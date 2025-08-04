/**
 * Learning & Development Tables
 */

async function createLearningTables(db, prefix = 'pf_') {
  // Courses catalog
  await db.execute(`
    CREATE TABLE ${prefix}courses (
      course_id VARCHAR2(26) DEFAULT SYS_GUID() PRIMARY KEY,
      external_course_id VARCHAR2(255),
      provider VARCHAR2(50) NOT NULL,
      course_title VARCHAR2(500) NOT NULL,
      description CLOB,
      duration_hours NUMBER(10,1),
      difficulty_level VARCHAR2(20) CHECK (
        difficulty_level IN ('beginner', 'intermediate', 'advanced', 'expert')
      ),
      format VARCHAR2(50) CHECK (
        format IN ('self-paced', 'instructor-led', 'blended', 'bootcamp')
      ),
      price_usd NUMBER(10,2),
      currency VARCHAR2(3) DEFAULT 'USD',
      skills_taught CLOB CHECK (skills_taught IS JSON),
      prerequisites CLOB CHECK (prerequisites IS JSON),
      language VARCHAR2(50) DEFAULT 'English',
      certificate_offered CHAR(1) DEFAULT 'N' CHECK (certificate_offered IN ('Y', 'N')),
      course_url VARCHAR2(1000),
      image_url VARCHAR2(1000),
      rating NUMBER(2,1),
      review_count NUMBER(10),
      enrolled_count NUMBER(10),
      last_updated DATE,
      is_active CHAR(1) DEFAULT 'Y' CHECK (is_active IN ('Y', 'N')),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Course enrollments
  await db.execute(`
    CREATE TABLE ${prefix}course_enrollments (
      enrollment_id VARCHAR2(26) DEFAULT SYS_GUID() PRIMARY KEY,
      user_id VARCHAR2(26) NOT NULL,
      course_id VARCHAR2(26) NOT NULL,
      enrollment_date DATE DEFAULT SYSDATE,
      start_date DATE,
      expected_completion_date DATE,
      actual_completion_date DATE,
      progress_percentage NUMBER(3) DEFAULT 0,
      time_spent_hours NUMBER(10,1) DEFAULT 0,
      status VARCHAR2(20) DEFAULT 'enrolled' CHECK (
        status IN ('enrolled', 'in_progress', 'completed', 'abandoned')
      ),
      certificate_url VARCHAR2(1000),
      user_rating NUMBER(1),
      user_review CLOB,
      notes CLOB,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT ${prefix}fk_enroll_user FOREIGN KEY (user_id) 
        REFERENCES ${prefix}users(user_id) ON DELETE CASCADE,
      CONSTRAINT ${prefix}fk_enroll_course FOREIGN KEY (course_id) 
        REFERENCES ${prefix}courses(course_id) ON DELETE CASCADE,
      CONSTRAINT ${prefix}uk_user_course UNIQUE (user_id, course_id)
    )
  `);

  // Skill assessments
  await db.execute(`
    CREATE TABLE ${prefix}skill_assessments (
      assessment_id VARCHAR2(26) DEFAULT SYS_GUID() PRIMARY KEY,
      skill_id VARCHAR2(26) NOT NULL,
      assessment_name VARCHAR2(200) NOT NULL,
      assessment_type VARCHAR2(50) CHECK (
        assessment_type IN ('quiz', 'project', 'peer_review', 'self_assessment')
      ),
      difficulty_level VARCHAR2(20) CHECK (
        difficulty_level IN ('beginner', 'intermediate', 'advanced', 'expert')
      ),
      description CLOB,
      instructions CLOB,
      time_limit_minutes NUMBER(10),
      passing_score NUMBER(3) DEFAULT 70,
      questions CLOB CHECK (questions IS JSON),
      rubric CLOB CHECK (rubric IS JSON),
      max_attempts NUMBER(5) DEFAULT 3,
      is_active CHAR(1) DEFAULT 'Y' CHECK (is_active IN ('Y', 'N')),
      created_by VARCHAR2(26),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT ${prefix}fk_assess_skill FOREIGN KEY (skill_id) 
        REFERENCES ${prefix}skills(skill_id) ON DELETE CASCADE
    )
  `);

  // User assessment results
  await db.execute(`
    CREATE TABLE ${prefix}user_assessments (
      result_id VARCHAR2(26) DEFAULT SYS_GUID() PRIMARY KEY,
      user_id VARCHAR2(26) NOT NULL,
      assessment_id VARCHAR2(26) NOT NULL,
      attempt_number NUMBER(5) DEFAULT 1,
      start_time TIMESTAMP,
      end_time TIMESTAMP,
      score NUMBER(10,2),
      percentage_score NUMBER(5,2),
      passed CHAR(1) CHECK (passed IN ('Y', 'N')),
      answers CLOB CHECK (answers IS JSON),
      feedback CLOB CHECK (feedback IS JSON),
      time_taken_minutes NUMBER(10),
      skill_level_achieved VARCHAR2(20),
      strengths CLOB CHECK (strengths IS JSON),
      improvement_areas CLOB CHECK (improvement_areas IS JSON),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT ${prefix}fk_result_user FOREIGN KEY (user_id) 
        REFERENCES ${prefix}users(user_id) ON DELETE CASCADE,
      CONSTRAINT ${prefix}fk_result_assess FOREIGN KEY (assessment_id) 
        REFERENCES ${prefix}skill_assessments(assessment_id) ON DELETE CASCADE
    )
  `);

  // Certifications catalog
  await db.execute(`
    CREATE TABLE ${prefix}certifications (
      certification_id VARCHAR2(26) DEFAULT SYS_GUID() PRIMARY KEY,
      certification_name VARCHAR2(200) NOT NULL,
      issuing_organization VARCHAR2(200) NOT NULL,
      certification_level VARCHAR2(50) CHECK (
        certification_level IN ('foundational', 'associate', 'professional', 'expert', 'specialty')
      ),
      description CLOB,
      skills_validated CLOB CHECK (skills_validated IS JSON),
      prerequisites CLOB CHECK (prerequisites IS JSON),
      exam_format VARCHAR2(100),
      exam_duration_minutes NUMBER(10),
      passing_score VARCHAR2(50),
      cost_usd NUMBER(10,2),
      validity_period_months NUMBER(5),
      renewal_requirements CLOB,
      industry VARCHAR2(100),
      market_demand_score NUMBER(2,1) DEFAULT 3.0,
      average_salary_impact NUMBER(10),
      preparation_hours_avg NUMBER(10),
      official_url VARCHAR2(1000),
      is_active CHAR(1) DEFAULT 'Y' CHECK (is_active IN ('Y', 'N')),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // User certifications
  await db.execute(`
    CREATE TABLE ${prefix}user_certifications (
      user_cert_id VARCHAR2(26) DEFAULT SYS_GUID() PRIMARY KEY,
      user_id VARCHAR2(26) NOT NULL,
      certification_id VARCHAR2(26) NOT NULL,
      credential_number VARCHAR2(100),
      issue_date DATE NOT NULL,
      expiry_date DATE,
      status VARCHAR2(20) DEFAULT 'active' CHECK (
        status IN ('active', 'expired', 'revoked', 'renewing', 'renewed')
      ),
      verification_url VARCHAR2(1000),
      certificate_file_url VARCHAR2(1000),
      cpe_credits_earned NUMBER(10,1),
      preparation_hours NUMBER(10),
      exam_score VARCHAR2(50),
      exam_date DATE,
      renewal_reminder_date DATE,
      notes CLOB,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT ${prefix}fk_usercert_user FOREIGN KEY (user_id) 
        REFERENCES ${prefix}users(user_id) ON DELETE CASCADE,
      CONSTRAINT ${prefix}fk_usercert_cert FOREIGN KEY (certification_id) 
        REFERENCES ${prefix}certifications(certification_id) ON DELETE CASCADE
    )
  `);

  // Learning paths
  await db.execute(`
    CREATE TABLE ${prefix}learning_paths (
      path_id VARCHAR2(26) DEFAULT SYS_GUID() PRIMARY KEY,
      path_name VARCHAR2(200) NOT NULL,
      path_description CLOB,
      created_by VARCHAR2(26) NOT NULL,
      target_role VARCHAR2(200),
      target_level VARCHAR2(50) CHECK (
        target_level IN ('entry', 'mid', 'senior', 'expert')
      ),
      estimated_duration_weeks NUMBER(10),
      difficulty_level VARCHAR2(20) CHECK (
        difficulty_level IN ('beginner', 'intermediate', 'advanced', 'expert')
      ),
      skills_gained CLOB CHECK (skills_gained IS JSON),
      prerequisites CLOB CHECK (prerequisites IS JSON),
      is_public CHAR(1) DEFAULT 'N' CHECK (is_public IN ('Y', 'N')),
      tags CLOB CHECK (tags IS JSON),
      popularity_score NUMBER(10) DEFAULT 0,
      completion_count NUMBER(10) DEFAULT 0,
      average_rating NUMBER(2,1),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT ${prefix}fk_path_creator FOREIGN KEY (created_by) 
        REFERENCES ${prefix}users(user_id) ON DELETE CASCADE
    )
  `);

  // Learning path steps
  await db.execute(`
    CREATE TABLE ${prefix}learning_path_steps (
      step_id VARCHAR2(26) DEFAULT SYS_GUID() PRIMARY KEY,
      path_id VARCHAR2(26) NOT NULL,
      step_number NUMBER(5) NOT NULL,
      step_type VARCHAR2(50) CHECK (
        step_type IN ('course', 'assessment', 'project', 'certification', 'reading', 'practice')
      ),
      resource_id VARCHAR2(26),
      step_name VARCHAR2(200) NOT NULL,
      step_description CLOB,
      estimated_hours NUMBER(10,1),
      is_optional CHAR(1) DEFAULT 'N' CHECK (is_optional IN ('Y', 'N')),
      dependencies CLOB CHECK (dependencies IS JSON),
      success_criteria VARCHAR2(500),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT ${prefix}fk_step_path FOREIGN KEY (path_id) 
        REFERENCES ${prefix}learning_paths(path_id) ON DELETE CASCADE
    )
  `);

  // User learning paths
  await db.execute(`
    CREATE TABLE ${prefix}user_learning_paths (
      user_path_id VARCHAR2(26) DEFAULT SYS_GUID() PRIMARY KEY,
      user_id VARCHAR2(26) NOT NULL,
      path_id VARCHAR2(26) NOT NULL,
      start_date DATE DEFAULT SYSDATE,
      target_completion_date DATE,
      actual_completion_date DATE,
      current_step_number NUMBER(5) DEFAULT 1,
      progress_percentage NUMBER(3) DEFAULT 0,
      time_invested_hours NUMBER(10,1) DEFAULT 0,
      status VARCHAR2(20) DEFAULT 'active' CHECK (
        status IN ('active', 'paused', 'completed', 'abandoned')
      ),
      notes CLOB,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT ${prefix}fk_userpath_user FOREIGN KEY (user_id) 
        REFERENCES ${prefix}users(user_id) ON DELETE CASCADE,
      CONSTRAINT ${prefix}fk_userpath_path FOREIGN KEY (path_id) 
        REFERENCES ${prefix}learning_paths(path_id) ON DELETE CASCADE,
      CONSTRAINT ${prefix}uk_user_path UNIQUE (user_id, path_id)
    )
  `);

  // User path progress
  await db.execute(`
    CREATE TABLE ${prefix}user_path_progress (
      progress_id VARCHAR2(26) DEFAULT SYS_GUID() PRIMARY KEY,
      user_path_id VARCHAR2(26) NOT NULL,
      step_id VARCHAR2(26) NOT NULL,
      status VARCHAR2(20) DEFAULT 'not_started' CHECK (
        status IN ('not_started', 'in_progress', 'completed', 'skipped')
      ),
      start_date DATE,
      completion_date DATE,
      time_spent_hours NUMBER(10,1) DEFAULT 0,
      score NUMBER(10,2),
      feedback CLOB,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT ${prefix}fk_progress_userpath FOREIGN KEY (user_path_id) 
        REFERENCES ${prefix}user_learning_paths(user_path_id) ON DELETE CASCADE,
      CONSTRAINT ${prefix}fk_progress_step FOREIGN KEY (step_id) 
        REFERENCES ${prefix}learning_path_steps(step_id) ON DELETE CASCADE,
      CONSTRAINT ${prefix}uk_userpath_step UNIQUE (user_path_id, step_id)
    )
  `);

  // Learning goals
  await db.execute(`
    CREATE TABLE ${prefix}learning_goals (
      goal_id VARCHAR2(26) DEFAULT SYS_GUID() PRIMARY KEY,
      user_id VARCHAR2(26) NOT NULL,
      goal_title VARCHAR2(200) NOT NULL,
      goal_description CLOB,
      target_date DATE,
      goal_type VARCHAR2(50) CHECK (
        goal_type IN ('skill_acquisition', 'certification', 'course_completion', 'project', 'other')
      ),
      target_skill_id VARCHAR2(26),
      target_skill_level VARCHAR2(20),
      related_path_id VARCHAR2(26),
      progress_percentage NUMBER(3) DEFAULT 0,
      status VARCHAR2(20) DEFAULT 'active' CHECK (
        status IN ('active', 'completed', 'missed', 'cancelled')
      ),
      completion_date DATE,
      notes CLOB,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT ${prefix}fk_goal_user FOREIGN KEY (user_id) 
        REFERENCES ${prefix}users(user_id) ON DELETE CASCADE,
      CONSTRAINT ${prefix}fk_goal_skill FOREIGN KEY (target_skill_id) 
        REFERENCES ${prefix}skills(skill_id) ON DELETE SET NULL,
      CONSTRAINT ${prefix}fk_goal_path FOREIGN KEY (related_path_id) 
        REFERENCES ${prefix}learning_paths(path_id) ON DELETE SET NULL
    )
  `);

  // Seed sample certifications
  await db.execute(`
    INSERT INTO ${prefix}certifications (
      certification_id, certification_name, issuing_organization, 
      certification_level, industry, market_demand_score, average_salary_impact, 
      cost_usd, validity_period_months, description
    ) VALUES (
      '01HX8K9FN2CERT00000000001', 
      'AWS Certified Solutions Architect - Associate', 
      'Amazon Web Services',
      'associate', 
      'Technology', 
      4.8, 
      15000,
      150, 
      36,
      'Validates ability to design distributed systems on AWS'
    )
  `);

  await db.execute(`
    INSERT INTO ${prefix}certifications (
      certification_id, certification_name, issuing_organization, 
      certification_level, industry, market_demand_score, average_salary_impact, 
      cost_usd, validity_period_months, description
    ) VALUES (
      '01HX8K9FN2CERT00000000002', 
      'Professional Scrum Master I', 
      'Scrum.org',
      'professional', 
      'Technology', 
      4.2, 
      10000,
      200, 
      NULL,
      'Demonstrates fundamental knowledge of Scrum framework'
    )
  `);
}

module.exports = createLearningTables;