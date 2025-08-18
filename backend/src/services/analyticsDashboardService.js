const logger = require('../utils/logger');

/**
 * AnalyticsDashboardService - Comprehensive dashboard for user metrics and retention
 * 
 * Features:
 * - User overview metrics widget
 * - Active user trends chart
 * - Retention cohort analysis
 * - Engagement heatmap
 * - Feature adoption funnel
 * - Geographic distribution
 * - User growth timeline
 * - Performance metrics
 */
class AnalyticsDashboardService {
  constructor(analyticsRepository, cacheService) {
    this.analyticsRepository = analyticsRepository;
    this.cacheService = cacheService;
    this.metricsCache = new Map();
  }

  /**
   * Get comprehensive dashboard overview
   */
  async getDashboardOverview(startDate, endDate) {
    const cacheKey = `dashboard:overview:${startDate.toISOString()}:${endDate.toISOString()}`;
    const cached = await this.cacheService.get(cacheKey);
    if (cached) return cached;

    const [
      userMetrics,
      engagementMetrics,
      performanceMetrics,
      topFeatures,
      recentErrors
    ] = await Promise.all([
      this.getUserMetrics(startDate, endDate),
      this.getEngagementMetrics(startDate, endDate),
      this.getPerformanceMetrics(startDate, endDate),
      this.getTopFeatures(startDate, endDate),
      this.getRecentErrors(startDate, endDate)
    ]);

    const overview = {
      userMetrics,
      engagementMetrics,
      performanceMetrics,
      topFeatures,
      recentErrors,
      generatedAt: new Date()
    };

    // Cache for 5 minutes
    await this.cacheService.set(cacheKey, overview, 300);

    return overview;
  }

  /**
   * Get user metrics for dashboard
   */
  async getUserMetrics(startDate, endDate) {
    const metrics = await this.analyticsRepository.getUserMetrics(startDate, endDate);
    
    return {
      totalUsers: metrics.totalUsers,
      newUsers: metrics.newUsers,
      activeUsers: {
        daily: metrics.dau,
        weekly: metrics.wau,
        monthly: metrics.mau
      },
      growth: {
        rate: this.calculateGrowthRate(metrics),
        trend: this.calculateTrend(metrics)
      },
      churn: {
        rate: metrics.churnRate,
        count: metrics.churnedUsers
      },
      userSegments: await this.getUserSegments(startDate, endDate),
      geographicDistribution: await this.getGeographicDistribution(startDate, endDate)
    };
  }

  /**
   * Get engagement metrics
   */
  async getEngagementMetrics(startDate, endDate) {
    const engagement = await this.analyticsRepository.getEngagementMetrics(
      startDate,
      endDate
    );

    return {
      sessions: {
        total: engagement.totalSessions,
        average: engagement.avgSessionsPerUser,
        duration: {
          average: engagement.avgDuration,
          median: engagement.medianDuration,
          distribution: engagement.durationDistribution
        }
      },
      pageViews: {
        total: engagement.totalPageViews,
        perSession: engagement.pageViewsPerSession,
        unique: engagement.uniquePageViews,
        topPages: engagement.topPages
      },
      actions: {
        total: engagement.totalActions,
        perUser: engagement.actionsPerUser,
        topActions: engagement.topActions
      },
      bounce: {
        rate: engagement.bounceRate,
        count: engagement.bouncedSessions
      },
      engagementHeatmap: await this.generateEngagementHeatmap(startDate, endDate)
    };
  }

  /**
   * Get retention cohorts
   */
  async getRetentionCohorts(cohortType, startDate, endDate) {
    const cohortSize = cohortType === 'daily' ? 1 : cohortType === 'weekly' ? 7 : 30;
    const cohorts = [];

    let currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const cohortEndDate = new Date(currentDate);
      cohortEndDate.setDate(cohortEndDate.getDate() + cohortSize);

      const cohortData = await this.calculateCohortRetention(
        currentDate,
        cohortEndDate
      );

      cohorts.push({
        cohortDate: currentDate.toISOString(),
        cohortSize: cohortData.size,
        retention: cohortData.retention
      });

      currentDate.setDate(currentDate.getDate() + cohortSize);
    }

