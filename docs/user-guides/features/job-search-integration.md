# Job Search Integration Feature

## Overview

The Job Search Integration feature transforms Pathfinder into a comprehensive career advancement platform by integrating job search capabilities, intelligent job matching, application tracking, and interview preparation tools. This feature helps users discover relevant opportunities, track their job search progress, and prepare effectively for interviews.

## Core Components

### 1. Job Board Integration
- Multiple job board API connections (Indeed, LinkedIn, Glassdoor, etc.)
- Real-time job data synchronization
- Unified job search interface
- Custom job alerts and notifications
- Job data enrichment and normalization

### 2. Job Matching Algorithm
- AI-powered job-candidate matching
- Skills-based compatibility scoring
- Experience level matching
- Culture fit assessment
- Salary expectation alignment
- Location and remote work preferences

### 3. Application Tracking System (ATS)
- Application status tracking
- Interview scheduling and tracking
- Document management (resumes, cover letters)
- Communication history
- Pipeline visualization
- Analytics and insights

### 4. Interview Preparation
- Company research automation
- Common interview questions by role/company
- STAR method response builder
- Mock interview scheduling
- Interview feedback tracking
- Salary negotiation guidance

## Data Model

### Job Listings
```sql
-- Job postings from various sources
CREATE TABLE pf_job_listings (
    job_id VARCHAR2(26) PRIMARY KEY,
    external_job_id VARCHAR2(255), -- ID from job board
    source VARCHAR2(50) NOT NULL, -- indeed, linkedin, glassdoor, etc.
    company_name VARCHAR2(255) NOT NULL,
    company_id VARCHAR2(26), -- Reference to company profiles
    job_title VARCHAR2(255) NOT NULL,
    job_description CLOB NOT NULL,
    requirements CLOB,
    responsibilities CLOB,
    required_skills CLOB CHECK (required_skills IS JSON), -- Array of skills
    preferred_skills CLOB CHECK (preferred_skills IS JSON),
    experience_level VARCHAR2(50), -- entry, mid, senior, executive
    experience_years_min NUMBER,
    experience_years_max NUMBER,
    education_requirements VARCHAR2(255),
    job_type VARCHAR2(50), -- full-time, part-time, contract, internship
    location VARCHAR2(255),
    is_remote CHAR(1) DEFAULT 'N' CHECK (is_remote IN ('Y', 'N')),
    remote_type VARCHAR2(50), -- fully_remote, hybrid, occasional
    salary_min NUMBER,
    salary_max NUMBER,
    salary_currency VARCHAR2(3) DEFAULT 'USD',
    salary_period VARCHAR2(20), -- hourly, monthly, yearly
    benefits CLOB CHECK (benefits IS JSON),
    posting_date DATE,
    application_deadline DATE,
    job_url VARCHAR2(1000),
    apply_url VARCHAR2(1000),
    is_active CHAR(1) DEFAULT 'Y' CHECK (is_active IN ('Y', 'N')),
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for job search
CREATE INDEX idx_jobs_title ON pf_job_listings(UPPER(job_title));
CREATE INDEX idx_jobs_company ON pf_job_listings(company_name);
CREATE INDEX idx_jobs_location ON pf_job_listings(location);
CREATE INDEX idx_jobs_experience ON pf_job_listings(experience_level);
CREATE INDEX idx_jobs_active_date ON pf_job_listings(is_active, posting_date DESC);

-- Company profiles
CREATE TABLE pf_companies (
    company_id VARCHAR2(26) PRIMARY KEY,
    company_name VARCHAR2(255) NOT NULL,
    industry VARCHAR2(100),
    company_size VARCHAR2(50), -- 1-10, 11-50, 51-200, etc.
    headquarters_location VARCHAR2(255),
    website_url VARCHAR2(500),
    linkedin_url VARCHAR2(500),
    glassdoor_url VARCHAR2(500),
    description CLOB,
    culture_values CLOB CHECK (culture_values IS JSON),
    tech_stack CLOB CHECK (tech_stack IS JSON),
    benefits_summary CLOB,
    rating_glassdoor NUMBER(3,2),
    rating_indeed NUMBER(3,2),
    logo_url VARCHAR2(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Job applications
CREATE TABLE pf_job_applications (
    application_id VARCHAR2(26) PRIMARY KEY,
    user_id VARCHAR2(26) NOT NULL,
    job_id VARCHAR2(26) REFERENCES pf_job_listings(job_id),
    company_id VARCHAR2(26) REFERENCES pf_companies(company_id),
    status VARCHAR2(50) DEFAULT 'interested', -- interested, applied, screening, interviewing, offer, rejected, withdrawn
    application_date DATE,
    resume_version_id VARCHAR2(26), -- Link to specific resume used
    cover_letter_id VARCHAR2(26),
    application_method VARCHAR2(50), -- platform, email, referral, direct
    referral_contact_id VARCHAR2(26), -- Link to networking contact
    application_notes CLOB,
    excitement_level NUMBER(1) CHECK (excitement_level BETWEEN 1 AND 5),
    fit_score NUMBER(3,2), -- AI-calculated fit score
    salary_expectation_min NUMBER,
    salary_expectation_max NUMBER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_applications_user ON pf_job_applications(user_id, status);
CREATE INDEX idx_applications_date ON pf_job_applications(application_date DESC);

-- Application status history
CREATE TABLE pf_application_status_history (
    history_id VARCHAR2(26) PRIMARY KEY,
    application_id VARCHAR2(26) REFERENCES pf_job_applications(application_id) ON DELETE CASCADE,
    old_status VARCHAR2(50),
    new_status VARCHAR2(50) NOT NULL,
    changed_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes CLOB
);

-- Interviews
CREATE TABLE pf_interviews (
    interview_id VARCHAR2(26) PRIMARY KEY,
    application_id VARCHAR2(26) REFERENCES pf_job_applications(application_id) ON DELETE CASCADE,
    interview_round NUMBER DEFAULT 1,
    interview_type VARCHAR2(50), -- phone, video, onsite, technical, behavioral
    scheduled_date TIMESTAMP,
    duration_minutes NUMBER,
    interviewer_names CLOB, -- JSON array
    location VARCHAR2(500), -- Physical address or video link
    preparation_notes CLOB,
    questions_asked CLOB CHECK (questions_asked IS JSON), -- Array of questions
    your_questions CLOB CHECK (your_questions IS JSON), -- Questions you asked
    interview_notes CLOB,
    feedback_received CLOB,
    outcome VARCHAR2(50), -- passed, failed, pending, cancelled
    next_steps CLOB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Job search preferences
CREATE TABLE pf_job_search_preferences (
    preference_id VARCHAR2(26) PRIMARY KEY,
    user_id VARCHAR2(26) NOT NULL UNIQUE,
    target_roles CLOB CHECK (target_roles IS JSON), -- Array of job titles
    target_companies CLOB CHECK (target_companies IS JSON), -- Array of company names
    industries CLOB CHECK (industries IS JSON),
    locations CLOB CHECK (locations IS JSON),
    remote_preference VARCHAR2(50), -- only_remote, prefer_remote, open_to_remote, prefer_onsite, only_onsite
    salary_min_expected NUMBER,
    salary_max_expected NUMBER,
    job_types CLOB CHECK (job_types IS JSON), -- full-time, contract, etc.
    company_sizes CLOB CHECK (company_sizes IS JSON),
    must_have_benefits CLOB CHECK (must_have_benefits IS JSON),
    deal_breakers CLOB CHECK (deal_breakers IS JSON),
    search_status VARCHAR2(50) DEFAULT 'passive', -- active, passive, not_looking
    urgency_level VARCHAR2(20), -- immediate, 3_months, 6_months, exploring
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Saved job searches
CREATE TABLE pf_saved_searches (
    search_id VARCHAR2(26) PRIMARY KEY,
    user_id VARCHAR2(26) NOT NULL,
    search_name VARCHAR2(255),
    search_criteria CLOB CHECK (search_criteria IS JSON), -- Full search parameters
    notification_frequency VARCHAR2(50), -- daily, weekly, instant
    is_active CHAR(1) DEFAULT 'Y' CHECK (is_active IN ('Y', 'N')),
    last_run_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Job matching scores
CREATE TABLE pf_job_match_scores (
    match_id VARCHAR2(26) PRIMARY KEY,
    user_id VARCHAR2(26) NOT NULL,
    job_id VARCHAR2(26) REFERENCES pf_job_listings(job_id),
    overall_score NUMBER(3,2) CHECK (overall_score BETWEEN 0 AND 1),
    skills_match_score NUMBER(3,2),
    experience_match_score NUMBER(3,2),
    culture_fit_score NUMBER(3,2),
    location_match_score NUMBER(3,2),
    salary_match_score NUMBER(3,2),
    match_reasons CLOB CHECK (match_reasons IS JSON), -- Array of reasons
    missing_skills CLOB CHECK (missing_skills IS JSON),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_user_job_match UNIQUE (user_id, job_id)
);

CREATE INDEX idx_match_scores ON pf_job_match_scores(user_id, overall_score DESC);

-- Interview preparation resources
CREATE TABLE pf_interview_prep (
    prep_id VARCHAR2(26) PRIMARY KEY,
    company_id VARCHAR2(26) REFERENCES pf_companies(company_id),
    role_category VARCHAR2(100), -- software_engineer, product_manager, etc.
    question_text CLOB NOT NULL,
    question_type VARCHAR2(50), -- behavioral, technical, situational
    difficulty_level VARCHAR2(20), -- easy, medium, hard
    sample_answer CLOB,
    answer_framework VARCHAR2(50), -- STAR, situation-task-action-result
    tips CLOB,
    source VARCHAR2(255), -- glassdoor, leetcode, user_submitted
    times_asked NUMBER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User interview responses
CREATE TABLE pf_interview_responses (
    response_id VARCHAR2(26) PRIMARY KEY,
    user_id VARCHAR2(26) NOT NULL,
    prep_id VARCHAR2(26) REFERENCES pf_interview_prep(prep_id),
    interview_id VARCHAR2(26) REFERENCES pf_interviews(interview_id),
    response_text CLOB,
    self_rating NUMBER(1) CHECK (self_rating BETWEEN 1 AND 5),
    needs_improvement CHAR(1) DEFAULT 'N' CHECK (needs_improvement IN ('Y', 'N')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## API Endpoints

### Job Search
- `GET /api/jobs/search` - Search job listings
- `GET /api/jobs/:jobId` - Get job details
- `GET /api/jobs/recommended` - Get AI-recommended jobs
- `POST /api/jobs/match-scores` - Calculate match scores for jobs

### Application Management
- `GET /api/applications` - List user's applications
- `POST /api/applications` - Create new application
- `PUT /api/applications/:applicationId` - Update application
- `GET /api/applications/:applicationId/timeline` - Get application timeline
- `DELETE /api/applications/:applicationId` - Withdraw application

### Interview Management
- `GET /api/interviews` - List interviews
- `POST /api/interviews` - Schedule interview
- `PUT /api/interviews/:interviewId` - Update interview details
- `GET /api/interviews/:interviewId/prep` - Get interview prep materials

### Job Preferences
- `GET /api/job-preferences` - Get user preferences
- `PUT /api/job-preferences` - Update preferences
- `POST /api/saved-searches` - Save search criteria
- `GET /api/saved-searches` - List saved searches

### Company Research
- `GET /api/companies/:companyId` - Get company details
- `GET /api/companies/:companyId/interview-insights` - Get interview insights
- `GET /api/companies/:companyId/culture` - Get culture information

## Implementation Plan

### Phase 1: Core Infrastructure (Week 1)
1. Create database schema
2. Set up job board API integrations
3. Implement job data ingestion pipeline
4. Build basic search functionality

### Phase 2: Matching Algorithm (Week 2)
1. Develop skills matching algorithm
2. Implement experience matching
3. Create culture fit assessment
4. Build recommendation engine

### Phase 3: Application Tracking (Week 3)
1. Create application management system
2. Build status tracking workflow
3. Implement document management
4. Add analytics dashboard

### Phase 4: Interview Preparation (Week 4)
1. Build interview question database
2. Create preparation resources
3. Implement response tracking
4. Add mock interview features

## Job Matching Algorithm

### Matching Factors
1. **Skills Match (40%)**
   - Required skills coverage
   - Preferred skills bonus
   - Skill level alignment

2. **Experience Match (25%)**
   - Years of experience
   - Industry experience
   - Role progression

3. **Culture Fit (15%)**
   - Company values alignment
   - Work style preferences
   - Team dynamics

4. **Location & Logistics (10%)**
   - Location preferences
   - Remote work alignment
   - Commute considerations

5. **Compensation (10%)**
   - Salary range overlap
   - Benefits alignment
   - Growth potential

### Scoring Algorithm
```javascript
calculateMatchScore(userProfile, jobListing) {
  const scores = {
    skills: calculateSkillsMatch(userProfile.skills, jobListing.required_skills, jobListing.preferred_skills),
    experience: calculateExperienceMatch(userProfile.experience, jobListing.experience_requirements),
    culture: calculateCultureFit(userProfile.values, jobListing.company.culture),
    location: calculateLocationMatch(userProfile.location_prefs, jobListing.location),
    salary: calculateSalaryMatch(userProfile.salary_expectations, jobListing.salary_range)
  };
  
  const weights = {
    skills: 0.40,
    experience: 0.25,
    culture: 0.15,
    location: 0.10,
    salary: 0.10
  };
  
  return calculateWeightedScore(scores, weights);
}
```

## Integration Partners

### Job Boards
1. **LinkedIn Jobs API**
   - Premium job listings
   - Company insights
   - Network connections

2. **Indeed API**
   - Broad job coverage
   - Salary insights
   - Company reviews

3. **Glassdoor API**
   - Interview questions
   - Company culture
   - Salary data

4. **AngelList (Wellfound)**
   - Startup jobs
   - Equity information
   - Startup culture

### Additional Data Sources
- GitHub Jobs (tech roles)
- RemoteOK (remote positions)
- Dice (tech jobs)
- SimplyHired (aggregator)

## Success Metrics

### Usage Metrics
- Job searches per user
- Applications submitted
- Interview conversion rate
- Offer rate
- Time to hire

### Quality Metrics
- Match score accuracy
- User satisfaction with recommendations
- Application success rate
- Interview preparation effectiveness

### Outcome Metrics
- Jobs landed through platform
- Salary improvements
- Career advancement
- User retention during job search

## Privacy & Compliance

### Data Protection
- Secure storage of application data
- Encrypted communication history
- Limited data retention
- User consent for data sharing

### Compliance
- Equal opportunity compliance
- GDPR/CCPA compliance
- Job board ToS compliance
- Anti-discrimination measures

## Future Enhancements

### Advanced Features
- Video interview practice with AI feedback
- Salary negotiation simulator
- Network-based job discovery
- Automated application submission
- Interview scheduling integration

### AI Enhancements
- Resume optimization for ATS
- Cover letter generation
- Interview answer coaching
- Negotiation strategy recommendations
- Career transition planning