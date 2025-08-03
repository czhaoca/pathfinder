const express = require('express');
const { validate, schemas } = require('../middleware/validation');

function createAuthRoutes(container) {
  const router = express.Router();
  const authController = container.get('authController');
  const authMiddleware = container.get('authMiddleware');

  // Public routes
  router.post('/register', 
    validate(schemas.auth.register),
    authController.register
  );

  router.post('/login',
    validate(schemas.auth.login),
    authController.login
  );

  router.post('/refresh',
    authController.refreshToken
  );

  // Protected routes
  router.post('/logout',
    authMiddleware.authenticate(),
    authController.logout
  );

  return router;
}

module.exports = createAuthRoutes;