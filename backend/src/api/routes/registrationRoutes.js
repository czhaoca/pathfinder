/**
 * Registration Routes with DDoS Protection
 * 
 * Public endpoints for user self-registration with comprehensive security
 */

const express = require('express');
const router = express.Router();
const { RegistrationController } = require('../controllers/registrationController');
const { validateRequest } = require('../middleware/validation');
const { rateLimiter } = require('../middleware/rateLimiter');
const { captureRequestContext } = require('../middleware/requestContext');
const { body, query } = require('express-validator');

// Initialize controller (will be injected in app.js)
let registrationController;

// Validation rules
const registrationValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  body('username')
    .isLength({ min: 3, max: 30 })
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage('Username must be 3-30 characters, alphanumeric with underscores and hyphens'),
  body('password')
    .isLength({ min: 8 })
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must be at least 8 characters with uppercase, lowercase, and number'),
  body('firstName')
    .optional()
    .isLength({ max: 100 })
    .trim()
    .escape(),
  body('lastName')
    .optional()
    .isLength({ max: 100 })
    .trim()
    .escape(),
  body('captchaToken')
    .optional()
    .isString()
];

const usernameCheckValidation = [
  body('username')
    .isLength({ min: 3, max: 30 })
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage('Invalid username format')
];

const emailCheckValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Invalid email format')
];

const verificationValidation = [
  query('token')
    .isString()
    .isLength({ min: 32, max: 128 })
    .withMessage('Invalid verification token')
];

const verificationCodeValidation = [
  body('code')
    .isString()
    .isLength({ min: 6, max: 6 })
    .isNumeric()
    .withMessage('Invalid verification code'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required')
];

// Rate limiting configurations
const registrationRateLimit = rateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per IP
  message: 'Too many registration attempts. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  keyGenerator: (req) => req.ip
});

