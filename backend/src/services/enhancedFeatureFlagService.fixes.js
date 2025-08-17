/**
 * Critical Fixes for Enhanced Feature Flag Service
 * 
 * This file contains fixes for critical security and performance issues
 * identified during QA review. These should be integrated into the main service.
 */

const crypto = require('crypto');

/**
 * Circuit Breaker Implementation
 * Prevents cascading failures when dependencies are unavailable
 */
class CircuitBreaker {
  constructor(name, options = {}) {
    this.name = name;
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeout = options.resetTimeout || 60000; // 1 minute
    this.monitoringPeriod = options.monitoringPeriod || 10000; // 10 seconds
    
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.nextAttemptTime = null;
    this.successCount = 0;
    this.requestCount = 0;
  }

  async execute(fn, fallbackFn = null) {
    this.requestCount++;
    
    // Check if circuit should be reset
    if (this.state === 'OPEN' && Date.now() >= this.nextAttemptTime) {
      this.state = 'HALF_OPEN';
      this.failureCount = 0;
    }
    
    // If circuit is open, use fallback or throw
    if (this.state === 'OPEN') {
      if (fallbackFn) {
        return await fallbackFn();
      }
      throw new Error(`Circuit breaker is OPEN for ${this.name}`);
    }
    
    try {
      const result = await this.executeWithTimeout(fn, 5000); // 5 second timeout
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      
      if (fallbackFn) {
        return await fallbackFn();
      }
      throw error;
    }
  }
  
  async executeWithTimeout(fn, timeout) {
    return Promise.race([
      fn(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error(`Operation timeout after ${timeout}ms`)), timeout)
      )
    ]);
  }
  
  onSuccess() {
    this.successCount++;
    
    if (this.state === 'HALF_OPEN') {
      // Successfully handled request in half-open state, close the circuit
      this.state = 'CLOSED';
      this.failureCount = 0;
    }
    
    // Reset failure count if monitoring period passed
    if (this.lastFailureTime && Date.now() - this.lastFailureTime > this.monitoringPeriod) {
      this.failureCount = 0;
    }
  }
  
  onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
      this.nextAttemptTime = Date.now() + this.resetTimeout;
    }
  }
  
  getMetrics() {
    return {
      name: this.name,
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      requestCount: this.requestCount,
      errorRate: this.requestCount > 0 ? (this.failureCount / this.requestCount) * 100 : 0
    };
  }
  
  reset() {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.successCount = 0;
    this.requestCount = 0;
    this.lastFailureTime = null;
    this.nextAttemptTime = null;
  }
}

/**
 * Input Sanitization Utilities
 * Prevents SQL injection and other injection attacks
 */
class InputSanitizer {
  /**
   * Sanitize IP address to prevent injection
   */
  static sanitizeIP(ip) {
    if (!ip || typeof ip !== 'string') return '0.0.0.0';
    
    // Remove any non-IP characters
    const cleaned = ip.replace(/[^0-9.:]/g, '');
    
    // Validate IPv4
    const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    if (ipv4Regex.test(cleaned)) {
      return cleaned;
    }
    
    // Validate IPv6 (simplified)
    const ipv6Regex = /^(?:[A-F0-9]{1,4}:){7}[A-F0-9]{1,4}$/i;
    if (ipv6Regex.test(cleaned)) {
      return cleaned;
    }
    
    // Return safe default
    return '0.0.0.0';
  }
  
  /**
   * Sanitize fingerprint to prevent injection
   */
  static sanitizeFingerprint(fingerprint) {
    if (!fingerprint || typeof fingerprint !== 'string') return '';
    
    // Allow only alphanumeric, dash, underscore
    return fingerprint.replace(/[^a-zA-Z0-9\-_]/g, '').substring(0, 255);
  }
  
  /**
   * Sanitize cache key to prevent injection
   */
  static sanitizeCacheKey(key) {
    if (!key || typeof key !== 'string') return '';
    
    // Remove any Redis special characters
    return key
      .replace(/[\r\n\0\x00]/g, '') // Remove null bytes and newlines
      .replace(/[*?\[\]{}()]/g, '_') // Replace wildcards
      .replace(/\s+/g, '_') // Replace spaces
      .substring(0, 250); // Limit length
  }
  
