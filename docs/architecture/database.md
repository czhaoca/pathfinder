# Database Architecture

Pathfinder uses Oracle Autonomous Database with a multi-user architecture that provides complete data isolation and HIPAA-level security.

## Overview

The database design follows these principles:
- **Complete User Isolation**: Each user's data is stored in separate tables with user-prefixed names
- **Security First**: Field-level encryption, audit logging, and row-level security
- **Scalability**: Designed to handle millions of users and experiences
- **Performance**: Optimized indexes and materialized views for analytics

## Multi-User Architecture

### Schema Naming Convention

Each user gets their own set of tables with the prefix pattern:
```
pf_user_<username>_<table_name>
```

Example for user "john_doe":
- `pf_user_john_doe_experiences`
- `pf_user_john_doe_skills`
- `pf_user_john_doe_chat_conversations`

### Shared System Tables

System-wide tables use the `pf_` prefix:
- `pf_users` - User accounts
- `pf_user_sessions` - Active sessions
- `pf_audit_log` - Security audit trail
- `pf_ref_skills_catalog` - Reference skill data
- `pf_ref_career_paths` - Career path templates

## Core Data Models

### User Management

```sql
-- User accounts table
CREATE TABLE pf_users (
    id VARCHAR2(36) PRIMARY KEY,
    username VARCHAR2(50) UNIQUE NOT NULL,
    email VARCHAR2(255) UNIQUE NOT NULL,
    password_hash VARCHAR2(255) NOT NULL,
    full_name VARCHAR2(255),
    avatar_url VARCHAR2(500),
    bio CLOB,
    location VARCHAR2(255),
    linkedin_url VARCHAR2(500),
    github_url VARCHAR2(500),
    website_url VARCHAR2(500),
    timezone VARCHAR2(50) DEFAULT 'UTC',
    language VARCHAR2(10) DEFAULT 'en',
    email_verified NUMBER(1) DEFAULT 0,
    is_active NUMBER(1) DEFAULT 1,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User sessions for JWT management
CREATE TABLE pf_user_sessions (
    id VARCHAR2(36) PRIMARY KEY,
    user_id VARCHAR2(36) NOT NULL,
    refresh_token VARCHAR2(500) UNIQUE NOT NULL,
    device_info VARCHAR2(500),
    ip_address VARCHAR2(45),
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES pf_users(id) ON DELETE CASCADE
);
```

### Experience Management (Per User)

