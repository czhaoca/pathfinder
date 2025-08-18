const BaseController = require('./BaseController');
const logger = require('../../utils/logger');

class AnalyticsDashboardController extends BaseController {
  constructor(analyticsDashboardService, auditService) {
    super();
    this.analyticsDashboardService = analyticsDashboardService;
    this.auditService = auditService;
  }

  /**
   * Get dashboard overview
   */
  async getDashboardOverview(req, res, next) {
    try {
      const { startDate, endDate } = this.validateDateRange(req.query);

      const overview = await this.analyticsDashboardService.getDashboardOverview(
        startDate,
        endDate
      );

      await this.auditService.logDataAccess({
        userId: req.user.userId,
        action: 'DASHBOARD_OVERVIEW_VIEWED',
        resourceType: 'analytics_dashboard',
        resourceId: null,
        operation: 'read',
        success: true,
        metadata: { startDate, endDate }
      });

      return this.sendSuccess(res, overview, 'Dashboard overview retrieved successfully');
    } catch (error) {
      logger.error('Failed to get dashboard overview', { 
        error: error.message,
        userId: req.user?.userId 
      });
      return this.sendError(res, error);
    }
  }

  /**
   * Get real-time metrics
   */
  async getRealtimeMetrics(req, res, next) {
    try {
      const metrics = await this.analyticsDashboardService.getRealtimeMetrics();

      await this.auditService.logDataAccess({
        userId: req.user.userId,
        action: 'REALTIME_METRICS_VIEWED',
        resourceType: 'analytics_dashboard',
        resourceId: null,
        operation: 'read',
        success: true
      });

      return this.sendSuccess(res, metrics, 'Real-time metrics retrieved successfully');
    } catch (error) {
      logger.error('Failed to get real-time metrics', { 
        error: error.message,
        userId: req.user?.userId 
      });
      return this.sendError(res, error);
    }
  }

  /**
   * Get retention cohorts
   */
  async getRetentionCohorts(req, res, next) {
    try {
      const { cohortType = 'weekly' } = req.query;
      const { startDate, endDate } = this.validateDateRange(req.query);

      if (!['daily', 'weekly', 'monthly'].includes(cohortType)) {
        return this.sendBadRequest(res, 'Invalid cohort type. Must be daily, weekly, or monthly');
      }

      const retention = await this.analyticsDashboardService.getRetentionCohorts(
        cohortType,
        startDate,
        endDate
      );

      await this.auditService.logDataAccess({
        userId: req.user.userId,
        action: 'RETENTION_COHORTS_VIEWED',
        resourceType: 'analytics_dashboard',
        resourceId: null,
        operation: 'read',
        success: true,
        metadata: { cohortType, startDate, endDate }
      });

      return this.sendSuccess(res, retention, 'Retention cohorts retrieved successfully');
    } catch (error) {
      logger.error('Failed to get retention cohorts', { 
        error: error.message,
        userId: req.user?.userId 
      });
      return this.sendError(res, error);
    }
  }

  /**
   * Get funnel analysis
   */
  async getFunnelAnalysis(req, res, next) {
    try {
      const { funnelId } = req.params;
      const { segment } = req.query;
      const { startDate, endDate } = this.validateDateRange(req.query);

      if (!funnelId) {
        return this.sendBadRequest(res, 'Funnel ID is required');
      }

      const funnel = await this.analyticsDashboardService.getFunnelAnalysis(
        funnelId,
        startDate,
        endDate,
        segment
      );

      await this.auditService.logDataAccess({
        userId: req.user.userId,
        action: 'FUNNEL_ANALYSIS_VIEWED',
        resourceType: 'analytics_dashboard',
        resourceId: funnelId,
        operation: 'read',
        success: true,
        metadata: { segment, startDate, endDate }
      });

      return this.sendSuccess(res, funnel, 'Funnel analysis retrieved successfully');
    } catch (error) {
      logger.error('Failed to get funnel analysis', { 
        error: error.message,
        userId: req.user?.userId,
        funnelId: req.params?.funnelId 
      });
      return this.sendError(res, error);
    }
  }

