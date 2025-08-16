const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const Redis = require('ioredis');
const { AuditService } = require('../services/auditService');

// Initialize Redis client
const redisClient = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD,
  db: process.env.REDIS_DB || 0,
  keyPrefix: 'rate_limit:',
  enableOfflineQueue: false,
  maxRetriesPerRequest: 3
});

// Initialize audit service
const auditService = new AuditService(require('../config/database'));

// Handle Redis connection errors
redisClient.on('error', (err) => {
  console.error('Redis connection error:', err);
});

// Define rate limit configurations for different endpoints
const rateLimitConfigs = {
  // Authentication endpoints
  login: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 requests
    skipSuccessfulRequests: true,
    message: 'Too many login attempts. Please try again later.',
    standardHeaders: true,
    legacyHeaders: false
  },
  register: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 registrations
    message: 'Too many registration attempts. Please try again later.'
  },
  password_retrieve: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // 3 attempts
    message: 'Too many password retrieval attempts. Please try again later.'
  },
  password_reset: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // 3 attempts
    message: 'Too many password reset attempts. Please try again later.'
  },
  password_reset_confirm: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // 5 attempts
    message: 'Too many password reset confirmation attempts. Please try again later.'
  },
  password_change: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // 5 attempts
    message: 'Too many password change attempts. Please try again later.'
  },
  token_refresh: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 30, // 30 refreshes
    message: 'Too many token refresh attempts. Please login again.'
  },
  mfa_verify: {
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 5, // 5 attempts
    message: 'Too many MFA verification attempts. Please try again later.'
  },
  
  // User management endpoints
  user_list: {
    windowMs: 60 * 1000, // 1 minute
    max: 100, // 100 requests
    message: 'Too many requests. Please slow down.'
  },
  user_create: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // 20 user creations
    message: 'Too many user creation requests. Please try again later.'
  },
  user_update: {
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 30, // 30 updates
    message: 'Too many update requests. Please try again later.'
  },
  user_delete: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // 5 deletions
    message: 'Too many deletion requests. Please try again later.'
  },
  batch_operation: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // 5 batch operations
    message: 'Too many batch operations. Please try again later.'
  },
  
  // Admin endpoints
  admin_action: {
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 50, // 50 admin actions
    message: 'Too many admin actions. Please slow down.'
  },
  audit_query: {
    windowMs: 60 * 1000, // 1 minute
    max: 30, // 30 queries
    message: 'Too many audit queries. Please slow down.'
  },
  
  // Default rate limit
  default: {
    windowMs: 60 * 1000, // 1 minute
    max: 60, // 60 requests per minute
    message: 'Too many requests. Please slow down.'
  }
};

/**
 * Create rate limiter for specific endpoint
 * @param {string} endpoint - Endpoint identifier
 * @param {Object} customConfig - Custom configuration to override defaults
 * @returns {Function} Express rate limit middleware
 */
function rateLimiter(endpoint, customConfig = {}) {
  const config = { ...rateLimitConfigs[endpoint] || rateLimitConfigs.default, ...customConfig };
  
  // Create Redis store for distributed rate limiting
  const store = new RedisStore({
    client: redisClient,
    prefix: `rl:${endpoint}:`,
    sendCommand: (...args) => redisClient.call(...args)
  });
  
  return rateLimit({
    store,
    windowMs: config.windowMs,
    max: config.max,
    message: config.message,
    standardHeaders: config.standardHeaders !== false,
    legacyHeaders: config.legacyHeaders || false,
    skipSuccessfulRequests: config.skipSuccessfulRequests || false,
    
    // Key generator - use user ID if authenticated, otherwise IP
    keyGenerator: (req) => {
      if (req.user && req.user.id) {
        return `user:${req.user.id}`;
      }
      return req.ip;
    },
    
    // Custom handler for rate limit exceeded
    handler: async (req, res) => {
      // Log rate limit violation
      await auditService.log({
        event_type: 'security',
        event_category: 'rate_limit',
        event_severity: 'warning',
        event_name: 'Rate Limit Exceeded',
        event_description: `Rate limit exceeded for endpoint: ${endpoint}`,
        action: 'rate_limit',
        action_result: 'failure',
        actor_id: req.user?.id,
        actor_username: req.user?.username,
        target_path: req.path,
        http_method: req.method,
        ip_address: req.ip,
        user_agent: req.get('user-agent'),
        custom_data: JSON.stringify({
          endpoint,
          limit: config.max,
          window: config.windowMs
        }),
        risk_score: 60
      });
      
      res.status(429).json({
        success: false,
        error: 'RATE_LIMIT_EXCEEDED',
        message: config.message,
        retry_after: res.getHeader('Retry-After')
      });
    },
    
    // Skip rate limiting for certain conditions
    skip: (req) => {
      // Skip for health checks
      if (req.path === '/health' || req.path === '/api/health') {
        return true;
      }
      
      // Skip for site admins if configured
      if (config.skipAdmins && req.user?.roles?.includes('site_admin')) {
        return true;
      }
      
      return false;
    }
  });
}

