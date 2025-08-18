import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AnalyticsDashboard } from '../AnalyticsDashboard';
import { useAnalyticsDashboard } from '../../../hooks/useAnalyticsDashboard';

// Mock the hook
jest.mock('../../../hooks/useAnalyticsDashboard');

// Mock child components
jest.mock('../MetricsOverview', () => ({
  MetricsOverview: () => <div data-testid="metrics-overview">Metrics Overview</div>
}));

jest.mock('../UserTrendsChart', () => ({
  UserTrendsChart: () => <div data-testid="user-trends">User Trends</div>
}));

jest.mock('../RetentionCohortTable', () => ({
  RetentionCohortTable: () => <div data-testid="retention-cohort">Retention Cohort</div>
}));

jest.mock('../EngagementHeatmap', () => ({
  EngagementHeatmap: () => <div data-testid="engagement-heatmap">Engagement Heatmap</div>
}));

jest.mock('../FeatureAdoptionFunnel', () => ({
  FeatureAdoptionFunnel: () => <div data-testid="feature-adoption">Feature Adoption</div>
}));

jest.mock('../GeographicDistributionMap', () => ({
  GeographicDistributionMap: () => <div data-testid="geographic-map">Geographic Map</div>
}));

jest.mock('../UserGrowthTimeline', () => ({
  UserGrowthTimeline: () => <div data-testid="user-growth">User Growth</div>
}));

jest.mock('../TopFeaturesChart', () => ({
  TopFeaturesChart: () => <div data-testid="top-features">Top Features</div>
}));

describe('AnalyticsDashboard', () => {
  const mockDashboardData = {
    overview: {
      userMetrics: {
        totalUsers: 1000,
        newUsers: 50,
        activeUsers: { daily: 300, weekly: 600, monthly: 800 },
        growth: { rate: 5.2, trend: 'growing' },
        churn: { rate: 2.1, count: 21 }
      },
      engagementMetrics: {
        sessions: { total: 5000, average: 5, duration: { average: 300 } },
        pageViews: { total: 20000, perSession: 4 },
        bounce: { rate: 25 }
      },
      performanceMetrics: {
        pageLoad: { average: 1500, p95: 3000 },
        errors: { rate: 1.5 },
        availability: { uptime: 99.9 }
      }
    },
    realtimeMetrics: {
      activeUsers: 45,
      activeSessions: 78,
      eventsPerSecond: 12.5,
      errorRate: 0.5
    },
    loading: false,
    error: null,
    refreshData: jest.fn(),
    setDateRange: jest.fn(),
    dateRange: {
      start: new Date('2024-01-01'),
      end: new Date('2024-01-31')
    }
  };

  beforeEach(() => {
    (useAnalyticsDashboard as jest.Mock).mockReturnValue(mockDashboardData);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders dashboard components correctly', () => {
    render(<AnalyticsDashboard />);

    expect(screen.getByText('Analytics Dashboard')).toBeInTheDocument();
    expect(screen.getByTestId('metrics-overview')).toBeInTheDocument();
    expect(screen.getByTestId('user-trends')).toBeInTheDocument();
    expect(screen.getByTestId('retention-cohort')).toBeInTheDocument();
  });

  it('displays loading state', () => {
    (useAnalyticsDashboard as jest.Mock).mockReturnValue({
      ...mockDashboardData,
      loading: true
    });

    render(<AnalyticsDashboard />);
    expect(screen.getByText(/Loading analytics.../i)).toBeInTheDocument();
  });

  it('displays error state', () => {
    const errorMessage = 'Failed to load analytics';
    (useAnalyticsDashboard as jest.Mock).mockReturnValue({
      ...mockDashboardData,
      error: new Error(errorMessage)
    });

    render(<AnalyticsDashboard />);
    expect(screen.getByText(new RegExp(errorMessage))).toBeInTheDocument();
  });

  it('handles date range changes', () => {
    render(<AnalyticsDashboard />);

    const startDateInput = screen.getByLabelText(/start date/i);
    const endDateInput = screen.getByLabelText(/end date/i);

    fireEvent.change(startDateInput, { target: { value: '2024-02-01' } });
    fireEvent.change(endDateInput, { target: { value: '2024-02-28' } });

    expect(mockDashboardData.setDateRange).toHaveBeenCalled();
  });

  it('handles refresh button click', () => {
    render(<AnalyticsDashboard />);

    const refreshButton = screen.getByRole('button', { name: /refresh/i });
    fireEvent.click(refreshButton);

    expect(mockDashboardData.refreshData).toHaveBeenCalled();
  });

  it('toggles between different view modes', () => {
    render(<AnalyticsDashboard />);

    const overviewTab = screen.getByRole('tab', { name: /overview/i });
    const usersTab = screen.getByRole('tab', { name: /users/i });
    const engagementTab = screen.getByRole('tab', { name: /engagement/i });
    const performanceTab = screen.getByRole('tab', { name: /performance/i });

    fireEvent.click(usersTab);
    expect(screen.getByTestId('user-trends')).toBeInTheDocument();

    fireEvent.click(engagementTab);
    expect(screen.getByTestId('engagement-heatmap')).toBeInTheDocument();

    fireEvent.click(performanceTab);
    // Performance metrics should be visible

    fireEvent.click(overviewTab);
    expect(screen.getByTestId('metrics-overview')).toBeInTheDocument();
  });

  it('displays real-time metrics when enabled', () => {
    render(<AnalyticsDashboard />);

    const realtimeToggle = screen.getByLabelText(/real-time/i);
    fireEvent.click(realtimeToggle);

    expect(screen.getByText(/45/)).toBeInTheDocument(); // Active users
    expect(screen.getByText(/78/)).toBeInTheDocument(); // Active sessions
    expect(screen.getByText(/12.5/)).toBeInTheDocument(); // Events per second
  });

  it('exports dashboard data', async () => {
    render(<AnalyticsDashboard />);

    const exportButton = screen.getByRole('button', { name: /export/i });
    fireEvent.click(exportButton);

    const csvOption = screen.getByText(/CSV/i);
    fireEvent.click(csvOption);

    // Verify export was triggered
    await waitFor(() => {
      expect(screen.getByText(/Export completed/i)).toBeInTheDocument();
    });
  });

  it('displays correct metric values', () => {
    render(<AnalyticsDashboard />);

    // Check if key metrics are displayed
    expect(screen.getByText(/1000/)).toBeInTheDocument(); // Total users
    expect(screen.getByText(/300/)).toBeInTheDocument(); // Daily active users
    expect(screen.getByText(/5.2%/)).toBeInTheDocument(); // Growth rate
    expect(screen.getByText(/99.9%/)).toBeInTheDocument(); // Uptime
  });

  it('handles empty data gracefully', () => {
    (useAnalyticsDashboard as jest.Mock).mockReturnValue({
      ...mockDashboardData,
      overview: null
    });

    render(<AnalyticsDashboard />);
    expect(screen.getByText(/No data available/i)).toBeInTheDocument();
  });
});