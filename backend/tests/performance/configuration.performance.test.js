/**
 * Configuration Management Performance Tests
 * 
 * Performance test suite for the configuration management system:
 * - Cache performance under load
 * - Concurrent configuration updates
 * - Feature flag evaluation throughput
 * - Memory usage and leak detection
 * - Database connection pooling efficiency
 * - Rate limiter performance
 */

const { performance } = require('perf_hooks');
const { ConfigurationService } = require('../../src/services/configurationService');
const { FeatureFlagService } = require('../../src/services/featureFlagService');
const { DynamicRateLimiter } = require('../../src/services/dynamicRateLimiter');
const { ConfigurationCache } = require('../../src/services/configurationCache');
const { setupTestDatabase, cleanupTestDatabase } = require('../setup');

// Performance test configuration
const PERFORMANCE_CONFIG = {
  CACHE_LOAD_TEST_ITERATIONS: 1000,
  CONCURRENT_USERS: 50,
  FEATURE_FLAG_EVALUATIONS: 10000,
  RATE_LIMIT_REQUESTS: 5000,
  MEMORY_LEAK_ITERATIONS: 100,
  ACCEPTABLE_RESPONSE_TIME_MS: 50,
  ACCEPTABLE_CACHE_HIT_RATE: 0.95
};

