# Authentication API

Comprehensive documentation for Pathfinder's authentication endpoints and security flows.

## Overview

Pathfinder uses JWT-based authentication with short-lived access tokens and longer-lived refresh tokens. All API requests (except authentication endpoints) require a valid JWT token in the Authorization header.

## Authentication Flow

```mermaid
sequenceDiagram
    participant Client
    participant API
    participant Database
    participant MFA Service
    
    Client->>API: POST /auth/login
    API->>Database: Validate credentials
    Database-->>API: User verified
    API->>MFA Service: Send 2FA code
    MFA Service-->>Client: 2FA code (SMS/Email/App)
    Client->>API: POST /auth/verify-2fa
    API-->>Client: JWT tokens (access + refresh)
```

## Endpoints

### 1. User Registration

**POST** `/api/auth/register`

Creates a new user account.

#### Request

```javascript
POST /api/auth/register
Content-Type: application/json

{
  "email": "jane.doe@example.com",
  "password": "SecurePass123!",
  "firstName": "Jane",
  "lastName": "Doe",
  "acceptTerms": true,
  "marketingConsent": false
}
```

#### Response

```javascript
201 Created
{
  "success": true,
  "message": "Registration successful. Please check your email to verify your account.",
  "data": {
    "userId": "usr_2KtY3Lp9Xm5n8Qr",
    "email": "jane.doe@example.com",
    "requiresVerification": true
  }
}
```

#### Error Responses

```javascript
400 Bad Request
{
  "error": "VALIDATION_ERROR",
  "message": "Password must contain at least 8 characters",
  "fields": {
    "password": "Password too weak"
  }
}

409 Conflict
{
  "error": "EMAIL_EXISTS",
  "message": "An account with this email already exists"
}
```

### 2. User Login

**POST** `/api/auth/login`

Authenticates a user and returns JWT tokens.

#### Request

```javascript
POST /api/auth/login
Content-Type: application/json

{
  "email": "jane.doe@example.com",
  "password": "SecurePass123!",
  "rememberMe": true
}
```

#### Response (Without 2FA)

```javascript
200 OK
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 900, // 15 minutes
    "tokenType": "Bearer",
    "user": {
      "id": "usr_2KtY3Lp9Xm5n8Qr",
      "email": "jane.doe@example.com",
      "firstName": "Jane",
      "lastName": "Doe",
      "role": "user"
    }
  }
}
```

#### Response (With 2FA Required)

```javascript
200 OK
{
  "success": true,
  "requiresMfa": true,
  "data": {
    "sessionToken": "tmp_8Hy6Gt4Rf2Ws9Kl",
    "mfaType": "authenticator", // or "sms", "email"
    "expiresIn": 300 // 5 minutes
  }
}
```

### 3. Two-Factor Authentication

**POST** `/api/auth/verify-2fa`

Verifies the 2FA code and completes authentication.

#### Request

```javascript
POST /api/auth/verify-2fa
Content-Type: application/json

{
  "sessionToken": "tmp_8Hy6Gt4Rf2Ws9Kl",
  "code": "123456",
  "trustDevice": true
}
```

#### Response

```javascript
200 OK
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 900,
    "tokenType": "Bearer",
    "deviceToken": "dev_9Jk7Nm3Qp5Tx2Yw" // If trustDevice: true
  }
}
```

### 4. Token Refresh

**POST** `/api/auth/refresh`

Refreshes an expired access token using a valid refresh token.

#### Request

```javascript
POST /api/auth/refresh
Content-Type: application/json

{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### Response

```javascript
200 OK
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 900,
    "tokenType": "Bearer"
  }
}
```

### 5. Logout

**POST** `/api/auth/logout`

Invalidates the current session and tokens.

#### Request

```javascript
POST /api/auth/logout
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "logoutAllDevices": false
}
```

#### Response

```javascript
200 OK
{
  "success": true,
  "message": "Logged out successfully"
}
```

### 6. Email Verification

**POST** `/api/auth/verify-email`

Verifies user email address using the verification token.

#### Request

```javascript
POST /api/auth/verify-email
Content-Type: application/json

