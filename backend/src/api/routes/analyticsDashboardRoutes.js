const express = require('express');
const ErrorHandler = require('../middleware/errorHandler');

function createAnalyticsDashboardRoutes(container) {
  const router = express.Router();
  const analyticsDashboardController = container.get('analyticsDashboardController');
  const authMiddleware = container.get('authMiddleware');

  // All dashboard routes require authentication and admin role
  router.use(authMiddleware.authenticate());
  router.use(authMiddleware.authorize('admin'));

  // Dashboard overview
  router.get('/overview',
    ErrorHandler.asyncWrapper((req, res, next) => 
      analyticsDashboardController.getDashboardOverview(req, res, next)
    )
  );

  // Real-time metrics
  router.get('/realtime',
    ErrorHandler.asyncWrapper((req, res, next) => 
      analyticsDashboardController.getRealtimeMetrics(req, res, next)
    )
  );

  // User metrics
  router.get('/metrics/users',
    ErrorHandler.asyncWrapper((req, res, next) => 
      analyticsDashboardController.getUserMetrics(req, res, next)
    )
  );

  // Engagement metrics
  router.get('/metrics/engagement',
    ErrorHandler.asyncWrapper((req, res, next) => 
      analyticsDashboardController.getEngagementMetrics(req, res, next)
    )
  );

  // Performance metrics
  router.get('/metrics/performance',
    ErrorHandler.asyncWrapper((req, res, next) => 
      analyticsDashboardController.getPerformanceMetrics(req, res, next)
    )
  );

  // Retention cohorts
  router.get('/cohorts/retention',
    ErrorHandler.asyncWrapper((req, res, next) => 
      analyticsDashboardController.getRetentionCohorts(req, res, next)
    )
  );

  // Funnel analysis
  router.get('/funnels/:funnelId',
    ErrorHandler.asyncWrapper((req, res, next) => 
      analyticsDashboardController.getFunnelAnalysis(req, res, next)
    )
  );

  // Feature adoption
  router.get('/features/adoption',
    ErrorHandler.asyncWrapper((req, res, next) => 
      analyticsDashboardController.getFeatureAdoption(req, res, next)
    )
  );

  // User lifecycle stages
  router.get('/lifecycle/stages',
    ErrorHandler.asyncWrapper((req, res, next) => 
      analyticsDashboardController.getUserLifecycleStages(req, res, next)
    )
  );

  // Generate report
  router.post('/reports/generate',
    ErrorHandler.asyncWrapper((req, res, next) => 
      analyticsDashboardController.generateReport(req, res, next)
    )
  );

  // Export dashboard
  router.get('/export',
    ErrorHandler.asyncWrapper((req, res, next) => 
      analyticsDashboardController.exportDashboard(req, res, next)
    )
  );

  return router;
}

module.exports = createAnalyticsDashboardRoutes;