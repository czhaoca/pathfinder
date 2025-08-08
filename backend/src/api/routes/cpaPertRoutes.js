/**
 * CPA PERT Routes
 * Defines API endpoints for CPA PERT functionality
 */

const express = require('express');
const ErrorHandler = require('../middleware/errorHandler');

function createCPAPertRoutes(container) {
  const router = express.Router();
  const cpaPertController = container.get('cpaPertController');
  const authMiddleware = container.get('authMiddleware');

  // All routes require authentication
  router.use(authMiddleware.authenticate());

  // Analyze experience and map competencies
  router.post(
    '/analyze-experience',
    ErrorHandler.asyncWrapper((req, res, next) => cpaPertController.analyzeExperience(req, res, next))
  );

  // Get competency mapping for an experience
  router.get(
    '/competency-mapping/:experienceId',
    ErrorHandler.asyncWrapper((req, res, next) => cpaPertController.getCompetencyMapping(req, res, next))
  );

  // Generate PERT response
  router.post(
    '/generate-response',
    ErrorHandler.asyncWrapper((req, res, next) => cpaPertController.generatePERTResponse(req, res, next))
  );

  // EVR compliance check
  router.get(
    '/compliance-check',
    ErrorHandler.asyncWrapper((req, res, next) => cpaPertController.checkCompliance(req, res, next))
  );

  // Validate EVR requirements (creates new check)
  router.post(
    '/validate-requirements',
    ErrorHandler.asyncWrapper((req, res, next) => cpaPertController.validateRequirements(req, res, next))
  );

  // Get competency framework
  router.get(
    '/competency-framework',
    ErrorHandler.asyncWrapper((req, res, next) => cpaPertController.getCompetencyFramework(req, res, next))
  );

  // Get proficiency assessment
  router.get(
    '/proficiency-assessment/:experienceId',
    ErrorHandler.asyncWrapper((req, res, next) => cpaPertController.getProficiencyAssessment(req, res, next))
  );

  // Get user's PERT responses
  router.get(
    '/responses',
    ErrorHandler.asyncWrapper((req, res, next) => cpaPertController.getUserPERTResponses(req, res, next))
  );

  // Get competency report
  router.get(
    '/competency-report',
    ErrorHandler.asyncWrapper((req, res, next) => cpaPertController.getCompetencyReport(req, res, next))
  );

  // Update PERT response
  router.put(
    '/response/:responseId',
    ErrorHandler.asyncWrapper((req, res, next) => cpaPertController.updatePERTResponse(req, res, next))
  );

  // Delete PERT response
  router.delete(
    '/response/:responseId',
    ErrorHandler.asyncWrapper((req, res, next) => cpaPertController.deletePERTResponse(req, res, next))
  );

  // Batch operations
  router.post(
    '/batch/analyze',
    ErrorHandler.asyncWrapper((req, res, next) => cpaPertController.batchAnalyzeExperiences(req, res, next))
  );

  router.post(
    '/batch/generate',
    ErrorHandler.asyncWrapper((req, res, next) => cpaPertController.batchGeneratePERTResponses(req, res, next))
  );

  return router;
}

module.exports = createCPAPertRoutes;