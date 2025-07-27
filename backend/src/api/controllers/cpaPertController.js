/**
 * CPA PERT Controller
 * Handles HTTP requests for CPA PERT functionality
 */

const Joi = require('joi');
const logger = require('../../utils/logger');

class CPAPertController {
  constructor(cpaPertService, authService) {
    this.cpaPertService = cpaPertService;
    this.authService = authService;
  }

  /**
   * Analyze experience and map to CPA competencies
   * POST /api/cpa-pert/analyze-experience
   */
  async analyzeExperience(req, res, next) {
    try {
      const schema = Joi.object({
        experienceId: Joi.string().uuid().required()
      });

      const { error, value } = schema.validate(req.body);
      if (error) {
        return res.status(400).json({ 
          error: 'Validation error', 
          details: error.details 
        });
      }

      const mappings = await this.cpaPertService.analyzeExperienceCompetencies(
        value.experienceId,
        req.user.userId
      );

      res.json({
        success: true,
        data: {
          experienceId: value.experienceId,
          mappings: mappings,
          totalMapped: mappings.length
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get competency mapping for an experience
   * GET /api/cpa-pert/competency-mapping/:experienceId
   */
  async getCompetencyMapping(req, res, next) {
    try {
      const { experienceId } = req.params;

      if (!experienceId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        return res.status(400).json({ error: 'Invalid experience ID format' });
      }

      const mappings = await this.cpaPertService.cpaPertRepository.getExperienceMappings(
        experienceId
      );

      // Verify user owns this experience
      const userOwnsExperience = mappings.length > 0 && mappings[0].user_id === req.user.userId;
      if (!userOwnsExperience) {
        return res.status(404).json({ error: 'Experience not found' });
      }

      res.json({
        success: true,
        data: mappings
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Generate PERT response
   * POST /api/cpa-pert/generate-response
   */
  async generatePERTResponse(req, res, next) {
    try {
      const schema = Joi.object({
        experienceId: Joi.string().uuid().required(),
        competencyCode: Joi.string().pattern(/^[A-Z]{2}-\d+\.\d+$/).required(),
        proficiencyLevel: Joi.number().integer().min(0).max(2).required()
      });

      const { error, value } = schema.validate(req.body);
      if (error) {
        return res.status(400).json({ 
          error: 'Validation error', 
          details: error.details 
        });
      }

      const response = await this.cpaPertService.generatePERTResponse(
        value.experienceId,
        value.competencyCode,
        value.proficiencyLevel,
        req.user.userId
      );

      res.json({
        success: true,
        data: response
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Check EVR compliance
   * GET /api/cpa-pert/compliance-check
   */
  async checkCompliance(req, res, next) {
    try {
      const result = await this.cpaPertService.validateEVRRequirements(req.user.userId);

      res.json({
        success: true,
        data: {
          isCompliant: result.isCompliant,
          summary: result.summary,
          complianceCheck: result.complianceCheck
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Validate EVR requirements
   * POST /api/cpa-pert/validate-requirements
   */
  async validateRequirements(req, res, next) {
    try {
      // This endpoint triggers a full validation and creates a new compliance check
      const result = await this.cpaPertService.validateEVRRequirements(req.user.userId);

      res.json({
        success: true,
        data: {
          isCompliant: result.isCompliant,
          details: result.summary,
          recommendations: result.complianceCheck.recommendations 
            ? JSON.parse(result.complianceCheck.recommendations) 
            : []
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get CPA competency framework
   * GET /api/cpa-pert/competency-framework
   */
  async getCompetencyFramework(req, res, next) {
    try {
      const competencies = await this.cpaPertService.cpaPertRepository.getAllCompetencies();

      // Group by category
      const framework = competencies.reduce((acc, comp) => {
        if (!acc[comp.category]) {
          acc[comp.category] = [];
        }
        acc[comp.category].push({
          competencyId: comp.competency_id,
          competencyCode: comp.competency_code,
          competencyName: comp.competency_name,
          description: comp.description,
          proficiencyLevels: JSON.parse(comp.proficiency_levels)
        });
        return acc;
      }, {});

      res.json({
        success: true,
        data: framework
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get proficiency assessment for an experience
   * GET /api/cpa-pert/proficiency-assessment/:experienceId
   */
  async getProficiencyAssessment(req, res, next) {
    try {
      const { experienceId } = req.params;
      const { competencyCode } = req.query;

      if (!experienceId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        return res.status(400).json({ error: 'Invalid experience ID format' });
      }

      if (!competencyCode || !competencyCode.match(/^[A-Z]{2}-\d+\.\d+$/)) {
        return res.status(400).json({ error: 'Valid competency code required' });
      }

      const assessment = await this.cpaPertService.assessProficiencyLevel(
        experienceId,
        competencyCode,
        req.user.userId
      );

      res.json({
        success: true,
        data: assessment
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get user's PERT responses
   * GET /api/cpa-pert/responses
   */
  async getUserPERTResponses(req, res, next) {
    try {
      const { limit = 50 } = req.query;

      const responses = await this.cpaPertService.cpaPertRepository.getUserPERTResponses(
        req.user.userId,
        parseInt(limit)
      );

      res.json({
        success: true,
        data: responses,
        total: responses.length
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get competency report
   * GET /api/cpa-pert/competency-report
   */
  async getCompetencyReport(req, res, next) {
    try {
      const report = await this.cpaPertService.generateCompetencyReport(req.user.userId);

      res.json({
        success: true,
        data: report
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update PERT response
   * PUT /api/cpa-pert/response/:responseId
   */
  async updatePERTResponse(req, res, next) {
    try {
      const { responseId } = req.params;
      
      const schema = Joi.object({
        responseText: Joi.string().max(5000).required(),
        situationText: Joi.string().max(1000).optional(),
        taskText: Joi.string().max(1000).optional(),
        actionText: Joi.string().max(2500).optional(),
        resultText: Joi.string().max(1500).optional(),
        quantifiedImpact: Joi.string().max(500).optional()
      });

      const { error, value } = schema.validate(req.body);
      if (error) {
        return res.status(400).json({ 
          error: 'Validation error', 
          details: error.details 
        });
      }

      // Verify user owns this response
      const existingResponse = await this.cpaPertService.cpaPertRepository.getPERTResponse(responseId);
      if (!existingResponse || existingResponse.user_id !== req.user.userId) {
        return res.status(404).json({ error: 'PERT response not found' });
      }

      // Update response
      const updatedResponse = await this.cpaPertService.cpaPertRepository.updatePERTResponse(
        responseId,
        {
          ...value,
          character_count: value.responseText.length,
          version: existingResponse.version
        }
      );

      res.json({
        success: true,
        data: updatedResponse
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete PERT response
   * DELETE /api/cpa-pert/response/:responseId
   */
  async deletePERTResponse(req, res, next) {
    try {
      const { responseId } = req.params;

      // Verify user owns this response
      const existingResponse = await this.cpaPertService.cpaPertRepository.getPERTResponse(responseId);
      if (!existingResponse || existingResponse.user_id !== req.user.userId) {
        return res.status(404).json({ error: 'PERT response not found' });
      }

      // Mark as not current instead of hard delete
      await this.cpaPertService.cpaPertRepository.database.executeQuery(
        `UPDATE ${this.cpaPertService.cpaPertRepository.tablePrefix}cpa_pert_responses 
         SET is_current = 'N' 
         WHERE response_id = :responseId`,
        { responseId }
      );

      res.json({
        success: true,
        message: 'PERT response deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = CPAPertController;