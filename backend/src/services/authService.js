const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');
const logger = require('../utils/logger');

class AuthService {
  constructor(userRepository, sessionRepository, auditService) {
    this.userRepository = userRepository;
    this.sessionRepository = sessionRepository;
    this.auditService = auditService;
  }

  async register({ username, email, password, firstName, lastName, ipAddress, userAgent }) {
    // Check if user exists
    const existingUser = await this.userRepository.findByUsernameOrEmail(username, email);
    if (existingUser) {
      const error = new Error('Username or email already exists');
      error.code = 'USER_EXISTS';
      throw error;
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

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
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
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
  }

  async login({ username, password, ipAddress, userAgent }) {
    // Get user
    const user = await this.userRepository.findByUsername(username);
    if (!user) {
      const error = new Error('Invalid credentials');
      error.code = 'INVALID_CREDENTIALS';
      throw error;
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
      const error = new Error('Invalid credentials');
      error.code = 'INVALID_CREDENTIALS';
      throw error;
    }

    // Check account status
    if (user.accountStatus !== 'active') {
      const error = new Error('Account is not active');
      error.code = 'ACCOUNT_INACTIVE';
      throw error;
    }

    // Create session
    const sessionId = uuidv4();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
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
  }

  async refreshToken(refreshToken) {
    try {
      const decoded = jwt.verify(refreshToken, config.security.jwtSecret);
      
      if (decoded.type !== 'refresh') {
        const error = new Error('Invalid token type');
        error.code = 'INVALID_TOKEN';
        throw error;
      }

      // Check if session is still valid
      const session = await this.sessionRepository.findById(decoded.sessionId);
      if (!session) {
        const error = new Error('Session not found');
        error.code = 'SESSION_NOT_FOUND';
        throw error;
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
}

module.exports = AuthService;