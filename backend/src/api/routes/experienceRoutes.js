const express = require('express');
const ErrorHandler = require('../middleware/errorHandler');

function createExperienceRoutes(container) {
  const router = express.Router();
  const experienceController = container.get('experienceController');
  const authMiddleware = container.get('authMiddleware');

  // All experience routes require authentication
  router.use(authMiddleware.authenticate());

  router.get('/',
    ErrorHandler.asyncWrapper((req, res, next) => 
      experienceController.listExperiences(req, res, next)
    )
  );

  // Stats route must come before /:id to avoid route conflicts
  router.get('/stats',
    ErrorHandler.asyncWrapper((req, res, next) => 
      experienceController.getExperienceStats(req, res, next)
    )
  );

  // Templates route must come before /:id to avoid route conflicts
  router.get('/templates',
    ErrorHandler.asyncWrapper((req, res, next) => 
      experienceController.getExperienceTemplates(req, res, next)
    )
  );

  router.post('/',
    ErrorHandler.asyncWrapper((req, res, next) => 
      experienceController.createExperience(req, res, next)
    )
  );

  router.get('/:id',
    ErrorHandler.asyncWrapper((req, res, next) => 
      experienceController.getExperience(req, res, next)
    )
  );

  router.put('/:id',
    ErrorHandler.asyncWrapper((req, res, next) => 
      experienceController.updateExperience(req, res, next)
    )
  );

  router.delete('/:id',
    ErrorHandler.asyncWrapper((req, res, next) => 
      experienceController.deleteExperience(req, res, next)
    )
  );

  // Bulk operations
  router.post('/bulk',
    ErrorHandler.asyncWrapper((req, res, next) => 
      experienceController.bulkCreateExperiences(req, res, next)
    )
  );

  router.put('/bulk',
    ErrorHandler.asyncWrapper((req, res, next) => 
      experienceController.bulkUpdateExperiences(req, res, next)
    )
  );

  // Experience-specific operations (must be after generic routes)
  router.post('/:id/duplicate',
    ErrorHandler.asyncWrapper((req, res, next) => 
      experienceController.duplicateExperience(req, res, next)
    )
  );

  router.post('/:id/extract-skills',
    ErrorHandler.asyncWrapper((req, res, next) => 
      experienceController.extractSkills(req, res, next)
    )
  );

  return router;
}

module.exports = createExperienceRoutes;