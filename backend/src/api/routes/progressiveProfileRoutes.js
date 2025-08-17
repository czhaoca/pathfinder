/**
 * Progressive Profile Management API Routes
 */

const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { authenticateToken } = require('../middleware/auth');
const ProfileFieldsService = require('../../services/ProfileFieldsService');
const ProfileCompletionService = require('../../services/ProfileCompletionService');
const { getDb } = require('../../config/database');
const logger = require('../../utils/logger');

// Rate limiter for profile updates
const profileUpdateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // Limit each user to 30 profile updates per window
  message: 'Too many profile updates, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.userId || req.ip, // Rate limit by user ID if authenticated
});

// Stricter rate limiter for bulk operations
const bulkOperationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Limit bulk operations to 5 per hour
  message: 'Too many bulk operations, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

// Initialize services
let profileFieldsService;
let profileCompletionService;

async function initializeServices() {
  const db = await getDb();
  const encryptionService = require('../../services/encryptionService');
  const cacheService = require('../../services/cacheService');
  
  profileFieldsService = new ProfileFieldsService(db, encryptionService, cacheService);
  profileCompletionService = new ProfileCompletionService(db, profileFieldsService, cacheService);
}

// Initialize services on module load
initializeServices().catch(err => {
  logger.error('Failed to initialize profile services', err);
});

/**
 * Get all profile fields
 * GET /api/progressive-profile/fields
 */
router.get('/fields', authenticateToken, async (req, res) => {
  try {
    const { group, essential, active } = req.query;
    
    const filters = {};
    if (group) filters.group = group;
    if (essential !== undefined) filters.isEssential = essential === 'true';
    if (active !== undefined) filters.isActive = active === 'true';

    const fields = await profileFieldsService.getAllFields(filters);
    
    res.json({
      success: true,
      fields
    });
  } catch (error) {
    logger.error('Failed to get profile fields', { error, userId: req.user.userId });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve profile fields'
    });
  }
});

/**
 * Get user's profile data
 * GET /api/progressive-profile/data
 */
router.get('/data', authenticateToken, async (req, res) => {
  try {
    const { includeMetadata } = req.query;
    const userId = req.user.userId;

    const profileData = await profileFieldsService.getUserProfileData(
      userId,
      includeMetadata === 'true'
    );

    res.json({
      success: true,
      profile: profileData
    });
  } catch (error) {
    logger.error('Failed to get user profile data', { error, userId: req.user.userId });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve profile data'
    });
  }
});

/**
 * Update user's profile data (partial update)
 * PATCH /api/progressive-profile/data
 */
router.patch('/data', authenticateToken, profileUpdateLimiter, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { fields, source = 'manual' } = req.body;

    if (!fields || typeof fields !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Invalid fields data'
      });
    }

    const result = await profileFieldsService.saveUserProfileData(
      userId,
      fields,
      source
    );

    // Update completion tracking
    const completionStats = await profileCompletionService.updateCompletionTracking(userId);

    res.json({
      success: true,
      result,
      completionStats
    });
  } catch (error) {
    logger.error('Failed to update profile data', { error, userId: req.user.userId });
    res.status(500).json({
      success: false,
      error: 'Failed to update profile data'
    });
  }
});

/**
 * Get profile completion statistics
 * GET /api/progressive-profile/completion
 */
router.get('/completion', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const stats = await profileCompletionService.getCompletionStats(userId);

    res.json({
      success: true,
      stats
    });
  } catch (error) {
    logger.error('Failed to get completion stats', { error, userId: req.user.userId });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve completion statistics'
    });
  }
});

/**
 * Get field suggestions for profile completion
 * GET /api/progressive-profile/suggestions
 */
router.get('/suggestions', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { limit = 5 } = req.query;

    const suggestions = await profileCompletionService.getFieldSuggestions(
      userId,
      parseInt(limit)
    );

    res.json({
      success: true,
      suggestions
    });
  } catch (error) {
    logger.error('Failed to get field suggestions', { error, userId: req.user.userId });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve field suggestions'
    });
  }
});

/**
 * Check feature access requirements
 * GET /api/progressive-profile/feature-access/:featureKey
 */
router.get('/feature-access/:featureKey', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { featureKey } = req.params;

    const accessInfo = await profileFieldsService.checkFeatureAccess(userId, featureKey);

    res.json({
      success: true,
      ...accessInfo
    });
  } catch (error) {
    logger.error('Failed to check feature access', { 
      error, 
      userId: req.user.userId,
      featureKey: req.params.featureKey 
    });
    res.status(500).json({
      success: false,
      error: 'Failed to check feature access'
    });
  }
});

/**
 * Get pending prompts for user
 * GET /api/progressive-profile/prompts
 */
router.get('/prompts', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const prompts = await profileCompletionService.getPendingPrompts(userId);

    res.json({
      success: true,
      prompts
    });
  } catch (error) {
    logger.error('Failed to get pending prompts', { error, userId: req.user.userId });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve pending prompts'
    });
  }
});

