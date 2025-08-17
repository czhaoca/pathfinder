/**
 * Feature Flag Management API Routes
 * 
 * Comprehensive REST API for feature flag administration:
 * - Flag CRUD operations
 * - Self-registration toggle with DDoS protection
 * - Emergency kill switches
 * - Flag evaluation endpoints
 * - Metrics and analytics
 */

const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { authenticateToken } = require('../middleware/authMiddleware');
const { requireRole } = require('../../middleware/rbac');
const { EnhancedFeatureFlagService } = require('../../services/enhancedFeatureFlagService');
const { logger } = require('../../utils/logger');
const { apiResponse } = require('../../utils/apiResponse');
const { body, query, param, validationResult } = require('express-validator');

// Rate limiters for different operations
const evaluationLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 1000, // Very high limit for flag evaluation
  message: 'Too many flag evaluations, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit admin operations
  message: 'Too many admin operations, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

const emergencyLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // Strict limit for emergency operations
  message: 'Emergency operation rate limit exceeded',
  standardHeaders: true,
  legacyHeaders: false,
});

// Service instance (injected via DI)
let flagService;

// Middleware to inject service
router.use((req, res, next) => {
  if (!flagService) {
    flagService = req.app.get('featureFlagService');
  }
  next();
});

// Validation middleware
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json(apiResponse.error('Validation failed', errors.array()));
  }
  next();
};

/**
 * @route GET /api/feature-flags
 * @desc Get all feature flags with optional filtering
 * @access Admin
 */
router.get('/', 
  authenticateToken, 
  requireRole(['admin', 'site_admin']),
  [
    query('category').optional().isString(),
    query('enabled').optional().isBoolean(),
    query('system_wide').optional().isBoolean()
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { category, enabled, system_wide } = req.query;
      
      let flags = Array.from(flagService.flags.values());
      
      // Apply filters
      if (category) {
        flags = flags.filter(f => f.category === category);
      }
      if (enabled !== undefined) {
        flags = flags.filter(f => (f.enabled === 'Y') === enabled);
      }
      if (system_wide !== undefined) {
        flags = flags.filter(f => (f.is_system_wide === 'Y') === system_wide);
      }
      
      res.json(apiResponse.success({
        flags,
        count: flags.length,
        metrics: flagService.getMetrics()
      }));
    } catch (error) {
      logger.error('Error fetching feature flags:', error);
      res.status(500).json(apiResponse.error('Failed to fetch feature flags'));
    }
  }
);

/**
 * @route GET /api/feature-flags/evaluate
 * @desc Evaluate multiple feature flags for current user
 * @access Authenticated
 */
router.post('/evaluate',
  evaluationLimiter,
  authenticateToken,
  [
    body('flags').isArray().notEmpty(),
    body('context').optional().isObject()
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { flags, context = {} } = req.body;
      
      // Build evaluation context
      const evalContext = {
        userId: req.user.id,
        userRoles: req.user.roles || [],
        groupId: req.user.group_id,
        ...context,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      };
      
      const results = {};
      for (const flagKey of flags) {
        const evaluation = await flagService.evaluateFlag(flagKey, evalContext);
        results[flagKey] = {
          value: evaluation.value,
          reason: evaluation.reason
        };
      }
      
      res.json(apiResponse.success(results));
    } catch (error) {
      logger.error('Error evaluating feature flags:', error);
      res.status(500).json(apiResponse.error('Failed to evaluate feature flags'));
    }
  }
);

/**
 * @route GET /api/feature-flags/:key
 * @desc Get specific feature flag details
 * @access Admin
 */
