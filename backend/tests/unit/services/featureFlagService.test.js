/**
 * Feature Flag Service Unit Tests
 * 
 * Comprehensive test suite for the FeatureFlagService class:
 * - Feature flag evaluation logic
 * - Targeting rule evaluation
 * - Performance and caching
 * - Circuit breaker functionality
 * - A/B testing scenarios
 */

const { FeatureFlagService, FeatureFlagEvaluationEngine } = require('../../../src/services/featureFlagService');

// Mock dependencies
const mockDb = {
  query: jest.fn(),
  queryOne: jest.fn(),
  execute: jest.fn()
};

const mockCache = {
  get: jest.fn(),
  setex: jest.fn(),
  del: jest.fn()
};

const mockAnalyticsService = {
  recordFeatureFlagEvaluation: jest.fn()
};

describe('FeatureFlagEvaluationEngine', () => {
  let engine;

  beforeEach(() => {
    engine = new FeatureFlagEvaluationEngine();
  });

  describe('user_attribute rules', () => {
    it('should evaluate equals operator correctly', () => {
      const rule = {
        type: 'user_attribute',
        attribute: 'country',
        operator: 'equals',
        value: 'US'
      };

      const context = { country: 'US' };
      expect(engine._evaluateRule(rule, context)).toBe(true);

      const context2 = { country: 'CA' };
      expect(engine._evaluateRule(rule, context2)).toBe(false);
    });

    it('should evaluate contains operator correctly', () => {
      const rule = {
        type: 'user_attribute',
        attribute: 'email',
        operator: 'contains',
        value: '@company.com'
      };

      const context = { email: 'user@company.com' };
      expect(engine._evaluateRule(rule, context)).toBe(true);

      const context2 = { email: 'user@other.com' };
      expect(engine._evaluateRule(rule, context2)).toBe(false);
    });

    it('should evaluate in operator correctly', () => {
      const rule = {
        type: 'user_attribute',
        attribute: 'role',
        operator: 'in',
        value: ['admin', 'moderator', 'editor']
      };

      const context = { role: 'admin' };
      expect(engine._evaluateRule(rule, context)).toBe(true);

      const context2 = { role: 'user' };
      expect(engine._evaluateRule(rule, context2)).toBe(false);
    });

    it('should evaluate regex operator correctly', () => {
      const rule = {
        type: 'user_attribute',
        attribute: 'username',
        operator: 'regex',
        value: '^admin_\\d+$'
      };

      const context = { username: 'admin_123' };
      expect(engine._evaluateRule(rule, context)).toBe(true);

      const context2 = { username: 'user_123' };
      expect(engine._evaluateRule(rule, context2)).toBe(false);
    });

    it('should evaluate numeric comparisons correctly', () => {
      const rule = {
        type: 'user_attribute',
        attribute: 'age',
        operator: 'greater_than',
        value: '18'
      };

      const context = { age: 25 };
      expect(engine._evaluateRule(rule, context)).toBe(true);

      const context2 = { age: 16 };
      expect(engine._evaluateRule(rule, context2)).toBe(false);
    });
  });

  describe('datetime rules', () => {
    it('should evaluate before operator correctly', () => {
      const rule = {
        type: 'datetime',
        operator: 'before',
        value: '2025-12-31T23:59:59Z'
      };

      expect(engine._evaluateRule(rule, {})).toBe(true);

      const rule2 = {
        type: 'datetime',
        operator: 'before',
        value: '2020-01-01T00:00:00Z'
      };

      expect(engine._evaluateRule(rule2, {})).toBe(false);
    });

    it('should evaluate day_of_week operator correctly', () => {
      const rule = {
        type: 'datetime',
        operator: 'day_of_week',
        value: new Date().getDay().toString()
      };

      expect(engine._evaluateRule(rule, {})).toBe(true);

      const rule2 = {
        type: 'datetime',
        operator: 'day_of_week',
        value: ((new Date().getDay() + 1) % 7).toString()
      };

      expect(engine._evaluateRule(rule2, {})).toBe(false);
    });

    it('should evaluate between operator correctly', () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      const rule = {
        type: 'datetime',
        operator: 'between',
        start_value: yesterday.toISOString(),
        end_value: tomorrow.toISOString()
      };

      expect(engine._evaluateRule(rule, {})).toBe(true);
    });
  });

  describe('geography rules', () => {
    it('should evaluate country targeting correctly', () => {
      const rule = {
        type: 'geography',
        operator: 'country_equals',
        value: 'US'
      };

      const context = { country: 'US' };
      expect(engine._evaluateRule(rule, context)).toBe(true);

      const context2 = { country: 'CA' };
      expect(engine._evaluateRule(rule, context2)).toBe(false);
    });

    it('should evaluate country list targeting correctly', () => {
      const rule = {
        type: 'geography',
        operator: 'country_in',
        value: ['US', 'CA', 'GB']
      };

      const context = { country: 'CA' };
      expect(engine._evaluateRule(rule, context)).toBe(true);

      const context2 = { country: 'FR' };
      expect(engine._evaluateRule(rule, context2)).toBe(false);
    });
  });

  describe('device rules', () => {
    it('should evaluate platform targeting correctly', () => {
      const rule = {
        type: 'device',
        operator: 'platform_equals',
        value: 'iOS'
      };

      const context = { platform: 'iOS' };
      expect(engine._evaluateRule(rule, context)).toBe(true);

      const context2 = { platform: 'Android' };
      expect(engine._evaluateRule(rule, context2)).toBe(false);
    });

    it('should evaluate device type targeting correctly', () => {
      const rule = {
        type: 'device',
        operator: 'mobile',
        value: null
      };

      const context = { deviceType: 'mobile' };
      expect(engine._evaluateRule(rule, context)).toBe(true);

      const context2 = { deviceType: 'desktop' };
      expect(engine._evaluateRule(rule, context2)).toBe(false);
    });

    it('should evaluate user agent contains correctly', () => {
      const rule = {
        type: 'device',
        operator: 'user_agent_contains',
        value: 'Chrome'
      };

      const context = { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' };
      expect(engine._evaluateRule(rule, context)).toBe(true);

      const context2 = { userAgent: 'Mozilla/5.0 (compatible; MSIE 9.0; Windows NT 6.1; Trident/5.0)' };
      expect(engine._evaluateRule(rule, context2)).toBe(false);
    });
  });

  describe('version rules', () => {
    it('should compare versions correctly', () => {
      const rule = {
        type: 'version',
        operator: 'version_greater',
        value: '1.2.0'
      };

      const context = { app_version: '1.3.0' };
      expect(engine._evaluateRule(rule, context)).toBe(true);

      const context2 = { app_version: '1.1.5' };
      expect(engine._evaluateRule(rule, context2)).toBe(false);

      const context3 = { app_version: '1.2.0' };
      expect(engine._evaluateRule(rule, context3)).toBe(false);
    });

    it('should handle version_greater_equal correctly', () => {
      const rule = {
        type: 'version',
        operator: 'version_greater_equal',
        value: '1.2.0'
      };

      const context = { app_version: '1.2.0' };
      expect(engine._evaluateRule(rule, context)).toBe(true);

      const context2 = { app_version: '1.2.1' };
      expect(engine._evaluateRule(rule, context2)).toBe(true);

      const context3 = { app_version: '1.1.9' };
      expect(engine._evaluateRule(rule, context3)).toBe(false);
    });

    it('should handle complex version numbers', () => {
      const rule = {
        type: 'version',
        operator: 'version_less',
        value: '2.0.0-beta.1'
      };

      const context = { app_version: '1.9.5' };
      expect(engine._evaluateRule(rule, context)).toBe(true);
    });
  });

  describe('percentage rules', () => {
    it('should distribute users consistently across percentages', () => {
      const rule = {
        type: 'percentage',
        operator: 'percentage_in',
        value: '50',
        feature_key: 'test_feature'
      };

      // Test same user multiple times - should be consistent
      const context = { userId: 'consistent_user' };
      const result1 = engine._evaluateRule(rule, context);
      const result2 = engine._evaluateRule(rule, context);
      const result3 = engine._evaluateRule(rule, context);

      expect(result1).toBe(result2);
      expect(result2).toBe(result3);
    });

    it('should approximate target percentage across many users', () => {
      const rule = {
        type: 'percentage',
        operator: 'percentage_in',
        value: '25',
        feature_key: 'test_feature'
      };

      let enabledCount = 0;
      const totalUsers = 1000;

      for (let i = 0; i < totalUsers; i++) {
        const context = { userId: `user_${i}` };
        if (engine._evaluateRule(rule, context)) {
          enabledCount++;
        }
      }

      const actualPercentage = (enabledCount / totalUsers) * 100;
      // Should be within 5% of target (25%)
      expect(actualPercentage).toBeGreaterThan(20);
      expect(actualPercentage).toBeLessThan(30);
    });
  });

  describe('rule combinations', () => {
    it('should handle AND combinator correctly', () => {
      const rules = [
        {
          type: 'user_attribute',
          attribute: 'country',
          operator: 'equals',
          value: 'US',
          combinator: 'AND'
        },
        {
          type: 'user_attribute',
          attribute: 'role',
          operator: 'equals',
          value: 'premium',
          combinator: 'AND'
        }
      ];

      const context1 = { country: 'US', role: 'premium' };
      expect(engine.evaluateRules(rules, context1)).toBe(true);

      const context2 = { country: 'US', role: 'basic' };
      expect(engine.evaluateRules(rules, context2)).toBe(false);

      const context3 = { country: 'CA', role: 'premium' };
      expect(engine.evaluateRules(rules, context3)).toBe(false);
    });

    it('should handle OR combinator correctly', () => {
      const rules = [
        {
          type: 'user_attribute',
          attribute: 'role',
          operator: 'equals',
          value: 'admin',
          combinator: 'OR'
        },
        {
          type: 'user_attribute',
          attribute: 'role',
          operator: 'equals',
          value: 'moderator',
          combinator: 'OR'
        }
      ];

      const context1 = { role: 'admin' };
      expect(engine.evaluateRules(rules, context1)).toBe(true);

      const context2 = { role: 'moderator' };
      expect(engine.evaluateRules(rules, context2)).toBe(true);

      const context3 = { role: 'user' };
      expect(engine.evaluateRules(rules, context3)).toBe(false);
    });

    it('should handle NOT combinator correctly', () => {
      const rules = [
        {
          type: 'user_attribute',
          attribute: 'role',
          operator: 'equals',
          value: 'banned',
          combinator: 'NOT'
        }
      ];

      const context1 = { role: 'user' };
      expect(engine.evaluateRules(rules, context1)).toBe(true);

      const context2 = { role: 'banned' };
      expect(engine.evaluateRules(rules, context2)).toBe(false);
    });
  });
});

