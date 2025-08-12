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

  // Password reset flow
  router.post('/forgot-password',
    validate(schemas.auth.forgotPassword),
    authController.forgotPassword
  );

  router.post('/reset-password',
    validate(schemas.auth.resetPassword),
    authController.resetPassword
  );

  // Email verification
  router.get('/verify/:token',
    authController.verifyEmail
  );

  router.post('/resend-verification',
    validate(schemas.auth.resendVerification),
    authController.resendVerification
  );

  // Protected routes
  router.post('/logout',
    authMiddleware.authenticate(),
    authController.logout
  );

  router.post('/change-password',
    authMiddleware.authenticate(),
    validate(schemas.auth.changePassword),
    authController.changePassword
  );

  // Session management
  router.get('/sessions',
    authMiddleware.authenticate(),
    authController.getSessions
  );

  router.delete('/sessions/:sessionId',
    authMiddleware.authenticate(),
    authController.revokeSession
  );

  return router;
}

module.exports = createAuthRoutes;