  /**
   * Sanitize SQL parameter
   */
  static sanitizeSQLParam(param) {
    if (param === null || param === undefined) return null;
    if (typeof param === 'number') return param;
    if (typeof param === 'boolean') return param;
    
    // For strings, escape special characters
    return String(param)
      .replace(/'/g, "''") // Escape single quotes
      .replace(/\\/g, '\\\\') // Escape backslashes
      .replace(/\0/g, '') // Remove null bytes
      .substring(0, 1000); // Limit length
  }
  
  /**
   * Validate and sanitize context object to prevent prototype pollution
   */
  static sanitizeContext(context) {
    if (!context || typeof context !== 'object') return {};
    
    // Create a new object without prototype
    const sanitized = Object.create(null);
    
    // Whitelist allowed fields
    const allowedFields = [
      'userId', 'groupId', 'userRoles', 'sessionId',
      'ipAddress', 'userAgent', 'country', 'age',
      'environment', 'path', 'method'
    ];
    
    for (const field of allowedFields) {
      if (context.hasOwnProperty(field)) {
        const value = context[field];
        
        // Validate types
        if (field === 'userRoles' && Array.isArray(value)) {
          sanitized[field] = value.filter(r => typeof r === 'string').slice(0, 10);
        } else if (field === 'age' && typeof value === 'number') {
          sanitized[field] = Math.min(Math.max(0, value), 150);
        } else if (typeof value === 'string') {
          sanitized[field] = value.substring(0, 500);
        } else if (typeof value === 'boolean' || typeof value === 'number') {
          sanitized[field] = value;
        }
      }
    }
    
    return sanitized;
  }
}

/**
 * Circular Dependency Detector
 * Prevents infinite loops in prerequisite evaluation
 */
class DependencyTracker {
  constructor() {
    this.visitedFlags = new Set();
    this.recursionDepth = 0;
    this.maxDepth = 10;
  }
  
  /**
   * Check if flag can be evaluated or if it would cause a cycle
   */
  canEvaluate(flagKey) {
    if (this.visitedFlags.has(flagKey)) {
      throw new Error(`Circular dependency detected: ${flagKey} is already being evaluated`);
    }
    
    if (this.recursionDepth >= this.maxDepth) {
      throw new Error(`Maximum prerequisite depth (${this.maxDepth}) exceeded`);
    }
    
    return true;
  }
  
  /**
   * Mark flag as being evaluated
   */
  startEvaluation(flagKey) {
    this.visitedFlags.add(flagKey);
    this.recursionDepth++;
  }
  
  /**
   * Mark flag evaluation as complete
   */
  endEvaluation(flagKey) {
    this.visitedFlags.delete(flagKey);
    this.recursionDepth--;
  }
  
  /**
   * Reset tracker for new evaluation
   */
  reset() {
    this.visitedFlags.clear();
    this.recursionDepth = 0;
  }
}

/**
 * Rate Limiter Implementation
 * Prevents abuse of flag evaluation endpoints
 */
class RateLimiter {
  constructor(options = {}) {
    this.windowMs = options.windowMs || 60000; // 1 minute
    this.maxRequests = options.maxRequests || 100;
    this.keyGenerator = options.keyGenerator || ((req) => req.ip);
    this.cache = options.cache;
    this.skipSuccessfulRequests = options.skipSuccessfulRequests || false;
  }
  
  async isAllowed(key) {
    if (!this.cache) return true; // No cache, allow all
    
    const sanitizedKey = InputSanitizer.sanitizeCacheKey(`ratelimit:${key}`);
    const now = Date.now();
    const windowStart = now - this.windowMs;
    
    // Get current count
    const count = await this.cache.incr(sanitizedKey);
    
    if (count === 1) {
      // First request in window, set expiry
      await this.cache.expire(sanitizedKey, Math.ceil(this.windowMs / 1000));
    }
    
    return count <= this.maxRequests;
  }
  
