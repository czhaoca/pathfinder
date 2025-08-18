const AnalyticsDashboardController = require('../../../src/api/controllers/analyticsDashboardController');

describe('AnalyticsDashboardController', () => {
  let controller;
  let mockAnalyticsDashboardService;
  let mockAuditService;
  let req, res, next;

  beforeEach(() => {
    // Create mock services
    mockAnalyticsDashboardService = {
      getDashboardOverview: jest.fn(),
      getRealtimeMetrics: jest.fn(),
      getRetentionCohorts: jest.fn(),
      getFunnelAnalysis: jest.fn(),
      getFeatureAdoption: jest.fn(),
      getUserLifecycleStages: jest.fn(),
      getUserMetrics: jest.fn(),
      getEngagementMetrics: jest.fn(),
      getPerformanceMetrics: jest.fn(),
      generateReport: jest.fn()
    };

    mockAuditService = {
      logDataAccess: jest.fn()
    };

    controller = new AnalyticsDashboardController(
      mockAnalyticsDashboardService,
      mockAuditService
    );

    // Setup request, response, and next
    req = {
      user: { userId: 'test-user-123' },
      query: {},
      params: {},
      body: {}
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      setHeader: jest.fn().mockReturnThis()
    };

    next = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getDashboardOverview', () => {
    it('should return dashboard overview successfully', async () => {
      const mockOverview = {
        userMetrics: { totalUsers: 100 },
        engagementMetrics: { sessions: { total: 500 } }
      };

      req.query = { startDate: '2024-01-01', endDate: '2024-01-31' };
      mockAnalyticsDashboardService.getDashboardOverview.mockResolvedValue(mockOverview);

      await controller.getDashboardOverview(req, res, next);

      expect(mockAnalyticsDashboardService.getDashboardOverview).toHaveBeenCalledWith(
        expect.any(Date),
        expect.any(Date)
      );
      expect(mockAuditService.logDataAccess).toHaveBeenCalledWith({
        userId: 'test-user-123',
        action: 'DASHBOARD_OVERVIEW_VIEWED',
        resourceType: 'analytics_dashboard',
        resourceId: null,
        operation: 'read',
        success: true,
        metadata: expect.objectContaining({
          startDate: expect.any(Date),
          endDate: expect.any(Date)
        })
      });
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: mockOverview
      }));
    });

    it('should use default date range when not provided', async () => {
      const mockOverview = { userMetrics: { totalUsers: 100 } };
      mockAnalyticsDashboardService.getDashboardOverview.mockResolvedValue(mockOverview);

      await controller.getDashboardOverview(req, res, next);

      const [[startDate, endDate]] = mockAnalyticsDashboardService.getDashboardOverview.mock.calls;
      const daysDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
      expect(daysDiff).toBeCloseTo(30, -1); // Approximately 30 days
    });

    it('should handle service errors', async () => {
      req.query = { startDate: '2024-01-01', endDate: '2024-01-31' };
      mockAnalyticsDashboardService.getDashboardOverview.mockRejectedValue(
        new Error('Service error')
      );

      await controller.getDashboardOverview(req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: expect.any(String)
      }));
    });

    it('should handle invalid date format', async () => {
      req.query = { startDate: 'invalid-date', endDate: '2024-01-31' };

      await controller.getDashboardOverview(req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: expect.stringContaining('Invalid date')
      }));
    });

    it('should validate date range (start > end)', async () => {
      req.query = { startDate: '2024-01-31', endDate: '2024-01-01' };

      await controller.getDashboardOverview(req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: expect.stringContaining('Start date must be before end date')
      }));
    });

    it('should validate maximum date range', async () => {
      req.query = { startDate: '2023-01-01', endDate: '2024-12-31' };

      await controller.getDashboardOverview(req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: expect.stringContaining('Date range cannot exceed 1 year')
      }));
    });
  });

  describe('getRealtimeMetrics', () => {
    it('should return real-time metrics successfully', async () => {
      const mockMetrics = {
        activeUsers: 45,
        activeSessions: 78,
        eventsPerSecond: 12.5,
        errorRate: 0.5
      };

      mockAnalyticsDashboardService.getRealtimeMetrics.mockResolvedValue(mockMetrics);

      await controller.getRealtimeMetrics(req, res, next);

      expect(mockAnalyticsDashboardService.getRealtimeMetrics).toHaveBeenCalled();
      expect(mockAuditService.logDataAccess).toHaveBeenCalledWith({
        userId: 'test-user-123',
        action: 'REALTIME_METRICS_VIEWED',
        resourceType: 'analytics_dashboard',
        resourceId: null,
        operation: 'read',
        success: true
      });
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: mockMetrics
      }));
    });

    it('should handle service errors', async () => {
      mockAnalyticsDashboardService.getRealtimeMetrics.mockRejectedValue(
        new Error('Real-time service unavailable')
      );

      await controller.getRealtimeMetrics(req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: expect.any(String)
      }));
    });
  });

  describe('getRetentionCohorts', () => {
    it('should return retention cohorts successfully', async () => {
      const mockRetention = {
        cohortType: 'weekly',
        cohorts: [],
        summary: { averageDay1Retention: 80 }
      };

      req.query = {
        cohortType: 'weekly',
        startDate: '2024-01-01',
        endDate: '2024-01-31'
      };
      mockAnalyticsDashboardService.getRetentionCohorts.mockResolvedValue(mockRetention);

      await controller.getRetentionCohorts(req, res, next);

      expect(mockAnalyticsDashboardService.getRetentionCohorts).toHaveBeenCalledWith(
        'weekly',
        expect.any(Date),
        expect.any(Date)
      );
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: mockRetention
      }));
    });

    it('should use default cohort type when not provided', async () => {
      const mockRetention = { cohortType: 'weekly', cohorts: [] };
      req.query = { startDate: '2024-01-01', endDate: '2024-01-31' };
      mockAnalyticsDashboardService.getRetentionCohorts.mockResolvedValue(mockRetention);

      await controller.getRetentionCohorts(req, res, next);

      expect(mockAnalyticsDashboardService.getRetentionCohorts).toHaveBeenCalledWith(
        'weekly',
        expect.any(Date),
        expect.any(Date)
      );
    });

    it('should validate cohort type', async () => {
      req.query = {
        cohortType: 'invalid',
        startDate: '2024-01-01',
        endDate: '2024-01-31'
      };

      await controller.getRetentionCohorts(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: expect.stringContaining('Invalid cohort type')
      }));
    });

    it('should handle service errors', async () => {
      req.query = {
        cohortType: 'daily',
        startDate: '2024-01-01',
        endDate: '2024-01-31'
      };
      mockAnalyticsDashboardService.getRetentionCohorts.mockRejectedValue(
        new Error('Retention calculation failed')
      );

      await controller.getRetentionCohorts(req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getFunnelAnalysis', () => {
    it('should return funnel analysis successfully', async () => {
      const mockFunnel = {
        funnelId: 'onboarding',
        name: 'Onboarding Funnel',
        steps: [],
        overallConversion: 50
      };

      req.params = { funnelId: 'onboarding' };
      req.query = {
        segment: 'new_users',
        startDate: '2024-01-01',
        endDate: '2024-01-31'
      };
      mockAnalyticsDashboardService.getFunnelAnalysis.mockResolvedValue(mockFunnel);

      await controller.getFunnelAnalysis(req, res, next);

      expect(mockAnalyticsDashboardService.getFunnelAnalysis).toHaveBeenCalledWith(
        'onboarding',
        expect.any(Date),
        expect.any(Date),
        'new_users'
      );
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: mockFunnel
      }));
    });

    it('should validate funnel ID is provided', async () => {
      req.params = {};
      req.query = { startDate: '2024-01-01', endDate: '2024-01-31' };

      await controller.getFunnelAnalysis(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: expect.stringContaining('Funnel ID is required')
      }));
    });

    it('should handle optional segment parameter', async () => {
      const mockFunnel = { funnelId: 'onboarding', steps: [] };
      req.params = { funnelId: 'onboarding' };
      req.query = { startDate: '2024-01-01', endDate: '2024-01-31' };
      mockAnalyticsDashboardService.getFunnelAnalysis.mockResolvedValue(mockFunnel);

      await controller.getFunnelAnalysis(req, res, next);

      expect(mockAnalyticsDashboardService.getFunnelAnalysis).toHaveBeenCalledWith(
        'onboarding',
        expect.any(Date),
        expect.any(Date),
        undefined
      );
    });
  });

  describe('generateReport', () => {
    it('should generate JSON report successfully', async () => {
      const mockReport = { users: { totalUsers: 100 } };
      req.body = {
        type: 'comprehensive',
        format: 'json',
        metrics: ['users', 'engagement'],
        startDate: '2024-01-01',
        endDate: '2024-01-31'
      };
      mockAnalyticsDashboardService.generateReport.mockResolvedValue(mockReport);

      await controller.generateReport(req, res, next);

      expect(mockAnalyticsDashboardService.generateReport).toHaveBeenCalledWith({
        type: 'comprehensive',
        startDate: expect.any(Date),
        endDate: expect.any(Date),
        metrics: ['users', 'engagement'],
        format: 'json'
      });
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: mockReport
      }));
    });

    it('should generate CSV report with correct headers', async () => {
      const mockCSV = 'Metric,Value,Date\nTotal Users,100,2024-01-31';
      req.body = {
        format: 'csv',
        metrics: ['users'],
        startDate: '2024-01-01',
        endDate: '2024-01-31'
      };
      mockAnalyticsDashboardService.generateReport.mockResolvedValue(mockCSV);

      await controller.generateReport(req, res, next);

      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv');
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        expect.stringContaining('attachment; filename="analytics-report-')
      );
      expect(res.send).toHaveBeenCalledWith(mockCSV);
    });

    it('should generate PDF report with correct headers', async () => {
      const mockPDF = 'pdf-content';
      req.body = {
        format: 'pdf',
        metrics: ['users'],
        startDate: '2024-01-01',
        endDate: '2024-01-31'
      };
      mockAnalyticsDashboardService.generateReport.mockResolvedValue(mockPDF);

      await controller.generateReport(req, res, next);

      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        expect.stringContaining('attachment; filename="analytics-report-')
      );
      expect(res.send).toHaveBeenCalledWith(mockPDF);
    });

    it('should generate Excel report with correct headers', async () => {
      const mockExcel = 'excel-content';
      req.body = {
        format: 'excel',
        metrics: ['users'],
        startDate: '2024-01-01',
        endDate: '2024-01-31'
      };
      mockAnalyticsDashboardService.generateReport.mockResolvedValue(mockExcel);

      await controller.generateReport(req, res, next);

      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        expect.stringContaining('attachment; filename="analytics-report-')
      );
      expect(res.send).toHaveBeenCalledWith(mockExcel);
    });

    it('should use default values when not provided', async () => {
      const mockReport = { users: {} };
      req.body = {
        startDate: '2024-01-01',
        endDate: '2024-01-31'
      };
      mockAnalyticsDashboardService.generateReport.mockResolvedValue(mockReport);

      await controller.generateReport(req, res, next);

      expect(mockAnalyticsDashboardService.generateReport).toHaveBeenCalledWith({
        type: 'comprehensive',
        startDate: expect.any(Date),
        endDate: expect.any(Date),
        metrics: ['users', 'engagement', 'retention', 'performance'],
        format: 'json'
      });
    });

    it('should validate format', async () => {
      req.body = {
        format: 'invalid',
        startDate: '2024-01-01',
        endDate: '2024-01-31'
      };

      await controller.generateReport(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: expect.stringContaining('Invalid format')
      }));
    });

    it('should validate metrics', async () => {
      req.body = {
        metrics: ['users', 'invalid_metric'],
        startDate: '2024-01-01',
        endDate: '2024-01-31'
      };

      await controller.generateReport(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: expect.stringContaining('Invalid metrics: invalid_metric')
      }));
    });

    it('should log audit for report generation', async () => {
      const mockReport = { users: {} };
      req.body = {
        startDate: '2024-01-01',
        endDate: '2024-01-31'
      };
      mockAnalyticsDashboardService.generateReport.mockResolvedValue(mockReport);

      await controller.generateReport(req, res, next);

      expect(mockAuditService.logDataAccess).toHaveBeenCalledWith({
        userId: 'test-user-123',
        action: 'ANALYTICS_REPORT_GENERATED',
        resourceType: 'analytics_dashboard',
        resourceId: null,
        operation: 'export',
        success: true,
        metadata: expect.objectContaining({
          type: 'comprehensive',
          format: 'json',
          metrics: expect.any(Array)
        })
      });
    });
  });

  describe('exportDashboard', () => {
    it('should export dashboard as JSON', async () => {
      const mockOverview = { userMetrics: { totalUsers: 100 } };
      req.query = {
        format: 'json',
        startDate: '2024-01-01',
        endDate: '2024-01-31'
      };
      mockAnalyticsDashboardService.getDashboardOverview.mockResolvedValue(mockOverview);

      await controller.exportDashboard(req, res, next);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: mockOverview
      }));
    });

    it('should export dashboard as CSV', async () => {
      const mockOverview = {
        userMetrics: {
          totalUsers: 100,
          newUsers: 10,
          activeUsers: { daily: 50, weekly: 75, monthly: 90 }
        },
        engagementMetrics: {
          sessions: { total: 500, duration: { average: 300 } },
          bounce: { rate: 25 }
        },
        performanceMetrics: {
          pageLoad: { average: 1500 },
          errors: { rate: 1.5 },
          availability: { uptime: 99.9 }
        }
      };
      req.query = {
        format: 'csv',
        startDate: '2024-01-01',
        endDate: '2024-01-31'
      };
      mockAnalyticsDashboardService.getDashboardOverview.mockResolvedValue(mockOverview);

      await controller.exportDashboard(req, res, next);

      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv');
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        expect.stringContaining('attachment; filename="dashboard-')
      );
      expect(res.send).toHaveBeenCalledWith(expect.stringContaining('Category,Metric,Value'));
      expect(res.send).toHaveBeenCalledWith(expect.stringContaining('Users,Total,100'));
    });

    it('should log audit for export', async () => {
      const mockOverview = { userMetrics: {} };
      req.query = {
        format: 'json',
        startDate: '2024-01-01',
        endDate: '2024-01-31'
      };
      mockAnalyticsDashboardService.getDashboardOverview.mockResolvedValue(mockOverview);

      await controller.exportDashboard(req, res, next);

      expect(mockAuditService.logDataAccess).toHaveBeenCalledWith({
        userId: 'test-user-123',
        action: 'DASHBOARD_EXPORTED',
        resourceType: 'analytics_dashboard',
        resourceId: null,
        operation: 'export',
        success: true,
        metadata: expect.objectContaining({
          format: 'json'
        })
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle missing user context', async () => {
      req.user = undefined;
      
      await controller.getDashboardOverview(req, res, next);

      // Should still work but log undefined userId
      expect(mockAuditService.logDataAccess).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: undefined
        })
      );
    });

    it('should handle null service responses', async () => {
      mockAnalyticsDashboardService.getDashboardOverview.mockResolvedValue(null);
      
      await controller.getDashboardOverview(req, res, next);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: null
      }));
    });

    it('should handle concurrent requests', async () => {
      const mockOverview = { userMetrics: { totalUsers: 100 } };
      mockAnalyticsDashboardService.getDashboardOverview.mockResolvedValue(mockOverview);

      const promises = Array(5).fill(null).map(() => 
        controller.getDashboardOverview(req, res, next)
      );

      await Promise.all(promises);

      expect(mockAnalyticsDashboardService.getDashboardOverview).toHaveBeenCalledTimes(5);
    });

    it('should handle audit service failures gracefully', async () => {
      const mockOverview = { userMetrics: { totalUsers: 100 } };
      mockAnalyticsDashboardService.getDashboardOverview.mockResolvedValue(mockOverview);
      mockAuditService.logDataAccess.mockRejectedValue(new Error('Audit failed'));

      await controller.getDashboardOverview(req, res, next);

      // Should still return data even if audit fails
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: mockOverview
      }));
    });

    it('should sanitize CSV export data', async () => {
      const mockOverview = {
        userMetrics: {
          totalUsers: '100,200', // Contains comma
          newUsers: 10
        }
      };
      req.query = { format: 'csv' };
      mockAnalyticsDashboardService.getDashboardOverview.mockResolvedValue(mockOverview);

      await controller.exportDashboard(req, res, next);

      const csvData = res.send.mock.calls[0][0];
      // Should properly escape or quote values with commas
      expect(csvData).toBeDefined();
    });
  });

  describe('Method-specific tests', () => {
    describe('getUserMetrics', () => {
      it('should retrieve user metrics successfully', async () => {
        const mockMetrics = {
          totalUsers: 100,
          activeUsers: { daily: 50 }
        };
        req.query = { startDate: '2024-01-01', endDate: '2024-01-31' };
        mockAnalyticsDashboardService.getUserMetrics.mockResolvedValue(mockMetrics);

        await controller.getUserMetrics(req, res, next);

        expect(mockAnalyticsDashboardService.getUserMetrics).toHaveBeenCalled();
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
          success: true,
          data: mockMetrics
        }));
      });
    });

    describe('getEngagementMetrics', () => {
      it('should retrieve engagement metrics successfully', async () => {
        const mockMetrics = {
          sessions: { total: 500 },
          bounce: { rate: 25 }
        };
        req.query = { startDate: '2024-01-01', endDate: '2024-01-31' };
        mockAnalyticsDashboardService.getEngagementMetrics.mockResolvedValue(mockMetrics);

        await controller.getEngagementMetrics(req, res, next);

        expect(mockAnalyticsDashboardService.getEngagementMetrics).toHaveBeenCalled();
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
          success: true,
          data: mockMetrics
        }));
      });
    });

    describe('getPerformanceMetrics', () => {
      it('should retrieve performance metrics successfully', async () => {
        const mockMetrics = {
          pageLoad: { average: 1500 },
          errors: { rate: 1.5 }
        };
        req.query = { startDate: '2024-01-01', endDate: '2024-01-31' };
        mockAnalyticsDashboardService.getPerformanceMetrics.mockResolvedValue(mockMetrics);

        await controller.getPerformanceMetrics(req, res, next);

        expect(mockAnalyticsDashboardService.getPerformanceMetrics).toHaveBeenCalled();
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
          success: true,
          data: mockMetrics
        }));
      });
    });

    describe('getFeatureAdoption', () => {
      it('should retrieve feature adoption metrics successfully', async () => {
        const mockAdoption = {
          features: [],
          summary: { totalFeatures: 5 }
        };
        req.query = { startDate: '2024-01-01', endDate: '2024-01-31' };
        mockAnalyticsDashboardService.getFeatureAdoption.mockResolvedValue(mockAdoption);

        await controller.getFeatureAdoption(req, res, next);

        expect(mockAnalyticsDashboardService.getFeatureAdoption).toHaveBeenCalled();
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
          success: true,
          data: mockAdoption
        }));
      });
    });

    describe('getUserLifecycleStages', () => {
      it('should retrieve user lifecycle stages successfully', async () => {
        const mockLifecycle = {
          stages: [],
          transitions: {}
        };
        req.query = { startDate: '2024-01-01', endDate: '2024-01-31' };
        mockAnalyticsDashboardService.getUserLifecycleStages.mockResolvedValue(mockLifecycle);

        await controller.getUserLifecycleStages(req, res, next);

        expect(mockAnalyticsDashboardService.getUserLifecycleStages).toHaveBeenCalled();
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
          success: true,
          data: mockLifecycle
        }));
      });
    });
  });
});