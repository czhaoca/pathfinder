---
name: Database Change
about: Database schema changes or migrations
title: 'feat: [DB] Reorganize database schemas into dedicated folder structure'
labels: database, refactoring, documentation, developer-experience
assignees: ''

---

## 📋 Description
Reorganize all database schemas from scattered documentation into a dedicated `/database` folder with logical structure. Extract SQL schemas into executable files organized by domain (core, security, user-data, modules). This will establish a single source of truth for database structure and improve maintainability.

## 🎯 Purpose
Currently, database schemas are mixed within documentation files, making them difficult to find, maintain, and execute. This reorganization will:
- Create a single source of truth for all database schemas
- Enable direct execution of SQL files for migrations
- Improve developer experience with clear organization
- Support automated schema validation and migration tools
- Facilitate database versioning and change tracking

## 📊 Schema Changes

### New Directory Structure
```
database/
├── README.md                    # Navigation and overview
├── migrations/                  # Migration scripts
│   ├── 001_initial_schema.sql
│   ├── 002_add_rbac.sql
│   └── rollback/
├── core/                        # Core system tables
│   ├── users.sql
│   ├── configuration.sql
│   └── README.md
├── security/                    # Security and auth tables
│   ├── authentication.sql
│   ├── audit.sql
│   ├── encryption.sql
│   └── README.md
├── user-data/                   # Per-user data tables
│   ├── experiences.sql
│   ├── skills.sql
│   ├── chat.sql
│   └── README.md
├── modules/                     # Feature modules
│   ├── cpa-pert.sql
│   ├── job-search.sql
│   ├── learning.sql
│   └── README.md
├── reference/                   # Reference data
│   ├── skills-catalog.sql
│   ├── industries.sql
│   └── README.md
├── views/                       # Database views
│   ├── user-summary.sql
│   ├── analytics.sql
│   └── README.md
├── functions/                   # Stored procedures/functions
│   ├── user-management.sql
│   ├── data-validation.sql
│   └── README.md
└── scripts/                     # Utility scripts
    ├── create-user-schema.sql
    ├── backup.sql
    ├── restore.sql
    └── validate-schema.sh
```

