# Google OAuth Integration Setup Guide

## Overview

Pathfinder supports Google OAuth 2.0 authentication, allowing users to sign in with their Google accounts. This integration provides secure, passwordless authentication with automatic account provisioning and linking.

## Features

- **Single Sign-On (SSO)**: Users can sign in with their Google accounts
- **Account Provisioning**: Automatic local account creation for new Google users
- **Account Linking**: Existing users can link their Google accounts
- **Security**: PKCE implementation, state validation, and token encryption
- **Feature Flags**: Control OAuth availability through feature flags

## Prerequisites

1. Google Cloud Console account
2. Google OAuth 2.0 credentials (Client ID and Secret)
3. SSL certificate for production (HTTPS required)
4. Redis for production state management (optional but recommended)

## Setup Instructions

### 1. Google Cloud Console Configuration

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google+ API
4. Navigate to **APIs & Services** > **Credentials**
5. Click **Create Credentials** > **OAuth client ID**
6. Configure the OAuth consent screen:
   - Application name: "Pathfinder"
   - Authorized domains: Your domain(s)
   - Privacy policy URL: Your privacy policy
   - Terms of service URL: Your terms
7. Create OAuth 2.0 Client ID:
   - Application type: Web application
   - Name: "Pathfinder Web Client"
   - Authorized JavaScript origins:
     - `http://localhost:3000` (development)
     - `https://yourdomain.com` (production)
   - Authorized redirect URIs:
     - `http://localhost:3001/api/auth/google/callback` (development)
     - `https://yourdomain.com/api/auth/google/callback` (production)
8. Save the Client ID and Client Secret

### 2. Environment Configuration

Add the following environment variables to your `.env` file:

```bash
# Google OAuth Configuration
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3001/api/auth/google/callback

# OAuth Feature Flags
GOOGLE_OAUTH_ENABLED=true
GOOGLE_OAUTH_ALLOW_SIGNUP=true
GOOGLE_OAUTH_AUTO_LINK=false

# Optional: Domain restrictions (comma-separated)
GOOGLE_ALLOWED_DOMAINS=yourdomain.com,anotherdomain.com

# Security
JWT_SECRET=your-jwt-secret-key
ENABLE_FIELD_ENCRYPTION=true
```

### 3. Database Setup

The required database tables are automatically created during setup:

- `pf_sso_accounts`: Stores OAuth account information
- `pf_feature_flags`: Controls OAuth availability

Run database migrations:

```bash
npm run db:setup
```

### 4. Feature Flag Configuration

Enable Google OAuth through feature flags:

```javascript
// Via API
POST /api/feature-flags
{
  "flag_key": "google_oauth_enabled",
  "flag_name": "Google OAuth",
  "description": "Enable Google OAuth authentication",
  "is_enabled": true,
  "rollout_percentage": 100
}
```

Or programmatically:

```javascript
await featureFlagService.setFlag('google_oauth_enabled', true);
await featureFlagService.setFlag('google_oauth_allow_signup', true);
await featureFlagService.setFlag('google_oauth_auto_link', false);
```

## Security Configuration

### PKCE (Proof Key for Code Exchange)

PKCE is automatically implemented for all OAuth flows:

- Code verifier: 32-byte random value
- Code challenge: SHA256 hash of verifier
- Challenge method: S256

### State Parameter

- 32-byte random state parameter
- 10-minute expiration
- One-time use (prevents replay attacks)
- Stored in memory (Redis in production)

### Token Encryption

OAuth tokens are encrypted before storage:

- Algorithm: AES-256-GCM
- Unique encryption key per user
- Automatic decryption on retrieval

### Rate Limiting

OAuth endpoints are rate-limited:

- `/api/auth/google`: 10 attempts per hour
- `/api/auth/google/callback`: 20 attempts per hour
- Per-IP address limiting

## Usage

### Frontend Integration

#### Add Google Sign-In Button

```tsx
import { GoogleSignInButton } from '@/components/auth/GoogleSignIn';

// In your login form
<GoogleSignInButton 
  fullWidth 
  variant="outline"
  returnUrl="/dashboard"
/>
```

#### Check OAuth Availability

