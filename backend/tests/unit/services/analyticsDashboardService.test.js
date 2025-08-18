const AnalyticsDashboardService = require('../../../src/services/analyticsDashboardService');

describe('AnalyticsDashboardService', () => {
  let service;
  let mockAnalyticsRepository;
  let mockCacheService;

  beforeEach(() => {
    // Create mock repository
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

    // Create mock cache service
    mockCacheService = {
      get: jest.fn(),
      set: jest.fn()
    };

    service = new AnalyticsDashboardService(mockAnalyticsRepository, mockCacheService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getDashboardOverview', () => {
    const startDate = new Date('2024-01-01');
    const endDate = new Date('2024-01-31');

    it('should return cached data if available', async () => {
      const cachedData = { userMetrics: { totalUsers: 100 } };
      mockCacheService.get.mockResolvedValue(cachedData);

      const result = await service.getDashboardOverview(startDate, endDate);

      expect(result).toEqual(cachedData);
      expect(mockCacheService.get).toHaveBeenCalledWith(
        expect.stringContaining('dashboard:overview')
      );
      expect(mockAnalyticsRepository.getUserMetrics).not.toHaveBeenCalled();
    });

    it('should fetch and cache data if not cached', async () => {
      mockCacheService.get.mockResolvedValue(null);
      
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

      const result = await service.getDashboardOverview(startDate, endDate);

      expect(result).toHaveProperty('userMetrics');
      expect(result).toHaveProperty('engagementMetrics');
      expect(result).toHaveProperty('performanceMetrics');
      expect(result).toHaveProperty('generatedAt');
      expect(mockCacheService.set).toHaveBeenCalledWith(
        expect.stringContaining('dashboard:overview'),
        expect.any(Object),
        300
      );
    });

    it('should handle errors gracefully', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockAnalyticsRepository.getUserMetrics.mockRejectedValue(new Error('Database error'));

      await expect(service.getDashboardOverview(startDate, endDate))
        .rejects.toThrow('Database error');
    });
  });

  describe('getUserMetrics', () => {
    const startDate = new Date('2024-01-01');
    const endDate = new Date('2024-01-31');

    it('should calculate growth rate correctly', async () => {
      mockAnalyticsRepository.getUserMetrics.mockResolvedValue({
        totalUsers: 110,
        previousPeriodUsers: 100,
        newUsers: 10,
        dau: 50,
        wau: 75,
        mau: 90,
        churnRate: 5,
        churnedUsers: 5
      });

      const result = await service.getUserMetrics(startDate, endDate);

      expect(result.growth.rate).toBe(10); // 10% growth
    });

    it('should handle zero previous period users', async () => {
      mockAnalyticsRepository.getUserMetrics.mockResolvedValue({
        totalUsers: 100,
        previousPeriodUsers: 0,
        newUsers: 100,
        dau: 50,
        wau: 75,
        mau: 90,
        churnRate: 0,
        churnedUsers: 0
      });

      const result = await service.getUserMetrics(startDate, endDate);

      expect(result.growth.rate).toBe(100); // 100% growth from zero
    });

    it('should determine trend correctly', async () => {
      const metricsData = {
        totalUsers: 100,
        newUsers: 10,
        dau: 50,
        wau: 75,
        mau: 90,
        churnRate: 5,
        churnedUsers: 5
      };

      // Test growing trend
      mockAnalyticsRepository.getUserMetrics.mockResolvedValue({
        ...metricsData,
        trend: 15
      });
      let result = await service.getUserMetrics(startDate, endDate);
      expect(result.growth.trend).toBe('growing');

      // Test declining trend
      mockAnalyticsRepository.getUserMetrics.mockResolvedValue({
        ...metricsData,
        trend: -15
      });
      result = await service.getUserMetrics(startDate, endDate);
      expect(result.growth.trend).toBe('declining');

      // Test stable trend
      mockAnalyticsRepository.getUserMetrics.mockResolvedValue({
        ...metricsData,
        trend: 5
      });
      result = await service.getUserMetrics(startDate, endDate);
      expect(result.growth.trend).toBe('stable');
    });
  });

  describe('getRetentionCohorts', () => {
    const startDate = new Date('2024-01-01');
    const endDate = new Date('2024-01-07');

    it('should calculate daily cohorts correctly', async () => {
      mockAnalyticsRepository.getNewUsers.mockResolvedValue([
        { userId: '1' },
        { userId: '2' }
      ]);
      mockAnalyticsRepository.getActiveUsersFromCohort.mockImplementation((userIds, date) => {
        // Simulate decreasing retention
        const dayDiff = Math.floor((date - startDate) / (1000 * 60 * 60 * 24));
        if (dayDiff === 0) return userIds;
        if (dayDiff === 1) return [userIds[0]];
        return [];
      });

      const result = await service.getRetentionCohorts('daily', startDate, endDate);

      expect(result.cohortType).toBe('daily');
      expect(result.cohorts).toHaveLength(7); // 7 daily cohorts
      expect(result.cohorts[0].retention).toHaveLength(31); // 31 days of retention data
      expect(result.summary).toHaveProperty('averageDay1Retention');
    });

    it('should handle empty cohorts', async () => {
      mockAnalyticsRepository.getNewUsers.mockResolvedValue([]);
      mockAnalyticsRepository.getActiveUsersFromCohort.mockResolvedValue([]);

      const result = await service.getRetentionCohorts('daily', startDate, endDate);

      expect(result.cohorts[0].cohortSize).toBe(0);
      expect(result.cohorts[0].retention[0].percentage).toBe(0);
    });

    it('should calculate retention summary correctly', async () => {
      mockAnalyticsRepository.getNewUsers.mockResolvedValue([
        { userId: '1' },
        { userId: '2' }
      ]);
      mockAnalyticsRepository.getActiveUsersFromCohort.mockImplementation((userIds, date) => {
        const dayDiff = Math.floor((date - startDate) / (1000 * 60 * 60 * 24));
        if (dayDiff === 1) return [userIds[0]]; // 50% day 1 retention
        if (dayDiff === 7) return [userIds[0]]; // 50% day 7 retention
        if (dayDiff === 30) return []; // 0% day 30 retention
        return userIds;
      });

      const result = await service.getRetentionCohorts('weekly', startDate, endDate);

      expect(result.summary.averageDay1Retention).toBeGreaterThanOrEqual(0);
      expect(result.summary.averageDay7Retention).toBeGreaterThanOrEqual(0);
      expect(result.summary.averageDay30Retention).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getFunnelAnalysis', () => {
    const startDate = new Date('2024-01-01');
    const endDate = new Date('2024-01-31');

    it('should calculate funnel conversion rates correctly', async () => {
      // Mock funnel steps
      mockAnalyticsRepository.getUsersCompletedStep
        .mockResolvedValueOnce(Array(100).fill({ userId: 'user' })) // Step 1: 100 users
        .mockResolvedValueOnce(Array(75).fill({ userId: 'user' }))  // Step 2: 75 users
        .mockResolvedValueOnce(Array(50).fill({ userId: 'user' }));  // Step 3: 50 users

      const result = await service.getFunnelAnalysis('onboarding', startDate, endDate);

      expect(result.funnelId).toBe('onboarding');
      expect(result.steps).toHaveLength(3);
      expect(result.steps[0].users).toBe(100);
      expect(result.steps[0].conversionRate).toBe(100); // First step is always 100%
      expect(result.steps[1].users).toBe(75);
      expect(result.steps[1].conversionRate).toBe(75); // 75/100 = 75%
      expect(result.steps[2].users).toBe(50);
      expect(result.steps[2].conversionRate).toBeCloseTo(66.67, 1); // 50/75 = 66.67%
      expect(result.overallConversion).toBe(50); // 50/100 = 50%
    });

    it('should handle empty funnel', async () => {
      mockAnalyticsRepository.getUsersCompletedStep.mockResolvedValue([]);

      const result = await service.getFunnelAnalysis('onboarding', startDate, endDate);

      expect(result.steps[0].users).toBe(0);
      expect(result.overallConversion).toBe(0);
    });

    it('should handle unknown funnel ID', async () => {
      mockAnalyticsRepository.getUsersCompletedStep.mockResolvedValue([]);

      const result = await service.getFunnelAnalysis('unknown', startDate, endDate);

      expect(result.name).toBe('Custom Funnel');
      expect(result.steps).toHaveLength(0);
    });
  });

  describe('getRealtimeMetrics', () => {
    it('should calculate metrics for last 5 minutes', async () => {
      const mockEvents = [
        { eventType: 'page_view', pageUrl: '/home', eventTimestamp: new Date() },
        { eventType: 'page_view', pageUrl: '/home', eventTimestamp: new Date() },
        { eventType: 'page_view', pageUrl: '/dashboard', eventTimestamp: new Date() },
        { eventType: 'error', message: 'Test error', eventTimestamp: new Date() }
      ];

      mockAnalyticsRepository.getActiveUsers.mockResolvedValue(Array(10).fill({ userId: 'user' }));
      mockAnalyticsRepository.getActiveSessions.mockResolvedValue(Array(15).fill({ sessionId: 'session' }));
      mockAnalyticsRepository.getRecentEvents.mockResolvedValue(mockEvents);
      mockAnalyticsRepository.getErrorRate.mockResolvedValue(1.5);

      const result = await service.getRealtimeMetrics();

      expect(result.activeUsers).toBe(10);
      expect(result.activeSessions).toBe(15);
      expect(result.eventsPerSecond).toBeCloseTo(mockEvents.length / 300, 2);
      expect(result.errorRate).toBe(1.5);
      expect(result.topPages).toHaveLength(2);
      expect(result.topPages[0].url).toBe('/home');
      expect(result.topPages[0].views).toBe(2);
      expect(result.recentErrors).toHaveLength(1);
    });

    it('should handle no events', async () => {
      mockAnalyticsRepository.getActiveUsers.mockResolvedValue([]);
      mockAnalyticsRepository.getActiveSessions.mockResolvedValue([]);
      mockAnalyticsRepository.getRecentEvents.mockResolvedValue([]);
      mockAnalyticsRepository.getErrorRate.mockResolvedValue(0);

      const result = await service.getRealtimeMetrics();

      expect(result.activeUsers).toBe(0);
      expect(result.activeSessions).toBe(0);
      expect(result.eventsPerSecond).toBe(0);
      expect(result.topPages).toHaveLength(0);
      expect(result.recentErrors).toHaveLength(0);
    });
  });

  describe('getFeatureAdoption', () => {
    const startDate = new Date('2024-01-01');
    const endDate = new Date('2024-01-31');

    it('should calculate feature adoption metrics', async () => {
      mockAnalyticsRepository.getFeatureUsage.mockResolvedValue([
        {
          name: 'Feature A',
          uniqueUsers: 100,
          totalUsage: 500,
          adoptionRate: 50,
          trend: 'growing',
          firstUsed: new Date('2024-01-01'),
          lastUsed: new Date('2024-01-31')
        },
        {
          name: 'Feature B',
          uniqueUsers: 50,
          totalUsage: 150,
          adoptionRate: 25,
          trend: 'stable',
          firstUsed: new Date('2024-01-15'),
          lastUsed: new Date('2024-01-31')
        }
      ]);

      const result = await service.getFeatureAdoption(startDate, endDate);

      expect(result.features).toHaveLength(2);
      expect(result.features[0].averageUsagePerUser).toBe(5); // 500/100
      expect(result.features[1].averageUsagePerUser).toBe(3); // 150/50
      expect(result.summary.totalFeatures).toBe(2);
      expect(result.summary.averageAdoptionRate).toBe(37.5); // (50+25)/2
      expect(result.summary.mostUsed.featureName).toBe('Feature A');
      expect(result.summary.leastUsed.featureName).toBe('Feature B');
    });

    it('should handle no features', async () => {
      mockAnalyticsRepository.getFeatureUsage.mockResolvedValue([]);

      const result = await service.getFeatureAdoption(startDate, endDate);

      expect(result.features).toHaveLength(0);
      expect(result.summary.totalFeatures).toBe(0);
    });

    it('should handle division by zero for usage per user', async () => {
      mockAnalyticsRepository.getFeatureUsage.mockResolvedValue([
        {
          name: 'Feature A',
          uniqueUsers: 0,
          totalUsage: 0,
          adoptionRate: 0,
          trend: 'stable',
          firstUsed: null,
          lastUsed: null
        }
      ]);

      const result = await service.getFeatureAdoption(startDate, endDate);

      expect(result.features[0].averageUsagePerUser).toBe(0);
    });
  });

  describe('getUserLifecycleStages', () => {
    const startDate = new Date('2024-01-01');
    const endDate = new Date('2024-01-31');

    it('should categorize users into lifecycle stages', async () => {
      const now = new Date();
      const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000);
      const oneWeekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
      const oneMonthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
      const threeMonthsAgo = new Date(now - 90 * 24 * 60 * 60 * 1000);
      const sixMonthsAgo = new Date(now - 180 * 24 * 60 * 60 * 1000);

      mockAnalyticsRepository.getAllUsers.mockResolvedValue([
        { userId: '1', lastActivity: oneDayAgo },      // active
        { userId: '2', lastActivity: oneWeekAgo },      // engaged
        { userId: '3', lastActivity: oneMonthAgo },     // atRisk
        { userId: '4', lastActivity: threeMonthsAgo },  // dormant
        { userId: '5', lastActivity: sixMonthsAgo }     // churned
      ]);

      const result = await service.getUserLifecycleStages(startDate, endDate);

      expect(result.stages).toHaveLength(7); // All stage categories
      expect(result.stages.find(s => s.stage === 'active').count).toBe(1);
      expect(result.stages.find(s => s.stage === 'engaged').count).toBe(1);
      expect(result.stages.find(s => s.stage === 'atRisk').count).toBe(1);
      expect(result.stages.find(s => s.stage === 'dormant').count).toBe(1);
      expect(result.stages.find(s => s.stage === 'churned').count).toBe(1);
    });

    it('should handle empty user list', async () => {
      mockAnalyticsRepository.getAllUsers.mockResolvedValue([]);

      const result = await service.getUserLifecycleStages(startDate, endDate);

      expect(result.stages.every(s => s.count === 0)).toBe(true);
    });
  });

  describe('generateReport', () => {
    const reportConfig = {
      type: 'comprehensive',
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-01-31'),
      metrics: ['users', 'engagement'],
      format: 'json'
    };

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

      const result = await service.generateReport(reportConfig);

      expect(result).toHaveProperty('users');
      expect(result).toHaveProperty('engagement');
      expect(result.users.totalUsers).toBe(100);
      expect(result.engagement.sessions.total).toBe(500);
    });

    it('should generate CSV report', async () => {
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

      const csvConfig = { ...reportConfig, format: 'csv' };
      const result = await service.generateReport(csvConfig);

      expect(typeof result).toBe('string');
      expect(result).toContain('Metric,Value,Date');
      expect(result).toContain('Total Users,100');
    });

    it('should handle PDF format (stub)', async () => {
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

      const pdfConfig = { ...reportConfig, format: 'pdf' };
      const result = await service.generateReport(pdfConfig);

      expect(result).toBe('pdf-content');
    });

    it('should handle Excel format (stub)', async () => {
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

      const excelConfig = { ...reportConfig, format: 'excel' };
      const result = await service.generateReport(excelConfig);

      expect(result).toBe('excel-content');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle null/undefined date ranges', async () => {
      await expect(service.getDashboardOverview(null, null))
        .rejects.toThrow();
    });

    it('should handle invalid date objects', async () => {
      const invalidDate = new Date('invalid');
      await expect(service.getDashboardOverview(invalidDate, new Date()))
        .rejects.toThrow();
    });

    it('should handle repository timeout', async () => {
      mockAnalyticsRepository.getUserMetrics.mockImplementation(() => 
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 100))
      );

      await expect(service.getUserMetrics(new Date(), new Date()))
        .rejects.toThrow('Timeout');
    });

    it('should handle concurrent requests correctly', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockAnalyticsRepository.getUserMetrics.mockResolvedValue({
        totalUsers: 100,
        newUsers: 10,
        dau: 50,
        wau: 75,
        mau: 90,
        churnRate: 5,
        churnedUsers: 5
      });

      const promises = Array(10).fill(null).map(() => 
        service.getUserMetrics(new Date('2024-01-01'), new Date('2024-01-31'))
      );

      const results = await Promise.all(promises);
      expect(results.every(r => r.totalUsers === 100)).toBe(true);
    });

    it('should handle very large datasets', async () => {
      const largeUserList = Array(10000).fill(null).map((_, i) => ({
        userId: `user${i}`,
        lastActivity: new Date()
      }));

      mockAnalyticsRepository.getAllUsers.mockResolvedValue(largeUserList);

      const result = await service.getUserLifecycleStages(new Date(), new Date());
      
      expect(result.stages).toBeDefined();
      // Should only return top 10 users for preview
      expect(result.stages[0].users.length).toBeLessThanOrEqual(10);
    });

    it('should handle malformed repository responses', async () => {
      mockAnalyticsRepository.getUserMetrics.mockResolvedValue({
        // Missing required fields
        totalUsers: undefined,
        newUsers: null
      });

      const result = await service.getUserMetrics(new Date(), new Date());
      
      // Should handle gracefully with defaults
      expect(result).toBeDefined();
    });
  });

  describe('Performance Optimizations', () => {
    it('should use appropriate query optimization based on date range', () => {
      const oneWeek = new Date('2024-01-01');
      const oneWeekEnd = new Date('2024-01-07');
      expect(service.optimizeQueries(oneWeek, oneWeekEnd)).toBe('raw');

      const twoWeeks = new Date('2024-01-01');
      const twoWeeksEnd = new Date('2024-01-14');
      expect(service.optimizeQueries(twoWeeks, twoWeeksEnd)).toBe('daily');

      const twoMonths = new Date('2024-01-01');
      const twoMonthsEnd = new Date('2024-03-01');
      expect(service.optimizeQueries(twoMonths, twoMonthsEnd)).toBe('weekly');

      const fourMonths = new Date('2024-01-01');
      const fourMonthsEnd = new Date('2024-05-01');
      expect(service.optimizeQueries(fourMonths, fourMonthsEnd)).toBe('monthly');
    });

    it('should precompute metrics successfully', async () => {
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

      await service.precomputeMetrics();

      expect(mockAnalyticsRepository.getUserMetrics).toHaveBeenCalled();
      expect(mockAnalyticsRepository.getEngagementMetrics).toHaveBeenCalled();
      expect(mockAnalyticsRepository.getPerformanceMetrics).toHaveBeenCalled();
    });
  });
});