router.get('/:key',
  authenticateToken,
  requireRole(['admin', 'site_admin']),
  [
    param('key').notEmpty().isString()
  ],
  validateRequest,
  async (req, res) => {
    try {
      const flag = flagService.flags.get(req.params.key);
      
      if (!flag) {
        return res.status(404).json(apiResponse.error('Feature flag not found'));
      }
      
      // Get additional details from database
      const history = await flagService.getFlagHistory(flag.flag_id, 10);
      const evaluations = await flagService.getFlagEvaluations(flag.flag_id, '24h');
      
      res.json(apiResponse.success({
        flag,
        history,
        evaluations
      }));
    } catch (error) {
      logger.error(`Error fetching flag ${req.params.key}:`, error);
      res.status(500).json(apiResponse.error('Failed to fetch feature flag'));
    }
  }
);

/**
 * @route POST /api/feature-flags
 * @desc Create new feature flag
 * @access Admin
 */
router.post('/',
  authenticateToken,
  requireRole(['admin', 'site_admin']),
  [
    body('flag_key').notEmpty().matches(/^[a-z0-9_]+$/),
    body('flag_name').notEmpty().isString(),
    body('description').optional().isString(),
    body('flag_type').isIn(['boolean', 'percentage', 'variant', 'numeric', 'string']),
    body('default_value').notEmpty(),
    body('category').optional().isString(),
    body('is_system_wide').optional().isBoolean(),
    body('rollout_percentage').optional().isInt({ min: 0, max: 100 })
  ],
  validateRequest,
  async (req, res) => {
    try {
      const flagData = {
        ...req.body,
        created_by: req.user.id
      };
      
      // Check if flag already exists
      if (flagService.flags.has(flagData.flag_key)) {
        return res.status(400).json(apiResponse.error('Feature flag already exists'));
      }
      
      const flagId = await flagService.createFlag(flagData);
      
      // Reload flags
      await flagService.loadAllFlags();
      
      // Audit log
      await req.app.get('auditService').log({
        action: 'create_feature_flag',
        entity_type: 'feature_flag',
        entity_id: flagId,
        details: flagData,
        user_id: req.user.id
      });
      
      res.status(201).json(apiResponse.success({
        flag_id: flagId,
        flag_key: flagData.flag_key,
        message: 'Feature flag created successfully'
      }));
    } catch (error) {
      logger.error('Error creating feature flag:', error);
      res.status(500).json(apiResponse.error('Failed to create feature flag'));
    }
  }
);

/**
 * @route PUT /api/feature-flags/:key
 * @desc Update feature flag
 * @access Admin
 */
router.put('/:key',
  authenticateToken,
  requireRole(['admin', 'site_admin']),
  [
    param('key').notEmpty().isString(),
    body('reason').notEmpty().isString(),
    body('updates').isObject().notEmpty()
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { reason, updates } = req.body;
      
      const updatedFlag = await flagService.updateFlag(
        req.params.key,
        updates,
        reason,
        req.user.id
      );
      
      res.json(apiResponse.success({
        flag: updatedFlag,
        message: 'Feature flag updated successfully'
      }));
    } catch (error) {
      logger.error(`Error updating flag ${req.params.key}:`, error);
      res.status(500).json(apiResponse.error('Failed to update feature flag'));
    }
  }
);

/**
 * @route DELETE /api/feature-flags/:key
 * @desc Archive/disable feature flag
 * @access Admin
 */
router.delete('/:key',
  authenticateToken,
  requireRole(['admin', 'site_admin']),
  [
    param('key').notEmpty().isString(),
    body('reason').notEmpty().isString()
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { reason } = req.body;
      
      await flagService.updateFlag(
        req.params.key,
        { is_archived: 'Y', enabled: 'N' },
        reason,
        req.user.id
      );
      
      // Remove from memory
      flagService.flags.delete(req.params.key);
      
      res.json(apiResponse.success({
        message: 'Feature flag archived successfully'
      }));
    } catch (error) {
      logger.error(`Error deleting flag ${req.params.key}:`, error);
      res.status(500).json(apiResponse.error('Failed to delete feature flag'));
    }
  }
);

/**
 * @route POST /api/feature-flags/self-registration/toggle
 * @desc Toggle self-registration with DDoS protection
 * @access Admin
 */
