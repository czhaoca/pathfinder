# Authentication API Documentation

## Overview

The Authentication API manages user authentication, authorization, and role management for the Pathfinder system.

## Base Endpoints

All authentication endpoints are prefixed with `/api/auth`.

## Site Admin Provisioning

### POST /auth/provision-site-admin

**Description:** Initial provisioning of site admin account during system deployment. This endpoint can only be called once and requires system-level access.

**Authentication:** System token (configured during deployment)

**Request Body:**
```json
{
  "system_token": "string",
  "username": "string"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "username": "admin_username",
    "temporary_password": "xK9#mP2$vL5@nQ8&wR3^",
    "expires_at": "2025-08-13T12:00:00Z",
    "must_change_password": true
  }
}
```

**Error Responses:**
- `409 Conflict` - Site admin already provisioned
- `401 Unauthorized` - Invalid system token

## User Registration

### POST /auth/register

**Description:** Create a new user account. Only Admins and Site Admins can use this endpoint. System generates a secure temporary password that must be retrieved separately.

**Authentication:** Required (Admin or Site Admin)

**Request Body:**
```json
{
  "username": "string",
  "email": "string",
  "firstName": "string",
  "lastName": "string",
  "role": "user", // "user" | "admin" (site_admin requires separate promotion)
  "send_welcome_email": true,
  "require_password_change": true // Default: true
}
```

**Note:** No password is included in the request. System generates a secure temporary password.

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "username": "string",
      "email": "string",
      "firstName": "string",
      "lastName": "string",
      "roles": ["user"],
      "created_at": "2025-08-13T10:00:00Z"
    },
    "password_token": "secure_token_abc123", // One-time token to retrieve password
    "token_expires_at": "2025-08-13T11:00:00Z" // 1 hour expiry
  }
}
```

**Validation Rules:**
- Username: 3-30 characters, alphanumeric and underscores only
- Email: Valid email format
- Role: Only "user" or "admin" allowed (site_admin requires promotion)

**Error Responses:**
- `400 Bad Request` - Validation failed
- `401 Unauthorized` - Not authenticated or insufficient permissions
- `409 Conflict` - Username or email already exists

## Authentication

### POST /auth/login

**Description:** Authenticate user and receive tokens. Password must be salted client-side before transmission.

**Request Body:**
```json
{
  "username": "string",
  "password_hash": "string", // Client-salted password hash (SHA256)
  "client_salt": "string", // Random salt used by client
  "mfa_code": "string" // Optional, required if MFA enabled
}
```

**Password Hashing:**
- Client generates random salt (minimum 32 bytes)
- Client creates hash: SHA256(password + client_salt)
- Server never receives or stores plain text password
- Server applies additional hashing before storage

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "username": "string",
      "email": "string",
      "firstName": "string",
      "lastName": "string",
      "roles": ["user", "admin"],
      "must_change_password": false,
      "mfa_enabled": false
    },
    "token": "jwt_token",
    "refresh_token": "refresh_token",
    "expires_at": "2025-08-13T10:15:00Z"
  }
}
```

### POST /auth/logout

**Description:** Logout user and invalidate tokens.

**Authentication:** Required

**Response:**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

### POST /auth/refresh

**Description:** Refresh access token using refresh token.

**Request Body:**
```json
{
  "refresh_token": "string"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "new_jwt_token",
    "expires_at": "2025-08-13T10:30:00Z"
  }
}
```

### POST /auth/change-password

**Description:** Change user password. All passwords must be salted client-side.

**Authentication:** Required

**Request Body:**
```json
{
  "current_password_hash": "string", // SHA256(current_password + current_salt)
  "current_salt": "string",
  "new_password_hash": "string", // SHA256(new_password + new_salt)
  "new_salt": "string"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Password changed successfully",
  "data": {
    "password_expires_at": "2025-11-13T10:00:00Z", // Based on role
    "must_change_password": false
  }
}
```

**Note:** If user had a temporary password, the 24-hour expiry is removed upon successful change.

## Password Management

### POST /auth/password/retrieve

**Description:** Retrieve the temporary password using a one-time token. This endpoint can only be used once per token.

**Request Body:**
```json
{
  "password_token": "secure_token_abc123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "username": "john_doe",
    "temporary_password": "TempPass#2024$Secure",
    "expires_at": "2025-08-14T10:00:00Z", // 24 hours from retrieval
    "must_change": true
  }
}
```

**Important:**
- Token is single-use and expires after retrieval
- Temporary password expires 24 hours after retrieval
- User must change password before expiry

**Error Responses:**
- `404 Not Found` - Invalid or expired token
- `410 Gone` - Token already used

### POST /auth/password/reset-request

