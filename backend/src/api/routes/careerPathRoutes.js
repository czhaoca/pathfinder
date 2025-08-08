const express = require('express');
const ErrorHandler = require('../middleware/errorHandler');

function createCareerPathRoutes(container) {
  const router = express.Router();
  const authMiddleware = container.get('authMiddleware');
  const controller = container.get('careerPathController');

  // Auth for all endpoints
  router.use(authMiddleware.authenticate());

  // Career Path Routes
  router.get('/career-paths/search',
    ErrorHandler.asyncWrapper((req, res, next) => controller.searchCareerPaths(req, res, next))
  );

  router.get('/career-paths/:nodeId',
    ErrorHandler.asyncWrapper((req, res, next) => controller.getCareerNode(req, res, next))
  );

  router.get('/career-paths/:nodeId/transitions',
    ErrorHandler.asyncWrapper((req, res, next) => controller.getCareerTransitions(req, res, next))
  );

  router.post('/career-paths/visualize',
    ErrorHandler.asyncWrapper((req, res, next) => controller.visualizeCareerPath(req, res, next))
  );

  // Skills Gap Routes
  router.get('/skills-gap/:currentRole/:targetRole',
    ErrorHandler.asyncWrapper((req, res, next) => controller.analyzeSkillsGap(req, res, next))
  );

  router.get('/skills-gap/user/:userId',
    ErrorHandler.asyncWrapper((req, res, next) => controller.getUserSkillsGap(req, res, next))
  );

  router.post('/skills-gap/assessment',
    ErrorHandler.asyncWrapper((req, res, next) => controller.submitSkillsAssessment(req, res, next))
  );

  // Learning Routes
  router.get('/learning/recommendations/:skillId',
    ErrorHandler.asyncWrapper((req, res, next) => controller.getLearningRecommendations(req, res, next))
  );

  router.get('/learning/user/:userId/plan',
    ErrorHandler.asyncWrapper((req, res, next) => controller.getLearningPlan(req, res, next))
  );

  router.post('/learning/progress',
    ErrorHandler.asyncWrapper((req, res, next) => controller.logLearningProgress(req, res, next))
  );

  // Goal Routes
  router.get('/goals/user/:userId',
    ErrorHandler.asyncWrapper((req, res, next) => controller.getUserGoals(req, res, next))
  );

  router.post('/goals',
    ErrorHandler.asyncWrapper((req, res, next) => controller.createGoal(req, res, next))
  );

  router.put('/goals/:goalId',
    ErrorHandler.asyncWrapper((req, res, next) => controller.updateGoal(req, res, next))
  );

  router.get('/goals/:goalId/milestones',
    ErrorHandler.asyncWrapper((req, res, next) => controller.getGoalMilestones(req, res, next))
  );

  return router;
}

module.exports = createCareerPathRoutes;
