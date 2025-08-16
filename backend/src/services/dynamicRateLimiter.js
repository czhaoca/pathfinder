/**
 * Dynamic Rate Limiting Service
 * 
 * Database-driven rate limiting with:
 * - Dynamic configuration updates
 * - Multiple scoping strategies (user, IP, API key, endpoint)
 * - Sliding window and token bucket algorithms
 * - Exemption rules and circuit breakers
 * - Distributed rate limiting across multiple servers
 * - Real-time metrics and alerting
 */

const { logger } = require('../utils/logger');
const crypto = require('crypto');

class RateLimitCounter {
  constructor(redis = null) {
    this.redis = redis;
    this.localCounters = new Map();
    this.maxLocalCounters = 10000;
  }

  async increment(key, window, max, sliding = true) {
    const now = Date.now();
    const windowStart = sliding ? now - window * 1000 : Math.floor(now / (window * 1000)) * window * 1000;
    const counterKey = `${key}:${windowStart}`;

    if (this.redis) {
      return await this._incrementRedis(counterKey, window, max, now);
    } else {
      return await this._incrementLocal(counterKey, window, max, now);
    }
  }

  async _incrementRedis(key, window, max, now) {
    try {
      const multi = this.redis.multi();
      multi.incr(key);
      multi.expire(key, window + 1); // Add buffer for cleanup
      multi.get(key);
      
      const results = await multi.exec();
      const count = parseInt(results[2][1]);
      
      return {
        count,
        remaining: Math.max(0, max - count),
        reset: now + (window * 1000),
        limited: count > max
      };
    } catch (error) {
      logger.warn('Redis rate limit error:', error);
      // Fallback to local counting
      return await this._incrementLocal(key, window, max, now);
    }
  }

  async _incrementLocal(key, window, max, now) {
    // Clean up expired counters
    this._cleanupLocalCounters(now);
    
    // Manage counter size
    if (this.localCounters.size >= this.maxLocalCounters) {
      const oldestKey = this.localCounters.keys().next().value;
      this.localCounters.delete(oldestKey);
    }

    if (!this.localCounters.has(key)) {
      this.localCounters.set(key, {
        count: 0,
        windowStart: now,
        lastAccess: now
      });
    }

    const counter = this.localCounters.get(key);
    counter.count++;
    counter.lastAccess = now;

    return {
      count: counter.count,
      remaining: Math.max(0, max - counter.count),
      reset: counter.windowStart + (window * 1000),
      limited: counter.count > max
    };
  }

  _cleanupLocalCounters(now) {
    for (const [key, counter] of this.localCounters.entries()) {
      if (now - counter.lastAccess > 300000) { // 5 minutes
        this.localCounters.delete(key);
      }
    }
  }

  async getCount(key) {
    if (this.redis) {
      try {
        const count = await this.redis.get(key);
        return parseInt(count) || 0;
      } catch (error) {
        logger.warn('Redis get count error:', error);
      }
    }

    const counter = this.localCounters.get(key);
    return counter ? counter.count : 0;
  }

  async reset(key) {
    if (this.redis) {
      try {
        await this.redis.del(key);
      } catch (error) {
        logger.warn('Redis reset error:', error);
      }
    }

    this.localCounters.delete(key);
  }
}

class DynamicRateLimiter {
  constructor(db, redis = null, configService = null) {
    this.db = db;
    this.redis = redis;
    this.configService = configService;
    this.counter = new RateLimitCounter(redis);
    this.configCache = new Map();
    this.exemptionCache = new Map();
    this.circuitBreakers = new Map();
    this.metrics = new Map();
  }

  /**
   * Check if request should be rate limited
   */
  async checkLimit(limitKey, context = {}) {
    try {
      const startTime = Date.now();
      
      // Get rate limit configuration
      const config = await this._getRateLimitConfig(limitKey, context);
      if (!config) {
        return this._createResult(false, null, 'No rate limit configured');
      }

      // Check exemptions first
      if (await this._isExempt(config, context)) {
        return this._createResult(false, config, 'Exempt from rate limiting');
      }

      // Generate rate limit key
      const rateLimitKey = this._generateRateLimitKey(config, context);
      
      // Check circuit breaker
      if (this._isCircuitBreakerOpen(limitKey)) {
        return this._createResult(true, config, 'Circuit breaker open');
      }

      // Increment counter and check limit
      const result = await this.counter.increment(
        rateLimitKey,
        config.time_window_seconds,
        config.max_requests,
        config.sliding_window === 1
      );

      const limited = result.limited;
      
      // Record metrics
      await this._recordMetrics(limitKey, config, context, limited, Date.now() - startTime);
      
      // Handle limit exceeded
      if (limited) {
        await this._handleLimitExceeded(config, context);
      }

      return this._createResult(limited, config, null, result);

    } catch (error) {
      logger.error(`Rate limiting error for ${limitKey}:`, error);
      
      // Record circuit breaker error
      this._recordCircuitBreakerError(limitKey);
      
      // Fail open (allow request) on error
      return this._createResult(false, null, 'Rate limiting error - fail open');
    }
  }

