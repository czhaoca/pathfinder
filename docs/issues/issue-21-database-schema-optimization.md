# Issue #21: Database Schema Optimization for User Management

## Title
Database Schema Optimization for Enhanced User Management and Performance

## User Story
As a system architect, I want to optimize the database schema for user management so that the platform can efficiently handle enterprise-scale user operations with advanced features like invitations, SSO, and feature flags.

## Description
Redesign and optimize the user management database schema to support advanced features including invitation workflows, SSO account linking, feature flag management, and analytics tracking. This optimization will prepare the database for enterprise-scale operations while maintaining our HIPAA-level security standards.

## Acceptance Criteria

### Schema Design
- [ ] Extended `pf_users` table with additional profile fields and metadata
- [ ] New `pf_user_invitations` table for invitation workflow management
- [ ] New `pf_sso_accounts` table for OAuth provider account linking
- [ ] New `pf_feature_flags` table for feature flag definitions
- [ ] New `pf_user_feature_flags` table for user-specific feature overrides
- [ ] New `pf_user_groups` table for group-based feature management
- [ ] New `pf_user_analytics` table for activity tracking
- [ ] New `pf_user_preferences` table for extended profile data

### Performance Optimization
- [ ] Composite indexes on frequently queried field combinations
- [ ] Partitioning strategy for analytics tables by date
- [ ] Materialized views for user statistics and metrics
- [ ] Query optimization for user search and filtering
- [ ] Connection pool optimization for concurrent user operations

### Data Integrity
- [ ] Foreign key constraints with appropriate cascade rules
- [ ] Check constraints for data validation
- [ ] Unique constraints on business keys
- [ ] Default values for all new fields
- [ ] Audit triggers for all user-related tables

## Technical Implementation

### Database Changes

```sql
-- Enhanced users table
ALTER TABLE pf_users ADD (
  -- Profile fields
  phone_number VARCHAR2(20),
  phone_verified CHAR(1) DEFAULT 'N' CHECK (phone_verified IN ('Y', 'N')),
  avatar_url VARCHAR2(500),
  bio CLOB,
  timezone VARCHAR2(50) DEFAULT 'UTC',
  language VARCHAR2(10) DEFAULT 'en',
  
  -- Extended profile
  date_of_birth DATE,
  gender VARCHAR2(20),
  nationality VARCHAR2(100),
  
  -- Professional info
  current_title VARCHAR2(200),
  current_company VARCHAR2(200),
  years_experience NUMBER(3,1),
  
  -- Invitation tracking
  invited_by VARCHAR2(26),
  invitation_accepted_at TIMESTAMP,
  
  -- Feature flags
  feature_group_id VARCHAR2(26),
  
  -- Analytics
  last_activity_at TIMESTAMP,
  total_logins NUMBER(10) DEFAULT 0,
  
  -- Indexes
  INDEX idx_users_email_verified (email_verified),
  INDEX idx_users_invited_by (invited_by),
  INDEX idx_users_last_activity (last_activity_at),
  INDEX idx_users_feature_group (feature_group_id)
);

-- User invitations table
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
  CONSTRAINT fk_invitation_inviter FOREIGN KEY (invited_by) 
    REFERENCES pf_users(user_id) ON DELETE CASCADE,
  INDEX idx_invitation_email (email),
  INDEX idx_invitation_token (invitation_token),
  INDEX idx_invitation_expires (expires_at)
);

-- SSO accounts table
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
  is_primary CHAR(1) DEFAULT 'N' CHECK (is_primary IN ('Y', 'N')),
  CONSTRAINT fk_sso_user FOREIGN KEY (user_id) 
    REFERENCES pf_users(user_id) ON DELETE CASCADE,
  UNIQUE (provider, provider_user_id),
  INDEX idx_sso_user (user_id),
  INDEX idx_sso_provider (provider)
);

-- Feature flags table
CREATE TABLE pf_feature_flags (
  flag_id VARCHAR2(26) DEFAULT SYS_GUID() PRIMARY KEY,
  flag_key VARCHAR2(100) UNIQUE NOT NULL,
  flag_name VARCHAR2(200) NOT NULL,
  description CLOB,
  flag_type VARCHAR2(50) DEFAULT 'boolean',
  default_value VARCHAR2(500),
  allowed_values CLOB CHECK (allowed_values IS JSON),
  is_system_wide CHAR(1) DEFAULT 'N' CHECK (is_system_wide IN ('Y', 'N')),
  requires_restart CHAR(1) DEFAULT 'N' CHECK (requires_restart IN ('Y', 'N')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_flag_key (flag_key),
  INDEX idx_flag_system (is_system_wide)
);

-- User feature groups
CREATE TABLE pf_user_groups (
  group_id VARCHAR2(26) DEFAULT SYS_GUID() PRIMARY KEY,
  group_name VARCHAR2(100) UNIQUE NOT NULL,
  description CLOB,
  is_default CHAR(1) DEFAULT 'N' CHECK (is_default IN ('Y', 'N')),
  priority NUMBER(5) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User feature flag overrides
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
  CONSTRAINT fk_uff_user FOREIGN KEY (user_id) 
    REFERENCES pf_users(user_id) ON DELETE CASCADE,
  CONSTRAINT fk_uff_group FOREIGN KEY (group_id) 
    REFERENCES pf_user_groups(group_id) ON DELETE CASCADE,
  CONSTRAINT fk_uff_flag FOREIGN KEY (flag_id) 
    REFERENCES pf_feature_flags(flag_id) ON DELETE CASCADE,
  CHECK ((user_id IS NOT NULL AND group_id IS NULL) OR 
         (user_id IS NULL AND group_id IS NOT NULL)),
  INDEX idx_uff_user (user_id),
  INDEX idx_uff_group (group_id),
  INDEX idx_uff_flag (flag_id)
);

-- User analytics table
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
  CONSTRAINT fk_analytics_user FOREIGN KEY (user_id) 
    REFERENCES pf_users(user_id) ON DELETE CASCADE,
  INDEX idx_analytics_user (user_id),
  INDEX idx_analytics_event (event_type),
  INDEX idx_analytics_timestamp (event_timestamp)
) PARTITION BY RANGE (event_timestamp) 
  INTERVAL (NUMTODSINTERVAL(1, 'DAY'))
  (PARTITION p_initial VALUES LESS THAN (DATE '2025-01-01'));

-- User preferences (lazy-loaded extended profile)
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
  CONSTRAINT fk_preferences_user FOREIGN KEY (user_id) 
    REFERENCES pf_users(user_id) ON DELETE CASCADE
);
```

