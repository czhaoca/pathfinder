/**
 * Configuration Migration Runner
 * 
 * Runs the configuration management system migration
 * with proper error handling and rollback capabilities.
 */

const path = require('path');
const { logger } = require('../utils/logger');

// Database connection
let db;
try {
  const databaseService = require('../services/database');
  db = databaseService;
} catch (error) {
  console.error('Failed to load database service:', error);
  process.exit(1);
}

// Migration class
const CreateConfigurationTablesMigration = require('./migrations/20250816001_create_configuration_tables');

class ConfigurationMigrationRunner {
  constructor() {
    this.migration = new CreateConfigurationTablesMigration(db);
    this.migrationTable = 'pf_migrations';
  }

  async run() {
    try {
      console.log('🚀 Starting Configuration Management System Migration');
      console.log('=' .repeat(60));

      // Ensure migration tracking table exists
      await this.ensureMigrationTable();

      // Check if migration already applied
      if (await this.isMigrationApplied()) {
        console.log('ℹ️  Configuration migration already applied');
        return { success: true, message: 'Migration already applied' };
      }

      // Run pre-migration checks
      await this.runPreMigrationChecks();

      // Execute migration
      console.log('\n📦 Executing migration...');
      const startTime = Date.now();
      
      await this.migration.up();
      
      const duration = Date.now() - startTime;
      console.log(`✅ Migration completed in ${duration}ms`);

      // Record migration
      await this.recordMigration();

      // Run post-migration validation
      await this.runPostMigrationValidation();

      console.log('\n🎉 Configuration Management System migration completed successfully!');
      console.log('=' .repeat(60));

      return { success: true, duration };

    } catch (error) {
      console.error('\n❌ Migration failed:', error.message);
      console.error('Stack trace:', error.stack);

      // Attempt rollback
      await this.handleMigrationFailure(error);

      throw error;
    }
  }

  async rollback() {
    try {
      console.log('🔄 Rolling back Configuration Management System Migration');
      console.log('=' .repeat(60));

      // Check if migration is applied
      if (!(await this.isMigrationApplied())) {
        console.log('ℹ️  Configuration migration not applied, nothing to rollback');
        return { success: true, message: 'Nothing to rollback' };
      }

      console.log('\n📦 Executing rollback...');
      const startTime = Date.now();
      
      await this.migration.down();
      
      const duration = Date.now() - startTime;
      console.log(`✅ Rollback completed in ${duration}ms`);

      // Remove migration record
      await this.removeMigrationRecord();

      console.log('\n🎉 Configuration Management System rollback completed successfully!');
      console.log('=' .repeat(60));

      return { success: true, duration };

    } catch (error) {
      console.error('\n❌ Rollback failed:', error.message);
      console.error('Stack trace:', error.stack);
      throw error;
    }
  }

  async ensureMigrationTable() {
    try {
      // Check if migration table exists
      const checkSql = `
        SELECT COUNT(*) as count 
        FROM user_tables 
        WHERE table_name = UPPER(?)
      `;
      const result = await db.queryOne(checkSql, [this.migrationTable]);
      
      if (result.COUNT === 0) {
        console.log('📋 Creating migration tracking table...');
        
        const createSql = `
          CREATE TABLE ${this.migrationTable} (
            id VARCHAR2(36) DEFAULT SYS_GUID() PRIMARY KEY,
            migration_name VARCHAR2(255) UNIQUE NOT NULL,
            version VARCHAR2(50) NOT NULL,
            description VARCHAR2(1000),
            executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            execution_time_ms NUMBER(10),
            checksum VARCHAR2(64),
            status VARCHAR2(20) DEFAULT 'completed',
            rollback_available NUMBER(1) DEFAULT 1,
            
            CONSTRAINT chk_migration_status CHECK (status IN ('completed', 'failed', 'rolled_back'))
          )
        `;
        
        await db.query(createSql);
        console.log('✅ Migration tracking table created');
      }
    } catch (error) {
      console.error('Failed to ensure migration table:', error);
      throw error;
    }
  }

