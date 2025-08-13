---
name: Security Feature
about: Implement security-related features or improvements
title: 'feat: [Security] Implement three-tier RBAC system (Site Admin, Admin, User)'
labels: security, enhancement, priority:critical, breaking-change
assignees: ''

---

## 📋 Description
Implement a comprehensive three-tier role-based access control (RBAC) system to replace the current basic authentication. This system will provide granular access control with Site Admin (root), Admin (user management), and User (standard) roles.

## 🎯 Acceptance Criteria
- [ ] Database tables created for roles and permissions management
- [ ] Site Admin role cannot be demoted (only deleted by another Site Admin)
- [ ] Admin role can manage users but cannot delete them
- [ ] User role has access only to personal features
- [ ] Role promotion from User to Admin requires 2 Admin approvals OR 1 Site Admin approval
- [ ] All role changes are audit logged with actor information
- [ ] Existing users migrated to appropriate roles
- [ ] Role inheritance implemented (Admin inherits User permissions)
- [ ] API endpoints enforce role-based permissions
- [ ] Session includes user roles for authorization checks

## 🔒 Security Considerations
- **Impact on existing security measures**: Enhances current authentication with granular authorization
- **New vulnerabilities mitigated**: 
  - Prevents privilege escalation through approval workflow
  - Eliminates single point of failure with multi-admin approval
  - Protects against unauthorized user deletion
- **Compliance requirements**: 
  - HIPAA: Role-based access control for PHI
  - GDPR: Audit trail for all permission changes
  - SOC2: Principle of least privilege enforcement

## 📊 Technical Implementation

### Database Changes
```sql
-- Create role tables from /database/security/authentication.sql

-- User roles assignment table
CREATE TABLE pf_user_roles (
    user_id VARCHAR2(36) NOT NULL,
    role_name VARCHAR2(50) NOT NULL,
    granted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    granted_by VARCHAR2(36),
    expires_at TIMESTAMP,
    is_active NUMBER(1) DEFAULT 1,
    notes VARCHAR2(500),
    PRIMARY KEY (user_id, role_name),
    FOREIGN KEY (user_id) REFERENCES pf_users(id) ON DELETE CASCADE,
    FOREIGN KEY (granted_by) REFERENCES pf_users(id),
    CONSTRAINT chk_role_name CHECK (role_name IN ('site_admin', 'admin', 'user'))
);

-- Role permissions mapping
CREATE TABLE pf_role_permissions (
    role_name VARCHAR2(50) NOT NULL,
    permission_code VARCHAR2(100) NOT NULL,
    resource_type VARCHAR2(50),
    allowed_actions VARCHAR2(500), -- JSON array
    description VARCHAR2(500),
    PRIMARY KEY (role_name, permission_code)
);

-- Role promotion approvals workflow
CREATE TABLE pf_role_promotion_approvals (
    id VARCHAR2(36) PRIMARY KEY,
    target_user_id VARCHAR2(36) NOT NULL,
    from_role VARCHAR2(50) NOT NULL,
    to_role VARCHAR2(50) NOT NULL,
    initiated_by VARCHAR2(36) NOT NULL,
    initiated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    required_approvals NUMBER(3) NOT NULL,
    current_approvals NUMBER(3) DEFAULT 0,
    status VARCHAR2(20) DEFAULT 'pending',
    justification VARCHAR2(1000),
    completed_at TIMESTAMP,
    expires_at TIMESTAMP,
    FOREIGN KEY (target_user_id) REFERENCES pf_users(id),
    FOREIGN KEY (initiated_by) REFERENCES pf_users(id)
);

-- Individual approval votes
CREATE TABLE pf_approval_votes (
    approval_id VARCHAR2(36) NOT NULL,
    voter_id VARCHAR2(36) NOT NULL,
    vote VARCHAR2(10) NOT NULL,
    voted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    comments VARCHAR2(500),
    PRIMARY KEY (approval_id, voter_id),
    FOREIGN KEY (approval_id) REFERENCES pf_role_promotion_approvals(id),
    FOREIGN KEY (voter_id) REFERENCES pf_users(id)
);

-- Insert default permissions
INSERT INTO pf_role_permissions (role_name, permission_code, resource_type, allowed_actions) VALUES
('site_admin', '*', '*', '["create","read","update","delete"]'),
('admin', 'users.manage', 'user', '["create","read","update"]'),
('admin', 'users.roles', 'role', '["read","update"]'),
('admin', 'reports.view', 'report', '["read"]'),
('user', 'profile.own', 'profile', '["read","update"]'),
('user', 'experiences.own', 'experience', '["create","read","update","delete"]');
```

