# Development Setup Guide

## Prerequisites

Before starting, ensure you have the following installed:

- **Node.js** (v18 or higher)
- **npm** (v9 or higher)
- **Docker** and **Docker Compose**
- **Git**
- **Oracle Instant Client** (for database connectivity)

## Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/your-org/pathfinder.git
cd pathfinder
```

### 2. Install Dependencies

The project uses npm workspaces for monorepo management:

```bash
# Install all dependencies (frontend + backend)
npm run install:all
```

### 3. Environment Configuration

Create a `.env` file in the root directory with the following configuration:

```bash
# Copy environment template
cp .env.example .env
```

**Complete .env Configuration Example:**

```bash
# Application Environment
NODE_ENV=development
APP_NAME=Pathfinder
APP_URL=http://localhost:5173

# Backend Server Configuration
API_PORT=3000
API_HOST=localhost
API_BASE_PATH=/api/v1

# Frontend Configuration
FRONTEND_PORT=5173
VITE_API_URL=http://localhost:3000/api/v1

# Database Configuration (Oracle ATP)
DATABASE_URL=oracle://ADMIN:YourSecurePassword123!@pathfinder_high?walletDirectory=/app/backend/wallets
DB_POOL_MIN=2
DB_POOL_MAX=10
DB_POOL_INCREMENT=1
ORACLE_INSTANT_CLIENT_PATH=/opt/oracle/instantclient_21_8

# For local development with Docker Oracle XE:
# DATABASE_URL=oracle://system:oracle@localhost:1521/XEPDB1

# Authentication & Security
JWT_SECRET=a4f8b3c7d9e2f1a6b5c8d7e4f3a2b1c9d8e7f6a5b4c3d2e1f9a8b7c6d5e4f3a2
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=30d
BCRYPT_ROUNDS=12

# Encryption Configuration
ENABLE_FIELD_ENCRYPTION=true
ENCRYPTION_KEY=32_char_hex_key_for_aes_encryption_here_12345678
ENCRYPTION_ALGORITHM=aes-256-gcm

# Session Configuration
SESSION_SECRET=another_64_character_secret_key_for_session_management_1234567890
SESSION_TIMEOUT=1800000 # 30 minutes in milliseconds

# Redis Configuration (for caching and sessions)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
CACHE_TTL=3600

# Email Configuration (SendGrid)
SENDGRID_API_KEY=SG.actual_sendgrid_api_key_here
EMAIL_FROM=noreply@pathfinder.ai
EMAIL_SUPPORT=support@pathfinder.ai

# MCP (Model Context Protocol) Server
MCP_SERVER_ENABLED=true
MCP_SERVER_PORT=8001
MCP_SERVER_HOST=localhost
MCP_AUTH_REQUIRED=true

# AI/LLM Configuration
OPENAI_API_KEY=sk-actual_openai_api_key_here
AI_MODEL=gpt-4-1106-preview
AI_TEMPERATURE=0.7
AI_MAX_TOKENS=2000

# File Upload Configuration
UPLOAD_MAX_SIZE=10485760 # 10MB in bytes
UPLOAD_ALLOWED_TYPES=pdf,doc,docx,txt,jpg,jpeg,png
UPLOAD_DIRECTORY=./uploads

# Rate Limiting
RATE_LIMIT_WINDOW=900000 # 15 minutes in milliseconds
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_AUTH_REQUESTS=5

# Logging Configuration
LOG_LEVEL=debug # error, warn, info, debug
LOG_FORMAT=json # json, simple
LOG_DIRECTORY=./logs
ENABLE_REQUEST_LOGGING=true

# Monitoring & Analytics
ENABLE_TELEMETRY=false
SENTRY_DSN=
NEW_RELIC_LICENSE_KEY=

# Feature Flags
FEATURE_CHAT_ENABLED=true
FEATURE_RESUME_GENERATION=true
FEATURE_JOB_SEARCH=true
FEATURE_NETWORKING=true
FEATURE_LEARNING_PATHS=true

# External API Keys (Optional)
LINKEDIN_CLIENT_ID=
LINKEDIN_CLIENT_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=

# Development Tools
ENABLE_SWAGGER=true
ENABLE_GRAPHQL_PLAYGROUND=true
ENABLE_DEBUG_TOOLBAR=true

