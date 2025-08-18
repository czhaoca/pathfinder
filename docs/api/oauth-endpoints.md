# OAuth API Endpoints

## Overview

The OAuth API provides endpoints for third-party authentication integration, currently supporting Google OAuth 2.0 with plans for additional providers.

## Base URL

```
Development: http://localhost:3001/api/auth
Production: https://yourdomain.com/api/auth
```

## Authentication

Most OAuth endpoints are public, but account management endpoints require JWT authentication.

## Endpoints

### Initialize OAuth Flow

#### `GET /google`

Generates a Google OAuth authorization URL with PKCE parameters.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| returnUrl | string | No | URL to redirect after authentication (default: `/`) |

**Response:**
```json
{
  "authUrl": "https://accounts.google.com/o/oauth2/v2/auth?client_id=..."
}
```

**Error Responses:**
- `403 Forbidden`: Google OAuth is not enabled
- `400 Bad Request`: Invalid return URL

**Example:**
```javascript
const response = await fetch('/api/auth/google?returnUrl=/dashboard');
const { authUrl } = await response.json();
window.location.href = authUrl;
```

---

### OAuth Callback

#### `GET /google/callback`

Handles the OAuth callback from Google. This endpoint is called by Google after user authorization.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| code | string | Yes | Authorization code from Google |
| state | string | Yes | State parameter for CSRF protection |
| error | string | No | Error from Google (e.g., access_denied) |

**Response:**
- Success: Redirects to `returnUrl` or `/dashboard`
- Account exists: Redirects to `/auth/merge?provider=google`
- Error: Redirects to `/login?error=message`

**Cookies Set:**
- `access_token`: JWT access token (15 minutes, httpOnly)
- `refresh_token`: JWT refresh token (7 days, httpOnly)

**Error Scenarios:**
- Invalid state parameter
- Expired state (>10 minutes)
- Invalid authorization code
- Account exists (requires merge)
- Sign-up disabled

---

### Merge Google Account

#### `POST /google/merge`

Links a Google account to an existing user account with password verification.

**Authentication:** Required (Bearer token)

**Request Body:**
```json
{
  "password": "string",
  "googleAuthCode": "string"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Google account successfully linked"
}
```

**Error Responses:**
- `401 Unauthorized`: Invalid password or not authenticated
- `400 Bad Request`: Missing required fields
- `409 Conflict`: Google account already linked

**Example:**
```javascript
await fetch('/api/auth/google/merge', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    password: 'currentPassword',
    googleAuthCode: 'auth-code-from-google'
  })
});
```

---

### Unlink Google Account

#### `DELETE /google/unlink`

Removes the Google account link from the current user.

**Authentication:** Required (Bearer token)

**Response:**
```json
{
  "success": true,
  "message": "Google account unlinked"
}
```

**Error Responses:**
- `401 Unauthorized`: Not authenticated
- `400 Bad Request`: Cannot unlink - no other authentication method
- `404 Not Found`: No Google account linked

**Example:**
```javascript
await fetch('/api/auth/google/unlink', {
  method: 'DELETE',
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

---

### Get Linked Providers

#### `GET /sso/providers`

Returns all OAuth providers linked to the current user account.

**Authentication:** Required (Bearer token)

**Response:**
```json
{
  "providers": [
    {
      "provider": "google",
      "email": "user@gmail.com",
      "displayName": "John Doe",
      "linkedAt": "2024-01-15T10:30:00Z",
      "isPrimary": false
    }
  ],
  "hasPassword": true
}
```

**Error Responses:**
- `401 Unauthorized`: Not authenticated

**Example:**
```javascript
const response = await fetch('/api/auth/sso/providers', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
const data = await response.json();
```

---

## Data Models

### SSO Account

```typescript
interface SSOAccount {
  provider: 'google' | 'github' | 'microsoft';
  email: string;
  displayName: string;
  linkedAt: Date;
  isPrimary: boolean;
}
```

### OAuth State

Internal state management for OAuth flows:

```typescript
interface OAuthState {
  userId?: string;        // Existing user ID (for linking)
  returnUrl: string;      // Redirect after auth
  codeVerifier: string;   // PKCE verifier
  createdAt: number;      // Creation timestamp
  expires: number;        // Expiration timestamp
}
```

## Security Features

### PKCE Implementation

All OAuth flows use PKCE (RFC 7636):

1. Generate code verifier (32 bytes random)
2. Calculate code challenge (SHA256)
3. Include challenge in authorization request
4. Verify with code verifier in token exchange

### State Parameter

- 32-byte random value
- One-time use
- 10-minute expiration
- Prevents CSRF attacks

### Token Encryption

- Access tokens encrypted with AES-256-GCM
- Refresh tokens encrypted before storage
- User-specific encryption keys

## Rate Limiting

| Endpoint | Limit | Window |
|----------|-------|--------|
| GET /google | 10 requests | 1 hour |
| GET /google/callback | 20 requests | 1 hour |
| POST /google/merge | 5 requests | 1 hour |
| DELETE /google/unlink | 5 requests | 1 hour |

## Error Handling

### Error Response Format

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {
    "field": "Additional context"
  }
}
```

### Common Error Codes

| Code | Description |
|------|-------------|
| `OAUTH_DISABLED` | OAuth provider is not enabled |
| `INVALID_STATE` | State parameter validation failed |
| `STATE_EXPIRED` | State parameter has expired |
| `ACCOUNT_EXISTS` | Email already exists, merge required |
| `SIGNUP_DISABLED` | New account creation disabled |
| `NO_AUTH_METHOD` | Cannot unlink last authentication |
| `INVALID_CODE` | Authorization code invalid |
| `TOKEN_REFRESH_FAILED` | Failed to refresh access token |

## Webhooks

### OAuth Events

The following events trigger webhooks (if configured):

- `oauth.account.linked`: Google account linked
- `oauth.account.unlinked`: Google account unlinked
- `oauth.login.success`: Successful OAuth login
- `oauth.login.failed`: Failed OAuth attempt
- `oauth.signup.success`: New account via OAuth

## Testing

### Test Credentials

For development/testing:

```bash
GOOGLE_CLIENT_ID=test-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=test-secret
GOOGLE_OAUTH_ENABLED=true
```

### Mock OAuth Flow

```javascript
// Mock successful OAuth
jest.mock('google-auth-library', () => ({
  OAuth2Client: jest.fn().mockImplementation(() => ({
    generateAuthUrl: jest.fn().mockReturnValue('https://mock-auth-url'),
    getToken: jest.fn().mockResolvedValue({
      tokens: {
        access_token: 'mock-access-token',
        refresh_token: 'mock-refresh-token',
        expiry_date: Date.now() + 3600000
      }
    })
  }))
}));
```

## Migration Guide

### Adding OAuth to Existing Accounts

1. User signs in with password
2. Navigate to security settings
3. Click "Link Google Account"
4. Complete OAuth flow
5. Account linked

### Migrating from Password to OAuth

1. Ensure Google account linked
2. Test OAuth sign-in works
3. Optionally remove password
4. Set Google as primary auth

## Roadmap

### Planned Providers

- GitHub OAuth (Q2 2024)
- Microsoft OAuth (Q2 2024)
- LinkedIn OAuth (Q3 2024)
- Apple Sign In (Q4 2024)

### Planned Features

- Multiple OAuth accounts per provider
- OAuth account switching
- Social profile import
- Team/organization SSO
- SAML 2.0 support