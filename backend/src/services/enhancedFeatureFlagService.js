/**
 * Enhanced Feature Flag Management Service
 * 
 * Advanced feature flag system with:
 * - Self-registration toggle with DDoS protection
 * - Redis caching for <5ms evaluation
 * - Real-time flag updates without restart
 * - Emergency kill switches
 * - Group-level and system-wide controls
 * - Comprehensive audit logging
 */

const crypto = require('crypto');
const { logger } = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

class EnhancedFeatureFlagService {
  constructor(db, cache, analyticsService, auditService) {
    this.db = db;
    this.cache = cache;
    this.analyticsService = analyticsService;
    this.auditService = auditService;
    
    // In-memory flag cache for ultra-fast lookups
    this.flags = new Map();
    this.flagsByCategory = new Map();
    this.systemFlags = new Map();
    
    // DDoS protection state
    this.registrationProtection = {
      enabled: false,
      rateLimit: 5,
      windowMinutes: 15,
      blockDurationMinutes: 60,
      captchaThreshold: 3,
      suspicionThreshold: 0.8
    };
    
    // Circuit breakers for resilience
    this.circuitBreakers = new Map();
    
    // Performance metrics
    this.evaluationMetrics = {
      totalEvaluations: 0,
      cacheHits: 0,
      avgEvaluationTime: 0
    };
    
    this.initializeService();
  }

  async initializeService() {
    try {
      // Load all active flags into memory
      await this.loadAllFlags();
      
      // Initialize critical system flags
      await this.initializeSystemFlags();
      
      // Set up real-time updates via Redis pub/sub
      if (this.cache) {
        await this.setupCacheSubscriptions();
      }
      
      // Start periodic sync
      this.startPeriodicSync();
      
      logger.info('Enhanced Feature Flag Service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Feature Flag Service:', error);
      throw error;
    }
  }

  async initializeSystemFlags() {
    // Define critical system flags
    const systemFlags = [
      {
        flag_key: 'self_registration_enabled',
        flag_name: 'Self-Registration',
        description: 'Allow new users to self-register. Critical for DDoS protection.',
        flag_type: 'boolean',
        default_value: 'false',
        category: 'security',
        is_system_wide: 'Y',
        requires_restart: 'N'
      },
      {
        flag_key: 'sso_google_enabled',
        flag_name: 'Google SSO',
        description: 'Enable Google Single Sign-On',
        flag_type: 'boolean',
        default_value: 'false',
        category: 'authentication',
        is_system_wide: 'Y',
        requires_restart: 'N'
      },
      {
        flag_key: 'sso_microsoft_enabled',
        flag_name: 'Microsoft SSO',
        description: 'Enable Microsoft Single Sign-On',
        flag_type: 'boolean',
        default_value: 'false',
        category: 'authentication',
        is_system_wide: 'Y',
        requires_restart: 'N'
      },
      {
        flag_key: 'rate_limiting_enabled',
        flag_name: 'Global Rate Limiting',
        description: 'Enable rate limiting for API endpoints',
        flag_type: 'boolean',
        default_value: 'true',
        category: 'security',
        is_system_wide: 'Y',
        requires_restart: 'N'
      },
      {
        flag_key: 'maintenance_mode',
        flag_name: 'Maintenance Mode',
        description: 'Emergency maintenance mode - blocks all non-admin access',
        flag_type: 'boolean',
        default_value: 'false',
        category: 'system',
        is_system_wide: 'Y',
        requires_restart: 'N'
      }
    ];

    for (const flag of systemFlags) {
      const existing = await this.getFlag(flag.flag_key);
      if (!existing) {
        await this.createFlag(flag);
      }
      this.systemFlags.set(flag.flag_key, flag);
    }
  }

