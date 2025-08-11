/**
 * CPA PERT Module Tables
 */

async function createCPAPertTables(db, prefix = 'pf_') {
  // Competency high-level areas (for enhanced progress tracking)
  await db.execute(`
    CREATE TABLE ${prefix}cpa_competency_areas (
      id VARCHAR2(26) DEFAULT SYS_GUID() PRIMARY KEY,
      code VARCHAR2(10) UNIQUE NOT NULL,
      name VARCHAR2(200) NOT NULL,
      description CLOB,
      category VARCHAR2(20) NOT NULL CHECK (category IN ('technical', 'enabling')),
      requirements CLOB CHECK (requirements IS JSON),
      display_order NUMBER(5) DEFAULT 0,
      deleted_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Sub-competencies within areas
  await db.execute(`
    CREATE TABLE ${prefix}cpa_sub_competencies (
      id VARCHAR2(26) DEFAULT SYS_GUID() PRIMARY KEY,
      competency_area_id VARCHAR2(26) NOT NULL,
      code VARCHAR2(20) UNIQUE NOT NULL,
      name VARCHAR2(200) NOT NULL,
      description CLOB,
      level_0_indicators CLOB CHECK (level_0_indicators IS JSON),
      level_1_indicators CLOB CHECK (level_1_indicators IS JSON),
      level_2_indicators CLOB CHECK (level_2_indicators IS JSON),
      example_tasks CLOB CHECK (example_tasks IS JSON),
      display_order NUMBER(5) DEFAULT 0,
      deleted_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT ${prefix}fk_subcomp_area FOREIGN KEY (competency_area_id)
        REFERENCES ${prefix}cpa_competency_areas(id) ON DELETE CASCADE
    )
  `);

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

  // PERT reports (versioned, for EVR/PPR)
  await db.execute(`
    CREATE TABLE ${prefix}cpa_pert_reports (
      id VARCHAR2(26) DEFAULT SYS_GUID() PRIMARY KEY,
      user_id VARCHAR2(26) NOT NULL,
      report_period_start DATE NOT NULL,
      report_period_end DATE NOT NULL,
      submission_deadline DATE,
      route_type VARCHAR2(5) NOT NULL CHECK (route_type IN ('EVR','PPR')),
      status VARCHAR2(20) DEFAULT 'draft' CHECK (status IN ('draft','submitted','approved','rejected','archived')),
      employer_name VARCHAR2(255),
      position_title VARCHAR2(255),
      hours_worked NUMBER(7,2),
      version NUMBER(5) DEFAULT 1,
      deleted_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT ${prefix}fk_pert_report_user FOREIGN KEY (user_id)
        REFERENCES ${prefix}users(user_id) ON DELETE CASCADE
    )
  `);

  // Experiences within PERT reports (append-only versioning)
  await db.execute(`
    CREATE TABLE ${prefix}cpa_pert_experiences (
      id VARCHAR2(26) DEFAULT SYS_GUID() PRIMARY KEY,
      report_id VARCHAR2(26) NOT NULL,
      sub_competency_id VARCHAR2(26) NOT NULL,
      experience_title VARCHAR2(500) NOT NULL,
      experience_start_date DATE NOT NULL,
      experience_end_date DATE NOT NULL,
      duration_days NUMBER(10) GENERATED ALWAYS AS (experience_end_date - experience_start_date + 1) VIRTUAL,
      proficiency_level NUMBER(1) NOT NULL CHECK (proficiency_level IN (0,1,2)),
      challenge CLOB NOT NULL,
      actions CLOB NOT NULL,
      results CLOB NOT NULL,
      lessons_learned CLOB NOT NULL,
      time_spent_hours NUMBER(7,2),
      complexity_level VARCHAR2(20) CHECK (complexity_level IN ('simple','moderate','complex')),
      collaboration_type VARCHAR2(20) CHECK (collaboration_type IN ('individual','team','cross-functional')),
      tools_used CLOB CHECK (tools_used IS JSON),
      cpa_values CLOB CHECK (cpa_values IS JSON),
      word_count NUMBER(10),
      character_count NUMBER(10),
      approval_status VARCHAR2(20) DEFAULT 'pending' CHECK (approval_status IN ('pending','approved','rejected')),
      version NUMBER(5) DEFAULT 1,
      previous_version_id VARCHAR2(26),
      last_edited_by VARCHAR2(26),
      deleted_at TIMESTAMP,
      deleted_by VARCHAR2(26),
      deletion_reason VARCHAR2(500),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT ${prefix}fk_pert_exp_report FOREIGN KEY (report_id)
        REFERENCES ${prefix}cpa_pert_reports(id) ON DELETE CASCADE,
      CONSTRAINT ${prefix}fk_pert_exp_sub FOREIGN KEY (sub_competency_id)
        REFERENCES ${prefix}cpa_sub_competencies(id),
      CONSTRAINT ${prefix}fk_pert_exp_user FOREIGN KEY (last_edited_by)
        REFERENCES ${prefix}users(user_id)
    )
  `);

  // Progress tracking per sub-competency and user
  await db.execute(`
    CREATE TABLE ${prefix}cpa_competency_progress (
      id VARCHAR2(26) DEFAULT SYS_GUID() PRIMARY KEY,
      user_id VARCHAR2(26) NOT NULL,
      sub_competency_id VARCHAR2(26) NOT NULL,
      current_level NUMBER(1) DEFAULT 0 CHECK (current_level IN (0,1,2)),
      target_level NUMBER(1) CHECK (target_level IN (1,2)),
      experiences_count NUMBER(10) DEFAULT 0,
      last_experience_date DATE,
      progress_percentage NUMBER(5,2) DEFAULT 0,
      deleted_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT ${prefix}fk_prog_user FOREIGN KEY (user_id)
        REFERENCES ${prefix}users(user_id) ON DELETE CASCADE,
      CONSTRAINT ${prefix}fk_prog_sub FOREIGN KEY (sub_competency_id)
        REFERENCES ${prefix}cpa_sub_competencies(id),
      CONSTRAINT ${prefix}uk_user_sub UNIQUE (user_id, sub_competency_id)
    )
  `);

  // Review history / audit trail for experiences
  await db.execute(`
    CREATE TABLE ${prefix}cpa_pert_review_history (
      id VARCHAR2(26) DEFAULT SYS_GUID() PRIMARY KEY,
      experience_id VARCHAR2(26) NOT NULL,
      report_id VARCHAR2(26) NOT NULL,
      reviewer_id VARCHAR2(26),
      action VARCHAR2(50) NOT NULL,
      previous_status VARCHAR2(20),
      new_status VARCHAR2(20),
      comments CLOB,
      changes_made CLOB CHECK (changes_made IS JSON),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT ${prefix}fk_review_exp FOREIGN KEY (experience_id)
        REFERENCES ${prefix}cpa_pert_experiences(id) ON DELETE CASCADE,
      CONSTRAINT ${prefix}fk_review_report FOREIGN KEY (report_id)
        REFERENCES ${prefix}cpa_pert_reports(id) ON DELETE CASCADE,
      CONSTRAINT ${prefix}fk_review_user FOREIGN KEY (reviewer_id)
        REFERENCES ${prefix}users(user_id)
    )
  `);

  // Experience templates (assist authoring)
  await db.execute(`
    CREATE TABLE ${prefix}cpa_pert_templates (
      id VARCHAR2(26) DEFAULT SYS_GUID() PRIMARY KEY,
      sub_competency_id VARCHAR2(26) NOT NULL,
      proficiency_level NUMBER(1) NOT NULL CHECK (proficiency_level IN (0,1,2)),
      challenge_template CLOB,
      actions_template CLOB,
      results_template CLOB,
      lessons_template CLOB,
      industry VARCHAR2(100),
      is_public CHAR(1) DEFAULT 'Y' CHECK (is_public IN ('Y','N')),
      usage_count NUMBER(10) DEFAULT 0,
      rating NUMBER(2,1),
      keywords CLOB CHECK (keywords IS JSON),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      deleted_at TIMESTAMP,
      CONSTRAINT ${prefix}fk_template_sub FOREIGN KEY (sub_competency_id)
        REFERENCES ${prefix}cpa_sub_competencies(id)
    )
  `);

  // Final submission snapshots to CPA (immutable record)
  await db.execute(`
    CREATE TABLE ${prefix}cpa_pert_submissions (
      id VARCHAR2(26) DEFAULT SYS_GUID() PRIMARY KEY,
      report_id VARCHAR2(26) NOT NULL,
      user_id VARCHAR2(26) NOT NULL,
      submission_type VARCHAR2(20) NOT NULL CHECK (submission_type IN ('draft','final','revision')),
      submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      submission_deadline DATE,
      submission_status VARCHAR2(20) DEFAULT 'pending' CHECK (submission_status IN ('pending','accepted','rejected','needs_changes','withdrawn')),
      cpa_reference_number VARCHAR2(100),
      cpa_confirmation_code VARCHAR2(100),
      reviewer_id VARCHAR2(100),
      reviewer_comments CLOB,
      submitted_payload CLOB CHECK (submitted_payload IS JSON),
      experience_count NUMBER(10),
      total_word_count NUMBER(10),
      exported_file_url VARCHAR2(1000),
      exported_file_format VARCHAR2(20) CHECK (exported_file_format IN ('pdf','docx','xml','json')),
      version NUMBER(5) DEFAULT 1,
      ack_reference VARCHAR2(100),
      submission_checksum VARCHAR2(64),
      CONSTRAINT ${prefix}fk_submit_report FOREIGN KEY (report_id)
        REFERENCES ${prefix}cpa_pert_reports(id) ON DELETE CASCADE,
      CONSTRAINT ${prefix}fk_submit_user FOREIGN KEY (user_id)
        REFERENCES ${prefix}users(user_id) ON DELETE CASCADE
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

  // EVR assessments (employment verification route pre-assessment)
  await db.execute(`
    CREATE TABLE ${prefix}cpa_evr_assessments (
      id VARCHAR2(26) DEFAULT SYS_GUID() PRIMARY KEY,
      user_id VARCHAR2(26) NOT NULL,
      employer_name VARCHAR2(255) NOT NULL,
      position_title VARCHAR2(255) NOT NULL,
      job_description CLOB NOT NULL,
      start_date DATE NOT NULL,
      end_date DATE,
      is_current CHAR(1) DEFAULT 'N' CHECK (is_current IN ('Y', 'N')),
      reporting_relationship VARCHAR2(500),
      team_size NUMBER(5),
      industry VARCHAR2(100),
      assessment_status VARCHAR2(20) DEFAULT 'pending' CHECK (assessment_status IN ('pending','completed','cancelled')),
      technical_exposure CLOB CHECK (technical_exposure IS JSON),
      enabling_exposure CLOB CHECK (enabling_exposure IS JSON),
      recommendations CLOB CHECK (recommendations IS JSON),
      assessment_date TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT ${prefix}fk_evr_user FOREIGN KEY (user_id)
        REFERENCES ${prefix}users(user_id) ON DELETE CASCADE
    )
  `);

  // Experience breakdown for detailed tracking
  await db.execute(`
    CREATE TABLE ${prefix}cpa_experience_breakdown (
      id VARCHAR2(26) DEFAULT SYS_GUID() PRIMARY KEY,
      experience_id VARCHAR2(26) NOT NULL,
      report_id VARCHAR2(26) NOT NULL,
      user_id VARCHAR2(26) NOT NULL,
      activity_type VARCHAR2(50) NOT NULL CHECK (activity_type IN ('planning','execution','review','documentation','analysis','presentation','training')),
      activity_description CLOB NOT NULL,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      hours_spent NUMBER(7,2) NOT NULL,
      competencies_demonstrated CLOB CHECK (competencies_demonstrated IS JSON),
      deliverables CLOB CHECK (deliverables IS JSON),
      stakeholders_involved CLOB CHECK (stakeholders_involved IS JSON),
      business_impact VARCHAR2(1000),
      skills_applied CLOB CHECK (skills_applied IS JSON),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT ${prefix}fk_breakdown_exp FOREIGN KEY (experience_id)
        REFERENCES ${prefix}cpa_pert_experiences(id) ON DELETE CASCADE,
      CONSTRAINT ${prefix}fk_breakdown_report FOREIGN KEY (report_id)
        REFERENCES ${prefix}cpa_pert_reports(id) ON DELETE CASCADE,
      CONSTRAINT ${prefix}fk_breakdown_user FOREIGN KEY (user_id)
        REFERENCES ${prefix}users(user_id) ON DELETE CASCADE
    )
  `);

  // Progress milestones for tracking progression over time
  await db.execute(`
    CREATE TABLE ${prefix}cpa_progress_milestones (
      id VARCHAR2(26) DEFAULT SYS_GUID() PRIMARY KEY,
      user_id VARCHAR2(26) NOT NULL,
      sub_competency_id VARCHAR2(26) NOT NULL,
      milestone_date DATE NOT NULL,
      previous_level NUMBER(1) CHECK (previous_level IN (0,1,2)),
      achieved_level NUMBER(1) NOT NULL CHECK (achieved_level IN (0,1,2)),
      evidence_count NUMBER(10) DEFAULT 0,
      hours_accumulated NUMBER(10,2) DEFAULT 0,
      key_experiences CLOB CHECK (key_experiences IS JSON),
      mentor_feedback CLOB,
      self_assessment CLOB,
      next_steps CLOB,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT ${prefix}fk_milestone_user FOREIGN KEY (user_id)
        REFERENCES ${prefix}users(user_id) ON DELETE CASCADE,
      CONSTRAINT ${prefix}fk_milestone_sub FOREIGN KEY (sub_competency_id)
        REFERENCES ${prefix}cpa_sub_competencies(id)
    )
  `);

  // Submission history with detailed tracking
  await db.execute(`
    CREATE TABLE ${prefix}cpa_submission_history (
      id VARCHAR2(26) DEFAULT SYS_GUID() PRIMARY KEY,
      submission_id VARCHAR2(26) NOT NULL,
      report_id VARCHAR2(26) NOT NULL,
      user_id VARCHAR2(26) NOT NULL,
      action VARCHAR2(50) NOT NULL CHECK (action IN ('created','submitted','reviewed','accepted','rejected','revised','withdrawn')),
      action_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      action_by VARCHAR2(26),
      action_details CLOB,
      previous_status VARCHAR2(20),
      new_status VARCHAR2(20),
      attachments CLOB CHECK (attachments IS JSON),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT ${prefix}fk_subhist_submission FOREIGN KEY (submission_id)
        REFERENCES ${prefix}cpa_pert_submissions(id) ON DELETE CASCADE,
      CONSTRAINT ${prefix}fk_subhist_report FOREIGN KEY (report_id)
        REFERENCES ${prefix}cpa_pert_reports(id) ON DELETE CASCADE,
      CONSTRAINT ${prefix}fk_subhist_user FOREIGN KEY (user_id)
        REFERENCES ${prefix}users(user_id) ON DELETE CASCADE
    )
  `);

  // Experience time tracking for detailed hour allocation
  await db.execute(`
    CREATE TABLE ${prefix}cpa_experience_time_tracking (
      id VARCHAR2(26) DEFAULT SYS_GUID() PRIMARY KEY,
      experience_id VARCHAR2(26) NOT NULL,
      user_id VARCHAR2(26) NOT NULL,
      activity_date DATE NOT NULL,
      hours_logged NUMBER(4,2) NOT NULL CHECK (hours_logged > 0 AND hours_logged <= 24),
      activity_category VARCHAR2(50) CHECK (activity_category IN ('direct_work','supervision','training','research','documentation')),
      description VARCHAR2(1000),
      is_billable CHAR(1) DEFAULT 'Y' CHECK (is_billable IN ('Y','N')),
      is_cpa_eligible CHAR(1) DEFAULT 'Y' CHECK (is_cpa_eligible IN ('Y','N')),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT ${prefix}fk_timetrack_exp FOREIGN KEY (experience_id)
        REFERENCES ${prefix}cpa_pert_experiences(id) ON DELETE CASCADE,
      CONSTRAINT ${prefix}fk_timetrack_user FOREIGN KEY (user_id)
        REFERENCES ${prefix}users(user_id) ON DELETE CASCADE,
      CONSTRAINT ${prefix}uk_timetrack_date UNIQUE (experience_id, activity_date)
    )
  `);
}

module.exports = createCPAPertTables;
