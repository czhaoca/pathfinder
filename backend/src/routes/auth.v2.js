const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { requireRoles, canCreateRole } = require('../middleware/rbac');
const { rateLimiter } = require('../middleware/rateLimit');
const { auditLog } = require('../middleware/audit');
const authService = require('../services/authService');
const userService = require('../services/userService');
const passwordService = require('../services/passwordService');
const approvalService = require('../services/approvalService');
const { AuditService } = require('../services/auditService');

// Initialize audit service
const auditService = new AuditService(require('../config/database'));

/**
 * POST /api/v2/auth/register
 * Create new user without password in request - system generates it
 * Requires admin or site_admin role
 */
router.post('/register', 
  rateLimiter('register', { max: 5, window: '15m' }),
  requireRoles(['admin', 'site_admin']),
  auditLog('user_registration'),
  async (req, res) => {
    const { username, email, first_name, last_name, role = 'user', department, phone } = req.body;
    
    // Validate required fields
    if (!username || !email || !first_name || !last_name) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_FIELDS',
        message: 'Username, email, first name, and last name are required'
      });
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_EMAIL',
        message: 'Invalid email format'
      });
    }
    
    // Validate requesting user can create this role
    if (!canCreateRole(req.user.roles, role)) {
      await auditService.log({
        event_type: 'authorization',
        event_category: 'security',
        event_severity: 'warning',
        event_name: 'Unauthorized Role Creation Attempt',
        action: 'create_user',
        action_result: 'failure',
        actor_id: req.user.id,
        actor_username: req.user.username,
        target_type: 'role',
        target_name: role,
        ip_address: req.ip
      });
      
      return res.status(403).json({
        success: false,
        error: 'INSUFFICIENT_PRIVILEGES',
        message: `Cannot create user with role: ${role}`
      });
    }
    
    try {
      // Create user with system-generated password
      const result = await userService.createUser({
        username,
        email,
        first_name,
        last_name,
        role,
        department,
        phone,
        created_by: req.user.id
      });
      
      // Log successful creation
      await auditService.log({
        event_type: 'data_modification',
        event_category: 'user_management',
        event_severity: 'info',
        event_name: 'User Created',
        action: 'create',
        action_result: 'success',
        actor_id: req.user.id,
        actor_username: req.user.username,
        target_type: 'user',
        target_id: result.userId,
        target_name: username,
        new_values: JSON.stringify({ username, email, role }),
        ip_address: req.ip
      });
      
      res.status(201).json({
        success: true,
        data: {
          user: {
            id: result.userId,
            username,
            email,
            role,
            status: 'pending_activation'
          },
          password_retrieval_token: result.retrievalToken,
          token_expires_at: result.tokenExpiry,
          temporary_password_expires_at: result.passwordExpiry,
          instructions: 'User must retrieve password using the token and change it on first login'
        }
      });
    } catch (error) {
      // Log failure
      await auditService.log({
        event_type: 'data_modification',
        event_category: 'user_management',
        event_severity: 'error',
        event_name: 'User Creation Failed',
        action: 'create',
        action_result: 'failure',
        actor_id: req.user.id,
        actor_username: req.user.username,
        error_message: error.message,
        ip_address: req.ip
      });
      
      if (error.code === 'USER_EXISTS') {
        return res.status(409).json({
          success: false,
          error: 'USER_EXISTS',
          message: 'Username or email already exists'
        });
      }
      
      res.status(400).json({
        success: false,
        error: error.code || 'CREATION_FAILED',
        message: error.message || 'Failed to create user'
      });
    }
  }
);

/**
 * POST /api/v2/auth/login
 * Authenticate with client-hashed password
 */