  async loadAllFlags() {
    try {
      const sql = `
        SELECT 
          flag_id, flag_key, flag_name, description, flag_type,
          default_value, variants, rollout_percentage, targeting_rules,
          prerequisites, is_system_wide, requires_restart, is_archived,
          category, tags, enabled, start_date, end_date
        FROM pf_feature_flags
        WHERE is_archived = 'N' AND enabled = 'Y'
      `;
      
      const flags = await this.db.query(sql);
      
      // Clear and reload flags
      this.flags.clear();
      this.flagsByCategory.clear();
      
      for (const flag of flags) {
        // Parse JSON fields
        if (flag.variants) flag.variants = JSON.parse(flag.variants);
        if (flag.targeting_rules) flag.targeting_rules = JSON.parse(flag.targeting_rules);
        if (flag.prerequisites) flag.prerequisites = JSON.parse(flag.prerequisites);
        if (flag.tags) flag.tags = JSON.parse(flag.tags);
        
        // Store in memory
        this.flags.set(flag.flag_key, flag);
        
        // Index by category
        if (flag.category) {
          if (!this.flagsByCategory.has(flag.category)) {
            this.flagsByCategory.set(flag.category, new Set());
          }
          this.flagsByCategory.get(flag.category).add(flag.flag_key);
        }
      }
      
      logger.info(`Loaded ${flags.length} feature flags into memory`);
    } catch (error) {
      logger.error('Failed to load feature flags:', error);
      throw error;
    }
  }

  async setupCacheSubscriptions() {
    // Subscribe to flag update events
    await this.cache.subscribe('flag:updates', async (message) => {
      try {
        const update = JSON.parse(message);
        await this.handleFlagUpdate(update);
      } catch (error) {
        logger.error('Error handling flag update:', error);
      }
    });

    // Subscribe to emergency events
    await this.cache.subscribe('flag:emergency', async (message) => {
      try {
        const emergency = JSON.parse(message);
        await this.handleEmergencyEvent(emergency);
      } catch (error) {
        logger.error('Error handling emergency event:', error);
      }
    });
  }

  async handleFlagUpdate(update) {
    const { flag_key, action, data } = update;
    
    switch (action) {
      case 'created':
      case 'updated':
        // Reload specific flag
        const flag = await this.getFlag(flag_key);
        if (flag) {
          this.flags.set(flag_key, flag);
          logger.info(`Flag updated in memory: ${flag_key}`);
        }
        break;
        
      case 'deleted':
      case 'disabled':
        this.flags.delete(flag_key);
        logger.info(`Flag removed from memory: ${flag_key}`);
        break;
        
      case 'reload_all':
        await this.loadAllFlags();
        break;
    }
    
    // Clear evaluation cache
    await this.clearFlagCache(flag_key);
  }

  async handleEmergencyEvent(emergency) {
    const { type, reason, user_id } = emergency;
    
    logger.warn(`Emergency event received: ${type}`, { reason, user_id });
    
    switch (type) {
      case 'disable_self_registration':
        await this.toggleSelfRegistration(false, `EMERGENCY: ${reason}`, user_id);
        break;
        
      case 'enable_maintenance':
        await this.updateFlag('maintenance_mode', { default_value: 'true' }, 
          `EMERGENCY: ${reason}`, user_id);
        break;
        
      case 'disable_all_features':
        // Disable all non-critical features
        for (const [key, flag] of this.flags) {
          if (flag.category !== 'system' && flag.category !== 'security') {
            await this.updateFlag(key, { enabled: 'N' }, 
              `EMERGENCY SHUTDOWN: ${reason}`, user_id);
          }
        }
        break;
    }
  }

