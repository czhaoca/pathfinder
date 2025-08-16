// Global setup - runs once before all tests
const dotenv = require('dotenv');
const path = require('path');
const oracledb = require('oracledb');

module.exports = async () => {
  console.log('\n🚀 Starting global test setup...\n');
  
  // Load test environment
  dotenv.config({ path: path.join(__dirname, '../.env.test') });
  
  // Initialize Oracle client
  if (process.env.ORACLE_INSTANT_CLIENT_PATH) {
    try {
      oracledb.initOracleClient({ 
        libDir: process.env.ORACLE_INSTANT_CLIENT_PATH 
      });
      console.log('✅ Oracle Instant Client initialized');
    } catch (err) {
      if (err.errorNum !== 3055) { // Already initialized
        console.error('❌ Failed to initialize Oracle client:', err);
        throw err;
      }
    }
  }
  
  // Create test database schema if needed
  let connection;
  try {
    connection = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECTION_STRING
    });
    
    console.log('✅ Connected to Oracle database');
    
    // Create test schema tables if they don't exist
    const tables = [
      'pf_test_users',
      'pf_test_user_sessions',
      'pf_test_audit_log',
      'pf_test_encryption_keys'
    ];
    
    for (const table of tables) {
      try {
        // Check if table exists
        const result = await connection.execute(
          `SELECT COUNT(*) as count FROM user_tables WHERE table_name = :1`,
          [table.toUpperCase()]
        );
        
        if (result.rows[0][0] === 0) {
          console.log(`📦 Creating test table: ${table}`);
          // Create basic test table structure
          await createTestTable(connection, table);
        }
      } catch (err) {
        console.warn(`⚠️ Warning creating ${table}:`, err.message);
      }
    }
    
    console.log('\n✅ Global test setup complete\n');
    
  } catch (err) {
    console.error('❌ Database setup failed:', err);
    throw err;
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error('Error closing connection:', err);
      }
    }
  }
};

async function createTestTable(connection, tableName) {
  const tableDefinitions = {
    'pf_test_users': `
      CREATE TABLE ${tableName} (
        id VARCHAR2(50) PRIMARY KEY,
        username VARCHAR2(30) UNIQUE NOT NULL,
        email VARCHAR2(255) UNIQUE NOT NULL,
        first_name VARCHAR2(100),
        last_name VARCHAR2(100),
        password_hash VARCHAR2(255),
        password_salt VARCHAR2(255),
        role VARCHAR2(20) DEFAULT 'user',
        account_status VARCHAR2(20) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        bio CLOB,
        is_test_user CHAR(1) DEFAULT 'Y'
      )
    `,
    
    'pf_test_user_sessions': `
      CREATE TABLE ${tableName} (
        id VARCHAR2(50) PRIMARY KEY,
        user_id VARCHAR2(50) NOT NULL,
        token VARCHAR2(500) NOT NULL,
        refresh_token VARCHAR2(500),
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ip_address VARCHAR2(45),
        user_agent VARCHAR2(500)
      )
    `,
    
    'pf_test_audit_log': `
      CREATE TABLE ${tableName} (
        id VARCHAR2(50) PRIMARY KEY,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        event_type VARCHAR2(50) NOT NULL,
        event_name VARCHAR2(100),
        event_category VARCHAR2(50),
        event_severity VARCHAR2(20),
        action VARCHAR2(50),
        action_result VARCHAR2(20),
        actor_id VARCHAR2(50),
        actor_type VARCHAR2(20),
        target_id VARCHAR2(50),
        target_type VARCHAR2(50),
        target_name VARCHAR2(255),
        ip_address VARCHAR2(45),
        user_agent VARCHAR2(500),
        old_values CLOB,
        new_values CLOB,
        metadata CLOB,
        event_hash VARCHAR2(64),
        previous_hash VARCHAR2(64),
        data_sensitivity VARCHAR2(20)
      )
    `,
    
    'pf_test_encryption_keys': `
      CREATE TABLE ${tableName} (
        id VARCHAR2(50) PRIMARY KEY,
        user_id VARCHAR2(50) UNIQUE NOT NULL,
        key_value VARCHAR2(500) NOT NULL,
        key_version NUMBER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        rotated_at TIMESTAMP,
        status VARCHAR2(20) DEFAULT 'active'
      )
    `
  };
  
  const definition = tableDefinitions[tableName];
  if (definition) {
    await connection.execute(definition);
    await connection.commit();
  }
}