# API Error Codes Reference

## Overview

This document provides a comprehensive reference for all error codes returned by the Pathfinder API. Each error includes its HTTP status code, error code, description, and resolution steps.

## Error Response Format

All API errors follow this standard format:

```json
{
  "success": false,
  "error": "ERROR_CODE",
  "message": "Human-readable error description",
  "details": {
    // Additional context (optional)
  }
}
```

## Error Categories

### Authentication Errors (401)

| Error Code | Message | Description | Resolution |
|------------|---------|-------------|------------|
| `AUTHENTICATION_FAILED` | Invalid credentials | Username or password incorrect | Verify credentials are correct |
| `TOKEN_EXPIRED` | Token has expired | JWT access token expired | Refresh token or re-authenticate |
| `TOKEN_INVALID` | Invalid token format | Malformed or corrupted token | Re-authenticate to get new token |
| `TOKEN_MISSING` | No token provided | Authorization header missing | Include Bearer token in request |
| `REFRESH_TOKEN_INVALID` | Invalid refresh token | Refresh token expired or invalid | Re-authenticate with credentials |
| `SESSION_EXPIRED` | Session has expired | User session no longer valid | Login again to create new session |
| `MFA_REQUIRED` | Multi-factor authentication required | Account requires MFA token | Provide TOTP code with request |
| `MFA_INVALID` | Invalid MFA token | TOTP code incorrect or expired | Check authenticator app for current code |

### Authorization Errors (403)

| Error Code | Message | Description | Resolution |
|------------|---------|-------------|------------|
| `INSUFFICIENT_PRIVILEGES` | Insufficient privileges for this operation | User lacks required role | Contact admin for role assignment |
| `FORBIDDEN` | Access forbidden | Resource access denied | Check if you have permission |
| `ACCOUNT_SUSPENDED` | Account has been suspended | User account suspended | Contact administrator |
| `ACCOUNT_LOCKED` | Account locked due to failed attempts | Too many login failures | Wait or contact support |
| `IP_RESTRICTED` | Access denied from this IP | IP address not whitelisted | Use approved network or VPN |
| `APPROVAL_REQUIRED` | Operation requires approval | Admin approval needed | Submit request for approval |
| `ROLE_REQUIRED` | Specific role required | Missing admin or site_admin role | Request role from site_admin |

### Validation Errors (400)

| Error Code | Message | Description | Resolution |
|------------|---------|-------------|------------|
| `VALIDATION_ERROR` | Input validation failed | One or more fields invalid | Check field requirements |
| `MISSING_FIELDS` | Required fields missing | Mandatory fields not provided | Include all required fields |
| `INVALID_FORMAT` | Invalid field format | Field doesn't match expected format | Follow format requirements |
| `INVALID_EMAIL` | Invalid email format | Email address malformed | Use valid email format |
| `INVALID_DATE` | Invalid date format | Date not in ISO 8601 format | Use YYYY-MM-DD format |
| `INVALID_ENUM` | Invalid enum value | Value not in allowed list | Use one of allowed values |
| `STRING_TOO_SHORT` | String below minimum length | Input too short | Meet minimum length requirement |
| `STRING_TOO_LONG` | String exceeds maximum length | Input too long | Reduce to maximum length |
| `NUMBER_OUT_OF_RANGE` | Number outside valid range | Value too high or low | Use value within range |
| `INVALID_JSON` | Invalid JSON format | Request body not valid JSON | Fix JSON syntax errors |
| `INVALID_PASSWORD_HASH` | Password not hashed correctly | Plain text password detected | Hash password client-side |
| `WEAK_PASSWORD` | Password doesn't meet requirements | Password too weak | Use stronger password |

### Resource Errors (404)

| Error Code | Message | Description | Resolution |
|------------|---------|-------------|------------|
| `NOT_FOUND` | Resource not found | Requested resource doesn't exist | Verify resource ID is correct |
| `USER_NOT_FOUND` | User does not exist | User ID or username not found | Check user identifier |
| `EXPERIENCE_NOT_FOUND` | Experience not found | Experience ID doesn't exist | Verify experience ID |
| `RESUME_NOT_FOUND` | Resume not found | Resume ID doesn't exist | Check resume ID |
| `ENDPOINT_NOT_FOUND` | Endpoint does not exist | API endpoint not recognized | Check API documentation |

### Conflict Errors (409)

