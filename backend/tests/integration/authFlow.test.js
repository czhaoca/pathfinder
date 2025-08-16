const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const { query } = require('../../src/database/connection');
const passwordService = require('../../src/services/passwordService');

// Mock authenticated user for protected endpoints
const mockAuthUser = {
  userId: 'test-admin-id',
  username: 'testadmin',
  role: 'admin'
};

// Helper to generate auth token for tests
function generateTestToken(user = mockAuthUser) {
  const jwt = require('jsonwebtoken');
  return jwt.sign(user, process.env.JWT_SECRET || 'test-secret', { expiresIn: '15m' });
}

// Helper to hash password client-side (simulating frontend)
async function hashPasswordClientSide(password) {
  const salt = crypto.randomBytes(32).toString('hex');
  const hash = crypto.createHash('sha256')
    .update(password + salt)
    .digest('hex');
  return { hash, salt };
}

describe('Authentication API Integration Tests', () => {
  let testUserId;
  let testToken;
  let retrievalToken;
  
  beforeAll(async () => {
    // Setup test database tables if needed
    // This would normally be handled by migrations
  });
  
  afterAll(async () => {
    // Cleanup test data
    if (testUserId) {
      await query('DELETE FROM pf_user_passwords WHERE user_id = :userId', { userId: testUserId });
      await query('DELETE FROM pf_users WHERE id = :userId', { userId: testUserId });
    }
  });
  
  describe('POST /auth/register', () => {
    test('should register a new user and return retrieval token', async () => {
      const authToken = generateTestToken();
      
      const response = await request(app)
        .post('/auth/register')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          username: 'testuser_' + Date.now(),
          email: `test_${Date.now()}@example.com`,
          firstName: 'Test',
          lastName: 'User',
          role: 'user'
        });
      
      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.user.id).toBeDefined();
      expect(response.body.data.password_token).toBeDefined();
      expect(response.body.data.token_expires_at).toBeDefined();
      
      // Store for cleanup and further tests
      testUserId = response.body.data.user.id;
      retrievalToken = response.body.data.password_token;
    });
    
    test('should reject registration with password in request', async () => {
      const authToken = generateTestToken();
      
      const response = await request(app)
        .post('/auth/register')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          username: 'testuser2',
          email: 'test2@example.com',
          firstName: 'Test',
          lastName: 'User',
          password: 'ShouldNotBeHere123!' // This should be rejected
        });
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Password should not be sent');
    });
    
    test('should reject duplicate username', async () => {
      const authToken = generateTestToken();
      const username = 'duplicate_user_' + Date.now();
      
      // First registration
      await request(app)
        .post('/auth/register')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          username,
          email: 'first@example.com',
          firstName: 'First',
          lastName: 'User'
        });
      
      // Attempt duplicate
      const response = await request(app)
        .post('/auth/register')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          username,
          email: 'second@example.com',
          firstName: 'Second',
          lastName: 'User'
        });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Username already exists');
    });
    
    test('should require authentication to register users', async () => {
      const response = await request(app)
        .post('/auth/register')
        .send({
          username: 'testuser3',
          email: 'test3@example.com',
          firstName: 'Test',
          lastName: 'User'
        });
      
      expect(response.status).toBe(401);
    });
  });
  
  describe('POST /auth/password/retrieve', () => {
    test('should retrieve temporary password with valid token', async () => {
      // Assumes retrievalToken was set in registration test
      if (!retrievalToken) {
        console.warn('Skipping test - no retrieval token available');
        return;
      }
      
      const response = await request(app)
        .post('/auth/password/retrieve')
        .send({
          password_token: retrievalToken
        });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.username).toBeDefined();
      expect(response.body.data.temporary_password).toBeDefined();
      expect(response.body.data.expires_at).toBeDefined();
      expect(response.body.data.must_change).toBe(true);
    });
    
    test('should reject reuse of retrieval token', async () => {
      // Token was already used in previous test
      if (!retrievalToken) {
        console.warn('Skipping test - no retrieval token available');
        return;
      }
      
      const response = await request(app)
        .post('/auth/password/retrieve')
        .send({
          password_token: retrievalToken
        });
      
      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid or expired token');
    });
    
    test('should reject invalid token', async () => {
      const response = await request(app)
        .post('/auth/password/retrieve')
        .send({
          password_token: 'invalid-token-12345'
        });
      
      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });
  
  describe('POST /auth/login', () => {
    let testUsername;
    let testPassword;
    
    beforeAll(async () => {
      // Create a test user with known password for login tests
      testUsername = 'logintest_' + Date.now();
      testPassword = 'TestP@ssw0rd123!';
      
      const userId = 'login-test-user-id';
      await query(`
        INSERT INTO pf_users (id, username, email, first_name, last_name, role, status)
        VALUES (:id, :username, :email, :firstName, :lastName, :role, :status)
      `, {
        id: userId,
        username: testUsername,
        email: `${testUsername}@example.com`,
        firstName: 'Login',
        lastName: 'Test',
        role: 'user',
        status: 'active'
      });
      
      // Hash and store password
      const { hash, salt } = await hashPasswordClientSide(testPassword);
      await passwordService.storePassword(userId, hash, salt, false);
    });
    
    test('should login with correct hashed password', async () => {
      const { hash, salt } = await hashPasswordClientSide(testPassword);
      
      const response = await request(app)
        .post('/auth/login')
        .send({
          username: testUsername,
          password_hash: hash,
          client_salt: salt
        });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.token).toBeDefined();
      expect(response.body.data.expiresAt).toBeDefined();
      
      testToken = response.body.data.token;
    });
    
    test('should reject plain text password', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          username: testUsername,
          password: testPassword // Plain text - should be rejected
        });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Plain text passwords are not accepted');
    });
    
    test('should reject invalid credentials', async () => {
      const { hash, salt } = await hashPasswordClientSide('WrongPassword123!');
      
      const response = await request(app)
        .post('/auth/login')
        .send({
          username: testUsername,
          password_hash: hash,
          client_salt: salt
        });
      
      expect(response.status).toBe(401);
      expect(response.body.error).toContain('Invalid credentials');
    });
    
    test('should reject non-existent user', async () => {
      const { hash, salt } = await hashPasswordClientSide('AnyPassword123!');
      
      const response = await request(app)
        .post('/auth/login')
        .send({
          username: 'nonexistentuser',
          password_hash: hash,
          client_salt: salt
        });
      
      expect(response.status).toBe(401);
      expect(response.body.error).toContain('Invalid credentials');
    });
  });
  
  describe('POST /auth/password/change', () => {
    test('should change password when authenticated', async () => {
      if (!testToken) {
        console.warn('Skipping test - no auth token available');
        return;
      }
      
      const oldPassword = 'TestP@ssw0rd123!';
      const newPassword = 'NewP@ssw0rd456!';
      
      const { hash: oldHash, salt: oldSalt } = await hashPasswordClientSide(oldPassword);
      const { hash: newHash, salt: newSalt } = await hashPasswordClientSide(newPassword);
      
      const response = await request(app)
        .post('/auth/password/change')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          old_password_hash: oldHash,
          old_client_salt: oldSalt,
          new_password_hash: newHash,
          new_client_salt: newSalt
        });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.sessions_invalidated).toBe(true);
    });
    
    test('should reject change with wrong current password', async () => {
      if (!testToken) {
        console.warn('Skipping test - no auth token available');
        return;
      }
      
      const { hash: oldHash, salt: oldSalt } = await hashPasswordClientSide('WrongOldPassword!');
      const { hash: newHash, salt: newSalt } = await hashPasswordClientSide('NewPassword123!');
      
      const response = await request(app)
        .post('/auth/password/change')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          old_password_hash: oldHash,
          old_client_salt: oldSalt,
          new_password_hash: newHash,
          new_client_salt: newSalt
        });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Current password is incorrect');
    });
    
    test('should require authentication', async () => {
      const { hash: oldHash, salt: oldSalt } = await hashPasswordClientSide('OldPass123!');
      const { hash: newHash, salt: newSalt } = await hashPasswordClientSide('NewPass123!');
      
      const response = await request(app)
        .post('/auth/password/change')
        .send({
          old_password_hash: oldHash,
          old_client_salt: oldSalt,
          new_password_hash: newHash,
          new_client_salt: newSalt
        });
      
      expect(response.status).toBe(401);
    });
  });
  
  describe('POST /auth/password/reset-request', () => {
    test('should accept valid email for reset', async () => {
      const response = await request(app)
        .post('/auth/password/reset-request')
        .send({
          email: 'test@example.com'
        });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('If the email exists');
    });
    
    test('should not reveal if email exists', async () => {
      const response = await request(app)
        .post('/auth/password/reset-request')
        .send({
          email: 'nonexistent@example.com'
        });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('If the email exists');
    });
    
    test('should rate limit reset requests', async () => {
      // Make multiple requests quickly
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(
          request(app)
            .post('/auth/password/reset-request')
            .send({ email: 'ratelimit@example.com' })
        );
      }
      
      const responses = await Promise.all(promises);
      const rateLimited = responses.some(r => r.status === 429);
      expect(rateLimited).toBe(true);
    });
  });
  
  describe('POST /auth/logout', () => {
    test('should logout authenticated user', async () => {
      if (!testToken) {
        console.warn('Skipping test - no auth token available');
        return;
      }
      
      const response = await request(app)
        .post('/auth/logout')
        .set('Authorization', `Bearer ${testToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      
      // Token should now be invalid
      const checkResponse = await request(app)
        .post('/auth/password/change')
        .set('Authorization', `Bearer ${testToken}`)
        .send({});
      
      expect(checkResponse.status).toBe(401);
    });
    
    test('should handle logout without token gracefully', async () => {
      const response = await request(app)
        .post('/auth/logout');
      
      expect(response.status).toBe(401);
    });
  });
});

describe('Security Edge Cases', () => {
  test('should handle SQL injection attempts', async () => {
    const { hash, salt } = await hashPasswordClientSide('test');
    
    const response = await request(app)
      .post('/auth/login')
      .send({
        username: "admin' OR '1'='1",
        password_hash: hash,
        client_salt: salt
      });
    
    expect(response.status).toBe(401);
    expect(response.body.error).toContain('Invalid credentials');
  });
  
  test('should handle XSS attempts in registration', async () => {
    const authToken = generateTestToken();
    
    const response = await request(app)
      .post('/auth/register')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        username: '<script>alert("xss")</script>',
        email: 'xss@example.com',
        firstName: '<img src=x onerror=alert(1)>',
        lastName: 'Test'
      });
    
    // Should either sanitize or reject
    if (response.status === 201) {
      expect(response.body.data.user.username).not.toContain('<script>');
      expect(response.body.data.user.firstName).not.toContain('<img');
    }
  });
  
  test('should handle very long inputs gracefully', async () => {
    const authToken = generateTestToken();
    const longString = 'a'.repeat(10000);
    
    const response = await request(app)
      .post('/auth/register')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        username: longString,
        email: `${longString}@example.com`,
        firstName: longString,
        lastName: longString
      });
    
    expect(response.status).toBeGreaterThanOrEqual(400);
  });
  
  test('should not leak timing information on user lookup', async () => {
    const timings = [];
    const { hash, salt } = await hashPasswordClientSide('test');
    
    // Test with existing user (if any) and non-existing users
    const usernames = ['admin', 'nonexistent1', 'nonexistent2', 'nonexistent3'];
    
    for (const username of usernames) {
      const start = Date.now();
      await request(app)
        .post('/auth/login')
        .send({
          username,
          password_hash: hash,
          client_salt: salt
        });
      const end = Date.now();
      timings.push(end - start);
    }
    
    // Check that timings are relatively consistent
    const avgTime = timings.reduce((a, b) => a + b, 0) / timings.length;
    const maxDeviation = Math.max(...timings.map(t => Math.abs(t - avgTime)));
    
    // Allow up to 100ms deviation (network variance)
    expect(maxDeviation).toBeLessThan(100);
  });
});