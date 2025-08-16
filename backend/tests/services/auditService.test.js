const { AuditService, createAuditMiddleware } = require('../../src/services/auditService');
const crypto = require('crypto');

describe('AuditService', () => {
  let auditService;
  let mockDb;
  let mockConfig;

  beforeEach(() => {
    // Mock database
    mockDb = {
      execute: jest.fn().mockResolvedValue({ rows: [] }),
      query: jest.fn().mockResolvedValue({ rows: [] })
    };

    // Mock config
    mockConfig = {
      auditFlushInterval: 100, // Short interval for testing
      bufferSize: 10,
      appName: 'test-app',
      appVersion: '1.0.0'
    };

    // Create service instance
    auditService = new AuditService(mockDb, mockConfig);

    // Clear any intervals to prevent test interference
    clearInterval(auditService.flushInterval);
  });

  afterEach(() => {
    // Clean up
    if (auditService) {
      auditService.shutdown();
    }
  });

  describe('Event Logging', () => {
    test('should validate required fields', async () => {
      const invalidEvent = {
        event_type: 'authentication'
        // Missing required fields
      };

      await expect(auditService.log(invalidEvent))
        .rejects.toThrow('Missing required audit field');
    });

    test('should enrich events with context', async () => {
      const event = {
        event_type: 'authentication',
        event_category: 'security',
        event_severity: 'info',
        event_name: 'User Login',
        action: 'login',
        action_result: 'success'
      };

      const eventId = await auditService.log(event);

      expect(eventId).toBeDefined();
      expect(auditService.buffer.length).toBe(1);

      const enrichedEvent = auditService.buffer[0];
      expect(enrichedEvent.id).toBeDefined();
      expect(enrichedEvent.event_timestamp).toBeDefined();
      expect(enrichedEvent.event_id).toMatch(/^EVT_/);
      expect(enrichedEvent.application_name).toBe('test-app');
      expect(enrichedEvent.event_hash).toBeDefined();
    });

    test('should calculate event hash for integrity', async () => {
      const event = {
        event_type: 'data_modification',
        event_category: 'data',
        event_severity: 'info',
        event_name: 'Record Update',
        action: 'update',
        action_result: 'success',
        actor_id: 'user123'
      };

      await auditService.log(event);
      const loggedEvent = auditService.buffer[0];

      expect(loggedEvent.event_hash).toBeDefined();
      expect(loggedEvent.event_hash).toHaveLength(64); // SHA-256 hex length
    });

    test('should maintain hash chain for integrity', async () => {
      const event1 = {
        event_type: 'authentication',
        event_category: 'security',
        event_severity: 'info',
        event_name: 'Login',
        action: 'login',
        action_result: 'success'
      };

      const event2 = {
        event_type: 'data_access',
        event_category: 'data',
        event_severity: 'info',
        event_name: 'Read',
        action: 'read',
        action_result: 'success'
      };

      await auditService.log(event1);
      const firstHash = auditService.buffer[0].event_hash;

      await auditService.log(event2);
      const secondEvent = auditService.buffer[1];

      expect(secondEvent.previous_hash).toBe(firstHash);
    });

    test('should classify data sensitivity correctly', () => {
      const restrictedEvent = {
        target_table: 'pf_users'
      };
      expect(auditService.classifyDataSensitivity(restrictedEvent)).toBe('restricted');

      const confidentialEvent = {
        target_table: 'experiences_detailed'
      };
      expect(auditService.classifyDataSensitivity(confidentialEvent)).toBe('confidential');

      const authEvent = {
        event_type: 'authentication'
      };
      expect(auditService.classifyDataSensitivity(authEvent)).toBe('confidential');

      const generalEvent = {
        target_table: 'some_other_table'
      };
      expect(auditService.classifyDataSensitivity(generalEvent)).toBe('internal');
    });

    test('should add compliance tags', () => {
      const hipaaEvent = {
        target_table: 'experiences_detailed'
      };
      expect(auditService.getComplianceTags(hipaaEvent)).toContain('HIPAA');

      const gdprEvent = {
        target_table: 'pf_users',
        action: 'delete'
      };
      const gdprTags = auditService.getComplianceTags(gdprEvent);
      expect(gdprTags).toContain('HIPAA');
      expect(gdprTags).toContain('GDPR');

      const soc2Event = {
        event_type: 'authentication'
      };
      expect(auditService.getComplianceTags(soc2Event)).toContain('SOC2');
    });
  });

  describe('Risk Scoring', () => {
    test('should calculate risk score for authentication failures', async () => {
      const event = {
        event_type: 'authentication',
        action_result: 'failure',
        actor_id: 'user123'
      };

      mockDb.execute.mockResolvedValueOnce({ 
        rows: [{ failure_count: 5 }] 
      });

      const score = await auditService.calculateRiskScore(event);
      expect(score).toBeGreaterThanOrEqual(20); // Base score for auth failure
      expect(score).toBeLessThanOrEqual(100);
    });

    test('should increase risk score for sensitive data access', async () => {
      const event = {
        event_type: 'data_access',
        data_sensitivity: 'restricted',
        action_result: 'success'
      };

      const score = await auditService.calculateRiskScore(event);
      expect(score).toBeGreaterThanOrEqual(25); // Score for restricted data
    });

    test('should increase risk score for off-hours access', async () => {
      const nightEvent = {
        event_type: 'data_access',
        event_timestamp: new Date('2024-01-01T03:00:00'), // 3 AM
        action_result: 'success'
      };

      const score = await auditService.calculateRiskScore(nightEvent);
      expect(score).toBeGreaterThanOrEqual(10); // Off-hours bonus
    });

    test('should increase risk score for admin actions', async () => {
      const adminEvent = {
        event_type: 'configuration',
        actor_roles: JSON.stringify(['admin']),
        action_result: 'success'
      };

      const score = await auditService.calculateRiskScore(adminEvent);
      expect(score).toBeGreaterThanOrEqual(15); // Admin action bonus
    });

    test('should cap risk score at 100', async () => {
      const highRiskEvent = {
        event_type: 'authentication',
        action_result: 'failure',
        data_sensitivity: 'restricted',
        action: 'delete',
        actor_roles: JSON.stringify(['admin']),
        event_timestamp: new Date('2024-01-01T03:00:00')
      };

      mockDb.execute.mockResolvedValueOnce({ 
        rows: [{ failure_count: 20 }] 
      });

      const score = await auditService.calculateRiskScore(highRiskEvent);
      expect(score).toBe(100);
    });
  });

  describe('Critical Event Detection', () => {
    test('should detect brute force attempts', () => {
      const bruteForceEvent = {
        event_type: 'authentication',
        action_result: 'failure',
        risk_score: 60
      };

      expect(auditService.isCriticalEvent(bruteForceEvent)).toBe(true);
    });

    test('should detect admin access failures', () => {
      const adminFailure = {
        event_type: 'authorization',
        action_result: 'failure',
        action: 'admin_access'
      };

      expect(auditService.isCriticalEvent(adminFailure)).toBe(true);
    });

    test('should detect user deletion', () => {
      const userDeletion = {
        target_table: 'pf_users',
        action: 'delete'
      };

      expect(auditService.isCriticalEvent(userDeletion)).toBe(true);
    });

    test('should detect high severity events', () => {
      const criticalEvent = {
        event_type: 'security',
        event_severity: 'critical'
      };

      expect(auditService.isCriticalEvent(criticalEvent)).toBe(true);
    });

    test('should detect high risk score events', () => {
      const highRiskEvent = {
        risk_score: 85
      };

      expect(auditService.isCriticalEvent(highRiskEvent)).toBe(true);
    });

    test('should handle critical events', async () => {
      const criticalEvent = {
        id: 'test-id',
        event_type: 'security',
        event_severity: 'critical',
        risk_score: 90,
        event_name: 'Critical Security Event'
      };

      const alertSpy = jest.spyOn(auditService, 'sendSecurityAlert')
        .mockResolvedValue();

      await auditService.handleCriticalEvent(criticalEvent);

      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO pf_audit_critical_events'),
        expect.objectContaining({
          audit_log_id: 'test-id',
          threat_type: expect.any(String),
          threat_level: 'critical'
        })
      );

      expect(alertSpy).toHaveBeenCalled();
    });
  });

  describe('Buffer Management', () => {
    test('should flush buffer when size limit reached', async () => {
      auditService.config.bufferSize = 3;
      const flushSpy = jest.spyOn(auditService, 'flush');

      for (let i = 0; i < 4; i++) {
        await auditService.log({
          event_type: 'test',
          event_category: 'test',
          event_severity: 'info',
          event_name: `Event ${i}`,
          action: 'test',
          action_result: 'success'
        });
      }

      expect(flushSpy).toHaveBeenCalled();
    });

    test('should flush immediately for critical events', async () => {
      const flushSpy = jest.spyOn(auditService, 'flush');

      await auditService.log({
        event_type: 'security',
        event_category: 'security',
        event_severity: 'critical',
        event_name: 'Critical Event',
        action: 'test',
        action_result: 'failure'
      });

      expect(flushSpy).toHaveBeenCalled();
    });

    test('should batch insert events', async () => {
      const events = [
        {
          id: '1',
          event_type: 'test',
          event_timestamp: new Date()
        },
        {
          id: '2',
          event_type: 'test',
          event_timestamp: new Date()
        }
      ];

      await auditService.batchInsertAuditLogs(events);

      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO pf_audit_log'),
        expect.any(Object)
      );
    });
  });

  describe('Query Methods', () => {
    test('should build query with filters', () => {
      const filters = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        eventType: 'authentication',
        actorId: 'user123',
        minRiskScore: 50,
        limit: 100
      };

      const { sql, bindings } = auditService.buildAuditQuery(filters);

      expect(sql).toContain('event_timestamp >= :startDate');
      expect(sql).toContain('event_timestamp <= :endDate');
      expect(sql).toContain('event_type = :eventType');
      expect(sql).toContain('actor_id = :actorId');
      expect(sql).toContain('risk_score >= :minRiskScore');
      expect(sql).toContain('FETCH FIRST :limit ROWS ONLY');

      expect(bindings).toEqual(filters);
    });

    test('should verify event integrity', () => {
      const validEvent = {
        event_timestamp: new Date(),
        event_type: 'test',
        actor_id: 'user123',
        action: 'test',
        target_id: 'target123',
        action_result: 'success',
        previous_hash: 'abc123',
        event_hash: crypto.createHash('sha256')
          .update(JSON.stringify({
            timestamp: new Date(),
            type: 'test',
            actor: 'user123',
            action: 'test',
            target: 'target123',
            result: 'success',
            previous: 'abc123'
          }))
          .digest('hex')
      };

      // This should return false because we're not matching the exact hash
      expect(auditService.verifyEventIntegrity(validEvent)).toBe(false);

      // Event with no previous hash (first event) should be valid
      const firstEvent = { ...validEvent, previous_hash: null };
      expect(auditService.verifyEventIntegrity(firstEvent)).toBe(true);
    });
  });

  describe('Compliance Reporting', () => {
    test('should generate compliance report', async () => {
      const framework = 'HIPAA';
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      mockDb.execute.mockResolvedValueOnce({
        rows: [
          {
            event_type: 'authentication',
            event_severity: 'info',
            action_result: 'success',
            risk_score: 10,
            event_hash: 'hash123'
          }
        ]
      });

      const report = await auditService.generateComplianceReport(
        framework,
        startDate,
        endDate
      );

      expect(report).toMatchObject({
        framework: 'HIPAA',
        period: { start: startDate, end: endDate },
        generated_at: expect.any(Date),
        summary: expect.any(Object),
        compliance_status: expect.any(Object),
        recommendations: expect.any(Array)
      });
    });

    test('should assess compliance status', () => {
      const events = [
        { event_type: 'authentication', event_hash: 'hash1' },
        { event_type: 'data_access', event_hash: 'hash2' },
        { event_type: 'data_modification', event_hash: 'hash3' }
      ];

      const status = auditService.assessCompliance(events, 'HIPAA');

      expect(status).toHaveProperty('audit_controls');
      expect(status).toHaveProperty('access_tracking');
      expect(status).toHaveProperty('integrity_verification');
    });

    test('should generate recommendations', () => {
      const events = [
        { event_type: 'authentication', action_result: 'failure' },
        { event_type: 'authentication', action_result: 'failure' },
        { event_severity: 'critical' }
      ];

      const recommendations = auditService.generateRecommendations(events, 'HIPAA');

      expect(recommendations).toBeInstanceOf(Array);
      expect(recommendations.length).toBeGreaterThan(0);
    });
  });

  describe('Retention Policies', () => {
    test('should apply retention policies', async () => {
      mockDb.execute.mockResolvedValueOnce({
        rows: [
          {
            archive_after_days: 30,
            delete_after_days: 90,
            event_type: 'debug'
          }
        ]
      });

      const archiveSpy = jest.spyOn(auditService, 'archiveLogs')
        .mockResolvedValue();
      const deleteSpy = jest.spyOn(auditService, 'deleteExpiredLogs')
        .mockResolvedValue();

      await auditService.applyRetentionPolicies();

      expect(archiveSpy).toHaveBeenCalled();
      expect(deleteSpy).toHaveBeenCalled();
    });

    test('should archive old logs', async () => {
      const policy = {
        archive_after_days: 30,
        event_type: 'debug'
      };

      await auditService.archiveLogs(policy);

      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO pf_audit_log_archive'),
        expect.any(Object)
      );

      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM pf_audit_log'),
        expect.any(Object)
      );
    });
  });

  describe('Middleware', () => {
    test('should create audit middleware', () => {
      const middleware = createAuditMiddleware(auditService);
      expect(middleware).toBeInstanceOf(Function);
    });

    test('should log HTTP requests', async () => {
      const middleware = createAuditMiddleware(auditService);
      const logSpy = jest.spyOn(auditService, 'log');

      const req = {
        method: 'GET',
        path: '/api/test',
        query: { q: 'test' },
        ip: '127.0.0.1',
        get: jest.fn().mockReturnValue('Mozilla/5.0'),
        user: {
          id: 'user123',
          username: 'testuser',
          roles: ['user']
        },
        session: { id: 'session123' }
      };

      const res = {
        statusCode: 200,
        send: jest.fn(),
        json: jest.fn(),
        on: jest.fn((event, callback) => {
          if (event === 'finish') {
            callback();
          }
        })
      };

      const next = jest.fn();

      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      
      // Trigger the finish event
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(logSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: 'http_request',
          event_category: 'api',
          http_method: 'GET',
          http_path: '/api/test',
          actor_username: 'testuser'
        })
      );
    });
  });

  describe('Performance', () => {
    test('should handle high volume of events', async () => {
      const startTime = Date.now();
      const eventCount = 1000;

      for (let i = 0; i < eventCount; i++) {
        await auditService.log({
          event_type: 'test',
          event_category: 'performance',
          event_severity: 'info',
          event_name: `Event ${i}`,
          action: 'test',
          action_result: 'success'
        });
      }

      const duration = Date.now() - startTime;
      
      // Should process 1000 events in under 1 second
      expect(duration).toBeLessThan(1000);
      
      // Buffer should contain events (not all flushed yet)
      expect(auditService.buffer.length).toBeGreaterThan(0);
    });

    test('should maintain performance with retention checks', async () => {
      const startTime = Date.now();
      
      // Simulate retention policy check
      mockDb.execute.mockResolvedValue({ rows: [] });
      await auditService.applyRetentionPolicies();
      
      const duration = Date.now() - startTime;
      
      // Retention check should be fast
      expect(duration).toBeLessThan(100);
    });
  });

  describe('Fallback Logging', () => {
    test('should use fallback logging on database failure', async () => {
      const fs = require('fs').promises;
      const appendFileSpy = jest.spyOn(fs, 'appendFile')
        .mockResolvedValue();
      const mkdirSpy = jest.spyOn(fs, 'mkdir')
        .mockResolvedValue();

      const event = {
        event_type: 'test',
        event_category: 'test',
        event_severity: 'error',
        event_name: 'Test Event',
        action: 'test',
        action_result: 'failure'
      };

      const error = new Error('Database connection failed');

      await auditService.fallbackLog(event, error);

      expect(mkdirSpy).toHaveBeenCalled();
      expect(appendFileSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('Database connection failed')
      );

      appendFileSpy.mockRestore();
      mkdirSpy.mockRestore();
    });
  });

  describe('Event Emission', () => {
    test('should emit audit_event for all events', async () => {
      const eventHandler = jest.fn();
      auditService.on('audit_event', eventHandler);

      await auditService.log({
        event_type: 'test',
        event_category: 'test',
        event_severity: 'info',
        event_name: 'Test Event',
        action: 'test',
        action_result: 'success'
      });

      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: 'test',
          event_name: 'Test Event'
        })
      );
    });

    test('should emit critical_event for critical events', async () => {
      const criticalHandler = jest.fn();
      auditService.on('critical_event', criticalHandler);

      jest.spyOn(auditService, 'sendSecurityAlert').mockResolvedValue();

      const criticalEvent = {
        id: 'critical-id',
        event_type: 'security',
        event_severity: 'critical',
        risk_score: 90,
        event_name: 'Critical Event'
      };

      await auditService.handleCriticalEvent(criticalEvent);

      expect(criticalHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          event: criticalEvent,
          criticalEvent: expect.objectContaining({
            threat_level: 'critical'
          })
        })
      );
    });

    test('should emit security_alert for critical events', async () => {
      const alertHandler = jest.fn();
      auditService.on('security_alert', alertHandler);

      const event = {
        id: 'test-id',
        event_name: 'Security Event',
        actor_username: 'attacker',
        ip_address: '192.168.1.1',
        action: 'hack',
        target_name: 'system',
        risk_score: 95
      };

      const criticalEvent = {
        threat_type: 'intrusion',
        threat_level: 'critical'
      };

      await auditService.sendSecurityAlert(event, criticalEvent);

      expect(alertHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          threat_type: 'intrusion',
          threat_level: 'critical',
          summary: expect.stringContaining('intrusion')
        })
      );
    });
  });

  describe('Shutdown', () => {
    test('should gracefully shutdown', async () => {
      const flushSpy = jest.spyOn(auditService, 'flush');
      
      // Add some events to buffer
      await auditService.log({
        event_type: 'test',
        event_category: 'test',
        event_severity: 'info',
        event_name: 'Test',
        action: 'test',
        action_result: 'success'
      });

      await auditService.shutdown();

      expect(flushSpy).toHaveBeenCalled();
      expect(auditService.flushInterval).toBeNull();
    });
  });
});