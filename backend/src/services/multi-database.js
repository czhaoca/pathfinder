/**
 * Multi-Database Manager for Oracle Autonomous Database
 * Supports simultaneous connections to development and production databases
 */

const oracledb = require('oracledb');
const winston = require('winston');
const config = require('../config');
const { createUserSchema, getUserTableTemplates } = require('../scripts/deploy-schema');

// Configure logger
const logger = winston.createLogger({
  level: config.logging.level,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

if (config.logging.logFile) {
  logger.add(new winston.transports.File({ filename: config.logging.logFile }));
}

class MultiDatabaseManager {
  constructor() {
    this.pools = {};
    this.activeDatabases = config.activeDatabases;
    this.tablePrefix = config.project.tablePrefix;
    this.schemaPrefix = config.project.schemaPrefix;
    this.isInitialized = false;
    this.connectionStats = {
      development: {
        totalConnections: 0,
        activeConnections: 0,
        errors: 0,
        queries: 0,
        avgResponseTime: 0
      },
      production: {
        totalConnections: 0,
        activeConnections: 0,
        errors: 0,
        queries: 0,
        avgResponseTime: 0
      }
    };
  }

  /**
   * Initialize Oracle client and create connection pools
   */
  async initialize() {
    try {
      // Initialize Oracle client if needed
      if (process.platform === 'linux' || process.platform === 'darwin') {
        try {
          oracledb.initOracleClient();
          logger.info('Oracle client initialized (thick mode)');
        } catch (error) {
          logger.info('Oracle client already initialized or using thin mode');
        }
      }

      // Set Oracle configuration
      oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
      oracledb.fetchAsString = ['CLOB'];

      // Initialize pools based on active databases configuration
      if (this.activeDatabases === 'both' || this.activeDatabases === 'development') {
        await this.initializePool('development');
      }

      if (this.activeDatabases === 'both' || this.activeDatabases === 'production') {
        await this.initializePool('production');
      }

      this.isInitialized = true;

      logger.info(`✅ Database pools initialized`, {
        activeDatabases: this.activeDatabases,
        pools: Object.keys(this.pools)
      });

      // Start connection monitoring if enabled
      if (config.monitoring.enableHealthCheck) {
        this.startHealthMonitoring();
      }

    } catch (error) {
      logger.error(`❌ Failed to initialize database pools`, {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Initialize a specific database pool
   */
  async initializePool(env) {
    const dbConfig = config.database[env];
    
    if (!dbConfig) {
      throw new Error(`No configuration found for environment: ${env}`);
    }

    try {
      this.pools[env] = await oracledb.createPool({
        user: dbConfig.username,
        password: dbConfig.password,
        connectString: dbConfig.serviceName,
        poolMin: dbConfig.pool.min,
        poolMax: dbConfig.pool.max,
        poolIncrement: dbConfig.pool.increment,
        poolTimeout: dbConfig.pool.timeout,
        poolPingInterval: dbConfig.pool.pingInterval,
        enableStatistics: dbConfig.pool.enableStatistics,
        walletLocation: dbConfig.walletLocation,
        walletPassword: dbConfig.walletPassword
      });

      logger.info(`✅ ${env} database pool initialized`, {
        poolSize: `${dbConfig.pool.min}-${dbConfig.pool.max}`,
        serviceName: dbConfig.serviceName
      });
    } catch (error) {
      logger.error(`❌ Failed to initialize ${env} database pool`, {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get connection from specific pool
   */
  async getConnection(env = null) {
    // If no environment specified, use current NODE_ENV
    const targetEnv = env || config.environment;
    
    if (!this.pools[targetEnv]) {
      throw new Error(`Database pool not initialized for environment: ${targetEnv}`);
    }

    const startTime = Date.now();
    
    try {
      const connection = await this.pools[targetEnv].getConnection();
      
      this.connectionStats[targetEnv].totalConnections++;
      this.connectionStats[targetEnv].activeConnections++;
      
      const duration = Date.now() - startTime;
      logger.debug(`Connection acquired from ${targetEnv} in ${duration}ms`);
      
      // Wrap connection close to update stats
      const originalClose = connection.close.bind(connection);
      connection.close = async () => {
        this.connectionStats[targetEnv].activeConnections--;
        return await originalClose();
      };
      
      // Add environment info to connection
      connection._environment = targetEnv;
      
      return connection;
    } catch (error) {
      this.connectionStats[targetEnv].errors++;
      logger.error(`Failed to get database connection from ${targetEnv}`, { error: error.message });
      throw error;
    }
  }

  /**
   * Execute query on specific database
   */
  async executeQuery(sql, binds = {}, options = {}, env = null) {
    const targetEnv = env || config.environment;
    const startTime = Date.now();
    const connection = await this.getConnection(targetEnv);
    
    try {
      if (config.logging.enableQueryLogging) {
        logger.debug(`Executing query on ${targetEnv}`, { sql: sql.substring(0, 100) + '...' });
      }
      
      const result = await connection.execute(sql, binds, {
        autoCommit: config.database[targetEnv].options.autoCommit,
        ...options
      });
      
      const duration = Date.now() - startTime;
      this.connectionStats[targetEnv].queries++;
      
      // Update average response time
      const stats = this.connectionStats[targetEnv];
      stats.avgResponseTime = 
        (stats.avgResponseTime * (stats.queries - 1) + duration) / stats.queries;
      
      if (config.logging.enablePerformanceLogging) {
        logger.info(`Query executed on ${targetEnv}`, {
          duration: `${duration}ms`,
          rows: result.rows?.length || 0
        });
      }
      
      return result;
    } catch (error) {
      this.connectionStats[targetEnv].errors++;
      logger.error(`Query execution failed on ${targetEnv}`, {
        error: error.message,
        sql: sql.substring(0, 100) + '...'
      });
      throw error;
    } finally {
      await connection.close();
    }
  }

  /**
   * Execute query on all active databases
   */
  async executeQueryOnAll(sql, binds = {}, options = {}) {
    const results = {};
    const environments = Object.keys(this.pools);
    
    await Promise.all(
      environments.map(async (env) => {
        try {
          results[env] = await this.executeQuery(sql, binds, options, env);
        } catch (error) {
          results[env] = { error: error.message };
        }
      })
    );
    
    return results;
  }

  /**
   * Health check for all databases
   */
  async healthCheck() {
    const results = {};
    
    for (const env of Object.keys(this.pools)) {
      const startTime = Date.now();
      
      try {
        await this.executeQuery('SELECT 1 as health_check FROM DUAL', {}, {}, env);
        const duration = Date.now() - startTime;
        
        results[env] = {
          status: 'healthy',
          responseTime: `${duration}ms`,
          poolStats: await this.getPoolStatistics(env),
          connectionStats: this.connectionStats[env],
          connection: 'active'
        };
      } catch (error) {
        results[env] = {
          status: 'unhealthy',
          error: error.message,
          connectionStats: this.connectionStats[env],
          connection: 'failed'
        };
      }
    }
    
    return results;
  }

  /**
   * Get pool statistics for specific environment
   */
  async getPoolStatistics(env) {
    if (!this.pools[env]) {
      return null;
    }

    const pool = this.pools[env];
    const dbConfig = config.database[env];

    return {
      connectionsInUse: pool.connectionsInUse,
      connectionsOpen: pool.connectionsOpen,
      poolMin: dbConfig.pool.min,
      poolMax: dbConfig.pool.max,
      poolIncrement: dbConfig.pool.increment
    };
  }

  /**
   * Start health monitoring for all databases
   */
  startHealthMonitoring() {
    setInterval(async () => {
      try {
        const health = await this.healthCheck();
        
        Object.entries(health).forEach(([env, status]) => {
          if (status.status === 'unhealthy') {
            logger.warn(`${env} database health check failed`, status);
          } else {
            logger.debug(`${env} database health check passed`, {
              responseTime: status.responseTime,
              connectionsInUse: status.poolStats?.connectionsInUse
            });
          }
        });
      } catch (error) {
        logger.error('Health monitoring error', { error: error.message });
      }
    }, config.monitoring.healthCheckInterval);
  }

  /**
   * Close all database pools
   */
  async close() {
    for (const [env, pool] of Object.entries(this.pools)) {
      try {
        await pool.close(10);
        logger.info(`🔌 ${env} database pool closed`);
      } catch (error) {
        logger.error(`Error closing ${env} database pool`, { error: error.message });
      }
    }
    
    this.pools = {};
    this.isInitialized = false;
  }

  /**
   * Close specific database pool
   */
  async closePool(env) {
    if (this.pools[env]) {
      try {
        await this.pools[env].close(10);
        delete this.pools[env];
        logger.info(`🔌 ${env} database pool closed`);
      } catch (error) {
        logger.error(`Error closing ${env} database pool`, { error: error.message });
      }
    }
  }

  /**
   * Get active database environments
   */
  getActiveEnvironments() {
    return Object.keys(this.pools);
  }

  /**
   * Check if specific environment is active
   */
  isEnvironmentActive(env) {
    return !!this.pools[env];
  }

  // ===============================
  // USER MANAGEMENT METHODS (with env parameter)
  // ===============================

  /**
   * Find user by username or email in specific database
   */
  async findUserByUsernameOrEmail(username, email, env = null) {
    const sql = `
      SELECT 
        RAWTOHEX(user_id) as user_id,
        username,
        email,
        password_hash,
        mfa_secret,
        schema_prefix,
        first_name,
        last_name,
        account_status,
        created_at,
        last_login
      FROM ${this.tablePrefix}users 
      WHERE username = :username OR email = :email
    `;
    
    const result = await this.executeQuery(sql, { username, email }, {}, env);
    return result.rows.length > 0 ? result.rows[0] : null;
  }

  /**
   * Get user by ID from specific database
   */
  async getUserById(userId, env = null) {
    const sql = `
      SELECT 
        RAWTOHEX(user_id) as user_id,
        username,
        email,
        schema_prefix,
        first_name,
        last_name,
        account_status,
        created_at,
        last_login
      FROM ${this.tablePrefix}users 
      WHERE user_id = HEXTORAW(:userId)
    `;
    
    const result = await this.executeQuery(sql, { userId }, {}, env);
    return result.rows.length > 0 ? result.rows[0] : null;
  }

  /**
   * Sync user data between environments
   */
  async syncUserData(userId, fromEnv, toEnv) {
    // Get user from source environment
    const user = await this.getUserById(userId, fromEnv);
    if (!user) {
      throw new Error(`User ${userId} not found in ${fromEnv}`);
    }

    // Check if user exists in target environment
    const existingUser = await this.getUserById(userId, toEnv);
    
    if (existingUser) {
      logger.info(`User ${userId} already exists in ${toEnv}, skipping sync`);
      return existingUser;
    }

    // Copy user to target environment
    const sql = `
      INSERT INTO ${this.tablePrefix}users (
        user_id, username, email, password_hash, schema_prefix, 
        first_name, last_name, account_status, created_at
      ) VALUES (
        HEXTORAW(:userId), :username, :email, :passwordHash, :schemaPrefix,
        :firstName, :lastName, :accountStatus, :createdAt
      )
    `;
    
    await this.executeQuery(sql, {
      userId: user.USER_ID,
      username: user.USERNAME,
      email: user.EMAIL,
      passwordHash: user.PASSWORD_HASH,
      schemaPrefix: user.SCHEMA_PREFIX,
      firstName: user.FIRST_NAME,
      lastName: user.LAST_NAME,
      accountStatus: user.ACCOUNT_STATUS,
      createdAt: user.CREATED_AT
    }, { autoCommit: true }, toEnv);

    logger.info(`User ${userId} synced from ${fromEnv} to ${toEnv}`);
    return user;
  }

  /**
   * Create user-specific schema in specific environment
   */
  async createUserSpecificSchema(schemaPrefix, env = null) {
    const connection = await this.getConnection(env);
    
    try {
      // Create user-specific tables using the schema creation function
      await createUserSchema(connection, schemaPrefix);
      logger.info(`User schema created in ${connection._environment}: ${schemaPrefix}`);
    } catch (error) {
      logger.error(`Failed to create user schema in ${connection._environment}: ${schemaPrefix}`, { 
        error: error.message 
      });
      throw error;
    } finally {
      await connection.close();
    }
  }

  // ===============================
  // USER-SCOPED DATA METHODS (with env parameter)
  // ===============================

  /**
   * Get user quick context from specific database
   */
  async getUserQuickContext(schemaPrefix, env = null) {
    const sql = `
      SELECT 
        executive_summary,
        headline,
        JSON_VALUE(key_skills, '$') as key_skills,
        years_experience,
        current_role,
        current_company,
        JSON_VALUE(industries, '$') as industries,
        education_level,
        location,
        JSON_VALUE(career_goals, '$') as career_goals,
        JSON_VALUE(unique_value_props, '$') as unique_value_props,
        availability,
        last_updated
      FROM ${schemaPrefix}_quick_summaries
      WHERE ROWNUM = 1
      ORDER BY last_updated DESC
    `;
    
    const result = await this.executeQuery(sql, {}, {}, env);
    return result.rows.length > 0 ? result.rows[0] : null;
  }

  /**
   * Search user experiences in specific database
   */
  async searchUserExperiences(schemaPrefix, filters = {}, env = null) {
    let sql = `
      SELECT 
        RAWTOHEX(experience_id) as experience_id,
        title,
        organization,
        department,
        location,
        description,
        start_date,
        end_date,
        is_current,
        experience_type,
        employment_type,
        JSON_VALUE(extracted_skills, '$') as extracted_skills,
        JSON_VALUE(key_highlights, '$') as key_highlights,
        JSON_VALUE(quantified_impacts, '$') as quantified_impacts,
        JSON_VALUE(technologies_used, '$') as technologies_used,
        JSON_VALUE(achievements, '$') as achievements,
        team_size,
        budget_managed,
        revenue_impact,
        cost_savings,
        created_at,
        updated_at
      FROM ${schemaPrefix}_experiences_detailed
      WHERE 1 = 1
    `;
    
    const binds = {};
    
    if (filters.experienceType) {
      sql += ' AND experience_type = :experienceType';
      binds.experienceType = filters.experienceType;
    }
    
    if (filters.isCurrent !== undefined) {
      sql += ' AND is_current = :isCurrent';
      binds.isCurrent = filters.isCurrent ? 1 : 0;
    }
    
    if (filters.dateFrom) {
      sql += ' AND start_date >= :dateFrom';
      binds.dateFrom = filters.dateFrom;
    }
    
    if (filters.dateTo) {
      sql += ' AND start_date <= :dateTo';
      binds.dateTo = filters.dateTo;
    }
    
    if (filters.searchText) {
      sql += ` AND (
        UPPER(title) LIKE UPPER(:searchText) OR 
        UPPER(description) LIKE UPPER(:searchText) OR
        UPPER(organization) LIKE UPPER(:searchText)
      )`;
      binds.searchText = `%${filters.searchText}%`;
    }
    
    sql += ' ORDER BY start_date DESC';
    
    if (filters.limit) {
      sql += ' FETCH FIRST :limit ROWS ONLY';
      binds.limit = filters.limit;
    }
    
    const result = await this.executeQuery(sql, binds, {}, env);
    return result.rows;
  }

  /**
   * Compare data between environments
   */
  async compareUserData(userId, schemaPrefix) {
    const comparison = {
      user: {},
      experiences: {},
      summary: {}
    };

    // Compare user data
    for (const env of this.getActiveEnvironments()) {
      comparison.user[env] = await this.getUserById(userId, env);
    }

    // Compare experiences count
    for (const env of this.getActiveEnvironments()) {
      try {
        const sql = `SELECT COUNT(*) as count FROM ${schemaPrefix}_experiences_detailed`;
        const result = await this.executeQuery(sql, {}, {}, env);
        comparison.experiences[env] = result.rows[0].COUNT;
      } catch (error) {
        comparison.experiences[env] = { error: error.message };
      }
    }

    // Compare quick summary
    for (const env of this.getActiveEnvironments()) {
      try {
        comparison.summary[env] = await this.getUserQuickContext(schemaPrefix, env);
      } catch (error) {
        comparison.summary[env] = { error: error.message };
      }
    }

    return comparison;
  }
}

// Create singleton instance
const multiDatabaseManager = new MultiDatabaseManager();

module.exports = multiDatabaseManager;