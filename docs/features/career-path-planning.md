# Career Path Planning Feature

## Overview

The Career Path Planning feature enables users to visualize potential career trajectories, identify skills gaps, receive personalized learning recommendations, and track their progress toward career goals.

## Core Components

### 1. Career Path Visualization
- Interactive graph showing possible career progressions
- Multiple paths from current role to target roles
- Timeline estimates for transitions
- Industry-specific career lattices

### 2. Skills Gap Analysis
- Compare current skills with target role requirements
- Identify missing skills and competencies
- Prioritize skills based on market demand
- Show transferable skills from current experience

### 3. Learning Recommendations
- Curated courses and certifications for skill development
- Free and paid learning resources
- Time and cost estimates for skill acquisition
- Integration with popular learning platforms

### 4. Goal Tracking
- Set SMART career goals
- Track progress milestones
- Receive reminders and motivation
- Celebrate achievements

## Data Model

### Career Paths
```sql
-- Career path nodes representing roles
CREATE TABLE pf_career_nodes (
    node_id VARCHAR2(26) PRIMARY KEY,
    role_title VARCHAR2(255) NOT NULL,
    role_level VARCHAR2(50), -- entry, mid, senior, executive
    industry VARCHAR2(100),
    typical_years_experience NUMBER,
    salary_range_min NUMBER,
    salary_range_max NUMBER,
    required_skills CLOB, -- JSON array of skill IDs
    preferred_skills CLOB, -- JSON array of skill IDs
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Transitions between career nodes
CREATE TABLE pf_career_transitions (
    transition_id VARCHAR2(26) PRIMARY KEY,
    from_node_id VARCHAR2(26) REFERENCES pf_career_nodes(node_id),
    to_node_id VARCHAR2(26) REFERENCES pf_career_nodes(node_id),
    typical_duration_months NUMBER,
    difficulty_score NUMBER(3,2), -- 0-1 scale
    required_skills_gap CLOB, -- JSON array of skill IDs needed
    success_rate NUMBER(3,2), -- Historical success rate
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User career goals
CREATE TABLE pf_user_career_goals (
    goal_id VARCHAR2(26) PRIMARY KEY,
    user_id VARCHAR2(26) NOT NULL,
    current_node_id VARCHAR2(26) REFERENCES pf_career_nodes(node_id),
    target_node_id VARCHAR2(26) REFERENCES pf_career_nodes(node_id),
    target_date DATE,
    status VARCHAR2(20) DEFAULT 'active', -- active, achieved, abandoned
    progress_percentage NUMBER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Skills development tracking
CREATE TABLE pf_user_skills_progress (
    progress_id VARCHAR2(26) PRIMARY KEY,
    user_id VARCHAR2(26) NOT NULL,
    goal_id VARCHAR2(26) REFERENCES pf_user_career_goals(goal_id),
    skill_id VARCHAR2(26) REFERENCES pf_ref_skills_catalog(skill_id),
    current_level NUMBER(1) DEFAULT 1, -- 1-5 scale
    target_level NUMBER(1),
    learning_hours_logged NUMBER DEFAULT 0,
    certifications_earned CLOB, -- JSON array
    last_activity_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Learning resources
CREATE TABLE pf_learning_resources (
    resource_id VARCHAR2(26) PRIMARY KEY,
    skill_id VARCHAR2(26) REFERENCES pf_ref_skills_catalog(skill_id),
    title VARCHAR2(500) NOT NULL,
    provider VARCHAR2(200),
    url VARCHAR2(1000),
    resource_type VARCHAR2(50), -- course, book, tutorial, certification
    duration_hours NUMBER,
    cost NUMBER DEFAULT 0,
    difficulty_level VARCHAR2(20), -- beginner, intermediate, advanced
    rating NUMBER(3,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Goal milestones
CREATE TABLE pf_goal_milestones (
    milestone_id VARCHAR2(26) PRIMARY KEY,
    goal_id VARCHAR2(26) REFERENCES pf_user_career_goals(goal_id),
    title VARCHAR2(255) NOT NULL,
    description TEXT,
    due_date DATE,
    completed_date DATE,
    status VARCHAR2(20) DEFAULT 'pending', -- pending, completed, overdue
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## API Endpoints

### Career Path Endpoints
- `GET /api/career-paths/search` - Search career paths by role/industry
- `GET /api/career-paths/:nodeId` - Get specific career node details
- `GET /api/career-paths/:fromNodeId/transitions` - Get possible transitions
- `POST /api/career-paths/visualize` - Generate visualization data

### Skills Gap Analysis
- `GET /api/skills-gap/:currentRole/:targetRole` - Analyze skills gap
- `GET /api/skills-gap/user/:userId` - Get user's skills gaps for goals
- `POST /api/skills-gap/assessment` - Submit skills self-assessment

### Learning Recommendations
- `GET /api/learning/recommendations/:skillId` - Get learning resources
- `GET /api/learning/user/:userId/plan` - Get personalized learning plan
- `POST /api/learning/progress` - Log learning activity

### Goal Tracking
- `GET /api/goals/user/:userId` - Get user's career goals
- `POST /api/goals` - Create new career goal
- `PUT /api/goals/:goalId` - Update goal progress
- `GET /api/goals/:goalId/milestones` - Get goal milestones

## Implementation Plan

### Phase 1: Core Infrastructure (Week 1)
1. Create database schema and migrations
2. Populate initial career path data
3. Build basic API endpoints
4. Create service layer for career path logic

### Phase 2: Skills Gap Analysis (Week 2)
1. Implement skills comparison algorithm
2. Create skills assessment interface
3. Build gap analysis visualization
4. Add market demand weighting

### Phase 3: Learning Integration (Week 3)
1. Aggregate learning resource data
2. Build recommendation engine
3. Create learning plan generator
4. Add progress tracking

### Phase 4: Goal Management (Week 4)
1. Create goal setting interface
2. Implement milestone tracking
3. Add notifications and reminders
4. Build progress visualization

### Phase 5: Frontend Development (Week 5-6)
1. Design career path visualization component
2. Create skills gap dashboard
3. Build learning recommendations UI
4. Implement goal tracking interface

## Success Metrics
- User engagement with career paths
- Goals created and completed
- Skills developed through recommendations
- Career transitions achieved
- User satisfaction scores

## Security Considerations
- Ensure user career data privacy
- Validate goal and milestone inputs
- Secure learning resource URLs
- Audit trail for goal updates

## Future Enhancements
- AI-powered career coaching
- Mentor matching system
- Company-specific career paths
- Salary negotiation guidance
- Interview preparation for transitions