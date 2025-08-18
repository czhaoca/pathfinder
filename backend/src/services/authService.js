const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');
const logger = require('../utils/logger');
const { 
  ValidationError, 
  AuthenticationError, 
  ConflictError,
  DatabaseError 
} = require('../utils/errors');
const { AUTH, REGEX } = require('../utils/constants');

class AuthService {
  constructor(userRepository, sessionRepository, auditService) {
    this.userRepository = userRepository;
    this.sessionRepository = sessionRepository;
    this.auditService = auditService;
  }

  async register({ username, email, password, firstName, lastName, ipAddress, userAgent }) {
    // Validate inputs
    if (!REGEX.EMAIL.test(email)) {
      throw new ValidationError('Invalid email format', { email: 'Must be a valid email address' });
    }
    if (!REGEX.USERNAME.test(username)) {
      throw new ValidationError('Invalid username format', { 
        username: 'Must be 3-30 characters, alphanumeric with underscores and hyphens' 
      });
    }
    if (!REGEX.PASSWORD.test(password)) {
      throw new ValidationError('Invalid password format', { 
        password: 'Must be at least 8 characters with uppercase, lowercase, and number' 
      });
    }

    try {
      // Check if user exists
      const existingUser = await this.userRepository.findByUsernameOrEmail(username, email);
      if (existingUser) {
        throw new ConflictError('Username or email already exists');
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, AUTH.SALT_ROUNDS);

    // Create user
    const userId = uuidv4();
    const user = await this.userRepository.create({
      userId,
      username,
      email,
      passwordHash,
      firstName,
      lastName
    });

    // Create user-specific schema
    await this.userRepository.createUserSchema(user.schemaPrefix);

      // Create session
      const sessionId = uuidv4();
      const expiresAt = new Date(Date.now() + AUTH.SESSION_DURATION_MS);
      await this.sessionRepository.create({
        sessionId,
        userId,
        expiresAt
      });

    // Generate tokens
    const tokens = this.generateTokens({ userId, username, sessionId });

    // Log authentication
    await this.auditService.logAuth({
      userId,
      action: 'USER_REGISTERED',
      resourceType: 'user',
      resourceId: userId,
      ipAddress,
      userAgent,
      success: true
    });

      return {
        ...tokens,
        user: {
          id: user.userId,
          username: user.username,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          createdAt: user.createdAt,
          accountStatus: user.accountStatus
        }
      };
    } catch (error) {
      if (error.isOperational) {
        throw error;
      }
      logger.error('Registration error', { error: error.message, username, email });
      throw new DatabaseError('Failed to register user', error);
    }
  }

  async login({ username, password, ipAddress, userAgent }) {
    try {
      // Get user
      const user = await this.userRepository.findByUsername(username);
      if (!user) {
        throw new AuthenticationError('Invalid credentials');
      }

      // Verify password
      const validPassword = await bcrypt.compare(password, user.passwordHash);
      if (!validPassword) {
        await this.auditService.logAuth({
          userId: user.userId,
          action: 'LOGIN_FAILED',
          resourceType: 'auth',
          ipAddress,
          userAgent,
          success: false,
          errorMessage: 'Invalid password'
        });
        throw new AuthenticationError('Invalid credentials');
    }

      // Check account status
      if (user.accountStatus !== 'active') {
        throw new AuthenticationError(`Account is ${user.accountStatus}`);
      }

      // Create session
      const sessionId = uuidv4();
      const expiresAt = new Date(Date.now() + AUTH.SESSION_DURATION_MS);
      await this.sessionRepository.create({
        sessionId,
        userId: user.userId,
        expiresAt
      });

    // Generate tokens
    const tokens = this.generateTokens({ 
      userId: user.userId, 
      username: user.username, 
      sessionId 
    });

    // Update last login
    await this.userRepository.updateLastLogin(user.userId);

    // Log authentication
    await this.auditService.logAuth({
      userId: user.userId,
      action: 'USER_LOGIN',
      resourceType: 'auth',
      ipAddress,
      userAgent,
      success: true
    });

      return {
        ...tokens,
        user: {
          id: user.userId,
          username: user.username,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          createdAt: user.createdAt,
          lastLogin: new Date(),
          accountStatus: user.accountStatus
        }
      };
    } catch (error) {
      if (error.isOperational) {
        throw error;
      }
      logger.error('Login error', { error: error.message, username });
      throw new DatabaseError('Failed to login', error);
    }
  }

  async refreshToken(refreshToken) {
    try {
      const decoded = jwt.verify(refreshToken, config.security.jwtSecret);
      
      if (decoded.type !== 'refresh') {
        throw new AuthenticationError('Invalid token type');
      }

      // Check if session is still valid
      const session = await this.sessionRepository.findById(decoded.sessionId);
      if (!session) {
        throw new AuthenticationError('Session not found');
      }

      // Generate new tokens
      return this.generateTokens({ 
        userId: decoded.userId, 
        sessionId: decoded.sessionId 
      });
    } catch (error) {
      if (error.name === 'JsonWebTokenError') {
        const tokenError = new Error('Invalid refresh token');
        tokenError.code = 'INVALID_TOKEN';
        throw tokenError;
      }
      throw error;
    }
  }

  async logout({ sessionId, userId, ipAddress, userAgent }) {
    await this.sessionRepository.invalidate(sessionId);
    
    await this.auditService.logAuth({
      userId,
      action: 'USER_LOGOUT',
      resourceType: 'auth',
      ipAddress,
      userAgent,
      success: true
    });
  }

  async validateSession(sessionId) {
    const session = await this.sessionRepository.findActive(sessionId);
    if (!session || session.expiresAt < new Date()) {
      return null;
    }
    await this.sessionRepository.updateActivity(sessionId);
    return session;
  }

  generateTokens({ userId, username, sessionId }) {
    const token = jwt.sign(
      { userId, username, sessionId },
      config.security.jwtSecret,
      { expiresIn: '15m' }
    );

    const refreshToken = jwt.sign(
      { userId, sessionId, type: 'refresh' },
      config.security.jwtSecret,
      { expiresIn: '7d' }
    );

    return { token, refreshToken };
  }

  async userHasPassword(userId) {
    try {
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new ValidationError('User not found');
      }
      // Check if password hash exists and is not a placeholder
      return !!(user.passwordHash && user.passwordHash.length > 0 && !user.passwordHash.startsWith('oauth_'));
    } catch (error) {
      logger.error('Check password error', { error: error.message, userId });
      throw error;
    }
  }

  async getUserSessions(userId) {
    try {
      const sessions = await this.sessionRepository.findByUserId(userId);
      return sessions.map(session => ({
        sessionId: session.sessionId,
        createdAt: session.createdAt,
        lastActivity: session.lastActivity,
        expiresAt: session.expiresAt,
        ipAddress: session.ipAddress,
        userAgent: session.userAgent,
        isCurrent: false
      }));
    } catch (error) {
      logger.error('Get sessions error', { error: error.message, userId });
      throw new DatabaseError('Failed to retrieve sessions');
    }
  }
}

module.exports = AuthService;