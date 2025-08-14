---
name: API Enhancement
about: Update API endpoints for new authentication system
title: 'feat: [API] Update all endpoints for new authentication and RBAC system'
labels: api, enhancement, breaking-change, priority:high
assignees: ''

---

## 📋 Description
Update all API endpoints to support the new token-based password system, three-tier RBAC, and secure authentication flow. This includes modifying existing endpoints, adding new endpoints for password retrieval and user management, and ensuring all endpoints properly validate permissions based on the new role hierarchy.

## 🎯 Acceptance Criteria
- [ ] All authentication endpoints updated to use password_hash instead of password
- [ ] New password retrieval endpoint implemented
- [ ] New password reset endpoint with 3-hour token expiry
- [ ] User management endpoints restricted by role (Site Admin > Admin > User)
- [ ] All endpoints validate JWT tokens with 15-minute expiry
- [ ] Role-based middleware implemented for all protected routes
- [ ] Batch user operations for admins
- [ ] Audit logging integrated into all endpoints
- [ ] Rate limiting applied per endpoint based on sensitivity
- [ ] API versioning implemented (v1 -> v2)
- [ ] Backwards compatibility layer for migration period

## 🔧 Technical Implementation

### Updated Authentication Endpoints
```javascript
// backend/src/routes/auth.v2.js
const router = express.Router();
const { validateRole, requireRoles } = require('../middleware/rbac');
const { rateLimiter } = require('../middleware/rateLimit');
const { auditLog } = require('../middleware/audit');

/**
 * POST /api/v2/auth/register
 * No password in request body - system generates
 */
router.post('/register', 
  rateLimiter('register', { max: 5, window: '15m' }),
  requireRoles(['admin', 'site_admin']),
  auditLog('user_registration'),
  async (req, res) => {
    const { username, email, first_name, last_name, role } = req.body;
    
    // Validate requesting user can create this role
    if (!canCreateRole(req.user.roles, role)) {
      return res.status(403).json({
        success: false,
        error: 'INSUFFICIENT_PRIVILEGES',
        message: 'Cannot create user with specified role'
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
        created_by: req.user.id
      });
      
      res.status(201).json({
        success: true,
        data: {
          user: {
            id: result.userId,
            username,
            email,
            role
          },
          password_retrieval_token: result.retrievalToken,
          token_expires_at: result.tokenExpiry,
          temporary_password_expires_at: result.passwordExpiry
        }
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.code,
        message: error.message
      });
    }
  }
);

/**
 * POST /api/v2/auth/login
 * Uses client-hashed password
 */
router.post('/login',
  rateLimiter('login', { max: 10, window: '15m', skipSuccessfulRequests: true }),
  auditLog('authentication'),
  async (req, res) => {
    const { username, password_hash, client_salt, mfa_token } = req.body;
    
    // Reject plain passwords
    if (req.body.password) {
      await auditService.log({
        event_type: 'security',
        event_severity: 'warning',
        event_name: 'plain_password_attempt',
        actor_username: username,
        ip_address: req.ip
      });
      
      return res.status(400).json({
        success: false,
        error: 'INVALID_REQUEST',
        message: 'Plain text passwords not accepted'
      });
    }
    
    try {
      const result = await authService.authenticate({
        username,
        password_hash,
        client_salt,
        mfa_token,
        ip_address: req.ip,
        user_agent: req.get('user-agent')
      });
      
      if (result.requires_mfa && !mfa_token) {
        return res.status(200).json({
          success: false,
          requires_mfa: true,
          mfa_methods: result.mfa_methods
        });
      }
      
      if (result.must_change_password) {
        return res.status(200).json({
          success: false,
          must_change_password: true,
          change_token: result.change_token
        });
      }
      
      res.json({
        success: true,
        data: {
          user: result.user,
          token: result.token,
          refresh_token: result.refresh_token,
          expires_at: result.expires_at,
          permissions: result.permissions
        }
      });
    } catch (error) {
      res.status(401).json({
        success: false,
        error: 'AUTHENTICATION_FAILED',
        message: 'Invalid credentials'
      });
    }
  }
);

/**
 * POST /api/v2/auth/password/retrieve
 * One-time token for password retrieval
 */
router.post('/password/retrieve',
  rateLimiter('password_retrieve', { max: 3, window: '1h' }),
  auditLog('password_retrieval'),
  async (req, res) => {
    const { retrieval_token } = req.body;
    
    try {
      const result = await passwordService.retrievePassword(retrieval_token);
      
      res.json({
        success: true,
        data: {
          username: result.username,
          temporary_password: result.password,
          expires_at: result.expires_at,
          must_change: true,
          client_salt: result.client_salt
        }
      });
    } catch (error) {
      res.status(404).json({
        success: false,
        error: 'INVALID_TOKEN',
        message: 'Token invalid or expired'
      });
    }
  }
);

/**
 * POST /api/v2/auth/password/reset
 * Request password reset with 3-hour token
 */
router.post('/password/reset/request',
  rateLimiter('password_reset', { max: 3, window: '1h' }),
  auditLog('password_reset_request'),
  async (req, res) => {
    const { email } = req.body;
    
    try {
      await passwordService.requestReset(email);
      
      // Always return success to prevent email enumeration
      res.json({
        success: true,
        message: 'If the email exists, a reset link has been sent'
      });
    } catch (error) {
      // Log error but don't expose to client
      console.error('Password reset error:', error);
      res.json({
        success: true,
        message: 'If the email exists, a reset link has been sent'
      });
    }
  }
);

/**
 * POST /api/v2/auth/refresh
 * Refresh JWT token
 */
router.post('/refresh',
  rateLimiter('token_refresh', { max: 30, window: '15m' }),
  async (req, res) => {
    const { refresh_token } = req.body;
    
    try {
      const result = await authService.refreshToken(refresh_token);
      
      res.json({
        success: true,
        data: {
          token: result.token,
          expires_at: result.expires_at
        }
      });
    } catch (error) {
      res.status(401).json({
        success: false,
        error: 'INVALID_REFRESH_TOKEN',
        message: 'Invalid or expired refresh token'
      });
    }
  }
);
```

