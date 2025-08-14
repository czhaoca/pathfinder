---
name: Documentation
about: Complete API documentation overhaul
title: 'docs: [API] Complete documentation overhaul for v2 API'
labels: documentation, api, priority:high
assignees: ''

---

## 📋 Description
Complete overhaul of API documentation to reflect all changes from the new authentication system, RBAC implementation, and security enhancements. Create comprehensive, interactive API documentation with examples, migration guides, and best practices.

## 🎯 Acceptance Criteria
- [ ] OpenAPI 3.0 specification for entire v2 API
- [ ] Interactive API documentation (Swagger/Redoc)
- [ ] Complete migration guide from v1 to v2
- [ ] Authentication flow documentation with diagrams
- [ ] Role permission matrix documentation
- [ ] Security best practices guide
- [ ] Client implementation examples (JavaScript, Python, cURL)
- [ ] Error code reference with descriptions
- [ ] Rate limiting documentation
- [ ] Webhook documentation for events
- [ ] Postman collection with examples
- [ ] API changelog and versioning policy

## 📚 Documentation Structure

### OpenAPI Specification
```yaml
# /docs/api/openapi.v2.yaml
openapi: 3.0.3
info:
  title: Pathfinder API v2
  description: |
    Comprehensive career navigation and experience management API.
    
    ## Authentication
    This API uses JWT Bearer tokens with 15-minute expiry. Tokens must be
    refreshed using the refresh endpoint before expiry.
    
    ## Rate Limiting
    All endpoints are rate limited. See headers for current limits.
    
    ## Versioning
    API v2 is the current stable version. v1 is deprecated as of 2024-03-01.
  version: 2.0.0
  contact:
    email: api@pathfinder.app
  license:
    name: Proprietary
    
servers:
  - url: https://api.pathfinder.app/v2
    description: Production
  - url: https://staging-api.pathfinder.app/v2
    description: Staging
  - url: http://localhost:3000/api/v2
    description: Development

security:
  - bearerAuth: []

tags:
  - name: Authentication
    description: Authentication and authorization endpoints
  - name: Users
    description: User management operations
  - name: Admin
    description: Administrative operations (requires admin/site_admin role)
  - name: Profile
    description: User profile and preferences

paths:
  /auth/register:
    post:
      tags:
        - Authentication
      summary: Register new user
      description: |
        Creates a new user account. Only admins and site_admins can register users.
        System generates a secure temporary password that must be retrieved using
        the one-time token returned in the response.
      security:
        - bearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required:
                - username
                - email
                - first_name
                - last_name
              properties:
                username:
                  type: string
                  pattern: '^[a-z0-9_]{3,30}$'
                  example: john_doe
                email:
                  type: string
                  format: email
                  example: john@example.com
                first_name:
                  type: string
                  example: John
                last_name:
                  type: string
                  example: Doe
                role:
                  type: string
                  enum: [user, admin]
                  default: user
                  description: Role to assign (cannot create site_admin)
      responses:
        '201':
          description: User created successfully
          content:
            application/json:
              schema:
                type: object
                properties:
                  success:
                    type: boolean
                    example: true
                  data:
                    type: object
                    properties:
                      user:
                        $ref: '#/components/schemas/User'
                      password_retrieval_token:
                        type: string
                        description: One-time token to retrieve password
                      token_expires_at:
                        type: string
                        format: date-time
                      temporary_password_expires_at:
                        type: string
                        format: date-time
        '403':
          $ref: '#/components/responses/Forbidden'
        '400':
          $ref: '#/components/responses/BadRequest'

  /auth/login:
    post:
      tags:
        - Authentication
      summary: Authenticate user
      description: |
        Authenticates user with client-hashed password. 
        Password must be hashed with SHA-256 on client before sending.
        Plain text passwords are rejected.
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required:
                - username
                - password_hash
                - client_salt
              properties:
                username:
                  type: string
                password_hash:
                  type: string
                  description: SHA-256 hash of password + client_salt
                client_salt:
                  type: string
                  description: Random salt generated by client
                mfa_token:
                  type: string
                  description: TOTP token if MFA enabled
            examples:
              standard:
                summary: Standard login
                value:
                  username: john_doe
                  password_hash: 5e884898da28047151d0e56f8dc629...
                  client_salt: a1b2c3d4e5f6...
              with_mfa:
                summary: Login with MFA
                value:
                  username: john_doe
                  password_hash: 5e884898da28047151d0e56f8dc629...
                  client_salt: a1b2c3d4e5f6...
                  mfa_token: "123456"
      responses:
        '200':
          description: Authentication successful
          content:
            application/json:
              schema:
                type: object
                properties:
                  success:
                    type: boolean
                  data:
                    type: object
                    properties:
                      user:
                        $ref: '#/components/schemas/User'
                      token:
                        type: string
                        description: JWT access token (15 min expiry)
                      refresh_token:
                        type: string
                        description: Refresh token for getting new access tokens
                      expires_at:
                        type: string
                        format: date-time
                      permissions:
                        type: array
                        items:
                          type: string

components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
      
  schemas:
    User:
      type: object
      properties:
        id:
          type: string
          format: uuid
        username:
          type: string
        email:
          type: string
          format: email
        first_name:
          type: string
        last_name:
          type: string
        roles:
          type: array
          items:
            type: string
            enum: [user, admin, site_admin]
        created_at:
          type: string
          format: date-time
        last_login:
          type: string
          format: date-time
          
    Error:
      type: object
      required:
        - success
        - error
        - message
      properties:
        success:
          type: boolean
          example: false
        error:
          type: string
          description: Error code for programmatic handling
          example: VALIDATION_ERROR
        message:
          type: string
          description: Human-readable error message
        details:
          type: object
          description: Additional error context
          
  responses:
    Forbidden:
      description: Insufficient privileges
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/Error'
          example:
            success: false
            error: FORBIDDEN
            message: Insufficient privileges for this operation
```

