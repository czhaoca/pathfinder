/**
 * Advanced Configuration Cache
 * 
 * Multi-layer caching strategy with:
 * - L1: In-memory LRU cache with TTL
 * - L2: Redis distributed cache
 * - L3: Database with connection pooling
 * - Cache warming and prefetching
 * - Cache invalidation strategies
 * - Performance monitoring and metrics
 */

const { logger } = require('../utils/logger');

/**
 * LRU Cache with TTL support
 */
class LRUCache {
  constructor(maxSize = 1000, defaultTTL = 300) {
    this.maxSize = maxSize;
    this.defaultTTL = defaultTTL; // seconds
    this.cache = new Map();
    this.timers = new Map();
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, item);
    
    return item.value;
  }

  set(key, value, ttl = null) {
    // Clear existing timer if exists
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
    }

    // Remove oldest if at capacity
    if (!this.cache.has(key) && this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.delete(firstKey);
    }

    // Set new value
    const item = {
      value,
      timestamp: Date.now()
    };
    
    this.cache.set(key, item);

    // Set TTL timer
    const timeout = (ttl || this.defaultTTL) * 1000;
    const timer = setTimeout(() => {
      this.delete(key);
    }, timeout);
    
    this.timers.set(key, timer);
  }

  delete(key) {
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
      this.timers.delete(key);
    }
    return this.cache.delete(key);
  }

  has(key) {
    return this.cache.has(key);
  }

  clear() {
    // Clear all timers
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
    this.cache.clear();
  }

  size() {
    return this.cache.size;
  }

  keys() {
    return Array.from(this.cache.keys());
  }

  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      utilization: (this.cache.size / this.maxSize * 100).toFixed(1) + '%'
    };
  }
}

/**
 * Advanced Configuration Cache Manager
 */
class ConfigurationCacheManager {
  constructor(redis = null, options = {}) {
    this.redis = redis;
    this.options = {
      l1MaxSize: 1000,
      l1DefaultTTL: 300, // 5 minutes
      l2DefaultTTL: 3600, // 1 hour
      prefetchThreshold: 0.8, // Prefetch when 80% of TTL is reached
      metricsEnabled: true,
      warmupKeys: [],
      ...options
    };

    // L1 Cache - In-memory LRU
    this.l1Cache = new LRUCache(this.options.l1MaxSize, this.options.l1DefaultTTL);
    
    // Cache metrics
    this.metrics = {
      l1Hits: 0,
      l1Misses: 0,
      l2Hits: 0,
      l2Misses: 0,
      dbHits: 0,
      prefetches: 0,
      invalidations: 0,
      errors: 0
    };

    // Prefetch queue
    this.prefetchQueue = new Set();
    this.prefetchInProgress = new Set();

    // Start background tasks
    this._startBackgroundTasks();
  }

  /**
   * Get value with multi-layer caching
   */
  async get(key, loader = null) {
    const startTime = Date.now();
    
    try {
      // L1 Cache check
      let value = this.l1Cache.get(key);
      if (value !== null) {
        this._incrementMetric('l1Hits');
        this._checkPrefetchCondition(key, value);
        return this._parseValue(value);
      }
      this._incrementMetric('l1Misses');

      // L2 Cache check (Redis)
      if (this.redis) {
        try {
          const cached = await this.redis.get(`config:${key}`);
          if (cached) {
            const parsedValue = JSON.parse(cached);
            value = parsedValue.value;
            
            // Populate L1 cache
            this.l1Cache.set(key, value, parsedValue.ttl || this.options.l1DefaultTTL);
            
            this._incrementMetric('l2Hits');
            this._checkPrefetchCondition(key, parsedValue);
            return this._parseValue(value);
          }
        } catch (error) {
          logger.warn('Redis cache error:', error);
        }
      }
      this._incrementMetric('l2Misses');

      // L3 Database load
      if (loader) {
        value = await loader(key);
        if (value !== null) {
          // Store in both caches
          await this.set(key, value);
          this._incrementMetric('dbHits');
          return this._parseValue(value);
        }
      }

      return null;

    } catch (error) {
      this._incrementMetric('errors');
      logger.error(`Cache get error for key ${key}:`, error);
      throw error;
    } finally {
      // Record timing metrics
      if (this.options.metricsEnabled) {
        const duration = Date.now() - startTime;
        this._recordTiming('get', duration);
      }
    }
  }

