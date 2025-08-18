const AdminPanelService = require('../../services/adminPanelService');
const FeatureFlagService = require('../../services/featureFlagService');
const ConfigurationService = require('../../services/configurationService');
const InvitationService = require('../../services/invitationService');
const AuditService = require('../../services/auditService');
const CacheService = require('../../services/cacheService');
const { ApiError } = require('../../utils/errors');
const { successResponse, errorResponse } = require('../../utils/apiResponse');

class AdminPanelController {
  constructor() {
    this.adminPanelService = new AdminPanelService();
    this.featureFlagService = new FeatureFlagService();
    this.configurationService = new ConfigurationService();
    this.invitationService = new InvitationService();
    this.auditService = new AuditService();
    this.cacheService = new CacheService();
  }

  /**
   * Get comprehensive dashboard data
   */
  getDashboard = async (req, res) => {
    try {
      const dashboardData = await this.adminPanelService.getDashboardData();
      return successResponse(res, dashboardData, 'Dashboard data retrieved successfully');
    } catch (error) {
      console.error('Error getting dashboard data:', error);
      return errorResponse(res, 'Failed to load dashboard data', 500);
    }
  };

  /**
   * Get users with advanced filtering
   */
  getUsers = async (req, res) => {
    try {
      const {
        page = 1,
        limit = 20,
        search,
        status,
        role,
        createdAfter,
        createdBefore,
        lastActiveAfter,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = req.query;

      const filters = {
        page: parseInt(page),
        limit: parseInt(limit),
        search,
        status,
        role,
        createdAfter: createdAfter ? new Date(createdAfter) : undefined,
        createdBefore: createdBefore ? new Date(createdBefore) : undefined,
        lastActiveAfter: lastActiveAfter ? new Date(lastActiveAfter) : undefined,
        sortBy,
        sortOrder
      };

      const users = await this.adminPanelService.getUsers(filters);
      return successResponse(res, users, 'Users retrieved successfully');
    } catch (error) {
      console.error('Error getting users:', error);
      return errorResponse(res, 'Failed to retrieve users', 500);
    }
  };

  /**
   * Advanced user search with multiple criteria
   */
  advancedUserSearch = async (req, res) => {
    try {
      const searchParams = {
        email: req.query.email,
        createdAfter: req.query.createdAfter ? new Date(req.query.createdAfter) : undefined,
        createdBefore: req.query.createdBefore ? new Date(req.query.createdBefore) : undefined,
        lastActiveAfter: req.query.lastActiveAfter ? new Date(req.query.lastActiveAfter) : undefined,
        hasProfile: req.query.hasProfile === 'true',
        hasExperiences: req.query.hasExperiences === 'true',
        minExperiences: req.query.minExperiences ? parseInt(req.query.minExperiences) : undefined,
        tags: req.query.tags ? req.query.tags.split(',') : undefined,
        sortBy: req.query.sortBy || 'createdAt',
        sortOrder: req.query.sortOrder || 'desc'
      };

      const results = await this.adminPanelService.advancedUserSearch(searchParams);
      return successResponse(res, results, 'Search completed successfully');
    } catch (error) {
      console.error('Error in advanced user search:', error);
      return errorResponse(res, 'Search failed', 500);
    }
  };

  /**
   * Perform bulk operations on users
   */
  bulkUserOperation = async (req, res) => {
    try {
      const { userIds, operation, reason } = req.body;

      if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
        return errorResponse(res, 'User IDs are required', 400);
      }

      if (!operation || !['suspend', 'activate', 'delete', 'reset_password'].includes(operation)) {
        return errorResponse(res, 'Invalid operation', 400);
      }

      if (!reason) {
        return errorResponse(res, 'Reason is required for bulk operations', 400);
      }

      const result = await this.adminPanelService.bulkUserOperation(
        userIds,
        operation,
        reason,
        req.user.id
      );

      // Audit log
      await this.auditService.log({
        action: 'BULK_USER_OPERATION',
        userId: req.user.id,
        details: {
          operation,
          userCount: userIds.length,
          reason,
          result
        }
      });

      return successResponse(res, result, 'Bulk operation completed');
    } catch (error) {
      console.error('Error in bulk user operation:', error);
      return errorResponse(res, error.message, 500);
    }
  };

