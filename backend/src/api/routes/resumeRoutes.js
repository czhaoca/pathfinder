const express = require('express');
const ErrorHandler = require('../middleware/errorHandler');

function createResumeRoutes(container) {
  const router = express.Router();
  const resumeController = container.get('resumeController');
  const authMiddleware = container.get('authMiddleware');

  // All resume routes require authentication
  router.use(authMiddleware.authenticate());

  // Get available templates
  router.get('/templates',
    ErrorHandler.asyncWrapper((req, res, next) => 
      resumeController.getTemplates(req, res, next)
    )
  );

  // Preview resume without generating file
  router.get('/preview',
    ErrorHandler.asyncWrapper((req, res, next) => 
      resumeController.previewResume(req, res, next)
    )
  );

  // Get ATS optimization suggestions
  router.get('/ats-optimization',
    ErrorHandler.asyncWrapper((req, res, next) => 
      resumeController.getATSOptimization(req, res, next)
    )
  );

  // Generate resume
  router.post('/generate',
    ErrorHandler.asyncWrapper((req, res, next) => 
      resumeController.generateResume(req, res, next)
    )
  );

  // Generate multiple versions
  router.post('/generate-versions',
    ErrorHandler.asyncWrapper((req, res, next) => 
      resumeController.generateVersions(req, res, next)
    )
  );

  // Update resume section
  router.put('/section/:section',
    ErrorHandler.asyncWrapper((req, res, next) => 
      resumeController.updateSection(req, res, next)
    )
  );

  return router;
}

module.exports = createResumeRoutes;