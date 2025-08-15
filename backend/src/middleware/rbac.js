const { getRoleService } = require('../services/roleService');
const { auditService } = require('../services/auditService');

/**
 * Role hierarchy definition
 * Higher roles inherit permissions from lower roles
 */
const ROLE_HIERARCHY = {
  site_admin: ['site_admin', 'admin', 'user'],
  admin: ['admin', 'user'],
  user: ['user']
};

/**
 * Check if user has any of the required roles
 * @param {Array} userRoles - User's assigned roles
 * @param {Array} requiredRoles - Required roles for access
 * @returns {boolean}
 */
function hasRequiredRole(userRoles, requiredRoles) {
  for (const userRole of userRoles) {
    const inheritedRoles = ROLE_HIERARCHY[userRole] || [];
    if (requiredRoles.some(required => inheritedRoles.includes(required))) {
      return true;
    }
  }
  return false;
}

/**
 * Middleware to require specific roles for route access
 * @param {Array|String} allowedRoles - Role(s) required for access
 * @returns {Function} Express middleware
 */
function requireRoles(allowedRoles) {
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  
  return async (req, res, next) => {
    try {
      // Ensure user is authenticated
      if (!req.user || !req.user.id) {
        await auditService.log({
          event_type: 'authorization',
          event_severity: 'warning',
          event_name: 'unauthorized_access_attempt',
          action: 'access_denied',
          action_result: 'failure',
          target_path: req.path,
          ip_address: req.ip,
          user_agent: req.get('user-agent')
        });
        
        return res.status(401).json({
          success: false,
          error: 'UNAUTHORIZED',
          message: 'Authentication required'
        });
      }

      // Get user's roles
      const roleService = getRoleService();
      const userRoles = await roleService.getUserRoles(req.user.id);
      
      // Store roles in request for later use
      req.user.roles = userRoles;
      
      // Check if user has required roles
      if (!hasRequiredRole(userRoles, roles)) {
        await auditService.log({
          event_type: 'authorization',
          event_severity: 'warning',
          event_name: 'insufficient_permissions',
          action: 'access_denied',
          action_result: 'failure',
          actor_id: req.user.id,
          actor_roles: userRoles,
          required_roles: roles,
          target_path: req.path,
          ip_address: req.ip
        });
        
        return res.status(403).json({
          success: false,
          error: 'FORBIDDEN',
          message: 'Insufficient permissions for this operation'
        });
      }
      
      // User has required permissions
      next();
      
    } catch (error) {
      console.error('RBAC middleware error:', error);
      
      await auditService.log({
        event_type: 'system',
        event_severity: 'error',
        event_name: 'rbac_middleware_error',
        error_message: error.message,
        stack_trace: error.stack
      });
      
      return res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'Authorization check failed'
      });
    }
  };
}

/**
 * Check if user can perform specific action on resource
 * @param {String} userId - User ID
 * @param {String} action - Action to perform
 * @param {String} resourceType - Type of resource
 * @param {String} resourceId - Resource ID (optional)
 * @returns {Promise<boolean>}
 */
async function canPerformAction(userId, action, resourceType, resourceId = null) {
  try {
    const roleService = getRoleService();
    const permissions = await roleService.getUserPermissions(userId);
    
    // Check for wildcard permissions (site_admin)
    if (permissions.some(p => p.permission_code === 'system.all')) {
      return true;
    }
    
    // Check specific permissions
    for (const permission of permissions) {
      if (permission.resource_type === resourceType || permission.resource_type === '*') {
        const allowedActions = JSON.parse(permission.allowed_actions || '[]');
        if (allowedActions.includes(action) || allowedActions.includes('*')) {
          // Check resource ownership for 'own' permissions
          if (permission.permission_code.includes('.own')) {
            return await checkResourceOwnership(userId, resourceType, resourceId);
          }
          return true;
        }
      }
    }
    
    return false;
  } catch (error) {
    console.error('Permission check error:', error);
    return false;
  }
}

/**
 * Check if user owns the resource
 * @param {String} userId - User ID
 * @param {String} resourceType - Type of resource
 * @param {String} resourceId - Resource ID
 * @returns {Promise<boolean>}
 */
async function checkResourceOwnership(userId, resourceType, resourceId) {
  if (!resourceId) return false;
  
  const roleService = getRoleService();
  return await roleService.checkResourceOwnership(userId, resourceType, resourceId);
}

/**
 * Middleware to check specific permissions
 * @param {String} action - Required action
 * @param {String} resourceType - Resource type
 * @returns {Function} Express middleware
 */
function requirePermission(action, resourceType) {
  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({
          success: false,
          error: 'UNAUTHORIZED',
          message: 'Authentication required'
        });
      }
      
      const resourceId = req.params.id || req.params.userId || null;
      const hasPermission = await canPerformAction(
        req.user.id,
        action,
        resourceType,
        resourceId
      );
      
      if (!hasPermission) {
        await auditService.log({
          event_type: 'authorization',
          event_severity: 'warning',
          event_name: 'permission_denied',
          action: action,
          action_result: 'failure',
          actor_id: req.user.id,
          resource_type: resourceType,
          resource_id: resourceId,
          target_path: req.path
        });
        
        return res.status(403).json({
          success: false,
          error: 'FORBIDDEN',
          message: `Permission denied for action: ${action} on ${resourceType}`
        });
      }
      
      next();
      
    } catch (error) {
      console.error('Permission middleware error:', error);
      return res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'Permission check failed'
      });
    }
  };
}

/**
 * Check if user can create a specific role
 * @param {Array} userRoles - User's current roles
 * @param {String} targetRole - Role to create
 * @returns {boolean}
 */
function canCreateRole(userRoles, targetRole) {
  // Site admin can create any role
  if (userRoles.includes('site_admin')) {
    return true;
  }
  
  // Admin can only create user role
  if (userRoles.includes('admin') && targetRole === 'user') {
    return true;
  }
  
  return false;
}

/**
 * Check if user can modify another user's role
 * @param {Array} userRoles - User's current roles
 * @param {String} targetCurrentRole - Target user's current role
 * @param {String} targetNewRole - Target user's new role
 * @returns {boolean}
 */
function canModifyRole(userRoles, targetCurrentRole, targetNewRole) {
  // Site admin can modify any role
  if (userRoles.includes('site_admin')) {
    // But site_admin cannot be demoted
    if (targetCurrentRole === 'site_admin' && targetNewRole !== 'site_admin') {
      return false;
    }
    return true;
  }
  
  // Admin can promote user to admin (with approval)
  if (userRoles.includes('admin')) {
    if (targetCurrentRole === 'user' && targetNewRole === 'admin') {
      return true; // Will require approval workflow
    }
    // Admin can demote admin to user
    if (targetCurrentRole === 'admin' && targetNewRole === 'user') {
      return true;
    }
  }
  
  return false;
}

/**
 * Express middleware to attach user permissions to request
 */
async function attachPermissions(req, res, next) {
  if (req.user && req.user.id) {
    try {
      const roleService = getRoleService();
      req.user.permissions = await roleService.getUserPermissions(req.user.id);
      req.user.roles = await roleService.getUserRoles(req.user.id);
    } catch (error) {
      console.error('Error attaching permissions:', error);
      // Continue without permissions - specific routes will handle authorization
    }
  }
  next();
}

module.exports = {
  requireRoles,
  requirePermission,
  canPerformAction,
  canCreateRole,
  canModifyRole,
  attachPermissions,
  hasRequiredRole,
  ROLE_HIERARCHY
};