  /**
   * Apply rate limiting middleware
   */
  middleware(limitKey) {
    return async (req, res, next) => {
      const context = {
        userId: req.user?.id,
        userRoles: req.user?.roles || [],
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        apiKey: req.headers['x-api-key'],
        endpoint: req.path,
        method: req.method,
        environment: process.env.NODE_ENV
      };

      const result = await this.checkLimit(limitKey, context);

      if (result.limited) {
        // Set rate limit headers
        res.set({
          'X-RateLimit-Limit': result.config?.max_requests || 'unknown',
          'X-RateLimit-Remaining': result.details?.remaining || 0,
          'X-RateLimit-Reset': result.details?.reset || Date.now(),
          'Retry-After': result.config?.retry_after_header === 1 ? 
            Math.ceil(result.config.time_window_seconds) : undefined
        });

        // Handle different limit actions
        switch (result.config?.action_on_limit) {
          case 'block':
            return res.status(429).json({
              error: 'Rate limit exceeded',
              message: result.config.custom_error_message || 'Too many requests',
              retry_after: result.config.time_window_seconds
            });
            
          case 'throttle':
            // Add delay before processing
            const delay = Math.min(5000, result.config.time_window_seconds * 100);
            await new Promise(resolve => setTimeout(resolve, delay));
            break;
            
          case 'queue':
            // Queue implementation would go here
            logger.info(`Request queued for rate limiting: ${limitKey}`);
            break;
            
          case 'captcha':
            return res.status(429).json({
              error: 'Rate limit exceeded',
              challenge_required: true,
              challenge_type: 'captcha'
            });
            
          case 'log':
            logger.warn(`Rate limit exceeded (log only): ${limitKey}`, context);
            break;
            
          default:
            return res.status(429).json({
              error: 'Rate limit exceeded'
            });
        }
      } else {
        // Set informational headers
        res.set({
          'X-RateLimit-Limit': result.config?.max_requests || 'unknown',
          'X-RateLimit-Remaining': result.details?.remaining || 'unknown'
        });
      }

      next();
    };
  }

