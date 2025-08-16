import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AdminDashboard } from '../AdminDashboard';
import { authStore } from '@/stores/authStore';
import { adminService } from '@/services/admin.service';
import { websocketService } from '@/services/websocket.service';
import '@testing-library/jest-dom';

// Mock dependencies
jest.mock('@/stores/authStore');
jest.mock('@/services/admin.service');
jest.mock('@/services/websocket.service');
jest.mock('@/hooks/useWebSocket', () => ({
  useWebSocket: jest.fn((type, callback) => websocketService)
}));

// Mock child components to focus on AdminDashboard logic
jest.mock('@/components/admin/AdminSidebar', () => ({
  AdminSidebar: ({ userRole }: any) => <div data-testid="admin-sidebar">Sidebar: {userRole}</div>
}));
jest.mock('@/components/admin/DashboardMetrics', () => ({
  DashboardMetrics: ({ data }: any) => <div data-testid="dashboard-metrics">Metrics: {JSON.stringify(data)}</div>
}));
jest.mock('@/components/admin/SecurityAlerts', () => ({
  SecurityAlerts: ({ alerts, canDismiss, onDismiss }: any) => (
    <div data-testid="security-alerts">
      Alerts: {alerts.length}
      {canDismiss && <button onClick={() => onDismiss('test-id')}>Dismiss</button>}
    </div>
  )
}));
jest.mock('@/components/admin/QuickActions', () => ({
  QuickActions: ({ role }: any) => <div data-testid="quick-actions">Actions: {role}</div>
}));
jest.mock('@/components/admin/RecentActivity', () => ({
  RecentActivity: ({ limit }: any) => <div data-testid="recent-activity">Activity: {limit}</div>
}));
jest.mock('@/components/admin/SystemHealthMonitor', () => ({
  SystemHealthMonitor: () => <div data-testid="system-health">Health Monitor</div>
}));

