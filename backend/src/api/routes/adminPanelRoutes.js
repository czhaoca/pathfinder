const express = require('express');
const router = express.Router();
const adminPanelController = require('../controllers/adminPanelController');
const { authenticate, requireRole } = require('../middleware/authMiddleware');
const { rateLimiter } = require('../middleware/rateLimiter');
const { validateRequest } = require('../middleware/validation');
const { body, query, param } = require('express-validator');

// All routes require authentication and admin role
router.use(authenticate);
router.use(requireRole(['admin', 'site_admin']));

// Apply rate limiting to admin endpoints
router.use(rateLimiter('admin'));

/**
 * Dashboard Routes
 */
router.get('/dashboard', 
  adminPanelController.getDashboard
);

/**
 * User Management Routes
 */
router.get('/users',
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('search').optional().trim(),
  query('status').optional().isIn(['active', 'inactive', 'suspended', 'deleted']),
  query('role').optional().isIn(['user', 'admin', 'site_admin', 'moderator']),
  validateRequest,
  adminPanelController.getUsers
);

router.get('/users/search',
  query('email').optional().isEmail(),
  query('createdAfter').optional().isISO8601(),
  query('createdBefore').optional().isISO8601(),
  query('lastActiveAfter').optional().isISO8601(),
  query('hasProfile').optional().isBoolean(),
  query('minExperiences').optional().isInt({ min: 0 }),
  validateRequest,
  adminPanelController.advancedUserSearch
);

router.post('/users/bulk',
  body('userIds').isArray().notEmpty(),
  body('userIds.*').isUUID(),
  body('operation').isIn(['suspend', 'activate', 'delete', 'reset_password']),
  body('reason').notEmpty().trim(),
  validateRequest,
  adminPanelController.bulkUserOperation
);

router.post('/users/:userId/impersonate',
  param('userId').isUUID(),
  validateRequest,
  requireRole('site_admin'), // Only site admins can impersonate
  adminPanelController.impersonateUser
);

router.put('/users/:userId/status',
  param('userId').isUUID(),
  body('status').isIn(['active', 'inactive', 'suspended']),
  body('reason').notEmpty().trim(),
  validateRequest,
  adminPanelController.updateUserStatus
);

router.post('/users/:userId/reset-password',
  param('userId').isUUID(),
  validateRequest,
  adminPanelController.resetUserPassword
);

/**
 * Feature Flag Routes
 */
router.get('/feature-flags',
  adminPanelController.getFeatureFlags
);

router.get('/feature-flags/:flagId',
  param('flagId').notEmpty(),
  validateRequest,
  adminPanelController.getFeatureFlag
);

router.put('/feature-flags/:flagId',
  param('flagId').notEmpty(),
  body('enabled').optional().isBoolean(),
  body('rolloutPercentage').optional().isInt({ min: 0, max: 100 }),
  body('targetGroups').optional().isArray(),
  body('conditions').optional().isArray(),
  body('reason').notEmpty().trim(),
  validateRequest,
  adminPanelController.updateFeatureFlag
);

router.post('/feature-flags/:flagId/test',
  param('flagId').notEmpty(),
  body('variants').isArray({ min: 2 }),
  body('variants.*.name').notEmpty(),
  body('variants.*.weight').isInt({ min: 0, max: 100 }),
  body('metrics').optional().isArray(),
  body('duration').optional().isInt({ min: 1, max: 90 }),
  validateRequest,
  adminPanelController.createABTest
);

router.get('/feature-flags/:flagId/metrics',
  param('flagId').notEmpty(),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601(),
  validateRequest,
  adminPanelController.getFeatureFlagMetrics
);

/**
 * System Configuration Routes
 */
router.get('/config',
  adminPanelController.getSystemConfig
);

router.get('/config/search',
  query('q').notEmpty().trim(),
  validateRequest,
  adminPanelController.searchConfig
);

router.put('/config/:key',
  param('key').notEmpty(),
  body('value').notEmpty(),
  body('reason').notEmpty().trim(),
  validateRequest,
  requireRole('site_admin'), // Only site admins can change config
  adminPanelController.updateSystemConfig
);

router.post('/config/backup',
  requireRole('site_admin'),
  adminPanelController.backupConfig
);

router.post('/config/restore/:backupId',
  param('backupId').isUUID(),
  body('reason').notEmpty().trim(),
  validateRequest,
  requireRole('site_admin'),
  adminPanelController.restoreConfig
);

