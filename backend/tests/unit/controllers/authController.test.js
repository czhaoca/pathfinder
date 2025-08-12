const AuthController = require('../../../src/api/controllers/authController');
const ApiResponse = require('../../../src/utils/apiResponse');
const { ValidationError } = require('../../../src/utils/errors');

// Mock the ApiResponse module
jest.mock('../../../src/utils/apiResponse');

describe('AuthController', () => {
  let authController;
  let mockAuthService;
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Mock services
    mockAuthService = {
      register: jest.fn(),
      login: jest.fn(),
      refreshToken: jest.fn(),
      logout: jest.fn()
    };

    // Create controller instance
    authController = new AuthController(mockAuthService);

    // Mock request
    mockReq = {
      body: {},
      validated: null,
      user: { userId: 'test-user-id', sessionId: 'test-session-id' },
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

    // Setup ApiResponse mocks
    ApiResponse.success = jest.fn();
    ApiResponse.created = jest.fn();
    ApiResponse.error = jest.fn();
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

      await authController.register(mockReq, mockRes);

      expect(mockAuthService.register).toHaveBeenCalledWith({
        ...registerData,
        ipAddress: mockReq.ip,
        userAgent: mockReq.headers['user-agent']
      });
      expect(ApiResponse.created).toHaveBeenCalledWith(
        mockRes,
        mockResponse,
        'User registered successfully'
      );
    });

    it('should use validated data when available', async () => {
      const validatedData = {
        username: 'validateduser',
        email: 'validated@example.com',
        password: 'ValidatedPass123!',
        firstName: 'Validated',
        lastName: 'User'
      };

      const mockResponse = { user: { id: 'user-id' } };

      mockReq.validated = validatedData;
      mockAuthService.register.mockResolvedValue(mockResponse);

      await authController.register(mockReq, mockRes);

      expect(mockAuthService.register).toHaveBeenCalledWith({
        ...validatedData,
        ipAddress: mockReq.ip,
        userAgent: mockReq.headers['user-agent']
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

      await expect(authController.register(mockReq, mockRes)).rejects.toThrow(error);
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

      await authController.login(mockReq, mockRes);

      expect(mockAuthService.login).toHaveBeenCalledWith({
        ...loginData,
        ipAddress: mockReq.ip,
        userAgent: mockReq.headers['user-agent']
      });
      expect(ApiResponse.success).toHaveBeenCalledWith(
        mockRes,
        mockResponse,
        'Login successful'
      );
    });

    it('should use validated data for login', async () => {
      const validatedData = {
        username: 'validateduser',
        password: 'ValidatedPass123!'
      };

      const mockResponse = { token: 'token', user: {} };

      mockReq.validated = validatedData;
      mockAuthService.login.mockResolvedValue(mockResponse);

      await authController.login(mockReq, mockRes);

      expect(mockAuthService.login).toHaveBeenCalledWith({
        ...validatedData,
        ipAddress: mockReq.ip,
        userAgent: mockReq.headers['user-agent']
      });
    });

    it('should handle invalid credentials', async () => {
      mockReq.body = {
        username: 'testuser',
        password: 'wrongpassword'
      };

      const error = new Error('Invalid credentials');
      mockAuthService.login.mockRejectedValue(error);

      await expect(authController.login(mockReq, mockRes)).rejects.toThrow(error);
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

      await authController.refreshToken(mockReq, mockRes);

      expect(mockAuthService.refreshToken).toHaveBeenCalledWith(
        refreshTokenData.refreshToken
      );
      expect(ApiResponse.success).toHaveBeenCalledWith(
        mockRes,
        mockResponse,
        'Token refreshed successfully'
      );
    });

    it('should handle missing refresh token', async () => {
      mockReq.body = {};

      await expect(authController.refreshToken(mockReq, mockRes))
        .rejects.toThrow(ValidationError);
    });

    it('should handle invalid refresh token', async () => {
      mockReq.body = { refreshToken: 'invalid-token' };

      const error = new Error('Invalid refresh token');
      mockAuthService.refreshToken.mockRejectedValue(error);

      await expect(authController.refreshToken(mockReq, mockRes)).rejects.toThrow(error);
    });
  });

  describe('logout', () => {
    it('should logout user successfully', async () => {
      mockAuthService.logout.mockResolvedValue();

      await authController.logout(mockReq, mockRes);

      expect(mockAuthService.logout).toHaveBeenCalledWith({
        sessionId: mockReq.user.sessionId,
        userId: mockReq.user.userId,
        ipAddress: mockReq.ip,
        userAgent: mockReq.headers['user-agent']
      });
      expect(ApiResponse.success).toHaveBeenCalledWith(
        mockRes,
        null,
        'Logged out successfully'
      );
    });

    it('should handle logout errors', async () => {
      const error = new Error('Logout failed');
      mockAuthService.logout.mockRejectedValue(error);

      await expect(authController.logout(mockReq, mockRes)).rejects.toThrow(error);
    });

    it('should handle missing user context', async () => {
      mockReq.user = null;

      await expect(authController.logout(mockReq, mockRes))
        .rejects.toThrow();
    });
  });
});