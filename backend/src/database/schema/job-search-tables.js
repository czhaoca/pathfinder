/**
 * Job Search Integration Tables
 */

async function createJobSearchTables(db, prefix = 'pf_') {
  // Job listings
  await db.execute(`
    CREATE TABLE ${prefix}job_listings (
      job_id VARCHAR2(26) DEFAULT SYS_GUID() PRIMARY KEY,
      external_job_id VARCHAR2(255),
      source VARCHAR2(50) NOT NULL,
      company_id VARCHAR2(26),
      job_title VARCHAR2(200) NOT NULL,
      company_name VARCHAR2(200) NOT NULL,
      location VARCHAR2(200),
      remote_type VARCHAR2(50) CHECK (
        remote_type IN ('onsite', 'remote', 'hybrid', 'flexible')
      ),
      employment_type VARCHAR2(50) CHECK (
        employment_type IN ('full-time', 'part-time', 'contract', 'internship', 'temporary')
      ),
      experience_level VARCHAR2(50) CHECK (
        experience_level IN ('entry', 'mid', 'senior', 'lead', 'executive')
      ),
      salary_min NUMBER(10),
      salary_max NUMBER(10),
      salary_currency VARCHAR2(3) DEFAULT 'USD',
      job_description CLOB,
      requirements CLOB CHECK (requirements IS JSON),
      benefits CLOB CHECK (benefits IS JSON),
      skills_required CLOB CHECK (skills_required IS JSON),
      posted_date DATE,
      application_deadline DATE,
      job_url VARCHAR2(1000),
      is_active CHAR(1) DEFAULT 'Y' CHECK (is_active IN ('Y', 'N')),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT ${prefix}fk_job_company FOREIGN KEY (company_id) 
        REFERENCES ${prefix}companies(company_id) ON DELETE SET NULL
    )
  `);

  // Companies
  await db.execute(`
    CREATE TABLE ${prefix}companies (
      company_id VARCHAR2(26) DEFAULT SYS_GUID() PRIMARY KEY,
      company_name VARCHAR2(200) NOT NULL,
      industry VARCHAR2(100),
      company_size VARCHAR2(50),
      headquarters_location VARCHAR2(200),
      website VARCHAR2(500),
      linkedin_url VARCHAR2(500),
      glassdoor_url VARCHAR2(500),
      description CLOB,
      culture_values CLOB CHECK (culture_values IS JSON),
      benefits CLOB CHECK (benefits IS JSON),
      tech_stack CLOB CHECK (tech_stack IS JSON),
      rating_overall NUMBER(2,1),
      rating_culture NUMBER(2,1),
      rating_compensation NUMBER(2,1),
      rating_work_life NUMBER(2,1),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Job preferences
  await db.execute(`
    CREATE TABLE ${prefix}job_preferences (
      preference_id VARCHAR2(26) DEFAULT SYS_GUID() PRIMARY KEY,
      user_id VARCHAR2(26) UNIQUE NOT NULL,
      desired_roles CLOB CHECK (desired_roles IS JSON),
      desired_industries CLOB CHECK (desired_industries IS JSON),
      preferred_locations CLOB CHECK (preferred_locations IS JSON),
      remote_preference VARCHAR2(50),
      salary_min_expected NUMBER(10),
      salary_max_expected NUMBER(10),
      company_size_preference CLOB CHECK (company_size_preference IS JSON),
      culture_preferences CLOB CHECK (culture_preferences IS JSON),
      must_have_benefits CLOB CHECK (must_have_benefits IS JSON),
      deal_breakers CLOB CHECK (deal_breakers IS JSON),
      is_actively_looking CHAR(1) DEFAULT 'N' CHECK (is_actively_looking IN ('Y', 'N')),
      availability_date DATE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT ${prefix}fk_pref_user FOREIGN KEY (user_id) 
        REFERENCES ${prefix}users(user_id) ON DELETE CASCADE
    )
  `);

  // Saved searches
  await db.execute(`
    CREATE TABLE ${prefix}saved_searches (
      search_id VARCHAR2(26) DEFAULT SYS_GUID() PRIMARY KEY,
      user_id VARCHAR2(26) NOT NULL,
      search_name VARCHAR2(200) NOT NULL,
      search_criteria CLOB CHECK (search_criteria IS JSON),
      notification_frequency VARCHAR2(20) CHECK (
        notification_frequency IN ('realtime', 'daily', 'weekly', 'never')
      ),
      last_run_date TIMESTAMP,
      results_count NUMBER(10),
      is_active CHAR(1) DEFAULT 'Y' CHECK (is_active IN ('Y', 'N')),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT ${prefix}fk_search_user FOREIGN KEY (user_id) 
        REFERENCES ${prefix}users(user_id) ON DELETE CASCADE
    )
  `);

  // Applications
  await db.execute(`
    CREATE TABLE ${prefix}applications (
      application_id VARCHAR2(26) DEFAULT SYS_GUID() PRIMARY KEY,
      user_id VARCHAR2(26) NOT NULL,
      job_id VARCHAR2(26) NOT NULL,
      status VARCHAR2(50) DEFAULT 'draft' CHECK (
        status IN ('draft', 'applied', 'screening', 'interview', 'offer', 'rejected', 'withdrawn', 'accepted')
      ),
      application_date DATE,
      resume_version_id VARCHAR2(26),
      cover_letter_id VARCHAR2(26),
      custom_answers CLOB CHECK (custom_answers IS JSON),
      referral_contact_id VARCHAR2(26),
      application_url VARCHAR2(1000),
      notes CLOB,
      next_steps CLOB,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT ${prefix}fk_app_user FOREIGN KEY (user_id) 
        REFERENCES ${prefix}users(user_id) ON DELETE CASCADE,
      CONSTRAINT ${prefix}fk_app_job FOREIGN KEY (job_id) 
        REFERENCES ${prefix}job_listings(job_id) ON DELETE CASCADE,
      CONSTRAINT ${prefix}fk_app_referral FOREIGN KEY (referral_contact_id) 
        REFERENCES ${prefix}professional_contacts(contact_id) ON DELETE SET NULL
    )
  `);

  // Application timeline
  await db.execute(`
    CREATE TABLE ${prefix}application_timeline (
      timeline_id VARCHAR2(26) DEFAULT SYS_GUID() PRIMARY KEY,
      application_id VARCHAR2(26) NOT NULL,
      event_type VARCHAR2(50) NOT NULL,
      event_date TIMESTAMP NOT NULL,
      event_description VARCHAR2(500),
      metadata CLOB CHECK (metadata IS JSON),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT ${prefix}fk_timeline_app FOREIGN KEY (application_id) 
        REFERENCES ${prefix}applications(application_id) ON DELETE CASCADE
    )
  `);

  // Interview preparation
  await db.execute(`
    CREATE TABLE ${prefix}interview_prep (
      prep_id VARCHAR2(26) DEFAULT SYS_GUID() PRIMARY KEY,
      application_id VARCHAR2(26) NOT NULL,
      interview_round VARCHAR2(50),
      interview_type VARCHAR2(50) CHECK (
        interview_type IN ('phone', 'video', 'onsite', 'technical', 'behavioral', 'case', 'panel')
      ),
      scheduled_date TIMESTAMP,
      interviewer_names CLOB CHECK (interviewer_names IS JSON),
      preparation_notes CLOB,
      questions_to_ask CLOB CHECK (questions_to_ask IS JSON),
      expected_questions CLOB CHECK (expected_questions IS JSON),
      practice_answers CLOB CHECK (practice_answers IS JSON),
      company_research CLOB,
      post_interview_notes CLOB,
      outcome VARCHAR2(50),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT ${prefix}fk_prep_app FOREIGN KEY (application_id) 
        REFERENCES ${prefix}applications(application_id) ON DELETE CASCADE
    )
  `);

  // Job match scores
  await db.execute(`
    CREATE TABLE ${prefix}job_match_scores (
      match_id VARCHAR2(26) DEFAULT SYS_GUID() PRIMARY KEY,
      user_id VARCHAR2(26) NOT NULL,
      job_id VARCHAR2(26) NOT NULL,
      overall_score NUMBER(3,2) CHECK (overall_score BETWEEN 0 AND 1),
      skills_match NUMBER(3,2) CHECK (skills_match BETWEEN 0 AND 1),
      experience_match NUMBER(3,2) CHECK (experience_match BETWEEN 0 AND 1),
      culture_match NUMBER(3,2) CHECK (culture_match BETWEEN 0 AND 1),
      location_match NUMBER(3,2) CHECK (location_match BETWEEN 0 AND 1),
      salary_match NUMBER(3,2) CHECK (salary_match BETWEEN 0 AND 1),
      match_details CLOB CHECK (match_details IS JSON),
      calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT ${prefix}fk_match_user FOREIGN KEY (user_id) 
        REFERENCES ${prefix}users(user_id) ON DELETE CASCADE,
      CONSTRAINT ${prefix}fk_match_job FOREIGN KEY (job_id) 
        REFERENCES ${prefix}job_listings(job_id) ON DELETE CASCADE,
      CONSTRAINT ${prefix}uk_user_job_match UNIQUE (user_id, job_id)
    )
  `);
}

module.exports = createJobSearchTables;