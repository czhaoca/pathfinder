const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { query } = require('../database/connection');
const passwordService = require('../services/passwordService');
const auditService = require('../services/auditService');
const { authenticate } = require('../middleware/auth');
const { rateLimiter } = require('../middleware/rateLimiter');
const { validateRequest } = require('../middleware/validation');

// Input validation schemas
const schemas = {
  register: {
    username: { type: 'string', required: true, minLength: 3, maxLength: 50 },
    email: { type: 'string', required: true, format: 'email' },
    firstName: { type: 'string', required: true, maxLength: 100 },
    lastName: { type: 'string', required: true, maxLength: 100 },
    role: { type: 'string', enum: ['user', 'admin', 'super_admin'] }
  },
  login: {
    username: { type: 'string', required: true },
    password_hash: { type: 'string', required: true, minLength: 64, maxLength: 64 },
    client_salt: { type: 'string', required: true, minLength: 64, maxLength: 64 }
  },
  retrievePassword: {
    password_token: { type: 'string', required: true }
  },
  changePassword: {
    old_password_hash: { type: 'string', required: true, minLength: 64, maxLength: 64 },
    old_client_salt: { type: 'string', required: true, minLength: 64, maxLength: 64 },
    new_password_hash: { type: 'string', required: true, minLength: 64, maxLength: 64 },
    new_client_salt: { type: 'string', required: true, minLength: 64, maxLength: 64 }
  },
  requestReset: {
    email: { type: 'string', required: true, format: 'email' }
  },
  resetPassword: {
    reset_token: { type: 'string', required: true },
    new_password_hash: { type: 'string', required: true, minLength: 64, maxLength: 64 },
    new_client_salt: { type: 'string', required: true, minLength: 64, maxLength: 64 }
  }
};

/**
 * Helper function to generate JWT
 */
function generateJWT(user) {
  return jwt.sign(
    {
      userId: user.id,
      username: user.username,
      email: user.email,
      role: user.role
    },
    process.env.JWT_SECRET,
    { expiresIn: '15m' }
  );
}

/**
 * Helper function to get user by username
 */
async function getUserByUsername(username) {
  const result = await query(
    'SELECT * FROM pf_users WHERE username = :username AND status = :status',
    { username, status: 'active' }
  );
  return result.rows.length > 0 ? result.rows[0] : null;
}

/**
 * Helper function to get user by email
 */
async function getUserByEmail(email) {
  const result = await query(
    'SELECT * FROM pf_users WHERE email = :email AND status = :status',
    { email, status: 'active' }
  );
  return result.rows.length > 0 ? result.rows[0] : null;
}

/**
 * Helper function to create a new user
 */
async function createUser(userData) {
  const userId = uuidv4();
  const { username, email, firstName, lastName, role = 'user' } = userData;
  
  // Check if username already exists
  const existingUser = await getUserByUsername(username);
  if (existingUser) {
    throw new Error('Username already exists');
  }
  
  // Check if email already exists
  const existingEmail = await getUserByEmail(email);
  if (existingEmail) {
    throw new Error('Email already exists');
  }
  
  // Get default password policy
  const policyResult = await query(
    `SELECT id FROM pf_password_policies WHERE policy_name = :policyName`,
    { policyName: role === 'admin' || role === 'super_admin' ? 'admin' : 'default' }
  );
  
  const policyId = policyResult.rows[0]?.ID;
  
  // Create user
  await query(`
    INSERT INTO pf_users (
      id, username, email, first_name, last_name, role,
      status, password_policy_id, created_at
    ) VALUES (
      :userId, :username, :email, :firstName, :lastName, :role,
      'pending_activation', :policyId, CURRENT_TIMESTAMP
    )
  `, {
    userId,
    username,
    email,
    firstName,
    lastName,
    role,
    policyId
  });
  
  return userId;
}

/**
 * POST /auth/register
 * Register a new user with token-based password system
 */
