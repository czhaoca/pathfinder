import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { jest } from '@jest/globals';
import { AdminPanel } from '../AdminPanel';
import { adminService } from '../../../services/admin.service';
import { featureFlagService } from '../../../services/featureFlagService';
import { configurationService } from '../../../services/configurationService';
import { invitationService } from '../../../services/invitationService';
import { userService } from '../../../services/user.service';

// Mock services
jest.mock('../../../services/admin.service');
jest.mock('../../../services/featureFlagService');
jest.mock('../../../services/configurationService');
jest.mock('../../../services/invitationService');
jest.mock('../../../services/user.service');
jest.mock('../../../hooks/useAuth');

// Mock auth hook
import { useAuth } from '../../../hooks/useAuth';
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

describe('AdminPanel', () => {
  const mockAdminUser = {
    id: 'admin-1',
    username: 'admin',
    role: 'site_admin',
    isAdmin: true
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({
      user: mockAdminUser,
      isAdmin: true,
      isAuthenticated: true,
      login: jest.fn(),
      logout: jest.fn()
    });
  });

  describe('Panel Navigation', () => {
    it('should render all admin sections in navigation', () => {
      render(<AdminPanel />);
      
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Users')).toBeInTheDocument();
      expect(screen.getByText('Feature Flags')).toBeInTheDocument();
      expect(screen.getByText('Configuration')).toBeInTheDocument();
      expect(screen.getByText('Security')).toBeInTheDocument();
      expect(screen.getByText('Invitations')).toBeInTheDocument();
      expect(screen.getByText('Audit Logs')).toBeInTheDocument();
    });

    it('should switch between sections on navigation click', async () => {
      render(<AdminPanel />);
      
      // Initially shows dashboard
      expect(screen.getByTestId('admin-dashboard')).toBeInTheDocument();
      
      // Click on Users section
      fireEvent.click(screen.getByText('Users'));
      await waitFor(() => {
        expect(screen.getByTestId('user-management')).toBeInTheDocument();
      });
      
      // Click on Feature Flags section
      fireEvent.click(screen.getByText('Feature Flags'));
      await waitFor(() => {
        expect(screen.getByTestId('feature-flag-manager')).toBeInTheDocument();
      });
    });

    it('should show unauthorized message for non-admin users', () => {
      mockUseAuth.mockReturnValue({
        user: { id: 'user-1', username: 'user', role: 'user', isAdmin: false },
        isAdmin: false,
        isAuthenticated: true,
        login: jest.fn(),
        logout: jest.fn()
      });

      render(<AdminPanel />);
      expect(screen.getByText('Unauthorized Access')).toBeInTheDocument();
    });
  });

  describe('Dashboard Section', () => {
    beforeEach(() => {
      adminService.getDashboardMetrics = jest.fn().mockResolvedValue({
        totalUsers: 1000,
        userGrowth: 15,
        activeSessions: 250,
        failedLogins: 5,
        pendingApprovals: 10
      });

      adminService.getSystemHealth = jest.fn().mockResolvedValue({
        cpu: 45,
        memory: 60,
        disk: 30,
        database: { connected: true, latency: 15, activeConnections: 5 },
        api: { status: 'healthy', responseTime: 50, errorRate: 0.1 },
        websocket: { connected: true, clients: 25 }
      });

      adminService.getRecentActivity = jest.fn().mockResolvedValue([
        { id: '1', type: 'user', action: 'login', actor: 'user1', timestamp: new Date(), result: 'success' },
        { id: '2', type: 'config', action: 'update', actor: 'admin', timestamp: new Date(), result: 'success' }
      ]);

      adminService.getSecurityAlerts = jest.fn().mockResolvedValue([
        { id: '1', severity: 'warning', message: 'Multiple failed login attempts', timestamp: new Date(), resolved: false }
      ]);
    });

    it('should display dashboard metrics', async () => {
      render(<AdminPanel />);
      
      await waitFor(() => {
        expect(screen.getByText('1000')).toBeInTheDocument(); // Total users
        expect(screen.getByText('+15%')).toBeInTheDocument(); // User growth
        expect(screen.getByText('250')).toBeInTheDocument(); // Active sessions
      });
    });

    it('should display system health indicators', async () => {
      render(<AdminPanel />);
      
      await waitFor(() => {
        expect(screen.getByText('CPU: 45%')).toBeInTheDocument();
        expect(screen.getByText('Memory: 60%')).toBeInTheDocument();
        expect(screen.getByText('Database: Healthy')).toBeInTheDocument();
      });
    });

    it('should display and dismiss security alerts', async () => {
      render(<AdminPanel />);
      
      await waitFor(() => {
        expect(screen.getByText('Multiple failed login attempts')).toBeInTheDocument();
      });

      const dismissButton = screen.getByRole('button', { name: /dismiss/i });
      fireEvent.click(dismissButton);

      await waitFor(() => {
        expect(adminService.dismissAlert).toHaveBeenCalledWith('1');
      });
    });

    it('should auto-refresh dashboard data', async () => {
      jest.useFakeTimers();
      render(<AdminPanel />);
      
      await waitFor(() => {
        expect(adminService.getDashboardMetrics).toHaveBeenCalledTimes(1);
      });

      // Fast-forward 30 seconds (auto-refresh interval)
      jest.advanceTimersByTime(30000);

      await waitFor(() => {
        expect(adminService.getDashboardMetrics).toHaveBeenCalledTimes(2);
      });

      jest.useRealTimers();
    });
  });

  describe('User Management Section', () => {
    const mockUsers = [
      { id: '1', username: 'user1', email: 'user1@example.com', status: 'active', role: 'user', createdAt: new Date(), lastActive: new Date() },
      { id: '2', username: 'user2', email: 'user2@example.com', status: 'inactive', role: 'user', createdAt: new Date(), lastActive: new Date() }
    ];

    beforeEach(() => {
      userService.searchUsers = jest.fn().mockResolvedValue({
        users: mockUsers,
        total: 2,
        page: 1,
        totalPages: 1
      });
    });

    it('should display user list with search functionality', async () => {
      render(<AdminPanel />);
      fireEvent.click(screen.getByText('Users'));

      await waitFor(() => {
        expect(screen.getByText('user1@example.com')).toBeInTheDocument();
        expect(screen.getByText('user2@example.com')).toBeInTheDocument();
      });

      // Test search
      const searchInput = screen.getByPlaceholderText('Search users...');
      await userEvent.type(searchInput, 'user1');

      await waitFor(() => {
        expect(userService.searchUsers).toHaveBeenCalledWith(
          expect.objectContaining({ search: 'user1' })
        );
      });
    });

    it('should filter users by status and role', async () => {
      render(<AdminPanel />);
      fireEvent.click(screen.getByText('Users'));

      const statusFilter = screen.getByLabelText('Status Filter');
      fireEvent.change(statusFilter, { target: { value: 'active' } });

      await waitFor(() => {
        expect(userService.searchUsers).toHaveBeenCalledWith(
          expect.objectContaining({ status: 'active' })
        );
      });

      const roleFilter = screen.getByLabelText('Role Filter');
      fireEvent.change(roleFilter, { target: { value: 'admin' } });

      await waitFor(() => {
        expect(userService.searchUsers).toHaveBeenCalledWith(
          expect.objectContaining({ role: 'admin' })
        );
      });
    });

    it('should handle user impersonation', async () => {
      adminService.impersonateUser = jest.fn().mockResolvedValue({
        token: 'impersonation-token',
        expiresAt: new Date()
      });

      render(<AdminPanel />);
      fireEvent.click(screen.getByText('Users'));

      await waitFor(() => {
        expect(screen.getByText('user1@example.com')).toBeInTheDocument();
      });

      const impersonateButton = screen.getAllByTitle('Impersonate')[0];
      fireEvent.click(impersonateButton);

      // Confirm dialog
      const confirmButton = await screen.findByRole('button', { name: /confirm/i });
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(adminService.impersonateUser).toHaveBeenCalledWith('1');
      });
    });

    it('should perform bulk operations on selected users', async () => {
      adminService.bulkUserOperation = jest.fn().mockResolvedValue({
        processed: 2,
        successful: 2,
        failed: 0
      });

      render(<AdminPanel />);
      fireEvent.click(screen.getByText('Users'));

      await waitFor(() => {
        expect(screen.getByText('user1@example.com')).toBeInTheDocument();
      });

      // Select users
      const checkboxes = screen.getAllByRole('checkbox');
      fireEvent.click(checkboxes[1]); // First user checkbox
      fireEvent.click(checkboxes[2]); // Second user checkbox

      // Click bulk action button
      const bulkActionButton = screen.getByText('Bulk Actions');
      fireEvent.click(bulkActionButton);

      // Select suspend action
      const suspendOption = screen.getByText('Suspend Selected');
      fireEvent.click(suspendOption);

      // Enter reason
      const reasonInput = await screen.findByPlaceholderText('Enter reason...');
      await userEvent.type(reasonInput, 'Policy violation');

      // Confirm
      const confirmButton = screen.getByRole('button', { name: /confirm/i });
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(adminService.bulkUserOperation).toHaveBeenCalledWith(
          ['1', '2'],
          'suspend',
          'Policy violation'
        );
      });
    });

    it('should export user data', async () => {
      const mockBlob = new Blob(['user,data'], { type: 'text/csv' });
      userService.exportUsers = jest.fn().mockResolvedValue(mockBlob);

      render(<AdminPanel />);
      fireEvent.click(screen.getByText('Users'));

      const exportButton = await screen.findByText('Export Users');
      fireEvent.click(exportButton);

      await waitFor(() => {
        expect(userService.exportUsers).toHaveBeenCalled();
      });
    });
  });

  describe('Feature Flag Management', () => {
    const mockFeatureFlags = [
      {
        id: 'new-ui',
        name: 'New UI',
        description: 'Enable new user interface',
        enabled: true,
        rolloutPercentage: 50,
        targetGroups: ['beta'],
        history: [],
        metrics: { enabledUsers: 500, totalUsers: 1000, adoptionRate: 50 }
      }
    ];

    beforeEach(() => {
      featureFlagService.getAllFlags = jest.fn().mockResolvedValue(mockFeatureFlags);
      featureFlagService.getMetrics = jest.fn().mockResolvedValue({
        total: 5,
        enabled: 3,
        disabled: 2,
        inRollout: 1
      });
    });

    it('should display feature flags with visual indicators', async () => {
      render(<AdminPanel />);
      fireEvent.click(screen.getByText('Feature Flags'));

      await waitFor(() => {
        expect(screen.getByText('New UI')).toBeInTheDocument();
        expect(screen.getByText('50% Rollout')).toBeInTheDocument();
        expect(screen.getByText('Enabled')).toBeInTheDocument();
      });
    });

    it('should toggle feature flag status', async () => {
      featureFlagService.updateFlag = jest.fn().mockResolvedValue({
        ...mockFeatureFlags[0],
        enabled: false
      });

      render(<AdminPanel />);
      fireEvent.click(screen.getByText('Feature Flags'));

      await waitFor(() => {
        expect(screen.getByText('New UI')).toBeInTheDocument();
      });

      const toggleSwitch = screen.getByRole('switch', { name: /toggle new ui/i });
      fireEvent.click(toggleSwitch);

      // Enter reason
      const reasonInput = await screen.findByPlaceholderText('Enter reason for change...');
      await userEvent.type(reasonInput, 'Disabling for maintenance');

      const confirmButton = screen.getByRole('button', { name: /confirm/i });
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(featureFlagService.updateFlag).toHaveBeenCalledWith(
          'new-ui',
          expect.objectContaining({ enabled: false }),
          'Disabling for maintenance'
        );
      });
    });

    it('should configure A/B test for feature flag', async () => {
      featureFlagService.createABTest = jest.fn().mockResolvedValue({
        testId: 'test-123',
        status: 'running'
      });

      render(<AdminPanel />);
      fireEvent.click(screen.getByText('Feature Flags'));

      await waitFor(() => {
        expect(screen.getByText('New UI')).toBeInTheDocument();
      });

      const configureTestButton = screen.getByRole('button', { name: /configure a\/b test/i });
      fireEvent.click(configureTestButton);

      // Fill in test configuration
      const variantNameInput = screen.getByPlaceholderText('Variant name...');
      await userEvent.type(variantNameInput, 'Variant A');

      const weightInput = screen.getByPlaceholderText('Weight (%)...');
      await userEvent.type(weightInput, '50');

      const durationInput = screen.getByLabelText('Test duration (days)');
      await userEvent.type(durationInput, '14');

      const startTestButton = screen.getByRole('button', { name: /start test/i });
      fireEvent.click(startTestButton);

      await waitFor(() => {
        expect(featureFlagService.createABTest).toHaveBeenCalled();
      });
    });

    it('should display feature flag history', async () => {
      const flagWithHistory = {
        ...mockFeatureFlags[0],
        history: [
          { action: 'enabled', timestamp: new Date(), user: 'admin', details: 'Initial enable' },
          { action: 'rollout_changed', timestamp: new Date(), user: 'admin', details: 'Changed to 50%' }
        ]
      };

      featureFlagService.getAllFlags = jest.fn().mockResolvedValue([flagWithHistory]);

      render(<AdminPanel />);
      fireEvent.click(screen.getByText('Feature Flags'));

      await waitFor(() => {
        expect(screen.getByText('New UI')).toBeInTheDocument();
      });

      const viewHistoryButton = screen.getByRole('button', { name: /view history/i });
      fireEvent.click(viewHistoryButton);

      await waitFor(() => {
        expect(screen.getByText('Initial enable')).toBeInTheDocument();
        expect(screen.getByText('Changed to 50%')).toBeInTheDocument();
      });
    });
  });

  describe('System Configuration', () => {
    const mockConfig = {
      general: [
        { key: 'app.name', value: 'Pathfinder', type: 'string', editable: false },
        { key: 'app.maintenance', value: false, type: 'boolean', editable: true }
      ],
      security: [
        { key: 'auth.sessionTimeout', value: 3600, type: 'number', editable: true },
        { key: 'auth.maxLoginAttempts', value: 5, type: 'number', editable: true }
      ]
    };

    beforeEach(() => {
      configurationService.getGroupedConfig = jest.fn().mockResolvedValue(mockConfig);
    });

    it('should display grouped configuration settings', async () => {
      render(<AdminPanel />);
      fireEvent.click(screen.getByText('Configuration'));

      await waitFor(() => {
        expect(screen.getByText('General')).toBeInTheDocument();
        expect(screen.getByText('Security')).toBeInTheDocument();
        expect(screen.getByText('app.name')).toBeInTheDocument();
        expect(screen.getByText('auth.sessionTimeout')).toBeInTheDocument();
      });
    });

    it('should allow editing of editable configurations', async () => {
      configurationService.updateConfig = jest.fn().mockResolvedValue({
        key: 'auth.sessionTimeout',
        value: 7200,
        previousValue: 3600
      });

      render(<AdminPanel />);
      fireEvent.click(screen.getByText('Configuration'));

      await waitFor(() => {
        expect(screen.getByText('auth.sessionTimeout')).toBeInTheDocument();
      });

      const editButton = screen.getByTestId('edit-auth.sessionTimeout');
      fireEvent.click(editButton);

      const valueInput = await screen.findByDisplayValue('3600');
      await userEvent.clear(valueInput);
      await userEvent.type(valueInput, '7200');

      const reasonInput = screen.getByPlaceholderText('Reason for change...');
      await userEvent.type(reasonInput, 'Extending session timeout');

      const saveButton = screen.getByRole('button', { name: /save/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(configurationService.updateConfig).toHaveBeenCalledWith(
          'auth.sessionTimeout',
          7200,
          'Extending session timeout'
        );
      });
    });

    it('should prevent editing of non-editable configurations', async () => {
      render(<AdminPanel />);
      fireEvent.click(screen.getByText('Configuration'));

      await waitFor(() => {
        expect(screen.getByText('app.name')).toBeInTheDocument();
      });

      // Non-editable configs should not have edit button
      expect(screen.queryByTestId('edit-app.name')).not.toBeInTheDocument();
    });

    it('should search configurations', async () => {
      render(<AdminPanel />);
      fireEvent.click(screen.getByText('Configuration'));

      const searchInput = await screen.findByPlaceholderText('Search configuration...');
      await userEvent.type(searchInput, 'session');

      await waitFor(() => {
        expect(screen.getByText('auth.sessionTimeout')).toBeInTheDocument();
        expect(screen.queryByText('app.name')).not.toBeInTheDocument();
      });
    });
  });

  describe('Invitation Management', () => {
    const mockInvitations = {
      invitations: [
        { id: '1', email: 'newuser@example.com', status: 'pending', sentAt: new Date(), expiresAt: new Date() }
      ],
      statistics: {
        total: 100,
        pending: 20,
        accepted: 70,
        expired: 10,
        acceptanceRate: 70
      },
      templates: [
        { id: 'welcome', name: 'Welcome Email', usageCount: 50 }
      ]
    };

    beforeEach(() => {
      invitationService.getInvitationDashboard = jest.fn().mockResolvedValue(mockInvitations);
    });

    it('should display invitation statistics', async () => {
      render(<AdminPanel />);
      fireEvent.click(screen.getByText('Invitations'));

      await waitFor(() => {
        expect(screen.getByText('70% Acceptance Rate')).toBeInTheDocument();
        expect(screen.getByText('20 Pending')).toBeInTheDocument();
        expect(screen.getByText('70 Accepted')).toBeInTheDocument();
      });
    });

    it('should send bulk invitations', async () => {
      invitationService.sendBulkInvitations = jest.fn().mockResolvedValue({
        sent: 3,
        failed: 0,
        details: []
      });

      render(<AdminPanel />);
      fireEvent.click(screen.getByText('Invitations'));

      const bulkInviteButton = await screen.findByText('Send Bulk Invitations');
      fireEvent.click(bulkInviteButton);

      const emailsTextarea = await screen.findByPlaceholderText('Enter emails (one per line)...');
      await userEvent.type(emailsTextarea, 'user1@example.com\nuser2@example.com\nuser3@example.com');

      const templateSelect = screen.getByLabelText('Email Template');
      fireEvent.change(templateSelect, { target: { value: 'welcome' } });

      const sendButton = screen.getByRole('button', { name: /send invitations/i });
      fireEvent.click(sendButton);

      await waitFor(() => {
        expect(invitationService.sendBulkInvitations).toHaveBeenCalledWith(
          ['user1@example.com', 'user2@example.com', 'user3@example.com'],
          expect.objectContaining({ template: 'welcome' })
        );
      });
    });

    it('should resend individual invitations', async () => {
      invitationService.resendInvitation = jest.fn().mockResolvedValue({ success: true });

      render(<AdminPanel />);
      fireEvent.click(screen.getByText('Invitations'));

      await waitFor(() => {
        expect(screen.getByText('newuser@example.com')).toBeInTheDocument();
      });

      const resendButton = screen.getByRole('button', { name: /resend/i });
      fireEvent.click(resendButton);

      await waitFor(() => {
        expect(invitationService.resendInvitation).toHaveBeenCalledWith('1');
      });
    });
  });

  describe('Security Settings', () => {
    const mockSecuritySettings = {
      passwordPolicy: {
        minLength: 8,
        requireUppercase: true,
        requireNumbers: true
      },
      rateLimiting: {
        login: { attempts: 5, window: 300 },
        api: { requests: 100, window: 60 }
      },
      captcha: {
        enabled: true,
        threshold: 3
      }
    };

    beforeEach(() => {
      adminService.getSecuritySettings = jest.fn().mockResolvedValue(mockSecuritySettings);
    });

    it('should display security policies', async () => {
      render(<AdminPanel />);
      fireEvent.click(screen.getByText('Security'));

      await waitFor(() => {
        expect(screen.getByText('Password Policy')).toBeInTheDocument();
        expect(screen.getByText('Minimum Length: 8')).toBeInTheDocument();
        expect(screen.getByText('Rate Limiting')).toBeInTheDocument();
      });
    });

    it('should update rate limiting settings', async () => {
      adminService.updateRateLimits = jest.fn().mockResolvedValue({
        endpoint: 'login',
        attempts: 3,
        window: 600
      });

      render(<AdminPanel />);
      fireEvent.click(screen.getByText('Security'));

      await waitFor(() => {
        expect(screen.getByText('Rate Limiting')).toBeInTheDocument();
      });

      const editRateLimitButton = screen.getByTestId('edit-rate-limit-login');
      fireEvent.click(editRateLimitButton);

      const attemptsInput = await screen.findByLabelText('Max Attempts');
      await userEvent.clear(attemptsInput);
      await userEvent.type(attemptsInput, '3');

      const windowInput = screen.getByLabelText('Time Window (seconds)');
      await userEvent.clear(windowInput);
      await userEvent.type(windowInput, '600');

      const reasonInput = screen.getByPlaceholderText('Reason for change...');
      await userEvent.type(reasonInput, 'Increased security');

      const saveButton = screen.getByRole('button', { name: /save/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(adminService.updateRateLimits).toHaveBeenCalledWith(
          'login',
          { attempts: 3, window: 600 },
          'Increased security'
        );
      });
    });
  });
});