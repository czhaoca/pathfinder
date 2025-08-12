const AuthService = require('../../../src/services/authService');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { ValidationError, AuthenticationError } = require('../../../src/utils/errors');

// Mock dependencies
jest.mock('bcrypt');
jest.mock('jsonwebtoken');

describe('AuthService', () => {
  let authService;
  let mockDatabaseService;
  let mockAuditService;
  let mockEncryptionService;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock database service
    mockDatabaseService = {
      query: jest.fn(),
      execute: jest.fn(),
      transaction: jest.fn()
    };

    // Mock audit service
    mockAuditService = {
      logAction: jest.fn(),
      logSecurityEvent: jest.fn()
    };

    // Mock encryption service
    mockEncryptionService = {
      encrypt: jest.fn(data => `encrypted_${data}`),
      decrypt: jest.fn(data => data.replace('encrypted_', ''))
    };

    // Create service instance
    authService = new AuthService(
      mockDatabaseService,
      mockAuditService,
      mockEncryptionService
    );

    // Setup JWT mocks
    jwt.sign.mockImplementation((payload, secret) => 'mock-token');
    jwt.verify.mockImplementation((token, secret) => ({ userId: 'user-123' }));
  });

  describe('register', () => {
    it('should register new user successfully', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'Password123!',
        firstName: 'Test',
        lastName: 'User',
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent'
      };

      // Mock password hashing
      bcrypt.hash.mockResolvedValue('hashed_password');
      
      // Mock database responses
      mockDatabaseService.query.mockResolvedValueOnce({ rows: [] }); // Check username
      mockDatabaseService.query.mockResolvedValueOnce({ rows: [] }); // Check email
      mockDatabaseService.execute.mockResolvedValue({
        rows: [{
          id: 'user-123',
          username: userData.username,
          email: userData.email,
          first_name: userData.firstName,
          last_name: userData.lastName
        }]
      });

      const result = await authService.register(userData);

      expect(bcrypt.hash).toHaveBeenCalledWith(userData.password, 10);
      expect(mockDatabaseService.execute).toHaveBeenCalled();
      expect(result).toHaveProperty('token');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('user');
      expect(mockAuditService.logAction).toHaveBeenCalledWith(
        'USER_REGISTRATION',
        expect.anything(),
        expect.anything()
      );
    });

    it('should reject duplicate username', async () => {
      const userData = {
        username: 'existinguser',
        email: 'new@example.com',
        password: 'Password123!',
        firstName: 'Test',
        lastName: 'User'
      };

      mockDatabaseService.query.mockResolvedValue({
        rows: [{ username: 'existinguser' }]
      });

      await expect(authService.register(userData))
        .rejects.toThrow(ValidationError);
    });

    it('should reject duplicate email', async () => {
      const userData = {
        username: 'newuser',
        email: 'existing@example.com',
        password: 'Password123!',
        firstName: 'Test',
        lastName: 'User'
      };

      mockDatabaseService.query.mockResolvedValueOnce({ rows: [] }); // Username check
      mockDatabaseService.query.mockResolvedValueOnce({
        rows: [{ email: 'existing@example.com' }]
      }); // Email check

      await expect(authService.register(userData))
        .rejects.toThrow(ValidationError);
    });

    it('should validate password strength', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'weak',
        firstName: 'Test',
        lastName: 'User'
      };

      await expect(authService.register(userData))
        .rejects.toThrow(ValidationError);
    });
  });

  describe('login', () => {
    it('should login user successfully', async () => {
      const credentials = {
        username: 'testuser',
        password: 'Password123!',
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent'
      };

      const mockUser = {
        id: 'user-123',
        username: 'testuser',
        email: 'test@example.com',
        password_hash: 'hashed_password',
        is_active: true,
        email_verified: true
      };

      mockDatabaseService.query.mockResolvedValue({
        rows: [mockUser]
      });

      bcrypt.compare.mockResolvedValue(true);

      const result = await authService.login(credentials);

      expect(bcrypt.compare).toHaveBeenCalledWith(
        credentials.password,
        mockUser.password_hash
      );
      expect(result).toHaveProperty('token');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('user');
      expect(mockAuditService.logAction).toHaveBeenCalledWith(
        'USER_LOGIN',
        expect.anything(),
        expect.anything()
      );
    });

    it('should reject invalid username', async () => {
      const credentials = {
        username: 'nonexistent',
        password: 'Password123!',
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent'
      };

      mockDatabaseService.query.mockResolvedValue({ rows: [] });

      await expect(authService.login(credentials))
        .rejects.toThrow(AuthenticationError);
    });

    it('should reject invalid password', async () => {
      const credentials = {
        username: 'testuser',
        password: 'wrongpassword',
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent'
      };

      const mockUser = {
        id: 'user-123',
        username: 'testuser',
        password_hash: 'hashed_password',
        is_active: true
      };

      mockDatabaseService.query.mockResolvedValue({
        rows: [mockUser]
      });

      bcrypt.compare.mockResolvedValue(false);

      await expect(authService.login(credentials))
        .rejects.toThrow(AuthenticationError);

      expect(mockAuditService.logSecurityEvent).toHaveBeenCalledWith(
        'FAILED_LOGIN',
        expect.anything()
      );
    });

    it('should reject inactive user', async () => {
      const credentials = {
        username: 'testuser',
        password: 'Password123!',
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent'
      };

      const mockUser = {
        id: 'user-123',
        username: 'testuser',
        password_hash: 'hashed_password',
        is_active: false
      };

      mockDatabaseService.query.mockResolvedValue({
        rows: [mockUser]
      });

      bcrypt.compare.mockResolvedValue(true);

      await expect(authService.login(credentials))
        .rejects.toThrow(AuthenticationError);
    });
  });

  describe('refreshToken', () => {
    it('should refresh token successfully', async () => {
      const refreshToken = 'valid-refresh-token';
      const mockSession = {
        user_id: 'user-123',
        refresh_token: refreshToken,
        expires_at: new Date(Date.now() + 86400000) // Tomorrow
      };

      const mockUser = {
        id: 'user-123',
        username: 'testuser',
        email: 'test@example.com',
        is_active: true
      };

      mockDatabaseService.query.mockResolvedValueOnce({
        rows: [mockSession]
      });
      mockDatabaseService.query.mockResolvedValueOnce({
        rows: [mockUser]
      });

      const result = await authService.refreshToken(refreshToken);

      expect(result).toHaveProperty('token');
      expect(result).toHaveProperty('refreshToken');
      expect(mockDatabaseService.execute).toHaveBeenCalled(); // Update session
    });

    it('should reject invalid refresh token', async () => {
      const refreshToken = 'invalid-refresh-token';

      mockDatabaseService.query.mockResolvedValue({ rows: [] });

      await expect(authService.refreshToken(refreshToken))
        .rejects.toThrow(AuthenticationError);
    });

    it('should reject expired refresh token', async () => {
      const refreshToken = 'expired-refresh-token';
      const mockSession = {
        user_id: 'user-123',
        refresh_token: refreshToken,
        expires_at: new Date(Date.now() - 86400000) // Yesterday
      };

      mockDatabaseService.query.mockResolvedValue({
        rows: [mockSession]
      });

      await expect(authService.refreshToken(refreshToken))
        .rejects.toThrow(AuthenticationError);
    });
  });

  describe('logout', () => {
    it('should logout user successfully', async () => {
      const logoutData = {
        sessionId: 'session-123',
        userId: 'user-123',
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent'
      };

      mockDatabaseService.execute.mockResolvedValue({
        rowCount: 1
      });

      await authService.logout(logoutData);

      expect(mockDatabaseService.execute).toHaveBeenCalled();
      expect(mockAuditService.logAction).toHaveBeenCalledWith(
        'USER_LOGOUT',
        expect.anything(),
        expect.anything()
      );
    });

    it('should handle logout with invalid session', async () => {
      const logoutData = {
        sessionId: 'invalid-session',
        userId: 'user-123',
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent'
      };

      mockDatabaseService.execute.mockResolvedValue({
        rowCount: 0
      });

      await authService.logout(logoutData);

      expect(mockDatabaseService.execute).toHaveBeenCalled();
      // Should not throw error, just log the event
      expect(mockAuditService.logAction).toHaveBeenCalled();
    });
  });

  describe('validateToken', () => {
    it('should validate token successfully', async () => {
      const token = 'valid-token';
      const mockPayload = {
        userId: 'user-123',
        exp: Math.floor(Date.now() / 1000) + 3600
      };

      jwt.verify.mockReturnValue(mockPayload);

      const mockUser = {
        id: 'user-123',
        username: 'testuser',
        is_active: true
      };

      mockDatabaseService.query.mockResolvedValue({
        rows: [mockUser]
      });

      const result = await authService.validateToken(token);

      expect(jwt.verify).toHaveBeenCalledWith(token, expect.any(String));
      expect(result).toEqual(mockUser);
    });

    it('should reject invalid token', async () => {
      const token = 'invalid-token';

      jwt.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(authService.validateToken(token))
        .rejects.toThrow(AuthenticationError);
    });

    it('should reject token for inactive user', async () => {
      const token = 'valid-token';
      const mockPayload = {
        userId: 'user-123',
        exp: Math.floor(Date.now() / 1000) + 3600
      };

      jwt.verify.mockReturnValue(mockPayload);

      const mockUser = {
        id: 'user-123',
        username: 'testuser',
        is_active: false
      };

      mockDatabaseService.query.mockResolvedValue({
        rows: [mockUser]
      });

      await expect(authService.validateToken(token))
        .rejects.toThrow(AuthenticationError);
    });
  });
});