# Testing Configuration
TEST_DATABASE_URL=oracle://TEST_ADMIN:TestPassword123!@pathfinder_test?walletDirectory=/app/backend/test-wallets
TEST_REDIS_DB=1
```

**Generate Secure Keys:**

```bash
# Generate JWT Secret (64 characters)
openssl rand -hex 32

# Generate Encryption Key (32 characters for AES-256)
openssl rand -hex 16

# Generate Session Secret (64 characters)
openssl rand -hex 32
```

### 4. Database Setup

#### Option A: Using Oracle Cloud ATP (Recommended for Production)

1. **Create Oracle Cloud Account**
   - Sign up at [cloud.oracle.com](https://cloud.oracle.com)
   - Get free tier with $300 credits

2. **Provision Autonomous Database**
   ```bash
   # Using OCI CLI (if installed)
   oci db autonomous-database create \
     --compartment-id <your-compartment-id> \
     --db-name pathfinderdb \
     --display-name "Pathfinder Database" \
     --db-workload OLTP \
     --is-free-tier true \
     --cpu-core-count 1 \
     --data-storage-size-in-gbs 20
   ```

3. **Download Wallet Files**
   ```bash
   # Create wallet directory
   mkdir -p backend/wallets
   
   # Download from OCI Console: 
   # Autonomous Database → DB Connection → Download Wallet
   # Extract to backend/wallets/
   
   # Verify wallet files
   ls backend/wallets/
   # Should contain: cwallet.sso, ewallet.p12, sqlnet.ora, tnsnames.ora, etc.
   ```

4. **Configure Connection**
   ```bash
   # Update .env with your connection details
   DATABASE_URL=oracle://ADMIN:<your-password>@pathfinder_high?walletDirectory=/app/backend/wallets
   
   # Connection string format:
   # oracle://[username]:[password]@[service_name]?walletDirectory=[wallet_path]
   ```

#### Option B: Using Docker Oracle XE (Development Only)

1. **Start Oracle XE Container**
   ```bash
   # Create docker-compose.override.yml for local development
   cat > docker-compose.override.yml << EOF
   version: '3.8'
   services:
     oracle-xe:
       image: gvenzl/oracle-xe:21-slim
       ports:
         - "1521:1521"
       environment:
         ORACLE_PASSWORD: oracle
         ORACLE_DATABASE: XEPDB1
         APP_USER: pathfinder
         APP_USER_PASSWORD: pathfinder123
       volumes:
         - oracle-data:/opt/oracle/oradata
       healthcheck:
         test: ["CMD", "sqlplus", "-s", "sys/oracle@//localhost:1521/XE as sysdba", "<<<", "SELECT 1 FROM DUAL;"]
         interval: 30s
         timeout: 10s
         retries: 5
   
   volumes:
     oracle-data:
   EOF
   
   # Start the container
   docker-compose up -d oracle-xe
   
   # Monitor startup (takes 2-3 minutes)
   docker-compose logs -f oracle-xe
   # Look for: "DATABASE IS READY TO USE!"
   ```

2. **Verify Connection**
   ```bash
   # Test connection with sqlplus
   docker exec -it pathfinder-oracle-xe-1 sqlplus pathfinder/pathfinder123@//localhost:1521/XEPDB1
   
   # Or using Node.js
   npm run db:health
   ```

3. **Update .env for Local Development**
   ```bash
   DATABASE_URL=oracle://pathfinder:pathfinder123@localhost:1521/XEPDB1
   ```

### 5. Set Up Database

```bash
# Install Oracle Instant Client first (if not using Docker)
# macOS:
brew install instantclient-basic instantclient-sqlplus

# Ubuntu/Debian:
sudo apt-get install alien libaio1
# Download from Oracle website, then:
sudo alien -i oracle-instantclient*.rpm

# Set Oracle environment variables
export ORACLE_HOME=/usr/lib/oracle/21/client64
export LD_LIBRARY_PATH=$ORACLE_HOME/lib:$LD_LIBRARY_PATH
export PATH=$ORACLE_HOME/bin:$PATH

# Run database setup
npm run db:setup

# This will execute:
# 1. Create user schemas
# 2. Create tables with proper prefixes (pf_)
# 3. Set up indexes and constraints
# 4. Create stored procedures
# 5. Configure Row Level Security

# Verify setup was successful
npm run db:health

