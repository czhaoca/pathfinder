# Issue #28: Analytics Dashboard for User Metrics

## Title  
Build Performance-Optimized Analytics Dashboard with Real-time and Batch Metrics

## User Story
As a platform administrator, I want to view comprehensive user analytics through an intuitive dashboard so that I can understand user behavior, track platform health, and make data-driven decisions.

## Description
Create a comprehensive analytics dashboard that visualizes user metrics, retention cohorts, engagement patterns, and platform performance. The dashboard will support both real-time metrics and batch-processed historical data with performance-optimized queries. It integrates with the tiered storage system to provide seamless access to hot and cold data.

## Acceptance Criteria

### Dashboard Features
- [ ] Real-time metrics display (< 5 second refresh)
- [ ] Historical trend analysis with date range selection
- [ ] User retention cohort visualization
- [ ] Engagement funnel analysis
- [ ] Feature adoption tracking
- [ ] Performance metrics monitoring

### Metrics & Visualizations
- [ ] Active users (DAU, WAU, MAU)
- [ ] User retention curves
- [ ] Session duration distribution
- [ ] Feature usage heatmaps
- [ ] Error rate monitoring
- [ ] Geographic distribution maps

### Performance Requirements
- [ ] Dashboard load time < 2 seconds
- [ ] Query response time < 500ms for hot data
- [ ] Efficient pagination for large datasets
- [ ] Caching for frequently accessed metrics
- [ ] Progressive loading for complex visualizations
- [ ] Export capabilities for reports

### User Experience
- [ ] Responsive design for mobile/tablet
- [ ] Customizable dashboard layouts
- [ ] Saved dashboard configurations
- [ ] Scheduled report generation
- [ ] Alert configuration for metrics
- [ ] Drill-down capabilities

## Technical Implementation

### API Endpoints for Dashboard

```javascript
// backend/src/api/routes/analyticsRoutes.js
router.get('/analytics/dashboard/overview', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const overview = await analyticsService.getDashboardOverview(startDate, endDate);
    res.json(overview);
  } catch (error) {
    next(error);
  }
});

router.get('/analytics/metrics/realtime', authenticate, authorize('admin'), async (req, res) => {
  try {
    const metrics = await analyticsService.getRealtimeMetrics();
    res.json(metrics);
  } catch (error) {
    next(error);
  }
});

router.get('/analytics/cohorts/retention', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { cohortType, startDate, endDate } = req.query;
    const retention = await analyticsService.getRetentionCohorts(
      cohortType,
      startDate,
      endDate
    );
    res.json(retention);
  } catch (error) {
    next(error);
  }
});

router.get('/analytics/funnels/:funnelId', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { funnelId } = req.params;
    const { startDate, endDate, segment } = req.query;
    const funnel = await analyticsService.getFunnelAnalysis(
      funnelId,
      startDate,
      endDate,
      segment
    );
    res.json(funnel);
  } catch (error) {
    next(error);
  }
});

// WebSocket for real-time updates
io.on('connection', (socket) => {
  socket.on('subscribe:realtime-metrics', () => {
    const interval = setInterval(async () => {
      const metrics = await analyticsService.getRealtimeMetrics();
      socket.emit('metrics:update', metrics);
    }, 5000);

    socket.on('disconnect', () => {
      clearInterval(interval);
    });
  });
});
```

### Analytics Dashboard Service

```javascript
// backend/src/services/analyticsDashboardService.js
class AnalyticsDashboardService {
  constructor(analyticsRepository, cacheService) {
    this.analyticsRepository = analyticsRepository;
    this.cacheService = cacheService;
    this.metricsCache = new Map();
  }

  async getDashboardOverview(startDate, endDate) {
    const cacheKey = `dashboard:overview:${startDate}:${endDate}`;
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
      }
    };
  }

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
      }
    };
  }

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
        percentage: (activeUsers.length / cohortUsers.length) * 100
      });
    }

    return {
      size: cohortUsers.length,
      retention: retentionData
    };
  }

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
      overallConversion: steps.length > 0
        ? (steps[steps.length - 1].users / steps[0].users) * 100
        : 0,
      period: { startDate, endDate },
      segment
    };
  }

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
      case 'json':
        report = reportData;
        break;
    }

    return report;
  }

  // Optimization methods
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

  async optimizeQueries(startDate, endDate) {
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
}
```

### Frontend Dashboard Components

