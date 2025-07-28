/**
 * CPA PERT Repository
 * Handles database operations for CPA competencies, mappings, and PERT responses
 */

const BaseRepository = require('./baseRepository');

class CPAPertRepository extends BaseRepository {
  constructor(database, config) {
    super(database, config);
    this.tablePrefix = config.project.tablePrefix || 'pf_';
  }

  // Competency operations

  async getAllCompetencies() {
    const query = `
      SELECT * FROM ${this.tablePrefix}cpa_competencies 
      WHERE is_active = 1
      ORDER BY category, area_code, sub_code
    `;
    return await this.database.executeQuery(query);
  }

  async getCompetencyById(competencyId) {
    const query = `
      SELECT * FROM ${this.tablePrefix}cpa_competencies 
      WHERE competency_id = :competencyId
    `;
    const results = await this.database.executeQuery(query, { competencyId });
    return results[0];
  }

  async getCompetencyByCode(competencyCode) {
    const query = `
      SELECT * FROM ${this.tablePrefix}cpa_competencies 
      WHERE competency_id = :competencyCode
    `;
    const results = await this.database.executeQuery(query, { competencyCode });
    return results[0];
  }

  // Competency mapping operations

  async createCompetencyMapping(mappingData) {
    const query = `
      INSERT INTO ${this.tablePrefix}cpa_competency_mappings (
        mapping_id, experience_id, user_id, competency_id,
        relevance_score, evidence_extracted, mapping_method
      ) VALUES (
        :mapping_id, :experience_id, :user_id, :competency_id,
        :relevance_score, :evidence_extracted, :mapping_method
      )
    `;
    
    await this.database.executeQuery(query, mappingData);
    return await this.getCompetencyMapping(mappingData.experience_id, mappingData.competency_id);
  }

  async getCompetencyMapping(experienceId, competencyId) {
    const query = `
      SELECT m.*, c.competency_id, c.area_code, c.sub_code, c.sub_name, c.category
      FROM ${this.tablePrefix}cpa_competency_mappings m
      JOIN ${this.tablePrefix}cpa_competencies c ON m.competency_id = c.competency_id
      WHERE m.experience_id = :experienceId 
      AND m.competency_id = :competencyId
    `;
    
    const results = await this.database.executeQuery(query, { experienceId, competencyId });
    return results[0];
  }

  async getExperienceMappings(experienceId) {
    const query = `
      SELECT m.*, c.competency_id, c.area_code, c.sub_code, c.sub_name, c.category
      FROM ${this.tablePrefix}cpa_competency_mappings m
      JOIN ${this.tablePrefix}cpa_competencies c ON m.competency_id = c.competency_id
      WHERE m.experience_id = :experienceId
      ORDER BY m.relevance_score DESC
    `;
    
    return await this.database.executeQuery(query, { experienceId });
  }

  async getUserCompetencyMappings(userId) {
    const query = `
      SELECT m.*, c.competency_id, c.area_code, c.sub_code, c.sub_name, c.category
      FROM ${this.tablePrefix}cpa_competency_mappings m
      JOIN ${this.tablePrefix}cpa_competencies c ON m.competency_id = c.competency_id
      WHERE m.user_id = :userId
      ORDER BY c.category, c.area_code, c.sub_code
    `;
    
    return await this.database.executeQuery(query, { userId });
  }

  // PERT response operations

  async createPERTResponse(responseData) {
    const query = `
      INSERT INTO ${this.tablePrefix}cpa_pert_responses (
        response_id, user_id, experience_id, competency_id,
        proficiency_level, response_text, character_count,
        situation_text, task_text, action_text, result_text,
        quantified_impact, is_compliant
      ) VALUES (
        :response_id, :user_id, :experience_id, :competency_id,
        :proficiency_level, :response_text, :character_count,
        :situation_text, :task_text, :action_text, :result_text,
        :quantified_impact, :is_compliant
      )
    `;
    
    await this.database.executeQuery(query, responseData);
    return await this.getPERTResponse(responseData.response_id);
  }

