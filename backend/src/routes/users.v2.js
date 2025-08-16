const express = require('express');
const router = express.Router();
const { requireRoles, canPerformAction, canModifyRole, getHighestRole } = require('../middleware/rbac');
const { rateLimiter, roleBasedRateLimiter } = require('../middleware/rateLimit');
const { auditLog, trackDataChanges } = require('../middleware/audit');
const userService = require('../services/userService');
const approvalService = require('../services/approvalService');
const { AuditService } = require('../services/auditService');

// Initialize audit service
const auditService = new AuditService(require('../config/database'));

/**
 * GET /api/v2/users
 * List users based on requester's role
 */
router.get('/',
  requireRoles(['user', 'admin', 'site_admin']),
  roleBasedRateLimiter({ user: 10, admin: 50, site_admin: 100 }, 60000),
  auditLog('List Users'),
  async (req, res) => {
    const { page = 1, limit = 20, search, role, status, sort = 'created_at:desc' } = req.query;
    
    try {
      // Users can only see themselves
      if (req.user.roles.includes('user') && !req.user.roles.includes('admin')) {
        const user = await userService.getUser(req.user.id);
        
        return res.json({
          success: true,
          data: {
            users: user ? [user] : [],
            total: user ? 1 : 0,
            page: 1,
            limit: 1,
            pages: 1
          }
        });
      }
      
      // Admins and site admins can see all users
      const result = await userService.listUsers({
        page: parseInt(page),
        limit: parseInt(limit),
        search,
        role,
        status,
        sort,
        requester_id: req.user.id,
        requester_role: getHighestRole(req.user.roles)
      });
      
      // Log data access
      await auditService.log({
        event_type: 'data_access',
        event_category: 'user_management',
        event_severity: 'info',
        event_name: 'User List Accessed',
        action: 'list',
        action_result: 'success',
        actor_id: req.user.id,
        actor_username: req.user.username,
        custom_data: JSON.stringify({
          total_users: result.total,
          filters: { search, role, status }
        }),
        ip_address: req.ip
      });
      
      res.json({
        success: true,
        data: {
          users: result.users,
          total: result.total,
          page: result.page,
          limit: result.limit,
          pages: result.pages
        }
      });
    } catch (error) {
      console.error('List users error:', error);
      res.status(500).json({
        success: false,
        error: 'LIST_FAILED',
        message: 'Failed to retrieve users'
      });
    }
  }
);

/**
 * GET /api/v2/users/:id
 * Get specific user details
 */
router.get('/:id',
  requireRoles(['user', 'admin', 'site_admin']),
  rateLimiter('user_list'),
  auditLog('View User'),
  async (req, res) => {
    const { id } = req.params;
    
    try {
      // Check if user can view this profile
      const canView = req.user.id === id || 
                     req.user.roles.includes('admin') || 
                     req.user.roles.includes('site_admin');
      
      if (!canView) {
        await auditService.log({
          event_type: 'authorization',
          event_category: 'security',
          event_severity: 'warning',
          event_name: 'Unauthorized User Access',
          action: 'view',
          action_result: 'failure',
          actor_id: req.user.id,
          target_id: id,
          ip_address: req.ip,
          risk_score: 40
        });
        
        return res.status(403).json({
          success: false,
          error: 'FORBIDDEN',
          message: 'You do not have permission to view this user'
        });
      }
      
      const user = await userService.getUser(id);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'USER_NOT_FOUND',
          message: 'User not found'
        });
      }
      
      res.json({
        success: true,
        data: {
          user
        }
      });
    } catch (error) {
      console.error('Get user error:', error);
      res.status(500).json({
        success: false,
        error: 'GET_FAILED',
        message: 'Failed to retrieve user'
      });
    }
  }
);

/**
 * POST /api/v2/users
 * Create new user (admin/site_admin only)
 */
