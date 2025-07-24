/**
 * Rate Limiting Service for Career Navigator MCP Server
 * Implements sliding window rate limiting with Redis backend
 * Supports per-user, per-IP, and global rate limiting
 */

const winston = require('winston');

// Configure logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
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

class RateLimiter {
  constructor(redisClient = null) {
    this.redis = redisClient;
    this.isRedisEnabled = !!redisClient;
    this.localCache = new Map(); // Fallback for non-Redis environments
    this.cleanupInterval = null;
    
    // Rate limiting configuration
    this.limits = {
      // Per-user limits (authenticated requests)
      user: {
        requests: parseInt(process.env.API_RATE_LIMIT_REQUESTS) || 1000,
        window: parseInt(process.env.API_RATE_LIMIT_WINDOW) || 3600000 // 1 hour
      },
      // Per-IP limits (unauthenticated requests)
      ip: {
        requests: 100,
        window: 3600000 // 1 hour
      },
      // Global rate limiting
      global: {
        requests: 10000,
        window: 3600000 // 1 hour
      },
      // Authentication endpoint limits (stricter)
      auth: {
        requests: 10,
        window: 900000 // 15 minutes
      }
    };
    
    this.startCleanupTimer();
    
    logger.info('Rate limiter initialized', {
      redisEnabled: this.isRedisEnabled,
      userLimit: `${this.limits.user.requests}/${this.limits.user.window}ms`,
      ipLimit: `${this.limits.ip.requests}/${this.limits.ip.window}ms`
    });
  }

  /**
   * Start cleanup timer for local cache
   */
  startCleanupTimer() {
    if (!this.isRedisEnabled) {
      this.cleanupInterval = setInterval(() => {
        this.cleanupExpiredEntries();
      }, 60000); // Clean up every minute
    }
  }

