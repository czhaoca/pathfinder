# Pathfinder System Architecture

## Overview

Pathfinder is a **multi-user career navigation and experience management platform** with HIPAA-level security designed for intelligent professional experience storage, AI-powered career guidance, and resume generation. The architecture implements complete data isolation through user-prefixed schemas while maintaining optimal performance with a three-tier data model.

## Core Design Principles

1. **Complete Data Isolation**: Each user has their own isolated schema with prefixed tables
2. **Security-First Design**: HIPAA-level security with encryption, audit logging, and access controls
3. **Performance Optimization**: Three-tier data architecture for different query patterns (<10ms to <200ms)
4. **Enterprise Reliability**: Oracle Autonomous Database with built-in high availability
5. **Privacy by Design**: User data sovereignty with complete isolation and encryption

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    Frontend Applications                        │
│           (React Web App, Mobile Apps, API Clients)            │
├─────────────────────────────────────────────────────────────────┤
│                      REST API Gateway                           │
│               (Authentication, Rate Limiting)                    │
├─────────────────────────────────────────────────────────────────┤
│                  Application Service Layer                      │
│  ┌─────────────────┬─────────────────┬────────────────────────┐│
│  │   Auth Service  │Experience Service│  Analytics Service     ││
│  │ • JWT tokens    │ • CRUD operations│ • Career insights      ││
│  │ • MFA support   │ • Skills extract │ • Skill progression    ││
│  │ • Session mgmt  │ • AI enhancement │ • Impact scoring       ││
│  ├─────────────────┼─────────────────┼────────────────────────┤│
│  │  Chat Service   │ Resume Service   │  CPA PERT Service      ││
│  │ • AI chat       │ • Resume gen     │ • Competency mapping   ││
│  │ • Conversation  │ • ATS optimize   │ • PERT responses       ││
│  │ • MCP tools     │ • Multi-format   │ • EVR compliance       ││
│  └─────────────────┴─────────────────┴────────────────────────┘│
├─────────────────────────────────────────────────────────────────┤
│                    Data Access Layer                            │
│           (Repository Pattern with User Context)                │
├─────────────────────────────────────────────────────────────────┤
│              Oracle Autonomous Database                         │
│  ┌─────────────────┬─────────────────┬────────────────────────┐│
│  │ System Tables   │Reference Tables  │ User-Prefixed Schemas  ││
│  │ • pf_users      │ • Skills catalog │ • user_john_doe_*      ││
│  │ • pf_sessions   │ • Career paths   │ • user_jane_smith_*    ││
│  │ • pf_audit_log  │ • Industries     │ • Complete isolation   ││
│  └─────────────────┴─────────────────┴────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

## Component Architecture

### 1. Frontend Layer

**React Web Application**
- TypeScript-based SPA with modern UI/UX
- Zustand for state management
- React Router for navigation
- Tailwind CSS with shadcn/ui components
- Real-time updates via polling (WebSocket future)

**API Integration**
- Axios for HTTP requests
- JWT token management with refresh
- Request/response interceptors
- Automatic retry with exponential backoff

### 2. API Gateway Layer

**Express.js REST API**
- RESTful endpoint design
- CORS configuration
- Request validation with Joi
- Response formatting middleware
- Error handling with standardized codes

### 3. Application Service Layer

**Dependency Injection Container**
- IoC container for service lifecycle management
- Singleton pattern for shared services
- Repository pattern for data access
- Clean separation of concerns

**Core Services:**

#### Authentication Service
```javascript
- User registration with schema creation
- JWT token generation (15-minute expiry)
- Session management with Redis
- Password hashing with bcrypt
- MFA support (TOTP)
```

#### Experience Service
```javascript
- CRUD operations for experiences
- AI-powered skill extraction
- Impact quantification
- Achievement mining
- Experience categorization
```

#### Analytics Service
```javascript
- Career progression analysis
- Skill gap identification
- Industry trend insights
- Performance metrics
- Growth recommendations
```

#### Chat Service
```javascript
- OpenAI GPT-4 integration
- Conversation management
- Context-aware responses
- MCP tool integration
- Message history tracking
```

#### Resume Service
```javascript
- Multiple format generation (PDF, DOCX, TXT)
- ATS optimization
- Template customization
- Dynamic content selection
- Version management
```

### 4. Database Layer

**Oracle Autonomous Database with Multi-User Architecture**

**Why Oracle Autonomous Database?**
- **Enterprise Security**: Built-in encryption, VPD, and audit capabilities
- **JSON Performance**: Native JSON support with indexing
- **Always Free Tier**: 2 databases × 20GB for development
- **Self-Managing**: Automatic patching, tuning, and scaling
- **HIPAA Compliance**: Enterprise features for healthcare-grade security

