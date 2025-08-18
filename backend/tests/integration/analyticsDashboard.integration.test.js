const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');

describe('Analytics Dashboard API Integration Tests', () => {
  let app;
  let server;
  let authToken;
  let mockAnalyticsDashboardService;
  let mockAuditService;
  let mockAnalyticsRepository;
  let mockCacheService;

  beforeAll(() => {
    // Create Express app
    app = express();
    app.use(express.json());

    // Mock JWT secret
    process.env.JWT_SECRET = 'test-secret-key';

    // Create mock services
    mockAnalyticsRepository = {
      getUserMetrics: jest.fn(),
      getEngagementMetrics: jest.fn(),
      getPerformanceMetrics: jest.fn(),
      getFeatureUsage: jest.fn(),
      getNewUsers: jest.fn(),
      getActiveUsersFromCohort: jest.fn(),
      getUsersCompletedStep: jest.fn(),
      getActiveUsers: jest.fn(),
      getActiveSessions: jest.fn(),
      getRecentEvents: jest.fn(),
      getErrorRate: jest.fn(),
      getAllUsers: jest.fn()
    };

    mockCacheService = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(true)
    };

    mockAuditService = {
      logDataAccess: jest.fn().mockResolvedValue(true)
    };

    // Create service instance
    const AnalyticsDashboardService = require('../../src/services/analyticsDashboardService');
    mockAnalyticsDashboardService = new AnalyticsDashboardService(
      mockAnalyticsRepository,
      mockCacheService
    );

    // Create controller instance
    const AnalyticsDashboardController = require('../../src/api/controllers/analyticsDashboardController');
    const controller = new AnalyticsDashboardController(
      mockAnalyticsDashboardService,
      mockAuditService
    );

    // Mock authentication middleware
    const mockAuth = (req, res, next) => {
      const token = req.headers.authorization?.split(' ')[1];
      if (!token) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
      } catch (error) {
        return res.status(401).json({ error: 'Invalid token' });
      }
    };

    // Mock authorization middleware
    const mockAuthorize = (role) => (req, res, next) => {
      if (req.user.role !== role && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Forbidden' });
      }
      next();
    };

    // Setup routes
    app.get('/api/analytics/dashboard/overview', 
      mockAuth, 
      mockAuthorize('admin'), 
      (req, res, next) => controller.getDashboardOverview(req, res, next)
    );

    app.get('/api/analytics/metrics/realtime',
      mockAuth,
      mockAuthorize('admin'),
      (req, res, next) => controller.getRealtimeMetrics(req, res, next)
    );

    app.get('/api/analytics/cohorts/retention',
      mockAuth,
      mockAuthorize('admin'),
      (req, res, next) => controller.getRetentionCohorts(req, res, next)
    );

    app.get('/api/analytics/funnels/:funnelId',
      mockAuth,
      mockAuthorize('admin'),
      (req, res, next) => controller.getFunnelAnalysis(req, res, next)
    );

    app.get('/api/analytics/features/adoption',
      mockAuth,
      mockAuthorize('admin'),
      (req, res, next) => controller.getFeatureAdoption(req, res, next)
    );

    app.get('/api/analytics/users/lifecycle',
      mockAuth,
      mockAuthorize('admin'),
      (req, res, next) => controller.getUserLifecycleStages(req, res, next)
    );

    app.get('/api/analytics/users/metrics',
      mockAuth,
      mockAuthorize('admin'),
      (req, res, next) => controller.getUserMetrics(req, res, next)
    );

    app.get('/api/analytics/engagement/metrics',
      mockAuth,
      mockAuthorize('admin'),
      (req, res, next) => controller.getEngagementMetrics(req, res, next)
    );

    app.get('/api/analytics/performance/metrics',
      mockAuth,
      mockAuthorize('admin'),
      (req, res, next) => controller.getPerformanceMetrics(req, res, next)
    );

    app.post('/api/analytics/reports/generate',
      mockAuth,
      mockAuthorize('admin'),
      (req, res, next) => controller.generateReport(req, res, next)
    );

    app.get('/api/analytics/dashboard/export',
      mockAuth,
      mockAuthorize('admin'),
      (req, res, next) => controller.exportDashboard(req, res, next)
    );

    // Generate auth token
    authToken = jwt.sign(
      { userId: 'test-user-123', role: 'admin' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    server = app.listen(0); // Random port
  });

  afterAll((done) => {
    server.close(done);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/analytics/dashboard/overview', () => {
    it('should return dashboard overview with valid auth', async () => {
      const mockOverview = {
        userMetrics: {
          totalUsers: 100,
          newUsers: 10,
          activeUsers: { daily: 50, weekly: 75, monthly: 90 },
          growth: { rate: 5, trend: 'growing' },
          churn: { rate: 2, count: 2 }
        },
        engagementMetrics: {
          sessions: { total: 500 }
        },
        performanceMetrics: {
          pageLoad: { average: 1500 }
        }
      };

      mockAnalyticsRepository.getUserMetrics.mockResolvedValue({
        totalUsers: 100,
        newUsers: 10,
        dau: 50,
        wau: 75,
        mau: 90,
        churnRate: 2,
        churnedUsers: 2
      });

      mockAnalyticsRepository.getEngagementMetrics.mockResolvedValue({
        totalSessions: 500,
        avgSessionsPerUser: 5,
        avgDuration: 300,
        medianDuration: 250,
        durationDistribution: [],
        totalPageViews: 2000,
        pageViewsPerSession: 4,
        uniquePageViews: 1500,
        topPages: [],
        totalActions: 1000,
        actionsPerUser: 10,
        topActions: [],
        bounceRate: 25,
        bouncedSessions: 125
      });

      mockAnalyticsRepository.getPerformanceMetrics.mockResolvedValue({
        avgPageLoadTime: 1500,
        medianPageLoadTime: 1200,
        p95PageLoadTime: 3000,
        p99PageLoadTime: 5000,
        avgApiLatency: 200,
        medianApiLatency: 150,
        p95ApiLatency: 500,
        p99ApiLatency: 1000,
        totalErrors: 100,
        errorRate: 1.5,
        errorsByType: {},
        topErrors: [],
        uptimePercentage: 99.9,
        incidents: []
      });

      const response = await request(app)
        .get('/api/analytics/dashboard/overview')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ startDate: '2024-01-01', endDate: '2024-01-31' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('userMetrics');
      expect(response.body.data).toHaveProperty('engagementMetrics');
      expect(response.body.data).toHaveProperty('performanceMetrics');
    });

    it('should return 401 without auth token', async () => {
      const response = await request(app)
        .get('/api/analytics/dashboard/overview')
        .query({ startDate: '2024-01-01', endDate: '2024-01-31' });

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('Unauthorized');
    });

    it('should return 403 for non-admin users', async () => {
      const userToken = jwt.sign(
        { userId: 'test-user-456', role: 'user' },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      const response = await request(app)
        .get('/api/analytics/dashboard/overview')
        .set('Authorization', `Bearer ${userToken}`)
        .query({ startDate: '2024-01-01', endDate: '2024-01-31' });

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('Forbidden');
    });

    it('should handle date range validation', async () => {
      const response = await request(app)
        .get('/api/analytics/dashboard/overview')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ startDate: '2024-01-31', endDate: '2024-01-01' });

      expect(response.status).toBe(500);
      expect(response.body.error).toContain('Start date must be before end date');
    });
  });

  describe('GET /api/analytics/metrics/realtime', () => {
    it('should return real-time metrics', async () => {
      mockAnalyticsRepository.getActiveUsers.mockResolvedValue(
        Array(45).fill({ userId: 'user' })
      );
      mockAnalyticsRepository.getActiveSessions.mockResolvedValue(
        Array(78).fill({ sessionId: 'session' })
      );
      mockAnalyticsRepository.getRecentEvents.mockResolvedValue([
        { eventType: 'page_view', pageUrl: '/home' },
        { eventType: 'error', message: 'Test error' }
      ]);
      mockAnalyticsRepository.getErrorRate.mockResolvedValue(0.5);

      const response = await request(app)
        .get('/api/analytics/metrics/realtime')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('activeUsers', 45);
      expect(response.body.data).toHaveProperty('activeSessions', 78);
      expect(response.body.data).toHaveProperty('errorRate', 0.5);
    });
  });

  describe('GET /api/analytics/cohorts/retention', () => {
    it('should return retention cohorts', async () => {
      mockAnalyticsRepository.getNewUsers.mockResolvedValue([
        { userId: '1' },
        { userId: '2' }
      ]);
      mockAnalyticsRepository.getActiveUsersFromCohort.mockResolvedValue([
        { userId: '1' }
      ]);

      const response = await request(app)
        .get('/api/analytics/cohorts/retention')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          cohortType: 'weekly',
          startDate: '2024-01-01',
          endDate: '2024-01-07'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('cohortType', 'weekly');
      expect(response.body.data).toHaveProperty('cohorts');
      expect(response.body.data).toHaveProperty('summary');
    });

    it('should validate cohort type', async () => {
      const response = await request(app)
        .get('/api/analytics/cohorts/retention')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          cohortType: 'invalid',
          startDate: '2024-01-01',
          endDate: '2024-01-07'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid cohort type');
    });
  });

  describe('GET /api/analytics/funnels/:funnelId', () => {
    it('should return funnel analysis', async () => {
      mockAnalyticsRepository.getUsersCompletedStep
        .mockResolvedValueOnce(Array(100).fill({ userId: 'user' }))
        .mockResolvedValueOnce(Array(75).fill({ userId: 'user' }))
        .mockResolvedValueOnce(Array(50).fill({ userId: 'user' }));

      const response = await request(app)
        .get('/api/analytics/funnels/onboarding')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          startDate: '2024-01-01',
          endDate: '2024-01-31',
          segment: 'new_users'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('funnelId', 'onboarding');
      expect(response.body.data).toHaveProperty('steps');
      expect(response.body.data).toHaveProperty('overallConversion');
    });

    it('should handle unknown funnel ID', async () => {
      mockAnalyticsRepository.getUsersCompletedStep.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/analytics/funnels/unknown')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          startDate: '2024-01-01',
          endDate: '2024-01-31'
        });

      expect(response.status).toBe(200);
      expect(response.body.data.name).toBe('Custom Funnel');
    });
  });

  describe('POST /api/analytics/reports/generate', () => {
    it('should generate JSON report', async () => {
      mockAnalyticsRepository.getUserMetrics.mockResolvedValue({
        totalUsers: 100,
        newUsers: 10,
        dau: 50,
        wau: 75,
        mau: 90,
        churnRate: 5,
        churnedUsers: 5
      });

      const response = await request(app)
        .post('/api/analytics/reports/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'comprehensive',
          format: 'json',
          metrics: ['users'],
          startDate: '2024-01-01',
          endDate: '2024-01-31'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('users');
    });

    it('should generate CSV report with proper headers', async () => {
      mockAnalyticsRepository.getUserMetrics.mockResolvedValue({
        totalUsers: 100,
        newUsers: 10,
        dau: 50,
        wau: 75,
        mau: 90,
        churnRate: 5,
        churnedUsers: 5
      });

      const response = await request(app)
        .post('/api/analytics/reports/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          format: 'csv',
          metrics: ['users'],
          startDate: '2024-01-01',
          endDate: '2024-01-31'
        });

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('text/csv');
      expect(response.headers['content-disposition']).toContain('attachment');
      expect(response.text).toContain('Metric,Value,Date');
    });

    it('should validate metrics array', async () => {
      const response = await request(app)
        .post('/api/analytics/reports/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          metrics: ['invalid_metric'],
          startDate: '2024-01-01',
          endDate: '2024-01-31'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid metrics');
    });
  });

  describe('GET /api/analytics/dashboard/export', () => {
    it('should export dashboard as JSON', async () => {
      mockAnalyticsRepository.getUserMetrics.mockResolvedValue({
        totalUsers: 100,
        newUsers: 10,
        dau: 50,
        wau: 75,
        mau: 90,
        churnRate: 5,
        churnedUsers: 5
      });

      mockAnalyticsRepository.getEngagementMetrics.mockResolvedValue({
        totalSessions: 500,
        avgSessionsPerUser: 5,
        avgDuration: 300,
        medianDuration: 250,
        durationDistribution: [],
        totalPageViews: 2000,
        pageViewsPerSession: 4,
        uniquePageViews: 1500,
        topPages: [],
        totalActions: 1000,
        actionsPerUser: 10,
        topActions: [],
        bounceRate: 25,
        bouncedSessions: 125
      });

      mockAnalyticsRepository.getPerformanceMetrics.mockResolvedValue({
        avgPageLoadTime: 1500,
        medianPageLoadTime: 1200,
        p95PageLoadTime: 3000,
        p99PageLoadTime: 5000,
        avgApiLatency: 200,
        medianApiLatency: 150,
        p95ApiLatency: 500,
        p99ApiLatency: 1000,
        totalErrors: 100,
        errorRate: 1.5,
        errorsByType: {},
        topErrors: [],
        uptimePercentage: 99.9,
        incidents: []
      });

      const response = await request(app)
        .get('/api/analytics/dashboard/export')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          format: 'json',
          startDate: '2024-01-01',
          endDate: '2024-01-31'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('userMetrics');
    });

    it('should export dashboard as CSV', async () => {
      mockAnalyticsRepository.getUserMetrics.mockResolvedValue({
        totalUsers: 100,
        newUsers: 10,
        dau: 50,
        wau: 75,
        mau: 90,
        churnRate: 5,
        churnedUsers: 5
      });

      mockAnalyticsRepository.getEngagementMetrics.mockResolvedValue({
        totalSessions: 500,
        avgSessionsPerUser: 5,
        avgDuration: 300,
        medianDuration: 250,
        durationDistribution: [],
        totalPageViews: 2000,
        pageViewsPerSession: 4,
        uniquePageViews: 1500,
        topPages: [],
        totalActions: 1000,
        actionsPerUser: 10,
        topActions: [],
        bounceRate: 25,
        bouncedSessions: 125
      });

      mockAnalyticsRepository.getPerformanceMetrics.mockResolvedValue({
        avgPageLoadTime: 1500,
        medianPageLoadTime: 1200,
        p95PageLoadTime: 3000,
        p99PageLoadTime: 5000,
        avgApiLatency: 200,
        medianApiLatency: 150,
        p95ApiLatency: 500,
        p99ApiLatency: 1000,
        totalErrors: 100,
        errorRate: 1.5,
        errorsByType: {},
        topErrors: [],
        uptimePercentage: 99.9,
        incidents: []
      });

      const response = await request(app)
        .get('/api/analytics/dashboard/export')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          format: 'csv',
          startDate: '2024-01-01',
          endDate: '2024-01-31'
        });

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('text/csv');
      expect(response.text).toContain('Category,Metric,Value');
    });
  });

  describe('Performance and Load Testing', () => {
    it('should handle concurrent requests efficiently', async () => {
      mockAnalyticsRepository.getUserMetrics.mockResolvedValue({
        totalUsers: 100,
        newUsers: 10,
        dau: 50,
        wau: 75,
        mau: 90,
        churnRate: 5,
        churnedUsers: 5
      });

      mockAnalyticsRepository.getEngagementMetrics.mockResolvedValue({
        totalSessions: 500,
        avgSessionsPerUser: 5,
        avgDuration: 300,
        medianDuration: 250,
        durationDistribution: [],
        totalPageViews: 2000,
        pageViewsPerSession: 4,
        uniquePageViews: 1500,
        topPages: [],
        totalActions: 1000,
        actionsPerUser: 10,
        topActions: [],
        bounceRate: 25,
        bouncedSessions: 125
      });

      mockAnalyticsRepository.getPerformanceMetrics.mockResolvedValue({
        avgPageLoadTime: 1500,
        medianPageLoadTime: 1200,
        p95PageLoadTime: 3000,
        p99PageLoadTime: 5000,
        avgApiLatency: 200,
        medianApiLatency: 150,
        p95ApiLatency: 500,
        p99ApiLatency: 1000,
        totalErrors: 100,
        errorRate: 1.5,
        errorsByType: {},
        topErrors: [],
        uptimePercentage: 99.9,
        incidents: []
      });

      const promises = Array(10).fill(null).map(() =>
        request(app)
          .get('/api/analytics/dashboard/overview')
          .set('Authorization', `Bearer ${authToken}`)
          .query({ startDate: '2024-01-01', endDate: '2024-01-31' })
      );

      const responses = await Promise.all(promises);

      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });
    });

    it('should respect cache for repeated requests', async () => {
      mockAnalyticsRepository.getUserMetrics.mockResolvedValue({
        totalUsers: 100,
        newUsers: 10,
        dau: 50,
        wau: 75,
        mau: 90,
        churnRate: 5,
        churnedUsers: 5
      });

      // First request - should hit repository
      await request(app)
        .get('/api/analytics/dashboard/overview')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ startDate: '2024-01-01', endDate: '2024-01-31' });

      // Mock cache to return data
      mockCacheService.get.mockResolvedValue({
        userMetrics: { totalUsers: 100 }
      });

      // Second request - should use cache
      await request(app)
        .get('/api/analytics/dashboard/overview')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ startDate: '2024-01-01', endDate: '2024-01-31' });

      // Repository should only be called once (first request)
      expect(mockAnalyticsRepository.getUserMetrics).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('should handle repository failures gracefully', async () => {
      mockAnalyticsRepository.getUserMetrics.mockRejectedValue(
        new Error('Database connection failed')
      );

      const response = await request(app)
        .get('/api/analytics/dashboard/overview')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ startDate: '2024-01-01', endDate: '2024-01-31' });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Database connection failed');
    });

    it('should continue working if audit logging fails', async () => {
      mockAuditService.logDataAccess.mockRejectedValue(
        new Error('Audit service unavailable')
      );

      mockAnalyticsRepository.getUserMetrics.mockResolvedValue({
        totalUsers: 100,
        newUsers: 10,
        dau: 50,
        wau: 75,
        mau: 90,
        churnRate: 5,
        churnedUsers: 5
      });

      mockAnalyticsRepository.getEngagementMetrics.mockResolvedValue({
        totalSessions: 500,
        avgSessionsPerUser: 5,
        avgDuration: 300,
        medianDuration: 250,
        durationDistribution: [],
        totalPageViews: 2000,
        pageViewsPerSession: 4,
        uniquePageViews: 1500,
        topPages: [],
        totalActions: 1000,
        actionsPerUser: 10,
        topActions: [],
        bounceRate: 25,
        bouncedSessions: 125
      });

      mockAnalyticsRepository.getPerformanceMetrics.mockResolvedValue({
        avgPageLoadTime: 1500,
        medianPageLoadTime: 1200,
        p95PageLoadTime: 3000,
        p99PageLoadTime: 5000,
        avgApiLatency: 200,
        medianApiLatency: 150,
        p95ApiLatency: 500,
        p99ApiLatency: 1000,
        totalErrors: 100,
        errorRate: 1.5,
        errorsByType: {},
        topErrors: [],
        uptimePercentage: 99.9,
        incidents: []
      });

      const response = await request(app)
        .get('/api/analytics/dashboard/overview')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ startDate: '2024-01-01', endDate: '2024-01-31' });

      // Should still return data despite audit failure
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should handle malformed request data', async () => {
      const response = await request(app)
        .post('/api/analytics/reports/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send('malformed-json-data');

      expect(response.status).toBe(400);
    });
  });
});