router.post('/self-registration/toggle',
  authenticateToken,
  requireRole(['admin', 'site_admin']),
  [
    body('enabled').isBoolean().notEmpty(),
    body('reason').notEmpty().isString()
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { enabled, reason } = req.body;
      
      const result = await flagService.toggleSelfRegistration(
        enabled,
        reason,
        req.user.id
      );
      
      res.json(apiResponse.success({
        ...result,
        message: `Self-registration ${enabled ? 'enabled' : 'disabled'} successfully`
      }));
    } catch (error) {
      logger.error('Error toggling self-registration:', error);
      res.status(500).json(apiResponse.error('Failed to toggle self-registration'));
    }
  }
);

/**
 * @route GET /api/feature-flags/self-registration/metrics
 * @desc Get self-registration metrics and DDoS protection status
 * @access Admin
 */
router.get('/self-registration/metrics',
  authenticateToken,
  requireRole(['admin', 'site_admin']),
  [
    query('timeRange').optional().isIn(['1h', '24h', '7d', '30d'])
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { timeRange = '24h' } = req.query;
      
      const metrics = await flagService.getRegistrationMetrics(timeRange);
      const protection = flagService.registrationProtection;
      
      res.json(apiResponse.success({
        metrics,
        protection,
        currentStatus: flagService.flags.get('self_registration_enabled')?.default_value === 'true'
      }));
    } catch (error) {
      logger.error('Error fetching registration metrics:', error);
      res.status(500).json(apiResponse.error('Failed to fetch registration metrics'));
    }
  }
);

/**
 * @route POST /api/feature-flags/self-registration/protection
 * @desc Update DDoS protection settings
 * @access Admin
 */
router.post('/self-registration/protection',
  authenticateToken,
  requireRole(['admin', 'site_admin']),
  [
    body('rateLimit').optional().isInt({ min: 1, max: 100 }),
    body('windowMinutes').optional().isInt({ min: 1, max: 60 }),
    body('blockDurationMinutes').optional().isInt({ min: 1, max: 1440 }),
    body('captchaThreshold').optional().isInt({ min: 1, max: 10 }),
    body('suspicionThreshold').optional().isFloat({ min: 0, max: 1 })
  ],
  validateRequest,
  async (req, res) => {
    try {
      const updates = req.body;
      
      // Update protection settings
      Object.assign(flagService.registrationProtection, updates);
      
      // Save to cache
      if (flagService.cache) {
        await flagService.cache.setex(
          'registration:protection',
          86400,
          JSON.stringify(flagService.registrationProtection)
        );
      }
      
      // Audit log
      await req.app.get('auditService').log({
        action: 'update_ddos_protection',
        entity_type: 'system_config',
        entity_id: 'registration_protection',
        details: updates,
        user_id: req.user.id
      });
      
      res.json(apiResponse.success({
        protection: flagService.registrationProtection,
        message: 'DDoS protection settings updated successfully'
      }));
    } catch (error) {
      logger.error('Error updating DDoS protection:', error);
      res.status(500).json(apiResponse.error('Failed to update DDoS protection settings'));
    }
  }
);

/**
 * @route POST /api/feature-flags/:key/emergency-disable
 * @desc Emergency disable a feature flag
 * @access Admin
 */
router.post('/:key/emergency-disable',
  emergencyLimiter,
  authenticateToken,
  requireRole(['admin', 'site_admin']),
  [
    param('key').notEmpty().isString(),
    body('reason').notEmpty().isString()
  ],
  validateRequest,
  async (req, res) => {
    try {
      const result = await flagService.emergencyDisable(
        req.params.key,
        req.body.reason,
        req.user.id
      );
      
      res.json(apiResponse.success(result));
    } catch (error) {
      logger.error(`Error emergency disabling ${req.params.key}:`, error);
      res.status(500).json(apiResponse.error('Failed to emergency disable feature'));
    }
  }
);

/**
 * @route POST /api/feature-flags/:key/rollback
 * @desc Rollback feature flag to previous state
 * @access Admin
 */