  /**
   * Create impersonation token for user support
   */
  impersonateUser = async (req, res) => {
    try {
      const { userId } = req.params;

      const tokenData = await this.adminPanelService.createImpersonationToken(
        userId,
        req.user.id
      );

      // Audit log
      await this.auditService.log({
        action: 'USER_IMPERSONATION_START',
        userId: req.user.id,
        targetId: userId,
        details: {
          expiresAt: tokenData.expiresAt
        }
      });

      return successResponse(res, tokenData, 'Impersonation token created');
    } catch (error) {
      console.error('Error creating impersonation token:', error);
      if (error.message === 'Cannot impersonate other administrators') {
        return errorResponse(res, error.message, 403);
      }
      return errorResponse(res, error.message, 500);
    }
  };

  /**
   * Get feature flags with metrics
   */
  getFeatureFlags = async (req, res) => {
    try {
      const flags = await this.featureFlagService.getAllFlagsWithMetrics();
      return successResponse(res, flags, 'Feature flags retrieved');
    } catch (error) {
      console.error('Error getting feature flags:', error);
      return errorResponse(res, 'Failed to retrieve feature flags', 500);
    }
  };

  /**
   * Update feature flag configuration
   */
  updateFeatureFlag = async (req, res) => {
    try {
      const { flagId } = req.params;
      const { enabled, rolloutPercentage, targetGroups, conditions, reason } = req.body;

      if (!reason) {
        return errorResponse(res, 'Reason is required for flag updates', 400);
      }

      const updatedFlag = await this.featureFlagService.updateFlag(
        flagId,
        { enabled, rolloutPercentage, targetGroups, conditions },
        req.user.id
      );

      // Audit log
      await this.auditService.log({
        action: 'FEATURE_FLAG_UPDATE',
        userId: req.user.id,
        targetId: flagId,
        details: {
          changes: { enabled, rolloutPercentage, targetGroups, conditions },
          reason
        }
      });

      return successResponse(res, updatedFlag, 'Feature flag updated');
    } catch (error) {
      console.error('Error updating feature flag:', error);
      return errorResponse(res, error.message, 500);
    }
  };

  /**
   * Create A/B test for feature flag
   */
  createABTest = async (req, res) => {
    try {
      const { flagId } = req.params;
      const { variants, metrics, duration } = req.body;

      if (!variants || variants.length < 2) {
        return errorResponse(res, 'At least 2 variants are required for A/B test', 400);
      }

      const totalWeight = variants.reduce((sum, v) => sum + v.weight, 0);
      if (totalWeight !== 100) {
        return errorResponse(res, 'Variant weights must sum to 100', 400);
      }

      const testConfig = await this.featureFlagService.createABTest(
        flagId,
        { variants, metrics, duration },
        req.user.id
      );

      // Audit log
      await this.auditService.log({
        action: 'AB_TEST_CREATED',
        userId: req.user.id,
        targetId: flagId,
        details: testConfig
      });

      return successResponse(res, testConfig, 'A/B test created');
    } catch (error) {
      console.error('Error creating A/B test:', error);
      return errorResponse(res, error.message, 500);
    }
  };

  /**
   * Get grouped system configuration
   */
  getSystemConfig = async (req, res) => {
    try {
      const config = await this.configurationService.getGroupedConfig();
      return successResponse(res, config, 'Configuration retrieved');
    } catch (error) {
      console.error('Error getting system config:', error);
      return errorResponse(res, 'Failed to retrieve configuration', 500);
    }
  };

