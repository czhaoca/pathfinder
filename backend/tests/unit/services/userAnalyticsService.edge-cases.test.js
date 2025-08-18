/**
 * Edge Case and Security Tests for UserAnalyticsService
 * These tests cover critical scenarios missing from the main test suite
 */

const UserAnalyticsService = require('../../../src/services/userAnalyticsService');
const { ulid } = require('ulid');

describe('UserAnalyticsService - Edge Cases and Security', () => {
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

  describe('Security Vulnerabilities', () => {
    it('should prevent SQL injection in event properties', async () => {
      const maliciousEvent = {
        userId: 'user-123',
        sessionId: 'session-456',
        eventType: 'test',
        eventCategory: "'; DROP TABLE pf_user_events; --",
        properties: {
          data: "'; DELETE FROM pf_users WHERE '1'='1",
          nested: {
            sql: "1' OR '1'='1"
          }
        }
      };

      await analyticsService.trackEvent(maliciousEvent);
      await analyticsService.processEventBatch();

      // Verify the data is properly escaped when stored
      const storedEvent = mockUserAnalyticsRepository.insertEvents.mock.calls[0][0][0];
      expect(storedEvent.properties).toContain('DROP TABLE');
      // Properties should be JSON stringified, preventing SQL injection
      expect(typeof storedEvent.properties).toBe('string');
      expect(() => JSON.parse(storedEvent.properties)).not.toThrow();
    });

    it('should handle XSS attempts in event data', async () => {
      const xssEvent = {
        userId: 'user-123',
        sessionId: 'session-456',
        eventType: '<script>alert("XSS")</script>',
        eventLabel: '<img src=x onerror=alert(1)>',
        properties: {
          xss: '<iframe src="javascript:alert(document.cookie)">',
          svg: '<svg onload=alert(1)>'
        }
      };

      await analyticsService.trackEvent(xssEvent);
      
      const trackedEvent = analyticsService.eventQueue[0];
      // Event type should be stored as-is (sanitization happens on display)
      expect(trackedEvent.eventType).toBe('<script>alert("XSS")</script>');
      // Properties should be safely stringified
      expect(typeof trackedEvent.properties).toBe('string');
    });

    it('should limit properties object size to prevent DoS', async () => {
      const largeProperties = {};
      // Create a 10MB properties object
      for (let i = 0; i < 10000; i++) {
        largeProperties[`key_${i}`] = 'x'.repeat(1000);
      }

      const event = {
        userId: 'user-123',
        sessionId: 'session-456',
        eventType: 'test',
        properties: largeProperties
      };

      // Should either truncate or reject based on implementation
      await analyticsService.trackEvent(event);
      
      const trackedEvent = analyticsService.eventQueue[0];
      const propsSize = trackedEvent.properties.length;
      
      // Properties should be limited to a reasonable size (e.g., 1MB)
      expect(propsSize).toBeLessThan(1024 * 1024); // Less than 1MB
    });

    it('should prevent path traversal in OCI object names', async () => {
      const maliciousDate = {
        toISOString: () => '../../../etc/passwd'
      };

      const events = [{
        eventId: '1',
        userId: 'user-1',
        eventTimestamp: maliciousDate
      }];

      // Mock the repository to return our malicious events
      mockUserAnalyticsRepository.getEventsOlderThan.mockResolvedValue(events);

      await analyticsService.migrateToOCIColdStorage();

      // Check that the object name is sanitized
      if (mockObjectStorageClient.putObject.mock.calls.length > 0) {
        const objectName = mockObjectStorageClient.putObject.mock.calls[0][0].objectName;
        expect(objectName).not.toContain('..');
        expect(objectName).not.toContain('/etc/');
      }
    });
  });

  describe('Data Integrity', () => {
    it('should handle corrupted JSON in properties field', async () => {
      // Simulate corrupted data from database
      const corruptedEvent = {
        eventId: '1',
        userId: 'user-1',
        properties: '{invalid json}',
        eventTimestamp: new Date()
      };

      mockUserAnalyticsRepository.getUserEvents.mockResolvedValue([corruptedEvent]);

      const results = await analyticsService.queryAnalytics(
        'user-1',
        new Date('2024-01-01'),
        new Date()
      );

      // Should handle gracefully, either skip or return with null properties
      expect(results).toBeDefined();
      if (results.length > 0) {
        expect(results[0].properties).toBeNull();
      }
    });

    it('should validate event timestamps are not in the future', async () => {
      const futureEvent = {
        userId: 'user-123',
        sessionId: 'session-456',
        eventType: 'test',
        eventTimestamp: new Date('2030-01-01')
      };

      await analyticsService.trackEvent(futureEvent);
      
      const trackedEvent = analyticsService.eventQueue[0];
      const now = new Date();
      
      // Timestamp should be adjusted to current time or rejected
      expect(trackedEvent.eventTimestamp.getTime()).toBeLessThanOrEqual(now.getTime());
    });

    it('should handle duplicate event IDs gracefully', async () => {
      const duplicateId = ulid();
      const events = [
        { eventId: duplicateId, userId: 'user-1', sessionId: 's1', eventType: 'test1' },
        { eventId: duplicateId, userId: 'user-1', sessionId: 's1', eventType: 'test2' },
        { eventId: ulid(), userId: 'user-1', sessionId: 's1', eventType: 'test3' }
      ];

      analyticsService.eventQueue = events;
      await analyticsService.processEventBatch();

      // Should deduplicate before inserting
      const insertedEvents = mockUserAnalyticsRepository.insertEvents.mock.calls[0][0];
      const uniqueIds = new Set(insertedEvents.map(e => e.eventId));
      expect(uniqueIds.size).toBe(insertedEvents.length);
    });

    it('should handle null/undefined values in event data', async () => {
      const eventWithNulls = {
        userId: 'user-123',
        sessionId: 'session-456',
        eventType: 'test',
        eventCategory: null,
        eventLabel: undefined,
        eventValue: NaN,
        properties: {
          nullValue: null,
          undefinedValue: undefined,
          nanValue: NaN,
          infinityValue: Infinity
        }
      };

      await analyticsService.trackEvent(eventWithNulls);
      
      const trackedEvent = analyticsService.eventQueue[0];
      const properties = JSON.parse(trackedEvent.properties);
      
      // Should handle special values appropriately
      expect(properties.nullValue).toBeNull();
      expect(properties.nanValue).toBeNull(); // NaN should be converted to null
      expect(properties.infinityValue).toBeNull(); // Infinity should be converted to null
    });
  });

  describe('Concurrency and Race Conditions', () => {
    it('should handle concurrent event tracking without data loss', async () => {
      const promises = [];
      const eventCount = 1000;
      
      for (let i = 0; i < eventCount; i++) {
        promises.push(analyticsService.trackEvent({
          userId: `user-${i % 10}`,
          sessionId: `session-${i % 50}`,
          eventType: 'concurrent_test',
          eventValue: i
        }));
      }

      await Promise.all(promises);
      
      // All events should be in the queue
      expect(analyticsService.eventQueue.length).toBe(eventCount);
      
      // Check for duplicate or missing events
      const eventValues = analyticsService.eventQueue.map(e => e.eventValue);
      const uniqueValues = new Set(eventValues);
      expect(uniqueValues.size).toBe(eventCount);
    });

    it('should prevent race condition during batch processing', async () => {
      // Fill queue with initial events
      analyticsService.eventQueue = Array(100).fill(null).map((_, i) => ({
        eventId: `initial-${i}`,
        userId: 'user-1',
        sessionId: 'session-1',
        eventType: 'test'
      }));

      // Start batch processing
      const processPromise = analyticsService.processEventBatch();
      
      // Try to add more events during processing
      for (let i = 0; i < 50; i++) {
        analyticsService.eventQueue.push({
          eventId: `concurrent-${i}`,
          userId: 'user-2',
          sessionId: 'session-2',
          eventType: 'test'
        });
      }

      await processPromise;

      // New events added during processing should still be in queue
      expect(analyticsService.eventQueue.length).toBeGreaterThanOrEqual(50);
    });

    it('should handle simultaneous session updates', async () => {
      const sessionId = 'concurrent-session';
      
      // Create multiple concurrent updates to the same session
      const updates = [];
      for (let i = 0; i < 100; i++) {
        updates.push(analyticsService.trackPageView(
          sessionId,
          `/page-${i}`,
          `Page ${i}`
        ));
      }

      await Promise.all(updates);

      // All updates should be processed without data corruption
      const updateCalls = mockUserAnalyticsRepository.updateSession.mock.calls;
      expect(updateCalls.length).toBeGreaterThan(0);
    });

    it('should handle cache invalidation during concurrent reads', async () => {
      const userId = 'user-123';
      
      // Setup cache with initial data
      mockCacheService.get.mockResolvedValue({ data: 'cached' });
      
      // Start multiple reads
      const reads = [];
      for (let i = 0; i < 10; i++) {
        reads.push(analyticsService.getUserActivitySummary(userId));
      }
      
      // Invalidate cache during reads
      setTimeout(() => {
        mockCacheService.invalidate(`analytics:${userId}:*`);
      }, 10);
      
      const results = await Promise.all(reads);
      
      // All reads should complete successfully
      expect(results.every(r => r !== undefined)).toBe(true);
    });
  });

  describe('Session Edge Cases', () => {
    it('should handle session timeout after inactivity', async () => {
      const sessionId = 'timeout-session';
      const session = {
        sessionId,
        userId: 'user-123',
        sessionStart: new Date(Date.now() - 31 * 60 * 1000), // 31 minutes ago
        lastActivity: new Date(Date.now() - 31 * 60 * 1000),
        isActive: 'Y'
      };

      mockUserAnalyticsRepository.getSession.mockResolvedValue(session);

      // Try to track event on expired session
      await analyticsService.trackPageView(sessionId, '/page', 'Page');

      // Should either create new session or mark as expired
      const updateCalls = mockUserAnalyticsRepository.updateSession.mock.calls;
      if (updateCalls.length > 0) {
        const updateData = updateCalls[0][1];
        expect(updateData.isActive || updateData.sessionEnd).toBeDefined();
      }
    });

    it('should prevent session hijacking attempts', async () => {
      const validSession = {
        sessionId: 'valid-session',
        userId: 'user-123',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0 Valid'
      };

      await analyticsService.startSession(validSession);

      // Attempt to use session from different IP/UA
      const hijackAttempt = {
        userId: 'user-456', // Different user
        sessionId: 'valid-session', // Same session ID
        eventType: 'hijack_test',
        ipAddress: '10.0.0.1', // Different IP
        userAgent: 'Mozilla/5.0 Different'
      };

      await analyticsService.trackEvent(hijackAttempt);

      // Should either reject or create new session
      const events = analyticsService.eventQueue;
      if (events.length > 0) {
        expect(events[0].sessionId).not.toBe('valid-session');
      }
    });

    it('should handle invalid session IDs', async () => {
      const invalidSessions = [
        null,
        undefined,
        '',
        'a'.repeat(1000), // Too long
        '../etc/passwd', // Path traversal attempt
        '<script>alert(1)</script>', // XSS attempt
      ];

      for (const sessionId of invalidSessions) {
        const result = await analyticsService.trackEvent({
          userId: 'user-123',
          sessionId,
          eventType: 'test'
        }).catch(e => e);

        // Should either sanitize or reject
        if (result instanceof Error) {
          expect(result.message).toContain('session');
        } else {
          expect(result.eventId).toBeDefined();
        }
      }
    });
  });

  describe('OCI Storage Edge Cases', () => {
    it('should handle partial upload failure and retry', async () => {
      let attemptCount = 0;
      mockObjectStorageClient.putObject.mockImplementation(() => {
        attemptCount++;
        if (attemptCount < 3) {
          const error = new Error('Network timeout');
          error.code = 'ETIMEDOUT';
          return Promise.reject(error);
        }
        return Promise.resolve({ eTag: 'success' });
      });

      const events = [{
        eventId: '1',
        userId: 'user-1',
        eventTimestamp: new Date('2024-10-01')
      }];

      mockUserAnalyticsRepository.getEventsOlderThan.mockResolvedValue(events);

      // Should retry and eventually succeed
      await expect(analyticsService.migrateToOCIColdStorage()).resolves.not.toThrow();
      expect(attemptCount).toBeGreaterThanOrEqual(3);
    });

    it('should handle storage quota exceeded', async () => {
      mockObjectStorageClient.putObject.mockRejectedValue({
        statusCode: 507,
        message: 'Insufficient Storage'
      });

      const events = Array(1000).fill(null).map((_, i) => ({
        eventId: `event-${i}`,
        userId: 'user-1',
        eventTimestamp: new Date('2024-10-01')
      }));

      mockUserAnalyticsRepository.getEventsOlderThan.mockResolvedValue(events);

      await expect(analyticsService.migrateToOCIColdStorage())
        .rejects.toMatchObject({ statusCode: 507 });

      // Events should not be deleted from hot storage
      expect(mockUserAnalyticsRepository.deleteEventsByDate).not.toHaveBeenCalled();
    });

    it('should handle compression that increases file size', async () => {
      // Create data that doesn't compress well (random data)
      const randomData = Array(1000).fill(null).map(() => ({
        eventId: Math.random().toString(36),
        randomValue: Math.random()
      }));

      const originalSize = JSON.stringify(randomData).length;
      const compressed = await analyticsService.compressData(randomData);
      
      // If compression doesn't help, should handle gracefully
      if (compressed.length >= originalSize) {
        // Implementation should either use uncompressed or flag it
        expect(compressed).toBeDefined();
      }
    });

    it('should handle bucket permission changes during operation', async () => {
      let callCount = 0;
      mockObjectStorageClient.putObject.mockImplementation(() => {
        callCount++;
        if (callCount === 2) {
          return Promise.reject({
            statusCode: 403,
            message: 'Access Denied'
          });
        }
        return Promise.resolve({ eTag: 'success' });
      });

      const events = [
        { eventId: '1', userId: 'user-1', eventTimestamp: new Date('2024-10-01') },
        { eventId: '2', userId: 'user-1', eventTimestamp: new Date('2024-10-02') },
        { eventId: '3', userId: 'user-1', eventTimestamp: new Date('2024-10-03') }
      ];

      mockUserAnalyticsRepository.getEventsOlderThan.mockResolvedValue(events);

      await expect(analyticsService.migrateToOCIColdStorage())
        .rejects.toMatchObject({ statusCode: 403 });

      // Should have attempted but failed on permission error
      expect(callCount).toBe(2);
    });
  });

  describe('Performance Boundaries', () => {
    it('should handle exactly maxQueueSize events', async () => {
      const maxSize = analyticsService.maxQueueSize;
      
      // Fill queue to exactly max size
      for (let i = 0; i < maxSize; i++) {
        analyticsService.eventQueue.push({
          eventId: `max-${i}`,
          userId: 'user-1',
          eventType: 'test'
        });
      }

      // Should accept one more event (at exactly max)
      await expect(analyticsService.trackEvent({
        userId: 'user-1',
        sessionId: 'session-1',
        eventType: 'test'
      })).rejects.toThrow('queue at capacity');
    });

    it('should maintain performance with 1 million events in storage', async () => {
      const largeEventSet = Array(1000000).fill(null).map((_, i) => ({
        eventId: `perf-${i}`,
        userId: `user-${i % 1000}`,
        eventType: 'test',
        eventTimestamp: new Date('2024-10-01')
      }));

      // Mock large dataset retrieval
      mockUserAnalyticsRepository.getEventsOlderThan.mockImplementation(() => {
        // Simulate delay for large query
        return new Promise(resolve => {
          setTimeout(() => resolve(largeEventSet.slice(0, 10000)), 100);
        });
      });

      const startTime = Date.now();
      await analyticsService.migrateToOCIColdStorage();
      const duration = Date.now() - startTime;

      // Should complete in reasonable time even with large dataset
      expect(duration).toBeLessThan(30000); // 30 seconds max
    });

    it('should handle memory efficiently during aggregation', async () => {
      const largeEventSet = Array(100000).fill(null).map((_, i) => ({
        userId: `user-${i % 100}`,
        sessionId: `session-${i % 1000}`,
        eventType: i % 2 === 0 ? 'page_view' : 'click',
        eventTimestamp: new Date(),
        pageUrl: `/page-${i % 50}`,
        properties: JSON.stringify({ index: i })
      }));

      mockUserAnalyticsRepository.getEventsByDateRange.mockResolvedValue(largeEventSet);

      const memBefore = process.memoryUsage().heapUsed;
      await analyticsService.aggregateDailyMetrics(new Date());
      const memAfter = process.memoryUsage().heapUsed;

      // Memory increase should be reasonable (< 100MB for 100k events)
      const memIncrease = (memAfter - memBefore) / 1024 / 1024;
      expect(memIncrease).toBeLessThan(100);
    });
  });

  describe('Timezone and Locale Handling', () => {
    it('should handle events from different timezones correctly', async () => {
      const events = [
        {
          userId: 'user-1',
          sessionId: 'session-1',
          eventType: 'test',
          eventTimestamp: new Date('2025-01-15T00:00:00Z'), // UTC
          properties: { timezone: 'UTC' }
        },
        {
          userId: 'user-1',
          sessionId: 'session-2',
          eventType: 'test',
          eventTimestamp: new Date('2025-01-15T00:00:00-08:00'), // PST (8 hours behind)
          properties: { timezone: 'PST' }
        },
        {
          userId: 'user-1',
          sessionId: 'session-3',
          eventType: 'test',
          eventTimestamp: new Date('2025-01-15T00:00:00+09:00'), // JST (9 hours ahead)
          properties: { timezone: 'JST' }
        }
      ];

      for (const event of events) {
        await analyticsService.trackEvent(event);
      }

      // All events should be stored with consistent timezone handling
      expect(analyticsService.eventQueue.length).toBe(3);
      
      // Check that timestamps are properly converted
      const timestamps = analyticsService.eventQueue.map(e => e.eventTimestamp.getTime());
      // The PST and JST events are actually at different UTC times
      expect(new Set(timestamps).size).toBeGreaterThan(1);
    });

    it('should handle daylight saving time transitions', async () => {
      // Test event right before DST transition
      const beforeDST = new Date('2025-03-09T01:59:59-08:00'); // PST
      const afterDST = new Date('2025-03-09T03:00:01-07:00'); // PDT

      await analyticsService.trackEvent({
        userId: 'user-1',
        sessionId: 'session-1',
        eventType: 'before_dst',
        eventTimestamp: beforeDST
      });

      await analyticsService.trackEvent({
        userId: 'user-1',
        sessionId: 'session-1',
        eventType: 'after_dst',
        eventTimestamp: afterDST
      });

      // Both events should be tracked correctly
      expect(analyticsService.eventQueue.length).toBe(2);
      
      // Time difference should account for DST
      const timeDiff = analyticsService.eventQueue[1].eventTimestamp.getTime() - 
                       analyticsService.eventQueue[0].eventTimestamp.getTime();
      
      // Should be approximately 2 seconds (not 1 hour and 2 seconds)
      expect(timeDiff).toBeLessThan(60000); // Less than 1 minute
    });
  });

  describe('Unicode and Special Characters', () => {
    it('should handle various Unicode characters in event data', async () => {
      const unicodeEvent = {
        userId: 'user-123',
        sessionId: 'session-456',
        eventType: 'unicode_test',
        eventLabel: '🎉 Emoji 你好 مرحبا שלום',
        properties: {
          emoji: '😀😃😄😁😆😅😂🤣',
          chinese: '你好世界',
          arabic: 'مرحبا بالعالم',
          hebrew: 'שלום עולם',
          russian: 'Привет мир',
          japanese: 'こんにちは世界',
          special: '™️®️©️€£¥₹',
          math: '∑∏∫√∞≈≠±×÷'
        }
      };

      await analyticsService.trackEvent(unicodeEvent);
      await analyticsService.processEventBatch();

      const storedEvent = mockUserAnalyticsRepository.insertEvents.mock.calls[0][0][0];
      const properties = JSON.parse(storedEvent.properties);
      
      // All Unicode should be preserved
      expect(properties.emoji).toBe('😀😃😄😁😆😅😂🤣');
      expect(properties.chinese).toBe('你好世界');
      expect(properties.arabic).toBe('مرحبا بالعالم');
    });

    it('should handle control characters and escape sequences', async () => {
      const controlEvent = {
        userId: 'user-123',
        sessionId: 'session-456',
        eventType: 'control_test',
        properties: {
          newline: 'line1\nline2',
          tab: 'col1\tcol2',
          carriageReturn: 'text\roverwrite',
          backspace: 'text\b\b',
          nullChar: 'text\0end',
          escape: 'text\x1B[31mred',
          verticalTab: 'text\vtext',
          formFeed: 'text\ftext'
        }
      };

      await analyticsService.trackEvent(controlEvent);
      
      const trackedEvent = analyticsService.eventQueue[0];
      const properties = JSON.parse(trackedEvent.properties);
      
      // Control characters should be preserved in JSON
      expect(properties.newline).toContain('\n');
      expect(properties.tab).toContain('\t');
    });

    it('should handle zero-width characters', async () => {
      const zeroWidthEvent = {
        userId: 'user-123',
        sessionId: 'session-456',
        eventType: 'zero_width_test',
        properties: {
          zeroWidthSpace: 'text\u200Btext',
          zeroWidthJoiner: 'text\u200Dtext',
          zeroWidthNonJoiner: 'text\u200Ctext',
          leftToRightMark: 'text\u200Etext',
          rightToLeftMark: 'text\u200Ftext'
        }
      };

      await analyticsService.trackEvent(zeroWidthEvent);
      
      const trackedEvent = analyticsService.eventQueue[0];
      const properties = JSON.parse(trackedEvent.properties);
      
      // Zero-width characters should be preserved
      expect(properties.zeroWidthSpace).toContain('\u200B');
    });
  });
});