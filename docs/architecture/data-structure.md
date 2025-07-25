# Data Structure Documentation

## Single-User MCP Database Schema

This schema is optimized for a single-user Model Context Protocol (MCP) server that stores and retrieves professional experiences with three-tier performance optimization.

### Design Principles

- **Single-User Focus**: No multi-tenancy, simplified without user_id foreign keys
- **MCP Optimized**: Three-tier structure for optimal AI context retrieval performance
- **Oracle Autonomous DB**: Designed for Oracle's JSON capabilities and enterprise features
- **Environment Separation**: Schema supports both development and production environments

## Database Schema

### Level 1: Detailed Experiences Table

**Purpose**: Complete experience records with rich metadata for detailed analysis and retrieval.

```sql
CREATE TABLE experiences_detailed (
    id RAW(16) DEFAULT SYS_GUID() PRIMARY KEY,
    title VARCHAR2(255) NOT NULL,
    organization VARCHAR2(255),
    description CLOB NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE,
    is_current NUMBER(1) DEFAULT 0 CHECK (is_current IN (0,1)),
    experience_type VARCHAR2(50) CHECK (experience_type IN ('work', 'education', 'volunteer', 'project', 'hobby', 'certification')),
    extracted_skills JSON, -- Array of skill objects with proficiency levels
    key_highlights JSON, -- Array of achievement/highlight objects  
    role_mappings JSON, -- Mapping to potential career roles
    industry_tags JSON, -- Industry classification tags
    impact_metrics JSON, -- Quantifiable achievements
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Performance indexes for MCP queries
CREATE INDEX idx_experiences_type_date ON experiences_detailed (experience_type, start_date DESC);
CREATE INDEX idx_experiences_current ON experiences_detailed (is_current, updated_at DESC);
CREATE INDEX idx_experiences_skills ON experiences_detailed (JSON_VALUE(extracted_skills, '$[*].name'));
```

### Level 2: Profile Summaries Table

**Purpose**: Aggregated user profile for comprehensive career analysis and planning.

```sql
CREATE TABLE profile_summaries (
    id RAW(16) DEFAULT SYS_GUID() PRIMARY KEY,
    core_strengths JSON, -- Aggregated top skills with evidence
    career_interests JSON, -- Identified career paths and interest areas
    career_progression JSON, -- Timeline of career development
    industry_experience JSON, -- Industries worked in with depth
    leadership_profile JSON, -- Leadership experiences and style
    technical_profile JSON, -- Technical skills and tools
    soft_skills_profile JSON, -- Communication, teamwork, etc.
    education_summary JSON, -- Educational background summary
    achievement_highlights JSON, -- Top 10-15 career highlights
    last_aggregated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Single-user constraint (only one profile record allowed)
CREATE UNIQUE INDEX idx_profile_singleton ON profile_summaries (1);

-- Performance index for aggregation queries
CREATE INDEX idx_profile_aggregated ON profile_summaries (last_aggregated DESC);
```

### Level 3: Quick Summaries Table

**Purpose**: Rapid-access context for MCP conversations (< 10ms retrieval target).

```sql
CREATE TABLE quick_summaries (
    id RAW(16) DEFAULT SYS_GUID() PRIMARY KEY,
    executive_summary CLOB, -- 2-3 sentence professional summary
    key_skills JSON, -- Top 8-10 skills
    career_goals CLOB, -- Current career objectives
    years_experience NUMBER(3),
    current_role VARCHAR2(255),
    industries JSON, -- 2-3 primary industries
    education_level VARCHAR2(100),
    location VARCHAR2(255),
    availability VARCHAR2(100),
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Single-user constraint (only one quick summary record allowed)
CREATE UNIQUE INDEX idx_quick_singleton ON quick_summaries (1);

-- Ultra-fast retrieval index for MCP context
CREATE INDEX idx_quick_updated ON quick_summaries (last_updated DESC);
```

## Supporting Tables

### Skills Mapping Table

```sql
skills_mapping (
    id: UUID PRIMARY KEY,
    skill_name: VARCHAR(255) NOT NULL UNIQUE,
    category: VARCHAR(100), -- 'technical', 'soft', 'industry-specific'
    related_roles: JSONB, -- Career roles that commonly use this skill
    proficiency_levels: JSONB, -- Definition of beginner/intermediate/advanced
    market_demand: INTEGER, -- 1-10 rating of market demand
    created_at: TIMESTAMP DEFAULT NOW()
);
```

### Career Paths Table

```sql
career_paths (
    id: UUID PRIMARY KEY,
    path_name: VARCHAR(255) NOT NULL,
    industry: VARCHAR(100),
    required_skills: JSONB,
    typical_progression: JSONB, -- Array of role progression
    education_requirements: JSONB,
    salary_ranges: JSONB,
    growth_outlook: INTEGER, -- 1-10 rating
    related_paths: JSONB, -- Related career paths
    created_at: TIMESTAMP DEFAULT NOW()
);
```

### Role Profiles Table