  /**
   * Get feature adoption metrics
   */
  async getFeatureAdoption(req, res, next) {
    try {
      const { startDate, endDate } = this.validateDateRange(req.query);

      const adoption = await this.analyticsDashboardService.getFeatureAdoption(
        startDate,
        endDate
      );

      await this.auditService.logDataAccess({
        userId: req.user.userId,
        action: 'FEATURE_ADOPTION_VIEWED',
        resourceType: 'analytics_dashboard',
        resourceId: null,
        operation: 'read',
        success: true,
        metadata: { startDate, endDate }
      });

      return this.sendSuccess(res, adoption, 'Feature adoption metrics retrieved successfully');
    } catch (error) {
      logger.error('Failed to get feature adoption', { 
        error: error.message,
        userId: req.user?.userId 
      });
      return this.sendError(res, error);
    }
  }

  /**
   * Get user lifecycle stages
   */
  async getUserLifecycleStages(req, res, next) {
    try {
      const { startDate, endDate } = this.validateDateRange(req.query);

      const lifecycle = await this.analyticsDashboardService.getUserLifecycleStages(
        startDate,
        endDate
      );

      await this.auditService.logDataAccess({
        userId: req.user.userId,
        action: 'USER_LIFECYCLE_VIEWED',
        resourceType: 'analytics_dashboard',
        resourceId: null,
        operation: 'read',
        success: true,
        metadata: { startDate, endDate }
      });

      return this.sendSuccess(res, lifecycle, 'User lifecycle stages retrieved successfully');
    } catch (error) {
      logger.error('Failed to get user lifecycle stages', { 
        error: error.message,
        userId: req.user?.userId 
      });
      return this.sendError(res, error);
    }
  }

  /**
   * Get user metrics
   */
  async getUserMetrics(req, res, next) {
    try {
      const { startDate, endDate } = this.validateDateRange(req.query);

      const metrics = await this.analyticsDashboardService.getUserMetrics(
        startDate,
        endDate
      );

      await this.auditService.logDataAccess({
        userId: req.user.userId,
        action: 'USER_METRICS_VIEWED',
        resourceType: 'analytics_dashboard',
        resourceId: null,
        operation: 'read',
        success: true,
        metadata: { startDate, endDate }
      });

      return this.sendSuccess(res, metrics, 'User metrics retrieved successfully');
    } catch (error) {
      logger.error('Failed to get user metrics', { 
        error: error.message,
        userId: req.user?.userId 
      });
      return this.sendError(res, error);
    }
  }

  /**
   * Get engagement metrics
   */
  async getEngagementMetrics(req, res, next) {
    try {
      const { startDate, endDate } = this.validateDateRange(req.query);

      const metrics = await this.analyticsDashboardService.getEngagementMetrics(
        startDate,
        endDate
      );

      await this.auditService.logDataAccess({
        userId: req.user.userId,
        action: 'ENGAGEMENT_METRICS_VIEWED',
        resourceType: 'analytics_dashboard',
        resourceId: null,
        operation: 'read',
        success: true,
        metadata: { startDate, endDate }
      });

      return this.sendSuccess(res, metrics, 'Engagement metrics retrieved successfully');
    } catch (error) {
      logger.error('Failed to get engagement metrics', { 
        error: error.message,
        userId: req.user?.userId 
      });
      return this.sendError(res, error);
    }
  }

  /**
   * Get performance metrics
   */
  async getPerformanceMetrics(req, res, next) {
    try {
      const { startDate, endDate } = this.validateDateRange(req.query);

      const metrics = await this.analyticsDashboardService.getPerformanceMetrics(
        startDate,
        endDate
      );

      await this.auditService.logDataAccess({
        userId: req.user.userId,
        action: 'PERFORMANCE_METRICS_VIEWED',
        resourceType: 'analytics_dashboard',
        resourceId: null,
        operation: 'read',
        success: true,
        metadata: { startDate, endDate }
      });

      return this.sendSuccess(res, metrics, 'Performance metrics retrieved successfully');
    } catch (error) {
      logger.error('Failed to get performance metrics', { 
        error: error.message,
        userId: req.user?.userId 
      });
      return this.sendError(res, error);
    }
  }

