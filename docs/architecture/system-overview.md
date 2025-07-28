# Pathfinder MCP Architecture

## Overview

Pathfinder MCP is a **single-user Model Context Protocol server** designed for intelligent professional experience storage and retrieval. The architecture is optimized for AI conversation performance with sub-10ms context retrieval and enterprise-grade Oracle Autonomous Database backend.

## Core Design Principles

1. **Performance-First**: Three-tier data architecture for optimal AI conversation response times
2. **Single-User Optimization**: No multi-tenancy complexity, simplified schema and queries
3. **Enterprise Reliability**: Oracle Autonomous Database with built-in high availability
4. **Privacy by Design**: User-controlled database hosting with complete data sovereignty

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        AI Assistant (Claude)                    │
│                     ↕ Model Context Protocol                    │
├─────────────────────────────────────────────────────────────────┤
│                Pathfinder MCP Server                            │
│  ┌─────────────────┬─────────────────┬─────────────────────────┐│
│  │   Quick Context │ Detailed Profile│   Full Experiences      ││
│  │     < 10ms      │     < 50ms      │      < 200ms            ││
│  │                 │                 │                         ││
│  │ • Executive     │ • Career        │ • Complete experience   ││
│  │   summary       │   progression   │   records               ││
│  │ • Key skills    │ • Strengths     │ • Skills extraction     ││
│  │ • Current role  │   analysis      │ • Achievement metrics   ││
│  │ • Goals         │ • Industry      │ • Role mappings         ││
│  │                 │   experience    │ • Impact quantification ││
│  └─────────────────┴─────────────────┴─────────────────────────┘│
├─────────────────────────────────────────────────────────────────┤
│                   Oracle Autonomous Database                    │
│                        (Your OCI Account)                       │
└─────────────────────────────────────────────────────────────────┘
```

## Component Architecture

### 1. AI Assistant Integration Layer

**Model Context Protocol (MCP) Interface**
- Standard MCP protocol compliance for AI assistant integration
- Tool discovery and capability negotiation
- Secure communication channel with request/response validation
- Error handling and retry mechanisms

**Supported AI Assistants:**
- Claude Desktop (primary integration)
- OpenAI ChatGPT (via MCP adapters)
- Custom AI applications using MCP SDK

### 2. MCP Server Application Layer

**Technology Stack:**
- **Runtime**: Node.js 18+ with ES2022 features
- **Framework**: MCP SDK for protocol implementation
- **Database Driver**: Oracle Database Node.js driver (oracledb)
- **Logging**: Winston with structured JSON logging
- **Validation**: Joi for input validation and sanitization
- **Testing**: Jest for unit/integration testing

**Core Components:**

#### Tool Handler System
```javascript
// 8 professional MCP tools implemented:
- store_experience      // Add new professional experiences
- get_quick_context     // Rapid conversation context (< 10ms)
- get_detailed_profile  // Comprehensive career analysis (< 50ms)
- search_experiences    // Find experiences with filters (< 200ms)
- update_profile        // Update career summaries
- get_skills_analysis   // Skills analysis across experiences
- get_career_suggestions // AI-powered career recommendations
- update_quick_summary  // Optimize rapid context retrieval
```

#### Performance Management
```javascript
// Built-in performance tracking:
- Response time monitoring per tool
- Database connection pool utilization
- Query execution time analysis
- Error rate tracking and alerting
- Resource usage optimization
```

#### Configuration Management
```javascript
// Environment-based configuration:
- Development vs Production database connections
- Connection pool settings optimized for conversation patterns
- Security settings and encryption key management
- Logging levels and performance monitoring toggles
```

### 3. Database Layer

**Oracle Autonomous Database (Always Free Tier)**

**Why Oracle Autonomous Database?**
- **JSON Performance**: Native JSON support equivalent to PostgreSQL JSONB
- **Enterprise Features**: Built-in encryption, backup, and performance tuning
- **Always Free**: 2 databases × 20GB forever free (no credit card expiration)
- **Self-Managing**: Automatic patching, tuning, and scaling
- **Global Availability**: Available in all OCI regions

**Database Schema Design:**

#### Core Tables (Single-User Optimized)

**experiences_detailed** - Complete Professional Experiences
```sql
CREATE TABLE experiences_detailed (
    id RAW(16) DEFAULT SYS_GUID() PRIMARY KEY,
    title VARCHAR2(255) NOT NULL,
    organization VARCHAR2(255),
    description CLOB NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE,
    is_current NUMBER(1) DEFAULT 0,
    experience_type VARCHAR2(50) CHECK (experience_type IN 
        ('work', 'education', 'volunteer', 'project', 'hobby', 'certification')),
    extracted_skills JSON,     -- Skills with proficiency levels
    key_highlights JSON,       -- Achievements and impact metrics
    role_mappings JSON,        -- Career role connections
    industry_tags JSON,        -- Industry classifications
    impact_metrics JSON,       -- Quantifiable achievements
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Performance indexes for MCP queries
CREATE INDEX idx_experiences_type_date ON experiences_detailed (experience_type, start_date DESC);
CREATE INDEX idx_experiences_current ON experiences_detailed (is_current, updated_at DESC);
CREATE INDEX idx_experiences_skills ON experiences_detailed (JSON_VALUE(extracted_skills, '$[*].name'));
```

**profile_summaries** - Aggregated Career Analysis (Singleton)
```sql
CREATE TABLE profile_summaries (
    id RAW(16) DEFAULT SYS_GUID() PRIMARY KEY,
    core_strengths JSON,        -- Technical, leadership, communication strengths
    career_interests JSON,      -- Career goals and target areas
    career_progression JSON,    -- Timeline and growth pattern analysis
    industry_experience JSON,   -- Industry expertise and domain knowledge
    leadership_profile JSON,    -- Leadership style and experience
    technical_profile JSON,     -- Technical skills and architecture
    soft_skills_profile JSON,   -- Interpersonal and communication skills
    education_summary JSON,     -- Educational background summary
    achievement_highlights JSON, -- Top 10-15 career achievements
    last_aggregated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Singleton constraint (only one profile record allowed)
CREATE UNIQUE INDEX idx_profile_singleton ON profile_summaries (1);
```

**quick_summaries** - Rapid AI Context (Singleton, < 10ms retrieval)
```sql
CREATE TABLE quick_summaries (
    id RAW(16) DEFAULT SYS_GUID() PRIMARY KEY,
    executive_summary CLOB,     -- 2-3 sentence professional summary
    key_skills JSON,            -- Top 8-10 skills array
    career_goals CLOB,          -- Current career objectives
    years_experience NUMBER(3),
    current_role VARCHAR2(255),
    industries JSON,            -- 2-3 primary industries
    education_level VARCHAR2(100),
    location VARCHAR2(255),
    availability VARCHAR2(100),
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Singleton constraint and ultra-fast retrieval index
CREATE UNIQUE INDEX idx_quick_singleton ON quick_summaries (1);
CREATE INDEX idx_quick_updated ON quick_summaries (last_updated DESC);
```

#### Supporting Tables

**skills_mapping** - Skills Taxonomy and Market Data
```sql
CREATE TABLE skills_mapping (
    id RAW(16) DEFAULT SYS_GUID() PRIMARY KEY,
    skill_name VARCHAR2(255) NOT NULL UNIQUE,
    category VARCHAR2(100), -- 'technical', 'soft', 'industry-specific'
    related_roles JSON,     -- Career roles using this skill
    proficiency_levels JSON, -- Beginner/intermediate/advanced definitions
    market_demand NUMBER(2) CHECK (market_demand BETWEEN 1 AND 10),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**career_paths** - Industry Career Progression Tracks
```sql
CREATE TABLE career_paths (
    id RAW(16) DEFAULT SYS_GUID() PRIMARY KEY,
    path_name VARCHAR2(255) NOT NULL,
    industry VARCHAR2(100),
    required_skills JSON,
    typical_progression JSON,    -- Role progression timeline
    education_requirements JSON,
    salary_ranges JSON,
    growth_outlook NUMBER(2) CHECK (growth_outlook BETWEEN 1 AND 10),
    related_paths JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Data Flow Architecture

### Three-Tier Performance Model

**Level 1: Experience Input & Storage**
```
User Experience → Validation → Store in experiences_detailed
                                      ↓
                            Trigger Profile Aggregation
```

**Level 2: Profile Aggregation (Background Processing)**
```
experiences_detailed → Analysis Engine → profile_summaries
                                              ↓
                            Skills extraction, career progression analysis,
                            strengths identification, achievement ranking
```

**Level 3: Quick Context Optimization**
```
profile_summaries → Context Optimizer → quick_summaries
                                            ↓
                     Executive summary generation, key skills selection,
                     career goals synthesis for < 10ms AI retrieval
```

### MCP Tool Performance Optimization

**Query Performance Strategies:**

1. **Level 3 Queries (< 10ms target)**
   ```sql
   -- Ultra-optimized single-row retrieval
   SELECT executive_summary, key_skills, career_goals, current_role
   FROM quick_summaries 
   WHERE ROWNUM = 1;
   ```

2. **Level 2 Queries (< 50ms target)**
   ```sql
   -- Comprehensive profile with JSON parsing
   SELECT core_strengths, career_progression, achievement_highlights
   FROM profile_summaries
   WHERE ROWNUM = 1;
   ```

3. **Level 1 Queries (< 200ms target)**
   ```sql
   -- Complex experience searches with filters
   SELECT * FROM experiences_detailed
   WHERE experience_type = :type
   AND UPPER(description) LIKE UPPER(:search)
   ORDER BY start_date DESC
   FETCH FIRST :limit ROWS ONLY;
   ```

### Connection Pool Architecture

**Development Environment:**
```javascript
pool: {
  min: 2,          // Minimum connections maintained
  max: 8,          // Maximum connections for dev workload
  increment: 1,    // Connection growth increment
  timeout: 60000,  // Acquisition timeout (60s)
  idleTimeout: 300000, // Idle connection timeout (5 minutes)
  pingInterval: 60     // Connection health check interval
}
```

**Production Environment:**
```javascript
pool: {
  min: 2,          // Minimum connections maintained
  max: 15,         // Higher max for production load
  increment: 2,    // Faster connection scaling
  timeout: 60000,
  idleTimeout: 300000,
  pingInterval: 60
}
```

## Security Architecture

### Data Protection

**Encryption at Rest:**
- Oracle Autonomous Database Transparent Data Encryption (TDE)
- All data encrypted using AES-256 encryption
- Encryption keys managed by Oracle Cloud Infrastructure

**Encryption in Transit:**
- TLS 1.3 for all database connections
- Oracle Wallet-based authentication
- Certificate-based secure communication

**User Data Sovereignty:**
- Database hosted in user's own OCI account
- Complete data ownership and control
- No vendor access to user data
- Export/import capabilities for data portability

### Access Control

**MCP Server Security:**
```javascript
// Environment-based credential management
const config = {
  security: {
    encryptionKey: process.env.MCP_ENCRYPTION_KEY, // 32+ character key
    sessionTimeout: 3600000, // 1 hour
    maxRetries: 3,
    rateLimiting: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 100 // per window
    }
  }
};
```

**Database Access:**
- Single application user (ADMIN) with minimal required privileges
- Oracle Wallet-based authentication (no passwords in code)
- Connection pooling with secure credential management
- Audit logging of all database operations

## Deployment Architecture

### Environment Separation

**Development Environment:**
```
pathfinder-dev (OCI Autonomous Database)
├── Development schema and test data
├── Debug logging and query tracing enabled
├── Relaxed connection timeouts
└── Sample data seeding for testing
```

**Production Environment:**
```
pathfinder-prod (OCI Autonomous Database)  
├── Production schema with performance optimization
├── Info-level logging with performance monitoring
├── Optimized connection pooling
└── Backup and recovery configured
```

### Configuration Management

**Environment Variables:**
```bash
# Database Configuration
OCI_DB_DEV_HOST=your-dev-instance.adb.region.oraclecloud.com
OCI_DB_DEV_SERVICE_NAME=your_dev_service_high
OCI_DB_DEV_USERNAME=ADMIN
OCI_DB_DEV_PASSWORD=SecurePassword123!
OCI_DB_DEV_WALLET_PATH=./wallets/dev-wallet

# MCP Server Configuration
MCP_ENCRYPTION_KEY=your-32-character-encryption-key
LOG_LEVEL=debug
ENABLE_QUERY_LOGGING=true
ENABLE_PERFORMANCE_METRICS=true
```

**Environment Switching:**
```bash
# Automated environment switching
npm run env:dev    # Switch to development
npm run env:prod   # Switch to production

# Health checks for each environment
npm run db:health  # Current environment health
npm run db:test-connection  # Both environments
```

## Performance Architecture

### Response Time Targets

| Operation | Target | Implementation Strategy |
|-----------|--------|------------------------|
| Quick Context | < 10ms | Single-row singleton query with optimal indexing |
| Detailed Profile | < 50ms | Aggregated data with JSON parsing optimization |
| Experience Search | < 200ms | Indexed search with result limiting |
| Store Experience | < 500ms | Single insert with background aggregation trigger |

### Monitoring and Observability

**Built-in Performance Tracking:**
```javascript
// Automatic performance monitoring
const performanceMetrics = {
  toolCalls: 0,
  totalResponseTime: 0,
  errors: 0,
  averageResponseTime: 0,
  errorRate: 0
};

// Database connection monitoring
const connectionStats = {
  totalConnections: 0,
  activeConnections: 0,
  queries: 0,
  avgResponseTime: 0
};
```

**Health Check System:**
```javascript
// Comprehensive health monitoring
async function healthCheck() {
  return {
    status: 'healthy|unhealthy',
    environment: 'development|production',
    responseTime: '8ms',
    poolStats: {
      connectionsInUse: 2,
      connectionsOpen: 4,
      poolMin: 2,
      poolMax: 8
    },
    connectionStats: {
      totalConnections: 156,
      queries: 1247,
      avgResponseTime: 32,
      errors: 0
    }
  };
}
```

### Scaling Considerations

**Single-User Optimization Benefits:**
- No complex user isolation or row-level security overhead
- Singleton pattern eliminates user-based data partitioning
- Simplified query patterns with predictable performance
- Cache-friendly data access patterns

**Growth Path:**
```
Current: Single-user MCP server
↓
Future: Multi-user with tenant isolation
↓
Enterprise: Microservices with dedicated databases per user
```

## Integration Architecture

### AI Assistant Integration

**MCP Protocol Compliance:**
```javascript
// Standard MCP server implementation
const server = new Server({
  name: 'pathfinder-mcp',
  version: '1.0.0'
}, {
  capabilities: {
    tools: {} // 8 career management tools
  }
});
```

**Tool Registration:**
```javascript
// Professional tools for AI conversations
const tools = [
  'store_experience',      // Add new experiences
  'get_quick_context',     // Rapid conversation context
  'get_detailed_profile',  // Comprehensive career analysis
  'search_experiences',    // Find specific experiences
  'update_profile',        // Update career summaries
  'get_skills_analysis',   // Skills analysis across experiences
  'get_career_suggestions', // AI-powered recommendations
  'update_quick_summary'   // Optimize rapid context
];
```

### Development and Testing Architecture

**Testing Strategy:**
```
Unit Tests (Jest)
├── Database connection and query testing
├── MCP tool validation and response testing
├── Configuration and environment management
└── Error handling and edge cases

Integration Tests (Jest + Mocked Database)
├── Complete MCP tool workflows
├── Performance target validation
├── Environment switching scenarios
└── Error recovery and retry mechanisms
```

**Development Workflow:**
```
1. Environment Setup → npm install, database provisioning
2. Schema Deployment → npm run db:migrate:dev
3. Sample Data Loading → npm run db:seed:dev
4. Development Server → npm run mcp:dev
5. Testing → npm test
6. Production Deployment → npm run db:migrate:prod
```

This architecture provides a robust foundation for AI-powered career conversations with enterprise-grade reliability, optimal performance, and complete user data control.