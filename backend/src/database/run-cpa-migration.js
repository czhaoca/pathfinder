#!/usr/bin/env node

/**
 * CPA PERT Migration Runner
 * Executes database migrations for CPA PERT module
 */

const oracledb = require('oracledb');
const config = require('../config');
const { up: createCPASchema } = require('./migrations/create-cpa-pert-tables');
const { seedCPACompetencies } = require('./seeds/seed-cpa-competencies');

async function runMigration() {
  let connection;
  
  try {
    // Initialize Oracle client
    if (config.database[config.environment].walletLocation) {
      oracledb.initOracleClient({
        configDir: config.database[config.environment].walletLocation
      });
    }
    
    // Create connection pool
    const pool = await oracledb.createPool({
      user: config.database[config.environment].username,
      password: config.database[config.environment].password,
      connectString: config.database[config.environment].serviceName,
      poolMin: 1,
      poolMax: 5,
      poolIncrement: 1
    });
    
    // Get connection
    connection = await pool.getConnection();
    
    console.log('🔄 Running CPA PERT schema migration...');
    
    // Run migration
    await createCPASchema(connection);
    
    // Seed competencies
    console.log('🌱 Seeding CPA competency framework...');
    await seedCPACompetencies(connection);
    
    console.log('✅ CPA PERT migration completed successfully!');
    
    // Close pool
    await pool.close();
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error('❌ Rollback failed:', rollbackError);
      }
    }
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  runMigration();
}

module.exports = { runMigration };