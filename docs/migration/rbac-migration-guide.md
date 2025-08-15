# RBAC Migration Guide

## Overview

This guide covers the migration process from the basic authentication system to the comprehensive three-tier RBAC system.

## Migration Phases

### Phase 1: Database Setup (No Downtime)
**Timeline:** Immediate

1. **Run migration script:**
```bash
cd backend/src/database/migrations
sqlplus username/password@database @001_create_rbac_tables.sql
```

2. **Verify tables created:**
```sql
SELECT table_name FROM user_tables 
WHERE table_name LIKE 'PF_%ROLE%' 
OR table_name LIKE 'PF_%APPROVAL%';
```

3. **Check existing users have default role:**
```sql
SELECT u.username, r.role_name 
FROM pf_users u 
LEFT JOIN pf_user_roles r ON u.id = r.user_id 
WHERE r.is_active = 1;
```

All existing users should have 'user' role assigned.

### Phase 2: Identify and Promote Initial Admins
**Timeline:** Within 24 hours

1. **Identify admin candidates:**
   - Current system administrators
   - Team leads
   - Users with elevated access needs

2. **Provision site admin (one-time during deployment):**
```bash
npm run provision:site-admin
# Follow prompts to create site admin account
# SAVE THE GENERATED PASSWORD SECURELY
```

3. **Promote initial admins (as site admin):**
```javascript
POST /api/roles/assign
{
  "user_id": "admin-candidate-uuid",
  "role": "admin",
  "notes": "Initial admin assignment during migration"
}
```

### Phase 3: Enable RBAC Middleware
**Timeline:** After admin assignment

1. **Update environment configuration:**
```env
ENABLE_RBAC=true
RBAC_ENFORCEMENT_MODE=permissive  # Log violations but allow access
```

2. **Monitor for permission issues:**
```sql
SELECT event_name, actor_id, target_path, COUNT(*) as violations
FROM pf_audit_log
WHERE event_type = 'authorization'
AND event_name = 'insufficient_permissions'
AND event_timestamp > SYSDATE - 1
GROUP BY event_name, actor_id, target_path;
```

3. **Fix any permission gaps:**
   - Update role assignments
   - Adjust permission definitions
   - Modify API endpoint requirements

### Phase 4: Enforce RBAC
**Timeline:** After 1 week monitoring

1. **Switch to enforcement mode:**
```env
RBAC_ENFORCEMENT_MODE=enforce  # Block unauthorized access
```

2. **Remove old authorization code:**
   - Delete legacy middleware
   - Remove old permission checks
   - Clean up deprecated routes

### Phase 5: Cleanup
**Timeline:** After 2 weeks stable operation

1. **Remove rollback code:**
   - Delete old auth system files
   - Remove feature flags
   - Clean up migration scripts

2. **Optimize performance:**
   - Tune cache settings
   - Add database indexes if needed
   - Monitor query performance

## Migration Checklist

### Pre-Migration
- [ ] Backup database
- [ ] Review current user permissions
- [ ] Identify admin candidates
- [ ] Test migration in staging environment
- [ ] Prepare rollback plan

### During Migration
- [ ] Run database migration script
- [ ] Verify all users have roles assigned
- [ ] Create site admin account
- [ ] Promote initial admins
- [ ] Enable RBAC in permissive mode
- [ ] Monitor audit logs

### Post-Migration
- [ ] Switch to enforcement mode
- [ ] Train admins on new system
- [ ] Update documentation
- [ ] Remove old code
- [ ] Performance optimization

## User Communication

### Email Template for Users
```
Subject: Important: Security System Upgrade

Dear [Username],

We're upgrading our security system to provide better protection for your data.

What's changing:
- Enhanced role-based access control
- Improved audit logging
- Better permission management

What you need to know:
- Your access level: [Current Role]
- No action required for most users
- Contact support if you experience access issues

Timeline:
- [Date]: System upgrade begins
- [Date]: New security active
- [Date]: Migration complete

Questions? Contact support@pathfinder.app

Best regards,
The Pathfinder Team
```

