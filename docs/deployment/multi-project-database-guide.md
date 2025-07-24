# Multi-Project Database Usage Guide

## Overview

Career Navigator is designed to coexist with other projects in shared Oracle Autonomous Database environments. This guide explains how to deploy, configure, and manage Career Navigator alongside other applications while maintaining complete data isolation and security.

## Architecture Overview

### Project Isolation Strategy

Career Navigator implements multiple layers of isolation for shared database environments:

1. **Table Prefixing**: All Career Navigator tables use the prefix `cn_` (configurable)
2. **Environment Separation**: Development and production use separate table prefixes and tablespaces
3. **Schema Isolation**: User data is stored in user-prefixed schemas
4. **Access Control**: Role-based access control with Row Level Security (RLS)
5. **Virtual Private Database**: Environment and project-level data isolation

### Database Structure

```
Oracle Autonomous Database (Shared)
├── Career Navigator Development (cn_dev_*)
│   ├── System Tables (cn_users, cn_user_sessions, etc.)
│   ├── Reference Data (cn_ref_skills_catalog, etc.)
│   └── User Schemas (career_nav_user1_*, career_nav_user2_*, etc.)
├── Career Navigator Production (cn_prod_*)
│   ├── System Tables (cn_users, cn_user_sessions, etc.)
│   ├── Reference Data (cn_ref_skills_catalog, etc.)
│   └── User Schemas (career_nav_user1_*, career_nav_user2_*, etc.)
└── Other Projects
    ├── Project A Tables (pa_*)
    └── Project B Tables (pb_*)
```

## Configuration

### Environment Variables

The `.env` file must include project-specific configuration:

```bash
# Project Configuration
CN_TABLE_PREFIX=cn_                    # Career Navigator table prefix
CN_SCHEMA_PREFIX=career_nav_           # User schema prefix

# Development Environment
CN_DEV_TABLESPACE=CN_DEV_DATA         # Development tablespace
CN_DEV_TEMP_TABLESPACE=CN_DEV_TEMP    # Development temp tablespace

# Production Environment  
CN_PROD_TABLESPACE=CN_PROD_DATA       # Production tablespace
CN_PROD_TEMP_TABLESPACE=CN_PROD_TEMP  # Production temp tablespace

# Database Connections (separate dev/prod)
OCI_DB_DEV_SERVICE_NAME=your_dev_service_name.adb.oraclecloud.com
OCI_DB_PROD_SERVICE_NAME=your_prod_service_name.adb.oraclecloud.com

# Application Users (created by access control script)
CN_DEV_APP_USERNAME=CN_DEV_APP
CN_DEV_APP_PASSWORD=your_dev_app_password
CN_PROD_APP_USERNAME=CN_PROD_APP  
CN_PROD_APP_PASSWORD=your_prod_app_password
```

### Project Configuration Structure

```javascript
// config/mcp-config.js
const projectConfig = {
  name: 'career_navigator',
  tablePrefix: 'cn_',                 // Tables: cn_users, cn_audit_log, etc.
  schemaPrefix: 'career_nav_',        // User schemas: career_nav_john_doe_*
  version: '1.0.0',
  database: {
    development: {
      tableSpace: 'CN_DEV_DATA',
      tempTableSpace: 'CN_DEV_TEMP'
    },
    production: {
      tableSpace: 'CN_PROD_DATA', 
      tempTableSpace: 'CN_PROD_TEMP'
    }
  }
};
```

## Deployment Process

### Step 1: Environment Setup

1. **Configure Environment Variables**
   ```bash
   cp .env.example .env
   # Edit .env with your specific database configurations
   ```

2. **Verify Database Connectivity**
   ```bash
   # Test development environment
   npm run db:test:dev
   
   # Test production environment
   npm run db:test:prod
   ```

### Step 2: Schema Deployment

1. **Deploy Development Schema**
   ```bash
   npm run db:migrate:dev
   ```
   
   This creates:
   - System tables: `cn_users`, `cn_user_sessions`, `cn_api_keys`, `cn_audit_log`
   - Reference tables: `cn_ref_skills_catalog`, `cn_ref_career_paths`, etc.
   - Sample user schema: `career_nav_sample_*`

2. **Deploy Production Schema**
   ```bash
   npm run db:migrate:prod
   ```

### Step 3: Access Control Setup

1. **Create Application Roles and Users**
   ```bash
   # Development environment
   npm run db:access-control:dev
   
   # Production environment  
   npm run db:access-control:prod
   ```

   This creates:
   - Application roles: `CN_DEV_APP_ROLE`, `CN_PROD_APP_ROLE`
   - Service accounts: `CN_DEV_APP`, `CN_PROD_APP`
   - Row Level Security policies
   - Virtual Private Database policies