/**
 * API Key Management Routes
 */
router.get('/api-keys',
  adminPanelController.getApiKeys
);

router.post('/api-keys',
  body('name').notEmpty().trim(),
  body('scopes').isArray().notEmpty(),
  body('scopes.*').isIn(['read', 'write', 'admin']),
  body('expiresIn').optional().isInt({ min: 1, max: 365 }),
  validateRequest,
  requireRole('site_admin'),
  adminPanelController.createApiKey
);

router.delete('/api-keys/:keyId',
  param('keyId').isUUID(),
  body('reason').notEmpty().trim(),
  validateRequest,
  requireRole('site_admin'),
  adminPanelController.revokeApiKey
);

/**
 * Invitation Management Routes
 */
router.get('/invitations',
  query('status').optional().isIn(['pending', 'accepted', 'expired']),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  validateRequest,
  adminPanelController.getInvitations
);

router.get('/invitations/dashboard',
  adminPanelController.getInvitationDashboard
);

router.post('/invitations/bulk',
  body('emails').isArray({ min: 1, max: 100 }),
  body('emails.*').isEmail(),
  body('template').optional().notEmpty(),
  body('customMessage').optional().trim(),
  body('role').optional().isIn(['user', 'moderator']),
  body('expiresIn').optional().isInt({ min: 1, max: 30 }),
  validateRequest,
  adminPanelController.sendBulkInvitations
);

router.post('/invitations/:invitationId/resend',
  param('invitationId').isUUID(),
  validateRequest,
  adminPanelController.resendInvitation
);

router.delete('/invitations/:invitationId',
  param('invitationId').isUUID(),
  body('reason').notEmpty().trim(),
  validateRequest,
  adminPanelController.cancelInvitation
);

/**
 * Security Settings Routes
 */
router.get('/security/policies',
  adminPanelController.getSecurityPolicies
);

router.put('/security/policies/:policyType',
  param('policyType').isIn(['password', 'session', 'mfa']),
  body('settings').notEmpty(),
  body('reason').notEmpty().trim(),
  validateRequest,
  requireRole('site_admin'),
  adminPanelController.updateSecurityPolicy
);

router.get('/security/rate-limits',
  adminPanelController.getRateLimits
);

router.put('/security/rate-limits',
  body('endpoint').notEmpty(),
  body('attempts').isInt({ min: 1, max: 1000 }),
  body('window').isInt({ min: 1, max: 86400 }),
  body('reason').notEmpty().trim(),
  validateRequest,
  requireRole('site_admin'),
  adminPanelController.updateRateLimits
);

router.post('/security/rate-limits/reset',
  body('userId').optional().isUUID(),
  body('ipAddress').optional().isIP(),
  body('endpoint').optional().notEmpty(),
  validateRequest,
  adminPanelController.resetRateLimits
);

router.get('/security/captcha',
  adminPanelController.getCaptchaSettings
);

router.put('/security/captcha',
  body('enabled').isBoolean(),
  body('threshold').optional().isInt({ min: 1, max: 10 }),
  body('provider').optional().isIn(['recaptcha', 'hcaptcha']),
  body('reason').notEmpty().trim(),
  validateRequest,
  requireRole('site_admin'),
  adminPanelController.updateCaptchaSettings
);

/**
 * Service Management Routes
 */
router.get('/services/health',
  adminPanelController.getServicesHealth
);

router.post('/services/:service/restart',
  param('service').isIn(['database', 'redis', 'mcp_server', 'email', 'storage']),
  body('reason').notEmpty().trim(),
  validateRequest,
  requireRole('site_admin'),
  adminPanelController.restartService
);

router.get('/services/:service/logs',
  param('service').isIn(['api', 'mcp_server', 'background_jobs']),
  query('lines').optional().isInt({ min: 1, max: 1000 }),
  query('level').optional().isIn(['error', 'warning', 'info', 'debug']),
  validateRequest,
  adminPanelController.getServiceLogs
);

/**
 * User Notes and Tags Routes
 */
router.get('/users/:userId/notes',
  param('userId').isUUID(),
  query('type').optional().isIn(['general', 'support', 'compliance', 'security', 'billing']),
  query('priority').optional().isIn(['low', 'normal', 'high', 'critical']),
  query('pinned').optional().isBoolean(),
  validateRequest,
  adminPanelController.getUserNotes
);

