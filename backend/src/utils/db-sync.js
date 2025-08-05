#!/usr/bin/env node

/**
 * Database Synchronization Utility
 * Helps manage data between development and production databases
 */

const winston = require('winston');
const config = require('../config');

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.colorize(),
    winston.format.simple()
  ),
  transports: [new winston.transports.Console()]
});

// Ensure we're using multi-database mode
if (config.activeDatabases !== 'both') {
  logger.error('This utility requires ACTIVE_DATABASES=both in your environment');
  process.exit(1);
}

const dbManager = require('../services/database');

class DatabaseSync {
  constructor() {
    this.dbManager = dbManager;
  }

  /**
   * Initialize database connections
   */
  async initialize() {
    logger.info('Initializing database connections...');
    await this.dbManager.initialize();
    
    const environments = this.dbManager.getActiveEnvironments();
    logger.info(`Active environments: ${environments.join(', ')}`);
  }

  /**
   * Sync specific user from one environment to another
   */
  async syncUser(userId, fromEnv, toEnv) {
    logger.info(`Syncing user ${userId} from ${fromEnv} to ${toEnv}...`);
    
    try {
      const result = await this.dbManager.syncUserData(userId, fromEnv, toEnv);
      logger.info(`✅ User synced successfully`);
      return result;
    } catch (error) {
      logger.error(`❌ Failed to sync user: ${error.message}`);
      throw error;
    }
  }

  /**
   * Compare user data between environments
   */
  async compareUser(userId, schemaPrefix) {
    logger.info(`Comparing user ${userId} data across environments...`);
    
    try {
      const comparison = await this.dbManager.compareUserData(userId, schemaPrefix);
      
      // Log comparison results
      logger.info('User data comparison:');
      Object.entries(comparison.user).forEach(([env, data]) => {
        if (data) {
          logger.info(`  ${env}: ${data.USERNAME} (${data.EMAIL})`);
        } else {
          logger.info(`  ${env}: Not found`);
        }
      });

      logger.info('Experience counts:');
      Object.entries(comparison.experiences).forEach(([env, count]) => {
        logger.info(`  ${env}: ${count} experiences`);
      });

      return comparison;
    } catch (error) {
      logger.error(`❌ Failed to compare user: ${error.message}`);
      throw error;
    }
  }

  /**
   * List users in specific environment
   */
  async listUsers(env, limit = 10) {
    logger.info(`Listing users in ${env} (limit: ${limit})...`);
    
    const sql = `
      SELECT 
        RAWTOHEX(user_id) as user_id,
        username,
        email,
        schema_prefix,
        created_at,
        last_login
      FROM ${config.project.tablePrefix}users
      ORDER BY created_at DESC
      FETCH FIRST :limit ROWS ONLY
    `;
    
    try {
      const result = await this.dbManager.executeQuery(sql, { limit }, {}, env);
      
      logger.info(`Found ${result.rows.length} users:`);
      result.rows.forEach((user, index) => {
        logger.info(`  ${index + 1}. ${user.USERNAME} (${user.EMAIL}) - Created: ${user.CREATED_AT}`);
      });
      
      return result.rows;
    } catch (error) {
      logger.error(`❌ Failed to list users: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get database statistics
   */
  async getStats() {
    logger.info('Getting database statistics...');
    
    const stats = {};
    
    for (const env of this.dbManager.getActiveEnvironments()) {
      stats[env] = {
        users: 0,
        sessions: 0,
        poolStats: await this.dbManager.getPoolStatistics(env)
      };
      
      try {
        // Count users
        const userResult = await this.dbManager.executeQuery(
          `SELECT COUNT(*) as count FROM ${config.project.tablePrefix}users`,
          {}, {}, env
        );
        stats[env].users = userResult.rows[0].COUNT;
        
        // Count active sessions
        const sessionResult = await this.dbManager.executeQuery(
          `SELECT COUNT(*) as count FROM ${config.project.tablePrefix}user_sessions WHERE is_active = 1`,
          {}, {}, env
        );
        stats[env].sessions = sessionResult.rows[0].COUNT;
      } catch (error) {
        logger.error(`Failed to get stats for ${env}: ${error.message}`);
      }
    }
    
    // Log statistics
    Object.entries(stats).forEach(([env, data]) => {
      logger.info(`\n${env.toUpperCase()} Statistics:`);
      logger.info(`  Users: ${data.users}`);
      logger.info(`  Active Sessions: ${data.sessions}`);
      logger.info(`  Pool: ${data.poolStats.connectionsInUse}/${data.poolStats.connectionsOpen} connections`);
    });
    
    return stats;
  }

  /**
   * Perform health check on all databases
   */
  async healthCheck() {
    logger.info('Performing health check...');
    
    const health = await this.dbManager.healthCheck();
    
    Object.entries(health).forEach(([env, status]) => {
      logger.info(`\n${env.toUpperCase()} Health:`);
      logger.info(`  Status: ${status.status}`);
      logger.info(`  Response Time: ${status.responseTime || 'N/A'}`);
      if (status.error) {
        logger.error(`  Error: ${status.error}`);
      }
    });
    
    return health;
  }

  /**
   * Close database connections
   */
  async close() {
    logger.info('Closing database connections...');
    await this.dbManager.close();
  }
}

// Command-line interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  const sync = new DatabaseSync();
  
  try {
    await sync.initialize();
    
    switch (command) {
      case 'health':
        await sync.healthCheck();
        break;
        
      case 'stats':
        await sync.getStats();
        break;
        
      case 'list':
        const env = args[1] || 'development';
        const limit = parseInt(args[2]) || 10;
        await sync.listUsers(env, limit);
        break;
        
      case 'compare':
        const userId = args[1];
        const schemaPrefix = args[2];
        if (!userId || !schemaPrefix) {
          logger.error('Usage: db-sync compare <userId> <schemaPrefix>');
          break;
        }
        await sync.compareUser(userId, schemaPrefix);
        break;
        
      case 'sync':
        const syncUserId = args[1];
        const fromEnv = args[2] || 'development';
        const toEnv = args[3] || 'production';
        if (!syncUserId) {
          logger.error('Usage: db-sync sync <userId> [fromEnv] [toEnv]');
          break;
        }
        await sync.syncUser(syncUserId, fromEnv, toEnv);
        break;
        
      default:
        logger.info(`
Database Sync Utility

Commands:
  health                          - Check health of all databases
  stats                           - Show database statistics
  list [env] [limit]             - List users in environment
  compare <userId> <schema>       - Compare user data across environments
  sync <userId> [from] [to]      - Sync user from one env to another

Examples:
  node db-sync.js health
  node db-sync.js stats
  node db-sync.js list development 20
  node db-sync.js compare abc123 skill_user_john
  node db-sync.js sync abc123 development production
        `);
    }
  } catch (error) {
    logger.error('Operation failed:', error);
  } finally {
    await sync.close();
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    logger.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = DatabaseSync;