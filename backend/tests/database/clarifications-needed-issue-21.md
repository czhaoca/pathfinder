# Clarifications Needed - Issue #21 Database Schema Optimization

## CLARIFICATION REQUESTS

### 1. Audit Triggers Implementation
**Document**: `/work/pathfinder/docs/issues/issue-21-database-schema-optimization.md`
**Section**: Acceptance Criteria - Data Integrity
**Ambiguity**: "Audit triggers for all user-related tables" is listed but not detailed

**Possible interpretations**:
1. Create database triggers that log all INSERT/UPDATE/DELETE operations to `pf_audit_log`
2. Implement application-level auditing through the API layer
3. Use Oracle's built-in auditing features (AUDIT command)
4. Create a separate audit schema with shadow tables

**Recommendation**: Implement database triggers for critical tables (users, sessions, permissions) that capture:
- Operation type (INSERT/UPDATE/DELETE)
- Before and after values for UPDATE
- User performing the operation
- Timestamp
- Client IP address if available

### 2. Performance Metrics Validation
**Document**: `/work/pathfinder/docs/issues/issue-21-database-schema-optimization.md`
**Section**: Performance Metrics
**Ambiguity**: Target metrics are specified but validation method is unclear

**Questions**:
1. Should performance tests be automated as part of CI/CD?
2. What is the baseline data volume for performance testing?
3. Should we implement performance monitoring in production?
4. What are acceptable degradation thresholds?

**Recommendation**: Create performance benchmark suite that:
- Runs nightly with production-like data volumes
- Alerts when metrics exceed thresholds
- Maintains historical performance trends

### 3. Materialized View Refresh Strategy
**Document**: Implementation in `user-tables.js`
**Section**: Materialized View `pf_mv_user_stats`
**Ambiguity**: Refresh strategy is set to "ON DEMAND" but refresh schedule not specified

**Questions**:
1. How frequently should the materialized view be refreshed?
2. Should refresh be triggered by events or scheduled?
3. What is the acceptable staleness window?
4. Should we implement incremental refresh?

**Recommendation**: 
- Daily refresh during off-peak hours (2 AM)
- Manual refresh trigger after bulk operations
- Consider FAST refresh if change logs are acceptable

### 4. Partition Maintenance Strategy
**Document**: `/work/pathfinder/docs/issues/issue-21-database-schema-optimization.md`
**Section**: User Analytics Table
**Ambiguity**: Daily interval partitioning specified but maintenance not detailed

**Questions**:
1. How long should partitions be retained?
2. Should old partitions be archived or dropped?
3. Who manages partition maintenance?
4. Should we implement automatic partition compression?

**Recommendation**:
- 90-day online retention
- Archive partitions older than 90 days to cold storage
- Implement automated monthly partition maintenance job
- Compress partitions older than 30 days

### 5. Connection Pool Configuration
**Document**: `/work/pathfinder/docs/issues/issue-21-database-schema-optimization.md`
**Section**: Performance Optimization
**Ambiguity**: "Connection pool optimization" mentioned but not specified

**Questions**:
1. What are the specific pool size parameters?
2. Should pools be separated by operation type (read/write)?
3. What are the timeout values?
4. Should we implement connection pooling at app or database level?

**Recommendation**:
```javascript
{
  min: 10,           // Minimum connections
  max: 100,          // Maximum connections
  increment: 5,      // Connection increment
  timeout: 60,       // Connection timeout (seconds)
  idleTimeout: 300,  // Idle connection timeout
  queueTimeout: 60   // Queue timeout
}
```

### 6. JSON Field Size Limits
**Document**: Implementation shows CLOB with JSON constraint
**Section**: Various JSON fields
**Ambiguity**: No size limits specified for JSON data

**Questions**:
1. Should we enforce maximum JSON document size?
2. What is the maximum nesting depth allowed?
3. Should we validate JSON schema beyond syntax?
4. How to handle large JSON arrays?

**Recommendation**:
- 1MB maximum JSON document size
- Maximum nesting depth of 10 levels
- Implement JSON schema validation for known structures
- Consider JSON binary format (OSON) for performance

### 7. SSO Provider Configuration
**Document**: `pf_sso_accounts` table
**Section**: SSO Implementation
**Ambiguity**: Provider field is VARCHAR2(50) but supported providers not listed

**Questions**:
1. Which OAuth providers will be supported initially?
2. Should provider be an enum or free text?
3. How to handle provider-specific fields?
4. Should we support custom OAuth providers?

**Recommendation**:
- Initial support: Google, Microsoft, GitHub, LinkedIn
- Use check constraint for known providers
- Store provider-specific data in profile_data JSON
- Allow custom providers with "custom:" prefix

### 8. Feature Flag Evaluation Order
**Document**: Feature flags implementation
**Section**: User and group overrides
**Ambiguity**: Priority between user-specific and group overrides unclear

**Questions**:
1. Does user-specific override take precedence over group?
2. How to handle multiple group memberships?
3. Should flags support inheritance?
4. What is the evaluation order for nested flags?

**Recommendation**:
Evaluation order (highest to lowest priority):
1. User-specific override with unexpired timestamp
2. User's primary group override
3. User's secondary groups (by priority field)
4. System-wide flag value
5. Default value

## DOCUMENTATION UPDATES NEEDED

Based on the clarifications above, the following documentation should be updated:

1. **Database Architecture** (`/work/pathfinder/docs/architecture/database.md`)
   - Add audit trigger specifications
   - Document partition maintenance procedures
   - Include materialized view refresh strategy

2. **Performance Guide** (Create new: `/work/pathfinder/docs/deployment/performance-tuning.md`)
   - Connection pool configuration
   - Index maintenance procedures
   - Query optimization guidelines

3. **Security Guide** (`/work/pathfinder/docs/deployment/security.md`)
   - JSON validation rules
   - Audit log retention policies
   - SSO provider security requirements

4. **Operations Manual** (Create new: `/work/pathfinder/docs/operations/database-maintenance.md`)
   - Partition management procedures
   - Materialized view refresh schedule
   - Performance monitoring setup

## PRIORITY CLARIFICATIONS

**MUST HAVE** (Block implementation):
1. Audit trigger specifications
2. Feature flag evaluation order

**SHOULD HAVE** (Can proceed with assumptions):
3. Materialized view refresh strategy
4. Partition maintenance strategy
5. Connection pool configuration

**NICE TO HAVE** (Can be decided later):
6. JSON field size limits
7. SSO provider configuration
8. Performance metrics validation

---
Generated: 2025-08-17
QA Engineer: Claude Code Assistant