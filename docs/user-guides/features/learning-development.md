# Learning & Development Feature

## Overview

The Learning & Development feature transforms Pathfinder into a comprehensive career growth platform by integrating personalized learning recommendations, skill assessments, certification tracking, and custom learning paths. This feature helps users continuously develop their skills and advance their careers through targeted education.

## Core Components

### 1. Course Recommendations
- AI-powered course suggestions based on career goals
- Integration with major learning platforms (Coursera, Udemy, LinkedIn Learning)
- Personalized recommendations based on skill gaps
- Cost-benefit analysis for courses
- Time commitment estimation

### 2. Skill Assessment Tools
- Pre-built assessments for common skills
- Custom assessment creation
- Skill level benchmarking
- Progress tracking over time
- Peer comparison analytics
- Practical project-based assessments

### 3. Certification Tracking
- Digital credential storage
- Expiration reminders
- Renewal tracking
- Verification status
- Industry recognition scores
- CPE/CEU credit tracking

### 4. Learning Path Creation
- Goal-oriented learning sequences
- Milestone tracking
- Adaptive path adjustments
- Time estimation
- Resource bundling
- Community learning paths

## Data Model

### Course Catalog
```sql
-- Course information from various providers
CREATE TABLE pf_courses (
    course_id VARCHAR2(26) PRIMARY KEY,
    external_course_id VARCHAR2(255),
    provider VARCHAR2(50) NOT NULL, -- coursera, udemy, linkedin_learning, etc.
    course_title VARCHAR2(500) NOT NULL,
    course_description CLOB,
    provider_url VARCHAR2(1000),
    instructor_name VARCHAR2(255),
    duration_hours NUMBER(6,1),
    difficulty_level VARCHAR2(20), -- beginner, intermediate, advanced, expert
    price_usd NUMBER(8,2),
    price_currency VARCHAR2(3) DEFAULT 'USD',
    languages CLOB CHECK (languages IS JSON), -- Array of available languages
    skills_covered CLOB CHECK (skills_covered IS JSON), -- Array of skills
    prerequisites CLOB CHECK (prerequisites IS JSON),
    learning_objectives CLOB CHECK (learning_objectives IS JSON),
    course_format VARCHAR2(50), -- video, text, interactive, mixed
    certificate_available CHAR(1) DEFAULT 'N' CHECK (certificate_available IN ('Y', 'N')),
    rating NUMBER(3,2),
    review_count NUMBER,
    enrolled_count NUMBER,
    last_updated DATE,
    is_active CHAR(1) DEFAULT 'Y' CHECK (is_active IN ('Y', 'N')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User course enrollments
CREATE TABLE pf_user_courses (
    enrollment_id VARCHAR2(26) PRIMARY KEY,
    user_id VARCHAR2(26) NOT NULL,
    course_id VARCHAR2(26) REFERENCES pf_courses(course_id),
    enrollment_date DATE DEFAULT CURRENT_DATE,
    start_date DATE,
    expected_completion_date DATE,
    actual_completion_date DATE,
    progress_percentage NUMBER(3) DEFAULT 0 CHECK (progress_percentage BETWEEN 0 AND 100),
    status VARCHAR2(20) DEFAULT 'enrolled', -- enrolled, in_progress, completed, abandoned
    time_spent_hours NUMBER(6,1) DEFAULT 0,
    certificate_earned CHAR(1) DEFAULT 'N' CHECK (certificate_earned IN ('Y', 'N')),
    certificate_url VARCHAR2(1000),
    user_rating NUMBER(1) CHECK (user_rating BETWEEN 1 AND 5),
    user_review CLOB,
    notes CLOB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Skill assessments
CREATE TABLE pf_skill_assessments (
    assessment_id VARCHAR2(26) PRIMARY KEY,
    skill_id VARCHAR2(26) NOT NULL,
    assessment_name VARCHAR2(255) NOT NULL,
    assessment_type VARCHAR2(50), -- quiz, project, peer_review, self_assessment
    difficulty_level VARCHAR2(20),
    description CLOB,
    instructions CLOB,
    time_limit_minutes NUMBER,
    passing_score NUMBER(3) DEFAULT 70,
    questions CLOB CHECK (questions IS JSON), -- Array of questions/tasks
    rubric CLOB CHECK (rubric IS JSON), -- Scoring rubric
    max_attempts NUMBER DEFAULT 3,
    is_active CHAR(1) DEFAULT 'Y' CHECK (is_active IN ('Y', 'N')),
    created_by VARCHAR2(26),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User assessment results
CREATE TABLE pf_user_assessments (
    result_id VARCHAR2(26) PRIMARY KEY,
    user_id VARCHAR2(26) NOT NULL,
    assessment_id VARCHAR2(26) REFERENCES pf_skill_assessments(assessment_id),
    attempt_number NUMBER DEFAULT 1,
    start_time TIMESTAMP,
    end_time TIMESTAMP,
    score NUMBER(5,2),
    percentage_score NUMBER(3) CHECK (percentage_score BETWEEN 0 AND 100),
    passed CHAR(1) CHECK (passed IN ('Y', 'N')),
    answers CLOB CHECK (answers IS JSON), -- User's answers
    feedback CLOB CHECK (feedback IS JSON), -- Detailed feedback
    time_taken_minutes NUMBER,
    skill_level_achieved VARCHAR2(20), -- novice, competent, proficient, expert
    strengths CLOB CHECK (strengths IS JSON),
    improvement_areas CLOB CHECK (improvement_areas IS JSON),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Professional certifications
CREATE TABLE pf_certifications (
    certification_id VARCHAR2(26) PRIMARY KEY,
    certification_name VARCHAR2(500) NOT NULL,
    issuing_organization VARCHAR2(255) NOT NULL,
    credential_id VARCHAR2(255) UNIQUE,
    certification_level VARCHAR2(50), -- foundational, associate, professional, expert
    industry VARCHAR2(100),
    skills_validated CLOB CHECK (skills_validated IS JSON),
    description CLOB,
    requirements CLOB,
    exam_format VARCHAR2(100),
    passing_score VARCHAR2(50),
    validity_period_months NUMBER,
    renewal_requirements CLOB,
    average_salary_impact NUMBER(8,2),
    market_demand_score NUMBER(3,2), -- 0-5 scale
    preparation_hours_avg NUMBER,
    cost_usd NUMBER(8,2),
    official_url VARCHAR2(1000),
    is_active CHAR(1) DEFAULT 'Y' CHECK (is_active IN ('Y', 'N')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User certifications
CREATE TABLE pf_user_certifications (
    user_cert_id VARCHAR2(26) PRIMARY KEY,
    user_id VARCHAR2(26) NOT NULL,
    certification_id VARCHAR2(26) REFERENCES pf_certifications(certification_id),
    credential_number VARCHAR2(255),
    issue_date DATE NOT NULL,
    expiry_date DATE,
    status VARCHAR2(20) DEFAULT 'active', -- active, expired, revoked, renewing
    verification_url VARCHAR2(1000),
    certificate_file_url VARCHAR2(1000),
    cpe_credits_earned NUMBER(5,1),
    preparation_hours NUMBER,
    exam_score VARCHAR2(50),
    exam_date DATE,
    renewal_reminder_date DATE,
    notes CLOB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Learning paths
CREATE TABLE pf_learning_paths (
    path_id VARCHAR2(26) PRIMARY KEY,
    path_name VARCHAR2(255) NOT NULL,
    path_description CLOB,
    created_by VARCHAR2(26), -- NULL for system paths
    target_role VARCHAR2(255),
    target_level VARCHAR2(50), -- entry, mid, senior, expert
    estimated_duration_weeks NUMBER,
    difficulty_level VARCHAR2(20),
    skills_gained CLOB CHECK (skills_gained IS JSON),
    prerequisites CLOB CHECK (prerequisites IS JSON),
    is_public CHAR(1) DEFAULT 'N' CHECK (is_public IN ('Y', 'N')),
    popularity_score NUMBER(5) DEFAULT 0,
    completion_count NUMBER DEFAULT 0,
    average_rating NUMBER(3,2),
    tags CLOB CHECK (tags IS JSON),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Learning path steps
CREATE TABLE pf_learning_path_steps (
    step_id VARCHAR2(26) PRIMARY KEY,
    path_id VARCHAR2(26) REFERENCES pf_learning_paths(path_id) ON DELETE CASCADE,
    step_number NUMBER NOT NULL,
    step_type VARCHAR2(50), -- course, assessment, project, certification, reading
    resource_id VARCHAR2(26), -- References course_id, assessment_id, etc.
    step_name VARCHAR2(255) NOT NULL,
    step_description CLOB,
    estimated_hours NUMBER(5,1),
    is_optional CHAR(1) DEFAULT 'N' CHECK (is_optional IN ('Y', 'N')),
    dependencies CLOB CHECK (dependencies IS JSON), -- Array of prerequisite step_ids
    success_criteria CLOB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_path_step_number UNIQUE (path_id, step_number)
);

-- User learning paths
CREATE TABLE pf_user_learning_paths (
    user_path_id VARCHAR2(26) PRIMARY KEY,
    user_id VARCHAR2(26) NOT NULL,
    path_id VARCHAR2(26) REFERENCES pf_learning_paths(path_id),
    start_date DATE DEFAULT CURRENT_DATE,
    target_completion_date DATE,
    actual_completion_date DATE,
    current_step_number NUMBER DEFAULT 1,
    progress_percentage NUMBER(3) DEFAULT 0 CHECK (progress_percentage BETWEEN 0 AND 100),
    status VARCHAR2(20) DEFAULT 'active', -- active, paused, completed, abandoned
    time_invested_hours NUMBER(6,1) DEFAULT 0,
    notes CLOB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User learning path progress
CREATE TABLE pf_user_path_progress (
    progress_id VARCHAR2(26) PRIMARY KEY,
    user_path_id VARCHAR2(26) REFERENCES pf_user_learning_paths(user_path_id) ON DELETE CASCADE,
    step_id VARCHAR2(26) REFERENCES pf_learning_path_steps(step_id),
    status VARCHAR2(20) DEFAULT 'not_started', -- not_started, in_progress, completed, skipped
    start_date DATE,
    completion_date DATE,
    time_spent_hours NUMBER(5,1),
    score NUMBER(5,2),
    feedback CLOB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_user_path_step UNIQUE (user_path_id, step_id)
);

-- Learning goals
CREATE TABLE pf_learning_goals (
    goal_id VARCHAR2(26) PRIMARY KEY,
    user_id VARCHAR2(26) NOT NULL,
    goal_title VARCHAR2(255) NOT NULL,
    goal_description CLOB,
    target_date DATE,
    goal_type VARCHAR2(50), -- skill_acquisition, certification, course_completion, project
    target_skill_id VARCHAR2(26),
    target_skill_level VARCHAR2(20),
    related_path_id VARCHAR2(26) REFERENCES pf_learning_paths(path_id),
    progress_percentage NUMBER(3) DEFAULT 0 CHECK (progress_percentage BETWEEN 0 AND 100),
    status VARCHAR2(20) DEFAULT 'active', -- active, completed, missed, cancelled
    completion_date DATE,
    notes CLOB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Course recommendations
CREATE TABLE pf_course_recommendations (
    recommendation_id VARCHAR2(26) PRIMARY KEY,
    user_id VARCHAR2(26) NOT NULL,
    course_id VARCHAR2(26) REFERENCES pf_courses(course_id),
    recommendation_type VARCHAR2(50), -- skill_gap, career_goal, trending, peer_based
    relevance_score NUMBER(3,2) CHECK (relevance_score BETWEEN 0 AND 1),
    reason CLOB,
    skill_gaps_addressed CLOB CHECK (skill_gaps_addressed IS JSON),
    career_impact_score NUMBER(3,2),
    time_to_complete_weeks NUMBER(3,1),
    priority VARCHAR2(20), -- high, medium, low
    valid_until DATE,
    user_action VARCHAR2(20), -- viewed, enrolled, dismissed, completed
    action_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Learning resources (additional materials)
CREATE TABLE pf_learning_resources (
    resource_id VARCHAR2(26) PRIMARY KEY,
    resource_type VARCHAR2(50), -- article, video, book, podcast, tool
    title VARCHAR2(500) NOT NULL,
    author VARCHAR2(255),
    description CLOB,
    url VARCHAR2(1000),
    skills_covered CLOB CHECK (skills_covered IS JSON),
    difficulty_level VARCHAR2(20),
    time_to_consume_minutes NUMBER,
    cost NUMBER(8,2) DEFAULT 0,
    rating NUMBER(3,2),
    tags CLOB CHECK (tags IS JSON),
    created_by VARCHAR2(26),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_courses_provider ON pf_courses(provider);
CREATE INDEX idx_courses_skills ON pf_courses(skills_covered);
CREATE INDEX idx_user_courses_user ON pf_user_courses(user_id, status);
CREATE INDEX idx_assessments_skill ON pf_skill_assessments(skill_id);
CREATE INDEX idx_user_assessments ON pf_user_assessments(user_id, assessment_id);
CREATE INDEX idx_certifications_org ON pf_certifications(issuing_organization);
CREATE INDEX idx_user_certs ON pf_user_certifications(user_id, status);
CREATE INDEX idx_learning_paths_public ON pf_learning_paths(is_public, popularity_score DESC);
CREATE INDEX idx_user_paths ON pf_user_learning_paths(user_id, status);
CREATE INDEX idx_recommendations ON pf_course_recommendations(user_id, recommendation_type);

-- Triggers for timestamp updates
CREATE OR REPLACE TRIGGER trg_courses_updated
BEFORE UPDATE ON pf_courses
FOR EACH ROW
BEGIN
    :NEW.updated_at := CURRENT_TIMESTAMP;
END;
/

CREATE OR REPLACE TRIGGER trg_user_courses_updated
BEFORE UPDATE ON pf_user_courses
FOR EACH ROW
BEGIN
    :NEW.updated_at := CURRENT_TIMESTAMP;
END;
/

CREATE OR REPLACE TRIGGER trg_assessments_updated
BEFORE UPDATE ON pf_skill_assessments
FOR EACH ROW
BEGIN
    :NEW.updated_at := CURRENT_TIMESTAMP;
END;
/

CREATE OR REPLACE TRIGGER trg_certifications_updated
BEFORE UPDATE ON pf_certifications
FOR EACH ROW
BEGIN
    :NEW.updated_at := CURRENT_TIMESTAMP;
END;
/

CREATE OR REPLACE TRIGGER trg_user_certs_updated
BEFORE UPDATE ON pf_user_certifications
FOR EACH ROW
BEGIN
    :NEW.updated_at := CURRENT_TIMESTAMP;
END;
/

CREATE OR REPLACE TRIGGER trg_learning_paths_updated
BEFORE UPDATE ON pf_learning_paths
FOR EACH ROW
BEGIN
    :NEW.updated_at := CURRENT_TIMESTAMP;
END;
/

CREATE OR REPLACE TRIGGER trg_user_paths_updated
BEFORE UPDATE ON pf_user_learning_paths
FOR EACH ROW
BEGIN
    :NEW.updated_at := CURRENT_TIMESTAMP;
END;
/

CREATE OR REPLACE TRIGGER trg_path_progress_updated
BEFORE UPDATE ON pf_user_path_progress
FOR EACH ROW
BEGIN
    :NEW.updated_at := CURRENT_TIMESTAMP;
END;
/

CREATE OR REPLACE TRIGGER trg_goals_updated
BEFORE UPDATE ON pf_learning_goals
FOR EACH ROW
BEGIN
    :NEW.updated_at := CURRENT_TIMESTAMP;
END;
/
```