/**
 * Create a field collection prompt
 * POST /api/progressive-profile/prompts
 */
router.post('/prompts', authenticateToken, profileUpdateLimiter, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { fieldId, featureKey, promptType = 'modal' } = req.body;

    if (!fieldId) {
      return res.status(400).json({
        success: false,
        error: 'Field ID is required'
      });
    }

    const result = await profileCompletionService.createFieldPrompt(
      userId,
      fieldId,
      featureKey,
      promptType
    );

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    logger.error('Failed to create prompt', { error, userId: req.user.userId });
    res.status(500).json({
      success: false,
      error: 'Failed to create prompt'
    });
  }
});

/**
 * Update prompt response
 * PATCH /api/progressive-profile/prompts/:promptId
 */
router.patch('/prompts/:promptId', authenticateToken, async (req, res) => {
  try {
    const { promptId } = req.params;
    const { response, remindAfter } = req.body;

    if (!response || !['provided', 'skipped', 'remind_later', 'dismissed'].includes(response)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid response type'
      });
    }

    await profileCompletionService.updatePromptResponse(
      promptId,
      response,
      remindAfter
    );

    res.json({
      success: true,
      message: 'Prompt response updated'
    });
  } catch (error) {
    logger.error('Failed to update prompt response', { 
      error, 
      userId: req.user.userId,
      promptId: req.params.promptId 
    });
    res.status(500).json({
      success: false,
      error: 'Failed to update prompt response'
    });
  }
});

/**
 * Import profile data from external source
 * POST /api/progressive-profile/import
 */
router.post('/import', authenticateToken, bulkOperationLimiter, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { source, data } = req.body;

    if (!source || !data) {
      return res.status(400).json({
        success: false,
        error: 'Source and data are required'
      });
    }

    if (!['linkedin', 'resume'].includes(source)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid import source'
      });
    }

    const result = await profileCompletionService.importProfileData(
      userId,
      source,
      data
    );

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    logger.error('Failed to import profile data', { 
      error, 
      userId: req.user.userId,
      source: req.body.source 
    });
    res.status(500).json({
      success: false,
      error: 'Failed to import profile data'
    });
  }
});

/**
 * Update reminder settings
 * PUT /api/progressive-profile/reminder-settings
 */
router.put('/reminder-settings', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { settings } = req.body;

    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Invalid reminder settings'
      });
    }

    await profileCompletionService.updateReminderSettings(userId, settings);

    res.json({
      success: true,
      message: 'Reminder settings updated'
    });
  } catch (error) {
    logger.error('Failed to update reminder settings', { 
      error, 
      userId: req.user.userId 
    });
    res.status(500).json({
      success: false,
      error: 'Failed to update reminder settings'
    });
  }
});

/**
 * Admin: Create or update field definition
 * POST /api/progressive-profile/admin/fields
 */
router.post('/admin/fields', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin (you may want to add proper admin check)
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Admin access required'
      });
    }

    const fieldData = req.body;

    if (!fieldData.fieldName || !fieldData.fieldLabel || !fieldData.fieldType) {
      return res.status(400).json({
        success: false,
        error: 'Field name, label, and type are required'
      });
    }

    const result = await profileFieldsService.createField(fieldData);

    res.json({
      success: true,
      field: result
    });
  } catch (error) {
    logger.error('Failed to create field', { error, userId: req.user.userId });
    res.status(500).json({
      success: false,
      error: 'Failed to create field'
    });
  }
});

/**
 * Admin: Update field definition
 * PUT /api/progressive-profile/admin/fields/:fieldId
 */
router.put('/admin/fields/:fieldId', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Admin access required'
      });
    }

    const { fieldId } = req.params;
    const updates = req.body;

    const success = await profileFieldsService.updateField(fieldId, updates);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Field not found or no changes made'
      });
    }

    res.json({
      success: true,
      message: 'Field updated successfully'
    });
  } catch (error) {
    logger.error('Failed to update field', { 
      error, 
      userId: req.user.userId,
      fieldId: req.params.fieldId 
    });
    res.status(500).json({
      success: false,
      error: 'Failed to update field'
    });
  }
});

/**
 * Admin: Set feature requirements
 * PUT /api/progressive-profile/admin/features/:featureKey/requirements
 */
router.put('/admin/features/:featureKey/requirements', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Admin access required'
      });
    }

    const { featureKey } = req.params;
    const { requirements } = req.body;

    if (!requirements || !Array.isArray(requirements)) {
      return res.status(400).json({
        success: false,
        error: 'Requirements must be an array'
      });
    }

    await profileFieldsService.setFeatureRequirements(featureKey, requirements);

    res.json({
      success: true,
      message: 'Feature requirements updated'
    });
  } catch (error) {
    logger.error('Failed to set feature requirements', { 
      error, 
      userId: req.user.userId,
      featureKey: req.params.featureKey 
    });
    res.status(500).json({
      success: false,
      error: 'Failed to set feature requirements'
    });
  }
});

module.exports = router;