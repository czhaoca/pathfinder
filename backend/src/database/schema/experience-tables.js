/**
 * Experience Management Tables
 */

async function createExperienceTables(db, prefix = 'pf_') {
  // Experiences detailed table
  await db.execute(`
    CREATE TABLE ${prefix}experiences_detailed (
      experience_id VARCHAR2(26) DEFAULT SYS_GUID() PRIMARY KEY,
      user_id VARCHAR2(26) NOT NULL,
      title VARCHAR2(200) NOT NULL,
      organization VARCHAR2(200) NOT NULL,
      location VARCHAR2(200),
      description CLOB,
      start_date DATE NOT NULL,
      end_date DATE,
      is_current CHAR(1) DEFAULT 'N' CHECK (is_current IN ('Y', 'N')),
      experience_type VARCHAR2(50) DEFAULT 'work' CHECK (
        experience_type IN ('work', 'education', 'volunteer', 'project', 'certification', 'other')
      ),
      employment_type VARCHAR2(50) CHECK (
        employment_type IN ('full-time', 'part-time', 'contract', 'freelance', 'internship', 'volunteer')
      ),
      industry VARCHAR2(100),
      department VARCHAR2(100),
      achievements CLOB CHECK (achievements IS JSON),
      skills_used CLOB CHECK (skills_used IS JSON),
      technologies_used CLOB CHECK (technologies_used IS JSON),
      metrics CLOB CHECK (metrics IS JSON),
      ai_insights CLOB CHECK (ai_insights IS JSON),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT ${prefix}fk_exp_user FOREIGN KEY (user_id) 
        REFERENCES ${prefix}users(user_id) ON DELETE CASCADE
    )
  `);

  // Profile summaries table
  await db.execute(`
    CREATE TABLE ${prefix}profile_summaries (
      summary_id VARCHAR2(26) DEFAULT SYS_GUID() PRIMARY KEY,
      user_id VARCHAR2(26) UNIQUE NOT NULL,
      professional_summary CLOB,
      years_experience NUMBER(3,1),
      current_role VARCHAR2(200),
      key_skills CLOB CHECK (key_skills IS JSON),
      industries CLOB CHECK (industries IS JSON),
      career_highlights CLOB CHECK (career_highlights IS JSON),
      education_summary CLOB,
      certifications_count NUMBER(5) DEFAULT 0,
      total_experiences NUMBER(5) DEFAULT 0,
      last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT ${prefix}fk_summary_user FOREIGN KEY (user_id) 
        REFERENCES ${prefix}users(user_id) ON DELETE CASCADE
    )
  `);

  // Quick summaries table
  await db.execute(`
    CREATE TABLE ${prefix}quick_summaries (
      quick_id VARCHAR2(26) DEFAULT SYS_GUID() PRIMARY KEY,
      user_id VARCHAR2(26) UNIQUE NOT NULL,
      one_liner VARCHAR2(500),
      elevator_pitch VARCHAR2(1000),
      top_skills CLOB CHECK (top_skills IS JSON),
      years_experience NUMBER(3,1),
      availability_status VARCHAR2(50),
      preferred_roles CLOB CHECK (preferred_roles IS JSON),
      last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT ${prefix}fk_quick_user FOREIGN KEY (user_id) 
        REFERENCES ${prefix}users(user_id) ON DELETE CASCADE
    )
  `);

  // Skills catalog reference table
  await db.execute(`
    CREATE TABLE ${prefix}skills (
      skill_id VARCHAR2(26) DEFAULT SYS_GUID() PRIMARY KEY,
      skill_name VARCHAR2(100) UNIQUE NOT NULL,
      skill_category VARCHAR2(50),
      skill_description VARCHAR2(500),
      parent_skill_id VARCHAR2(26),
      is_technical CHAR(1) DEFAULT 'Y' CHECK (is_technical IN ('Y', 'N')),
      popularity_score NUMBER(10) DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT ${prefix}fk_parent_skill FOREIGN KEY (parent_skill_id) 
        REFERENCES ${prefix}skills(skill_id) ON DELETE SET NULL
    )
  `);

  // User skills mapping
  await db.execute(`
    CREATE TABLE ${prefix}user_skills (
      user_skill_id VARCHAR2(26) DEFAULT SYS_GUID() PRIMARY KEY,
      user_id VARCHAR2(26) NOT NULL,
      skill_id VARCHAR2(26) NOT NULL,
      proficiency_level VARCHAR2(20) CHECK (
        proficiency_level IN ('beginner', 'intermediate', 'advanced', 'expert')
      ),
      years_experience NUMBER(3,1),
      last_used_date DATE,
      is_primary CHAR(1) DEFAULT 'N' CHECK (is_primary IN ('Y', 'N')),
      endorsement_count NUMBER(10) DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT ${prefix}fk_userskill_user FOREIGN KEY (user_id) 
        REFERENCES ${prefix}users(user_id) ON DELETE CASCADE,
      CONSTRAINT ${prefix}fk_userskill_skill FOREIGN KEY (skill_id) 
        REFERENCES ${prefix}skills(skill_id) ON DELETE CASCADE,
      CONSTRAINT ${prefix}uk_user_skill UNIQUE (user_id, skill_id)
    )
  `);

  // Experience skills mapping
  await db.execute(`
    CREATE TABLE ${prefix}experience_skills (
      exp_skill_id VARCHAR2(26) DEFAULT SYS_GUID() PRIMARY KEY,
      experience_id VARCHAR2(26) NOT NULL,
      skill_id VARCHAR2(26) NOT NULL,
      relevance_score NUMBER(3,2) DEFAULT 1.0,
      is_primary CHAR(1) DEFAULT 'N' CHECK (is_primary IN ('Y', 'N')),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT ${prefix}fk_expskill_exp FOREIGN KEY (experience_id) 
        REFERENCES ${prefix}experiences_detailed(experience_id) ON DELETE CASCADE,
      CONSTRAINT ${prefix}fk_expskill_skill FOREIGN KEY (skill_id) 
        REFERENCES ${prefix}skills(skill_id) ON DELETE CASCADE,
      CONSTRAINT ${prefix}uk_exp_skill UNIQUE (experience_id, skill_id)
    )
  `);
}

module.exports = createExperienceTables;