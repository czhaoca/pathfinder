# Database Structure

This directory contains all database-related code for Pathfinder.

## Directory Structure

```
database/
├── schema/              # Table creation schemas
│   ├── user-tables.js   # User and authentication tables
│   ├── experience-tables.js  # Experience management tables
│   ├── chat-tables.js   # Chat and conversation tables
│   ├── cpa-pert-tables.js    # CPA PERT module tables
│   ├── career-path-tables.js # Career path planning tables
│   ├── networking-tables.js  # Professional networking tables
│   ├── job-search-tables.js  # Job search integration tables
│   └── learning-tables.js    # Learning & development tables
├── seeds/               # Seed data scripts
│   ├── seed-data.js     # Main seed data script
│   └── seed-cpa-competencies.js  # CPA competency framework data
├── queries/             # Reusable SQL queries
└── setup-database.js    # Database setup script
```

## Setup

This is a new development project with no legacy migrations. To set up the database:

```bash
# Set up all tables and initial data
npm run db:setup

# Or for specific environments:
npm run db:setup:dev   # Development
npm run db:setup:prod  # Production
```

## Schema Design

All tables use:
- `pf_` prefix for namespace isolation
- VARCHAR2(26) for IDs (ULID format)
- JSON columns for flexible data storage
- Proper foreign key constraints
- Audit fields (created_at, updated_at)

## Adding New Tables

1. Create a new schema file in `schema/` directory
2. Export a function that accepts (db, prefix) parameters
3. Import and call it in `setup-database.js`
4. Run `npm run db:setup` to create the tables

Example:
```javascript
// schema/new-feature-tables.js
async function createNewFeatureTables(db, prefix = 'pf_') {
  await db.execute(`
    CREATE TABLE ${prefix}new_table (
      id VARCHAR2(26) DEFAULT SYS_GUID() PRIMARY KEY,
      name VARCHAR2(200) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

module.exports = createNewFeatureTables;
```