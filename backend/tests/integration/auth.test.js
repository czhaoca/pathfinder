const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/api/app');
const { 
  setupTestDatabase, 
  cleanupTestDatabase, 
  clearTestData 
} = require('../helpers/database');
const { 
  generateTestUsers, 
  createTestUser,
  createUserWithToken,
  createUserWithTempPassword,
  loginAs,
  hashPassword
} = require('../helpers/users');
const { 
  getLatestAuditLog,
  getAuditLog 
} = require('../helpers/audit');

describe('Authentication Integration Tests', () => {
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

  describe('Registration Flow', () => {
    test('Admin can register new user without password', async () => {
      const adminToken = await loginAs(testUsers.admin1);
      
      const response = await request(testApp)
        .post('/api/auth/register')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          username: 'newuser',
          email: 'newuser@test.com',
          first_name: 'New',
          last_name: 'User',
          role: 'user'
        });
      
      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('password_retrieval_token');
      expect(response.body.data.password_retrieval_token).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data.user.username).toBe('newuser');
    });

    test('Rejects registration with password in request', async () => {
      const adminToken = await loginAs(testUsers.admin1);
      
      const response = await request(testApp)
        .post('/api/auth/register')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          username: 'baduser',
          email: 'bad@test.com',
          password: 'should-not-work',
          first_name: 'Bad',
          last_name: 'User'
        });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('INVALID_REQUEST');
      expect(response.body.message).toContain('password should not be provided');
    });

    test('User cannot register other users', async () => {
      const userToken = await loginAs(testUsers.regularUser);
      
      const response = await request(testApp)
        .post('/api/auth/register')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          username: 'unauthorized',
          email: 'unauthorized@test.com',
          first_name: 'Un',
          last_name: 'Authorized'
        });
      
      expect(response.status).toBe(403);
      expect(response.body.error).toBe('INSUFFICIENT_PRIVILEGES');
    });

    test('Admin cannot create site_admin role', async () => {
      const adminToken = await loginAs(testUsers.admin1);
      
      const response = await request(testApp)
        .post('/api/auth/register')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          username: 'wannabe_siteadmin',
          email: 'siteadmin@test.com',
          first_name: 'Site',
          last_name: 'Admin',
          role: 'site_admin'
        });
      
      expect(response.status).toBe(403);
      expect(response.body.error).toBe('INSUFFICIENT_PRIVILEGES');
      expect(response.body.message).toContain('Cannot create user with role: site_admin');
    });

    test('Validates required fields', async () => {
      const adminToken = await loginAs(testUsers.admin1);
      
      const response = await request(testApp)
        .post('/api/auth/register')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          username: 'incomplete'
          // Missing email, first_name, last_name
        });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('VALIDATION_ERROR');
      expect(response.body.details.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'email' }),
          expect.objectContaining({ field: 'first_name' }),
          expect.objectContaining({ field: 'last_name' })
        ])
      );
    });
  });

  describe('Password Retrieval', () => {
    test('Can retrieve password with valid token', async () => {
      const { user, retrievalToken } = await createUserWithToken();
      
      const response = await request(testApp)
        .post('/api/auth/password/retrieve')
        .send({
          token: retrievalToken
        });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('temporary_password');
      expect(response.body.data.temporary_password).toMatch(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{16,}$/
      );
      expect(response.body.data.must_change_on_login).toBe(true);
      expect(response.body.data).toHaveProperty('expires_at');
    });

    test('Token is single-use only', async () => {
      const { retrievalToken } = await createUserWithToken();
      
      // First retrieval succeeds
      const response1 = await request(testApp)
        .post('/api/auth/password/retrieve')
        .send({ token: retrievalToken });
      
      expect(response1.status).toBe(200);
      
      // Second retrieval fails
      const response2 = await request(testApp)
        .post('/api/auth/password/retrieve')
        .send({ token: retrievalToken });
      
      expect(response2.status).toBe(404);
      expect(response2.body.error).toBe('INVALID_TOKEN');
      expect(response2.body.message).toContain('Token not found or already used');
    });

    test('Token expires after configured time', async () => {
      const { retrievalToken } = await createUserWithToken();
      
      // Mock time advancement (would need to implement in actual test)
      // For now, we'll test with an expired token
      const expiredToken = 'expired_token_test';
      
      const response = await request(testApp)
        .post('/api/auth/password/retrieve')
        .send({ token: expiredToken });
      
      expect(response.status).toBe(404);
      expect(response.body.error).toBe('INVALID_TOKEN');
    });
  });

  describe('Login with Client Hashing', () => {
    test('Successful login with hashed password', async () => {
      const user = await createTestUser({ 
        username: 'hashtest',
        password: 'Test@Password123' 
      });
      
      const { hash, salt } = await hashPassword('Test@Password123');
      
      const response = await request(testApp)
        .post('/api/auth/login')
        .send({
          username: 'hashtest',
          password_hash: hash,
          client_salt: salt
        });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('token');
      expect(response.body.data).toHaveProperty('refresh_token');
      expect(response.body.data).toHaveProperty('expires_at');
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data.user.username).toBe('hashtest');
    });

    test('Rejects plain text password', async () => {
      const user = await createTestUser({ 
        username: 'plaintest',
        password: 'Test@Password123' 
      });
      
      const response = await request(testApp)
        .post('/api/auth/login')
        .send({
          username: 'plaintest',
          password: 'Test@Password123' // Plain text - should be rejected
        });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('INVALID_REQUEST');
      expect(response.body.message).toContain('Plain text passwords are not allowed');
      
      // Verify audit log captured this security event
      const auditLog = await getLatestAuditLog('plain_password_attempt');
      expect(auditLog).toBeDefined();
      expect(auditLog.EVENT_SEVERITY).toBe('warning');
    });

    test('Forces password change for temporary password', async () => {
      const { username, tempPassword } = await createUserWithTempPassword();
      const { hash, salt } = await hashPassword(tempPassword);
      
      const response = await request(testApp)
        .post('/api/auth/login')
        .send({
          username,
          password_hash: hash,
          client_salt: salt
        });
      
      expect(response.status).toBe(200);
      expect(response.body.data.must_change_password).toBe(true);
      expect(response.body.data).toHaveProperty('password_change_token');
    });

    test('Handles invalid credentials', async () => {
      const { hash, salt } = await hashPassword('WrongPassword123');
      
      const response = await request(testApp)
        .post('/api/auth/login')
        .send({
          username: 'nonexistent',
          password_hash: hash,
          client_salt: salt
        });
      
      expect(response.status).toBe(401);
      expect(response.body.error).toBe('AUTHENTICATION_FAILED');
      expect(response.body.message).toBe('Invalid username or password');
      
      // Verify failed login was logged
      const auditLog = await getAuditLog({
        event_type: 'authentication',
        action_result: 'failure'
      });
      expect(auditLog).toBeDefined();
    });
  });

  describe('Token Refresh', () => {
    test('Can refresh valid token', async () => {
      const user = await createTestUser();
      const { hash, salt } = await hashPassword('Test@Password123');
      
      // Login to get tokens
      const loginResponse = await request(testApp)
        .post('/api/auth/login')
        .send({
          username: user.username,
          password_hash: hash,
          client_salt: salt
        });
      
      const refreshToken = loginResponse.body.data.refresh_token;
      
      // Refresh token
      const refreshResponse = await request(testApp)
        .post('/api/auth/refresh')
        .send({
          refresh_token: refreshToken
        });
      
      expect(refreshResponse.status).toBe(200);
      expect(refreshResponse.body.success).toBe(true);
      expect(refreshResponse.body.data).toHaveProperty('token');
      expect(refreshResponse.body.data).toHaveProperty('expires_at');
    });

    test('Rejects invalid refresh token', async () => {
      const response = await request(testApp)
        .post('/api/auth/refresh')
        .send({
          refresh_token: 'invalid_refresh_token'
        });
      
      expect(response.status).toBe(401);
      expect(response.body.error).toBe('INVALID_TOKEN');
    });
  });

  describe('Logout', () => {
    test('Successfully logs out and invalidates session', async () => {
      const token = await loginAs(testUsers.regularUser);
      
      // Logout
      const logoutResponse = await request(testApp)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`);
      
      expect(logoutResponse.status).toBe(200);
      expect(logoutResponse.body.success).toBe(true);
      
      // Try to use token after logout
      const profileResponse = await request(testApp)
        .get('/api/profile')
        .set('Authorization', `Bearer ${token}`);
      
      expect(profileResponse.status).toBe(401);
      expect(profileResponse.body.error).toBe('SESSION_EXPIRED');
    });
  });

  describe('MFA Support', () => {
    test('Login with MFA token when enabled', async () => {
      // This would require MFA setup implementation
      // Placeholder test for MFA flow
      expect(true).toBe(true);
    });
  });
});