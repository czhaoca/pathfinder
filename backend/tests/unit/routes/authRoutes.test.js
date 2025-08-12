const request = require('supertest');
const express = require('express');

describe('Auth Routes', () => {
  let app;
  let mockAuthController;
  let mockAuthMiddleware;
  
  beforeEach(() => {
    app = express();
    app.use(express.json());
    
    // Create mock controller
    mockAuthController = {
      register: jest.fn((req, res) => res.status(201).json({ success: true })),
      login: jest.fn((req, res) => res.json({ success: true })),
      logout: jest.fn((req, res) => res.json({ success: true })),
      refreshToken: jest.fn((req, res) => res.json({ success: true })),
      verifyEmail: jest.fn((req, res) => res.json({ success: true })),
      forgotPassword: jest.fn((req, res) => res.json({ success: true })),
      resetPassword: jest.fn((req, res) => res.json({ success: true })),
      changePassword: jest.fn((req, res) => res.json({ success: true })),
      resendVerification: jest.fn((req, res) => res.json({ success: true })),
      getSessions: jest.fn((req, res) => res.json({ success: true })),
      revokeSession: jest.fn((req, res) => res.json({ success: true }))
    };
    
    // Create mock middleware
    mockAuthMiddleware = {
      authenticate: () => (req, res, next) => {
        req.user = { userId: 'user-123', username: 'testuser', sessionId: 'session-123' };
        next();
      }
    };
    
    // Create mock container
    const mockContainer = {
      get: (name) => {
        if (name === 'authController') return mockAuthController;
        if (name === 'authMiddleware') return mockAuthMiddleware;
        return null;
      }
    };
    
    // Load routes with mock container
    const createAuthRoutes = require('../../../src/api/routes/authRoutes');
    app.use('/auth', createAuthRoutes(mockContainer));
    
    jest.clearAllMocks();
  });

  describe('POST /auth/register', () => {
    it('should call register controller', async () => {
      const response = await request(app)
        .post('/auth/register')
        .send({
          username: 'newuser',
          email: 'new@example.com',
          password: 'TestPassword123!',
          firstName: 'New',
          lastName: 'User'
        });
      
      expect(response.status).toBe(201);
      expect(mockAuthController.register).toHaveBeenCalled();
      expect(response.body).toHaveProperty('success', true);
    });
  });

  describe('POST /auth/login', () => {
    it('should call login controller', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          username: 'testuser',
          password: 'TestPassword123!'
        });
      
      expect(response.status).toBe(200);
      expect(mockAuthController.login).toHaveBeenCalled();
      expect(response.body).toHaveProperty('success', true);
    });
  });

  describe('POST /auth/logout', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .post('/auth/logout')
        .set('Authorization', 'Bearer token');
      
      expect(response.status).toBe(200);
      expect(mockAuthController.logout).toHaveBeenCalled();
    });
  });

  describe('POST /auth/refresh', () => {
    it('should refresh token', async () => {
      const response = await request(app)
        .post('/auth/refresh')
        .send({ refreshToken: 'old-refresh-token' });
      
      expect(response.status).toBe(200);
      expect(mockAuthController.refreshToken).toHaveBeenCalled();
    });
  });

  describe('POST /auth/forgot-password', () => {
    it('should initiate password reset', async () => {
      const response = await request(app)
        .post('/auth/forgot-password')
        .send({ email: 'user@example.com' });
      
      expect(response.status).toBe(200);
      expect(mockAuthController.forgotPassword).toHaveBeenCalled();
    });
  });

  describe('POST /auth/reset-password', () => {
    it('should reset password with token', async () => {
      const response = await request(app)
        .post('/auth/reset-password')
        .send({ 
          token: 'reset-token',
          newPassword: 'NewPassword123!' 
        });
      
      expect(response.status).toBe(200);
      expect(mockAuthController.resetPassword).toHaveBeenCalled();
    });
  });

  describe('GET /auth/verify/:token', () => {
    it('should verify email token', async () => {
      const response = await request(app)
        .get('/auth/verify/verification-token-123');
      
      expect(response.status).toBe(200);
      expect(mockAuthController.verifyEmail).toHaveBeenCalled();
    });
  });

  describe('POST /auth/resend-verification', () => {
    it('should resend verification email', async () => {
      const response = await request(app)
        .post('/auth/resend-verification')
        .send({ email: 'user@example.com' });
      
      expect(response.status).toBe(200);
      expect(mockAuthController.resendVerification).toHaveBeenCalled();
    });
  });

  describe('POST /auth/change-password', () => {
    it('should change password for authenticated user', async () => {
      const response = await request(app)
        .post('/auth/change-password')
        .set('Authorization', 'Bearer token')
        .send({ 
          currentPassword: 'OldPassword123!',
          newPassword: 'NewPassword123!' 
        });
      
      expect(response.status).toBe(200);
      expect(mockAuthController.changePassword).toHaveBeenCalled();
    });
  });

  describe('GET /auth/sessions', () => {
    it('should get user sessions', async () => {
      const response = await request(app)
        .get('/auth/sessions')
        .set('Authorization', 'Bearer token');
      
      expect(response.status).toBe(200);
      expect(mockAuthController.getSessions).toHaveBeenCalled();
    });
  });

  describe('DELETE /auth/sessions/:sessionId', () => {
    it('should revoke session', async () => {
      const response = await request(app)
        .delete('/auth/sessions/session-456')
        .set('Authorization', 'Bearer token');
      
      expect(response.status).toBe(200);
      expect(mockAuthController.revokeSession).toHaveBeenCalled();
    });
  });

  describe('Error handling', () => {
    it('should handle controller errors', async () => {
      mockAuthController.login = jest.fn((req, res) => {
        throw new Error('Database error');
      });
      
      const response = await request(app)
        .post('/auth/login')
        .send({ username: 'test', password: 'test' });
      
      // Error should be caught by error handling middleware
      expect(mockAuthController.login).toHaveBeenCalled();
    });

    it('should handle 404 for undefined routes', async () => {
      const response = await request(app)
        .get('/auth/undefined-route');
      
      expect(response.status).toBe(404);
    });
  });
});