router.post('/:key/rollback',
  authenticateToken,
  requireRole(['admin', 'site_admin']),
  [
    param('key').notEmpty().isString(),
    body('historyId').notEmpty().isString()
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { historyId } = req.body;
      
      const result = await flagService.rollbackFlag(
        req.params.key,
        historyId,
        req.user.id
      );
      
      res.json(apiResponse.success({
        flag: result,
        message: 'Feature flag rolled back successfully'
      }));
    } catch (error) {
      logger.error(`Error rolling back ${req.params.key}:`, error);
      res.status(500).json(apiResponse.error('Failed to rollback feature flag'));
    }
  }
);

/**
 * @route GET /api/feature-flags/:key/history
 * @desc Get feature flag change history
 * @access Admin
 */
router.get('/:key/history',
  authenticateToken,
  requireRole(['admin', 'site_admin']),
  [
    param('key').notEmpty().isString(),
    query('limit').optional().isInt({ min: 1, max: 100 })
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { limit = 20 } = req.query;
      
      const flag = flagService.flags.get(req.params.key);
      if (!flag) {
        return res.status(404).json(apiResponse.error('Feature flag not found'));
      }
      
      const history = await flagService.getFlagHistory(flag.flag_id, limit);
      
      res.json(apiResponse.success({
        flag_key: req.params.key,
        history
      }));
    } catch (error) {
      logger.error(`Error fetching history for ${req.params.key}:`, error);
      res.status(500).json(apiResponse.error('Failed to fetch flag history'));
    }
  }
);

/**
 * @route POST /api/feature-flags/:key/override
 * @desc Set user or group override for feature flag
 * @access Admin
 */
router.post('/:key/override',
  authenticateToken,
  requireRole(['admin', 'site_admin']),
  [
    param('key').notEmpty().isString(),
    body('type').isIn(['user', 'group']),
    body('targetId').notEmpty().isString(),
    body('enabled').isBoolean(),
    body('reason').notEmpty().isString()
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { type, targetId, enabled, reason } = req.body;
      
      const flag = flagService.flags.get(req.params.key);
      if (!flag) {
        return res.status(404).json(apiResponse.error('Feature flag not found'));
      }
      
      await flagService.setOverride(
        flag.flag_id,
        type,
        targetId,
        enabled,
        reason,
        req.user.id
      );
      
      res.json(apiResponse.success({
        message: `Override set successfully for ${type} ${targetId}`
      }));
    } catch (error) {
      logger.error(`Error setting override for ${req.params.key}:`, error);
      res.status(500).json(apiResponse.error('Failed to set override'));
    }
  }
);

/**
 * @route GET /api/feature-flags/categories
 * @desc Get all flag categories
 * @access Admin
 */
router.get('/categories',
  authenticateToken,
  requireRole(['admin', 'site_admin']),
  async (req, res) => {
    try {
      const categories = Array.from(flagService.flagsByCategory.keys());
      
      const categoryCounts = {};
      for (const category of categories) {
        categoryCounts[category] = flagService.flagsByCategory.get(category).size;
      }
      
      res.json(apiResponse.success({
        categories,
        counts: categoryCounts
      }));
    } catch (error) {
      logger.error('Error fetching categories:', error);
      res.status(500).json(apiResponse.error('Failed to fetch categories'));
    }
  }
);

/**
 * @route GET /api/feature-flags/system/metrics
 * @desc Get feature flag system metrics
 * @access Admin
 */
router.get('/system/metrics',
  authenticateToken,
  requireRole(['admin', 'site_admin']),
  async (req, res) => {
    try {
      const metrics = flagService.getMetrics();
      const cacheStats = flagService.cache ? await flagService.cache.getStats() : null;
      
      res.json(apiResponse.success({
        flagMetrics: metrics,
        cacheStats,
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage()
      }));
    } catch (error) {
      logger.error('Error fetching system metrics:', error);
      res.status(500).json(apiResponse.error('Failed to fetch system metrics'));
    }
  }
);

module.exports = router;