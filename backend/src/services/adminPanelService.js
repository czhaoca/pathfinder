const db = require('./database');
const { encrypt, decrypt } = require('./encryption');
const UserRepository = require('../repositories/userRepository');
const ConfigurationRepository = require('../repositories/configurationRepository');
const AuditService = require('./auditService');
const CacheService = require('./cacheService');
const AuthService = require('./authService');
const EmailService = require('./emailService');
const crypto = require('crypto');
const EventEmitter = require('events');

class AdminPanelService extends EventEmitter {
  constructor(dependencies = {}) {
    super();
    
    this.db = dependencies.db || db;
    this.userRepository = dependencies.userRepository || new UserRepository();
    this.configRepository = dependencies.configRepository || new ConfigurationRepository();
    this.auditService = dependencies.auditService || new AuditService();
    this.cacheService = dependencies.cacheService || new CacheService();
    this.authService = dependencies.authService || new AuthService();
    this.emailService = dependencies.emailService || new EmailService();
    
    // Initialize health check intervals
    this.healthChecks = new Map();
    this.initializeHealthChecks();
  }

  /**
   * Get comprehensive dashboard data
   */
  async getDashboardData() {
    try {
      const [
        systemStats,
        userStats,
        recentActivity,
        alerts,
        jobStatus,
        serviceHealth
      ] = await Promise.all([
        this.getSystemStats(),
        this.getUserStats(),
        this.getRecentActivity(),
        this.getActiveAlerts(),
        this.getJobStatus(),
        this.getServicesHealth()
      ]);

      return {
        systemStats,
        userStats,
        recentActivity,
        alerts,
        jobStatus,
        serviceHealth,
        timestamp: new Date()
      };
    } catch (error) {
      console.error('Error getting dashboard data:', error);
      throw new Error('Failed to load dashboard data');
    }
  }

