/**
 * Integration Tests for Self-Registration System with DDoS Protection
 * 
 * Tests the complete registration flow including all protection layers
 */

const request = require('supertest');
const Redis = require('ioredis');
const app = require('../../src/api/app');
const { setupTestDatabase, cleanupTestDatabase } = require('../helpers/database');
const { createTestUser } = require('../helpers/users');
const { mockEmailService } = require('../helpers/email');

describe('Self-Registration Integration Tests', () => {
  let redis;
  let db;
  let server;

  beforeAll(async () => {
    // Setup test database
    db = await setupTestDatabase();
    
    // Setup Redis
    redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      db: process.env.REDIS_TEST_DB || 1
    });

    // Mock email service
    mockEmailService();

    // Start server
    server = app.listen(0);
  });

  afterAll(async () => {
    await cleanupTestDatabase(db);
    await redis.flushdb();
    await redis.quit();
    server.close();
  });

  beforeEach(async () => {
    // Clear Redis between tests
    await redis.flushdb();
    
    // Enable registration feature flag
    await db.query(
      `INSERT INTO pf_feature_flags (name, enabled, value) 
       VALUES ('self_registration_enabled', true, '{"defaultValue": "true"}')
       ON CONFLICT (name) DO UPDATE SET enabled = true, value = '{"defaultValue": "true"}'`
    );
  });

  describe('Successful Registration', () => {
    test('should register new user with valid data', async () => {
      // Act
      const response = await request(server)
        .post('/api/auth/register')
        .send({
          email: 'newuser@example.com',
          username: 'newuser123',
          password: 'SecurePass123!',
          firstName: 'New',
          lastName: 'User'
        })
        .set('X-Forwarded-For', '192.168.1.100');

      // Assert
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('verification');

      // Verify user was created
      const user = await db.query(
        'SELECT * FROM pf_users WHERE username = ?',
        ['newuser123']
      );
      expect(user.rows).toHaveLength(1);
      expect(user.rows[0].email_verified).toBe(false);
    });

    test('should send verification email after registration', async () => {
      // Arrange
      const emailSpy = jest.spyOn(mockEmailService, 'sendVerificationEmail');

      // Act
      await request(server)
        .post('/api/auth/register')
        .send({
          email: 'verify@example.com',
          username: 'verifyuser',
          password: 'SecurePass123!',
          firstName: 'Verify',
          lastName: 'User'
        })
        .set('X-Forwarded-For', '192.168.1.101');

      // Assert
      expect(emailSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'verify@example.com',
          username: 'verifyuser'
        })
      );
    });

    test('should handle multi-step registration process', async () => {
      // Step 1: Check username availability
      const checkUsername = await request(server)
        .post('/api/auth/register/check-username')
        .send({ username: 'uniqueuser' });
      
      expect(checkUsername.status).toBe(200);
      expect(checkUsername.body.available).toBe(true);

      // Step 2: Check email availability
      const checkEmail = await request(server)
        .post('/api/auth/register/check-email')
        .send({ email: 'unique@example.com' });
      
      expect(checkEmail.status).toBe(200);
      expect(checkEmail.body.available).toBe(true);

      // Step 3: Complete registration
      const register = await request(server)
        .post('/api/auth/register')
        .send({
          email: 'unique@example.com',
          username: 'uniqueuser',
          password: 'SecurePass123!',
          firstName: 'Unique',
          lastName: 'User'
        })
        .set('X-Forwarded-For', '192.168.1.102');

      expect(register.status).toBe(201);
      expect(register.body.success).toBe(true);
    });
  });

  describe('Rate Limiting', () => {
    test('should block after exceeding rate limit', async () => {
      const ipAddress = '192.168.1.200';
      
      // Make multiple attempts
      for (let i = 0; i < 5; i++) {
        await request(server)
          .post('/api/auth/register')
          .send({
            email: `test${i}@example.com`,
            username: `testuser${i}`,
            password: 'SecurePass123!'
          })
          .set('X-Forwarded-For', ipAddress);
      }

      // Next attempt should be blocked
      const response = await request(server)
        .post('/api/auth/register')
        .send({
          email: 'blocked@example.com',
          username: 'blockeduser',
          password: 'SecurePass123!'
        })
        .set('X-Forwarded-For', ipAddress);

      expect(response.status).toBe(429);
      expect(response.body.error).toContain('Too many');
    });

    test('should enforce per-email rate limiting', async () => {
      const email = 'ratelimit@example.com';
      
      // Make multiple attempts with same email
      for (let i = 0; i < 3; i++) {
        await request(server)
          .post('/api/auth/register')
          .send({
            email: email,
            username: `user${i}`,
            password: 'SecurePass123!'
          })
          .set('X-Forwarded-For', `192.168.1.${i}`);
      }

      // Next attempt with same email should be blocked
      const response = await request(server)
        .post('/api/auth/register')
        .send({
          email: email,
          username: 'anotheruser',
          password: 'SecurePass123!'
        })
        .set('X-Forwarded-For', '192.168.1.99');

      expect(response.status).toBe(429);
    });

    test('should use sliding window for rate limiting', async () => {
      const ipAddress = '192.168.1.201';
      
      // Make 4 attempts (under limit)
      for (let i = 0; i < 4; i++) {
        const response = await request(server)
          .post('/api/auth/register')
          .send({
            email: `sliding${i}@example.com`,
            username: `sliding${i}`,
            password: 'SecurePass123!'
          })
          .set('X-Forwarded-For', ipAddress);
        
        expect(response.status).not.toBe(429);
      }

      // Wait for window to partially expire
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Should allow one more attempt
      const response = await request(server)
        .post('/api/auth/register')
        .send({
          email: 'sliding5@example.com',
          username: 'sliding5',
          password: 'SecurePass123!'
        })
        .set('X-Forwarded-For', ipAddress);

      expect(response.status).not.toBe(429);
    });
  });

  describe('CAPTCHA Protection', () => {
    test('should require CAPTCHA for suspicious requests', async () => {
      // Arrange - Make some failed attempts to trigger suspicion
      const ipAddress = '192.168.1.202';
      
      for (let i = 0; i < 3; i++) {
        await request(server)
          .post('/api/auth/register')
          .send({
            email: 'admin@test.com', // Suspicious pattern
            username: `admin${i}`,
            password: 'weak'
          })
          .set('X-Forwarded-For', ipAddress);
      }

      // Act - Next attempt should require CAPTCHA
      const response = await request(server)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          username: 'testuser',
          password: 'SecurePass123!'
        })
        .set('X-Forwarded-For', ipAddress);

      // Assert
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('CAPTCHA_REQUIRED');
      expect(response.body.requireCaptcha).toBe(true);
    });

    test('should accept valid CAPTCHA token', async () => {
      // Mock CAPTCHA verification
      jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        json: () => Promise.resolve({
          success: true,
          score: 0.8
        })
      });

      // Act
      const response = await request(server)
        .post('/api/auth/register')
        .send({
          email: 'captcha@example.com',
          username: 'captchauser',
          password: 'SecurePass123!',
          captchaToken: 'valid_captcha_token'
        })
        .set('X-Forwarded-For', '192.168.1.203');

      // Assert
      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
    });

    test('should reject invalid CAPTCHA token', async () => {
      // Mock CAPTCHA verification failure
      jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        json: () => Promise.resolve({
          success: false,
          'error-codes': ['invalid-input-response']
        })
      });

      // Act
      const response = await request(server)
        .post('/api/auth/register')
        .send({
          email: 'badcaptcha@example.com',
          username: 'badcaptcha',
          password: 'SecurePass123!',
          captchaToken: 'invalid_token'
        })
        .set('X-Forwarded-For', '192.168.1.204');

      // Assert
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid CAPTCHA');
    });
  });

  describe('Email Validation', () => {
    test('should reject disposable email addresses', async () => {
      // Add disposable domain to blacklist
      await db.query(
        'INSERT INTO pf_disposable_email_domains (domain) VALUES (?)',
        ['tempmail.com']
      );

      // Act
      const response = await request(server)
        .post('/api/auth/register')
        .send({
          email: 'test@tempmail.com',
          username: 'tempuser',
          password: 'SecurePass123!'
        })
        .set('X-Forwarded-For', '192.168.1.205');

      // Assert
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Disposable email');
    });

    test('should reject blacklisted domains', async () => {
      // Add domain to blacklist
      await db.query(
        'INSERT INTO pf_blacklisted_domains (domain, reason) VALUES (?, ?)',
        ['spam.com', 'Known spam domain']
      );

      // Act
      const response = await request(server)
        .post('/api/auth/register')
        .send({
          email: 'user@spam.com',
          username: 'spamuser',
          password: 'SecurePass123!'
        })
        .set('X-Forwarded-For', '192.168.1.206');

      // Assert
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('not allowed');
    });

    test('should validate email format', async () => {
      const invalidEmails = [
        'notanemail',
        '@example.com',
        'user@',
        'user @example.com'
      ];

      for (const email of invalidEmails) {
        const response = await request(server)
          .post('/api/auth/register')
          .send({
            email: email,
            username: 'testuser',
            password: 'SecurePass123!'
          })
          .set('X-Forwarded-For', '192.168.1.207');

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('Invalid email');
      }
    });
  });

  describe('Bot Detection', () => {
    test('should detect and block automated tools', async () => {
      // Act
      const response = await request(server)
        .post('/api/auth/register')
        .send({
          email: 'bot@example.com',
          username: 'botuser',
          password: 'SecurePass123!'
        })
        .set('User-Agent', 'Selenium')
        .set('X-Forwarded-For', '192.168.1.208');

      // Assert
      expect(response.status).toBe(403);
      expect(response.body.error).toContain('Automated registration detected');
    });

    test('should detect headless browsers', async () => {
      // Act
      const response = await request(server)
        .post('/api/auth/register')
        .send({
          email: 'headless@example.com',
          username: 'headlessuser',
          password: 'SecurePass123!'
        })
        .set('User-Agent', 'HeadlessChrome')
        .set('X-Forwarded-For', '192.168.1.209');

      // Assert
      expect(response.status).toBe(403);
      expect(response.body.error).toContain('Automated registration detected');
    });

    test('should detect rapid sequential attempts', async () => {
      const ipAddress = '192.168.1.210';
      
      // Make rapid sequential attempts
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(
          request(server)
            .post('/api/auth/register')
            .send({
              email: `user${i}@example.com`,
              username: `user${i}`,
              password: 'SecurePass123!'
            })
            .set('X-Forwarded-For', ipAddress)
        );
      }

      const responses = await Promise.all(promises);
      
      // Should detect pattern and block
      const blockedResponses = responses.filter(r => r.status === 403);
      expect(blockedResponses.length).toBeGreaterThan(0);
    });
  });

  describe('VPN/Proxy Detection', () => {
    test('should flag VPN connections as suspicious', async () => {
      // Mock VPN detection
      await db.query(
        'INSERT INTO pf_ip_reputation (ip_address, is_vpn, is_proxy) VALUES (?, ?, ?)',
        ['10.0.0.1', true, false]
      );

      // Act
      const response = await request(server)
        .post('/api/auth/register')
        .send({
          email: 'vpnuser@example.com',
          username: 'vpnuser',
          password: 'SecurePass123!'
        })
        .set('X-Forwarded-For', '10.0.0.1');

      // Assert - Should require CAPTCHA for VPN users
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('CAPTCHA_REQUIRED');
    });

    test('should flag proxy connections as suspicious', async () => {
      // Mock proxy detection
      await db.query(
        'INSERT INTO pf_ip_reputation (ip_address, is_vpn, is_proxy) VALUES (?, ?, ?)',
        ['10.0.0.2', false, true]
      );

      // Act
      const response = await request(server)
        .post('/api/auth/register')
        .send({
          email: 'proxyuser@example.com',
          username: 'proxyuser',
          password: 'SecurePass123!'
        })
        .set('X-Forwarded-For', '10.0.0.2');

      // Assert
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('CAPTCHA_REQUIRED');
    });
  });

  describe('Feature Flag Control', () => {
    test('should disable registration when feature flag is off', async () => {
      // Disable feature flag
      await db.query(
        `UPDATE pf_feature_flags 
         SET enabled = false, value = '{"defaultValue": "false"}' 
         WHERE name = 'self_registration_enabled'`
      );

      // Act
      const response = await request(server)
        .post('/api/auth/register')
        .send({
          email: 'disabled@example.com',
          username: 'disableduser',
          password: 'SecurePass123!'
        })
        .set('X-Forwarded-For', '192.168.1.211');

      // Assert
      expect(response.status).toBe(503);
      expect(response.body.error).toContain('Registration is currently disabled');
    });

    test('should support gradual rollout', async () => {
      // Configure 50% rollout
      await db.query(
        `UPDATE pf_feature_flags 
         SET value = '{"defaultValue": "false", "rolloutPercentage": 50}' 
         WHERE name = 'self_registration_enabled'`
      );

      // Test multiple requests
      const results = [];
      for (let i = 0; i < 20; i++) {
        const response = await request(server)
          .post('/api/auth/register')
          .send({
            email: `rollout${i}@example.com`,
            username: `rollout${i}`,
            password: 'SecurePass123!'
          })
          .set('X-Forwarded-For', `192.168.1.${i}`);
        
        results.push(response.status !== 503);
      }

      // Should have roughly 50% success rate
      const successRate = results.filter(r => r).length / results.length;
      expect(successRate).toBeGreaterThan(0.3);
      expect(successRate).toBeLessThan(0.7);
    });

    test('should support geographic restrictions', async () => {
      // Configure geographic restriction
      await db.query(
        `UPDATE pf_feature_flags 
         SET value = '{"defaultValue": "true", "allowedCountries": ["US", "CA"]}' 
         WHERE name = 'self_registration_enabled'`
      );

      // Mock geo-location
      jest.spyOn(geoService, 'getCountry')
        .mockResolvedValueOnce('UK')
        .mockResolvedValueOnce('US');

      // UK request should be blocked
      const ukResponse = await request(server)
        .post('/api/auth/register')
        .send({
          email: 'uk@example.com',
          username: 'ukuser',
          password: 'SecurePass123!'
        })
        .set('X-Forwarded-For', '81.2.69.142');

      expect(ukResponse.status).toBe(503);

      // US request should be allowed
      const usResponse = await request(server)
        .post('/api/auth/register')
        .send({
          email: 'us@example.com',
          username: 'ususer',
          password: 'SecurePass123!'
        })
        .set('X-Forwarded-For', '72.229.28.185');

      expect(usResponse.status).toBe(201);
    });
  });

  describe('Emergency Controls', () => {
    test('should auto-disable on distributed attack', async () => {
      // Simulate distributed attack from multiple IPs
      const promises = [];
      for (let i = 0; i < 100; i++) {
        promises.push(
          request(server)
            .post('/api/auth/register')
            .send({
              email: `attack${i}@example.com`,
              username: `attack${i}`,
              password: 'password123'
            })
            .set('X-Forwarded-For', `192.168.${Math.floor(i/256)}.${i%256}`)
        );
      }

      await Promise.all(promises);

      // Check if registration was auto-disabled
      const flag = await db.query(
        'SELECT * FROM pf_feature_flags WHERE name = ?',
        ['self_registration_enabled']
      );

      expect(flag.rows[0].enabled).toBe(false);
      expect(flag.rows[0].value).toContain('EMERGENCY');
    });

    test('should clear pending registrations on emergency disable', async () => {
      // Add some pending registrations
      await db.query(
        'INSERT INTO pf_pending_registrations (email, token) VALUES (?, ?), (?, ?)',
        ['pending1@example.com', 'token1', 'pending2@example.com', 'token2']
      );

      // Trigger emergency disable
      await request(server)
        .post('/api/auth/admin/registration/emergency-disable')
        .send({ reason: 'Manual emergency disable' })
        .set('Authorization', 'Bearer admin-token');

      // Check pending registrations were cleared
      const pending = await db.query('SELECT * FROM pf_pending_registrations');
      expect(pending.rows).toHaveLength(0);
    });
  });

  describe('Email Verification', () => {
    test('should verify email with valid token', async () => {
      // Create pending registration
      const token = 'valid-verification-token';
      await db.query(
        'INSERT INTO pf_pending_registrations (email, username, token, expires_at) VALUES (?, ?, ?, ?)',
        ['verify@example.com', 'verifyuser', token, new Date(Date.now() + 3600000)]
      );

      // Act
      const response = await request(server)
        .get(`/api/auth/verify-email?token=${token}`);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('verified');
    });

    test('should reject expired verification token', async () => {
      // Create expired token
      const token = 'expired-token';
      await db.query(
        'INSERT INTO pf_pending_registrations (email, username, token, expires_at) VALUES (?, ?, ?, ?)',
        ['expired@example.com', 'expireduser', token, new Date(Date.now() - 3600000)]
      );

      // Act
      const response = await request(server)
        .get(`/api/auth/verify-email?token=${token}`);

      // Assert
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('expired');
    });

    test('should send welcome email after verification', async () => {
      // Arrange
      const emailSpy = jest.spyOn(mockEmailService, 'sendWelcomeEmail');
      const token = 'welcome-token';
      
      await db.query(
        'INSERT INTO pf_pending_registrations (email, username, token, expires_at) VALUES (?, ?, ?, ?)',
        ['welcome@example.com', 'welcomeuser', token, new Date(Date.now() + 3600000)]
      );

      // Act
      await request(server)
        .get(`/api/auth/verify-email?token=${token}`);

      // Assert
      expect(emailSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'welcome@example.com'
        })
      );
    });
  });

  describe('Admin Monitoring', () => {
    test('should provide registration metrics', async () => {
      // Act
      const response = await request(server)
        .get('/api/admin/registration/metrics')
        .set('Authorization', 'Bearer admin-token');

      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('totalAttempts');
      expect(response.body).toHaveProperty('successfulRegistrations');
      expect(response.body).toHaveProperty('failedAttempts');
      expect(response.body).toHaveProperty('blockedIPs');
      expect(response.body).toHaveProperty('uniqueIPs');
    });

    test('should provide real-time alerts', async () => {
      // Simulate suspicious activity
      const ipAddress = '192.168.1.250';
      for (let i = 0; i < 10; i++) {
        await request(server)
          .post('/api/auth/register')
          .send({
            email: `alert${i}@example.com`,
            username: `alert${i}`,
            password: 'weak'
          })
          .set('X-Forwarded-For', ipAddress);
      }

      // Check alerts
      const response = await request(server)
        .get('/api/admin/registration/alerts')
        .set('Authorization', 'Bearer admin-token');

      expect(response.status).toBe(200);
      expect(response.body.alerts).toHaveLength(1);
      expect(response.body.alerts[0]).toHaveProperty('type', 'rapid_attempts');
      expect(response.body.alerts[0]).toHaveProperty('ipAddress', ipAddress);
    });
  });
});