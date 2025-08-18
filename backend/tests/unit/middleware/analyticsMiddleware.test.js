const analyticsMiddleware = require('../../../src/middleware/analyticsMiddleware');
const UserAnalyticsService = require('../../../src/services/userAnalyticsService');

describe('Analytics Middleware', () => {
  let req, res, next;
  let mockAnalyticsService;
  let middleware;

  beforeEach(() => {
    // Mock request object
    req = {
      method: 'GET',
      originalUrl: '/api/users/profile',
      path: '/api/users/profile',
      params: {},
      query: {},
      headers: {
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        'x-forwarded-for': '192.168.1.1',
        'referer': 'https://example.com/dashboard'
      },
      body: {},
      user: {
        userId: 'user-123',
        username: 'testuser'
      },
      session: {
        sessionId: 'session-456'
      },
      ip: '192.168.1.1'
    };

    // Mock response object
    res = {
      statusCode: 200,
      locals: {},
      on: jest.fn(),
      end: jest.fn(),
      json: jest.fn(),
      send: jest.fn(),
      status: jest.fn().mockReturnThis()
    };

    // Mock next function
    next = jest.fn();

    // Mock analytics service
    mockAnalyticsService = {
      trackEvent: jest.fn().mockResolvedValue({ eventId: 'event-123' }),
      trackPageView: jest.fn(),
      trackApiCall: jest.fn(),
      trackError: jest.fn(),
      trackPerformance: jest.fn(),
      updateSession: jest.fn()
    };

    // Create middleware instance
    middleware = analyticsMiddleware(mockAnalyticsService);
  });

  describe('Event Tracking', () => {
    it('should track page view for GET requests to pages', async () => {
      req.originalUrl = '/dashboard';
      req.headers['accept'] = 'text/html';

      await middleware.trackPageView(req, res, next);

      expect(mockAnalyticsService.trackEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-123',
          sessionId: 'session-456',
          eventType: 'page_view',
          eventCategory: 'navigation',
          pageUrl: '/dashboard',
          referrer: 'https://example.com/dashboard',
          userAgent: expect.any(String),
          ipAddress: '192.168.1.1'
        })
      );
      expect(next).toHaveBeenCalled();
    });

    it('should track API calls', async () => {
      req.method = 'POST';
      req.originalUrl = '/api/experiences';
      
      await middleware.trackApiCall(req, res, next);

      expect(mockAnalyticsService.trackEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'api_call',
          eventCategory: 'api',
          eventAction: 'POST',
          eventLabel: '/api/experiences'
        })
      );
      expect(next).toHaveBeenCalled();
    });

    it('should track feature usage from custom headers', async () => {
      req.headers['x-feature'] = 'resume-builder';
      req.headers['x-feature-action'] = 'generate';

      await middleware.trackFeatureUsage(req, res, next);

      expect(mockAnalyticsService.trackEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'feature_usage',
          eventCategory: 'feature',
          eventLabel: 'resume-builder',
          eventAction: 'generate'
        })
      );
      expect(next).toHaveBeenCalled();
    });

    it('should skip tracking for static assets', async () => {
      req.originalUrl = '/static/css/main.css';

      await middleware.trackPageView(req, res, next);

      expect(mockAnalyticsService.trackEvent).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
    });

    it('should skip tracking for health check endpoints', async () => {
      req.originalUrl = '/health';

      await middleware.trackApiCall(req, res, next);

      expect(mockAnalyticsService.trackEvent).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
    });

    it('should handle anonymous users', async () => {
      req.user = null;
      req.session = { sessionId: 'anon-session-789' };

      await middleware.trackPageView(req, res, next);

      expect(mockAnalyticsService.trackEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'anonymous',
          sessionId: 'anon-session-789'
        })
      );
      expect(next).toHaveBeenCalled();
    });

    it('should extract device information from user agent', async () => {
      req.headers['user-agent'] = 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)';

      await middleware.trackPageView(req, res, next);

      expect(mockAnalyticsService.trackEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          properties: expect.objectContaining({
            deviceType: 'mobile',
            os: 'iOS',
            browser: 'Safari'
          })
        })
      );
    });
  });

  describe('Error Tracking', () => {
    it('should track errors when they occur', async () => {
      const error = new Error('Test error');
      error.status = 500;

      await middleware.trackError(error, req, res, next);

      expect(mockAnalyticsService.trackEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'error',
          eventCategory: 'system',
          eventAction: 'exception',
          properties: expect.objectContaining({
            message: 'Test error',
            statusCode: 500,
            stack: expect.any(String),
            url: '/api/users/profile',
            method: 'GET'
          })
        })
      );
      expect(next).toHaveBeenCalledWith(error);
    });

    it('should track 404 errors', async () => {
      res.statusCode = 404;

      await middleware.track404(req, res, next);

      expect(mockAnalyticsService.trackEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'error',
          eventCategory: 'navigation',
          eventAction: 'not_found',
          eventLabel: '/api/users/profile'
        })
      );
      expect(next).toHaveBeenCalled();
    });

    it('should track validation errors', async () => {
      const error = new Error('Validation failed');
      error.status = 400;
      error.validationErrors = [
        { field: 'email', message: 'Invalid email format' }
      ];

      await middleware.trackError(error, req, res, next);

      expect(mockAnalyticsService.trackEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'error',
          eventCategory: 'validation',
          properties: expect.objectContaining({
            validationErrors: expect.any(Array)
          })
        })
      );
    });

    it('should sanitize sensitive data from error tracking', async () => {
      const error = new Error('Database error');
      req.body = {
        password: 'secret123',
        email: 'user@example.com',
        name: 'John Doe'
      };

      await middleware.trackError(error, req, res, next);

      const trackedEvent = mockAnalyticsService.trackEvent.mock.calls[0][0];
      expect(trackedEvent.properties.body).not.toContain('secret123');
      expect(trackedEvent.properties.body.password).toBeUndefined();
    });
  });

  describe('Performance Tracking', () => {
    it('should track response time for API calls', async () => {
      const startTime = Date.now();
      req.startTime = startTime;

      // Simulate response ending
      res.on.mockImplementation((event, callback) => {
        if (event === 'finish') {
          // Simulate 150ms response time
          req.startTime = startTime - 150;
          callback();
        }
      });

      await middleware.trackPerformance(req, res, next);

      expect(res.on).toHaveBeenCalledWith('finish', expect.any(Function));
      
      // Trigger the finish event
      const finishCallback = res.on.mock.calls.find(call => call[0] === 'finish')[1];
      finishCallback();

      expect(mockAnalyticsService.trackEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'timing',
          eventCategory: 'performance',
          eventAction: 'response_time',
          eventValue: expect.any(Number)
        })
      );
      expect(next).toHaveBeenCalled();
    });

    it('should track slow requests', async () => {
      req.startTime = Date.now() - 3000; // 3 second response time

      res.on.mockImplementation((event, callback) => {
        if (event === 'finish') callback();
      });

      await middleware.trackPerformance(req, res, next);

      const finishCallback = res.on.mock.calls.find(call => call[0] === 'finish')[1];
      finishCallback();

      expect(mockAnalyticsService.trackEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'timing',
          eventCategory: 'performance',
          eventAction: 'slow_request',
          properties: expect.objectContaining({
            threshold: 2000,
            actualTime: expect.any(Number)
          })
        })
      );
    });

    it('should track memory usage for high-memory operations', async () => {
      // Mock process.memoryUsage
      const originalMemoryUsage = process.memoryUsage;
      process.memoryUsage = jest.fn().mockReturnValue({
        heapUsed: 500 * 1024 * 1024, // 500MB
        heapTotal: 1024 * 1024 * 1024, // 1GB
        external: 50 * 1024 * 1024,
        rss: 600 * 1024 * 1024
      });

      await middleware.trackMemoryUsage(req, res, next);

      expect(mockAnalyticsService.trackEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'performance',
          eventCategory: 'system',
          eventAction: 'high_memory_usage',
          properties: expect.objectContaining({
            heapUsedMB: expect.any(Number),
            heapPercentage: expect.any(Number)
          })
        })
      );

      process.memoryUsage = originalMemoryUsage;
      expect(next).toHaveBeenCalled();
    });
  });

  describe('Session Tracking', () => {
    it('should update session activity on each request', async () => {
      await middleware.trackSessionActivity(req, res, next);

      expect(mockAnalyticsService.updateSession).toHaveBeenCalledWith(
        'session-456',
        expect.objectContaining({
          lastActivity: expect.any(Date),
          pageCount: expect.any(Number),
          eventCount: expect.any(Number)
        })
      );
      expect(next).toHaveBeenCalled();
    });

    it('should track session duration', async () => {
      req.session.startTime = Date.now() - 300000; // 5 minutes ago

      await middleware.trackSessionDuration(req, res, next);

      expect(mockAnalyticsService.trackEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'session',
          eventCategory: 'engagement',
          eventAction: 'duration_update',
          eventValue: 300 // 300 seconds
        })
      );
      expect(next).toHaveBeenCalled();
    });

    it('should detect and track new sessions', async () => {
      req.session.isNew = true;

      await middleware.trackNewSession(req, res, next);

      expect(mockAnalyticsService.trackEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'session_start',
          eventCategory: 'engagement',
          properties: expect.objectContaining({
            referrer: 'https://example.com/dashboard',
            entryPage: '/api/users/profile'
          })
        })
      );
      expect(next).toHaveBeenCalled();
    });

    it('should track session end on logout', async () => {
      req.originalUrl = '/api/auth/logout';
      req.method = 'POST';

      await middleware.trackSessionEnd(req, res, next);

      expect(mockAnalyticsService.trackEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'session_end',
          eventCategory: 'engagement',
          eventAction: 'logout'
        })
      );
      expect(next).toHaveBeenCalled();
    });
  });

  describe('Custom Event Tracking', () => {
    it('should track custom events from request body', async () => {
      req.method = 'POST';
      req.originalUrl = '/api/analytics/track';
      req.body = {
        eventType: 'button_click',
        eventCategory: 'ui',
        eventAction: 'submit_form',
        eventLabel: 'contact_form',
        eventValue: 1,
        properties: {
          formId: 'contact-123',
          fieldsCompleted: 5
        }
      };

      await middleware.trackCustomEvent(req, res, next);

      expect(mockAnalyticsService.trackEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-123',
          sessionId: 'session-456',
          eventType: 'button_click',
          eventCategory: 'ui',
          eventAction: 'submit_form',
          eventLabel: 'contact_form',
          eventValue: 1,
          properties: expect.objectContaining({
            formId: 'contact-123',
            fieldsCompleted: 5
          })
        })
      );
      expect(next).toHaveBeenCalled();
    });

    it('should validate custom event data', async () => {
      req.body = {
        // Missing required eventType
        eventCategory: 'ui'
      };

      await middleware.trackCustomEvent(req, res, next);

      expect(mockAnalyticsService.trackEvent).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('eventType is required')
        })
      );
    });

    it('should limit custom event properties size', async () => {
      req.body = {
        eventType: 'test',
        properties: {
          largeData: 'x'.repeat(10000) // Very large string
        }
      };

      await middleware.trackCustomEvent(req, res, next);

      const trackedEvent = mockAnalyticsService.trackEvent.mock.calls[0][0];
      expect(JSON.stringify(trackedEvent.properties).length).toBeLessThan(5000);
    });
  });

  describe('Conversion Tracking', () => {
    it('should track signup conversions', async () => {
      req.method = 'POST';
      req.originalUrl = '/api/auth/register';
      res.statusCode = 201;

      res.on.mockImplementation((event, callback) => {
        if (event === 'finish') callback();
      });

      await middleware.trackConversion(req, res, next);

      const finishCallback = res.on.mock.calls.find(call => call[0] === 'finish')[1];
      finishCallback();

      expect(mockAnalyticsService.trackEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'conversion',
          eventCategory: 'engagement',
          eventAction: 'signup',
          eventValue: 1
        })
      );
      expect(next).toHaveBeenCalled();
    });

    it('should track purchase conversions', async () => {
      req.method = 'POST';
      req.originalUrl = '/api/purchases';
      req.body = {
        amount: 99.99,
        productId: 'prod-123'
      };
      res.statusCode = 200;

      res.on.mockImplementation((event, callback) => {
        if (event === 'finish') callback();
      });

      await middleware.trackConversion(req, res, next);

      const finishCallback = res.on.mock.calls.find(call => call[0] === 'finish')[1];
      finishCallback();

      expect(mockAnalyticsService.trackEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'conversion',
          eventCategory: 'revenue',
          eventAction: 'purchase',
          eventValue: 99.99,
          properties: expect.objectContaining({
            productId: 'prod-123'
          })
        })
      );
    });

    it('should track goal completions', async () => {
      req.method = 'POST';
      req.originalUrl = '/api/goals/complete';
      req.body = {
        goalId: 'goal-123',
        goalType: 'profile_completion'
      };

      await middleware.trackGoalCompletion(req, res, next);

      expect(mockAnalyticsService.trackEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'goal_completion',
          eventCategory: 'engagement',
          eventAction: 'complete',
          eventLabel: 'profile_completion',
          properties: expect.objectContaining({
            goalId: 'goal-123'
          })
        })
      );
      expect(next).toHaveBeenCalled();
    });
  });

  describe('Middleware Configuration', () => {
    it('should respect tracking disabled flag', async () => {
      req.headers['x-do-not-track'] = '1';

      await middleware.trackPageView(req, res, next);

      expect(mockAnalyticsService.trackEvent).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
    });

    it('should respect excluded paths configuration', async () => {
      const excludedPaths = ['/api/admin', '/api/internal'];
      middleware = analyticsMiddleware(mockAnalyticsService, {
        excludePaths: excludedPaths
      });

      req.originalUrl = '/api/admin/users';

      await middleware.trackApiCall(req, res, next);

      expect(mockAnalyticsService.trackEvent).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
    });

    it('should sample events based on configuration', async () => {
      middleware = analyticsMiddleware(mockAnalyticsService, {
        samplingRate: 0.5 // 50% sampling
      });

      // Mock Math.random to control sampling
      const originalRandom = Math.random;
      
      // Should track (random < 0.5)
      Math.random = jest.fn().mockReturnValue(0.3);
      await middleware.trackPageView(req, res, next);
      expect(mockAnalyticsService.trackEvent).toHaveBeenCalled();

      mockAnalyticsService.trackEvent.mockClear();

      // Should not track (random >= 0.5)
      Math.random = jest.fn().mockReturnValue(0.7);
      await middleware.trackPageView(req, res, next);
      expect(mockAnalyticsService.trackEvent).not.toHaveBeenCalled();

      Math.random = originalRandom;
    });

    it('should batch events when configured', async () => {
      middleware = analyticsMiddleware(mockAnalyticsService, {
        batching: true,
        batchSize: 10,
        batchInterval: 1000
      });

      // Track multiple events
      for (let i = 0; i < 5; i++) {
        await middleware.trackPageView(req, res, next);
      }

      // Events should be queued, not sent immediately
      expect(mockAnalyticsService.trackEvent).not.toHaveBeenCalled();

      // Fast-forward time to trigger batch send
      jest.advanceTimersByTime(1000);

      // Now events should be sent
      expect(mockAnalyticsService.trackEvent).toHaveBeenCalledTimes(5);
    });
  });

  describe('Privacy and Compliance', () => {
    it('should anonymize IP addresses when configured', async () => {
      middleware = analyticsMiddleware(mockAnalyticsService, {
        anonymizeIp: true
      });

      req.ip = '192.168.1.123';

      await middleware.trackPageView(req, res, next);

      expect(mockAnalyticsService.trackEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          ipAddress: '192.168.1.0' // Last octet anonymized
        })
      );
    });

    it('should respect GDPR consent', async () => {
      req.cookies = {
        gdpr_consent: 'false'
      };

      await middleware.trackPageView(req, res, next);

      expect(mockAnalyticsService.trackEvent).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
    });

    it('should exclude PII from tracking', async () => {
      req.body = {
        email: 'user@example.com',
        ssn: '123-45-6789',
        creditCard: '4111111111111111',
        name: 'John Doe'
      };

      await middleware.trackCustomEvent(req, res, next);

      const trackedEvent = mockAnalyticsService.trackEvent.mock.calls[0][0];
      expect(trackedEvent.properties).not.toHaveProperty('ssn');
      expect(trackedEvent.properties).not.toHaveProperty('creditCard');
      expect(trackedEvent.properties.email).toBe('[REDACTED]');
    });
  });

  describe('Error Handling', () => {
    it('should not block request on tracking failure', async () => {
      mockAnalyticsService.trackEvent.mockRejectedValue(new Error('Tracking failed'));

      await middleware.trackPageView(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(next).not.toHaveBeenCalledWith(expect.any(Error));
    });

    it('should log tracking errors', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      mockAnalyticsService.trackEvent.mockRejectedValue(new Error('Tracking failed'));

      await middleware.trackPageView(req, res, next);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Analytics tracking error'),
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('should handle missing analytics service gracefully', async () => {
      middleware = analyticsMiddleware(null);

      await middleware.trackPageView(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(next).not.toHaveBeenCalledWith(expect.any(Error));
    });
  });
});