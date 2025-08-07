/**
 * Advanced Rate Limiting Middleware
 * Implements sophisticated rate limiting with multiple strategies
 */

const Redis = require('ioredis');
const logger = require('../../utils/logger');

class RateLimiter {
  constructor() {
    this.redis = null;
    this.strategies = new Map();
    this.connected = false;
    
    // Default configurations
    this.defaultLimits = {
      global: { points: 1000, duration: 60 }, // 1000 requests per minute
      api: { points: 100, duration: 60 },     // 100 API calls per minute
      ai: { points: 10, duration: 60 },       // 10 AI requests per minute
      auth: { points: 5, duration: 60 },      // 5 auth attempts per minute
      heavy: { points: 5, duration: 300 }     // 5 heavy operations per 5 minutes
    };

    this.initializeRedis();
    this.setupStrategies();
  }

  /**
   * Initialize Redis connection for rate limiting
   */
  async initializeRedis() {
    try {
      this.redis = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD,
        db: process.env.REDIS_RATE_LIMIT_DB || 1,
        keyPrefix: 'ratelimit:',
        enableOfflineQueue: false
      });

      this.redis.on('connect', () => {
        this.connected = true;
        logger.info('Rate limiter connected to Redis');
      });

      this.redis.on('error', (error) => {
        logger.error('Rate limiter Redis error:', error);
        this.connected = false;
      });

