# Data Structure Documentation

## Database Schema

### Level 1: Detailed Experiences Table

```sql
experiences_detailed (
    id: UUID PRIMARY KEY,
    user_id: UUID NOT NULL,
    title: VARCHAR(255) NOT NULL,
    organization: VARCHAR(255),
    description: TEXT NOT NULL,
    start_date: DATE NOT NULL,
    end_date: DATE,
    is_current: BOOLEAN DEFAULT FALSE,
    experience_type: ENUM('work', 'education', 'volunteer', 'project', 'hobby', 'certification'),
    extracted_skills: JSONB, -- Array of skill objects with proficiency levels
    key_highlights: JSONB, -- Array of achievement/highlight objects
    role_mappings: JSONB, -- Mapping to potential career roles
    industry_tags: JSONB, -- Industry classification tags
    impact_metrics: JSONB, -- Quantifiable achievements
    created_at: TIMESTAMP DEFAULT NOW(),
    updated_at: TIMESTAMP DEFAULT NOW()
);
```

### Level 2: Profile Summaries Table

```sql
profile_summaries (
    id: UUID PRIMARY KEY,
    user_id: UUID NOT NULL UNIQUE,
    core_strengths: JSONB, -- Aggregated top skills with evidence
    career_interests: JSONB, -- Identified career paths and interest areas
    career_progression: JSONB, -- Timeline of career development
    industry_experience: JSONB, -- Industries worked in with depth
    leadership_profile: JSONB, -- Leadership experiences and style
    technical_profile: JSONB, -- Technical skills and tools
    soft_skills_profile: JSONB, -- Communication, teamwork, etc.
    education_summary: JSONB, -- Educational background summary
    achievement_highlights: JSONB, -- Top 10-15 career highlights
    last_aggregated: TIMESTAMP DEFAULT NOW(),
    created_at: TIMESTAMP DEFAULT NOW(),
    updated_at: TIMESTAMP DEFAULT NOW()
);
```

### Level 3: Quick Summaries Table

```sql
quick_summaries (
    id: UUID PRIMARY KEY,
    user_id: UUID NOT NULL UNIQUE,
    executive_summary: TEXT, -- 2-3 sentence professional summary
    key_skills: JSONB, -- Top 8-10 skills
    career_goals: TEXT, -- Current career objectives
    years_experience: INTEGER,
    current_role: VARCHAR(255),
    industries: JSONB, -- 2-3 primary industries
    education_level: VARCHAR(100),
    location: VARCHAR(255),
    availability: VARCHAR(100),
    last_updated: TIMESTAMP DEFAULT NOW(),
    created_at: TIMESTAMP DEFAULT NOW()
);
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

### Quick Context (Level 3)
- Used for initial conversation context
- Provides basic user profile for general career questions
- Minimal data transfer for fast response

### Detailed Context (Level 2)
- Retrieved when deeper analysis needed
- Used for specific career planning and detailed advice
- Comprehensive profile for nuanced recommendations

### Full Context (Level 1)
- Accessed for specific experience-related queries
- Used when user references particular experiences
- Complete detail for precise recommendations