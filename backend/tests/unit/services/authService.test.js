const { jest } = require('@jest/globals');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const AuthService = require('../../../src/services/authService');

// Mock external modules
jest.mock('bcrypt');
jest.mock('jsonwebtoken');

describe('AuthService', () => {
  let authService;
  let mockUserRepository;
  let mockSessionRepository;
  let mockConfig;

  beforeEach(() => {
    // Mock repositories
    mockUserRepository = {
      findByUsername: jest.fn(),
      findByEmail: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn()
    };

    mockSessionRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
      deleteByUserId: jest.fn()
    };

    // Mock config
    mockConfig = {
      security: {
        jwtSecret: 'test-secret',
        jwtExpiresIn: '15m',
        refreshTokenExpiresIn: '7d'
      }
    };

    // Create service instance
    authService = new AuthService(mockUserRepository, mockSessionRepository, mockConfig);

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'Password123!',
        firstName: 'Test',
        lastName: 'User'
      };

      // Mock no existing user
      mockUserRepository.findByUsername.mockResolvedValue(null);
      mockUserRepository.findByEmail.mockResolvedValue(null);

      // Mock bcrypt
      bcrypt.hash.mockResolvedValue('hashed-password');

      // Mock user creation
      const createdUser = {
        userId: 'user-123',
        username: userData.username,
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        createdAt: new Date(),
        accountStatus: 'active'
      };
      mockUserRepository.create.mockResolvedValue(createdUser);

      // Mock session creation
      const session = {
        sessionId: 'session-123',
        userId: createdUser.userId,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      };
      mockSessionRepository.create.mockResolvedValue(session);

      // Mock JWT
      jwt.sign.mockImplementation((payload, secret, options) => {
        if (options?.expiresIn === '15m') return 'mock-token';
        if (options?.expiresIn === '7d') return 'mock-refresh-token';
      });

      const result = await authService.register(userData);

      expect(mockUserRepository.findByUsername).toHaveBeenCalledWith(userData.username);
      expect(mockUserRepository.findByEmail).toHaveBeenCalledWith(userData.email);
      expect(bcrypt.hash).toHaveBeenCalledWith(userData.password, 10);
      expect(mockUserRepository.create).toHaveBeenCalled();
      expect(mockSessionRepository.create).toHaveBeenCalled();
      expect(result).toEqual({
        token: 'mock-token',
        refreshToken: 'mock-refresh-token',
        user: expect.objectContaining({
          id: createdUser.userId,
          username: createdUser.username,
          email: createdUser.email
        })
      });
    });

    it('should throw error if username already exists', async () => {
      mockUserRepository.findByUsername.mockResolvedValue({ userId: 'existing-user' });

      await expect(authService.register({
        username: 'existinguser',
        email: 'new@example.com',
        password: 'Password123!'
      })).rejects.toThrow('Username already exists');
    });

    it('should throw error if email already exists', async () => {
      mockUserRepository.findByUsername.mockResolvedValue(null);
      mockUserRepository.findByEmail.mockResolvedValue({ userId: 'existing-user' });

      await expect(authService.register({
        username: 'newuser',
        email: 'existing@example.com',
        password: 'Password123!'
      })).rejects.toThrow('Email already exists');
    });
  });

  describe('login', () => {
    it('should login user successfully', async () => {
      const loginData = {
        username: 'testuser',
        password: 'Password123!',
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent'
      };

      const mockUser = {
        userId: 'user-123',
        username: 'testuser',
        email: 'test@example.com',
        passwordHash: 'hashed-password',
        accountStatus: 'active',
        loginAttempts: 0
      };

      mockUserRepository.findByUsername.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(true);

      const session = {
        sessionId: 'session-123',
        userId: mockUser.userId,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      };
      mockSessionRepository.create.mockResolvedValue(session);

      jwt.sign.mockImplementation((payload, secret, options) => {
        if (options?.expiresIn === '15m') return 'mock-token';
        if (options?.expiresIn === '7d') return 'mock-refresh-token';
      });

      const result = await authService.login(
        loginData.username,
        loginData.password,
        loginData.ipAddress,
        loginData.userAgent
      );

      expect(mockUserRepository.findByUsername).toHaveBeenCalledWith(loginData.username);
      expect(bcrypt.compare).toHaveBeenCalledWith(loginData.password, mockUser.passwordHash);
      expect(mockUserRepository.update).toHaveBeenCalledWith(mockUser.userId, {
        lastLogin: expect.any(Date),
        loginAttempts: 0
      });
      expect(result).toEqual({
        token: 'mock-token',
        refreshToken: 'mock-refresh-token',
        user: expect.objectContaining({
          id: mockUser.userId,
          username: mockUser.username,
          email: mockUser.email
        })
      });
    });

    it('should throw error for invalid credentials', async () => {
      const mockUser = {
        userId: 'user-123',
        username: 'testuser',
        passwordHash: 'hashed-password',
        accountStatus: 'active',
        loginAttempts: 0
      };

      mockUserRepository.findByUsername.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(false);

      await expect(authService.login(
        'testuser',
        'wrongpassword',
        '127.0.0.1',
        'test-agent'
      )).rejects.toThrow('Invalid credentials');

      expect(mockUserRepository.update).toHaveBeenCalledWith(mockUser.userId, {
        loginAttempts: 1
      });
    });

    it('should throw error for locked account', async () => {
      const mockUser = {
        userId: 'user-123',
        username: 'testuser',
        accountStatus: 'locked'
      };

      mockUserRepository.findByUsername.mockResolvedValue(mockUser);

      await expect(authService.login(
        'testuser',
        'password',
        '127.0.0.1',
        'test-agent'
      )).rejects.toThrow('Account is locked');
    });
  });

  describe('refreshToken', () => {
    it('should refresh token successfully', async () => {
      const refreshToken = 'valid-refresh-token';
      const decodedToken = {
        userId: 'user-123',
        sessionId: 'session-123',
        type: 'refresh'
      };

      jwt.verify.mockReturnValue(decodedToken);

      const session = {
        sessionId: 'session-123',
        userId: 'user-123',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        isActive: true
      };
      mockSessionRepository.findById.mockResolvedValue(session);

      const user = {
        userId: 'user-123',
        username: 'testuser',
        accountStatus: 'active'
      };
      mockUserRepository.findById.mockResolvedValue(user);

      jwt.sign.mockImplementation((payload, secret, options) => {
        if (options?.expiresIn === '15m') return 'new-token';
        if (options?.expiresIn === '7d') return 'new-refresh-token';
      });

      const result = await authService.refreshToken(refreshToken);

      expect(jwt.verify).toHaveBeenCalledWith(refreshToken, mockConfig.security.jwtSecret);
      expect(mockSessionRepository.findById).toHaveBeenCalledWith(decodedToken.sessionId);
      expect(mockUserRepository.findById).toHaveBeenCalledWith(decodedToken.userId);
      expect(result).toEqual({
        token: 'new-token',
        refreshToken: 'new-refresh-token'
      });
    });

    it('should throw error for invalid refresh token', async () => {
      jwt.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(authService.refreshToken('invalid-token'))
        .rejects.toThrow('Invalid refresh token');
    });

    it('should throw error for expired session', async () => {
      const decodedToken = {
        userId: 'user-123',
        sessionId: 'session-123',
        type: 'refresh'
      };

      jwt.verify.mockReturnValue(decodedToken);

      const session = {
        sessionId: 'session-123',
        userId: 'user-123',
        expiresAt: new Date(Date.now() - 1000), // Expired
        isActive: true
      };
      mockSessionRepository.findById.mockResolvedValue(session);

      await expect(authService.refreshToken('valid-token'))
        .rejects.toThrow('Session expired');
    });
  });

  describe('logout', () => {
    it('should logout user successfully', async () => {
      const userId = 'user-123';

      await authService.logout(userId);

      expect(mockSessionRepository.deleteByUserId).toHaveBeenCalledWith(userId);
    });
  });
});