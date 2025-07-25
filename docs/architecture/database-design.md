# Database Architecture

## Overview

Career Navigator implements a sophisticated multi-user database architecture with complete data isolation, HIPAA-level security, and a 3-tier data model for optimal performance.

## Core Design Principles

1. **Complete Data Isolation**: Each user's data is stored in separate schemas
2. **Security First**: Encryption, audit logging, and access controls
3. **Performance Optimized**: 3-tier data model for different query patterns
4. **Scalability**: Designed to handle thousands of users
5. **Compliance Ready**: HIPAA, GDPR, and SOC 2 compliant design

## Database Schema Architecture

### User-Prefixed Schema Pattern

Each user gets their own isolated schema with tables prefixed by their username:

```sql
-- Example for user "john_doe"
career_nav_john_doe_experiences_detailed  -- Level 1: Detailed data
career_nav_john_doe_profile_summaries     -- Level 2: Aggregated data
career_nav_john_doe_quick_summaries       -- Level 3: Quick access data
```

### System Tables (Shared)

```sql
cn_users                 -- User accounts
cn_user_sessions         -- Active sessions
cn_audit_log            -- Comprehensive audit trail
cn_encryption_keys      -- User-specific encryption keys
cn_ref_skills_catalog   -- Reference skills database
cn_ref_career_paths     -- Career progression templates
cn_ref_industries       -- Industry classifications
```

## 3-Tier Data Model

### Level 1: Detailed Experience Data
**Purpose**: Store complete experience information with full fidelity

```sql
CREATE TABLE {user_schema}_experiences_detailed (
    experience_id       RAW(16) DEFAULT SYS_GUID() PRIMARY KEY,
    title              VARCHAR2(200) NOT NULL,
    organization       VARCHAR2(200),
    department         VARCHAR2(100),
    location           VARCHAR2(200),
    description        CLOB NOT NULL,
    start_date         DATE NOT NULL,
    end_date           DATE,
    is_current         NUMBER(1) DEFAULT 0,
    experience_type    VARCHAR2(50),
    employment_type    VARCHAR2(50),
    
    -- Extracted Data (JSON)
    extracted_skills    CLOB CHECK (extracted_skills IS JSON),
    key_highlights      CLOB CHECK (key_highlights IS JSON),
    quantified_impacts  CLOB CHECK (quantified_impacts IS JSON),
    technologies_used   CLOB CHECK (technologies_used IS JSON),
    achievements        CLOB CHECK (achievements IS JSON),
    
    -- Metrics
    team_size          NUMBER,
    budget_managed     NUMBER,
    revenue_impact     NUMBER,
    cost_savings       NUMBER,
    duration_months    NUMBER GENERATED ALWAYS AS (
        MONTHS_BETWEEN(NVL(end_date, SYSDATE), start_date)
    ),
    
    -- Metadata
    created_at         TIMESTAMP DEFAULT SYSTIMESTAMP,
    updated_at         TIMESTAMP DEFAULT SYSTIMESTAMP,
    ai_processed       NUMBER(1) DEFAULT 0,
    processing_version VARCHAR2(20)
);
```

### Level 2: Aggregated Profile Data
**Purpose**: Pre-computed summaries for profile generation

```sql
CREATE TABLE {user_schema}_profile_summaries (
    summary_id              RAW(16) DEFAULT SYS_GUID() PRIMARY KEY,
    total_years_experience  NUMBER,
    
    -- JSON Aggregations
    industries             CLOB CHECK (industries IS JSON),
    core_strengths         CLOB CHECK (core_strengths IS JSON),
    technical_skills       CLOB CHECK (technical_skills IS JSON),
    soft_skills           CLOB CHECK (soft_skills IS JSON),
    leadership_skills     CLOB CHECK (leadership_skills IS JSON),
    
    -- Career Analysis
    career_interests      CLOB CHECK (career_interests IS JSON),
    career_goals         CLOB CHECK (career_goals IS JSON),
    career_progression   CLOB CHECK (career_progression IS JSON),
    
    -- Achievements & Education
    key_achievements     CLOB CHECK (key_achievements IS JSON),
    education_summary    CLOB CHECK (education_summary IS JSON),
    certifications      CLOB CHECK (certifications IS JSON),
    languages           CLOB CHECK (languages IS JSON),
    volunteer_experience CLOB CHECK (volunteer_experience IS JSON),
    
    -- Metadata
    last_regenerated    TIMESTAMP DEFAULT SYSTIMESTAMP,
    created_at         TIMESTAMP DEFAULT SYSTIMESTAMP,
    updated_at         TIMESTAMP DEFAULT SYSTIMESTAMP
);
```

### Level 3: Quick Access Summaries
**Purpose**: Ultra-fast access for real-time features

```sql
CREATE TABLE {user_schema}_quick_summaries (
    summary_id          RAW(16) DEFAULT SYS_GUID() PRIMARY KEY,
    executive_summary   VARCHAR2(500),
    headline           VARCHAR2(200),
    key_skills         CLOB CHECK (key_skills IS JSON),
    years_experience   NUMBER,
    current_role       VARCHAR2(200),
    current_company    VARCHAR2(200),
    industries         CLOB CHECK (industries IS JSON),
    education_level    VARCHAR2(100),
    top_certifications CLOB CHECK (top_certifications IS JSON),
    location          VARCHAR2(200),
    career_goals      CLOB CHECK (career_goals IS JSON),
    unique_value_props CLOB CHECK (unique_value_props IS JSON),
    availability      VARCHAR2(50),
    last_updated      TIMESTAMP DEFAULT SYSTIMESTAMP
);
```

