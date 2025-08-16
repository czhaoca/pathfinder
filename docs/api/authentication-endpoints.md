# Authentication API Documentation

## Overview

The Pathfinder authentication system implements a secure token-based password system with client-side hashing and server-side Argon2 additional hashing. This ensures that plain text passwords are never transmitted or stored.

## Security Features

- **Client-side SHA-256 hashing**: Passwords are hashed on the client before transmission
- **Server-side Argon2id hashing**: Additional cryptographic hashing applied server-side
- **Token-based password retrieval**: System-generated temporary passwords retrieved via one-time tokens
- **Password history tracking**: Prevents reuse of recent passwords
- **Comprehensive audit logging**: All password operations are logged
- **Rate limiting**: Protection against brute force attacks
- **JWT authentication**: Short-lived tokens (15 minutes) for session management

## API Endpoints

### User Registration

**POST** `/auth/register`

Creates a new user account with a system-generated temporary password.

**Authorization:** Bearer token required (admin role)

**Request Body:**
```json
{
  "username": "johndoe",
  "email": "john@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "role": "user"  // Options: "user", "admin", "super_admin"
}
```

**Important:** Do NOT include a password field. The system generates a secure temporary password.

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "username": "johndoe",
      "email": "john@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "user",
      "status": "pending_activation"
    },
    "password_token": "base64url_token",
    "token_expires_at": "2024-01-01T12:00:00Z",
    "instructions": "Use the password_token with /auth/password/retrieve to get the temporary password"
  }
}
```

**Error Responses:**
- `400 Bad Request`: Invalid input or duplicate username/email
- `401 Unauthorized`: Missing or invalid authentication token

---

### Password Retrieval

**POST** `/auth/password/retrieve`

Retrieves the temporary password using a one-time token.

**Request Body:**
```json
{
  "password_token": "base64url_token_from_registration"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "username": "johndoe",
    "temporary_password": "Xk9#mL2$pQ8!nR5@",
    "expires_at": "2024-01-02T12:00:00Z",
    "must_change": true,
    "instructions": "This password expires in 24 hours. You must change it after first login."
  }
}
```

**Error Responses:**
- `404 Not Found`: Invalid or expired token
- `429 Too Many Requests`: Rate limit exceeded

**Note:** Tokens are single-use only. Once used, they cannot be reused.

---

### User Login

**POST** `/auth/login`

Authenticates a user with client-side hashed password.

**Request Body:**
```json
{
  "username": "johndoe",
  "password_hash": "sha256_hash_64_chars",
  "client_salt": "hex_salt_64_chars"
}
```

**Client-side hashing example (JavaScript):**
```javascript
import { PasswordHasher } from './utils/crypto';

