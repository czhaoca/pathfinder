/**
 * CPA PERT Module Database Schema Migration
 * Creates tables for CPA competency framework and PERT report tracking
 */

const oracledb = require('oracledb');
const config = require('../../config');

async function up(connection) {
  const tablePrefix = config.project.tablePrefix || 'skill_';
  
  try {
    // 1. Create CPA Competencies Master Table
    await connection.execute(`
      CREATE TABLE ${tablePrefix}cpa_competencies (
        competency_id VARCHAR2(50) PRIMARY KEY,
        competency_code VARCHAR2(20) NOT NULL UNIQUE,
        competency_name VARCHAR2(200) NOT NULL,
        category VARCHAR2(100) NOT NULL,
        sub_category VARCHAR2(100),
        description VARCHAR2(4000),
        proficiency_levels CLOB CHECK (proficiency_levels IS JSON),
        keywords CLOB,
        is_active CHAR(1) DEFAULT 'Y' CHECK (is_active IN ('Y', 'N')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 2. Create Experience to Competency Mappings Table
    await connection.execute(`
      CREATE TABLE ${tablePrefix}cpa_competency_mappings (
        mapping_id VARCHAR2(50) PRIMARY KEY,
        experience_id VARCHAR2(50) NOT NULL,
        user_id VARCHAR2(50) NOT NULL,
        competency_id VARCHAR2(50) NOT NULL,
        relevance_score NUMBER(3,2) CHECK (relevance_score BETWEEN 0 AND 1),
        evidence_extracted CLOB,
        mapping_method VARCHAR2(50) DEFAULT 'AI_ASSISTED',
        is_validated CHAR(1) DEFAULT 'N' CHECK (is_validated IN ('Y', 'N')),
        validated_by VARCHAR2(50),
        validated_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_cpa_map_comp FOREIGN KEY (competency_id) 
          REFERENCES ${tablePrefix}cpa_competencies(competency_id),
        CONSTRAINT uk_cpa_exp_comp UNIQUE (experience_id, competency_id)
      )
    `);

    // 3. Create PERT Responses Table
    await connection.execute(`
      CREATE TABLE ${tablePrefix}cpa_pert_responses (
        response_id VARCHAR2(50) PRIMARY KEY,
        user_id VARCHAR2(50) NOT NULL,
        experience_id VARCHAR2(50) NOT NULL,
        competency_id VARCHAR2(50) NOT NULL,
        proficiency_level NUMBER(1) CHECK (proficiency_level IN (0, 1, 2)),
        response_text CLOB NOT NULL,
        character_count NUMBER(5) NOT NULL,
        situation_text CLOB,
        task_text CLOB,
        action_text CLOB,
        result_text CLOB,
        quantified_impact VARCHAR2(500),
        is_compliant CHAR(1) DEFAULT 'Y' CHECK (is_compliant IN ('Y', 'N')),
        compliance_notes VARCHAR2(1000),
        version NUMBER DEFAULT 1,
        is_current CHAR(1) DEFAULT 'Y' CHECK (is_current IN ('Y', 'N')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_pert_comp FOREIGN KEY (competency_id) 
          REFERENCES ${tablePrefix}cpa_competencies(competency_id)
      )
    `);

    // 4. Create Proficiency Assessments Table
    await connection.execute(`
      CREATE TABLE ${tablePrefix}cpa_proficiency_assessments (
        assessment_id VARCHAR2(50) PRIMARY KEY,
        user_id VARCHAR2(50) NOT NULL,
        competency_id VARCHAR2(50) NOT NULL,
        current_level NUMBER(1) CHECK (current_level IN (0, 1, 2)),
        target_level NUMBER(1) CHECK (target_level IN (0, 1, 2)),
        assessment_date DATE DEFAULT SYSDATE,
        evidence_count NUMBER DEFAULT 0,
        strongest_evidence VARCHAR2(4000),
        development_areas VARCHAR2(4000),
        next_steps VARCHAR2(4000),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_prof_comp FOREIGN KEY (competency_id) 
          REFERENCES ${tablePrefix}cpa_competencies(competency_id),
        CONSTRAINT uk_prof_user_comp UNIQUE (user_id, competency_id)
      )
    `);

    // 5. Create EVR Compliance Checks Table
    await connection.execute(`
      CREATE TABLE ${tablePrefix}cpa_compliance_checks (
        check_id VARCHAR2(50) PRIMARY KEY,
        user_id VARCHAR2(50) NOT NULL,
        check_type VARCHAR2(50) NOT NULL,
        check_date DATE DEFAULT SYSDATE,
        is_compliant CHAR(1) DEFAULT 'N' CHECK (is_compliant IN ('Y', 'N')),
        total_competencies NUMBER DEFAULT 0,
        competencies_met NUMBER DEFAULT 0,
        missing_competencies CLOB,
        recommendations CLOB,
        expiry_date DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes for performance
    await connection.execute(`
      CREATE INDEX idx_cpa_map_user ON ${tablePrefix}cpa_competency_mappings(user_id)
    `);
    
    await connection.execute(`
      CREATE INDEX idx_cpa_map_exp ON ${tablePrefix}cpa_competency_mappings(experience_id)
    `);
    
    await connection.execute(`
      CREATE INDEX idx_pert_user ON ${tablePrefix}cpa_pert_responses(user_id)
    `);
    
    await connection.execute(`
      CREATE INDEX idx_pert_exp ON ${tablePrefix}cpa_pert_responses(experience_id)
    `);
    
    await connection.execute(`
      CREATE INDEX idx_prof_user ON ${tablePrefix}cpa_proficiency_assessments(user_id)
    `);
    
    await connection.execute(`
      CREATE INDEX idx_comp_user ON ${tablePrefix}cpa_compliance_checks(user_id)
    `);

    // Create triggers for updated_at
    await connection.execute(`
      CREATE OR REPLACE TRIGGER trg_cpa_comp_upd
      BEFORE UPDATE ON ${tablePrefix}cpa_competencies
      FOR EACH ROW
      BEGIN
        :NEW.updated_at := CURRENT_TIMESTAMP;
      END;
    `);

    await connection.execute(`
      CREATE OR REPLACE TRIGGER trg_cpa_map_upd
      BEFORE UPDATE ON ${tablePrefix}cpa_competency_mappings
      FOR EACH ROW
      BEGIN
        :NEW.updated_at := CURRENT_TIMESTAMP;
      END;
    `);

    await connection.execute(`
      CREATE OR REPLACE TRIGGER trg_cpa_pert_upd
      BEFORE UPDATE ON ${tablePrefix}cpa_pert_responses
      FOR EACH ROW
      BEGIN
        :NEW.updated_at := CURRENT_TIMESTAMP;
      END;
    `);

    await connection.execute(`
      CREATE OR REPLACE TRIGGER trg_cpa_prof_upd
      BEFORE UPDATE ON ${tablePrefix}cpa_proficiency_assessments
      FOR EACH ROW
      BEGIN
        :NEW.updated_at := CURRENT_TIMESTAMP;
      END;
    `);

    await connection.commit();
    console.log('✅ CPA PERT schema created successfully');
    
  } catch (error) {
    await connection.rollback();
    console.error('❌ Error creating CPA PERT schema:', error);
    throw error;
  }
}

async function down(connection) {
  const tablePrefix = config.project.tablePrefix || 'skill_';
  
  try {
    // Drop triggers
    await connection.execute(`DROP TRIGGER trg_cpa_prof_upd`);
    await connection.execute(`DROP TRIGGER trg_cpa_pert_upd`);
    await connection.execute(`DROP TRIGGER trg_cpa_map_upd`);
    await connection.execute(`DROP TRIGGER trg_cpa_comp_upd`);
    
    // Drop tables in reverse order of dependencies
    await connection.execute(`DROP TABLE ${tablePrefix}cpa_compliance_checks`);
    await connection.execute(`DROP TABLE ${tablePrefix}cpa_proficiency_assessments`);
    await connection.execute(`DROP TABLE ${tablePrefix}cpa_pert_responses`);
    await connection.execute(`DROP TABLE ${tablePrefix}cpa_competency_mappings`);
    await connection.execute(`DROP TABLE ${tablePrefix}cpa_competencies`);
    
    await connection.commit();
    console.log('✅ CPA PERT schema dropped successfully');
    
  } catch (error) {
    await connection.rollback();
    console.error('❌ Error dropping CPA PERT schema:', error);
    throw error;
  }
}

module.exports = { up, down };