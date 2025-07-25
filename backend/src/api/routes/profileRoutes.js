const express = require('express');
const ErrorHandler = require('../middleware/errorHandler');
const { validatePasswordChangeRequest } = require('../../validators/authValidator');

function createProfileRoutes(container) {
  const router = express.Router();
  const profileController = container.get('profileController');
  const authMiddleware = container.get('authMiddleware');

  // All profile routes require authentication
  router.use(authMiddleware.authenticate());

  router.get('/',
    ErrorHandler.asyncWrapper((req, res, next) => 
      profileController.getProfile(req, res, next)
    )
  );

  router.put('/',
    ErrorHandler.asyncWrapper((req, res, next) => 
      profileController.updateProfile(req, res, next)
    )
  );

  router.post('/change-password',
    ErrorHandler.asyncWrapper((req, res, next) => {
      const validation = validatePasswordChangeRequest(req.body);
      if (validation.error) {
        return res.status(400).json({ error: validation.error.details[0].message });
      }
      return profileController.changePassword(req, res, next);
    })
  );

  router.delete('/',
    authMiddleware.rateLimitByUser({ windowMs: 60000, max: 3 }),
    ErrorHandler.asyncWrapper((req, res, next) => 
      profileController.deleteAccount(req, res, next)
    )
  );

  return router;
}

module.exports = createProfileRoutes;