/**
 * CPA PERT Module Database Schema
 * Creates tables for CPA competency framework and PERT report tracking
 * 
 * Based on CPA PERT integration plan requirements
 */

const oracledb = require('oracledb');
const logger = require('../../utils/logger');

async function up(connection, tablePrefix = 'pf_') {
  try {
    logger.info('Creating CPA PERT schema...');
    
    // 1. Create CPA Competencies Master Table
    await connection.execute(`
      CREATE TABLE ${tablePrefix}cpa_competencies (
        competency_id VARCHAR2(10) PRIMARY KEY,
        category VARCHAR2(50) NOT NULL,
        area_code VARCHAR2(5) NOT NULL,
        area_name VARCHAR2(100) NOT NULL,
        sub_code VARCHAR2(10) NOT NULL,
        sub_name VARCHAR2(200) NOT NULL,
        description CLOB,
        evr_relevance VARCHAR2(20),
        level_1_criteria CLOB,
        level_2_criteria CLOB,
        guiding_questions CLOB,
        is_active NUMBER(1) DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    logger.info('✅ Created pf_cpa_competencies table');

    // Create unique index on competency code components
    await connection.execute(`
      CREATE UNIQUE INDEX idx_cpa_comp_code ON ${tablePrefix}cpa_competencies(area_code, sub_code)
    `);

    // 2. Create Experience to Competency Mappings Table
    await connection.execute(`
      CREATE TABLE ${tablePrefix}cpa_competency_mappings (
        mapping_id VARCHAR2(50) PRIMARY KEY,
        experience_id VARCHAR2(50) NOT NULL,
        user_id VARCHAR2(50) NOT NULL,
        competency_id VARCHAR2(10) NOT NULL,
        relevance_score NUMBER(3,2) CHECK (relevance_score BETWEEN 0 AND 1),
        evidence_extracted CLOB,
        mapping_method VARCHAR2(50) DEFAULT 'AI_ASSISTED',
        is_validated NUMBER(1) DEFAULT 0,
        validated_by VARCHAR2(50),
        validated_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_cpa_map_comp FOREIGN KEY (competency_id) 
          REFERENCES ${tablePrefix}cpa_competencies(competency_id),
        CONSTRAINT uk_cpa_exp_comp UNIQUE (experience_id, competency_id)
      )
    `);
    logger.info('✅ Created pf_cpa_competency_mappings table');

    // 3. Create PERT Responses Table
    await connection.execute(`
      CREATE TABLE ${tablePrefix}cpa_pert_responses (
        response_id VARCHAR2(50) PRIMARY KEY,
        user_id VARCHAR2(50) NOT NULL,
        experience_id VARCHAR2(50) NOT NULL,
        competency_id VARCHAR2(10) NOT NULL,
        proficiency_level NUMBER(1) CHECK (proficiency_level IN (0, 1, 2)),
        response_text CLOB NOT NULL,
        character_count NUMBER(5) NOT NULL CHECK (character_count <= 5000),
        situation_text CLOB,
        task_text CLOB,
        action_text CLOB,
        result_text CLOB,
        quantified_impact VARCHAR2(500),
        is_compliant NUMBER(1) DEFAULT 1,
        compliance_notes VARCHAR2(1000),
        version NUMBER DEFAULT 1,
        is_current NUMBER(1) DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_pert_comp FOREIGN KEY (competency_id) 
          REFERENCES ${tablePrefix}cpa_competencies(competency_id)
      )
    `);
    logger.info('✅ Created pf_cpa_pert_responses table');

    // 4. Create Proficiency Assessments Table
    await connection.execute(`
      CREATE TABLE ${tablePrefix}cpa_proficiency_assessments (
        assessment_id VARCHAR2(50) PRIMARY KEY,
        user_id VARCHAR2(50) NOT NULL,
        competency_id VARCHAR2(10) NOT NULL,
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
    logger.info('✅ Created pf_cpa_proficiency_assessments table');

    // 5. Create EVR Compliance Checks Table
    await connection.execute(`
      CREATE TABLE ${tablePrefix}cpa_compliance_checks (
        check_id VARCHAR2(50) PRIMARY KEY,
        user_id VARCHAR2(50) NOT NULL,
        check_type VARCHAR2(50) NOT NULL,
        check_date DATE DEFAULT SYSDATE,
        is_compliant NUMBER(1) DEFAULT 0,
        total_competencies NUMBER DEFAULT 0,
        competencies_met NUMBER DEFAULT 0,
        missing_competencies CLOB CHECK (missing_competencies IS JSON),
        recommendations CLOB,
        thirty_month_start DATE,
        thirty_month_end DATE,
        twelve_month_rule_met NUMBER(1) DEFAULT 0,
        expiry_date DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    logger.info('✅ Created pf_cpa_compliance_checks table');

    // 6. Create PERT Report History Table for versioning
    await connection.execute(`
      CREATE TABLE ${tablePrefix}cpa_pert_history (
        history_id VARCHAR2(50) PRIMARY KEY,
        response_id VARCHAR2(50) NOT NULL,
        user_id VARCHAR2(50) NOT NULL,
        version NUMBER NOT NULL,
        response_text CLOB NOT NULL,
        character_count NUMBER(5) NOT NULL,
        changed_by VARCHAR2(50),
        change_reason VARCHAR2(500),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_hist_resp FOREIGN KEY (response_id) 
          REFERENCES ${tablePrefix}cpa_pert_responses(response_id)
      )
    `);
    logger.info('✅ Created pf_cpa_pert_history table');

    // Create performance indexes
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
      CREATE INDEX idx_pert_current ON ${tablePrefix}cpa_pert_responses(user_id, is_current)
    `);
    
    await connection.execute(`
      CREATE INDEX idx_prof_user ON ${tablePrefix}cpa_proficiency_assessments(user_id)
    `);
    
    await connection.execute(`
      CREATE INDEX idx_comp_user ON ${tablePrefix}cpa_compliance_checks(user_id)
    `);
    
    await connection.execute(`
      CREATE INDEX idx_comp_date ON ${tablePrefix}cpa_compliance_checks(user_id, check_date DESC)
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
    logger.info('✅ CPA PERT schema created successfully');
    
  } catch (error) {
    await connection.rollback();
    logger.error('❌ Error creating CPA PERT schema:', error);
    throw error;
  }
}

async function down(connection, tablePrefix = 'pf_') {
  try {
    logger.info('Dropping CPA PERT schema...');
    
    // Drop triggers
    const triggers = [
      'trg_cpa_prof_upd',
      'trg_cpa_pert_upd', 
      'trg_cpa_map_upd',
      'trg_cpa_comp_upd'
    ];
    
    for (const trigger of triggers) {
      try {
        await connection.execute(`DROP TRIGGER ${trigger}`);
      } catch (error) {
        // Ignore if trigger doesn't exist
      }
    }
    
    // Drop tables in reverse order of dependencies
    const tables = [
      'cpa_pert_history',
      'cpa_compliance_checks',
      'cpa_proficiency_assessments',
      'cpa_pert_responses',
      'cpa_competency_mappings',
      'cpa_competencies'
    ];
    
    for (const table of tables) {
      try {
        await connection.execute(`DROP TABLE ${tablePrefix}${table}`);
        logger.info(`✅ Dropped ${tablePrefix}${table}`);
      } catch (error) {
        logger.warn(`Table ${tablePrefix}${table} may not exist`);
      }
    }
    
    await connection.commit();
    logger.info('✅ CPA PERT schema dropped successfully');
    
  } catch (error) {
    await connection.rollback();
    logger.error('❌ Error dropping CPA PERT schema:', error);
    throw error;
  }
}

module.exports = { up, down };