# Expected output:
# ✓ Database connection successful
# ✓ All required tables exist
# ✓ User permissions verified
# ✓ Encryption keys configured

# Seed test data (optional but recommended for development)
npm run db:seed

# This creates:
# - 3 test users (demo@pathfinder.ai, test@pathfinder.ai, admin@pathfinder.ai)
# - Sample experiences and skills
# - Example career paths
# - Test conversations

# Verify seeded data
npm run db:verify-seed
```

**Manual Database Verification:**

```sql
-- Connect to database
sqlplus pathfinder/pathfinder123@//localhost:1521/XEPDB1

-- Check tables
SELECT table_name FROM user_tables WHERE table_name LIKE 'PF_%' ORDER BY table_name;

-- Expected tables:
-- PF_USERS
-- PF_USER_SESSIONS
-- PF_EXPERIENCES_DETAILED
-- PF_EXPERIENCES_AGGREGATED
-- PF_EXPERIENCES_SUMMARY
-- PF_SKILLS
-- PF_USER_SKILLS
-- PF_CHAT_CONVERSATIONS
-- PF_CHAT_MESSAGES
-- ... and more

-- Check user data
SELECT user_id, email, first_name, last_name FROM pf_users;

-- Exit
EXIT;
```

### 6. Start Development Servers

```bash
# Start both frontend and backend
npm run dev

# Or start separately:
npm run backend:dev   # Backend on http://localhost:3000
npm run frontend:dev  # Frontend on http://localhost:5173
```

## Development Workflow

### Project Structure

```
pathfinder/
├── frontend/                # React TypeScript application
│   ├── src/
│   │   ├── components/     # UI components
│   │   ├── pages/          # Route pages
│   │   ├── stores/         # Zustand state management
│   │   ├── services/       # API services
│   │   └── types/          # TypeScript types
│   └── package.json
│
├── backend/                 # Node.js backend
│   ├── src/
│   │   ├── api/            # REST API routes
│   │   ├── services/       # Business logic
│   │   ├── database/       # Database layer
│   │   ├── config/         # Configuration
│   │   └── utils/          # Utilities
│   └── package.json
│
└── docs/                    # Documentation
```

### Available Scripts

```bash
# Development
npm run dev              # Start all services
npm run backend:dev      # Start backend only
npm run frontend:dev     # Start frontend only

# Database
npm run db:setup         # Set up database schema
npm run db:seed          # Seed test data
npm run db:health        # Check database health

# Testing
npm run test             # Run all tests
npm run test:unit        # Unit tests only
npm run test:integration # Integration tests
npm run test:e2e         # End-to-end tests

# Code Quality
npm run lint             # Lint all code
npm run lint:fix         # Fix linting issues
npm run typecheck        # TypeScript type checking
npm run format           # Format code with Prettier

# Building
npm run build            # Build for production
npm run preview          # Preview production build
```

## Development Tools

### VS Code Extensions

Recommended extensions for development:
- ESLint
- Prettier
- TypeScript and JavaScript Language Features
- Tailwind CSS IntelliSense
- Docker
- Oracle Developer Tools for VS Code

### Debugging

#### Backend Debugging
```json
// .vscode/launch.json
{
  "type": "node",
  "request": "launch",
  "name": "Debug Backend",
  "program": "${workspaceFolder}/backend/src/server.js",
  "envFile": "${workspaceFolder}/.env"
}
```

#### Frontend Debugging
- Use React Developer Tools browser extension
- Enable source maps in development

### Testing

#### Unit Tests
```bash
# Run with coverage
npm run test:unit -- --coverage

# Watch mode
npm run test:unit -- --watch
```

#### Integration Tests
```bash
# Requires database connection
npm run test:integration
```

#### E2E Tests
```bash
# Start services first
npm run dev

# In another terminal
npm run test:e2e
```

## Common Development Tasks

### Adding a New API Endpoint

1. Create controller in `backend/src/api/controllers/`
2. Create service in `backend/src/services/`
3. Add route in `backend/src/api/routes/`
4. Update API documentation
5. Add tests

### Adding a New Frontend Component

1. Create component in `frontend/src/components/`
2. Add TypeScript types in `frontend/src/types/`
3. Create service if needed in `frontend/src/services/`
4. Add tests
5. Update Storybook stories (if applicable)

### Database Schema Changes

1. Create migration file:
```bash
npm run db:migration:create -- add_new_table
```

2. Edit migration in `backend/src/database/migrations/`
3. Run migration:
```bash
npm run db:migrate
```

## Troubleshooting

### Common Issues & Solutions

#### 1. Port Already in Use
```bash
# Find process using port
lsof -i :3000  # macOS/Linux
netstat -ano | findstr :3000  # Windows

