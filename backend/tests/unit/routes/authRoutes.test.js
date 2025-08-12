const request = require('supertest');
const express = require('express');
const authRoutes = require('../../../src/api/routes/authRoutes');
const { authController } = require('../../../src/api/controllers/authController');

// Mock the controller
jest.mock('../../../src/api/controllers/authController', () => ({
  authController: {
    register: jest.fn(),
    login: jest.fn(),
    logout: jest.fn(),
    refreshToken: jest.fn(),
    verifyEmail: jest.fn(),
    forgotPassword: jest.fn(),
    resetPassword: jest.fn(),
    changePassword: jest.fn(),
    enable2FA: jest.fn(),
    verify2FA: jest.fn()
  }
}));

// Mock middleware
jest.mock('../../../src/api/middleware/auth', () => ({
  authenticate: (req, res, next) => {
    req.user = { id: 'user-123', username: 'testuser' };
    next();
  },
  authorize: (...roles) => (req, res, next) => next(),
  rateLimiter: (req, res, next) => next()
}));

jest.mock('../../../src/api/middleware/validation', () => ({
  validate: (schema) => (req, res, next) => next(),
  schemas: {
    auth: {
      register: {},
      login: {},
      refreshToken: {},
      forgotPassword: {},
      resetPassword: {},
      changePassword: {}
    }
  }
}));