  async isMigrationApplied() {
    try {
      const sql = `
        SELECT COUNT(*) as count 
        FROM ${this.migrationTable} 
        WHERE migration_name = ? AND status = 'completed'
      `;
      const result = await db.queryOne(sql, ['create_configuration_tables']);
      return result.COUNT > 0;
    } catch (error) {
      // If table doesn't exist, migration hasn't been applied
      return false;
    }
  }

  async runPreMigrationChecks() {
    console.log('\n🔍 Running pre-migration checks...');

    // Check database connection
    try {
      await db.query('SELECT 1 FROM DUAL');
      console.log('✅ Database connection verified');
    } catch (error) {
      throw new Error(`Database connection failed: ${error.message}`);
    }

    // Check if users table exists (dependency)
    try {
      const sql = `
        SELECT COUNT(*) as count 
        FROM user_tables 
        WHERE table_name = 'PF_USERS'
      `;
      const result = await db.queryOne(sql);
      
      if (result.COUNT === 0) {
        throw new Error('Required pf_users table not found. Please run user management migration first.');
      }
      console.log('✅ Required dependencies verified');
    } catch (error) {
      if (error.message.includes('Required')) {
        throw error;
      }
      console.warn('Warning: Could not verify all dependencies');
    }

    // Check available space (if possible)
    try {
      const spaceSql = `
        SELECT 
          tablespace_name,
          bytes/1024/1024 as mb_total,
          (bytes - NVL(maxbytes, bytes))/1024/1024 as mb_free
        FROM dba_data_files 
        WHERE tablespace_name = (
          SELECT default_tablespace 
          FROM user_users 
          WHERE username = USER
        )
      `;
      
      const spaceResult = await db.queryOne(spaceSql);
      if (spaceResult && spaceResult.MB_FREE < 100) {
        console.warn('⚠️  Warning: Low disk space detected');
      } else {
        console.log('✅ Sufficient disk space available');
      }
    } catch (error) {
      console.log('ℹ️  Could not check disk space (insufficient permissions)');
    }

    console.log('✅ Pre-migration checks completed');
  }

  async recordMigration() {
    const sql = `
      INSERT INTO ${this.migrationTable} (
        migration_name, version, description, execution_time_ms, checksum
      ) VALUES (?, ?, ?, ?, ?)
    `;
    
    // Calculate a simple checksum for verification
    const checksum = require('crypto')
      .createHash('md5')
      .update('create_configuration_tables_v1')
      .digest('hex');
    
    await db.execute(sql, [
      'create_configuration_tables',
      CreateConfigurationTablesMigration.version,
      CreateConfigurationTablesMigration.description,
      0, // Will be updated with actual time
      checksum
    ]);
  }

  async removeMigrationRecord() {
    const sql = `
      UPDATE ${this.migrationTable} 
      SET status = 'rolled_back'
      WHERE migration_name = ?
    `;
    
    await db.execute(sql, ['create_configuration_tables']);
  }