```typescript
// frontend/src/components/dashboard/AnalyticsDashboard.tsx
import React, { useState, useEffect } from 'react';
import { useAnalytics } from '../../hooks/useAnalytics';
import {
  LineChart,
  BarChart,
  PieChart,
  HeatMap,
  MetricCard,
  DateRangePicker
} from '../charts';

export const AnalyticsDashboard: React.FC = () => {
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    end: new Date()
  });
  
  const [view, setView] = useState<'overview' | 'users' | 'engagement' | 'performance'>('overview');
  const [realtime, setRealtime] = useState(false);
  
  const {
    overview,
    realtimeMetrics,
    loading,
    error,
    refreshData
  } = useAnalytics(dateRange, realtime);

  useEffect(() => {
    if (realtime) {
      const interval = setInterval(refreshData, 5000);
      return () => clearInterval(interval);
    }
  }, [realtime]);

  const renderOverview = () => (
    <div className="dashboard-overview">
      <div className="metrics-grid">
        <MetricCard
          title="Active Users"
          value={overview?.userMetrics.activeUsers.daily}
          change={overview?.userMetrics.growth.rate}
          trend={overview?.userMetrics.growth.trend}
          icon="users"
        />
        <MetricCard
          title="Sessions"
          value={overview?.engagementMetrics.sessions.total}
          subtitle={`Avg: ${overview?.engagementMetrics.sessions.average}`}
          icon="activity"
        />
        <MetricCard
          title="Page Load Time"
          value={`${overview?.performanceMetrics.pageLoad.median}ms`}
          subtitle={`P95: ${overview?.performanceMetrics.pageLoad.p95}ms`}
          icon="performance"
          status={overview?.performanceMetrics.pageLoad.median < 1000 ? 'good' : 'warning'}
        />
        <MetricCard
          title="Error Rate"
          value={`${overview?.performanceMetrics.errors.rate}%`}
          subtitle={`${overview?.performanceMetrics.errors.total} errors`}
          icon="error"
          status={overview?.performanceMetrics.errors.rate < 1 ? 'good' : 'bad'}
        />
      </div>

      <div className="charts-grid">
        <div className="chart-container">
          <h3>User Activity Trend</h3>
          <LineChart
            data={overview?.userMetrics.activityTrend}
            xKey="date"
            yKeys={['dau', 'wau', 'mau']}
            labels={['Daily', 'Weekly', 'Monthly']}
          />
        </div>

        <div className="chart-container">
          <h3>Top Features</h3>
          <BarChart
            data={overview?.topFeatures}
            xKey="feature"
            yKey="usage"
            horizontal
          />
        </div>

        <div className="chart-container">
          <h3>Session Duration Distribution</h3>
          <PieChart
            data={overview?.engagementMetrics.sessions.duration.distribution}
            labelKey="range"
            valueKey="count"
          />
        </div>

        <div className="chart-container">
          <h3>Geographic Distribution</h3>
          <WorldMap
            data={overview?.userMetrics.geographic}
            valueKey="users"
          />
        </div>
      </div>
    </div>
  );

  const renderRealtimeMetrics = () => (
    <div className="realtime-metrics">
      <div className="realtime-header">
        <h3>Real-time Metrics</h3>
        <span className="live-indicator">
          <span className="pulse"></span> Live
        </span>
      </div>

      <div className="realtime-grid">
        <div className="metric-live">
          <span className="value">{realtimeMetrics?.activeUsers}</span>
          <span className="label">Active Users</span>
        </div>
        <div className="metric-live">
          <span className="value">{realtimeMetrics?.activeSessions}</span>
          <span className="label">Active Sessions</span>
        </div>
        <div className="metric-live">
          <span className="value">{realtimeMetrics?.eventsPerSecond.toFixed(1)}</span>
          <span className="label">Events/sec</span>
        </div>
        <div className="metric-live">
          <span className="value">{realtimeMetrics?.errorRate.toFixed(2)}%</span>
          <span className="label">Error Rate</span>
        </div>
      </div>

      <div className="realtime-activity">
        <h4>Top Pages (Last 5 min)</h4>
        <div className="activity-list">
          {realtimeMetrics?.topPages.map((page, i) => (
            <div key={i} className="activity-item">
              <span className="page-url">{page.url}</span>
              <span className="page-views">{page.views} views</span>
            </div>
          ))}
        </div>
      </div>

      {realtimeMetrics?.recentErrors.length > 0 && (
        <div className="realtime-errors">
          <h4>Recent Errors</h4>
          <div className="error-list">
            {realtimeMetrics.recentErrors.map((error, i) => (
              <div key={i} className="error-item">
                <span className="error-message">{error.message}</span>
                <span className="error-time">{formatTime(error.timestamp)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="analytics-dashboard">
      <div className="dashboard-header">
        <h1>Analytics Dashboard</h1>
        
        <div className="dashboard-controls">
          <DateRangePicker
            startDate={dateRange.start}
            endDate={dateRange.end}
            onChange={setDateRange}
          />
          
          <div className="view-selector">
            <button
              className={view === 'overview' ? 'active' : ''}
              onClick={() => setView('overview')}
            >
              Overview
            </button>
            <button
              className={view === 'users' ? 'active' : ''}
              onClick={() => setView('users')}
            >
              Users
            </button>
            <button
              className={view === 'engagement' ? 'active' : ''}
              onClick={() => setView('engagement')}
            >
              Engagement
            </button>
            <button
              className={view === 'performance' ? 'active' : ''}
              onClick={() => setView('performance')}
            >
              Performance
            </button>
          </div>

          <div className="toggle-realtime">
            <label>
              <input
                type="checkbox"
                checked={realtime}
                onChange={(e) => setRealtime(e.target.checked)}
              />
              Real-time
            </label>
          </div>

          <button onClick={refreshData} className="btn-refresh">
            🔄 Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-error">
          Failed to load analytics: {error.message}
        </div>
      )}

      {loading ? (
        <div className="loading-spinner">Loading analytics...</div>
      ) : (
        <>
          {realtime && renderRealtimeMetrics()}
          {view === 'overview' && renderOverview()}
          {view === 'users' && <UserAnalytics dateRange={dateRange} />}
          {view === 'engagement' && <EngagementAnalytics dateRange={dateRange} />}
          {view === 'performance' && <PerformanceAnalytics dateRange={dateRange} />}
        </>
      )}
    </div>
  );
};

// Retention Cohort Visualization
export const RetentionCohortChart: React.FC<{
  data: RetentionData;
}> = ({ data }) => {
  const getCellColor = (percentage: number) => {
    if (percentage >= 80) return '#22c55e';
    if (percentage >= 60) return '#84cc16';
    if (percentage >= 40) return '#eab308';
    if (percentage >= 20) return '#f97316';
    return '#ef4444';
  };

  return (
    <div className="retention-cohort-chart">
      <table className="cohort-table">
        <thead>
          <tr>
            <th>Cohort</th>
            <th>Users</th>
            {Array.from({ length: 31 }, (_, i) => (
              <th key={i}>Day {i}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.cohorts.map((cohort, i) => (
            <tr key={i}>
              <td>{formatDate(cohort.cohortDate)}</td>
              <td>{cohort.cohortSize}</td>
              {cohort.retention.map((ret, j) => (
                <td
                  key={j}
                  className="retention-cell"
                  style={{
                    backgroundColor: getCellColor(ret.percentage),
                    opacity: ret.percentage / 100
                  }}
                  title={`${ret.retained} users (${ret.percentage.toFixed(1)}%)`}
                >
                  {ret.percentage.toFixed(0)}%
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// Funnel Visualization
export const FunnelChart: React.FC<{
  data: FunnelData;
}> = ({ data }) => {
  const maxUsers = data.steps[0]?.users || 1;

  return (
    <div className="funnel-chart">
      <h3>{data.name}</h3>
      <div className="funnel-container">
        {data.steps.map((step, i) => (
          <div key={i} className="funnel-step">
            <div
              className="funnel-bar"
              style={{
                width: `${(step.users / maxUsers) * 100}%`
              }}
            >
              <span className="step-name">{step.name}</span>
              <span className="step-users">{step.users.toLocaleString()} users</span>
              <span className="step-conversion">{step.conversionRate.toFixed(1)}%</span>
            </div>
            {i < data.steps.length - 1 && (
              <div className="dropoff">
                ↓ {step.dropoff.toLocaleString()} ({step.dropoffRate.toFixed(1)}%)
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="funnel-summary">
        Overall Conversion: {data.overallConversion.toFixed(1)}%
      </div>
    </div>
  );
};
```