### User Management Endpoints
```javascript
// backend/src/routes/users.v2.js

/**
 * GET /api/v2/users
 * List users based on requester's role
 */
router.get('/',
  requireRoles(['user', 'admin', 'site_admin']),
  async (req, res) => {
    const { page = 1, limit = 20, search, role, status } = req.query;
    
    // Users can only see themselves
    if (req.user.roles.includes('user') && !req.user.roles.includes('admin')) {
      const user = await userService.getUser(req.user.id);
      return res.json({
        success: true,
        data: {
          users: [user],
          total: 1,
          page: 1,
          limit: 1
        }
      });
    }
    
    // Admins can see all users
    const result = await userService.listUsers({
      page,
      limit,
      search,
      role,
      status,
      requester_role: req.user.roles[0]
    });
    
    res.json({
      success: true,
      data: result
    });
  }
);

/**
 * PUT /api/v2/users/:id/role
 * Promote/demote user (requires approval workflow)
 */
router.put('/:id/role',
  requireRoles(['admin', 'site_admin']),
  auditLog('role_change'),
  async (req, res) => {
    const { id } = req.params;
    const { new_role, reason } = req.body;
    
    try {
      // Check if promotion requires approval
      if (requiresApproval(req.user.roles[0], new_role)) {
        const approval = await approvalService.createRequest({
          type: 'role_change',
          target_user: id,
          new_role,
          reason,
          requested_by: req.user.id
        });
        
        return res.json({
          success: true,
          data: {
            status: 'pending_approval',
            approval_id: approval.id,
            approvers_needed: approval.approvers_needed
          }
        });
      }
      
      // Direct role change (site_admin changing admin to user)
      await userService.changeRole(id, new_role, req.user.id, reason);
      
      res.json({
        success: true,
        data: {
          status: 'completed',
          new_role
        }
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.code,
        message: error.message
      });
    }
  }
);

/**
 * DELETE /api/v2/users/:id
 * Initiate user deletion with cooling-off period
 */
router.delete('/:id',
  requireRoles(['user', 'admin', 'site_admin']),
  auditLog('user_deletion_request'),
  async (req, res) => {
    const { id } = req.params;
    const { confirmation, reason, override_cooling_off } = req.body;
    
    // Validate user can delete
    if (id !== req.user.id && !req.user.roles.includes('admin')) {
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: 'Can only delete your own account'
      });
    }
    
    // Require confirmation
    if (confirmation !== 'DELETE') {
      return res.status(400).json({
        success: false,
        error: 'CONFIRMATION_REQUIRED',
        message: 'Please confirm deletion'
      });
    }
    
    try {
      // Site admin can override cooling-off
      if (override_cooling_off && req.user.roles.includes('site_admin')) {
        await userService.deleteUserImmediate(id, req.user.id, reason);
        return res.json({
          success: true,
          data: {
            status: 'deleted',
            immediate: true
          }
        });
      }
      
      // Normal deletion with cooling-off
      const result = await userService.requestDeletion(id, req.user.id, reason);
      
      res.json({
        success: true,
        data: {
          status: 'scheduled',
          scheduled_for: result.scheduled_for,
          cancellation_token: result.cancellation_token,
          cooling_off_days: 7
        }
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.code,
        message: error.message
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
  rateLimiter('batch_operation', { max: 5, window: '1h' }),
  auditLog('batch_user_operation'),
  async (req, res) => {
    const { operation, user_ids, params } = req.body;
    
    const allowedOperations = ['activate', 'deactivate', 'reset_password', 'send_notification'];
    
    if (!allowedOperations.includes(operation)) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_OPERATION',
        message: `Operation must be one of: ${allowedOperations.join(', ')}`
      });
    }
    
    try {
      const results = await userService.batchOperation({
        operation,
        user_ids,
        params,
        performed_by: req.user.id
      });
      
      res.json({
        success: true,
        data: {
          operation,
          total: user_ids.length,
          successful: results.successful.length,
          failed: results.failed.length,
          details: results
        }
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.code,
        message: error.message
      });
    }
  }
);
```

