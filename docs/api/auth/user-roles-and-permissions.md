# User Roles and Permissions System

## Overview

The Pathfinder system implements a three-tier role-based access control (RBAC) system with the following roles:

1. **Site Admin** - Root-level access with full system control
2. **Admin** - Administrative access with user management capabilities
3. **User** - Standard user access to personal features

## Role Definitions

### Site Admin

**Purpose:** Root-level system administrators with complete access to all system functions.

**Key Characteristics:**
- Cannot be demoted to other roles (only deleted)
- Provisioned during initial system deployment
- Username configured through environment variables
- System generates and displays complex password on first deployment
- Can have multiple site admins in the system
- Inherits all User role permissions

**Permissions:**
- All system permissions
- Create/modify/delete any user account
- Promote users to Admin or Site Admin
- Override user deletion cooling-off period
- Access system configuration and monitoring
- Manage database schemas and encryption keys
- View audit logs for all users
- Perform system maintenance operations

### Admin

**Purpose:** Administrative users who can manage other users and system settings.

**Key Characteristics:**
- Can be promoted from User role or demoted back to User
- Retains User role capabilities when Admin privileges are removed
- Cannot delete users (only Site Admin can)
- Inherits all User role permissions

**Permissions:**
- Create new User accounts
- Promote Users to Admin role (requires approval)
- Demote other Admins to User role
- Reset user passwords
- Unlock user accounts
- View user activity logs
- Manage reference data (skills, career paths, etc.)
- Access administrative dashboards

### User

**Purpose:** Standard users with access to personal career management features.

**Permissions:**
- Access personal profile and experiences
- Use Pathfinder chat interface
- Manage own career data
- Generate resumes and reports
- Access learning resources
- Delete own account (with cooling-off period)
- View own activity logs

## Role Management

### Initial Site Admin Provisioning

During system deployment (both development and production):

1. **Configuration:** Site admin username set via environment variable
   ```bash
   SITE_ADMIN_USERNAME=admin_username
   ```

2. **Password Generation:** System generates complex password meeting requirements:
   - Minimum 16 characters
   - Mix of uppercase, lowercase, numbers, special characters
   - Cryptographically secure random generation

3. **Display:** Password shown once during deployment:
   ```
   ========================================
   SITE ADMIN INITIAL PASSWORD
   Username: admin_username
   Password: xK9#mP2$vL5@nQ8&wR3^
   
   IMPORTANT: Save this password immediately.
   It will not be shown again.
   ========================================
   ```

4. **First Login:** Site admin must change password on first login

### Role Promotion

#### User to Admin Promotion

**Requirements:**
- Initiated by an existing Admin or Site Admin
- Requires approval from:
  - At least 2 Admins, OR
  - 1 Site Admin

**Process:**
1. Admin initiates promotion request
2. System sends notification to approvers
3. Approvers review and vote
4. Promotion activated when requirements met
5. Audit log records all participants

#### Admin to Site Admin Promotion

**Requirements:**
- Can only be done by existing Site Admin
- No additional approval required
- Audit logged with timestamp and initiator

### Role Demotion

#### Admin to User Demotion

**Permissions:**
- Site Admin: Can demote any Admin
- Admin: Can demote other Admins (not self)

**Process:**
1. Initiator requests demotion
2. Admin privileges immediately revoked
3. User retains standard User role access
4. Audit logged

#### Site Admin Deletion

**Important:** Site Admins cannot be demoted, only deleted

**Requirements:**
- Only another Site Admin can delete
- Requires confirmation dialog
- System prevents deletion of last Site Admin
- Immediate effect (no cooling-off period)

## User Account Lifecycle

### Account Creation

**Who Can Create:**
- Site Admins: Can create any role
- Admins: Can create User accounts only
- Users: Cannot create accounts

### Account Deletion

#### User Self-Deletion