```sql
role_profiles (
    id: UUID PRIMARY KEY,
    role_title: VARCHAR(255) NOT NULL,
    role_level: VARCHAR(50), -- 'entry', 'mid', 'senior', 'executive'
    industry: VARCHAR(100),
    key_responsibilities: JSONB,
    required_skills: JSONB,
    preferred_skills: JSONB,
    experience_requirements: JSONB,
    career_path_id: UUID REFERENCES career_paths(id),
    created_at: TIMESTAMP DEFAULT NOW()
);
```

## Data Aggregation Logic

### Level 1 → Level 2 Aggregation

1. **Skills Aggregation**: Collect all skills from detailed experiences, weight by recency and impact
2. **Career Interest Analysis**: Analyze role mappings and industry tags to identify patterns
3. **Progression Mapping**: Create timeline-based progression story
4. **Strength Identification**: Identify top strengths based on repeated skills and achievements

### Level 2 → Level 3 Aggregation

1. **Executive Summary Generation**: Create concise professional summary from profile data
2. **Top Skills Selection**: Select 8-10 most relevant skills for current career goals
3. **Goal Synthesis**: Synthesize career objectives from interests and progression data

## MCP Context Retrieval Strategy

### Quick Context (Level 3) - Target: < 10ms
**Usage**: Initial conversation context and rapid user identification
- Provides essential professional summary for general career questions
- Minimal data transfer optimized for MCP server response times
- Single table query with ultra-fast index access

**Example Query**:
```sql
SELECT executive_summary, key_skills, career_goals, current_role
FROM quick_summaries 
WHERE ROWNUM = 1
ORDER BY last_updated DESC;
```

### Detailed Context (Level 2) - Target: < 50ms
**Usage**: Comprehensive career analysis and strategic planning
- Retrieved when deeper professional analysis is needed
- Used for specific career planning and detailed guidance
- Aggregated insights across all professional experiences

**Example Query**:
```sql
SELECT core_strengths, career_interests, career_progression, 
       technical_profile, achievement_highlights
FROM profile_summaries
WHERE ROWNUM = 1
ORDER BY last_aggregated DESC;
```

### Full Context (Level 1) - Target: < 200ms
**Usage**: Specific experience analysis and detailed recommendations
- Accessed when user references particular experiences or roles
- Complete granular detail for precise career guidance
- Complex queries with JSON field analysis

**Example Query**:
```sql
SELECT title, organization, description, extracted_skills, 
       key_highlights, impact_metrics
FROM experiences_detailed
WHERE experience_type = :type
AND start_date >= :date_range
ORDER BY start_date DESC;
```

## Single-User Optimization Benefits

### Simplified Architecture
- **No Multi-Tenancy Overhead**: Eliminates user_id filtering and row-level security
- **Singleton Pattern**: Only one record per summary table (enforced by unique indexes)
- **Optimized Indexes**: Focused on single-user query patterns
- **Reduced Complexity**: No cross-user data contamination concerns

### Performance Advantages
- **Faster Queries**: No user_id WHERE clauses in every query
- **Better Caching**: Single-user data fits easily in Oracle's buffer cache
- **Simplified Joins**: No complex user-based data relationships
- **Optimized Storage**: No data partitioning or user-based sharding needed

### MCP Integration Benefits
- **Predictable Performance**: Consistent response times without user volume variance
- **Simplified Context**: Direct table reads without user authentication overhead
- **Fast Development**: No user management layer reduces implementation complexity
- **Easy Debugging**: Single data set simplifies troubleshooting and testing

## Oracle Autonomous Database Specific Features

### JSON Optimization
```sql
-- Create function-based index for skills search
CREATE INDEX idx_skills_search ON experiences_detailed 
(JSON_VALUE(extracted_skills, '$[*].name' RETURNING VARCHAR2(4000)));

-- Create index for highlights performance
CREATE INDEX idx_highlights_impact ON experiences_detailed
(JSON_VALUE(key_highlights, '$[*].impact_score' RETURNING NUMBER));
```

### Performance Monitoring
```sql
-- Query to monitor MCP response times
SELECT sql_text, elapsed_time/1000000 as seconds, executions,
       (elapsed_time/1000000)/executions as avg_seconds
FROM v$sql 
WHERE sql_text LIKE '%quick_summaries%' 
   OR sql_text LIKE '%profile_summaries%'
   OR sql_text LIKE '%experiences_detailed%'
ORDER BY avg_seconds DESC;
```

### Storage Optimization
```sql
-- Enable compression for large JSON fields (Oracle 19c+)
ALTER TABLE experiences_detailed MODIFY (description COMPRESS FOR OLTP);
ALTER TABLE experiences_detailed MODIFY (extracted_skills COMPRESS FOR OLTP);

-- Monitor storage usage
SELECT table_name, 
       ROUND(bytes/1024/1024, 2) as mb_used,
       ROUND((bytes/1024/1024/1024), 4) as gb_used
FROM user_segments 
WHERE table_name IN ('EXPERIENCES_DETAILED', 'PROFILE_SUMMARIES', 'QUICK_SUMMARIES')
ORDER BY bytes DESC;
```