/**
 * Performance Monitoring Middleware
 * Tracks API response times and resource usage
 */

const logger = require('../../utils/logger');
const { cacheManager } = require('../../utils/cache');
const queryOptimizer = require('../../utils/queryOptimizer');

class PerformanceMonitor {
  constructor() {
    this.metrics = {
      requests: new Map(),
      endpoints: new Map(),
      errors: new Map(),
      cacheHitRate: 0,
      avgResponseTime: 0,
      totalRequests: 0
    };
    
    this.slowRequestThreshold = 1000; // 1 second
    this.metricsWindow = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Middleware to track request performance
   */
  track() {
    return async (req, res, next) => {
      const startTime = Date.now();
      const startMemory = process.memoryUsage();
      const requestId = req.id || `${Date.now()}-${Math.random()}`;

      // Store original end function
      const originalEnd = res.end;
      const originalJson = res.json;

      // Track response
      const trackResponse = () => {
        const duration = Date.now() - startTime;
        const endMemory = process.memoryUsage();
        
        const metrics = {
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          duration,
          memoryDelta: {
            rss: endMemory.rss - startMemory.rss,
            heapUsed: endMemory.heapUsed - startMemory.heapUsed
          },
          timestamp: new Date()
        };

        // Store metrics
        this.storeMetrics(req.path, metrics);

        // Log slow requests
        if (duration > this.slowRequestThreshold) {
          logger.warn('Slow request detected', {
            requestId,
            ...metrics
          });
        }

        // Log memory spikes
        if (metrics.memoryDelta.heapUsed > 50 * 1024 * 1024) { // 50MB
          logger.warn('High memory usage detected', {
            requestId,
            ...metrics
          });
        }
      };

      // Override response methods
      res.end = function(...args) {
        trackResponse();
        originalEnd.apply(res, args);
      };

      res.json = function(...args) {
        trackResponse();
        originalJson.apply(res, args);
      };

      // Add request ID to request object
      req.requestId = requestId;
      req.startTime = startTime;

      next();
    };
  }

  /**
   * Store metrics for analysis
   */
  storeMetrics(endpoint, metrics) {
    const now = Date.now();
    
    // Update endpoint statistics
    if (!this.metrics.endpoints.has(endpoint)) {
      this.metrics.endpoints.set(endpoint, {
        count: 0,
        totalTime: 0,
        avgTime: 0,
        maxTime: 0,
        minTime: Infinity,
        errors: 0,
        statusCodes: {}
      });
    }

    const stats = this.metrics.endpoints.get(endpoint);
    stats.count++;
    stats.totalTime += metrics.duration;
    stats.avgTime = stats.totalTime / stats.count;
    stats.maxTime = Math.max(stats.maxTime, metrics.duration);
    stats.minTime = Math.min(stats.minTime, metrics.duration);
    
    // Track status codes
    stats.statusCodes[metrics.statusCode] = 
      (stats.statusCodes[metrics.statusCode] || 0) + 1;
    
    if (metrics.statusCode >= 400) {
      stats.errors++;
    }

    // Store recent requests for window analysis
    if (!this.metrics.requests.has(endpoint)) {
      this.metrics.requests.set(endpoint, []);
    }
    
    const requests = this.metrics.requests.get(endpoint);
    requests.push({ ...metrics, timestamp: now });
    
    // Clean old requests outside window
    const cutoff = now - this.metricsWindow;
    const filtered = requests.filter(r => r.timestamp > cutoff);
    this.metrics.requests.set(endpoint, filtered);

    // Update global metrics
    this.metrics.totalRequests++;
    this.updateGlobalMetrics();
  }

  /**
   * Update global performance metrics
   */
  updateGlobalMetrics() {
    let totalTime = 0;
    let totalCount = 0;

    for (const stats of this.metrics.endpoints.values()) {
      totalTime += stats.totalTime;
      totalCount += stats.count;
    }

    this.metrics.avgResponseTime = totalCount > 0 ? totalTime / totalCount : 0;
  }

  /**
   * Compression middleware for response optimization
   */
  compression() {
    const compression = require('compression');
    
    return compression({
      filter: (req, res) => {
        // Don't compress responses with no-compression header
        if (req.headers['x-no-compression']) {
          return false;
        }
        
        // Fallback to standard filter function
        return compression.filter(req, res);
      },
      level: 6, // Balance between speed and compression
      threshold: 1024 // Only compress responses larger than 1KB
    });
  }

  /**
   * Response time header middleware
   */
  responseTime() {
    return (req, res, next) => {
      const startHrTime = process.hrtime();

      res.on('finish', () => {
        const elapsedHrTime = process.hrtime(startHrTime);
        const elapsedTimeInMs = elapsedHrTime[0] * 1000 + elapsedHrTime[1] / 1e6;
        
        res.set('X-Response-Time', `${elapsedTimeInMs.toFixed(2)}ms`);
      });

      next();
    };
  }

  /**
   * Request deduplication middleware
   */
  deduplicate(keyGenerator) {
    const pendingRequests = new Map();

    return async (req, res, next) => {
      const key = keyGenerator(req);
      
      if (!key) {
        return next();
      }

      // Check if identical request is already in progress
      if (pendingRequests.has(key)) {
        logger.debug('Deduplicating request', { key });
        
        try {
          const result = await pendingRequests.get(key);
          return res.json(result);
        } catch (error) {
          return next(error);
        }
      }

      // Create promise for this request
      const promise = new Promise((resolve, reject) => {
        const originalJson = res.json;
        const originalStatus = res.status;
        let statusCode = 200;

        res.status = function(code) {
          statusCode = code;
          return originalStatus.call(this, code);
        };

        res.json = function(data) {
          pendingRequests.delete(key);
          
          if (statusCode >= 200 && statusCode < 300) {
            resolve(data);
          } else {
            reject(data);
          }
          
          return originalJson.call(this, data);
        };

        next();
      });

      pendingRequests.set(key, promise);
    };
  }

  /**
   * Get performance report
   */
  getReport() {
    const report = {
      summary: {
        totalRequests: this.metrics.totalRequests,
        avgResponseTime: Math.round(this.metrics.avgResponseTime),
        totalEndpoints: this.metrics.endpoints.size,
        errorRate: this.calculateErrorRate()
      },
      endpoints: [],
      slowestEndpoints: [],
      mostFrequent: [],
      errorProne: [],
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime()
    };

    // Process endpoint statistics
    for (const [endpoint, stats] of this.metrics.endpoints.entries()) {
      const endpointReport = {
        endpoint,
        ...stats,
        errorRate: (stats.errors / stats.count * 100).toFixed(2)
      };
      
      report.endpoints.push(endpointReport);
    }

    // Sort for different views
    report.slowestEndpoints = [...report.endpoints]
      .sort((a, b) => b.avgTime - a.avgTime)
      .slice(0, 10);

    report.mostFrequent = [...report.endpoints]
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    report.errorProne = [...report.endpoints]
      .filter(e => e.errors > 0)
      .sort((a, b) => b.errorRate - a.errorRate)
      .slice(0, 10);

    return report;
  }

  /**
   * Calculate overall error rate
   */
  calculateErrorRate() {
    let totalErrors = 0;
    let totalRequests = 0;

    for (const stats of this.metrics.endpoints.values()) {
      totalErrors += stats.errors;
      totalRequests += stats.count;
    }

    return totalRequests > 0 
      ? (totalErrors / totalRequests * 100).toFixed(2)
      : 0;
  }

  /**
   * Get real-time metrics for monitoring
   */
  getRealTimeMetrics() {
    const now = Date.now();
    const windowStart = now - this.metricsWindow;
    
    const realTimeMetrics = {
      timestamp: new Date(),
      window: `${this.metricsWindow / 1000}s`,
      requests: 0,
      avgResponseTime: 0,
      errors: 0,
      throughput: 0
    };

    let totalTime = 0;
    let totalRequests = 0;
    let totalErrors = 0;

    for (const [endpoint, requests] of this.metrics.requests.entries()) {
      const recentRequests = requests.filter(r => r.timestamp > windowStart);
      
      totalRequests += recentRequests.length;
      totalTime += recentRequests.reduce((sum, r) => sum + r.duration, 0);
      totalErrors += recentRequests.filter(r => r.statusCode >= 400).length;
    }

    realTimeMetrics.requests = totalRequests;
    realTimeMetrics.avgResponseTime = totalRequests > 0 
      ? Math.round(totalTime / totalRequests)
      : 0;
    realTimeMetrics.errors = totalErrors;
    realTimeMetrics.throughput = (totalRequests / (this.metricsWindow / 1000)).toFixed(2);
    realTimeMetrics.errorRate = totalRequests > 0
      ? (totalErrors / totalRequests * 100).toFixed(2)
      : 0;

    return realTimeMetrics;
  }

  /**
   * Reset metrics
   */
  reset() {
    this.metrics.requests.clear();
    this.metrics.endpoints.clear();
    this.metrics.errors.clear();
    this.metrics.totalRequests = 0;
    this.metrics.avgResponseTime = 0;
    logger.info('Performance metrics reset');
  }

  /**
   * Health check endpoint data
   */
  getHealthStatus() {
    const metrics = this.getRealTimeMetrics();
    const memory = process.memoryUsage();
    
    const status = {
      healthy: true,
      checks: {
        responseTime: {
          value: metrics.avgResponseTime,
          threshold: this.slowRequestThreshold,
          healthy: metrics.avgResponseTime < this.slowRequestThreshold
        },
        errorRate: {
          value: parseFloat(metrics.errorRate),
          threshold: 5, // 5% error rate threshold
          healthy: parseFloat(metrics.errorRate) < 5
        },
        memory: {
          value: Math.round(memory.heapUsed / 1024 / 1024),
          threshold: 500, // 500MB threshold
          healthy: memory.heapUsed < 500 * 1024 * 1024,
          unit: 'MB'
        },
        throughput: {
          value: parseFloat(metrics.throughput),
          threshold: 0.1, // At least 0.1 req/s
          healthy: parseFloat(metrics.throughput) > 0.1,
          unit: 'req/s'
        }
      },
      timestamp: new Date()
    };

    // Overall health is true only if all checks pass
    status.healthy = Object.values(status.checks)
      .every(check => check.healthy);

    return status;
  }
}

// Create singleton instance
const performanceMonitor = new PerformanceMonitor();

// Export middleware functions
module.exports = {
  performanceMonitor,
  track: () => performanceMonitor.track(),
  compression: () => performanceMonitor.compression(),
  responseTime: () => performanceMonitor.responseTime(),
  deduplicate: (keyGen) => performanceMonitor.deduplicate(keyGen),
  
  // Performance API endpoints
  performanceRoutes: (router) => {
    // Get performance report
    router.get('/performance/report', (req, res) => {
      res.json(performanceMonitor.getReport());
    });

    // Get real-time metrics
    router.get('/performance/metrics', (req, res) => {
      res.json(performanceMonitor.getRealTimeMetrics());
    });

    // Get health status
    router.get('/health', (req, res) => {
      const status = performanceMonitor.getHealthStatus();
      res.status(status.healthy ? 200 : 503).json(status);
    });

    // Reset metrics (admin only)
    router.post('/performance/reset', (req, res) => {
      performanceMonitor.reset();
      res.json({ message: 'Performance metrics reset successfully' });
    });

    return router;
  }
};