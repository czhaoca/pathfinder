/**
 * CPA PERT Routes
 * Defines API endpoints for CPA PERT functionality
 */

const express = require('express');

function createCPAPertRoutes(container) {
  const router = express.Router();
  const cpaPertController = container.get('cpaPertController');
  const authMiddleware = container.get('authMiddleware');

  // All routes require authentication
  router.use(authMiddleware.authenticate.bind(authMiddleware));

  // Analyze experience and map competencies
  router.post(
    '/analyze-experience',
    cpaPertController.analyzeExperience.bind(cpaPertController)
  );

  // Get competency mapping for an experience
  router.get(
    '/competency-mapping/:experienceId',
    cpaPertController.getCompetencyMapping.bind(cpaPertController)
  );

  // Generate PERT response
  router.post(
    '/generate-response',
    cpaPertController.generatePERTResponse.bind(cpaPertController)
  );

  // EVR compliance check
  router.get(
    '/compliance-check',
    cpaPertController.checkCompliance.bind(cpaPertController)
  );

  // Validate EVR requirements (creates new check)
  router.post(
    '/validate-requirements',
    cpaPertController.validateRequirements.bind(cpaPertController)
  );

  // Get competency framework
  router.get(
    '/competency-framework',
    cpaPertController.getCompetencyFramework.bind(cpaPertController)
  );

  // Get proficiency assessment
  router.get(
    '/proficiency-assessment/:experienceId',
    cpaPertController.getProficiencyAssessment.bind(cpaPertController)
  );

  // Get user's PERT responses
  router.get(
    '/responses',
    cpaPertController.getUserPERTResponses.bind(cpaPertController)
  );

  // Get competency report
  router.get(
    '/competency-report',
    cpaPertController.getCompetencyReport.bind(cpaPertController)
  );

  // Update PERT response
  router.put(
    '/response/:responseId',
    cpaPertController.updatePERTResponse.bind(cpaPertController)
  );

  // Delete PERT response
  router.delete(
    '/response/:responseId',
    cpaPertController.deletePERTResponse.bind(cpaPertController)
  );

  // Batch operations
  router.post(
    '/batch/analyze',
    cpaPertController.batchAnalyzeExperiences.bind(cpaPertController)
  );

  router.post(
    '/batch/generate',
    cpaPertController.batchGeneratePERTResponses.bind(cpaPertController)
  );

  return router;
}

module.exports = createCPAPertRoutes;