# Kill process
kill -9 <PID>  # macOS/Linux
taskkill /PID <PID> /F  # Windows

# Or use different ports in .env
API_PORT=3001
FRONTEND_PORT=5174
```

#### 2. Database Connection Issues

**Error: ORA-12154: TNS:could not resolve the connect identifier**
```bash
# Solution 1: Check wallet path
ls -la backend/wallets/
# Ensure all wallet files are present

# Solution 2: Use absolute path in .env
DATABASE_URL=oracle://ADMIN:password@pathfinder_high?walletDirectory=/absolute/path/to/backend/wallets

# Solution 3: Check tnsnames.ora
cat backend/wallets/tnsnames.ora
# Verify service name matches your connection string
```

**Error: DPI-1047: Cannot locate a 64-bit Oracle Client library**
```bash
# macOS:
brew install instantclient-basic
export DYLD_LIBRARY_PATH=/usr/local/lib:$DYLD_LIBRARY_PATH

# Linux:
sudo apt-get install libaio1
export LD_LIBRARY_PATH=/opt/oracle/instantclient_21_8:$LD_LIBRARY_PATH

# Windows:
# Add Oracle Instant Client to PATH
# Restart terminal/IDE
```

**Error: ORA-01017: invalid username/password**
```bash
# Reset password in OCI Console
# Or for local Docker:
docker exec -it pathfinder-oracle-xe-1 sqlplus sys/oracle@//localhost:1521/XE as sysdba
SQL> ALTER USER pathfinder IDENTIFIED BY newpassword123;
```

#### 3. Frontend Build Issues

**Error: Cannot find module '@/components/...'**
```bash
# Clear all caches
rm -rf frontend/node_modules
rm -rf frontend/.vite
rm frontend/package-lock.json
cd frontend && npm install
npm run frontend:dev
```

**Error: ENOSPC: System limit for number of file watchers reached**
```bash
# Linux only - increase watchers
echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

#### 4. Redis Connection Issues

**Error: Redis connection to localhost:6379 failed**
```bash
# Start Redis with Docker
docker run -d -p 6379:6379 --name pathfinder-redis redis:alpine

# Or install locally
# macOS:
brew install redis && brew services start redis

# Ubuntu:
sudo apt-get install redis-server
sudo systemctl start redis-server
```

#### 5. MCP Server Issues

**Error: MCP server failed to start**
```bash
# Check if port is available
lsof -i :8001

# Run MCP server separately for debugging
npm run mcp:dev -- --debug

# Check logs
tail -f logs/mcp-server.log
```

#### 6. Authentication Issues

**Error: JsonWebTokenError: invalid signature**
```bash
# Regenerate JWT secret
openssl rand -hex 32
# Update .env with new secret
# Restart all services
npm run dev:restart
```

### Debugging Tips

#### Enable Detailed Logging
```bash
# In .env
LOG_LEVEL=debug
ENABLE_SQL_LOGGING=true
DEBUG=pathfinder:*

# View logs
tail -f logs/app.log | jq '.'  # Pretty print JSON logs
```

#### Database Query Debugging
```javascript
// In backend/src/config/database.js
const pool = oracledb.createPool({
  // ... other config
  events: true,
  _logStats: true  // Enable statistics
});

pool.on('_statslog', stats => {
  console.log('Pool stats:', stats);
});
```

#### API Request Debugging
```bash
# Use curl with verbose output
curl -v -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# Or use httpie (more readable)
http POST localhost:3000/api/auth/login \
  email=test@example.com \
  password=password123
```

### Getting Help

- Check [Troubleshooting Guide](./troubleshooting.md)
- Review existing GitHub issues
- Join our Discord community
- Contact the development team

## Next Steps

- Review [Architecture Documentation](../architecture/README.md)
- Read [Contributing Guide](./contributing-guide.md)
- Explore [API Documentation](../api/README.md)
- Check [Security Best Practices](../deployment/security/security-procedures.md)