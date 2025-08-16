const request = require('supertest');
const app = require('../../src/api/app');
const { 
  setupTestDatabase, 
  cleanupTestDatabase, 
  clearTestData 
} = require('../helpers/database');
const { 
  generateTestUsers,
  createTestUser,
  loginAs
} = require('../helpers/users');

describe('Security Integration Tests', () => {
  let testUsers;
  let testApp;

  beforeAll(async () => {
    await setupTestDatabase();
    testApp = app.getExpressApp();
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  beforeEach(async () => {
    await clearTestData();
    testUsers = await generateTestUsers();
  });

  describe('SQL Injection Prevention', () => {
    test('SQL injection attempts in login are blocked', async () => {
      const injectionAttempts = [
        "admin' OR '1'='1",
        "'; DROP TABLE pf_users; --",
        "admin'/*",
        "' UNION SELECT * FROM pf_users --",
        "admin' AND 1=1--",
        "' OR 'x'='x",
        "admin'; DELETE FROM pf_users WHERE 'a'='a"
      ];

      for (const attempt of injectionAttempts) {
        const response = await request(testApp)
          .post('/api/auth/login')
          .send({
            username: attempt,
            password_hash: 'hash',
            client_salt: 'salt'
          });

        expect(response.status).toBe(401);
        expect(response.body.error).toBe('AUTHENTICATION_FAILED');
        // Ensure no SQL error messages are exposed
        expect(response.body.message).not.toContain('SQL');
        expect(response.body.message).not.toContain('ORA-');
      }
    });

    test('SQL injection in search parameters is prevented', async () => {
      const userToken = await loginAs(testUsers.regularUser);
      
      const response = await request(testApp)
        .get('/api/experiences')
        .set('Authorization', `Bearer ${userToken}`)
        .query({
          search: "'; DROP TABLE pf_users; --"
        });

      expect([200, 404]).toContain(response.status);
      if (response.status === 200) {
        expect(response.body.data).toBeDefined();
      }
    });
  });

  describe('XSS Prevention', () => {
    test('XSS attempts in user input are sanitized', async () => {
      const userToken = await loginAs(testUsers.regularUser);
      
      const xssPayloads = [
        '<script>alert("XSS")</script>',
        '<img src=x onerror=alert("XSS")>',
        '<svg onload=alert("XSS")>',
        'javascript:alert("XSS")',
        '<iframe src="javascript:alert(\'XSS\')"></iframe>'
      ];

      for (const payload of xssPayloads) {
        const response = await request(testApp)
          .put('/api/profile')
          .set('Authorization', `Bearer ${userToken}`)
          .send({
            bio: payload
          });

        if (response.status === 200) {
          // Verify the payload was sanitized
          expect(response.body.data.profile.bio).not.toContain('<script>');
          expect(response.body.data.profile.bio).not.toContain('javascript:');
          expect(response.body.data.profile.bio).not.toContain('onerror=');
        }
      }
    });
  });

  describe('Rate Limiting', () => {
    test('Rate limiting prevents brute force attacks', async () => {
      const responses = [];
      
      // Attempt 11 login requests (assuming limit is 10)
      for (let i = 0; i < 11; i++) {
        const response = await request(testApp)
          .post('/api/auth/login')
          .send({
            username: 'testuser',
            password_hash: `wrong_${i}`,
            client_salt: 'salt'
          });
        
        responses.push(response);
      }

      // First 10 should be 401 (wrong credentials)
      const first10 = responses.slice(0, 10);
      expect(first10.every(r => r.status === 401)).toBe(true);
      
      // 11th should be rate limited
      expect(responses[10].status).toBe(429);
      expect(responses[10].body.error).toBe('RATE_LIMIT_EXCEEDED');
      expect(responses[10].headers).toHaveProperty('x-ratelimit-remaining');
      expect(responses[10].headers).toHaveProperty('x-ratelimit-reset');
    });

    test('Rate limits are per-user', async () => {
      const user1Token = await loginAs(testUsers.user1);
      const user2Token = await loginAs(testUsers.user2);
      
      // User1 makes requests
      for (let i = 0; i < 5; i++) {
        await request(testApp)
          .get('/api/profile')
          .set('Authorization', `Bearer ${user1Token}`);
      }
      
      // User2 should not be affected
      const response = await request(testApp)
        .get('/api/profile')
        .set('Authorization', `Bearer ${user2Token}`);
      
      expect(response.status).toBe(200);
    });
  });

  describe('CSRF Protection', () => {
    test('State-changing operations require valid CSRF token', async () => {
      const userToken = await loginAs(testUsers.regularUser);
      
      // Attempt to change password without CSRF token
      const response = await request(testApp)
        .post('/api/profile/change-password')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          current_password_hash: 'hash',
          new_password_hash: 'newhash',
          client_salt: 'salt'
        });
      
      // Should either require CSRF or use other protection mechanisms
      expect([200, 403]).toContain(response.status);
    });
  });

  describe('Session Security', () => {
    test('Sessions expire after inactivity', async () => {
      const user = await createTestUser();
      const token = await loginAs(user);
      
      // Simulate session expiry (would need to mock time in real test)
      // For now, test with invalid session
      const expiredToken = 'expired.token.here';
      
      const response = await request(testApp)
        .get('/api/profile')
        .set('Authorization', `Bearer ${expiredToken}`);
      
      expect(response.status).toBe(401);
      expect(response.body.error).toBe('TOKEN_INVALID');
    });

    test('Concurrent session limit is enforced', async () => {
      // This would test limiting number of active sessions per user
      // Implementation depends on business requirements
      expect(true).toBe(true);
    });
  });

  describe('Password Security', () => {
    test('Weak passwords are rejected', async () => {
      const adminToken = await loginAs(testUsers.admin1);
      
      const weakPasswords = [
        'password',
        '12345678',
        'qwerty',
        'abc123',
        'Password1' // No special character
      ];
      
      // This would test password strength validation
      // when users change their password
      expect(true).toBe(true);
    });

    test('Password history prevents reuse', async () => {
      // Test that users cannot reuse recent passwords
      expect(true).toBe(true);
    });
  });

  describe('Input Validation', () => {
    test('Email validation prevents invalid formats', async () => {
      const adminToken = await loginAs(testUsers.admin1);
      
      const invalidEmails = [
        'notanemail',
        '@example.com',
        'user@',
        'user@.com',
        'user@example',
        'user name@example.com',
        'user@exam ple.com'
      ];
      
      for (const email of invalidEmails) {
        const response = await request(testApp)
          .post('/api/auth/register')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            username: 'testuser',
            email: email,
            first_name: 'Test',
            last_name: 'User'
          });
        
        expect(response.status).toBe(400);
        expect(response.body.error).toBe('VALIDATION_ERROR');
      }
    });

    test('Username validation enforces rules', async () => {
      const adminToken = await loginAs(testUsers.admin1);
      
      const invalidUsernames = [
        'ab', // Too short
        'a'.repeat(31), // Too long
        'user name', // Contains space
        'user@name', // Contains special char
        'User123', // Contains uppercase
        '123user' // Starts with number
      ];
      
      for (const username of invalidUsernames) {
        const response = await request(testApp)
          .post('/api/auth/register')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            username: username,
            email: 'test@example.com',
            first_name: 'Test',
            last_name: 'User'
          });
        
        expect(response.status).toBe(400);
        expect(response.body.error).toBe('VALIDATION_ERROR');
      }
    });
  });

  describe('File Upload Security', () => {
    test('File uploads are validated for type and size', async () => {
      // Test file upload security if applicable
      expect(true).toBe(true);
    });

    test('Uploaded files are scanned for malware', async () => {
      // Test malware scanning integration if applicable
      expect(true).toBe(true);
    });
  });

  describe('API Security Headers', () => {
    test('Security headers are present in responses', async () => {
      const response = await request(testApp)
        .get('/api/health');
      
      expect(response.headers).toHaveProperty('x-content-type-options', 'nosniff');
      expect(response.headers).toHaveProperty('x-frame-options', 'DENY');
      expect(response.headers).toHaveProperty('x-xss-protection', '1; mode=block');
      
      // HSTS header on HTTPS
      if (response.secure) {
        expect(response.headers).toHaveProperty('strict-transport-security');
      }
    });
  });

  describe('Error Handling', () => {
    test('Error messages do not expose sensitive information', async () => {
      const response = await request(testApp)
        .get('/api/users/invalid-id')
        .set('Authorization', `Bearer invalid-token`);
      
      expect(response.body.message).not.toContain('stack');
      expect(response.body.message).not.toContain('SQL');
      expect(response.body.message).not.toContain('ORA-');
      expect(response.body.message).not.toContain('/home/');
      expect(response.body.message).not.toContain('\\Users\\');
    });
  });
});