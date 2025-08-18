# Self-Registration System with DDoS Protection

## Overview

The self-registration system allows public users to create accounts on the Pathfinder platform while providing comprehensive protection against DDoS attacks, spam, and abuse. The system is disabled by default and can be enabled via feature flags with granular control over protection mechanisms.

## Architecture

### Components

1. **Registration Service** (`registrationService.js`)
   - Handles the registration workflow
   - Validates user input
   - Manages email verification
   - Coordinates with protection service

2. **DDoS Protection Service** (`ddosProtectionService.js`)
   - IP blocking and reputation management
   - Rate limiting with sliding windows
   - Attack pattern detection
   - VPN/Proxy detection
   - Disposable email blocking

3. **Registration Routes** (`registrationRoutes.js`)
   - Public endpoints for registration
   - Admin endpoints for monitoring and control
   - Rate limiting middleware integration

4. **Registration Controller** (`registrationController.js`)
   - HTTP request handling
   - Response formatting
   - Error handling

## Security Features

### Multi-Layer Protection

1. **Rate Limiting**
   - IP-based: 5 attempts per 15 minutes
   - Email-based: 3 attempts per 15 minutes
   - Sliding window algorithm
   - Redis-backed for distributed systems

2. **CAPTCHA Integration**
   - Google reCAPTCHA v3 support
   - Triggered based on suspicion score
   - Required after threshold attempts

3. **Email Validation**
   - Format validation
   - DNS MX record verification
   - Disposable email blocking
   - Domain blacklisting

4. **Bot Detection**
   - User agent analysis
   - Headless browser detection
   - Automation tool detection
   - Behavioral pattern analysis

5. **IP Reputation**
   - AbuseIPDB integration (production)
   - Spamhaus checking
   - Internal reputation scoring
   - VPN/Proxy detection

6. **Attack Pattern Detection**
   - Credential stuffing
   - Email enumeration
   - Dictionary attacks
   - Distributed attacks
   - Sequential patterns

### Protection Escalation

The system automatically escalates protection when attacks are detected:

1. **Rapid Attempts** (>10 in 5 minutes)
   - Reduce rate limits
   - Require CAPTCHA for all requests

2. **Distributed Attack** (>100 unique IPs/minute)
   - Enable strict mode
   - Consider auto-disable
   - Alert administrators

3. **Emergency Disable** (>500 unique IPs/minute)
   - Automatically disable registration
   - Clear pending registrations
   - Send emergency alerts

## Registration Flow

### User Registration Process

1. **Check Availability**
   ```
   POST /api/auth/register/check-username
   POST /api/auth/register/check-email
   ```

2. **Submit Registration**
   ```
   POST /api/auth/register
   {
     "email": "user@example.com",
     "username": "newuser",
     "password": "SecurePass123!",
     "firstName": "John",
     "lastName": "Doe",
     "captchaToken": "..." // If required
   }
   ```

3. **Email Verification**
   - User receives verification email
   - Contains verification link and 6-digit code
   - Valid for 24 hours

4. **Complete Verification**
   ```
   GET /api/auth/verify-email?token=...
   // OR
   POST /api/auth/verify-email-code
   {
     "email": "user@example.com",
     "code": "123456"
   }
   ```

5. **Account Activated**
   - User receives welcome email
   - Can now log in with credentials

## Admin Controls

### Monitoring Endpoints

```javascript
// Get registration metrics
GET /api/admin/registration/metrics

// Get security alerts
GET /api/admin/registration/alerts

// Get recent attempts
GET /api/admin/registration/attempts?limit=50&success=false

// Get attack patterns
GET /api/admin/registration/attack-patterns
```

### Control Endpoints

```javascript
// Emergency disable
POST /api/admin/registration/emergency-disable
{
  "reason": "Distributed attack detected"
}

// Block IP
POST /api/admin/registration/block-ip
{
  "ipAddress": "192.168.1.1",
  "duration": 1440, // minutes
  "reason": "Suspicious activity"
}

// Blacklist domain
POST /api/admin/registration/blacklist-domain
{
  "domain": "spam.com",
  "reason": "Known spam domain"
}

// Update configuration
POST /api/admin/registration/configure
{
  "enabled": true,
  "rolloutPercentage": 50,
  "maxAttemptsPerIP": 5,
  "requireCaptcha": true
}
```

## Configuration

### Environment Variables

```bash
# Redis for rate limiting
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# CAPTCHA
RECAPTCHA_SITE_KEY=your_site_key
RECAPTCHA_SECRET=your_secret_key

# Email verification
VERIFICATION_SECRET=your_verification_secret

# URLs
FRONTEND_URL=http://localhost:5173
BACKEND_URL=http://localhost:3000
```

