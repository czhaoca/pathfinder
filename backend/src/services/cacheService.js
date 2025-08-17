/**
 * Redis Cache Service
 * 
 * High-performance caching layer for feature flags and system data
 * Provides <5ms response times for flag evaluation
 */

const Redis = require('ioredis');
const { logger } = require('../utils/logger');

class CacheService {
  constructor(config = {}) {
    this.config = {
      host: config.host || process.env.REDIS_HOST || 'localhost',
      port: config.port || process.env.REDIS_PORT || 6379,
      password: config.password || process.env.REDIS_PASSWORD,
      db: config.db || 0,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      enableOfflineQueue: true,
      maxRetriesPerRequest: 3,
      ...config
    };

    this.client = null;
    this.subscriber = null;
    this.publisher = null;
    this.connected = false;
    this.subscriptions = new Map();
  }

  async connect() {
    try {
      // Main client for get/set operations
      this.client = new Redis(this.config);
      
      // Separate clients for pub/sub (Redis requirement)
      this.subscriber = new Redis(this.config);
      this.publisher = new Redis(this.config);

      // Set up event handlers
      this.setupEventHandlers();

      // Wait for connection
      await this.client.ping();
      this.connected = true;

      logger.info('Redis cache service connected successfully');
      return true;
    } catch (error) {
      logger.error('Failed to connect to Redis:', error);
      this.connected = false;
      // Don't throw - allow system to work without cache
      return false;
    }
  }

  setupEventHandlers() {
    // Main client events
    this.client.on('connect', () => {
      logger.info('Redis client connected');
      this.connected = true;
    });

    this.client.on('error', (error) => {
      logger.error('Redis client error:', error);
    });

    this.client.on('close', () => {
      logger.warn('Redis client disconnected');
      this.connected = false;
    });

    // Subscriber events
    this.subscriber.on('message', (channel, message) => {
      const handlers = this.subscriptions.get(channel);
      if (handlers) {
        handlers.forEach(handler => {
          try {
            handler(message);
          } catch (error) {
            logger.error(`Error in subscription handler for ${channel}:`, error);
          }
        });
      }
    });

    this.subscriber.on('error', (error) => {
      logger.error('Redis subscriber error:', error);
    });

    // Publisher events
    this.publisher.on('error', (error) => {
      logger.error('Redis publisher error:', error);
    });
  }