  /**
   * Generate analytics report
   */
  async generateReport(req, res, next) {
    try {
      const { 
        type = 'comprehensive',
        format = 'json',
        metrics = ['users', 'engagement', 'retention', 'performance']
      } = req.body;
      
      const { startDate, endDate } = this.validateDateRange(req.body);

      // Validate format
      if (!['json', 'csv', 'pdf', 'excel'].includes(format)) {
        return this.sendBadRequest(res, 'Invalid format. Must be json, csv, pdf, or excel');
      }

      // Validate metrics
      const validMetrics = ['users', 'engagement', 'retention', 'performance', 'features', 'lifecycle'];
      const invalidMetrics = metrics.filter(m => !validMetrics.includes(m));
      if (invalidMetrics.length > 0) {
        return this.sendBadRequest(res, `Invalid metrics: ${invalidMetrics.join(', ')}`);
      }

      const reportConfig = {
        type,
        startDate,
        endDate,
        metrics,
        format
      };

      const report = await this.analyticsDashboardService.generateReport(reportConfig);

      await this.auditService.logDataAccess({
        userId: req.user.userId,
        action: 'ANALYTICS_REPORT_GENERATED',
        resourceType: 'analytics_dashboard',
        resourceId: null,
        operation: 'export',
        success: true,
        metadata: reportConfig
      });

      // Set appropriate headers based on format
      if (format === 'csv') {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="analytics-report-${Date.now()}.csv"`);
        return res.send(report);
      } else if (format === 'pdf') {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="analytics-report-${Date.now()}.pdf"`);
        return res.send(report);
      } else if (format === 'excel') {
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="analytics-report-${Date.now()}.xlsx"`);
        return res.send(report);
      }

      return this.sendSuccess(res, report, 'Analytics report generated successfully');
    } catch (error) {
      logger.error('Failed to generate report', { 
        error: error.message,
        userId: req.user?.userId 
      });
      return this.sendError(res, error);
    }
  }

  /**
   * Export dashboard data
   */
  async exportDashboard(req, res, next) {
    try {
      const { format = 'json' } = req.query;
      const { startDate, endDate } = this.validateDateRange(req.query);

      const overview = await this.analyticsDashboardService.getDashboardOverview(
        startDate,
        endDate
      );

      await this.auditService.logDataAccess({
        userId: req.user.userId,
        action: 'DASHBOARD_EXPORTED',
        resourceType: 'analytics_dashboard',
        resourceId: null,
        operation: 'export',
        success: true,
        metadata: { format, startDate, endDate }
      });

      if (format === 'csv') {
        const csv = this.convertToCSV(overview);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="dashboard-${Date.now()}.csv"`);
        return res.send(csv);
      }

      return this.sendSuccess(res, overview, 'Dashboard data exported successfully');
    } catch (error) {
      logger.error('Failed to export dashboard', { 
        error: error.message,
        userId: req.user?.userId 
      });
      return this.sendError(res, error);
    }
  }

  /**
   * Helper method to validate date range
   */
  validateDateRange(params) {
    const { startDate, endDate } = params;
    
    let start = startDate ? new Date(startDate) : new Date();
    let end = endDate ? new Date(endDate) : new Date();

    // Default to last 30 days if not provided
    if (!startDate) {
      start.setDate(start.getDate() - 30);
    }

    // Validate dates
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new Error('Invalid date format');
    }

    if (start > end) {
      throw new Error('Start date must be before end date');
    }

    // Maximum date range of 1 year
    const maxRange = 365 * 24 * 60 * 60 * 1000;
    if (end - start > maxRange) {
      throw new Error('Date range cannot exceed 1 year');
    }

    return { startDate: start, endDate: end };
  }

  /**
   * Convert data to CSV format
   */
  convertToCSV(data) {
    const rows = [];
    
    // Add headers
    rows.push('Category,Metric,Value');
    
    // Add user metrics
    if (data.userMetrics) {
      rows.push(`Users,Total,${data.userMetrics.totalUsers}`);
      rows.push(`Users,New,${data.userMetrics.newUsers}`);
      rows.push(`Users,Daily Active,${data.userMetrics.activeUsers?.daily}`);
      rows.push(`Users,Weekly Active,${data.userMetrics.activeUsers?.weekly}`);
      rows.push(`Users,Monthly Active,${data.userMetrics.activeUsers?.monthly}`);
    }
    
    // Add engagement metrics
    if (data.engagementMetrics) {
      rows.push(`Engagement,Total Sessions,${data.engagementMetrics.sessions?.total}`);
      rows.push(`Engagement,Avg Session Duration,${data.engagementMetrics.sessions?.duration?.average}`);
      rows.push(`Engagement,Bounce Rate,${data.engagementMetrics.bounce?.rate}`);
    }
    
    // Add performance metrics
    if (data.performanceMetrics) {
      rows.push(`Performance,Avg Page Load,${data.performanceMetrics.pageLoad?.average}`);
      rows.push(`Performance,Error Rate,${data.performanceMetrics.errors?.rate}`);
      rows.push(`Performance,Uptime,${data.performanceMetrics.availability?.uptime}`);
    }
    
    return rows.join('\n');
  }
}

module.exports = AnalyticsDashboardController;