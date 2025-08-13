# User Management API Documentation

## Overview

The User Management API provides endpoints for managing user profiles, preferences, and account settings in the Pathfinder system.

## Base Endpoints

All user management endpoints are prefixed with `/api/users`.

## User Profile

### GET /users/profile

**Description:** Get the current authenticated user's profile.

**Authentication:** Required

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "username": "john_doe",
    "email": "john@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "bio": "Experienced software engineer...",
    "phone": "+1-555-0123",
    "location": "San Francisco, CA",
    "timezone": "America/Los_Angeles",
    "avatar_url": "https://storage.example.com/avatars/uuid.jpg",
    "roles": ["user", "admin"],
    "created_at": "2025-01-15T10:00:00Z",
    "updated_at": "2025-08-13T09:30:00Z",
    "last_login": "2025-08-13T09:00:00Z",
    "email_verified": true,
    "mfa_enabled": false,
    "account_status": "active"
  }
}
```

### PUT /users/profile

**Description:** Update the current user's profile.

**Authentication:** Required

**Request Body:**
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "bio": "Updated bio...",
  "phone": "+1-555-0123",
  "location": "San Francisco, CA",
  "timezone": "America/Los_Angeles"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Profile updated successfully",
  "data": {
    // Updated user profile object
  }
}
```

### POST /users/avatar

**Description:** Upload or update user avatar.

**Authentication:** Required

**Request:** Multipart form data
- `avatar`: Image file (JPEG, PNG, GIF, max 5MB)

**Response:**
```json
{
  "success": true,
  "data": {
    "avatar_url": "https://storage.example.com/avatars/uuid.jpg"
  }
}
```

### DELETE /users/avatar

**Description:** Remove user avatar.

**Authentication:** Required

**Response:**
```json
{
  "success": true,
  "message": "Avatar removed successfully"
}
```

## User Search (Admin Only)

### GET /users

**Description:** Search and list users. Only accessible to Admins and Site Admins.

**Authentication:** Required (Admin or Site Admin)

**Query Parameters:**
- `q` - Search query (searches username, email, name)
- `role` - Filter by role (user, admin, site_admin)
- `status` - Filter by status (active, suspended, deleted)
- `created_after` - Filter by creation date
- `created_before` - Filter by creation date
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 20, max: 100)
- `sort` - Sort field (username, email, created_at, last_login)
- `order` - Sort order (asc, desc)

**Response:**
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": "uuid",
        "username": "john_doe",
        "email": "john@example.com",
        "firstName": "John",
        "lastName": "Doe",
        "roles": ["user"],
        "account_status": "active",
        "created_at": "2025-01-15T10:00:00Z",
        "last_login": "2025-08-13T09:00:00Z"
      }
    ],
    "pagination": {
      "total": 250,
      "page": 1,
      "limit": 20,
      "total_pages": 13
    }
  }
}
```

### GET /users/:userId

**Description:** Get a specific user's profile. Users can only view their own profile unless they are Admin/Site Admin.

**Authentication:** Required

**Response:**
```json
{
  "success": true,
  "data": {
    // User profile object (sensitive fields filtered based on permissions)
  }
}
```

### PUT /users/:userId

**Description:** Update a specific user's profile. Only Admins and Site Admins can update other users.

**Authentication:** Required (Admin or Site Admin for other users)

**Request Body:**
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@example.com",
  "account_status": "active", // Admin only
  "roles": ["user", "admin"] // Site Admin only
}
```

## User Preferences

### GET /users/preferences

**Description:** Get user preferences and settings.

**Authentication:** Required

**Response:**
```json
{
  "success": true,
  "data": {
    "notifications": {
      "email": {
        "career_updates": true,
        "job_recommendations": true,
        "learning_reminders": false,
        "marketing": false
      },
      "push": {
        "enabled": true,
        "career_updates": true,
        "messages": true
      }
    },
    "privacy": {
      "profile_visibility": "private", // public, private, connections
      "show_email": false,
      "show_phone": false,
      "allow_indexing": false
    },
    "display": {
      "theme": "light", // light, dark, auto
      "language": "en",
      "date_format": "MM/DD/YYYY",
      "time_format": "12h"
    },
    "career": {
      "job_search_active": true,
      "preferred_locations": ["San Francisco", "Remote"],
      "preferred_industries": ["Technology", "Finance"],
      "salary_range": {
        "min": 100000,
        "max": 200000,
        "currency": "USD"
      }
    }
  }
}
```

### PUT /users/preferences

**Description:** Update user preferences.

**Authentication:** Required

**Request Body:**
```json
{
  "notifications": {
    "email": {
      "career_updates": true,
      "job_recommendations": false
    }
  },
  "display": {
    "theme": "dark"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Preferences updated successfully",
  "data": {
    // Updated preferences object
  }
}
```

## Account Management

### POST /users/verify-email