describe('AdminDashboard - Security & Authorization', () => {
  const mockNavigate = jest.fn();
  
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock useNavigate
    jest.mock('react-router-dom', () => ({
      ...jest.requireActual('react-router-dom'),
      useNavigate: () => mockNavigate,
      Navigate: ({ to }: any) => {
        mockNavigate(to);
        return null;
      }
    }));
  });
  
  describe('RBAC Enforcement', () => {
    test('should deny access to non-admin users', () => {
      const mockUser = {
        id: '1',
        username: 'regular_user',
        roles: [{ role_name: 'user' }]
      };
      
      (authStore as jest.Mock).mockReturnValue({ user: mockUser });
      
      const { container } = render(
        <BrowserRouter>
          <AdminDashboard />
        </BrowserRouter>
      );
      
      // Should redirect non-admin users
      expect(container.querySelector('[data-testid="admin-sidebar"]')).not.toBeInTheDocument();
    });
    
    test('should allow access to admin users', async () => {
      const mockUser = {
        id: '1',
        username: 'admin_user',
        roles: [{ role_name: 'admin' }]
      };
      
      (authStore as jest.Mock).mockReturnValue({ user: mockUser });
      (adminService.getDashboardMetrics as jest.Mock).mockResolvedValue({
        totalUsers: 100,
        userGrowth: 10,
        activeSessions: 25,
        failedLogins: 5,
        pendingApprovals: 3
      });
      (adminService.getSecurityAlerts as jest.Mock).mockResolvedValue([]);
      
      render(
        <BrowserRouter>
          <AdminDashboard />
        </BrowserRouter>
      );
      
      await waitFor(() => {
        expect(screen.getByText('Admin Dashboard')).toBeInTheDocument();
        expect(screen.getByTestId('admin-sidebar')).toBeInTheDocument();
      });
    });
    
    test('should allow access to site_admin users', async () => {
      const mockUser = {
        id: '1',
        username: 'site_admin_user',
        roles: [{ role_name: 'site_admin' }]
      };
      
      (authStore as jest.Mock).mockReturnValue({ user: mockUser });
      (adminService.getDashboardMetrics as jest.Mock).mockResolvedValue({
        totalUsers: 100,
        userGrowth: 10,
        activeSessions: 25,
        failedLogins: 5,
        pendingApprovals: 3
      });
      (adminService.getSecurityAlerts as jest.Mock).mockResolvedValue([]);
      
      render(
        <BrowserRouter>
          <AdminDashboard />
        </BrowserRouter>
      );
      
      await waitFor(() => {
        expect(screen.getByText('Admin Dashboard')).toBeInTheDocument();
        expect(screen.getByTestId('system-health')).toBeInTheDocument(); // Site admin only feature
      });
    });
    
    test('should handle null user object gracefully', () => {
      (authStore as jest.Mock).mockReturnValue({ user: null });
      
      const { container } = render(
        <BrowserRouter>
          <AdminDashboard />
        </BrowserRouter>
      );
      
      expect(container.querySelector('[data-testid="admin-sidebar"]')).not.toBeInTheDocument();
    });
    
    test('should handle undefined roles array', () => {
      const mockUser = {
        id: '1',
        username: 'broken_user',
        roles: undefined
      };
      
      (authStore as jest.Mock).mockReturnValue({ user: mockUser });
      
      const { container } = render(
        <BrowserRouter>
          <AdminDashboard />
        </BrowserRouter>
      );
      
      expect(container.querySelector('[data-testid="admin-sidebar"]')).not.toBeInTheDocument();
    });
    
    test('should handle empty roles array', () => {
      const mockUser = {
        id: '1',
        username: 'no_role_user',
        roles: []
      };
      
      (authStore as jest.Mock).mockReturnValue({ user: mockUser });
      
      const { container } = render(
        <BrowserRouter>
          <AdminDashboard />
        </BrowserRouter>
      );
      
      expect(container.querySelector('[data-testid="admin-sidebar"]')).not.toBeInTheDocument();
    });
  });
  
  describe('Data Loading & Error Handling', () => {
    beforeEach(() => {
      const mockUser = {
        id: '1',
        username: 'admin_user',
        roles: [{ role_name: 'admin' }]
      };
      (authStore as jest.Mock).mockReturnValue({ user: mockUser });
    });
    
    test('should handle API failures gracefully', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      (adminService.getDashboardMetrics as jest.Mock).mockRejectedValue(
        new Error('Network error')
      );
      (adminService.getSecurityAlerts as jest.Mock).mockRejectedValue(
        new Error('Network error')
      );
      
      render(
        <BrowserRouter>
          <AdminDashboard />
        </BrowserRouter>
      );
      
      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Failed to load dashboard data:',
          expect.any(Error)
        );
      });
      
      // Should still render the dashboard structure
      expect(screen.getByText('Admin Dashboard')).toBeInTheDocument();
      
      consoleErrorSpy.mockRestore();
    });
    
    test('should handle partial API failures', async () => {
      (adminService.getDashboardMetrics as jest.Mock).mockResolvedValue({
        totalUsers: 100,
        userGrowth: 10,
        activeSessions: 25,
        failedLogins: 5,
        pendingApprovals: 3
      });
      (adminService.getSecurityAlerts as jest.Mock).mockRejectedValue(
        new Error('Alerts service down')
      );
      
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      render(
        <BrowserRouter>
          <AdminDashboard />
        </BrowserRouter>
      );
      
      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalled();
      });
      
      // Should still show metrics even if alerts fail
      expect(screen.getByTestId('dashboard-metrics')).toBeInTheDocument();
      
      consoleErrorSpy.mockRestore();
    });
    
    test('should show loading state while fetching data', () => {
      (adminService.getDashboardMetrics as jest.Mock).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );
      (adminService.getSecurityAlerts as jest.Mock).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );
      
      render(
        <BrowserRouter>
          <AdminDashboard />
        </BrowserRouter>
      );
      
      expect(screen.getByText('Admin Dashboard')).toBeInTheDocument();
      // Check for loading spinner
      const loader = document.querySelector('.animate-spin');
      expect(loader).toBeInTheDocument();
    });
  });
  
  describe('Real-time Updates via WebSocket', () => {
    beforeEach(() => {
      const mockUser = {
        id: '1',
        username: 'admin_user',
        roles: [{ role_name: 'admin' }]
      };
      (authStore as jest.Mock).mockReturnValue({ user: mockUser });
      (adminService.getDashboardMetrics as jest.Mock).mockResolvedValue({
        totalUsers: 100,
        userGrowth: 10,
        activeSessions: 25,
        failedLogins: 5,
        pendingApprovals: 3
      });
      (adminService.getSecurityAlerts as jest.Mock).mockResolvedValue([]);
    });
    
    test('should handle dashboard metric updates via WebSocket', async () => {
      const { useWebSocket } = require('@/hooks/useWebSocket');
      let dashboardUpdateCallback: any;
      
      useWebSocket.mockImplementation((type: string, callback: any) => {
        if (type === 'dashboard:update') {
          dashboardUpdateCallback = callback;
        }
        return websocketService;
      });
      
      render(
        <BrowserRouter>
          <AdminDashboard />
        </BrowserRouter>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('dashboard-metrics')).toBeInTheDocument();
      });
      
      // Simulate WebSocket update
      const newMetrics = {
        totalUsers: 150,
        userGrowth: 20,
        activeSessions: 30,
        failedLogins: 2,
        pendingApprovals: 5
      };
      
      dashboardUpdateCallback({ metrics: newMetrics });
      
      await waitFor(() => {
        const metricsElement = screen.getByTestId('dashboard-metrics');
        expect(metricsElement.textContent).toContain('150');
      });
    });
    
    test('should handle security alerts via WebSocket', async () => {
      const { useWebSocket } = require('@/hooks/useWebSocket');
      let alertCallback: any;
      
      useWebSocket.mockImplementation((type: string, callback: any) => {
        if (type === 'security:alert') {
          alertCallback = callback;
        }
        return websocketService;
      });
      
      render(
        <BrowserRouter>
          <AdminDashboard />
        </BrowserRouter>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('security-alerts')).toBeInTheDocument();
      });
      
      // Simulate new security alert
      const newAlert = {
        id: 'alert-1',
        severity: 'critical',
        message: 'Multiple failed login attempts detected',
        timestamp: new Date(),
        resolved: false
      };
      
      alertCallback(newAlert);
      
      await waitFor(() => {
        const alertsElement = screen.getByTestId('security-alerts');
        expect(alertsElement.textContent).toContain('Alerts: 1');
      });
    });
  });
  
  describe('Security Alert Management', () => {
    test('should show alert count badge when unresolved alerts exist', async () => {
      const mockUser = {
        id: '1',
        username: 'admin_user',
        roles: [{ role_name: 'admin' }]
      };
      
      (authStore as jest.Mock).mockReturnValue({ user: mockUser });
      (adminService.getDashboardMetrics as jest.Mock).mockResolvedValue({
        totalUsers: 100,
        userGrowth: 10,
        activeSessions: 25,
        failedLogins: 5,
        pendingApprovals: 3
      });
      (adminService.getSecurityAlerts as jest.Mock).mockResolvedValue([
        { id: '1', severity: 'warning', message: 'Test', timestamp: new Date(), resolved: false },
        { id: '2', severity: 'error', message: 'Test 2', timestamp: new Date(), resolved: false },
        { id: '3', severity: 'info', message: 'Test 3', timestamp: new Date(), resolved: true }
      ]);
      
      render(
        <BrowserRouter>
          <AdminDashboard />
        </BrowserRouter>
      );
      
      await waitFor(() => {
        // Should show count of unresolved alerts (2)
        const badge = screen.getByText('2');
        expect(badge).toHaveClass('bg-red-500');
      });
    });
    
    test('should allow site_admin to dismiss alerts', async () => {
      const mockUser = {
        id: '1',
        username: 'site_admin_user',
        roles: [{ role_name: 'site_admin' }]
      };
      
      (authStore as jest.Mock).mockReturnValue({ user: mockUser });
      (adminService.getDashboardMetrics as jest.Mock).mockResolvedValue({
        totalUsers: 100,
        userGrowth: 10,
        activeSessions: 25,
        failedLogins: 5,
        pendingApprovals: 3
      });
      (adminService.getSecurityAlerts as jest.Mock).mockResolvedValue([
        { id: 'alert-1', severity: 'warning', message: 'Test', timestamp: new Date(), resolved: false }
      ]);
      
      render(
        <BrowserRouter>
          <AdminDashboard />
        </BrowserRouter>
      );
      
      await waitFor(() => {
        expect(screen.getByText('Dismiss')).toBeInTheDocument();
      });
      
      fireEvent.click(screen.getByText('Dismiss'));
      
      await waitFor(() => {
        const alertsElement = screen.getByTestId('security-alerts');
        expect(alertsElement.textContent).toContain('Alerts: 1'); // Alert marked as resolved but still in list
      });
    });
    
    test('should not show dismiss button for regular admin', async () => {
      const mockUser = {
        id: '1',
        username: 'admin_user',
        roles: [{ role_name: 'admin' }]
      };
      
      (authStore as jest.Mock).mockReturnValue({ user: mockUser });
      (adminService.getDashboardMetrics as jest.Mock).mockResolvedValue({
        totalUsers: 100,
        userGrowth: 10,
        activeSessions: 25,
        failedLogins: 5,
        pendingApprovals: 3
      });
      (adminService.getSecurityAlerts as jest.Mock).mockResolvedValue([
        { id: 'alert-1', severity: 'warning', message: 'Test', timestamp: new Date(), resolved: false }
      ]);
      
      render(
        <BrowserRouter>
          <AdminDashboard />
        </BrowserRouter>
      );
      
      await waitFor(() => {
        expect(screen.queryByText('Dismiss')).not.toBeInTheDocument();
      });
    });
  });
  
  describe('Edge Cases', () => {
    test('should handle null dashboard data gracefully', async () => {
      const mockUser = {
        id: '1',
        username: 'admin_user',
        roles: [{ role_name: 'admin' }]
      };
      
      (authStore as jest.Mock).mockReturnValue({ user: mockUser });
      (adminService.getDashboardMetrics as jest.Mock).mockResolvedValue(null);
      (adminService.getSecurityAlerts as jest.Mock).mockResolvedValue(null);
      
      render(
        <BrowserRouter>
          <AdminDashboard />
        </BrowserRouter>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('dashboard-metrics')).toBeInTheDocument();
        expect(screen.getByTestId('dashboard-metrics').textContent).toContain('null');
      });
    });
    
    test('should handle malformed WebSocket messages', async () => {
      const { useWebSocket } = require('@/hooks/useWebSocket');
      let dashboardUpdateCallback: any;
      
      useWebSocket.mockImplementation((type: string, callback: any) => {
        if (type === 'dashboard:update') {
          dashboardUpdateCallback = callback;
        }
        return websocketService;
      });
      
      const mockUser = {
        id: '1',
        username: 'admin_user',
        roles: [{ role_name: 'admin' }]
      };
      
      (authStore as jest.Mock).mockReturnValue({ user: mockUser });
      (adminService.getDashboardMetrics as jest.Mock).mockResolvedValue({
        totalUsers: 100,
        userGrowth: 10,
        activeSessions: 25,
        failedLogins: 5,
        pendingApprovals: 3
      });
      (adminService.getSecurityAlerts as jest.Mock).mockResolvedValue([]);
      
      render(
        <BrowserRouter>
          <AdminDashboard />
        </BrowserRouter>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('dashboard-metrics')).toBeInTheDocument();
      });
      
      // Send malformed update (missing metrics property)
      dashboardUpdateCallback({ invalid: 'data' });
      
      // Should not crash, original data should remain
      expect(screen.getByTestId('dashboard-metrics').textContent).toContain('100');
    });
  });
});