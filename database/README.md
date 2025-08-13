# Database Schema Documentation

## Overview

This directory contains the complete database schema definitions for the Pathfinder system. All schemas are written in Oracle SQL syntax for Oracle Autonomous Database.

## Directory Structure

```
database/
├── README.md                 # This file
├── core/                     # Core system tables
│   └── users.sql            # User accounts and profiles
├── security/                 # Security and authentication
│   ├── authentication.sql   # Auth, roles, passwords, MFA
│   └── audit.sql            # Audit logging and compliance
├── user-data/               # Per-user data tables
│   └── experiences.sql      # Career experiences (3-tier model)
├── modules/                 # Feature-specific modules
│   └── cpa-pert.sql        # CPA PERT reporting module
└── reference/               # Reference and lookup tables
```

## Schema Categories

### 1. Core Tables (`/core`)
Primary system tables shared across all users:
- **users.sql**: User accounts, sessions, preferences, profiles
- **configuration.sql**: System configuration, feature flags, rate limits

### 2. Security Tables (`/security`)
Authentication, authorization, and audit:
- **authentication.sql**: Roles, permissions, passwords, tokens, MFA
- **audit.sql**: Comprehensive audit logging, compliance tracking

### 3. User Data Tables (`/user-data`)
Per-user isolated data tables (multi-tenant architecture):
- **experiences.sql**: 3-tier experience model, skills, education, certifications

### 4. Module Tables (`/modules`)
Feature-specific table schemas:
- **cpa-pert.sql**: CPA practical experience reporting

### 5. Reference Tables (`/reference`)
Shared reference data and lookups (future)

## Quick Navigation

| Schema File | Description | Key Tables |
|------------|-------------|------------|
| [core/users.sql](./core/users.sql) | User management | `pf_users`, `pf_user_sessions`, `pf_user_preferences` |
| [core/configuration.sql](./core/configuration.sql) | System configuration | `pf_system_config`, `pf_feature_flags`, `pf_rate_limits` |
| [security/authentication.sql](./security/authentication.sql) | Authentication & authorization | `pf_user_roles`, `pf_user_passwords`, `pf_password_tokens` |
| [security/audit.sql](./security/audit.sql) | Audit & compliance | `pf_audit_log`, `pf_security_events`, `pf_compliance_audit` |
| [user-data/experiences.sql](./user-data/experiences.sql) | Career data | `pf_user_<username>_experiences`, `pf_user_<username>_skills` |
| [modules/cpa-pert.sql](./modules/cpa-pert.sql) | CPA PERT module | `pf_cpa_pert_reports`, `pf_cpa_pert_experiences` |

## Database Architecture

### Multi-User Architecture
The system implements complete data isolation through user-prefixed schemas:
- System tables: `pf_*` (shared)
- User tables: `pf_user_<username>_*` (isolated per user)

### 3-Tier Experience Model
User experiences are stored in three tiers for optimal performance:
1. **Tier 1**: Detailed experiences with full context
2. **Tier 2**: Aggregated profile summaries
3. **Tier 3**: Quick access summaries for rapid retrieval

### Security Features
- Field-level encryption (AES-256-GCM)
- Comprehensive audit logging
- Role-based access control (RBAC)
- Password security with Argon2 hashing
- Token-based password retrieval

## Table Naming Conventions

| Prefix | Usage | Example |
|--------|-------|---------|
| `pf_` | System tables (shared) | `pf_users` |
| `pf_user_<username>_` | User-specific tables | `pf_user_john_doe_experiences` |
| `pf_ref_` | Reference data | `pf_ref_skills_catalog` |
| `pf_cpa_` | CPA module tables | `pf_cpa_pert_reports` |
| `mv_` | Materialized views | `mv_daily_audit_summary` |
| `idx_` | Indexes | `idx_users_username` |

## Data Types Used

| Oracle Type | Usage | Notes |
|------------|-------|-------|
| `VARCHAR2(n)` | Short text | Max 4000 bytes |
| `CLOB` | Long text | JSON data, descriptions |
| `NUMBER(p,s)` | Numbers | Precision and scale |
| `DATE` | Date only | No time component |
| `TIMESTAMP` | Date + time | With timezone support |
| `CHAR(1)` | Flags | Y/N values |

## JSON Storage
Many tables use `CLOB` columns with JSON constraints for flexible data:
```sql
column_name CLOB CHECK (column_name IS JSON)
```

## Security Considerations

### Password Storage
- Never store plain text passwords
- Use `pf_user_passwords` table with Argon2 hashing
- Client-side hashing before transmission
- Server-side additional hashing

### Audit Requirements
All data operations must be logged in `pf_audit_log` with:
- User identification
- Action performed
- Timestamp
- IP address
- Success/failure status

### Data Encryption
Sensitive fields use encryption via `pf_encryption_keys`:
- User-specific encryption keys
- AES-256-GCM algorithm
- Key rotation support

## Usage Examples

### Creating User Tables
When a new user registers, create their isolated schema:
```sql
-- Replace <username> with actual username
CREATE TABLE pf_user_john_doe_experiences AS 
SELECT * FROM pf_user_<username>_experiences WHERE 1=0;
```

### Role Assignment
```sql
INSERT INTO pf_user_roles (user_id, role_name, granted_by)
VALUES ('user-uuid', 'user', 'admin-uuid');
```

### Audit Logging
```sql
INSERT INTO pf_audit_log (
    user_id, action, entity_type, entity_id, ip_address
) VALUES (
    'user-uuid', 'create', 'experience', 'exp-uuid', '192.168.1.1'
);
```

## Migration Path

1. Run schemas in order:
   - core/users.sql
   - security/authentication.sql
   - security/audit.sql
   - modules/* (as needed)

2. For each user, create user-specific tables from templates in user-data/

3. Populate reference data tables

4. Enable audit logging and security features

## Maintenance

### Regular Tasks
- Monitor `pf_audit_log` growth
- Rotate encryption keys quarterly
- Archive old audit records
- Update materialized views

### Performance Optimization
- Ensure all foreign keys have indexes
- Partition large tables by date
- Use materialized views for analytics
- Regular statistics gathering

## Related Documentation

- [Database Architecture](../docs/architecture/database.md)
- [Security Documentation](../docs/api/auth/password-security.md)
- [API Documentation](../docs/api/)
- [Multi-User Architecture](../docs/development/multi-user-architecture.md)