  async runPostMigrationValidation() {
    console.log('\n🔍 Running post-migration validation...');

    const validations = [
      {
        name: 'System Configuration Table',
        sql: `SELECT COUNT(*) as count FROM pf_system_config`,
        expect: 'count > 0'
      },
      {
        name: 'Environment Configuration Table',
        sql: `SELECT COUNT(*) as count FROM pf_environment_config WHERE 1=0`,
        expect: 'no_error'
      },
      {
        name: 'Feature Flags Table',
        sql: `SELECT COUNT(*) as count FROM pf_feature_flags`,
        expect: 'count >= 0'
      },
      {
        name: 'Configuration History Table',
        sql: `SELECT COUNT(*) as count FROM pf_config_history WHERE 1=0`,
        expect: 'no_error'
      },
      {
        name: 'Rate Limits Table',
        sql: `SELECT COUNT(*) as count FROM pf_rate_limits`,
        expect: 'count >= 0'
      },
      {
        name: 'Configuration Templates Table',
        sql: `SELECT COUNT(*) as count FROM pf_config_templates`,
        expect: 'count > 0'
      },
      {
        name: 'Template History Table',
        sql: `SELECT COUNT(*) as count FROM template_application_history WHERE 1=0`,
        expect: 'no_error'
      },
      {
        name: 'Rate Limit Metrics Table',
        sql: `SELECT COUNT(*) as count FROM rate_limit_metrics WHERE 1=0`,
        expect: 'no_error'
      },
      {
        name: 'Feature Flag Evaluations Table',
        sql: `SELECT COUNT(*) as count FROM feature_flag_evaluations WHERE 1=0`,
        expect: 'no_error'
      }
    ];

    for (const validation of validations) {
      try {
        const result = await db.queryOne(validation.sql);
        
        if (validation.expect === 'no_error') {
          console.log(`✅ ${validation.name}`);
        } else if (validation.expect === 'count > 0' && result.COUNT > 0) {
          console.log(`✅ ${validation.name} (${result.COUNT} records)`);
        } else if (validation.expect === 'count >= 0' && result.COUNT >= 0) {
          console.log(`✅ ${validation.name} (${result.COUNT} records)`);
        } else {
          throw new Error(`Validation failed: ${validation.expect}`);
        }
      } catch (error) {
        throw new Error(`Validation failed for ${validation.name}: ${error.message}`);
      }
    }

    // Test basic functionality
    try {
      const testSql = `
        INSERT INTO pf_system_config (
          config_key, config_value, config_type, category, display_name
        ) VALUES ('test.migration.validation', 'test_value', 'string', 'test', 'Test Config')
      `;
      await db.execute(testSql);
      
      const verifyTestSql = `SELECT config_value FROM pf_system_config WHERE config_key = 'test.migration.validation'`;
      const testResult = await db.queryOne(verifyTestSql);
      
      if (testResult.CONFIG_VALUE !== 'test_value') {
        throw new Error('Configuration insert/select test failed');
      }
      
      // Clean up test data
      await db.execute(`DELETE FROM pf_system_config WHERE config_key = 'test.migration.validation'`);
      
      console.log('✅ Basic functionality test passed');
    } catch (error) {
      throw new Error(`Functionality test failed: ${error.message}`);
    }

    console.log('✅ Post-migration validation completed');
  }

  async handleMigrationFailure(error) {
    console.log('\n🚨 Handling migration failure...');
    
    try {
      // Attempt automatic rollback
      console.log('🔄 Attempting automatic rollback...');
      await this.migration.down();
      console.log('✅ Automatic rollback completed');
    } catch (rollbackError) {
      console.error('❌ Automatic rollback failed:', rollbackError.message);
      console.log('\n⚠️  Manual cleanup may be required. Check the following tables:');
      console.log('   - pf_system_config');
      console.log('   - pf_environment_config');
      console.log('   - pf_feature_flags');
      console.log('   - pf_config_history');
      console.log('   - pf_rate_limits');
      console.log('   - pf_config_templates');
      console.log('   - template_application_history');
      console.log('   - rate_limit_metrics');
      console.log('   - feature_flag_evaluations');
    }
  }

  async getStatus() {
    try {
      const sql = `
        SELECT 
          migration_name,
          version,
          description,
          executed_at,
          status
        FROM ${this.migrationTable} 
        WHERE migration_name = 'create_configuration_tables'
      `;
      
      const result = await db.queryOne(sql);
      return result || { status: 'not_applied' };
    } catch (error) {
      return { status: 'unknown', error: error.message };
    }
  }
}

// CLI interface
if (require.main === module) {
  const command = process.argv[2];
  const runner = new ConfigurationMigrationRunner();

  (async () => {
    try {
      switch (command) {
        case 'up':
        case 'migrate':
          await runner.run();
          break;
          
        case 'down':
        case 'rollback':
          await runner.rollback();
          break;
          
        case 'status':
          const status = await runner.getStatus();
          console.log('Migration Status:', JSON.stringify(status, null, 2));
          break;
          
        default:
          console.log('Usage: node run-configuration-migration.js [up|down|status]');
          console.log('');
          console.log('Commands:');
          console.log('  up, migrate  - Run the configuration migration');
          console.log('  down, rollback - Rollback the configuration migration');
          console.log('  status       - Check migration status');
          process.exit(1);
      }
      
      process.exit(0);
    } catch (error) {
      console.error('Migration runner error:', error);
      process.exit(1);
    }
  })();
}

module.exports = ConfigurationMigrationRunner;