## Security Considerations

1. **Access Control**
   - Admin-only access to dashboard
   - Role-based metric visibility
   - Audit logging of dashboard access
   - Data export permissions

2. **Data Privacy**
   - PII masking in analytics
   - Aggregated data only (no individual user data)
   - Compliance with privacy regulations
   - Secure data transmission

3. **Performance Security**
   - Query timeout limits
   - Resource consumption monitoring
   - Rate limiting on API endpoints
   - Caching security

## Testing Requirements

1. **Unit Tests**
   - Metric calculation accuracy
   - Data aggregation logic
   - Cache operations
   - Query optimization

2. **Integration Tests**
   - Dashboard data flow
   - Real-time updates
   - Report generation
   - Export functionality

3. **Performance Tests**
   - Dashboard load time
   - Query performance
   - Concurrent user access
   - Large dataset handling

## Documentation Updates

- Dashboard user guide
- Metric definitions
- Custom report creation
- API documentation for analytics endpoints

## Dependencies

- Issue #27: User Analytics System
- Chart visualization library (Chart.js/D3.js)
- WebSocket support for real-time
- PDF/Excel generation libraries

## Estimated Effort

**Large (L)** - 7-8 days

### Justification:
- Multiple visualization components
- Real-time data integration
- Performance optimization
- Report generation features
- Extensive UI development

## Priority

**Medium** - Important for platform monitoring but follows analytics implementation

## Labels

- `feature`
- `analytics`
- `dashboard`
- `visualization`
- `admin`