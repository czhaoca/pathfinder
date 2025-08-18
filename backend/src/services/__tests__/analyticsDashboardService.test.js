const AnalyticsDashboardService = require('../analyticsDashboardService');
const logger = require('../../utils/logger');

// Mock dependencies
jest.mock('../../utils/logger');

describe('AnalyticsDashboardService', () => {
  let service;
  let mockAnalyticsRepository;
  let mockCacheService;

  beforeEach(() => {
    // Mock repository
    mockAnalyticsRepository = {
      getUserMetrics: jest.fn(),
      getEngagementMetrics: jest.fn(),
      getPerformanceMetrics: jest.fn(),
      getActiveUsers: jest.fn(),
      getActiveSessions: jest.fn(),
      getRecentEvents: jest.fn(),
      getErrorRate: jest.fn(),
      getNewUsers: jest.fn(),
      getActiveUsersFromCohort: jest.fn(),
      getUsersCompletedStep: jest.fn(),
      saveSkillsProgression: jest.fn(),
      saveImpactScores: jest.fn(),
      saveAnalyticsSummary: jest.fn()
    };

    // Mock cache service
    mockCacheService = {
      get: jest.fn(),
      set: jest.fn(),
      invalidate: jest.fn()
    };

    service = new AnalyticsDashboardService(
      mockAnalyticsRepository,
      mockCacheService
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getDashboardOverview', () => {
    it('should return cached data if available', async () => {
      const cachedData = {
        userMetrics: { totalUsers: 100 },
        engagementMetrics: { sessions: { total: 500 } }
      };
      mockCacheService.get.mockResolvedValue(cachedData);

      const result = await service.getDashboardOverview(
        new Date('2024-01-01'),
        new Date('2024-01-31')
      );

      expect(result).toEqual(cachedData);
      expect(mockCacheService.get).toHaveBeenCalledWith(
        'dashboard:overview:2024-01-01T00:00:00.000Z:2024-01-31T00:00:00.000Z'
      );
      expect(mockAnalyticsRepository.getUserMetrics).not.toHaveBeenCalled();
    });

    it('should fetch and cache data if not cached', async () => {
      mockCacheService.get.mockResolvedValue(null);
      
      const userMetrics = {
        totalUsers: 100,
        newUsers: 20,
        dau: 50,
        wau: 80,
        mau: 95,
        churnRate: 5,
        churnedUsers: 5
      };
      
      const engagementMetrics = {
        totalSessions: 500,
        avgSessionsPerUser: 5,
        avgDuration: 300,
        medianDuration: 250,
        durationDistribution: [],
        totalPageViews: 2000,
        pageViewsPerSession: 4,
        uniquePageViews: 150,
        topPages: [],
        totalActions: 1000,
        actionsPerUser: 10,
        topActions: [],
        bounceRate: 25,
        bouncedSessions: 125
      };

      mockAnalyticsRepository.getUserMetrics.mockResolvedValue(userMetrics);
      mockAnalyticsRepository.getEngagementMetrics.mockResolvedValue(engagementMetrics);
      mockAnalyticsRepository.getPerformanceMetrics.mockResolvedValue({
        avgPageLoadTime: 1500,
        medianPageLoadTime: 1200,
        p95PageLoadTime: 3000,
        p99PageLoadTime: 5000,
        avgApiLatency: 200,
        medianApiLatency: 150,
        p95ApiLatency: 500,
        p99ApiLatency: 1000,
        totalErrors: 50,
        errorRate: 2.5,
        errorsByType: {},
        topErrors: [],
        uptimePercentage: 99.9,
        incidents: 0
      });

      jest.spyOn(service, 'getTopFeatures').mockResolvedValue([]);
      jest.spyOn(service, 'getRecentErrors').mockResolvedValue([]);

      const result = await service.getDashboardOverview(
        new Date('2024-01-01'),
        new Date('2024-01-31')
      );

      expect(result).toHaveProperty('userMetrics');
      expect(result).toHaveProperty('engagementMetrics');
      expect(result).toHaveProperty('performanceMetrics');
      expect(result).toHaveProperty('generatedAt');
      expect(mockCacheService.set).toHaveBeenCalled();
    });
  });

  describe('getRealtimeMetrics', () => {
    it('should return real-time metrics', async () => {
      const now = new Date();
      const fiveMinutesAgo = new Date(now - 5 * 60 * 1000);

      mockAnalyticsRepository.getActiveUsers.mockResolvedValue([
        { userId: 'user1' },
        { userId: 'user2' }
      ]);
      mockAnalyticsRepository.getActiveSessions.mockResolvedValue([
        { sessionId: 'session1' },
        { sessionId: 'session2' },
        { sessionId: 'session3' }
      ]);
      mockAnalyticsRepository.getRecentEvents.mockResolvedValue([
        { eventType: 'page_view', pageUrl: '/home' },
        { eventType: 'page_view', pageUrl: '/profile' },
        { eventType: 'error', message: 'Test error' }
      ]);
      mockAnalyticsRepository.getErrorRate.mockResolvedValue(2.5);

      jest.spyOn(service, 'extractTopPages').mockReturnValue([
        { url: '/home', views: 5 },
        { url: '/profile', views: 3 }
      ]);
      jest.spyOn(service, 'extractRecentErrors').mockReturnValue([
        { message: 'Test error', timestamp: now }
      ]);

      const result = await service.getRealtimeMetrics();

      expect(result).toHaveProperty('timestamp');
      expect(result.activeUsers).toBe(2);
      expect(result.activeSessions).toBe(3);
      expect(result.eventsPerSecond).toBeCloseTo(0.01, 2);
      expect(result.errorRate).toBe(2.5);
      expect(result.topPages).toHaveLength(2);
      expect(result.recentErrors).toHaveLength(1);
    });
  });

  describe('getRetentionCohorts', () => {
    it('should calculate daily retention cohorts', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-07');

      mockAnalyticsRepository.getNewUsers.mockResolvedValue([
        { userId: 'user1' },
        { userId: 'user2' }
      ]);

      mockAnalyticsRepository.getActiveUsersFromCohort.mockImplementation((userIds, date) => {
        // Mock decreasing retention
        const daysSinceStart = Math.floor((date - startDate) / (1000 * 60 * 60 * 24));
        if (daysSinceStart === 0) return userIds.map(id => ({ userId: id }));
        if (daysSinceStart === 1) return [{ userId: userIds[0] }];
        return [];
      });

      const result = await service.getRetentionCohorts('daily', startDate, endDate);

      expect(result).toHaveProperty('cohortType', 'daily');
      expect(result).toHaveProperty('cohorts');
      expect(result.cohorts.length).toBeGreaterThan(0);
      expect(result.cohorts[0]).toHaveProperty('cohortDate');
      expect(result.cohorts[0]).toHaveProperty('cohortSize');
      expect(result.cohorts[0]).toHaveProperty('retention');
    });

    it('should handle weekly retention cohorts', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      mockAnalyticsRepository.getNewUsers.mockResolvedValue([
        { userId: 'user1' },
        { userId: 'user2' },
        { userId: 'user3' }
      ]);

      mockAnalyticsRepository.getActiveUsersFromCohort.mockResolvedValue([
        { userId: 'user1' }
      ]);

      const result = await service.getRetentionCohorts('weekly', startDate, endDate);

      expect(result.cohortType).toBe('weekly');
      expect(result.cohorts).toBeDefined();
      expect(result.summary).toBeDefined();
    });
  });

  describe('getFunnelAnalysis', () => {
    it('should calculate funnel conversion rates', async () => {
      const funnelId = 'onboarding';
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      jest.spyOn(service, 'getFunnelConfiguration').mockResolvedValue({
        name: 'Onboarding Funnel',
        steps: [
          { name: 'Registration', eventType: 'signup', eventAction: 'complete' },
          { name: 'Profile Setup', eventType: 'profile', eventAction: 'complete' },
          { name: 'First Experience', eventType: 'experience', eventAction: 'create' }
        ]
      });

      mockAnalyticsRepository.getUsersCompletedStep.mockImplementation(
        (eventType, eventAction) => {
          if (eventType === 'signup') {
            return Promise.resolve([
              { userId: 'user1' },
              { userId: 'user2' },
              { userId: 'user3' }
            ]);
          }
          if (eventType === 'profile') {
            return Promise.resolve([
              { userId: 'user1' },
              { userId: 'user2' }
            ]);
          }
          if (eventType === 'experience') {
            return Promise.resolve([
              { userId: 'user1' }
            ]);
          }
          return Promise.resolve([]);
        }
      );

      const result = await service.getFunnelAnalysis(
        funnelId,
        startDate,
        endDate,
        null
      );

      expect(result.funnelId).toBe('onboarding');
      expect(result.name).toBe('Onboarding Funnel');
      expect(result.steps).toHaveLength(3);
      expect(result.steps[0].users).toBe(3);
      expect(result.steps[0].conversionRate).toBe(100);
      expect(result.steps[1].users).toBe(2);
      expect(result.steps[1].conversionRate).toBeCloseTo(66.67, 1);
      expect(result.steps[2].users).toBe(1);
      expect(result.steps[2].conversionRate).toBe(50);
      expect(result.overallConversion).toBeCloseTo(33.33, 1);
    });
  });

  describe('getPerformanceMetrics', () => {
    it('should return performance metrics with percentiles', async () => {
      const performanceData = {
        avgPageLoadTime: 1500,
        medianPageLoadTime: 1200,
        p95PageLoadTime: 3000,
        p99PageLoadTime: 5000,
        avgApiLatency: 200,
        medianApiLatency: 150,
        p95ApiLatency: 500,
        p99ApiLatency: 1000,
        totalErrors: 50,
        errorRate: 2.5,
        errorsByType: {
          '404': 20,
          '500': 10,
          'timeout': 20
        },
        topErrors: [
          { error: 'Resource not found', count: 15 },
          { error: 'Server error', count: 10 }
        ],
        uptimePercentage: 99.9,
        incidents: 1
      };

      mockAnalyticsRepository.getPerformanceMetrics.mockResolvedValue(performanceData);

      const result = await service.getPerformanceMetrics(
        new Date('2024-01-01'),
        new Date('2024-01-31')
      );

      expect(result.pageLoad).toEqual({
        average: 1500,
        median: 1200,
        p95: 3000,
        p99: 5000
      });
      expect(result.apiLatency).toEqual({
        average: 200,
        median: 150,
        p95: 500,
        p99: 1000
      });
      expect(result.errors.total).toBe(50);
      expect(result.errors.rate).toBe(2.5);
      expect(result.availability.uptime).toBe(99.9);
    });
  });

  describe('generateReport', () => {
    it('should generate a JSON report', async () => {
      const reportConfig = {
        type: 'monthly',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        metrics: ['users', 'engagement'],
        format: 'json'
      };

      const userMetrics = { totalUsers: 100 };
      const engagementMetrics = { sessions: { total: 500 } };

      jest.spyOn(service, 'getUserMetrics').mockResolvedValue(userMetrics);
      jest.spyOn(service, 'getEngagementMetrics').mockResolvedValue(engagementMetrics);

      const result = await service.generateReport(reportConfig);

      expect(result).toEqual({
        users: userMetrics,
        engagement: engagementMetrics
      });
    });

    it('should handle PDF report generation', async () => {
      const reportConfig = {
        type: 'monthly',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        metrics: ['users'],
        format: 'pdf'
      };

      const userMetrics = { totalUsers: 100 };
      jest.spyOn(service, 'getUserMetrics').mockResolvedValue(userMetrics);
      jest.spyOn(service, 'generatePDFReport').mockResolvedValue('pdf-content');

      const result = await service.generateReport(reportConfig);

      expect(result).toBe('pdf-content');
      expect(service.generatePDFReport).toHaveBeenCalledWith({ users: userMetrics });
    });
  });

  describe('optimizeQueries', () => {
    it('should return monthly aggregation for large date ranges', () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-06-30'); // 180 days

      const result = service.optimizeQueries(startDate, endDate);

      expect(result).toBe('monthly');
    });

    it('should return weekly aggregation for medium date ranges', () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-02-15'); // 45 days

      const result = service.optimizeQueries(startDate, endDate);

      expect(result).toBe('weekly');
    });

    it('should return daily aggregation for small date ranges', () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-10'); // 10 days

      const result = service.optimizeQueries(startDate, endDate);

      expect(result).toBe('daily');
    });

    it('should return raw data for very small date ranges', () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-05'); // 5 days

      const result = service.optimizeQueries(startDate, endDate);

      expect(result).toBe('raw');
    });
  });

  describe('precomputeMetrics', () => {
    it('should precompute daily metrics', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);

      jest.spyOn(service, 'getUserMetrics').mockResolvedValue({});
      jest.spyOn(service, 'getEngagementMetrics').mockResolvedValue({});
      jest.spyOn(service, 'getPerformanceMetrics').mockResolvedValue({});

      await service.precomputeMetrics();

      expect(service.getUserMetrics).toHaveBeenCalled();
      expect(service.getEngagementMetrics).toHaveBeenCalled();
      expect(service.getPerformanceMetrics).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        'Precomputed daily metrics',
        expect.objectContaining({ date: expect.any(Date) })
      );
    });
  });

  describe('calculateGrowthRate', () => {
    it('should calculate positive growth rate', () => {
      const metrics = {
        newUsers: 20,
        totalUsers: 100,
        previousPeriodUsers: 80
      };

      const result = service.calculateGrowthRate(metrics);

      expect(result).toBe(25); // (100 - 80) / 80 * 100
    });

    it('should calculate negative growth rate', () => {
      const metrics = {
        newUsers: 5,
        totalUsers: 75,
        previousPeriodUsers: 100
      };

      const result = service.calculateGrowthRate(metrics);

      expect(result).toBe(-25); // (75 - 100) / 100 * 100
    });

    it('should handle zero previous users', () => {
      const metrics = {
        newUsers: 10,
        totalUsers: 10,
        previousPeriodUsers: 0
      };

      const result = service.calculateGrowthRate(metrics);

      expect(result).toBe(100); // New users when starting from zero
    });
  });

  describe('calculateRetentionSummary', () => {
    it('should calculate average retention rates', () => {
      const cohorts = [
        {
          cohortDate: '2024-01-01',
          cohortSize: 100,
          retention: [
            { day: 0, retained: 100, percentage: 100 },
            { day: 1, retained: 80, percentage: 80 },
            { day: 7, retained: 50, percentage: 50 },
            { day: 30, retained: 30, percentage: 30 }
          ]
        },
        {
          cohortDate: '2024-01-02',
          cohortSize: 120,
          retention: [
            { day: 0, retained: 120, percentage: 100 },
            { day: 1, retained: 90, percentage: 75 },
            { day: 7, retained: 55, percentage: 45.8 },
            { day: 30, retained: 35, percentage: 29.2 }
          ]
        }
      ];

      const result = service.calculateRetentionSummary(cohorts);

      expect(result).toHaveProperty('averageDay1Retention');
      expect(result).toHaveProperty('averageDay7Retention');
      expect(result).toHaveProperty('averageDay30Retention');
      expect(result.averageDay1Retention).toBeCloseTo(77.5, 1);
      expect(result.averageDay7Retention).toBeCloseTo(47.9, 1);
      expect(result.averageDay30Retention).toBeCloseTo(29.6, 1);
    });
  });
});