router.post('/',
  requireRoles(['admin', 'site_admin']),
  rateLimiter('user_create'),
  trackDataChanges(),
  auditLog('Create User'),
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
    
    // Check if requester can create this role
    const canCreate = await canPerformAction(req.user.roles, 'create_user', [role]);
    
    if (!canCreate) {
      await auditService.log({
        event_type: 'authorization',
        event_category: 'security',
        event_severity: 'warning',
        event_name: 'Unauthorized User Creation',
        action: 'create',
        action_result: 'failure',
        actor_id: req.user.id,
        target_type: 'role',
        target_name: role,
        ip_address: req.ip,
        risk_score: 50
      });
      
      return res.status(403).json({
        success: false,
        error: 'INSUFFICIENT_PRIVILEGES',
        message: `Cannot create user with role: ${role}`
      });
    }
    
    try {
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
      
      // Store new values for audit
      req.auditSetNewValues({
        username,
        email,
        first_name,
        last_name,
        role
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
          temporary_password_expires_at: result.passwordExpiry
        }
      });
    } catch (error) {
      console.error('Create user error:', error);
      
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
 * PUT /api/v2/users/:id
 * Update user information
 */
router.put('/:id',
  requireRoles(['user', 'admin', 'site_admin']),
  rateLimiter('user_update'),
  trackDataChanges(),
  auditLog('Update User'),
  async (req, res) => {
    const { id } = req.params;
    const updates = req.body;
    
    try {
      // Check if user can update this profile
      const canUpdate = req.user.id === id || 
                       req.user.roles.includes('admin') || 
                       req.user.roles.includes('site_admin');
      
      if (!canUpdate) {
        return res.status(403).json({
          success: false,
          error: 'FORBIDDEN',
          message: 'You do not have permission to update this user'
        });
      }
      
      // Regular users cannot change certain fields
      if (req.user.id === id && !req.user.roles.includes('admin')) {
        delete updates.role;
        delete updates.status;
        delete updates.permissions;
      }
      
      // Get old values for audit
      const oldUser = await userService.getUser(id);
      req.auditSetOldValues(oldUser);
      
      // Update user
      const updatedUser = await userService.updateUser(id, updates, req.user.id);
      
      // Set new values and changed fields for audit
      req.auditSetNewValues(updatedUser);
      req.auditSetChangedFields(Object.keys(updates));
      
      res.json({
        success: true,
        data: {
          user: updatedUser
        }
      });
    } catch (error) {
      console.error('Update user error:', error);
      res.status(400).json({
        success: false,
        error: error.code || 'UPDATE_FAILED',
        message: error.message || 'Failed to update user'
      });
    }
  }
);

/**
 * PUT /api/v2/users/:id/role
 * Change user role (admin/site_admin only)
 */
router.put('/:id/role',
  requireRoles(['admin', 'site_admin']),
  rateLimiter('admin_action'),
  trackDataChanges(),
  auditLog('Change User Role'),
  async (req, res) => {
    const { id } = req.params;
    const { new_role, reason } = req.body;
    
    if (!new_role || !reason) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_FIELDS',
        message: 'New role and reason are required'
      });
    }
    
    try {
      // Get current user
      const targetUser = await userService.getUser(id);
      
      if (!targetUser) {
        return res.status(404).json({
          success: false,
          error: 'USER_NOT_FOUND',
          message: 'User not found'
        });
      }
      
      // Check if role change is allowed
      const canChange = canModifyRole(
        req.user.roles,
        targetUser.role,
        new_role
      );
      
      if (!canChange) {
        await auditService.log({
          event_type: 'authorization',
          event_category: 'security',
          event_severity: 'warning',
          event_name: 'Unauthorized Role Change',
          action: 'change_role',
          action_result: 'failure',
          actor_id: req.user.id,
          target_id: id,
          old_values: JSON.stringify({ role: targetUser.role }),
          new_values: JSON.stringify({ role: new_role }),
          ip_address: req.ip,
          risk_score: 60
        });
        
        return res.status(403).json({
          success: false,
          error: 'FORBIDDEN',
          message: 'You do not have permission to make this role change'
        });
      }
      
      // Check if approval is required
      const requiresApproval = 
        req.user.roles.includes('admin') && 
        (new_role === 'admin' || new_role === 'site_admin');
      
      if (requiresApproval) {
        // Create approval request
        const approval = await approvalService.createRequest({
          type: 'role_change',
          target_user: id,
          current_role: targetUser.role,
          new_role,
          reason,
          requested_by: req.user.id
        });
        
        await auditService.log({
          event_type: 'authorization',
          event_category: 'approval',
          event_severity: 'info',
          event_name: 'Role Change Approval Requested',
          action: 'request_approval',
          action_result: 'success',
          actor_id: req.user.id,
          target_id: id,
          custom_data: JSON.stringify({
            approval_id: approval.id,
            current_role: targetUser.role,
            new_role
          }),
          ip_address: req.ip
        });
        
        return res.json({
          success: true,
          data: {
            status: 'pending_approval',
            approval_id: approval.id,
            approvers_needed: approval.approvers_needed,
            message: 'Role change requires approval from site administrator'
          }
        });
      }
      
      // Direct role change
      req.auditSetOldValues({ role: targetUser.role });
      
      await userService.changeRole(id, new_role, req.user.id, reason);
      
      req.auditSetNewValues({ role: new_role });
      req.auditSetChangedFields(['role']);
      
      res.json({
        success: true,
        data: {
          status: 'completed',
          user_id: id,
          old_role: targetUser.role,
          new_role,
          changed_by: req.user.id,
          reason
        }
      });
    } catch (error) {
      console.error('Role change error:', error);
      res.status(400).json({
        success: false,
        error: error.code || 'ROLE_CHANGE_FAILED',
        message: error.message || 'Failed to change user role'
      });
    }
  }
);

