import { api } from './api';

class AnalyticsDashboardService {
  private baseUrl = '/api/analytics/dashboard';

  /**
   * Get dashboard overview
   */
  async getDashboardOverview(startDate: Date, endDate: Date) {
    const response = await api.get(`${this.baseUrl}/overview`, {
      params: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      }
    });
    return response.data.data;
  }

  /**
   * Get real-time metrics
   */
  async getRealtimeMetrics() {
    const response = await api.get(`${this.baseUrl}/realtime`);
    return response.data.data;
  }

  /**
   * Get user metrics
   */
  async getUserMetrics(startDate: Date, endDate: Date) {
    const response = await api.get(`${this.baseUrl}/metrics/users`, {
      params: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      }
    });
    return response.data.data;
  }

  /**
   * Get engagement metrics
   */
  async getEngagementMetrics(startDate: Date, endDate: Date) {
    const response = await api.get(`${this.baseUrl}/metrics/engagement`, {
      params: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      }
    });
    return response.data.data;
  }

  /**
   * Get performance metrics
   */
  async getPerformanceMetrics(startDate: Date, endDate: Date) {
    const response = await api.get(`${this.baseUrl}/metrics/performance`, {
      params: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      }
    });
    return response.data.data;
  }

  /**
   * Get retention cohorts
   */
  async getRetentionCohorts(
    cohortType: 'daily' | 'weekly' | 'monthly',
    startDate: Date,
    endDate: Date
  ) {
    const response = await api.get(`${this.baseUrl}/cohorts/retention`, {
      params: {
        cohortType,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      }
    });
    return response.data.data;
  }

  /**
   * Get funnel analysis
   */
  async getFunnelAnalysis(
    funnelId: string,
    startDate: Date,
    endDate: Date,
    segment?: string
  ) {
    const response = await api.get(`${this.baseUrl}/funnels/${funnelId}`, {
      params: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        segment
      }
    });
    return response.data.data;
  }

  /**
   * Get feature adoption metrics
   */
  async getFeatureAdoption(startDate: Date, endDate: Date) {
    const response = await api.get(`${this.baseUrl}/features/adoption`, {
      params: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      }
    });
    return response.data.data;
  }

  /**
   * Get user lifecycle stages
   */
  async getUserLifecycleStages(startDate: Date, endDate: Date) {
    const response = await api.get(`${this.baseUrl}/lifecycle/stages`, {
      params: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      }
    });
    return response.data.data;
  }

  /**
   * Generate analytics report
   */
  async generateReport(config: {
    type: string;
    startDate: Date;
    endDate: Date;
    metrics: string[];
    format: 'json' | 'csv' | 'pdf' | 'excel';
  }) {
    const response = await api.post(`${this.baseUrl}/reports/generate`, {
      ...config,
      startDate: config.startDate.toISOString(),
      endDate: config.endDate.toISOString()
    });

    // Handle different response types based on format
    if (config.format === 'json') {
      return response.data.data;
    } else {
      // For file formats, return the blob
      return response.data;
    }
  }

  /**
   * Export dashboard data
   */
  async exportDashboard(
    format: 'json' | 'csv' | 'pdf',
    startDate: Date,
    endDate: Date
  ) {
    const response = await api.get(`${this.baseUrl}/export`, {
      params: {
        format,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      },
      responseType: format === 'json' ? 'json' : 'blob'
    });

    if (format === 'json') {
      return response.data.data;
    } else {
      // For CSV/PDF, create download link
      const blob = new Blob([response.data], {
        type: format === 'csv' ? 'text/csv' : 'application/pdf'
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dashboard-export-${Date.now()}.${format}`;
      a.click();
      window.URL.revokeObjectURL(url);
      return true;
    }
  }

  /**
   * Get dashboard configuration
   */
  async getDashboardConfig() {
    const response = await api.get(`${this.baseUrl}/config`);
    return response.data.data;
  }

  /**
   * Save dashboard configuration
   */
  async saveDashboardConfig(config: any) {
    const response = await api.post(`${this.baseUrl}/config`, config);
    return response.data.data;
  }

  /**
   * Get saved dashboard views
   */
  async getSavedViews() {
    const response = await api.get(`${this.baseUrl}/views`);
    return response.data.data;
  }

  /**
   * Save dashboard view
   */
  async saveView(name: string, config: any) {
    const response = await api.post(`${this.baseUrl}/views`, {
      name,
      config
    });
    return response.data.data;
  }

  /**
   * Delete saved view
   */
  async deleteView(viewId: string) {
    const response = await api.delete(`${this.baseUrl}/views/${viewId}`);
    return response.data.data;
  }

  /**
   * Get metric history for trend analysis
   */
  async getMetricHistory(
    metric: string,
    startDate: Date,
    endDate: Date,
    granularity: 'hour' | 'day' | 'week' | 'month' = 'day'
  ) {
    const response = await api.get(`${this.baseUrl}/metrics/${metric}/history`, {
      params: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        granularity
      }
    });
    return response.data.data;
  }

  /**
   * Get comparison data between periods
   */
  async getComparison(
    metrics: string[],
    period1Start: Date,
    period1End: Date,
    period2Start: Date,
    period2End: Date
  ) {
    const response = await api.post(`${this.baseUrl}/compare`, {
      metrics,
      period1: {
        start: period1Start.toISOString(),
        end: period1End.toISOString()
      },
      period2: {
        start: period2Start.toISOString(),
        end: period2End.toISOString()
      }
    });
    return response.data.data;
  }

  /**
   * Get predictive analytics
   */
  async getPredictiveAnalytics(metric: string, daysAhead: number = 30) {
    const response = await api.get(`${this.baseUrl}/predictive/${metric}`, {
      params: {
        daysAhead
      }
    });
    return response.data.data;
  }

  /**
   * Get anomaly detection results
   */
  async getAnomalies(startDate: Date, endDate: Date) {
    const response = await api.get(`${this.baseUrl}/anomalies`, {
      params: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      }
    });
    return response.data.data;
  }

  /**
   * Subscribe to real-time metric updates via WebSocket
   */
  subscribeToRealtimeUpdates(onUpdate: (data: any) => void): () => void {
    // This would typically connect to a WebSocket endpoint
    // For now, we'll use polling as a fallback
    const interval = setInterval(async () => {
      try {
        const data = await this.getRealtimeMetrics();
        onUpdate(data);
      } catch (error) {
        console.error('Failed to fetch real-time updates:', error);
      }
    }, 5000);

    // Return cleanup function
    return () => clearInterval(interval);
  }
}

export const analyticsDashboardService = new AnalyticsDashboardService();