| Error Code | Message | Description | Resolution |
|------------|---------|-------------|------------|
| `CONFLICT` | Resource conflict | Operation conflicts with existing data | Resolve conflict first |
| `DUPLICATE_USERNAME` | Username already exists | Username taken by another user | Choose different username |
| `DUPLICATE_EMAIL` | Email already registered | Email associated with account | Use different email or login |
| `DUPLICATE_ENTRY` | Duplicate entry | Record already exists | Update existing instead |
| `VERSION_CONFLICT` | Version mismatch | Resource modified by another user | Refresh and retry |
| `STATE_CONFLICT` | Invalid state transition | Operation not allowed in current state | Check resource state |

### Rate Limiting Errors (429)

| Error Code | Message | Description | Resolution |
|------------|---------|-------------|------------|
| `RATE_LIMIT_EXCEEDED` | Too many requests | Rate limit exceeded | Wait before retrying |
| `DAILY_LIMIT_EXCEEDED` | Daily limit reached | Daily API quota exhausted | Wait until tomorrow |
| `CONCURRENT_LIMIT_EXCEEDED` | Too many concurrent requests | Parallel request limit hit | Reduce concurrent calls |

### Server Errors (500)

| Error Code | Message | Description | Resolution |
|------------|---------|-------------|------------|
| `INTERNAL_ERROR` | Internal server error | Unexpected server error | Report to support |
| `DATABASE_ERROR` | Database operation failed | Database connection or query failed | Retry later |
| `SERVICE_UNAVAILABLE` | Service temporarily unavailable | System maintenance or overload | Try again later |
| `DEPENDENCY_ERROR` | External service error | Third-party service failure | Wait and retry |
| `CONFIGURATION_ERROR` | System misconfiguration | Server configuration issue | Contact support |

### Business Logic Errors (422)

| Error Code | Message | Description | Resolution |
|------------|---------|-------------|------------|
| `INVALID_OPERATION` | Operation not allowed | Business rule violation | Check operation requirements |
| `INSUFFICIENT_BALANCE` | Insufficient credits | Not enough credits for operation | Purchase more credits |
| `LIMIT_EXCEEDED` | Limit exceeded | Resource limit reached | Upgrade plan or delete items |
| `EXPIRED` | Resource has expired | Time-sensitive resource expired | Create new resource |
| `NOT_ELIGIBLE` | Not eligible for operation | Requirements not met | Meet eligibility criteria |
| `ALREADY_PROCESSED` | Already processed | Operation already completed | No action needed |

## Error Response Examples

### Validation Error with Field Details

```json
{
  "success": false,
  "error": "VALIDATION_ERROR",
  "message": "Validation failed",
  "details": {
    "errors": [
      {
        "field": "email",
        "message": "Invalid email format",
        "code": "INVALID_FORMAT"
      },
      {
        "field": "username",
        "message": "Username must be at least 3 characters",
        "code": "STRING_TOO_SHORT"
      }
    ]
  }
}
```

### Rate Limit Error with Headers

```http
HTTP/1.1 429 Too Many Requests
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 2024-03-01T12:30:00Z

{
  "success": false,
  "error": "RATE_LIMIT_EXCEEDED",
  "message": "Too many requests, please try again later",
  "details": {
    "retry_after": 900,
    "limit": 100,
    "window": "15m"
  }
}
```

### Authentication Error

```json
{
  "success": false,
  "error": "TOKEN_EXPIRED",
  "message": "Your session has expired",
  "details": {
    "expired_at": "2024-03-01T11:30:00Z",
    "refresh_available": true
  }
}
```

## Error Handling Best Practices

### Client-Side Implementation

```javascript
class APIErrorHandler {
  static async handleError(error) {
    const errorCode = error.response?.data?.error;
    const statusCode = error.response?.status;
    
    // Log error for debugging
    console.error(`API Error [${statusCode}]: ${errorCode}`, error);
    
    switch (statusCode) {
      case 401:
        return this.handleAuthenticationError(errorCode, error);
      case 403:
        return this.handleAuthorizationError(errorCode, error);
      case 400:
        return this.handleValidationError(errorCode, error);
      case 429:
        return this.handleRateLimitError(errorCode, error);
      case 404:
        return this.handleNotFoundError(errorCode, error);
      case 500:
        return this.handleServerError(errorCode, error);
      default:
        return this.handleGenericError(error);
    }
  }
  
  static handleAuthenticationError(code, error) {
    switch (code) {
      case 'TOKEN_EXPIRED':
        // Attempt token refresh
        return this.refreshToken();
      
      case 'AUTHENTICATION_FAILED':
        // Redirect to login
        window.location.href = '/login';
        break;
      
      case 'MFA_REQUIRED':
        // Show MFA input
        return this.promptForMFA();
      
      default:
        // Clear auth and redirect
        this.clearAuthentication();
        window.location.href = '/login';
    }
  }
  
  static handleValidationError(code, error) {
    const errors = error.response?.data?.details?.errors || [];
    
    // Display field-specific errors
    errors.forEach(fieldError => {
      this.displayFieldError(fieldError.field, fieldError.message);
    });
    
    // Show general notification
    this.showNotification('Please correct the errors and try again', 'error');
  }
  
  static handleRateLimitError(code, error) {
    const retryAfter = error.response?.headers['x-ratelimit-reset'];
    const waitTime = new Date(retryAfter) - new Date();
    
    this.showNotification(
      `Rate limit exceeded. Please wait ${Math.ceil(waitTime / 1000)} seconds`,
      'warning'
    );
    
    // Implement exponential backoff
    return this.retryWithBackoff(error.config, waitTime);
  }
}
```