### Schema Extraction Plan
```sql
-- Example: Extracted and enhanced user table
-- File: /database/core/users.sql

-- =====================================================
-- Core User Tables
-- Version: 1.0.0
-- Last Modified: 2024-01-15
-- =====================================================

-- Drop existing tables (for clean migration)
-- DROP TABLE IF EXISTS pf_users CASCADE;

-- Main users table with enhanced fields
CREATE TABLE pf_users (
    -- Primary identification
    id VARCHAR2(36) DEFAULT SYS_GUID() PRIMARY KEY,
    username VARCHAR2(50) UNIQUE NOT NULL,
    email VARCHAR2(255) UNIQUE NOT NULL,
    
    -- Authentication
    password_hash VARCHAR2(255) NOT NULL,
    password_changed_at TIMESTAMP,
    
    -- Profile information
    full_name VARCHAR2(255),
    first_name VARCHAR2(100),
    last_name VARCHAR2(100),
    display_name VARCHAR2(100),
    
    -- Contact information
    phone VARCHAR2(20),
    phone_verified NUMBER(1) DEFAULT 0,
    
    -- Extended profile
    avatar_url VARCHAR2(500),
    banner_url VARCHAR2(500),
    bio CLOB,
    location VARCHAR2(255),
    timezone VARCHAR2(50) DEFAULT 'UTC',
    locale VARCHAR2(10) DEFAULT 'en-US',
    
    -- Professional links
    linkedin_url VARCHAR2(500),
    github_url VARCHAR2(500),
    website_url VARCHAR2(500),
    portfolio_url VARCHAR2(500),
    
    -- Account status
    email_verified NUMBER(1) DEFAULT 0,
    email_verified_at TIMESTAMP,
    is_active NUMBER(1) DEFAULT 1,
    account_status VARCHAR2(20) DEFAULT 'active',
    status_reason VARCHAR2(500),
    
    -- Authentication tracking
    last_login TIMESTAMP,
    last_login_ip VARCHAR2(45),
    login_count NUMBER(10) DEFAULT 0,
    failed_login_count NUMBER(5) DEFAULT 0,
    locked_until TIMESTAMP,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP,
    
    -- Constraints
    CONSTRAINT chk_email_format 
        CHECK (REGEXP_LIKE(email, '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')),
    CONSTRAINT chk_username_format 
        CHECK (REGEXP_LIKE(username, '^[a-z0-9_]{3,30}$')),
    CONSTRAINT chk_account_status 
        CHECK (account_status IN ('active', 'suspended', 'deleted', 'pending', 'anonymized'))
);

-- Performance indexes
CREATE INDEX idx_users_username ON pf_users(LOWER(username));
CREATE INDEX idx_users_email ON pf_users(LOWER(email));
CREATE INDEX idx_users_status ON pf_users(account_status, is_active);
CREATE INDEX idx_users_created ON pf_users(created_at DESC);
CREATE INDEX idx_users_last_login ON pf_users(last_login DESC NULLS LAST);
CREATE INDEX idx_users_deleted ON pf_users(deleted_at) WHERE deleted_at IS NOT NULL;

-- Table comments
COMMENT ON TABLE pf_users IS 'Core user accounts table - central user management';
COMMENT ON COLUMN pf_users.id IS 'UUID primary key using Oracle SYS_GUID()';
COMMENT ON COLUMN pf_users.username IS 'Unique username, lowercase alphanumeric + underscore, 3-30 chars';
COMMENT ON COLUMN pf_users.password_hash IS 'Argon2id hash - never store plain text';

-- Triggers for auto-update
CREATE OR REPLACE TRIGGER trg_users_updated
BEFORE UPDATE ON pf_users
FOR EACH ROW
BEGIN
    :NEW.updated_at := CURRENT_TIMESTAMP;
END;
/

-- Grants (adjust as needed)
-- GRANT SELECT, INSERT, UPDATE ON pf_users TO pathfinder_app;
-- GRANT SELECT ON pf_users TO pathfinder_readonly;
```

### Migration Scripts
```sql
-- File: /database/migrations/001_initial_schema.sql
-- Migration: Create initial database schema
-- Version: 1.0.0
-- Date: 2024-01-15

-- Check migration hasn't been applied
DECLARE
    v_count NUMBER;
BEGIN
    SELECT COUNT(*) INTO v_count 
    FROM user_tables 
    WHERE table_name = 'PF_MIGRATIONS';
    
    IF v_count = 0 THEN
        -- Create migrations tracking table
        EXECUTE IMMEDIATE 'CREATE TABLE pf_migrations (
            id NUMBER PRIMARY KEY,
            version VARCHAR2(20) NOT NULL UNIQUE,
            name VARCHAR2(255) NOT NULL,
            applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            checksum VARCHAR2(64),
            execution_time_ms NUMBER,
            applied_by VARCHAR2(100) DEFAULT USER
        )';
    END IF;
END;
/

-- Apply migration only if not already applied
DECLARE
    v_count NUMBER;
    v_start_time TIMESTAMP;
    v_end_time TIMESTAMP;
    v_execution_ms NUMBER;
BEGIN
    SELECT COUNT(*) INTO v_count 
    FROM pf_migrations 
    WHERE version = '1.0.0';
    
    IF v_count = 0 THEN
        v_start_time := CURRENT_TIMESTAMP;
        
        -- Execute schema creation
        @../core/users.sql
        @../security/authentication.sql
        @../security/audit.sql
        
        v_end_time := CURRENT_TIMESTAMP;
        v_execution_ms := EXTRACT(SECOND FROM (v_end_time - v_start_time)) * 1000;
        
        -- Record migration
        INSERT INTO pf_migrations (id, version, name, execution_time_ms)
        VALUES (1, '1.0.0', 'Initial schema creation', v_execution_ms);
        
        COMMIT;
        DBMS_OUTPUT.PUT_LINE('Migration 1.0.0 applied successfully');
    ELSE
        DBMS_OUTPUT.PUT_LINE('Migration 1.0.0 already applied');
    END IF;
END;
/
```

