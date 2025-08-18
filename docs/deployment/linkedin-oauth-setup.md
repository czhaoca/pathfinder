# LinkedIn OAuth Setup and Configuration

## Overview

This document provides technical setup instructions for configuring LinkedIn OAuth 2.0 integration in the Pathfinder application.

## Prerequisites

- LinkedIn Developer Account
- Verified LinkedIn Company Page (for production)
- SSL certificate (HTTPS required)
- Domain verification

## LinkedIn App Configuration

### 1. Create LinkedIn App

1. Go to [LinkedIn Developers](https://www.linkedin.com/developers/)
2. Click **Create App**
3. Fill in required information:
   - **App Name**: Pathfinder Career Navigation
   - **LinkedIn Page**: Select your company page
   - **Privacy Policy URL**: https://pathfinder.com/privacy
   - **App Logo**: Upload 100x100px logo
4. Click **Create App**

### 2. Configure OAuth Settings

In your LinkedIn app dashboard:

1. Navigate to **Auth** tab
2. Add **Authorized redirect URLs**:
   ```
   https://pathfinder.com/api/auth/linkedin/callback
   https://staging.pathfinder.com/api/auth/linkedin/callback
   http://localhost:3000/api/auth/linkedin/callback
   ```

3. Configure **OAuth 2.0 scopes**:
   - ✅ `openid` - OpenID Connect
   - ✅ `profile` - Member's profile
   - ✅ `email` - Member's email
   - ✅ `w_member_social` - Social actions

### 3. Obtain Credentials

From the **Auth** tab, copy:
- **Client ID**: Your app's unique identifier
- **Client Secret**: Your app's secret key

**Security Note**: Never commit credentials to version control!

## Environment Configuration

### Development Environment

Create `.env.development`:

```bash
# LinkedIn OAuth Configuration
LINKEDIN_OAUTH_ENABLED=true
LINKEDIN_CLIENT_ID=your_development_client_id
LINKEDIN_CLIENT_SECRET=your_development_client_secret
LINKEDIN_REDIRECT_URI=http://localhost:3000/api/auth/linkedin/callback

# LinkedIn API URLs
LINKEDIN_AUTH_URL=https://www.linkedin.com/oauth/v2/authorization
LINKEDIN_TOKEN_URL=https://www.linkedin.com/oauth/v2/accessToken
LINKEDIN_USER_INFO_URL=https://api.linkedin.com/v2/userinfo
LINKEDIN_PROFILE_URL=https://api.linkedin.com/v2/me

# OAuth Settings
LINKEDIN_OAUTH_SCOPES=openid profile email w_member_social
LINKEDIN_STATE_EXPIRATION=300
LINKEDIN_ALLOW_SIGNUP=true
LINKEDIN_AUTO_LINK_ACCOUNTS=false

# Profile Import Settings
LINKEDIN_IMPORT_WORK_EXPERIENCE=true
LINKEDIN_IMPORT_EDUCATION=true
LINKEDIN_IMPORT_SKILLS=true
LINKEDIN_IMPORT_CERTIFICATIONS=true
LINKEDIN_IMPORT_SUMMARY=true
LINKEDIN_IMPORT_PROFILE_PHOTO=true
LINKEDIN_IMPORT_LOCATION=true
LINKEDIN_IMPORT_INDUSTRY=true

# Sync Settings
LINKEDIN_SYNC_INTERVAL=86400000  # 24 hours in milliseconds
LINKEDIN_SYNC_ENABLED_DEFAULT=true
```

### Production Environment

Create `.env.production`:

```bash
# LinkedIn OAuth Configuration
LINKEDIN_OAUTH_ENABLED=true
LINKEDIN_CLIENT_ID=${LINKEDIN_PROD_CLIENT_ID}
LINKEDIN_CLIENT_SECRET=${LINKEDIN_PROD_CLIENT_SECRET}
LINKEDIN_REDIRECT_URI=https://pathfinder.com/api/auth/linkedin/callback

# Security Settings
LINKEDIN_PKCE_ENABLED=true
LINKEDIN_STATE_LENGTH=32
LINKEDIN_CODE_VERIFIER_LENGTH=128

# Rate Limiting
LINKEDIN_OAUTH_RATE_LIMIT=20
LINKEDIN_OAUTH_RATE_WINDOW=900000
LINKEDIN_IMPORT_RATE_LIMIT=10
LINKEDIN_IMPORT_RATE_WINDOW=3600000

# Feature Flags
LINKEDIN_OAUTH_FEATURE_FLAG=linkedin_oauth_enabled
LINKEDIN_GRADUAL_ROLLOUT_PERCENTAGE=100
```

## Docker Configuration

### Docker Compose

Add LinkedIn OAuth service configuration:

```yaml
version: '3.8'

services:
  backend:
    environment:
      - LINKEDIN_OAUTH_ENABLED=${LINKEDIN_OAUTH_ENABLED}
      - LINKEDIN_CLIENT_ID=${LINKEDIN_CLIENT_ID}
      - LINKEDIN_CLIENT_SECRET=${LINKEDIN_CLIENT_SECRET}
      - LINKEDIN_REDIRECT_URI=${LINKEDIN_REDIRECT_URI}
    volumes:
      - ./certs:/app/certs:ro  # SSL certificates

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes

volumes:
  redis_data:
```

### Kubernetes Configuration

Create ConfigMap for non-sensitive config:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: linkedin-oauth-config
data:
  LINKEDIN_OAUTH_ENABLED: "true"
  LINKEDIN_REDIRECT_URI: "https://pathfinder.com/api/auth/linkedin/callback"
  LINKEDIN_OAUTH_SCOPES: "openid profile email w_member_social"
  LINKEDIN_STATE_EXPIRATION: "300"
  LINKEDIN_SYNC_INTERVAL: "86400000"
```

Create Secret for sensitive data:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: linkedin-oauth-secret
type: Opaque
data:
  LINKEDIN_CLIENT_ID: <base64_encoded_client_id>
  LINKEDIN_CLIENT_SECRET: <base64_encoded_client_secret>
```

## Application Configuration

### Backend Service Registration

Register LinkedIn OAuth service in dependency injection:

```javascript
// src/config/container.js
const LinkedInOAuthService = require('../services/linkedInOAuthService');
const ProfileImportService = require('../services/profileImportService');

container.register('linkedInOAuthService', () => {
  return new LinkedInOAuthService(
    config,
    container.get('userService'),
    container.get('ssoService'),
    container.get('auditService'),
    container.get('database'),
    container.get('encryptionService'),
    container.get('profileImportService'),
    container.get('featureFlagService')
  );
});

container.register('profileImportService', () => {
  return new ProfileImportService(
    container.get('database'),
    container.get('experienceService'),
    container.get('educationService'),
    container.get('skillsService'),
    container.get('certificationsService')
  );
});
```

### Feature Flag Configuration

Enable LinkedIn OAuth via feature flags:

```sql
-- Enable LinkedIn OAuth globally
INSERT INTO pf_feature_flags (
  flag_key,
  flag_name,
  description,
  enabled,
  rollout_percentage,
  targeting_rules
) VALUES (
  'linkedin_oauth_enabled',
  'LinkedIn OAuth Integration',
  'Enable LinkedIn sign-in and profile import',
  'Y',
  100,
  NULL
);

-- Gradual rollout configuration
UPDATE pf_feature_flags
SET 
  rollout_percentage = 25,
  targeting_rules = JSON_OBJECT(
    'strategy', 'percentage',
    'rules', JSON_ARRAY(
      JSON_OBJECT(
        'type', 'user_attribute',
        'attribute', 'beta_tester',
        'operator', 'equals',
        'value', true
      )
    )
  )
WHERE flag_key = 'linkedin_oauth_enabled';
```

## Security Configuration

### PKCE Implementation

Ensure PKCE is properly configured:

```javascript
// Generate code verifier and challenge
const codeVerifier = crypto.randomBytes(32).toString('base64url');
const codeChallenge = crypto
  .createHash('sha256')
  .update(codeVerifier)
  .digest('base64url');

// Include in authorization URL
const authUrl = new URL('https://www.linkedin.com/oauth/v2/authorization');
authUrl.searchParams.append('code_challenge', codeChallenge);
authUrl.searchParams.append('code_challenge_method', 'S256');
```

### Token Encryption

Configure encryption for stored tokens:

```javascript
// Encryption configuration
const encryptionConfig = {
  algorithm: 'aes-256-gcm',
  keyDerivation: 'pbkdf2',
  iterations: 100000,
  saltLength: 32,
  tagLength: 16,
  ivLength: 16
};

// Key management
const masterKey = process.env.ENCRYPTION_MASTER_KEY;
const userKey = deriveUserKey(masterKey, userId);
```

### SSL/TLS Configuration

Nginx configuration for HTTPS:

```nginx
server {
    listen 443 ssl http2;
    server_name pathfinder.com;

    ssl_certificate /etc/nginx/certs/pathfinder.crt;
    ssl_certificate_key /etc/nginx/certs/pathfinder.key;
    
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    
    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    
    location /api/auth/linkedin {
        proxy_pass http://backend:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Monitoring and Logging

### Application Metrics

Track LinkedIn OAuth metrics:

```javascript
// Prometheus metrics
const promClient = require('prom-client');

const linkedinAuthCounter = new promClient.Counter({
  name: 'linkedin_oauth_attempts_total',
  help: 'Total LinkedIn OAuth attempts',
  labelNames: ['status']
});

const linkedinImportHistogram = new promClient.Histogram({
  name: 'linkedin_import_duration_seconds',
  help: 'LinkedIn profile import duration',
  buckets: [0.1, 0.5, 1, 2, 5, 10]
});
```

### Audit Logging

Configure comprehensive audit logging:

```javascript
// Audit log configuration
const auditConfig = {
  linkedinOAuth: {
    logLevel: 'info',
    includeHeaders: ['user-agent', 'x-forwarded-for'],
    sensitiveFields: ['access_token', 'refresh_token'],
    retention: 90 // days
  }
};

// Log OAuth events
auditService.log({
  userId,
  action: 'LINKEDIN_OAUTH_SUCCESS',
  resourceType: 'authentication',
  details: {
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    timestamp: new Date().toISOString()
  }
});
```

## Testing Configuration

### Integration Tests

Configure test environment:

```javascript
// test/setup/linkedin-oauth.js
const nock = require('nock');

beforeEach(() => {
  // Mock LinkedIn API endpoints
  nock('https://www.linkedin.com')
    .post('/oauth/v2/accessToken')
    .reply(200, {
      access_token: 'test_access_token',
      expires_in: 3600
    });

  nock('https://api.linkedin.com')
    .get('/v2/userinfo')
    .reply(200, {
      sub: 'linkedin_user_id',
      email: 'test@example.com',
      given_name: 'Test',
      family_name: 'User'
    });
});
```

### Load Testing

Configure load testing for OAuth endpoints:

```yaml
# k6-linkedin-oauth.js
import http from 'k6/http';
import { check } from 'k6';

export let options = {
  stages: [
    { duration: '2m', target: 100 },
    { duration: '5m', target: 100 },
    { duration: '2m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.1'],
  },
};

export default function() {
  let response = http.get('https://pathfinder.com/api/auth/linkedin');
  check(response, {
    'status is 200': (r) => r.status === 200,
    'has auth URL': (r) => r.json('data.authUrl') !== undefined,
  });
}
```

## Troubleshooting

### Common Issues

#### Invalid Redirect URI

**Error**: `invalid_redirect_uri`

**Solution**:
1. Verify redirect URI matches exactly in LinkedIn app settings
2. Check for trailing slashes
3. Ensure HTTPS in production

#### Token Expiration

**Error**: `invalid_token`

**Solution**:
```javascript
// Implement automatic token refresh
if (isTokenExpired(accessToken)) {
  accessToken = await refreshAccessToken(refreshToken);
}
```

#### Rate Limiting

**Error**: `429 Too Many Requests`

**Solution**:
- Implement exponential backoff
- Cache user profiles
- Use batch operations where possible

### Debug Mode

Enable debug logging:

```javascript
// Enable LinkedIn OAuth debugging
if (process.env.DEBUG_LINKEDIN_OAUTH) {
  console.log('LinkedIn OAuth Request:', {
    url: authUrl,
    params: authParams,
    headers: sanitizeHeaders(headers)
  });
}
```

## Migration Guide

### From Manual Authentication

1. Enable LinkedIn OAuth feature flag
2. Run migration to create SSO accounts table
3. Prompt existing users to link LinkedIn
4. Gradually phase out manual auth

### Database Migration

```sql
-- Add LinkedIn-specific fields
ALTER TABLE pf_sso_accounts
ADD COLUMN linkedin_vanity_name VARCHAR(100),
ADD COLUMN linkedin_industry VARCHAR(100),
ADD COLUMN linkedin_headline VARCHAR(500);

-- Create indexes for performance
CREATE INDEX idx_sso_linkedin ON pf_sso_accounts(provider, provider_user_id)
WHERE provider = 'linkedin';
```

## Compliance

### GDPR Compliance

- Obtain explicit consent for data access
- Provide data export functionality
- Implement right to be forgotten
- Log all data access

### LinkedIn Platform Policies

Ensure compliance with:
- LinkedIn API Terms of Use
- Data usage restrictions
- Rate limit guidelines
- Branding requirements

## Performance Optimization

### Caching Strategy

```javascript
// Redis caching for LinkedIn profiles
const cacheKey = `linkedin:profile:${userId}`;
const cached = await redis.get(cacheKey);

if (!cached) {
  const profile = await fetchLinkedInProfile(accessToken);
  await redis.setex(cacheKey, 3600, JSON.stringify(profile));
  return profile;
}

return JSON.parse(cached);
```

### Database Optimization

```sql
-- Optimize SSO account queries
CREATE INDEX idx_sso_user_provider ON pf_sso_accounts(user_id, provider);
CREATE INDEX idx_sso_token_expires ON pf_sso_accounts(token_expires_at)
WHERE token_expires_at IS NOT NULL;
```

## Maintenance

### Regular Tasks

1. **Weekly**: Review OAuth logs for anomalies
2. **Monthly**: Rotate encryption keys
3. **Quarterly**: Update LinkedIn API integration
4. **Annually**: Review and update scopes

### Monitoring Checklist

- [ ] OAuth success rate > 95%
- [ ] Token refresh success rate > 99%
- [ ] Average auth time < 2 seconds
- [ ] No security incidents
- [ ] API rate limits not exceeded

---

*Last updated: January 2024*
*Version: 1.0*