### Migration Guide
```markdown
# API v1 to v2 Migration Guide

## Overview
API v2 introduces significant security improvements and breaking changes.
This guide helps you migrate from v1 to v2.

## Timeline
- **2024-03-01**: v2 released, v1 deprecated
- **2024-06-01**: v1 enters maintenance mode (critical fixes only)  
- **2024-09-01**: v1 discontinued

## Breaking Changes

### 1. Authentication Changes

#### Password Handling
**v1 (Deprecated):**
```javascript
// DON'T DO THIS
fetch('/api/v1/auth/login', {
  method: 'POST',
  body: JSON.stringify({
    username: 'john_doe',
    password: 'plaintext123' // ❌ Plain text
  })
});
```

**v2 (Required):**
```javascript
// DO THIS
async function login(username, password) {
  // Hash password client-side
  const salt = generateSalt();
  const hash = await hashPassword(password + salt);
  
  const response = await fetch('/api/v2/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      username,
      password_hash: hash, // ✅ Hashed
      client_salt: salt
    })
  });
}
```

### 2. Token Expiry
- v1: Tokens valid for 24 hours
- v2: Tokens valid for 15 minutes (must refresh)

### 3. Registration Flow
Users no longer set their own passwords during registration.

**v1 Flow:**
1. Admin creates user with password
2. User logs in immediately

**v2 Flow:**
1. Admin creates user (no password)
2. System generates temporary password
3. Admin shares retrieval token with user
4. User retrieves password using token
5. User logs in and must change password

### 4. Role-Based Access
All endpoints now enforce strict RBAC:
- `user`: Can only access own data
- `admin`: Can manage users
- `site_admin`: Full system access

## Code Examples

### JavaScript/TypeScript Client
```typescript
class PathfinderClient {
  private token: string | null = null;
  private refreshToken: string | null = null;
  
