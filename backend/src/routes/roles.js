const express = require('express');
const router = express.Router();
const { requireRoles, requirePermission, canModifyRole, canCreateRole } = require('../middleware/rbac');
const { authenticate } = require('../middleware/auth');
const { getRoleService } = require('../services/roleService');
const { validateRequest } = require('../middleware/validation');
const { body, param } = require('express-validator');

/**
 * @route GET /api/roles/my-roles
 * @desc Get current user's roles
 * @access Private
 */
router.get('/my-roles', 
  authenticate,
  async (req, res) => {
    try {
      const roleService = getRoleService();
      const roles = await roleService.getUserRoles(req.user.id);
      const permissions = await roleService.getUserPermissions(req.user.id);
      
      res.json({
        success: true,
        data: {
          roles,
          permissions: permissions.map(p => ({
            code: p.permission_code,
            resource: p.resource_type,
            actions: JSON.parse(p.allowed_actions || '[]')
          }))
        }
      });
    } catch (error) {
      console.error('Error fetching user roles:', error);
      res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'Failed to fetch roles'
      });
    }
  }
);

/**
 * @route GET /api/roles/user/:userId
 * @desc Get specific user's roles (admin only)
 * @access Admin, Site Admin
 */
router.get('/user/:userId',
  authenticate,
  requireRoles(['admin', 'site_admin']),
  param('userId').isUUID(),
  validateRequest,
  async (req, res) => {
    try {
      const roleService = getRoleService();
      const roles = await roleService.getUserRoles(req.params.userId);
      
      res.json({
        success: true,
        data: { roles }
      });
    } catch (error) {
      console.error('Error fetching user roles:', error);
      res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'Failed to fetch user roles'
      });
    }
  }
);

/**
 * @route POST /api/roles/assign
 * @desc Directly assign role (site admin only)
 * @access Site Admin
 */
router.post('/assign',
  authenticate,
  requireRoles(['site_admin']),
  body('user_id').isUUID(),
  body('role').isIn(['site_admin', 'admin', 'user']),
  body('notes').optional().isString(),
  validateRequest,
  async (req, res) => {
    try {
      const { user_id, role, notes } = req.body;
      
      const roleService = getRoleService();
      const result = await roleService.assignRole(
        user_id,
        role,
        req.user.id,
        notes
      );
      
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Error assigning role:', error);
      res.status(500).json({
        success: false,
        error: 'ROLE_ASSIGNMENT_FAILED',
        message: error.message
      });
    }
  }
);

/**
 * @route POST /api/roles/promote
 * @desc Request role promotion (requires approval)
 * @access Admin, Site Admin
 */
router.post('/promote',
  authenticate,
  requireRoles(['admin', 'site_admin']),
  body('user_id').isUUID(),
  body('to_role').isIn(['admin', 'user']),
  body('justification').isString().isLength({ min: 10, max: 1000 }),
  validateRequest,
  async (req, res) => {
    try {
      const { user_id, to_role, justification } = req.body;
      const roleService = getRoleService();
      
      // Get current role
      const currentRoles = await roleService.getUserRoles(user_id);
      const currentRole = currentRoles[0] || 'user';
      
      // Check if promotion is valid
      if (!canModifyRole(req.user.roles, currentRole, to_role)) {
        return res.status(403).json({
          success: false,
          error: 'FORBIDDEN',
          message: 'You cannot perform this role change'
        });
      }
      
      // Site admin can promote immediately
      if (req.user.roles.includes('site_admin')) {
        const result = await roleService.assignRole(
          user_id,
          to_role,
          req.user.id,
          justification
        );
        
        return res.json({
          success: true,
          data: {
            ...result,
            status: 'approved',
            immediate: true
          }
        });
      }
      
      // Admin needs approval workflow for promotions
      if (currentRole === 'user' && to_role === 'admin') {
        const promotion = await roleService.createPromotionRequest({
          targetUserId: user_id,
          fromRole: currentRole,
          toRole: to_role,
          initiatedBy: req.user.id,
          justification,
          requiredApprovals: 2
        });
        
        return res.json({
          success: true,
          data: {
            promotion_id: promotion.id,
            status: 'pending_approval',
            expires_at: promotion.expires_at,
            required_approvals: 2
          }
        });
      }
      
      // Direct demotion (admin to user)
      if (currentRole === 'admin' && to_role === 'user') {
        const result = await roleService.assignRole(
          user_id,
          to_role,
          req.user.id,
          `Demoted: ${justification}`
        );
        
        return res.json({
          success: true,
          data: {
            ...result,
            status: 'approved',
            immediate: true
          }
        });
      }
      
      res.status(400).json({
        success: false,
        error: 'INVALID_PROMOTION',
        message: 'Invalid role transition'
      });
      
    } catch (error) {
      console.error('Error promoting user:', error);
      res.status(500).json({
        success: false,
        error: 'PROMOTION_FAILED',
        message: error.message
      });
    }
  }
);

/**
 * @route POST /api/roles/approve-promotion
 * @desc Approve or reject promotion request
 * @access Admin, Site Admin
 */
router.post('/approve-promotion',
  authenticate,
  requireRoles(['admin', 'site_admin']),
  body('promotion_id').isUUID(),
  body('vote').isIn(['approve', 'reject', 'abstain']),
  body('comments').optional().isString().isLength({ max: 500 }),
  validateRequest,
  async (req, res) => {
    try {
      const { promotion_id, vote, comments } = req.body;
      const roleService = getRoleService();
      
      const result = await roleService.recordVote(
        promotion_id,
        req.user.id,
        vote,
        comments
      );
      
      res.json({
        success: true,
        data: result
      });
      
    } catch (error) {
      console.error('Error recording vote:', error);
      res.status(400).json({
        success: false,
        error: 'VOTE_FAILED',
        message: error.message
      });
    }
  }
);

/**
 * @route GET /api/roles/pending-promotions
 * @desc Get all pending promotion requests
 * @access Admin, Site Admin
 */
router.get('/pending-promotions',
  authenticate,
  requireRoles(['admin', 'site_admin']),
  async (req, res) => {
    try {
      const roleService = getRoleService();
      const promotions = await roleService.getPendingPromotions();
      
      res.json({
        success: true,
        data: promotions
      });
      
    } catch (error) {
      console.error('Error fetching promotions:', error);
      res.status(500).json({
        success: false,
        error: 'FETCH_FAILED',
        message: 'Failed to fetch pending promotions'
      });
    }
  }
);

/**
 * @route POST /api/roles/revoke
 * @desc Revoke user's role (site admin only)
 * @access Site Admin
 */
router.post('/revoke',
  authenticate,
  requireRoles(['site_admin']),
  body('user_id').isUUID(),
  body('reason').isString(),
  validateRequest,
  async (req, res) => {
    try {
      const { user_id, reason } = req.body;
      const roleService = getRoleService();
      
      // Check if trying to revoke site_admin
      const currentRoles = await roleService.getUserRoles(user_id);
      if (currentRoles.includes('site_admin')) {
        return res.status(403).json({
          success: false,
          error: 'FORBIDDEN',
          message: 'Site admin role cannot be revoked, only transferred'
        });
      }
      
      // Assign default user role
      const result = await roleService.assignRole(
        user_id,
        'user',
        req.user.id,
        `Role revoked: ${reason}`
      );
      
      res.json({
        success: true,
        data: result
      });
      
    } catch (error) {
      console.error('Error revoking role:', error);
      res.status(500).json({
        success: false,
        error: 'REVOKE_FAILED',
        message: error.message
      });
    }
  }
);

module.exports = router;