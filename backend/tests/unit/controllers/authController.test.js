const AuthController = require('../../../src/api/controllers/authController');

describe('AuthController', () => {
  let authController;
  let mockAuthService;
  let mockAuditService;
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    // Mock services
    mockAuthService = {
      register: jest.fn(),
      login: jest.fn(),
      refreshToken: jest.fn(),
      logout: jest.fn()
    };

    mockAuditService = {
      logAction: jest.fn()
    };

    // Create controller instance
    authController = new AuthController(mockAuthService, mockAuditService);

    // Mock request
    mockReq = {
      body: {},
      user: { userId: 'test-user-id' },
      ip: '127.0.0.1',
      headers: {
        'user-agent': 'test-agent'
      }
    };

    // Mock response
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };

    // Mock next
    mockNext = jest.fn();
  });

  describe('register', () => {
    it('should register a new user successfully', async () => {
      const registerData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'Password123!',
        firstName: 'Test',
        lastName: 'User'
      };

      const mockResponse = {
        token: 'mock-token',
        refreshToken: 'mock-refresh-token',
        user: {
          id: 'user-id',
          username: 'testuser',
          email: 'test@example.com'
        }
      };

      mockReq.body = registerData;
      mockAuthService.register.mockResolvedValue(mockResponse);

      await authController.register(mockReq, mockRes, mockNext);

      expect(mockAuthService.register).toHaveBeenCalledWith(registerData);
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith(mockResponse);
      expect(mockAuditService.logAction).toHaveBeenCalled();
    });

    it('should handle validation errors', async () => {
      mockReq.body = { username: 'test' }; // Missing required fields

      await authController.register(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: expect.any(String)
      });
    });

    it('should handle service errors', async () => {
      mockReq.body = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'Password123!',
        firstName: 'Test',
        lastName: 'User'
      };

      const error = new Error('Registration failed');
      mockAuthService.register.mockRejectedValue(error);

      await authController.register(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('login', () => {
    it('should login user successfully', async () => {
      const loginData = {
        username: 'testuser',
        password: 'Password123!'
      };

      const mockResponse = {
        token: 'mock-token',
        refreshToken: 'mock-refresh-token',
        user: {
          id: 'user-id',
          username: 'testuser'
        }
      };

      mockReq.body = loginData;
      mockAuthService.login.mockResolvedValue(mockResponse);

      await authController.login(mockReq, mockRes, mockNext);

      expect(mockAuthService.login).toHaveBeenCalledWith(
        loginData.username,
        loginData.password,
        mockReq.ip,
        mockReq.headers['user-agent']
      );
      expect(mockRes.json).toHaveBeenCalledWith(mockResponse);
    });

    it('should handle invalid credentials', async () => {
      mockReq.body = {
        username: 'testuser',
        password: 'wrongpassword'
      };

      const error = new Error('Invalid credentials');
      error.statusCode = 401;
      mockAuthService.login.mockRejectedValue(error);

      await authController.login(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('refreshToken', () => {
    it('should refresh token successfully', async () => {
      const refreshTokenData = {
        refreshToken: 'valid-refresh-token'
      };

      const mockResponse = {
        token: 'new-token',
        refreshToken: 'new-refresh-token'
      };

      mockReq.body = refreshTokenData;
      mockAuthService.refreshToken.mockResolvedValue(mockResponse);

      await authController.refreshToken(mockReq, mockRes, mockNext);

      expect(mockAuthService.refreshToken).toHaveBeenCalledWith(
        refreshTokenData.refreshToken
      );
      expect(mockRes.json).toHaveBeenCalledWith(mockResponse);
    });

    it('should handle missing refresh token', async () => {
      mockReq.body = {};

      await authController.refreshToken(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Refresh token is required'
      });
    });
  });

  describe('logout', () => {
    it('should logout user successfully', async () => {
      await authController.logout(mockReq, mockRes, mockNext);

      expect(mockAuthService.logout).toHaveBeenCalledWith('test-user-id');
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Logged out successfully'
      });
      expect(mockAuditService.logAction).toHaveBeenCalled();
    });

    it('should handle logout errors', async () => {
      const error = new Error('Logout failed');
      mockAuthService.logout.mockRejectedValue(error);

      await authController.logout(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });
});