## API Endpoints

### Course Management
- `GET /api/courses/search` - Search available courses
- `GET /api/courses/:courseId` - Get course details
- `GET /api/courses/recommended` - Get personalized recommendations
- `POST /api/courses/enroll` - Enroll in a course
- `PUT /api/courses/:enrollmentId/progress` - Update course progress
- `POST /api/courses/:enrollmentId/complete` - Mark course as completed
- `GET /api/courses/enrolled` - Get user's enrolled courses

### Skill Assessments
- `GET /api/assessments` - List available assessments
- `GET /api/assessments/:assessmentId` - Get assessment details
- `POST /api/assessments/:assessmentId/start` - Start an assessment
- `POST /api/assessments/:assessmentId/submit` - Submit assessment answers
- `GET /api/assessments/results` - Get user's assessment results
- `GET /api/assessments/skill/:skillId` - Get assessments for a specific skill

### Certification Tracking
- `GET /api/certifications/catalog` - Browse certification catalog
- `GET /api/certifications/:certificationId` - Get certification details
- `POST /api/certifications/add` - Add user certification
- `PUT /api/certifications/:userCertId` - Update certification details
- `GET /api/certifications/my` - Get user's certifications
- `GET /api/certifications/expiring` - Get expiring certifications
- `POST /api/certifications/:userCertId/renew` - Track renewal

