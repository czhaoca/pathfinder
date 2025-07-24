/**
 * Data Retention Policy Service for Career Navigator
 * Implements HIPAA-compliant data retention and automated cleanup
 * Handles user data lifecycle, legal holds, and compliance requirements
 */

const winston = require('winston');
const crypto = require('crypto');
const { performance } = require('perf_hooks');

// Configure logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

class DataRetentionService {
  constructor(databaseManager, securityAudit) {
    this.db = databaseManager;
    this.audit = securityAudit;
    this.isEnabled = process.env.ENABLE_DATA_RETENTION !== 'false';
    
    // Retention policies in days
    this.retentionPolicies = {
      // HIPAA requires 7 years for audit logs
      auditLogs: parseInt(process.env.AUDIT_LOG_RETENTION_DAYS) || 2555, // 7 years
      
      // User session data
      sessionLogs: parseInt(process.env.SESSION_LOG_RETENTION_DAYS) || 90,
      
      // Error logs and system events
      errorLogs: parseInt(process.env.ERROR_LOG_RETENTION_DAYS) || 365,
      
      // User account deletion grace period
      deletedAccounts: parseInt(process.env.DELETED_ACCOUNT_GRACE_DAYS) || 30,
      
      // Backup retention
      backups: parseInt(process.env.BACKUP_RETENTION_DAYS) || 365,
      
      // Temporary data (exports, reports)
      temporaryData: parseInt(process.env.TEMP_DATA_RETENTION_DAYS) || 7,
      
      // Rate limiting data
      rateLimitData: parseInt(process.env.RATE_LIMIT_RETENTION_DAYS) || 7
    };
    
    // Data categories for classification
    this.dataCategories = {
      PERSONAL_DATA: 'personal_data',
      SENSITIVE_DATA: 'sensitive_data',
      SYSTEM_DATA: 'system_data',
      AUDIT_DATA: 'audit_data',
      TEMPORARY_DATA: 'temporary_data'
    };
    
    // Legal hold status
    this.legalHolds = new Set();
    
    logger.info('Data retention service initialized', {
      enabled: this.isEnabled,
      policies: this.retentionPolicies
    });
  }

  /**
   * Execute daily data retention cleanup
   */
  async executeDailyCleanup() {
    if (!this.isEnabled) {
      logger.info('Data retention disabled, skipping cleanup');
      return { status: 'disabled' };
    }

    const startTime = performance.now();
    const results = {
      timestamp: new Date().toISOString(),
      auditLogs: 0,
      sessionLogs: 0,
      errorLogs: 0,
      deletedAccounts: 0,
      temporaryData: 0,
      rateLimitData: 0,
      errors: []
    };

    try {
      logger.info('Starting daily data retention cleanup');

      // Clean up audit logs (oldest first, respect legal holds)
      results.auditLogs = await this.cleanupAuditLogs();
      
      // Clean up session logs
      results.sessionLogs = await this.cleanupSessionLogs();
      
      // Clean up error logs
      results.errorLogs = await this.cleanupErrorLogs();
      
      // Process deleted accounts (after grace period)
      results.deletedAccounts = await this.processDeletedAccounts();
      
      // Clean up temporary data
      results.temporaryData = await this.cleanupTemporaryData();
      
      // Clean up rate limiting data
      results.rateLimitData = await this.cleanupRateLimitData();
      
      const duration = performance.now() - startTime;
      
      // Log cleanup completion
      await this.audit.logEvent({
        type: 'SYSTEM_EVENT',
        action: 'data_retention_cleanup',
        userId: 'system',
        success: true,
        riskLevel: 'low',
        metadata: {
          ...results,
          durationMs: Math.round(duration)
        }
      });
      
      logger.info('Data retention cleanup completed', {
        results,
        durationMs: Math.round(duration)
      });
      
      return results;
      
    } catch (error) {
      logger.error('Data retention cleanup failed', {
        error: error.message,
        stack: error.stack
      });
      
      results.errors.push({
        operation: 'daily_cleanup',
        error: error.message,
        timestamp: new Date().toISOString()
      });
      
      return results;
    }
  }

  /**
   * Clean up expired audit logs
   */
  async cleanupAuditLogs() {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.retentionPolicies.auditLogs);
      
      // Check for legal holds
      const legalHoldCheck = await this.checkLegalHolds('audit_log', cutoffDate);
      if (legalHoldCheck.hasHolds) {
        logger.warn('Audit log cleanup blocked by legal hold', {
          affectedRecords: legalHoldCheck.affectedRecords,
          holdReasons: legalHoldCheck.reasons
        });
        return 0;
      }
      