**Description:** Admin initiates password reset for a user. Generates a unique reset token that expires in 3 hours.

**Authentication:** Required (Admin or Site Admin)

**Request Body:**
```json
{
  "user_id": "uuid",
  "reason": "User forgot password",
  "notify_user": true // Send email notification
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "reset_token": "reset_token_xyz789",
    "expires_at": "2025-08-13T13:00:00Z", // 3 hours from generation
    "user_notified": true
  }
}
```

**Note:** Reset tokens automatically expire 3 hours after generation for security.

### POST /auth/password/reset

**Description:** User resets password using admin-generated reset token.

**Request Body:**
```json
{
  "reset_token": "reset_token_xyz789",
  "new_password_hash": "string", // SHA256(new_password + salt)
  "salt": "string"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Password reset successfully",
  "data": {
    "must_login": true
  }
}
```

### POST /auth/password/force-reset

**Description:** Site Admin forces immediate password reset without token.

**Authentication:** Required (Site Admin only)

**Request Body:**
```json
{
  "user_id": "uuid",
  "generate_temporary": true // Generate new temporary password
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "password_token": "secure_token_def456",
    "token_expires_at": "2025-08-13T11:00:00Z"
  }
}
```

### GET /auth/password/policy

**Description:** Get password policy requirements for the current user's role.

**Authentication:** Required

**Response:**
```json
{
  "success": true,
  "data": {
    "role": "user",
    "requirements": {
      "min_length": 8,
      "require_uppercase": true,
      "require_lowercase": true,
      "require_numbers": true,
      "require_special": true,
      "special_characters": "!@#$%^&*()_+-=[]{}|;:,.<>?"
    },
    "expiry_days": 90,
    "history_count": 3,
    "current_password_age_days": 45,
    "expires_at": "2025-10-28T10:00:00Z"
  }
}
```

## Role Management

### GET /auth/roles

**Description:** Get available roles and current user's roles.

**Authentication:** Required

**Response:**
```json
{
  "success": true,
  "data": {
    "current_roles": ["user", "admin"],
    "available_roles": [
      {
        "name": "user",
        "description": "Standard user with personal feature access"
      },
      {
        "name": "admin",
        "description": "Administrative user with management capabilities"
      },
      {
        "name": "site_admin",
        "description": "Root-level system administrator"
      }
    ]
  }
}
```

### POST /auth/roles/promote

**Description:** Initiate role promotion for a user.

**Authentication:** Required (Admin or Site Admin)

**Request Body:**
```json
{
  "user_id": "uuid",
  "to_role": "admin", // "admin" or "site_admin"
  "justification": "string"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "promotion_id": "uuid",
    "status": "pending", // or "approved" if site_admin promoting
    "required_approvals": 2,
    "current_approvals": 0
  }
}
```

### POST /auth/roles/approve-promotion

**Description:** Approve a pending role promotion.

**Authentication:** Required (Admin or Site Admin)

**Request Body:**
```json
{
  "promotion_id": "uuid",
  "vote": "approve", // "approve" or "reject"
  "comments": "string"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "promotion_id": "uuid",
    "status": "pending", // or "approved" or "rejected"
    "required_approvals": 2,
    "current_approvals": 1,
    "votes": [
      {
        "voter": "admin_username",
        "vote": "approve",
        "voted_at": "2025-08-13T10:00:00Z"
      }
    ]
  }
}
```

### POST /auth/roles/demote

**Description:** Demote an admin to user role.

**Authentication:** Required (Admin or Site Admin)

**Request Body:**
```json
{
  "user_id": "uuid",
  "reason": "string"
}
```

**Response:**
```json
{
  "success": true,
  "message": "User demoted successfully",
  "data": {
    "user_id": "uuid",
    "new_roles": ["user"]
  }
}
```

### GET /auth/roles/promotions

**Description:** Get pending role promotions.

**Authentication:** Required (Admin or Site Admin)

**Query Parameters:**
- `status` - Filter by status (pending, approved, rejected)
- `user_id` - Filter by specific user

**Response:**
```json
{
  "success": true,
  "data": {
    "promotions": [
      {
        "id": "uuid",
        "target_user": {
          "id": "uuid",
          "username": "string"
        },
        "from_role": "user",
        "to_role": "admin",
        "initiated_by": "admin_username",
        "initiated_at": "2025-08-13T09:00:00Z",
        "status": "pending",
        "required_approvals": 2,
        "current_approvals": 1,
        "votes": []
      }
    ]
  }
}
```

## User Account Management

### DELETE /auth/users/:userId

**Description:** Delete a user account. Site Admins can delete immediately, users can self-delete with cooling-off period.

**Authentication:** Required