### API Changes
```javascript
// backend/src/middleware/authorization.js
const requireRole = (roles) => {
  return async (req, res, next) => {
    const userRoles = await getUserRoles(req.user.id);
    
    // Check role hierarchy
    if (userRoles.includes('site_admin')) {
      return next(); // Site admin has all permissions
    }
    
    if (roles.includes('admin') && userRoles.includes('admin')) {
      return next(); // Admin has admin + user permissions
    }
    
    if (roles.some(role => userRoles.includes(role))) {
      return next();
    }
    
    return res.status(403).json({
      success: false,
      message: 'Insufficient permissions'
    });
  };
};

// backend/src/routes/auth.js
router.post('/roles/promote', 
  authenticate, 
  requireRole(['admin', 'site_admin']), 
  async (req, res) => {
    const { user_id, to_role, justification } = req.body;
    
    // Site admin can promote immediately
    if (req.user.roles.includes('site_admin')) {
      await promoteUser(user_id, to_role, req.user.id);
      return res.json({ success: true, status: 'approved' });
    }
    
    // Admin initiates approval workflow
    const promotion = await createPromotionRequest({
      target_user_id: user_id,
      to_role,
      initiated_by: req.user.id,
      justification,
      required_approvals: 2
    });
    
    return res.json({ 
      success: true, 
      promotion_id: promotion.id,
      status: 'pending_approval'
    });
  }
);

router.post('/roles/approve-promotion',
  authenticate,
  requireRole(['admin', 'site_admin']),
  async (req, res) => {
    const { promotion_id, vote, comments } = req.body;
    
    await recordVote(promotion_id, req.user.id, vote, comments);
    const promotion = await checkPromotionStatus(promotion_id);
    
    if (promotion.current_approvals >= promotion.required_approvals) {
      await executePromotion(promotion);
      return res.json({ success: true, status: 'approved' });
    }
    
    return res.json({ 
      success: true, 
      status: 'pending',
      approvals: `${promotion.current_approvals}/${promotion.required_approvals}`
    });
  }
);
```

### Configuration
```yaml
# Environment variables
ENABLE_RBAC=true
SITE_ADMIN_USERNAME=siteadmin
PROMOTION_APPROVAL_TIMEOUT_HOURS=72
ROLE_CACHE_TTL_SECONDS=300

# Feature flags in database
feature_key: rbac_system
is_enabled: true
rollout_percentage: 100
```

## 🧪 Testing Requirements
- [ ] Unit tests for role checking middleware
- [ ] Unit tests for permission inheritance logic
- [ ] Integration tests for promotion approval workflow
- [ ] Integration tests for role-based API access
- [ ] Security tests for privilege escalation attempts
- [ ] Load tests for role caching performance
- [ ] E2E tests for complete role management flow

### Test Scenarios
```javascript
// backend/tests/rbac.test.js
describe('RBAC System', () => {
  test('Site admin cannot be demoted', async () => {
    const result = await demoteUser(siteAdminId, 'admin');
    expect(result.error).toBe('Site admin cannot be demoted');
  });
  
  test('Admin cannot delete users', async () => {
    const result = await deleteUser(userId, adminToken);
    expect(result.status).toBe(403);
  });
  
  test('Promotion requires multiple approvals', async () => {
    const promotion = await createPromotion(userId, 'admin');
    await approvePromotion(promotion.id, admin1Id);
    expect(promotion.status).toBe('pending');
    
    await approvePromotion(promotion.id, admin2Id);
    expect(promotion.status).toBe('approved');
  });
});
```

## 📚 Documentation Updates
- [ ] Update API documentation with role requirements for each endpoint
- [ ] Create role matrix documentation showing permissions
- [ ] Update security guidelines with RBAC best practices
- [ ] Create user guide for role management
- [ ] Write migration guide for existing users
- [ ] Document approval workflow process
- [ ] Add troubleshooting guide for permission issues

## ⚠️ Breaking Changes
**Breaking Change**: All API endpoints will require role-based authorization.

### Migration Strategy:
1. **Phase 1**: Deploy role tables and assign all existing users to 'user' role
2. **Phase 2**: Identify and promote initial admins (manual process)
3. **Phase 3**: Provision site admin account during deployment
4. **Phase 4**: Enable RBAC middleware (feature flag controlled)
5. **Phase 5**: Remove old authorization system

### Rollback Plan:
- Feature flag to disable RBAC and fall back to previous auth
- Role tables are additive (no data loss)
- Keep old auth code for 2 releases

## 🔗 Dependencies
- Depends on: None (first in security sprint)
- Blocks: 
  - #2 (Password system needs roles)
  - #3 (Site admin provisioning)
  - #4 (User deletion permissions)
  - #12 (Role management UI)

## 📈 Success Metrics
- **Security Metrics:**
  - Zero unauthorized access incidents
  - 100% of admin actions audit logged
  - All role changes traceable to approver
  
- **Performance Benchmarks:**
  - Role check middleware < 10ms
  - Permission cache hit rate > 95%
  - Promotion workflow completion < 24 hours
  
- **Adoption Metrics:**
  - 100% of users assigned appropriate roles
  - Admin approval response time < 4 hours
  - Zero rollback incidents

- **Security Audit Requirements:**
  - Pass RBAC penetration testing
  - Complete audit trail for all role changes
  - Compliance with principle of least privilege
  - Regular access reviews implemented

## 🏃 Implementation Checklist

### Backend Tasks:
- [ ] Create database migration for role tables
- [ ] Implement role checking middleware
- [ ] Create role management service
- [ ] Add promotion approval workflow
- [ ] Update all API endpoints with role requirements
- [ ] Implement role caching for performance
- [ ] Add comprehensive audit logging

### DevOps Tasks:
- [ ] Add RBAC environment variables
- [ ] Create migration scripts
- [ ] Update deployment pipeline
- [ ] Configure monitoring alerts
- [ ] Set up role analytics dashboard

### QA Tasks:
- [ ] Create test plan for RBAC
- [ ] Write automated test suites
- [ ] Perform security testing
- [ ] Validate migration process
- [ ] Test rollback procedures

---

**Estimated Effort**: 8 story points
**Sprint**: 1 (Critical Security)
**Target Completion**: Week 2