  async getPERTResponse(responseId) {
    const query = `
      SELECT r.*, c.competency_id, c.area_code, c.sub_code, c.sub_name, c.category
      FROM ${this.tablePrefix}cpa_pert_responses r
      JOIN ${this.tablePrefix}cpa_competencies c ON r.competency_id = c.competency_id
      WHERE r.response_id = :responseId
    `;
    
    const results = await this.database.executeQuery(query, { responseId });
    return results[0];
  }

  async getUserPERTResponses(userId, limit = 50) {
    const query = `
      SELECT r.*, c.competency_id, c.area_code, c.sub_code, c.sub_name, c.category
      FROM ${this.tablePrefix}cpa_pert_responses r
      JOIN ${this.tablePrefix}cpa_competencies c ON r.competency_id = c.competency_id
      WHERE r.user_id = :userId
      AND r.is_current = 1
      ORDER BY r.created_at DESC
      FETCH FIRST :limit ROWS ONLY
    `;
    
    return await this.database.executeQuery(query, { userId, limit });
  }

  async getUserPERTResponsesForCompetency(userId, competencyId) {
    const query = `
      SELECT * FROM ${this.tablePrefix}cpa_pert_responses
      WHERE user_id = :userId
      AND competency_id = :competencyId
      AND is_current = 1
      ORDER BY proficiency_level DESC, created_at DESC
    `;
    
    return await this.database.executeQuery(query, { userId, competencyId });
  }

  async getAllUserPERTResponses(userId) {
    const query = `
      SELECT r.*, c.competency_id, c.area_code, c.sub_code, c.sub_name, c.category
      FROM ${this.tablePrefix}cpa_pert_responses r
      JOIN ${this.tablePrefix}cpa_competencies c ON r.competency_id = c.competency_id
      WHERE r.user_id = :userId
      AND r.is_current = 1
      ORDER BY c.category, c.area_code, c.sub_code, r.proficiency_level DESC
    `;
    
    return await this.database.executeQuery(query, { userId });
  }

  async updatePERTResponse(responseId, updates) {
    // Mark existing as not current
    await this.database.executeQuery(
      `UPDATE ${this.tablePrefix}cpa_pert_responses 
       SET is_current = 'N' 
       WHERE response_id = :responseId`,
      { responseId }
    );

    // Create new version
    const newData = {
      ...updates,
      response_id: this.database.generateId(),
      version: updates.version + 1,
      is_current: 'Y'
    };

    return await this.createPERTResponse(newData);
  }

  // Proficiency assessment operations

  async upsertProficiencyAssessment(assessmentData) {
    // Check if assessment exists
    const existing = await this.getUserProficiencyAssessment(
      assessmentData.user_id,
      assessmentData.competency_id
    );

    if (existing) {
      // Update existing
      const query = `
        UPDATE ${this.tablePrefix}cpa_proficiency_assessments
        SET current_level = :current_level,
            target_level = :target_level,
            evidence_count = :evidence_count,
            strongest_evidence = :strongest_evidence,
            development_areas = :development_areas,
            next_steps = :next_steps,
            assessment_date = SYSDATE
        WHERE user_id = :user_id
        AND competency_id = :competency_id
      `;
      
      await this.database.executeQuery(query, assessmentData);
      return await this.getUserProficiencyAssessment(
        assessmentData.user_id,
        assessmentData.competency_id
      );
    } else {
      // Insert new
      const query = `
        INSERT INTO ${this.tablePrefix}cpa_proficiency_assessments (
          assessment_id, user_id, competency_id, current_level,
          target_level, evidence_count, strongest_evidence,
          development_areas, next_steps
        ) VALUES (
          :assessment_id, :user_id, :competency_id, :current_level,
          :target_level, :evidence_count, :strongest_evidence,
          :development_areas, :next_steps
        )
      `;
      
      await this.database.executeQuery(query, assessmentData);
      return await this.getProficiencyAssessment(assessmentData.assessment_id);
    }
  }

  async getProficiencyAssessment(assessmentId) {
    const query = `
      SELECT a.*, c.competency_code, c.competency_name, c.category
      FROM ${this.tablePrefix}cpa_proficiency_assessments a
      JOIN ${this.tablePrefix}cpa_competencies c ON a.competency_id = c.competency_id
      WHERE a.assessment_id = :assessmentId
    `;
    
    const results = await this.database.executeQuery(query, { assessmentId });
    return results[0];
  }

