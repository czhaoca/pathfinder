#!/usr/bin/env node

/**
 * Career Navigator API Server
 * RESTful API backend for the Career Navigator frontend application
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const winston = require('winston');
const { v4: uuidv4 } = require('uuid');

const DatabaseManager = require('../services/database');
const config = require('../config');
const { encryptField, decryptField } = require('../services/encryption');

// Configure logger
const logger = winston.createLogger({
  level: config.logging.level,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// Initialize Express app
const app = express();
const PORT = process.env.API_PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // limit auth attempts
  skipSuccessfulRequests: true
});

app.use('/api/', limiter);
app.use('/api/auth/', authLimiter);

// Database instance
let db;

// Initialize database connection
async function initializeDatabase() {
  try {
    db = new DatabaseManager(config.database[config.environment]);
    await db.connect();
    logger.info('Database connection established');
  } catch (error) {
    logger.error('Failed to connect to database:', error);
    process.exit(1);
  }
}

// Authentication middleware
async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, config.security.jwtSecret);
    
    // Check if session is still valid
    const session = await db.getUserSession(decoded.sessionId);
    if (!session || session.expiresAt < new Date()) {
      return res.status(401).json({ error: 'Session expired' });
    }

    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid token' });
  }
}

// Routes

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: config.environment
  });
});

// Authentication routes
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password, firstName, lastName } = req.body;

    // Validate input
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required' });
    }

    // Check if user exists
    const existingUser = await db.getUserByUsername(username);
    if (existingUser) {
      return res.status(409).json({ error: 'Username already exists' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const userId = uuidv4();
    const user = await db.createUser({
      userId,
      username,
      email,
      passwordHash,
      firstName,
      lastName
    });

    // Create session
    const sessionId = uuidv4();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    await db.createSession({
      sessionId,
      userId,
      expiresAt
    });

    // Generate tokens
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

    // Log authentication
    await db.logAudit({
      userId,
      action: 'USER_REGISTERED',
      resourceType: 'user',
      resourceId: userId,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      success: true
    });

    res.status(201).json({
      token,
      refreshToken,
      user: {
        id: user.userId,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        createdAt: user.createdAt,
        accountStatus: user.accountStatus
      }
    });
  } catch (error) {
    logger.error('Registration error:', error);
    res.status(500).json({ error: 'Failed to register user' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Validate input
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Get user
    const user = await db.getUserByUsername(username);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password
    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      await db.logAudit({
        userId: user.userId,
        action: 'LOGIN_FAILED',
        resourceType: 'auth',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        success: false,
        errorMessage: 'Invalid password'
      });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check account status
    if (user.accountStatus !== 'active') {
      return res.status(403).json({ error: 'Account is not active' });
    }

    // Create session
    const sessionId = uuidv4();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await db.createSession({
      sessionId,
      userId: user.userId,
      expiresAt
    });

    // Generate tokens
    const token = jwt.sign(
      { userId: user.userId, username: user.username, sessionId },
      config.security.jwtSecret,
      { expiresIn: '15m' }
    );

    const refreshToken = jwt.sign(
      { userId: user.userId, sessionId, type: 'refresh' },
      config.security.jwtSecret,
      { expiresIn: '7d' }
    );

    // Update last login
    await db.updateUser(user.userId, { lastLogin: new Date() });

    // Log authentication
    await db.logAudit({
      userId: user.userId,
      action: 'USER_LOGIN',
      resourceType: 'auth',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      success: true
    });

    res.json({
      token,
      refreshToken,
      user: {
        id: user.userId,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin,
        accountStatus: user.accountStatus
      }
    });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({ error: 'Failed to login' });
  }
});

app.post('/api/auth/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token required' });
    }

    const decoded = jwt.verify(refreshToken, config.security.jwtSecret);
    
    if (decoded.type !== 'refresh') {
      return res.status(403).json({ error: 'Invalid token type' });
    }

    // Check if session is still valid
    const session = await db.getUserSession(decoded.sessionId);
    if (!session) {
      return res.status(401).json({ error: 'Session not found' });
    }

    // Generate new access token
    const token = jwt.sign(
      { userId: decoded.userId, sessionId: decoded.sessionId },
      config.security.jwtSecret,
      { expiresIn: '15m' }
    );

    // Generate new refresh token
    const newRefreshToken = jwt.sign(
      { userId: decoded.userId, sessionId: decoded.sessionId, type: 'refresh' },
      config.security.jwtSecret,
      { expiresIn: '7d' }
    );

    res.json({ token, refreshToken: newRefreshToken });
  } catch (error) {
    logger.error('Token refresh error:', error);
    res.status(403).json({ error: 'Invalid refresh token' });
  }
});

app.post('/api/auth/logout', authenticateToken, async (req, res) => {
  try {
    await db.deleteSession(req.user.sessionId);
    
    await db.logAudit({
      userId: req.user.userId,
      action: 'USER_LOGOUT',
      resourceType: 'auth',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      success: true
    });

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    logger.error('Logout error:', error);
    res.status(500).json({ error: 'Failed to logout' });
  }
});

// Profile routes
app.get('/api/profile', authenticateToken, async (req, res) => {
  try {
    const user = await db.getUserById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      id: user.userId,
      username: user.username,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      createdAt: user.createdAt,
      lastLogin: user.lastLogin,
      accountStatus: user.accountStatus
    });
  } catch (error) {
    logger.error('Profile fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Experience routes
app.get('/api/experiences', authenticateToken, async (req, res) => {
  try {
    const experiences = await db.getUserExperiences(req.user.userId);
    res.json(experiences);
  } catch (error) {
    logger.error('Experiences fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch experiences' });
  }
});

app.post('/api/experiences', authenticateToken, async (req, res) => {
  try {
    const experienceData = {
      ...req.body,
      userId: req.user.userId,
      experienceId: uuidv4()
    };

    const experience = await db.createExperience(experienceData);
    
    await db.logAudit({
      userId: req.user.userId,
      action: 'EXPERIENCE_CREATED',
      resourceType: 'experience',
      resourceId: experience.experienceId,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      success: true
    });

    res.status(201).json(experience);
  } catch (error) {
    logger.error('Experience creation error:', error);
    res.status(500).json({ error: 'Failed to create experience' });
  }
});

// Chat routes (placeholder for MCP integration)
app.post('/api/chat/message', authenticateToken, async (req, res) => {
  try {
    const { message } = req.body;

    // TODO: Integrate with MCP server
    // For now, return a placeholder response
    const response = {
      id: uuidv4(),
      role: 'assistant',
      content: 'I understand you want to discuss: "' + message + '". The full MCP integration is pending. This would normally process your message through the Career Navigator AI.',
      timestamp: new Date().toISOString()
    };

    await db.logAudit({
      userId: req.user.userId,
      action: 'CHAT_MESSAGE',
      resourceType: 'chat',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      success: true
    });

    res.json(response);
  } catch (error) {
    logger.error('Chat error:', error);
    res.status(500).json({ error: 'Failed to process chat message' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Start server
async function startServer() {
  await initializeDatabase();
  
  app.listen(PORT, () => {
    logger.info(`API server running on port ${PORT} in ${config.environment} mode`);
  });
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  if (db) {
    await db.close();
  }
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  if (db) {
    await db.close();
  }
  process.exit(0);
});

// Start the server
startServer().catch(error => {
  logger.error('Failed to start server:', error);
  process.exit(1);
});