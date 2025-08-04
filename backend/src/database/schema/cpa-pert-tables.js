/**
 * CPA PERT Module Tables
 */

async function createCPAPertTables(db, prefix = 'pf_') {
  // CPA competencies reference table
  await db.execute(`
    CREATE TABLE ${prefix}cpa_competencies (
      competency_id VARCHAR2(10) PRIMARY KEY,
      area_code VARCHAR2(5) NOT NULL,
      area_name VARCHAR2(100) NOT NULL,
      sub_code VARCHAR2(10) NOT NULL,
      sub_name VARCHAR2(200) NOT NULL,
      category VARCHAR2(20) NOT NULL CHECK (category IN ('Technical', 'Enabling')),
      description CLOB,
      evr_relevance VARCHAR2(20) DEFAULT 'HIGH',
      level1_criteria CLOB,
      level2_criteria CLOB,
      keywords CLOB CHECK (keywords IS JSON),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Experience competency mappings
  await db.execute(`
    CREATE TABLE ${prefix}experience_competencies (
      mapping_id VARCHAR2(26) DEFAULT SYS_GUID() PRIMARY KEY,
      experience_id VARCHAR2(26) NOT NULL,
      competency_id VARCHAR2(10) NOT NULL,
      relevance_score NUMBER(3,2) DEFAULT 0.0 CHECK (relevance_score BETWEEN 0 AND 1),
      evidence_extracted CLOB,
      ai_confidence NUMBER(3,2) DEFAULT 0.0 CHECK (ai_confidence BETWEEN 0 AND 1),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT ${prefix}fk_expcomp_exp FOREIGN KEY (experience_id) 
        REFERENCES ${prefix}experiences_detailed(experience_id) ON DELETE CASCADE,
      CONSTRAINT ${prefix}fk_expcomp_comp FOREIGN KEY (competency_id) 
        REFERENCES ${prefix}cpa_competencies(competency_id),
      CONSTRAINT ${prefix}uk_exp_comp UNIQUE (experience_id, competency_id)
    )
  `);

  // PERT responses
  await db.execute(`
    CREATE TABLE ${prefix}pert_responses (
      response_id VARCHAR2(26) DEFAULT SYS_GUID() PRIMARY KEY,
      user_id VARCHAR2(26) NOT NULL,
      experience_id VARCHAR2(26) NOT NULL,
      competency_id VARCHAR2(10) NOT NULL,
      proficiency_level NUMBER(1) NOT NULL CHECK (proficiency_level IN (1, 2)),
      situation_text CLOB,
      task_text CLOB,
      action_text CLOB,
      result_text CLOB,
      quantified_impact VARCHAR2(500),
      response_text CLOB NOT NULL,
      character_count NUMBER(10),
      version NUMBER(5) DEFAULT 1,
      is_active CHAR(1) DEFAULT 'Y' CHECK (is_active IN ('Y', 'N')),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT ${prefix}fk_pert_user FOREIGN KEY (user_id) 
        REFERENCES ${prefix}users(user_id) ON DELETE CASCADE,
      CONSTRAINT ${prefix}fk_pert_exp FOREIGN KEY (experience_id) 
        REFERENCES ${prefix}experiences_detailed(experience_id) ON DELETE CASCADE,
      CONSTRAINT ${prefix}fk_pert_comp FOREIGN KEY (competency_id) 
        REFERENCES ${prefix}cpa_competencies(competency_id)
    )
  `);

  // Compliance tracking
  await db.execute(`
    CREATE TABLE ${prefix}compliance_checks (
      check_id VARCHAR2(26) DEFAULT SYS_GUID() PRIMARY KEY,
      user_id VARCHAR2(26) NOT NULL,
      check_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      total_competencies NUMBER(5),
      level2_count NUMBER(5),
      level1_or_higher_count NUMBER(5),
      is_compliant CHAR(1) DEFAULT 'N' CHECK (is_compliant IN ('Y', 'N')),
      compliance_details CLOB CHECK (compliance_details IS JSON),
      recommendations CLOB CHECK (recommendations IS JSON),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT ${prefix}fk_compliance_user FOREIGN KEY (user_id) 
        REFERENCES ${prefix}users(user_id) ON DELETE CASCADE
    )
  `);

  // Proficiency assessments
  await db.execute(`
    CREATE TABLE ${prefix}proficiency_assessments (
      assessment_id VARCHAR2(26) DEFAULT SYS_GUID() PRIMARY KEY,
      user_id VARCHAR2(26) NOT NULL,
      competency_id VARCHAR2(10) NOT NULL,
      current_level NUMBER(1) DEFAULT 0 CHECK (current_level IN (0, 1, 2)),
      target_level NUMBER(1) DEFAULT 2 CHECK (target_level IN (1, 2)),
      gap_analysis CLOB,
      evidence_count NUMBER(5) DEFAULT 0,
      assessment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      next_review_date TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT ${prefix}fk_prof_user FOREIGN KEY (user_id) 
        REFERENCES ${prefix}users(user_id) ON DELETE CASCADE,
      CONSTRAINT ${prefix}fk_prof_comp FOREIGN KEY (competency_id) 
        REFERENCES ${prefix}cpa_competencies(competency_id),
      CONSTRAINT ${prefix}uk_user_comp_prof UNIQUE (user_id, competency_id)
    )
  `);
}

module.exports = createCPAPertTables;