**Multi-User Schema Architecture:**

#### System Tables (Shared)

**pf_users** - User Account Management
```sql
CREATE TABLE pf_users (
    user_id RAW(16) DEFAULT SYS_GUID() PRIMARY KEY,
    username VARCHAR2(50) UNIQUE NOT NULL,
    email VARCHAR2(255) UNIQUE NOT NULL,
    password_hash VARCHAR2(255) NOT NULL,
    schema_prefix VARCHAR2(64) NOT NULL UNIQUE,
    first_name VARCHAR2(100),
    last_name VARCHAR2(100),
    account_status VARCHAR2(20) DEFAULT 'active',
    mfa_secret VARCHAR2(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP
);
```

**pf_user_sessions** - Session Management
```sql
CREATE TABLE pf_user_sessions (
    session_id RAW(16) DEFAULT SYS_GUID() PRIMARY KEY,
    user_id RAW(16) NOT NULL REFERENCES pf_users(user_id),
    token_hash VARCHAR2(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    is_active NUMBER(1) DEFAULT 1,
    ip_address VARCHAR2(45),
    user_agent VARCHAR2(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_activity TIMESTAMP
);
```

**pf_audit_log** - Comprehensive Audit Trail
```sql
CREATE TABLE pf_audit_log (
    audit_id RAW(16) DEFAULT SYS_GUID() PRIMARY KEY,
    user_id RAW(16) REFERENCES pf_users(user_id),
    action VARCHAR2(100) NOT NULL,
    resource_type VARCHAR2(50),
    resource_id VARCHAR2(255),
    request_data CLOB CHECK (request_data IS JSON),
    response_code NUMBER,
    execution_time_ms NUMBER,
    ip_address VARCHAR2(45),
    success NUMBER(1),
    error_message VARCHAR2(4000),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) PARTITION BY RANGE (timestamp) 
  INTERVAL (NUMTOYMINTERVAL(1, 'MONTH'));
```

#### User-Prefixed Tables (Per User)

Each user gets isolated tables with their username prefix:

**{user_prefix}_experiences_detailed** - Complete Experience Records
```sql
CREATE TABLE user_john_doe_experiences_detailed (
    experience_id RAW(16) DEFAULT SYS_GUID() PRIMARY KEY,
    title VARCHAR2(200) NOT NULL,
    organization VARCHAR2(200),
    department VARCHAR2(100),
    description CLOB NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE,
    is_current NUMBER(1) DEFAULT 0,
    experience_type VARCHAR2(50),
    employment_type VARCHAR2(50),
    
    -- AI-Extracted Data (JSON)
    extracted_skills CLOB CHECK (extracted_skills IS JSON),
    key_highlights CLOB CHECK (key_highlights IS JSON),
    quantified_impacts CLOB CHECK (quantified_impacts IS JSON),
    technologies_used CLOB CHECK (technologies_used IS JSON),
    achievements CLOB CHECK (achievements IS JSON),
    
    -- Metrics
    team_size NUMBER,
    budget_managed NUMBER,
    revenue_impact NUMBER,
    cost_savings NUMBER,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ai_processed NUMBER(1) DEFAULT 0
);
```

