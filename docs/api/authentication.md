# Authentication API

The authentication system uses JWT tokens with refresh token rotation for secure user authentication.

## Endpoints

### Register New User

```http
POST /api/auth/register
```

**Request Body:**
```json
{
  "username": "john_doe",
  "email": "john@example.com",
  "password": "SecurePassword123!",
  "fullName": "John Doe"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "username": "john_doe",
      "email": "john@example.com",
      "fullName": "John Doe"
    },
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
    "expiresIn": 900
  }
}
```

### User Login

```http
POST /api/auth/login
```

**Request Body:**
```json
{
  "username": "john_doe",
  "password": "SecurePassword123!"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "username": "john_doe",
      "email": "john@example.com",
      "fullName": "John Doe"
    },
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
    "expiresIn": 900
  }
}
```

### Refresh Token

```http
POST /api/auth/refresh
```

**Request Body:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
    "expiresIn": 900
  }
}
```

### User Logout

```http
POST /api/auth/logout
```

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

### Verify Email

```http
POST /api/auth/verify-email
```

**Request Body:**
```json
{
  "token": "verification-token-from-email"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Email verified successfully"
}
```

### Request Password Reset

```http
POST /api/auth/forgot-password
```

**Request Body:**
```json
{
  "email": "john@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Password reset email sent"
}
```

### Reset Password

```http
POST /api/auth/reset-password
```

**Request Body:**
```json
{
  "token": "reset-token-from-email",
  "newPassword": "NewSecurePassword123!"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Password reset successfully"
}
```

## Authentication Flow

### Initial Login
1. User submits credentials
2. Server validates credentials
3. Server generates JWT token (15 min expiry)
4. Server generates refresh token (7 days expiry)
5. Both tokens returned to client
6. Client stores tokens securely

### Token Refresh
1. Access token expires
2. Client sends refresh token
3. Server validates refresh token
4. Server generates new token pair
5. Old refresh token invalidated
6. New tokens returned to client

### Using Authentication

Include the JWT token in the Authorization header for protected endpoints:

```http
GET /api/profile
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

## Security Features

### Password Requirements
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character

### Token Security
- JWT tokens expire after 15 minutes
- Refresh tokens expire after 7 days
- Refresh tokens are single-use
- All tokens are signed with HS256

### Rate Limiting
- Login: 5 attempts per 15 minutes
- Register: 3 attempts per hour
- Password reset: 3 attempts per hour

### Session Management
- Active sessions tracked in database
- Logout invalidates all tokens
- Concurrent session limit: 5 devices

## Error Responses

### Invalid Credentials
```json
{
  "success": false,
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Invalid username or password"
  }
}
```

### Token Expired
```json
{
  "success": false,
  "error": {
    "code": "TOKEN_EXPIRED",
    "message": "Access token has expired"
  }
}
```

### Account Locked
```json
{
  "success": false,
  "error": {
    "code": "ACCOUNT_LOCKED",
    "message": "Account locked due to multiple failed attempts"
  }
}
```

## Best Practices

### Client-Side Storage
- Store access token in memory
- Store refresh token in httpOnly cookie
- Never store tokens in localStorage

### Token Renewal
- Renew token before expiry
- Implement retry logic
- Handle refresh failures gracefully

### Security Headers
Always include:
- `Content-Type: application/json`
- `X-Requested-With: XMLHttpRequest`