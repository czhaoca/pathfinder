const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../src/api/app');
const { AuditService } = require('../../src/services/auditService');

// Mock services
jest.mock('../../src/services/authService');
jest.mock('../../src/services/userService');
jest.mock('../../src/services/passwordService');
jest.mock('../../src/services/auditService');

const authService = require('../../src/services/authService');
const userService = require('../../src/services/userService');
const passwordService = require('../../src/services/passwordService');

describe('Auth V2 API Endpoints', () => {
  let mockAuditService;
  
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuditService = {
      log: jest.fn().mockResolvedValue()
    };
    AuditService.mockImplementation(() => mockAuditService);
  });

  describe('POST /api/v2/auth/register', () => {
    const validUser = {
      username: 'testuser',
      email: 'test@example.com',
      first_name: 'Test',
      last_name: 'User',
      role: 'user'
    };

    beforeEach(() => {
      // Mock admin authentication
      app.use((req, res, next) => {
        req.user = {
          id: 'admin-id',
          username: 'admin',
          roles: ['admin']
        };
        next();
      });
    });

    test('should register new user without password in request', async () => {
      userService.createUser.mockResolvedValue({
        userId: 'new-user-id',
        retrievalToken: 'token-123',
        tokenExpiry: new Date(Date.now() + 3600000),
        passwordExpiry: new Date(Date.now() + 86400000)
      });

      const res = await request(app)
        .post('/api/v2/auth/register')
        .send(validUser)
        .expect(201);

      expect(res.body).toMatchObject({
        success: true,
        data: {
          user: {
            id: 'new-user-id',
            username: 'testuser',
            email: 'test@example.com',
            role: 'user',
            status: 'pending_activation'
          },
          password_retrieval_token: 'token-123'
        }
      });

      expect(userService.createUser).toHaveBeenCalledWith(
        expect.objectContaining({
          username: 'testuser',
          email: 'test@example.com',
          created_by: 'admin-id'
        })
      );
    });

    test('should reject registration with missing fields', async () => {
      const res = await request(app)
        .post('/api/v2/auth/register')
        .send({ username: 'test' })
        .expect(400);

      expect(res.body).toMatchObject({
        success: false,
        error: 'MISSING_FIELDS'
      });
    });

    test('should reject registration with invalid email', async () => {
      const res = await request(app)
        .post('/api/v2/auth/register')
        .send({ ...validUser, email: 'invalid-email' })
        .expect(400);

      expect(res.body).toMatchObject({
        success: false,
        error: 'INVALID_EMAIL'
      });
    });

    test('should enforce role-based registration restrictions', async () => {
      // Regular user trying to create admin
      app.use((req, res, next) => {
        req.user = {
          id: 'user-id',
          username: 'regularuser',
          roles: ['user']
        };
        next();
      });

      const res = await request(app)
        .post('/api/v2/auth/register')
        .send({ ...validUser, role: 'admin' })
        .expect(403);

      expect(res.body).toMatchObject({
        success: false,
        error: 'INSUFFICIENT_PRIVILEGES'
      });
    });
  });

  describe('POST /api/v2/auth/login', () => {
    test('should authenticate with client-hashed password', async () => {
      authService.authenticate.mockResolvedValue({
        user: {
          id: 'user-id',
          username: 'testuser',
          email: 'test@example.com',
          roles: ['user']
        },
        token: 'jwt-token',
        expires_at: new Date(Date.now() + 900000), // 15 minutes
        session_id: 'session-123',
        permissions: ['read', 'write']
      });

      const res = await request(app)
        .post('/api/v2/auth/login')
        .send({
          username: 'testuser',
          password_hash: 'hashed-password',
          client_salt: 'client-salt'
        })
        .expect(200);

      expect(res.body).toMatchObject({
        success: true,
        data: {
          user: {
            id: 'user-id',
            username: 'testuser'
          },
          token: 'jwt-token'
        }
      });
    });

    test('should reject plain text passwords', async () => {
      const res = await request(app)
        .post('/api/v2/auth/login')
        .send({
          username: 'testuser',
          password: 'plain-password' // Plain text
        })
        .expect(400);

      expect(res.body).toMatchObject({
        success: false,
        error: 'INVALID_REQUEST',
        message: expect.stringContaining('Plain text passwords')
      });

      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: 'security',
          event_severity: 'warning',
          event_name: 'Plain Password Attempt'
        })
      );
    });

    test('should handle MFA requirement', async () => {
      authService.authenticate.mockResolvedValue({
        requires_mfa: true,
        mfa_challenge: 'challenge-123',
        mfa_methods: ['totp', 'sms'],
        session_token: 'temp-token'
      });

      const res = await request(app)
        .post('/api/v2/auth/login')
        .send({
          username: 'testuser',
          password_hash: 'hashed-password',
          client_salt: 'client-salt'
        })
        .expect(200);

      expect(res.body).toMatchObject({
        success: false,
        requires_mfa: true,
        mfa_methods: ['totp', 'sms']
      });
    });

    test('should handle password change requirement', async () => {
      authService.authenticate.mockResolvedValue({
        must_change_password: true,
        change_token: 'change-token-123',
        change_reason: 'Password expired'
      });

      const res = await request(app)
        .post('/api/v2/auth/login')
        .send({
          username: 'testuser',
          password_hash: 'hashed-password',
          client_salt: 'client-salt'
        })
        .expect(200);

      expect(res.body).toMatchObject({
        success: false,
        must_change_password: true,
        change_token: 'change-token-123'
      });
    });
  });

  describe('POST /api/v2/auth/password/retrieve', () => {
    test('should retrieve temporary password with valid token', async () => {
      passwordService.retrievePassword.mockResolvedValue({
        user_id: 'user-id',
        username: 'testuser',
        password: 'temp-password-123',
        expires_at: new Date(Date.now() + 3600000),
        client_salt: 'salt-123'
      });

      const res = await request(app)
        .post('/api/v2/auth/password/retrieve')
        .send({ retrieval_token: 'valid-token' })
        .expect(200);

      expect(res.body).toMatchObject({
        success: true,
        data: {
          username: 'testuser',
          temporary_password: 'temp-password-123',
          must_change: true
        }
      });
    });

    test('should reject invalid retrieval token', async () => {
      passwordService.retrievePassword.mockRejectedValue(new Error('Invalid token'));

      const res = await request(app)
        .post('/api/v2/auth/password/retrieve')
        .send({ retrieval_token: 'invalid-token' })
        .expect(404);

      expect(res.body).toMatchObject({
        success: false,
        error: 'INVALID_TOKEN'
      });
    });
  });

  describe('POST /api/v2/auth/password/reset/request', () => {
    test('should always return success to prevent enumeration', async () => {
      passwordService.requestReset.mockResolvedValue({
        reset_token: 'reset-token-123'
      });

      const res = await request(app)
        .post('/api/v2/auth/password/reset/request')
        .send({ email: 'test@example.com' })
        .expect(200);

      expect(res.body).toMatchObject({
        success: true,
        message: expect.stringContaining('reset link has been sent'),
        expires_in_hours: 3
      });
    });

    test('should return success even for non-existent users', async () => {
      passwordService.requestReset.mockRejectedValue(new Error('User not found'));

      const res = await request(app)
        .post('/api/v2/auth/password/reset/request')
        .send({ email: 'nonexistent@example.com' })
        .expect(200);

      expect(res.body).toMatchObject({
        success: true,
        message: expect.stringContaining('reset link has been sent')
      });
    });
  });

  describe('POST /api/v2/auth/refresh', () => {
    test('should refresh JWT token with valid refresh token', async () => {
      authService.refreshToken.mockResolvedValue({
        token: 'new-jwt-token',
        expires_at: new Date(Date.now() + 900000),
        user_id: 'user-id',
        session_id: 'session-123'
      });

      const res = await request(app)
        .post('/api/v2/auth/refresh')
        .send({ refresh_token: 'valid-refresh-token' })
        .expect(200);

      expect(res.body).toMatchObject({
        success: true,
        data: {
          token: 'new-jwt-token'
        }
      });
    });

    test('should reject invalid refresh token', async () => {
      authService.refreshToken.mockRejectedValue(new Error('Invalid token'));

      const res = await request(app)
        .post('/api/v2/auth/refresh')
        .send({ refresh_token: 'invalid-token' })
        .expect(401);

      expect(res.body).toMatchObject({
        success: false,
        error: 'INVALID_REFRESH_TOKEN'
      });
    });
  });

  describe('Token Expiry', () => {
    test('should enforce 15-minute JWT token expiry', async () => {
      const expiredToken = jwt.sign(
        {
          id: 'user-id',
          username: 'testuser',
          iat: Math.floor(Date.now() / 1000) - 1000 // Issued 16+ minutes ago
        },
        process.env.JWT_SECRET || 'test-secret'
      );

      const res = await request(app)
        .get('/api/v2/users')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);

      expect(res.body).toMatchObject({
        success: false,
        error: 'TOKEN_EXPIRED'
      });
    });
  });

  describe('Rate Limiting', () => {
    test('should enforce rate limits on login attempts', async () => {
      // Make multiple login attempts
      const attempts = Array(11).fill().map(() =>
        request(app)
          .post('/api/v2/auth/login')
          .send({
            username: 'testuser',
            password_hash: 'wrong-hash',
            client_salt: 'salt'
          })
      );

      const results = await Promise.all(attempts);
      const rateLimited = results.filter(r => r.status === 429);

      expect(rateLimited.length).toBeGreaterThan(0);
      expect(rateLimited[0].body).toMatchObject({
        success: false,
        error: 'RATE_LIMIT_EXCEEDED'
      });
    });

    test('should have different rate limits for different endpoints', async () => {
      // Password reset has stricter limits
      const attempts = Array(4).fill().map(() =>
        request(app)
          .post('/api/v2/auth/password/reset/request')
          .send({ email: 'test@example.com' })
      );

      const results = await Promise.all(attempts);
      const rateLimited = results.filter(r => r.status === 429);

      expect(rateLimited.length).toBeGreaterThan(0);
    });
  });

  describe('Audit Logging', () => {
    test('should log all authentication events', async () => {
      authService.authenticate.mockResolvedValue({
        user: { id: 'user-id', username: 'testuser' },
        token: 'jwt-token',
        expires_at: new Date()
      });

      await request(app)
        .post('/api/v2/auth/login')
        .send({
          username: 'testuser',
          password_hash: 'hash',
          client_salt: 'salt'
        });

      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: 'authentication',
          event_name: 'Successful Login',
          action: 'login',
          action_result: 'success'
        })
      );
    });

    test('should log failed authentication attempts', async () => {
      authService.authenticate.mockRejectedValue(new Error('Invalid credentials'));

      await request(app)
        .post('/api/v2/auth/login')
        .send({
          username: 'testuser',
          password_hash: 'wrong-hash',
          client_salt: 'salt'
        });

      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: 'authentication',
          event_name: 'Failed Login',
          action: 'login',
          action_result: 'failure'
        })
      );
    });
  });
});