const request = require('supertest');
const app = require('../../src/api/app');
const DatabaseService = require('../../src/services/database');

describe('Auth API Integration', () => {
  let server;
  let database;
  let testUser;

  beforeAll(async () => {
    // Initialize database
    database = new DatabaseService();
    await database.initialize();

    // Start server
    server = app.listen(0); // Random port
  });

  afterAll(async () => {
    // Cleanup
    if (server) {
      await new Promise(resolve => server.close(resolve));
    }
    if (database) {
      await database.close();
    }
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user', async () => {
      const userData = {
        username: `testuser_${Date.now()}`,
        email: `test_${Date.now()}@example.com`,
        password: 'TestPassword123!',
        firstName: 'Test',
        lastName: 'User'
      };

      const response = await request(server)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body).toMatchObject({
        success: true,
        message: 'User registered successfully',
        data: expect.objectContaining({
          token: expect.any(String),
          refreshToken: expect.any(String),
          user: expect.objectContaining({
            username: userData.username,
            email: userData.email
          })
        })
      });

      testUser = response.body.data;
    });

    it('should reject duplicate username', async () => {
      const userData = {
        username: testUser.user.username,
        email: 'different@example.com',
        password: 'TestPassword123!',
        firstName: 'Test',
        lastName: 'User'
      };

      const response = await request(server)
        .post('/api/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.stringContaining('username')
      });
    });

    it('should validate password requirements', async () => {
      const userData = {
        username: 'newuser',
        email: 'new@example.com',
        password: 'weak',
        firstName: 'Test',
        lastName: 'User'
      };

      const response = await request(server)
        .post('/api/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        errors: expect.objectContaining({
          password: expect.any(String)
        })
      });
    });

    it('should validate email format', async () => {
      const userData = {
        username: 'newuser',
        email: 'invalid-email',
        password: 'TestPassword123!',
        firstName: 'Test',
        lastName: 'User'
      };

      const response = await request(server)
        .post('/api/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        errors: expect.objectContaining({
          email: expect.any(String)
        })
      });
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login with valid credentials', async () => {
      const credentials = {
        username: testUser.user.username,
        password: 'TestPassword123!'
      };

      const response = await request(server)
        .post('/api/auth/login')
        .send(credentials)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Login successful',
        data: expect.objectContaining({
          token: expect.any(String),
          refreshToken: expect.any(String),
          user: expect.objectContaining({
            username: credentials.username
          })
        })
      });
    });

    it('should reject invalid password', async () => {
      const credentials = {
        username: testUser.user.username,
        password: 'WrongPassword123!'
      };

      const response = await request(server)
        .post('/api/auth/login')
        .send(credentials)
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.stringContaining('Invalid')
      });
    });

    it('should reject non-existent user', async () => {
      const credentials = {
        username: 'nonexistentuser',
        password: 'TestPassword123!'
      };

      const response = await request(server)
        .post('/api/auth/login')
        .send(credentials)
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.stringContaining('Invalid')
      });
    });

    it('should handle missing credentials', async () => {
      const response = await request(server)
        .post('/api/auth/login')
        .send({})
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        errors: expect.any(Object)
      });
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('should refresh token with valid refresh token', async () => {
      const response = await request(server)
        .post('/api/auth/refresh')
        .send({ refreshToken: testUser.refreshToken })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Token refreshed successfully',
        data: expect.objectContaining({
          token: expect.any(String),
          refreshToken: expect.any(String)
        })
      });
    });

    it('should reject invalid refresh token', async () => {
      const response = await request(server)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'invalid-token' })
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.any(String)
      });
    });

    it('should handle missing refresh token', async () => {
      const response = await request(server)
        .post('/api/auth/refresh')
        .send({})
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.stringContaining('required')
      });
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should logout authenticated user', async () => {
      const response = await request(server)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${testUser.token}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Logged out successfully'
      });
    });

    it('should reject logout without token', async () => {
      const response = await request(server)
        .post('/api/auth/logout')
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.stringContaining('Authentication')
      });
    });

    it('should reject logout with invalid token', async () => {
      const response = await request(server)
        .post('/api/auth/logout')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.stringContaining('Invalid')
      });
    });
  });

  describe('Authentication Middleware', () => {
    it('should protect routes requiring authentication', async () => {
      const response = await request(server)
        .get('/api/profile')
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.stringContaining('Authentication')
      });
    });

    it('should allow access with valid token', async () => {
      const response = await request(server)
        .get('/api/profile')
        .set('Authorization', `Bearer ${testUser.token}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: expect.objectContaining({
          username: testUser.user.username
        })
      });
    });

    it('should handle malformed token', async () => {
      const response = await request(server)
        .get('/api/profile')
        .set('Authorization', 'Bearer malformed.token.here')
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.stringContaining('Invalid')
      });
    });

    it('should handle expired token', async () => {
      // Create an expired token
      const jwt = require('jsonwebtoken');
      const expiredToken = jwt.sign(
        { userId: 'test', exp: Math.floor(Date.now() / 1000) - 3600 },
        process.env.JWT_SECRET || 'test-secret'
      );

      const response = await request(server)
        .get('/api/profile')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.stringContaining('expired')
      });
    });
  });

  describe('Rate Limiting', () => {
    it('should rate limit excessive requests', async () => {
      const promises = [];
      
      // Make many rapid requests
      for (let i = 0; i < 20; i++) {
        promises.push(
          request(server)
            .post('/api/auth/login')
            .send({ username: 'test', password: 'test' })
        );
      }

      const responses = await Promise.all(promises);
      const rateLimited = responses.some(r => r.status === 429);

      expect(rateLimited).toBe(true);
    });

    it('should include rate limit headers', async () => {
      const response = await request(server)
        .post('/api/auth/login')
        .send({ username: 'test', password: 'test' });

      expect(response.headers).toHaveProperty('x-ratelimit-limit');
      expect(response.headers).toHaveProperty('x-ratelimit-remaining');
    });
  });

  describe('Security Headers', () => {
    it('should include security headers', async () => {
      const response = await request(server)
        .get('/api/health');

      expect(response.headers).toMatchObject({
        'x-content-type-options': 'nosniff',
        'x-frame-options': 'DENY',
        'x-xss-protection': '1; mode=block'
      });
    });

    it('should not expose sensitive information', async () => {
      const response = await request(server)
        .get('/api/nonexistent')
        .expect(404);

      expect(response.headers['x-powered-by']).toBeUndefined();
      expect(response.body).not.toContain('stack');
      expect(response.body).not.toContain('trace');
    });
  });
});