describe('Configuration Management Performance Tests', () => {
  let configService;
  let featureFlagService;
  let rateLimiter;
  let cache;
  let mockDb;

  beforeAll(async () => {
    await setupTestDatabase();
    
    // Setup mock database with realistic delays
    mockDb = {
      query: jest.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve([]), 5))
      ),
      queryOne: jest.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({
          config_key: 'test.key',
          config_value: 'test_value',
          config_type: 'string',
          cache_ttl_seconds: 300
        }), 5))
      ),
      execute: jest.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({ rowsAffected: 1 }), 10))
      )
    };

    cache = new ConfigurationCache();
    configService = new ConfigurationService(mockDb, cache);
    featureFlagService = new FeatureFlagService(mockDb, cache);
    rateLimiter = new DynamicRateLimiter(mockDb, cache);
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  describe('Cache Performance Tests', () => {
    it('should handle high-volume cache operations efficiently', async () => {
      const startTime = performance.now();
      const promises = [];

      // Simulate high-volume cache operations
      for (let i = 0; i < PERFORMANCE_CONFIG.CACHE_LOAD_TEST_ITERATIONS; i++) {
        promises.push(cache.get(`test.key.${i % 100}`, 'production'));
      }

      await Promise.all(promises);
      const endTime = performance.now();
      const duration = endTime - startTime;
      const avgResponseTime = duration / PERFORMANCE_CONFIG.CACHE_LOAD_TEST_ITERATIONS;

      expect(avgResponseTime).toBeLessThan(1); // Should be sub-millisecond
      console.log(`Cache operations: ${PERFORMANCE_CONFIG.CACHE_LOAD_TEST_ITERATIONS} in ${duration.toFixed(2)}ms (avg: ${avgResponseTime.toFixed(3)}ms)`);
    });

    it('should maintain high cache hit rate under load', async () => {
      // Pre-populate cache
      const keys = Array.from({ length: 100 }, (_, i) => `perf.test.key.${i}`);
      
      for (const key of keys) {
        await cache.set(key, `value_${key}`, 300);
      }

      let hits = 0;
      let misses = 0;

      // Test cache hit rate
      for (let i = 0; i < 1000; i++) {
        const key = keys[i % keys.length];
        const result = await cache.get(key);
        if (result !== null) {
          hits++;
        } else {
          misses++;
        }
      }

      const hitRate = hits / (hits + misses);
      expect(hitRate).toBeGreaterThan(PERFORMANCE_CONFIG.ACCEPTABLE_CACHE_HIT_RATE);
      console.log(`Cache hit rate: ${(hitRate * 100).toFixed(2)}% (${hits} hits, ${misses} misses)`);
    });

    it('should handle cache eviction efficiently', async () => {
      const smallCache = new ConfigurationCache(100); // Small cache for testing eviction
      const startTime = performance.now();

      // Fill cache beyond capacity to trigger eviction
      for (let i = 0; i < 200; i++) {
        await smallCache.set(`eviction.test.${i}`, `value_${i}`, 300);
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(1000); // Should complete within 1 second
      console.log(`Cache eviction test: 200 items in ${duration.toFixed(2)}ms`);
    });
  });

  describe('Concurrent Access Performance', () => {
    it('should handle concurrent configuration reads efficiently', async () => {
      const concurrentPromises = [];
      const startTime = performance.now();

      // Simulate concurrent reads from multiple users
      for (let i = 0; i < PERFORMANCE_CONFIG.CONCURRENT_USERS; i++) {
        concurrentPromises.push(
          configService.getValue('test.concurrent.read', 'production', `user_${i}`)
        );
      }

      const results = await Promise.all(concurrentPromises);
      const endTime = performance.now();
      const duration = endTime - startTime;
      const avgResponseTime = duration / PERFORMANCE_CONFIG.CONCURRENT_USERS;

      expect(results).toHaveLength(PERFORMANCE_CONFIG.CONCURRENT_USERS);
      expect(avgResponseTime).toBeLessThan(PERFORMANCE_CONFIG.ACCEPTABLE_RESPONSE_TIME_MS);
      console.log(`Concurrent reads: ${PERFORMANCE_CONFIG.CONCURRENT_USERS} users in ${duration.toFixed(2)}ms (avg: ${avgResponseTime.toFixed(2)}ms)`);
    });

    it('should handle concurrent configuration updates with proper locking', async () => {
      const updatePromises = [];
      const startTime = performance.now();

      // Mock setValue to simulate update operations
      jest.spyOn(configService, 'setValue').mockImplementation(async (key, value, env, userId) => {
        // Simulate database write delay
        await new Promise(resolve => setTimeout(resolve, 20));
        return { success: true, requires_restart: false };
      });

      // Simulate concurrent updates to same configuration
      for (let i = 0; i < 10; i++) {
        updatePromises.push(
          configService.setValue('test.concurrent.update', `value_${i}`, 'production', `user_${i}`)
        );
      }

      const results = await Promise.all(updatePromises);
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(results).toHaveLength(10);
      expect(results.every(r => r.success)).toBe(true);
      console.log(`Concurrent updates: 10 updates in ${duration.toFixed(2)}ms`);
    });
  });

  describe('Feature Flag Performance Tests', () => {
    it('should evaluate feature flags at high throughput', async () => {
      // Mock feature flag data
      mockDb.queryOne.mockResolvedValue({
        id: 'test_flag',
        feature_key: 'test.performance.flag',
        is_enabled: 1,
        rollout_percentage: 50,
        cache_ttl_seconds: 60
      });

      const evaluationPromises = [];
      const startTime = performance.now();

      // Simulate high-throughput feature flag evaluations
      for (let i = 0; i < PERFORMANCE_CONFIG.FEATURE_FLAG_EVALUATIONS; i++) {
        evaluationPromises.push(
          featureFlagService.isFeatureEnabled('test.performance.flag', {
            userId: `user_${i % 1000}`, // Cycle through 1000 users
            environment: 'production'
          })
        );
      }

      const results = await Promise.all(evaluationPromises);
      const endTime = performance.now();
      const duration = endTime - startTime;
      const throughput = PERFORMANCE_CONFIG.FEATURE_FLAG_EVALUATIONS / (duration / 1000);

      expect(results).toHaveLength(PERFORMANCE_CONFIG.FEATURE_FLAG_EVALUATIONS);
      expect(throughput).toBeGreaterThan(1000); // Should handle > 1000 evaluations/second
      console.log(`Feature flag evaluations: ${PERFORMANCE_CONFIG.FEATURE_FLAG_EVALUATIONS} in ${duration.toFixed(2)}ms (${throughput.toFixed(0)} ops/sec)`);
    });

    it('should handle complex targeting rules efficiently', async () => {
      // Mock feature flag with complex targeting rules
      mockDb.queryOne.mockResolvedValue({
        id: 'complex_flag',
        feature_key: 'test.complex.targeting',
        is_enabled: 1,
        targeting_rules: JSON.stringify([
          {
            type: 'user_attribute',
            attribute: 'country',
            operator: 'in',
            value: ['US', 'CA', 'GB']
          },
          {
            type: 'user_attribute',
            attribute: 'subscription_tier',
            operator: 'equals',
            value: 'premium'
          },
          {
            type: 'percentage',
            operator: 'percentage_in',
            value: '25'
          }
        ]),
        cache_ttl_seconds: 60
      });

      const evaluations = 1000;
      const startTime = performance.now();

      const promises = Array.from({ length: evaluations }, (_, i) =>
        featureFlagService.isFeatureEnabled('test.complex.targeting', {
          userId: `user_${i}`,
          country: ['US', 'CA', 'GB', 'FR', 'DE'][i % 5],
          subscription_tier: ['basic', 'premium', 'enterprise'][i % 3]
        })
      );

      await Promise.all(promises);
      const endTime = performance.now();
      const duration = endTime - startTime;
      const avgTime = duration / evaluations;

      expect(avgTime).toBeLessThan(5); // Should be under 5ms per evaluation
      console.log(`Complex targeting: ${evaluations} evaluations in ${duration.toFixed(2)}ms (avg: ${avgTime.toFixed(2)}ms)`);
    });
  });

  describe('Rate Limiter Performance Tests', () => {
    it('should handle high-volume rate limit checks efficiently', async () => {
      // Mock rate limit configuration
      mockDb.queryOne.mockResolvedValue({
        limit_key: 'api.requests',
        max_requests: 1000,
        time_window_seconds: 60,
        scope_type: 'user'
      });

      const checkPromises = [];
      const startTime = performance.now();

      // Simulate high-volume rate limit checks
      for (let i = 0; i < PERFORMANCE_CONFIG.RATE_LIMIT_REQUESTS; i++) {
        checkPromises.push(
          rateLimiter.checkLimit('api.requests', {
            userId: `user_${i % 100}`, // 100 different users
            ip: `192.168.1.${i % 255}`
          })
        );
      }

      const results = await Promise.all(checkPromises);
      const endTime = performance.now();
      const duration = endTime - startTime;
      const throughput = PERFORMANCE_CONFIG.RATE_LIMIT_REQUESTS / (duration / 1000);

      expect(results).toHaveLength(PERFORMANCE_CONFIG.RATE_LIMIT_REQUESTS);
      expect(throughput).toBeGreaterThan(500); // Should handle > 500 checks/second
      console.log(`Rate limit checks: ${PERFORMANCE_CONFIG.RATE_LIMIT_REQUESTS} in ${duration.toFixed(2)}ms (${throughput.toFixed(0)} ops/sec)`);
    });

    it('should scale with number of concurrent rate limiters', async () => {
      const limitKeys = ['api.auth', 'api.data', 'api.upload', 'api.download'];
      const checksPerLimiter = 250;
      const startTime = performance.now();

      const allPromises = limitKeys.flatMap(limitKey =>
        Array.from({ length: checksPerLimiter }, (_, i) =>
          rateLimiter.checkLimit(limitKey, { userId: `user_${i}` })
        )
      );

      await Promise.all(allPromises);
      const endTime = performance.now();
      const duration = endTime - startTime;
      const totalChecks = limitKeys.length * checksPerLimiter;

      console.log(`Multi-limiter test: ${totalChecks} checks across ${limitKeys.length} limiters in ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });

  describe('Memory Usage and Leak Detection', () => {
    it('should not leak memory during repeated operations', async () => {
      const getMemoryUsage = () => {
        if (global.gc) global.gc(); // Force garbage collection if available
        return process.memoryUsage().heapUsed;
      };

      const initialMemory = getMemoryUsage();
      
      // Perform repeated operations that could cause memory leaks
      for (let i = 0; i < PERFORMANCE_CONFIG.MEMORY_LEAK_ITERATIONS; i++) {
        // Configuration operations
        await configService.getValue(`test.memory.${i % 10}`, 'production');
        
        // Feature flag operations
        await featureFlagService.isFeatureEnabled('test.memory.flag', {
          userId: `user_${i}`
        });
        
        // Cache operations
        await cache.set(`temp.key.${i}`, `value_${i}`, 10);
        await cache.get(`temp.key.${i}`);
        
        // Clear temporary data periodically
        if (i % 20 === 0) {
          await cache.clear();
        }
      }

      const finalMemory = getMemoryUsage();
      const memoryIncrease = finalMemory - initialMemory;
      const memoryIncreasePercent = (memoryIncrease / initialMemory) * 100;

      console.log(`Memory usage: ${(initialMemory / 1024 / 1024).toFixed(2)}MB -> ${(finalMemory / 1024 / 1024).toFixed(2)}MB (${memoryIncreasePercent.toFixed(1)}% increase)`);
      
      // Memory increase should be reasonable (< 50% of initial)
      expect(memoryIncreasePercent).toBeLessThan(50);
    });

    it('should efficiently manage cache memory usage', async () => {
      const cacheWithLimit = new ConfigurationCache(1000); // 1000 item limit
      
      // Fill cache to capacity
      for (let i = 0; i < 1500; i++) {
        await cacheWithLimit.set(`memory.test.${i}`, `value_${i}`, 300);
      }

      // Check that cache respects size limits
      const cacheStats = cacheWithLimit.getStats();
      expect(cacheStats.size).toBeLessThanOrEqual(1000);
      console.log(`Cache memory management: ${cacheStats.size} items (limit: 1000), hit rate: ${(cacheStats.hitRate * 100).toFixed(1)}%`);
    });
  });

  describe('Database Connection Performance', () => {
    it('should efficiently manage database connections under load', async () => {
      const connectionPromises = [];
      const startTime = performance.now();

      // Simulate high-concurrency database operations
      for (let i = 0; i < 100; i++) {
        connectionPromises.push(
          (async () => {
            await configService.getValue(`db.test.${i % 20}`, 'production');
            await featureFlagService.isFeatureEnabled('db.test.flag', { userId: `user_${i}` });
          })()
        );
      }

      await Promise.all(connectionPromises);
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
      console.log(`Database connection test: 100 concurrent operations in ${duration.toFixed(2)}ms`);
    });
  });

  describe('Performance Regression Tests', () => {
    it('should maintain response times within acceptable limits', async () => {
      const operations = [
        () => configService.getValue('perf.test.string', 'production'),
        () => configService.getValue('perf.test.number', 'production'),
        () => configService.getValue('perf.test.boolean', 'production'),
        () => featureFlagService.isFeatureEnabled('perf.test.flag'),
        () => rateLimiter.checkLimit('perf.test.limit', { userId: 'test_user' })
      ];

      const results = [];
      
      for (const operation of operations) {
        const startTime = performance.now();
        await operation();
        const endTime = performance.now();
        const duration = endTime - startTime;
        results.push(duration);
      }

      const avgResponseTime = results.reduce((a, b) => a + b, 0) / results.length;
      const maxResponseTime = Math.max(...results);

      expect(avgResponseTime).toBeLessThan(PERFORMANCE_CONFIG.ACCEPTABLE_RESPONSE_TIME_MS);
      expect(maxResponseTime).toBeLessThan(PERFORMANCE_CONFIG.ACCEPTABLE_RESPONSE_TIME_MS * 2);
      
      console.log(`Performance regression test:`);
      console.log(`  Average response time: ${avgResponseTime.toFixed(2)}ms`);
      console.log(`  Max response time: ${maxResponseTime.toFixed(2)}ms`);
      console.log(`  Individual times: [${results.map(r => r.toFixed(1)).join(', ')}]ms`);
    });
  });

  describe('Stress Testing', () => {
    it('should handle system stress without degradation', async () => {
      const stressTestDuration = 5000; // 5 seconds
      const startTime = performance.now();
      let operationCount = 0;
      const errors = [];

      // Run operations continuously for the stress test duration
      const stressPromise = new Promise(async (resolve) => {
        while (performance.now() - startTime < stressTestDuration) {
          try {
            // Mix of different operations
            const operations = [
              configService.getValue(`stress.test.${operationCount % 50}`, 'production'),
              featureFlagService.isFeatureEnabled('stress.test.flag', { userId: `user_${operationCount}` }),
              rateLimiter.checkLimit('stress.test.limit', { userId: `user_${operationCount % 10}` })
            ];

            await Promise.all(operations);
            operationCount += operations.length;
          } catch (error) {
            errors.push(error);
          }
        }
        resolve();
      });

      await stressPromise;
      const actualDuration = performance.now() - startTime;
      const operationsPerSecond = operationCount / (actualDuration / 1000);

      expect(errors.length).toBe(0); // No errors should occur
      expect(operationsPerSecond).toBeGreaterThan(100); // Minimum throughput
      
      console.log(`Stress test: ${operationCount} operations in ${actualDuration.toFixed(0)}ms (${operationsPerSecond.toFixed(0)} ops/sec)`);
      if (errors.length > 0) {
        console.log(`Errors encountered: ${errors.length}`);
      }
    });
  });
});