router.post('/login',
  rateLimiter('login', { max: 10, window: '15m', skipSuccessfulRequests: true }),
  auditLog('authentication'),
  async (req, res) => {
    const { username, password_hash, client_salt, mfa_token, remember_me = false } = req.body;
    
    // Security check - reject plain passwords
    if (req.body.password) {
      await auditService.log({
        event_type: 'security',
        event_category: 'authentication',
        event_severity: 'warning',
        event_name: 'Plain Password Attempt',
        event_description: 'Client attempted to send plain text password',
        action: 'login',
        action_result: 'failure',
        actor_username: username,
        ip_address: req.ip,
        user_agent: req.get('user-agent'),
        risk_score: 50
      });
      
      return res.status(400).json({
        success: false,
        error: 'INVALID_REQUEST',
        message: 'Plain text passwords are not accepted. Please use the secure authentication flow.'
      });
    }
    
    // Validate required fields
    if (!username || !password_hash || !client_salt) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_CREDENTIALS',
        message: 'Username, password hash, and client salt are required'
      });
    }
    
    try {
      const result = await authService.authenticate({
        username,
        password_hash,
        client_salt,
        mfa_token,
        remember_me,
        ip_address: req.ip,
        user_agent: req.get('user-agent'),
        session_id: req.sessionID
      });
      
      // Handle MFA requirement
      if (result.requires_mfa && !mfa_token) {
        await auditService.log({
          event_type: 'authentication',
          event_category: 'security',
          event_severity: 'info',
          event_name: 'MFA Required',
          action: 'login',
          action_result: 'partial',
          actor_username: username,
          ip_address: req.ip
        });
        
        return res.status(200).json({
          success: false,
          requires_mfa: true,
          mfa_challenge: result.mfa_challenge,
          mfa_methods: result.mfa_methods,
          session_token: result.session_token // Temporary token for MFA submission
        });
      }
      
      // Handle password change requirement
      if (result.must_change_password) {
        await auditService.log({
          event_type: 'authentication',
          event_category: 'security',
          event_severity: 'warning',
          event_name: 'Password Change Required',
          action: 'login',
          action_result: 'partial',
          actor_username: username,
          ip_address: req.ip
        });
        
        return res.status(200).json({
          success: false,
          must_change_password: true,
          change_token: result.change_token,
          reason: result.change_reason
        });
      }
      
      // Successful authentication
      await auditService.log({
        event_type: 'authentication',
        event_category: 'security',
        event_severity: 'info',
        event_name: 'Successful Login',
        action: 'login',
        action_result: 'success',
        actor_id: result.user.id,
        actor_username: username,
        actor_roles: JSON.stringify(result.user.roles),
        ip_address: req.ip,
        user_agent: req.get('user-agent'),
        session_id: result.session_id
      });
      
      // Set secure cookie for refresh token
      if (result.refresh_token) {
        res.cookie('refresh_token', result.refresh_token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: remember_me ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000 // 30 days or 1 day
        });
      }
      
      res.json({
        success: true,
        data: {
          user: {
            id: result.user.id,
            username: result.user.username,
            email: result.user.email,
            first_name: result.user.first_name,
            last_name: result.user.last_name,
            roles: result.user.roles,
            permissions: result.permissions
          },
          token: result.token,
          expires_at: result.expires_at,
          session_id: result.session_id
        }
      });
    } catch (error) {
      // Log authentication failure
      await auditService.log({
        event_type: 'authentication',
        event_category: 'security',
        event_severity: 'warning',
        event_name: 'Failed Login',
        action: 'login',
        action_result: 'failure',
        actor_username: username,
        error_message: error.message,
        ip_address: req.ip,
        user_agent: req.get('user-agent'),
        risk_score: 30
      });
      
      // Generic error to prevent username enumeration
      res.status(401).json({
        success: false,
        error: 'AUTHENTICATION_FAILED',
        message: 'Invalid credentials'
      });
    }
  }
);

/**
 * POST /api/v2/auth/logout
 * Invalidate session and tokens
 */