const checkRateLimit = rateLimiter({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 20, // 20 checks per minute
  message: 'Too many requests. Please slow down.',
  skipSuccessfulRequests: true
});

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post(
  '/register',
  registrationRateLimit,
  captureRequestContext,
  registrationValidation,
  validateRequest,
  async (req, res, next) => {
    try {
      await registrationController.register(req, res);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   POST /api/auth/register/check-username
 * @desc    Check if username is available
 * @access  Public
 */
router.post(
  '/register/check-username',
  checkRateLimit,
  usernameCheckValidation,
  validateRequest,
  async (req, res, next) => {
    try {
      await registrationController.checkUsername(req, res);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   POST /api/auth/register/check-email
 * @desc    Check if email is available
 * @access  Public
 */
router.post(
  '/register/check-email',
  checkRateLimit,
  emailCheckValidation,
  validateRequest,
  async (req, res, next) => {
    try {
      await registrationController.checkEmail(req, res);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   GET /api/auth/verify-email
 * @desc    Verify email address with token
 * @access  Public
 */
router.get(
  '/verify-email',
  verificationValidation,
  validateRequest,
  async (req, res, next) => {
    try {
      await registrationController.verifyEmail(req, res);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   POST /api/auth/verify-email-code
 * @desc    Verify email with 6-digit code
 * @access  Public
 */
router.post(
  '/verify-email-code',
  verificationCodeValidation,
  validateRequest,
  async (req, res, next) => {
    try {
      await registrationController.verifyEmailCode(req, res);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   POST /api/auth/resend-verification
 * @desc    Resend verification email
 * @access  Public
 */
router.post(
  '/resend-verification',
  rateLimiter({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 3 // 3 resends per 5 minutes
  }),
  emailCheckValidation,
  validateRequest,
  async (req, res, next) => {
    try {
      await registrationController.resendVerification(req, res);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   GET /api/auth/registration/status
 * @desc    Check if registration is enabled
 * @access  Public
 */
router.get(
  '/registration/status',
  checkRateLimit,
  async (req, res, next) => {
    try {
      await registrationController.getRegistrationStatus(req, res);
    } catch (error) {
      next(error);
    }
  }
);

// Admin endpoints (require authentication)
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

/**
 * @route   GET /api/admin/registration/metrics
 * @desc    Get registration metrics
 * @access  Admin
 */
router.get(
  '/admin/registration/metrics',
  authenticate,
  requireRole('admin'),
  async (req, res, next) => {
    try {
      await registrationController.getMetrics(req, res);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   GET /api/admin/registration/alerts
 * @desc    Get registration security alerts
 * @access  Admin
 */
router.get(
  '/admin/registration/alerts',
  authenticate,
  requireRole('admin'),
  async (req, res, next) => {
    try {
      await registrationController.getAlerts(req, res);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   POST /api/admin/registration/emergency-disable
 * @desc    Emergency disable registration
 * @access  Admin
 */
router.post(
  '/admin/registration/emergency-disable',
  authenticate,
  requireRole('admin'),
  body('reason').isString().notEmpty(),
  validateRequest,
  async (req, res, next) => {
    try {
      await registrationController.emergencyDisable(req, res);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   POST /api/admin/registration/block-ip
 * @desc    Block an IP address
 * @access  Admin
 */
router.post(
  '/admin/registration/block-ip',
  authenticate,
  requireRole('admin'),
  body('ipAddress').isIP(),
  body('duration').isInt({ min: 1 }),
  body('reason').isString().notEmpty(),
  validateRequest,
  async (req, res, next) => {
    try {
      await registrationController.blockIP(req, res);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   POST /api/admin/registration/unblock-ip
 * @desc    Unblock an IP address
 * @access  Admin
 */
router.post(
  '/admin/registration/unblock-ip',
  authenticate,
  requireRole('admin'),
  body('ipAddress').isIP(),
  validateRequest,
  async (req, res, next) => {
    try {
      await registrationController.unblockIP(req, res);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   GET /api/admin/registration/blocked-ips
 * @desc    Get list of blocked IPs
 * @access  Admin
 */
router.get(
  '/admin/registration/blocked-ips',
  authenticate,
  requireRole('admin'),
  async (req, res, next) => {
    try {
      await registrationController.getBlockedIPs(req, res);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   POST /api/admin/registration/blacklist-domain
 * @desc    Add domain to blacklist
 * @access  Admin
 */
router.post(
  '/admin/registration/blacklist-domain',
  authenticate,
  requireRole('admin'),
  body('domain').isFQDN(),
  body('reason').isString().notEmpty(),
  validateRequest,
  async (req, res, next) => {
    try {
      await registrationController.blacklistDomain(req, res);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   POST /api/admin/registration/whitelist-domain
 * @desc    Remove domain from blacklist
 * @access  Admin
 */
router.post(
  '/admin/registration/whitelist-domain',
  authenticate,
  requireRole('admin'),
  body('domain').isFQDN(),
  validateRequest,
  async (req, res, next) => {
    try {
      await registrationController.whitelistDomain(req, res);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   GET /api/admin/registration/attempts
 * @desc    Get recent registration attempts
 * @access  Admin
 */
router.get(
  '/admin/registration/attempts',
  authenticate,
  requireRole('admin'),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('offset').optional().isInt({ min: 0 }),
  query('success').optional().isBoolean(),
  validateRequest,
  async (req, res, next) => {
    try {
      await registrationController.getRegistrationAttempts(req, res);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   GET /api/admin/registration/attack-patterns
 * @desc    Get detected attack patterns
 * @access  Admin
 */
router.get(
  '/admin/registration/attack-patterns',
  authenticate,
  requireRole('admin'),
  async (req, res, next) => {
    try {
      await registrationController.getAttackPatterns(req, res);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   POST /api/admin/registration/clear-alerts
 * @desc    Clear/acknowledge alerts
 * @access  Admin
 */
router.post(
  '/admin/registration/clear-alerts',
  authenticate,
  requireRole('admin'),
  body('alertIds').isArray(),
  body('alertIds.*').isUUID(),
  validateRequest,
  async (req, res, next) => {
    try {
      await registrationController.clearAlerts(req, res);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   POST /api/admin/registration/configure
 * @desc    Update registration configuration
 * @access  Admin
 */
router.post(
  '/admin/registration/configure',
  authenticate,
  requireRole('admin'),
  body('enabled').optional().isBoolean(),
  body('rolloutPercentage').optional().isInt({ min: 0, max: 100 }),
  body('maxAttemptsPerIP').optional().isInt({ min: 1, max: 20 }),
  body('maxAttemptsPerEmail').optional().isInt({ min: 1, max: 10 }),
  body('blockDurationMinutes').optional().isInt({ min: 1, max: 1440 }),
  body('requireCaptcha').optional().isBoolean(),
  body('allowedCountries').optional().isArray(),
  body('blockedCountries').optional().isArray(),
  validateRequest,
  async (req, res, next) => {
    try {
      await registrationController.updateConfiguration(req, res);
    } catch (error) {
      next(error);
    }
  }
);

// Set controller
const setController = (controller) => {
  registrationController = controller;
};

module.exports = { router, setController };