**Process:**
1. User initiates deletion request
2. 7-day cooling-off period begins
3. Account marked as "soft deleted"
4. User can cancel deletion during cooling-off
5. Automatic permanent deletion after 7 days

**During Cooling-Off:**
- Account remains accessible
- User sees deletion warning
- Can cancel at any time
- Email reminders sent at days 1, 3, 6

#### Admin-Initiated Deletion

**Site Admin Only:**
- Can delete any user immediately
- Can override cooling-off periods
- Confirmation required
- Audit logged

## Database Schema

### User Roles Table

```sql
CREATE TABLE pf_user_roles (
    user_id UUID REFERENCES pf_users(id),
    role_name VARCHAR(50) NOT NULL,
    granted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    granted_by UUID REFERENCES pf_users(id),
    is_active BOOLEAN DEFAULT true,
    PRIMARY KEY (user_id, role_name)
);
```

### Role Permissions Table

```sql
CREATE TABLE pf_role_permissions (
    role_name VARCHAR(50) NOT NULL,
    permission_code VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
    allowed_actions TEXT[], -- ['create', 'read', 'update', 'delete']
    PRIMARY KEY (role_name, permission_code)
);
```

### Promotion Approvals Table

```sql
CREATE TABLE pf_role_promotion_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    target_user_id UUID REFERENCES pf_users(id),
    from_role VARCHAR(50) NOT NULL,
    to_role VARCHAR(50) NOT NULL,
    initiated_by UUID REFERENCES pf_users(id),
    initiated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    required_approvals INTEGER NOT NULL,
    status VARCHAR(20) DEFAULT 'pending', -- pending, approved, rejected, expired
    completed_at TIMESTAMP
);
```

### Approval Votes Table

```sql
CREATE TABLE pf_approval_votes (
    approval_id UUID REFERENCES pf_role_promotion_approvals(id),
    voter_id UUID REFERENCES pf_users(id),
    vote VARCHAR(10) NOT NULL, -- approve, reject
    voted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    comments TEXT,
    PRIMARY KEY (approval_id, voter_id)
);
```

### User Deletion Queue Table

```sql
CREATE TABLE pf_user_deletion_queue (
    user_id UUID PRIMARY KEY REFERENCES pf_users(id),
    deletion_requested_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deletion_scheduled_for TIMESTAMP NOT NULL,
    requested_by UUID REFERENCES pf_users(id),
    cancellation_token VARCHAR(255) UNIQUE,
    status VARCHAR(20) DEFAULT 'pending', -- pending, cancelled, completed
    override_cooling_off BOOLEAN DEFAULT false,
    processed_at TIMESTAMP
);
```

## Security Considerations

### Password Requirements

**Site Admin:**
- Minimum 16 characters
- Must include uppercase, lowercase, numbers, special characters
- Cannot reuse last 10 passwords
- Expires every 30 days

**Admin:**
- Minimum 12 characters
- Must include 3 of 4 character types
- Cannot reuse last 5 passwords
- Expires every 60 days

**User:**
- Minimum 8 characters
- Must include 2 of 4 character types
- Cannot reuse last 3 passwords
- Expires every 90 days (optional)

### Multi-Factor Authentication

- **Site Admin:** MFA required
- **Admin:** MFA strongly recommended
- **User:** MFA optional

### Audit Logging

All role-related actions are logged:
- Role grants and revocations
- Promotion requests and approvals
- Account deletions
- Failed authorization attempts
- Password changes

## API Implementation

See [Authentication API Documentation](./authentication-api.md) for detailed endpoint specifications.

## Migration Path

For existing systems migrating to this role model:

1. **Phase 1:** Deploy role tables and permissions
2. **Phase 2:** Assign all existing users to User role
3. **Phase 3:** Identify and promote initial Admins
4. **Phase 4:** Provision Site Admin account
5. **Phase 5:** Enable role-based access controls
6. **Phase 6:** Audit and adjust permissions