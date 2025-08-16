const crypto = require('crypto');
const { query, queryOne } = require('./database');

/**
 * Get latest audit log entry
 */
async function getLatestAuditLog(eventName = null) {
  let sql = `SELECT * FROM pf_audit_log`;
  const params = [];
  
  if (eventName) {
    sql += ` WHERE event_name = :1`;
    params.push(eventName);
  }
  
  sql += ` ORDER BY timestamp DESC FETCH FIRST 1 ROW ONLY`;
  
  return queryOne(sql, params);
}

/**
 * Get audit log by criteria
 */
async function getAuditLog(criteria) {
  const conditions = [];
  const params = [];
  let paramIndex = 1;

  if (criteria.event_type) {
    conditions.push(`event_type = :${paramIndex++}`);
    params.push(criteria.event_type);
  }

  if (criteria.action_result) {
    conditions.push(`action_result = :${paramIndex++}`);
    params.push(criteria.action_result);
  }

  if (criteria.event_name) {
    conditions.push(`event_name = :${paramIndex++}`);
    params.push(criteria.event_name);
  }

  if (criteria.target_id) {
    conditions.push(`target_id = :${paramIndex++}`);
    params.push(criteria.target_id);
  }

  if (criteria.data_sensitivity) {
    conditions.push(`JSON_VALUE(metadata, '$.data_sensitivity') = :${paramIndex++}`);
    params.push(criteria.data_sensitivity);
  }

  const sql = `
    SELECT * FROM pf_audit_log 
    WHERE ${conditions.join(' AND ')}
    ORDER BY timestamp DESC 
    FETCH FIRST 1 ROW ONLY
  `;

  return queryOne(sql, params);
}

/**
 * Create audit log entry
 */
async function createAuditLog(event) {
  const id = crypto.randomUUID();
  
  // Calculate event hash
  const eventData = JSON.stringify({
    event_type: event.event_type,
    event_name: event.event_name,
    actor_id: event.actor_id,
    target_id: event.target_id,
    timestamp: new Date().toISOString()
  });
  
  const eventHash = crypto
    .createHash('sha256')
    .update(eventData)
    .digest('hex');

  // Get previous hash for chain
  const previous = await queryOne(
    `SELECT event_hash FROM pf_audit_log 
     ORDER BY timestamp DESC 
     FETCH FIRST 1 ROW ONLY`
  );
  
  const previousHash = previous ? previous.EVENT_HASH : '0';

  await query(
    `INSERT INTO pf_audit_log (
      id, event_type, event_category, event_severity,
      event_name, event_description, action, action_result,
      actor_id, actor_username, target_type, target_id,
      target_name, ip_address, user_agent, old_values,
      new_values, metadata, event_hash, previous_hash
    ) VALUES (
      :1, :2, :3, :4, :5, :6, :7, :8, :9, :10,
      :11, :12, :13, :14, :15, :16, :17, :18, :19, :20
    )`,
    [
      id,
      event.event_type || 'test',
      event.event_category || 'test',
      event.event_severity || 'info',
      event.event_name || 'test_event',
      event.event_description || 'Test event',
      event.action || 'test',
      event.action_result || 'success',
      event.actor_id || null,
      event.actor_username || 'test_user',
      event.target_type || null,
      event.target_id || null,
      event.target_name || null,
      event.ip_address || '127.0.0.1',
      event.user_agent || 'test-agent',
      event.old_values ? JSON.stringify(event.old_values) : null,
      event.new_values ? JSON.stringify(event.new_values) : null,
      event.metadata ? JSON.stringify(event.metadata) : null,
      eventHash,
      previousHash
    ]
  );

  return id;
}

/**
 * Verify audit log chain integrity
 */
async function verifyAuditChain() {
  const logs = await query(
    `SELECT id, event_hash, previous_hash 
     FROM pf_audit_log 
     ORDER BY timestamp ASC`
  );

  for (let i = 1; i < logs.length; i++) {
    const current = logs[i];
    const previous = logs[i - 1];
    
    if (current.PREVIOUS_HASH !== previous.EVENT_HASH) {
      return {
        valid: false,
        brokenAt: current.ID,
        expected: previous.EVENT_HASH,
        actual: current.PREVIOUS_HASH
      };
    }
  }

  return { valid: true };
}

/**
 * Get audit logs for user
 */
async function getUserAuditLogs(userId) {
  return query(
    `SELECT * FROM pf_audit_log 
     WHERE actor_id = :1 OR target_id = :1
     ORDER BY timestamp DESC`,
    [userId]
  );
}

/**
 * Count audit logs by type
 */
async function countAuditLogs(eventType = null) {
  let sql = `SELECT COUNT(*) as count FROM pf_audit_log`;
  const params = [];
  
  if (eventType) {
    sql += ` WHERE event_type = :1`;
    params.push(eventType);
  }
  
  const result = await queryOne(sql, params);
  return result ? result.COUNT : 0;
}

/**
 * Get security events
 */
async function getSecurityEvents(severity = 'warning') {
  return query(
    `SELECT * FROM pf_audit_log 
     WHERE event_category = 'security' 
     AND event_severity IN (:1, 'error', 'critical')
     ORDER BY timestamp DESC`,
    [severity]
  );
}

module.exports = {
  getLatestAuditLog,
  getAuditLog,
  createAuditLog,
  verifyAuditChain,
  getUserAuditLogs,
  countAuditLogs,
  getSecurityEvents
};