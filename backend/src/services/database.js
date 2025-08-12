/**
 * Multi-User Database Manager for Oracle Autonomous Database
 * Handles connection pooling and database operations for the authenticated MCP server
 * Supports user-prefixed schema isolation for data privacy
 */

const oracledb = require('oracledb');
const winston = require('winston');
const config = require('../config');

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

class DatabaseManager {
  constructor() {
    this.pool = null;
    this.environment = config.environment;
    this.dbConfig = config.database[this.environment];
    this.tablePrefix = config.project.tablePrefix;
    this.schemaPrefix = config.project.schemaPrefix;
    this.isInitialized = false;
    this.connectionStats = {
      totalConnections: 0,
      activeConnections: 0,
      errors: 0,
      queries: 0,
      avgResponseTime: 0
    };
  }

  /**
   * Initialize Oracle client and create connection pool
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
      oracledb.outFormat = this.dbConfig.options.outFormat;
      oracledb.fetchAsString = this.dbConfig.options.fetchAsString;

      // Create connection pool
      this.pool = await oracledb.createPool({
        user: this.dbConfig.username,
        password: this.dbConfig.password,
        connectString: this.dbConfig.serviceName,
        poolMin: this.dbConfig.pool.min,
        poolMax: this.dbConfig.pool.max,
        poolIncrement: this.dbConfig.pool.increment,
        poolTimeout: this.dbConfig.pool.timeout,
        poolPingInterval: this.dbConfig.pool.pingInterval,
        enableStatistics: this.dbConfig.pool.enableStatistics,
        walletLocation: this.dbConfig.walletLocation,
        walletPassword: this.dbConfig.walletPassword
      });

      this.isInitialized = true;

      logger.info(`✅ Database pool initialized`, {
        environment: this.environment,
        poolSize: `${this.dbConfig.pool.min}-${this.dbConfig.pool.max}`,
        serviceName: this.dbConfig.serviceName
      });

      // Start connection monitoring if enabled
      if (config.monitoring.enableHealthCheck) {
        this.startHealthMonitoring();
      }

    } catch (error) {
      logger.error(`❌ Failed to initialize database pool`, {
        environment: this.environment,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get connection from pool with performance tracking
   */
  async getConnection() {
    if (!this.pool) {
      throw new Error('Database pool not initialized');
    }

    const startTime = Date.now();
    
    try {
      const connection = await this.pool.getConnection();
      
      this.connectionStats.totalConnections++;
      this.connectionStats.activeConnections++;
      
      const duration = Date.now() - startTime;
      logger.debug(`Connection acquired in ${duration}ms`);
      
      // Wrap connection close to update stats
      const originalClose = connection.close.bind(connection);
      connection.close = async () => {
        this.connectionStats.activeConnections--;
        return await originalClose();
      };
      
      return connection;
    } catch (error) {
      this.connectionStats.errors++;
      logger.error('Failed to get database connection', { error: error.message });
      throw error;
    }
  }

  /**
   * Execute query with performance tracking and error handling
   */
  async executeQuery(sql, binds = {}, options = {}) {
    const startTime = Date.now();
    const connection = await this.getConnection();
    
    try {
      if (config.logging.enableQueryLogging) {
        logger.debug('Executing query', { sql: sql.substring(0, 100) + '...' });
      }
      
      const result = await connection.execute(sql, binds, {
        autoCommit: this.dbConfig.options.autoCommit,
        ...options
      });
      
      const duration = Date.now() - startTime;
      this.connectionStats.queries++;
      
      // Update average response time
      this.connectionStats.avgResponseTime = 
        (this.connectionStats.avgResponseTime * (this.connectionStats.queries - 1) + duration) / 
        this.connectionStats.queries;
      
      if (config.logging.enablePerformanceLogging) {
        logger.info('Query executed', {
          duration: `${duration}ms`,
          rows: result.rows?.length || 0
        });
      }
      
      return result;
    } catch (error) {
      this.connectionStats.errors++;
      logger.error('Query execution failed', {
        error: error.message,
        sql: sql.substring(0, 100) + '...'
      });
      throw error;
    } finally {
      await connection.close();
    }
  }

