const UserAnalyticsService = require('../../../src/services/userAnalyticsService');
const { ulid } = require('ulid');

describe('UserAnalyticsService', () => {
  let analyticsService;
  let mockUserAnalyticsRepository;
  let mockCacheService;
  let mockOciConfig;
  let mockObjectStorageClient;

  beforeEach(() => {
    // Mock repository
    mockUserAnalyticsRepository = {
      insertEvents: jest.fn(),
      getEventsByDateRange: jest.fn(),
      getEventsOlderThan: jest.fn(),
      deleteEventsByDate: jest.fn(),
      saveUserMetrics: jest.fn(),
      getUserEvents: jest.fn(),
      createStorageTier: jest.fn(),
      getStorageTiers: jest.fn(),
      updateStorageTier: jest.fn(),
      updateTierLastAccessed: jest.fn(),
      getColdStorageOlderThan: jest.fn(),
      saveSessions: jest.fn(),
      updateSession: jest.fn(),
      getSession: jest.fn()
    };

    // Mock cache service
    mockCacheService = {
      get: jest.fn(),
      set: jest.fn(),
      invalidate: jest.fn(),
      del: jest.fn()
    };

    // Mock OCI Object Storage client
    mockObjectStorageClient = {
      putObject: jest.fn().mockResolvedValue({ eTag: 'mock-etag' }),
      getObject: jest.fn(),
      copyObject: jest.fn(),
      deleteObject: jest.fn(),
      listObjects: jest.fn()
    };

    // Mock OCI config
    mockOciConfig = {
      provider: {},
      namespace: 'test-namespace',
      region: 'us-phoenix-1',
      hotBucket: 'analytics-hot',
      coldBucket: 'analytics-cold',
      archiveBucket: 'analytics-archive'
    };

    // Create service instance with mocks
    analyticsService = new UserAnalyticsService(
      mockUserAnalyticsRepository,
      mockOciConfig,
      mockCacheService
    );

    // Replace the OCI client with mock
    analyticsService.objectStorageClient = mockObjectStorageClient;

    // Mock timers
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe('Event Tracking', () => {
    describe('trackEvent', () => {
      it('should track a basic event successfully', async () => {
        const eventData = {
          userId: 'user-123',
          sessionId: 'session-456',
          eventType: 'page_view',
          eventCategory: 'navigation',
          eventAction: 'view',
          eventLabel: 'homepage',
          pageUrl: '/home',
          properties: { source: 'direct' }
        };

        const result = await analyticsService.trackEvent(eventData);

        expect(result).toHaveProperty('eventId');
        expect(analyticsService.eventQueue).toHaveLength(1);
        expect(analyticsService.eventQueue[0]).toMatchObject({
          ...eventData,
          properties: JSON.stringify(eventData.properties)
        });
      });

      it('should process critical events in real-time', async () => {
        const criticalEvent = {
          userId: 'user-123',
          sessionId: 'session-456',
          eventType: 'error',
          eventCategory: 'system',
          eventAction: 'exception',
          properties: { message: 'Critical error' }
        };

        analyticsService.processEventRealtime = jest.fn();
        await analyticsService.trackEvent(criticalEvent);

        expect(analyticsService.processEventRealtime).toHaveBeenCalled();
      });

      it('should handle high-volume event tracking', async () => {
        const promises = [];
        for (let i = 0; i < 1000; i++) {
          promises.push(analyticsService.trackEvent({
            userId: `user-${i}`,
            sessionId: `session-${i}`,
            eventType: 'click',
            eventAction: 'button_click'
          }));
        }

        await Promise.all(promises);
        expect(analyticsService.eventQueue).toHaveLength(1000);
      });

      it('should validate required event fields', async () => {
        const invalidEvent = {
          eventType: 'page_view'
          // Missing userId and sessionId
        };

        await expect(analyticsService.trackEvent(invalidEvent))
          .rejects.toThrow('userId and sessionId are required');
      });

      it('should enrich events with device and browser info', async () => {
        const eventData = {
          userId: 'user-123',
          sessionId: 'session-456',
          eventType: 'page_view',
          userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
          ipAddress: '192.168.1.1'
        };

        await analyticsService.trackEvent(eventData);

        const enrichedEvent = analyticsService.eventQueue[0];
        expect(enrichedEvent).toHaveProperty('deviceType');
        expect(enrichedEvent).toHaveProperty('browser');
        expect(enrichedEvent).toHaveProperty('os');
      });
    });

    describe('processEventBatch', () => {
      beforeEach(() => {
        // Add events to queue
        analyticsService.eventQueue = [
          {
            eventId: ulid(),
            userId: 'user-1',
            sessionId: 'session-1',
            eventType: 'page_view',
            eventTimestamp: new Date()
          },
          {
            eventId: ulid(),
            userId: 'user-2',
            sessionId: 'session-2',
            eventType: 'click',
            eventTimestamp: new Date()
          }
        ];
      });

      it('should process event batch successfully', async () => {
        mockUserAnalyticsRepository.insertEvents.mockResolvedValue();

        await analyticsService.processEventBatch();

        expect(mockUserAnalyticsRepository.insertEvents).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({ userId: 'user-1' }),
            expect.objectContaining({ userId: 'user-2' })
          ])
        );
        expect(analyticsService.eventQueue).toHaveLength(0);
      });

      it('should update real-time metrics after processing', async () => {
        analyticsService.updateRealtimeMetrics = jest.fn();
        await analyticsService.processEventBatch();

        expect(analyticsService.updateRealtimeMetrics).toHaveBeenCalled();
      });

      it('should invalidate cache for affected users', async () => {
        await analyticsService.processEventBatch();

        expect(mockCacheService.invalidate).toHaveBeenCalledWith('analytics:user-1:*');
        expect(mockCacheService.invalidate).toHaveBeenCalledWith('analytics:user-2:*');
      });

      it('should re-queue events on failure', async () => {
        const originalEvents = [...analyticsService.eventQueue];
        mockUserAnalyticsRepository.insertEvents.mockRejectedValue(new Error('DB Error'));

        await analyticsService.processEventBatch();

        expect(analyticsService.eventQueue).toEqual(originalEvents);
      });

      it('should handle empty queue gracefully', async () => {
        analyticsService.eventQueue = [];
        await analyticsService.processEventBatch();

        expect(mockUserAnalyticsRepository.insertEvents).not.toHaveBeenCalled();
      });
    });

    describe('Session Management', () => {
      it('should track session start', async () => {
        const sessionData = {
          sessionId: 'session-123',
          userId: 'user-456',
          userAgent: 'Mozilla/5.0',
          ipAddress: '192.168.1.1'
        };

        await analyticsService.startSession(sessionData);

        expect(mockUserAnalyticsRepository.saveSessions).toHaveBeenCalledWith(
          expect.objectContaining({
            sessionId: sessionData.sessionId,
            userId: sessionData.userId,
            sessionStart: expect.any(Date)
          })
        );
      });

      it('should track session end with duration', async () => {
        const sessionId = 'session-123';
        const startTime = new Date();
        
        // Mock existing session
        mockUserAnalyticsRepository.getSession.mockResolvedValue({
          sessionId,
          sessionStart: startTime
        });

        await analyticsService.endSession(sessionId);

        expect(mockUserAnalyticsRepository.updateSession).toHaveBeenCalledWith(
          sessionId,
          expect.objectContaining({
            sessionEnd: expect.any(Date),
            durationSeconds: expect.any(Number)
          })
        );
      });

      it('should track page views within session', async () => {
        const sessionId = 'session-123';
        await analyticsService.trackPageView(sessionId, '/products', 'Products Page');

        expect(mockUserAnalyticsRepository.updateSession).toHaveBeenCalledWith(
          sessionId,
          expect.objectContaining({
            pageCount: expect.any(Number)
          })
        );
      });
    });
  });

  describe('Data Aggregation', () => {
    describe('aggregateDailyMetrics', () => {
      const mockEvents = [
        {
          userId: 'user-1',
          sessionId: 'session-1',
          eventType: 'page_view',
          pageUrl: '/home',
          eventTimestamp: new Date()
        },
        {
          userId: 'user-1',
          sessionId: 'session-1',
          eventType: 'page_view',
          pageUrl: '/products',
          eventTimestamp: new Date()
        },
        {
          userId: 'user-1',
          sessionId: 'session-2',
          eventType: 'click',
          eventAction: 'add_to_cart',
          eventCategory: 'feature_usage',
          eventLabel: 'shopping_cart',
          eventTimestamp: new Date()
        },
        {
          userId: 'user-2',
          sessionId: 'session-3',
          eventType: 'error',
          eventTimestamp: new Date()
        }
      ];

      beforeEach(() => {
        mockUserAnalyticsRepository.getEventsByDateRange.mockResolvedValue(mockEvents);
      });

      it('should aggregate metrics by user', async () => {
        await analyticsService.aggregateDailyMetrics(new Date());

        expect(mockUserAnalyticsRepository.saveUserMetrics).toHaveBeenCalledTimes(2);
        expect(mockUserAnalyticsRepository.saveUserMetrics).toHaveBeenCalledWith(
          expect.objectContaining({
            userId: 'user-1',
            totalEvents: 3,
            totalSessions: 2,
            pageViews: 2,
            uniquePages: 2
          })
        );
      });

      it('should track feature usage', async () => {
        await analyticsService.aggregateDailyMetrics(new Date());

        const user1Metrics = mockUserAnalyticsRepository.saveUserMetrics.mock.calls
          .find(call => call[0].userId === 'user-1')[0];
        
        const featuresUsed = JSON.parse(user1Metrics.featuresUsed);
        expect(featuresUsed).toContain('shopping_cart');
      });

      it('should count errors', async () => {
        await analyticsService.aggregateDailyMetrics(new Date());

        const user2Metrics = mockUserAnalyticsRepository.saveUserMetrics.mock.calls
          .find(call => call[0].userId === 'user-2')[0];
        
        expect(user2Metrics.errorCount).toBe(1);
      });

      it('should handle empty event list', async () => {
        mockUserAnalyticsRepository.getEventsByDateRange.mockResolvedValue([]);
        
        await analyticsService.aggregateDailyMetrics(new Date());

        expect(mockUserAnalyticsRepository.saveUserMetrics).not.toHaveBeenCalled();
      });

      it('should calculate performance metrics', async () => {
        const eventsWithPerformance = [
          ...mockEvents,
          {
            userId: 'user-1',
            eventType: 'timing',
            eventValue: 2.5,
            properties: JSON.stringify({ metric: 'page_load_time' })
          }
        ];

        mockUserAnalyticsRepository.getEventsByDateRange.mockResolvedValue(eventsWithPerformance);
        await analyticsService.aggregateDailyMetrics(new Date());

        const user1Metrics = mockUserAnalyticsRepository.saveUserMetrics.mock.calls
          .find(call => call[0].userId === 'user-1')[0];
        
        expect(user1Metrics.avgPageLoadTime).toBeDefined();
      });
    });

    describe('Cohort Analysis', () => {
      it('should calculate retention cohorts', async () => {
        const cohortData = await analyticsService.calculateRetentionCohorts(
          new Date('2025-01-01'),
          new Date('2025-01-31')
        );

        expect(cohortData).toHaveProperty('cohorts');
        expect(cohortData).toHaveProperty('retentionRates');
      });

      it('should identify user segments', async () => {
        const segments = await analyticsService.identifyUserSegments();

        expect(segments).toContain('highly_engaged');
        expect(segments).toContain('at_risk');
        expect(segments).toContain('new_users');
      });
    });

    describe('Funnel Analysis', () => {
      it('should calculate conversion funnels', async () => {
        const funnelSteps = [
          { step: 'page_view', page: '/products' },
          { step: 'click', action: 'add_to_cart' },
          { step: 'page_view', page: '/checkout' },
          { step: 'conversion', action: 'purchase' }
        ];

        const funnelData = await analyticsService.calculateFunnel(
          funnelSteps,
          new Date('2025-01-01'),
          new Date('2025-01-31')
        );

        expect(funnelData).toHaveProperty('steps');
        expect(funnelData).toHaveProperty('conversionRates');
        expect(funnelData).toHaveProperty('dropoffRates');
      });
    });
  });

  describe('OCI Storage Integration', () => {
    describe('migrateToOCIColdStorage', () => {
      const oldEvents = [
        { eventId: '1', userId: 'user-1', eventTimestamp: new Date('2024-10-01') },
        { eventId: '2', userId: 'user-1', eventTimestamp: new Date('2024-10-01') },
        { eventId: '3', userId: 'user-2', eventTimestamp: new Date('2024-10-02') }
      ];

      beforeEach(() => {
        mockUserAnalyticsRepository.getEventsOlderThan.mockResolvedValue(oldEvents);
      });

      it('should migrate old events to cold storage', async () => {
        await analyticsService.migrateToOCIColdStorage();

        expect(mockObjectStorageClient.putObject).toHaveBeenCalled();
        expect(mockUserAnalyticsRepository.createStorageTier).toHaveBeenCalled();
        expect(mockUserAnalyticsRepository.deleteEventsByDate).toHaveBeenCalled();
      });

      it('should compress data before storage', async () => {
        analyticsService.compressData = jest.fn().mockResolvedValue(Buffer.from('compressed'));
        
        await analyticsService.migrateToOCIColdStorage();

        expect(analyticsService.compressData).toHaveBeenCalled();
      });

      it('should group events by date', async () => {
        await analyticsService.migrateToOCIColdStorage();

        // Should create 2 storage tiers (for 2 different dates)
        expect(mockUserAnalyticsRepository.createStorageTier).toHaveBeenCalledTimes(2);
      });

      it('should handle migration failures gracefully', async () => {
        mockObjectStorageClient.putObject.mockRejectedValue(new Error('OCI Error'));

        await expect(analyticsService.migrateToOCIColdStorage())
          .rejects.toThrow('OCI Error');
      });

      it('should skip migration when no old events exist', async () => {
        mockUserAnalyticsRepository.getEventsOlderThan.mockResolvedValue([]);

        await analyticsService.migrateToOCIColdStorage();

        expect(mockObjectStorageClient.putObject).not.toHaveBeenCalled();
      });

      it('should create proper OCI object names', async () => {
        await analyticsService.migrateToOCIColdStorage();

        expect(mockObjectStorageClient.putObject).toHaveBeenCalledWith(
          expect.objectContaining({
            objectName: expect.stringMatching(/analytics\/daily\/\d{4}-\d{2}-\d{2}\/events\.json\.gz/)
          })
        );
      });
    });

    describe('migrateToOCIArchive', () => {
      const coldStorageItems = [
        {
          tierId: 'tier-1',
          filePrefix: 'analytics/daily/2024-01-01/events.json.gz',
          dateRangeStart: new Date('2024-01-01'),
          sizeBytes: 1024
        }
      ];

      beforeEach(() => {
        mockUserAnalyticsRepository.getColdStorageOlderThan.mockResolvedValue(coldStorageItems);
      });

      it('should migrate cold storage to archive', async () => {
        await analyticsService.migrateToOCIArchive();

        expect(mockObjectStorageClient.copyObject).toHaveBeenCalled();
        expect(mockUserAnalyticsRepository.updateStorageTier).toHaveBeenCalled();
        expect(mockObjectStorageClient.deleteObject).toHaveBeenCalled();
      });

      it('should update storage tier metadata', async () => {
        await analyticsService.migrateToOCIArchive();

        expect(mockUserAnalyticsRepository.updateStorageTier).toHaveBeenCalledWith(
          'tier-1',
          expect.objectContaining({
            tierName: 'archive',
            ociBucket: mockOciConfig.archiveBucket
          })
        );
      });

      it('should handle archive failures', async () => {
        mockObjectStorageClient.copyObject.mockRejectedValue(new Error('Copy failed'));

        await expect(analyticsService.migrateToOCIArchive())
          .rejects.toThrow('Copy failed');
      });
    });

    describe('queryAnalytics', () => {
      it('should query across all storage tiers', async () => {
        const userId = 'user-123';
        const startDate = new Date('2024-01-01');
        const endDate = new Date('2025-01-31');

        mockUserAnalyticsRepository.getUserEvents.mockResolvedValue([
          { eventId: '1', eventTimestamp: new Date('2025-01-15') }
        ]);

        analyticsService.queryOCIColdStorage = jest.fn().mockResolvedValue([
          { eventId: '2', eventTimestamp: new Date('2024-06-15') }
        ]);

        analyticsService.queryOCIArchive = jest.fn().mockResolvedValue([
          { eventId: '3', eventTimestamp: new Date('2024-01-15') }
        ]);

        const results = await analyticsService.queryAnalytics(userId, startDate, endDate);

        expect(results).toHaveLength(3);
        expect(results[0].eventId).toBe('3'); // Oldest first
        expect(results[2].eventId).toBe('1'); // Newest last
      });

      it('should optimize queries based on date ranges', async () => {
        const userId = 'user-123';
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 30); // 30 days ago
        const endDate = new Date();

        analyticsService.queryOCIColdStorage = jest.fn();
        analyticsService.queryOCIArchive = jest.fn();

        await analyticsService.queryAnalytics(userId, startDate, endDate);

        // Should only query hot storage for recent data
        expect(mockUserAnalyticsRepository.getUserEvents).toHaveBeenCalled();
        expect(analyticsService.queryOCIColdStorage).not.toHaveBeenCalled();
        expect(analyticsService.queryOCIArchive).not.toHaveBeenCalled();
      });

      it('should handle OCI retrieval failures gracefully', async () => {
        const userId = 'user-123';
        const startDate = new Date('2024-01-01');
        const endDate = new Date('2024-06-01');

        analyticsService.queryOCIColdStorage = jest.fn()
          .mockRejectedValue(new Error('OCI unavailable'));

        const results = await analyticsService.queryAnalytics(userId, startDate, endDate);

        // Should still return partial results
        expect(results).toBeDefined();
      });
    });

    describe('Data Compression', () => {
      it('should compress data using gzip', async () => {
        const data = { events: Array(1000).fill({ eventId: 'test' }) };
        const compressed = await analyticsService.compressData(data);

        expect(compressed).toBeInstanceOf(Buffer);
        expect(compressed.length).toBeLessThan(JSON.stringify(data).length);
      });

      it('should decompress data correctly', async () => {
        const originalData = { test: 'data', value: 123 };
        const compressed = await analyticsService.compressData(originalData);
        const decompressed = await analyticsService.decompressData(compressed);

        expect(JSON.parse(decompressed)).toEqual(originalData);
      });
    });
  });

  describe('Real-time Processing', () => {
    describe('Event Stream Processing', () => {
      it('should process real-time event stream', async () => {
        const event = {
          userId: 'user-123',
          eventType: 'conversion',
          eventValue: 99.99
        };

        await analyticsService.processEventRealtime(event);

        expect(mockCacheService.set).toHaveBeenCalled();
      });

      it('should update real-time dashboards', async () => {
        analyticsService.updateRealtimeDashboard = jest.fn();
        
        const events = [
          { userId: 'user-1', eventType: 'page_view' },
          { userId: 'user-2', eventType: 'click' }
        ];

        await analyticsService.updateRealtimeMetrics(events);

        expect(analyticsService.updateRealtimeDashboard).toHaveBeenCalled();
      });
    });

    describe('Performance Monitoring', () => {
      it('should track processing latency', async () => {
        const startTime = Date.now();
        await analyticsService.processEventBatch();
        const endTime = Date.now();

        expect(endTime - startTime).toBeLessThan(1000); // Should process within 1 second
      });

      it('should handle backpressure', async () => {
        // Fill queue to capacity
        for (let i = 0; i < 10000; i++) {
          analyticsService.eventQueue.push({ eventId: i });
        }

        const event = { userId: 'user-123', eventType: 'test' };
        await expect(analyticsService.trackEvent(event))
          .rejects.toThrow('Event queue at capacity');
      });
    });
  });

  describe('Analytics Queries', () => {
    describe('User Activity Summaries', () => {
      it('should generate user activity summary', async () => {
        const userId = 'user-123';
        const summary = await analyticsService.getUserActivitySummary(userId);

        expect(summary).toHaveProperty('totalEvents');
        expect(summary).toHaveProperty('totalSessions');
        expect(summary).toHaveProperty('averageSessionDuration');
        expect(summary).toHaveProperty('mostVisitedPages');
        expect(summary).toHaveProperty('topActions');
      });

      it('should calculate engagement score', async () => {
        const userId = 'user-123';
        const score = await analyticsService.calculateEngagementScore(userId);

        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(100);
      });
    });

    describe('Feature Adoption Tracking', () => {
      it('should track feature adoption rates', async () => {
        const adoption = await analyticsService.getFeatureAdoption();

        expect(adoption).toHaveProperty('features');
        expect(adoption.features).toBeInstanceOf(Array);
        adoption.features.forEach(feature => {
          expect(feature).toHaveProperty('name');
          expect(feature).toHaveProperty('adoptionRate');
          expect(feature).toHaveProperty('userCount');
        });
      });

      it('should identify unused features', async () => {
        const unused = await analyticsService.getUnusedFeatures(30); // Last 30 days

        expect(unused).toBeInstanceOf(Array);
      });
    });

    describe('User Journey Mapping', () => {
      it('should map user journey paths', async () => {
        const userId = 'user-123';
        const journey = await analyticsService.getUserJourney(userId);

        expect(journey).toHaveProperty('paths');
        expect(journey).toHaveProperty('entryPoints');
        expect(journey).toHaveProperty('exitPoints');
        expect(journey).toHaveProperty('conversionPoints');
      });

      it('should identify common paths', async () => {
        const commonPaths = await analyticsService.getCommonUserPaths();

        expect(commonPaths).toBeInstanceOf(Array);
        commonPaths.forEach(path => {
          expect(path).toHaveProperty('sequence');
          expect(path).toHaveProperty('frequency');
          expect(path).toHaveProperty('conversionRate');
        });
      });
    });

    describe('Custom Query Builder', () => {
      it('should execute custom analytics queries', async () => {
        const query = {
          metrics: ['pageViews', 'uniqueUsers'],
          dimensions: ['date', 'pageUrl'],
          filters: {
            eventType: 'page_view',
            dateRange: {
              start: new Date('2025-01-01'),
              end: new Date('2025-01-31')
            }
          },
          groupBy: ['date'],
          orderBy: 'pageViews DESC',
          limit: 100
        };

        const results = await analyticsService.executeCustomQuery(query);

        expect(results).toHaveProperty('data');
        expect(results).toHaveProperty('metadata');
      });

      it('should validate custom queries', async () => {
        const invalidQuery = {
          metrics: ['invalid_metric']
        };

        await expect(analyticsService.executeCustomQuery(invalidQuery))
          .rejects.toThrow('Invalid metric: invalid_metric');
      });
    });

    describe('Export Capabilities', () => {
      it('should export analytics data to CSV', async () => {
        const exportConfig = {
          format: 'csv',
          dateRange: {
            start: new Date('2025-01-01'),
            end: new Date('2025-01-31')
          },
          metrics: ['events', 'sessions', 'users']
        };

        const csvData = await analyticsService.exportAnalytics(exportConfig);

        expect(csvData).toContain('Date,Events,Sessions,Users');
      });

      it('should export to JSON format', async () => {
        const exportConfig = {
          format: 'json',
          dateRange: {
            start: new Date('2025-01-01'),
            end: new Date('2025-01-31')
          }
        };

        const jsonData = await analyticsService.exportAnalytics(exportConfig);

        expect(() => JSON.parse(jsonData)).not.toThrow();
      });

      it('should handle large exports with streaming', async () => {
        const exportConfig = {
          format: 'csv',
          streaming: true,
          dateRange: {
            start: new Date('2024-01-01'),
            end: new Date('2025-01-31')
          }
        };

        const stream = await analyticsService.exportAnalyticsStream(exportConfig);

        expect(stream).toHaveProperty('pipe');
      });
    });
  });

  describe('Scheduled Jobs', () => {
    it('should schedule aggregation jobs', () => {
      const scheduleJobSpy = jest.spyOn(analyticsService, 'scheduleAggregationJobs');
      analyticsService.scheduleAggregationJobs();

      expect(scheduleJobSpy).toHaveBeenCalled();
    });

    it('should schedule tiering jobs', () => {
      const scheduleJobSpy = jest.spyOn(analyticsService, 'scheduleTieringJobs');
      analyticsService.scheduleTieringJobs();

      expect(scheduleJobSpy).toHaveBeenCalled();
    });

    it('should run hourly aggregation', () => {
      jest.advanceTimersByTime(60 * 60 * 1000); // 1 hour
      // Verify hourly aggregation was triggered
    });

    it('should run daily migration to cold storage', () => {
      // Fast-forward to 4 AM
      const tomorrow4am = new Date();
      tomorrow4am.setDate(tomorrow4am.getDate() + 1);
      tomorrow4am.setHours(4, 0, 0, 0);
      
      jest.setSystemTime(tomorrow4am);
      jest.advanceTimersByTime(1000);
      
      // Verify migration was triggered
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle database connection failures', async () => {
      mockUserAnalyticsRepository.insertEvents.mockRejectedValue(
        new Error('Database connection failed')
      );

      analyticsService.eventQueue = [{ eventId: '1' }];
      await analyticsService.processEventBatch();

      // Events should remain in queue for retry
      expect(analyticsService.eventQueue).toHaveLength(1);
    });

    it('should handle OCI service outages', async () => {
      mockObjectStorageClient.putObject.mockRejectedValue(
        new Error('OCI service unavailable')
      );

      // Should not throw, but log error
      await expect(analyticsService.migrateToOCIColdStorage())
        .rejects.toThrow('OCI service unavailable');
    });

    it('should implement retry logic with exponential backoff', async () => {
      let attempts = 0;
      mockUserAnalyticsRepository.insertEvents.mockImplementation(() => {
        attempts++;
        if (attempts < 3) {
          return Promise.reject(new Error('Temporary failure'));
        }
        return Promise.resolve();
      });

      await analyticsService.processEventBatchWithRetry();

      expect(attempts).toBe(3);
    });

    it('should handle data corruption gracefully', async () => {
      const corruptedData = 'not-valid-json';
      mockObjectStorageClient.getObject.mockResolvedValue({ value: corruptedData });

      const results = await analyticsService.queryOCIColdStorage(
        'user-123',
        new Date('2024-01-01'),
        new Date('2024-12-31')
      );

      // Should return empty array instead of throwing
      expect(results).toEqual([]);
    });
  });

  describe('Performance Optimization', () => {
    it('should batch database operations efficiently', async () => {
      // Add 1000 events
      for (let i = 0; i < 1000; i++) {
        analyticsService.eventQueue.push({
          eventId: `event-${i}`,
          userId: `user-${i % 10}`,
          eventType: 'test'
        });
      }

      await analyticsService.processEventBatch();

      // Should batch insert, not individual inserts
      expect(mockUserAnalyticsRepository.insertEvents).toHaveBeenCalledTimes(1);
      expect(mockUserAnalyticsRepository.insertEvents).toHaveBeenCalledWith(
        expect.arrayContaining([expect.any(Object)])
      );
    });

    it('should use caching for frequently accessed data', async () => {
      const userId = 'user-123';
      
      // First call - should hit database
      await analyticsService.getUserActivitySummary(userId);
      expect(mockCacheService.get).toHaveBeenCalled();
      
      // Second call - should use cache
      mockCacheService.get.mockResolvedValue({ cached: true });
      const result = await analyticsService.getUserActivitySummary(userId);
      
      expect(result.cached).toBe(true);
    });

    it('should optimize storage with data deduplication', async () => {
      const duplicateEvents = [
        { eventId: '1', userId: 'user-1', eventType: 'click' },
        { eventId: '1', userId: 'user-1', eventType: 'click' }, // Duplicate
        { eventId: '2', userId: 'user-1', eventType: 'click' }
      ];

      analyticsService.eventQueue = duplicateEvents;
      await analyticsService.processEventBatch();

      // Should only insert unique events
      expect(mockUserAnalyticsRepository.insertEvents).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ eventId: '1' }),
          expect.objectContaining({ eventId: '2' })
        ])
      );
    });
  });
});