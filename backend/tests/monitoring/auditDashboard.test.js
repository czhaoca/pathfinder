const AuditDashboard = require('../../src/monitoring/auditDashboard');

describe('AuditDashboard', () => {
  let dashboard;
  let mockDb;
  let mockAuditService;

  beforeEach(() => {
    mockDb = {
      execute: jest.fn().mockResolvedValue({ rows: [] })
    };

    mockAuditService = {
      buffer: [],
      config: { bufferSize: 1000 },
      query: jest.fn().mockResolvedValue([])
    };

    dashboard = new AuditDashboard(mockDb, mockAuditService);
  });

  describe('Metrics Generation', () => {
    test('should get metrics for specified time range', async () => {
      mockDb.execute
        .mockResolvedValueOnce({ rows: [{ total: 100 }] }) // Total events
        .mockResolvedValueOnce({ rows: [ // Events by type
          { event_type: 'authentication', count: 50, percentage: 50 },
          { event_type: 'data_access', count: 30, percentage: 30 },
          { event_type: 'system', count: 20, percentage: 20 }
        ]})
        .mockResolvedValueOnce({ rows: [ // Events by severity
          { event_severity: 'info', count: 80, percentage: 80 },
          { event_severity: 'warning', count: 15, percentage: 15 },
          { event_severity: 'error', count: 5, percentage: 5 }
        ]})
        .mockResolvedValueOnce({ rows: [ // Failure rate
          { action_result: 'success', count: 90, percentage: 90 },
          { action_result: 'failure', count: 10, percentage: 10 }
        ]})
        .mockResolvedValueOnce({ rows: [] }) // Top actors
        .mockResolvedValueOnce({ rows: [] }) // Critical events
        .mockResolvedValueOnce({ rows: [{ // Auth metrics
          total_attempts: 50,
          successful: 40,
          failed: 10,
          unique_users: 15,
          unique_ips: 20
        }]})
        .mockResolvedValueOnce({ rows: [] }) // Failed patterns
        .mockResolvedValueOnce({ rows: [] }) // Data access
        .mockResolvedValueOnce({ rows: [{ invalid_count: 0 }] }) // Integrity
        .mockResolvedValueOnce({ rows: [{ active_policies: 5 }] }) // Retention
        .mockResolvedValueOnce({ rows: [{ archived_events: 1000 }] }) // Archive
        .mockResolvedValueOnce({ rows: [{ event_count: 10 }] }) // HIPAA
        .mockResolvedValueOnce({ rows: [{ event_count: 8 }] }) // GDPR
        .mockResolvedValueOnce({ rows: [{ event_count: 12 }] }); // SOC2

      const metrics = await dashboard.getMetrics('24h');

      expect(metrics).toMatchObject({
        timeRange: '24h',
        totalEvents: 100,
        eventsByType: expect.any(Array),
        eventsBySeverity: expect.any(Array),
        failureRate: {
          failure_count: 10,
          total_count: 100,
          failure_rate: 10
        },
        authenticationMetrics: expect.objectContaining({
          total_attempts: 50,
          successful: 40,
          failed: 10,
          success_rate: '80.00'
        }),
        systemHealth: expect.objectContaining({
          integrity: { status: 'healthy', invalid_events: 0 }
        }),
        complianceStatus: expect.objectContaining({
          HIPAA: { events_logged: 10, status: 'active' },
          GDPR: { events_logged: 8, status: 'active' },
          SOC2: { events_logged: 12, status: 'active' }
        })
      });
    });

    test('should handle different time ranges', () => {
      const ranges = ['1h', '6h', '24h', '7d', '30d', '90d'];
      
      ranges.forEach(range => {
        const startDate = dashboard.getStartDate(range);
        expect(startDate).toBeInstanceOf(Date);
        expect(startDate.getTime()).toBeLessThan(Date.now());
      });
    });
  });

  describe('Anomaly Detection', () => {
    test('should detect brute force attempts', async () => {
      mockDb.execute.mockResolvedValueOnce({
        rows: [
          {
            actor_username: 'attacker',
            ip_address: '192.168.1.100',
            attempts: 10,
            first_attempt: new Date('2024-01-01T10:00:00'),
            last_attempt: new Date('2024-01-01T10:05:00'),
            duration_minutes: 5
          }
        ]
      });

      const bruteForce = await dashboard.detectBruteForce(
        new Date('2024-01-01T10:00:00'),
        new Date('2024-01-01T11:00:00')
      );

      expect(bruteForce).toHaveLength(1);
      expect(bruteForce[0]).toMatchObject({
        actor_username: 'attacker',
        attempts: 10
      });
    });

    test('should detect privilege escalation attempts', async () => {
      mockDb.execute.mockResolvedValueOnce({
        rows: [
          {
            actor_username: 'user123',
            target_name: 'admin_panel',
            attempts: 5,
            actions_attempted: 'access_admin, modify_permissions'
          }
        ]
      });

      const privEsc = await dashboard.detectPrivilegeEscalation(
        new Date('2024-01-01'),
        new Date('2024-01-02')
      );

      expect(privEsc).toHaveLength(1);
      expect(privEsc[0]).toMatchObject({
        actor_username: 'user123',
        target_name: 'admin_panel',
        attempts: 5
      });
    });

    test('should detect data exfiltration attempts', async () => {
      mockDb.execute.mockResolvedValueOnce({
        rows: [
          {
            actor_username: 'insider',
            ip_address: '10.0.0.50',
            total_records: 50000,
            export_count: 15,
            tables_accessed: 'users, experiences, careers'
          }
        ]
      });

      const dataExfil = await dashboard.detectDataExfiltration(
        new Date('2024-01-01'),
        new Date('2024-01-02')
      );

      expect(dataExfil).toHaveLength(1);
      expect(dataExfil[0]).toMatchObject({
        actor_username: 'insider',
        total_records: 50000,
        export_count: 15
      });
    });

    test('should detect unusual access patterns', async () => {
      mockDb.execute.mockResolvedValueOnce({
        rows: [
          {
            actor_username: 'nightowl',
            ip_address: '192.168.1.50',
            access_count: 10,
            hours_accessed: '02:00, 03:00, 04:00'
          }
        ]
      });

      const unusual = await dashboard.detectUnusualAccess(
        new Date('2024-01-01'),
        new Date('2024-01-02')
      );

      expect(unusual).toHaveLength(1);
      expect(unusual[0]).toMatchObject({
        actor_username: 'nightowl',
        access_count: 10
      });
    });

    test('should aggregate all anomalies', async () => {
      // Mock all detection methods
      jest.spyOn(dashboard, 'detectBruteForce').mockResolvedValue([
        { type: 'brute_force', actor: 'attacker1' }
      ]);
      jest.spyOn(dashboard, 'detectPrivilegeEscalation').mockResolvedValue([]);
      jest.spyOn(dashboard, 'detectDataExfiltration').mockResolvedValue([]);
      jest.spyOn(dashboard, 'detectUnusualAccess').mockResolvedValue([
        { type: 'unusual', actor: 'user2' }
      ]);
      jest.spyOn(dashboard, 'detectConfigurationChanges').mockResolvedValue([]);

      const anomalies = await dashboard.detectAnomalies('1h');

      expect(anomalies).toHaveLength(2);
      expect(anomalies[0]).toMatchObject({
        type: 'brute_force',
        severity: 'high'
      });
      expect(anomalies[1]).toMatchObject({
        type: 'unusual_access',
        severity: 'medium'
      });
    });
  });

  describe('Critical Events', () => {
    test('should get critical events with details', async () => {
      mockDb.execute.mockResolvedValueOnce({
        rows: [
          {
            id: 'crit-1',
            audit_log_id: 'audit-1',
            threat_type: 'brute_force',
            threat_level: 'high',
            resolved: 0,
            event_name: 'Multiple Login Failures',
            actor_username: 'attacker',
            risk_score: 85
          },
          {
            id: 'crit-2',
            audit_log_id: 'audit-2',
            threat_type: 'data_exfiltration',
            threat_level: 'critical',
            resolved: 1,
            event_name: 'Mass Data Export',
            actor_username: 'insider',
            risk_score: 95
          }
        ]
      });

      const critical = await dashboard.getCriticalEvents(
        new Date('2024-01-01'),
        new Date('2024-01-02')
      );

      expect(critical).toMatchObject({
        total: 2,
        unresolved: 1,
        by_threat_level: {
          high: 1,
          critical: 1
        },
        by_threat_type: {
          brute_force: 1,
          data_exfiltration: 1
        }
      });
    });
  });

  describe('Threat Report Generation', () => {
    test('should generate comprehensive threat report', async () => {
      jest.spyOn(dashboard, 'detectAnomalies')
        .mockResolvedValueOnce([
          { type: 'brute_force', severity: 'high' }
        ])
        .mockResolvedValueOnce([
          { type: 'privilege_escalation', severity: 'critical' },
          { type: 'unusual_access', severity: 'medium' }
        ])
        .mockResolvedValueOnce([
          { type: 'configuration_change', severity: 'low' }
        ]);

      const report = await dashboard.generateThreatReport();

      expect(report).toMatchObject({
        generated_at: expect.any(Date),
        threat_summary: {
          total_threats: 4,
          by_severity: {
            critical: 1,
            high: 1,
            medium: 1,
            low: 1
          },
          immediate_action_required: true
        },
        time_windows: expect.any(Object),
        recommendations: expect.any(Array)
      });

      expect(report.recommendations).toContainEqual(
        expect.objectContaining({
          priority: 'immediate',
          action: 'Investigate critical security events immediately'
        })
      );
    });

    test('should generate appropriate recommendations', () => {
      const threatLevels = {
        critical: 2,
        high: 3,
        medium: 1,
        low: 0
      };

      const recommendations = dashboard.generateThreatRecommendations(threatLevels);

      expect(recommendations).toContainEqual(
        expect.objectContaining({
          priority: 'immediate',
          action: 'Investigate critical security events immediately'
        })
      );

      expect(recommendations).toContainEqual(
        expect.objectContaining({
          priority: 'high',
          action: 'Review high-severity security events'
        })
      );

      // Should always include ongoing recommendations
      expect(recommendations.some(r => r.priority === 'ongoing')).toBe(true);
    });
  });

  describe('Export Functionality', () => {
    test('should export audit log as JSON', async () => {
      const events = [
        { id: '1', event_type: 'auth', timestamp: new Date() },
        { id: '2', event_type: 'data', timestamp: new Date() }
      ];

      mockAuditService.query.mockResolvedValue(events);

      const exported = await dashboard.exportAuditLog({}, 'json');
      const parsed = JSON.parse(exported);

      expect(parsed).toEqual(events);
    });

    test('should export audit log as CSV', async () => {
      const events = [
        { id: '1', event_type: 'auth', actor: 'user1' },
        { id: '2', event_type: 'data', actor: 'user2' }
      ];

      mockAuditService.query.mockResolvedValue(events);

      const csv = await dashboard.exportAuditLog({}, 'csv');

      expect(csv).toContain('id,event_type,actor');
      expect(csv).toContain('1,auth,user1');
      expect(csv).toContain('2,data,user2');
    });

    test('should handle CSV special characters', () => {
      const events = [
        { id: '1', description: 'Contains, comma', value: 'Has "quotes"' }
      ];

      const csv = dashboard.convertToCSV(events);

      expect(csv).toContain('"Contains, comma"');
      expect(csv).toContain('"Has ""quotes"""');
    });

    test('should export audit log as XML', async () => {
      const events = [
        { id: '1', event_type: 'auth', actor: 'user1' }
      ];

      mockAuditService.query.mockResolvedValue(events);

      const xml = await dashboard.exportAuditLog({}, 'xml');

      expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(xml).toContain('<audit_log>');
      expect(xml).toContain('<event>');
      expect(xml).toContain('<id>1</id>');
      expect(xml).toContain('<event_type>auth</event_type>');
      expect(xml).toContain('<actor>user1</actor>');
    });

    test('should escape XML special characters', () => {
      const value = 'Test & <tag> "quotes" \'apostrophe\'';
      const escaped = dashboard.escapeXML(value);

      expect(escaped).toBe('Test &amp; &lt;tag&gt; &quot;quotes&quot; &apos;apostrophe&apos;');
    });

    test('should reject unsupported export formats', async () => {
      await expect(dashboard.exportAuditLog({}, 'pdf'))
        .rejects.toThrow('Unsupported export format: pdf');
    });
  });

  describe('Authentication Metrics', () => {
    test('should calculate authentication success rate', async () => {
      mockDb.execute
        .mockResolvedValueOnce({
          rows: [{
            total_attempts: 100,
            successful: 85,
            failed: 15,
            unique_users: 20,
            unique_ips: 25
          }]
        })
        .mockResolvedValueOnce({
          rows: [
            {
              actor_username: 'suspicious_user',
              ip_address: '192.168.1.100',
              failure_count: 8
            }
          ]
        });

      const metrics = await dashboard.getAuthenticationMetrics(
        new Date('2024-01-01'),
        new Date('2024-01-02')
      );

      expect(metrics).toMatchObject({
        total_attempts: 100,
        successful: 85,
        failed: 15,
        success_rate: '85.00',
        suspicious_patterns: [
          {
            actor_username: 'suspicious_user',
            failure_count: 8
          }
        ]
      });
    });

    test('should handle zero authentication attempts', async () => {
      mockDb.execute
        .mockResolvedValueOnce({
          rows: [{
            total_attempts: 0,
            successful: 0,
            failed: 0
          }]
        })
        .mockResolvedValueOnce({ rows: [] });

      const metrics = await dashboard.getAuthenticationMetrics(
        new Date('2024-01-01'),
        new Date('2024-01-02')
      );

      expect(metrics.success_rate).toBe(0);
    });
  });

  describe('Data Access Metrics', () => {
    test('should aggregate data access metrics', async () => {
      mockDb.execute.mockResolvedValueOnce({
        rows: [
          {
            target_table: 'users',
            action: 'read',
            data_sensitivity: 'confidential',
            access_count: 50,
            unique_users: 10
          },
          {
            target_table: 'experiences',
            action: 'update',
            data_sensitivity: 'restricted',
            access_count: 25,
            unique_users: 5
          }
        ]
      });

      const metrics = await dashboard.getDataAccessMetrics(
        new Date('2024-01-01'),
        new Date('2024-01-02')
      );

      expect(metrics).toMatchObject({
        total_accesses: 75,
        by_table: {
          users: 1,
          experiences: 1
        },
        by_action: {
          read: 1,
          update: 1
        },
        by_sensitivity: {
          confidential: 1,
          restricted: 1
        }
      });
    });
  });

  describe('System Health', () => {
    test('should check system health status', async () => {
      mockDb.execute
        .mockResolvedValueOnce({ rows: [{ invalid_count: 0 }] })
        .mockResolvedValueOnce({ 
          rows: [{
            active_policies: 5,
            min_retention: 7,
            max_retention: 2555
          }]
        })
        .mockResolvedValueOnce({
          rows: [{
            archived_events: 10000,
            oldest_event: new Date('2023-01-01'),
            newest_event: new Date('2023-12-31')
          }]
        });

      mockAuditService.buffer = new Array(100);
      mockAuditService.config.bufferSize = 1000;

      const health = await dashboard.getSystemHealth();

      expect(health).toMatchObject({
        integrity: {
          status: 'healthy',
          invalid_events: 0
        },
        buffer: {
          current_size: 100,
          max_size: 1000,
          utilization: '10.00'
        },
        retention: {
          active_policies: 5,
          min_retention: 7,
          max_retention: 2555
        },
        archive: {
          archived_events: 10000
        }
      });
    });

    test('should detect degraded integrity', async () => {
      mockDb.execute
        .mockResolvedValueOnce({ rows: [{ invalid_count: 5 }] })
        .mockResolvedValueOnce({ rows: [{}] })
        .mockResolvedValueOnce({ rows: [{}] });

      const health = await dashboard.getSystemHealth();

      expect(health.integrity).toMatchObject({
        status: 'degraded',
        invalid_events: 5
      });
    });
  });

  describe('Compliance Status', () => {
    test('should check compliance framework status', async () => {
      mockDb.execute
        .mockResolvedValueOnce({ rows: [{ event_count: 100 }] }) // HIPAA
        .mockResolvedValueOnce({ rows: [{ event_count: 80 }] })  // GDPR
        .mockResolvedValueOnce({ rows: [{ event_count: 0 }] });   // SOC2

      const status = await dashboard.getComplianceStatus();

      expect(status).toMatchObject({
        HIPAA: { events_logged: 100, status: 'active' },
        GDPR: { events_logged: 80, status: 'active' },
        SOC2: { events_logged: 0, status: 'inactive' }
      });
    });
  });

  describe('Utility Functions', () => {
    test('should group items by field', () => {
      const items = [
        { type: 'auth', value: 1 },
        { type: 'auth', value: 2 },
        { type: 'data', value: 3 },
        { type: null, value: 4 }
      ];

      const grouped = dashboard.groupByField(items, 'type');

      expect(grouped).toEqual({
        auth: 2,
        data: 1,
        unknown: 1
      });
    });
  });
});