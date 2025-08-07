/**
 * Authentication Integration Tests
 */

const request = require('supertest');
const app = require('../../src/api/app');
const { AppError } = require('../../src/api/middleware/errorHandler');

describe('Authentication Endpoints', () => {
  let testUser;
  let authToken;
  let refreshToken;

  beforeEach(() => {
    testUser = {
      username: 'testuser',
      email: 'test@example.com',
      password: 'Test123!@#',
      firstName: 'Test',
      lastName: 'User'
    };
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send(testUser)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data).toHaveProperty('token');
      expect(response.body.data).toHaveProperty('refreshToken');
      expect(response.body.data.user.username).toBe(testUser.username);
      expect(response.body.data.user.email).toBe(testUser.email);
      expect(response.body.data.user).not.toHaveProperty('password');
    });

    it('should fail with missing required fields', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'testuser'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Validation failed');
    });

    it('should fail with invalid email format', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          ...testUser,
          email: 'invalid-email'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toContainEqual(
        expect.objectContaining({
          field: 'email',
          message: expect.stringContaining('email')
        })
      );
    });

    it('should fail with weak password', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          ...testUser,
          password: '123'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toContainEqual(
        expect.objectContaining({
          field: 'password',
          message: expect.stringContaining('password')
        })
      );
    });

    it('should fail with duplicate username', async () => {
      // First registration
      await request(app)
        .post('/api/auth/register')
        .send(testUser)
        .expect(201);

      // Duplicate registration
      const response = await request(app)
        .post('/api/auth/register')
        .send(testUser)
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('already exists');
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      // Register a user first
      await request(app)
        .post('/api/auth/register')
        .send(testUser);
    });

    it('should login successfully with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: testUser.username,
          password: testUser.password
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data).toHaveProperty('token');
      expect(response.body.data).toHaveProperty('refreshToken');
      
      authToken = response.body.data.token;
      refreshToken = response.body.data.refreshToken;
    });

    it('should login with email instead of username', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: testUser.email,
          password: testUser.password
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('token');
    });

    it('should fail with invalid password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: testUser.username,
          password: 'wrongpassword'
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid credentials');
    });

    it('should fail with non-existent username', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'nonexistent',
          password: testUser.password
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid credentials');
    });

    it('should fail with missing credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Validation failed');
    });
  });

  describe('POST /api/auth/refresh', () => {
    beforeEach(async () => {
      // Register and login
      await request(app)
        .post('/api/auth/register')
        .send(testUser);

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username: testUser.username,
          password: testUser.password
        });

      authToken = loginResponse.body.data.token;
      refreshToken = loginResponse.body.data.refreshToken;
    });

    it('should refresh token successfully', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({
          refreshToken
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('token');
      expect(response.body.data).toHaveProperty('refreshToken');
      expect(response.body.data.token).not.toBe(authToken);
    });

    it('should fail with invalid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({
          refreshToken: 'invalid-token'
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid token');
    });

    it('should fail with missing refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/logout', () => {
    beforeEach(async () => {
      // Register and login
      await request(app)
        .post('/api/auth/register')
        .send(testUser);

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username: testUser.username,
          password: testUser.password
        });

      authToken = loginResponse.body.data.token;
    });

    it('should logout successfully', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('Logged out');
    });

    it('should fail without authentication', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Unauthorized');
    });

    it('should invalidate token after logout', async () => {
      // Logout
      await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Try to use the same token
      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/auth/verify-email', () => {
    it('should verify email with valid token', async () => {
      // This would typically require a verification token
      // For testing, we'll simulate the flow
      const verificationToken = 'valid-verification-token';
      
      const response = await request(app)
        .get(`/api/auth/verify-email?token=${verificationToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('verified');
    });

    it('should fail with invalid verification token', async () => {
      const response = await request(app)
        .get('/api/auth/verify-email?token=invalid-token')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid');
    });
  });

  describe('POST /api/auth/forgot-password', () => {
    beforeEach(async () => {
      await request(app)
        .post('/api/auth/register')
        .send(testUser);
    });

    it('should send password reset email', async () => {
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({
          email: testUser.email
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('reset');
    });

    it('should succeed even with non-existent email (security)', async () => {
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({
          email: 'nonexistent@example.com'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('reset');
    });
  });

  describe('POST /api/auth/reset-password', () => {
    it('should reset password with valid token', async () => {
      const resetToken = 'valid-reset-token';
      const newPassword = 'NewPassword123!@#';

      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: resetToken,
          password: newPassword
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('Password reset');
    });

    it('should fail with invalid reset token', async () => {
      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: 'invalid-token',
          password: 'NewPassword123!@#'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid');
    });

    it('should fail with weak new password', async () => {
      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: 'valid-reset-token',
          password: '123'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toContainEqual(
        expect.objectContaining({
          field: 'password'
        })
      );
    });
  });

  describe('Authentication Middleware', () => {
    beforeEach(async () => {
      // Register and login
      await request(app)
        .post('/api/auth/register')
        .send(testUser);

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username: testUser.username,
          password: testUser.password
        });

      authToken = loginResponse.body.data.token;
    });

    it('should allow access with valid token', async () => {
      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should deny access without token', async () => {
      const response = await request(app)
        .get('/api/users/profile')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Unauthorized');
    });

    it('should deny access with malformed token', async () => {
      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', 'Bearer malformed-token')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid token');
    });

    it('should deny access with expired token', async () => {
      // Create an expired token
      const jwt = require('jsonwebtoken');
      const expiredToken = jwt.sign(
        { id: 'user-id', username: 'testuser' },
        process.env.JWT_SECRET,
        { expiresIn: '-1h' }
      );

      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('expired');
    });
  });
});