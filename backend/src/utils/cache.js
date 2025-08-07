/**
 * Cache Management Utility
 * Implements caching strategies for improved performance
 */

const Redis = require('ioredis');
const logger = require('./logger');

class CacheManager {
  constructor() {
    this.redis = null;
    this.defaultTTL = 3600; // 1 hour default
    this.connected = false;
  }

  /**
   * Initialize Redis connection
   */
  async connect() {
    if (this.connected) return;

    try {
      this.redis = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD,
        db: process.env.REDIS_DB || 0,
        retryStrategy: (times) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
        maxRetriesPerRequest: 3
      });

      this.redis.on('connect', () => {
        this.connected = true;
        logger.info('Cache manager connected to Redis');
      });

      this.redis.on('error', (error) => {
        logger.error('Redis connection error:', error);
        this.connected = false;
      });

      // Test connection
      await this.redis.ping();
      this.connected = true;
    } catch (error) {
      logger.error('Failed to connect to Redis:', error);
      // Continue without cache if Redis is unavailable
      this.connected = false;
    }
  }

  /**
   * Get value from cache
   */
  async get(key) {
    if (!this.connected) return null;

    try {
      const value = await this.redis.get(key);
      if (value) {
        logger.debug(`Cache hit for key: ${key}`);
        return JSON.parse(value);
      }
      logger.debug(`Cache miss for key: ${key}`);
      return null;
    } catch (error) {
      logger.error('Cache get error:', error);
      return null;
    }
  }

  /**
   * Set value in cache
   */
  async set(key, value, ttl = this.defaultTTL) {
    if (!this.connected) return false;

    try {
      const serialized = JSON.stringify(value);
      if (ttl) {
        await this.redis.setex(key, ttl, serialized);
      } else {
        await this.redis.set(key, serialized);
      }
      logger.debug(`Cache set for key: ${key}, TTL: ${ttl}s`);
      return true;
    } catch (error) {
      logger.error('Cache set error:', error);
      return false;
    }
  }

  /**
   * Delete value from cache
   */
  async delete(key) {
    if (!this.connected) return false;

    try {
      await this.redis.del(key);
      logger.debug(`Cache deleted for key: ${key}`);
      return true;
    } catch (error) {
      logger.error('Cache delete error:', error);
      return false;
    }
  }

  /**
   * Delete multiple keys by pattern
   */
  async deletePattern(pattern) {
    if (!this.connected) return false;

    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
        logger.debug(`Cache deleted ${keys.length} keys matching pattern: ${pattern}`);
      }
      return true;
    } catch (error) {
      logger.error('Cache delete pattern error:', error);
      return false;
    }
  }

  /**
   * Clear all cache
   */
  async flush() {
    if (!this.connected) return false;

    try {
      await this.redis.flushdb();
      logger.info('Cache flushed');
      return true;
    } catch (error) {
      logger.error('Cache flush error:', error);
      return false;
    }
  }

  /**
   * Get or set cache (fetch if miss)
   */
  async getOrSet(key, fetchFunction, ttl = this.defaultTTL) {
    // Try to get from cache first
    const cached = await this.get(key);
    if (cached !== null) {
      return cached;
    }

    // Fetch data if not in cache
    try {
      const data = await fetchFunction();
      if (data !== null && data !== undefined) {
        await this.set(key, data, ttl);
      }
      return data;
    } catch (error) {
      logger.error('Error in getOrSet fetch function:', error);
      throw error;
    }
  }

  /**
   * Invalidate related cache entries
   */
  async invalidateRelated(patterns) {
    if (!this.connected) return;

    for (const pattern of patterns) {
      await this.deletePattern(pattern);
    }
  }

  /**
   * Cache decorator for methods
   */
  cached(keyPrefix, ttl = this.defaultTTL) {
    return (target, propertyName, descriptor) => {
      const originalMethod = descriptor.value;

      descriptor.value = async function(...args) {
        const cacheKey = `${keyPrefix}:${JSON.stringify(args)}`;
        
        // Try to get from cache
        const cached = await this.get(cacheKey);
        if (cached !== null) {
          return cached;
        }

        // Call original method
        const result = await originalMethod.apply(this, args);
        
        // Cache the result
        if (result !== null && result !== undefined) {
          await this.set(cacheKey, result, ttl);
        }

        return result;
      }.bind(this);

      return descriptor;
    };
  }

  /**
   * Get cache statistics
   */
  async getStats() {
    if (!this.connected) {
      return { connected: false };
    }

    try {
      const info = await this.redis.info('stats');
      const dbSize = await this.redis.dbsize();
      
      // Parse Redis info
      const stats = {
        connected: true,
        totalKeys: dbSize,
        memoryUsage: await this.redis.info('memory'),
        hits: 0,
        misses: 0
      };

      // Extract hit/miss stats from info
      const lines = info.split('\r\n');
      for (const line of lines) {
        if (line.startsWith('keyspace_hits:')) {
          stats.hits = parseInt(line.split(':')[1]);
        } else if (line.startsWith('keyspace_misses:')) {
          stats.misses = parseInt(line.split(':')[1]);
        }
      }

      stats.hitRate = stats.hits / (stats.hits + stats.misses) || 0;
      
      return stats;
    } catch (error) {
      logger.error('Error getting cache stats:', error);
      return { connected: this.connected, error: error.message };
    }
  }

  /**
   * Close Redis connection
   */
  async disconnect() {
    if (this.redis) {
      await this.redis.quit();
      this.connected = false;
      logger.info('Cache manager disconnected from Redis');
    }
  }
}

// Cache key generators
class CacheKeys {
  static user(userId) {
    return `user:${userId}`;
  }

  static userProfile(userId) {
    return `user:profile:${userId}`;
  }

  static userSessions(userId) {
    return `user:sessions:${userId}`;
  }

  static careerPath(pathId) {
    return `career:path:${pathId}`;
  }

  static careerRecommendations(userId) {
    return `career:recommendations:${userId}`;
  }

  static jobSearch(query) {
    return `jobs:search:${JSON.stringify(query)}`;
  }

  static jobDetails(jobId) {
    return `jobs:details:${jobId}`;
  }

  static learningCourses(filters) {
    return `learning:courses:${JSON.stringify(filters)}`;
  }

  static learningProgress(userId) {
    return `learning:progress:${userId}`;
  }

  static networkingContacts(userId) {
    return `networking:contacts:${userId}`;
  }

  static analytics(type, userId, dateRange) {
    return `analytics:${type}:${userId}:${JSON.stringify(dateRange)}`;
  }

  static aiResponse(prompt, context) {
    const hash = require('crypto')
      .createHash('md5')
      .update(prompt + JSON.stringify(context))
      .digest('hex');
    return `ai:response:${hash}`;
  }
}

// Export singleton instance
const cacheManager = new CacheManager();

module.exports = {
  cacheManager,
  CacheKeys
};