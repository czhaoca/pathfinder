/**
 * Unit Tests for Registration Service with DDoS Protection
 * 
 * Tests all layers of protection and registration functionality
 */

const { RegistrationService } = require('../../../src/services/registrationService');
const { DDoSProtectionService } = require('../../../src/services/ddosProtectionService');
const { ValidationError, AuthenticationError, ConflictError } = require('../../../src/utils/errors');

// Mock dependencies
jest.mock('../../../src/services/userService');
jest.mock('../../../src/services/emailService');
jest.mock('../../../src/services/ddosProtectionService');
jest.mock('../../../src/services/featureFlagService');
jest.mock('../../../src/services/auditService');
jest.mock('../../../src/utils/logger');

describe('RegistrationService', () => {
  let registrationService;
  let mockUserService;
  let mockEmailService;
  let mockProtectionService;
  let mockFeatureFlagService;
  let mockAuditService;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock implementations
    mockUserService = {
      findByEmail: jest.fn(),
      findByUsername: jest.fn(),
      create: jest.fn(),
      createUserSchema: jest.fn()
    };

    mockEmailService = {
      sendVerificationEmail: jest.fn(),
      sendWelcomeEmail: jest.fn(),
      validateEmailDomain: jest.fn()
    };

    mockProtectionService = {
      checkIPStatus: jest.fn(),
      getRecentAttempts: jest.fn(),
      getRecentEmailAttempts: jest.fn(),
      trackSuccessfulRegistration: jest.fn(),
      trackFailedAttempt: jest.fn(),
      blockIP: jest.fn(),
      getIPReputation: jest.fn(),
      detectVPNProxy: jest.fn(),
      getDisposableDomains: jest.fn(),
      isDomainBlacklisted: jest.fn(),
      getFailedAttempts: jest.fn(),
      getUniqueIPsLastMinute: jest.fn(),
      enableStrictMode: jest.fn(),
      clearPendingRegistrations: jest.fn(),
      flagSuspiciousDevice: jest.fn()
    };

    mockFeatureFlagService = {
      evaluateFlag: jest.fn(),
      updateFlag: jest.fn()
    };

    mockAuditService = {
      logRegistration: jest.fn(),
      logSecurityEvent: jest.fn()
    };

    // Create service instance
    registrationService = new RegistrationService(
      mockUserService,
      mockEmailService,
      mockProtectionService,
      mockFeatureFlagService,
      mockAuditService
    );
  });

  describe('Registration Flow', () => {
    const validRegistrationData = {
      email: 'test@example.com',
      username: 'testuser',
      password: 'SecurePass123!',
      firstName: 'John',
      lastName: 'Doe'
    };

    const validRequestContext = {
      ipAddress: '192.168.1.1',
      userAgent: 'Mozilla/5.0',
      fingerprint: 'fp_12345',
      headers: {}
    };

    test('should successfully register a new user when all checks pass', async () => {
      // Arrange
      mockFeatureFlagService.evaluateFlag.mockResolvedValue(true);
      mockProtectionService.checkIPStatus.mockResolvedValue({ blocked: false });
      mockProtectionService.getRecentAttempts.mockResolvedValue(2);
      mockProtectionService.getRecentEmailAttempts.mockResolvedValue(1);
      mockProtectionService.getIPReputation.mockResolvedValue({ score: 80 });
      mockProtectionService.detectVPNProxy.mockResolvedValue({ isVPN: false, isProxy: false });
      mockProtectionService.getDisposableDomains.mockResolvedValue([]);
      mockProtectionService.isDomainBlacklisted.mockResolvedValue(false);
      mockProtectionService.getFailedAttempts.mockResolvedValue(0);
      mockEmailService.validateEmailDomain.mockResolvedValue(true);
      mockUserService.findByEmail.mockResolvedValue(null);
      mockUserService.findByUsername.mockResolvedValue(null);
      mockUserService.create.mockResolvedValue({
        id: 'user123',
        username: 'testuser',
        email: 'test@example.com'
      });

      // Act
      const result = await registrationService.register(validRegistrationData, validRequestContext);

      // Assert
      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('userId', 'user123');
      expect(mockUserService.create).toHaveBeenCalled();
      expect(mockEmailService.sendVerificationEmail).toHaveBeenCalled();
      expect(mockProtectionService.trackSuccessfulRegistration).toHaveBeenCalled();
    });

    test('should fail when registration is disabled via feature flag', async () => {
      // Arrange
      mockFeatureFlagService.evaluateFlag.mockResolvedValue(false);

      // Act & Assert
      await expect(registrationService.register(validRegistrationData, validRequestContext))
        .rejects.toThrow('Registration is currently disabled');
      
      expect(mockUserService.create).not.toHaveBeenCalled();
    });

    test('should fail when email already exists', async () => {
      // Arrange
      mockFeatureFlagService.evaluateFlag.mockResolvedValue(true);
      mockProtectionService.checkIPStatus.mockResolvedValue({ blocked: false });
      mockUserService.findByEmail.mockResolvedValue({ id: 'existing' });

      // Act & Assert
      await expect(registrationService.register(validRegistrationData, validRequestContext))
        .rejects.toThrow(ConflictError);
      
      expect(mockProtectionService.trackFailedAttempt).toHaveBeenCalled();
    });

    test('should fail when username already exists', async () => {
      // Arrange
      mockFeatureFlagService.evaluateFlag.mockResolvedValue(true);
      mockProtectionService.checkIPStatus.mockResolvedValue({ blocked: false });
      mockUserService.findByEmail.mockResolvedValue(null);
      mockUserService.findByUsername.mockResolvedValue({ id: 'existing' });

      // Act & Assert
      await expect(registrationService.register(validRegistrationData, validRequestContext))
        .rejects.toThrow(ConflictError);
      
      expect(mockProtectionService.trackFailedAttempt).toHaveBeenCalled();
    });
  });

  describe('DDoS Protection Checks', () => {
    const registrationData = {
      email: 'test@example.com',
      username: 'testuser',
      password: 'SecurePass123!'
    };

    const requestContext = {
      ipAddress: '192.168.1.1',
      userAgent: 'Mozilla/5.0',
      fingerprint: 'fp_12345'
    };

    test('should block registration when IP is blocked', async () => {
      // Arrange
      mockFeatureFlagService.evaluateFlag.mockResolvedValue(true);
      mockProtectionService.checkIPStatus.mockResolvedValue({ 
        blocked: true, 
        reason: 'Too many attempts' 
      });

      // Act & Assert
      await expect(registrationService.register(registrationData, requestContext))
        .rejects.toThrow('Registration temporarily blocked');
    });

    test('should block registration when rate limit is exceeded', async () => {
      // Arrange
      mockFeatureFlagService.evaluateFlag.mockResolvedValue(true);
      mockProtectionService.checkIPStatus.mockResolvedValue({ blocked: false });
      mockProtectionService.getRecentAttempts.mockResolvedValue(10); // Exceeds threshold

      // Act & Assert
      await expect(registrationService.register(registrationData, requestContext))
        .rejects.toThrow('Too many registration attempts');
      
      expect(mockProtectionService.blockIP).toHaveBeenCalledWith(
        requestContext.ipAddress,
        expect.any(Number)
      );
    });

    test('should require CAPTCHA when suspicion score is high', async () => {
      // Arrange
      const dataWithoutCaptcha = { ...registrationData };
      mockFeatureFlagService.evaluateFlag.mockResolvedValue(true);
      mockProtectionService.checkIPStatus.mockResolvedValue({ blocked: false });
      mockProtectionService.getRecentAttempts.mockResolvedValue(4);
      mockProtectionService.getRecentEmailAttempts.mockResolvedValue(2);
      mockProtectionService.getIPReputation.mockResolvedValue({ score: 30 }); // Low reputation
      mockProtectionService.detectVPNProxy.mockResolvedValue({ isVPN: true, isProxy: false });

      // Act & Assert
      await expect(registrationService.register(dataWithoutCaptcha, requestContext))
        .rejects.toThrow('CAPTCHA_REQUIRED');
    });

    test('should block disposable email addresses', async () => {
      // Arrange
      const dataWithDisposableEmail = {
        ...registrationData,
        email: 'test@tempmail.com'
      };
      mockFeatureFlagService.evaluateFlag.mockResolvedValue(true);
      mockProtectionService.checkIPStatus.mockResolvedValue({ blocked: false });
      mockProtectionService.getDisposableDomains.mockResolvedValue(['tempmail.com']);

      // Act & Assert
      await expect(registrationService.register(dataWithDisposableEmail, requestContext))
        .rejects.toThrow('Disposable email addresses are not allowed');
    });

    test('should block blacklisted domains', async () => {
      // Arrange
      mockFeatureFlagService.evaluateFlag.mockResolvedValue(true);
      mockProtectionService.checkIPStatus.mockResolvedValue({ blocked: false });
      mockProtectionService.isDomainBlacklisted.mockResolvedValue(true);

      // Act & Assert
      await expect(registrationService.register(registrationData, requestContext))
        .rejects.toThrow('Email domain is not allowed');
    });

    test('should detect and block bot behavior', async () => {
      // Arrange
      const botContext = {
        ...requestContext,
        userAgent: 'Selenium'
      };
      mockFeatureFlagService.evaluateFlag.mockResolvedValue(true);
      mockProtectionService.checkIPStatus.mockResolvedValue({ blocked: false });

      // Act & Assert
      await expect(registrationService.register(registrationData, botContext))
        .rejects.toThrow('Automated registration detected');
      
      expect(mockProtectionService.blockIP).toHaveBeenCalledWith(
        botContext.ipAddress,
        24 * 60 // 24 hour block
      );
    });

    test('should validate CAPTCHA when required', async () => {
      // Arrange
      const dataWithCaptcha = {
        ...registrationData,
        captchaToken: 'valid_token'
      };
      mockFeatureFlagService.evaluateFlag.mockResolvedValue(true);
      mockProtectionService.checkIPStatus.mockResolvedValue({ blocked: false });
      mockProtectionService.getRecentAttempts.mockResolvedValue(4);
      
      // Mock fetch for CAPTCHA verification
      global.fetch = jest.fn().mockResolvedValue({
        json: () => Promise.resolve({ success: true, score: 0.8 })
      });

      mockUserService.findByEmail.mockResolvedValue(null);
      mockUserService.findByUsername.mockResolvedValue(null);
      mockUserService.create.mockResolvedValue({ id: 'user123' });

      // Act
      const result = await registrationService.register(dataWithCaptcha, requestContext);

      // Assert
      expect(result.success).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('google.com/recaptcha'),
        expect.any(Object)
      );
    });
  });

  describe('Suspicion Score Calculation', () => {
    test('should calculate low suspicion score for legitimate user', async () => {
      // Arrange
      const context = {
        email: 'john.doe@company.com',
        ipAddress: '192.168.1.1',
        fingerprint: 'fp_12345',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      };

      mockProtectionService.getDisposableDomains.mockResolvedValue([]);
      mockProtectionService.getIPReputation.mockResolvedValue({ score: 85 });
      mockProtectionService.detectVPNProxy.mockResolvedValue({ isVPN: false, isProxy: false });
      mockProtectionService.getFailedAttempts.mockResolvedValue(0);

      // Act
      const score = await registrationService.calculateSuspicionScore(context);

      // Assert
      expect(score).toBeLessThan(0.3);
    });

    test('should calculate high suspicion score for suspicious patterns', async () => {
      // Arrange
      const context = {
        email: 'test123456@tempmail.com',
        ipAddress: '192.168.1.1',
        fingerprint: 'fp_12345',
        userAgent: 'curl/7.68.0'
      };

      mockProtectionService.getDisposableDomains.mockResolvedValue(['tempmail.com']);
      mockProtectionService.getIPReputation.mockResolvedValue({ score: 20 });
      mockProtectionService.detectVPNProxy.mockResolvedValue({ isVPN: true, isProxy: true });
      mockProtectionService.getFailedAttempts.mockResolvedValue(15);

      // Act
      const score = await registrationService.calculateSuspicionScore(context);

      // Assert
      expect(score).toBeGreaterThan(0.7);
    });

    test('should detect suspicious email patterns', async () => {
      // Arrange
      const suspiciousEmails = [
        'test12345@example.com',
        'admin@example.com',
        'noreply@example.com'
      ];

      for (const email of suspiciousEmails) {
        const context = { email, ipAddress: '192.168.1.1' };
        mockProtectionService.getIPReputation.mockResolvedValue({ score: 70 });
        
        // Act
        const score = await registrationService.calculateSuspicionScore(context);
        
        // Assert
        expect(score).toBeGreaterThan(0.2);
      }
    });
  });

  describe('Protection Escalation', () => {
    test('should escalate protection on rapid attempts', async () => {
      // Arrange
      mockProtectionService.getRecentAttempts.mockResolvedValue(15);
      mockProtectionService.getUniqueIPsLastMinute.mockResolvedValue(50);

      // Act
      await registrationService.checkEscalation('192.168.1.1');

      // Assert
      expect(registrationService.thresholds.maxAttemptsPerIP).toBeLessThan(5);
      expect(registrationService.thresholds.captchaThreshold).toBe(1);
    });

    test('should trigger emergency disable on distributed attack', async () => {
      // Arrange
      mockProtectionService.getUniqueIPsLastMinute.mockResolvedValue(600);
      mockFeatureFlagService.updateFlag.mockResolvedValue(true);

      // Act
      await registrationService.checkEscalation('192.168.1.1');

      // Assert
      expect(mockFeatureFlagService.updateFlag).toHaveBeenCalledWith(
        'self_registration_enabled',
        expect.objectContaining({ defaultValue: 'false' }),
        expect.stringContaining('EMERGENCY')
      );
      expect(mockProtectionService.clearPendingRegistrations).toHaveBeenCalled();
    });

    test('should enable strict mode when protection escalates', async () => {
      // Arrange
      mockProtectionService.getRecentAttempts.mockResolvedValue(12);

      // Act
      await registrationService.checkEscalation('192.168.1.1');

      // Assert
      expect(mockProtectionService.enableStrictMode).toHaveBeenCalled();
    });
  });

  describe('Email Validation', () => {
    test('should validate email format', async () => {
      const invalidEmails = [
        'notanemail',
        '@example.com',
        'user@',
        'user @example.com',
        'user@example'
      ];

      for (const email of invalidEmails) {
        await expect(registrationService.validateEmail(email))
          .rejects.toThrow('Invalid email format');
      }
    });

    test('should validate email DNS records', async () => {
      // Arrange
      const dns = require('dns').promises;
      dns.resolveMx = jest.fn().mockResolvedValue([{ priority: 10, exchange: 'mx.example.com' }]);

      // Act
      const result = await registrationService.validateEmailDNS('example.com');

      // Assert
      expect(result).toBe(true);
    });

    test('should reject invalid email domains', async () => {
      // Arrange
      const dns = require('dns').promises;
      dns.resolveMx = jest.fn().mockRejectedValue(new Error('ENOTFOUND'));

      // Act
      const result = await registrationService.validateEmailDNS('invaliddomain.xyz');

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('Behavioral Analysis', () => {
    test('should detect headless browser', async () => {
      // Arrange
      const context = {
        ipAddress: '192.168.1.1',
        userAgent: 'HeadlessChrome/91.0.4472.124'
      };

      // Act
      const result = await registrationService.analyzeBehavior(context);

      // Assert
      expect(result.isBot).toBe(true);
      expect(result.factors).toContain('headless_browser');
    });

    test('should detect automation tools', async () => {
      // Arrange
      const automationUserAgents = [
        'Selenium',
        'Puppeteer',
        'Playwright',
        'PhantomJS'
      ];

      for (const userAgent of automationUserAgents) {
        const context = { ipAddress: '192.168.1.1', userAgent };
        
        // Act
        const result = await registrationService.analyzeBehavior(context);
        
        // Assert
        expect(result.isBot).toBe(true);
        expect(result.factors).toContain('automation_tool');
      }
    });

    test('should detect consistent timing patterns', async () => {
      // Arrange
      const timingPatterns = [1000, 1001, 999, 1002, 998]; // Very consistent
      const context = {
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        timingPatterns
      };

      // Act
      const result = await registrationService.analyzeBehavior(context);

      // Assert
      expect(result.factors).toContain('consistent_timing');
    });
  });

  describe('Input Validation', () => {
    test('should validate password strength', async () => {
      const weakPasswords = [
        'short',
        'nouppercasehere123',
        'NOLOWERCASEHERE123',
        'NoNumbersHere!',
        '12345678'
      ];

      for (const password of weakPasswords) {
        const data = { email: 'test@example.com', username: 'test', password };
        const context = { ipAddress: '192.168.1.1' };
        
        await expect(registrationService.register(data, context))
          .rejects.toThrow(ValidationError);
      }
    });

    test('should validate username format', async () => {
      const invalidUsernames = [
        'ab', // Too short
        'user name', // Contains space
        'user@name', // Contains @
        'user#name', // Contains #
        'a'.repeat(31) // Too long
      ];

      for (const username of invalidUsernames) {
        const data = { email: 'test@example.com', username, password: 'SecurePass123!' };
        const context = { ipAddress: '192.168.1.1' };
        
        await expect(registrationService.register(data, context))
          .rejects.toThrow(ValidationError);
      }
    });

    test('should sanitize input to prevent XSS', async () => {
      // Arrange
      const maliciousData = {
        email: 'test@example.com',
        username: 'testuser',
        password: 'SecurePass123!',
        firstName: '<script>alert("XSS")</script>',
        lastName: 'Doe'
      };

      mockFeatureFlagService.evaluateFlag.mockResolvedValue(true);
      mockProtectionService.checkIPStatus.mockResolvedValue({ blocked: false });
      mockUserService.create.mockImplementation((data) => {
        // Should sanitize the input
        expect(data.firstName).not.toContain('<script>');
        return { id: 'user123' };
      });

      // Act
      await registrationService.register(maliciousData, { ipAddress: '192.168.1.1' });

      // Assert
      expect(mockUserService.create).toHaveBeenCalled();
    });
  });

  describe('Audit and Logging', () => {
    test('should log successful registration', async () => {
      // Arrange
      mockFeatureFlagService.evaluateFlag.mockResolvedValue(true);
      mockProtectionService.checkIPStatus.mockResolvedValue({ blocked: false });
      mockUserService.create.mockResolvedValue({ id: 'user123' });

      // Act
      await registrationService.register(
        { email: 'test@example.com', username: 'test', password: 'SecurePass123!' },
        { ipAddress: '192.168.1.1' }
      );

      // Assert
      expect(mockAuditService.logRegistration).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user123',
          action: 'USER_REGISTERED',
          success: true
        })
      );
    });

    test('should log failed registration attempts', async () => {
      // Arrange
      mockFeatureFlagService.evaluateFlag.mockResolvedValue(true);
      mockProtectionService.checkIPStatus.mockResolvedValue({ blocked: true });

      // Act
      try {
        await registrationService.register(
          { email: 'test@example.com', username: 'test', password: 'SecurePass123!' },
          { ipAddress: '192.168.1.1' }
        );
      } catch (error) {
        // Expected to throw
      }

      // Assert
      expect(mockProtectionService.trackFailedAttempt).toHaveBeenCalled();
    });

    test('should log security events', async () => {
      // Arrange
      mockProtectionService.getUniqueIPsLastMinute.mockResolvedValue(600);

      // Act
      await registrationService.checkEscalation('192.168.1.1');

      // Assert
      expect(mockAuditService.logSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'registration_attack',
          severity: 'critical'
        })
      );
    });
  });
});