### Learning Paths
- `GET /api/learning-paths` - Browse learning paths
- `GET /api/learning-paths/:pathId` - Get path details
- `POST /api/learning-paths` - Create custom learning path
- `POST /api/learning-paths/:pathId/enroll` - Enroll in a path
- `PUT /api/learning-paths/:userPathId/progress` - Update progress
- `GET /api/learning-paths/my` - Get user's learning paths
- `GET /api/learning-paths/recommended` - Get recommended paths

### Learning Goals
- `GET /api/learning-goals` - Get user's learning goals
- `POST /api/learning-goals` - Create learning goal
- `PUT /api/learning-goals/:goalId` - Update goal
- `DELETE /api/learning-goals/:goalId` - Delete goal
- `GET /api/learning-goals/progress` - Get goals progress

### Analytics
- `GET /api/learning/analytics` - Get learning analytics
- `GET /api/learning/skill-progress` - Get skill development progress
- `GET /api/learning/time-investment` - Get time investment report
- `GET /api/learning/completion-rates` - Get completion statistics

## Implementation Plan

### Phase 1: Core Infrastructure (Week 1)
1. Create database schema
2. Set up course catalog integration
3. Build basic CRUD services
4. Implement enrollment system

### Phase 2: Recommendations Engine (Week 2)
1. Develop recommendation algorithm
2. Integrate with skill gap analysis
3. Create personalized suggestions
4. Build feedback loop