## Security Implementation

### Encryption at Rest

```sql
-- Encrypted fields in user tables
CREATE TABLE cn_users (
    user_id         RAW(16) DEFAULT SYS_GUID() PRIMARY KEY,
    username        VARCHAR2(50) UNIQUE NOT NULL,
    email          VARCHAR2(255) UNIQUE NOT NULL,
    password_hash   VARCHAR2(255) NOT NULL,
    
    -- Encrypted PII
    first_name_encrypted    RAW(2000),
    last_name_encrypted     RAW(2000),
    phone_encrypted         RAW(2000),
    
    -- Encryption metadata
    encryption_key_id       RAW(16),
    encryption_version      VARCHAR2(20) DEFAULT 'AES256-GCM-V1'
);
```

### Audit Logging

```sql
CREATE TABLE cn_audit_log (
    audit_id        RAW(16) DEFAULT SYS_GUID() PRIMARY KEY,
    user_id         RAW(16),
    action          VARCHAR2(100) NOT NULL,
    resource_type   VARCHAR2(50),
    resource_id     VARCHAR2(255),
    request_data    CLOB CHECK (request_data IS JSON),
    response_code   NUMBER,
    execution_time_ms NUMBER,
    ip_address      VARCHAR2(45),
    user_agent      VARCHAR2(500),
    success         NUMBER(1),
    error_message   VARCHAR2(4000),
    timestamp       TIMESTAMP DEFAULT SYSTIMESTAMP,
    
    -- Partitioned by month for performance
    CONSTRAINT audit_log_partition_key 
        CHECK (timestamp >= DATE '2024-01-01')
) PARTITION BY RANGE (timestamp) 
  INTERVAL (NUMTOYMINTERVAL(1, 'MONTH'));
```

## Performance Optimization

### Indexes

```sql
-- Experience search optimization
CREATE INDEX idx_exp_dates ON {user_schema}_experiences_detailed(start_date DESC, end_date);
CREATE INDEX idx_exp_current ON {user_schema}_experiences_detailed(is_current, start_date DESC);
CREATE INDEX idx_exp_type ON {user_schema}_experiences_detailed(experience_type);

-- Full-text search
CREATE INDEX idx_exp_text ON {user_schema}_experiences_detailed(title, organization) 
    INDEXTYPE IS CTXSYS.CONTEXT;

-- Audit log performance
CREATE INDEX idx_audit_user_time ON cn_audit_log(user_id, timestamp DESC);
CREATE INDEX idx_audit_action ON cn_audit_log(action, timestamp DESC);
```

### Materialized Views

```sql
-- User activity summary (refreshed hourly)
CREATE MATERIALIZED VIEW cn_user_activity_summary
REFRESH COMPLETE ON DEMAND
AS
SELECT 
    user_id,
    COUNT(*) as total_actions,
    MAX(timestamp) as last_activity,
    COUNT(DISTINCT TRUNC(timestamp)) as active_days
FROM cn_audit_log
WHERE timestamp >= SYSDATE - 30
GROUP BY user_id;
```

## Data Lifecycle Management

### Retention Policies

1. **Active Data**: Full retention in all three tiers
2. **Archived Data**: After 2 years, move Level 1 to compressed storage
3. **Audit Logs**: 7-year retention per compliance requirements
4. **Deleted Users**: 30-day soft delete, then permanent removal

### Backup Strategy

```sql
-- Backup metadata tracking
CREATE TABLE cn_backup_history (
    backup_id       RAW(16) DEFAULT SYS_GUID() PRIMARY KEY,
    backup_type     VARCHAR2(50), -- FULL, INCREMENTAL, USER_EXPORT
    backup_location VARCHAR2(500),
    encryption_key  RAW(32),
    start_time      TIMESTAMP,
    end_time        TIMESTAMP,
    size_bytes      NUMBER,
    status          VARCHAR2(50),
    error_message   VARCHAR2(4000)
);
```

## Migration Support

### Schema Versioning

```sql
CREATE TABLE cn_schema_versions (
    version_id      NUMBER PRIMARY KEY,
    version_name    VARCHAR2(50),
    description     VARCHAR2(500),
    applied_at      TIMESTAMP DEFAULT SYSTIMESTAMP,
    applied_by      VARCHAR2(100),
    rollback_script CLOB
);
```

## Best Practices

1. **Always use bind variables** to prevent SQL injection
2. **Implement connection pooling** with appropriate limits
3. **Use database jobs** for maintenance tasks
4. **Monitor performance** with Oracle AWR reports
5. **Regular statistics gathering** for query optimization

## Related Documentation

- [Multi-User Architecture](./multi-user-architecture.md)
- [Security Architecture](./security-architecture.md)
- [API Design](../api/README.md)
- [Performance Tuning Guide](../deployment/performance-tuning.md)