  /**
   * Health check for monitoring
   */
  async healthCheck() {
    const startTime = Date.now();
    
    try {
      const result = await this.executeQuery('SELECT 1 as health_check FROM DUAL');
      const duration = Date.now() - startTime;
      
      return {
        status: 'healthy',
        environment: this.environment,
        responseTime: `${duration}ms`,
        poolStats: await this.getPoolStatistics(),
        connectionStats: this.connectionStats,
        connection: 'active'
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        environment: this.environment,
        error: error.message,
        connectionStats: this.connectionStats,
        connection: 'failed'
      };
    }
  }

  /**
   * Get pool statistics
   */
  async getPoolStatistics() {
    if (!this.pool) {
      return null;
    }

    return {
      connectionsInUse: this.pool.connectionsInUse,
      connectionsOpen: this.pool.connectionsOpen,
      poolMin: this.dbConfig.pool.min,
      poolMax: this.dbConfig.pool.max,
      poolIncrement: this.dbConfig.pool.increment
    };
  }

  /**
   * Start health monitoring
   */
  startHealthMonitoring() {
    setInterval(async () => {
      try {
        const health = await this.healthCheck();
        if (health.status === 'unhealthy') {
          logger.warn('Database health check failed', health);
        } else {
          logger.debug('Database health check passed', {
            responseTime: health.responseTime,
            connectionsInUse: health.poolStats?.connectionsInUse
          });
        }
      } catch (error) {
        logger.error('Health monitoring error', { error: error.message });
      }
    }, config.monitoring.healthCheckInterval);
  }

  /**
   * Close database pool
   */
  async close() {
    if (this.pool) {
      try {
        await this.pool.close(10);
        this.isInitialized = false;
        logger.info(`🔌 Database pool closed for ${this.environment} environment`);
      } catch (error) {
        logger.error('Error closing database pool', { error: error.message });
      }
    }
  }

  // ===============================
  // USER MANAGEMENT METHODS
  // ===============================

  /**
   * Find user by username or email
   */
  async findUserByUsernameOrEmail(username, email) {
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
      FROM users 
      WHERE username = :username OR email = :email
    `;
    
    const result = await this.executeQuery(sql, { username, email });
    return result.rows.length > 0 ? result.rows[0] : null;
  }

  /**
   * Get user by ID
   */
  async getUserById(userId) {
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
      FROM users 
      WHERE user_id = HEXTORAW(:userId)
    `;
    
    const result = await this.executeQuery(sql, { userId });
    return result.rows.length > 0 ? result.rows[0] : null;
  }

  /**
   * Create new user
   */
  async createUser(userData) {
    const sql = `
      INSERT INTO users (
        username, email, password_hash, schema_prefix, 
        first_name, last_name, created_at
      ) VALUES (
        :username, :email, :passwordHash, :schemaPrefix,
        :firstName, :lastName, CURRENT_TIMESTAMP
      ) RETURNING RAWTOHEX(user_id) INTO :userId
    `;
    
    const binds = {
      username: userData.username,
      email: userData.email,
      passwordHash: userData.passwordHash,
      schemaPrefix: userData.schemaPrefix,
      firstName: userData.firstName || null,
      lastName: userData.lastName || null,
      userId: { dir: oracledb.BIND_OUT, type: oracledb.STRING }
    };
    
    const result = await this.executeQuery(sql, binds, { autoCommit: true });
    return result.outBinds.userId;
  }

  /**
   * Create user-specific schema
   */
  async createUserSpecificSchema(schemaPrefix) {
    const connection = await this.getConnection();
    
    try {
      // Create user-specific tables using the schema creation function
      await createUserSchema(connection, schemaPrefix);
      logger.info(`User schema created: ${schemaPrefix}`);
    } catch (error) {
      logger.error(`Failed to create user schema: ${schemaPrefix}`, { error: error.message });
      throw error;
    } finally {
      await connection.close();
    }
  }