  /**
   * Evaluate feature flag with ultra-fast performance
   */
  async evaluateFlag(flagKey, context = {}, evaluationChain = new Set()) {
    const startTime = process.hrtime.bigint();
    
    try {
      // Check in-memory cache first (< 1ms)
      let flag = this.flags.get(flagKey);
      
      if (!flag) {
        // Check Redis cache (< 5ms)
        if (this.cache) {
          const cached = await this.cache.get(`flag:${flagKey}`);
          if (cached) {
            flag = JSON.parse(cached);
            this.flags.set(flagKey, flag); // Update memory cache
            this.evaluationMetrics.cacheHits++;
          }
        }
        
        if (!flag) {
          // Load from database as last resort
          flag = await this.getFlag(flagKey);
          if (flag) {
            this.flags.set(flagKey, flag);
            if (this.cache) {
              await this.cache.setex(`flag:${flagKey}`, 300, JSON.stringify(flag));
            }
          }
        }
      }
      
      if (!flag || flag.enabled !== 'Y') {
        return this.createEvaluation(flagKey, false, 'disabled');
      }
      
      // Check date validity
      const now = new Date();
      if (flag.start_date && now < new Date(flag.start_date)) {
        return this.createEvaluation(flagKey, false, 'not_started');
      }
      if (flag.end_date && now > new Date(flag.end_date)) {
        return this.createEvaluation(flagKey, false, 'expired');
      }
      
      // Check prerequisites with circular dependency protection
      if (flag.prerequisites && flag.prerequisites.length > 0) {
        // Circular dependency detection
        if (evaluationChain.has(flagKey)) {
          logger.error(`Circular dependency detected for flag: ${flagKey}`, {
            chain: Array.from(evaluationChain)
          });
          return this.createEvaluation(flagKey, false, 'circular_dependency');
        }
        
        // Add current flag to evaluation chain
        const newChain = new Set(evaluationChain);
        newChain.add(flagKey);
        
        for (const prereq of flag.prerequisites) {
          const prereqResult = await this.evaluateFlag(prereq, context, newChain);
          if (!prereqResult.value) {
            return this.createEvaluation(flagKey, false, 'prerequisites_not_met');
          }
        }
      }
      
      // Check user/group overrides
      if (context.userId || context.groupId) {
        const override = await this.checkOverrides(flag.flag_id, context);
        if (override !== null) {
          return this.createEvaluation(flagKey, override, 'override');
        }
      }
      
      // Evaluate targeting rules
      if (flag.targeting_rules && flag.targeting_rules.length > 0) {
        const targeted = this.evaluateTargetingRules(flag.targeting_rules, context);
        if (targeted !== null) {
          return this.createEvaluation(flagKey, targeted, 'targeting');
        }
      }
      
      // Handle percentage rollout
      if (flag.rollout_percentage && flag.rollout_percentage < 100) {
        const included = this.isInRollout(
          context.userId || context.sessionId || 'anonymous',
          flag.flag_key,
          flag.rollout_percentage
        );
        if (!included) {
          return this.createEvaluation(flagKey, false, 'rollout_excluded');
        }
      }
      
      // Return default value
      const value = this.parseValue(flag.default_value, flag.flag_type);
      return this.createEvaluation(flagKey, value, 'default');
      
    } finally {
      // Record metrics
      const endTime = process.hrtime.bigint();
      const evaluationTime = Number(endTime - startTime) / 1000000; // Convert to ms
      
      this.evaluationMetrics.totalEvaluations++;
      this.evaluationMetrics.avgEvaluationTime = 
        (this.evaluationMetrics.avgEvaluationTime * (this.evaluationMetrics.totalEvaluations - 1) + 
         evaluationTime) / this.evaluationMetrics.totalEvaluations;
      
      // Log if evaluation took too long
      if (evaluationTime > 5) {
        logger.warn(`Slow flag evaluation: ${flagKey} took ${evaluationTime.toFixed(2)}ms`);
      }
      
      // Record in analytics
      if (this.analyticsService) {
        await this.analyticsService.recordFlagEvaluation({
          flag_key: flagKey,
          evaluation_time: evaluationTime,
          context
        });
      }
    }
  }

  /**
   * Toggle self-registration with DDoS protection
   */
  async toggleSelfRegistration(enabled, reason, userId) {
    try {
      // Update the flag
      await this.updateFlag('self_registration_enabled', {
        default_value: enabled.toString(),
        enabled: 'Y'
      }, reason, userId);
      
      if (enabled) {
        // Enable DDoS protection
        await this.enableRegistrationProtection();
      } else {
        // Log emergency disable if needed
        if (reason.toLowerCase().includes('emergency') || 
            reason.toLowerCase().includes('attack') ||
            reason.toLowerCase().includes('ddos')) {
          await this.logEmergencyDisable(reason, userId);
        }
      }
      
      // Broadcast change to all instances
      if (this.cache) {
        await this.cache.publish('flag:updates', JSON.stringify({
          flag_key: 'self_registration_enabled',
          action: enabled ? 'enabled' : 'disabled',
          reason,
          user_id: userId
        }));
      }
      
      // Audit log
      await this.auditService.log({
        action: 'toggle_self_registration',
        entity_type: 'feature_flag',
        entity_id: 'self_registration_enabled',
        details: { enabled, reason },
        user_id: userId,
        severity: reason.includes('emergency') ? 'critical' : 'info'
      });
      
      return { success: true, enabled };
      
    } catch (error) {
      logger.error('Failed to toggle self-registration:', error);
      throw error;
    }
  }

