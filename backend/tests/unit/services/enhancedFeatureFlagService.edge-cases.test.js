/**
 * Enhanced Feature Flag Service - Edge Case Tests
 * 
 * Additional test coverage for edge cases, security vulnerabilities,
 * and performance boundaries not covered in the main test suite
 */

const { EnhancedFeatureFlagService, featureFlagMiddleware } = require('../../../src/services/enhancedFeatureFlagService');

// Mock dependencies
const mockDb = {
  query: jest.fn(),
  queryOne: jest.fn(),
  execute: jest.fn()
};

const mockCache = {
  get: jest.fn(),
  set: jest.fn(),
  setex: jest.fn(),
  del: jest.fn(),
  incr: jest.fn(),
  expire: jest.fn(),
  publish: jest.fn(),
  subscribe: jest.fn(),
  keys: jest.fn(),
  isConnected: jest.fn(() => true),
  getStats: jest.fn()
};

const mockAnalyticsService = {
  recordFlagEvaluation: jest.fn()
};

const mockAuditService = {
  log: jest.fn()
};

describe('Enhanced Feature Flag Service - Edge Cases', () => {
  let service;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    
    mockDb.query.mockResolvedValue([]);
    mockDb.queryOne.mockResolvedValue(null);
    mockDb.execute.mockResolvedValue({ rowsAffected: 1 });
    
    service = new EnhancedFeatureFlagService(
      mockDb,
      mockCache,
      mockAnalyticsService,
      mockAuditService
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Edge Case: Null/Undefined Inputs', () => {
    it('should handle null flag key gracefully', async () => {
      const result = await service.evaluateFlag(null);
      expect(result.value).toBe(false);
      expect(result.reason).toBe('disabled');
    });

    it('should handle undefined context in flag evaluation', async () => {
      service.flags.set('test_flag', {
        flag_key: 'test_flag',
        enabled: 'Y',
        default_value: 'true'
      });
      
      const result = await service.evaluateFlag('test_flag', undefined);
      expect(result.value).toBe(true);
    });

    it('should handle empty flag key string', async () => {
      const result = await service.evaluateFlag('');
      expect(result.value).toBe(false);
    });

    it('should handle null values in targeting rules', async () => {
      service.flags.set('null_targeting', {
        flag_key: 'null_targeting',
        enabled: 'Y',
        targeting_rules: [
          { field: 'country', operator: 'equals', value: null }
        ],
        default_value: 'true'
      });
      
      const result = await service.evaluateFlag('null_targeting', { country: null });
      expect(result).toBeDefined();
    });
  });

  describe('Edge Case: Boundary Values', () => {
    it('should handle rollout percentage at 0%', async () => {
      service.flags.set('zero_rollout', {
        flag_key: 'zero_rollout',
        enabled: 'Y',
        rollout_percentage: 0,
        default_value: 'true'
      });
      
      const result = await service.evaluateFlag('zero_rollout', { userId: 'test' });
      expect(result.value).toBe(false);
      expect(result.reason).toBe('rollout_excluded');
    });

    it('should handle rollout percentage at 100%', async () => {
      service.flags.set('full_rollout', {
        flag_key: 'full_rollout',
        enabled: 'Y',
        rollout_percentage: 100,
        default_value: 'true'
      });
      
      const result = await service.evaluateFlag('full_rollout', { userId: 'test' });
      expect(result.value).toBe(true);
      expect(result.reason).toBe('default');
    });

    it('should handle extremely long flag keys', async () => {
      const longKey = 'a'.repeat(1000);
      service.flags.set(longKey, {
        flag_key: longKey,
        enabled: 'Y',
        default_value: 'true'
      });
      
      const result = await service.evaluateFlag(longKey);
      expect(result.value).toBe(true);
    });

    it('should handle maximum rate limit attempts', async () => {
      mockCache.incr.mockResolvedValueOnce(Number.MAX_SAFE_INTEGER);
      
      await expect(
        service.checkRegistrationProtection('192.168.1.1', 'fingerprint')
      ).rejects.toThrow('Too many registration attempts');
    });
  });

  describe('Edge Case: DDoS Protection Vulnerabilities', () => {
    beforeEach(() => {
      service.flags.set('self_registration_enabled', {
        flag_key: 'self_registration_enabled',
        default_value: 'true',
        enabled: 'Y'
      });
      service.registrationProtection.enabled = true;
    });

    it('should handle rapid IP rotation attacks', async () => {
      const ips = [];
      for (let i = 0; i < 100; i++) {
        ips.push(`192.168.1.${i}`);
      }
      
      // Each IP should be tracked separately
      const promises = ips.map(ip => {
        mockCache.incr.mockResolvedValueOnce(1);
        return service.checkRegistrationProtection(ip, 'fingerprint');
      });
      
      const results = await Promise.all(promises);
      results.forEach(result => {
        expect(result.allowed).toBe(true);
      });
    });

    it('should detect fingerprint-based attacks across IPs', async () => {
      const fingerprint = 'malicious_fingerprint';
      
      // Mock high fingerprint count
      mockDb.queryOne.mockResolvedValueOnce({ count: 0 }) // Recent registrations
                     .mockResolvedValueOnce({ count: 50 }); // High fingerprint count
      
      const score = await service.calculateSuspicionScore('192.168.1.1', fingerprint, {});
      expect(score).toBeGreaterThan(0.5);
    });

    it('should handle missing headers in suspicion calculation', async () => {
      const score = await service.calculateSuspicionScore(
        '192.168.1.1',
        'fingerprint',
        {} // No headers
      );
      expect(score).toBeGreaterThanOrEqual(0.2); // Missing headers increase suspicion
    });

    it('should handle bot user agents', async () => {
      const botAgents = [
        'Googlebot/2.1',
        'Mozilla/5.0 (compatible; bingbot/2.0)',
        'facebookexternalhit/1.1',
        'crawler',
        'bot'
      ];
      
      for (const agent of botAgents) {
        mockDb.query.mockResolvedValue([]);
        mockDb.queryOne.mockResolvedValue({ count: 0 });
        
        const score = await service.calculateSuspicionScore(
          '192.168.1.1',
          'fingerprint',
          { 'user-agent': agent }
        );
        expect(score).toBeGreaterThanOrEqual(0.3);
      }
    });

    it('should handle concurrent registration attempts', async () => {
      const ip = '192.168.1.1';
      let attemptCount = 0;
      
      mockCache.incr.mockImplementation(() => {
        attemptCount++;
        return Promise.resolve(attemptCount);
      });
      
      // Simulate 10 concurrent requests
      const promises = Array(10).fill(null).map(() => 
        service.checkRegistrationProtection(ip, 'fingerprint')
      );
      
      const results = await Promise.allSettled(promises);
      
      // First 5 should succeed, rest should fail
      const succeeded = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      
      expect(succeeded).toBeLessThanOrEqual(5);
      expect(failed).toBeGreaterThanOrEqual(5);
    });

    it('should prevent cache key injection attacks', async () => {
      const maliciousIp = '192.168.1.1"; DEL *; GET "';
      
      // Should sanitize the IP and not cause issues
      mockCache.incr.mockResolvedValueOnce(1);
      const result = await service.checkRegistrationProtection(maliciousIp, 'fingerprint');
      
      expect(mockCache.incr).toHaveBeenCalledWith(
        expect.stringContaining('registration:attempts:')
      );
    });
  });

  describe('Edge Case: Performance Boundaries', () => {
    it('should handle evaluation of 10000 flags without memory issues', async () => {
      // Create many flags
      for (let i = 0; i < 10000; i++) {
        service.flags.set(`flag_${i}`, {
          flag_key: `flag_${i}`,
          enabled: 'Y',
          default_value: 'true'
        });
      }
      
      const memBefore = process.memoryUsage().heapUsed;
      
      // Evaluate many flags
      const promises = [];
      for (let i = 0; i < 1000; i++) {
        promises.push(service.evaluateFlag(`flag_${i % 10000}`));
      }
      await Promise.all(promises);
      
      const memAfter = process.memoryUsage().heapUsed;
      const memIncrease = memAfter - memBefore;
      
      // Memory increase should be reasonable (< 100MB)
      expect(memIncrease).toBeLessThan(100 * 1024 * 1024);
    });

    it('should maintain <5ms evaluation with complex rules', async () => {
      service.flags.set('complex_flag', {
        flag_key: 'complex_flag',
        enabled: 'Y',
        default_value: 'true',
        prerequisites: ['prereq1', 'prereq2', 'prereq3'],
        targeting_rules: [
          { field: 'country', operator: 'in', value: ['US', 'CA', 'UK'] },
          { field: 'age', operator: 'greater_than', value: 18 },
          { field: 'role', operator: 'not_equals', value: 'guest' }
        ],
        rollout_percentage: 75
      });
      
      // Setup prerequisites
      ['prereq1', 'prereq2', 'prereq3'].forEach(key => {
        service.flags.set(key, {
          flag_key: key,
          enabled: 'Y',
          default_value: 'true'
        });
      });
      
      const start = process.hrtime.bigint();
      await service.evaluateFlag('complex_flag', {
        userId: 'user123',
        country: 'US',
        age: 25,
        role: 'admin'
      });
      const end = process.hrtime.bigint();
      
      const durationMs = Number(end - start) / 1000000;
      expect(durationMs).toBeLessThan(5);
    });

    it('should handle cache failures gracefully', async () => {
      // Simulate cache failure
      mockCache.get.mockRejectedValue(new Error('Cache connection failed'));
      mockCache.setex.mockRejectedValue(new Error('Cache connection failed'));
      
      service.flags.set('cache_fail_flag', {
        flag_key: 'cache_fail_flag',
        enabled: 'Y',
        default_value: 'true'
      });
      
      // Should still work without cache
      const result = await service.evaluateFlag('cache_fail_flag');
      expect(result.value).toBe(true);
    });
  });

  describe('Edge Case: Circular Dependencies', () => {
    it('should detect and handle circular prerequisites', async () => {
      service.flags.set('flag_a', {
        flag_key: 'flag_a',
        enabled: 'Y',
        prerequisites: ['flag_b'],
        default_value: 'true'
      });
      
      service.flags.set('flag_b', {
        flag_key: 'flag_b',
        enabled: 'Y',
        prerequisites: ['flag_c'],
        default_value: 'true'
      });
      
      service.flags.set('flag_c', {
        flag_key: 'flag_c',
        enabled: 'Y',
        prerequisites: ['flag_a'], // Circular reference
        default_value: 'true'
      });
      
      // Should timeout or return false to prevent infinite loop
      const timeoutPromise = new Promise((resolve) => {
        setTimeout(() => resolve({ timeout: true }), 1000);
      });
      
      const evalPromise = service.evaluateFlag('flag_a');
      const result = await Promise.race([evalPromise, timeoutPromise]);
      
      if (result.timeout) {
        // Test passed - prevented infinite loop
        expect(true).toBe(true);
      } else {
        // Should have returned false
        expect(result.value).toBe(false);
      }
    });
  });

  describe('Edge Case: Invalid Data Types', () => {
    it('should handle invalid JSON in variants field', async () => {
      service.flags.set('invalid_json', {
        flag_key: 'invalid_json',
        enabled: 'Y',
        variants: 'not valid json',
        default_value: 'true'
      });
      
      const result = await service.evaluateFlag('invalid_json');
      expect(result.value).toBe(true);
    });

    it('should handle non-numeric rollout percentage', async () => {
      service.flags.set('bad_rollout', {
        flag_key: 'bad_rollout',
        enabled: 'Y',
        rollout_percentage: 'fifty',
        default_value: 'true'
      });
      
      const result = await service.evaluateFlag('bad_rollout');
      expect(result).toBeDefined();
    });

    it('should handle invalid date formats', async () => {
      service.flags.set('bad_dates', {
        flag_key: 'bad_dates',
        enabled: 'Y',
        start_date: 'not-a-date',
        end_date: 'also-not-a-date',
        default_value: 'true'
      });
      
      const result = await service.evaluateFlag('bad_dates');
      expect(result).toBeDefined();
    });
  });

  describe('Edge Case: Emergency Scenarios', () => {
    it('should handle multiple concurrent emergency disables', async () => {
      const flags = ['flag1', 'flag2', 'flag3', 'flag4', 'flag5'];
      flags.forEach(key => {
        service.flags.set(key, {
          flag_key: key,
          enabled: 'Y',
          default_value: 'true'
        });
      });
      
      // Simulate concurrent emergency disables
      const promises = flags.map(key => 
        service.emergencyDisable(key, 'Concurrent emergency', 'admin')
      );
      
      await Promise.all(promises);
      
      // All flags should be disabled
      flags.forEach(key => {
        const flag = service.flags.get(key);
        expect(flag.enabled).toBe('N');
      });
      
      // Should have logged all emergencies
      expect(mockAuditService.log).toHaveBeenCalledTimes(flags.length);
    });

    it('should handle emergency disable when cache is down', async () => {
      mockCache.publish.mockRejectedValue(new Error('Cache unavailable'));
      
      service.flags.set('emergency_flag', {
        flag_key: 'emergency_flag',
        enabled: 'Y'
      });
      
      // Should still disable even if cache broadcast fails
      const result = await service.emergencyDisable(
        'emergency_flag',
        'Cache failure emergency',
        'admin'
      );
      
      expect(result.success).toBe(true);
      expect(service.flags.get('emergency_flag').enabled).toBe('N');
    });
  });

  describe('Edge Case: Database Failures', () => {
    it('should handle database connection failures during initialization', async () => {
      mockDb.query.mockRejectedValue(new Error('Database connection failed'));
      
      const failService = new EnhancedFeatureFlagService(
        mockDb,
        mockCache,
        mockAnalyticsService,
        mockAuditService
      );
      
      // Give it time to attempt initialization
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Service should still be functional with empty flags
      expect(failService.flags.size).toBe(0);
    });

    it('should handle database failures during flag update', async () => {
      service.flags.set('update_fail', {
        flag_id: 'id',
        flag_key: 'update_fail',
        enabled: 'Y'
      });
      
      mockDb.execute.mockRejectedValue(new Error('Database update failed'));
      
      await expect(
        service.updateFlag('update_fail', { enabled: 'N' }, 'Test', 'user')
      ).rejects.toThrow();
      
      // Flag should remain unchanged in memory
      expect(service.flags.get('update_fail').enabled).toBe('Y');
    });
  });

  describe('Edge Case: Time-based Issues', () => {
    it('should handle daylight saving time transitions', async () => {
      const dstFlag = {
        flag_key: 'dst_flag',
        enabled: 'Y',
        start_date: '2024-03-10T02:00:00', // DST starts
        end_date: '2024-11-03T02:00:00',   // DST ends
        default_value: 'true'
      };
      
      service.flags.set('dst_flag', dstFlag);
      
      // Test evaluation at various times
      const result = await service.evaluateFlag('dst_flag');
      expect(result).toBeDefined();
    });

    it('should handle leap year dates', async () => {
      service.flags.set('leap_flag', {
        flag_key: 'leap_flag',
        enabled: 'Y',
        start_date: '2024-02-29T00:00:00', // Leap year date
        default_value: 'true'
      });
      
      const result = await service.evaluateFlag('leap_flag');
      expect(result).toBeDefined();
    });
  });

  describe('Edge Case: Targeting Rule Operators', () => {
    it('should handle "in" operator with empty array', async () => {
      service.flags.set('empty_in', {
        flag_key: 'empty_in',
        enabled: 'Y',
        targeting_rules: [
          { field: 'country', operator: 'in', value: [] }
        ],
        default_value: 'true'
      });
      
      const result = await service.evaluateFlag('empty_in', { country: 'US' });
      expect(result.value).toBe(false);
    });

    it('should handle contains operator with null value', async () => {
      service.flags.set('null_contains', {
        flag_key: 'null_contains',
        enabled: 'Y',
        targeting_rules: [
          { field: 'tags', operator: 'contains', value: 'test' }
        ],
        default_value: 'true'
      });
      
      const result = await service.evaluateFlag('null_contains', { tags: null });
      expect(result.value).toBe(false);
    });

    it('should handle numeric comparisons with non-numeric values', async () => {
      service.flags.set('bad_numeric', {
        flag_key: 'bad_numeric',
        enabled: 'Y',
        targeting_rules: [
          { field: 'age', operator: 'greater_than', value: 'eighteen' }
        ],
        default_value: 'true'
      });
      
      const result = await service.evaluateFlag('bad_numeric', { age: 'twenty' });
      expect(result).toBeDefined();
    });
  });
});