  /**
   * Create user session
   */
  async createUserSession(sessionData) {
    const sql = `
      INSERT INTO user_sessions (
        user_id, token_hash, expires_at, created_at
      ) VALUES (
        HEXTORAW(:userId), :tokenHash, :expiresAt, CURRENT_TIMESTAMP
      ) RETURNING RAWTOHEX(session_id) INTO :sessionId
    `;
    
    const binds = {
      userId: sessionData.userId,
      tokenHash: sessionData.tokenHash,
      expiresAt: sessionData.expiresAt,
      sessionId: { dir: oracledb.BIND_OUT, type: oracledb.STRING }
    };
    
    const result = await this.executeQuery(sql, binds, { autoCommit: true });
    return result.outBinds.sessionId;
  }

  /**
   * Get active session
   */
  async getActiveSession(tokenHash) {
    const sql = `
      SELECT 
        RAWTOHEX(session_id) as session_id,
        RAWTOHEX(user_id) as user_id,
        created_at,
        expires_at,
        last_activity
      FROM user_sessions 
      WHERE token_hash = :tokenHash 
        AND is_active = 1 
        AND expires_at > SYSTIMESTAMP
    `;
    
    const result = await this.executeQuery(sql, { tokenHash });
    return result.rows.length > 0 ? result.rows[0] : null;
  }

  /**
   * Update session activity
   */
  async updateSessionActivity(sessionId) {
    const sql = `
      UPDATE user_sessions 
      SET last_activity = SYSTIMESTAMP 
      WHERE session_id = HEXTORAW(:sessionId)
    `;
    
    await this.executeQuery(sql, { sessionId }, { autoCommit: true });
  }

  /**
   * Invalidate user sessions
   */
  async invalidateUserSessions(userId) {
    const sql = `
      UPDATE user_sessions 
      SET is_active = 0 
      WHERE user_id = HEXTORAW(:userId)
    `;
    
    await this.executeQuery(sql, { userId }, { autoCommit: true });
  }

  /**
   * Update last login
   */
  async updateLastLogin(userId) {
    const sql = `
      UPDATE users 
      SET last_login = SYSTIMESTAMP 
      WHERE user_id = HEXTORAW(:userId)
    `;
    
    await this.executeQuery(sql, { userId }, { autoCommit: true });
  }

  /**
   * Insert audit log
   */
  async insertAuditLog(logData) {
    const sql = `
      INSERT INTO audit_log (
        user_id, action, resource_type, resource_id, 
        request_data, response_code, execution_time_ms, 
        success, error_message, timestamp
      ) VALUES (
        ${logData.userId ? 'HEXTORAW(:userId)' : 'NULL'}, 
        :action, :resourceType, :resourceId,
        :requestData, :responseCode, :executionTimeMs,
        :success, :errorMessage, SYSTIMESTAMP
      )
    `;
    
    const binds = {
      action: logData.action,
      resourceType: logData.resourceType,
      resourceId: logData.resourceId,
      requestData: logData.requestData,
      responseCode: logData.responseCode,
      executionTimeMs: logData.executionTimeMs,
      success: logData.success ? 1 : 0,
      errorMessage: logData.errorMessage
    };

    if (logData.userId) {
      binds.userId = logData.userId;
    }
    
    try {
      await this.executeQuery(sql, binds, { autoCommit: true });
    } catch (error) {
      // Don't throw audit log errors to avoid cascading failures
      logger.error('Failed to insert audit log', { error: error.message, logData });
    }
  }

  // ===============================
  // USER-SCOPED DATA METHODS
  // ===============================

  /**
   * Get user quick context (Level 3) - Target: < 10ms
   */
  async getUserQuickContext(schemaPrefix) {
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
    
    const result = await this.executeQuery(sql);
    return result.rows.length > 0 ? result.rows[0] : null;
  }

  /**
   * Get user detailed profile (Level 2) - Target: < 50ms
   */
  async getUserDetailedProfile(schemaPrefix) {
    const sql = `
      SELECT 
        total_years_experience,
        JSON_VALUE(industries, '$') as industries,
        JSON_VALUE(core_strengths, '$') as core_strengths,
        JSON_VALUE(technical_skills, '$') as technical_skills,
        JSON_VALUE(soft_skills, '$') as soft_skills,
        JSON_VALUE(leadership_skills, '$') as leadership_skills,
        JSON_VALUE(career_interests, '$') as career_interests,
        JSON_VALUE(career_goals, '$') as career_goals,
        JSON_VALUE(career_progression, '$') as career_progression,
        JSON_VALUE(key_achievements, '$') as key_achievements,
        JSON_VALUE(education_summary, '$') as education_summary,
        JSON_VALUE(certifications, '$') as certifications,
        JSON_VALUE(languages, '$') as languages,
        JSON_VALUE(volunteer_experience, '$') as volunteer_experience,
        last_regenerated
      FROM ${schemaPrefix}_profile_summaries
      WHERE ROWNUM = 1
      ORDER BY last_regenerated DESC
    `;
    
    const result = await this.executeQuery(sql);
    return result.rows.length > 0 ? result.rows[0] : null;
  }

