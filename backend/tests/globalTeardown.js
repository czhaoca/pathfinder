// Global teardown - runs once after all tests
const oracledb = require('oracledb');
const dotenv = require('dotenv');
const path = require('path');

module.exports = async () => {
  console.log('\n🧹 Starting global test teardown...\n');
  
  // Load test environment
  dotenv.config({ path: path.join(__dirname, '../.env.test') });
  
  let connection;
  try {
    connection = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECTION_STRING
    });
    
    // Clean up test data
    const testTables = [
      'pf_test_audit_log',
      'pf_test_user_sessions',
      'pf_test_encryption_keys',
      'pf_test_users'
    ];
    
    for (const table of testTables) {
      try {
        // Check if table exists
        const result = await connection.execute(
          `SELECT COUNT(*) as count FROM user_tables WHERE table_name = :1`,
          [table.toUpperCase()]
        );
        
        if (result.rows[0][0] > 0) {
          // Clean test data but keep table structure
          await connection.execute(`DELETE FROM ${table} WHERE 1=1`);
          console.log(`✅ Cleaned test data from ${table}`);
        }
      } catch (err) {
        console.warn(`⚠️ Warning cleaning ${table}:`, err.message);
      }
    }
    
    await connection.commit();
    
    // Clean up any test user schemas created during tests
    try {
      const testSchemas = await connection.execute(`
        SELECT username FROM all_users 
        WHERE username LIKE 'TEST_USER_%'
      `);
      
      for (const row of testSchemas.rows) {
        const schemaName = row[0];
        console.log(`🗑️ Dropping test schema: ${schemaName}`);
        try {
          await connection.execute(`DROP USER ${schemaName} CASCADE`);
        } catch (err) {
          console.warn(`⚠️ Could not drop ${schemaName}:`, err.message);
        }
      }
    } catch (err) {
      console.warn('⚠️ Warning cleaning test schemas:', err.message);
    }
    
    console.log('\n✅ Global test teardown complete\n');
    
  } catch (err) {
    console.error('❌ Teardown failed:', err);
    // Don't throw - we still want tests to complete
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error('Error closing connection:', err);
      }
    }
    
    // Ensure Oracle connection pool is closed
    try {
      await oracledb.getPool().close(10);
    } catch (err) {
      // Pool might not exist, that's okay
    }
  }
  
  // Give processes time to clean up
  await new Promise(resolve => setTimeout(resolve, 1000));
};