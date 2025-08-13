# Environment Configuration Guide

## Overview

This document describes the environment configuration for the Pathfinder system, including both development and production environments.

## Environment Files

The system uses environment files to manage configuration across different deployment environments.

### File Structure

```
pathfinder/
├── .env.example          # Template with all required variables
├── .env.development      # Development environment (local)
├── .env.production       # Production environment
└── .env.test            # Testing environment
```

**Important:** Never commit actual `.env` files to version control. Only `.env.example` should be in the repository.

## Core Configuration Variables

### System Configuration

```bash
# Application
NODE_ENV=production                    # Environment: development, production, test
APP_NAME=Pathfinder
APP_VERSION=1.0.0
LOG_LEVEL=info                         # debug, info, warn, error

# Server Configuration
PORT=3000                              # Backend API port
FRONTEND_PORT=3001                     # Frontend dev server port
PRODUCTION_HOST=https://api.example.com # Production API host (no /api suffix)
```

### Site Admin Provisioning

```bash
# Initial Site Admin Configuration
SITE_ADMIN_USERNAME=siteadmin         # Username for initial site admin
SITE_ADMIN_PROVISION_TOKEN=           # System token for provisioning (auto-generated)
ENABLE_SITE_ADMIN_PROVISIONING=true   # Enable provisioning endpoint
```

**Note:** On first deployment, the system will:
1. Check if site admin exists
2. Generate a complex temporary password
3. Display credentials in console (one-time only)
4. Require password change on first login

### Database Configuration

```bash
# Oracle Database Configuration
ORACLE_USER=pathfinder_app
ORACLE_PASSWORD=secure_password_here
ORACLE_CONNECTION_STRING=//hostname:1521/servicename
ORACLE_INSTANT_CLIENT_PATH=/opt/oracle/instantclient

# Database Options
DB_POOL_MIN=2
DB_POOL_MAX=10
DB_POOL_INCREMENT=1
DB_STATEMENT_CACHE_SIZE=20
DB_TIMEOUT=60000

# Schema Configuration
DB_SCHEMA_PREFIX=pf_                  # Table prefix for shared databases
DB_USER_SCHEMA_PREFIX=user_           # Prefix for user-specific schemas
```

### Authentication & Security

```bash
# JWT Configuration
JWT_SECRET=                           # 64-character hex string (required)
JWT_EXPIRES_IN=15m                    # Token expiration time
JWT_REFRESH_EXPIRES_IN=7d             # Refresh token expiration
JWT_ALGORITHM=HS256

# Encryption
ENABLE_FIELD_ENCRYPTION=true          # Enable field-level encryption
ENCRYPTION_ALGORITHM=aes-256-gcm
ENCRYPTION_KEY_ROTATION_DAYS=90

# Password Policy
PASSWORD_MIN_LENGTH=8
PASSWORD_REQUIRE_UPPERCASE=true
PASSWORD_REQUIRE_LOWERCASE=true
PASSWORD_REQUIRE_NUMBERS=true
PASSWORD_REQUIRE_SPECIAL=true
PASSWORD_HISTORY_COUNT=5              # Number of previous passwords to check

# Multi-Factor Authentication
MFA_ISSUER=Pathfinder
MFA_WINDOW=1                          # Time window for TOTP codes
REQUIRE_MFA_SITE_ADMIN=true          # Mandatory MFA for site admins
REQUIRE_MFA_ADMIN=false              # MFA for admins
```

### API Configuration

```bash
# API Settings
API_PREFIX=/api
API_VERSION=v1
ENABLE_API_DOCS=true                  # Enable Swagger/OpenAPI docs
API_DOCS_PATH=/api-docs

# Rate Limiting
RATE_LIMIT_ENABLED=true
RATE_LIMIT_WINDOW_MS=900000          # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100          # Per window
RATE_LIMIT_MAX_REQUESTS_AUTH=1000    # For authenticated users

# CORS
CORS_ENABLED=true
CORS_ORIGIN=http://localhost:3001,https://app.example.com
CORS_CREDENTIALS=true
```