const { hash, salt } = await PasswordHasher.hashPassword(plainTextPassword);
// Send hash and salt to server, never the plain password
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "username": "johndoe",
      "email": "john@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "user"
    },
    "token": "jwt_token",
    "expiresAt": "2024-01-01T12:15:00Z",
    "passwordInfo": {
      "daysUntilExpiry": 83,
      "passwordAge": 7
    }
  }
}
```

**Error Responses:**
- `400 Bad Request`: Plain text password sent (rejected)
- `401 Unauthorized`: Invalid credentials
- `403 Forbidden`: Password change required (temporary password)
- `429 Too Many Requests`: Rate limit exceeded

---

### Password Change

**POST** `/auth/password/change`

Changes the user's password. Requires authentication.

**Authorization:** Bearer token required

**Request Body:**
```json
{
  "old_password_hash": "sha256_hash_of_old_password",
  "old_client_salt": "salt_used_for_old_password",
  "new_password_hash": "sha256_hash_of_new_password",
  "new_client_salt": "salt_for_new_password"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Password changed successfully. Please login with your new password.",
  "sessions_invalidated": true
}
```

**Error Responses:**
- `400 Bad Request`: Current password incorrect or password reuse detected
- `401 Unauthorized`: Missing or invalid authentication token
- `429 Too Many Requests`: Rate limit exceeded

**Note:** All existing sessions are invalidated after a successful password change.

---

### Password Reset Request

**POST** `/auth/password/reset-request`

Requests a password reset token.

**Request Body:**
```json
{
  "email": "john@example.com"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "If the email exists, a reset token has been generated."
}
```

**Note:** Always returns success to prevent email enumeration attacks.

**In Development Mode:**
```json
{
  "success": true,
  "message": "If the email exists, a reset token has been generated.",
  "development_only": {
    "reset_token": "base64url_reset_token",
    "expires_at": "2024-01-01T15:00:00Z"
  }
}
```

---

### Password Reset

**POST** `/auth/password/reset`

Resets password using a reset token.

**Request Body:**
```json
{
  "reset_token": "base64url_reset_token",
  "new_password_hash": "sha256_hash_of_new_password",
  "new_client_salt": "salt_for_new_password"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Password reset successfully. Please login with your new password."
}
```

**Error Responses:**
- `400 Bad Request`: Invalid or expired reset token
- `429 Too Many Requests`: Rate limit exceeded

---

### User Logout

**POST** `/auth/logout`

Invalidates the current session.

**Authorization:** Bearer token required

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

## Password Requirements

### Default Policy
- Minimum length: 12 characters
- Maximum length: 128 characters
- Must contain at least 2 uppercase letters
- Must contain at least 2 lowercase letters
- Must contain at least 2 numbers
- Must contain at least 2 special characters
- Cannot be a common password
- Cannot reuse last 10 passwords
- Expires after 90 days

### Admin Policy
- Minimum length: 16 characters
- Must contain at least 3 of each character type
- Cannot reuse last 20 passwords
- Expires after 30 days
- Fewer login attempts allowed (3 vs 5)
- Longer lockout duration (60 vs 30 minutes)

## Rate Limiting

| Endpoint | Limit | Window |
|----------|-------|--------|
| `/auth/register` | 5 requests | 60 seconds |
| `/auth/login` | 10 requests | 60 seconds |
| `/auth/password/retrieve` | 3 requests | 60 seconds |
| `/auth/password/change` | 3 requests | 60 seconds |
| `/auth/password/reset-request` | 3 requests | 300 seconds |
| `/auth/password/reset` | 3 requests | 60 seconds |

## Security Best Practices

### For Frontend Developers

1. **Always hash passwords client-side** before sending to the server
2. **Never store passwords** in local storage or session storage
3. **Clear password fields** immediately after hashing
4. **Use the provided PasswordHasher utility** for consistent hashing
5. **Implement password strength indicators** to guide users
6. **Handle token expiry gracefully** with appropriate user feedback

### For Backend Developers

1. **Never log passwords** or password hashes
2. **Always use parameterized queries** to prevent SQL injection
3. **Validate all inputs** before processing
4. **Implement proper error handling** without leaking information
5. **Monitor audit logs** for suspicious activity
6. **Regularly rotate JWT secrets** in production

## Migration Guide

### For Existing Systems

If migrating from a traditional password system:

1. **Phase 1**: Deploy new password tables alongside existing
2. **Phase 2**: Update APIs to support both methods temporarily
3. **Phase 3**: Migrate users' passwords on next login
4. **Phase 4**: Force password reset for inactive users
5. **Phase 5**: Remove old password system

### Database Migration

Run the migration script:
```bash
npm run db:migrate
```

This creates the following tables:
- `pf_user_passwords`: Current password storage
- `pf_password_history`: Password history tracking
- `pf_password_tokens`: One-time token management
- `pf_password_policies`: Configurable password policies
- `pf_password_strength_log`: Password strength analytics

## Error Handling

All endpoints return consistent error responses:

```json
{
  "success": false,
  "error": "Human-readable error message",
  "code": "ERROR_CODE" // Optional error code for programmatic handling
}
```

Common error codes:
- `INVALID_CREDENTIALS`: Username or password incorrect
- `TOKEN_EXPIRED`: Token has expired
- `TOKEN_ALREADY_USED`: Token was already used
- `PASSWORD_TOO_WEAK`: Password doesn't meet policy requirements
- `PASSWORD_RECENTLY_USED`: Password was used recently
- `RATE_LIMIT_EXCEEDED`: Too many requests

## Audit Logging

All password-related operations are logged:
- User registration
- Password retrieval
- Login attempts (success and failure)
- Password changes
- Password resets
- Token generation and usage

Audit logs include:
- Timestamp
- User ID
- Event type
- IP address
- User agent
- Success/failure status
- Additional metadata

## Testing

### Unit Tests
```bash
npm run test:unit -- passwordService.test.js
```

### Integration Tests
```bash
npm run test:integration -- authFlow.test.js
```

### Security Tests
```bash
npm run test:security -- auth.security.test.js
```

## Environment Variables

Required environment variables:
```env
JWT_SECRET=64_character_hex_string
ENABLE_FIELD_ENCRYPTION=true
PASSWORD_MIN_LENGTH=12
PASSWORD_TEMP_LENGTH=16
PASSWORD_HISTORY_COUNT=10
PASSWORD_EXPIRY_DAYS=90
TOKEN_RETRIEVAL_EXPIRY_HOURS=1
TOKEN_RESET_EXPIRY_HOURS=3
TEMP_PASSWORD_EXPIRY_HOURS=24
```

## Support

For issues or questions:
- Check the [troubleshooting guide](../troubleshooting/authentication.md)
- Review [security documentation](../security/password-security.md)
- Contact the security team for sensitive issues