      await this.redis.ping();
      this.connected = true;
    } catch (error) {
      logger.error('Failed to initialize rate limiter:', error);
      this.connected = false;
    }
  }

  /**
   * Setup rate limiting strategies
   */
  setupStrategies() {
    // Global rate limit (all requests)
    this.strategies.set('global', {
      keyGenerator: (req) => `global:${req.ip}`,
      limits: this.defaultLimits.global,
      message: 'Too many requests, please slow down'
    });

    // API endpoint rate limit
    this.strategies.set('api', {
      keyGenerator: (req) => `api:${req.user?.id || req.ip}:${req.path}`,
      limits: this.defaultLimits.api,
      message: 'API rate limit exceeded'
    });

    // AI operations rate limit (stricter)
    this.strategies.set('ai', {
      keyGenerator: (req) => `ai:${req.user?.id || req.ip}`,
      limits: this.defaultLimits.ai,
      message: 'AI request limit exceeded. Please wait before making another request',
      blockDuration: 300 // Block for 5 minutes after limit exceeded
    });

    // Authentication rate limit
    this.strategies.set('auth', {
      keyGenerator: (req) => `auth:${req.ip}:${req.body?.username || 'unknown'}`,
      limits: this.defaultLimits.auth,
      message: 'Too many authentication attempts',
      blockDuration: 900 // Block for 15 minutes
    });

    // Heavy operations (reports, exports, batch operations)
    this.strategies.set('heavy', {
      keyGenerator: (req) => `heavy:${req.user?.id || req.ip}`,
      limits: this.defaultLimits.heavy,
      message: 'Heavy operation limit exceeded. Please wait before retrying'
    });

    // User-specific limits
    this.strategies.set('user', {
      keyGenerator: (req) => `user:${req.user?.id}:${req.path}`,
      limits: { points: 60, duration: 60 },
      message: 'User rate limit exceeded'
    });

    // IP-based strict limit for non-authenticated requests
    this.strategies.set('ip-strict', {
      keyGenerator: (req) => `ip:${req.ip}`,
      limits: { points: 30, duration: 60 },
      message: 'IP rate limit exceeded',
      skipAuth: true // Apply even to authenticated users
    });
  }

  /**
   * Main rate limiting middleware
   */
  limit(strategyName = 'api', customOptions = {}) {
    return async (req, res, next) => {
      // Skip rate limiting if Redis is not connected
      if (!this.connected) {
        logger.warn('Rate limiting skipped - Redis not connected');
        return next();
      }

      const strategy = this.strategies.get(strategyName);
      if (!strategy) {
        logger.error(`Unknown rate limit strategy: ${strategyName}`);
        return next();
      }

      try {
        const key = strategy.keyGenerator(req);
        const limits = { ...strategy.limits, ...customOptions };
        
        // Check if user is blocked
        const blockKey = `block:${key}`;
        const isBlocked = await this.redis.get(blockKey);
        
        if (isBlocked) {
          return this.sendRateLimitResponse(res, {
            limit: limits.points,
            remaining: 0,
            reset: new Date(parseInt(isBlocked)),
            message: 'You have been temporarily blocked due to rate limit violations'
          });
        }

        // Consume points
        const result = await this.consume(key, limits);
        
        // Set rate limit headers
        res.set({
          'X-RateLimit-Limit': limits.points,
          'X-RateLimit-Remaining': Math.max(0, result.remaining),
          'X-RateLimit-Reset': new Date(result.reset).toISOString()
        });

        if (result.allowed) {
          return next();
        }

        // Block user if specified
        if (strategy.blockDuration) {
          const blockUntil = Date.now() + (strategy.blockDuration * 1000);
          await this.redis.setex(blockKey, strategy.blockDuration, blockUntil);
        }

        // Send rate limit response
        return this.sendRateLimitResponse(res, {
          ...result,
          message: strategy.message
        });

      } catch (error) {
        logger.error('Rate limiting error:', error);
        // Fail open - allow request if rate limiting fails
        return next();
      }
    };
  }

  /**
   * Consume rate limit points
   */
  async consume(key, limits) {
    const now = Date.now();
    const window = limits.duration * 1000;
    const clearBefore = now - window;

    // Use Redis pipeline for atomic operations
    const pipeline = this.redis.pipeline();
    
    // Remove old entries
    pipeline.zremrangebyscore(key, '-inf', clearBefore);
    
    // Count current entries in window
    pipeline.zcard(key);
    
    // Add current request
    pipeline.zadd(key, now, `${now}-${Math.random()}`);
    
    // Set expiry
    pipeline.expire(key, limits.duration);
    
    // Execute pipeline
    const results = await pipeline.exec();
    
    const count = results[1][1];
    const allowed = count < limits.points;
    
    // Calculate reset time
    const oldestEntry = await this.redis.zrange(key, 0, 0, 'WITHSCORES');
    const reset = oldestEntry.length > 0 
      ? parseInt(oldestEntry[1]) + window
      : now + window;

    return {
      allowed,
      remaining: Math.max(0, limits.points - count - 1),
      reset,
      total: limits.points
    };
  }

  /**
   * AI-specific rate limiter with token bucket algorithm
   */
  aiRateLimit(options = {}) {
    const config = {
      tokensPerInterval: options.tokens || 10,
      interval: options.interval || 60000, // 1 minute
      maxBurst: options.maxBurst || 5,
      costPerRequest: options.cost || 1
    };

    return async (req, res, next) => {
      if (!this.connected) {
        return next();
      }

      const userId = req.user?.id || req.ip;
      const bucketKey = `ai-bucket:${userId}`;
      
      try {
        const allowed = await this.consumeTokenBucket(
          bucketKey,
          config
        );

        if (allowed) {
          return next();
        }

        return this.sendRateLimitResponse(res, {
          message: 'AI service rate limit exceeded. Tokens will replenish over time.',
          retryAfter: Math.ceil(config.interval / config.tokensPerInterval)
        });

      } catch (error) {
        logger.error('AI rate limiting error:', error);
        return next();
      }
    };
  }

  /**
   * Token bucket algorithm implementation
   */
  async consumeTokenBucket(key, config) {
    const now = Date.now();
    
    // Get current bucket state
    const bucketData = await this.redis.get(key);
    let bucket = bucketData ? JSON.parse(bucketData) : {
      tokens: config.maxBurst,
      lastRefill: now
    };

    // Calculate tokens to add
    const timePassed = now - bucket.lastRefill;
    const tokensToAdd = Math.floor(timePassed / config.interval * config.tokensPerInterval);
    
    // Refill bucket
    bucket.tokens = Math.min(
      config.maxBurst,
      bucket.tokens + tokensToAdd
    );
    bucket.lastRefill = now;

    // Check if request can be served
    if (bucket.tokens >= config.costPerRequest) {
      bucket.tokens -= config.costPerRequest;
      await this.redis.setex(
        key,
        Math.ceil(config.interval / 1000),
        JSON.stringify(bucket)
      );
      return true;
    }

    return false;
  }

  /**
   * Sliding window rate limiter for distributed systems
   */
  slidingWindow(options = {}) {
    return async (req, res, next) => {
      if (!this.connected) {
        return next();
      }

      const key = options.keyGenerator 
        ? options.keyGenerator(req)
        : `sliding:${req.user?.id || req.ip}`;
      
      const limit = options.limit || 100;
      const window = options.window || 60000; // 1 minute
      
      try {
        const allowed = await this.checkSlidingWindow(key, limit, window);
        
        if (allowed) {
          return next();
        }

        return this.sendRateLimitResponse(res, {
          message: 'Rate limit exceeded (sliding window)',
          limit,
          window: `${window / 1000}s`
        });

      } catch (error) {
        logger.error('Sliding window rate limit error:', error);
        return next();
      }
    };
  }

  /**
   * Check sliding window rate limit
   */
  async checkSlidingWindow(key, limit, window) {
    const now = Date.now();
    const windowStart = now - window;
    
    const pipeline = this.redis.pipeline();
    
    // Remove old entries
    pipeline.zremrangebyscore(key, '-inf', windowStart);
    
    // Count entries in window
    pipeline.zcard(key);
    
    // Add current request if under limit
    const results = await pipeline.exec();
    const count = results[1][1];
    
    if (count < limit) {
      await this.redis.zadd(key, now, `${now}-${Math.random()}`);
      await this.redis.expire(key, Math.ceil(window / 1000));
      return true;
    }
    
    return false;
  }

  /**
   * Dynamic rate limiting based on system load
   */
  adaptive(baseLimit = 100) {
    return async (req, res, next) => {
      const load = await this.getSystemLoad();
      const adjustedLimit = Math.floor(baseLimit * (1 - load));
      
      const options = {
        limit: Math.max(10, adjustedLimit), // Minimum 10 requests
        window: 60000
      };
      
      return this.slidingWindow(options)(req, res, next);
    };
  }

  /**
   * Get system load for adaptive rate limiting
   */
  async getSystemLoad() {
    const cpuUsage = process.cpuUsage();
    const memUsage = process.memoryUsage();
    
    // Simple load calculation (0-1)
    const cpuLoad = Math.min(1, cpuUsage.user / 1000000000);
    const memLoad = memUsage.heapUsed / memUsage.heapTotal;
    
    return (cpuLoad + memLoad) / 2;
  }

  /**
   * Whitelist certain IPs or users from rate limiting
   */
  whitelist(checker) {
    return async (req, res, next) => {
      const isWhitelisted = await checker(req);
      
      if (isWhitelisted) {
        return next();
      }
      
      // Apply normal rate limiting
      return this.limit()(req, res, next);
    };
  }

  /**
   * Send rate limit exceeded response
   */
  sendRateLimitResponse(res, info) {
    const response = {
      error: 'Rate limit exceeded',
      message: info.message || 'Too many requests',
      limit: info.limit,
      remaining: info.remaining || 0,
      reset: info.reset,
      retryAfter: info.retryAfter
    };

    res.status(429).json(response);
  }

  /**
   * Reset rate limit for a specific key
   */
  async reset(key) {
    if (!this.connected) {
      throw new Error('Redis not connected');
    }
    
    await this.redis.del(key);
    await this.redis.del(`block:${key}`);
    
    logger.info(`Rate limit reset for key: ${key}`);
  }

  /**
   * Get current rate limit status for a key
   */
  async getStatus(key, limits) {
    if (!this.connected) {
      return null;
    }

    const now = Date.now();
    const window = limits.duration * 1000;
    const clearBefore = now - window;

    await this.redis.zremrangebyscore(key, '-inf', clearBefore);
    const count = await this.redis.zcard(key);

    return {
      used: count,
      limit: limits.points,
      remaining: Math.max(0, limits.points - count),
      reset: now + window
    };
  }

  /**
   * Clean up expired rate limit keys
   */
  async cleanup() {
    if (!this.connected) {
      return;
    }

    try {
      const keys = await this.redis.keys('ratelimit:*');
      let cleaned = 0;

      for (const key of keys) {
        const ttl = await this.redis.ttl(key);
        if (ttl === -1) {
          // Key has no expiry, set one
          await this.redis.expire(key, 3600);
          cleaned++;
        }
      }

      logger.info(`Rate limiter cleanup: ${cleaned} keys updated`);
    } catch (error) {
      logger.error('Rate limiter cleanup error:', error);
    }
  }
}

// Create singleton instance
const rateLimiter = new RateLimiter();

// Export middleware functions
module.exports = {
  rateLimiter,
  
  // Convenience middleware exports
  global: () => rateLimiter.limit('global'),
  api: (options) => rateLimiter.limit('api', options),
  ai: (options) => rateLimiter.aiRateLimit(options),
  auth: () => rateLimiter.limit('auth'),
  heavy: () => rateLimiter.limit('heavy'),
  
  // Advanced strategies
  slidingWindow: (options) => rateLimiter.slidingWindow(options),
  adaptive: (baseLimit) => rateLimiter.adaptive(baseLimit),
  tokenBucket: (options) => rateLimiter.aiRateLimit(options),
  
  // Utilities
  reset: (key) => rateLimiter.reset(key),
  getStatus: (key, limits) => rateLimiter.getStatus(key, limits),
  cleanup: () => rateLimiter.cleanup()
};