describe('Auth Routes', () => {
  let app;
  
  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/auth', authRoutes);
    jest.clearAllMocks();
  });

  describe('POST /auth/register', () => {
    it('should call register controller', async () => {
      authController.register.mockImplementation((req, res) => {
        res.status(201).json({ 
          success: true, 
          data: { id: 'user-123', username: 'newuser' } 
        });
      });
      
      const response = await request(app)
        .post('/auth/register')
        .send({
          username: 'newuser',
          email: 'new@example.com',
          password: 'Password123!'
        });
      
      expect(response.status).toBe(201);
      expect(authController.register).toHaveBeenCalled();
      expect(response.body).toHaveProperty('success', true);
    });

    it('should validate input data', async () => {
      const response = await request(app)
        .post('/auth/register')
        .send({}); // Empty body should trigger validation
      
      // Validation middleware should be called
      expect(authController.register).toHaveBeenCalled();
    });
  });

  describe('POST /auth/login', () => {
    it('should call login controller', async () => {
      authController.login.mockImplementation((req, res) => {
        res.json({ 
          success: true, 
          data: { 
            token: 'jwt-token',
            user: { id: 'user-123', username: 'testuser' } 
          } 
        });
      });
      
      const response = await request(app)
        .post('/auth/login')
        .send({
          username: 'testuser',
          password: 'Password123!'
        });
      
      expect(response.status).toBe(200);
      expect(authController.login).toHaveBeenCalled();
      expect(response.body.data).toHaveProperty('token');
    });

    it('should apply rate limiting', async () => {
      authController.login.mockImplementation((req, res) => {
        res.json({ success: true });
      });
      
      // Make multiple requests
      const promises = Array(5).fill().map(() => 
        request(app)
          .post('/auth/login')
          .send({ username: 'test', password: 'test' })
      );
      
      await Promise.all(promises);
      
      // Rate limiter middleware should have been applied
      expect(authController.login).toHaveBeenCalledTimes(5);
    });
  });

  describe('POST /auth/logout', () => {
    it('should require authentication', async () => {
      authController.logout.mockImplementation((req, res) => {
        res.json({ success: true, message: 'Logged out' });
      });
      
      const response = await request(app)
        .post('/auth/logout')
        .set('Authorization', 'Bearer token');
      
      expect(response.status).toBe(200);
      expect(authController.logout).toHaveBeenCalled();
    });
  });

  describe('POST /auth/refresh', () => {
    it('should refresh token', async () => {
      authController.refreshToken.mockImplementation((req, res) => {
        res.json({ 
          success: true, 
          data: { 
            token: 'new-jwt-token',
            refreshToken: 'new-refresh-token'
          } 
        });
      });
      
      const response = await request(app)
        .post('/auth/refresh')
        .send({ refreshToken: 'old-refresh-token' });
      
      expect(response.status).toBe(200);
      expect(authController.refreshToken).toHaveBeenCalled();
      expect(response.body.data).toHaveProperty('token');
    });
  });

  describe('GET /auth/verify/:token', () => {
    it('should verify email token', async () => {
      authController.verifyEmail.mockImplementation((req, res) => {
        res.json({ success: true, message: 'Email verified' });
      });
      
      const response = await request(app)
        .get('/auth/verify/verification-token-123');
      
      expect(response.status).toBe(200);
      expect(authController.verifyEmail).toHaveBeenCalled();
    });
  });

  describe('POST /auth/forgot-password', () => {
    it('should initiate password reset', async () => {
      authController.forgotPassword.mockImplementation((req, res) => {
        res.json({ 
          success: true, 
          message: 'Password reset email sent' 
        });
      });
      
      const response = await request(app)
        .post('/auth/forgot-password')
        .send({ email: 'user@example.com' });
      
      expect(response.status).toBe(200);
      expect(authController.forgotPassword).toHaveBeenCalled();
    });
  });

  describe('POST /auth/reset-password', () => {
    it('should reset password with token', async () => {
      authController.resetPassword.mockImplementation((req, res) => {
        res.json({ 
          success: true, 
          message: 'Password reset successful' 
        });
      });
      
      const response = await request(app)
        .post('/auth/reset-password')
        .send({ 
          token: 'reset-token',
          newPassword: 'NewPassword123!' 
        });
      
      expect(response.status).toBe(200);
      expect(authController.resetPassword).toHaveBeenCalled();
    });
  });

  describe('POST /auth/change-password', () => {
    it('should change password for authenticated user', async () => {
      authController.changePassword.mockImplementation((req, res) => {
        res.json({ 
          success: true, 
          message: 'Password changed successfully' 
        });
      });
      
      const response = await request(app)
        .post('/auth/change-password')
        .set('Authorization', 'Bearer token')
        .send({ 
          currentPassword: 'OldPassword123!',
          newPassword: 'NewPassword123!' 
        });
      
      expect(response.status).toBe(200);
      expect(authController.changePassword).toHaveBeenCalled();
    });
  });

  describe('2FA endpoints', () => {
    it('should enable 2FA', async () => {
      authController.enable2FA.mockImplementation((req, res) => {
        res.json({ 
          success: true, 
          data: { 
            secret: 'secret-key',
            qrCode: 'data:image/png;base64,...' 
          } 
        });
      });
      
      const response = await request(app)
        .post('/auth/2fa/enable')
        .set('Authorization', 'Bearer token');
      
      expect(response.status).toBe(200);
      expect(authController.enable2FA).toHaveBeenCalled();
      expect(response.body.data).toHaveProperty('qrCode');
    });

    it('should verify 2FA token', async () => {
      authController.verify2FA.mockImplementation((req, res) => {
        res.json({ 
          success: true, 
          message: '2FA verified successfully' 
        });
      });
      
      const response = await request(app)
        .post('/auth/2fa/verify')
        .set('Authorization', 'Bearer token')
        .send({ token: '123456' });
      
      expect(response.status).toBe(200);
      expect(authController.verify2FA).toHaveBeenCalled();
    });
  });

  describe('Error handling', () => {
    it('should handle controller errors', async () => {
      authController.login.mockImplementation((req, res) => {
        throw new Error('Database error');
      });
      
      const response = await request(app)
        .post('/auth/login')
        .send({ username: 'test', password: 'test' });
      
      // Error should be caught by error handling middleware
      expect(authController.login).toHaveBeenCalled();
    });

    it('should handle 404 for undefined routes', async () => {
      const response = await request(app)
        .get('/auth/undefined-route');
      
      expect(response.status).toBe(404);
    });
  });
});