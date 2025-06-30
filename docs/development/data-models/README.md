# Career Navigator Data Models

This section documents the data architecture, database schemas, and data flow patterns used throughout the Career Navigator platform.

## Architecture Overview

Career Navigator uses a **3-tier data architecture** designed for privacy, scalability, and intelligent content generation:

[![Data Architecture Overview](../../assets/mermaid/data-architecture-overview.png)](../../assets/diagrams/data-architecture-overview.mmd)

## Data Models Documentation

### Core Models
- **[Data Structure](data-structure.md)** - Complete 3-tier architecture specification
- **[User Profile Model](user-profile-model.md)** - User account and preference data
- **[Experience Model](experience-model.md)** - Professional experience data structure
- **[Skills Model](skills-model.md)** - Skills taxonomy and proficiency tracking

### Relationship Models
- **[Career Path Model](career-path-model.md)** - Career progression and opportunity mapping
- **[Achievement Model](achievement-model.md)** - Accomplishment tracking and quantification
- **[Goal Model](goal-model.md)** - Career objective and milestone tracking

### AI Integration Models
- **[Context Model](context-model.md)** - MCP server context data structure
- **[Analytics Model](analytics-model.md)** - User interaction and improvement tracking
- **[Recommendation Model](recommendation-model.md)** - AI-generated suggestion data

### Security Models
- **[Encryption Model](encryption-model.md)** - Data encryption and key management
- **[Access Control Model](access-control-model.md)** - Permission and authorization data
- **[Audit Model](audit-model.md)** - Security and compliance tracking

## Database Implementation Options

### User-Controlled Databases
Career Navigator supports multiple database backends, all under user control:

#### Oracle Cloud Infrastructure (OCI) Free Tier
- **Always Free**: 2 ATP databases with 20GB each
- **Enterprise Security**: Advanced encryption and access controls
- **Global Availability**: Multiple regions for data residency
- **Schema**: PostgreSQL-compatible with JSONB support

#### Cloudflare D1
- **Edge Database**: SQLite with global replication
- **Generous Free Tier**: 100K reads/day, 1K writes/day
- **Built-in Encryption**: All data encrypted at rest and in transit
- **Schema**: SQLite with JSON extensions

#### Self-Hosted Options
- **PostgreSQL**: Full-featured relational database
- **SQLite**: Lightweight local database option
- **MySQL/MariaDB**: Alternative relational database
- **MongoDB**: Document-based NoSQL option

### Schema Management

#### Migration Strategy
```javascript
// Database migration example
const migrations = {
  '001_initial_schema': {
    up: async (db) => {
      await db.createTable('user_profiles', userProfileSchema);
      await db.createTable('experiences_detailed', experienceSchema);
      await db.createTable('profile_summaries', profileSummarySchema);
      await db.createTable('quick_summaries', quickSummarySchema);
    },
    down: async (db) => {
      await db.dropTable('quick_summaries');
      await db.dropTable('profile_summaries');
      await db.dropTable('experiences_detailed');
      await db.dropTable('user_profiles');
    }
  }
};
```

#### Version Control
- **Schema Versioning**: Incremental migration scripts
- **Backward Compatibility**: Support for multiple schema versions
- **Data Migration**: Safe upgrade paths for existing data
- **Rollback Support**: Ability to revert schema changes

## Data Flow Patterns

### Experience Processing Pipeline
[![Experience Processing Pipeline](../../assets/mermaid/experience-processing-pipeline.png)](../../assets/diagrams/experience-processing-pipeline.mmd)

### Data Privacy Flow
[![Data Privacy Flow](../../assets/mermaid/data-privacy-flow.png)](../../assets/diagrams/data-privacy-flow.mmd)

## Performance Considerations

### Query Optimization
- **Indexing Strategy**: Optimized indexes for common query patterns
- **Caching Layer**: Redis/Memcached for frequently accessed data
- **Connection Pooling**: Efficient database connection management
- **Query Batching**: Grouped operations for better performance

### Scalability Patterns
- **Horizontal Partitioning**: User-based data partitioning
- **Read Replicas**: Separate read and write operations
- **CDN Integration**: Static asset delivery optimization
- **Background Processing**: Async processing for heavy operations

## Data Validation & Quality

### Input Validation
```javascript
const experienceValidation = {
  title: { required: true, maxLength: 255 },
  company: { required: true, maxLength: 255 },
  description: { required: true, minLength: 50 },
  startDate: { required: true, type: 'date' },
  endDate: { type: 'date', afterField: 'startDate' },
  skills: { type: 'array', itemType: 'string' }
};
```

### Data Quality Checks
- **Completeness**: Required field validation
- **Consistency**: Cross-field validation rules
- **Accuracy**: Format and range validation
- **Uniqueness**: Duplicate detection and prevention

### Data Enrichment
- **Skills Normalization**: Standardize skill names and categories
- **Achievement Extraction**: Identify quantifiable accomplishments
- **Context Enhancement**: Add metadata and relationships
- **Quality Scoring**: Rate data completeness and quality

## Backup & Recovery

### Backup Strategy
- **Automated Backups**: Daily encrypted backups
- **Cross-Region Replication**: Geographic backup distribution
- **Point-in-Time Recovery**: Restore to specific timestamps
- **User-Controlled**: Backup management under user control

### Disaster Recovery
- **Recovery Time Objective (RTO)**: 4 hours maximum downtime
- **Recovery Point Objective (RPO)**: 1 hour maximum data loss
- **Failover Procedures**: Automated failover to backup systems
- **Testing Schedule**: Monthly disaster recovery testing

---

*The Career Navigator data architecture prioritizes user privacy, data sovereignty, and intelligent content generation while maintaining high performance and reliability.*