router.post('/register', 
  rateLimiter('auth', 5, 60), // 5 requests per minute
  validateRequest(schemas.register),
  authenticate, // Only authenticated users can create new users
  async (req, res) => {
    try {
      const { username, email, firstName, lastName, role } = req.body;
      
      // Reject if password is included in request
      if (req.body.password || req.body.password_hash) {
        return res.status(400).json({
          success: false,
          error: 'Password should not be sent during registration. Use token-based retrieval.'
        });
      }
      
      // Create user
      const userId = await createUser({ username, email, firstName, lastName, role });
      
      // Generate temporary password
      const tempPassword = passwordService.generateTemporaryPassword();
      
      // Hash the temporary password for storage
      const tempSalt = crypto.randomBytes(32).toString('hex');
      const tempHash = crypto.createHash('sha256')
        .update(tempPassword + tempSalt)
        .digest('hex');
      
      // Store the password
      await passwordService.storePassword(userId, tempHash, tempSalt, true, tempPassword);
      
      // Generate retrieval token
      const tokenResult = await passwordService.createPasswordToken(
        userId, 
        'retrieval',
        req.user.userId,
        'User registration - temporary password retrieval',
        { registeredBy: req.user.username }
      );
      
      // Audit log
      await auditService.log({
        eventType: 'user_registered',
        eventCategory: 'security',
        userId,
        performedBy: req.user.userId,
        eventDescription: `New user registered: ${username}`,
        metadata: {
          username,
          email,
          role,
          registeredBy: req.user.username
        }
      });
      
      res.status(201).json({
        success: true,
        data: {
          user: {
            id: userId,
            username,
            email,
            firstName,
            lastName,
            role,
            status: 'pending_activation'
          },
          password_token: tokenResult.token,
          token_expires_at: tokenResult.expiresAt,
          instructions: 'Use the password_token with /auth/password/retrieve to get the temporary password'
        }
      });
      
    } catch (error) {
      console.error('Registration error:', error);
      
      await auditService.log({
        eventType: 'registration_failed',
        eventCategory: 'security',
        eventStatus: 'failure',
        performedBy: req.user?.userId,
        eventDescription: 'User registration failed',
        metadata: {
          error: error.message,
          username: req.body.username
        }
      });
      
      res.status(400).json({
        success: false,
        error: error.message || 'Registration failed'
      });
    }
  }
);

/**
 * POST /auth/password/retrieve
 * Retrieve temporary password using one-time token
 */
router.post('/password/retrieve',
  rateLimiter('auth', 3, 60), // 3 requests per minute
  validateRequest(schemas.retrievePassword),
  async (req, res) => {
    try {
      const { password_token } = req.body;
      
      // Validate and use the token
      const tokenResult = await passwordService.validateAndUseToken(password_token);
      
      if (!tokenResult.valid) {
        await auditService.log({
          eventType: 'password_retrieval_failed',
          eventCategory: 'security',
          eventStatus: 'failure',
          eventDescription: 'Invalid password retrieval attempt',
          metadata: {
            error: tokenResult.error,
            ip: req.ip,
            userAgent: req.get('user-agent')
          }
        });
        
        return res.status(404).json({
          success: false,
          error: tokenResult.error
        });
      }
      
      // Get user details
      const userResult = await query(
        'SELECT * FROM pf_users WHERE id = :userId',
        { userId: tokenResult.userId }
      );
      
      if (userResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }
      
      const user = userResult.rows[0];
      
      // Retrieve the temporary password
      const tempPassword = await passwordService.retrieveTemporaryPassword(tokenResult.userId);
      
      if (!tempPassword) {
        return res.status(404).json({
          success: false,
          error: 'No temporary password found for this user'
        });
      }
      
      // Update user status to active if pending
      if (user.STATUS === 'pending_activation') {
        await query(
          'UPDATE pf_users SET status = :status WHERE id = :userId',
          { status: 'active', userId: tokenResult.userId }
        );
      }
      
      // Audit log
      await auditService.log({
        eventType: 'password_retrieved',
        eventCategory: 'security',
        userId: tokenResult.userId,
        eventDescription: 'Temporary password retrieved successfully',
        metadata: {
          username: user.USERNAME,
          tokenType: tokenResult.tokenType,
          ip: req.ip
        }
      });
      
      res.json({
        success: true,
        data: {
          username: user.USERNAME,
          temporary_password: tempPassword,
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
          must_change: true,
          instructions: 'This password expires in 24 hours. You must change it after first login.'
        }
      });
      
    } catch (error) {
      console.error('Password retrieval error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve password'
      });
    }
  }
);

/**
 * POST /auth/login
 * Login with client-side hashed password
 */