/**
 * Global rate limiter for all endpoints
 */
const globalRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute per IP
  message: 'Too many requests from this IP. Please slow down.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip,
  skip: (req) => {
    // Skip health checks
    return req.path === '/health' || req.path === '/api/health';
  }
});

/**
 * Strict rate limiter for sensitive operations
 */
const strictRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 requests per hour
  message: 'Too many sensitive operations. Please contact support if you need to perform more.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.user?.id ? `user:${req.user.id}` : req.ip;
  }
});

/**
 * Dynamic rate limiter based on user role
 * @param {Object} limits - Role-based limits { user: 10, admin: 50, site_admin: 100 }
 * @param {number} windowMs - Time window in milliseconds
 */
function roleBasedRateLimiter(limits = {}, windowMs = 60000) {
  return (req, res, next) => {
    const userRole = req.user?.roles?.[0] || 'anonymous';
    const maxRequests = limits[userRole] || limits.default || 60;
    
    const limiter = rateLimit({
      windowMs,
      max: maxRequests,
      message: `Rate limit exceeded for ${userRole} role`,
      keyGenerator: (req) => {
        return req.user?.id ? `${userRole}:${req.user.id}` : `anonymous:${req.ip}`;
      }
    });
    
    limiter(req, res, next);
  };
}

/**
 * Sliding window rate limiter for more accurate limiting
 */
class SlidingWindowRateLimiter {
  constructor(options = {}) {
    this.windowMs = options.windowMs || 60000;
    this.max = options.max || 60;
    this.prefix = options.prefix || 'sliding:';
  }
  
  async isAllowed(key) {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    const redisKey = `${this.prefix}${key}`;
    
    try {
      // Remove old entries
      await redisClient.zremrangebyscore(redisKey, '-inf', windowStart);
      
      // Count current entries
      const count = await redisClient.zcard(redisKey);
      
      if (count < this.max) {
        // Add new entry
        await redisClient.zadd(redisKey, now, `${now}:${Math.random()}`);
        await redisClient.expire(redisKey, Math.ceil(this.windowMs / 1000));
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Sliding window rate limit error:', error);
      // Allow on error to prevent blocking legitimate requests
      return true;
    }
  }
  
  middleware() {
    return async (req, res, next) => {
      const key = req.user?.id || req.ip;
      const allowed = await this.isAllowed(key);
      
      if (!allowed) {
        await auditService.log({
          event_type: 'security',
          event_category: 'rate_limit',
          event_severity: 'warning',
          event_name: 'Sliding Window Rate Limit Exceeded',
          actor_id: req.user?.id,
          ip_address: req.ip,
          risk_score: 50
        });
        
        return res.status(429).json({
          success: false,
          error: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests. Please slow down.'
        });
      }
      
      next();
    };
  }
}

/**
 * Reset rate limit for a specific key
 * @param {string} endpoint - Endpoint identifier
 * @param {string} key - User ID or IP address
 */
async function resetRateLimit(endpoint, key) {
  try {
    const redisKey = `rl:${endpoint}:${key}`;
    await redisClient.del(redisKey);
    
    await auditService.log({
      event_type: 'system',
      event_category: 'rate_limit',
      event_severity: 'info',
      event_name: 'Rate Limit Reset',
      event_description: `Rate limit reset for ${key} on ${endpoint}`,
      action: 'reset_rate_limit',
      action_result: 'success',
      custom_data: JSON.stringify({ endpoint, key })
    });
    
    return true;
  } catch (error) {
    console.error('Failed to reset rate limit:', error);
    return false;
  }
}

/**
 * Get current rate limit status for a key
 * @param {string} endpoint - Endpoint identifier
 * @param {string} key - User ID or IP address
 */
async function getRateLimitStatus(endpoint, key) {
  try {
    const redisKey = `rl:${endpoint}:${key}`;
    const count = await redisClient.get(redisKey);
    const ttl = await redisClient.ttl(redisKey);
    const config = rateLimitConfigs[endpoint] || rateLimitConfigs.default;
    
    return {
      current: parseInt(count) || 0,
      limit: config.max,
      remaining: Math.max(0, config.max - (parseInt(count) || 0)),
      reset_in: ttl > 0 ? ttl : 0,
      window_ms: config.windowMs
    };
  } catch (error) {
    console.error('Failed to get rate limit status:', error);
    return null;
  }
}

module.exports = {
  rateLimiter,
  globalRateLimiter,
  strictRateLimiter,
  roleBasedRateLimiter,
  SlidingWindowRateLimiter,
  resetRateLimit,
  getRateLimitStatus,
  rateLimitConfigs
};