const oracledb = require('oracledb');
const crypto = require('crypto');
const logger = require('../utils/logger');

class SessionRepository {
  constructor(database) {
    this.database = database;
  }

  async create(sessionData) {
    const tokenHash = crypto.createHash('sha256').update(sessionData.sessionId).digest('hex');
    
    const sql = `
      INSERT INTO ${this.database.tablePrefix}user_sessions (
        user_id, token_hash, expires_at, created_at
      ) VALUES (
        HEXTORAW(:userId), :tokenHash, :expiresAt, CURRENT_TIMESTAMP
      ) RETURNING RAWTOHEX(session_id) INTO :sessionId
    `;
    
    const binds = {
      userId: sessionData.userId,
      tokenHash,
      expiresAt: sessionData.expiresAt,
      sessionId: { dir: oracledb.BIND_OUT, type: oracledb.STRING }
    };
    
    const result = await this.database.executeQuery(sql, binds, { autoCommit: true });
    return result.outBinds.sessionId;
  }

  async findById(sessionId) {
    const tokenHash = crypto.createHash('sha256').update(sessionId).digest('hex');
    
    const sql = `
      SELECT 
        RAWTOHEX(session_id) as session_id,
        RAWTOHEX(user_id) as user_id,
        created_at,
        expires_at,
        last_activity
      FROM ${this.database.tablePrefix}user_sessions 
      WHERE token_hash = :tokenHash 
        AND is_active = 1
    `;
    
    const result = await this.database.executeQuery(sql, { tokenHash });
    return result.rows.length > 0 ? this.mapToSession(result.rows[0]) : null;
  }

  async findActive(sessionId) {
    const tokenHash = crypto.createHash('sha256').update(sessionId).digest('hex');
    
    const sql = `
      SELECT 
        RAWTOHEX(session_id) as session_id,
        RAWTOHEX(user_id) as user_id,
        created_at,
        expires_at,
        last_activity
      FROM ${this.database.tablePrefix}user_sessions 
      WHERE token_hash = :tokenHash 
        AND is_active = 1 
        AND expires_at > SYSTIMESTAMP
    `;
    
    const result = await this.database.executeQuery(sql, { tokenHash });
    return result.rows.length > 0 ? this.mapToSession(result.rows[0]) : null;
  }

  async updateActivity(sessionId) {
    const tokenHash = crypto.createHash('sha256').update(sessionId).digest('hex');
    
    const sql = `
      UPDATE ${this.database.tablePrefix}user_sessions 
      SET last_activity = SYSTIMESTAMP 
      WHERE token_hash = :tokenHash
        AND is_active = 1
    `;
    
    await this.database.executeQuery(sql, { tokenHash }, { autoCommit: true });
  }

  async invalidate(sessionId) {
    const tokenHash = crypto.createHash('sha256').update(sessionId).digest('hex');
    
    const sql = `
      UPDATE ${this.database.tablePrefix}user_sessions 
      SET is_active = 0, updated_at = SYSTIMESTAMP 
      WHERE token_hash = :tokenHash
    `;
    
    await this.database.executeQuery(sql, { tokenHash }, { autoCommit: true });
  }

  async invalidateUserSessions(userId) {
    const sql = `
      UPDATE ${this.database.tablePrefix}user_sessions 
      SET is_active = 0, updated_at = SYSTIMESTAMP 
      WHERE user_id = HEXTORAW(:userId)
    `;
    
    await this.database.executeQuery(sql, { userId }, { autoCommit: true });
  }

  async cleanupExpiredSessions() {
    const sql = `
      DELETE FROM ${this.database.tablePrefix}user_sessions 
      WHERE expires_at < SYSTIMESTAMP - INTERVAL '7' DAY
    `;
    
    const result = await this.database.executeQuery(sql, {}, { autoCommit: true });
    return result.rowsAffected;
  }

  mapToSession(row) {
    return {
      sessionId: row.SESSION_ID,
      userId: row.USER_ID,
      createdAt: row.CREATED_AT,
      expiresAt: row.EXPIRES_AT,
      lastActivity: row.LAST_ACTIVITY
    };
  }
}

module.exports = SessionRepository;