### Optimization Indexes

```sql
-- Composite indexes for common queries
CREATE INDEX idx_users_search ON pf_users(
  LOWER(username), LOWER(email), LOWER(first_name), LOWER(last_name)
);

CREATE INDEX idx_users_active_recent ON pf_users(
  account_status, last_activity_at DESC
) WHERE account_status = 'active';

CREATE INDEX idx_analytics_user_date ON pf_user_analytics(
  user_id, event_timestamp DESC
);

-- Materialized view for user statistics
CREATE MATERIALIZED VIEW pf_mv_user_stats 
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
CREATE INDEX idx_mv_user_stats_activity ON pf_mv_user_stats(last_activity DESC);
```

## Security Considerations

1. **Data Encryption**
   - All sensitive fields (tokens, SSO credentials) must be encrypted at rest
   - Use field-level encryption for PII in extended profile fields
   - Implement key rotation for invitation tokens

2. **Access Control**
   - Row-level security policies for multi-tenant isolation
   - Separate read/write permissions for analytics data
   - Admin-only access to feature flag management

3. **Audit Trail**
   - Log all schema changes and user modifications
   - Track invitation lifecycle events
   - Monitor SSO linking/unlinking activities

4. **Data Validation**
   - Email format validation at database level
   - Phone number format validation
   - Date range checks for analytics partitions

## Performance Metrics

- Target query response time: < 100ms for user lookup
- Index efficiency: > 90% for all composite indexes
- Partition pruning effectiveness: > 80% for analytics queries
- Connection pool utilization: < 70% under normal load

## Dependencies

- No existing migrations (pre-deployment phase)
- Oracle Autonomous Database 19c or higher
- Partitioning option enabled
- JSON support enabled

## Rollback Plan

Since this is pre-deployment, no rollback needed. However, maintain:
- DDL scripts for all schema changes
- Index creation scripts separate from table creation
- Partition management procedures

## Testing Requirements

1. **Load Testing**
   - Simulate 100,000 concurrent users
   - Test partition performance with 1 year of analytics data
   - Validate index performance under load

2. **Security Testing**
   - Verify encryption of sensitive fields
   - Test row-level security policies
   - Validate audit logging completeness

3. **Integration Testing**
   - Test foreign key constraints
   - Verify cascade operations
   - Validate JSON field constraints

## Documentation Updates

- Update database schema documentation
- Create data dictionary for new tables
- Document partitioning strategy
- Update backup/recovery procedures

## Estimated Effort

**Large (L)** - 3-5 days

### Justification:
- Complex schema design with multiple new tables
- Performance optimization requires careful planning
- Partitioning strategy implementation
- Comprehensive testing requirements

## Priority

**High** - This forms the foundation for all subsequent user management features

## Labels

- `database`
- `performance`
- `security`
- `user-management`
- `pre-deployment`