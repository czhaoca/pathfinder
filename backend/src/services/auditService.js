const logger = require('../utils/logger');

class AuditService {
  constructor(auditRepository) {
    this.auditRepository = auditRepository;
  }

  async logAuth({ userId, action, resourceType, resourceId, ipAddress, userAgent, success, errorMessage }) {
    try {
      await this.auditRepository.create({
        userId,
        action,
        resourceType,
        resourceId: resourceId || null,
        requestData: JSON.stringify({ ipAddress, userAgent }),
        responseCode: success ? 200 : 401,
        executionTimeMs: 0,
        success,
        errorMessage: errorMessage || null
      });
    } catch (error) {
      // Don't throw audit log errors to avoid cascading failures
      logger.error('Failed to create audit log', { error: error.message, action });
    }
  }

  async logDataAccess({ userId, action, resourceType, resourceId, operation, success, errorMessage }) {
    try {
      await this.auditRepository.create({
        userId,
        action,
        resourceType,
        resourceId,
        requestData: JSON.stringify({ operation }),
        responseCode: success ? 200 : 500,
        executionTimeMs: 0,
        success,
        errorMessage: errorMessage || null
      });
    } catch (error) {
      logger.error('Failed to create audit log', { error: error.message, action });
    }
  }

  async logApiCall({ userId, method, path, statusCode, executionTimeMs, ipAddress, userAgent }) {
    try {
      await this.auditRepository.create({
        userId,
        action: `${method} ${path}`,
        resourceType: 'api',
        resourceId: null,
        requestData: JSON.stringify({ ipAddress, userAgent }),
        responseCode: statusCode,
        executionTimeMs,
        success: statusCode < 400,
        errorMessage: null
      });
    } catch (error) {
      logger.error('Failed to create API audit log', { error: error.message });
    }
  }

  async getAuditLogs(filters) {
    return await this.auditRepository.findByFilters(filters);
  }

  async getSecurityEvents(userId, timeRange) {
    return await this.auditRepository.findSecurityEvents(userId, timeRange);
  }
}

module.exports = AuditService;