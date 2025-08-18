import { useState, useEffect, useCallback } from 'react';
import { analyticsDashboardService } from '../services/analyticsDashboardService';

interface DateRange {
  start: Date;
  end: Date;
}

interface DashboardData {
  userMetrics?: any;
  engagementMetrics?: any;
  performanceMetrics?: any;
  topFeatures?: any[];
  recentErrors?: any[];
  generatedAt?: Date;
}

interface RealtimeMetrics {
  timestamp: Date;
  activeUsers: number;
  activeSessions: number;
  eventsPerSecond: number;
  errorRate: number;
  topPages: any[];
  recentErrors: any[];
}

interface RetentionCohort {
  cohortDate: string;
  cohortSize: number;
  retention: Array<{
    day: number;
    retained: number;
    percentage: number;
  }>;
}

export function useAnalyticsDashboard() {
  const [overview, setOverview] = useState<DashboardData | null>(null);
  const [realtimeMetrics, setRealtimeMetrics] = useState<RealtimeMetrics | null>(null);
  const [retentionCohorts, setRetentionCohorts] = useState<RetentionCohort[] | null>(null);
  const [funnelAnalysis, setFunnelAnalysis] = useState<any>(null);
  const [featureAdoption, setFeatureAdoption] = useState<any>(null);
  const [userLifecycle, setUserLifecycle] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
    end: new Date()
  });

  // Fetch dashboard overview
  const fetchDashboardOverview = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const data = await analyticsDashboardService.getDashboardOverview(
        dateRange.start,
        dateRange.end
      );
      
      setOverview(data);
    } catch (err) {
      setError(err as Error);
      console.error('Failed to fetch dashboard overview:', err);
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  // Fetch real-time metrics
  const fetchRealtimeMetrics = useCallback(async () => {
    try {
      const data = await analyticsDashboardService.getRealtimeMetrics();
      setRealtimeMetrics(data);
    } catch (err) {
      console.error('Failed to fetch real-time metrics:', err);
    }
  }, []);

  // Fetch retention cohorts
  const fetchRetentionCohorts = useCallback(async (cohortType: 'daily' | 'weekly' | 'monthly' = 'weekly') => {
    try {
      const data = await analyticsDashboardService.getRetentionCohorts(
        cohortType,
        dateRange.start,
        dateRange.end
      );
      setRetentionCohorts(data.cohorts);
    } catch (err) {
      console.error('Failed to fetch retention cohorts:', err);
    }
  }, [dateRange]);

  // Fetch funnel analysis
  const fetchFunnelAnalysis = useCallback(async (funnelId: string) => {
    try {
      const data = await analyticsDashboardService.getFunnelAnalysis(
        funnelId,
        dateRange.start,
        dateRange.end
      );
      setFunnelAnalysis(data);
    } catch (err) {
      console.error('Failed to fetch funnel analysis:', err);
    }
  }, [dateRange]);

  // Fetch feature adoption
  const fetchFeatureAdoption = useCallback(async () => {
    try {
      const data = await analyticsDashboardService.getFeatureAdoption(
        dateRange.start,
        dateRange.end
      );
      setFeatureAdoption(data);
    } catch (err) {
      console.error('Failed to fetch feature adoption:', err);
    }
  }, [dateRange]);

  // Fetch user lifecycle stages
  const fetchUserLifecycle = useCallback(async () => {
    try {
      const data = await analyticsDashboardService.getUserLifecycleStages(
        dateRange.start,
        dateRange.end
      );
      setUserLifecycle(data);
    } catch (err) {
      console.error('Failed to fetch user lifecycle stages:', err);
    }
  }, [dateRange]);

  // Export dashboard data
  const exportDashboard = useCallback(async (format: 'json' | 'csv' | 'pdf' = 'json') => {
    try {
      const data = await analyticsDashboardService.exportDashboard(
        format,
        dateRange.start,
        dateRange.end
      );
      
      // Handle download based on format
      if (format === 'json') {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `dashboard-${Date.now()}.json`;
        a.click();
        window.URL.revokeObjectURL(url);
      } else if (format === 'csv' || format === 'pdf') {
        // The service should return a downloadable file
        // Implementation depends on backend response
      }
      
      return data;
    } catch (err) {
      console.error('Failed to export dashboard:', err);
      throw err;
    }
  }, [dateRange]);

  // Generate report
  const generateReport = useCallback(async (
    metrics: string[],
    format: 'json' | 'csv' | 'pdf' | 'excel' = 'json'
  ) => {
    try {
      const report = await analyticsDashboardService.generateReport({
        type: 'comprehensive',
        startDate: dateRange.start,
        endDate: dateRange.end,
        metrics,
        format
      });
      
      return report;
    } catch (err) {
      console.error('Failed to generate report:', err);
      throw err;
    }
  }, [dateRange]);

  // Refresh all data
  const refreshData = useCallback(async () => {
    await Promise.all([
      fetchDashboardOverview(),
      fetchRealtimeMetrics(),
      fetchRetentionCohorts(),
      fetchFeatureAdoption(),
      fetchUserLifecycle(),
      fetchFunnelAnalysis('onboarding')
    ]);
  }, [
    fetchDashboardOverview,
    fetchRealtimeMetrics,
    fetchRetentionCohorts,
    fetchFeatureAdoption,
    fetchUserLifecycle,
    fetchFunnelAnalysis
  ]);

  // Update date range
  const updateDateRange = useCallback((newRange: DateRange) => {
    setDateRange(newRange);
  }, []);

  // Initial data fetch
  useEffect(() => {
    fetchDashboardOverview();
  }, [fetchDashboardOverview]);

  // Fetch additional data when overview is loaded
  useEffect(() => {
    if (overview && !loading) {
      Promise.all([
        fetchRetentionCohorts(),
        fetchFeatureAdoption(),
        fetchUserLifecycle(),
        fetchFunnelAnalysis('onboarding')
      ]);
    }
  }, [overview, loading]);

  return {
    // Data
    overview,
    realtimeMetrics,
    retentionCohorts,
    funnelAnalysis,
    featureAdoption,
    userLifecycle,
    
    // State
    loading,
    error,
    dateRange,
    
    // Actions
    refreshData,
    setDateRange: updateDateRange,
    exportDashboard,
    generateReport,
    fetchRealtimeMetrics,
    fetchRetentionCohorts,
    fetchFunnelAnalysis,
    fetchFeatureAdoption,
    fetchUserLifecycle
  };
}