### Schema Documentation Generator
```javascript
// File: /database/scripts/generate-docs.js
const fs = require('fs');
const path = require('path');
const { parseSQL } = require('sql-parser');

class SchemaDocGenerator {
  constructor(databasePath) {
    this.databasePath = databasePath;
    this.schemas = new Map();
  }

  async generateDocumentation() {
    // Scan all SQL files
    await this.scanDirectory(this.databasePath);
    
    // Generate markdown documentation
    const markdown = this.generateMarkdown();
    
    // Generate ERD
    const erd = this.generateERD();
    
    // Generate data dictionary
    const dictionary = this.generateDataDictionary();
    
    return {
      markdown,
      erd,
      dictionary
    };
  }

  async scanDirectory(dir) {
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory() && !file.startsWith('.')) {
        await this.scanDirectory(fullPath);
      } else if (file.endsWith('.sql')) {
        await this.parseSchemaFile(fullPath);
      }
    }
  }

  async parseSchemaFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Extract tables, columns, indexes, constraints
    const tables = this.extractTables(content);
    const indexes = this.extractIndexes(content);
    const constraints = this.extractConstraints(content);
    const comments = this.extractComments(content);
    
    // Store parsed schema
    const category = path.dirname(filePath).split('/').pop();
    this.schemas.set(filePath, {
      category,
      tables,
      indexes,
      constraints,
      comments
    });
  }

  generateMarkdown() {
    let md = '# Database Schema Documentation\n\n';
    md += 'Auto-generated from SQL schema files\n\n';
    
    // Group by category
    const categories = new Map();
    for (const [file, schema] of this.schemas) {
      if (!categories.has(schema.category)) {
        categories.set(schema.category, []);
      }
      categories.get(schema.category).push(schema);
    }
    
    // Generate documentation for each category
    for (const [category, schemas] of categories) {
      md += `## ${category.toUpperCase()}\n\n`;
      
      for (const schema of schemas) {
        for (const table of schema.tables) {
          md += `### Table: ${table.name}\n`;
          md += `${table.comment || 'No description'}\n\n`;
          
          md += '| Column | Type | Nullable | Default | Description |\n';
          md += '|--------|------|----------|---------|-------------|\n';
          
          for (const column of table.columns) {
            md += `| ${column.name} | ${column.type} | ${column.nullable} | ${column.default || '-'} | ${column.comment || '-'} |\n`;
          }
          
          md += '\n';
          
          if (table.indexes.length > 0) {
            md += '**Indexes:**\n';
            for (const index of table.indexes) {
              md += `- ${index.name} (${index.columns.join(', ')})\n`;
            }
            md += '\n';
          }
        }
      }
    }
    
    return md;
  }

  generateERD() {
    // Generate Mermaid ERD
    let mermaid = 'erDiagram\n';
    
    for (const [file, schema] of this.schemas) {
      for (const table of schema.tables) {
        // Add table
        mermaid += `    ${table.name} {\n`;
        
        for (const column of table.columns) {
          const pk = column.isPrimaryKey ? 'PK' : '';
          const fk = column.isForeignKey ? 'FK' : '';
          mermaid += `        ${column.type} ${column.name} ${pk}${fk}\n`;
        }
        
        mermaid += '    }\n';
        
        // Add relationships
        for (const fk of table.foreignKeys) {
          mermaid += `    ${table.name} ||--o{ ${fk.referencedTable} : "${fk.name}"\n`;
        }
      }
    }
    
    return mermaid;
  }

  generateDataDictionary() {
    const dictionary = [];
    
    for (const [file, schema] of this.schemas) {
      for (const table of schema.tables) {
        for (const column of table.columns) {
          dictionary.push({
            schema: schema.category,
            table: table.name,
            column: column.name,
            dataType: column.type,
            nullable: column.nullable,
            default: column.default,
            primaryKey: column.isPrimaryKey,
            foreignKey: column.isForeignKey,
            unique: column.isUnique,
            indexed: column.isIndexed,
            description: column.comment
          });
        }
      }
    }
    
    return dictionary;
  }
}