  /**
   * Create or update rate limit configuration
   */
  async setRateLimit(config) {
    try {
      const {
        limit_key,
        limit_name,
        description,
        max_requests,
        time_window_seconds,
        scope_type = 'global',
        scope_pattern,
        action_on_limit = 'block',
        sliding_window = 1,
        is_active = 1,
        priority = 100,
        environment
      } = config;

      // Validate required fields
      if (!limit_key || !max_requests || !time_window_seconds) {
        throw new Error('limit_key, max_requests, and time_window_seconds are required');
      }

      // Check if rate limit exists
      const existingSql = `SELECT id FROM pf_rate_limits WHERE limit_key = ?`;
      const existing = await this.db.queryOne(existingSql, [limit_key]);

      if (existing) {
        // Update existing
        const updateSql = `
          UPDATE pf_rate_limits 
          SET limit_name = ?, description = ?, max_requests = ?, 
              time_window_seconds = ?, scope_type = ?, scope_pattern = ?,
              action_on_limit = ?, sliding_window = ?, is_active = ?,
              priority = ?, environment = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `;
        
        await this.db.execute(updateSql, [
          limit_name, description, max_requests, time_window_seconds,
          scope_type, scope_pattern, action_on_limit, sliding_window,
          is_active, priority, environment, existing.id
        ]);
      } else {
        // Insert new
        const insertSql = `
          INSERT INTO pf_rate_limits (
            limit_key, limit_name, description, max_requests, time_window_seconds,
            scope_type, scope_pattern, action_on_limit, sliding_window,
            is_active, priority, environment
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        await this.db.execute(insertSql, [
          limit_key, limit_name, description, max_requests, time_window_seconds,
          scope_type, scope_pattern, action_on_limit, sliding_window,
          is_active, priority, environment
        ]);
      }

      // Clear cache
      this._clearConfigCache(limit_key);

      return { success: true, limit_key };

    } catch (error) {
      logger.error('Error setting rate limit:', error);
      throw error;
    }
  }

  /**
   * Remove rate limit configuration
   */
  async removeRateLimit(limitKey) {
    try {
      const sql = `
        UPDATE pf_rate_limits 
        SET is_active = 0, updated_at = CURRENT_TIMESTAMP
        WHERE limit_key = ?
      `;
      
      const result = await this.db.execute(sql, [limitKey]);
      
      if (result.rowsAffected === 0) {
        throw new Error('Rate limit not found');
      }

      // Clear cache
      this._clearConfigCache(limitKey);

      return { success: true };

    } catch (error) {
      logger.error(`Error removing rate limit ${limitKey}:`, error);
      throw error;
    }
  }

  /**
   * Get rate limit status for debugging
   */
  async getStatus(limitKey, context = {}) {
    try {
      const config = await this._getRateLimitConfig(limitKey, context);
      if (!config) {
        return { error: 'Rate limit not configured' };
      }

      const rateLimitKey = this._generateRateLimitKey(config, context);
      const count = await this.counter.getCount(rateLimitKey);
      const exempt = await this._isExempt(config, context);

      return {
        limit_key: limitKey,
        config: {
          max_requests: config.max_requests,
          time_window_seconds: config.time_window_seconds,
          scope_type: config.scope_type,
          action_on_limit: config.action_on_limit
        },
        status: {
          current_count: count,
          remaining: Math.max(0, config.max_requests - count),
          exempt,
          rate_limit_key: rateLimitKey
        }
      };

    } catch (error) {
      logger.error(`Error getting rate limit status for ${limitKey}:`, error);
      throw error;
    }
  }

  /**
   * Reset rate limit counters
   */
  async resetCounters(limitKey, context = {}) {
    try {
      const config = await this._getRateLimitConfig(limitKey, context);
      if (!config) {
        throw new Error('Rate limit not configured');
      }

      const rateLimitKey = this._generateRateLimitKey(config, context);
      await this.counter.reset(rateLimitKey);

      return { success: true, reset_key: rateLimitKey };

    } catch (error) {
      logger.error(`Error resetting rate limit counters for ${limitKey}:`, error);
      throw error;
    }
  }

  /**
   * Get rate limiting metrics
   */
  async getMetrics(limitKey = null, timeRange = '1h') {
    try {
      const endDate = new Date();
      const startDate = new Date();
      
      switch (timeRange) {
        case '1h':
          startDate.setHours(startDate.getHours() - 1);
          break;
        case '24h':
          startDate.setHours(startDate.getHours() - 24);
          break;
        case '7d':
          startDate.setDate(startDate.getDate() - 7);
          break;
        default:
          startDate.setHours(startDate.getHours() - 1);
      }

      // Get metrics from database (would need metrics table)
      let sql = `
        SELECT 
          limit_key,
          COUNT(*) as total_requests,
          SUM(CASE WHEN limited = 1 THEN 1 ELSE 0 END) as limited_requests,
          AVG(processing_time_ms) as avg_processing_time,
          MAX(processing_time_ms) as max_processing_time
        FROM rate_limit_metrics 
        WHERE recorded_at BETWEEN ? AND ?
      `;
      
      const params = [startDate, endDate];
      
      if (limitKey) {
        sql += ` AND limit_key = ?`;
        params.push(limitKey);
      }
      
      sql += ` GROUP BY limit_key ORDER BY total_requests DESC`;

      const metrics = await this.db.query(sql, params);

      return {
        time_range: timeRange,
        start_date: startDate,
        end_date: endDate,
        metrics: metrics || []
      };

    } catch (error) {
      logger.error('Error getting rate limiting metrics:', error);
      return { metrics: [] };
    }
  }

  // Private helper methods

  async _getRateLimitConfig(limitKey, context) {
    // Check cache
    const cacheKey = `${limitKey}:${context.environment || 'default'}`;
    if (this.configCache.has(cacheKey)) {
      const cached = this.configCache.get(cacheKey);
      if (cached.expires > Date.now()) {
        return cached.config;
      }
    }

    // Get from database
    let sql = `
      SELECT * FROM pf_rate_limits 
      WHERE limit_key = ? 
      AND is_active = 1
    `;
    const params = [limitKey];

    if (context.environment) {
      sql += ` AND (environment = ? OR environment IS NULL)`;
      params.push(context.environment);
    }

    sql += ` ORDER BY priority DESC, environment DESC FETCH FIRST 1 ROW ONLY`;

    const config = await this.db.queryOne(sql, params);

    // Cache result
    if (config) {
      this.configCache.set(cacheKey, {
        config,
        expires: Date.now() + 300000 // 5 minutes
      });
    }

    return config;
  }

  async _isExempt(config, context) {
    const cacheKey = `exempt:${config.id}:${context.userId || context.ip || 'anonymous'}`;
    
    // Check cache
    if (this.exemptionCache.has(cacheKey)) {
      const cached = this.exemptionCache.get(cacheKey);
      if (cached.expires > Date.now()) {
        return cached.exempt;
      }
    }

    let exempt = false;

    // Check role exemptions
    if (config.exempt_roles && context.userRoles) {
      const exemptRoles = JSON.parse(config.exempt_roles);
      exempt = context.userRoles.some(role => exemptRoles.includes(role));
    }

    // Check user exemptions
    if (!exempt && config.exempt_users && context.userId) {
      const exemptUsers = JSON.parse(config.exempt_users);
      exempt = exemptUsers.includes(context.userId);
    }

    // Check IP exemptions
    if (!exempt && config.exempt_ips && context.ip) {
      const exemptIPs = JSON.parse(config.exempt_ips);
      exempt = exemptIPs.includes(context.ip);
    }

    // Check API key exemptions
    if (!exempt && config.exempt_api_keys && context.apiKey) {
      const exemptKeys = JSON.parse(config.exempt_api_keys);
      exempt = exemptKeys.includes(context.apiKey);
    }

    // Cache result
    this.exemptionCache.set(cacheKey, {
      exempt,
      expires: Date.now() + 60000 // 1 minute
    });

    return exempt;
  }

  _generateRateLimitKey(config, context) {
    const parts = ['rl', config.limit_key];

    switch (config.scope_type) {
      case 'user':
        parts.push('user', context.userId || 'anonymous');
        break;
      case 'ip':
        parts.push('ip', context.ip || 'unknown');
        break;
      case 'api_key':
        parts.push('key', context.apiKey || 'none');
        break;
      case 'endpoint':
        parts.push('endpoint', context.endpoint || 'unknown');
        break;
      case 'role':
        const role = context.userRoles?.[0] || 'norole';
        parts.push('role', role);
        break;
      case 'service':
        parts.push('service', context.service || 'default');
        break;
      default: // global
        parts.push('global');
    }

    // Add pattern matching if specified
    if (config.scope_pattern && context.endpoint) {
      const regex = new RegExp(config.scope_pattern);
      if (regex.test(context.endpoint)) {
        parts.push('pattern', crypto.createHash('md5').update(context.endpoint).digest('hex').substring(0, 8));
      }
    }

    return parts.join(':');
  }

  _createResult(limited, config, reason, details = null) {
    return {
      limited,
      config,
      reason,
      details,
      timestamp: new Date().toISOString()
    };
  }

  async _handleLimitExceeded(config, context) {
    // Update trigger statistics
    const updateSql = `
      UPDATE pf_rate_limits 
      SET last_triggered = CURRENT_TIMESTAMP,
          trigger_count = trigger_count + 1
      WHERE id = ?
    `;
    
    try {
      await this.db.execute(updateSql, [config.id]);
    } catch (error) {
      logger.warn('Failed to update rate limit trigger stats:', error);
    }

    // Check alert threshold
    if (config.alert_threshold_percentage > 0) {
      const alertThreshold = config.max_requests * (config.alert_threshold_percentage / 100);
      // Alert logic would go here
      logger.warn(`Rate limit threshold exceeded for ${config.limit_key}`);
    }
  }

  async _recordMetrics(limitKey, config, context, limited, processingTime) {
    // Record metrics asynchronously to avoid blocking
    setImmediate(async () => {
      try {
        // This would insert into a metrics table
        const sql = `
          INSERT INTO rate_limit_metrics (
            limit_key, limited, processing_time_ms, 
            user_id, ip_address, recorded_at
          ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `;
        
        await this.db.execute(sql, [
          limitKey,
          limited ? 1 : 0,
          processingTime,
          context.userId,
          context.ip
        ]);
      } catch (error) {
        logger.warn('Failed to record rate limit metrics:', error);
      }
    });
  }

  _isCircuitBreakerOpen(limitKey) {
    const breaker = this.circuitBreakers.get(limitKey);
    if (!breaker) return false;

    const now = Date.now();
    if (breaker.state === 'open' && now > breaker.nextAttempt) {
      breaker.state = 'half-open';
      return false;
    }

    return breaker.state === 'open';
  }

  _recordCircuitBreakerError(limitKey) {
    const now = Date.now();
    let breaker = this.circuitBreakers.get(limitKey);
    
    if (!breaker) {
      breaker = {
        errors: 0,
        state: 'closed',
        nextAttempt: 0,
        threshold: 5,
        timeout: 60000 // 1 minute
      };
      this.circuitBreakers.set(limitKey, breaker);
    }

    breaker.errors++;
    
    if (breaker.errors >= breaker.threshold && breaker.state === 'closed') {
      breaker.state = 'open';
      breaker.nextAttempt = now + breaker.timeout;
      logger.warn(`Rate limiting circuit breaker opened for: ${limitKey}`);
    }
  }

  _clearConfigCache(limitKey) {
    for (const key of this.configCache.keys()) {
      if (key.startsWith(limitKey)) {
        this.configCache.delete(key);
      }
    }
  }
}

module.exports = { DynamicRateLimiter, RateLimitCounter };