  async enableRegistrationProtection() {
    // Configure enhanced DDoS protection
    this.registrationProtection.enabled = true;
    
    // Set rate limiting rules in cache
    if (this.cache) {
      await this.cache.setex('registration:protection', 86400, JSON.stringify({
        maxAttempts: this.registrationProtection.rateLimit,
        windowMinutes: this.registrationProtection.windowMinutes,
        blockDurationMinutes: this.registrationProtection.blockDurationMinutes,
        captchaThreshold: this.registrationProtection.captchaThreshold,
        enabled: true
      }));
    }
    
    logger.info('Registration DDoS protection enabled');
  }

  async checkRegistrationProtection(ipAddress, fingerprint, headers = {}) {
    try {
      // Check if self-registration is enabled
      const selfRegFlag = await this.evaluateFlag('self_registration_enabled');
      if (!selfRegFlag.value) {
        throw new Error('Self-registration is currently disabled');
      }
      
      // Check IP block status
      const blockKey = `registration:block:${ipAddress}`;
      if (this.cache) {
        const blocked = await this.cache.get(blockKey);
        if (blocked) {
          const blockInfo = JSON.parse(blocked);
          throw new Error(`Registration blocked until ${blockInfo.until}. Reason: ${blockInfo.reason}`);
        }
      }
      
      // Check rate limit
      const attemptKey = `registration:attempts:${ipAddress}`;
      let attempts = 0;
      
      if (this.cache) {
        attempts = await this.cache.incr(attemptKey);
        if (attempts === 1) {
          await this.cache.expire(attemptKey, this.registrationProtection.windowMinutes * 60);
        }
      }
      
      if (attempts > this.registrationProtection.rateLimit) {
        // Block the IP
        const blockUntil = new Date(Date.now() + this.registrationProtection.blockDurationMinutes * 60000);
        
        if (this.cache) {
          await this.cache.setex(blockKey, 
            this.registrationProtection.blockDurationMinutes * 60,
            JSON.stringify({
              until: blockUntil.toISOString(),
              reason: 'Too many registration attempts',
              attempts
            })
          );
        }
        
        // Record in database
        await this.recordProtectionEvent(ipAddress, fingerprint, 'blocked', 'rate_limit_exceeded');
        
        throw new Error('Too many registration attempts. Please try again later.');
      }
      
      // Calculate suspicion score
      const suspicionScore = await this.calculateSuspicionScore(ipAddress, fingerprint, headers);
      
      // Determine required verification
      const requireCaptcha = attempts > this.registrationProtection.captchaThreshold || 
                           suspicionScore > this.registrationProtection.suspicionThreshold;
      
      const requireEmailVerification = suspicionScore > 0.9;
      
      return {
        allowed: true,
        requireCaptcha,
        requireEmailVerification,
        attempts,
        suspicionScore,
        remainingAttempts: Math.max(0, this.registrationProtection.rateLimit - attempts)
      };
      
    } catch (error) {
      logger.error('Registration protection check failed:', error);
      throw error;
    }
  }

  async calculateSuspicionScore(ipAddress, fingerprint, headers) {
    let score = 0;
    
    // Check IP reputation (simplified - would use external service in production)
    const suspiciousIPs = await this.getSuspiciousIPs();
    if (suspiciousIPs.has(ipAddress)) {
      score += 0.4;
    }
    
    // Check for common bot patterns
    const userAgent = headers['user-agent'] || '';
    if (!userAgent || userAgent.includes('bot') || userAgent.includes('crawler')) {
      score += 0.3;
    }
    
    // Check for missing common headers
    if (!headers['accept-language'] || !headers['accept-encoding']) {
      score += 0.2;
    }
    
    // Check registration velocity from this IP
    const recentRegistrations = await this.getRecentRegistrations(ipAddress, 3600); // Last hour
    if (recentRegistrations > 2) {
      score += 0.3;
    }
    
    // Check fingerprint uniqueness
    if (fingerprint) {
      const fingerprintCount = await this.getFingerprintCount(fingerprint, 86400); // Last 24 hours
      if (fingerprintCount > 5) {
        score += 0.2;
      }
    }
    
    return Math.min(1, score);
  }

  async recordProtectionEvent(ipAddress, fingerprint, eventType, reason) {
    try {
      const sql = `
        INSERT INTO pf_registration_protection (
          protection_id, ip_address, fingerprint, 
          event_type, reason, event_timestamp
        ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `;
      
      await this.db.execute(sql, [
        uuidv4(),
        ipAddress,
        fingerprint,
        eventType,
        reason
      ]);
    } catch (error) {
      logger.error('Failed to record protection event:', error);
    }
  }