router.post('/logout',
  requireRoles(['user', 'admin', 'site_admin']),
  async (req, res) => {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      const refresh_token = req.cookies.refresh_token;
      
      // Invalidate tokens
      await authService.logout({
        token,
        refresh_token,
        user_id: req.user.id,
        session_id: req.user.session_id
      });
      
      // Log logout
      await auditService.log({
        event_type: 'authentication',
        event_category: 'security',
        event_severity: 'info',
        event_name: 'User Logout',
        action: 'logout',
        action_result: 'success',
        actor_id: req.user.id,
        actor_username: req.user.username,
        session_id: req.user.session_id,
        ip_address: req.ip
      });
      
      // Clear refresh token cookie
      res.clearCookie('refresh_token');
      
      res.json({
        success: true,
        message: 'Logged out successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'LOGOUT_FAILED',
        message: 'Failed to logout'
      });
    }
  }
);

/**
 * POST /api/v2/auth/password/retrieve
 * Exchange one-time token for temporary password
 */
router.post('/password/retrieve',
  rateLimiter('password_retrieve', { max: 3, window: '1h' }),
  auditLog('password_retrieval'),
  async (req, res) => {
    const { retrieval_token } = req.body;
    
    if (!retrieval_token) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_TOKEN',
        message: 'Retrieval token is required'
      });
    }
    
    try {
      const result = await passwordService.retrievePassword(retrieval_token);
      
      // Log successful retrieval
      await auditService.log({
        event_type: 'authentication',
        event_category: 'security',
        event_severity: 'warning',
        event_name: 'Password Retrieved',
        event_description: 'Temporary password retrieved using one-time token',
        action: 'password_retrieve',
        action_result: 'success',
        actor_id: result.user_id,
        actor_username: result.username,
        ip_address: req.ip,
        risk_score: 40
      });
      
      res.json({
        success: true,
        data: {
          username: result.username,
          temporary_password: result.password,
          expires_at: result.expires_at,
          must_change: true,
          client_salt: result.client_salt,
          instructions: 'Use this temporary password to login. You will be required to change it immediately.'
        }
      });
    } catch (error) {
      // Log failed retrieval
      await auditService.log({
        event_type: 'security',
        event_category: 'authentication',
        event_severity: 'warning',
        event_name: 'Invalid Password Retrieval Attempt',
        action: 'password_retrieve',
        action_result: 'failure',
        error_message: error.message,
        ip_address: req.ip,
        risk_score: 50
      });
      
      res.status(404).json({
        success: false,
        error: 'INVALID_TOKEN',
        message: 'Token is invalid or has expired'
      });
    }
  }
);

/**
 * POST /api/v2/auth/password/reset/request
 * Request password reset with 3-hour expiry token
 */
router.post('/password/reset/request',
  rateLimiter('password_reset', { max: 3, window: '1h' }),
  auditLog('password_reset_request'),
  async (req, res) => {
    const { email, username } = req.body;
    
    if (!email && !username) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_IDENTIFIER',
        message: 'Email or username is required'
      });
    }
    
    try {
      // Request reset - this will send email if user exists
      const result = await passwordService.requestReset({ email, username });
      
      // Log the request (without exposing if user exists)
      await auditService.log({
        event_type: 'authentication',
        event_category: 'security',
        event_severity: 'info',
        event_name: 'Password Reset Requested',
        action: 'password_reset_request',
        action_result: 'success',
        target_type: 'email',
        ip_address: req.ip
      });
      
      // Always return success to prevent enumeration
      res.json({
        success: true,
        message: 'If an account exists with this email/username, a reset link has been sent',
        expires_in_hours: 3
      });
    } catch (error) {
      // Log error internally but don't expose
      console.error('Password reset request error:', error);
      
      // Still return success to prevent enumeration
      res.json({
        success: true,
        message: 'If an account exists with this email/username, a reset link has been sent',
        expires_in_hours: 3
      });
    }
  }
);

/**
 * POST /api/v2/auth/password/reset/confirm
 * Reset password with token
 */