/**
 * DELETE /api/v2/users/:id
 * Delete user account with cooling-off period
 */
router.delete('/:id',
  requireRoles(['user', 'admin', 'site_admin']),
  rateLimiter('user_delete'),
  auditLog('Delete User'),
  async (req, res) => {
    const { id } = req.params;
    const { confirmation, reason, override_cooling_off = false } = req.body;
    
    try {
      // Validate user can delete
      const isSelf = id === req.user.id;
      const isAdmin = req.user.roles.includes('admin') || req.user.roles.includes('site_admin');
      
      if (!isSelf && !isAdmin) {
        return res.status(403).json({
          success: false,
          error: 'FORBIDDEN',
          message: 'You can only delete your own account'
        });
      }
      
      // Require confirmation
      if (confirmation !== 'DELETE') {
        return res.status(400).json({
          success: false,
          error: 'CONFIRMATION_REQUIRED',
          message: 'Please confirm deletion by providing confirmation: "DELETE"'
        });
      }
      
      // Get user to be deleted
      const targetUser = await userService.getUser(id);
      
      if (!targetUser) {
        return res.status(404).json({
          success: false,
          error: 'USER_NOT_FOUND',
          message: 'User not found'
        });
      }
      
      // Prevent deletion of last site_admin
      if (targetUser.role === 'site_admin') {
        const siteAdminCount = await userService.countUsersByRole('site_admin');
        if (siteAdminCount <= 1) {
          return res.status(400).json({
            success: false,
            error: 'LAST_ADMIN',
            message: 'Cannot delete the last site administrator'
          });
        }
      }
      
      // Site admin can override cooling-off period
      if (override_cooling_off && req.user.roles.includes('site_admin')) {
        await userService.deleteUserImmediate(id, req.user.id, reason);
        
        await auditService.log({
          event_type: 'data_modification',
          event_category: 'user_management',
          event_severity: 'critical',
          event_name: 'User Deleted Immediately',
          action: 'delete',
          action_result: 'success',
          actor_id: req.user.id,
          target_id: id,
          target_name: targetUser.username,
          custom_data: JSON.stringify({
            immediate: true,
            reason
          }),
          ip_address: req.ip,
          risk_score: 80
        });
        
        return res.json({
          success: true,
          data: {
            status: 'deleted',
            immediate: true,
            deleted_user: id
          }
        });
      }
      
      // Normal deletion with cooling-off period
      const result = await userService.requestDeletion(id, req.user.id, reason);
      
      await auditService.log({
        event_type: 'data_modification',
        event_category: 'user_management',
        event_severity: 'warning',
        event_name: 'User Deletion Scheduled',
        action: 'schedule_delete',
        action_result: 'success',
        actor_id: req.user.id,
        target_id: id,
        target_name: targetUser.username,
        custom_data: JSON.stringify({
          scheduled_for: result.scheduled_for,
          cooling_off_days: 7,
          reason
        }),
        ip_address: req.ip,
        risk_score: 60
      });
      
      res.json({
        success: true,
        data: {
          status: 'scheduled',
          scheduled_for: result.scheduled_for,
          cancellation_token: result.cancellation_token,
          cooling_off_days: 7,
          message: 'User deletion scheduled. Use the cancellation token to cancel within 7 days.'
        }
      });
    } catch (error) {
      console.error('User deletion error:', error);
      res.status(400).json({
        success: false,
        error: error.code || 'DELETION_FAILED',
        message: error.message || 'Failed to delete user'
      });
    }
  }
);

/**
 * POST /api/v2/users/:id/cancel-deletion
 * Cancel scheduled user deletion
 */
router.post('/:id/cancel-deletion',
  requireRoles(['user', 'admin', 'site_admin']),
  rateLimiter('user_update'),
  auditLog('Cancel User Deletion'),
  async (req, res) => {
    const { id } = req.params;
    const { cancellation_token } = req.body;
    
    if (!cancellation_token) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_TOKEN',
        message: 'Cancellation token is required'
      });
    }
    
    try {
      await userService.cancelDeletion(id, cancellation_token);
      
      await auditService.log({
        event_type: 'data_modification',
        event_category: 'user_management',
        event_severity: 'info',
        event_name: 'User Deletion Cancelled',
        action: 'cancel_delete',
        action_result: 'success',
        actor_id: req.user.id,
        target_id: id,
        ip_address: req.ip
      });
      
      res.json({
        success: true,
        message: 'User deletion has been cancelled'
      });
    } catch (error) {
      console.error('Cancel deletion error:', error);
      res.status(400).json({
        success: false,
        error: error.code || 'CANCELLATION_FAILED',
        message: error.message || 'Failed to cancel deletion'
      });
    }
  }
);