{
  "token": "ver_3Lm8Qr5Ty7Wx9Zn"
}
```

#### Response

```javascript
200 OK
{
  "success": true,
  "message": "Email verified successfully",
  "data": {
    "autoLogin": true,
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### 7. Password Reset Request

**POST** `/api/auth/forgot-password`

Initiates password reset process.

#### Request

```javascript
POST /api/auth/forgot-password
Content-Type: application/json

{
  "email": "jane.doe@example.com"
}
```

#### Response

```javascript
200 OK
{
  "success": true,
  "message": "If an account exists with this email, you will receive password reset instructions"
}
```

### 8. Password Reset Confirmation

**POST** `/api/auth/reset-password`

Resets password using the reset token.

#### Request

```javascript
POST /api/auth/reset-password
Content-Type: application/json

{
  "token": "rst_4Np9Rs6Uy8Xa1Bc",
  "newPassword": "NewSecurePass456!",
  "confirmPassword": "NewSecurePass456!"
}
```

#### Response

```javascript
200 OK
{
  "success": true,
  "message": "Password reset successful. Please login with your new password."
}
```

## Authentication Headers

### Bearer Token Authentication

All authenticated requests must include the JWT token in the Authorization header:

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### API Key Authentication (Alternative)

For programmatic access, API keys can be used:

```http
X-API-Key: pk_live_5Ty8Wx9Zn3Lm7Qr
```

## JWT Token Structure

### Access Token Payload

```javascript
{
  "sub": "usr_2KtY3Lp9Xm5n8Qr",
  "email": "jane.doe@example.com",
  "role": "user",
  "permissions": ["read:own_profile", "write:own_profile"],
  "iat": 1642598400,
  "exp": 1642599300,
  "iss": "https://api.pathfinder.ai",
  "aud": "pathfinder-web"
}
```

### Refresh Token Payload

```javascript
{
  "sub": "usr_2KtY3Lp9Xm5n8Qr",
  "tokenFamily": "fam_6Uy8Xa1Bc4Np9Rs",
  "iat": 1642598400,
  "exp": 1645190400,
  "iss": "https://api.pathfinder.ai"
}
```

## Security Best Practices

### 1. Token Storage

**Recommended Storage Locations:**
- Access Token: Memory only (not localStorage)
- Refresh Token: HttpOnly, Secure, SameSite cookie
- Never store tokens in localStorage for production

### 2. Token Rotation

- Access tokens expire in 15 minutes
- Refresh tokens expire in 30 days
- Each refresh generates a new token pair
- Token families prevent replay attacks

### 3. Rate Limiting

```javascript
// Rate limits per endpoint
{
  "/auth/login": "5 requests per 15 minutes",
  "/auth/register": "3 requests per hour",
  "/auth/forgot-password": "3 requests per hour",
  "/auth/refresh": "10 requests per minute"
}
```

### 4. Security Headers

Required security headers for all requests:

```http
Content-Security-Policy: default-src 'self'
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

## Error Codes

| Code | Description | Action Required |
|------|-------------|-----------------|
| `AUTH_INVALID_CREDENTIALS` | Invalid email or password | Check credentials |
| `AUTH_ACCOUNT_LOCKED` | Too many failed attempts | Wait 30 minutes or reset password |
| `AUTH_EMAIL_NOT_VERIFIED` | Email verification required | Check email for verification link |
| `AUTH_TOKEN_EXPIRED` | Access token expired | Use refresh token |
| `AUTH_TOKEN_INVALID` | Invalid or malformed token | Re-authenticate |
| `AUTH_REFRESH_TOKEN_EXPIRED` | Refresh token expired | Re-authenticate |
| `AUTH_SESSION_INVALID` | Session not found | Re-authenticate |
| `AUTH_2FA_REQUIRED` | 2FA verification needed | Complete 2FA flow |
| `AUTH_2FA_INVALID` | Invalid 2FA code | Check code and retry |

## Integration Examples

### JavaScript/TypeScript

```typescript
class AuthService {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;

  async login(email: string, password: string): Promise<void> {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();
    
    if (data.requiresMfa) {
      return this.handle2FA(data.data.sessionToken);
    }

    this.accessToken = data.data.accessToken;
    this.refreshToken = data.data.refreshToken;
    this.scheduleTokenRefresh(data.data.expiresIn);
  }

  async makeAuthenticatedRequest(url: string, options: RequestInit = {}) {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${this.accessToken}`
      }
    });

    if (response.status === 401) {
      await this.refreshAccessToken();
      return this.makeAuthenticatedRequest(url, options);
    }

    return response;
  }
}
```

### Python

```python
import requests
from datetime import datetime, timedelta

class PathfinderAuth:
    def __init__(self):
        self.access_token = None
        self.refresh_token = None
        self.token_expires = None
    
    def login(self, email, password):
        response = requests.post(
            'https://api.pathfinder.ai/auth/login',
            json={'email': email, 'password': password}
        )
        data = response.json()
        
        if data.get('requiresMfa'):
            return self.handle_2fa(data['data']['sessionToken'])
        
        self.access_token = data['data']['accessToken']
        self.refresh_token = data['data']['refreshToken']
        self.token_expires = datetime.now() + timedelta(seconds=data['data']['expiresIn'])
    
    def get_headers(self):
        if datetime.now() >= self.token_expires:
            self.refresh_tokens()
        
        return {'Authorization': f'Bearer {self.access_token}'}
```

## Testing Authentication

### Using cURL

```bash
# Login
curl -X POST https://api.pathfinder.ai/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"TestPass123!"}'

# Make authenticated request
curl -X GET https://api.pathfinder.ai/profile \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Using Postman

1. Import the [Pathfinder API Collection](https://www.getpostman.com/collections/pathfinder-api)
2. Set environment variables for `base_url` and `auth_token`
3. Use the "Login" request to authenticate
4. Token is automatically saved for subsequent requests

---

**Next:** [Experience API](./experience-endpoints.md) | **Previous:** [API Overview](./README.md)