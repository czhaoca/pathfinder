const express = require('express');
const { validate, schemas } = require('../middleware/validation');

function createProfileRoutes(container) {
  const router = express.Router();
  const profileController = container.get('profileController');
  const authMiddleware = container.get('authMiddleware');

  // All profile routes require authentication
  router.use(authMiddleware.authenticate());

  router.get('/',
    profileController.getProfile
  );

  router.put('/',
    validate(schemas.profile.update),
    profileController.updateProfile
  );

  router.post('/change-password',
    validate(schemas.auth.changePassword),
    profileController.changePassword
  );

  router.delete('/',
    authMiddleware.rateLimitByUser({ windowMs: 60000, max: 3 }),
    profileController.deleteAccount
  );

  return router;
}

module.exports = createProfileRoutes;