/**
 * POST /api/v2/users/batch
 * Batch operations for admins
 */
router.post('/batch',
  requireRoles(['admin', 'site_admin']),
  rateLimiter('batch_operation'),
  auditLog('Batch User Operation'),
  async (req, res) => {
    const { operation, user_ids, params = {} } = req.body;
    
    const allowedOperations = [
      'activate',
      'deactivate',
      'reset_password',
      'send_notification',
      'export',
      'update_department'
    ];
    
    if (!operation || !allowedOperations.includes(operation)) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_OPERATION',
        message: `Operation must be one of: ${allowedOperations.join(', ')}`
      });
    }
    
    if (!user_ids || !Array.isArray(user_ids) || user_ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_USERS',
        message: 'User IDs array is required'
      });
    }
    
    // Limit batch size
    if (user_ids.length > 100) {
      return res.status(400).json({
        success: false,
        error: 'BATCH_TOO_LARGE',
        message: 'Maximum 100 users per batch operation'
      });
    }
    
    try {
      const results = await userService.batchOperation({
        operation,
        user_ids,
        params,
        performed_by: req.user.id
      });
      
      await auditService.log({
        event_type: 'data_modification',
        event_category: 'batch_operation',
        event_severity: 'warning',
        event_name: `Batch ${operation}`,
        action: operation,
        action_result: 'success',
        actor_id: req.user.id,
        custom_data: JSON.stringify({
          operation,
          total_users: user_ids.length,
          successful: results.successful.length,
          failed: results.failed.length,
          params
        }),
        ip_address: req.ip,
        risk_score: 50
      });
      
      res.json({
        success: true,
        data: {
          operation,
          total: user_ids.length,
          successful: results.successful.length,
          failed: results.failed.length,
          results: {
            successful: results.successful,
            failed: results.failed
          }
        }
      });
    } catch (error) {
      console.error('Batch operation error:', error);
      res.status(400).json({
        success: false,
        error: error.code || 'BATCH_FAILED',
        message: error.message || 'Batch operation failed'
      });
    }
  }
);

/**
 * GET /api/v2/users/:id/sessions
 * Get user's active sessions
 */
router.get('/:id/sessions',
  requireRoles(['user', 'admin', 'site_admin']),
  rateLimiter('user_list'),
  auditLog('View User Sessions'),
  async (req, res) => {
    const { id } = req.params;
    
    try {
      // Check if user can view sessions
      const canView = req.user.id === id || 
                     req.user.roles.includes('admin') || 
                     req.user.roles.includes('site_admin');
      
      if (!canView) {
        return res.status(403).json({
          success: false,
          error: 'FORBIDDEN',
          message: 'You do not have permission to view these sessions'
        });
      }
      
      const sessions = await userService.getUserSessions(id);
      
      res.json({
        success: true,
        data: {
          sessions,
          total: sessions.length
        }
      });
    } catch (error) {
      console.error('Get sessions error:', error);
      res.status(500).json({
        success: false,
        error: 'GET_SESSIONS_FAILED',
        message: 'Failed to retrieve sessions'
      });
    }
  }
);

/**
 * DELETE /api/v2/users/:id/sessions
 * Invalidate all user sessions
 */
router.delete('/:id/sessions',
  requireRoles(['user', 'admin', 'site_admin']),
  rateLimiter('admin_action'),
  auditLog('Invalidate User Sessions'),
  async (req, res) => {
    const { id } = req.params;
    
    try {
      // Check if user can invalidate sessions
      const canInvalidate = req.user.id === id || 
                           req.user.roles.includes('admin') || 
                           req.user.roles.includes('site_admin');
      
      if (!canInvalidate) {
        return res.status(403).json({
          success: false,
          error: 'FORBIDDEN',
          message: 'You do not have permission to invalidate these sessions'
        });
      }
      
      const count = await userService.invalidateUserSessions(id, req.user.id);
      
      await auditService.log({
        event_type: 'security',
        event_category: 'session_management',
        event_severity: 'warning',
        event_name: 'User Sessions Invalidated',
        action: 'invalidate_sessions',
        action_result: 'success',
        actor_id: req.user.id,
        target_id: id,
        custom_data: JSON.stringify({ sessions_invalidated: count }),
        ip_address: req.ip,
        risk_score: 40
      });
      
      res.json({
        success: true,
        data: {
          sessions_invalidated: count,
          message: `${count} sessions invalidated for user ${id}`
        }
      });
    } catch (error) {
      console.error('Invalidate sessions error:', error);
      res.status(500).json({
        success: false,
        error: 'INVALIDATION_FAILED',
        message: 'Failed to invalidate sessions'
      });
    }
  }
);

module.exports = router;