```typescript
import { featureFlagService } from '@/services/featureFlagService';

const isGoogleOAuthEnabled = await featureFlagService.isEnabled(
  'google_oauth_enabled',
  userId
);
```

### User Flows

#### 1. New User Sign-Up

1. User clicks "Continue with Google"
2. Redirected to Google consent screen
3. Grants permissions
4. Redirected back to application
5. Local account automatically created
6. User logged in

#### 2. Existing User Sign-In

1. User clicks "Continue with Google"
2. Google authentication
3. Matched to existing SSO account
4. Tokens refreshed
5. User logged in

#### 3. Account Linking

When email exists but no SSO account:

**Auto-link enabled:**
- Automatically links Google to existing account

**Auto-link disabled:**
- Redirects to merge page
- User enters password
- Accounts linked after verification

#### 4. Account Unlinking

```typescript
// Check if user can unlink
const providers = await authService.getLinkedProviders();
const hasPassword = await authService.userHasPassword();

if (hasPassword || providers.length > 1) {
  await authService.unlinkProvider('google');
}
```

## API Endpoints

### OAuth Flow

```http
GET /api/auth/google?returnUrl=/dashboard
```
Generates Google OAuth authorization URL

```http
GET /api/auth/google/callback?code=xxx&state=yyy
```
Handles OAuth callback

### Account Management

```http
POST /api/auth/google/merge
{
  "password": "current-password",
  "googleAuthCode": "auth-code"
}
```
Links Google account with password verification

```http
DELETE /api/auth/google/unlink
```
Removes Google account link

```http
GET /api/auth/sso/providers
```
Lists all linked OAuth providers

## Troubleshooting

### Common Issues

#### "Google authentication is not available"
- Check feature flag is enabled
- Verify environment variables are set
- Ensure Google OAuth client is configured

#### "Invalid state parameter"
- State expired (>10 minutes)
- State already used
- Clear browser cookies and retry

#### "Sign up with Google is not allowed"
- Check `GOOGLE_OAUTH_ALLOW_SIGNUP` flag
- Verify user registration is enabled

#### Token refresh failures
- Check refresh token is stored
- Verify encryption keys are consistent
- Check Google OAuth client is active

### Debug Mode

Enable debug logging:

```bash
OAUTH_LOG_LEVEL=debug
OAUTH_AUDIT_ALL=true
```

Check audit logs:

```sql
SELECT * FROM pf_audit_log 
WHERE action LIKE 'GOOGLE_OAUTH_%'
ORDER BY created_at DESC;
```

## Production Checklist

- [ ] SSL certificate installed (HTTPS required)
- [ ] Redis configured for state management
- [ ] Environment variables set securely
- [ ] Feature flags configured appropriately
- [ ] Rate limiting configured
- [ ] Monitoring and alerting set up
- [ ] Audit logging enabled
- [ ] Backup authentication method available
- [ ] Privacy policy updated
- [ ] Terms of service updated

## Security Best Practices

1. **Never expose Client Secret** in frontend code
2. **Always use HTTPS** in production
3. **Implement rate limiting** on OAuth endpoints
4. **Monitor audit logs** for suspicious activity
5. **Rotate encryption keys** periodically
6. **Validate redirect URLs** to prevent open redirects
7. **Keep Google OAuth client** credentials secure
8. **Enable 2FA** on Google Cloud Console account
9. **Regularly review** linked accounts
10. **Provide account recovery** options

## Compliance

### GDPR Compliance

- User consent obtained through Google
- Profile data minimally collected
- Right to deletion (unlink accounts)
- Data portability supported

### Data Storage

- Minimal Google profile data stored:
  - Email
  - Name
  - Profile picture URL
- Tokens encrypted at rest
- User can request data deletion

## Monitoring

### Key Metrics

- OAuth success rate
- Account creation rate
- Link/unlink operations
- Token refresh failures
- Authentication errors

### Alerts

Set up alerts for:
- High failure rates
- Unusual login patterns
- Token refresh failures
- State validation errors

## Support

For issues or questions:
1. Check the troubleshooting section
2. Review audit logs
3. Contact support with:
   - Error messages
   - Audit log entries
   - Steps to reproduce