  async getRegistrationMetrics(timeRange = '24h') {
    try {
      const cutoff = this.getTimeCutoff(timeRange);
      
      const sql = `
        SELECT 
          COUNT(*) as total_attempts,
          SUM(CASE WHEN event_type = 'success' THEN 1 ELSE 0 END) as successful_registrations,
          SUM(CASE WHEN event_type = 'blocked' THEN 1 ELSE 0 END) as blocked_attempts,
          COUNT(DISTINCT ip_address) as unique_ips,
          COUNT(DISTINCT CASE WHEN suspicious_score > 0.5 THEN ip_address END) as suspicious_ips,
          AVG(CASE WHEN event_type = 'success' THEN processing_time_ms END) as avg_success_time
        FROM pf_registration_protection
        WHERE event_timestamp > ?
      `;
      
      const metrics = await this.db.queryOne(sql, [cutoff]);
      
      // Add CAPTCHA solve rate
      const captchaStats = await this.getCaptchaStats(cutoff);
      
      return {
        ...metrics,
        captchaSolveRate: captchaStats.solveRate,
        timeRange
      };
      
    } catch (error) {
      logger.error('Failed to get registration metrics:', error);
      return null;
    }
  }

  /**
   * Update feature flag configuration
   */
  async updateFlag(flagKey, updates, reason, userId) {
    try {
      const flag = await this.getFlag(flagKey);
      if (!flag) {
        throw new Error(`Flag ${flagKey} not found`);
      }
      
      // Create history entry
      await this.createFlagHistory({
        flag_id: flag.flag_id,
        change_type: 'updated',
        old_value: flag,
        new_value: { ...flag, ...updates },
        change_reason: reason,
        changed_by: userId
      });
      
      // Build update query
      const updateFields = [];
      const updateValues = [];
      
      for (const [key, value] of Object.entries(updates)) {
        updateFields.push(`${key} = ?`);
        updateValues.push(typeof value === 'object' ? JSON.stringify(value) : value);
      }
      
      updateFields.push('updated_at = CURRENT_TIMESTAMP');
      
      const sql = `
        UPDATE pf_feature_flags 
        SET ${updateFields.join(', ')}
        WHERE flag_key = ?
      `;
      
      updateValues.push(flagKey);
      await this.db.execute(sql, updateValues);
      
      // Clear caches
      await this.clearFlagCache(flagKey);
      
      // Reload flag
      const updatedFlag = await this.getFlag(flagKey);
      this.flags.set(flagKey, updatedFlag);
      
      // Broadcast update
      if (this.cache) {
        await this.cache.publish('flag:updates', JSON.stringify({
          flag_key: flagKey,
          action: 'updated',
          data: updatedFlag
        }));
      }
      
      return updatedFlag;
      
    } catch (error) {
      logger.error(`Failed to update flag ${flagKey}:`, error);
      throw error;
    }
  }

  /**
   * Emergency kill switch for features
   */
  async emergencyDisable(flagKey, reason, userId) {
    try {
      // Immediately disable in memory
      const flag = this.flags.get(flagKey);
      if (flag) {
        flag.enabled = 'N';
      }
      
      // Update database
      await this.updateFlag(flagKey, {
        enabled: 'N',
        disabled_reason: `EMERGENCY: ${reason}`
      }, `Emergency disable: ${reason}`, userId);
      
      // Broadcast emergency event
      if (this.cache) {
        await this.cache.publish('flag:emergency', JSON.stringify({
          type: 'emergency_disable',
          flag_key: flagKey,
          reason,
          user_id: userId
        }));
      }
      
      // Critical audit log
      await this.auditService.log({
        action: 'emergency_disable_flag',
        entity_type: 'feature_flag',
        entity_id: flagKey,
        details: { reason },
        user_id: userId,
        severity: 'critical'
      });
      
      logger.error(`EMERGENCY: Feature ${flagKey} disabled`, { reason, userId });
      
      return { success: true, message: `Feature ${flagKey} has been emergency disabled` };
      
    } catch (error) {
      logger.error(`Failed to emergency disable ${flagKey}:`, error);
      throw error;
    }
  }

  // Helper methods

  async getFlag(flagKey) {
    const sql = `
      SELECT * FROM pf_feature_flags 
      WHERE flag_key = ? AND is_archived = 'N'
    `;
    return await this.db.queryOne(sql, [flagKey]);
  }

