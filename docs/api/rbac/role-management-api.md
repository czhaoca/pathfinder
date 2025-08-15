# Role Management API Documentation

## Overview

The Pathfinder RBAC (Role-Based Access Control) system implements a three-tier role hierarchy with comprehensive permission management and approval workflows.

## Role Hierarchy

```
site_admin (Root Level)
    ├── Inherits: admin, user permissions
    ├── Can: Everything
    └── Protected: Cannot be demoted

admin (Management Level)
    ├── Inherits: user permissions
    ├── Can: Manage users (no deletion), view reports
    └── Requires: Approval for promotions

user (Standard Level)
    ├── Inherits: None
    ├── Can: Manage own resources
    └── Default: Assigned to all new users
```

## API Endpoints

### Get My Roles
**GET** `/api/roles/my-roles`

Get current authenticated user's roles and permissions.

**Headers:**
- `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "data": {
    "roles": ["admin"],
    "permissions": [
      {
        "code": "users.manage",
        "resource": "user",
        "actions": ["create", "read", "update"]
      },
      {
        "code": "profile.own",
        "resource": "profile",
        "actions": ["read", "update"]
      }
    ]
  }
}
```

### Get User Roles
**GET** `/api/roles/user/:userId`

Get specific user's roles (admin/site_admin only).

**Headers:**
- `Authorization: Bearer <token>`

**Parameters:**
- `userId` (UUID): Target user ID

**Response:**
```json
{
  "success": true,
  "data": {
    "roles": ["user"]
  }
}
```

### Assign Role (Direct)
**POST** `/api/roles/assign`

Directly assign role to user (site_admin only).

**Headers:**
- `Authorization: Bearer <token>`

**Body:**
```json
{
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "role": "admin",
  "notes": "Promoted for excellent performance"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "success": true,
    "role": "admin"
  }
}
```

### Request Role Promotion
**POST** `/api/roles/promote`

Request role promotion (may require approval).

**Headers:**
- `Authorization: Bearer <token>`

**Body:**
```json
{
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "to_role": "admin",
  "justification": "User has demonstrated leadership skills and technical expertise"
}
```

**Response (Requires Approval):**
```json
{
  "success": true,
  "data": {
    "promotion_id": "660e8400-e29b-41d4-a716-446655440001",
    "status": "pending_approval",
    "expires_at": "2025-08-17T15:30:00Z",
    "required_approvals": 2
  }
}
```

**Response (Immediate - Site Admin):**
```json
{
  "success": true,
  "data": {
    "success": true,
    "role": "admin",
    "status": "approved",
    "immediate": true
  }
}
```

### Approve/Reject Promotion
**POST** `/api/roles/approve-promotion`

Vote on pending promotion request (admin/site_admin only).

**Headers:**
- `Authorization: Bearer <token>`

**Body:**
```json
{
  "promotion_id": "660e8400-e29b-41d4-a716-446655440001",
  "vote": "approve",
  "comments": "User is ready for admin responsibilities"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "success": true,
    "status": "approved",
    "current_approvals": 2,
    "required_approvals": 2
  }
}
```

### Get Pending Promotions
**GET** `/api/roles/pending-promotions`

Get all pending promotion requests (admin/site_admin only).

**Headers:**
- `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "660e8400-e29b-41d4-a716-446655440001",
      "target_user_id": "550e8400-e29b-41d4-a716-446655440000",
      "username": "john.doe",
      "email": "john@example.com",
      "from_role": "user",
      "to_role": "admin",
      "initiated_by": "770e8400-e29b-41d4-a716-446655440002",
      "initiated_at": "2025-08-14T10:00:00Z",
      "required_approvals": 2,
      "current_approvals": 1,
      "status": "pending",
      "justification": "Ready for admin role",
      "expires_at": "2025-08-17T10:00:00Z"
    }
  ]
}
```

### Revoke Role
**POST** `/api/roles/revoke`

Revoke user's elevated role (site_admin only).

**Headers:**
- `Authorization: Bearer <token>`

**Body:**
```json
{
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "reason": "Policy violation"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "success": true,
    "role": "user"
  }
}
```

## Permission Codes

### Site Admin Permissions
- `system.all` - Full system access
- `users.all` - Full user management
- `roles.all` - Full role management
- `config.all` - System configuration
- `audit.all` - Audit log management

### Admin Permissions
- `users.manage` - User management (no deletion)
- `users.roles` - Role assignment (with approval)
- `users.reset_password` - Reset user passwords
- `users.bulk` - Bulk user operations
- `reports.view` - View and export reports
- `audit.view` - View audit logs
- Plus all user permissions

### User Permissions
- `profile.own` - Own profile management
- `experiences.own` - Own experiences
- `skills.own` - Own skills
- `documents.own` - Own documents
- `settings.own` - Own settings
- `chat.own` - Own chat history

## Approval Workflow

### User to Admin Promotion
1. Admin initiates promotion request
2. Request requires 2 admin approvals (or 1 site_admin)
3. Approvals must be completed within 72 hours
4. Once approved, role change is automatic
5. All actions are audit logged

### Workflow Rules
- Initiator's request counts as first approval
- Users cannot vote on their own promotion
- Each admin can only vote once per promotion
- Site admins can bypass approval workflow
- Expired promotions must be re-initiated

## Error Codes

| Code | Description |
|------|-------------|
| `UNAUTHORIZED` | No authentication token provided |
| `FORBIDDEN` | Insufficient permissions |
| `ROLE_ASSIGNMENT_FAILED` | Failed to assign role |
| `INVALID_PROMOTION` | Invalid role transition |
| `PROMOTION_FAILED` | Promotion request failed |
| `VOTE_FAILED` | Failed to record vote |
| `FETCH_FAILED` | Failed to fetch data |
| `REVOKE_FAILED` | Failed to revoke role |

## Security Considerations

1. **Site Admin Protection**: Site admin role cannot be demoted, only transferred
2. **Approval Requirements**: Admin promotions require multiple approvals
3. **Audit Trail**: All role changes are comprehensively logged
4. **Permission Inheritance**: Higher roles inherit lower role permissions
5. **Resource Ownership**: Users can only access their own resources unless elevated

## Rate Limiting

Role management endpoints have the following rate limits:
- Role assignment: 10 requests per minute
- Promotion requests: 5 requests per minute
- Approval votes: 20 requests per minute

## Examples

### Promote User to Admin (with approval workflow)
```javascript
// Admin 1 initiates promotion
const response = await fetch('/api/roles/promote', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${admin1Token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    user_id: 'user-uuid',
    to_role: 'admin',
    justification: 'User has shown excellent leadership'
  })
});

const { promotion_id } = await response.json();

// Admin 2 approves
await fetch('/api/roles/approve-promotion', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${admin2Token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    promotion_id,
    vote: 'approve',
    comments: 'Agree with assessment'
  })
});
```

### Check User Permissions
```javascript
// Get current user's roles and permissions
const response = await fetch('/api/roles/my-roles', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

const { roles, permissions } = await response.json();

// Check if user can perform action
const canManageUsers = permissions.some(p => 
  p.code === 'users.manage' && 
  p.actions.includes('create')
);
```