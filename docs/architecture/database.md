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

### User Management (Enhanced)

```sql
-- Extended user accounts table with profile fields
CREATE TABLE pf_users (
    user_id VARCHAR2(26) DEFAULT SYS_GUID() PRIMARY KEY,
    username VARCHAR2(50) UNIQUE NOT NULL,
    email VARCHAR2(255) UNIQUE NOT NULL,
    password_hash VARCHAR2(255) NOT NULL,
    first_name VARCHAR2(100),
    last_name VARCHAR2(100),
    account_status VARCHAR2(20) DEFAULT 'active',
    mfa_enabled CHAR(1) DEFAULT 'N',
    mfa_secret VARCHAR2(255),
    email_verified CHAR(1) DEFAULT 'N',
    
    -- Extended profile fields
    phone_number VARCHAR2(20),
    phone_verified CHAR(1) DEFAULT 'N',
    avatar_url VARCHAR2(500),
    bio CLOB,
    timezone VARCHAR2(50) DEFAULT 'UTC',
    language VARCHAR2(10) DEFAULT 'en',
    date_of_birth DATE,
    gender VARCHAR2(20),
    nationality VARCHAR2(100),
    
    -- Professional info
    current_title VARCHAR2(200),
    current_company VARCHAR2(200),
    years_experience NUMBER(3,1),
    
    -- Invitation and feature management
    invited_by VARCHAR2(26),
    invitation_accepted_at TIMESTAMP,
    feature_group_id VARCHAR2(26),
    
    -- Analytics tracking
    last_activity_at TIMESTAMP,
    total_logins NUMBER(10) DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP
);

-- User sessions for JWT management
CREATE TABLE pf_user_sessions (
    session_id VARCHAR2(26) DEFAULT SYS_GUID() PRIMARY KEY,
    user_id VARCHAR2(26) NOT NULL,
    token VARCHAR2(500) UNIQUE NOT NULL,
    refresh_token VARCHAR2(500) UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    refresh_expires_at TIMESTAMP,
    ip_address VARCHAR2(45),
    user_agent VARCHAR2(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active CHAR(1) DEFAULT 'Y',
    FOREIGN KEY (user_id) REFERENCES pf_users(user_id) ON DELETE CASCADE
);

-- User invitations management
CREATE TABLE pf_user_invitations (
    invitation_id VARCHAR2(26) DEFAULT SYS_GUID() PRIMARY KEY,
    email VARCHAR2(255) NOT NULL,
    invitation_token VARCHAR2(255) UNIQUE NOT NULL,
    invited_by VARCHAR2(26) NOT NULL,
    role VARCHAR2(50) DEFAULT 'user',
    feature_group_id VARCHAR2(26),
    expires_at TIMESTAMP NOT NULL,
    accepted_at TIMESTAMP,
    declined_at TIMESTAMP,
    reminder_sent_at TIMESTAMP,
    metadata CLOB CHECK (metadata IS JSON),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (invited_by) REFERENCES pf_users(user_id) ON DELETE CASCADE
);

-- SSO account linking
CREATE TABLE pf_sso_accounts (
    sso_account_id VARCHAR2(26) DEFAULT SYS_GUID() PRIMARY KEY,
    user_id VARCHAR2(26) NOT NULL,
    provider VARCHAR2(50) NOT NULL,
    provider_user_id VARCHAR2(255) NOT NULL,
    email VARCHAR2(255),
    display_name VARCHAR2(255),
    avatar_url VARCHAR2(500),
    access_token VARCHAR2(2000),
    refresh_token VARCHAR2(2000),
    token_expires_at TIMESTAMP,
    profile_data CLOB CHECK (profile_data IS JSON),
    linked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_sync_at TIMESTAMP,
    is_primary CHAR(1) DEFAULT 'N',
    FOREIGN KEY (user_id) REFERENCES pf_users(user_id) ON DELETE CASCADE,
    UNIQUE (provider, provider_user_id)
);

-- Feature flags system
CREATE TABLE pf_feature_flags (
    flag_id VARCHAR2(26) DEFAULT SYS_GUID() PRIMARY KEY,
    flag_key VARCHAR2(100) UNIQUE NOT NULL,
    flag_name VARCHAR2(200) NOT NULL,
    description CLOB,
    flag_type VARCHAR2(50) DEFAULT 'boolean',
    default_value VARCHAR2(500),
    allowed_values CLOB CHECK (allowed_values IS JSON),
    is_system_wide CHAR(1) DEFAULT 'N',
    requires_restart CHAR(1) DEFAULT 'N',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User groups for feature management
CREATE TABLE pf_user_groups (
    group_id VARCHAR2(26) DEFAULT SYS_GUID() PRIMARY KEY,
    group_name VARCHAR2(100) UNIQUE NOT NULL,
    description CLOB,
    is_default CHAR(1) DEFAULT 'N',
    priority NUMBER(5) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User-specific feature flag overrides
CREATE TABLE pf_user_feature_flags (
    override_id VARCHAR2(26) DEFAULT SYS_GUID() PRIMARY KEY,
    user_id VARCHAR2(26),
    group_id VARCHAR2(26),
    flag_id VARCHAR2(26) NOT NULL,
    override_value VARCHAR2(500),
    reason VARCHAR2(500),
    expires_at TIMESTAMP,
    created_by VARCHAR2(26),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES pf_users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (group_id) REFERENCES pf_user_groups(group_id) ON DELETE CASCADE,
    FOREIGN KEY (flag_id) REFERENCES pf_feature_flags(flag_id) ON DELETE CASCADE,
    CHECK ((user_id IS NOT NULL AND group_id IS NULL) OR 
           (user_id IS NULL AND group_id IS NOT NULL))
);

-- User analytics with partitioning
CREATE TABLE pf_user_analytics (
    analytics_id VARCHAR2(26) DEFAULT SYS_GUID() PRIMARY KEY,
    user_id VARCHAR2(26) NOT NULL,
    event_type VARCHAR2(100) NOT NULL,
    event_data CLOB CHECK (event_data IS JSON),
    session_id VARCHAR2(26),
    ip_address VARCHAR2(45),
    user_agent VARCHAR2(500),
    referrer VARCHAR2(500),
    page_url VARCHAR2(500),
    event_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES pf_users(user_id) ON DELETE CASCADE
) PARTITION BY RANGE (event_timestamp) 
  INTERVAL (NUMTODSINTERVAL(1, 'DAY'))
  (PARTITION p_initial VALUES LESS THAN (DATE '2025-01-01'));

-- User preferences (extended profile)
CREATE TABLE pf_user_preferences (
    preference_id VARCHAR2(26) DEFAULT SYS_GUID() PRIMARY KEY,
    user_id VARCHAR2(26) UNIQUE NOT NULL,
    notification_preferences CLOB CHECK (notification_preferences IS JSON),
    privacy_settings CLOB CHECK (privacy_settings IS JSON),
    ui_preferences CLOB CHECK (ui_preferences IS JSON),
    communication_preferences CLOB CHECK (communication_preferences IS JSON),
    feature_preferences CLOB CHECK (feature_preferences IS JSON),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES pf_users(user_id) ON DELETE CASCADE
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

### CPA PERT Module (Enhanced)

The CPA PERT module uses shared tables with robust tracking capabilities:

```sql
-- PERT Reports with time periods
CREATE TABLE pf_cpa_pert_reports (
    id VARCHAR2(26) PRIMARY KEY,
    user_id VARCHAR2(26) NOT NULL,
    report_period_start DATE NOT NULL,
    report_period_end DATE NOT NULL,
    submission_deadline DATE,
    route_type VARCHAR2(5) CHECK (route_type IN ('EVR','PPR')),
    status VARCHAR2(20) DEFAULT 'draft',
    employer_name VARCHAR2(255),
    position_title VARCHAR2(255),
    hours_worked NUMBER(7,2),
    version NUMBER(5) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- PERT Experiences with date ranges
CREATE TABLE pf_cpa_pert_experiences (
    id VARCHAR2(26) PRIMARY KEY,
    report_id VARCHAR2(26) NOT NULL,
    sub_competency_id VARCHAR2(26) NOT NULL,
    experience_title VARCHAR2(500) NOT NULL,
    experience_start_date DATE NOT NULL,
    experience_end_date DATE NOT NULL,
    duration_days NUMBER(10) GENERATED ALWAYS AS 
        (experience_end_date - experience_start_date + 1) VIRTUAL,
    proficiency_level NUMBER(1) CHECK (proficiency_level IN (0,1,2)),
    challenge CLOB NOT NULL,
    actions CLOB NOT NULL,
    results CLOB NOT NULL,
    lessons_learned CLOB NOT NULL,
    time_spent_hours NUMBER(7,2),
    complexity_level VARCHAR2(20),
    word_count NUMBER(10),
    approval_status VARCHAR2(20) DEFAULT 'pending',
    version NUMBER(5) DEFAULT 1,
    previous_version_id VARCHAR2(26),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Experience Activity Breakdown
CREATE TABLE pf_cpa_experience_breakdown (
    id VARCHAR2(26) PRIMARY KEY,
    experience_id VARCHAR2(26) NOT NULL,
    activity_type VARCHAR2(50) CHECK (activity_type IN 
        ('planning','execution','review','documentation',
         'analysis','presentation','training')),
    activity_description CLOB NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    hours_spent NUMBER(7,2) NOT NULL,
    competencies_demonstrated CLOB CHECK (competencies_demonstrated IS JSON),
    deliverables CLOB CHECK (deliverables IS JSON),
    business_impact VARCHAR2(1000),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Progress Milestones
CREATE TABLE pf_cpa_progress_milestones (
    id VARCHAR2(26) PRIMARY KEY,
    user_id VARCHAR2(26) NOT NULL,
    sub_competency_id VARCHAR2(26) NOT NULL,
    milestone_date DATE NOT NULL,
    previous_level NUMBER(1),
    achieved_level NUMBER(1) NOT NULL CHECK (achieved_level IN (0,1,2)),
    evidence_count NUMBER(10) DEFAULT 0,
    hours_accumulated NUMBER(10,2) DEFAULT 0,
    key_experiences CLOB CHECK (key_experiences IS JSON),
    mentor_feedback CLOB,
    self_assessment CLOB,
    next_steps CLOB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- CPA Submissions with Complete Tracking
CREATE TABLE pf_cpa_pert_submissions (
    id VARCHAR2(26) PRIMARY KEY,
    report_id VARCHAR2(26) NOT NULL,
    user_id VARCHAR2(26) NOT NULL,
    submission_type VARCHAR2(20) CHECK (submission_type IN 
        ('draft','final','revision')),
    submission_deadline DATE,
    submission_status VARCHAR2(20) DEFAULT 'pending',
    cpa_reference_number VARCHAR2(100),
    cpa_confirmation_code VARCHAR2(100),
    reviewer_id VARCHAR2(100),
    reviewer_comments CLOB,
    submitted_payload CLOB CHECK (submitted_payload IS JSON),
    experience_count NUMBER(10),
    total_word_count NUMBER(10),
    exported_file_url VARCHAR2(1000),
    exported_file_format VARCHAR2(20),
    submission_checksum VARCHAR2(64),
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Submission History Audit Trail
CREATE TABLE pf_cpa_submission_history (
    id VARCHAR2(26) PRIMARY KEY,
    submission_id VARCHAR2(26) NOT NULL,
    report_id VARCHAR2(26) NOT NULL,
    user_id VARCHAR2(26) NOT NULL,
    action VARCHAR2(50) CHECK (action IN 
        ('created','submitted','reviewed','accepted',
         'rejected','revised','withdrawn')),
    action_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    action_by VARCHAR2(26),
    action_details CLOB,
    previous_status VARCHAR2(20),
    new_status VARCHAR2(20),
    attachments CLOB CHECK (attachments IS JSON)
);

-- Time Tracking for Experiences
CREATE TABLE pf_cpa_experience_time_tracking (
    id VARCHAR2(26) PRIMARY KEY,
    experience_id VARCHAR2(26) NOT NULL,
    user_id VARCHAR2(26) NOT NULL,
    activity_date DATE NOT NULL,
    hours_logged NUMBER(4,2) CHECK (hours_logged > 0 AND hours_logged <= 24),
    activity_category VARCHAR2(50),
    description VARCHAR2(1000),
    is_billable CHAR(1) DEFAULT 'Y',
    is_cpa_eligible CHAR(1) DEFAULT 'Y',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (experience_id, activity_date)
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

### Primary Indexes (Enhanced)

```sql
-- User lookup and search
CREATE INDEX idx_users_username ON pf_users(username);
CREATE INDEX idx_users_email ON pf_users(email);
CREATE INDEX idx_users_email_verified ON pf_users(email_verified);
CREATE INDEX idx_users_invited_by ON pf_users(invited_by);
CREATE INDEX idx_users_last_activity ON pf_users(last_activity_at);
CREATE INDEX idx_users_feature_group ON pf_users(feature_group_id);

-- Composite search index
CREATE INDEX idx_users_search ON pf_users(
    LOWER(username), LOWER(email), LOWER(first_name), LOWER(last_name)
);

-- Filtered index for active users
CREATE INDEX idx_users_active_recent ON pf_users(
    CASE WHEN account_status = 'active' THEN account_status END,
    last_activity_at
);

-- Invitation indexes
CREATE INDEX idx_invitation_email ON pf_user_invitations(email);
CREATE INDEX idx_invitation_token ON pf_user_invitations(invitation_token);
CREATE INDEX idx_invitation_expires ON pf_user_invitations(expires_at);

-- SSO indexes
CREATE INDEX idx_sso_user ON pf_sso_accounts(user_id);
CREATE INDEX idx_sso_provider ON pf_sso_accounts(provider);

-- Feature flag indexes
CREATE INDEX idx_flag_key ON pf_feature_flags(flag_key);
CREATE INDEX idx_flag_system ON pf_feature_flags(is_system_wide);
CREATE INDEX idx_uff_user ON pf_user_feature_flags(user_id);
CREATE INDEX idx_uff_group ON pf_user_feature_flags(group_id);
CREATE INDEX idx_uff_flag ON pf_user_feature_flags(flag_id);

-- Analytics indexes (local partitioned)
CREATE INDEX idx_analytics_user ON pf_user_analytics(user_id) LOCAL;
CREATE INDEX idx_analytics_event ON pf_user_analytics(event_type) LOCAL;
CREATE INDEX idx_analytics_timestamp ON pf_user_analytics(event_timestamp) LOCAL;
CREATE INDEX idx_analytics_user_date ON pf_user_analytics(
    user_id, event_timestamp
) LOCAL;

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
-- User statistics materialized view
CREATE MATERIALIZED VIEW pf_mv_user_stats 
BUILD IMMEDIATE
REFRESH COMPLETE ON DEMAND AS
SELECT 
    u.user_id,
    u.username,
    COUNT(DISTINCT a.session_id) as total_sessions,
    COUNT(a.analytics_id) as total_events,
    MAX(a.event_timestamp) as last_activity,
    MIN(a.event_timestamp) as first_activity
FROM pf_users u
LEFT JOIN pf_user_analytics a ON u.user_id = a.user_id
GROUP BY u.user_id, u.username;

-- Index on materialized view
CREATE INDEX idx_mv_user_stats_activity ON pf_mv_user_stats(last_activity);

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