# Registration API Endpoints

## Overview
The self-registration system provides secure public user registration with comprehensive DDoS protection. The system is disabled by default and must be explicitly enabled via feature flag.

## Base URL
```
/api/auth/register
```

## Authentication
These endpoints are public when registration is enabled. No authentication required for initial registration, but email verification is mandatory.

## Endpoints

### 1. Check Username Availability
Check if a username is available for registration.

**Endpoint:** `GET /api/auth/register/check-username`

**Query Parameters:**
- `username` (string, required): Username to check

**Response:**
```json
{
  "available": true,
  "message": "Username is available"
}
```

**Error Responses:**
- `400 Bad Request`: Invalid username format
- `409 Conflict`: Username already taken
- `429 Too Many Requests`: Rate limit exceeded

---

### 2. Check Email Availability
Check if an email address is available for registration.

**Endpoint:** `GET /api/auth/register/check-email`

**Query Parameters:**
- `email` (string, required): Email address to check

**Response:**
```json
{
  "available": true,
  "message": "Email is available"
}
```

**Error Responses:**
- `400 Bad Request`: Invalid email format or disposable email detected
- `409 Conflict`: Email already registered
- `429 Too Many Requests`: Rate limit exceeded

---

### 3. Start Registration
Initiate the registration process with user details.

**Endpoint:** `POST /api/auth/register/start`

**Request Body:**
```json
{
  "username": "johndoe",
  "email": "john@example.com",
  "password": "SecurePass123!",
  "firstName": "John",
  "lastName": "Doe",
  "acceptTerms": true,
  "captchaToken": "reCAPTCHA_token_here"
}
```

**Field Requirements:**
- `username`: 3-50 characters, alphanumeric with underscores/hyphens
- `email`: Valid email format, not disposable
- `password`: Minimum 8 characters, must include uppercase, lowercase, and number
- `firstName`: 1-100 characters
- `lastName`: 1-100 characters
- `acceptTerms`: Must be true
- `captchaToken`: Required when suspicion score is high or after failed attempts

**Response:**
```json
{
  "success": true,
  "message": "Registration started. Please check your email for verification.",
  "registrationId": "uuid-here",
  "verificationMethod": "email"
}
```

**Error Responses:**
- `400 Bad Request`: Validation errors
- `403 Forbidden`: Registration disabled or blocked IP/email
- `409 Conflict`: Username or email already exists
- `429 Too Many Requests`: Rate limit exceeded
- `451 Unavailable For Legal Reasons`: Geographic restriction

---

### 4. Verify Email
Complete registration by verifying the email address.

**Endpoint:** `POST /api/auth/register/verify`

**Request Body (Token Method):**
```json
{
  "token": "verification-token-from-email"
}
```

**Request Body (Code Method):**
```json
{
  "email": "john@example.com",
  "code": "123456"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Email verified successfully. Registration complete.",
  "user": {
    "id": "user-id",
    "username": "johndoe",
    "email": "john@example.com"
  },
  "token": "jwt-auth-token"
}
```

**Error Responses:**
- `400 Bad Request`: Invalid or expired token/code
- `404 Not Found`: Registration not found
- `429 Too Many Requests`: Too many verification attempts

---

### 5. Resend Verification Email
Request a new verification email.

**Endpoint:** `POST /api/auth/register/resend-verification`

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
  "message": "Verification email resent"
}
```

**Error Responses:**
- `400 Bad Request`: Invalid email
- `404 Not Found`: No pending registration found
- `429 Too Many Requests`: Resend limit exceeded (max 3 per hour)

---

## Rate Limiting

The registration system implements multiple layers of rate limiting:

### Per IP Address
- 5 registration attempts per 15 minutes
- 10 availability checks per minute
- 3 verification attempts per hour

### Per Email Address
- 3 registration attempts per 15 minutes
- 3 resend requests per hour

### Global Limits
- 100 registrations per hour (configurable)
- 500 unique IPs per minute triggers emergency mode

## DDoS Protection Features

### CAPTCHA Requirements
CAPTCHA is required when:
- Suspicion score exceeds threshold
- After 2 failed attempts from same IP
- When bot patterns are detected
- During high traffic periods

### Automatic Blocking
The system automatically blocks:
- IPs with 5+ failed attempts (1 hour block)
- Disposable email domains
- Known VPN/proxy IPs (configurable)
- Suspicious patterns (sequential usernames, etc.)

### Emergency Controls
Administrators can:
- Instantly disable registration via kill switch
- Block specific IPs or email domains
- Enable strict mode (CAPTCHA for all)
- Set geographic restrictions

## Error Handling

All errors follow this format:
```json
{
  "error": {
    "code": "REGISTRATION_DISABLED",
    "message": "User-friendly error message",
    "details": {
      "field": "specific_field_if_applicable"
    }
  }
}
```

## Common Error Codes
- `REGISTRATION_DISABLED`: Feature flag is off
- `RATE_LIMIT_EXCEEDED`: Too many requests
- `INVALID_CAPTCHA`: CAPTCHA verification failed
- `DISPOSABLE_EMAIL`: Disposable email detected
- `IP_BLOCKED`: IP address is blocked
- `GEO_RESTRICTED`: Geographic restriction
- `VALIDATION_ERROR`: Input validation failed
- `DUPLICATE_USER`: Username/email exists
- `VERIFICATION_EXPIRED`: Token/code expired

## Security Considerations

1. **Default State**: Registration is DISABLED by default
2. **Email Verification**: Always required, no exceptions
3. **Password Security**: Passwords hashed with bcrypt (cost factor 12)
4. **Token Security**: Cryptographically secure tokens with 24-hour expiry
5. **Audit Logging**: All registration attempts are logged
6. **Fingerprinting**: Device fingerprints tracked for pattern detection

## Testing in Development

To test registration in development:

1. Enable the feature flag:
```sql
UPDATE pf_feature_flags 
SET is_enabled = true 
WHERE feature_key = 'self_registration_enabled';
```

2. Configure CAPTCHA (optional for dev):
```bash
RECAPTCHA_SITE_KEY=your_test_key
RECAPTCHA_SECRET_KEY=your_test_secret
```

3. Configure email service:
```bash
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your_email
SMTP_PASS=your_password
```

## Monitoring

Monitor registration health via:
- `GET /api/admin/registration/metrics` - Registration statistics
- `GET /api/admin/registration/alerts` - Security alerts
- `GET /api/admin/registration/attack-patterns` - Attack analysis

## Admin Controls

Administrators can manage registration via:
- `POST /api/admin/registration/emergency-disable` - Kill switch
- `POST /api/admin/registration/block-ip` - Block specific IP
- `POST /api/admin/registration/block-domain` - Block email domain
- `PUT /api/admin/registration/config` - Update configuration