  async createFlag(flagData) {
    const flagId = uuidv4();
    const sql = `
      INSERT INTO pf_feature_flags (
        flag_id, flag_key, flag_name, description, flag_type,
        default_value, category, is_system_wide, requires_restart,
        enabled, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Y', CURRENT_TIMESTAMP)
    `;
    
    await this.db.execute(sql, [
      flagId,
      flagData.flag_key,
      flagData.flag_name,
      flagData.description,
      flagData.flag_type || 'boolean',
      flagData.default_value,
      flagData.category,
      flagData.is_system_wide || 'N',
      flagData.requires_restart || 'N'
    ]);
    
    return flagId;
  }

  async createFlagHistory(historyData) {
    const sql = `
      INSERT INTO pf_feature_flag_history (
        history_id, flag_id, change_type, changed_by,
        old_value, new_value, change_reason, change_timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `;
    
    await this.db.execute(sql, [
      uuidv4(),
      historyData.flag_id,
      historyData.change_type,
      historyData.changed_by,
      JSON.stringify(historyData.old_value),
      JSON.stringify(historyData.new_value),
      historyData.change_reason
    ]);
  }

  async checkOverrides(flagId, context) {
    // Check user-specific override
    if (context.userId) {
      const userOverride = await this.db.queryOne(
        'SELECT enabled FROM pf_user_feature_flags WHERE flag_id = ? AND user_id = ?',
        [flagId, context.userId]
      );
      if (userOverride) {
        return userOverride.enabled === 'Y';
      }
    }
    
    // Check group-specific override
    if (context.groupId) {
      const groupOverride = await this.db.queryOne(
        'SELECT enabled FROM pf_group_feature_flags WHERE flag_id = ? AND group_id = ?',
        [flagId, context.groupId]
      );
      if (groupOverride) {
        return groupOverride.enabled === 'Y';
      }
    }
    
    return null;
  }

  evaluateTargetingRules(rules, context) {
    for (const rule of rules) {
      if (this.evaluateRule(rule, context)) {
        return true;
      }
    }
    return null;
  }

  evaluateRule(rule, context) {
    const { field, operator, value } = rule;
    const contextValue = context[field];
    
    switch (operator) {
      case 'equals':
        return contextValue === value;
      case 'not_equals':
        return contextValue !== value;
      case 'contains':
        return contextValue && contextValue.includes(value);
      case 'in':
        return Array.isArray(value) && value.includes(contextValue);
      case 'greater_than':
        return Number(contextValue) > Number(value);
      case 'less_than':
        return Number(contextValue) < Number(value);
      default:
        return false;
    }
  }

  isInRollout(identifier, seed, percentage) {
    const hash = crypto.createHash('md5')
      .update(`${identifier}:${seed}`)
      .digest('hex');
    const hashValue = parseInt(hash.substring(0, 8), 16);
    const bucket = (hashValue % 100) + 1;
    return bucket <= percentage;
  }

  parseValue(value, type) {
    switch (type) {
      case 'boolean':
        return value === 'true' || value === true;
      case 'numeric':
        return Number(value);
      case 'string':
        return String(value);
      case 'json':
        try {
          return JSON.parse(value);
        } catch {
          return value;
        }
      default:
        return value;
    }
  }

  createEvaluation(flagKey, value, reason) {
    return {
      flagKey,
      value,
      reason,
      timestamp: new Date().toISOString()
    };
  }

  async clearFlagCache(flagKey) {
    if (this.cache) {
      await this.cache.del(`flag:${flagKey}`);
      
      // Clear pattern-based cache entries
      const pattern = `flag:eval:${flagKey}:*`;
      const keys = await this.cache.keys(pattern);
      if (keys && keys.length > 0) {
        await this.cache.del(...keys);
      }
    }
  }

  async getSuspiciousIPs() {
    // In production, this would query a threat intelligence database
    const sql = `
      SELECT DISTINCT ip_address 
      FROM pf_registration_protection
      WHERE event_type = 'blocked' 
      AND event_timestamp > DATE_SUB(NOW(), INTERVAL 7 DAY)
      GROUP BY ip_address
      HAVING COUNT(*) > 5
    `;
    const results = await this.db.query(sql);
    return new Set(results.map(r => r.ip_address));
  }