  async getUserProficiencyAssessment(userId, competencyId) {
    const query = `
      SELECT * FROM ${this.tablePrefix}cpa_proficiency_assessments
      WHERE user_id = :userId
      AND competency_id = :competencyId
    `;
    
    const results = await this.database.executeQuery(query, { userId, competencyId });
    return results[0];
  }

  async getUserProficiencyAssessments(userId) {
    const query = `
      SELECT a.*, c.competency_code, c.competency_name, c.category
      FROM ${this.tablePrefix}cpa_proficiency_assessments a
      JOIN ${this.tablePrefix}cpa_competencies c ON a.competency_id = c.competency_id
      WHERE a.user_id = :userId
      ORDER BY c.category, c.area_code, c.sub_code
    `;
    
    return await this.database.executeQuery(query, { userId });
  }

  // Compliance check operations

  async createComplianceCheck(checkData) {
    const query = `
      INSERT INTO ${this.tablePrefix}cpa_compliance_checks (
        check_id, user_id, check_type, is_compliant,
        total_competencies, competencies_met,
        missing_competencies, recommendations
      ) VALUES (
        :check_id, :user_id, :check_type, :is_compliant,
        :total_competencies, :competencies_met,
        :missing_competencies, :recommendations
      )
    `;
    
    await this.database.executeQuery(query, checkData);
    return await this.getComplianceCheck(checkData.check_id);
  }

  async getComplianceCheck(checkId) {
    const query = `
      SELECT * FROM ${this.tablePrefix}cpa_compliance_checks
      WHERE check_id = :checkId
    `;
    
    const results = await this.database.executeQuery(query, { checkId });
    return results[0];
  }

  async getLatestComplianceCheck(userId) {
    const query = `
      SELECT * FROM ${this.tablePrefix}cpa_compliance_checks
      WHERE user_id = :userId
      ORDER BY created_at DESC
      FETCH FIRST 1 ROW ONLY
    `;
    
    const results = await this.database.executeQuery(query, { userId });
    return results[0];
  }

  async getUserComplianceHistory(userId, limit = 10) {
    const query = `
      SELECT * FROM ${this.tablePrefix}cpa_compliance_checks
      WHERE user_id = :userId
      ORDER BY created_at DESC
      FETCH FIRST :limit ROWS ONLY
    `;
    
    return await this.database.executeQuery(query, { userId, limit });
  }

  // Analytics and reporting

  async getCompetencyAnalytics(userId) {
    const query = `
      WITH competency_stats AS (
        SELECT 
          c.category,
          COUNT(DISTINCT c.competency_id) as total_competencies,
          COUNT(DISTINCT a.competency_id) as assessed_competencies,
          SUM(CASE WHEN a.current_level = 2 THEN 1 ELSE 0 END) as level_2_count,
          SUM(CASE WHEN a.current_level = 1 THEN 1 ELSE 0 END) as level_1_count,
          SUM(CASE WHEN a.current_level = 0 THEN 1 ELSE 0 END) as level_0_count
        FROM ${this.tablePrefix}cpa_competencies c
        LEFT JOIN ${this.tablePrefix}cpa_proficiency_assessments a 
          ON c.competency_id = a.competency_id AND a.user_id = :userId
        WHERE c.is_active = 'Y'
        GROUP BY c.category
      )
      SELECT * FROM competency_stats
      ORDER BY category
    `;
    
    return await this.database.executeQuery(query, { userId });
  }

  async getPERTResponseStats(userId) {
    const query = `
      SELECT 
        COUNT(*) as total_responses,
        COUNT(DISTINCT experience_id) as unique_experiences,
        COUNT(DISTINCT competency_id) as unique_competencies,
        AVG(character_count) as avg_character_count,
        MAX(created_at) as last_response_date
      FROM ${this.tablePrefix}cpa_pert_responses
      WHERE user_id = :userId
      AND is_current = 1
    `;
    
    const results = await this.database.executeQuery(query, { userId });
    return results[0];
  }
}

module.exports = CPAPertRepository;