  /**
   * Update system configuration
   */
  updateSystemConfig = async (req, res) => {
    try {
      const { key } = req.params;
      const { value, reason } = req.body;

      if (!reason) {
        return errorResponse(res, 'Reason is required for configuration changes', 400);
      }

      const updated = await this.configurationService.updateConfig(
        key,
        value,
        reason,
        req.user.id
      );

      // Clear relevant caches
      await this.cacheService.clearPattern(`config:${key}:*`);

      // Audit log
      await this.auditService.log({
        action: 'CONFIG_UPDATE',
        userId: req.user.id,
        resourceId: key,
        details: {
          previousValue: updated.previousValue,
          newValue: value,
          reason
        }
      });

      return successResponse(res, updated, 'Configuration updated');
    } catch (error) {
      console.error('Error updating config:', error);
      if (error.message === 'Configuration is not editable') {
        return errorResponse(res, error.message, 400);
      }
      return errorResponse(res, error.message, 500);
    }
  };

  /**
   * Get API keys
   */
  getApiKeys = async (req, res) => {
    try {
      const apiKeys = await this.configurationService.getApiKeys();
      return successResponse(res, apiKeys, 'API keys retrieved');
    } catch (error) {
      console.error('Error getting API keys:', error);
      return errorResponse(res, 'Failed to retrieve API keys', 500);
    }
  };

  /**
   * Create new API key
   */
  createApiKey = async (req, res) => {
    try {
      const { name, scopes, expiresIn } = req.body;

      if (!name || !scopes || !Array.isArray(scopes)) {
        return errorResponse(res, 'Name and scopes are required', 400);
      }

      const apiKey = await this.configurationService.createApiKey(
        name,
        scopes,
        expiresIn,
        req.user.id
      );

      // Audit log
      await this.auditService.log({
        action: 'API_KEY_CREATED',
        userId: req.user.id,
        details: {
          name,
          scopes,
          keyId: apiKey.id
        }
      });

      return successResponse(res, apiKey, 'API key created');
    } catch (error) {
      console.error('Error creating API key:', error);
      return errorResponse(res, error.message, 500);
    }
  };

  /**
   * Get invitation dashboard with analytics
   */
  getInvitationDashboard = async (req, res) => {
    try {
      const dashboard = await this.invitationService.getInvitationDashboard();
      return successResponse(res, dashboard, 'Invitation dashboard retrieved');
    } catch (error) {
      console.error('Error getting invitation dashboard:', error);
      return errorResponse(res, 'Failed to retrieve invitation dashboard', 500);
    }
  };

  /**
   * Send bulk invitations
   */
  sendBulkInvitations = async (req, res) => {
    try {
      const { emails, template, customMessage, role, expiresIn } = req.body;

      if (!emails || !Array.isArray(emails) || emails.length === 0) {
        return errorResponse(res, 'Email addresses are required', 400);
      }

      // Validate email addresses
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const invalidEmails = emails.filter(email => !emailRegex.test(email));
      if (invalidEmails.length > 0) {
        return errorResponse(res, `Invalid email addresses: ${invalidEmails.join(', ')}`, 400);
      }

      const result = await this.invitationService.sendBulkInvitations(
        emails,
        { template, customMessage, role, expiresIn },
        req.user.id
      );

      // Audit log
      await this.auditService.log({
        action: 'BULK_INVITATIONS_SENT',
        userId: req.user.id,
        details: {
          emailCount: emails.length,
          template,
          result
        }
      });

      return successResponse(res, result, 'Invitations sent');
    } catch (error) {
      console.error('Error sending bulk invitations:', error);
      return errorResponse(res, error.message, 500);
    }
  };

  /**
   * Get security policies
   */
  getSecurityPolicies = async (req, res) => {
    try {
      const policies = await this.adminPanelService.getSecurityPolicies();
      return successResponse(res, policies, 'Security policies retrieved');
    } catch (error) {
      console.error('Error getting security policies:', error);
      return errorResponse(res, 'Failed to retrieve security policies', 500);
    }
  };