  middleware() {
    return async (req, res, next) => {
      const key = this.keyGenerator(req);
      
      try {
        const allowed = await this.isAllowed(key);
        
        if (!allowed) {
          return res.status(429).json({
            error: 'Too Many Requests',
            message: 'Rate limit exceeded. Please try again later.',
            retryAfter: this.windowMs / 1000
          });
        }
        
        next();
      } catch (error) {
        // On error, allow request but log
        console.error('Rate limiter error:', error);
        next();
      }
    };
  }
}

/**
 * Enhanced Error Handler
 * Prevents information leakage through error messages
 */
class SecureErrorHandler {
  static handle(error, req, res, next) {
    // Log full error internally
    console.error('Error:', {
      message: error.message,
      stack: error.stack,
      url: req.url,
      method: req.method,
      ip: req.ip,
      user: req.user?.id
    });
    
    // Determine if this is a known error type
    const knownErrors = {
      'ValidationError': 400,
      'UnauthorizedError': 401,
      'ForbiddenError': 403,
      'NotFoundError': 404,
      'ConflictError': 409,
      'RateLimitError': 429
    };
    
    const statusCode = knownErrors[error.name] || 500;
    
    // Send sanitized response
    if (process.env.NODE_ENV === 'production') {
      // Production: minimal information
      res.status(statusCode).json({
        error: statusCode < 500 ? error.message : 'Internal Server Error',
        code: error.code || 'ERROR',
        timestamp: new Date().toISOString()
      });
    } else {
      // Development: more details
      res.status(statusCode).json({
        error: error.message,
        code: error.code || 'ERROR',
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
    }
  }
}

/**
 * Connection Pool Manager
 * Prevents connection exhaustion attacks
 */
class ConnectionPoolManager {
  constructor(options = {}) {
    this.maxConnections = options.maxConnections || 20;
    this.connectionTimeout = options.connectionTimeout || 30000; // 30 seconds
    this.idleTimeout = options.idleTimeout || 10000; // 10 seconds
    this.connections = new Map();
    this.waitQueue = [];
  }
  
  async getConnection() {
    // Clean up idle connections
    this.cleanupIdleConnections();
    
    // If pool not full, create new connection
    if (this.connections.size < this.maxConnections) {
      return this.createConnection();
    }
    
    // Pool full, wait for available connection
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const index = this.waitQueue.indexOf(resolver);
        if (index > -1) {
          this.waitQueue.splice(index, 1);
        }
        reject(new Error('Connection timeout - pool exhausted'));
      }, this.connectionTimeout);
      
      const resolver = { resolve, reject, timeout };
      this.waitQueue.push(resolver);
    });
  }
  
  releaseConnection(connection) {
    connection.lastUsed = Date.now();
    
    // If there are waiting requests, give them the connection
    if (this.waitQueue.length > 0) {
      const { resolve, timeout } = this.waitQueue.shift();
      clearTimeout(timeout);
      resolve(connection);
    }
  }
  
  createConnection() {
    const connection = {
      id: crypto.randomBytes(16).toString('hex'),
      createdAt: Date.now(),
      lastUsed: Date.now()
    };
    
    this.connections.set(connection.id, connection);
    return connection;
  }
  
  cleanupIdleConnections() {
    const now = Date.now();
    
    for (const [id, conn] of this.connections) {
      if (now - conn.lastUsed > this.idleTimeout) {
        this.connections.delete(id);
      }
    }
  }
}

/**
 * Request Validator
 * Validates and sanitizes all incoming requests
 */
class RequestValidator {
  static validateFlagKey(flagKey) {
    if (!flagKey || typeof flagKey !== 'string') {
      throw new Error('Invalid flag key');
    }
    
    if (flagKey.length > 100) {
      throw new Error('Flag key too long');
    }
    
    if (!/^[a-z0-9_]+$/.test(flagKey)) {
      throw new Error('Flag key must contain only lowercase letters, numbers, and underscores');
    }
    
    return flagKey;
  }
  
  static validateFlagData(data) {
    const errors = [];
    
    // Required fields
    if (!data.flag_key) errors.push('flag_key is required');
    if (!data.flag_name) errors.push('flag_name is required');
    if (!data.flag_type) errors.push('flag_type is required');
    if (data.default_value === undefined) errors.push('default_value is required');
    
    // Validate types
    const validTypes = ['boolean', 'percentage', 'variant', 'numeric', 'string'];
    if (data.flag_type && !validTypes.includes(data.flag_type)) {
      errors.push(`Invalid flag_type. Must be one of: ${validTypes.join(', ')}`);
    }
    
    // Validate percentage
    if (data.rollout_percentage !== undefined) {
      const percentage = Number(data.rollout_percentage);
      if (isNaN(percentage) || percentage < 0 || percentage > 100) {
        errors.push('rollout_percentage must be between 0 and 100');
      }
    }
    
    // Validate dates
    if (data.start_date && !Date.parse(data.start_date)) {
      errors.push('Invalid start_date format');
    }
    
    if (data.end_date && !Date.parse(data.end_date)) {
      errors.push('Invalid end_date format');
    }
    
    if (errors.length > 0) {
      const error = new Error('Validation failed');
      error.name = 'ValidationError';
      error.details = errors;
      throw error;
    }
    
    return data;
  }
}

module.exports = {
  CircuitBreaker,
  InputSanitizer,
  DependencyTracker,
  RateLimiter,
  SecureErrorHandler,
  ConnectionPoolManager,
  RequestValidator
};