```sql
-- 3-Tier Experience Model
-- Tier 1: Detailed experiences
CREATE TABLE pf_user_<username>_experiences (
    id VARCHAR2(36) PRIMARY KEY,
    title VARCHAR2(255) NOT NULL,
    company VARCHAR2(255) NOT NULL,
    location VARCHAR2(255),
    start_date DATE NOT NULL,
    end_date DATE,
    is_current NUMBER(1) DEFAULT 0,
    description CLOB,
    key_achievements CLOB,
    technologies_used CLOB,
    industry VARCHAR2(100),
    role_type VARCHAR2(50),
    employment_type VARCHAR2(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Skills extracted from experiences
CREATE TABLE pf_user_<username>_skills (
    id VARCHAR2(36) PRIMARY KEY,
    experience_id VARCHAR2(36),
    skill_name VARCHAR2(100) NOT NULL,
    skill_category VARCHAR2(50),
    proficiency_level VARCHAR2(20),
    years_of_experience NUMBER(3,1),
    last_used DATE,
    is_primary NUMBER(1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (experience_id) 
        REFERENCES pf_user_<username>_experiences(id) ON DELETE CASCADE
);

-- Tier 2: Aggregated summaries
CREATE TABLE pf_user_<username>_profile_summary (
    id VARCHAR2(36) PRIMARY KEY,
    total_years_experience NUMBER(3,1),
    industries CLOB,
    top_skills CLOB,
    career_highlights CLOB,
    leadership_experience CLOB,
    technical_expertise CLOB,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tier 3: Quick access summaries
CREATE TABLE pf_user_<username>_quick_summary (
    id VARCHAR2(36) PRIMARY KEY,
    professional_headline VARCHAR2(255),
    career_objective VARCHAR2(500),
    key_strengths CLOB,
    total_roles NUMBER(5),
    years_experience NUMBER(3,1),
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Chat and AI Context (Per User)

```sql
-- Chat conversations
CREATE TABLE pf_user_<username>_chat_conversations (
    id VARCHAR2(36) PRIMARY KEY,
    title VARCHAR2(255),
    context CLOB,
    model VARCHAR2(50) DEFAULT 'gpt-4',
    total_messages NUMBER(10) DEFAULT 0,
    last_message_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Chat messages
CREATE TABLE pf_user_<username>_chat_messages (
    id VARCHAR2(36) PRIMARY KEY,
    conversation_id VARCHAR2(36) NOT NULL,
    role VARCHAR2(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content CLOB NOT NULL,
    tokens_used NUMBER(10),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conversation_id) 
        REFERENCES pf_user_<username>_chat_conversations(id) ON DELETE CASCADE
);
```

### Analytics and Insights (Per User)

```sql
-- Career analytics
CREATE TABLE pf_user_<username>_career_analytics (
    id VARCHAR2(36) PRIMARY KEY,
    metric_date DATE NOT NULL,
    metric_type VARCHAR2(50) NOT NULL,
    metric_value NUMBER(10,2),
    metric_data CLOB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (metric_date, metric_type)
);

-- Skills progression tracking
CREATE TABLE pf_user_<username>_skills_progression (
    id VARCHAR2(36) PRIMARY KEY,
    skill_name VARCHAR2(100) NOT NULL,
    assessment_date DATE NOT NULL,
    proficiency_score NUMBER(3),
    growth_rate NUMBER(5,2),
    market_demand_score NUMBER(3),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### CPA PERT Module (Per User)

```sql
-- PERT responses
CREATE TABLE pf_user_<username>_pert_responses (
    id VARCHAR2(36) PRIMARY KEY,
    experience_id VARCHAR2(36),
    competency_id VARCHAR2(36) NOT NULL,
    sub_competency_id VARCHAR2(36),
    situation CLOB NOT NULL,
    task CLOB NOT NULL,
    action CLOB NOT NULL,
    result CLOB NOT NULL,
    reflection CLOB,
    evidence_files CLOB,
    word_count NUMBER(10),
    status VARCHAR2(20) DEFAULT 'draft',
    reviewer_feedback CLOB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    submitted_at TIMESTAMP,
    FOREIGN KEY (experience_id) 
        REFERENCES pf_user_<username>_experiences(id)
);
```

## Security Features

### Field-Level Encryption

Sensitive fields are encrypted using AES-256:
```sql
-- Encryption keys table
CREATE TABLE pf_encryption_keys (
    id VARCHAR2(36) PRIMARY KEY,
    user_id VARCHAR2(36) UNIQUE NOT NULL,
    key_encrypted VARCHAR2(500) NOT NULL,
    key_salt VARCHAR2(100) NOT NULL,
    algorithm VARCHAR2(20) DEFAULT 'AES-256-GCM',
    rotation_count NUMBER(5) DEFAULT 0,
    last_rotated TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES pf_users(id) ON DELETE CASCADE
);
```

### Audit Logging

All data access is logged:
```sql
CREATE TABLE pf_audit_log (
    id VARCHAR2(36) PRIMARY KEY,
    user_id VARCHAR2(36),
    action VARCHAR2(50) NOT NULL,
    entity_type VARCHAR2(50),
    entity_id VARCHAR2(36),
    ip_address VARCHAR2(45),
    user_agent VARCHAR2(500),
    request_method VARCHAR2(10),
    request_path VARCHAR2(500),
    response_status NUMBER(3),
    execution_time_ms NUMBER(10),
    error_message CLOB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_audit_user (user_id),
    INDEX idx_audit_action (action),
    INDEX idx_audit_created (created_at)
);
```

## Indexes and Performance

### Primary Indexes

```sql
-- User lookup
CREATE INDEX idx_users_username ON pf_users(username);
CREATE INDEX idx_users_email ON pf_users(email);

-- Experience search (per user)
CREATE INDEX idx_exp_dates ON pf_user_<username>_experiences(start_date, end_date);
CREATE INDEX idx_exp_company ON pf_user_<username>_experiences(company);

-- Skills search (per user)
CREATE INDEX idx_skills_name ON pf_user_<username>_skills(skill_name);
CREATE INDEX idx_skills_category ON pf_user_<username>_skills(skill_category);

-- Chat performance (per user)
CREATE INDEX idx_chat_updated ON pf_user_<username>_chat_conversations(updated_at);
CREATE INDEX idx_messages_conv ON pf_user_<username>_chat_messages(conversation_id, created_at);
```

### Materialized Views for Analytics

```sql
-- Career summary view (per user)
CREATE MATERIALIZED VIEW pf_user_<username>_career_summary AS
SELECT 
    COUNT(*) as total_positions,
    COUNT(DISTINCT company) as total_companies,
    MIN(start_date) as career_start_date,
    SUM(
        CASE 
            WHEN end_date IS NULL THEN 
                MONTHS_BETWEEN(SYSDATE, start_date)
            ELSE 
                MONTHS_BETWEEN(end_date, start_date)
        END
    ) / 12 as total_years_experience
FROM pf_user_<username>_experiences;
```

## Data Retention and Archival

### Retention Policies

```sql
-- Data retention configuration
CREATE TABLE pf_data_retention_policies (
    id VARCHAR2(36) PRIMARY KEY,
    table_pattern VARCHAR2(255) NOT NULL,
    retention_days NUMBER(10) NOT NULL,
    archive_enabled NUMBER(1) DEFAULT 0,
    delete_enabled NUMBER(1) DEFAULT 1,
    last_run TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Archive tables for old data
CREATE TABLE pf_user_<username>_experiences_archive 
AS SELECT * FROM pf_user_<username>_experiences WHERE 1=0;
```

## Backup and Recovery

### Backup Strategy

1. **Automated Daily Backups**
   - Full database export daily
   - Incremental backups every 4 hours
   - 30-day retention

2. **Point-in-Time Recovery**
   - Transaction logs retained for 7 days
   - RPO: 5 minutes
   - RTO: 1 hour

3. **Geo-Redundancy**
   - Primary: US East
   - Secondary: US West
   - Automatic failover

## Migration Scripts

### User Table Creation

```javascript
// backend/src/database/migrations/create-user-tables.js
async function createUserTables(username) {
    const tables = [
        'experiences',
        'skills',
        'profile_summary',
        'quick_summary',
        'chat_conversations',
        'chat_messages',
        'career_analytics',
        'skills_progression',
        'pert_responses'
    ];
    
    for (const table of tables) {
        const tableName = `pf_user_${username}_${table}`;
        await createTableFromTemplate(table, tableName);
    }
}
```

## Best Practices

### 1. Connection Pooling
```javascript
const poolConfig = {
    min: 2,
    max: 10,
    increment: 1,
    timeout: 60,
    connectionTimeout: 30
};
```

### 2. Query Optimization
- Use bind variables for all queries
- Implement pagination for large result sets
- Use appropriate indexes
- Regular statistics gathering

### 3. Security
- Never store sensitive data unencrypted
- Use parameterized queries
- Implement row-level security
- Regular security audits

### 4. Monitoring
- Query performance monitoring
- Connection pool metrics
- Storage usage alerts
- Backup verification