router.post('/login',
  rateLimiter('auth', 10, 60), // 10 attempts per minute
  validateRequest(schemas.login),
  async (req, res) => {
    try {
      const { username, password_hash, client_salt } = req.body;
      
      // Reject plain text password
      if (req.body.password) {
        await auditService.log({
          eventType: 'login_plain_password_rejected',
          eventCategory: 'security',
          eventStatus: 'failure',
          eventDescription: 'Login attempt with plain text password rejected',
          metadata: {
            username,
            ip: req.ip
          }
        });
        
        return res.status(400).json({
          success: false,
          error: 'Plain text passwords are not accepted. Use client-side hashing.'
        });
      }
      
      // Get user
      const user = await getUserByUsername(username);
      
      if (!user) {
        await auditService.log({
          eventType: 'login_failed',
          eventCategory: 'security',
          eventStatus: 'failure',
          eventDescription: 'Login failed - user not found',
          metadata: {
            username,
            ip: req.ip
          }
        });
        
        return res.status(401).json({
          success: false,
          error: 'Invalid credentials'
        });
      }
      
      // Verify password
      const verifyResult = await passwordService.verifyPassword(
        user.ID,
        password_hash,
        client_salt
      );
      
      if (!verifyResult.valid) {
        await auditService.log({
          eventType: 'login_failed',
          eventCategory: 'security',
          eventStatus: 'failure',
          userId: user.ID,
          eventDescription: 'Login failed - invalid password',
          metadata: {
            username,
            error: verifyResult.error,
            ip: req.ip
          }
        });
        
        return res.status(401).json({
          success: false,
          error: verifyResult.error || 'Invalid credentials'
        });
      }
      
      // Check if password change is required
      if (verifyResult.mustChange) {
        await auditService.log({
          eventType: 'login_requires_password_change',
          eventCategory: 'security',
          userId: user.ID,
          eventDescription: 'Login successful but password change required',
          metadata: {
            username,
            ip: req.ip
          }
        });
        
        return res.status(403).json({
          success: false,
          error: 'Password change required',
          must_change_password: true,
          user_id: user.ID
        });
      }
      
      // Generate JWT token
      const token = generateJWT({
        id: user.ID,
        username: user.USERNAME,
        email: user.EMAIL,
        role: user.ROLE
      });
      
      // Create session
      const sessionId = uuidv4();
      await query(`
        INSERT INTO pf_user_sessions (
          id, user_id, token_hash, ip_address, user_agent,
          created_at, expires_at, is_active
        ) VALUES (
          :sessionId, :userId, :tokenHash, :ip, :userAgent,
          CURRENT_TIMESTAMP, :expiresAt, 1
        )
      `, {
        sessionId,
        userId: user.ID,
        tokenHash: crypto.createHash('sha256').update(token).digest('hex'),
        ip: req.ip,
        userAgent: req.get('user-agent'),
        expiresAt: new Date(Date.now() + 15 * 60 * 1000) // 15 minutes
      });
      
      // Audit successful login
      await auditService.log({
        eventType: 'login_success',
        eventCategory: 'security',
        userId: user.ID,
        eventDescription: 'User logged in successfully',
        metadata: {
          username,
          sessionId,
          ip: req.ip,
          daysUntilPasswordExpiry: verifyResult.daysUntilExpiry
        }
      });
      
      res.json({
        success: true,
        data: {
          user: {
            id: user.ID,
            username: user.USERNAME,
            email: user.EMAIL,
            firstName: user.FIRST_NAME,
            lastName: user.LAST_NAME,
            role: user.ROLE
          },
          token,
          expiresAt: new Date(Date.now() + 15 * 60 * 1000),
          passwordInfo: {
            daysUntilExpiry: verifyResult.daysUntilExpiry,
            passwordAge: verifyResult.passwordAge
          }
        }
      });
      
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        success: false,
        error: 'Login failed'
      });
    }
  }
);

/**
 * POST /auth/password/change
 * Change password (requires authentication)
 */
router.post('/password/change',
  authenticate,
  rateLimiter('auth', 3, 60), // 3 attempts per minute
  validateRequest(schemas.changePassword),
  async (req, res) => {
    try {
      const { old_password_hash, old_client_salt, new_password_hash, new_client_salt } = req.body;
      
      // Change password
      const result = await passwordService.changePassword(
        req.user.userId,
        old_password_hash,
        old_client_salt,
        new_password_hash,
        new_client_salt
      );
      
      if (!result.success) {
        await auditService.log({
          eventType: 'password_change_failed',
          eventCategory: 'security',
          eventStatus: 'failure',
          userId: req.user.userId,
          eventDescription: 'Password change failed',
          metadata: {
            error: result.error,
            ip: req.ip
          }
        });
        
        return res.status(400).json({
          success: false,
          error: result.error
        });
      }
      
      // Invalidate all existing sessions for the user
      await query(
        'UPDATE pf_user_sessions SET is_active = 0 WHERE user_id = :userId',
        { userId: req.user.userId }
      );
      
      // Audit successful password change
      await auditService.log({
        eventType: 'password_changed',
        eventCategory: 'security',
        userId: req.user.userId,
        eventDescription: 'Password changed successfully',
        metadata: {
          ip: req.ip,
          sessionsInvalidated: true
        }
      });
      
      res.json({
        success: true,
        message: 'Password changed successfully. Please login with your new password.',
        sessions_invalidated: true
      });
      
    } catch (error) {
      console.error('Password change error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to change password'
      });
    }
  }
);