**Description:** Send email verification link.

**Authentication:** Required

**Response:**
```json
{
  "success": true,
  "message": "Verification email sent"
}
```

### POST /users/verify-email/:token

**Description:** Verify email with token.

**Response:**
```json
{
  "success": true,
  "message": "Email verified successfully"
}
```

### POST /users/request-data-export

**Description:** Request export of all user data (GDPR compliance).

**Authentication:** Required

**Response:**
```json
{
  "success": true,
  "data": {
    "export_id": "uuid",
    "requested_at": "2025-08-13T10:00:00Z",
    "estimated_completion": "2025-08-13T11:00:00Z"
  }
}
```

### GET /users/data-exports

**Description:** Get status of data export requests.

**Authentication:** Required

**Response:**
```json
{
  "success": true,
  "data": {
    "exports": [
      {
        "id": "uuid",
        "requested_at": "2025-08-13T10:00:00Z",
        "completed_at": "2025-08-13T10:30:00Z",
        "status": "completed",
        "download_url": "https://storage.example.com/exports/uuid.zip",
        "expires_at": "2025-08-20T10:30:00Z"
      }
    ]
  }
}
```

## Account Actions (Admin)

### POST /users/:userId/suspend

**Description:** Suspend a user account.

**Authentication:** Required (Admin or Site Admin)

**Request Body:**
```json
{
  "reason": "Violation of terms of service",
  "duration_days": 30, // Optional, permanent if not specified
  "notify_user": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user_id": "uuid",
    "suspended_until": "2025-09-12T10:00:00Z",
    "reason": "Violation of terms of service"
  }
}
```

### POST /users/:userId/unsuspend

**Description:** Unsuspend a user account.

**Authentication:** Required (Admin or Site Admin)

**Response:**
```json
{
  "success": true,
  "message": "User account unsuspended"
}
```

### POST /users/:userId/reset-password

**Description:** Force password reset for a user.

**Authentication:** Required (Admin or Site Admin)

**Request Body:**
```json
{
  "send_email": true,
  "temporary_password": "string" // Optional, auto-generated if not provided
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "temporary_password": "TempPass123!", // Only if generated
    "reset_link_sent": true
  }
}
```

### POST /users/:userId/unlock

**Description:** Unlock a locked user account.

**Authentication:** Required (Admin or Site Admin)

**Response:**
```json
{
  "success": true,
  "message": "Account unlocked successfully"
}
```

## User Statistics

### GET /users/:userId/stats

**Description:** Get user activity statistics.

**Authentication:** Required (own stats or Admin/Site Admin)

**Response:**
```json
{
  "success": true,
  "data": {
    "profile_completion": 85,
    "experiences_count": 12,
    "skills_count": 45,
    "career_goals_count": 3,
    "applications_count": 8,
    "certifications_count": 5,
    "last_activity": "2025-08-13T09:30:00Z",
    "account_age_days": 210,
    "total_login_count": 156,
    "chat_conversations": 23,
    "reports_generated": 4
  }
}
```

## Bulk Operations (Admin)

### POST /users/bulk/export

**Description:** Export multiple users' data.

**Authentication:** Required (Site Admin)

**Request Body:**
```json
{
  "user_ids": ["uuid1", "uuid2"], // Optional, all users if not specified
  "fields": ["username", "email", "roles", "created_at"],
  "format": "csv" // csv, json
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "export_id": "uuid",
    "download_url": "https://storage.example.com/exports/bulk-uuid.csv"
  }
}
```

### POST /users/bulk/update

**Description:** Update multiple users at once.

**Authentication:** Required (Site Admin)

**Request Body:**
```json
{
  "user_ids": ["uuid1", "uuid2"],
  "updates": {
    "account_status": "active",
    "email_verified": true
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "updated_count": 2,
    "failed_count": 0,
    "results": [
      {
        "user_id": "uuid1",
        "success": true
      },
      {
        "user_id": "uuid2",
        "success": true
      }
    ]
  }
}
```

## Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "message": "Invalid request parameters",
  "errors": [
    {
      "field": "email",
      "message": "Invalid email format"
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
  "message": "You do not have permission to perform this action"
}
```

### 404 Not Found
```json
{
  "success": false,
  "message": "User not found"
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

## Rate Limiting

User management endpoints have the following rate limits:

- Profile updates: 10 per hour per user
- Avatar uploads: 5 per hour per user
- Preference updates: 20 per hour per user
- Admin operations: 100 per hour per admin
- Bulk operations: 10 per hour per site admin

## Webhooks

The following webhook events are triggered by user management actions:

- `user.created` - New user account created
- `user.updated` - User profile updated
- `user.suspended` - User account suspended
- `user.unsuspended` - User account unsuspended
- `user.deleted` - User account deleted
- `user.role_changed` - User role changed
- `user.email_verified` - Email address verified
- `user.password_changed` - Password changed