**Request Body:**
```json
{
  "confirmation": "DELETE", // Required confirmation string
  "override_cooling_off": false // Site Admin only
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "deletion_scheduled": "2025-08-20T10:00:00Z",
    "cancellation_token": "token_string", // For self-deletion
    "immediate": false
  }
}
```

### POST /auth/users/:userId/cancel-deletion

**Description:** Cancel a pending account deletion during cooling-off period.

**Authentication:** Required (User or Site Admin)

**Request Body:**
```json
{
  "cancellation_token": "string" // Required for self-cancellation
}
```

**Response:**
```json
{
  "success": true,
  "message": "Account deletion cancelled"
}
```

### GET /auth/users/:userId/deletion-status

**Description:** Check deletion status for an account.

**Authentication:** Required (User or Site Admin)

**Response:**
```json
{
  "success": true,
  "data": {
    "is_scheduled": true,
    "scheduled_for": "2025-08-20T10:00:00Z",
    "requested_at": "2025-08-13T10:00:00Z",
    "can_cancel": true
  }
}
```

## Multi-Factor Authentication

### POST /auth/mfa/enable

**Description:** Enable MFA for user account.

**Authentication:** Required

**Request Body:**
```json
{
  "password_hash": "string", // SHA256(password + salt) for verification
  "salt": "string"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "secret": "base32_secret",
    "qr_code": "data:image/png;base64,...",
    "backup_codes": [
      "XXXX-XXXX",
      "YYYY-YYYY"
    ]
  }
}
```

### POST /auth/mfa/verify

**Description:** Verify MFA setup with code.

**Authentication:** Required

**Request Body:**
```json
{
  "code": "123456"
}
```

**Response:**
```json
{
  "success": true,
  "message": "MFA enabled successfully"
}
```

### POST /auth/mfa/disable

**Description:** Disable MFA for user account.

**Authentication:** Required

**Request Body:**
```json
{
  "password_hash": "string", // SHA256(password + salt)
  "salt": "string",
  "code": "123456" // Current MFA code
}
```

**Response:**
```json
{
  "success": true,
  "message": "MFA disabled successfully"
}
```

## Session Management

### GET /auth/sessions

**Description:** Get active sessions for current user.

**Authentication:** Required

**Response:**
```json
{
  "success": true,
  "data": {
    "sessions": [
      {
        "id": "session_id",
        "device": "Chrome on Windows",
        "ip_address": "192.168.1.1",
        "location": "San Francisco, CA",
        "created_at": "2025-08-13T09:00:00Z",
        "last_active": "2025-08-13T10:00:00Z",
        "is_current": true
      }
    ]
  }
}
```

### DELETE /auth/sessions/:sessionId

**Description:** Terminate a specific session.

**Authentication:** Required

**Response:**
```json
{
  "success": true,
  "message": "Session terminated"
}
```

### DELETE /auth/sessions

**Description:** Terminate all sessions except current.

**Authentication:** Required

**Response:**
```json
{
  "success": true,
  "message": "All other sessions terminated",
  "data": {
    "terminated_count": 3
  }
}
```

## Audit Logs

### GET /auth/audit-logs

**Description:** Get authentication audit logs.

**Authentication:** Required (Admin or Site Admin for other users)

**Query Parameters:**
- `user_id` - Filter by user (Admin/Site Admin only)
- `action` - Filter by action type
- `from` - Start date
- `to` - End date
- `page` - Page number
- `limit` - Items per page

**Response:**
```json
{
  "success": true,
  "data": {
    "logs": [
      {
        "id": "uuid",
        "user_id": "uuid",
        "action": "login",
        "ip_address": "192.168.1.1",
        "user_agent": "Mozilla/5.0...",
        "success": true,
        "details": {},
        "timestamp": "2025-08-13T10:00:00Z"
      }
    ],
    "pagination": {
      "total": 100,
      "page": 1,
      "limit": 20
    }
  }
}
```

## Error Responses

All endpoints may return these standard error responses:

### 400 Bad Request
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    {
      "field": "password",
      "message": "Password does not meet requirements"
    }
  ]
}
```

### 401 Unauthorized
```json
{
  "success": false,
  "message": "Authentication required"
}
```

### 403 Forbidden
```json
{
  "success": false,
  "message": "Insufficient permissions"
}
```

### 429 Too Many Requests
```json
{
  "success": false,
  "message": "Rate limit exceeded",
  "retry_after": 60
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "message": "An unexpected error occurred"
}
```

## Rate Limiting

Authentication endpoints have specific rate limits:

- Login: 5 attempts per 15 minutes per IP
- Password reset: 3 requests per hour per email
- Registration: 10 requests per hour per IP
- MFA verification: 5 attempts per 10 minutes

## Security Headers

All authentication responses include security headers:

```http
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=31536000; includeSubDomains
```