### Phase 3: Assessment System (Week 3)
1. Create assessment framework
2. Build question types
3. Implement scoring system
4. Add progress tracking

### Phase 4: Certification & Paths (Week 4)
1. Build certification tracking
2. Create learning path builder
3. Add goal management
4. Implement completion certificates

## Recommendation Algorithm

### Factors Considered
1. **Skill Gaps (40%)**
   - Current vs. required skills
   - Proficiency levels
   - Industry standards

2. **Career Goals (25%)**
   - Target role requirements
   - Timeline to achieve
   - Market demand

3. **Learning Style (15%)**
   - Preferred formats
   - Time availability
   - Budget constraints

4. **Past Performance (10%)**
   - Completion rates
   - Assessment scores
   - Time to complete

5. **Peer Success (10%)**
   - Similar profiles
   - Successful outcomes
   - Popular choices

### Scoring Formula
```javascript
calculateRecommendationScore(user, course) {
  const skillGapScore = calculateSkillGapCoverage(user.skillGaps, course.skillsCovered);
  const careerScore = calculateCareerAlignment(user.careerGoals, course.outcomes);
  const styleScore = calculateLearningStyleMatch(user.preferences, course.format);
  const performanceScore = calculateLikelihoodOfCompletion(user.history, course.difficulty);
  const peerScore = calculatePeerSuccess(user.profile, course.completions);
  
  return {
    overall: (
      skillGapScore * 0.40 +
      careerScore * 0.25 +
      styleScore * 0.15 +
      performanceScore * 0.10 +
      peerScore * 0.10
    ),
    breakdown: {
      skillGap: skillGapScore,
      career: careerScore,
      style: styleScore,
      performance: performanceScore,
      peer: peerScore
    }
  };
}
```