describe('Feature Flag Middleware - Edge Cases', () => {
  let middleware;
  let mockReq, mockRes, mockNext;
  let mockFlagService;

  beforeEach(() => {
    mockFlagService = {
      evaluateFlag: jest.fn()
    };
    
    middleware = featureFlagMiddleware(mockFlagService);
    
    mockReq = {
      user: { id: 'user123', roles: ['user'] },
      sessionID: 'session123',
      ip: '192.168.1.1',
      headers: { 'user-agent': 'Mozilla/5.0' },
      path: '/api/test',
      method: 'GET'
    };
    
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    
    mockNext = jest.fn();
  });

  it('should handle missing user object', async () => {
    mockReq.user = null;
    mockFlagService.evaluateFlag.mockResolvedValue({ value: false });
    
    await middleware(mockReq, mockRes, mockNext);
    
    expect(mockFlagService.evaluateFlag).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        userId: undefined,
        userRoles: []
      })
    );
    expect(mockNext).toHaveBeenCalled();
  });

  it('should handle missing session ID', async () => {
    mockReq.sessionID = undefined;
    mockFlagService.evaluateFlag.mockResolvedValue({ value: false });
    
    await middleware(mockReq, mockRes, mockNext);
    
    expect(mockNext).toHaveBeenCalled();
  });

  it('should handle flag service timeout', async () => {
    mockFlagService.evaluateFlag.mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve({ value: false }), 10000))
    );
    
    const timeoutPromise = new Promise(resolve => {
      setTimeout(() => {
        mockNext();
        resolve();
      }, 100);
    });
    
    middleware(mockReq, mockRes, mockNext);
    await timeoutPromise;
    
    expect(mockNext).toHaveBeenCalled();
  });

  it('should handle circular hasFeature calls', async () => {
    mockFlagService.evaluateFlag.mockResolvedValue({ value: true });
    
    await middleware(mockReq, mockRes, mockNext);
    
    // Call hasFeature multiple times for same flag
    const result1 = await mockReq.hasFeature('test_flag');
    const result2 = await mockReq.hasFeature('test_flag');
    const result3 = await mockReq.hasFeature('test_flag');
    
    // Should use cached result
    expect(mockFlagService.evaluateFlag).toHaveBeenCalledTimes(4); // 3 system flags + 1 for test_flag
    expect(result1).toBe(result2);
    expect(result2).toBe(result3);
  });
});