2. **Update Environment Configuration**
   ```bash
   # Add generated credentials to .env
   CN_DEV_APP_USERNAME=CN_DEV_APP
   CN_DEV_APP_PASSWORD=generated_password
   ```

### Step 4: Verification

1. **Health Check**
   ```bash
   npm run db:health:dev
   npm run db:health:prod
   ```

2. **Seed Reference Data**
   ```bash
   npm run db:seed:dev
   npm run db:seed:prod
   ```

## Multi-Project Coexistence

### Naming Conventions

Career Navigator follows strict naming conventions to avoid conflicts:

| Component | Pattern | Example |
|-----------|---------|---------|
| System Tables | `{prefix}{table_name}` | `cn_users`, `cn_audit_log` |
| Reference Tables | `{prefix}ref_{table_name}` | `cn_ref_skills_catalog` |
| User Schemas | `{schema_prefix}{username}_*` | `career_nav_john_doe_experiences` |
| Roles | `CN_{ENV}_*` | `CN_DEV_APP_ROLE` |
| Users | `CN_{ENV}_*` | `CN_PROD_READONLY` |

### Database Resource Allocation

```sql
-- Example tablespace allocation for shared database
CREATE TABLESPACE CN_DEV_DATA 
  DATAFILE SIZE 1G AUTOEXTEND ON 
  MAXSIZE 10G;

CREATE TABLESPACE CN_PROD_DATA 
  DATAFILE SIZE 2G AUTOEXTEND ON 
  MAXSIZE 50G;
```

### Monitoring and Isolation

1. **Environment-Specific Views**
   ```sql
   -- Development monitoring
   SELECT * FROM v_cn_dev_system_overview;
   
   -- Production monitoring
   SELECT * FROM v_cn_prod_system_overview;
   ```

2. **Project-Specific Audit Logs**
   ```sql
   -- Career Navigator audit events only
   SELECT * FROM cn_audit_log 
   WHERE project_name = 'career_navigator'
     AND environment = 'production';
   ```

## Security and Access Control

### Row Level Security (RLS)

Career Navigator implements RLS to ensure data isolation:

```sql
-- Users can only access their own data
CREATE POLICY cn_user_isolation ON cn_users
  FOR ALL TO cn_app_role
  USING (user_id = SYS_CONTEXT('USERENV', 'SESSION_USER'));
```

### Virtual Private Database (VPD)

Environment and project isolation through VPD:

```sql
-- Only show data for current environment and project
CREATE FUNCTION cn_isolation_policy RETURN VARCHAR2
IS
BEGIN
  RETURN 'environment = SYS_CONTEXT(''CN_CTX'', ''ENVIRONMENT'') 
          AND project_name = ''career_navigator''';
END;
```

### Application User Privileges

| User Type | Tables | Permissions | Purpose |
|-----------|--------|-------------|---------|
| `CN_DEV_APP` | All CN tables | SELECT, INSERT, UPDATE, DELETE | Application runtime |
| `CN_DEV_READONLY` | All CN tables | SELECT | Reporting, monitoring |
| `CN_DEV_ADMIN` | All CN tables | ALL | Schema management |

## Maintenance and Operations

### Regular Maintenance Tasks

1. **Daily Health Checks**
   ```bash
   # Automated health check script
   npm run db:health:prod
   npm run security:compliance-dashboard
   ```

2. **Weekly Access Reviews**
   ```bash
   # Review user access patterns
   npm run security:audit
   ```

3. **Monthly Schema Validation**
   ```bash
   # Verify schema integrity
   npm run db:test:prod
   npm run compliance:hipaa-report
   ```

### Backup and Recovery

1. **Schema-Specific Backups**
   ```bash
   # Export Career Navigator schema only
   expdp system/password DIRECTORY=data_pump_dir 
     DUMPFILE=career_navigator_dev.dmp 
     TABLES=cn_%
   ```

2. **User Data Backup**
   ```bash
   # Export specific user schemas
   expdp system/password DIRECTORY=data_pump_dir 
     DUMPFILE=user_schemas.dmp 
     SCHEMAS=career_nav_%
   ```

### Monitoring Queries

```sql
-- Career Navigator table usage
SELECT table_name, num_rows, last_analyzed
FROM user_tables 
WHERE table_name LIKE 'CN_%'
ORDER BY num_rows DESC;

-- User schema growth
SELECT schema_name, 
       COUNT(*) as table_count,
       SUM(bytes)/1024/1024 as size_mb
FROM user_segments 
WHERE segment_name LIKE 'CAREER_NAV_%'
GROUP BY schema_name;

-- Environment isolation verification
SELECT environment, COUNT(*) as record_count
FROM cn_audit_log 
GROUP BY environment;
```

