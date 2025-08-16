const { AuditService, createAuditMiddleware } = require('../../src/services/auditService');
const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');

describe('AuditService Edge Cases and Missing Tests', () => {
  let auditService;
  let mockDb;
  let mockConfig;

  beforeEach(() => {
    mockDb = {
      execute: jest.fn().mockResolvedValue({ rows: [] }),
      query: jest.fn().mockResolvedValue({ rows: [] })
    };

    mockConfig = {
      auditFlushInterval: 100,
      bufferSize: 10,
      appName: 'test-app',
      appVersion: '1.0.0',
      fallbackLogPath: '/tmp/test-audit.log'
    };

    auditService = new AuditService(mockDb, mockConfig);
    clearInterval(auditService.flushInterval);
  });

  afterEach(() => {
    if (auditService) {
      auditService.shutdown();
    }
  });

  describe('Edge Cases - Null/Undefined Handling', () => {
    test('should handle null values in event fields', async () => {
      const event = {
        event_type: 'test',
        event_category: 'test',
        event_severity: 'info',
        event_name: 'Test Event',
        action: 'test',
        action_result: 'success',
        actor_id: null,
        target_id: null,
        old_values: null,
        new_values: null
      };

      const eventId = await auditService.log(event);
      expect(eventId).toBeDefined();
      expect(auditService.buffer[0].actor_id).toBeNull();
    });

    test('should handle undefined values in event fields', async () => {
      const event = {
        event_type: 'test',
        event_category: 'test',
        event_severity: 'info',
        event_name: 'Test Event',
        action: 'test',
        action_result: 'success',
        actor_username: undefined,
        ip_address: undefined
      };

      const eventId = await auditService.log(event);
      expect(eventId).toBeDefined();
    });

    test('should handle empty strings in required fields', async () => {
      const event = {
        event_type: '',
        event_category: 'test',
        event_severity: 'info',
        event_name: 'Test',
        action: 'test',
        action_result: 'success'
      };

      await expect(auditService.log(event)).rejects.toThrow('Missing required audit field');
    });

    test('should handle events with no optional fields', async () => {
      const minimalEvent = {
        event_type: 'system',
        event_category: 'minimal',
        event_severity: 'info',
        event_name: 'Minimal Event',
        action: 'test',
        action_result: 'success'
      };

      const eventId = await auditService.log(minimalEvent);
      expect(eventId).toBeDefined();
    });
  });

  describe('Edge Cases - Boundary Values', () => {
    test('should handle maximum buffer size exactly', async () => {
      const flushSpy = jest.spyOn(auditService, 'flush');
      
      // Fill buffer to exact capacity
      for (let i = 0; i < auditService.config.bufferSize; i++) {
        await auditService.log({
          event_type: 'test',
          event_category: 'boundary',
          event_severity: 'info',
          event_name: `Event ${i}`,
          action: 'test',
          action_result: 'success'
        });
      }

      expect(flushSpy).toHaveBeenCalledTimes(1);
    });

    test('should handle risk score at boundaries', async () => {
      // Test minimum risk score
      const lowRiskEvent = {
        event_type: 'data_access',
        event_category: 'test',
        event_severity: 'debug',
        event_name: 'Low Risk',
        action: 'read',
        action_result: 'success'
      };

      const lowScore = await auditService.calculateRiskScore(lowRiskEvent);
      expect(lowScore).toBeGreaterThanOrEqual(0);

      // Test maximum risk score
      const highRiskEvent = {
        event_type: 'authentication',
        action_result: 'failure',
        data_sensitivity: 'restricted',
        action: 'delete',
        actor_roles: JSON.stringify(['admin']),
        event_timestamp: new Date('2024-01-01T03:00:00'),
        custom_data: { recordCount: 50000 }
      };

      mockDb.execute.mockResolvedValueOnce({ 
        rows: [{ failure_count: 100 }] 
      });

      const highScore = await auditService.calculateRiskScore(highRiskEvent);
      expect(highScore).toBe(100);
    });

    test('should handle extremely long event descriptions', async () => {
      const longDescription = 'x'.repeat(10000);
      const event = {
        event_type: 'test',
        event_category: 'boundary',
        event_severity: 'info',
        event_name: 'Long Event',
        event_description: longDescription,
        action: 'test',
        action_result: 'success'
      };

      const eventId = await auditService.log(event);
      expect(eventId).toBeDefined();
      expect(auditService.buffer[0].event_description).toBe(longDescription);
    });

    test('should handle retention period boundaries', async () => {
      const policies = [
        { archive_after_days: 0, event_type: 'immediate' },
        { archive_after_days: 1, event_type: 'daily' },
        { archive_after_days: 2555, event_type: 'hipaa' },
        { delete_after_days: 0, event_type: 'delete_immediate' }
      ];

      for (const policy of policies) {
        await auditService.archiveLogs(policy);
        expect(mockDb.execute).toHaveBeenCalled();
      }
    });
  });

  describe('Edge Cases - Concurrent Operations', () => {
    test('should handle simultaneous flush operations', async () => {
      auditService.isProcessing = false;
      
      // Add events to buffer
      for (let i = 0; i < 5; i++) {
        auditService.buffer.push({
          event_type: 'test',
          event_timestamp: new Date(),
          id: `event-${i}`
        });
      }

      // Trigger multiple flush operations simultaneously
      const flushPromises = [
        auditService.flush(),
        auditService.flush(),
        auditService.flush()
      ];

      await Promise.all(flushPromises);

      // Only one flush should have processed the events
      expect(mockDb.execute).toHaveBeenCalledTimes(2); // batch insert + search index
    });

    test('should handle buffer modifications during flush', async () => {
      // Add initial events
      for (let i = 0; i < 5; i++) {
        auditService.buffer.push({
          event_type: 'test',
          id: `initial-${i}`
        });
      }

      // Start flush and add more events during processing
      const flushPromise = auditService.flush();
      
      auditService.buffer.push({
        event_type: 'concurrent',
        id: 'added-during-flush'
      });

      await flushPromise;

      // New event should still be in buffer
      expect(auditService.buffer.some(e => e.id === 'added-during-flush')).toBe(true);
    });

    test('should handle rapid event logging', async () => {
      const rapidEvents = [];
      for (let i = 0; i < 100; i++) {
        rapidEvents.push(auditService.log({
          event_type: 'rapid',
          event_category: 'test',
          event_severity: 'info',
          event_name: `Rapid ${i}`,
          action: 'test',
          action_result: 'success'
        }));
      }

      const results = await Promise.all(rapidEvents);
      expect(results.length).toBe(100);
      expect(results.every(id => id !== undefined)).toBe(true);
    });
  });

  describe('Edge Cases - Error Scenarios', () => {
    test('should handle database connection failure during flush', async () => {
      const appendFileSpy = jest.spyOn(fs, 'appendFile').mockResolvedValue();
      const mkdirSpy = jest.spyOn(fs, 'mkdir').mockResolvedValue();

      // Add events to buffer
      auditService.buffer.push({
        event_type: 'test',
        event_name: 'Test Event',
        id: 'test-id'
      });

      // Simulate database failure
      mockDb.execute.mockRejectedValueOnce(new Error('Database connection lost'));

      await auditService.flush();

      // Events should be re-added to buffer
      expect(auditService.buffer.length).toBeGreaterThan(0);
      
      // Fallback logging should be called
      expect(appendFileSpy).toHaveBeenCalled();

      appendFileSpy.mockRestore();
      mkdirSpy.mockRestore();
    });

    test('should handle fallback logging failure', async () => {
      const appendFileSpy = jest.spyOn(fs, 'appendFile')
        .mockRejectedValue(new Error('Disk full'));
      const mkdirSpy = jest.spyOn(fs, 'mkdir')
        .mockRejectedValue(new Error('Permission denied'));

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await auditService.fallbackLog({ test: 'event' }, new Error('Test error'));

      expect(consoleErrorSpy).toHaveBeenCalledWith('Fallback logging failed:', expect.any(Error));

      appendFileSpy.mockRestore();
      mkdirSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });

    test('should handle malformed JSON in event fields', async () => {
      const event = {
        event_type: 'test',
        event_category: 'test',
        event_severity: 'info',
        event_name: 'Test',
        action: 'test',
        action_result: 'success',
        actor_roles: '{"invalid json}',
        old_values: '{not valid json',
        new_values: 'plain string'
      };

      // Should handle gracefully by treating as strings
      const eventId = await auditService.log(event);
      expect(eventId).toBeDefined();
    });

    test('should handle getRecentFailures database error', async () => {
      const event = {
        event_type: 'authentication',
        action_result: 'failure',
        actor_id: 'user123',
        ip_address: '192.168.1.1'
      };

      mockDb.execute.mockRejectedValueOnce(new Error('Query failed'));

      const score = await auditService.calculateRiskScore(event);
      expect(score).toBeGreaterThanOrEqual(20); // Should still calculate base score
    });
  });

  describe('Edge Cases - State Transitions', () => {
    test('should handle shutdown during active flush', async () => {
      // Add many events to trigger flush
      for (let i = 0; i < 100; i++) {
        auditService.buffer.push({
          event_type: 'test',
          id: `event-${i}`
        });
      }

      // Start flush
      const flushPromise = auditService.flush();

      // Immediately shutdown
      await auditService.shutdown();

      await flushPromise;

      expect(auditService.flushInterval).toBeNull();
    });

    test('should handle multiple shutdown calls', async () => {
      await auditService.shutdown();
      await auditService.shutdown(); // Second call should not error
      
      expect(auditService.flushInterval).toBeNull();
    });

    test('should handle events after shutdown', async () => {
      await auditService.shutdown();

      const event = {
        event_type: 'test',
        event_category: 'test',
        event_severity: 'info',
        event_name: 'After Shutdown',
        action: 'test',
        action_result: 'success'
      };

      // Should still work but without interval flushing
      const eventId = await auditService.log(event);
      expect(eventId).toBeDefined();
    });
  });

  describe('Edge Cases - Invalid Event Types', () => {
    test('should handle invalid event_type values', async () => {
      const event = {
        event_type: 'invalid_type',
        event_category: 'test',
        event_severity: 'info',
        event_name: 'Invalid Type',
        action: 'test',
        action_result: 'success'
      };

      // Should log but might fail on database insert
      const eventId = await auditService.log(event);
      expect(eventId).toBeDefined();
    });

    test('should handle invalid event_severity values', async () => {
      const event = {
        event_type: 'test',
        event_category: 'test',
        event_severity: 'invalid_severity',
        event_name: 'Invalid Severity',
        action: 'test',
        action_result: 'success'
      };

      const eventId = await auditService.log(event);
      expect(eventId).toBeDefined();
    });

    test('should handle invalid action_result values', async () => {
      const event = {
        event_type: 'test',
        event_category: 'test',
        event_severity: 'info',
        event_name: 'Invalid Result',
        action: 'test',
        action_result: 'invalid_result'
      };

      const eventId = await auditService.log(event);
      expect(eventId).toBeDefined();
    });
  });

  describe('Edge Cases - Complex Data Structures', () => {
    test('should handle deeply nested JSON objects', async () => {
      const deepObject = {
        level1: {
          level2: {
            level3: {
              level4: {
                level5: {
                  data: 'deep value'
                }
              }
            }
          }
        }
      };

      const event = {
        event_type: 'test',
        event_category: 'test',
        event_severity: 'info',
        event_name: 'Deep Object',
        action: 'test',
        action_result: 'success',
        old_values: deepObject,
        new_values: deepObject,
        custom_data: deepObject
      };

      const eventId = await auditService.log(event);
      expect(eventId).toBeDefined();
      
      const logged = auditService.buffer[0];
      expect(JSON.parse(logged.old_values)).toEqual(deepObject);
    });

    test('should handle circular references in objects', async () => {
      const circularObj = { name: 'test' };
      circularObj.self = circularObj; // Create circular reference

      const event = {
        event_type: 'test',
        event_category: 'test',
        event_severity: 'info',
        event_name: 'Circular',
        action: 'test',
        action_result: 'success'
      };

      // Add circular object to event (should be handled by JSON.stringify)
      event.circularData = circularObj;

      await expect(auditService.log(event)).rejects.toThrow();
    });

    test('should handle arrays in JSON fields', async () => {
      const event = {
        event_type: 'test',
        event_category: 'test',
        event_severity: 'info',
        event_name: 'Array Data',
        action: 'test',
        action_result: 'success',
        actor_roles: ['admin', 'user', 'moderator'],
        changed_fields: ['field1', 'field2', 'field3'],
        tags: ['important', 'security', 'audit']
      };

      const eventId = await auditService.log(event);
      expect(eventId).toBeDefined();
      
      const logged = auditService.buffer[0];
      expect(JSON.parse(logged.actor_roles)).toEqual(['admin', 'user', 'moderator']);
    });
  });

  describe('Edge Cases - Special Characters', () => {
    test('should handle special characters in string fields', async () => {
      const event = {
        event_type: 'test',
        event_category: 'test',
        event_severity: 'info',
        event_name: 'Test "with" \'quotes\' and \\backslashes\\',
        event_description: 'Contains\nnewlines\tand\ttabs',
        action: 'test',
        action_result: 'success',
        actor_username: 'user@domain.com',
        target_name: 'file:/path/to/resource?query=1&param=2'
      };

      const eventId = await auditService.log(event);
      expect(eventId).toBeDefined();
      expect(auditService.buffer[0].event_name).toBe(event.event_name);
    });

    test('should handle Unicode characters', async () => {
      const event = {
        event_type: 'test',
        event_category: 'test',
        event_severity: 'info',
        event_name: 'Unicode Test 测试 🔒',
        event_description: 'Émoji 😀 and special çhäracters',
        action: 'test',
        action_result: 'success',
        actor_username: 'user_测试'
      };

      const eventId = await auditService.log(event);
      expect(eventId).toBeDefined();
      expect(auditService.buffer[0].event_name).toBe(event.event_name);
    });
  });

  describe('Edge Cases - Middleware', () => {
    test('should handle requests with missing session', async () => {
      const middleware = createAuditMiddleware(auditService);
      const logSpy = jest.spyOn(auditService, 'log');

      const req = {
        method: 'GET',
        path: '/test',
        query: {},
        ip: '127.0.0.1',
        get: jest.fn().mockReturnValue('User-Agent'),
        // No session
      };

      const res = {
        statusCode: 200,
        send: jest.fn(),
        json: jest.fn(),
        on: jest.fn((event, callback) => {
          if (event === 'finish') {
            setTimeout(callback, 0);
          }
        })
      };

      const next = jest.fn();

      await middleware(req, res, next);
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(logSpy).toHaveBeenCalled();
    });

    test('should handle response without data', async () => {
      const middleware = createAuditMiddleware(auditService);
      const logSpy = jest.spyOn(auditService, 'log');

      const req = {
        method: 'DELETE',
        path: '/api/resource/123',
        query: {},
        ip: '127.0.0.1',
        get: jest.fn().mockReturnValue('User-Agent')
      };

      const res = {
        statusCode: 204, // No content
        send: jest.fn(),
        json: jest.fn(),
        on: jest.fn((event, callback) => {
          if (event === 'finish') {
            setTimeout(callback, 0);
          }
        })
      };

      const next = jest.fn();

      await middleware(req, res, next);
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(logSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          http_status_code: 204
        })
      );
    });

    test('should handle middleware errors gracefully', async () => {
      const middleware = createAuditMiddleware(auditService);
      jest.spyOn(auditService, 'log').mockRejectedValue(new Error('Audit failed'));
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      const req = {
        method: 'GET',
        path: '/test',
        query: {},
        get: jest.fn()
      };

      const res = {
        statusCode: 200,
        send: jest.fn(),
        json: jest.fn(),
        on: jest.fn((event, callback) => {
          if (event === 'finish') {
            setTimeout(callback, 0);
          }
        })
      };

      const next = jest.fn();

      await middleware(req, res, next);
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(consoleErrorSpy).toHaveBeenCalledWith('Audit middleware error:', expect.any(Error));
      
      consoleErrorSpy.mockRestore();
    });
  });

  describe('Edge Cases - Query Building', () => {
    test('should handle empty filter object', () => {
      const { sql, bindings } = auditService.buildAuditQuery({});
      
      expect(sql).toContain('SELECT * FROM pf_audit_log WHERE 1=1');
      expect(sql).toContain('ORDER BY event_timestamp DESC');
      expect(Object.keys(bindings).length).toBe(0);
    });

    test('should handle all filter options simultaneously', () => {
      const filters = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
        eventType: 'authentication',
        eventCategory: 'security',
        actorId: 'user123',
        targetId: 'resource456',
        minRiskScore: 70,
        actionResult: 'failure',
        limit: 50
      };

      const { sql, bindings } = auditService.buildAuditQuery(filters);

      expect(sql).toContain('event_timestamp >= :startDate');
      expect(sql).toContain('event_timestamp <= :endDate');
      expect(sql).toContain('event_type = :eventType');
      expect(sql).toContain('event_category = :eventCategory');
      expect(sql).toContain('actor_id = :actorId');
      expect(sql).toContain('target_id = :targetId');
      expect(sql).toContain('risk_score >= :minRiskScore');
      expect(sql).toContain('action_result = :actionResult');
      expect(sql).toContain('FETCH FIRST :limit ROWS ONLY');
      
      expect(Object.keys(bindings).length).toBe(9);
    });

    test('should handle limit of 0', () => {
      const { sql, bindings } = auditService.buildAuditQuery({ limit: 0 });
      
      expect(sql).not.toContain('FETCH FIRST');
      expect(bindings.limit).toBeUndefined();
    });
  });

  describe('Edge Cases - Compliance Reporting', () => {
    test('should handle empty event list in compliance report', async () => {
      mockDb.execute.mockResolvedValueOnce({ rows: [] });

      const report = await auditService.generateComplianceReport(
        'HIPAA',
        new Date('2024-01-01'),
        new Date('2024-01-31')
      );

      expect(report.summary.total_events).toBe(0);
      expect(report.critical_events).toEqual([]);
      expect(report.failed_actions).toEqual([]);
    });

    test('should handle unknown compliance framework', async () => {
      mockDb.execute.mockResolvedValueOnce({ rows: [] });

      const report = await auditService.generateComplianceReport(
        'UNKNOWN_FRAMEWORK',
        new Date('2024-01-01'),
        new Date('2024-01-31')
      );

      expect(report.framework).toBe('UNKNOWN_FRAMEWORK');
      expect(report.compliance_status).toEqual({});
    });

    test('should handle events without compliance tags', async () => {
      const events = [
        {
          event_type: 'custom',
          event_severity: 'info',
          action_result: 'success',
          event_hash: 'hash1'
        }
      ];

      mockDb.execute.mockResolvedValueOnce({ rows: events });

      const report = await auditService.generateComplianceReport(
        'HIPAA',
        new Date('2024-01-01'),
        new Date('2024-01-31')
      );

      expect(report.summary.total_events).toBe(1);
    });
  });

  describe('Edge Cases - Global Request Context', () => {
    test('should handle missing global request context', async () => {
      delete global.requestContext;

      const event = {
        event_type: 'test',
        event_category: 'test',
        event_severity: 'info',
        event_name: 'No Context',
        action: 'test',
        action_result: 'success'
      };

      const eventId = await auditService.log(event);
      expect(eventId).toBeDefined();
      
      const logged = auditService.buffer[0];
      expect(logged.request_id).toBeUndefined();
      expect(logged.session_id).toBeUndefined();
    });

    test('should use global request context when available', async () => {
      global.requestContext = {
        requestId: 'req-123',
        sessionId: 'sess-456',
        ip: '10.0.0.1',
        userAgent: 'Test Browser'
      };

      const event = {
        event_type: 'test',
        event_category: 'test',
        event_severity: 'info',
        event_name: 'With Context',
        action: 'test',
        action_result: 'success'
      };

      const eventId = await auditService.log(event);
      expect(eventId).toBeDefined();
      
      const logged = auditService.buffer[0];
      expect(logged.request_id).toBe('req-123');
      expect(logged.session_id).toBe('sess-456');
      expect(logged.ip_address).toBe('10.0.0.1');
      expect(logged.user_agent).toBe('Test Browser');

      delete global.requestContext;
    });
  });
});