# Pathfinder Database Modeling Documentation

## Overview

Pathfinder implements a sophisticated multi-user, multi-tenant database architecture designed for complete data isolation, HIPAA-level security compliance, and scalability. The system uses Oracle Autonomous Database with a unique user-prefixed schema approach that ensures complete data separation between users while maintaining shared reference data.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Core Design Principles](#core-design-principles)
3. [Database Schemas](#database-schemas)
4. [Entity Relationship Diagrams](#entity-relationship-diagrams)
5. [Security Model](#security-model)
6. [Multi-User Architecture](#multi-user-architecture)
7. [Data Types and Conventions](#data-types-and-conventions)

## Architecture Overview

The database architecture consists of four main schema categories:

1. **System Schema**: Authentication, authorization, and audit logging
2. **Reference Schema**: Shared reference data (skills, career paths, role templates)
3. **User-Specific Schemas**: Isolated data storage for each user
4. **Specialized Module Schemas**: Add-on modules like CPA PERT

### Key Features

- **Complete Data Isolation**: Each user's data is stored in separate, prefixed tables
- **HIPAA Compliance**: Field-level encryption, comprehensive audit logging, and legal hold capabilities
- **Multi-Environment Support**: Separate prefixes for development, staging, and production
- **Scalability**: Designed to support thousands of concurrent users
- **Performance**: Strategic indexing and partitioning for optimal query performance

## Core Design Principles

### 1. Data Isolation by Design
Every user gets their own set of tables with a unique prefix (e.g., `user_john_doe_experiences`), ensuring:
- No possibility of cross-user data access at the database level
- Simplified security model
- Easy user data export/deletion for GDPR compliance

### 2. Encryption at Rest
Sensitive fields are encrypted using AES-256-GCM with user-specific keys:
- Personal information (names, emails)
- Experience descriptions
- Chat messages
- API keys and tokens

### 3. Comprehensive Auditing
Every data access operation is logged with:
- User identification
- Action performed
- Resource accessed
- Timestamp and IP address
- Success/failure status

### 4. Reference Data Sharing
Common data (skills catalog, career paths) is stored in shared tables with:
- Read-only access for users
- Version control for updates
- Industry-standard taxonomies

## Database Schemas

### System Tables (Prefix: `pf_`)

| Table Name | Purpose | Key Features |
|------------|---------|--------------|
| `pf_users` | User accounts | MFA support, account status, preferences |
| `pf_user_sessions` | Active sessions | JWT tokens, expiration, activity tracking |
| `pf_api_keys` | Programmatic access | Rate limiting, permissions, usage tracking |
| `pf_audit_log` | Security audit trail | All operations, immutable, 7-year retention |
| `pf_legal_holds` | Compliance holds | Prevent data deletion for legal requirements |

### Reference Tables (Prefix: `pf_ref_`)

| Table Name | Purpose | Key Features |
|------------|---------|--------------|
| `pf_ref_skills_catalog` | Skills taxonomy | Categories, market demand, related skills |
| `pf_ref_career_paths` | Career progressions | Industry paths, typical roles, requirements |
| `pf_ref_role_templates` | Job role templates | Responsibilities, skills, salary ranges |
| `pf_ref_industry_standards` | Compliance standards | Industry requirements, certifications |

### User-Specific Tables (Prefix: `{username}_`)

| Table Name | Purpose | Key Features |
|------------|---------|--------------|
| `{username}_experiences_detailed` | Work experiences | Full details, skills extraction, achievements |
| `{username}_profile_summaries` | Aggregated profiles | Career summaries, skill consolidation |
| `{username}_conversations` | Chat conversations | AI mentorship sessions, topics |
| `{username}_messages` | Chat messages | Conversation content, metadata |

### CPA PERT Module Tables (Prefix: `pf_cpa_`)

| Table Name | Purpose | Key Features |
|------------|---------|--------------|
| `pf_cpa_competencies` | CPA competency framework | Official competencies, proficiency levels |
| `pf_cpa_competency_mappings` | Experience mappings | Link experiences to competencies |
| `pf_cpa_pert_responses` | PERT report responses | STAR format responses, compliance |
| `pf_cpa_proficiency_assessments` | Skill assessments | Current/target levels, evidence |

## Entity Relationship Diagrams

### System and User Management ERD

![System ERD](./assets/system-erd.png)

[View detailed System ERD](./diagrams/system-relationships.md)

### User Experience Management ERD

![Experience ERD](./assets/experience-erd.png)

[View detailed Experience ERD](./diagrams/experience-relationships.md)

### Chat and Conversation ERD

![Chat ERD](./assets/chat-erd.png)

[View detailed Chat ERD](./diagrams/chat-relationships.md)

### CPA PERT Module ERD

![CPA PERT ERD](./assets/cpa-pert-erd.png)

[View detailed CPA PERT ERD](./diagrams/cpa-pert-relationships.md)

## Security Model

### Authentication & Authorization

1. **Multi-Factor Authentication (MFA)**
   - TOTP-based second factor
   - Backup codes for recovery
   - Optional biometric support

2. **JWT Token Management**
   - 15-minute access token expiry
   - Secure refresh token rotation
   - Session invalidation on logout

3. **API Key Security**
   - Scoped permissions
   - Rate limiting per key
   - Usage analytics and monitoring

### Encryption Strategy

1. **Field-Level Encryption**
   - User-specific encryption keys
   - Key rotation support
   - Hardware security module (HSM) compatible

2. **Transport Security**
   - TLS 1.3 minimum
   - Certificate pinning for mobile apps
   - Perfect forward secrecy

### Access Control

1. **Row-Level Security (RLS)**
   - Oracle VPD policies
   - Context-based filtering
   - Automatic user isolation

2. **Role-Based Access Control (RBAC)**
   - Predefined roles (user, admin, auditor)
   - Granular permissions
   - Principle of least privilege

## Multi-User Architecture

### User Onboarding Flow

```sql
-- 1. Create user account
INSERT INTO pf_users (username, email, schema_prefix) 
VALUES ('john_doe', 'john@example.com', 'user_john_doe');

-- 2. Create user-specific schema tables
CREATE TABLE user_john_doe_experiences_detailed (...);
CREATE TABLE user_john_doe_profile_summaries (...);
CREATE TABLE user_john_doe_conversations (...);

-- 3. Set up encryption keys
INSERT INTO pf_encryption_keys (user_id, key_data, key_version)
VALUES (:user_id, :encrypted_key, 1);

-- 4. Initialize audit logging
INSERT INTO pf_audit_log (user_id, action, resource_type)
VALUES (:user_id, 'USER_CREATED', 'USER_ACCOUNT');
```

### Data Access Patterns

All queries are automatically scoped to the user's schema:

```sql
-- Repository pattern ensures user isolation
SELECT * FROM {userPrefix}_experiences_detailed
WHERE experience_id = :id;

-- Cross-user queries are impossible by design
-- This will fail: no direct table access
SELECT * FROM user_jane_doe_experiences_detailed; -- Error
```

## Data Types and Conventions

### Standard Column Types

| Data Type | Usage | Example Columns |
|-----------|-------|-----------------|
| `RAW(16)` | Primary keys (GUIDs) | `user_id`, `experience_id` |
| `VARCHAR2` | Short text | `username`, `email`, `title` |
| `CLOB` | Long text | `description`, `content`, `metadata` |
| `JSON` | Structured data | `preferences`, `skills`, `achievements` |
| `TIMESTAMP` | Date/time with timezone | `created_at`, `updated_at` |
| `NUMBER` | Numeric values | `salary`, `team_size`, `score` |

### Naming Conventions

1. **Tables**: Lowercase with underscores (e.g., `user_sessions`)
2. **Columns**: Lowercase with underscores (e.g., `created_at`)
3. **Indexes**: `idx_{table}_{columns}` (e.g., `idx_users_email`)
4. **Constraints**: `{type}_{table}_{column}` (e.g., `fk_sessions_user`)
5. **Triggers**: `trg_{table}_{action}` (e.g., `trg_users_update`)

### Common Column Standards

Every table includes these audit columns:
- `created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`
- `updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`
- `environment VARCHAR2(50)` - Track dev/staging/prod

## Best Practices

### Performance Optimization

1. **Indexing Strategy**
   - Index foreign keys
   - Composite indexes for common queries
   - Avoid over-indexing CLOB columns

2. **Query Optimization**
   - Use bind variables
   - Implement pagination
   - Cache reference data

3. **Data Archival**
   - Archive old conversations after 1 year
   - Compress audit logs after 90 days
   - Separate OLTP and OLAP workloads

### Security Best Practices

1. **Never store plaintext passwords**
2. **Always use parameterized queries**
3. **Implement least privilege access**
4. **Regular security audits**
5. **Monitor for suspicious patterns**

### Development Guidelines

1. **Migration Scripts**
   - Always include rollback procedures
   - Test in development first
   - Version control all changes

2. **Data Validation**
   - Implement database constraints
   - Validate at application layer too
   - Use check constraints for enums

3. **Documentation**
   - Document all schema changes
   - Maintain data dictionary
   - Include examples in comments

## Related Documentation

- [Multi-User Architecture Details](../development/multi-user-architecture.md)
- [Security Implementation Guide](../deployment/security-guide.md)
- [Database Migration Guide](../development/database-migrations.md)
- [API Data Access Patterns](../development/api-patterns.md)