  /**
   * Update rate limiting settings
   */
  updateRateLimits = async (req, res) => {
    try {
      const { endpoint, attempts, window, reason } = req.body;

      if (!endpoint || !attempts || !window || !reason) {
        return errorResponse(res, 'All fields are required', 400);
      }

      const updated = await this.adminPanelService.updateRateLimits(
        endpoint,
        { attempts, window },
        reason,
        req.user.id
      );

      // Clear rate limit caches
      await this.cacheService.clearPattern('rate_limit:*');

      // Audit log
      await this.auditService.log({
        action: 'RATE_LIMITS_UPDATE',
        userId: req.user.id,
        details: {
          endpoint,
          previousSettings: {
            attempts: updated.previousAttempts,
            window: updated.previousWindow
          },
          newSettings: { attempts, window },
          reason
        }
      });

      return successResponse(res, updated, 'Rate limits updated');
    } catch (error) {
      console.error('Error updating rate limits:', error);
      return errorResponse(res, error.message, 500);
    }
  };

  /**
   * Get service health status
   */
  getServicesHealth = async (req, res) => {
    try {
      const health = await this.adminPanelService.getServicesHealth();
      return successResponse(res, health, 'Service health retrieved');
    } catch (error) {
      console.error('Error getting service health:', error);
      return errorResponse(res, 'Failed to retrieve service health', 500);
    }
  };

  /**
   * Restart a service
   */
  restartService = async (req, res) => {
    try {
      const { service } = req.params;
      const { reason } = req.body;

      if (!reason) {
        return errorResponse(res, 'Reason is required for service restart', 400);
      }

      const result = await this.adminPanelService.restartService(
        service,
        reason,
        req.user.id
      );

      // Audit log
      await this.auditService.log({
        action: 'SERVICE_RESTART',
        userId: req.user.id,
        target: service,
        details: {
          reason,
          result
        }
      });

      return successResponse(res, result, 'Service restarted');
    } catch (error) {
      console.error('Error restarting service:', error);
      return errorResponse(res, error.message, 500);
    }
  };

  /**
   * Get cache statistics
   */
  getCacheStats = async (req, res) => {
    try {
      const stats = await this.cacheService.getStats();
      return successResponse(res, stats, 'Cache statistics retrieved');
    } catch (error) {
      console.error('Error getting cache stats:', error);
      return errorResponse(res, 'Failed to retrieve cache statistics', 500);
    }
  };

  /**
   * Clear cache by pattern
   */
  clearCache = async (req, res) => {
    try {
      const { pattern } = req.params;
      const { reason } = req.body;

      if (!reason) {
        return errorResponse(res, 'Reason is required for cache clearing', 400);
      }

      const result = await this.cacheService.clearPattern(pattern);

      // Audit log
      await this.auditService.log({
        action: 'CACHE_CLEAR',
        userId: req.user.id,
        details: {
          pattern,
          reason,
          keysCleared: result.keysCleared
        }
      });

      return successResponse(res, result, 'Cache cleared');
    } catch (error) {
      console.error('Error clearing cache:', error);
      return errorResponse(res, error.message, 500);
    }
  };

  /**
   * Get background jobs status
   */
  getBackgroundJobs = async (req, res) => {
    try {
      const jobs = await this.adminPanelService.getBackgroundJobs();
      return successResponse(res, jobs, 'Background jobs retrieved');
    } catch (error) {
      console.error('Error getting background jobs:', error);
      return errorResponse(res, 'Failed to retrieve background jobs', 500);
    }
  };