/**
 * POST /auth/password/reset-request
 * Request a password reset token
 */
router.post('/password/reset-request',
  rateLimiter('auth', 3, 300), // 3 requests per 5 minutes
  validateRequest(schemas.requestReset),
  async (req, res) => {
    try {
      const { email } = req.body;
      
      // Get user by email
      const user = await getUserByEmail(email);
      
      // Always return success to prevent email enumeration
      if (!user) {
        await auditService.log({
          eventType: 'password_reset_request_invalid',
          eventCategory: 'security',
          eventStatus: 'failure',
          eventDescription: 'Password reset requested for non-existent email',
          metadata: {
            email,
            ip: req.ip
          }
        });
        
        return res.json({
          success: true,
          message: 'If the email exists, a reset token has been generated.'
        });
      }
      
      // Generate reset token
      const tokenResult = await passwordService.createPasswordToken(
        user.ID,
        'reset',
        user.ID, // Self-initiated
        'Password reset requested by user',
        { email, ip: req.ip }
      );
      
      // In production, send email with token
      // For now, return it in response (development only)
      const isDevelopment = process.env.NODE_ENV !== 'production';
      
      await auditService.log({
        eventType: 'password_reset_requested',
        eventCategory: 'security',
        userId: user.ID,
        eventDescription: 'Password reset token generated',
        metadata: {
          email,
          ip: req.ip,
          tokenExpiresAt: tokenResult.expiresAt
        }
      });
      
      res.json({
        success: true,
        message: 'If the email exists, a reset token has been generated.',
        ...(isDevelopment && {
          development_only: {
            reset_token: tokenResult.token,
            expires_at: tokenResult.expiresAt
          }
        })
      });
      
    } catch (error) {
      console.error('Password reset request error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to process reset request'
      });
    }
  }
);

/**
 * POST /auth/password/reset
 * Reset password using token
 */
router.post('/password/reset',
  rateLimiter('auth', 3, 60), // 3 attempts per minute
  validateRequest(schemas.resetPassword),
  async (req, res) => {
    try {
      const { reset_token, new_password_hash, new_client_salt } = req.body;
      
      // Validate token
      const tokenResult = await passwordService.validateAndUseToken(reset_token);
      
      if (!tokenResult.valid || tokenResult.tokenType !== 'reset') {
        await auditService.log({
          eventType: 'password_reset_failed',
          eventCategory: 'security',
          eventStatus: 'failure',
          eventDescription: 'Invalid password reset attempt',
          metadata: {
            error: tokenResult.error,
            ip: req.ip
          }
        });
        
        return res.status(400).json({
          success: false,
          error: 'Invalid or expired reset token'
        });
      }
      
      // Archive old password to history
      await passwordService.archivePasswordToHistory(tokenResult.userId, 'password_reset');
      
      // Store new password
      await passwordService.storePassword(
        tokenResult.userId,
        new_password_hash,
        new_client_salt,
        false // Not temporary
      );
      
      // Invalidate all sessions
      await query(
        'UPDATE pf_user_sessions SET is_active = 0 WHERE user_id = :userId',
        { userId: tokenResult.userId }
      );
      
      // Audit successful reset
      await auditService.log({
        eventType: 'password_reset_success',
        eventCategory: 'security',
        userId: tokenResult.userId,
        eventDescription: 'Password reset successfully',
        metadata: {
          ip: req.ip,
          sessionsInvalidated: true
        }
      });
      
      res.json({
        success: true,
        message: 'Password reset successfully. Please login with your new password.'
      });
      
    } catch (error) {
      console.error('Password reset error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to reset password'
      });
    }
  }
);

/**
 * POST /auth/logout
 * Logout and invalidate session
 */
router.post('/logout',
  authenticate,
  async (req, res) => {
    try {
      // Invalidate current session
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (token) {
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
        await query(
          'UPDATE pf_user_sessions SET is_active = 0 WHERE token_hash = :tokenHash',
          { tokenHash }
        );
      }
      
      await auditService.log({
        eventType: 'logout',
        eventCategory: 'security',
        userId: req.user.userId,
        eventDescription: 'User logged out',
        metadata: {
          ip: req.ip
        }
      });
      
      res.json({
        success: true,
        message: 'Logged out successfully'
      });
      
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to logout'
      });
    }
  }
);

module.exports = router;