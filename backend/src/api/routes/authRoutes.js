const express = require('express');
const ErrorHandler = require('../middleware/errorHandler');

function createAuthRoutes(container) {
  const router = express.Router();
  const authController = container.get('authController');
  const authMiddleware = container.get('authMiddleware');

  // Public routes
  router.post('/register', 
    ErrorHandler.asyncWrapper((req, res, next) => 
      authController.register(req, res, next)
    )
  );

  router.post('/login',
    ErrorHandler.asyncWrapper((req, res, next) => 
      authController.login(req, res, next)
    )
  );

  router.post('/refresh',
    ErrorHandler.asyncWrapper((req, res, next) => 
      authController.refreshToken(req, res, next)
    )
  );

  // Protected routes
  router.post('/logout',
    authMiddleware.authenticate(),
    ErrorHandler.asyncWrapper((req, res, next) => 
      authController.logout(req, res, next)
    )
  );

  return router;
}

module.exports = createAuthRoutes;