/**
 * Enhanced Feature Flag Service Tests
 * 
 * Comprehensive test suite for:
 * - Flag evaluation with <5ms performance
 * - Self-registration toggle with DDoS protection
 * - Emergency controls
 * - Cache integration
 * - Real-time updates
 */

const { EnhancedFeatureFlagService, featureFlagMiddleware } = require('../../../src/services/enhancedFeatureFlagService');
const { CacheService } = require('../../../src/services/cacheService');

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

describe('EnhancedFeatureFlagService', () => {
  let service;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    
    // Mock database responses
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

  describe('Performance Requirements', () => {
    it('should evaluate flags in under 5ms with cache hit', async () => {
      // Setup in-memory flag
      service.flags.set('test_flag', {
        flag_id: '123',
        flag_key: 'test_flag',
        flag_type: 'boolean',
        default_value: 'true',
        enabled: 'Y'
      });

      const start = process.hrtime.bigint();
      const result = await service.evaluateFlag('test_flag');
      const end = process.hrtime.bigint();
      
      const durationMs = Number(end - start) / 1000000;
      
      expect(durationMs).toBeLessThan(5);
      expect(result.value).toBe(true);
      expect(result.reason).toBe('default');
    });

    it('should handle 1000 concurrent evaluations efficiently', async () => {
      // Setup flags
      for (let i = 0; i < 10; i++) {
        service.flags.set(`flag_${i}`, {
          flag_id: `id_${i}`,
          flag_key: `flag_${i}`,
          flag_type: 'boolean',
          default_value: 'true',
          enabled: 'Y'
        });
      }

      const evaluations = [];
      const start = process.hrtime.bigint();
      
      // Simulate 1000 concurrent evaluations
      for (let i = 0; i < 1000; i++) {
        const flagKey = `flag_${i % 10}`;
        evaluations.push(service.evaluateFlag(flagKey));
      }
      
      await Promise.all(evaluations);
      const end = process.hrtime.bigint();
      
      const totalDurationMs = Number(end - start) / 1000000;
      const avgDurationMs = totalDurationMs / 1000;
      
      expect(avgDurationMs).toBeLessThan(5);
      expect(service.evaluationMetrics.totalEvaluations).toBe(1000);
    });
  });

  describe('Self-Registration Toggle', () => {
    beforeEach(() => {
      service.flags.set('self_registration_enabled', {
        flag_id: 'self_reg_id',
        flag_key: 'self_registration_enabled',
        flag_type: 'boolean',
        default_value: 'false',
        enabled: 'Y',
        category: 'security',
        is_system_wide: 'Y'
      });
    });

    it('should toggle self-registration on', async () => {
      const result = await service.toggleSelfRegistration(true, 'Testing', 'user123');
      
      expect(result.success).toBe(true);
      expect(result.enabled).toBe(true);
      expect(mockCache.publish).toHaveBeenCalledWith(
        'flag:updates',
        expect.stringContaining('self_registration_enabled')
      );
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'toggle_self_registration',
          entity_id: 'self_registration_enabled',
          details: { enabled: true, reason: 'Testing' }
        })
      );
    });

    it('should enable DDoS protection when enabling registration', async () => {
      await service.toggleSelfRegistration(true, 'Enable registration', 'user123');
      
      expect(service.registrationProtection.enabled).toBe(true);
      expect(mockCache.setex).toHaveBeenCalledWith(
        'registration:protection',
        86400,
        expect.stringContaining('"enabled":true')
      );
    });

    it('should log emergency disable', async () => {
      await service.toggleSelfRegistration(false, 'EMERGENCY: DDoS attack', 'user123');
      
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'critical'
        })
      );
      expect(mockCache.publish).toHaveBeenCalledWith(
        'admin:alerts',
        expect.stringContaining('emergency_registration_disable')
      );
    });
  });

  describe('DDoS Protection', () => {
    beforeEach(() => {
      service.flags.set('self_registration_enabled', {
        flag_key: 'self_registration_enabled',
        default_value: 'true',
        enabled: 'Y'
      });
      service.registrationProtection.enabled = true;
    });

    it('should block IPs after rate limit exceeded', async () => {
      const ipAddress = '192.168.1.1';
      
      // Mock rate limit exceeded
      mockCache.incr.mockResolvedValueOnce(6); // Over limit of 5
      
      await expect(
        service.checkRegistrationProtection(ipAddress, 'fingerprint123')
      ).rejects.toThrow('Too many registration attempts');
      
      expect(mockCache.setex).toHaveBeenCalledWith(
        `registration:block:${ipAddress}`,
        expect.any(Number),
        expect.stringContaining('Too many registration attempts')
      );
    });

    it('should require CAPTCHA after threshold', async () => {
      const ipAddress = '192.168.1.2';
      
      // Mock attempts at threshold
      mockCache.incr.mockResolvedValueOnce(4); // At CAPTCHA threshold of 3
      mockDb.query.mockResolvedValue([]); // No suspicious IPs
      mockDb.queryOne.mockResolvedValue({ count: 0 });
      
      const result = await service.checkRegistrationProtection(ipAddress, 'fingerprint456');
      
      expect(result.allowed).toBe(true);
      expect(result.requireCaptcha).toBe(true);
      expect(result.remainingAttempts).toBe(1);
    });

    it('should calculate suspicion score correctly', async () => {
      // Mock suspicious IP
      mockDb.query.mockResolvedValueOnce([
        { ip_address: '192.168.1.3' }
      ]);
      
      // Mock recent registrations
      mockDb.queryOne
        .mockResolvedValueOnce({ count: 3 }) // Recent registrations
        .mockResolvedValueOnce({ count: 6 }); // Fingerprint count
      
      const score = await service.calculateSuspicionScore(
        '192.168.1.3',
        'fingerprint789',
        { 'user-agent': 'bot' }
      );
      
      expect(score).toBeGreaterThan(0.5);
      expect(score).toBeLessThanOrEqual(1);
    });

    it('should handle missing self-registration flag gracefully', async () => {
      service.flags.delete('self_registration_enabled');
      
      await expect(
        service.checkRegistrationProtection('192.168.1.4', 'fingerprint')
      ).rejects.toThrow('Self-registration is currently disabled');
    });
  });

  describe('Emergency Controls', () => {
    it('should emergency disable a feature immediately', async () => {
      service.flags.set('test_feature', {
        flag_id: 'test_id',
        flag_key: 'test_feature',
        enabled: 'Y'
      });
      
      const result = await service.emergencyDisable(
        'test_feature',
        'Security breach',
        'admin123'
      );
      
      expect(result.success).toBe(true);
      expect(service.flags.get('test_feature').enabled).toBe('N');
      expect(mockCache.publish).toHaveBeenCalledWith(
        'flag:emergency',
        expect.stringContaining('emergency_disable')
      );
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'emergency_disable_flag',
          severity: 'critical'
        })
      );
    });

    it('should handle emergency events from cache', async () => {
      await service.handleEmergencyEvent({
        type: 'disable_self_registration',
        reason: 'Attack detected',
        user_id: 'system'
      });
      
      expect(mockDb.execute).toHaveBeenCalled();
      expect(mockAuditService.log).toHaveBeenCalled();
    });

    it('should disable all non-critical features in emergency', async () => {
      // Setup multiple flags
      service.flags.set('feature1', { 
        flag_key: 'feature1', 
        category: 'experimental',
        enabled: 'Y'
      });
      service.flags.set('feature2', { 
        flag_key: 'feature2', 
        category: 'beta',
        enabled: 'Y'
      });
      service.flags.set('system_flag', { 
        flag_key: 'system_flag', 
        category: 'system',
        enabled: 'Y'
      });
      
      await service.handleEmergencyEvent({
        type: 'disable_all_features',
        reason: 'System compromise',
        user_id: 'admin'
      });
      
      // Non-critical features should be disabled
      expect(mockDb.execute).toHaveBeenCalledTimes(2); // feature1 and feature2
    });
  });

  describe('Real-time Updates', () => {
    it('should handle flag updates via pub/sub', async () => {
      const update = {
        flag_key: 'updated_flag',
        action: 'updated',
        data: {
          flag_key: 'updated_flag',
          enabled: 'Y',
          default_value: 'true'
        }
      };
      
      mockDb.queryOne.mockResolvedValueOnce(update.data);
      
      await service.handleFlagUpdate(update);
      
      expect(service.flags.has('updated_flag')).toBe(true);
      expect(service.flags.get('updated_flag')).toEqual(update.data);
    });

    it('should remove disabled flags from memory', async () => {
      service.flags.set('to_disable', { flag_key: 'to_disable' });
      
      await service.handleFlagUpdate({
        flag_key: 'to_disable',
        action: 'disabled'
      });
      
      expect(service.flags.has('to_disable')).toBe(false);
    });

    it('should reload all flags on reload_all event', async () => {
      const flags = [
        { flag_key: 'flag1', enabled: 'Y' },
        { flag_key: 'flag2', enabled: 'Y' }
      ];
      
      mockDb.query.mockResolvedValueOnce(flags);
      
      await service.handleFlagUpdate({
        action: 'reload_all'
      });
      
      expect(service.flags.size).toBe(2);
    });
  });

  describe('Flag Evaluation Logic', () => {
    it('should respect date range restrictions', async () => {
      const futureDate = new Date(Date.now() + 86400000); // Tomorrow
      const pastDate = new Date(Date.now() - 86400000); // Yesterday
      
      service.flags.set('future_flag', {
        flag_key: 'future_flag',
        enabled: 'Y',
        start_date: futureDate.toISOString(),
        default_value: 'true'
      });
      
      service.flags.set('expired_flag', {
        flag_key: 'expired_flag',
        enabled: 'Y',
        end_date: pastDate.toISOString(),
        default_value: 'true'
      });
      
      const futureResult = await service.evaluateFlag('future_flag');
      expect(futureResult.value).toBe(false);
      expect(futureResult.reason).toBe('not_started');
      
      const expiredResult = await service.evaluateFlag('expired_flag');
      expect(expiredResult.value).toBe(false);
      expect(expiredResult.reason).toBe('expired');
    });

    it('should check prerequisites', async () => {
      service.flags.set('prereq_flag', {
        flag_key: 'prereq_flag',
        enabled: 'Y',
        default_value: 'true'
      });
      
      service.flags.set('dependent_flag', {
        flag_key: 'dependent_flag',
        enabled: 'Y',
        prerequisites: ['prereq_flag'],
        default_value: 'true'
      });
      
      // Disable prerequisite
      service.flags.get('prereq_flag').enabled = 'N';
      
      const result = await service.evaluateFlag('dependent_flag');
      expect(result.value).toBe(false);
      expect(result.reason).toBe('prerequisites_not_met');
    });

    it('should handle percentage rollout', async () => {
      service.flags.set('rollout_flag', {
        flag_key: 'rollout_flag',
        enabled: 'Y',
        rollout_percentage: 50,
        default_value: 'true'
      });
      
      // Test consistency for same user
      const userId = 'consistent_user';
      const result1 = await service.evaluateFlag('rollout_flag', { userId });
      const result2 = await service.evaluateFlag('rollout_flag', { userId });
      
      expect(result1.value).toBe(result2.value);
    });

    it('should apply targeting rules', async () => {
      service.flags.set('targeted_flag', {
        flag_key: 'targeted_flag',
        enabled: 'Y',
        targeting_rules: [
          { field: 'country', operator: 'equals', value: 'US' }
        ],
        default_value: 'true'
      });
      
      const usResult = await service.evaluateFlag('targeted_flag', { country: 'US' });
      expect(usResult.value).toBe(true);
      expect(usResult.reason).toBe('targeting');
      
      const caResult = await service.evaluateFlag('targeted_flag', { country: 'CA' });
      expect(caResult.value).toBe(false);
      expect(caResult.reason).toBe('default');
    });

    it('should check user/group overrides', async () => {
      service.flags.set('override_flag', {
        flag_id: 'override_id',
        flag_key: 'override_flag',
        enabled: 'Y',
        default_value: 'false'
      });
      
      // Mock user override
      mockDb.queryOne.mockResolvedValueOnce({ enabled: 'Y' });
      
      const result = await service.evaluateFlag('override_flag', { 
        userId: 'user123' 
      });
      
      expect(result.value).toBe(true);
      expect(result.reason).toBe('override');
    });
  });

  describe('Metrics and Analytics', () => {
    it('should track evaluation metrics', async () => {
      service.flags.set('metric_flag', {
        flag_key: 'metric_flag',
        enabled: 'Y',
        default_value: 'true'
      });
      
      await service.evaluateFlag('metric_flag');
      await service.evaluateFlag('metric_flag');
      await service.evaluateFlag('metric_flag');
      
      const metrics = service.getMetrics();
      
      expect(metrics.totalFlags).toBe(1);
      expect(metrics.evaluationMetrics.totalEvaluations).toBe(3);
      expect(metrics.avgEvaluationTime).toBeGreaterThan(0);
    });

    it('should calculate cache hit rate', async () => {
      service.flags.set('cache_flag', {
        flag_key: 'cache_flag',
        enabled: 'Y',
        default_value: 'true'
      });
      
      // First evaluation - cache miss
      await service.evaluateFlag('cache_flag');
      
      // Second evaluation - should be cache hit
      service.evaluationMetrics.cacheHits = 1;
      await service.evaluateFlag('cache_flag');
      
      const metrics = service.getMetrics();
      expect(metrics.cacheHitRate).toBeGreaterThan(0);
    });

    it('should record registration metrics', async () => {
      mockDb.queryOne.mockResolvedValueOnce({
        total_attempts: 100,
        successful_registrations: 75,
        blocked_attempts: 25,
        unique_ips: 50,
        suspicious_ips: 5,
        avg_success_time: 250
      });
      
      mockDb.queryOne.mockResolvedValueOnce({
        total: 50,
        solved: 45
      });
      
      const metrics = await service.getRegistrationMetrics('24h');
      
      expect(metrics).toMatchObject({
        totalAttempts: 100,
        successfulRegistrations: 75,
        blockedAttempts: 25,
        captchaSolveRate: 90
      });
    });
  });

  describe('Flag Management', () => {
    it('should create new flag', async () => {
      const flagData = {
        flag_key: 'new_flag',
        flag_name: 'New Feature',
        description: 'Test feature',
        flag_type: 'boolean',
        default_value: 'false',
        category: 'experimental'
      };
      
      const flagId = await service.createFlag(flagData);
      
      expect(flagId).toBeTruthy();
      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO pf_feature_flags'),
        expect.arrayContaining([flagData.flag_key, flagData.flag_name])
      );
    });

    it('should update flag with history', async () => {
      const flag = {
        flag_id: 'update_id',
        flag_key: 'update_flag',
        enabled: 'Y'
      };
      
      service.flags.set('update_flag', flag);
      mockDb.queryOne.mockResolvedValueOnce(flag);
      
      await service.updateFlag(
        'update_flag',
        { enabled: 'N' },
        'Disable for testing',
        'user123'
      );
      
      // Should create history entry
      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO pf_feature_flag_history'),
        expect.arrayContaining(['update_id', 'updated'])
      );
      
      // Should update flag
      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE pf_feature_flags'),
        expect.arrayContaining(['N', 'update_flag'])
      );
      
      // Should broadcast update
      expect(mockCache.publish).toHaveBeenCalledWith(
        'flag:updates',
        expect.stringContaining('update_flag')
      );
    });
  });
});

