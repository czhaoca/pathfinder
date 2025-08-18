import React, { useState, useEffect } from 'react';
import { useAnalyticsDashboard } from '../../hooks/useAnalyticsDashboard';
import { DateRangePicker } from '../common/DateRangePicker';
import { MetricsOverview } from './MetricsOverview';
import { UserTrendsChart } from './UserTrendsChart';
import { RetentionCohortTable } from './RetentionCohortTable';
import { EngagementHeatmap } from './EngagementHeatmap';
import { FeatureAdoptionFunnel } from './FeatureAdoptionFunnel';
import { GeographicDistributionMap } from './GeographicDistributionMap';
import { UserGrowthTimeline } from './UserGrowthTimeline';
import { TopFeaturesChart } from './TopFeaturesChart';
import { RealtimeMetrics } from './RealtimeMetrics';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { ErrorMessage } from '../common/ErrorMessage';
import { Button } from '../ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Switch } from '../ui/switch';
import { Card } from '../ui/card';
import './AnalyticsDashboard.css';

export const AnalyticsDashboard: React.FC = () => {
  const [view, setView] = useState<'overview' | 'users' | 'engagement' | 'performance'>('overview');
  const [realtime, setRealtime] = useState(false);
  const [exportFormat, setExportFormat] = useState<'json' | 'csv' | 'pdf'>('json');
  const [isExporting, setIsExporting] = useState(false);

  const {
    overview,
    realtimeMetrics,
    retentionCohorts,
    funnelAnalysis,
    featureAdoption,
    userLifecycle,
    loading,
    error,
    refreshData,
    setDateRange,
    dateRange,
    exportDashboard
  } = useAnalyticsDashboard();

  // Auto-refresh for real-time metrics
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (realtime) {
      interval = setInterval(() => {
        refreshData();
      }, 5000); // Refresh every 5 seconds
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [realtime, refreshData]);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      await exportDashboard(exportFormat);
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

  if (loading && !overview) {
    return (
      <div className="analytics-dashboard-loading">
        <LoadingSpinner />
        <p>Loading analytics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="analytics-dashboard-error">
        <ErrorMessage message={error.message} />
      </div>
    );
  }

  if (!overview) {
    return (
      <div className="analytics-dashboard-empty">
        <p>No data available</p>
      </div>
    );
  }

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
          
          <div className="view-controls">
            <Tabs value={view} onValueChange={(v) => setView(v as typeof view)}>
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="users">Users</TabsTrigger>
                <TabsTrigger value="engagement">Engagement</TabsTrigger>
                <TabsTrigger value="performance">Performance</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="realtime-toggle">
            <label htmlFor="realtime-switch">Real-time</label>
            <Switch
              id="realtime-switch"
              checked={realtime}
              onCheckedChange={setRealtime}
            />
          </div>

          <div className="action-buttons">
            <Button onClick={refreshData} variant="outline">
              Refresh
            </Button>
            
            <div className="export-controls">
              <select
                value={exportFormat}
                onChange={(e) => setExportFormat(e.target.value as typeof exportFormat)}
                className="export-format-select"
              >
                <option value="json">JSON</option>
                <option value="csv">CSV</option>
                <option value="pdf">PDF</option>
              </select>
              <Button
                onClick={handleExport}
                disabled={isExporting}
                variant="default"
              >
                {isExporting ? 'Exporting...' : 'Export'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {realtime && realtimeMetrics && (
        <RealtimeMetrics metrics={realtimeMetrics} />
      )}

      <div className="dashboard-content">
        <Tabs value={view}>
          <TabsContent value="overview">
            <div className="overview-grid">
              <MetricsOverview metrics={overview} />
              
              <div className="charts-row">
                <Card className="chart-card">
                  <UserTrendsChart data={overview.userMetrics} />
                </Card>
                <Card className="chart-card">
                  <TopFeaturesChart features={overview.topFeatures} />
                </Card>
              </div>
              
              <div className="charts-row">
                <Card className="chart-card">
                  <EngagementHeatmap data={overview.engagementMetrics?.engagementHeatmap} />
                </Card>
                <Card className="chart-card">
                  <GeographicDistributionMap data={overview.userMetrics?.geographicDistribution} />
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="users">
            <div className="users-view">
              <div className="metrics-cards">
                <MetricsOverview 
                  metrics={{
                    userMetrics: overview.userMetrics,
                    performanceMetrics: null,
                    engagementMetrics: null
                  }}
                />
              </div>
              
              <div className="charts-grid">
                <Card className="chart-card full-width">
                  <UserGrowthTimeline data={overview.userMetrics} />
                </Card>
                
                <Card className="chart-card full-width">
                  <RetentionCohortTable cohorts={retentionCohorts} />
                </Card>
                
                <Card className="chart-card">
                  <UserTrendsChart data={overview.userMetrics} detailed={true} />
                </Card>
                
                <Card className="chart-card">
                  <GeographicDistributionMap data={overview.userMetrics?.geographicDistribution} />
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="engagement">
            <div className="engagement-view">
              <div className="metrics-cards">
                <MetricsOverview 
                  metrics={{
                    userMetrics: null,
                    performanceMetrics: null,
                    engagementMetrics: overview.engagementMetrics
                  }}
                />
              </div>
              
              <div className="charts-grid">
                <Card className="chart-card full-width">
                  <EngagementHeatmap data={overview.engagementMetrics?.engagementHeatmap} detailed={true} />
                </Card>
                
                <Card className="chart-card">
                  <FeatureAdoptionFunnel data={featureAdoption} />
                </Card>
                
                <Card className="chart-card">
                  <TopFeaturesChart features={overview.topFeatures} detailed={true} />
                </Card>
                
                {funnelAnalysis && (
                  <Card className="chart-card full-width">
                    <div className="funnel-analysis">
                      <h3>Conversion Funnels</h3>
                      {/* Render funnel analysis charts */}
                    </div>
                  </Card>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="performance">
            <div className="performance-view">
              <div className="metrics-cards">
                <MetricsOverview 
                  metrics={{
                    userMetrics: null,
                    performanceMetrics: overview.performanceMetrics,
                    engagementMetrics: null
                  }}
                />
              </div>
              
              <div className="charts-grid">
                <Card className="chart-card">
                  <div className="performance-chart">
                    <h3>Page Load Times</h3>
                    <div className="metric-values">
                      <div className="metric">
                        <span className="label">Average:</span>
                        <span className="value">{overview.performanceMetrics?.pageLoad?.average}ms</span>
                      </div>
                      <div className="metric">
                        <span className="label">P95:</span>
                        <span className="value">{overview.performanceMetrics?.pageLoad?.p95}ms</span>
                      </div>
                      <div className="metric">
                        <span className="label">P99:</span>
                        <span className="value">{overview.performanceMetrics?.pageLoad?.p99}ms</span>
                      </div>
                    </div>
                  </div>
                </Card>
                
                <Card className="chart-card">
                  <div className="performance-chart">
                    <h3>API Latency</h3>
                    <div className="metric-values">
                      <div className="metric">
                        <span className="label">Average:</span>
                        <span className="value">{overview.performanceMetrics?.apiLatency?.average}ms</span>
                      </div>
                      <div className="metric">
                        <span className="label">P95:</span>
                        <span className="value">{overview.performanceMetrics?.apiLatency?.p95}ms</span>
                      </div>
                      <div className="metric">
                        <span className="label">P99:</span>
                        <span className="value">{overview.performanceMetrics?.apiLatency?.p99}ms</span>
                      </div>
                    </div>
                  </div>
                </Card>
                
                <Card className="chart-card">
                  <div className="error-metrics">
                    <h3>Error Metrics</h3>
                    <div className="metric-values">
                      <div className="metric">
                        <span className="label">Total Errors:</span>
                        <span className="value">{overview.performanceMetrics?.errors?.total}</span>
                      </div>
                      <div className="metric">
                        <span className="label">Error Rate:</span>
                        <span className="value">{overview.performanceMetrics?.errors?.rate}%</span>
                      </div>
                    </div>
                  </div>
                </Card>
                
                <Card className="chart-card">
                  <div className="availability-metrics">
                    <h3>Availability</h3>
                    <div className="metric-values">
                      <div className="metric">
                        <span className="label">Uptime:</span>
                        <span className="value">{overview.performanceMetrics?.availability?.uptime}%</span>
                      </div>
                      <div className="metric">
                        <span className="label">Incidents:</span>
                        <span className="value">{overview.performanceMetrics?.availability?.incidents}</span>
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {isExporting && (
        <div className="export-overlay">
          <div className="export-message">
            <LoadingSpinner />
            <p>Generating {exportFormat.toUpperCase()} report...</p>
          </div>
        </div>
      )}
    </div>
  );
};