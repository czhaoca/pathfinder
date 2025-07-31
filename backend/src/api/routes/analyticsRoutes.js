const express = require('express');
const ErrorHandler = require('../middleware/errorHandler');

function createAnalyticsRoutes(container) {
  const router = express.Router();
  const analyticsController = container.get('analyticsController');
  const authMiddleware = container.get('authMiddleware');

  // All analytics routes require authentication
  router.use(authMiddleware.authenticate());

  // Skills progression analysis
  router.get('/skills-progression',
    ErrorHandler.asyncWrapper((req, res, next) => 
      analyticsController.getSkillsProgression(req, res, next)
    )
  );

  // Career trajectory visualization
  router.get('/career-trajectory',
    ErrorHandler.asyncWrapper((req, res, next) => 
      analyticsController.getCareerTrajectory(req, res, next)
    )
  );

  // Comprehensive analytics summary
  router.get('/summary',
    ErrorHandler.asyncWrapper((req, res, next) => 
      analyticsController.getAnalyticsSummary(req, res, next)
    )
  );

  // Impact scores for experiences
  router.get('/impact-scores',
    ErrorHandler.asyncWrapper((req, res, next) => 
      analyticsController.getImpactScores(req, res, next)
    )
  );

  // Career insights
  router.get('/insights',
    ErrorHandler.asyncWrapper((req, res, next) => 
      analyticsController.getCareerInsights(req, res, next)
    )
  );

  // Export analytics data
  router.get('/export',
    ErrorHandler.asyncWrapper((req, res, next) => 
      analyticsController.exportAnalytics(req, res, next)
    )
  );

  // Quantify achievements for specific experience
  router.post('/experiences/:experienceId/quantify',
    ErrorHandler.asyncWrapper((req, res, next) => 
      analyticsController.quantifyAchievements(req, res, next)
    )
  );

  // Skill recommendations
  router.post('/skill-recommendations',
    ErrorHandler.asyncWrapper((req, res, next) => 
      analyticsController.getSkillRecommendations(req, res, next)
    )
  );

  return router;
}

module.exports = createAnalyticsRoutes;