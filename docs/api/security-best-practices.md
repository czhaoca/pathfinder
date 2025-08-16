# API Security Best Practices

## Overview

This guide provides comprehensive security best practices for developers, administrators, and users of the Pathfinder API. Following these practices ensures data protection, system integrity, and compliance with security standards.

## Table of Contents

1. [Authentication Security](#authentication-security)
2. [Data Protection](#data-protection)
3. [API Security](#api-security)
4. [Client-Side Security](#client-side-security)
5. [Server-Side Security](#server-side-security)
6. [Security Headers](#security-headers)
7. [Error Handling](#error-handling)
8. [Monitoring & Auditing](#monitoring--auditing)
9. [Incident Response](#incident-response)
10. [Compliance](#compliance)

## Authentication Security

### Password Management

#### Never Send Plain Text Passwords

```javascript
// ❌ WRONG - Never do this
fetch('/api/auth/login', {
  body: JSON.stringify({
    username: 'user',
    password: 'plaintext123' // Security vulnerability!
  })
});

// ✅ CORRECT - Always hash client-side
async function secureLogin(username, password) {
  const salt = crypto.getRandomValues(new Uint8Array(32));
  const saltHex = Array.from(salt)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  const encoder = new TextEncoder();
  const data = encoder.encode(password + saltHex);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashHex = Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  return fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username,
      password_hash: hashHex,
      client_salt: saltHex
    })
  });
}
```

### Token Management

#### Secure Token Storage

```javascript
// ❌ WRONG - Vulnerable to XSS
localStorage.setItem('token', jwt);

// ✅ BETTER - Use secure storage methods
class SecureTokenStorage {
  // Option 1: HttpOnly cookies (server-set)
  // Immune to XSS, vulnerable to CSRF
  
  // Option 2: Memory + refresh token in httpOnly cookie
  constructor() {
    this.token = null; // Access token in memory
  }
  
  setToken(token) {
    this.token = token; // Keep in memory only
  }
  
  getToken() {
    return this.token;
  }
  
  // Option 3: SessionStorage for less sensitive apps
  // Clears on tab close
  setSessionToken(token) {
    sessionStorage.setItem('token', token);
  }
}
```

#### Automatic Token Refresh

```javascript
class TokenManager {
  constructor() {
    this.token = null;
    this.refreshToken = null;
    this.refreshTimer = null;
  }
  
  startTokenRefresh() {
    // Refresh 1 minute before expiry
    const refreshIn = (14 * 60 * 1000); // 14 minutes
    
    this.refreshTimer = setTimeout(async () => {
      try {
        await this.refreshAccessToken();
      } catch (error) {
        // Force re-authentication
        this.handleAuthFailure();
      }
    }, refreshIn);
  }
  
  stopTokenRefresh() {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  }
  
  handleAuthFailure() {
    this.clearTokens();
    window.location.href = '/login';
  }
  
  clearTokens() {
    this.token = null;
    this.refreshToken = null;
    this.stopTokenRefresh();
  }
}
```

### Multi-Factor Authentication (MFA)

```javascript
// Enable MFA for sensitive operations
async function enableMFA() {
  // Generate secret
  const response = await fetch('/api/auth/mfa/setup', {
    method: 'POST',
    headers: getAuthHeaders()
  });
  
  const { secret, qr_code } = await response.json();
  
  // Display QR code for user to scan
  displayQRCode(qr_code);
  
  // Verify TOTP token
  const token = prompt('Enter verification code:');
  
  const verifyResponse = await fetch('/api/auth/mfa/verify', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ token, secret })
  });
  
  if (verifyResponse.ok) {
    alert('MFA enabled successfully');
  }
}
```

## Data Protection

### Field-Level Encryption

```javascript
// Encrypt sensitive data before sending
class DataEncryption {
  async encryptSensitiveData(data, publicKey) {
    const sensitive = {
      ssn: data.ssn,
      bank_account: data.bank_account,
      medical_info: data.medical_info
    };
    
    // Encrypt sensitive fields
    const encrypted = await crypto.subtle.encrypt(
      {
        name: 'RSA-OAEP',
        hash: 'SHA-256'
      },
      publicKey,
      new TextEncoder().encode(JSON.stringify(sensitive))
    );
    
    return {
      ...data,
      ssn: undefined,
      bank_account: undefined,
      medical_info: undefined,
      encrypted_data: btoa(String.fromCharCode(...new Uint8Array(encrypted)))
    };
  }
}
```

### Input Validation

```javascript
// Validate and sanitize all inputs
class InputValidator {
  static validateEmail(email) {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!regex.test(email)) {
      throw new Error('Invalid email format');
    }
    return email.toLowerCase().trim();
  }
  
  static validateUsername(username) {
    const regex = /^[a-z0-9_]{3,30}$/;
    if (!regex.test(username)) {
      throw new Error('Username must be 3-30 characters, lowercase letters, numbers, and underscores only');
    }
    return username;
  }
  
  static sanitizeHTML(input) {
    // Remove any HTML tags
    return input.replace(/<[^>]*>?/gm, '');
  }
  
  static validatePassword(password) {
    if (password.length < 12) {
      throw new Error('Password must be at least 12 characters');
    }
    
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*]/.test(password);
    
    if (!hasUpperCase || !hasLowerCase || !hasNumbers || !hasSpecialChar) {
      throw new Error('Password must contain uppercase, lowercase, numbers, and special characters');
    }
    
    return password;
  }
}
```

## API Security

### Rate Limiting Implementation

```javascript
// Client-side rate limiting awareness
class APIClient {
  constructor() {
    this.rateLimitInfo = {};
  }
  
  async makeRequest(url, options) {
    // Check if we're rate limited
    if (this.isRateLimited(url)) {
      const resetTime = this.rateLimitInfo[url].reset;
      const waitTime = resetTime - Date.now();
      throw new Error(`Rate limited. Retry in ${Math.ceil(waitTime / 1000)} seconds`);
    }
    
    const response = await fetch(url, options);
    
    // Store rate limit headers
    this.updateRateLimitInfo(url, {
      limit: response.headers.get('X-RateLimit-Limit'),
      remaining: response.headers.get('X-RateLimit-Remaining'),
      reset: new Date(response.headers.get('X-RateLimit-Reset')).getTime()
    });
    
    if (response.status === 429) {
      throw new Error('Rate limit exceeded');
    }
    
    return response;
  }
  
  isRateLimited(url) {
    const info = this.rateLimitInfo[url];
    return info && info.remaining === 0 && info.reset > Date.now();
  }
  
  updateRateLimitInfo(url, info) {
    this.rateLimitInfo[url] = info;
  }
}
```

### API Key Management

```javascript
// Secure API key handling
class APIKeyManager {
  constructor() {
    // Never hardcode API keys
    this.apiKey = process.env.API_KEY; // Load from environment
  }
  
  getHeaders() {
    if (!this.apiKey) {
      throw new Error('API key not configured');
    }
    
    return {
      'X-API-Key': this.apiKey,
      'Content-Type': 'application/json'
    };
  }
  
  // Rotate API keys periodically
  async rotateKey() {
    const response = await fetch('/api/admin/rotate-key', {
      method: 'POST',
      headers: this.getHeaders()
    });
    
    const { new_key } = await response.json();
    this.apiKey = new_key;
    
    // Update stored key securely
    await this.securelyStoreKey(new_key);
  }
}
```

## Client-Side Security

### XSS Prevention

```javascript
// Prevent XSS attacks
class XSSProtection {
  // Escape HTML entities
  static escapeHtml(text) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#x27;',
      '/': '&#x2F;'
    };
    return text.replace(/[&<>"'/]/g, char => map[char]);
  }
  
  // Safe DOM manipulation
  static safelySetContent(element, userContent) {
    // Never use innerHTML with user content
    element.textContent = userContent;
    
    // If HTML is needed, use a sanitization library
    // element.innerHTML = DOMPurify.sanitize(userContent);
  }
  
  // Content Security Policy
  static setCSPHeaders() {
    return {
      'Content-Security-Policy': [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: https:",
        "font-src 'self'",
        "connect-src 'self'",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'"
      ].join('; ')
    };
  }
}
```

### CSRF Protection

```javascript
// CSRF token management
class CSRFProtection {
  constructor() {
    this.token = null;
  }
  
  async fetchCSRFToken() {
    const response = await fetch('/api/csrf-token');
    const data = await response.json();
    this.token = data.csrf_token;
    return this.token;
  }
  
  async makeSecureRequest(url, options = {}) {
    if (!this.token) {
      await this.fetchCSRFToken();
    }
    
    return fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'X-CSRF-Token': this.token
      }
    });
  }
}
```

## Server-Side Security

### Environment Variables

```bash
# .env.example
NODE_ENV=production
API_PORT=3000

# Security
JWT_SECRET=<64-character-random-string>
ENCRYPTION_KEY=<32-byte-hex-string>
REFRESH_TOKEN_SECRET=<64-character-random-string>

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=pathfinder
DB_USER=dbuser
DB_PASSWORD=<strong-password>

# Rate Limiting
RATE_LIMIT_WINDOW=900000  # 15 minutes
RATE_LIMIT_MAX=100

# Session
SESSION_SECRET=<random-string>
SESSION_TIMEOUT=900000  # 15 minutes

# Never commit .env file
# Add to .gitignore
```

### Secure Headers

```javascript
// Express middleware for security headers
app.use((req, res, next) => {
  // Security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  
  // HSTS (only on HTTPS)
  if (req.secure) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
  
  next();
});
```

## Security Headers

### Comprehensive Header Configuration

```javascript
const securityHeaders = {
  // Prevent MIME type sniffing
  'X-Content-Type-Options': 'nosniff',
  
  // Prevent clickjacking
  'X-Frame-Options': 'DENY',
  
  // Enable XSS filter
  'X-XSS-Protection': '1; mode=block',
  
  // HSTS
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  
  // CSP
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'",
  
  // Referrer Policy
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  
  // Permissions Policy
  'Permissions-Policy': 'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()',
  
  // CORP
  'Cross-Origin-Resource-Policy': 'same-origin',
  
  // COEP
  'Cross-Origin-Embedder-Policy': 'require-corp',
  
  // COOP
  'Cross-Origin-Opener-Policy': 'same-origin'
};
```

## Error Handling

### Secure Error Messages

```javascript
// Never expose sensitive information in errors
class SecureErrorHandler {
  static handle(error, req, res) {
    // Log full error internally
    console.error('Error:', {
      message: error.message,
      stack: error.stack,
      user: req.user?.id,
      endpoint: req.path,
      method: req.method,
      ip: req.ip
    });
    
    // Send generic error to client
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Invalid input provided',
        ...(isDevelopment && { details: error.details })
      });
    }
    
    if (error.name === 'UnauthorizedError') {
      return res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Authentication required'
      });
    }
    
    // Generic error for production
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'An error occurred processing your request',
      ...(isDevelopment && { debug: error.message })
    });
  }
}
```

## Monitoring & Auditing

### Security Event Logging

```javascript
class SecurityAuditor {
  static async logSecurityEvent(event) {
    const auditEntry = {
      timestamp: new Date().toISOString(),
      event_type: event.type,
      severity: event.severity,
      user_id: event.userId,
      ip_address: event.ip,
      user_agent: event.userAgent,
      action: event.action,
      result: event.result,
      metadata: event.metadata
    };
    
    // Store in audit log
    await AuditLog.create(auditEntry);
    
    // Alert on critical events
    if (event.severity === 'critical') {
      await this.sendSecurityAlert(auditEntry);
    }
  }
  
  static async detectSuspiciousActivity(userId) {
    const recentEvents = await AuditLog.find({
      user_id: userId,
      timestamp: { $gte: new Date(Date.now() - 3600000) } // Last hour
    });
    
    // Check for suspicious patterns
    const failedLogins = recentEvents.filter(e => 
      e.event_type === 'login' && e.result === 'failure'
    ).length;
    
    if (failedLogins > 5) {
      await this.logSecurityEvent({
        type: 'suspicious_activity',
        severity: 'warning',
        userId,
        action: 'multiple_failed_logins',
        metadata: { count: failedLogins }
      });
    }
  }
}
```

### Real-time Monitoring

```javascript
// Monitor API health and security metrics
class SecurityMonitor {
  static metrics = {
    failedAuths: 0,
    rateLimitHits: 0,
    suspiciousRequests: 0,
    lastReset: Date.now()
  };
  
  static track(event) {
    switch(event.type) {
      case 'auth_failure':
        this.metrics.failedAuths++;
        break;
      case 'rate_limit':
        this.metrics.rateLimitHits++;
        break;
      case 'suspicious':
        this.metrics.suspiciousRequests++;
        break;
    }
    
    // Reset hourly
    if (Date.now() - this.metrics.lastReset > 3600000) {
      this.reportMetrics();
      this.resetMetrics();
    }
  }
  
  static reportMetrics() {
    console.log('Security Metrics:', this.metrics);
    // Send to monitoring service
  }
  
  static resetMetrics() {
    this.metrics = {
      failedAuths: 0,
      rateLimitHits: 0,
      suspiciousRequests: 0,
      lastReset: Date.now()
    };
  }
}
```

## Incident Response

### Security Incident Checklist

1. **Detection**
   - [ ] Identify the type of incident
   - [ ] Determine scope and impact
   - [ ] Document initial findings

2. **Containment**
   - [ ] Isolate affected systems
   - [ ] Prevent further damage
   - [ ] Preserve evidence

3. **Investigation**
   - [ ] Analyze logs and audit trails
   - [ ] Identify root cause
   - [ ] Document timeline of events

4. **Remediation**
   - [ ] Fix vulnerabilities
   - [ ] Patch affected systems
   - [ ] Update security controls

5. **Recovery**
   - [ ] Restore normal operations
   - [ ] Verify system integrity
   - [ ] Monitor for recurrence

6. **Post-Incident**
   - [ ] Complete incident report
   - [ ] Update security procedures
   - [ ] Conduct lessons learned

### Emergency Response Contacts

```javascript
const SECURITY_CONTACTS = {
  security_team: 'security@pathfinder.app',
  ciso: 'ciso@pathfinder.app',
  legal: 'legal@pathfinder.app',
  pr: 'pr@pathfinder.app'
};

async function reportSecurityIncident(incident) {
  // Immediate notification
  await notifySecurityTeam(incident);
  
  // Log incident
  await SecurityAuditor.logSecurityEvent({
    type: 'security_incident',
    severity: 'critical',
    ...incident
  });
  
  // Initiate response protocol
  await initiateIncidentResponse(incident);
}
```

## Compliance

### GDPR Compliance

```javascript
class GDPRCompliance {
  // Right to Access
  static async exportUserData(userId) {
    const data = await collectAllUserData(userId);
    return {
      profile: data.profile,
      experiences: data.experiences,
      chat_history: data.chats,
      audit_logs: data.logs,
      exported_at: new Date().toISOString()
    };
  }
  
  // Right to Erasure
  static async deleteUserData(userId) {
    // Soft delete with retention for legal requirements
    await User.update(userId, {
      status: 'deleted',
      deleted_at: new Date(),
      data_erased: true
    });
    
    // Schedule permanent deletion after retention period
    await scheduleDataPurge(userId, RETENTION_PERIOD);
  }
  
  // Consent Management
  static async updateConsent(userId, consents) {
    await UserConsent.update(userId, {
      marketing: consents.marketing,
      analytics: consents.analytics,
      third_party: consents.thirdParty,
      updated_at: new Date()
    });
  }
}
```

### HIPAA Compliance

```javascript
class HIPAACompliance {
  // Encryption at rest
  static encryptPHI(data) {
    return encrypt(data, process.env.PHI_ENCRYPTION_KEY);
  }
  
  // Access controls
  static async accessPHI(userId, patientId) {
    // Verify authorization
    const authorized = await checkPHIAuthorization(userId, patientId);
    if (!authorized) {
      throw new Error('Unauthorized PHI access');
    }
    
    // Log access
    await PHIAuditLog.create({
      user_id: userId,
      patient_id: patientId,
      action: 'access',
      timestamp: new Date()
    });
    
    // Return encrypted data
    return await getPHIData(patientId);
  }
}
```

## Security Checklist

### Development

- [ ] Use HTTPS everywhere
- [ ] Implement client-side password hashing
- [ ] Validate all inputs
- [ ] Sanitize all outputs
- [ ] Use parameterized queries
- [ ] Implement CSRF protection
- [ ] Set security headers
- [ ] Handle errors securely
- [ ] Log security events
- [ ] Regular dependency updates

### Deployment

- [ ] Secure environment variables
- [ ] Configure firewall rules
- [ ] Enable rate limiting
- [ ] Set up monitoring
- [ ] Configure backup strategy
- [ ] Implement DDoS protection
- [ ] Regular security scanning
- [ ] Penetration testing
- [ ] Security training
- [ ] Incident response plan

### Operations

- [ ] Regular security audits
- [ ] Monitor suspicious activity
- [ ] Review access logs
- [ ] Update dependencies
- [ ] Rotate secrets regularly
- [ ] Test backup restoration
- [ ] Conduct security drills
- [ ] Update documentation
- [ ] Security awareness training
- [ ] Compliance verification

## Related Documentation

- [Authentication Flow](./authentication-flow.md)
- [Role Permissions](./role-permissions.md)
- [API Reference](./openapi.yaml)
- [Error Codes](./error-codes.md)
- [Rate Limiting](./rate-limiting.md)