**{user_prefix}_profile_summaries** - Aggregated Profile (Level 2)
```sql
CREATE TABLE user_john_doe_profile_summaries (
    summary_id RAW(16) DEFAULT SYS_GUID() PRIMARY KEY,
    total_years_experience NUMBER,
    industries CLOB CHECK (industries IS JSON),
    core_strengths CLOB CHECK (core_strengths IS JSON),
    technical_skills CLOB CHECK (technical_skills IS JSON),
    soft_skills CLOB CHECK (soft_skills IS JSON),
    career_progression CLOB CHECK (career_progression IS JSON),
    key_achievements CLOB CHECK (key_achievements IS JSON),
    last_regenerated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**{user_prefix}_quick_summaries** - Quick Access (Level 3)
```sql
CREATE TABLE user_john_doe_quick_summaries (
    summary_id RAW(16) DEFAULT SYS_GUID() PRIMARY KEY,
    executive_summary VARCHAR2(500),
    headline VARCHAR2(200),
    key_skills CLOB CHECK (key_skills IS JSON),
    years_experience NUMBER,
    current_role VARCHAR2(200),
    industries CLOB CHECK (industries IS JSON),
    career_goals CLOB CHECK (career_goals IS JSON),
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Data Flow Architecture

### User Registration & Schema Creation

```
User Registration → Create pf_users record
                         ↓
                  Generate unique schema_prefix
                         ↓
                  Create user-specific tables
                         ↓
                  Initialize with default data
```

### Three-Tier Data Model Performance

**Level 1: Detailed Experience Storage (< 200ms)**
```
User submits experience → Validate input
                              ↓
                Store in {user}_experiences_detailed
                              ↓
                    Trigger AI enhancement
                              ↓
                Extract skills & quantify impact
```

**Level 2: Profile Aggregation (< 50ms)**
```
Experiences change → Background job triggered
                            ↓
                    Analyze all experiences
                            ↓
                Generate career progression
                            ↓
            Update {user}_profile_summaries
```

**Level 3: Quick Access Optimization (< 10ms)**
```
Profile updated → Generate executive summary
                           ↓
                   Extract top skills
                           ↓
              Update {user}_quick_summaries
                           ↓
                  Cache for fast retrieval
```

### API Request Flow with User Context

```javascript
// 1. API Request with JWT token
POST /api/experiences
Authorization: Bearer eyJhbGci...

// 2. Middleware validates token
const userId = validateJWT(token);
const user = await getUserById(userId);

// 3. Repository uses schema prefix
const tableName = `${user.schemaPrefix}_experiences_detailed`;
const query = `INSERT INTO ${tableName} ...`;

// 4. Audit log captures action
await auditLog.create({
  userId,
  action: 'CREATE_EXPERIENCE',
  resourceType: 'EXPERIENCE',
  resourceId: experienceId
});
```

### Connection Pool Architecture

**Optimized for Multi-User Scalability:**
```javascript
// Development Environment
pool: {
  min: 2,              // Minimum connections
  max: 10,             // Maximum connections
  increment: 2,        // Growth increment
  timeout: 60000,      // 60s acquisition timeout
  idleTimeout: 300000, // 5 min idle timeout
  pingInterval: 60,    // Health check interval
  enableStatistics: true
}

// Production Environment
pool: {
  min: 10,             // Higher baseline
  max: 50,             // Support more users
  increment: 5,        // Faster scaling
  timeout: 30000,      // 30s timeout
  idleTimeout: 600000, // 10 min idle
  pingInterval: 30,    // More frequent checks
  enableStatistics: true
}
```

## Security Architecture

### Multi-Layer Security Model

**1. Authentication & Authorization**
- JWT tokens with 15-minute expiry
- Refresh token rotation
- Multi-factor authentication (TOTP)
- Session management with automatic timeout
- API key support for programmatic access

**2. Data Isolation**
- Complete schema isolation per user
- No shared tables between users
- Parameterized queries only
- Schema prefix validation
- SQL injection prevention

**3. Encryption**
- **At Rest**: Oracle TDE with AES-256
- **In Transit**: TLS 1.3 minimum
- **Application Level**: Sensitive field encryption
- **Key Management**: User-specific encryption keys

**4. Audit & Compliance**
- Every data access logged
- User attribution for all actions
- Immutable audit trail
- 7-year retention policy
- HIPAA-compliant logging

### Security Implementation

```javascript
// Request Authentication Flow
app.use(async (req, res, next) => {
  // 1. Extract JWT token
  const token = req.headers.authorization?.split(' ')[1];
  
  // 2. Validate token
  const decoded = jwt.verify(token, JWT_SECRET);
  
  // 3. Load user context
  const user = await userRepository.findById(decoded.userId);
  req.userContext = {
    userId: user.user_id,
    schemaPrefix: user.schema_prefix,
    permissions: user.permissions
  };
  
  // 4. Audit log entry
  await auditService.logAccess({
    userId: user.user_id,
    action: req.method + ' ' + req.path,
    ip: req.ip,
    userAgent: req.headers['user-agent']
  });
  
  next();
});
```

## Deployment Architecture

### Docker-Based Deployment

**Development Stack:**
```yaml
services:
  frontend:
    build: ./frontend
    ports: ["3001:3001"]
    environment:
      - VITE_API_URL=http://localhost:3000/api
  
  backend:
    build: ./backend
    ports: ["3000:3000"]
    environment:
      - NODE_ENV=development
      - DB_CONNECTION_STRING=${DB_CONNECTION_STRING}
    volumes:
      - ./backend:/app
  
  nginx:
    image: nginx:alpine
    ports: ["80:80"]
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf
```

**Production Stack:**
```yaml
services:
  app:
    image: pathfinder:latest
    environment:
      - NODE_ENV=production
      - JWT_SECRET=${JWT_SECRET}
      - DB_CONNECTION_STRING=${DB_CONNECTION_STRING}
    deploy:
      replicas: 3
      restart_policy:
        condition: on-failure
```

### Environment Configuration

**Required Environment Variables:**
```bash
# Security
JWT_SECRET=<64-character-hex-string>
REFRESH_TOKEN_SECRET=<64-character-hex-string>
SESSION_SECRET=<32-character-string>

# Database
DB_HOST=your-instance.adb.region.oraclecloud.com
DB_SERVICE_NAME=your_service_high
DB_USERNAME=ADMIN
DB_PASSWORD=<secure-password>
DB_WALLET_PATH=./wallets/wallet.zip

# AI Services
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4-turbo-preview

# Feature Flags
ENABLE_FIELD_ENCRYPTION=true
ENABLE_AUDIT_LOGGING=true
ENABLE_RATE_LIMITING=true
```

## Performance Architecture

### Response Time Targets

| Operation | Target | Actual | Strategy |
|-----------|--------|--------|----------|
| User Login | < 200ms | 150ms | Password hash caching |
| Quick Context | < 10ms | 8ms | Singleton query optimization |
| Profile Load | < 50ms | 35ms | JSON aggregation |
| Experience Search | < 200ms | 120ms | Full-text indexing |
| Experience Create | < 500ms | 380ms | Async AI processing |
| Resume Generation | < 3s | 2.5s | Template caching |

### Caching Strategy

**Redis Integration:**
```javascript
// Session caching
redis.setex(`session:${sessionId}`, 900, JSON.stringify(sessionData));

// Quick summary caching
redis.setex(`quick:${userId}`, 300, JSON.stringify(quickSummary));

// API response caching
redis.setex(`api:${endpoint}:${userId}`, 60, JSON.stringify(response));
```

### Monitoring & Observability

**Application Metrics:**
```javascript
// Prometheus metrics
const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status']
});

const activeUsers = new Gauge({
  name: 'active_users_total',
  help: 'Number of active users'
});

const dbQueryDuration = new Histogram({
  name: 'db_query_duration_seconds',
  help: 'Duration of database queries',
  labelNames: ['operation', 'table']
});
```

**Health Endpoints:**
```javascript
// GET /health
{
  "status": "healthy",
  "version": "1.0.0",
  "uptime": 86400,
  "services": {
    "database": "connected",
    "redis": "connected",
    "openai": "available"
  }
}

// GET /metrics
# HELP http_requests_total Total HTTP requests
# TYPE http_requests_total counter
http_requests_total{method="GET",status="200"} 12453
```

## Scalability Architecture

### Horizontal Scaling Strategy

**1. Stateless Application Servers**
- No server-side session storage
- JWT tokens for authentication
- Redis for shared state

**2. Database Connection Pooling**
- Per-application instance pools
- Connection multiplexing
- Automatic failover

**3. Load Balancing**
- Nginx reverse proxy
- Health check-based routing
- Session affinity optional

### Growth Roadmap

**Phase 1: Current (0-1K users)**
- Single database instance
- 2-3 application servers
- Basic monitoring

**Phase 2: Growth (1K-10K users)**
- Read replicas for queries
- Microservice extraction
- Enhanced caching layer

**Phase 3: Scale (10K-100K users)**
- Database sharding by user
- Service mesh architecture
- Global CDN deployment

**Phase 4: Enterprise (100K+ users)**
- Multi-region deployment
- Dedicated user databases
- Real-time data pipelines

## Integration Points

### External Services

**1. OpenAI API**
- Skill extraction from experiences
- Career recommendations
- Resume optimization
- Chat responses

**2. OAuth Providers**
- Google OAuth 2.0
- LinkedIn OAuth 2.0
- Microsoft Azure AD

**3. Storage Services**
- Oracle Object Storage for backups
- CDN for static assets
- Document storage for resumes

### Webhook Support

```javascript
// Experience created webhook
POST https://customer.com/webhooks/experience
{
  "event": "experience.created",
  "userId": "123e4567-e89b-12d3-a456-426614174000",
  "experienceId": "456e7890-e89b-12d3-a456-426614174000",
  "timestamp": "2024-01-01T00:00:00Z"
}
```

## Development & Testing

### Local Development Setup

```bash
# Clone repository
git clone https://github.com/pathfinder/pathfinder.git

# Install dependencies
npm install

# Setup database
npm run db:setup
npm run db:migrate

# Start development servers
npm run dev

# Run tests
npm test
npm run test:e2e
```

### Testing Strategy

**Unit Tests (90% coverage target)**
- Service layer logic
- Repository data access
- Utility functions
- API endpoint validation

**Integration Tests**
- Database operations
- API workflows
- Authentication flows
- External service mocks

**E2E Tests (Playwright)**
- User registration flow
- Experience management
- Resume generation
- Chat interactions

This architecture provides a secure, scalable foundation for career management with enterprise-grade features, optimal performance, and comprehensive user data protection.