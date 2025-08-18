import React from 'react';
import { Card } from '../ui/card';
import { TrendingUp, TrendingDown, Users, Activity, Zap, AlertCircle } from 'lucide-react';
import './MetricsOverview.css';

interface MetricsOverviewProps {
  metrics: {
    userMetrics?: any;
    engagementMetrics?: any;
    performanceMetrics?: any;
  };
}

export const MetricsOverview: React.FC<MetricsOverviewProps> = ({ metrics }) => {
  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  };

  const formatPercentage = (num: number): string => {
    return num.toFixed(1) + '%';
  };

  const getTrendIcon = (trend: string) => {
    if (trend === 'growing') {
      return <TrendingUp className="trend-icon growing" />;
    } else if (trend === 'declining') {
      return <TrendingDown className="trend-icon declining" />;
    }
    return null;
  };

  const getStatusColor = (metric: string, value: number): string => {
    switch (metric) {
      case 'errorRate':
        return value < 1 ? 'good' : value < 5 ? 'warning' : 'bad';
      case 'uptime':
        return value >= 99.9 ? 'good' : value >= 99 ? 'warning' : 'bad';
      case 'pageLoad':
        return value < 1000 ? 'good' : value < 3000 ? 'warning' : 'bad';
      case 'churnRate':
        return value < 2 ? 'good' : value < 5 ? 'warning' : 'bad';
      default:
        return 'neutral';
    }
  };

  return (
    <div className="metrics-overview">
      <div className="metrics-grid">
        {metrics.userMetrics && (
          <>
            <Card className="metric-card">
              <div className="metric-header">
                <Users className="metric-icon" />
                <span className="metric-label">Total Users</span>
              </div>
              <div className="metric-value">
                {formatNumber(metrics.userMetrics.totalUsers)}
              </div>
              <div className="metric-footer">
                <span className="metric-change positive">
                  +{formatNumber(metrics.userMetrics.newUsers)} new
                </span>
              </div>
            </Card>

            <Card className="metric-card">
              <div className="metric-header">
                <Activity className="metric-icon" />
                <span className="metric-label">Daily Active Users</span>
              </div>
              <div className="metric-value">
                {formatNumber(metrics.userMetrics.activeUsers?.daily || 0)}
              </div>
              <div className="metric-footer">
                <span className="metric-sublabel">
                  WAU: {formatNumber(metrics.userMetrics.activeUsers?.weekly || 0)} | 
                  MAU: {formatNumber(metrics.userMetrics.activeUsers?.monthly || 0)}
                </span>
              </div>
            </Card>

            <Card className="metric-card">
              <div className="metric-header">
                <div className="metric-icon-wrapper">
                  {getTrendIcon(metrics.userMetrics.growth?.trend)}
                </div>
                <span className="metric-label">Growth Rate</span>
              </div>
              <div className={`metric-value ${metrics.userMetrics.growth?.rate > 0 ? 'positive' : 'negative'}`}>
                {metrics.userMetrics.growth?.rate > 0 ? '+' : ''}{formatPercentage(metrics.userMetrics.growth?.rate || 0)}
              </div>
              <div className="metric-footer">
                <span className="metric-trend">{metrics.userMetrics.growth?.trend}</span>
              </div>
            </Card>

            <Card className="metric-card">
              <div className="metric-header">
                <AlertCircle className="metric-icon" />
                <span className="metric-label">Churn Rate</span>
              </div>
              <div className={`metric-value status-${getStatusColor('churnRate', metrics.userMetrics.churn?.rate || 0)}`}>
                {formatPercentage(metrics.userMetrics.churn?.rate || 0)}
              </div>
              <div className="metric-footer">
                <span className="metric-sublabel">
                  {formatNumber(metrics.userMetrics.churn?.count || 0)} users
                </span>
              </div>
            </Card>
          </>
        )}

        {metrics.engagementMetrics && (
          <>
            <Card className="metric-card">
              <div className="metric-header">
                <Activity className="metric-icon" />
                <span className="metric-label">Total Sessions</span>
              </div>
              <div className="metric-value">
                {formatNumber(metrics.engagementMetrics.sessions?.total || 0)}
              </div>
              <div className="metric-footer">
                <span className="metric-sublabel">
                  Avg: {metrics.engagementMetrics.sessions?.average?.toFixed(1) || 0} per user
                </span>
              </div>
            </Card>

            <Card className="metric-card">
              <div className="metric-header">
                <Zap className="metric-icon" />
                <span className="metric-label">Avg Session Duration</span>
              </div>
              <div className="metric-value">
                {Math.floor((metrics.engagementMetrics.sessions?.duration?.average || 0) / 60)}m
              </div>
              <div className="metric-footer">
                <span className="metric-sublabel">
                  Median: {Math.floor((metrics.engagementMetrics.sessions?.duration?.median || 0) / 60)}m
                </span>
              </div>
            </Card>

            <Card className="metric-card">
              <div className="metric-header">
                <Activity className="metric-icon" />
                <span className="metric-label">Page Views</span>
              </div>
              <div className="metric-value">
                {formatNumber(metrics.engagementMetrics.pageViews?.total || 0)}
              </div>
              <div className="metric-footer">
                <span className="metric-sublabel">
                  {metrics.engagementMetrics.pageViews?.perSession?.toFixed(1) || 0} per session
                </span>
              </div>
            </Card>

            <Card className="metric-card">
              <div className="metric-header">
                <AlertCircle className="metric-icon" />
                <span className="metric-label">Bounce Rate</span>
              </div>
              <div className={`metric-value status-${metrics.engagementMetrics.bounce?.rate < 30 ? 'good' : 'warning'}`}>
                {formatPercentage(metrics.engagementMetrics.bounce?.rate || 0)}
              </div>
              <div className="metric-footer">
                <span className="metric-sublabel">
                  {formatNumber(metrics.engagementMetrics.bounce?.count || 0)} sessions
                </span>
              </div>
            </Card>
          </>
        )}

        {metrics.performanceMetrics && (
          <>
            <Card className="metric-card">
              <div className="metric-header">
                <Zap className="metric-icon" />
                <span className="metric-label">Page Load Time</span>
              </div>
              <div className={`metric-value status-${getStatusColor('pageLoad', metrics.performanceMetrics.pageLoad?.average || 0)}`}>
                {metrics.performanceMetrics.pageLoad?.average || 0}ms
              </div>
              <div className="metric-footer">
                <span className="metric-sublabel">
                  P95: {metrics.performanceMetrics.pageLoad?.p95 || 0}ms
                </span>
              </div>
            </Card>

            <Card className="metric-card">
              <div className="metric-header">
                <Activity className="metric-icon" />
                <span className="metric-label">API Latency</span>
              </div>
              <div className="metric-value">
                {metrics.performanceMetrics.apiLatency?.average || 0}ms
              </div>
              <div className="metric-footer">
                <span className="metric-sublabel">
                  P95: {metrics.performanceMetrics.apiLatency?.p95 || 0}ms
                </span>
              </div>
            </Card>

            <Card className="metric-card">
              <div className="metric-header">
                <AlertCircle className="metric-icon" />
                <span className="metric-label">Error Rate</span>
              </div>
              <div className={`metric-value status-${getStatusColor('errorRate', metrics.performanceMetrics.errors?.rate || 0)}`}>
                {formatPercentage(metrics.performanceMetrics.errors?.rate || 0)}
              </div>
              <div className="metric-footer">
                <span className="metric-sublabel">
                  {formatNumber(metrics.performanceMetrics.errors?.total || 0)} errors
                </span>
              </div>
            </Card>

            <Card className="metric-card">
              <div className="metric-header">
                <Zap className="metric-icon" />
                <span className="metric-label">Uptime</span>
              </div>
              <div className={`metric-value status-${getStatusColor('uptime', metrics.performanceMetrics.availability?.uptime || 0)}`}>
                {formatPercentage(metrics.performanceMetrics.availability?.uptime || 0)}
              </div>
              <div className="metric-footer">
                <span className="metric-sublabel">
                  {metrics.performanceMetrics.availability?.incidents || 0} incidents
                </span>
              </div>
            </Card>
          </>
        )}
      </div>
    </div>
  );
};