  /**
   * Set value in all cache layers
   */
  async set(key, value, ttl = null) {
    try {
      const cacheTTL = ttl || this.options.l1DefaultTTL;
      
      // L1 Cache
      this.l1Cache.set(key, value, cacheTTL);

      // L2 Cache (Redis)
      if (this.redis) {
        try {
          const cacheData = {
            value,
            ttl: cacheTTL,
            timestamp: Date.now(),
            expiry: Date.now() + (cacheTTL * 1000)
          };
          
          await this.redis.setex(
            `config:${key}`,
            ttl || this.options.l2DefaultTTL,
            JSON.stringify(cacheData)
          );
        } catch (error) {
          logger.warn('Redis cache set error:', error);
        }
      }

    } catch (error) {
      this._incrementMetric('errors');
      logger.error(`Cache set error for key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Delete key from all cache layers
   */
  async delete(key) {
    try {
      // L1 Cache
      this.l1Cache.delete(key);

      // L2 Cache (Redis)
      if (this.redis) {
        try {
          await this.redis.del(`config:${key}`);
        } catch (error) {
          logger.warn('Redis cache delete error:', error);
        }
      }

      this._incrementMetric('invalidations');

    } catch (error) {
      this._incrementMetric('errors');
      logger.error(`Cache delete error for key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Invalidate cache based on pattern
   */
  async invalidatePattern(pattern) {
    try {
      // L1 Cache pattern invalidation
      const l1Keys = this.l1Cache.keys();
      for (const key of l1Keys) {
        if (key.includes(pattern) || key.match(pattern)) {
          this.l1Cache.delete(key);
          this._incrementMetric('invalidations');
        }
      }

      // L2 Cache pattern invalidation
      if (this.redis) {
        try {
          const keys = await this.redis.keys(`config:*${pattern}*`);
          if (keys.length > 0) {
            await this.redis.del(...keys);
            this._incrementMetric('invalidations', keys.length);
          }
        } catch (error) {
          logger.warn('Redis pattern invalidation error:', error);
        }
      }

    } catch (error) {
      this._incrementMetric('errors');
      logger.error(`Cache pattern invalidation error for ${pattern}:`, error);
      throw error;
    }
  }

  /**
   * Warm up cache with commonly used keys
   */
  async warmup(keys, loader) {
    logger.info(`Starting cache warmup for ${keys.length} keys`);
    
    const batchSize = 10;
    for (let i = 0; i < keys.length; i += batchSize) {
      const batch = keys.slice(i, i + batchSize);
      
      await Promise.allSettled(
        batch.map(async key => {
          try {
            if (!this.l1Cache.has(key)) {
              const value = await loader(key);
              if (value !== null) {
                await this.set(key, value);
              }
            }
          } catch (error) {
            logger.warn(`Cache warmup error for key ${key}:`, error);
          }
        })
      );

      // Small delay between batches to avoid overwhelming the system
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    
    logger.info('Cache warmup completed');
  }

  /**
   * Prefetch key before expiry
   */
  async prefetch(key, loader) {
    if (this.prefetchInProgress.has(key)) {
      return; // Already prefetching
    }

    this.prefetchInProgress.add(key);
    
    try {
      const value = await loader(key);
      if (value !== null) {
        await this.set(key, value);
        this._incrementMetric('prefetches');
      }
    } catch (error) {
      logger.warn(`Prefetch error for key ${key}:`, error);
    } finally {
      this.prefetchInProgress.delete(key);
      this.prefetchQueue.delete(key);
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const l1Stats = this.l1Cache.getStats();
    
    const totalRequests = this.metrics.l1Hits + this.metrics.l1Misses;
    const l1HitRate = totalRequests > 0 ? (this.metrics.l1Hits / totalRequests * 100).toFixed(1) : 0;
    
    const l2Requests = this.metrics.l2Hits + this.metrics.l2Misses;
    const l2HitRate = l2Requests > 0 ? (this.metrics.l2Hits / l2Requests * 100).toFixed(1) : 0;

    return {
      l1: {
        ...l1Stats,
        hitRate: l1HitRate + '%',
        hits: this.metrics.l1Hits,
        misses: this.metrics.l1Misses
      },
      l2: {
        hitRate: l2HitRate + '%',
        hits: this.metrics.l2Hits,
        misses: this.metrics.l2Misses,
        enabled: !!this.redis
      },
      overall: {
        totalRequests,
        dbHits: this.metrics.dbHits,
        prefetches: this.metrics.prefetches,
        invalidations: this.metrics.invalidations,
        errors: this.metrics.errors
      }
    };
  }

  /**
   * Clear all caches
   */
  async clear() {
    try {
      // L1 Cache
      this.l1Cache.clear();

      // L2 Cache
      if (this.redis) {
        try {
          const keys = await this.redis.keys('config:*');
          if (keys.length > 0) {
            await this.redis.del(...keys);
          }
        } catch (error) {
          logger.warn('Redis clear error:', error);
        }
      }

      // Reset metrics
      Object.keys(this.metrics).forEach(key => {
        this.metrics[key] = 0;
      });

    } catch (error) {
      logger.error('Cache clear error:', error);
      throw error;
    }
  }

  /**
   * Health check for cache system
   */
  async healthCheck() {
    const health = {
      l1: { status: 'healthy' },
      l2: { status: 'not_configured' },
      overall: { status: 'healthy' }
    };

    try {
      // Check L1 cache
      const testKey = 'health_check_test';
      this.l1Cache.set(testKey, 'test_value', 5);
      const l1Value = this.l1Cache.get(testKey);
      this.l1Cache.delete(testKey);
      
      if (l1Value !== 'test_value') {
        health.l1.status = 'error';
        health.l1.error = 'L1 cache read/write failed';
      }

      // Check L2 cache (Redis)
      if (this.redis) {
        try {
          await this.redis.setex('health_check_test', 5, 'test_value');
          const l2Value = await this.redis.get('health_check_test');
          await this.redis.del('health_check_test');
          
          if (l2Value === 'test_value') {
            health.l2.status = 'healthy';
          } else {
            health.l2.status = 'error';
            health.l2.error = 'L2 cache read/write failed';
          }
        } catch (error) {
          health.l2.status = 'error';
          health.l2.error = error.message;
        }
      }

      // Overall health
      if (health.l1.status === 'error' || health.l2.status === 'error') {
        health.overall.status = 'degraded';
      }

    } catch (error) {
      health.overall.status = 'error';
      health.overall.error = error.message;
    }

    return health;
  }

  // Private helper methods

  _parseValue(value) {
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }
    return value;
  }

  _checkPrefetchCondition(key, cachedData) {
    if (!this.options.prefetchThreshold) return;

    const now = Date.now();
    const expiry = cachedData.expiry || (now + this.options.l1DefaultTTL * 1000);
    const timeUntilExpiry = expiry - now;
    const totalTTL = (cachedData.ttl || this.options.l1DefaultTTL) * 1000;
    
    if (timeUntilExpiry < totalTTL * (1 - this.options.prefetchThreshold)) {
      this.prefetchQueue.add(key);
    }
  }

  _incrementMetric(metric, value = 1) {
    if (this.options.metricsEnabled) {
      this.metrics[metric] = (this.metrics[metric] || 0) + value;
    }
  }

  _recordTiming(operation, duration) {
    // This could be sent to a metrics system like Prometheus
    logger.debug(`Cache ${operation} took ${duration}ms`);
  }

  _startBackgroundTasks() {
    // Prefetch processor
    setInterval(async () => {
      if (this.prefetchQueue.size > 0) {
        const keys = Array.from(this.prefetchQueue).slice(0, 5); // Process up to 5 at a time
        for (const key of keys) {
          if (!this.prefetchInProgress.has(key)) {
            // This would need a reference to the loader function
            // In practice, this would be injected or managed differently
            logger.debug(`Would prefetch key: ${key}`);
          }
        }
      }
    }, 10000); // Every 10 seconds

    // Metrics reset (daily)
    setInterval(() => {
      if (this.options.metricsEnabled) {
        logger.info('Cache metrics:', this.getStats());
        // Reset daily metrics but keep running totals
      }
    }, 24 * 60 * 60 * 1000); // Daily
  }
}

/**
 * Configuration-specific cache wrapper
 */
class ConfigurationCache extends ConfigurationCacheManager {
  constructor(redis = null, db = null, options = {}) {
    super(redis, {
      warmupKeys: [
        'api.rate_limit.default',
        'cache.ttl.default',
        'auth.session.timeout',
        'features.mcp.enabled',
        'logging.level'
      ],
      ...options
    });
    
    this.db = db;
  }

  /**
   * Get configuration value with automatic database loading
   */
  async getConfig(key, environment = null, userId = null) {
    const cacheKey = this._buildConfigKey(key, environment, userId);
    
    return await this.get(cacheKey, async () => {
      // Database loader function
      return await this._loadFromDatabase(key, environment, userId);
    });
  }

  /**
   * Set configuration value and update cache
   */
  async setConfig(key, value, environment = null, userId = null, ttl = null) {
    const cacheKey = this._buildConfigKey(key, environment, userId);
    await this.set(cacheKey, value, ttl);
  }

  /**
   * Invalidate configuration cache
   */
  async invalidateConfig(key, environment = null) {
    const pattern = environment ? `${key}:${environment}` : key;
    await this.invalidatePattern(pattern);
  }

  /**
   * Warm up cache with common configurations
   */
  async warmupConfigurations() {
    if (this.options.warmupKeys.length > 0) {
      await this.warmup(this.options.warmupKeys, async (key) => {
        return await this._loadFromDatabase(key);
      });
    }
  }

  // Private methods

  _buildConfigKey(key, environment = null, userId = null) {
    const parts = [key];
    if (environment) parts.push(`env:${environment}`);
    if (userId) parts.push(`user:${userId}`);
    return parts.join(':');
  }

  async _loadFromDatabase(key, environment = null, userId = null) {
    if (!this.db) {
      throw new Error('Database connection not available');
    }

    try {
      // Get base configuration
      const baseConfigSql = `
        SELECT config_value, config_type, cache_ttl_seconds 
        FROM pf_system_config 
        WHERE config_key = ? AND is_active = 1
      `;
      const baseConfig = await this.db.queryOne(baseConfigSql, [key]);

      if (!baseConfig) {
        return null;
      }

      let value = baseConfig.config_value;

      // Check for environment override
      if (environment) {
        const overrideSql = `
          SELECT config_value FROM pf_environment_config 
          WHERE config_key = ? AND environment = ? AND is_active = 1
          AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
          ORDER BY priority DESC
          FETCH FIRST 1 ROW ONLY
        `;
        const override = await this.db.queryOne(overrideSql, [key, environment]);

        if (override) {
          value = override.config_value;
        }
      }

      // Parse value based on type
      const parsedValue = this._parseConfigValue(value, baseConfig.config_type);

      return {
        value: parsedValue,
        type: baseConfig.config_type,
        ttl: baseConfig.cache_ttl_seconds
      };

    } catch (error) {
      logger.error(`Error loading configuration ${key} from database:`, error);
      throw error;
    }
  }

  _parseConfigValue(value, type) {
    if (value === null || value === undefined) {
      return null;
    }

    switch (type) {
      case 'boolean':
        return value === 'true' || value === '1' || value === 1 || value === true;
      case 'number':
        return parseFloat(value);
      case 'json':
      case 'array':
        return JSON.parse(value);
      case 'date':
        return new Date(value);
      default:
        return String(value);
    }
  }
}

module.exports = {
  ConfigurationCacheManager,
  ConfigurationCache,
  LRUCache
};