## Integration Partners

### Course Providers
1. **Coursera**
   - University courses
   - Professional certificates
   - Specializations

2. **Udemy**
   - Technical skills
   - Business skills
   - Creative skills

3. **LinkedIn Learning**
   - Professional development
   - Software training
   - Business skills

4. **Pluralsight**
   - Technology courses
   - IT certifications
   - Developer tools

### Certification Bodies
- CompTIA
- Microsoft
- AWS
- Google
- PMI
- ISC2
- Oracle
- Cisco

## Success Metrics

### Usage Metrics
- Course enrollments per user
- Assessment completion rate
- Learning path adherence
- Goal achievement rate

### Quality Metrics
- Course completion rate
- Assessment pass rate
- Skill improvement scores
- Certification success rate

### Business Metrics
- User engagement increase
- Premium conversion for learning features
- Partner revenue share
- Corporate account adoption

## Privacy & Compliance

### Data Protection
- Secure credential storage
- Encrypted assessment results
- Limited retention policies
- User consent for recommendations

### Academic Integrity
- Plagiarism detection
- Identity verification
- Proctoring integration
- Honor code enforcement

## Future Enhancements

### Advanced Features
- Virtual study groups
- Peer mentoring
- Live workshop integration
- AR/VR training modules
- Micro-learning integration

### AI Enhancements
- Adaptive learning paths
- Personalized study schedules
- Performance prediction
- Skill decay modeling
- Optimal review timing