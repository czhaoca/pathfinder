/**
 * Configuration Management API Routes
 * 
 * Provides REST endpoints for:
 * - System configuration management
 * - Environment-specific overrides
 * - Feature flag management
 * - Rate limit configuration
 * - Configuration templates
 * - Audit and rollback functionality
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const { requireRole } = require('../../middleware/rbac');
const { ConfigurationService } = require('../../services/configurationService');
const { logger } = require('../../utils/logger');
const { apiResponse } = require('../../utils/apiResponse');

// Initialize service (will be injected via DI in real app)
let configService;

// Middleware to inject service
router.use((req, res, next) => {
  if (!configService) {
    configService = req.app.get('configurationService');
  }
  next();
});

/**
 * @route GET /api/config
 * @desc Get all configurations for an environment
 * @access Admin
 */
router.get('/', authenticateToken, requireRole(['admin', 'site_admin']), async (req, res) => {
  try {
    const { environment } = req.query;
    const configurations = await configService.getAllConfigurations(environment);
    
    res.json(apiResponse.success({
      configurations,
      environment: environment || 'global',
      count: configurations.length
    }));
  } catch (error) {
    logger.error('Error getting all configurations:', error);
    res.status(500).json(apiResponse.error('Failed to retrieve configurations'));
  }
});

/**
 * @route GET /api/config/:key
 * @desc Get specific configuration value
 * @access Authenticated
 */
router.get('/:key', authenticateToken, async (req, res) => {
  try {
    const { key } = req.params;
    const { environment } = req.query;
    
    const value = await configService.getValue(key, environment, req.user.id);
    
    res.json(apiResponse.success({
      key,
      value,
      environment: environment || 'global'
    }));
  } catch (error) {
    if (error.message.includes('not found')) {
      res.status(404).json(apiResponse.error(`Configuration key not found: ${req.params.key}`));
    } else {
      logger.error(`Error getting configuration ${req.params.key}:`, error);
      res.status(500).json(apiResponse.error('Failed to retrieve configuration'));
    }
  }
});

/**
 * @route PUT /api/config/:key
 * @desc Update configuration value
 * @access Admin
 */
router.put('/:key', authenticateToken, requireRole(['admin', 'site_admin']), async (req, res) => {
  try {
    const { key } = req.params;
    const { value, environment, reason } = req.body;
    
    // Validate request
    if (value === undefined) {
      return res.status(400).json(apiResponse.error('Value is required'));
    }
    
    const result = await configService.setValue(
      key, 
      value, 
      environment, 
      req.user.id, 
      reason
    );
    
    res.json(apiResponse.success({
      key,
      value,
      environment: environment || 'global',
      ...result
    }));
  } catch (error) {
    if (error.message.includes('not found')) {
      res.status(404).json(apiResponse.error(`Configuration key not found: ${req.params.key}`));
    } else if (error.message.includes('validation') || error.message.includes('Invalid')) {
      res.status(400).json(apiResponse.error(error.message));
    } else {
      logger.error(`Error updating configuration ${req.params.key}:`, error);
      res.status(500).json(apiResponse.error('Failed to update configuration'));
    }
  }
});

/**
 * @route GET /api/config/:key/history
 * @desc Get configuration change history
 * @access Admin
 */
router.get('/:key/history', authenticateToken, requireRole(['admin', 'site_admin']), async (req, res) => {
  try {
    const { key } = req.params;
    const { limit = 50 } = req.query;
    
    const history = await configService.getConfigurationHistory(key, parseInt(limit));
    
    res.json(apiResponse.success({
      key,
      history,
      count: history.length
    }));
  } catch (error) {
    logger.error(`Error getting configuration history for ${req.params.key}:`, error);
    res.status(500).json(apiResponse.error('Failed to retrieve configuration history'));
  }
});

/**
 * @route POST /api/config/:key/rollback
 * @desc Rollback configuration to previous value
 * @access Site Admin
 */
