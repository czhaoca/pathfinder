const express = require('express');
const ErrorHandler = require('../middleware/errorHandler');
const { validate, schemas } = require('../middleware/validation');

function createExperienceRoutes(container) {
  const router = express.Router();
  const experienceController = container.get('experienceController');
  const authMiddleware = container.get('authMiddleware');

  // All experience routes require authentication
  router.use(authMiddleware.authenticate());

  router.get('/',
    validate(schemas.pagination),
    experienceController.listExperiences
  );

  // Stats route must come before /:id to avoid route conflicts
  router.get('/stats',
    experienceController.getExperienceStats
  );

  // Templates route must come before /:id to avoid route conflicts
  router.get('/templates',
    experienceController.getExperienceTemplates
  );

  router.post('/',
    validate(schemas.experience.create),
    experienceController.createExperience
  );

  router.get('/:id',
    experienceController.getExperience
  );

  router.put('/:id',
    validate(schemas.experience.update),
    experienceController.updateExperience
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