### Session Management

```bash
# Session Configuration
SESSION_SECRET=                      # Different from JWT_SECRET
SESSION_DURATION=1800000             # 30 minutes in milliseconds
SESSION_EXTEND_ON_ACTIVITY=true
SESSION_MAX_AGE=86400000            # 24 hours maximum
SESSION_CLEANUP_INTERVAL=3600000    # Cleanup every hour
```

### Redis Configuration (For Rate Limiting & Sessions)

```bash
# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
REDIS_KEY_PREFIX=pathfinder:
REDIS_ENABLE_TLS=false
```

### Email Configuration

```bash
# Email Service
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false                   # true for 465, false for other ports
SMTP_USER=
SMTP_PASSWORD=
EMAIL_FROM=noreply@pathfinder.ai
EMAIL_FROM_NAME=Pathfinder

# Email Templates
EMAIL_WELCOME_ENABLED=true
EMAIL_VERIFICATION_ENABLED=true
EMAIL_PASSWORD_RESET_ENABLED=true
```

### Storage Configuration

```bash
# File Storage
STORAGE_TYPE=local                  # local, s3, azure
STORAGE_LOCAL_PATH=./uploads
STORAGE_MAX_FILE_SIZE=5242880      # 5MB in bytes

# S3 Configuration (if STORAGE_TYPE=s3)
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_S3_BUCKET=pathfinder-uploads
AWS_S3_REGION=us-east-1
```

### MCP Server Configuration

```bash
# Model Context Protocol
MCP_SERVER_ENABLED=true
MCP_SERVER_PORT=3002
MCP_SERVER_HOST=localhost
MCP_AUTH_REQUIRED=true
MCP_MAX_CONTEXT_SIZE=32000
```

### Monitoring & Logging

```bash
# Monitoring
ENABLE_MONITORING=true
MONITORING_ENDPOINT=/metrics
ENABLE_HEALTH_CHECK=true
HEALTH_CHECK_ENDPOINT=/health

# OpenTelemetry
OTEL_ENABLED=false
OTEL_SERVICE_NAME=pathfinder
OTEL_EXPORTER_ENDPOINT=http://localhost:4318
OTEL_TRACES_ENABLED=true
OTEL_METRICS_ENABLED=true

# Audit Logging
AUDIT_LOG_ENABLED=true
AUDIT_LOG_RETENTION_DAYS=2555      # 7 years for compliance
AUDIT_LOG_SENSITIVE_ACTIONS=true   # Log sensitive operations
```

### Feature Flags

```bash
# Feature Toggles
FEATURE_CPA_PERT=true
FEATURE_CAREER_CHAT=true
FEATURE_JOB_SEARCH=true
FEATURE_LEARNING_PATHS=true
FEATURE_NETWORKING=true
FEATURE_RESUME_BUILDER=true

# Beta Features
ENABLE_BETA_FEATURES=false
BETA_USER_PERCENTAGE=10            # Percentage of users with beta access
```

## Environment-Specific Settings

### Development Environment

```bash
# .env.development
NODE_ENV=development
LOG_LEVEL=debug
ENABLE_API_DOCS=true
CORS_ORIGIN=http://localhost:3001
RATE_LIMIT_ENABLED=false
ENABLE_SITE_ADMIN_PROVISIONING=true
```

### Production Environment

```bash
# .env.production
NODE_ENV=production
LOG_LEVEL=warn
ENABLE_API_DOCS=false
CORS_ORIGIN=https://app.pathfinder.ai
RATE_LIMIT_ENABLED=true
ENABLE_SITE_ADMIN_PROVISIONING=false  # Disable after initial setup
ENABLE_FIELD_ENCRYPTION=true
REQUIRE_MFA_SITE_ADMIN=true
```

### Test Environment

```bash
# .env.test
NODE_ENV=test
LOG_LEVEL=error
ENABLE_API_DOCS=false
RATE_LIMIT_ENABLED=false
DB_SCHEMA_PREFIX=test_pf_
SESSION_DURATION=60000              # Shorter for testing
```