router.post('/users/:userId/notes',
  param('userId').isUUID(),
  body('text').notEmpty().trim(),
  body('type').optional().isIn(['general', 'support', 'compliance', 'security', 'billing']),
  body('priority').optional().isIn(['low', 'normal', 'high', 'critical']),
  body('pinned').optional().isBoolean(),
  body('internal').optional().isBoolean(),
  validateRequest,
  adminPanelController.addUserNote
);

router.put('/notes/:noteId',
  param('noteId').isUUID(),
  body('text').optional().trim(),
  body('type').optional().isIn(['general', 'support', 'compliance', 'security', 'billing']),
  body('priority').optional().isIn(['low', 'normal', 'high', 'critical']),
  body('pinned').optional().isBoolean(),
  body('internal').optional().isBoolean(),
  validateRequest,
  adminPanelController.updateUserNote
);

router.delete('/notes/:noteId',
  param('noteId').isUUID(),
  validateRequest,
  adminPanelController.deleteUserNote
);

router.get('/users/:userId/tags',
  param('userId').isUUID(),
  validateRequest,
  adminPanelController.getUserTags
);

router.post('/users/:userId/tags',
  param('userId').isUUID(),
  body('name').notEmpty().trim().isLength({ max: 50 }),
  body('color').optional().matches(/^#[0-9A-F]{6}$/i),
  validateRequest,
  adminPanelController.addUserTag
);

router.delete('/users/:userId/tags/:tagName',
  param('userId').isUUID(),
  param('tagName').notEmpty().trim(),
  validateRequest,
  adminPanelController.removeUserTag
);

router.get('/tags',
  adminPanelController.getAllTags
);

router.get('/users/by-tags',
  query('tags').notEmpty(),
  validateRequest,
  adminPanelController.searchUsersByTag
);

/**
 * Cache Management Routes
 */
router.get('/cache/stats',
  adminPanelController.getCacheStats
);

router.delete('/cache/:pattern',
  param('pattern').notEmpty(),
  body('reason').notEmpty().trim(),
  validateRequest,
  requireRole('site_admin'),
  adminPanelController.clearCache
);

router.post('/cache/warm',
  body('keys').isArray(),
  body('keys.*').notEmpty(),
  validateRequest,
  adminPanelController.warmCache
);

/**
 * Background Jobs Routes
 */
router.get('/jobs',
  query('status').optional().isIn(['queued', 'running', 'completed', 'failed']),
  query('type').optional().notEmpty(),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  validateRequest,
  adminPanelController.getBackgroundJobs
);

router.post('/jobs/:jobId/retry',
  param('jobId').isUUID(),
  validateRequest,
  adminPanelController.retryJob
);

router.delete('/jobs/:jobId',
  param('jobId').isUUID(),
  body('reason').notEmpty().trim(),
  validateRequest,
  adminPanelController.cancelJob
);

/**
 * Audit Log Routes
 */
router.get('/audit-logs',
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601(),
  query('userId').optional().isUUID(),
  query('action').optional().notEmpty(),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  validateRequest,
  adminPanelController.getAuditLogs
);

router.get('/audit-logs/export',
  query('format').optional().isIn(['json', 'csv', 'pdf']),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601(),
  validateRequest,
  requireRole('site_admin'),
  adminPanelController.exportAuditLogs
);

/**
 * System Backup Routes
 */
router.get('/backups',
  requireRole('site_admin'),
  adminPanelController.getBackups
);

router.post('/backups',
  body('type').isIn(['full', 'partial', 'config']),
  body('description').optional().trim(),
  validateRequest,
  requireRole('site_admin'),
  adminPanelController.createBackup
);

router.post('/backups/:backupId/restore',
  param('backupId').isUUID(),
  body('reason').notEmpty().trim(),
  validateRequest,
  requireRole('site_admin'),
  adminPanelController.restoreBackup
);

/**
 * System Metrics Routes
 */
router.get('/metrics',
  query('period').optional().isIn(['1h', '24h', '7d', '30d']),
  validateRequest,
  adminPanelController.getSystemMetrics
);

router.get('/metrics/export',
  query('format').optional().isIn(['json', 'csv']),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601(),
  validateRequest,
  adminPanelController.exportMetrics
);

module.exports = router;