      const result = await this.db.executeQuery(`
        DELETE FROM audit_log 
        WHERE timestamp < :cutoffDate
          AND log_id NOT IN (
            SELECT resource_id FROM legal_holds 
            WHERE resource_type = 'audit_log' AND is_active = 1
          )
      `, { cutoffDate: cutoffDate.toISOString() });
      
      if (result.rowsAffected > 0) {
        logger.info('Audit logs cleaned up', {
          deletedRecords: result.rowsAffected,
          cutoffDate: cutoffDate.toISOString()
        });
      }
      
      return result.rowsAffected;
      
    } catch (error) {
      logger.error('Failed to cleanup audit logs', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Clean up expired session logs
   */
  async cleanupSessionLogs() {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.retentionPolicies.sessionLogs);
      
      const result = await this.db.executeQuery(`
        DELETE FROM user_sessions 
        WHERE created_at < :cutoffDate
          AND is_active = 0
      `, { cutoffDate: cutoffDate.toISOString() });
      
      if (result.rowsAffected > 0) {
        logger.info('Session logs cleaned up', {
          deletedRecords: result.rowsAffected,
          cutoffDate: cutoffDate.toISOString()
        });
      }
      
      return result.rowsAffected;
      
    } catch (error) {
      logger.error('Failed to cleanup session logs', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Clean up expired error logs
   */
  async cleanupErrorLogs() {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.retentionPolicies.errorLogs);
      
      const result = await this.db.executeQuery(`
        DELETE FROM audit_log 
        WHERE timestamp < :cutoffDate
          AND success = 0
          AND action LIKE '%error%'
      `, { cutoffDate: cutoffDate.toISOString() });
      
      if (result.rowsAffected > 0) {
        logger.info('Error logs cleaned up', {
          deletedRecords: result.rowsAffected,
          cutoffDate: cutoffDate.toISOString()
        });
      }
      
      return result.rowsAffected;
      
    } catch (error) {
      logger.error('Failed to cleanup error logs', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Process deleted accounts after grace period
   */
  async processDeletedAccounts() {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.retentionPolicies.deletedAccounts);
      
      // Find accounts eligible for permanent deletion
      const eligibleAccounts = await this.db.executeQuery(`
        SELECT 
          RAWTOHEX(user_id) as user_id,
          username,
          schema_prefix,
          last_login
        FROM users 
        WHERE account_status = 'deleted'
          AND last_login < :cutoffDate
      `, { cutoffDate: cutoffDate.toISOString() });
      
      let processedCount = 0;
      
      for (const account of eligibleAccounts.rows) {
        try {
          // Check for legal holds
          const legalHoldCheck = await this.checkLegalHolds('user_data', null, account.user_id);
          if (legalHoldCheck.hasHolds) {
            logger.warn('Account deletion blocked by legal hold', {
              userId: account.user_id,
              username: account.username,
              holdReasons: legalHoldCheck.reasons
            });
            continue;
          }
          
          // Permanently delete user data
          await this.permanentlyDeleteUserData(account);
          processedCount++;
          
          // Log the deletion
          await this.audit.logPrivacyEvent({
            action: 'permanent_data_deletion',
            userId: account.user_id,
            dataSubject: account.user_id,
            success: true,
            legalBasis: 'data_retention_policy',
            dataCategories: [this.dataCategories.PERSONAL_DATA, this.dataCategories.SENSITIVE_DATA],
            metadata: {
              retentionPolicyDays: this.retentionPolicies.deletedAccounts,
              deletionReason: 'retention_policy_expired',
              schemaPrefix: account.schema_prefix
            }
          });
          
        } catch (error) {
          logger.error('Failed to process deleted account', {
            userId: account.user_id,
            error: error.message
          });
        }
      }
      
      if (processedCount > 0) {
        logger.info('Deleted accounts processed', {
          processedCount,
          cutoffDate: cutoffDate.toISOString()
        });
      }
      
      return processedCount;
      
    } catch (error) {
      logger.error('Failed to process deleted accounts', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Clean up temporary data (exports, reports, etc.)
   */
  async cleanupTemporaryData() {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.retentionPolicies.temporaryData);
      
      // This would clean up temporary files, export data, etc.
      // Implementation depends on how temporary data is stored
      
      let cleanedCount = 0;
      
      // Example: Clean up temporary export files
      const tempExports = await this.db.executeQuery(`
        SELECT export_id, file_path, user_id
        FROM temporary_exports 
        WHERE created_at < :cutoffDate
      `, { cutoffDate: cutoffDate.toISOString() });
      
      for (const export_record of tempExports.rows) {
        try {
          // Delete physical file if exists
          // await fs.unlink(export_record.file_path);
          
          // Remove database record
          await this.db.executeQuery(`
            DELETE FROM temporary_exports 
            WHERE export_id = :exportId
          `, { exportId: export_record.export_id });
          
          cleanedCount++;
          
        } catch (error) {
          logger.error('Failed to clean up temporary export', {
            exportId: export_record.export_id,
            error: error.message
          });
        }
      }
      
      if (cleanedCount > 0) {
        logger.info('Temporary data cleaned up', {
          cleanedCount,
          cutoffDate: cutoffDate.toISOString()
        });
      }
      
      return cleanedCount;
      
    } catch (error) {
      logger.error('Failed to cleanup temporary data', {
        error: error.message
      });
      return 0; // Non-critical failure
    }
  }

  /**
   * Clean up rate limiting data
   */
  async cleanupRateLimitData() {
    try {
      // This would clean up Redis rate limiting data
      // Implementation depends on Redis structure
      
      const cutoffTimestamp = Date.now() - (this.retentionPolicies.rateLimitData * 24 * 60 * 60 * 1000);
      
      // Example Redis cleanup (if Redis client available)
      let cleanedCount = 0;
      
      // In practice, this would use Redis SCAN and ZREMRANGEBYSCORE
      logger.debug('Rate limit data cleanup completed', {
        cleanedCount,
        cutoffTimestamp
      });
      
      return cleanedCount;
      
    } catch (error) {
      logger.error('Failed to cleanup rate limit data', {
        error: error.message
      });
      return 0; // Non-critical failure
    }
  }

  /**
   * Permanently delete all user data
   */
  async permanentlyDeleteUserData(account) {
    const connection = await this.db.getConnection();
    
    try {
      // Start transaction for atomic deletion
      await connection.execute('BEGIN');
      
      // Delete user-specific schema and all data
      await connection.execute(`DROP SCHEMA ${account.schema_prefix} CASCADE`);
      
      // Delete user record from system tables
      await connection.execute(`
        DELETE FROM users WHERE user_id = HEXTORAW(:userId)
      `, { userId: account.user_id });
      
      // Delete associated sessions, API keys, etc.
      await connection.execute(`
        DELETE FROM user_sessions WHERE user_id = HEXTORAW(:userId)
      `, { userId: account.user_id });
      
      await connection.execute(`
        DELETE FROM api_keys WHERE user_id = HEXTORAW(:userId)
      `, { userId: account.user_id });
      
      // Commit transaction
      await connection.execute('COMMIT');
      
      logger.info('User data permanently deleted', {
        userId: account.user_id,
        username: account.username,
        schemaPrefix: account.schema_prefix
      });
      
    } catch (error) {
      // Rollback on error
      await connection.execute('ROLLBACK');
      logger.error('Failed to permanently delete user data', {
        userId: account.user_id,
        error: error.message
      });
      throw error;
    } finally {
      await connection.close();
    }
  }

  /**
   * Check for legal holds on data
   */
  async checkLegalHolds(resourceType, cutoffDate = null, userId = null) {
    try {
      let sql = `
        SELECT 
          hold_id,
          reason,
          created_by,
          created_at
        FROM legal_holds 
        WHERE resource_type = :resourceType
          AND is_active = 1
      `;
      
      const binds = { resourceType };
      
      if (userId) {
        sql += ' AND resource_id = :userId';
        binds.userId = userId;
      }
      
      if (cutoffDate) {
        sql += ' AND created_at <= :cutoffDate';
        binds.cutoffDate = cutoffDate.toISOString();
      }
      
      const result = await this.db.executeQuery(sql, binds);
      
      return {
        hasHolds: result.rows.length > 0,
        affectedRecords: result.rows.length,
        reasons: result.rows.map(row => row.reason)
      };
      
    } catch (error) {
      logger.error('Failed to check legal holds', {
        error: error.message,
        resourceType,
        userId
      });
      
      // Err on side of caution - assume holds exist if check fails
      return {
        hasHolds: true,
        affectedRecords: 0,
        reasons: ['legal_hold_check_failed']
      };
    }
  }

  /**
   * Create legal hold on data
   */
  async createLegalHold(holdData) {
    try {
      const holdId = crypto.randomUUID();
      
      await this.db.executeQuery(`
        INSERT INTO legal_holds (
          hold_id, resource_type, resource_id, reason, 
          created_by, created_at, is_active
        ) VALUES (
          :holdId, :resourceType, :resourceId, :reason,
          :createdBy, CURRENT_TIMESTAMP, 1
        )
      `, {
        holdId,
        resourceType: holdData.resourceType,
        resourceId: holdData.resourceId,
        reason: holdData.reason,
        createdBy: holdData.createdBy
      });
      
      // Log the legal hold creation
      await this.audit.logEvent({
        type: 'PRIVACY_EVENT',
        action: 'legal_hold_created',
        userId: holdData.createdBy,
        resourceType: holdData.resourceType,
        resourceId: holdData.resourceId,
        success: true,
        riskLevel: 'high',
        metadata: {
          holdId,
          reason: holdData.reason,
          affectedData: holdData.affectedData
        }
      });
      
      logger.info('Legal hold created', {
        holdId,
        resourceType: holdData.resourceType,
        reason: holdData.reason
      });
      
      return holdId;
      
    } catch (error) {
      logger.error('Failed to create legal hold', {
        error: error.message,
        holdData
      });
      throw error;
    }
  }

  /**
   * Release legal hold
   */
  async releaseLegalHold(holdId, releasedBy, reason) {
    try {
      await this.db.executeQuery(`
        UPDATE legal_holds 
        SET is_active = 0, 
            released_at = CURRENT_TIMESTAMP,
            released_by = :releasedBy,
            release_reason = :reason
        WHERE hold_id = :holdId
      `, { holdId, releasedBy, reason });
      
      // Log the legal hold release
      await this.audit.logEvent({
        type: 'PRIVACY_EVENT',
        action: 'legal_hold_released',
        userId: releasedBy,
        resourceId: holdId,
        success: true,
        riskLevel: 'medium',
        metadata: {
          holdId,
          releaseReason: reason
        }
      });
      
      logger.info('Legal hold released', {
        holdId,
        releasedBy,
        reason
      });
      
    } catch (error) {
      logger.error('Failed to release legal hold', {
        error: error.message,
        holdId
      });
      throw error;
    }
  }

  /**
   * Get retention policy summary
   */
  getRetentionPolicySummary() {
    return {
      enabled: this.isEnabled,
      policies: this.retentionPolicies,
      dataCategories: this.dataCategories,
      legalHoldsActive: this.legalHolds.size,
      lastCleanup: this.lastCleanupTime || null
    };
  }

  /**
   * Update retention policy
   */
  updateRetentionPolicy(policyType, days) {
    if (this.retentionPolicies.hasOwnProperty(policyType)) {
      const oldValue = this.retentionPolicies[policyType];
      this.retentionPolicies[policyType] = days;
      
      logger.info('Retention policy updated', {
        policyType,
        oldValue,
        newValue: days
      });
      
      return true;
    }
    
    return false;
  }

  /**
   * Generate retention compliance report
   */
  async generateRetentionReport(startDate, endDate) {
    try {
      const report = {
        reportId: crypto.randomUUID(),
        generatedAt: new Date().toISOString(),
        period: { startDate, endDate },
        policies: this.retentionPolicies,
        statistics: {}
      };
      
      // Get cleanup statistics
      const cleanupStats = await this.db.executeQuery(`
        SELECT 
          action,
          COUNT(*) as event_count,
          MIN(timestamp) as first_event,
          MAX(timestamp) as last_event
        FROM audit_log 
        WHERE action LIKE '%cleanup%' OR action LIKE '%retention%'
          AND timestamp BETWEEN :startDate AND :endDate
        GROUP BY action
      `, { startDate, endDate });
      
      report.statistics.cleanupEvents = cleanupStats.rows;
      
      // Get legal hold statistics
      const legalHoldStats = await this.db.executeQuery(`
        SELECT 
          resource_type,
          COUNT(*) as active_holds,
          COUNT(CASE WHEN released_at IS NOT NULL THEN 1 END) as released_holds
        FROM legal_holds 
        WHERE created_at BETWEEN :startDate AND :endDate
        GROUP BY resource_type
      `, { startDate, endDate });
      
      report.statistics.legalHolds = legalHoldStats.rows;
      
      return report;
      
    } catch (error) {
      logger.error('Failed to generate retention report', {
        error: error.message,
        startDate,
        endDate
      });
      throw error;
    }
  }
}

module.exports = DataRetentionService;