/**
 * Career Path Planning Tables
 */

async function createCareerPathTables(db, prefix = 'pf_') {
  // Career paths reference table
  await db.execute(`
    CREATE TABLE ${prefix}career_paths (
      path_id VARCHAR2(26) DEFAULT SYS_GUID() PRIMARY KEY,
      path_name VARCHAR2(200) NOT NULL,
      industry VARCHAR2(100),
      level VARCHAR2(50) CHECK (level IN ('entry', 'mid', 'senior', 'lead', 'executive')),
      description CLOB,
      typical_progression CLOB CHECK (typical_progression IS JSON),
      required_skills CLOB CHECK (required_skills IS JSON),
      typical_salary_range CLOB CHECK (typical_salary_range IS JSON),
      growth_outlook VARCHAR2(50),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Role transitions mapping
  await db.execute(`
    CREATE TABLE ${prefix}role_transitions (
      transition_id VARCHAR2(26) DEFAULT SYS_GUID() PRIMARY KEY,
      from_role VARCHAR2(200) NOT NULL,
      to_role VARCHAR2(200) NOT NULL,
      difficulty_score NUMBER(3,2) CHECK (difficulty_score BETWEEN 0 AND 1),
      typical_timeframe_months NUMBER(5),
      required_skills_gap CLOB CHECK (required_skills_gap IS JSON),
      recommended_steps CLOB CHECK (recommended_steps IS JSON),
      success_rate NUMBER(3,2) CHECK (success_rate BETWEEN 0 AND 1),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // User career goals
  await db.execute(`
    CREATE TABLE ${prefix}user_career_goals (
      goal_id VARCHAR2(26) DEFAULT SYS_GUID() PRIMARY KEY,
      user_id VARCHAR2(26) NOT NULL,
      target_role VARCHAR2(200) NOT NULL,
      target_date DATE,
      current_role VARCHAR2(200),
      motivation CLOB,
      constraints CLOB CHECK (constraints IS JSON),
      status VARCHAR2(20) DEFAULT 'active' CHECK (
        status IN ('active', 'achieved', 'paused', 'abandoned')
      ),
      progress_percentage NUMBER(3) DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT ${prefix}fk_goal_user FOREIGN KEY (user_id) 
        REFERENCES ${prefix}users(user_id) ON DELETE CASCADE
    )
  `);

  // Skills gap analysis
  await db.execute(`
    CREATE TABLE ${prefix}skills_gap_analysis (
      analysis_id VARCHAR2(26) DEFAULT SYS_GUID() PRIMARY KEY,
      user_id VARCHAR2(26) NOT NULL,
      target_role VARCHAR2(200),
      analysis_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      current_skills CLOB CHECK (current_skills IS JSON),
      required_skills CLOB CHECK (required_skills IS JSON),
      skill_gaps CLOB CHECK (skill_gaps IS JSON),
      recommendations CLOB CHECK (recommendations IS JSON),
      estimated_time_to_close_months NUMBER(5),
      CONSTRAINT ${prefix}fk_gap_user FOREIGN KEY (user_id) 
        REFERENCES ${prefix}users(user_id) ON DELETE CASCADE
    )
  `);

  // Career milestones
  await db.execute(`
    CREATE TABLE ${prefix}career_milestones (
      milestone_id VARCHAR2(26) DEFAULT SYS_GUID() PRIMARY KEY,
      user_id VARCHAR2(26) NOT NULL,
      goal_id VARCHAR2(26),
      milestone_type VARCHAR2(50),
      title VARCHAR2(200) NOT NULL,
      description CLOB,
      target_date DATE,
      achieved_date DATE,
      status VARCHAR2(20) DEFAULT 'pending' CHECK (
        status IN ('pending', 'in_progress', 'achieved', 'missed')
      ),
      evidence CLOB CHECK (evidence IS JSON),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT ${prefix}fk_milestone_user FOREIGN KEY (user_id) 
        REFERENCES ${prefix}users(user_id) ON DELETE CASCADE,
      CONSTRAINT ${prefix}fk_milestone_goal FOREIGN KEY (goal_id) 
        REFERENCES ${prefix}user_career_goals(goal_id) ON DELETE SET NULL
    )
  `);

  // Learning recommendations
  await db.execute(`
    CREATE TABLE ${prefix}learning_recommendations (
      recommendation_id VARCHAR2(26) DEFAULT SYS_GUID() PRIMARY KEY,
      user_id VARCHAR2(26) NOT NULL,
      skill_gap_id VARCHAR2(26),
      recommendation_type VARCHAR2(50),
      title VARCHAR2(200) NOT NULL,
      description CLOB,
      provider VARCHAR2(100),
      url VARCHAR2(500),
      estimated_duration_hours NUMBER(10),
      cost_usd NUMBER(10,2),
      priority_score NUMBER(3,2) CHECK (priority_score BETWEEN 0 AND 1),
      status VARCHAR2(20) DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT ${prefix}fk_learn_user FOREIGN KEY (user_id) 
        REFERENCES ${prefix}users(user_id) ON DELETE CASCADE
    )
  `);
}

module.exports = createCareerPathTables;