  /**
   * Search user experiences (Level 1) - Target: < 200ms
   */
  async searchUserExperiences(schemaPrefix, filters = {}) {
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
    
    const result = await this.executeQuery(sql, binds);
    return result.rows;
  }

  /**
   * Store user experience
   */
  async storeUserExperience(schemaPrefix, experience) {
    const sql = `
      INSERT INTO ${schemaPrefix}_experiences_detailed (
        title, organization, department, location, description, 
        start_date, end_date, is_current, experience_type, employment_type,
        extracted_skills, key_highlights, quantified_impacts, 
        technologies_used, achievements, team_size, budget_managed,
        revenue_impact, cost_savings
      ) VALUES (
        :title, :organization, :department, :location, :description,
        TO_DATE(:startDate, 'YYYY-MM-DD'), 
        ${experience.endDate ? "TO_DATE(:endDate, 'YYYY-MM-DD')" : 'NULL'},
        :isCurrent, :experienceType, :employmentType,
        :extractedSkills, :keyHighlights, :quantifiedImpacts,
        :technologiesUsed, :achievements, :teamSize, :budgetManaged,
        :revenueImpact, :costSavings
      ) RETURNING RAWTOHEX(experience_id) INTO :experienceId
    `;
    
    const binds = {
      title: experience.title,
      organization: experience.organization || null,
      department: experience.department || null,
      location: experience.location || null,
      description: experience.description,
      startDate: experience.startDate,
      isCurrent: experience.isCurrent ? 1 : 0,
      experienceType: experience.experienceType,
      employmentType: experience.employmentType || null,
      extractedSkills: experience.extractedSkills ? JSON.stringify(experience.extractedSkills) : null,
      keyHighlights: experience.keyHighlights ? JSON.stringify(experience.keyHighlights) : null,
      quantifiedImpacts: experience.quantifiedImpacts ? JSON.stringify(experience.quantifiedImpacts) : null,
      technologiesUsed: experience.technologiesUsed ? JSON.stringify(experience.technologiesUsed) : null,
      achievements: experience.achievements ? JSON.stringify(experience.achievements) : null,
      teamSize: experience.teamSize || null,
      budgetManaged: experience.budgetManaged || null,
      revenueImpact: experience.revenueImpact || null,
      costSavings: experience.costSavings || null,
      experienceId: { dir: oracledb.BIND_OUT, type: oracledb.STRING }
    };

    if (experience.endDate) {
      binds.endDate = experience.endDate;
    }
    
    const result = await this.executeQuery(sql, binds, { autoCommit: true });
    return result.outBinds.experienceId;
  }