## Troubleshooting

### Common Issues

#### 1. Table Name Conflicts
**Problem**: `ORA-00955: name is already used by an existing object`
**Solution**: 
- Verify table prefix configuration
- Check for existing objects with same name
- Use different prefix if necessary

#### 2. Permission Denied
**Problem**: `ORA-00942: table or view does not exist`
**Solution**:
- Verify application user has correct roles
- Check RLS policies are not blocking access
- Ensure VPD policies allow access

#### 3. Environment Mixing
**Problem**: Development data appearing in production
**Solution**:
- Verify environment variables are correct
- Check VPD policy configuration
- Validate connection strings

### Diagnostic Commands

```bash
# Verify environment configuration
npm run db:test:dev
npm run db:test:prod

# Check access control setup
sqlplus CN_DEV_APP/password@dev_service
SQL> SELECT * FROM user_role_privs;

# Validate table prefixing
SQL> SELECT table_name FROM user_tables WHERE table_name LIKE 'CN_%';

# Test RLS policies
SQL> SELECT COUNT(*) FROM cn_users; -- Should only show allowed records
```

## Best Practices

### Development Guidelines

1. **Always Use Environment-Specific Commands**
   ```bash
   # Correct
   npm run mcp:dev
   npm run db:migrate:dev
   
   # Avoid
   npm run mcp:start  # Uses default environment
   ```

2. **Verify Isolation Before Deployment**
   ```bash
   # Test data isolation
   npm run security:audit
   npm run compliance:hipaa-report
   ```

3. **Monitor Resource Usage**
   ```sql
   -- Check tablespace usage
   SELECT tablespace_name, 
          ROUND(used_space * 8192 / 1024 / 1024, 2) as used_mb,
          ROUND(tablespace_size * 8192 / 1024 / 1024, 2) as total_mb
   FROM dba_tablespace_usage_metrics
   WHERE tablespace_name LIKE 'CN_%';
   ```

### Production Deployment

1. **Pre-Deployment Checklist**
   - [ ] Environment variables configured
   - [ ] Database connectivity verified
   - [ ] Access control deployed
   - [ ] Security policies tested
   - [ ] Monitoring configured

2. **Post-Deployment Verification**
   - [ ] Schema deployment successful
   - [ ] User isolation working
   - [ ] Audit logging active
   - [ ] Performance metrics baseline
   - [ ] Backup procedures tested

## Integration with Other Projects

### Shared Database Resources

When sharing a database with other projects:

1. **Coordinate Tablespace Usage**
   ```sql
   -- Reserve tablespace for Career Navigator
   ALTER TABLESPACE cn_prod_data 
   AUTOEXTEND ON MAXSIZE 100G;
   ```

2. **Monitor Resource Consumption**
   ```sql
   -- Track Career Navigator resource usage
   SELECT 'career_navigator' as project,
          SUM(bytes)/1024/1024/1024 as gb_used
   FROM user_segments 
   WHERE segment_name LIKE 'CN_%';
   ```

3. **Coordinate Maintenance Windows**
   - Schedule maintenance during off-peak hours
   - Coordinate with other project teams
   - Document maintenance procedures

### API Integration Points

Career Navigator can integrate with other systems through:

1. **Shared Reference Data**
   ```sql
   -- Export skills data for other projects
   CREATE VIEW shared_skills AS
   SELECT skill_name, category, description
   FROM cn_ref_skills_catalog
   WHERE environment = 'production';
   ```

2. **Cross-Project Audit Trail**
   ```sql
   -- Unified audit view
   CREATE VIEW unified_audit AS
   SELECT 'career_navigator' as project, timestamp, action, user_id
   FROM cn_audit_log
   UNION ALL
   SELECT 'other_project' as project, timestamp, action, user_id  
   FROM other_project_audit;
   ```

## Support and Maintenance

### Getting Help

- **Configuration Issues**: Check `docs/deployment/docker-deployment.md`
- **Security Questions**: Review `docs/deployment/security-procedures.md`
- **Database Problems**: See troubleshooting section above
- **Performance Issues**: Monitor using built-in views

### Regular Updates

1. **Schema Updates**
   ```bash
   # Apply schema changes
   npm run db:migrate:prod
   ```

2. **Security Updates**
   ```bash
   # Update access control
   npm run db:access-control:prod
   ```

3. **Configuration Changes**
   ```bash
   # Update environment configuration
   vim .env
   npm run db:test:prod
   ```

Career Navigator is designed for seamless coexistence with other projects while maintaining the highest levels of security and data isolation. Following these guidelines ensures successful deployment and operation in shared database environments.