router.post('/:key/rollback', authenticateToken, requireRole(['site_admin']), async (req, res) => {
  try {
    const { key } = req.params;
    const { environment, steps = 1, reason } = req.body;
    
    if (steps < 1 || steps > 10) {
      return res.status(400).json(apiResponse.error('Steps must be between 1 and 10'));
    }
    
    const result = await configService.rollback(key, environment, steps, req.user.id);
    
    res.json(apiResponse.success({
      key,
      environment: environment || 'global',
      reason,
      ...result
    }));
  } catch (error) {
    if (error.message.includes('No rollback history')) {
      res.status(404).json(apiResponse.error('No rollback history available'));
    } else {
      logger.error(`Error rolling back configuration ${req.params.key}:`, error);
      res.status(500).json(apiResponse.error('Failed to rollback configuration'));
    }
  }
});

// Feature Flags Management

/**
 * @route GET /api/config/features/flags
 * @desc Get all feature flags
 * @access Admin
 */
router.get('/features/flags', authenticateToken, requireRole(['admin', 'site_admin']), async (req, res) => {
  try {
    const flags = await configService.getActiveFeatureFlags();
    
    res.json(apiResponse.success({
      flags,
      count: flags.length
    }));
  } catch (error) {
    logger.error('Error getting feature flags:', error);
    res.status(500).json(apiResponse.error('Failed to retrieve feature flags'));
  }
});

/**
 * @route GET /api/config/features/:featureKey
 * @desc Check if feature is enabled for current user
 * @access Authenticated
 */
router.get('/features/:featureKey', authenticateToken, async (req, res) => {
  try {
    const { featureKey } = req.params;
    const { environment } = req.query;
    
    const context = {
      userId: req.user.id,
      userRoles: req.user.roles || [],
      environment: environment || process.env.NODE_ENV,
      ip: req.ip
    };
    
    const enabled = await configService.isFeatureEnabled(featureKey, context);
    
    res.json(apiResponse.success({
      feature_key: featureKey,
      enabled,
      user_id: req.user.id,
      environment: context.environment
    }));
  } catch (error) {
    logger.error(`Error checking feature flag ${req.params.featureKey}:`, error);
    res.status(500).json(apiResponse.error('Failed to check feature flag'));
  }
});

/**
 * @route POST /api/config/features/:featureKey/enable
 * @desc Enable feature flag
 * @access Admin
 */
router.post('/features/:featureKey/enable', authenticateToken, requireRole(['admin', 'site_admin']), async (req, res) => {
  try {
    const { featureKey } = req.params;
    const { rollout_percentage = 100, targeting_rules, reason } = req.body;
    
    // Update feature flag in database
    const sql = `
      UPDATE pf_feature_flags 
      SET is_enabled = 1, 
          rollout_percentage = ?,
          targeting_rules = ?,
          updated_at = CURRENT_TIMESTAMP,
          updated_by = ?
      WHERE feature_key = ?
    `;
    
    const db = req.app.get('db');
    const result = await db.execute(sql, [
      rollout_percentage,
      targeting_rules ? JSON.stringify(targeting_rules) : null,
      req.user.id,
      featureKey
    ]);
    
    if (result.rowsAffected === 0) {
      return res.status(404).json(apiResponse.error('Feature flag not found'));
    }
    
    // Clear cache
    await configService.cache.invalidate(featureKey);
    
    res.json(apiResponse.success({
      feature_key: featureKey,
      enabled: true,
      rollout_percentage,
      reason
    }));
  } catch (error) {
    logger.error(`Error enabling feature flag ${req.params.featureKey}:`, error);
    res.status(500).json(apiResponse.error('Failed to enable feature flag'));
  }
});

/**
 * @route POST /api/config/features/:featureKey/disable
 * @desc Disable feature flag
 * @access Admin
 */
router.post('/features/:featureKey/disable', authenticateToken, requireRole(['admin', 'site_admin']), async (req, res) => {
  try {
    const { featureKey } = req.params;
    const { reason } = req.body;
    
    // Update feature flag in database
    const sql = `
      UPDATE pf_feature_flags 
      SET is_enabled = 0,
          updated_at = CURRENT_TIMESTAMP,
          updated_by = ?
      WHERE feature_key = ?
    `;
    
    const db = req.app.get('db');
    const result = await db.execute(sql, [req.user.id, featureKey]);
    
    if (result.rowsAffected === 0) {
      return res.status(404).json(apiResponse.error('Feature flag not found'));
    }
    
    // Clear cache
    await configService.cache.invalidate(featureKey);
    
    res.json(apiResponse.success({
      feature_key: featureKey,
      enabled: false,
      reason
    }));
  } catch (error) {
    logger.error(`Error disabling feature flag ${req.params.featureKey}:`, error);
    res.status(500).json(apiResponse.error('Failed to disable feature flag'));
  }
});