  /**
   * Stop cleanup timer
   */
  stopCleanupTimer() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Clean up expired entries from local cache
   */
  cleanupExpiredEntries() {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, data] of this.localCache.entries()) {
      if (now > data.window) {
        this.localCache.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      logger.debug(`Cleaned up ${cleaned} expired rate limit entries`);
    }
  }

  /**
   * Check if request is within rate limits
   */
  async checkLimit(identifier, limitType = 'user', endpoint = null) {
    try {
      const config = this.limits[limitType] || this.limits.user;
      const key = this.buildKey(identifier, limitType, endpoint);
      
      if (this.isRedisEnabled) {
        return await this.checkRedisLimit(key, config);
      } else {
        return await this.checkLocalLimit(key, config);
      }
    } catch (error) {
      logger.error('Rate limit check failed', {
        error: error.message,
        identifier,
        limitType
      });
      // Fail open - allow request if rate limiting fails
      return {
        allowed: true,
        remaining: config?.requests || 1000,
        resetTime: Date.now() + (config?.window || 3600000)
      };
    }
  }

  /**
   * Build cache key for rate limiting
   */
  buildKey(identifier, limitType, endpoint = null) {
    const parts = ['rate_limit', limitType, identifier];
    if (endpoint) {
      parts.push(endpoint);
    }
    return parts.join(':');
  }

  /**
   * Check rate limit using Redis
   */
  async checkRedisLimit(key, config) {
    const now = Date.now();
    const windowStart = now - config.window;
    
    // Use Redis sorted set for sliding window
    const pipe = this.redis.multi();
    
    // Remove expired entries
    pipe.zremrangebyscore(key, 0, windowStart);
    
    // Count current requests in window
    pipe.zcard(key);
    
    // Add current request
    pipe.zadd(key, now, `${now}-${Math.random()}`);
    
    // Set expiration
    pipe.expire(key, Math.ceil(config.window / 1000));
    
    const results = await pipe.exec();
    const currentCount = results[1][1];
    
    const allowed = currentCount < config.requests;
    const remaining = Math.max(0, config.requests - currentCount - 1);
    const resetTime = now + config.window;
    
    if (!allowed) {
      logger.warn('Rate limit exceeded', {
        key,
        currentCount,
        limit: config.requests,
        window: config.window
      });
    }
    
    return {
      allowed,
      remaining,
      resetTime,
      currentCount
    };
  }

  /**
   * Check rate limit using local cache
   */
  async checkLocalLimit(key, config) {
    const now = Date.now();
    const data = this.localCache.get(key) || {
      requests: [],
      window: now + config.window
    };
    
    // Remove expired requests
    data.requests = data.requests.filter(timestamp => 
      timestamp > now - config.window
    );
    
    const currentCount = data.requests.length;
    const allowed = currentCount < config.requests;
    
    if (allowed) {
      data.requests.push(now);
      this.localCache.set(key, data);
    }
    
    const remaining = Math.max(0, config.requests - currentCount - (allowed ? 1 : 0));
    const resetTime = now + config.window;
    
    if (!allowed) {
      logger.warn('Rate limit exceeded (local)', {
        key,
        currentCount,
        limit: config.requests,
        window: config.window
      });
    }
    
    return {
      allowed,
      remaining,
      resetTime,
      currentCount
    };
  }

  /**
   * Express middleware for rate limiting
   */
  middleware(limitType = 'ip', endpoint = null) {
    return async (req, res, next) => {
      try {
        // Determine identifier based on limit type
        let identifier;
        switch (limitType) {
          case 'user':
            identifier = req.user?.userId || req.ip;
            break;
          case 'ip':
            identifier = req.ip;
            break;
          case 'global':
            identifier = 'global';
            break;
          default:
            identifier = req.user?.userId || req.ip;
        }
        
        const result = await this.checkLimit(identifier, limitType, endpoint);
        
        // Set rate limit headers
        res.set({
          'X-RateLimit-Limit': this.limits[limitType]?.requests || 1000,
          'X-RateLimit-Remaining': result.remaining,
          'X-RateLimit-Reset': new Date(result.resetTime).toISOString()
        });
        
        if (!result.allowed) {
          logger.warn('Request blocked by rate limiter', {
            identifier,
            limitType,
            endpoint,
            ip: req.ip,
            userAgent: req.get('User-Agent')
          });
          
          return res.status(429).json({
            error: 'Too Many Requests',
            message: 'Rate limit exceeded. Please try again later.',
            retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000)
          });
        }
        
        next();
      } catch (error) {
        logger.error('Rate limiting middleware error', {
          error: error.message,
          path: req.path
        });
        // Fail open - continue request if rate limiting fails
        next();
      }
    };
  }

  /**
   * MCP-specific rate limiting for tool calls
   */
  async checkMCPLimit(userId, toolName) {
    const identifier = `${userId}:${toolName}`;
    return await this.checkLimit(identifier, 'user', 'mcp');
  }

  /**
   * Authentication-specific rate limiting
   */
  async checkAuthLimit(identifier) {
    return await this.checkLimit(identifier, 'auth', 'auth');
  }

  /**
   * Reset rate limit for identifier (admin function)
   */
  async resetLimit(identifier, limitType = 'user') {
    const key = this.buildKey(identifier, limitType);
    
    try {
      if (this.isRedisEnabled) {
        await this.redis.del(key);
      } else {
        this.localCache.delete(key);
      }
      
      logger.info('Rate limit reset', { identifier, limitType });
      return true;
    } catch (error) {
      logger.error('Failed to reset rate limit', {
        error: error.message,
        identifier,
        limitType
      });
      return false;
    }
  }

  /**
   * Get current rate limit status
   */
  async getStatus(identifier, limitType = 'user') {
    const key = this.buildKey(identifier, limitType);
    const config = this.limits[limitType];
    
    try {
      if (this.isRedisEnabled) {
        const count = await this.redis.zcard(key);
        return {
          identifier,
          limitType,
          currentCount: count,
          limit: config.requests,
          remaining: Math.max(0, config.requests - count),
          window: config.window
        };
      } else {
        const data = this.localCache.get(key);
        const currentCount = data ? data.requests.length : 0;
        return {
          identifier,
          limitType,
          currentCount,
          limit: config.requests,
          remaining: Math.max(0, config.requests - currentCount),
          window: config.window
        };
      }
    } catch (error) {
      logger.error('Failed to get rate limit status', {
        error: error.message,
        identifier,
        limitType
      });
      return null;
    }
  }

  /**
   * Get rate limiting statistics
   */
  async getStatistics() {
    try {
      const stats = {
        enabled: true,
        redisEnabled: this.isRedisEnabled,
        limits: this.limits,
        cacheSize: this.localCache.size
      };
      
      if (this.isRedisEnabled) {
        // Get Redis statistics
        const info = await this.redis.info('memory');
        stats.redisMemory = info;
      }
      
      return stats;
    } catch (error) {
      logger.error('Failed to get rate limiting statistics', {
        error: error.message
      });
      return { enabled: false, error: error.message };
    }
  }

  /**
   * Update rate limiting configuration
   */
  updateLimits(newLimits) {
    this.limits = { ...this.limits, ...newLimits };
    logger.info('Rate limiting configuration updated', { limits: this.limits });
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    this.stopCleanupTimer();
    this.localCache.clear();
    logger.info('Rate limiter cleanup completed');
  }
}

module.exports = RateLimiter;