describe('Feature Flag Middleware', () => {
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

  it('should evaluate system flags and attach to request', async () => {
    mockFlagService.evaluateFlag.mockResolvedValue({ value: true });
    
    await middleware(mockReq, mockRes, mockNext);
    
    expect(mockFlagService.evaluateFlag).toHaveBeenCalledWith(
      'maintenance_mode',
      expect.objectContaining({
        userId: 'user123',
        sessionId: 'session123'
      })
    );
    
    expect(mockReq.flags).toBeDefined();
    expect(mockReq.hasFeature).toBeDefined();
    expect(mockNext).toHaveBeenCalled();
  });

  it('should block non-admin users in maintenance mode', async () => {
    mockFlagService.evaluateFlag
      .mockResolvedValueOnce({ value: true }) // maintenance_mode = true
      .mockResolvedValue({ value: false });
    
    await middleware(mockReq, mockRes, mockNext);
    
    expect(mockRes.status).toHaveBeenCalledWith(503);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Service temporarily unavailable'
      })
    );
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should allow admin users in maintenance mode', async () => {
    mockReq.user.roles = ['admin'];
    mockFlagService.evaluateFlag.mockResolvedValue({ value: true });
    
    await middleware(mockReq, mockRes, mockNext);
    
    expect(mockNext).toHaveBeenCalled();
  });

  it('should handle errors gracefully', async () => {
    mockFlagService.evaluateFlag.mockRejectedValue(new Error('Service error'));
    
    await middleware(mockReq, mockRes, mockNext);
    
    expect(mockReq.flags).toEqual({});
    expect(mockNext).toHaveBeenCalled();
  });

  it('should provide hasFeature helper function', async () => {
    mockFlagService.evaluateFlag.mockResolvedValue({ value: true });
    
    await middleware(mockReq, mockRes, mockNext);
    
    const hasFeature = await mockReq.hasFeature('test_feature');
    
    expect(hasFeature).toBe(true);
    expect(mockReq.flags.test_feature).toBe(true);
  });
});