  /**
   * Update user profile summary (Level 2 aggregation)
   */
  async updateUserProfileSummary(schemaPrefix, profileData) {
    // Use MERGE to handle insert/update
    const sql = `
      MERGE INTO ${schemaPrefix}_profile_summaries ps
      USING (SELECT 1 FROM DUAL) ON (1=1)
      WHEN MATCHED THEN UPDATE SET
        total_years_experience = :totalYearsExperience,
        industries = :industries,
        core_strengths = :coreStrengths,
        technical_skills = :technicalSkills,
        soft_skills = :softSkills,
        leadership_skills = :leadershipSkills,
        career_interests = :careerInterests,
        career_goals = :careerGoals,
        career_progression = :careerProgression,
        key_achievements = :keyAchievements,
        education_summary = :educationSummary,
        certifications = :certifications,
        languages = :languages,
        volunteer_experience = :volunteerExperience,
        last_regenerated = SYSTIMESTAMP,
        updated_at = SYSTIMESTAMP
      WHEN NOT MATCHED THEN INSERT (
        total_years_experience, industries, core_strengths, technical_skills,
        soft_skills, leadership_skills, career_interests, career_goals,
        career_progression, key_achievements, education_summary, certifications,
        languages, volunteer_experience
      ) VALUES (
        :totalYearsExperience, :industries, :coreStrengths, :technicalSkills,
        :softSkills, :leadershipSkills, :careerInterests, :careerGoals,
        :careerProgression, :keyAchievements, :educationSummary, :certifications,
        :languages, :volunteerExperience
      )
    `;
    
    const binds = {
      totalYearsExperience: profileData.totalYearsExperience || null,
      industries: JSON.stringify(profileData.industries || []),
      coreStrengths: JSON.stringify(profileData.coreStrengths || {}),
      technicalSkills: JSON.stringify(profileData.technicalSkills || {}),
      softSkills: JSON.stringify(profileData.softSkills || {}),
      leadershipSkills: JSON.stringify(profileData.leadershipSkills || {}),
      careerInterests: JSON.stringify(profileData.careerInterests || {}),
      careerGoals: JSON.stringify(profileData.careerGoals || {}),
      careerProgression: JSON.stringify(profileData.careerProgression || {}),
      keyAchievements: JSON.stringify(profileData.keyAchievements || {}),
      educationSummary: JSON.stringify(profileData.educationSummary || {}),
      certifications: JSON.stringify(profileData.certifications || {}),
      languages: JSON.stringify(profileData.languages || {}),
      volunteerExperience: JSON.stringify(profileData.volunteerExperience || {})
    };
    
    await this.executeQuery(sql, binds, { autoCommit: true });
  }

  /**
   * Update user quick summary (Level 3 optimization)
   */
  async updateUserQuickSummary(schemaPrefix, summaryData) {
    // Use MERGE to handle insert/update
    const sql = `
      MERGE INTO ${schemaPrefix}_quick_summaries qs
      USING (SELECT 1 FROM DUAL) ON (1=1)
      WHEN MATCHED THEN UPDATE SET
        executive_summary = :executiveSummary,
        headline = :headline,
        key_skills = :keySkills,
        years_experience = :yearsExperience,
        current_role = :currentRole,
        current_company = :currentCompany,
        industries = :industries,
        education_level = :educationLevel,
        top_certifications = :topCertifications,
        location = :location,
        career_goals = :careerGoals,
        unique_value_props = :uniqueValueProps,
        availability = :availability,
        last_updated = SYSTIMESTAMP
      WHEN NOT MATCHED THEN INSERT (
        executive_summary, headline, key_skills, years_experience,
        current_role, current_company, industries, education_level,
        top_certifications, location, career_goals, unique_value_props, availability
      ) VALUES (
        :executiveSummary, :headline, :keySkills, :yearsExperience,
        :currentRole, :currentCompany, :industries, :educationLevel,
        :topCertifications, :location, :careerGoals, :uniqueValueProps, :availability
      )
    `;
    
    const binds = {
      executiveSummary: summaryData.executiveSummary,
      headline: summaryData.headline,
      keySkills: JSON.stringify(summaryData.keySkills || []),
      yearsExperience: summaryData.yearsExperience || null,
      currentRole: summaryData.currentRole || null,
      currentCompany: summaryData.currentCompany || null,
      industries: JSON.stringify(summaryData.industries || []),
      educationLevel: summaryData.educationLevel || null,
      topCertifications: JSON.stringify(summaryData.topCertifications || []),
      location: summaryData.location || null,
      careerGoals: JSON.stringify(summaryData.careerGoals || {}),
      uniqueValueProps: JSON.stringify(summaryData.uniqueValueProps || {}),
      availability: summaryData.availability || null
    };
    
    await this.executeQuery(sql, binds, { autoCommit: true });
  }
}

// Create singleton instance
const databaseManager = new DatabaseManager();

// Export multi-database manager if configured
const multiDbManager = config.activeDatabases === 'both' ? require('./multi-database') : null;

module.exports = config.activeDatabases === 'both' ? multiDbManager : databaseManager;