// Generate documentation
const generator = new SchemaDocGenerator('/database');
generator.generateDocumentation().then(docs => {
  fs.writeFileSync('/database/SCHEMA.md', docs.markdown);
  fs.writeFileSync('/database/erd.mmd', docs.erd);
  fs.writeFileSync('/database/data-dictionary.json', JSON.stringify(docs.dictionary, null, 2));
  console.log('Documentation generated successfully');
});
```

## 🔄 Migration Strategy
- [x] Create `/database` directory structure
- [ ] Extract schemas from `/docs/architecture/database.md`
- [ ] Extract schemas from `/docs/api/auth/*.md`
- [ ] Split monolithic schemas into domain files
- [ ] Add missing indexes and constraints
- [ ] Create migration scripts for each version
- [ ] Add rollback scripts for each migration
- [ ] Validate all SQL syntax
- [ ] Test migrations on development database
- [ ] Document migration procedures

### Migration Execution Plan
```bash
#!/bin/bash
# File: /database/scripts/migrate.sh

# Configuration
DB_USER=${DB_USER:-pathfinder}
DB_PASS=${DB_PASS:-}
DB_HOST=${DB_HOST:-localhost}
DB_NAME=${DB_NAME:-pathfinder}
DB_PORT=${DB_PORT:-1521}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🚀 Pathfinder Database Migration Tool"
echo "====================================="

# Check database connection
echo -n "Checking database connection... "
sqlplus -s ${DB_USER}/${DB_PASS}@${DB_HOST}:${DB_PORT}/${DB_NAME} <<EOF
SELECT 'Connected' FROM DUAL;
EXIT;
EOF

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗${NC}"
    echo "Failed to connect to database"
    exit 1
fi

# Get current version
CURRENT_VERSION=$(sqlplus -s ${DB_USER}/${DB_PASS}@${DB_HOST}:${DB_PORT}/${DB_NAME} <<EOF
SET HEADING OFF
SET FEEDBACK OFF
SELECT MAX(version) FROM pf_migrations;
EXIT;
EOF
)

echo "Current database version: ${CURRENT_VERSION:-none}"

# Find pending migrations
PENDING_MIGRATIONS=$(find ./migrations -name "*.sql" | sort)

for MIGRATION in ${PENDING_MIGRATIONS}; do
    VERSION=$(basename ${MIGRATION} | cut -d'_' -f1)
    
    # Check if already applied
    APPLIED=$(sqlplus -s ${DB_USER}/${DB_PASS}@${DB_HOST}:${DB_PORT}/${DB_NAME} <<EOF
SET HEADING OFF
SET FEEDBACK OFF
SELECT COUNT(*) FROM pf_migrations WHERE version = '${VERSION}';
EXIT;
EOF
)
    
    if [ "${APPLIED}" = "0" ]; then
        echo -e "${YELLOW}Applying migration ${VERSION}...${NC}"
        
        # Execute migration
        sqlplus ${DB_USER}/${DB_PASS}@${DB_HOST}:${DB_PORT}/${DB_NAME} @${MIGRATION}
        
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✓ Migration ${VERSION} applied successfully${NC}"
        else
            echo -e "${RED}✗ Migration ${VERSION} failed${NC}"
            exit 1
        fi
    else
        echo "Skipping migration ${VERSION} (already applied)"
    fi
done

echo -e "${GREEN}✅ All migrations completed successfully${NC}"
```

## 📈 Performance Impact
- **Positive Impact:**
  - Faster schema lookups for developers
  - Automated migration reduces errors
  - Consistent indexing improves query performance
  - Schema validation catches issues early

- **Migration Performance:**
  - Initial extraction: ~1 hour manual work
  - Migration script execution: < 5 minutes
  - No downtime required (additive changes only)
  - Rollback capability if issues arise

## 🔒 Security Considerations
- All passwords/secrets removed from SQL files
- Permissions and grants documented separately
- Audit tables properly configured
- Encryption keys never in schemas
- Connection strings externalized

## 🧪 Testing Requirements
- [ ] Validate all SQL syntax with Oracle parser
- [ ] Test create/drop for all tables
- [ ] Verify foreign key relationships
- [ ] Test migration scripts on clean database
- [ ] Test rollback procedures
- [ ] Verify indexes are created correctly
- [ ] Load test with sample data
- [ ] Test user schema creation script
- [ ] Validate documentation generation

### Test Script
```sql
-- File: /database/scripts/validate-schema.sql
DECLARE
    v_errors NUMBER := 0;
    v_warnings NUMBER := 0;
BEGIN
    DBMS_OUTPUT.PUT_LINE('Starting schema validation...');
    
    -- Check all expected tables exist
    FOR t IN (
        SELECT 'pf_users' AS table_name FROM DUAL UNION ALL
        SELECT 'pf_user_roles' FROM DUAL UNION ALL
        SELECT 'pf_audit_log' FROM DUAL
        -- Add all expected tables
    ) LOOP
        DECLARE
            v_count NUMBER;
        BEGIN
            SELECT COUNT(*) INTO v_count
            FROM user_tables
            WHERE table_name = UPPER(t.table_name);
            
            IF v_count = 0 THEN
                DBMS_OUTPUT.PUT_LINE('ERROR: Table ' || t.table_name || ' not found');
                v_errors := v_errors + 1;
            END IF;
        END;
    END LOOP;
    
    -- Check foreign keys
    FOR fk IN (
        SELECT constraint_name, table_name, r_constraint_name
        FROM user_constraints
        WHERE constraint_type = 'R'
    ) LOOP
        DBMS_OUTPUT.PUT_LINE('Validating FK: ' || fk.constraint_name);
    END LOOP;
    
    -- Check indexes
    FOR idx IN (
        SELECT index_name, table_name, uniqueness
        FROM user_indexes
        WHERE index_name NOT LIKE 'SYS%'
    ) LOOP
        DBMS_OUTPUT.PUT_LINE('Found index: ' || idx.index_name);
    END LOOP;
    
    -- Summary
    DBMS_OUTPUT.PUT_LINE('=====================================');
    DBMS_OUTPUT.PUT_LINE('Validation complete:');
    DBMS_OUTPUT.PUT_LINE('Errors: ' || v_errors);
    DBMS_OUTPUT.PUT_LINE('Warnings: ' || v_warnings);
    
    IF v_errors > 0 THEN
        RAISE_APPLICATION_ERROR(-20001, 'Schema validation failed');
    END IF;
END;
/
```

## 📚 Documentation Updates
- [x] Create comprehensive README in /database
- [ ] Generate data dictionary from schemas
- [ ] Create ERD diagrams
- [ ] Document naming conventions
- [ ] Add migration guide
- [ ] Create troubleshooting guide
- [ ] Document backup/restore procedures

## ⚠️ Risks
- **Risk:** Schema extraction might miss constraints
  - **Mitigation:** Manual review of extracted schemas
  
- **Risk:** Migration scripts might fail on production
  - **Mitigation:** Test on staging environment first
  
- **Risk:** Documentation becomes outdated
  - **Mitigation:** Automated documentation generation

## 🔗 Dependencies
- Related to: All features that use database
- Depends on: None (refactoring task)
- Blocks: Future database migrations

## 📊 Success Metrics
- All schemas successfully extracted and organized
- Zero errors during migration execution
- 100% of tables have proper indexes
- Documentation auto-generation working
- Developer satisfaction with organization
- Reduced time to find schemas (< 30 seconds)
- Migration execution time < 5 minutes

---

**Estimated Effort**: 5 story points
**Sprint**: 2 (Database & Infrastructure)
**Target Completion**: Week 3
**Risk Level**: Medium - No data changes, only reorganization