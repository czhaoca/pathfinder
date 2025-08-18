/**
 * Unit Tests for DDoS Protection Service
 * 
 * Tests attack detection, pattern matching, and protection mechanisms
 */

const { DDoSProtectionService } = require('../../../src/services/ddosProtectionService');
const Redis = require('ioredis');

// Mock dependencies
jest.mock('ioredis');
jest.mock('../../../src/utils/logger');

describe('DDoSProtectionService', () => {
  let protectionService;
  let mockRedis;
  let mockDatabase;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock Redis
    mockRedis = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      zadd: jest.fn(),
      zcard: jest.fn(),
      zremrangebyscore: jest.fn(),
      expire: jest.fn(),
      incr: jest.fn(),
      mset: jest.fn(),
      pipeline: jest.fn(() => ({
        exec: jest.fn().mockResolvedValue([])
      }))
    };

    // Mock database
    mockDatabase = {
      query: jest.fn(),
      transaction: jest.fn()
    };

    protectionService = new DDoSProtectionService(mockRedis, mockDatabase);
  });

  describe('IP Blocking', () => {
    test('should check permanent IP blocks in database', async () => {
      // Arrange
      mockDatabase.query.mockResolvedValue({
        rows: [{
          ip_address: '192.168.1.1',
          reason: 'Suspicious activity',
          expires_at: null
        }]
      });

      // Act
      const result = await protectionService.checkIPStatus('192.168.1.1');

      // Assert
      expect(result.blocked).toBe(true);
      expect(result.reason).toBe('Suspicious activity');
      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM pf_blocked_ips'),
        ['192.168.1.1']
      );
    });

    test('should check temporary IP blocks in Redis', async () => {
      // Arrange
      mockDatabase.query.mockResolvedValue({ rows: [] });
      mockRedis.get.mockResolvedValue('blocked');

      // Act
      const result = await protectionService.checkIPStatus('192.168.1.1');

      // Assert
      expect(result.blocked).toBe(true);
      expect(result.reason).toBe('Temporary block due to suspicious activity');
      expect(mockRedis.get).toHaveBeenCalledWith('blocked:192.168.1.1');
    });

    test('should return not blocked for clean IP', async () => {
      // Arrange
      mockDatabase.query.mockResolvedValue({ rows: [] });
      mockRedis.get.mockResolvedValue(null);

      // Act
      const result = await protectionService.checkIPStatus('192.168.1.1');

      // Assert
      expect(result.blocked).toBe(false);
    });

    test('should block IP for specified duration', async () => {
      // Act
      await protectionService.blockIP('192.168.1.1', 60);

      // Assert
      expect(mockRedis.set).toHaveBeenCalledWith(
        'blocked:192.168.1.1',
        'blocked',
        'EX',
        3600 // 60 minutes in seconds
      );
    });

    test('should block subnet when required', async () => {
      // Act
      await protectionService.blockSubnet('192.168.1.0/24', 30);

      // Assert
      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO pf_blocked_subnets'),
        expect.arrayContaining(['192.168.1.0/24'])
      );
    });
  });

  describe('Rate Limiting', () => {
    test('should track recent attempts with sliding window', async () => {
      // Arrange
      const now = Date.now();
      mockRedis.zcard.mockResolvedValue(3);

      // Act
      const count = await protectionService.getRecentAttempts('192.168.1.1', 15);

      // Assert
      expect(mockRedis.zremrangebyscore).toHaveBeenCalledWith(
        'attempts:192.168.1.1',
        '-inf',
        expect.any(Number)
      );
      expect(mockRedis.zcard).toHaveBeenCalledWith('attempts:192.168.1.1');
      expect(mockRedis.zadd).toHaveBeenCalled();
      expect(mockRedis.expire).toHaveBeenCalledWith('attempts:192.168.1.1', 900);
      expect(count).toBe(3);
    });

    test('should track email-based attempts', async () => {
      // Arrange
      mockRedis.zcard.mockResolvedValue(2);

      // Act
      const count = await protectionService.getRecentEmailAttempts('test@example.com', 15);

      // Assert
      const emailHash = protectionService.hashEmail('test@example.com');
      expect(mockRedis.zcard).toHaveBeenCalledWith(`attempts:email:${emailHash}`);
      expect(count).toBe(2);
    });

    test('should increment failure counters', async () => {
      // Act
      await protectionService.incrementCounter('failed:192.168.1.1', 3600);

      // Assert
      expect(mockRedis.incr).toHaveBeenCalledWith('failed:192.168.1.1');
      expect(mockRedis.expire).toHaveBeenCalledWith('failed:192.168.1.1', 3600);
    });
  });

  describe('Attack Pattern Detection', () => {
    test('should detect rapid succession attempts', async () => {
      // Arrange
      jest.spyOn(protectionService, 'getRecentAttempts').mockResolvedValue(15);
      jest.spyOn(protectionService, 'getRecentAttemptDetails').mockResolvedValue([]);
      jest.spyOn(protectionService, 'findSimilarPatterns').mockResolvedValue([]);
      jest.spyOn(protectionService, 'matchesBotSignature').mockResolvedValue(false);

      // Act
      const patterns = await protectionService.detectAttackPatterns('192.168.1.1');

      // Assert
      expect(patterns).toContain('rapid_succession');
    });

    test('should detect sequential patterns in usernames', async () => {
      // Arrange
      const attempts = [
        { username: 'user1', email: 'user1@example.com' },
        { username: 'user2', email: 'user2@example.com' },
        { username: 'user3', email: 'user3@example.com' }
      ];
      
      // Act
      const hasPattern = protectionService.hasSequentialPattern(attempts);

      // Assert
      expect(hasPattern).toBe(true);
    });

    test('should detect distributed attacks', async () => {
      // Arrange
      const attempts = [
        { email: 'test@example.com', timestamp: Date.now() }
      ];
      const similarPatterns = new Array(10).fill({ ipAddress: '192.168.1.x' });
      
      jest.spyOn(protectionService, 'getRecentAttempts').mockResolvedValue(5);
      jest.spyOn(protectionService, 'getRecentAttemptDetails').mockResolvedValue(attempts);
      jest.spyOn(protectionService, 'findSimilarPatterns').mockResolvedValue(similarPatterns);
      jest.spyOn(protectionService, 'matchesBotSignature').mockResolvedValue(false);

      // Act
      const patterns = await protectionService.detectAttackPatterns('192.168.1.1');

      // Assert
      expect(patterns).toContain('distributed_attack');
    });

    test('should detect bot signatures', async () => {
      // Arrange
      jest.spyOn(protectionService, 'getRecentAttempts').mockResolvedValue(3);
      jest.spyOn(protectionService, 'getRecentAttemptDetails').mockResolvedValue([]);
      jest.spyOn(protectionService, 'findSimilarPatterns').mockResolvedValue([]);
      jest.spyOn(protectionService, 'matchesBotSignature').mockResolvedValue(true);

      // Act
      const patterns = await protectionService.detectAttackPatterns('192.168.1.1');

      // Assert
      expect(patterns).toContain('bot_signature');
    });

    test('should handle detected patterns appropriately', async () => {
      // Arrange
      const patterns = ['distributed_attack', 'bot_signature'];
      jest.spyOn(protectionService, 'blockIP').mockResolvedValue();
      jest.spyOn(protectionService, 'blockSubnet').mockResolvedValue();
      jest.spyOn(protectionService, 'sendAlert').mockResolvedValue();
      jest.spyOn(protectionService, 'updateProtectionRules').mockResolvedValue();

      // Act
      await protectionService.handleDetectedPatterns('192.168.1.1', patterns);

      // Assert
      expect(protectionService.blockIP).toHaveBeenCalledWith('192.168.1.1', 24 * 60);
      expect(protectionService.blockSubnet).toHaveBeenCalled();
      expect(protectionService.sendAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'critical',
          type: 'attack_pattern_detected'
        })
      );
    });
  });

  describe('Bot Detection', () => {
    test('should detect consistent timing patterns', async () => {
      // Arrange
      const attempts = [
        { timestamp: 1000 },
        { timestamp: 2000 },
        { timestamp: 3000 },
        { timestamp: 4000 },
        { timestamp: 5000 }
      ];
      jest.spyOn(protectionService, 'getRecentAttemptDetails').mockResolvedValue(attempts);

      // Act
      const isBot = await protectionService.matchesBotSignature('192.168.1.1');

      // Assert
      expect(isBot).toBe(true);
    });

    test('should detect same user agent across attempts', async () => {
      // Arrange
      const attempts = new Array(10).fill({
        userAgent: 'Mozilla/5.0',
        timestamp: Date.now()
      });
      jest.spyOn(protectionService, 'getRecentAttemptDetails').mockResolvedValue(attempts);

      // Act
      const isBot = await protectionService.matchesBotSignature('192.168.1.1');

      // Assert
      expect(isBot).toBe(true);
    });

    test('should detect lack of human behavior', async () => {
      // Arrange
      const attempts = [
        { hasMouseMovement: false, hasKeyboardVariation: false },
        { hasMouseMovement: false, hasKeyboardVariation: false },
        { hasMouseMovement: false, hasKeyboardVariation: false }
      ];
      jest.spyOn(protectionService, 'getRecentAttemptDetails').mockResolvedValue(attempts);

      // Act
      const isBot = await protectionService.matchesBotSignature('192.168.1.1');

      // Assert
      expect(isBot).toBe(true);
    });
  });

  describe('IP Reputation', () => {
    test('should calculate combined IP reputation score', async () => {
      // Arrange
      jest.spyOn(protectionService, 'checkAbuseIPDB').mockResolvedValue({
        abuseScore: 20,
        isWhitelisted: false
      });
      jest.spyOn(protectionService, 'checkSpamhaus').mockResolvedValue({
        clean: true,
        listed: false
      });
      jest.spyOn(protectionService, 'getInternalReputation').mockResolvedValue({
        score: 75,
        registrations: 2,
        failures: 1
      });

      // Act
      const reputation = await protectionService.getIPReputation('192.168.1.1');

      // Assert
      expect(reputation.score).toBeGreaterThan(60);
      expect(reputation.details).toHaveProperty('abuseIPDB');
      expect(reputation.details).toHaveProperty('spamhaus');
      expect(reputation.details).toHaveProperty('internal');
    });

    test('should handle reputation check failures gracefully', async () => {
      // Arrange
      jest.spyOn(protectionService, 'checkAbuseIPDB').mockRejectedValue(new Error('API error'));
      jest.spyOn(protectionService, 'checkSpamhaus').mockResolvedValue({ clean: true });
      jest.spyOn(protectionService, 'getInternalReputation').mockResolvedValue({ score: 50 });

      // Act
      const reputation = await protectionService.getIPReputation('192.168.1.1');

      // Assert
      expect(reputation.score).toBeGreaterThan(0);
    });
  });

  describe('VPN/Proxy Detection', () => {
    test('should detect VPN connections', async () => {
      // Arrange
      mockDatabase.query.mockResolvedValue({
        rows: [{
          is_vpn: true,
          is_proxy: false,
          is_hosting: false
        }]
      });

      // Act
      const result = await protectionService.detectVPNProxy('192.168.1.1');

      // Assert
      expect(result.isVPN).toBe(true);
      expect(result.isProxy).toBe(false);
    });

    test('should detect proxy connections', async () => {
      // Arrange
      mockDatabase.query.mockResolvedValue({
        rows: [{
          is_vpn: false,
          is_proxy: true,
          is_hosting: false
        }]
      });

      // Act
      const result = await protectionService.detectVPNProxy('192.168.1.1');

      // Assert
      expect(result.isVPN).toBe(false);
      expect(result.isProxy).toBe(true);
    });
  });

  describe('Disposable Email Detection', () => {
    test('should maintain list of disposable email domains', async () => {
      // Arrange
      mockDatabase.query.mockResolvedValue({
        rows: [
          { domain: 'tempmail.com' },
          { domain: '10minutemail.com' },
          { domain: 'guerrillamail.com' }
        ]
      });

      // Act
      const domains = await protectionService.getDisposableDomains();

      // Assert
      expect(domains).toContain('tempmail.com');
      expect(domains).toContain('10minutemail.com');
      expect(domains).toContain('guerrillamail.com');
    });

    test('should check if domain is blacklisted', async () => {
      // Arrange
      mockDatabase.query.mockResolvedValue({
        rows: [{ domain: 'spam.com', reason: 'Known spam domain' }]
      });

      // Act
      const isBlacklisted = await protectionService.isDomainBlacklisted('spam.com');

      // Assert
      expect(isBlacklisted).toBe(true);
    });
  });

  describe('Strict Mode', () => {
    test('should enable strict protection mode', async () => {
      // Act
      await protectionService.enableStrictMode();

      // Assert
      expect(mockRedis.set).toHaveBeenCalledWith('protection:strict_mode', 'true', 'EX', 3600);
      expect(mockRedis.mset).toHaveBeenCalledWith(
        'protection:max_attempts', '2',
        'protection:captcha_always', 'true',
        'protection:email_verification', 'required',
        'protection:block_duration', '7200'
      );
    });

    test('should clear pending registrations', async () => {
      // Arrange
      mockDatabase.query.mockResolvedValue({ rowCount: 5 });

      // Act
      const result = await protectionService.clearPendingRegistrations();

      // Assert
      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM pf_pending_registrations')
      );
      expect(result.cleared).toBe(5);
    });
  });

  describe('Pattern Detection Rules', () => {
    test('should detect credential stuffing pattern', async () => {
      // Arrange
      const attempts = new Array(15).fill({
        passwordLength: 12,
        email: 'different@example.com'
      });
      const pattern = protectionService.patterns.get('credential_stuffing');

      // Act
      const detected = await pattern.check(attempts);

      // Assert
      expect(detected).toBe(true);
    });

    test('should detect email enumeration pattern', async () => {
      // Arrange
      const attempts = [];
      for (let i = 0; i < 25; i++) {
        attempts.push({ email: `user${i}@example.com` });
      }
      const pattern = protectionService.patterns.get('email_enumeration');

      // Act
      const detected = await pattern.check(attempts);

      // Assert
      expect(detected).toBe(true);
    });

    test('should detect dictionary attack pattern', async () => {
      // Arrange
      const attempts = [
        { passwordHint: 'password' },
        { passwordHint: '123456' },
        { passwordHint: 'admin' }
      ];
      const pattern = protectionService.patterns.get('dictionary_attack');

      // Act
      const detected = await pattern.check(attempts);

      // Assert
      expect(detected).toBe(true);
    });
  });

  describe('Analytics and Metrics', () => {
    test('should track failed attempts', async () => {
      // Act
      await protectionService.trackFailedAttempt({
        email: 'test@example.com',
        ipAddress: '192.168.1.1',
        fingerprint: 'fp_12345',
        reason: 'Invalid credentials'
      });

      // Assert
      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO pf_registration_attempts'),
        expect.arrayContaining([false, 'Invalid credentials'])
      );
      expect(mockRedis.incr).toHaveBeenCalled();
    });

    test('should track successful registrations', async () => {
      // Act
      await protectionService.trackSuccessfulRegistration({
        userId: 'user123',
        email: 'test@example.com',
        ipAddress: '192.168.1.1',
        fingerprint: 'fp_12345'
      });

      // Assert
      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO pf_registration_attempts'),
        expect.arrayContaining([true])
      );
    });

    test('should get unique IPs in last minute', async () => {
      // Arrange
      mockDatabase.query.mockResolvedValue({
        rows: [{ unique_ips: 150 }]
      });

      // Act
      const count = await protectionService.getUniqueIPsLastMinute();

      // Assert
      expect(count).toBe(150);
      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('COUNT(DISTINCT ip_address)')
      );
    });
  });

  describe('Alert System', () => {
    test('should send alert for critical events', async () => {
      // Arrange
      const mockNotificationService = {
        sendAdminAlert: jest.fn()
      };
      protectionService.notificationService = mockNotificationService;

      // Act
      await protectionService.sendAlert({
        severity: 'critical',
        type: 'distributed_attack',
        ipAddress: '192.168.1.1',
        patterns: ['distributed_attack', 'bot_signature']
      });

      // Assert
      expect(mockNotificationService.sendAdminAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'critical',
          type: 'distributed_attack'
        })
      );
    });

    test('should generate appropriate recommendations', () => {
      // Act
      const recommendation1 = protectionService.getRecommendation(['distributed_attack']);
      const recommendation2 = protectionService.getRecommendation(['bot_signature']);
      const recommendation3 = protectionService.getRecommendation(['rapid_succession']);

      // Assert
      expect(recommendation1).toContain('disable registration');
      expect(recommendation2).toContain('CAPTCHA');
      expect(recommendation3).toContain('rate limiting');
    });
  });
});