    return {
      cohortType,
      cohorts,
      summary: this.calculateRetentionSummary(cohorts)
    };
  }

  /**
   * Calculate retention for a specific cohort
   */
  async calculateCohortRetention(cohortStart, cohortEnd) {
    // Get users who joined in this cohort
    const cohortUsers = await this.analyticsRepository.getNewUsers(
      cohortStart,
      cohortEnd
    );

    const retentionData = [];
    const maxDays = 30; // Track 30 days of retention

    for (let day = 0; day <= maxDays; day++) {
      const checkDate = new Date(cohortStart);
      checkDate.setDate(checkDate.getDate() + day);

      const activeUsers = await this.analyticsRepository.getActiveUsersFromCohort(
        cohortUsers.map(u => u.userId),
        checkDate
      );

      retentionData.push({
        day,
        retained: activeUsers.length,
        percentage: cohortUsers.length > 0 ? (activeUsers.length / cohortUsers.length) * 100 : 0
      });
    }

    return {
      size: cohortUsers.length,
      retention: retentionData
    };
  }

  /**
   * Get funnel analysis for conversion tracking
   */
  async getFunnelAnalysis(funnelId, startDate, endDate, segment) {
    const funnelConfig = await this.getFunnelConfiguration(funnelId);
    const steps = [];

    let previousStepUsers = null;
    for (const step of funnelConfig.steps) {
      const stepUsers = await this.analyticsRepository.getUsersCompletedStep(
        step.eventType,
        step.eventAction,
        startDate,
        endDate,
        segment
      );

      const dropoff = previousStepUsers 
        ? previousStepUsers.length - stepUsers.length
        : 0;

      steps.push({
        name: step.name,
        users: stepUsers.length,
        conversionRate: previousStepUsers 
          ? (stepUsers.length / previousStepUsers.length) * 100
          : 100,
        dropoff,
        dropoffRate: previousStepUsers
          ? (dropoff / previousStepUsers.length) * 100
          : 0
      });

      previousStepUsers = stepUsers;
    }

    return {
      funnelId,
      name: funnelConfig.name,
      steps,
      overallConversion: steps.length > 0 && steps[0].users > 0
        ? (steps[steps.length - 1].users / steps[0].users) * 100
        : 0,
      period: { startDate, endDate },
      segment
    };
  }

  /**
   * Get real-time metrics
   */
  async getRealtimeMetrics() {
    const now = new Date();
    const fiveMinutesAgo = new Date(now - 5 * 60 * 1000);

    const [
      activeUsers,
      activeSessions,
      recentEvents,
      errorRate
    ] = await Promise.all([
      this.analyticsRepository.getActiveUsers(fiveMinutesAgo, now),
      this.analyticsRepository.getActiveSessions(fiveMinutesAgo, now),
      this.analyticsRepository.getRecentEvents(fiveMinutesAgo, now),
      this.analyticsRepository.getErrorRate(fiveMinutesAgo, now)
    ]);

    return {
      timestamp: now,
      activeUsers: activeUsers.length,
      activeSessions: activeSessions.length,
      eventsPerSecond: recentEvents.length / 300,
      errorRate,
      topPages: this.extractTopPages(recentEvents),
      recentErrors: this.extractRecentErrors(recentEvents)
    };
  }

  /**
   * Get performance metrics with percentiles
   */
  async getPerformanceMetrics(startDate, endDate) {
    const performance = await this.analyticsRepository.getPerformanceMetrics(
      startDate,
      endDate
    );

    return {
      pageLoad: {
        average: performance.avgPageLoadTime,
        median: performance.medianPageLoadTime,
        p95: performance.p95PageLoadTime,
        p99: performance.p99PageLoadTime
      },
      apiLatency: {
        average: performance.avgApiLatency,
        median: performance.medianApiLatency,
        p95: performance.p95ApiLatency,
        p99: performance.p99ApiLatency
      },
      errors: {
        total: performance.totalErrors,
        rate: performance.errorRate,
        byType: performance.errorsByType,
        topErrors: performance.topErrors
      },
      availability: {
        uptime: performance.uptimePercentage,
        incidents: performance.incidents
      }
    };
  }

  /**
   * Get feature adoption metrics
   */
  async getFeatureAdoption(startDate, endDate) {
    const features = await this.analyticsRepository.getFeatureUsage(startDate, endDate);
    
    const adoption = features.map(feature => ({
      featureName: feature.name,
      uniqueUsers: feature.uniqueUsers,
      totalUsage: feature.totalUsage,
      adoptionRate: feature.adoptionRate,
      averageUsagePerUser: feature.uniqueUsers > 0 
        ? feature.totalUsage / feature.uniqueUsers 
        : 0,
      trend: feature.trend,
      firstUsed: feature.firstUsed,
      lastUsed: feature.lastUsed
    }));

    return {
      features: adoption,
      summary: {
        totalFeatures: adoption.length,
        averageAdoptionRate: adoption.reduce((sum, f) => sum + f.adoptionRate, 0) / adoption.length,
        mostUsed: adoption.sort((a, b) => b.totalUsage - a.totalUsage)[0],
        leastUsed: adoption.sort((a, b) => a.totalUsage - b.totalUsage)[0]
      }
    };
  }

  /**
   * Get user lifecycle stages
   */
  async getUserLifecycleStages(startDate, endDate) {
    const users = await this.analyticsRepository.getAllUsers(startDate, endDate);
    
    const stages = {
      new: [],
      active: [],
      engaged: [],
      powerUsers: [],
      atRisk: [],
      dormant: [],
      churned: []
    };

    for (const user of users) {
      const stage = await this.determineUserStage(user);
      stages[stage].push(user);
    }

    return {
      stages: Object.entries(stages).map(([stage, users]) => ({
        stage,
        count: users.length,
        percentage: (users.length / users.length) * 100,
        users: users.slice(0, 10) // Top 10 for preview
      })),
      transitions: await this.calculateStageTransitions(startDate, endDate)
    };
  }

  /**
   * Generate comprehensive report
   */
  async generateReport(reportConfig) {
    const { type, startDate, endDate, metrics, format } = reportConfig;

    // Gather requested metrics
    const reportData = {};
    for (const metric of metrics) {
      switch (metric) {
        case 'users':
          reportData.users = await this.getUserMetrics(startDate, endDate);
          break;
        case 'engagement':
          reportData.engagement = await this.getEngagementMetrics(startDate, endDate);
          break;
        case 'retention':
          reportData.retention = await this.getRetentionCohorts('weekly', startDate, endDate);
          break;
        case 'performance':
          reportData.performance = await this.getPerformanceMetrics(startDate, endDate);
          break;
        case 'features':
          reportData.features = await this.getFeatureAdoption(startDate, endDate);
          break;
        case 'lifecycle':
          reportData.lifecycle = await this.getUserLifecycleStages(startDate, endDate);
          break;
      }
    }

    // Format report
    let report;
    switch (format) {
      case 'pdf':
        report = await this.generatePDFReport(reportData);
        break;
      case 'excel':
        report = await this.generateExcelReport(reportData);
        break;
      case 'csv':
        report = await this.generateCSVReport(reportData);
        break;
      case 'json':
      default:
        report = reportData;
        break;
    }

    return report;
  }

  /**
   * Optimization methods
   */
  async precomputeMetrics() {
    // Run daily to precompute expensive metrics
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Precompute and cache daily metrics
    await this.getUserMetrics(yesterday, today);
    await this.getEngagementMetrics(yesterday, today);
    await this.getPerformanceMetrics(yesterday, today);

    logger.info('Precomputed daily metrics', { date: yesterday });
  }

  optimizeQueries(startDate, endDate) {
    const daysDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));

    if (daysDiff > 90) {
      // Use pre-aggregated monthly data
      return 'monthly';
    } else if (daysDiff > 30) {
      // Use pre-aggregated weekly data
      return 'weekly';
    } else if (daysDiff > 7) {
      // Use pre-aggregated daily data
      return 'daily';
    } else {
      // Use raw data
      return 'raw';
    }
  }

  /**
   * Helper methods
   */
  calculateGrowthRate(metrics) {
    if (!metrics.previousPeriodUsers || metrics.previousPeriodUsers === 0) {
      return metrics.totalUsers > 0 ? 100 : 0;
    }
    return ((metrics.totalUsers - metrics.previousPeriodUsers) / metrics.previousPeriodUsers) * 100;
  }

  calculateTrend(metrics) {
    if (!metrics.trend) return 'stable';
    if (metrics.trend > 10) return 'growing';
    if (metrics.trend < -10) return 'declining';
    return 'stable';
  }

  calculateRetentionSummary(cohorts) {
    if (!cohorts || cohorts.length === 0) {
      return {
        averageDay1Retention: 0,
        averageDay7Retention: 0,
        averageDay30Retention: 0
      };
    }

    let day1Total = 0, day7Total = 0, day30Total = 0;
    let day1Count = 0, day7Count = 0, day30Count = 0;

    cohorts.forEach(cohort => {
      const day1 = cohort.retention.find(r => r.day === 1);
      const day7 = cohort.retention.find(r => r.day === 7);
      const day30 = cohort.retention.find(r => r.day === 30);

      if (day1) {
        day1Total += day1.percentage;
        day1Count++;
      }
      if (day7) {
        day7Total += day7.percentage;
        day7Count++;
      }
      if (day30) {
        day30Total += day30.percentage;
        day30Count++;
      }
    });

    return {
      averageDay1Retention: day1Count > 0 ? day1Total / day1Count : 0,
      averageDay7Retention: day7Count > 0 ? day7Total / day7Count : 0,
      averageDay30Retention: day30Count > 0 ? day30Total / day30Count : 0
    };
  }

  async getUserSegments(startDate, endDate) {
    // Implementation for user segmentation
    return {
      highlyEngaged: 0,
      active: 0,
      casual: 0,
      atRisk: 0,
      dormant: 0
    };
  }

  async getGeographicDistribution(startDate, endDate) {
    // Implementation for geographic distribution
    return [];
  }

  async generateEngagementHeatmap(startDate, endDate) {
    // Implementation for engagement heatmap
    return {
      hourly: [],
      daily: []
    };
  }

  async getTopFeatures(startDate, endDate) {
    // Implementation for top features
    return [];
  }

  async getRecentErrors(startDate, endDate) {
    // Implementation for recent errors
    return [];
  }

  extractTopPages(events) {
    const pageViews = {};
    events.forEach(event => {
      if (event.eventType === 'page_view' && event.pageUrl) {
        pageViews[event.pageUrl] = (pageViews[event.pageUrl] || 0) + 1;
      }
    });

    return Object.entries(pageViews)
      .map(([url, views]) => ({ url, views }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 10);
  }

  extractRecentErrors(events) {
    return events
      .filter(event => event.eventType === 'error')
      .map(event => ({
        message: event.message || 'Unknown error',
        timestamp: event.eventTimestamp
      }))
      .slice(0, 10);
  }

  async getFunnelConfiguration(funnelId) {
    // Predefined funnel configurations
    const funnels = {
      onboarding: {
        name: 'Onboarding Funnel',
        steps: [
          { name: 'Registration', eventType: 'signup', eventAction: 'complete' },
          { name: 'Profile Setup', eventType: 'profile', eventAction: 'complete' },
          { name: 'First Experience', eventType: 'experience', eventAction: 'create' }
        ]
      },
      engagement: {
        name: 'Engagement Funnel',
        steps: [
          { name: 'Login', eventType: 'auth', eventAction: 'login' },
          { name: 'View Dashboard', eventType: 'page_view', eventAction: '/dashboard' },
          { name: 'Interact', eventType: 'interaction', eventAction: 'any' }
        ]
      },
      conversion: {
        name: 'Conversion Funnel',
        steps: [
          { name: 'Visit Landing', eventType: 'page_view', eventAction: '/landing' },
          { name: 'Start Trial', eventType: 'trial', eventAction: 'start' },
          { name: 'Subscribe', eventType: 'subscription', eventAction: 'create' }
        ]
      }
    };

    return funnels[funnelId] || {
      name: 'Custom Funnel',
      steps: []
    };
  }

  async determineUserStage(user) {
    // Logic to determine user lifecycle stage
    const daysSinceLastActivity = Math.floor(
      (new Date() - new Date(user.lastActivity)) / (1000 * 60 * 60 * 24)
    );

    if (daysSinceLastActivity <= 1) return 'active';
    if (daysSinceLastActivity <= 7) return 'engaged';
    if (daysSinceLastActivity <= 30) return 'atRisk';
    if (daysSinceLastActivity <= 90) return 'dormant';
    return 'churned';
  }

  async calculateStageTransitions(startDate, endDate) {
    // Implementation for calculating user stage transitions
    return {
      newToActive: 0,
      activeToEngaged: 0,
      engagedToPowerUser: 0,
      activeToAtRisk: 0,
      atRiskToDormant: 0,
      dormantToChurned: 0,
      reactivated: 0
    };
  }

  async generatePDFReport(data) {
    // Implementation for PDF generation
    // This would use a library like puppeteer or pdfkit
    return 'pdf-content';
  }

  async generateExcelReport(data) {
    // Implementation for Excel generation
    // This would use a library like exceljs
    return 'excel-content';
  }

  async generateCSVReport(data) {
    // Implementation for CSV generation
    const csv = [];
    
    // Headers
    csv.push('Metric,Value,Date');
    
    // Add data rows
    if (data.users) {
      csv.push(`Total Users,${data.users.totalUsers},${new Date().toISOString()}`);
      csv.push(`New Users,${data.users.newUsers},${new Date().toISOString()}`);
    }
    
    return csv.join('\n');
  }
}

module.exports = AnalyticsDashboardService;