  /**
   * Get a value from cache
   */
  async get(key) {
    if (!this.connected) return null;
    
    try {
      const value = await this.client.get(key);
      return value;
    } catch (error) {
      logger.error(`Cache get error for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Set a value in cache
   */
  async set(key, value, ttl = null) {
    if (!this.connected) return false;
    
    try {
      const serialized = typeof value === 'object' ? JSON.stringify(value) : value;
      
      if (ttl) {
        await this.client.setex(key, ttl, serialized);
      } else {
        await this.client.set(key, serialized);
      }
      
      return true;
    } catch (error) {
      logger.error(`Cache set error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Set with expiry (convenience method)
   */
  async setex(key, ttl, value) {
    return this.set(key, value, ttl);
  }

  /**
   * Delete a key
   */
  async del(...keys) {
    if (!this.connected) return 0;
    
    try {
      const result = await this.client.del(...keys);
      return result;
    } catch (error) {
      logger.error(`Cache delete error for keys ${keys}:`, error);
      return 0;
    }
  }

  /**
   * Check if key exists
   */
  async exists(key) {
    if (!this.connected) return false;
    
    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      logger.error(`Cache exists error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Set expiry on existing key
   */
  async expire(key, seconds) {
    if (!this.connected) return false;
    
    try {
      const result = await this.client.expire(key, seconds);
      return result === 1;
    } catch (error) {
      logger.error(`Cache expire error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Increment a counter
   */
  async incr(key) {
    if (!this.connected) return null;
    
    try {
      const result = await this.client.incr(key);
      return result;
    } catch (error) {
      logger.error(`Cache incr error for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Decrement a counter
   */
  async decr(key) {
    if (!this.connected) return null;
    
    try {
      const result = await this.client.decr(key);
      return result;
    } catch (error) {
      logger.error(`Cache decr error for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Get all keys matching pattern
   */
  async keys(pattern) {
    if (!this.connected) return [];
    
    try {
      const keys = await this.client.keys(pattern);
      return keys;
    } catch (error) {
      logger.error(`Cache keys error for pattern ${pattern}:`, error);
      return [];
    }
  }

  /**
   * Publish a message to a channel
   */
  async publish(channel, message) {
    if (!this.connected) return false;
    
    try {
      const serialized = typeof message === 'object' ? JSON.stringify(message) : message;
      await this.publisher.publish(channel, serialized);
      return true;
    } catch (error) {
      logger.error(`Cache publish error for channel ${channel}:`, error);
      return false;
    }
  }

  /**
   * Subscribe to a channel
   */
  async subscribe(channel, handler) {
    if (!this.connected) return false;
    
    try {
      // Add handler to local map
      if (!this.subscriptions.has(channel)) {
        this.subscriptions.set(channel, new Set());
        // Actually subscribe to Redis channel
        await this.subscriber.subscribe(channel);
      }
      
      this.subscriptions.get(channel).add(handler);
      return true;
    } catch (error) {
      logger.error(`Cache subscribe error for channel ${channel}:`, error);
      return false;
    }
  }

  /**
   * Unsubscribe from a channel
   */
  async unsubscribe(channel, handler = null) {
    if (!this.connected) return false;
    
    try {
      if (handler) {
        // Remove specific handler
        const handlers = this.subscriptions.get(channel);
        if (handlers) {
          handlers.delete(handler);
          if (handlers.size === 0) {
            this.subscriptions.delete(channel);
            await this.subscriber.unsubscribe(channel);
          }
        }
      } else {
        // Remove all handlers for channel
        this.subscriptions.delete(channel);
        await this.subscriber.unsubscribe(channel);
      }
      
      return true;
    } catch (error) {
      logger.error(`Cache unsubscribe error for channel ${channel}:`, error);
      return false;
    }
  }

  /**
   * Hash operations
   */
  async hset(key, field, value) {
    if (!this.connected) return false;
    
    try {
      const serialized = typeof value === 'object' ? JSON.stringify(value) : value;
      await this.client.hset(key, field, serialized);
      return true;
    } catch (error) {
      logger.error(`Cache hset error for key ${key}:`, error);
      return false;
    }
  }

  async hget(key, field) {
    if (!this.connected) return null;
    
    try {
      const value = await this.client.hget(key, field);
      return value;
    } catch (error) {
      logger.error(`Cache hget error for key ${key}:`, error);
      return null;
    }
  }

  async hgetall(key) {
    if (!this.connected) return {};
    
    try {
      const hash = await this.client.hgetall(key);
      return hash;
    } catch (error) {
      logger.error(`Cache hgetall error for key ${key}:`, error);
      return {};
    }
  }

  async hdel(key, ...fields) {
    if (!this.connected) return 0;
    
    try {
      const result = await this.client.hdel(key, ...fields);
      return result;
    } catch (error) {
      logger.error(`Cache hdel error for key ${key}:`, error);
      return 0;
    }
  }

  /**
   * List operations
   */
  async lpush(key, ...values) {
    if (!this.connected) return 0;
    
    try {
      const serialized = values.map(v => typeof v === 'object' ? JSON.stringify(v) : v);
      const result = await this.client.lpush(key, ...serialized);
      return result;
    } catch (error) {
      logger.error(`Cache lpush error for key ${key}:`, error);
      return 0;
    }
  }

  async rpush(key, ...values) {
    if (!this.connected) return 0;
    
    try {
      const serialized = values.map(v => typeof v === 'object' ? JSON.stringify(v) : v);
      const result = await this.client.rpush(key, ...serialized);
      return result;
    } catch (error) {
      logger.error(`Cache rpush error for key ${key}:`, error);
      return 0;
    }
  }

  async lrange(key, start, stop) {
    if (!this.connected) return [];
    
    try {
      const list = await this.client.lrange(key, start, stop);
      return list;
    } catch (error) {
      logger.error(`Cache lrange error for key ${key}:`, error);
      return [];
    }
  }

  async llen(key) {
    if (!this.connected) return 0;
    
    try {
      const length = await this.client.llen(key);
      return length;
    } catch (error) {
      logger.error(`Cache llen error for key ${key}:`, error);
      return 0;
    }
  }

  /**
   * Set operations
   */
  async sadd(key, ...members) {
    if (!this.connected) return 0;
    
    try {
      const result = await this.client.sadd(key, ...members);
      return result;
    } catch (error) {
      logger.error(`Cache sadd error for key ${key}:`, error);
      return 0;
    }
  }

  async srem(key, ...members) {
    if (!this.connected) return 0;
    
    try {
      const result = await this.client.srem(key, ...members);
      return result;
    } catch (error) {
      logger.error(`Cache srem error for key ${key}:`, error);
      return 0;
    }
  }

  async smembers(key) {
    if (!this.connected) return [];
    
    try {
      const members = await this.client.smembers(key);
      return members;
    } catch (error) {
      logger.error(`Cache smembers error for key ${key}:`, error);
      return [];
    }
  }

  async sismember(key, member) {
    if (!this.connected) return false;
    
    try {
      const result = await this.client.sismember(key, member);
      return result === 1;
    } catch (error) {
      logger.error(`Cache sismember error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Sorted set operations (for leaderboards, rankings, etc.)
   */
  async zadd(key, score, member) {
    if (!this.connected) return 0;
    
    try {
      const result = await this.client.zadd(key, score, member);
      return result;
    } catch (error) {
      logger.error(`Cache zadd error for key ${key}:`, error);
      return 0;
    }
  }

  async zrange(key, start, stop, withScores = false) {
    if (!this.connected) return [];
    
    try {
      if (withScores) {
        const result = await this.client.zrange(key, start, stop, 'WITHSCORES');
        // Convert to array of [member, score] pairs
        const pairs = [];
        for (let i = 0; i < result.length; i += 2) {
          pairs.push([result[i], parseFloat(result[i + 1])]);
        }
        return pairs;
      } else {
        const result = await this.client.zrange(key, start, stop);
        return result;
      }
    } catch (error) {
      logger.error(`Cache zrange error for key ${key}:`, error);
      return [];
    }
  }

  async zrem(key, ...members) {
    if (!this.connected) return 0;
    
    try {
      const result = await this.client.zrem(key, ...members);
      return result;
    } catch (error) {
      logger.error(`Cache zrem error for key ${key}:`, error);
      return 0;
    }
  }

  /**
   * Transaction support
   */
  async multi() {
    if (!this.connected) return null;
    return this.client.multi();
  }

  /**
   * Flush all data (use with caution!)
   */
  async flushall() {
    if (!this.connected) return false;
    
    try {
      await this.client.flushall();
      logger.warn('Cache flushed - all data cleared');
      return true;
    } catch (error) {
      logger.error('Cache flushall error:', error);
      return false;
    }
  }

  /**
   * Flush current database
   */
  async flushdb() {
    if (!this.connected) return false;
    
    try {
      await this.client.flushdb();
      logger.warn('Cache database flushed');
      return true;
    } catch (error) {
      logger.error('Cache flushdb error:', error);
      return false;
    }
  }

  /**
   * Get cache info
   */
  async info(section = null) {
    if (!this.connected) return null;
    
    try {
      const info = section ? await this.client.info(section) : await this.client.info();
      return info;
    } catch (error) {
      logger.error('Cache info error:', error);
      return null;
    }
  }

  /**
   * Ping the cache
   */
  async ping() {
    if (!this.connected) return false;
    
    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch (error) {
      logger.error('Cache ping error:', error);
      return false;
    }
  }

  /**
   * Close all connections
   */
  async disconnect() {
    try {
      if (this.client) {
        await this.client.quit();
      }
      if (this.subscriber) {
        await this.subscriber.quit();
      }
      if (this.publisher) {
        await this.publisher.quit();
      }
      
      this.connected = false;
      logger.info('Redis cache service disconnected');
      return true;
    } catch (error) {
      logger.error('Error disconnecting from Redis:', error);
      return false;
    }
  }

  /**
   * Check if cache is available
   */
  isConnected() {
    return this.connected;
  }

  /**
   * Get cache statistics
   */
  async getStats() {
    if (!this.connected) {
      return {
        connected: false,
        error: 'Cache not connected'
      };
    }

    try {
      const info = await this.client.info('stats');
      const memory = await this.client.info('memory');
      
      // Parse info strings
      const parseInfo = (infoStr) => {
        const lines = infoStr.split('\r\n');
        const result = {};
        lines.forEach(line => {
          if (line && !line.startsWith('#')) {
            const [key, value] = line.split(':');
            if (key && value) {
              result[key] = value;
            }
          }
        });
        return result;
      };

      const stats = parseInfo(info);
      const memInfo = parseInfo(memory);

      return {
        connected: true,
        totalConnections: parseInt(stats.total_connections_received || 0),
        totalCommands: parseInt(stats.total_commands_processed || 0),
        instantaneousOps: parseInt(stats.instantaneous_ops_per_sec || 0),
        usedMemory: memInfo.used_memory_human || 'N/A',
        peakMemory: memInfo.used_memory_peak_human || 'N/A',
        uptimeSeconds: parseInt(stats.uptime_in_seconds || 0)
      };
    } catch (error) {
      logger.error('Error getting cache stats:', error);
      return {
        connected: true,
        error: 'Failed to retrieve stats'
      };
    }
  }
}

// Singleton instance
let cacheInstance = null;

/**
 * Get or create cache service instance
 */
function getCacheService(config = null) {
  if (!cacheInstance) {
    cacheInstance = new CacheService(config);
  }
  return cacheInstance;
}

module.exports = {
  CacheService,
  getCacheService
};