  /**
   * Get system statistics
   */
  async getSystemStats() {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    // Get database stats
    const dbStats = await this.getDatabaseStats();
    
    // Get cache stats
    const cacheStats = await this.cacheService.getStats();
    
    // Get storage stats
    const storageStats = await this.getStorageStats();

    return {
      uptime: process.uptime(),
      memory: {
        used: memoryUsage.heapUsed,
        total: memoryUsage.heapTotal,
        percentage: (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100
      },
      cpu: cpuUsage,
      database: dbStats,
      cache: cacheStats,
      storage: storageStats
    };
  }

  /**
   * Get user statistics
   */
  async getUserStats() {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thisWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thisMonth = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const result = await this.db.query(`
      SELECT 
        COUNT(*) as TOTAL_USERS,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as ACTIVE_USERS,
        COUNT(CASE WHEN created_at >= :today THEN 1 END) as NEW_TODAY,
        COUNT(CASE WHEN created_at >= :thisWeek THEN 1 END) as NEW_WEEK,
        COUNT(CASE WHEN created_at >= :thisMonth THEN 1 END) as NEW_MONTH
      FROM pf_users
    `, { today, thisWeek, thisMonth });

    const statusBreakdown = await this.db.query(`
      SELECT status, COUNT(*) as count
      FROM pf_users
      GROUP BY status
    `);

    const roleBreakdown = await this.db.query(`
      SELECT r.name as role, COUNT(*) as count
      FROM pf_users u
      JOIN pf_user_roles ur ON u.id = ur.user_id
      JOIN pf_roles r ON ur.role_id = r.id
      WHERE ur.is_active = 1
      GROUP BY r.name
    `);

    const stats = result.rows[0];
    
    return {
      total: parseInt(stats.TOTAL_USERS),
      active: parseInt(stats.ACTIVE_USERS),
      new: {
        today: parseInt(stats.NEW_TODAY),
        week: parseInt(stats.NEW_WEEK),
        month: parseInt(stats.NEW_MONTH)
      },
      byStatus: statusBreakdown.rows.reduce((acc, row) => {
        acc[row.STATUS] = parseInt(row.COUNT);
        return acc;
      }, {}),
      byRole: roleBreakdown.rows.reduce((acc, row) => {
        acc[row.ROLE] = parseInt(row.COUNT);
        return acc;
      }, {})
    };
  }

  /**
   * Get recent admin activity
   */
  async getRecentActivity(limit = 10) {
    const result = await this.db.query(`
      SELECT 
        al.event_name as ACTION,
        u.username as USERNAME,
        al.created_at as TIMESTAMP,
        al.event_category as CATEGORY,
        al.action_result as RESULT
      FROM pf_audit_log al
      JOIN pf_users u ON al.actor_id = u.id
      WHERE al.event_category IN ('admin', 'configuration', 'security')
      ORDER BY al.created_at DESC
      FETCH FIRST :limit ROWS ONLY
    `, { limit });

    return result.rows.map(row => ({
      action: row.ACTION,
      username: row.USERNAME,
      timestamp: row.TIMESTAMP,
      category: row.CATEGORY,
      result: row.RESULT
    }));
  }

  /**
   * Get active security alerts
   */
  async getActiveAlerts() {
    const result = await this.db.query(`
      SELECT 
        id as ID,
        severity as SEVERITY,
        message as MESSAGE,
        created_at as CREATED_AT,
        resolved as RESOLVED
      FROM pf_security_alerts
      WHERE resolved = 0
      ORDER BY 
        CASE severity
          WHEN 'critical' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          WHEN 'low' THEN 4
          ELSE 5
        END,
        created_at DESC
    `);

    return result.rows.map(row => ({
      id: row.ID,
      severity: row.SEVERITY,
      message: row.MESSAGE,
      createdAt: row.CREATED_AT,
      resolved: row.RESOLVED === 1
    }));
  }

  /**
   * Get background job status
   */
  async getJobStatus() {
    const result = await this.db.query(`
      SELECT 
        status,
        COUNT(*) as count
      FROM pf_background_jobs
      WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '24' HOUR
      GROUP BY status
    `);

    const statusCounts = result.rows.reduce((acc, row) => {
      acc[row.STATUS] = parseInt(row.COUNT);
      return acc;
    }, {});

    return {
      running: statusCounts.running || 0,
      queued: statusCounts.queued || 0,
      failed: statusCounts.failed || 0,
      completed: statusCounts.completed || 0
    };
  }

  /**
   * Get users with filtering and pagination
   */
  async getUsers(filters) {
    const { users, total } = await this.userRepository.searchUsers(filters);
    
    return {
      users,
      total,
      page: filters.page,
      limit: filters.limit,
      totalPages: Math.ceil(total / filters.limit)
    };
  }

  /**
   * Perform bulk operations on users
   */
  async bulkUserOperation(userIds, operation, reason, adminId) {
    const results = {
      processed: 0,
      successful: 0,
      failed: 0,
      details: []
    };

    for (const userId of userIds) {
      try {
        await this.db.transaction(async (trx) => {
          switch (operation) {
            case 'suspend':
              await trx.execute(`
                UPDATE pf_users 
                SET status = 'suspended', 
                    updated_at = CURRENT_TIMESTAMP 
                WHERE id = :userId
              `, { userId });
              break;
              
            case 'activate':
              await trx.execute(`
                UPDATE pf_users 
                SET status = 'active', 
                    updated_at = CURRENT_TIMESTAMP 
                WHERE id = :userId
              `, { userId });
              break;
              
            case 'delete':
              // Soft delete
              await trx.execute(`
                UPDATE pf_users 
                SET status = 'deleted', 
                    deleted_at = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP 
                WHERE id = :userId
              `, { userId });
              break;
              
            case 'reset_password':
              // Generate password reset token
              const resetToken = crypto.randomBytes(32).toString('hex');
              await trx.execute(`
                INSERT INTO pf_password_resets (user_id, token, expires_at)
                VALUES (:userId, :token, :expiresAt)
              `, {
                userId,
                token: resetToken,
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
              });
              
              // Send reset email
              const user = await this.userRepository.findById(userId);
              await this.emailService.sendPasswordResetEmail(user.email, resetToken);
              break;
          }

          // Audit log for each operation
          await this.auditService.log({
            action: `USER_${operation.toUpperCase()}`,
            userId: adminId,
            targetId: userId,
            details: { reason }
          });

          await trx.commit();
          
          results.successful++;
          results.details.push({
            userId,
            status: 'success',
            operation
          });
        });
      } catch (error) {
        results.failed++;
        results.details.push({
          userId,
          status: 'failed',
          operation,
          error: error.message
        });
      }
      
      results.processed++;
    }

    return results;
  }

  /**
   * Create impersonation token
   */
  async createImpersonationToken(targetUserId, adminUserId) {
    // Get target user
    const targetUser = await this.userRepository.findById(targetUserId);
    if (!targetUser) {
      throw new Error('User not found');
    }

    // Check if target is admin
    if (targetUser.role === 'admin' || targetUser.role === 'site_admin') {
      throw new Error('Cannot impersonate other administrators');
    }

    // Check for existing active impersonation sessions by this admin
    const activeImpersonations = await this.db('pf_impersonation_sessions')
      .where('admin_id', adminUserId)
      .where('status', 'active')
      .where('expires_at', '>', new Date())
      .count('* as count')
      .first();

    const MAX_CONCURRENT_IMPERSONATIONS = 1;
    if (activeImpersonations && activeImpersonations.count >= MAX_CONCURRENT_IMPERSONATIONS) {
      throw new Error(`Maximum concurrent impersonation limit (${MAX_CONCURRENT_IMPERSONATIONS}) reached. Please end existing session first.`);
    }

    // Check if target user is already being impersonated
    const targetBeingImpersonated = await this.db('pf_impersonation_sessions')
      .where('target_user_id', targetUserId)
      .where('status', 'active')
      .where('expires_at', '>', new Date())
      .first();

    if (targetBeingImpersonated) {
      throw new Error('This user is already being impersonated by another admin');
    }

    // Generate impersonation token
    const tokenData = await this.authService.generateImpersonationToken(
      targetUser,
      adminUserId,
      {
        expiresIn: '1h',
        scope: 'impersonation',
        adminId: adminUserId
      }
    );

    // Record impersonation session
    const sessionId = this.generateId();
    await this.db('pf_impersonation_sessions').insert({
      id: sessionId,
      admin_id: adminUserId,
      target_user_id: targetUserId,
      token_hash: require('crypto').createHash('sha256').update(tokenData.token).digest('hex'),
      status: 'active',
      started_at: new Date(),
      expires_at: tokenData.expiresAt,
      ip_address: null, // Will be set from request context
      user_agent: null  // Will be set from request context
    });

    // Audit log
    await this.auditService.log({
      action: 'IMPERSONATION_STARTED',
      userId: adminUserId,
      targetId: targetUserId,
      details: {
        sessionId,
        expiresAt: tokenData.expiresAt
      }
    });

    return {
      token: tokenData.token,
      sessionId,
      expiresAt: tokenData.expiresAt,
      targetUser: {
        id: targetUser.id,
        username: targetUser.username,
        email: targetUser.email,
        role: targetUser.role
      }
    };
  }

  /**
   * End impersonation session
   */
  async endImpersonationSession(sessionId, adminId) {
    const session = await this.db('pf_impersonation_sessions')
      .where('id', sessionId)
      .where('admin_id', adminId)
      .first();

    if (!session) {
      throw new Error('Impersonation session not found');
    }

    await this.db('pf_impersonation_sessions')
      .where('id', sessionId)
      .update({
        status: 'ended',
        ended_at: new Date()
      });

    // Audit log
    await this.auditService.log({
      action: 'IMPERSONATION_ENDED',
      userId: adminId,
      targetId: session.target_user_id,
      details: { sessionId }
    });

    return { success: true };
  }

  /**
   * Get active impersonation sessions
   */
  async getActiveImpersonations(adminId = null) {
    let query = this.db('pf_impersonation_sessions')
      .select(
        'pf_impersonation_sessions.*',
        'admins.username as admin_username',
        'admins.email as admin_email',
        'targets.username as target_username',
        'targets.email as target_email'
      )
      .leftJoin('pf_users as admins', 'pf_impersonation_sessions.admin_id', 'admins.id')
      .leftJoin('pf_users as targets', 'pf_impersonation_sessions.target_user_id', 'targets.id')
      .where('pf_impersonation_sessions.status', 'active')
      .where('pf_impersonation_sessions.expires_at', '>', new Date());

    if (adminId) {
      query = query.where('pf_impersonation_sessions.admin_id', adminId);
    }

    return await query.orderBy('pf_impersonation_sessions.started_at', 'desc');
  }

  /**
   * Advanced user search
   */
  async advancedUserSearch(searchParams) {
    let query = `
      SELECT DISTINCT
        u.id as ID,
        u.username as USERNAME,
        u.email as EMAIL,
        u.status as STATUS,
        u.created_at as CREATED_AT,
        u.last_login as LAST_ACTIVE,
        (SELECT COUNT(*) FROM pf_experiences WHERE user_id = u.id) as EXPERIENCE_COUNT,
        r.name as ROLE
      FROM pf_users u
      LEFT JOIN pf_user_roles ur ON u.id = ur.user_id
      LEFT JOIN pf_roles r ON ur.role_id = r.id
      WHERE 1=1
    `;
    
    const params = {};
    
    if (searchParams.email) {
      query += ` AND u.email LIKE :emailPattern`;
      params.emailPattern = `%${searchParams.email}%`;
    }
    
    if (searchParams.createdAfter) {
      query += ` AND u.created_at >= :createdAfter`;
      params.createdAfter = searchParams.createdAfter;
    }
    
    if (searchParams.createdBefore) {
      query += ` AND u.created_at <= :createdBefore`;
      params.createdBefore = searchParams.createdBefore;
    }
    
    if (searchParams.lastActiveAfter) {
      query += ` AND u.last_login >= :lastActiveAfter`;
      params.lastActiveAfter = searchParams.lastActiveAfter;
    }
    
    if (searchParams.hasProfile) {
      query += ` AND EXISTS (SELECT 1 FROM pf_user_profiles WHERE user_id = u.id)`;
    }
    
    if (searchParams.minExperiences) {
      query += ` AND (SELECT COUNT(*) FROM pf_experiences WHERE user_id = u.id) >= :minExperiences`;
      params.minExperiences = searchParams.minExperiences;
    }
    
    // Add sorting
    const sortColumn = {
      'createdAt': 'u.created_at',
      'lastActive': 'u.last_login',
      'email': 'u.email',
      'username': 'u.username'
    }[searchParams.sortBy] || 'u.created_at';
    
    query += ` ORDER BY ${sortColumn} ${searchParams.sortOrder === 'asc' ? 'ASC' : 'DESC'}`;
    
    const result = await this.db.query(query, params);
    
    return {
      users: result.rows.map(row => ({
        id: row.ID,
        username: row.USERNAME,
        email: row.EMAIL,
        status: row.STATUS,
        role: row.ROLE,
        createdAt: row.CREATED_AT,
        lastActive: row.LAST_ACTIVE,
        experienceCount: parseInt(row.EXPERIENCE_COUNT)
      })),
      total: result.rows.length
    };
  }

  /**
   * Get security policies
   */
  async getSecurityPolicies() {
    const result = await this.db.query(`
      SELECT policy_type as POLICY_TYPE, settings as SETTINGS
      FROM pf_security_policies
    `);

    const policies = {};
    
    result.rows.forEach(row => {
      const settings = typeof row.SETTINGS === 'string' 
        ? JSON.parse(row.SETTINGS) 
        : row.SETTINGS;
      
      switch (row.POLICY_TYPE) {
        case 'password':
          policies.passwordPolicy = settings;
          break;
        case 'session':
          policies.sessionPolicy = settings;
          break;
        case 'rate_limiting':
          policies.rateLimiting = settings;
          break;
      }
    });

    return policies;
  }

  /**
   * Update rate limiting settings
   */
  async updateRateLimits(endpoint, settings, reason, userId) {
    // Get current settings
    const current = await this.db.query(`
      SELECT attempts as ATTEMPTS, window as WINDOW
      FROM pf_rate_limits
      WHERE endpoint = :endpoint
    `, { endpoint });

    const previousSettings = current.rows[0] || { ATTEMPTS: null, WINDOW: null };

    // Update settings
    await this.db.execute(`
      MERGE INTO pf_rate_limits rl
      USING (SELECT :endpoint as endpoint FROM dual) src
      ON (rl.endpoint = src.endpoint)
      WHEN MATCHED THEN
        UPDATE SET 
          attempts = :attempts,
          window = :window,
          updated_at = CURRENT_TIMESTAMP,
          updated_by = :userId
      WHEN NOT MATCHED THEN
        INSERT (id, endpoint, attempts, window, created_by)
        VALUES (SYS_GUID(), :endpoint, :attempts, :window, :userId)
    `, {
      endpoint,
      attempts: settings.attempts,
      window: settings.window,
      userId
    });

    // Clear rate limit caches
    await this.cacheService.clearPattern('rate_limit:*');

    return {
      endpoint,
      attempts: settings.attempts,
      window: settings.window,
      previousAttempts: previousSettings.ATTEMPTS,
      previousWindow: previousSettings.WINDOW
    };
  }

  /**
   * Get service health status
   */
  async getServicesHealth() {
    const services = [
      { name: 'database', check: () => this.checkDatabase() },
      { name: 'redis', check: () => this.checkRedis() },
      { name: 'mcp_server', check: () => this.checkMCPServer() },
      { name: 'email', check: () => this.checkEmailService() },
      { name: 'storage', check: () => this.checkStorage() }
    ];

    const health = {};
    
    for (const service of services) {
      try {
        const result = await service.check();
        health[service.name] = {
          status: result.healthy ? 'healthy' : 'unhealthy',
          responseTime: result.responseTime,
          details: result.details,
          lastCheck: new Date()
        };
      } catch (error) {
        health[service.name] = {
          status: 'error',
          error: error.message,
          lastCheck: new Date()
        };
      }
    }

    return health;
  }

  /**
   * Restart a service
   */
  async restartService(serviceName, reason, userId) {
    // Get current status
    const healthBefore = await this[`check${this.capitalizeService(serviceName)}`]();
    
    // Execute restart based on service type
    await this.executeServiceRestart(serviceName);
    
    // Wait for service to come back up
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Check health after restart
    const healthAfter = await this[`check${this.capitalizeService(serviceName)}`]();
    
    // Audit log
    await this.auditService.log({
      action: 'SERVICE_RESTART',
      userId,
      target: serviceName,
      details: {
        reason,
        statusBefore: healthBefore.healthy ? 'healthy' : 'unhealthy',
        statusAfter: healthAfter.healthy ? 'healthy' : 'unhealthy'
      }
    });

    return {
      service: serviceName,
      status: 'restarted',
      previousStatus: healthBefore.healthy ? 'healthy' : 'unhealthy',
      newStatus: healthAfter.healthy ? 'healthy' : 'unhealthy',
      restartedAt: new Date()
    };
  }

  /**
   * Get background jobs
   */
  async getBackgroundJobs() {
    const result = await this.db.query(`
      SELECT 
        id,
        job_type,
        status,
        created_at,
        started_at,
        completed_at,
        error_message,
        retry_count
      FROM pf_background_jobs
      ORDER BY created_at DESC
      FETCH FIRST 100 ROWS ONLY
    `);

    return result.rows.map(row => ({
      id: row.ID,
      type: row.JOB_TYPE,
      status: row.STATUS,
      createdAt: row.CREATED_AT,
      startedAt: row.STARTED_AT,
      completedAt: row.COMPLETED_AT,
      error: row.ERROR_MESSAGE,
      retryCount: row.RETRY_COUNT
    }));
  }

  /**
   * Retry a failed job
   */
  async retryJob(jobId) {
    await this.db.execute(`
      UPDATE pf_background_jobs
      SET status = 'queued',
          retry_count = retry_count + 1,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = :jobId
      AND status = 'failed'
    `, { jobId });

    return {
      jobId,
      status: 'queued',
      retriedAt: new Date()
    };
  }

  // Helper methods
  async getDatabaseStats() {
    try {
      const result = await this.db.query(`
        SELECT 
          (SELECT COUNT(*) FROM v$session WHERE username IS NOT NULL) as connections,
          (SELECT value FROM v$parameter WHERE name = 'sessions') as max_connections
        FROM dual
      `);
      
      const stats = result.rows[0];
      
      return {
        connections: parseInt(stats.CONNECTIONS),
        maxConnections: parseInt(stats.MAX_CONNECTIONS),
        responseTime: 15 // Mock response time
      };
    } catch (error) {
      return {
        connections: 0,
        maxConnections: 0,
        error: error.message
      };
    }
  }

  async getStorageStats() {
    // Mock storage stats - would integrate with actual storage service
    return {
      used: 50 * 1024 * 1024 * 1024, // 50GB
      total: 100 * 1024 * 1024 * 1024, // 100GB
      percentage: 50
    };
  }

  async checkDatabase() {
    const startTime = Date.now();
    try {
      await this.db.query('SELECT 1 FROM dual');
      return {
        healthy: true,
        responseTime: Date.now() - startTime,
        details: await this.getDatabaseStats()
      };
    } catch (error) {
      return {
        healthy: false,
        responseTime: Date.now() - startTime,
        details: { error: error.message }
      };
    }
  }

  async checkRedis() {
    const startTime = Date.now();
    try {
      await this.cacheService.ping();
      return {
        healthy: true,
        responseTime: Date.now() - startTime,
        details: await this.cacheService.getInfo()
      };
    } catch (error) {
      return {
        healthy: false,
        responseTime: Date.now() - startTime,
        details: { error: error.message }
      };
    }
  }

  async checkMCPServer() {
    const startTime = Date.now();
    try {
      // Mock MCP server check - would make actual health check request
      return {
        healthy: true,
        responseTime: Date.now() - startTime,
        details: { status: 'running', version: '1.0.0' }
      };
    } catch (error) {
      return {
        healthy: false,
        responseTime: Date.now() - startTime,
        details: { error: error.message }
      };
    }
  }

  async checkEmailService() {
    const startTime = Date.now();
    try {
      await this.emailService.testConnection();
      return {
        healthy: true,
        responseTime: Date.now() - startTime,
        details: { provider: 'smtp', status: 'connected' }
      };
    } catch (error) {
      return {
        healthy: false,
        responseTime: Date.now() - startTime,
        details: { error: error.message }
      };
    }
  }

  async checkStorage() {
    const startTime = Date.now();
    try {
      const stats = await this.getStorageStats();
      return {
        healthy: stats.percentage < 90,
        responseTime: Date.now() - startTime,
        details: stats
      };
    } catch (error) {
      return {
        healthy: false,
        responseTime: Date.now() - startTime,
        details: { error: error.message }
      };
    }
  }

  async executeServiceRestart(serviceName) {
    // Mock service restart - would integrate with actual service management
    switch (serviceName) {
      case 'mcp_server':
        // Restart MCP server
        console.log('Restarting MCP server...');
        break;
      case 'redis':
        // Restart Redis
        console.log('Restarting Redis...');
        break;
      default:
        throw new Error(`Cannot restart service: ${serviceName}`);
    }
  }

  capitalizeService(serviceName) {
    const mapping = {
      'database': 'Database',
      'redis': 'Redis',
      'mcp_server': 'MCPServer',
      'email': 'EmailService',
      'storage': 'Storage'
    };
    return mapping[serviceName] || serviceName;
  }

  initializeHealthChecks() {
    // Set up periodic health checks
    setInterval(() => {
      this.getServicesHealth().then(health => {
        this.healthChecks.set(Date.now(), health);
        // Keep only last 100 checks
        if (this.healthChecks.size > 100) {
          const oldest = Math.min(...this.healthChecks.keys());
          this.healthChecks.delete(oldest);
        }
        
        // Emit health status for monitoring
        this.emit('health:updated', health);
      });
    }, 60000); // Every minute
  }

  /**
   * User Notes Management
   */
  async getUserNotes(userId, filters = {}) {
    let query = this.db('pf_user_notes')
      .where('user_id', userId)
      .orderBy('created_at', 'desc');

    if (filters.type) {
      query = query.where('note_type', filters.type);
    }

    if (filters.priority) {
      query = query.where('priority', filters.priority);
    }

    if (filters.pinned !== undefined) {
      query = query.where('is_pinned', filters.pinned ? 1 : 0);
    }

    const notes = await query.select(
      'id',
      'note_text',
      'note_type',
      'priority',
      'is_pinned',
      'is_internal',
      'created_at',
      'admin_id'
    );

    // Get admin names
    const adminIds = [...new Set(notes.map(n => n.admin_id))];
    const admins = await this.db('pf_users')
      .whereIn('id', adminIds)
      .select('id', 'username', 'full_name');

    const adminMap = new Map(admins.map(a => [a.id, a]));

    return notes.map(note => ({
      ...note,
      admin: adminMap.get(note.admin_id) || null
    }));
  }

  async addUserNote(userId, noteData, adminId) {
    const noteId = this.generateId();
    
    await this.db('pf_user_notes').insert({
      id: noteId,
      user_id: userId,
      admin_id: adminId,
      note_text: noteData.text,
      note_type: noteData.type || 'general',
      priority: noteData.priority || 'normal',
      is_pinned: noteData.pinned ? 1 : 0,
      is_internal: noteData.internal !== false ? 1 : 0,
      created_at: new Date()
    });

    // Audit log
    await this.auditService.log({
      action: 'USER_NOTE_ADDED',
      userId: adminId,
      targetId: userId,
      details: {
        noteId,
        type: noteData.type,
        priority: noteData.priority
      }
    });

    return { id: noteId };
  }

  async updateUserNote(noteId, updates, adminId) {
    const note = await this.db('pf_user_notes')
      .where('id', noteId)
      .first();

    if (!note) {
      throw new Error('Note not found');
    }

    await this.db('pf_user_notes')
      .where('id', noteId)
      .update({
        note_text: updates.text || note.note_text,
        note_type: updates.type || note.note_type,
        priority: updates.priority || note.priority,
        is_pinned: updates.pinned !== undefined ? (updates.pinned ? 1 : 0) : note.is_pinned,
        is_internal: updates.internal !== undefined ? (updates.internal ? 1 : 0) : note.is_internal,
        updated_at: new Date()
      });

    // Audit log
    await this.auditService.log({
      action: 'USER_NOTE_UPDATED',
      userId: adminId,
      targetId: note.user_id,
      details: { noteId, updates }
    });

    return { success: true };
  }

  async deleteUserNote(noteId, adminId) {
    const note = await this.db('pf_user_notes')
      .where('id', noteId)
      .first();

    if (!note) {
      throw new Error('Note not found');
    }

    await this.db('pf_user_notes')
      .where('id', noteId)
      .delete();

    // Audit log
    await this.auditService.log({
      action: 'USER_NOTE_DELETED',
      userId: adminId,
      targetId: note.user_id,
      details: { noteId }
    });

    return { success: true };
  }

  /**
   * User Tags Management
   */
  async getUserTags(userId) {
    const tags = await this.db('pf_user_tags')
      .where('user_id', userId)
      .select('id', 'tag_name', 'tag_color', 'added_by', 'added_at')
      .orderBy('tag_name');

    // Get admin names
    const adminIds = [...new Set(tags.map(t => t.added_by))];
    const admins = await this.db('pf_users')
      .whereIn('id', adminIds)
      .select('id', 'username');

    const adminMap = new Map(admins.map(a => [a.id, a.username]));

    return tags.map(tag => ({
      ...tag,
      added_by_username: adminMap.get(tag.added_by) || null
    }));
  }

  async addUserTag(userId, tagData, adminId) {
    const tagId = this.generateId();

    try {
      await this.db('pf_user_tags').insert({
        id: tagId,
        user_id: userId,
        tag_name: tagData.name,
        tag_color: tagData.color || '#0066CC',
        added_by: adminId,
        added_at: new Date()
      });

      // Audit log
      await this.auditService.log({
        action: 'USER_TAG_ADDED',
        userId: adminId,
        targetId: userId,
        details: { tagName: tagData.name }
      });

      return { id: tagId };
    } catch (error) {
      if (error.code === 'ORA-00001') { // Unique constraint violation
        throw new Error('User already has this tag');
      }
      throw error;
    }
  }

  async removeUserTag(userId, tagName, adminId) {
    const result = await this.db('pf_user_tags')
      .where('user_id', userId)
      .where('tag_name', tagName)
      .delete();

    if (result === 0) {
      throw new Error('Tag not found for user');
    }

    // Audit log
    await this.auditService.log({
      action: 'USER_TAG_REMOVED',
      userId: adminId,
      targetId: userId,
      details: { tagName }
    });

    return { success: true };
  }

  async getAllTags() {
    const tags = await this.db('pf_user_tags')
      .select('tag_name', 'tag_color')
      .count('* as count')
      .groupBy('tag_name', 'tag_color')
      .orderBy('count', 'desc');

    return tags.map(tag => ({
      name: tag.tag_name,
      color: tag.tag_color,
      count: parseInt(tag.count)
    }));
  }

  async searchUsersByTag(tagNames) {
    const users = await this.db('pf_users')
      .join('pf_user_tags', 'pf_users.id', 'pf_user_tags.user_id')
      .whereIn('pf_user_tags.tag_name', tagNames)
      .select(
        'pf_users.id',
        'pf_users.username',
        'pf_users.email',
        'pf_users.full_name',
        'pf_users.account_status'
      )
      .groupBy(
        'pf_users.id',
        'pf_users.username',
        'pf_users.email',
        'pf_users.full_name',
        'pf_users.account_status'
      );

    return users;
  }

  generateId() {
    return require('crypto').randomUUID();
  }
}

module.exports = AdminPanelService;