  async getRecentRegistrations(ipAddress, seconds) {
    const sql = `
      SELECT COUNT(*) as count
      FROM pf_registration_protection
      WHERE ip_address = ?
      AND event_type = 'success'
      AND event_timestamp > DATE_SUB(NOW(), INTERVAL ? SECOND)
    `;
    const result = await this.db.queryOne(sql, [ipAddress, seconds]);
    return result ? result.count : 0;
  }

  async getFingerprintCount(fingerprint, seconds) {
    const sql = `
      SELECT COUNT(*) as count
      FROM pf_registration_protection
      WHERE fingerprint = ?
      AND event_timestamp > DATE_SUB(NOW(), INTERVAL ? SECOND)
    `;
    const result = await this.db.queryOne(sql, [fingerprint, seconds]);
    return result ? result.count : 0;
  }

  async getCaptchaStats(since) {
    const sql = `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN captcha_solved = 'Y' THEN 1 ELSE 0 END) as solved
      FROM pf_registration_protection
      WHERE event_timestamp > ?
      AND captcha_required = 'Y'
    `;
    const result = await this.db.queryOne(sql, [since]);
    return {
      solveRate: result && result.total > 0 ? (result.solved / result.total) * 100 : 0
    };
  }

  getTimeCutoff(timeRange) {
    const now = new Date();
    switch (timeRange) {
      case '1h':
        return new Date(now - 3600000);
      case '24h':
        return new Date(now - 86400000);
      case '7d':
        return new Date(now - 604800000);
      case '30d':
        return new Date(now - 2592000000);
      default:
        return new Date(now - 86400000);
    }
  }

  async logEmergencyDisable(reason, userId) {
    logger.error('EMERGENCY: Self-registration disabled', { reason, userId });
    
    // Send alerts to admins
    if (this.cache) {
      await this.cache.publish('admin:alerts', JSON.stringify({
        type: 'emergency_registration_disable',
        severity: 'critical',
        message: 'Self-registration has been emergency disabled',
        reason,
        user_id: userId,
        timestamp: new Date().toISOString()
      }));
    }
  }

  startPeriodicSync() {
    // Sync flags every 60 seconds
    setInterval(async () => {
      try {
        await this.loadAllFlags();
      } catch (error) {
        logger.error('Periodic flag sync failed:', error);
      }
    }, 60000);
  }

  /**
   * Get performance metrics
   */
  getMetrics() {
    return {
      totalFlags: this.flags.size,
      systemFlags: this.systemFlags.size,
      evaluationMetrics: this.evaluationMetrics,
      cacheHitRate: this.evaluationMetrics.totalEvaluations > 0 
        ? (this.evaluationMetrics.cacheHits / this.evaluationMetrics.totalEvaluations) * 100 
        : 0,
      avgEvaluationTime: this.evaluationMetrics.avgEvaluationTime,
      registrationProtection: this.registrationProtection
    };
  }
}

/**
 * Feature Flag Middleware for Express
 */
function featureFlagMiddleware(flagService) {
  return async (req, res, next) => {
    try {
      // Build context from request
      const context = {
        userId: req.user?.id,
        groupId: req.user?.group_id,
        userRoles: req.user?.roles || [],
        sessionId: req.sessionID,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        environment: process.env.NODE_ENV || 'development',
        path: req.path,
        method: req.method
      };
      
      // Evaluate common system flags
      const systemFlags = [
        'maintenance_mode',
        'rate_limiting_enabled',
        'self_registration_enabled'
      ];
      
      req.flags = {};
      for (const flagKey of systemFlags) {
        const result = await flagService.evaluateFlag(flagKey, context);
        req.flags[flagKey] = result.value;
      }
      
      // Helper function to check flags
      req.hasFeature = async (flagKey) => {
        if (req.flags[flagKey] !== undefined) {
          return req.flags[flagKey];
        }
        const result = await flagService.evaluateFlag(flagKey, context);
        req.flags[flagKey] = result.value;
        return result.value;
      };
      
      // Check maintenance mode
      if (req.flags.maintenance_mode && !req.user?.roles?.includes('admin')) {
        return res.status(503).json({
          error: 'Service temporarily unavailable',
          message: 'The system is currently under maintenance. Please try again later.'
        });
      }
      
      next();
    } catch (error) {
      logger.error('Feature flag middleware error:', error);
      // Continue without flags on error
      req.flags = {};
      req.hasFeature = async () => false;
      next();
    }
  };
}

module.exports = { 
  EnhancedFeatureFlagService, 
  featureFlagMiddleware 
};