router.post('/password/reset/confirm',
  rateLimiter('password_reset_confirm', { max: 5, window: '1h' }),
  async (req, res) => {
    const { reset_token, new_password_hash, client_salt } = req.body;
    
    // Validate inputs
    if (!reset_token || !new_password_hash || !client_salt) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_FIELDS',
        message: 'Reset token, new password hash, and client salt are required'
      });
    }
    
    try {
      const result = await passwordService.resetPassword({
        reset_token,
        new_password_hash,
        client_salt,
        ip_address: req.ip
      });
      
      // Log successful reset
      await auditService.log({
        event_type: 'authentication',
        event_category: 'security',
        event_severity: 'warning',
        event_name: 'Password Reset',
        action: 'password_reset',
        action_result: 'success',
        actor_id: result.user_id,
        actor_username: result.username,
        ip_address: req.ip,
        risk_score: 30
      });
      
      res.json({
        success: true,
        message: 'Password has been reset successfully',
        data: {
          username: result.username,
          must_login: true
        }
      });
    } catch (error) {
      // Log failed reset
      await auditService.log({
        event_type: 'security',
        event_category: 'authentication',
        event_severity: 'warning',
        event_name: 'Failed Password Reset',
        action: 'password_reset',
        action_result: 'failure',
        error_message: error.message,
        ip_address: req.ip,
        risk_score: 60
      });
      
      res.status(400).json({
        success: false,
        error: error.code || 'RESET_FAILED',
        message: error.message || 'Failed to reset password'
      });
    }
  }
);

/**
 * POST /api/v2/auth/password/change
 * Change password for authenticated user
 */
router.post('/password/change',
  requireRoles(['user', 'admin', 'site_admin']),
  rateLimiter('password_change', { max: 5, window: '1h' }),
  async (req, res) => {
    const { current_password_hash, new_password_hash, client_salt } = req.body;
    
    if (!current_password_hash || !new_password_hash || !client_salt) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_FIELDS',
        message: 'Current password hash, new password hash, and client salt are required'
      });
    }
    
    try {
      await passwordService.changePassword({
        user_id: req.user.id,
        current_password_hash,
        new_password_hash,
        client_salt,
        ip_address: req.ip
      });
      
      // Log password change
      await auditService.log({
        event_type: 'authentication',
        event_category: 'security',
        event_severity: 'warning',
        event_name: 'Password Changed',
        action: 'password_change',
        action_result: 'success',
        actor_id: req.user.id,
        actor_username: req.user.username,
        ip_address: req.ip
      });
      
      res.json({
        success: true,
        message: 'Password changed successfully'
      });
    } catch (error) {
      // Log failed change
      await auditService.log({
        event_type: 'security',
        event_category: 'authentication',
        event_severity: 'error',
        event_name: 'Failed Password Change',
        action: 'password_change',
        action_result: 'failure',
        actor_id: req.user.id,
        error_message: error.message,
        ip_address: req.ip
      });
      
      res.status(400).json({
        success: false,
        error: error.code || 'CHANGE_FAILED',
        message: error.message || 'Failed to change password'
      });
    }
  }
);

/**
 * POST /api/v2/auth/refresh
 * Refresh JWT token using refresh token
 */
router.post('/refresh',
  rateLimiter('token_refresh', { max: 30, window: '15m' }),
  async (req, res) => {
    const refresh_token = req.body.refresh_token || req.cookies.refresh_token;
    
    if (!refresh_token) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_TOKEN',
        message: 'Refresh token is required'
      });
    }
    
    try {
      const result = await authService.refreshToken(refresh_token);
      
      // Log token refresh
      await auditService.log({
        event_type: 'authentication',
        event_category: 'security',
        event_severity: 'info',
        event_name: 'Token Refreshed',
        action: 'token_refresh',
        action_result: 'success',
        actor_id: result.user_id,
        session_id: result.session_id,
        ip_address: req.ip
      });
      
      res.json({
        success: true,
        data: {
          token: result.token,
          expires_at: result.expires_at
        }
      });
    } catch (error) {
      // Log failed refresh
      await auditService.log({
        event_type: 'security',
        event_category: 'authentication',
        event_severity: 'warning',
        event_name: 'Failed Token Refresh',
        action: 'token_refresh',
        action_result: 'failure',
        error_message: error.message,
        ip_address: req.ip,
        risk_score: 40
      });
      
      res.status(401).json({
        success: false,
        error: 'INVALID_REFRESH_TOKEN',
        message: 'Invalid or expired refresh token'
      });
    }
  }
);

