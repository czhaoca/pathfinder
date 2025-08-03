const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const { body, param, query } = require('express-validator');

// Contact Management Routes
router.get('/contacts',
  authenticateToken,
  [
    query('search').optional().isString().trim(),
    query('relationshipType').optional().isIn(['mentor', 'peer', 'report', 'recruiter', 'friend']),
    query('minStrength').optional().isInt({ min: 1, max: 5 }),
    query('company').optional().isString().trim(),
    query('sortBy').optional().isIn(['first_name', 'last_name', 'company', 'last_interaction', 'relationship_strength']),
    query('sortOrder').optional().isIn(['ASC', 'DESC']),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('offset').optional().isInt({ min: 0 })
  ],
  validate,
  (req, res, next) => {
    const controller = req.app.locals.container.networkingController;
    controller.listContacts(req, res, next);
  }
);

router.get('/contacts/search',
  authenticateToken,
  [
    query('q').notEmpty().isString().trim()
  ],
  validate,
  (req, res, next) => {
    const controller = req.app.locals.container.networkingController;
    controller.searchContacts(req, res, next);
  }
);

router.get('/contacts/analytics',
  authenticateToken,
  (req, res, next) => {
    const controller = req.app.locals.container.networkingController;
    controller.getContactAnalytics(req, res, next);
  }
);

router.get('/contacts/:contactId',
  authenticateToken,
  [
    param('contactId').notEmpty().isString()
  ],
  validate,
  (req, res, next) => {
    const controller = req.app.locals.container.networkingController;
    controller.getContact(req, res, next);
  }
);

router.post('/contacts',
  authenticateToken,
  [
    body('firstName').notEmpty().isString().trim(),
    body('lastName').notEmpty().isString().trim(),
    body('preferredName').optional().isString().trim(),
    body('email').optional().isEmail(),
    body('phone').optional().isString().trim(),
    body('linkedinUrl').optional().isURL(),
    body('currentTitle').optional().isString().trim(),
    body('currentCompany').optional().isString().trim(),
    body('location').optional().isString().trim(),
    body('bio').optional().isString(),
    body('contactSource').optional().isIn(['manual', 'linkedin', 'event', 'referral']),
    body('relationshipType').optional().isIn(['mentor', 'peer', 'report', 'recruiter', 'friend']),
    body('relationshipStrength').optional().isInt({ min: 1, max: 5 }),
    body('personalInterests').optional().isArray(),
    body('professionalContext').optional().isObject(),
    body('tags').optional().isArray()
  ],
  validate,
  (req, res, next) => {
    const controller = req.app.locals.container.networkingController;
    controller.createContact(req, res, next);
  }
);

router.put('/contacts/:contactId',
  authenticateToken,
  [
    param('contactId').notEmpty().isString(),
    body('firstName').optional().isString().trim(),
    body('lastName').optional().isString().trim(),
    body('preferredName').optional().isString().trim(),
    body('email').optional().isEmail(),
    body('phone').optional().isString().trim(),
    body('linkedinUrl').optional().isURL(),
    body('currentTitle').optional().isString().trim(),
    body('currentCompany').optional().isString().trim(),
    body('location').optional().isString().trim(),
    body('bio').optional().isString(),
    body('contactSource').optional().isIn(['manual', 'linkedin', 'event', 'referral']),
    body('relationshipType').optional().isIn(['mentor', 'peer', 'report', 'recruiter', 'friend']),
    body('relationshipStrength').optional().isInt({ min: 1, max: 5 }),
    body('personalInterests').optional().isArray(),
    body('professionalContext').optional().isObject(),
    body('tags').optional().isArray()
  ],
  validate,
  (req, res, next) => {
    const controller = req.app.locals.container.networkingController;
    controller.updateContact(req, res, next);
  }
);

router.delete('/contacts/:contactId',
  authenticateToken,
  [
    param('contactId').notEmpty().isString()
  ],
  validate,
  (req, res, next) => {
    const controller = req.app.locals.container.networkingController;
    controller.deleteContact(req, res, next);
  }
);

router.post('/contacts/:contactId/tags',
  authenticateToken,
  [
    param('contactId').notEmpty().isString(),
    body('tags').isArray().notEmpty()
  ],
  validate,
  (req, res, next) => {
    const controller = req.app.locals.container.networkingController;
    controller.addContactTags(req, res, next);
  }
);

// Interaction Routes
router.get('/interactions',
  authenticateToken,
  [
    query('contactId').optional().isString(),
    query('interactionType').optional().isIn(['meeting', 'email', 'call', 'message', 'event']),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('sentiment').optional().isIn(['positive', 'neutral', 'negative']),
    query('followUpRequired').optional().isBoolean(),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('offset').optional().isInt({ min: 0 })
  ],
  validate,
  (req, res, next) => {
    const controller = req.app.locals.container.networkingController;
    controller.listInteractions(req, res, next);
  }
);

router.post('/interactions',
  authenticateToken,
  [
    body('contactId').notEmpty().isString(),
    body('interactionType').notEmpty().isIn(['meeting', 'email', 'call', 'message', 'event']),
    body('interactionDate').optional().isISO8601(),
    body('subject').notEmpty().isString(),
    body('notes').optional().isString(),
    body('location').optional().isString(),
    body('durationMinutes').optional().isInt({ min: 0 }),
    body('sentiment').optional().isIn(['positive', 'neutral', 'negative']),
    body('followUpRequired').optional().isBoolean(),
    body('followUpDate').optional().isISO8601(),
    body('followUpNotes').optional().isString(),
    body('valueExchanged').optional().isObject(),
    body('meetingNotes').optional().isObject()
  ],
  validate,
  (req, res, next) => {
    const controller = req.app.locals.container.networkingController;
    controller.logInteraction(req, res, next);
  }
);

