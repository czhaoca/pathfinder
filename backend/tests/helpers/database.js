const oracledb = require('oracledb');
const crypto = require('crypto');

let testConnection = null;
let testDbName = null;

/**
 * Set up test database with isolated schema
 */
async function setupTestDatabase() {
  try {
    // Generate unique test database name
    testDbName = `test_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    
    // Get connection from pool or create new one
    testConnection = await oracledb.getConnection({
      user: process.env.TEST_DB_USER || process.env.DB_USER,
      password: process.env.TEST_DB_PASSWORD || process.env.DB_PASSWORD,
      connectString: process.env.TEST_DB_CONNECTION || process.env.DB_CONNECTION_STRING
    });

    // Create test schema
    await testConnection.execute(`CREATE USER ${testDbName} IDENTIFIED BY testpass123`);
    await testConnection.execute(`GRANT CONNECT, RESOURCE TO ${testDbName}`);
    await testConnection.execute(`ALTER USER ${testDbName} QUOTA UNLIMITED ON USERS`);

    // Switch to test schema
    await testConnection.execute(`ALTER SESSION SET CURRENT_SCHEMA = ${testDbName}`);

    // Create test tables
    await createTestTables();

    // Seed basic data
    await seedTestData();

    return testConnection;
  } catch (error) {
    console.error('Failed to setup test database:', error);
    throw error;
  }
}

/**
 * Clean up test database after tests
 */
async function cleanupTestDatabase() {
  try {
    if (testConnection && testDbName) {
      // Drop test schema and all objects
      await testConnection.execute(`DROP USER ${testDbName} CASCADE`);
      
      // Close connection
      await testConnection.close();
      testConnection = null;
      testDbName = null;
    }
  } catch (error) {
    console.error('Failed to cleanup test database:', error);
    // Don't throw - cleanup should not fail tests
  }
}

/**
 * Create test tables matching production schema
 */
async function createTestTables() {
  const tables = [
    // Users table
    `CREATE TABLE pf_users (
      id VARCHAR2(36) DEFAULT SYS_GUID() PRIMARY KEY,
      username VARCHAR2(30) UNIQUE NOT NULL,
      email VARCHAR2(255) UNIQUE NOT NULL,
      password_hash VARCHAR2(255),
      password_salt VARCHAR2(255),
      first_name VARCHAR2(100),
      last_name VARCHAR2(100),
      account_status VARCHAR2(20) DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      last_login TIMESTAMP,
      password_changed_at TIMESTAMP,
      password_expires_at TIMESTAMP,
      must_change_password NUMBER(1) DEFAULT 0,
      deletion_scheduled_at TIMESTAMP,
      deletion_reason VARCHAR2(500)
    )`,

    // User roles table
    `CREATE TABLE pf_user_roles (
      id VARCHAR2(36) DEFAULT SYS_GUID() PRIMARY KEY,
      user_id VARCHAR2(36) NOT NULL,
      role VARCHAR2(20) NOT NULL,
      granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      granted_by VARCHAR2(36),
      expires_at TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES pf_users(id) ON DELETE CASCADE
    )`,

    // Password tokens table
    `CREATE TABLE pf_password_tokens (
      id VARCHAR2(36) DEFAULT SYS_GUID() PRIMARY KEY,
      user_id VARCHAR2(36) NOT NULL,
      token VARCHAR2(255) UNIQUE NOT NULL,
      token_type VARCHAR2(20) NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      used_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES pf_users(id) ON DELETE CASCADE
    )`,

    // Sessions table
    `CREATE TABLE pf_user_sessions (
      id VARCHAR2(36) DEFAULT SYS_GUID() PRIMARY KEY,
      user_id VARCHAR2(36) NOT NULL,
      token VARCHAR2(255) UNIQUE NOT NULL,
      refresh_token VARCHAR2(255) UNIQUE,
      ip_address VARCHAR2(45),
      user_agent VARCHAR2(500),
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES pf_users(id) ON DELETE CASCADE
    )`,

    // Audit log table
    `CREATE TABLE pf_audit_log (
      id VARCHAR2(36) DEFAULT SYS_GUID() PRIMARY KEY,
      event_type VARCHAR2(50) NOT NULL,
      event_category VARCHAR2(50),
      event_severity VARCHAR2(20),
      event_name VARCHAR2(100),
      event_description VARCHAR2(500),
      action VARCHAR2(50),
      action_result VARCHAR2(20),
      actor_id VARCHAR2(36),
      actor_username VARCHAR2(30),
      target_type VARCHAR2(50),
      target_id VARCHAR2(36),
      target_name VARCHAR2(255),
      ip_address VARCHAR2(45),
      user_agent VARCHAR2(500),
      old_values CLOB,
      new_values CLOB,
      metadata CLOB,
      event_hash VARCHAR2(64),
      previous_hash VARCHAR2(64),
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

    // Approval workflows table
    `CREATE TABLE pf_approval_workflows (
      id VARCHAR2(36) DEFAULT SYS_GUID() PRIMARY KEY,
      workflow_type VARCHAR2(50) NOT NULL,
      initiator_id VARCHAR2(36) NOT NULL,
      target_type VARCHAR2(50),
      target_id VARCHAR2(36),
      action VARCHAR2(100),
      reason VARCHAR2(500),
      status VARCHAR2(20) DEFAULT 'pending',
      approvals_required NUMBER DEFAULT 1,
      approvals_received NUMBER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      completed_at TIMESTAMP,
      FOREIGN KEY (initiator_id) REFERENCES pf_users(id)
    )`,

    // Approval votes table
    `CREATE TABLE pf_approval_votes (
      id VARCHAR2(36) DEFAULT SYS_GUID() PRIMARY KEY,
      workflow_id VARCHAR2(36) NOT NULL,
      approver_id VARCHAR2(36) NOT NULL,
      decision VARCHAR2(20) NOT NULL,
      comments VARCHAR2(500),
      voted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (workflow_id) REFERENCES pf_approval_workflows(id),
      FOREIGN KEY (approver_id) REFERENCES pf_users(id)
    )`,

    // Configuration table
    `CREATE TABLE pf_configuration (
      key VARCHAR2(100) PRIMARY KEY,
      value VARCHAR2(500),
      description VARCHAR2(500),
      data_type VARCHAR2(20),
      is_sensitive NUMBER(1) DEFAULT 0,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_by VARCHAR2(36)
    )`
  ];

  for (const sql of tables) {
    await testConnection.execute(sql);
  }

  // Create indexes
  const indexes = [
    'CREATE INDEX idx_users_email ON pf_users(email)',
    'CREATE INDEX idx_users_username ON pf_users(username)',
    'CREATE INDEX idx_user_roles_user ON pf_user_roles(user_id)',
    'CREATE INDEX idx_sessions_user ON pf_user_sessions(user_id)',
    'CREATE INDEX idx_audit_actor ON pf_audit_log(actor_id)',
    'CREATE INDEX idx_audit_timestamp ON pf_audit_log(timestamp)'
  ];

  for (const sql of indexes) {
    await testConnection.execute(sql);
  }
}

/**
 * Seed test data
 */
async function seedTestData() {
  // Insert default configuration
  const configs = [
    ['password_min_length', '12', 'Minimum password length', 'number', 0],
    ['password_expiry_days', '90', 'Password expiry in days', 'number', 0],
    ['session_timeout_minutes', '15', 'Session timeout in minutes', 'number', 0],
    ['cooling_off_days', '7', 'Deletion cooling-off period', 'number', 0],
    ['rate_limit_window', '900000', 'Rate limit window in ms', 'number', 0],
    ['rate_limit_max_requests', '100', 'Max requests per window', 'number', 0]
  ];

  for (const config of configs) {
    await testConnection.execute(
      `INSERT INTO pf_configuration (key, value, description, data_type, is_sensitive) 
       VALUES (:1, :2, :3, :4, :5)`,
      config
    );
  }

  await testConnection.commit();
}

/**
 * Get test database connection
 */
function getTestConnection() {
  if (!testConnection) {
    throw new Error('Test database not initialized. Call setupTestDatabase first.');
  }
  return testConnection;
}

/**
 * Execute query on test database
 */
async function query(sql, params = []) {
  const conn = getTestConnection();
  const result = await conn.execute(sql, params, { 
    outFormat: oracledb.OUT_FORMAT_OBJECT,
    autoCommit: true 
  });
  return result.rows;
}

/**
 * Execute single row query
 */
async function queryOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

/**
 * Clear all data from tables (keep structure)
 */
async function clearTestData() {
  const tables = [
    'pf_approval_votes',
    'pf_approval_workflows',
    'pf_audit_log',
    'pf_user_sessions',
    'pf_password_tokens',
    'pf_user_roles',
    'pf_users',
    'pf_configuration'
  ];

  for (const table of tables) {
    await testConnection.execute(`DELETE FROM ${table}`);
  }
  
  await testConnection.commit();
  
  // Re-seed configuration
  await seedTestData();
}

/**
 * Begin transaction
 */
async function beginTransaction() {
  // Oracle doesn't have explicit BEGIN TRANSACTION
  // Just ensure autoCommit is off
  return testConnection;
}

/**
 * Commit transaction
 */
async function commitTransaction() {
  await testConnection.commit();
}

/**
 * Rollback transaction
 */
async function rollbackTransaction() {
  await testConnection.rollback();
}

module.exports = {
  setupTestDatabase,
  cleanupTestDatabase,
  getTestConnection,
  query,
  queryOne,
  clearTestData,
  beginTransaction,
  commitTransaction,
  rollbackTransaction
};