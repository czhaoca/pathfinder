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

  return router;
}

module.exports = createExperienceRoutes;