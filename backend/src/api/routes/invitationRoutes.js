const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/authMiddleware');
const rateLimiter = require('../middleware/rateLimiter');
const csrfMiddleware = require('../middleware/csrfMiddleware');
const InvitationController = require('../controllers/invitationController');

// Initialize controller (will be injected by container)
let invitationController;

const initializeRoutes = (container) => {
  invitationController = new InvitationController(
    container.get('invitationService')
  );
  return router;
};

// CSRF token endpoint
router.get(
  '/admin/invitations/csrf-token',
  authMiddleware,
  csrfMiddleware.getTokenEndpoint()
);

// Admin invitation endpoints (protected)
router.post(
  '/admin/invitations/send',
  authMiddleware,
  csrfMiddleware.protect(),
  rateLimiter({ windowMs: 60 * 60 * 1000, max: 100 }), // 100 invitations per hour
  (req, res, next) => invitationController.sendInvitations(req, res, next)
);

router.get(
  '/admin/invitations',
  authMiddleware,
  (req, res, next) => invitationController.listInvitations(req, res, next)
);

router.post(
  '/admin/invitations/:id/resend',
  authMiddleware,
  csrfMiddleware.protect(),
  rateLimiter({ windowMs: 60 * 60 * 1000, max: 50 }), // 50 resends per hour
  (req, res, next) => invitationController.resendInvitation(req, res, next)
);

router.delete(
  '/admin/invitations/:id',
  authMiddleware,
  csrfMiddleware.protect(),
  (req, res, next) => invitationController.revokeInvitation(req, res, next)
);

router.post(
  '/admin/invitations/bulk',
  authMiddleware,
  csrfMiddleware.protect(),
  rateLimiter({ windowMs: 60 * 60 * 1000, max: 10 }), // 10 bulk uploads per hour
  (req, res, next) => invitationController.bulkInvitations(req, res, next)
);

router.get(
  '/admin/invitations/stats',
  authMiddleware,
  (req, res, next) => invitationController.getInvitationStats(req, res, next)
);

// Public invitation endpoints
router.get(
  '/invitations/validate/:token',
  rateLimiter({ windowMs: 15 * 60 * 1000, max: 10 }), // 10 validations per 15 minutes per IP
  (req, res, next) => invitationController.validateInvitation(req, res, next)
);

router.post(
  '/invitations/accept',
  rateLimiter({ windowMs: 60 * 60 * 1000, max: 5 }), // 5 attempts per hour per IP
  (req, res, next) => invitationController.acceptInvitation(req, res, next)
);

module.exports = { router, initializeRoutes };