### Admin Training Points

1. **Role Management:**
   - How to view user roles
   - Promotion approval process
   - When to escalate to site admin

2. **Permission Concepts:**
   - Role hierarchy
   - Permission inheritance
   - Resource ownership

3. **Common Tasks:**
   - Reset user passwords
   - Approve promotions
   - View audit logs
   - Handle permission errors

## Rollback Plan

If issues arise during migration:

### Immediate Rollback (Phase 1-2)
```sql
-- Disable RBAC checks
UPDATE pf_system_config 
SET config_value = 'false' 
WHERE config_key = 'rbac.enabled';

-- Keep role tables (no data loss)
-- Revert to old auth middleware
```

### Feature Flag Rollback (Phase 3-4)
```env
ENABLE_RBAC=false
FALLBACK_TO_LEGACY_AUTH=true
```

### Emergency Procedures
1. **Site Admin locked out:**
   - Use emergency recovery mechanism
   - Run recovery script with physical server access
   - Contact database administrator

2. **Mass permission issues:**
   - Switch to permissive mode immediately
   - Grant temporary elevated roles
   - Fix permission definitions
   - Re-enable enforcement

## Monitoring and Validation

### Key Metrics to Track
```sql
-- Daily active users by role
SELECT role_name, COUNT(DISTINCT user_id) as active_users
FROM pf_user_roles r
JOIN pf_user_sessions s ON r.user_id = s.user_id
WHERE s.last_activity > SYSDATE - 1
GROUP BY role_name;

-- Failed authorization attempts
SELECT COUNT(*) as failed_auths
FROM pf_audit_log
WHERE event_name = 'insufficient_permissions'
AND event_timestamp > SYSDATE - 1;

-- Promotion approval metrics
SELECT 
  AVG(completed_at - initiated_at) as avg_approval_time,
  COUNT(*) as total_promotions
FROM pf_role_promotion_approvals
WHERE status = 'approved'
AND completed_at > SYSDATE - 7;
```

### Success Criteria
- [ ] Zero unauthorized access after enforcement
- [ ] All users successfully authenticated
- [ ] Admin operations functioning normally
- [ ] Audit logs capturing all events
- [ ] Performance metrics within acceptable range

## Troubleshooting

### Common Issues and Solutions

1. **User cannot access own resources:**
   - Check role assignment: `SELECT * FROM pf_user_roles WHERE user_id = ?`
   - Verify resource ownership
   - Check permission definitions

2. **Admin cannot perform expected action:**
   - Verify admin role is active
   - Check permission inheritance
   - Review recent role changes

3. **Promotion workflow stuck:**
   - Check approval expiry
   - Verify approvers have correct roles
   - Look for duplicate votes

4. **Performance degradation:**
   - Check cache hit rates
   - Review database query plans
   - Increase cache TTL if appropriate

## Support Contacts

- **Technical Issues:** tech-support@pathfinder.app
- **Security Concerns:** security@pathfinder.app
- **Emergency:** Use PagerDuty escalation
- **Documentation:** https://docs.pathfinder.app/rbac

## Appendix: SQL Queries

### Useful Administrative Queries

```sql
-- Find users without roles
SELECT u.id, u.username 
FROM pf_users u
LEFT JOIN pf_user_roles r ON u.id = r.user_id AND r.is_active = 1
WHERE r.user_id IS NULL;

-- Recent role changes
SELECT 
  u.username,
  r.role_name,
  r.granted_at,
  g.username as granted_by
FROM pf_user_roles r
JOIN pf_users u ON r.user_id = u.id
LEFT JOIN pf_users g ON r.granted_by = g.id
WHERE r.granted_at > SYSDATE - 7
ORDER BY r.granted_at DESC;

-- Permission check for specific user
SELECT DISTINCT p.*
FROM pf_role_permissions p
JOIN pf_user_roles r ON p.role_name = r.role_name
WHERE r.user_id = :user_id
AND r.is_active = 1;
```