  /**
   * Retry failed job
   */
  retryJob = async (req, res) => {
    try {
      const { jobId } = req.params;
      const result = await this.adminPanelService.retryJob(jobId);

      // Audit log
      await this.auditService.log({
        action: 'JOB_RETRY',
        userId: req.user.id,
        targetId: jobId,
        details: result
      });

      return successResponse(res, result, 'Job retry initiated');
    } catch (error) {
      console.error('Error retrying job:', error);
      return errorResponse(res, error.message, 500);
    }
  };

  /**
   * User Notes Management
   */
  getUserNotes = async (req, res) => {
    try {
      const { userId } = req.params;
      const filters = req.query;
      const notes = await this.adminPanelService.getUserNotes(userId, filters);
      return successResponse(res, notes);
    } catch (error) {
      console.error('Error getting user notes:', error);
      return errorResponse(res, error.message, 500);
    }
  };

  addUserNote = async (req, res) => {
    try {
      const { userId } = req.params;
      const noteData = req.body;
      const adminId = req.user.id;
      const result = await this.adminPanelService.addUserNote(userId, noteData, adminId);
      return successResponse(res, result, 'Note added successfully', 201);
    } catch (error) {
      console.error('Error adding user note:', error);
      return errorResponse(res, error.message, 500);
    }
  };

  updateUserNote = async (req, res) => {
    try {
      const { noteId } = req.params;
      const updates = req.body;
      const adminId = req.user.id;
      const result = await this.adminPanelService.updateUserNote(noteId, updates, adminId);
      return successResponse(res, result, 'Note updated successfully');
    } catch (error) {
      console.error('Error updating user note:', error);
      return errorResponse(res, error.message, 500);
    }
  };

  deleteUserNote = async (req, res) => {
    try {
      const { noteId } = req.params;
      const adminId = req.user.id;
      const result = await this.adminPanelService.deleteUserNote(noteId, adminId);
      return successResponse(res, result, 'Note deleted successfully');
    } catch (error) {
      console.error('Error deleting user note:', error);
      return errorResponse(res, error.message, 500);
    }
  };

  /**
   * User Tags Management
   */
  getUserTags = async (req, res) => {
    try {
      const { userId } = req.params;
      const tags = await this.adminPanelService.getUserTags(userId);
      return successResponse(res, tags);
    } catch (error) {
      console.error('Error getting user tags:', error);
      return errorResponse(res, error.message, 500);
    }
  };

  addUserTag = async (req, res) => {
    try {
      const { userId } = req.params;
      const tagData = req.body;
      const adminId = req.user.id;
      const result = await this.adminPanelService.addUserTag(userId, tagData, adminId);
      return successResponse(res, result, 'Tag added successfully', 201);
    } catch (error) {
      console.error('Error adding user tag:', error);
      if (error.message === 'User already has this tag') {
        return errorResponse(res, error.message, 409);
      }
      return errorResponse(res, error.message, 500);
    }
  };

  removeUserTag = async (req, res) => {
    try {
      const { userId, tagName } = req.params;
      const adminId = req.user.id;
      const result = await this.adminPanelService.removeUserTag(userId, tagName, adminId);
      return successResponse(res, result, 'Tag removed successfully');
    } catch (error) {
      console.error('Error removing user tag:', error);
      if (error.message === 'Tag not found for user') {
        return errorResponse(res, error.message, 404);
      }
      return errorResponse(res, error.message, 500);
    }
  };

  getAllTags = async (req, res) => {
    try {
      const tags = await this.adminPanelService.getAllTags();
      return successResponse(res, tags);
    } catch (error) {
      console.error('Error getting all tags:', error);
      return errorResponse(res, error.message, 500);
    }
  };

  searchUsersByTag = async (req, res) => {
    try {
      const { tags } = req.query;
      const tagNames = Array.isArray(tags) ? tags : tags.split(',');
      const users = await this.adminPanelService.searchUsersByTag(tagNames);
      return successResponse(res, users);
    } catch (error) {
      console.error('Error searching users by tag:', error);
      return errorResponse(res, error.message, 500);
    }
  };
}

module.exports = new AdminPanelController();