  async login(username: string, password: string): Promise<void> {
    // Generate client salt
    const salt = crypto.getRandomValues(new Uint8Array(32));
    const saltHex = Array.from(salt)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    // Hash password
    const encoder = new TextEncoder();
    const data = encoder.encode(password + saltHex);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashHex = Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    const response = await fetch('/api/v2/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username,
        password_hash: hashHex,
        client_salt: saltHex
      })
    });
    
    const result = await response.json();
    this.token = result.data.token;
    this.refreshToken = result.data.refresh_token;
    
    // Set up automatic refresh
    this.scheduleTokenRefresh();
  }
  
  private scheduleTokenRefresh(): void {
    // Refresh 1 minute before expiry
    setTimeout(() => this.refreshAccessToken(), 14 * 60 * 1000);
  }
}
```

### Python Client
```python
import hashlib
import secrets
import requests
from datetime import datetime, timedelta

class PathfinderClient:
    def __init__(self, base_url="https://api.pathfinder.app/v2"):
        self.base_url = base_url
        self.token = None
        self.refresh_token = None
        
    def login(self, username: str, password: str) -> dict:
        # Generate client salt
        salt = secrets.token_hex(32)
        
        # Hash password with salt
        password_hash = hashlib.sha256(
            (password + salt).encode()
        ).hexdigest()
        
        response = requests.post(
            f"{self.base_url}/auth/login",
            json={
                "username": username,
                "password_hash": password_hash,
                "client_salt": salt
            }
        )
        
        data = response.json()
        self.token = data["data"]["token"]
        self.refresh_token = data["data"]["refresh_token"]
        
        return data["data"]["user"]
```

## Error Handling

### Error Codes
| Code | Description | Action |
|------|-------------|--------|
| `INVALID_REQUEST` | Malformed request | Check request format |
| `AUTHENTICATION_FAILED` | Invalid credentials | Check username/password |
| `TOKEN_EXPIRED` | JWT token expired | Refresh token |
| `INSUFFICIENT_PRIVILEGES` | Missing required role | Check user permissions |
| `RATE_LIMIT_EXCEEDED` | Too many requests | Wait and retry |

## Testing Your Migration

1. Update client libraries to v2
2. Test in staging environment
3. Monitor deprecation warnings in v1
4. Gradually migrate endpoints
5. Verify RBAC permissions
```

### Interactive Documentation
```html
<!-- /docs/api/index.html -->
<!DOCTYPE html>
<html>
<head>
  <title>Pathfinder API Documentation</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist/swagger-ui.css">
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist/swagger-ui-bundle.js"></script>
  <script>
    SwaggerUIBundle({
      url: "/api/v2/openapi.json",
      dom_id: '#swagger-ui',
      deepLinking: true,
      presets: [
        SwaggerUIBundle.presets.apis,
        SwaggerUIBundle.SwaggerUIStandalonePreset
      ],
      layout: "BaseLayout",
      tryItOutEnabled: true,
      requestInterceptor: (request) => {
        // Add auth token to requests
        const token = localStorage.getItem('api_token');
        if (token) {
          request.headers['Authorization'] = `Bearer ${token}`;
        }
        return request;
      }
    });
  </script>
</body>
</html>
```

## 🧪 Testing Requirements
- [ ] Validate OpenAPI spec against implementation
- [ ] Test all examples in documentation
- [ ] Verify interactive documentation works
- [ ] Test migration guide procedures
- [ ] Validate error codes and responses
- [ ] Test rate limiting as documented
- [ ] Verify all client examples work

## 📊 Success Metrics
- Documentation coverage: 100% of endpoints
- Example code for all major operations
- Zero documentation discrepancies
- Developer satisfaction score > 4.5/5
- Support ticket reduction by 50%

## 🔗 Dependencies
- Depends on: #15 (API implementation complete)
- Blocks: External API consumers

---

**Estimated Effort**: 8 story points
**Sprint**: 3 (API & Documentation)
**Target Completion**: Week 6