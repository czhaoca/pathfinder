const express = require('express');
const { validate, schemas } = require('../middleware/validation');

function createAuthRoutes(container) {
  const router = express.Router();
  const authController = container.get('authController');
  const authMiddleware = container.get('authMiddleware');
  const rateLimiter = container.get('rateLimiter');

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

  // Google OAuth routes with rate limiting
  router.get('/google',
    rateLimiter.middleware('oauth', { max: 20, window: 900000 }), // 20 requests per 15 minutes
    authController.googleAuth
  );

  router.get('/google/callback',
    rateLimiter.middleware('oauth_callback', { max: 50, window: 900000 }), // 50 callbacks per 15 minutes
    authController.googleCallback
  );

  router.post('/google/merge',
    authMiddleware.authenticate(),
    rateLimiter.middleware('oauth_merge', { max: 5, window: 900000 }), // 5 merge attempts per 15 minutes
    validate(schemas.auth.googleMerge),
    authController.googleMerge
  );

  router.delete('/google/unlink',
    authMiddleware.authenticate(),
    rateLimiter.middleware('oauth_unlink', { max: 10, window: 3600000 }), // 10 unlinks per hour
    authController.googleUnlink
  );

  // LinkedIn OAuth routes with rate limiting
  router.get('/linkedin',
    rateLimiter.middleware('oauth', { max: 20, window: 900000 }), // 20 requests per 15 minutes
    authController.linkedInAuth
  );

  router.get('/linkedin/callback',
    rateLimiter.middleware('oauth_callback', { max: 50, window: 900000 }), // 50 callbacks per 15 minutes
    authController.linkedInCallback
  );

  router.post('/linkedin/merge',
    authMiddleware.authenticate(),
    rateLimiter.middleware('oauth_merge', { max: 5, window: 900000 }), // 5 merge attempts per 15 minutes
    validate(schemas.auth.linkedInMerge),
    authController.linkedInMerge
  );

  router.delete('/linkedin/unlink',
    authMiddleware.authenticate(),
    rateLimiter.middleware('oauth_unlink', { max: 10, window: 3600000 }), // 10 unlinks per hour
    authController.linkedInUnlink
  );

  // LinkedIn profile import routes
  router.post('/linkedin/import',
    authMiddleware.authenticate(),
    rateLimiter.middleware('profile_import', { max: 10, window: 3600000 }), // 10 imports per hour
    validate(schemas.auth.linkedInImport),
    authController.linkedInImport
  );

  router.post('/linkedin/sync',
    authMiddleware.authenticate(),
    rateLimiter.middleware('profile_sync', { max: 20, window: 3600000 }), // 20 syncs per hour
    validate(schemas.auth.linkedInSync),
    authController.linkedInSync
  );

  // SSO account management
  router.get('/sso/providers',
    authMiddleware.authenticate(),
    authController.getLinkedProviders
  );

  return router;
}

module.exports = createAuthRoutes;