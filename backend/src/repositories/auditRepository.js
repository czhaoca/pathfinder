const logger = require('../utils/logger');

class AuditRepository {
  constructor(database) {
    this.database = database;
  }

  async create(auditData) {
    const sql = `
      INSERT INTO ${this.database.tablePrefix}audit_log (
        user_id, action, resource_type, resource_id, 
        request_data, response_code, execution_time_ms, 
        success, error_message, timestamp
      ) VALUES (
        ${auditData.userId ? 'HEXTORAW(:userId)' : 'NULL'}, 
        :action, :resourceType, :resourceId,
        :requestData, :responseCode, :executionTimeMs,
        :success, :errorMessage, SYSTIMESTAMP
      )
    `;
    
    const binds = {
      action: auditData.action,
      resourceType: auditData.resourceType,
      resourceId: auditData.resourceId,
      requestData: auditData.requestData,
      responseCode: auditData.responseCode,
      executionTimeMs: auditData.executionTimeMs,
      success: auditData.success ? 1 : 0,
      errorMessage: auditData.errorMessage
    };

    if (auditData.userId) {
      binds.userId = auditData.userId;
    }
    
    await this.database.executeQuery(sql, binds, { autoCommit: true });
  }

  async findByFilters(filters) {
    let sql = `
      SELECT 
        RAWTOHEX(audit_id) as audit_id,
        RAWTOHEX(user_id) as user_id,
        action,
        resource_type,
        resource_id,
        request_data,
        response_code,
        execution_time_ms,
        success,
        error_message,
        timestamp
      FROM ${this.database.tablePrefix}audit_log
      WHERE 1 = 1
    `;
    
    const binds = {};
    
    if (filters.userId) {
      sql += ' AND user_id = HEXTORAW(:userId)';
      binds.userId = filters.userId;
    }
    
    if (filters.action) {
      sql += ' AND action = :action';
      binds.action = filters.action;
    }
    
    if (filters.resourceType) {
      sql += ' AND resource_type = :resourceType';
      binds.resourceType = filters.resourceType;
    }
    
    if (filters.startDate) {
      sql += ' AND timestamp >= :startDate';
      binds.startDate = filters.startDate;
    }
    
    if (filters.endDate) {
      sql += ' AND timestamp <= :endDate';
      binds.endDate = filters.endDate;
    }
    
    if (filters.success !== undefined) {
      sql += ' AND success = :success';
      binds.success = filters.success ? 1 : 0;
    }
    
    sql += ' ORDER BY timestamp DESC';
    
    if (filters.limit) {
      sql += ' FETCH FIRST :limit ROWS ONLY';
      binds.limit = filters.limit;
    }
    
    const result = await this.database.executeQuery(sql, binds);
    return result.rows.map(this.mapToAuditLog);
  }

  async findSecurityEvents(userId, timeRange) {
    const sql = `
      SELECT 
        RAWTOHEX(audit_id) as audit_id,
        action,
        resource_type,
        success,
        error_message,
        request_data,
        timestamp
      FROM ${this.database.tablePrefix}audit_log
      WHERE user_id = HEXTORAW(:userId)
        AND timestamp >= SYSTIMESTAMP - INTERVAL :hours HOUR
        AND action IN ('USER_LOGIN', 'LOGIN_FAILED', 'USER_LOGOUT', 
                      'PASSWORD_CHANGED', 'MFA_ENABLED', 'MFA_DISABLED')
      ORDER BY timestamp DESC
    `;
    
    const result = await this.database.executeQuery(sql, { 
      userId, 
      hours: timeRange.hours || 24 
    });
    
    return result.rows.map(this.mapToAuditLog);
  }

  async getFailedLoginAttempts(username, timeWindowMinutes = 15) {
    const sql = `
      SELECT COUNT(*) as failed_attempts
      FROM ${this.database.tablePrefix}audit_log
      WHERE action = 'LOGIN_FAILED'
        AND request_data LIKE :username
        AND timestamp >= SYSTIMESTAMP - INTERVAL :minutes MINUTE
    `;
    
    const result = await this.database.executeQuery(sql, { 
      username: `%${username}%`, 
      minutes: timeWindowMinutes 
    });
    
    return result.rows[0].FAILED_ATTEMPTS;
  }

  mapToAuditLog(row) {
    return {
      auditId: row.AUDIT_ID,
      userId: row.USER_ID,
      action: row.ACTION,
      resourceType: row.RESOURCE_TYPE,
      resourceId: row.RESOURCE_ID,
      requestData: row.REQUEST_DATA ? JSON.parse(row.REQUEST_DATA) : null,
      responseCode: row.RESPONSE_CODE,
      executionTimeMs: row.EXECUTION_TIME_MS,
      success: row.SUCCESS === 1,
      errorMessage: row.ERROR_MESSAGE,
      timestamp: row.TIMESTAMP
    };
  }
}

module.exports = AuditRepository;