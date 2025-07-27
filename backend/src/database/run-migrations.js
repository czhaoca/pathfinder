/**
 * Simple Migration Runner
 * Runs all database migrations in order
 */

const logger = require('../utils/logger');
const DatabaseManager = require('../services/database');
const fs = require('fs').promises;
const path = require('path');

async function runMigrations() {
  try {
    // Initialize database
    await DatabaseManager.initialize();
    
    // Get all migration files
    const migrationsDir = path.join(__dirname, 'migrations');
    const files = await fs.readdir(migrationsDir);
    const migrationFiles = files
      .filter(f => f.startsWith('create-') && f.endsWith('.js'))
      .sort();
    
    logger.info(`Found ${migrationFiles.length} migration files`);
    
    // Run each migration
    for (const file of migrationFiles) {
      if (file === 'deploy-prefixed-schema.js') continue; // Skip the complex deployment script
      
      logger.info(`Running migration: ${file}`);
      
      try {
        const migration = require(path.join(migrationsDir, file));
        
        if (migration.up) {
          await migration.up(DatabaseManager, 'cn_');
          logger.info(`✅ Migration completed: ${file}`);
        } else {
          logger.warn(`⚠️  No 'up' method found in ${file}`);
        }
      } catch (error) {
        logger.error(`❌ Migration failed: ${file}`, { error: error.message });
        throw error;
      }
    }
    
    logger.info('✅ All migrations completed successfully');
    
  } catch (error) {
    logger.error('Migration run failed', { error: error.message });
    throw error;
  } finally {
    await DatabaseManager.close();
  }
}

// Run if called directly
if (require.main === module) {
  runMigrations()
    .then(() => {
      logger.info('Migration process completed');
      process.exit(0);
    })
    .catch(err => {
      logger.error('Migration process failed', { error: err.message });
      process.exit(1);
    });
}

module.exports = { runMigrations };