router.get('/interactions/:interactionId',
  authenticateToken,
  [
    param('interactionId').notEmpty().isString()
  ],
  validate,
  (req, res, next) => {
    const controller = req.app.locals.container.networkingController;
    controller.getInteraction(req, res, next);
  }
);

router.put('/interactions/:interactionId',
  authenticateToken,
  [
    param('interactionId').notEmpty().isString(),
    body('subject').optional().isString(),
    body('notes').optional().isString(),
    body('location').optional().isString(),
    body('durationMinutes').optional().isInt({ min: 0 }),
    body('sentiment').optional().isIn(['positive', 'neutral', 'negative']),
    body('followUpRequired').optional().isBoolean(),
    body('valueExchanged').optional().isObject(),
    body('meetingNotes').optional().isObject()
  ],
  validate,
  (req, res, next) => {
    const controller = req.app.locals.container.networkingController;
    controller.updateInteraction(req, res, next);
  }
);

// Meeting Notes Routes
router.post('/meetings',
  authenticateToken,
  [
    body('interactionId').notEmpty().isString(),
    body('meetingPurpose').optional().isString(),
    body('keyTopics').optional().isArray(),
    body('actionItems').optional().isArray(),
    body('decisionsMade').optional().isArray(),
    body('nextSteps').optional().isString(),
    body('personalNotes').optional().isString(),
    body('professionalInsights').optional().isString()
  ],
  validate,
  (req, res, next) => {
    const controller = req.app.locals.container.networkingController;
    controller.createMeetingNotes(req, res, next);
  }
);

router.put('/meetings/:meetingId',
  authenticateToken,
  [
    param('meetingId').notEmpty().isString(),
    body('meetingPurpose').optional().isString(),
    body('keyTopics').optional().isArray(),
    body('actionItems').optional().isArray(),
    body('decisionsMade').optional().isArray(),
    body('nextSteps').optional().isString(),
    body('personalNotes').optional().isString(),
    body('professionalInsights').optional().isString()
  ],
  validate,
  (req, res, next) => {
    const controller = req.app.locals.container.networkingController;
    controller.updateMeetingNotes(req, res, next);
  }
);

router.get('/meetings/insights',
  authenticateToken,
  [
    query('timeframe').optional().isInt({ min: 1, max: 365 })
  ],
  validate,
  (req, res, next) => {
    const controller = req.app.locals.container.networkingController;
    controller.getMeetingInsights(req, res, next);
  }
);

// Reminder Routes
router.get('/reminders',
  authenticateToken,
  [
    query('status').optional().isIn(['pending', 'sent', 'completed', 'snoozed', 'cancelled']),
    query('contactId').optional().isString(),
    query('reminderType').optional().isIn(['follow_up', 'birthday', 'milestone', 'check_in']),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('includeCompleted').optional().isBoolean(),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('offset').optional().isInt({ min: 0 })
  ],
  validate,
  (req, res, next) => {
    const controller = req.app.locals.container.networkingController;
    controller.listReminders(req, res, next);
  }
);

router.post('/reminders',
  authenticateToken,
  [
    body('contactId').notEmpty().isString(),
    body('reminderType').optional().isIn(['follow_up', 'birthday', 'milestone', 'check_in']),
    body('reminderDate').notEmpty().isISO8601(),
    body('reminderTime').optional().matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
    body('subject').notEmpty().isString(),
    body('notes').optional().isString(),
    body('isRecurring').optional().isBoolean(),
    body('recurrencePattern').optional().isIn(['weekly', 'monthly', 'quarterly', 'yearly'])
  ],
  validate,
  (req, res, next) => {
    const controller = req.app.locals.container.networkingController;
    controller.createReminder(req, res, next);
  }
);

router.put('/reminders/:reminderId',
  authenticateToken,
  [
    param('reminderId').notEmpty().isString(),
    body('reminderDate').optional().isISO8601(),
    body('reminderTime').optional().matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
    body('subject').optional().isString(),
    body('notes').optional().isString(),
    body('status').optional().isIn(['pending', 'sent', 'completed', 'snoozed', 'cancelled']),
    body('isRecurring').optional().isBoolean(),
    body('recurrencePattern').optional().isIn(['weekly', 'monthly', 'quarterly', 'yearly'])
  ],
  validate,
  (req, res, next) => {
    const controller = req.app.locals.container.networkingController;
    controller.updateReminder(req, res, next);
  }
);

router.post('/reminders/:reminderId/complete',
  authenticateToken,
  [
    param('reminderId').notEmpty().isString()
  ],
  validate,
  (req, res, next) => {
    const controller = req.app.locals.container.networkingController;
    controller.completeReminder(req, res, next);
  }
);

router.get('/reminders/upcoming',
  authenticateToken,
  [
    query('days').optional().isInt({ min: 1, max: 90 })
  ],
  validate,
  (req, res, next) => {
    const controller = req.app.locals.container.networkingController;
    controller.getUpcomingReminders(req, res, next);
  }
);

// Networking Recommendations Routes
router.get('/networking/recommendations',
  authenticateToken,
  (req, res, next) => {
    const controller = req.app.locals.container.networkingController;
    controller.getRecommendations(req, res, next);
  }
);

router.post('/networking/recommendations/:recommendationId/dismiss',
  authenticateToken,
  [
    param('recommendationId').notEmpty().isString()
  ],
  validate,
  (req, res, next) => {
    const controller = req.app.locals.container.networkingController;
    controller.dismissRecommendation(req, res, next);
  }
);

router.get('/networking/insights',
  authenticateToken,
  (req, res, next) => {
    const controller = req.app.locals.container.networkingController;
    controller.getNetworkingInsights(req, res, next);
  }
);

module.exports = router;