### Retry Logic

```javascript
class RetryHandler {
  static async retryWithExponentialBackoff(
    requestFn,
    maxRetries = 3,
    baseDelay = 1000
  ) {
    let lastError;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await requestFn();
      } catch (error) {
        lastError = error;
        
        // Don't retry on client errors (4xx) except 429
        if (error.response?.status >= 400 && 
            error.response?.status < 500 && 
            error.response?.status !== 429) {
          throw error;
        }
        
        // Calculate delay with jitter
        const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
        
        console.log(`Retry attempt ${attempt + 1} after ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError;
  }
}
```

## Monitoring Error Rates

### Error Tracking

```javascript
class ErrorMonitor {
  static errors = new Map();
  
  static track(errorCode, context = {}) {
    const key = `${errorCode}:${new Date().getHours()}`;
    
    if (!this.errors.has(key)) {
      this.errors.set(key, {
        code: errorCode,
        count: 0,
        firstSeen: new Date(),
        contexts: []
      });
    }
    
    const errorEntry = this.errors.get(key);
    errorEntry.count++;
    errorEntry.lastSeen = new Date();
    errorEntry.contexts.push(context);
    
    // Alert on high error rates
    if (errorEntry.count > 10) {
      this.alertHighErrorRate(errorCode, errorEntry);
    }
  }
  
  static getErrorStats() {
    const stats = {};
    
    this.errors.forEach((value, key) => {
      const [code] = key.split(':');
      if (!stats[code]) {
        stats[code] = {
          total: 0,
          hourly: []
        };
      }
      stats[code].total += value.count;
      stats[code].hourly.push({
        hour: key.split(':')[1],
        count: value.count
      });
    });
    
    return stats;
  }
}
```

## Troubleshooting Common Errors

### AUTHENTICATION_FAILED

**Symptoms:**
- Cannot login despite correct credentials
- Consistent 401 errors

**Possible Causes:**
1. Password not hashed client-side
2. Incorrect salt generation
3. Account locked or suspended
4. Caps lock enabled

**Resolution:**
```javascript
// Ensure proper hashing
async function debugLogin(username, password) {
  console.log('Username:', username);
  console.log('Password length:', password.length);
  
  const salt = generateSalt();
  console.log('Salt:', salt);
  
  const hash = await hashPassword(password, salt);
  console.log('Hash:', hash);
  
  // Try login
  try {
    await login(username, password);
  } catch (error) {
    console.error('Login error:', error.response?.data);
  }
}
```

### RATE_LIMIT_EXCEEDED

**Symptoms:**
- Frequent 429 errors
- Requests blocked

**Possible Causes:**
1. Too many requests in short time
2. Retry logic too aggressive
3. Multiple clients using same credentials

**Resolution:**
- Implement request queuing
- Add delays between requests
- Use exponential backoff
- Check for request loops

### VALIDATION_ERROR

**Symptoms:**
- Form submissions failing
- 400 errors with field details

**Possible Causes:**
1. Missing required fields
2. Invalid data formats
3. Fields exceeding length limits

**Resolution:**
- Validate client-side before submission
- Check API documentation for requirements
- Log request payload for debugging

## Error Code Changes

### Deprecated Error Codes

| Old Code | New Code | Deprecated | Removed |
|----------|----------|------------|---------|
| `INVALID_CREDENTIALS` | `AUTHENTICATION_FAILED` | 2024-01-01 | 2024-06-01 |
| `UNAUTHORIZED` | `INSUFFICIENT_PRIVILEGES` | 2024-02-01 | 2024-07-01 |

### New Error Codes (Added 2024)

- `MFA_REQUIRED` - Multi-factor authentication support
- `APPROVAL_REQUIRED` - Approval workflow system
- `DAILY_LIMIT_EXCEEDED` - Daily quota management

## Related Documentation

- [API Reference](./openapi.yaml)
- [Authentication Flow](./authentication-flow.md)
- [Rate Limiting](./rate-limiting.md)
- [Security Best Practices](./security-best-practices.md)