// Rate Limits Management

/**
 * @route GET /api/config/rate-limits
 * @desc Get all rate limit configurations
 * @access Admin
 */
router.get('/rate-limits', authenticateToken, requireRole(['admin', 'site_admin']), async (req, res) => {
  try {
    const { environment } = req.query;
    
    let sql = `
      SELECT * FROM pf_rate_limits 
      WHERE is_active = 1
    `;
    const params = [];
    
    if (environment) {
      sql += ` AND (environment = ? OR environment IS NULL)`;
      params.push(environment);
    }
    
    sql += ` ORDER BY priority DESC, limit_key`;
    
    const db = req.app.get('db');
    const rateLimits = await db.query(sql, params);
    
    res.json(apiResponse.success({
      rate_limits: rateLimits,
      environment: environment || 'all',
      count: rateLimits.length
    }));
  } catch (error) {
    logger.error('Error getting rate limits:', error);
    res.status(500).json(apiResponse.error('Failed to retrieve rate limits'));
  }
});

/**
 * @route GET /api/config/rate-limits/:key
 * @desc Get specific rate limit configuration
 * @access Authenticated
 */
router.get('/rate-limits/:key', authenticateToken, async (req, res) => {
  try {
    const { key } = req.params;
    const { scope = 'global' } = req.query;
    
    const context = {
      userId: req.user.id,
      userRoles: req.user.roles || [],
      ip: req.ip
    };
    
    const rateLimit = await configService.getRateLimit(key, scope, context);
    
    res.json(apiResponse.success({
      limit_key: key,
      scope,
      ...rateLimit
    }));
  } catch (error) {
    logger.error(`Error getting rate limit ${req.params.key}:`, error);
    res.status(500).json(apiResponse.error('Failed to retrieve rate limit'));
  }
});

// Configuration Templates

/**
 * @route GET /api/config/templates
 * @desc Get all configuration templates
 * @access Admin
 */
router.get('/templates', authenticateToken, requireRole(['admin', 'site_admin']), async (req, res) => {
  try {
    const { template_type } = req.query;
    
    let sql = `
      SELECT * FROM pf_config_templates 
      WHERE is_active = 1
    `;
    const params = [];
    
    if (template_type) {
      sql += ` AND template_type = ?`;
      params.push(template_type);
    }
    
    sql += ` ORDER BY is_default DESC, usage_count DESC, template_name`;
    
    const db = req.app.get('db');
    const templates = await db.query(sql, params);
    
    res.json(apiResponse.success({
      templates,
      count: templates.length
    }));
  } catch (error) {
    logger.error('Error getting configuration templates:', error);
    res.status(500).json(apiResponse.error('Failed to retrieve templates'));
  }
});

/**
 * @route POST /api/config/templates/:templateName/apply
 * @desc Apply configuration template
 * @access Admin
 */
router.post('/templates/:templateName/apply', authenticateToken, requireRole(['admin', 'site_admin']), async (req, res) => {
  try {
    const { templateName } = req.params;
    const { environment, reason } = req.body;
    
    if (!environment) {
      return res.status(400).json(apiResponse.error('Environment is required'));
    }
    
    const results = await configService.applyTemplate(templateName, environment, req.user.id);
    
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    res.json(apiResponse.success({
      template_name: templateName,
      environment,
      reason,
      results,
      summary: {
        total: results.length,
        successful,
        failed
      }
    }));
  } catch (error) {
    if (error.message.includes('not found')) {
      res.status(404).json(apiResponse.error(`Template not found: ${req.params.templateName}`));
    } else {
      logger.error(`Error applying template ${req.params.templateName}:`, error);
      res.status(500).json(apiResponse.error('Failed to apply template'));
    }
  }
});

// Bulk Operations

