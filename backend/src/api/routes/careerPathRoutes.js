const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const { body, param, query } = require('express-validator');

// Career Path Routes
router.get('/career-paths/search',
  authenticateToken,
  [
    query('query').optional().isString().trim(),
    query('industry').optional().isString().trim(),
    query('level').optional().isIn(['entry', 'mid', 'senior', 'executive']),
    query('limit').optional().isInt({ min: 1, max: 100 })
  ],
  validate,
  (req, res, next) => {
    const controller = req.app.locals.container.careerPathController;
    controller.searchCareerPaths(req, res, next);
  }
);

router.get('/career-paths/:nodeId',
  authenticateToken,
  [
    param('nodeId').notEmpty().isString()
  ],
  validate,
  (req, res, next) => {
    const controller = req.app.locals.container.careerPathController;
    controller.getCareerNode(req, res, next);
  }
);

router.get('/career-paths/:nodeId/transitions',
  authenticateToken,
  [
    param('nodeId').notEmpty().isString()
  ],
  validate,
  (req, res, next) => {
    const controller = req.app.locals.container.careerPathController;
    controller.getCareerTransitions(req, res, next);
  }
);

router.post('/career-paths/visualize',
  authenticateToken,
  [
    body('targetNodeId').notEmpty().isString(),
    body('currentNodeId').optional().isString()
  ],
  validate,
  (req, res, next) => {
    const controller = req.app.locals.container.careerPathController;
    controller.visualizeCareerPath(req, res, next);
  }
);

// Skills Gap Routes
router.get('/skills-gap/:currentRole/:targetRole',
  authenticateToken,
  [
    param('currentRole').notEmpty().isString(),
    param('targetRole').notEmpty().isString()
  ],
  validate,
  (req, res, next) => {
    const controller = req.app.locals.container.careerPathController;
    controller.analyzeSkillsGap(req, res, next);
  }
);

router.get('/skills-gap/user/:userId',
  authenticateToken,
  (req, res, next) => {
    const controller = req.app.locals.container.careerPathController;
    controller.getUserSkillsGap(req, res, next);
  }
);

router.post('/skills-gap/assessment',
  authenticateToken,
  [
    body('goalId').notEmpty().isString(),
    body('skills').isArray(),
    body('skills.*.skill_id').notEmpty().isString(),
    body('skills.*.current_level').isInt({ min: 1, max: 5 }),
    body('skills.*.target_level').optional().isInt({ min: 1, max: 5 })
  ],
  validate,
  (req, res, next) => {
    const controller = req.app.locals.container.careerPathController;
    controller.submitSkillsAssessment(req, res, next);
  }
);

// Learning Routes
router.get('/learning/recommendations/:skillId',
  authenticateToken,
  [
    param('skillId').notEmpty().isString(),
    query('maxCost').optional().isFloat({ min: 0 }),
    query('difficultyLevel').optional().isIn(['beginner', 'intermediate', 'advanced']),
    query('resourceType').optional().isIn(['course', 'book', 'tutorial', 'certification', 'workshop', 'webinar']),
    query('freeOnly').optional().isBoolean()
  ],
  validate,
  (req, res, next) => {
    const controller = req.app.locals.container.careerPathController;
    controller.getLearningRecommendations(req, res, next);
  }
);

router.get('/learning/user/:userId/plan',
  authenticateToken,
  (req, res, next) => {
    const controller = req.app.locals.container.careerPathController;
    controller.getLearningPlan(req, res, next);
  }
);

router.post('/learning/progress',
  authenticateToken,
  [
    body('resourceId').optional().isString(),
    body('skillId').notEmpty().isString(),
    body('activityType').notEmpty().isIn(['started', 'progress', 'completed', 'certified']),
    body('hoursSpent').optional().isFloat({ min: 0 }),
    body('progressPercentage').optional().isInt({ min: 0, max: 100 }),
    body('notes').optional().isString()
  ],
  validate,
  (req, res, next) => {
    const controller = req.app.locals.container.careerPathController;
    controller.logLearningProgress(req, res, next);
  }
);

// Goal Routes
router.get('/goals/user/:userId',
  authenticateToken,
  (req, res, next) => {
    const controller = req.app.locals.container.careerPathController;
    controller.getUserGoals(req, res, next);
  }
);

router.post('/goals',
  authenticateToken,
  [
    body('currentNodeId').notEmpty().isString(),
    body('targetNodeId').notEmpty().isString(),
    body('targetDate').notEmpty().isISO8601(),
    body('notes').optional().isString()
  ],
  validate,
  (req, res, next) => {
    const controller = req.app.locals.container.careerPathController;
    controller.createGoal(req, res, next);
  }
);

router.put('/goals/:goalId',
  authenticateToken,
  [
    param('goalId').notEmpty().isString(),
    body('status').optional().isIn(['active', 'achieved', 'abandoned', 'paused']),
    body('notes').optional().isString()
  ],
  validate,
  (req, res, next) => {
    const controller = req.app.locals.container.careerPathController;
    controller.updateGoal(req, res, next);
  }
);

router.get('/goals/:goalId/milestones',
  authenticateToken,
  [
    param('goalId').notEmpty().isString()
  ],
  validate,
  (req, res, next) => {
    const controller = req.app.locals.container.careerPathController;
    controller.getGoalMilestones(req, res, next);
  }
);

module.exports = router;