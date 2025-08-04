# Configuration Guide

This guide covers all configuration options for Pathfinder, including environment variables, feature flags, and system settings.

## Environment Variables

### Global Configuration (.env)

```env
# Application Environment
NODE_ENV=development|production|test
LOG_LEVEL=debug|info|warn|error

# Application Metadata
APP_NAME=Pathfinder
APP_VERSION=1.0.0
```

### Backend Configuration (backend/.env)

#### Server Configuration
```env
# API Server
API_PORT=3000
API_HOST=0.0.0.0
API_BASE_PATH=/api

# MCP Server
MCP_SERVER_PORT=3001
MCP_SERVER_ENABLED=true

# CORS
CORS_ORIGIN=http://localhost:5173
CORS_CREDENTIALS=true
```

#### Database Configuration
```env
# Oracle Database Connection
DB_USER=your_username
DB_PASSWORD=your_password
DB_CONNECTION_STRING=(DESCRIPTION=(ADDRESS=(PROTOCOL=TCP)(HOST=your-host)(PORT=1521))(CONNECT_DATA=(SERVICE_NAME=your-service)))

# Connection Pool
DB_POOL_MIN=2
DB_POOL_MAX=10
DB_POOL_INCREMENT=1
DB_POOL_TIMEOUT=60
DB_POOL_PINGINTERVAL=60

# Oracle Instant Client (if needed)
ORACLE_INSTANT_CLIENT_PATH=/opt/oracle/instantclient
```

#### Security Configuration
```env
# JWT Authentication
JWT_SECRET=your-super-secret-key-minimum-32-characters
JWT_EXPIRES_IN=15m
JWT_ALGORITHM=HS256

# Refresh Tokens
REFRESH_TOKEN_SECRET=another-super-secret-key-minimum-32-characters
REFRESH_TOKEN_EXPIRES_IN=7d

# Session Management
SESSION_SECRET=session-secret-key-minimum-32-characters
SESSION_MAX_AGE=86400000
SESSION_SECURE=true
SESSION_HTTPONLY=true
SESSION_SAMESITE=strict

# Encryption
ENABLE_FIELD_ENCRYPTION=true
ENCRYPTION_KEY=base64-encoded-32-byte-key
ENCRYPTION_ALGORITHM=aes-256-gcm
```

#### API Keys and External Services
```env
# OpenAI
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4
OPENAI_MAX_TOKENS=2000
OPENAI_TEMPERATURE=0.7

# Email Service (SendGrid/AWS SES)
EMAIL_SERVICE=sendgrid
EMAIL_API_KEY=your-api-key
EMAIL_FROM=noreply@pathfinder.app
EMAIL_FROM_NAME=Pathfinder

# Storage (S3/Oracle Object Storage)
STORAGE_TYPE=s3
STORAGE_BUCKET=pathfinder-uploads
STORAGE_REGION=us-east-1
STORAGE_ACCESS_KEY=your-access-key
STORAGE_SECRET_KEY=your-secret-key
```

#### Feature Flags
```env
# Feature Toggles
FEATURE_CHAT_ENABLED=true
FEATURE_ANALYTICS_ENABLED=true
FEATURE_RESUME_BUILDER_ENABLED=true
FEATURE_CPA_PERT_ENABLED=true
FEATURE_NETWORKING_ENABLED=true
FEATURE_JOB_SEARCH_ENABLED=true
FEATURE_LEARNING_ENABLED=true

# Beta Features
BETA_FEATURES_ENABLED=false
BETA_USER_LIST=user1,user2,user3
```

#### Performance and Monitoring
```env
# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_SKIP_SUCCESSFUL_REQUESTS=false

# Monitoring
ENABLE_METRICS=true
METRICS_PORT=9090
ENABLE_TRACING=false
TRACING_ENDPOINT=http://localhost:14268/api/traces

# Cache
CACHE_TYPE=memory
CACHE_TTL=3600
REDIS_URL=redis://localhost:6379
```

### Frontend Configuration (frontend/.env)

```env
# API Configuration
VITE_API_URL=http://localhost:3000/api
VITE_API_TIMEOUT=30000

# WebSocket Configuration
VITE_WS_URL=ws://localhost:3000
VITE_WS_RECONNECT_INTERVAL=5000

# Feature Flags
VITE_ENABLE_ANALYTICS=true
VITE_ENABLE_CHAT=true
VITE_ENABLE_DEBUG=false

# UI Configuration
VITE_APP_NAME=Pathfinder
VITE_APP_LOGO_URL=/logo.png
VITE_DEFAULT_THEME=light

# External Services
VITE_GA_TRACKING_ID=UA-XXXXXXXXX-X
VITE_SENTRY_DSN=https://xxx@sentry.io/xxx
```