/**
 * POST /api/v2/auth/mfa/verify
 * Verify MFA token
 */
router.post('/mfa/verify',
  rateLimiter('mfa_verify', { max: 5, window: '5m' }),
  async (req, res) => {
    const { session_token, mfa_token, mfa_method = 'totp' } = req.body;
    
    if (!session_token || !mfa_token) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_FIELDS',
        message: 'Session token and MFA token are required'
      });
    }
    
    try {
      const result = await authService.verifyMFA({
        session_token,
        mfa_token,
        mfa_method,
        ip_address: req.ip,
        user_agent: req.get('user-agent')
      });
      
      // Log successful MFA
      await auditService.log({
        event_type: 'authentication',
        event_category: 'security',
        event_severity: 'info',
        event_name: 'MFA Verification Success',
        action: 'mfa_verify',
        action_result: 'success',
        actor_id: result.user.id,
        actor_username: result.user.username,
        ip_address: req.ip
      });
      
      res.json({
        success: true,
        data: {
          user: result.user,
          token: result.token,
          expires_at: result.expires_at,
          permissions: result.permissions
        }
      });
    } catch (error) {
      // Log failed MFA
      await auditService.log({
        event_type: 'security',
        event_category: 'authentication',
        event_severity: 'warning',
        event_name: 'MFA Verification Failed',
        action: 'mfa_verify',
        action_result: 'failure',
        error_message: error.message,
        ip_address: req.ip,
        risk_score: 60
      });
      
      res.status(401).json({
        success: false,
        error: 'MFA_FAILED',
        message: 'Invalid MFA token'
      });
    }
  }
);

/**
 * GET /api/v2/auth/session
 * Get current session information
 */
router.get('/session',
  requireRoles(['user', 'admin', 'site_admin']),
  async (req, res) => {
    try {
      const session = await authService.getSession(req.user.session_id);
      
      res.json({
        success: true,
        data: {
          session_id: session.id,
          user_id: session.user_id,
          created_at: session.created_at,
          last_activity: session.last_activity,
          expires_at: session.expires_at,
          ip_address: session.ip_address,
          user_agent: session.user_agent
        }
      });
    } catch (error) {
      res.status(404).json({
        success: false,
        error: 'SESSION_NOT_FOUND',
        message: 'Session not found'
      });
    }
  }
);

/**
 * DELETE /api/v2/auth/sessions
 * Invalidate all sessions for current user
 */
router.delete('/sessions',
  requireRoles(['user', 'admin', 'site_admin']),
  async (req, res) => {
    try {
      const count = await authService.invalidateAllSessions(req.user.id);
      
      // Log session invalidation
      await auditService.log({
        event_type: 'security',
        event_category: 'authentication',
        event_severity: 'warning',
        event_name: 'All Sessions Invalidated',
        action: 'invalidate_sessions',
        action_result: 'success',
        actor_id: req.user.id,
        actor_username: req.user.username,
        custom_data: JSON.stringify({ sessions_invalidated: count }),
        ip_address: req.ip,
        risk_score: 50
      });
      
      res.json({
        success: true,
        message: `${count} sessions invalidated`,
        data: {
          sessions_invalidated: count
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'INVALIDATION_FAILED',
        message: 'Failed to invalidate sessions'
      });
    }
  }
);

module.exports = router;