/**
 * @route POST /api/config/bulk-update
 * @desc Update multiple configurations at once
 * @access Site Admin
 */
router.post('/bulk-update', authenticateToken, requireRole(['site_admin']), async (req, res) => {
  try {
    const { configurations, environment, reason } = req.body;
    
    if (!Array.isArray(configurations) || configurations.length === 0) {
      return res.status(400).json(apiResponse.error('Configurations array is required'));
    }
    
    const results = [];
    
    for (const config of configurations) {
      try {
        const result = await configService.setValue(
          config.key,
          config.value,
          environment,
          req.user.id,
          reason || `Bulk update: ${config.key}`
        );
        
        results.push({
          key: config.key,
          success: true,
          ...result
        });
      } catch (error) {
        results.push({
          key: config.key,
          success: false,
          error: error.message
        });
      }
    }
    
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    res.json(apiResponse.success({
      environment: environment || 'global',
      reason,
      results,
      summary: {
        total: results.length,
        successful,
        failed
      }
    }));
  } catch (error) {
    logger.error('Error in bulk configuration update:', error);
    res.status(500).json(apiResponse.error('Failed to perform bulk update'));
  }
});

/**
 * @route POST /api/config/validate
 * @desc Validate configuration values before applying
 * @access Admin
 */
router.post('/validate', authenticateToken, requireRole(['admin', 'site_admin']), async (req, res) => {
  try {
    const { configurations } = req.body;
    
    if (!Array.isArray(configurations)) {
      return res.status(400).json(apiResponse.error('Configurations array is required'));
    }
    
    const validationResults = [];
    
    for (const config of configurations) {
      try {
        // Get configuration schema for validation
        const db = req.app.get('db');
        const configSchema = await db.queryOne(
          'SELECT * FROM pf_system_config WHERE config_key = ?',
          [config.key]
        );
        
        if (!configSchema) {
          validationResults.push({
            key: config.key,
            valid: false,
            error: 'Configuration key not found'
          });
          continue;
        }
        
        // Validate using the service's internal validation
        configService._validateValue(config.value, configSchema);
        
        validationResults.push({
          key: config.key,
          valid: true
        });
      } catch (error) {
        validationResults.push({
          key: config.key,
          valid: false,
          error: error.message
        });
      }
    }
    
    const allValid = validationResults.every(r => r.valid);
    
    res.json(apiResponse.success({
      all_valid: allValid,
      results: validationResults
    }));
  } catch (error) {
    logger.error('Error validating configurations:', error);
    res.status(500).json(apiResponse.error('Failed to validate configurations'));
  }
});

// Health and Status

/**
 * @route GET /api/config/health
 * @desc Get configuration system health status
 * @access Admin
 */
router.get('/health', authenticateToken, requireRole(['admin', 'site_admin']), async (req, res) => {
  try {
    const db = req.app.get('db');
    
    // Check database connectivity
    const configCount = await db.queryOne('SELECT COUNT(*) as count FROM pf_system_config');
    const flagCount = await db.queryOne('SELECT COUNT(*) as count FROM pf_feature_flags WHERE is_active = 1');
    const rateLimitCount = await db.queryOne('SELECT COUNT(*) as count FROM pf_rate_limits WHERE is_active = 1');
    
    // Check cache status
    const cacheStats = {
      local_cache_size: configService.cache.localCache.size,
      feature_flag_cache_size: configService.featureFlagCache.size
    };
    
    // Check for configurations requiring restart
    const restartRequired = await db.query(
      'SELECT config_key FROM pf_system_config WHERE requires_restart = 1 AND updated_at > ?',
      [new Date(Date.now() - 24 * 60 * 60 * 1000)] // Last 24 hours
    );
    
    res.json(apiResponse.success({
      status: 'healthy',
      database: {
        configurations: configCount.COUNT,
        feature_flags: flagCount.COUNT,
        rate_limits: rateLimitCount.COUNT
      },
      cache: cacheStats,
      restart_required: restartRequired.map(r => r.CONFIG_KEY),
      timestamp: new Date().toISOString()
    }));
  } catch (error) {
    logger.error('Error checking configuration health:', error);
    res.status(500).json(apiResponse.error('Configuration system health check failed'));
  }
});

module.exports = router;