describe('FeatureFlagService', () => {
  let service;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new FeatureFlagService(mockDb, mockCache, mockAnalyticsService);
  });

  describe('isFeatureEnabled', () => {
    it('should return false for non-existent feature', async () => {
      mockDb.queryOne.mockResolvedValue(null);

      const result = await service.isFeatureEnabled('nonexistent_feature');

      expect(result).toBe(false);
      expect(mockAnalyticsService.recordFeatureFlagEvaluation).toHaveBeenCalledWith(
        expect.objectContaining({
          feature_key: 'nonexistent_feature',
          enabled: false
        })
      );
    });

    it('should return false for globally disabled feature', async () => {
      const flag = {
        id: 'flag1',
        feature_key: 'test_feature',
        is_enabled: 0,
        cache_ttl_seconds: 60
      };

      mockDb.queryOne.mockResolvedValue(flag);

      const result = await service.isFeatureEnabled('test_feature');

      expect(result).toBe(false);
    });

    it('should return true for globally enabled feature with no targeting', async () => {
      const flag = {
        id: 'flag1',
        feature_key: 'test_feature',
        is_enabled: 1,
        cache_ttl_seconds: 60
      };

      mockDb.queryOne.mockResolvedValue(flag);

      const result = await service.isFeatureEnabled('test_feature');

      expect(result).toBe(true);
    });

    it('should respect environment targeting', async () => {
      const flag = {
        id: 'flag1',
        feature_key: 'test_feature',
        is_enabled: 1,
        enabled_environments: JSON.stringify(['production']),
        cache_ttl_seconds: 60
      };

      mockDb.queryOne.mockResolvedValue(flag);

      const result1 = await service.isFeatureEnabled('test_feature', {
        environment: 'production'
      });
      expect(result1).toBe(true);

      const result2 = await service.isFeatureEnabled('test_feature', {
        environment: 'development'
      });
      expect(result2).toBe(false);
    });

    it('should check user whitelist', async () => {
      const flag = {
        id: 'flag1',
        feature_key: 'test_feature',
        is_enabled: 1,
        enabled_for_users: JSON.stringify(['user123', 'user456']),
        cache_ttl_seconds: 60
      };

      mockDb.queryOne.mockResolvedValue(flag);

      const result1 = await service.isFeatureEnabled('test_feature', {
        userId: 'user123'
      });
      expect(result1).toBe(true);

      const result2 = await service.isFeatureEnabled('test_feature', {
        userId: 'user789'
      });
      expect(result2).toBe(false);
    });

    it('should check role targeting', async () => {
      const flag = {
        id: 'flag1',
        feature_key: 'test_feature',
        is_enabled: 1,
        enabled_for_roles: JSON.stringify(['admin', 'beta_tester']),
        cache_ttl_seconds: 60
      };

      mockDb.queryOne.mockResolvedValue(flag);

      const result1 = await service.isFeatureEnabled('test_feature', {
        userId: 'user123',
        userRoles: ['admin', 'user']
      });
      expect(result1).toBe(true);

      const result2 = await service.isFeatureEnabled('test_feature', {
        userId: 'user456',
        userRoles: ['user']
      });
      expect(result2).toBe(false);
    });

    it('should handle percentage rollout', async () => {
      const flag = {
        id: 'flag1',
        feature_key: 'test_feature',
        is_enabled: 1,
        rollout_percentage: 50,
        cache_ttl_seconds: 60
      };

      mockDb.queryOne.mockResolvedValue(flag);

      // Test consistency for same user
      const userId = 'consistent_user';
      const result1 = await service.isFeatureEnabled('test_feature', { userId });
      const result2 = await service.isFeatureEnabled('test_feature', { userId });

      expect(result1).toBe(result2);
    });

    it('should respect date range restrictions', async () => {
      const futureDate = new Date(Date.now() + 86400000); // Tomorrow
      const pastDate = new Date(Date.now() - 86400000); // Yesterday

      const flag = {
        id: 'flag1',
        feature_key: 'test_feature',
        is_enabled: 1,
        start_date: futureDate,
        cache_ttl_seconds: 60
      };

      mockDb.queryOne.mockResolvedValue(flag);

      const result = await service.isFeatureEnabled('test_feature');
      expect(result).toBe(false);

      // Test with past end date
      flag.start_date = null;
      flag.end_date = pastDate;

      const result2 = await service.isFeatureEnabled('test_feature');
      expect(result2).toBe(false);
    });

    it('should evaluate complex targeting rules', async () => {
      const flag = {
        id: 'flag1',
        feature_key: 'test_feature',
        is_enabled: 1,
        targeting_rules: JSON.stringify([
          {
            type: 'user_attribute',
            attribute: 'country',
            operator: 'equals',
            value: 'US'
          },
          {
            type: 'user_attribute',
            attribute: 'subscription_tier',
            operator: 'in',
            value: ['premium', 'enterprise']
          }
        ]),
        cache_ttl_seconds: 60
      };

      mockDb.queryOne.mockResolvedValue(flag);

      const result1 = await service.isFeatureEnabled('test_feature', {
        userId: 'user123',
        country: 'US',
        subscription_tier: 'premium'
      });
      expect(result1).toBe(true);

      const result2 = await service.isFeatureEnabled('test_feature', {
        userId: 'user456',
        country: 'CA',
        subscription_tier: 'premium'
      });
      expect(result2).toBe(false);
    });

    it('should use cache for subsequent evaluations', async () => {
      const flag = {
        id: 'flag1',
        feature_key: 'test_feature',
        is_enabled: 1,
        cache_ttl_seconds: 60
      };

      mockDb.queryOne.mockResolvedValue(flag);

      const context = { userId: 'user123' };

      // First evaluation
      await service.isFeatureEnabled('test_feature', context);

      // Second evaluation should use cache
      await service.isFeatureEnabled('test_feature', context);

      // Database should only be queried once
      expect(mockDb.queryOne).toHaveBeenCalledTimes(1);
    });

    it('should record evaluation metrics', async () => {
      const flag = {
        id: 'flag1',
        feature_key: 'test_feature',
        is_enabled: 1,
        cache_ttl_seconds: 60
      };

      mockDb.queryOne.mockResolvedValue(flag);
      mockDb.execute.mockResolvedValue();

      const context = {
        userId: 'user123',
        environment: 'production'
      };

      await service.isFeatureEnabled('test_feature', context);

      expect(mockAnalyticsService.recordFeatureFlagEvaluation).toHaveBeenCalledWith(
        expect.objectContaining({
          feature_key: 'test_feature',
          enabled: true,
          user_id: 'user123',
          environment: 'production',
          from_cache: false
        })
      );

      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE pf_feature_flags'),
        expect.arrayContaining(['flag1'])
      );
    });
  });

  describe('circuit breaker functionality', () => {
    it('should open circuit breaker after too many errors', async () => {
      mockDb.queryOne.mockRejectedValue(new Error('Database error'));

      // Simulate multiple errors to trigger circuit breaker
      for (let i = 0; i < 6; i++) {
        await service.isFeatureEnabled('test_feature');
      }

      // Circuit breaker should now be open
      expect(service._isCircuitBreakerOpen('test_feature')).toBe(true);

      // Next call should fail fast
      const result = await service.isFeatureEnabled('test_feature');
      expect(result).toBe(false);
    });

    it('should transition to half-open state after timeout', async () => {
      // Manually set circuit breaker to open state
      service.circuitBreakers.set('test_feature', {
        errors: 5,
        state: 'open',
        nextAttempt: Date.now() - 1000, // Past timeout
        threshold: 5,
        timeout: 60000
      });

      expect(service._isCircuitBreakerOpen('test_feature')).toBe(false);

      const breaker = service.circuitBreakers.get('test_feature');
      expect(breaker.state).toBe('half-open');
    });
  });

  describe('batch evaluation', () => {
    it('should evaluate multiple features efficiently', async () => {
      const flags = [
        {
          id: 'flag1',
          feature_key: 'feature1',
          is_enabled: 1,
          cache_ttl_seconds: 60
        },
        {
          id: 'flag2',
          feature_key: 'feature2',
          is_enabled: 0,
          cache_ttl_seconds: 60
        }
      ];

      mockDb.queryOne
        .mockResolvedValueOnce(flags[0])
        .mockResolvedValueOnce(flags[1]);

      const context = { userId: 'user123' };
      const results = await service.evaluateFeatures(['feature1', 'feature2'], context);

      expect(results).toEqual({
        feature1: true,
        feature2: false
      });
    });

    it('should handle batch evaluation errors gracefully', async () => {
      mockDb.queryOne
        .mockResolvedValueOnce({ id: 'flag1', feature_key: 'feature1', is_enabled: 1 })
        .mockRejectedValueOnce(new Error('Database error'));

      const results = await service.evaluateFeatures(['feature1', 'feature2'], {});

      expect(results).toEqual({
        feature1: true,
        feature2: false // Should default to false on error
      });
    });
  });

  describe('feature flag CRUD operations', () => {
    it('should create feature flag successfully', async () => {
      mockDb.execute.mockResolvedValue({ rowsAffected: 1 });

      const flagData = {
        feature_key: 'new_feature',
        feature_name: 'New Feature',
        description: 'A new feature for testing',
        feature_category: 'experimental',
        created_by: 'user123'
      };

      const result = await service.createFeatureFlag(flagData);

      expect(result).toEqual({
        id: expect.any(String),
        feature_key: 'new_feature'
      });

      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO pf_feature_flags'),
        expect.arrayContaining(['new_feature', 'New Feature'])
      );
    });

    it('should update feature flag successfully', async () => {
      const existingFlag = {
        id: 'flag1',
        feature_key: 'test_feature'
      };

      mockDb.queryOne.mockResolvedValue(existingFlag);
      mockDb.execute.mockResolvedValue({ rowsAffected: 1 });

      const updates = {
        is_enabled: true,
        rollout_percentage: 50,
        description: 'Updated description'
      };

      const result = await service.updateFeatureFlag('test_feature', updates, 'user123');

      expect(result).toEqual({ success: true });

      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE pf_feature_flags'),
        expect.arrayContaining([1, 50, 'Updated description', 'user123', 'test_feature'])
      );
    });

    it('should delete feature flag successfully', async () => {
      mockDb.execute.mockResolvedValue({ rowsAffected: 1 });

      const result = await service.deleteFeatureFlag('test_feature', 'user123');

      expect(result).toEqual({ success: true });

      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE pf_feature_flags SET is_active = 0'),
        ['user123', 'test_feature']
      );
    });
  });

  describe('error handling', () => {
    it('should return false on database errors', async () => {
      mockDb.queryOne.mockRejectedValue(new Error('Database connection failed'));

      const result = await service.isFeatureEnabled('test_feature');

      expect(result).toBe(false);
    });

    it('should handle cache errors gracefully', async () => {
      mockCache.get.mockRejectedValue(new Error('Cache error'));

      const flag = {
        id: 'flag1',
        feature_key: 'test_feature',
        is_enabled: 1,
        cache_ttl_seconds: 60
      };

      mockDb.queryOne.mockResolvedValue(flag);

      // Should still work despite cache error
      const result = await service.isFeatureEnabled('test_feature');
      expect(result).toBe(true);
    });

    it('should handle malformed targeting rules gracefully', async () => {
      const flag = {
        id: 'flag1',
        feature_key: 'test_feature',
        is_enabled: 1,
        targeting_rules: 'invalid json',
        cache_ttl_seconds: 60
      };

      mockDb.queryOne.mockResolvedValue(flag);

      // Should not throw error, should default to enabled
      const result = await service.isFeatureEnabled('test_feature');
      expect(result).toBe(true);
    });
  });
});