## Configuration Files

### TypeScript Configuration (tsconfig.json)

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "lib": ["ES2020", "DOM"],
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleResolution": "node",
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  }
}
```

### ESLint Configuration (.eslintrc.json)

```json
{
  "extends": [
    "eslint:recommended",
    "plugin:react/recommended",
    "plugin:@typescript-eslint/recommended",
    "prettier"
  ],
  "rules": {
    "no-console": "warn",
    "no-unused-vars": "error",
    "prefer-const": "error"
  }
}
```

### Prettier Configuration (.prettierrc)

```json
{
  "semi": false,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 80,
  "arrowParens": "avoid"
}
```

## Docker Configuration

### Docker Compose Environment

```yaml
# docker-compose.yml environment section
environment:
  - NODE_ENV=${NODE_ENV:-development}
  - API_PORT=${API_PORT:-3000}
  - DB_USER=${DB_USER}
  - DB_PASSWORD=${DB_PASSWORD}
  - JWT_SECRET=${JWT_SECRET}
```

### Dockerfile Build Args

```dockerfile
# Build arguments
ARG NODE_VERSION=18
ARG APP_VERSION=1.0.0
```

## Security Configuration

### Content Security Policy

```javascript
// Helmet CSP configuration
contentSecurityPolicy: {
  directives: {
    defaultSrc: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    scriptSrc: ["'self'"],
    imgSrc: ["'self'", "data:", "https:"],
    connectSrc: ["'self'", "https://api.openai.com"]
  }
}
```

### CORS Configuration

```javascript
// CORS options
cors({
  origin: process.env.CORS_ORIGIN,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['X-Total-Count']
})
```

## Database Configuration

### Connection Pool Settings

```javascript
const poolConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  connectString: process.env.DB_CONNECTION_STRING,
  poolMin: parseInt(process.env.DB_POOL_MIN) || 2,
  poolMax: parseInt(process.env.DB_POOL_MAX) || 10,
  poolIncrement: parseInt(process.env.DB_POOL_INCREMENT) || 1,
  poolTimeout: parseInt(process.env.DB_POOL_TIMEOUT) || 60,
  poolPingInterval: parseInt(process.env.DB_POOL_PINGINTERVAL) || 60
}
```

## Logging Configuration

### Log Levels

```javascript
// Winston logger configuration
const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  verbose: 4,
  debug: 5,
  silly: 6
}
```

### Log Format

```javascript
// Log format configuration
format: winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
)
```

## Performance Tuning

### Node.js Options

```bash
# Increase memory limit
NODE_OPTIONS="--max-old-space-size=4096"

# Enable source maps
NODE_OPTIONS="--enable-source-maps"
```

### PM2 Configuration

```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'pathfinder-api',
    script: './backend/src/api/server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production'
    }
  }]
}
```

## Environment-Specific Settings

### Development
```env
NODE_ENV=development
LOG_LEVEL=debug
JWT_EXPIRES_IN=1h
RATE_LIMIT_MAX_REQUESTS=1000
```

### Staging
```env
NODE_ENV=staging
LOG_LEVEL=info
JWT_EXPIRES_IN=30m
RATE_LIMIT_MAX_REQUESTS=500
```

### Production
```env
NODE_ENV=production
LOG_LEVEL=warn
JWT_EXPIRES_IN=15m
RATE_LIMIT_MAX_REQUESTS=100
```

## Configuration Best Practices

1. **Never commit secrets**
   - Use `.env.example` for templates
   - Add `.env` to `.gitignore`
   - Use environment-specific files

2. **Use strong secrets**
   ```bash
   # Generate secure secrets
   openssl rand -base64 32
   ```

3. **Validate configuration**
   ```javascript
   // config/index.js
   const requiredEnvVars = [
     'DB_USER',
     'DB_PASSWORD',
     'JWT_SECRET'
   ]
   
   requiredEnvVars.forEach(varName => {
     if (!process.env[varName]) {
       throw new Error(`Missing required env var: ${varName}`)
     }
   })
   ```

4. **Use defaults wisely**
   ```javascript
   const port = process.env.API_PORT || 3000
   const logLevel = process.env.LOG_LEVEL || 'info'
   ```

5. **Document all options**
   - Maintain `.env.example`
   - Include descriptions
   - Specify value formats

## Troubleshooting Configuration

### Common Issues

1. **Missing environment variables**
   - Check `.env` file exists
   - Verify variable names
   - Restart application

2. **Invalid values**
   - Check data types
   - Verify formats
   - Review constraints

3. **Permission errors**
   - Check file permissions
   - Verify user access
   - Review security settings

### Configuration Validation

```bash
# Validate configuration
npm run config:validate

# Show effective configuration
npm run config:show
```