### Feature Flag Configuration

```javascript
{
  "name": "self_registration_enabled",
  "enabled": false,
  "value": {
    "defaultValue": "false",
    "rolloutPercentage": 0,
    "enableCaptcha": true,
    "maxAttemptsPerIP": 5,
    "maxAttemptsPerEmail": 3,
    "windowMinutes": 15,
    "blockDurationMinutes": 60,
    "requireEmailVerification": true,
    "allowedCountries": [],
    "blockedCountries": []
  }
}
```

## Database Schema

### Key Tables

1. **pf_registration_attempts** - Tracks all registration attempts
2. **pf_pending_registrations** - Stores unverified registrations
3. **pf_blocked_ips** - Manages IP blocks
4. **pf_blocked_subnets** - Subnet-level blocking
5. **pf_disposable_email_domains** - Known disposable domains
6. **pf_blacklisted_domains** - Manually blacklisted domains
7. **pf_ip_reputation** - IP reputation cache
8. **pf_detected_attacks** - Attack pattern history
9. **pf_registration_metrics** - Hourly metrics
10. **pf_registration_alerts** - Security alerts
11. **pf_device_fingerprints** - Device tracking

## Testing

### Unit Tests
```bash
npm run test:unit -- registrationService.test.js
npm run test:unit -- ddosProtectionService.test.js
```

### Integration Tests
```bash
npm run test:integration -- self-registration.test.js
```

### Load Testing
```bash
# Simulate registration load
npm run test:load -- registration
```

## Monitoring

### Key Metrics

1. **Registration Rate**
   - Successful registrations/hour
   - Failed attempts/hour
   - Conversion rate

2. **Security Metrics**
   - Blocked IPs count
   - CAPTCHA challenges/passes
   - Suspicion score average
   - Attack patterns detected

3. **Performance Metrics**
   - Response time percentiles
   - Rate limit hits
   - Redis latency

### Alerts

The system generates alerts for:
- Rapid attempt patterns
- Distributed attacks
- High failure rates
- Emergency disables
- Suspicious patterns

## Security Best Practices

1. **Always start with registration disabled**
   - Enable gradually with monitoring
   - Use percentage rollout for testing

2. **Monitor metrics closely**
   - Watch for unusual patterns
   - Review alerts promptly
   - Adjust thresholds as needed

3. **Regular maintenance**
   - Update disposable email list
   - Review IP reputation data
   - Clean up old attempt records

4. **Incident response**
   - Have emergency disable ready
   - Document attack patterns
   - Update protection rules

## Troubleshooting

### Common Issues

1. **Registration always blocked**
   - Check IP not in blocked list
   - Verify rate limits not too strict
   - Check Redis connectivity

2. **CAPTCHA not working**
   - Verify reCAPTCHA keys
   - Check domain whitelist in Google console
   - Test score threshold

3. **Emails not sending**
   - Check SMTP configuration
   - Verify email templates exist
   - Check email service logs

4. **High false positive rate**
   - Adjust suspicion score weights
   - Review VPN/Proxy detection
   - Tune rate limits

## API Examples

### Successful Registration
```javascript
// Request
POST /api/auth/register
{
  "email": "john.doe@company.com",
  "username": "johndoe",
  "password": "SecurePass123!",
  "firstName": "John",
  "lastName": "Doe"
}

// Response
{
  "success": true,
  "message": "Registration successful. Please check your email for verification.",
  "requiresVerification": true
}
```

### CAPTCHA Required
```javascript
// Response
{
  "error": "CAPTCHA_REQUIRED",
  "requireCaptcha": true
}
```

### Rate Limited
```javascript
// Response (429)
{
  "error": "Too many registration attempts. Please try again later.",
  "retryAfter": 900
}
```

## Migration Guide

### Enabling Self-Registration

1. **Configure environment**
   ```bash
   export REDIS_HOST=your_redis_host
   export RECAPTCHA_SITE_KEY=your_site_key
   export RECAPTCHA_SECRET=your_secret_key
   ```

2. **Run migrations**
   ```bash
   npm run db:migrate
   ```

3. **Configure feature flag**
   ```javascript
   await featureFlagService.updateFlag('self_registration_enabled', {
     defaultValue: 'true',
     rolloutPercentage: 10 // Start with 10%
   });
   ```

4. **Monitor metrics**
   - Watch registration attempts
   - Review security alerts
   - Adjust configuration as needed

5. **Gradual rollout**
   - Increase percentage slowly
   - Monitor for issues
   - Full enable when stable

## Support

For issues or questions:
- Check logs in `/logs/registration/`
- Review metrics dashboard
- Contact security team for attack response
- Submit issues to GitHub repository