### Role-Based Middleware
```javascript
// backend/src/middleware/rbac.js
const roleHierarchy = {
  site_admin: ['site_admin', 'admin', 'user'],
  admin: ['admin', 'user'],
  user: ['user']
};

function requireRoles(allowedRoles) {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Authentication required'
      });
    }
    
    const userRoles = req.user.roles || [];
    
    // Check if user has any of the allowed roles
    const hasPermission = allowedRoles.some(role => {
      return userRoles.some(userRole => {
        return roleHierarchy[userRole]?.includes(role);
      });
    });
    
    if (!hasPermission) {
      await auditService.log({
        event_type: 'authorization',
        event_severity: 'warning',
        event_name: 'access_denied',
        actor_id: req.user.id,
        target_path: req.path,
        required_roles: allowedRoles,
        user_roles: userRoles
      });
      
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: 'Insufficient privileges'
      });
    }
    
    next();
  };
}

function canPerformAction(userRoles, action, targetRoles) {
  // Define action permissions
  const actionPermissions = {
    create_user: {
      site_admin: ['admin', 'user'],
      admin: ['user']
    },
    modify_role: {
      site_admin: ['admin', 'user'],
      admin: [] // Cannot modify roles
    },
    delete_user: {
      site_admin: ['admin', 'user'],
      admin: ['user']
    }
  };
  
  const userTopRole = userRoles[0]; // Highest role
  const allowedTargets = actionPermissions[action]?.[userTopRole] || [];
  
  return targetRoles.every(role => allowedTargets.includes(role));
}
```

### API Versioning
```javascript
// backend/src/app.js
const app = express();

// Version 2 routes (new system)
app.use('/api/v2/auth', require('./routes/auth.v2'));
app.use('/api/v2/users', require('./routes/users.v2'));
app.use('/api/v2/admin', require('./routes/admin.v2'));

// Version 1 routes (legacy - with deprecation warning)
app.use('/api/v1/*', (req, res, next) => {
  res.set('X-API-Deprecation-Warning', 'API v1 is deprecated. Please migrate to v2.');
  res.set('X-API-Deprecation-Date', '2024-06-01');
  next();
});

app.use('/api/v1/auth', require('./routes/auth.v1'));
app.use('/api/v1/users', require('./routes/users.v1'));

// Default to v2
app.use('/api/auth', require('./routes/auth.v2'));
app.use('/api/users', require('./routes/users.v2'));
```

## 🧪 Testing Requirements
- [ ] Unit tests for all new endpoints
- [ ] Integration tests for role-based access
- [ ] Security tests for authorization bypass attempts
- [ ] Load tests for batch operations
- [ ] Backwards compatibility tests
- [ ] Rate limiting tests
- [ ] Token expiry tests
- [ ] API versioning tests

## 📚 Documentation Updates
- [ ] Update API reference with v2 endpoints
- [ ] Create migration guide from v1 to v2
- [ ] Document breaking changes
- [ ] Add authentication flow diagrams
- [ ] Create role permission matrix
- [ ] Update Postman/OpenAPI specs
- [ ] Add code examples for each endpoint

## ⚠️ Breaking Changes
- Password field removed from all requests
- New authentication flow with password_hash
- JWT tokens expire after 15 minutes (was 24 hours)
- Role-based restrictions on all endpoints
- API versioning introduced

## 🔗 Dependencies
- Depends on: #1, #2, #3, #4, #5, #6, #7
- Blocks: #11 (Frontend implementation)

## 📊 Success Metrics
- All endpoints migrated to v2: 100%
- Authorization checks pass rate: 100%
- API response time < 200ms (p95)
- Zero authorization bypass vulnerabilities
- Backwards compatibility maintained for 3 months

---

**Estimated Effort**: 13 story points
**Sprint**: 3 (API & Documentation)
**Target Completion**: Week 5