## Deployment Process

### Initial Deployment

1. **Copy environment template:**
   ```bash
   cp .env.example .env.production
   ```

2. **Generate secure secrets:**
   ```bash
   # Generate JWT secret
   openssl rand -hex 32
   
   # Generate session secret
   openssl rand -hex 32
   
   # Generate provisioning token
   openssl rand -hex 16
   ```

3. **Configure production values:**
   - Set `PRODUCTION_HOST` to your domain
   - Configure database connection
   - Set up email service
   - Configure storage

4. **Deploy application:**
   ```bash
   npm run deploy:production
   ```

5. **Provision site admin:**
   - System will display credentials on first run
   - Save credentials immediately
   - Login and change password

6. **Secure the deployment:**
   - Set `ENABLE_SITE_ADMIN_PROVISIONING=false`
   - Restart application

### Docker Deployment

```yaml
# docker-compose.yml excerpt
services:
  backend:
    env_file:
      - .env.production
    environment:
      - NODE_ENV=production
      - PRODUCTION_HOST=${PRODUCTION_HOST}
```

### Kubernetes Deployment

```yaml
# ConfigMap for non-sensitive values
apiVersion: v1
kind: ConfigMap
metadata:
  name: pathfinder-config
data:
  NODE_ENV: "production"
  API_PREFIX: "/api"
  ENABLE_MONITORING: "true"

---
# Secret for sensitive values
apiVersion: v1
kind: Secret
metadata:
  name: pathfinder-secrets
type: Opaque
stringData:
  JWT_SECRET: "your-jwt-secret"
  DB_PASSWORD: "your-db-password"
```

## Security Best Practices

### Secret Management

1. **Never commit secrets to version control**
2. **Use environment variables for all secrets**
3. **Rotate secrets regularly:**
   - JWT secrets: Every 90 days
   - Database passwords: Every 60 days
   - API keys: Every 180 days

4. **Use secret management tools in production:**
   - AWS Secrets Manager
   - Azure Key Vault
   - HashiCorp Vault
   - Kubernetes Secrets

### Environment Isolation

1. **Separate databases for each environment**
2. **Different secret values per environment**
3. **Isolated Redis instances**
4. **Environment-specific API keys**

### Access Control

1. **Limit who can access production environment files**
2. **Use CI/CD for deployments (no manual access)**
3. **Audit access to environment configurations**
4. **Encrypt environment files at rest**

## Validation

### Required Variables Checker

```javascript
// scripts/validate-env.js
const required = [
  'NODE_ENV',
  'JWT_SECRET',
  'ORACLE_USER',
  'ORACLE_PASSWORD',
  'ORACLE_CONNECTION_STRING',
  'SITE_ADMIN_USERNAME'
];

const missing = required.filter(key => !process.env[key]);

if (missing.length > 0) {
  console.error('Missing required environment variables:', missing);
  process.exit(1);
}
```

### Pre-deployment Checklist

- [ ] All required variables are set
- [ ] Secrets are properly generated (not default values)
- [ ] Database connection is tested
- [ ] Redis connection is verified
- [ ] Email service is configured
- [ ] CORS origins are correctly set
- [ ] Production host is configured
- [ ] SSL/TLS is enabled
- [ ] Rate limiting is enabled
- [ ] Monitoring is configured

## Troubleshooting

### Common Issues

1. **"JWT_SECRET is required"**
   - Generate a secure secret: `openssl rand -hex 32`

2. **"Cannot connect to database"**
   - Verify ORACLE_CONNECTION_STRING format
   - Check network connectivity
   - Ensure Oracle Instant Client is installed

3. **"Site admin already exists"**
   - Set `ENABLE_SITE_ADMIN_PROVISIONING=false`
   - Use existing credentials or reset via database

4. **"CORS error in production"**
   - Add production domain to CORS_ORIGIN
   - Ensure protocol (http/https) matches

5. **"Rate limit exceeded"**
   - Adjust RATE_LIMIT_MAX_REQUESTS
   - Check Redis connection
   - Verify rate limit key expiration