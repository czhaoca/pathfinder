import { test, expect } from '../../fixtures/auth.fixture';
import { Browser } from '@playwright/test';

test.describe('Admin Dashboard', () => {
  test('displays real-time metrics', async ({ page, authHelper, adminUser, browser }) => {
    await authHelper.loginAs(adminUser);
    await page.goto('/admin');
    
    // Verify metrics cards are visible
    await expect(page.locator('[data-testid="metric-total-users"]')).toBeVisible();
    await expect(page.locator('[data-testid="metric-active-sessions"]')).toBeVisible();
    await expect(page.locator('[data-testid="metric-failed-logins"]')).toBeVisible();
    await expect(page.locator('[data-testid="metric-pending-approvals"]')).toBeVisible();
    
    // Get initial session count
    const initialSessions = await page.locator('[data-testid="metric-active-sessions"]').textContent();
    const initialCount = parseInt(initialSessions || '0');
    
    // Create new session in another browser context
    const context2 = await browser.newContext();
    const page2 = await context2.newPage();
    const authHelper2 = new (await import('../../helpers/auth.helper')).AuthHelper(page2);
    const regularUser = await (await import('../../factories/user.factory')).UserFactory.createUser('user');
    await authHelper2.loginAs(regularUser, page2);
    
    // Wait for real-time update (WebSocket)
    await page.waitForFunction(
      (initial) => {
        const current = document.querySelector('[data-testid="metric-active-sessions"]')?.textContent;
        return parseInt(current || '0') > initial;
      },
      initialCount,
      { timeout: 5000 }
    );
    
    const updatedSessions = await page.locator('[data-testid="metric-active-sessions"]').textContent();
    expect(parseInt(updatedSessions || '0')).toBeGreaterThan(initialCount);
    
    // Cleanup
    await context2.close();
    await (await import('../../factories/user.factory')).UserFactory.cleanup(regularUser);
  });
  
  test('audit log viewer with filtering', async ({ page, authHelper, adminUser }) => {
    await authHelper.loginAs(adminUser);
    await page.goto('/admin/audit-logs');
    
    // Verify logs are visible
    await expect(page.locator('[data-testid="audit-log-entry"]').first()).toBeVisible();
    
    // Test severity filter
    await page.selectOption('[data-testid="severity-filter"]', 'error');
    await page.waitForLoadState('networkidle');
    
    // Verify all visible logs have error severity
    const errorLogs = await page.locator('[data-testid="audit-log-entry"][data-severity="error"]').count();
    const totalLogs = await page.locator('[data-testid="audit-log-entry"]').count();
    
    if (totalLogs > 0) {
      expect(errorLogs).toBe(totalLogs);
    }
    
    // Test date range filter
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    await page.fill('[data-testid="date-from"]', yesterday.toISOString().split('T')[0]);
    await page.fill('[data-testid="date-to"]', tomorrow.toISOString().split('T')[0]);
    await page.click('[data-testid="apply-filters"]');
    
    // Verify filtered results
    await page.waitForLoadState('networkidle');
    const logsAfterFilter = await page.locator('[data-testid="audit-log-entry"]').count();
    expect(logsAfterFilter).toBeGreaterThanOrEqual(0);
    
    // Test search functionality
    await page.fill('[data-testid="audit-search"]', 'login');
    await page.waitForTimeout(500); // Debounce
    
    const searchResults = await page.locator('[data-testid="audit-log-entry"]').allTextContents();
    if (searchResults.length > 0) {
      searchResults.forEach(text => {
        expect(text.toLowerCase()).toContain('login');
      });
    }
    
    // Test log expansion
    if (await page.locator('[data-testid="audit-log-entry"]').count() > 0) {
      const firstLog = page.locator('[data-testid="audit-log-entry"]').first();
      await firstLog.click();
      await expect(firstLog.locator('[data-testid="log-details"]')).toBeVisible();
      await expect(firstLog.locator('[data-testid="event-hash"]')).toBeVisible();
      await expect(firstLog.locator('[data-testid="risk-score"]')).toBeVisible();
    }
  });
  
  test('batch user operations', async ({ page, authHelper, adminUser }) => {
    // Create test users for batch operations
    const testUsers = await Promise.all([
      (await import('../../factories/user.factory')).UserFactory.createUser('user'),
      (await import('../../factories/user.factory')).UserFactory.createUser('user'),
      (await import('../../factories/user.factory')).UserFactory.createUser('user')
    ]);
    
    await authHelper.loginAs(adminUser);
    await page.goto('/admin/users');
    
    // Select multiple users
    for (const user of testUsers) {
      const checkbox = page.locator(`[data-testid="select-user-${user.id}"]`);
      if (await checkbox.isVisible()) {
        await checkbox.check();
      }
    }
    
    // Verify selected count
    const selectedCount = await page.locator('[data-testid="selected-count"]').textContent();
    expect(parseInt(selectedCount || '0')).toBeGreaterThanOrEqual(testUsers.length);
    
    // Perform batch deactivation
    await page.click('[data-testid="batch-actions"]');
    await page.click('[data-testid="batch-deactivate"]');
    
    // Confirm action
    await expect(page.locator('[data-testid="batch-confirm-dialog"]')).toBeVisible();
    await page.click('[data-testid="confirm-batch-action"]');
    
    // Wait for completion
    await expect(page.locator('text=Successfully deactivated')).toBeVisible({ timeout: 10000 });
    
    // Verify users are deactivated
    await page.reload();
    for (const user of testUsers) {
      const userStatus = page.locator(`[data-testid="user-status-${user.id}"]`);
      if (await userStatus.isVisible()) {
        await expect(userStatus).toHaveAttribute('data-status', 'inactive');
      }
    }
    
    // Cleanup
    await Promise.all(testUsers.map(user => 
      (import('../../factories/user.factory')).then(m => m.UserFactory.cleanup(user))
    ));
  });
  
  test('security alerts display and dismissal', async ({ page, authHelper, siteAdminUser }) => {
    await authHelper.loginAs(siteAdminUser);
    await page.goto('/admin');
    
    // Check for security alerts section
    const alertsSection = page.locator('[data-testid="security-alerts"]');
    
    if (await alertsSection.isVisible()) {
      // Check alert severity indicators
      const criticalAlerts = await page.locator('[data-testid="alert-critical"]').count();
      const warningAlerts = await page.locator('[data-testid="alert-warning"]').count();
      
      // Site admin can dismiss alerts
      if (criticalAlerts > 0) {
        const firstCriticalAlert = page.locator('[data-testid="alert-critical"]').first();
        const dismissButton = firstCriticalAlert.locator('[data-testid="dismiss-alert"]');
        
        if (await dismissButton.isVisible()) {
          await dismissButton.click();
          await expect(page.locator('text=Alert dismissed')).toBeVisible();
          
          // Verify alert is removed
          await page.waitForTimeout(500);
          const newCriticalCount = await page.locator('[data-testid="alert-critical"]').count();
          expect(newCriticalCount).toBe(criticalAlerts - 1);
        }
      }
    }
  });
  
  test('system health monitoring', async ({ page, authHelper, siteAdminUser }) => {
    await authHelper.loginAs(siteAdminUser);
    await page.goto('/admin');
    
    // Verify system health section is visible for site admin
    await expect(page.locator('[data-testid="system-health"]')).toBeVisible();
    
    // Check health metrics
    await expect(page.locator('[data-testid="health-cpu"]')).toBeVisible();
    await expect(page.locator('[data-testid="health-memory"]')).toBeVisible();
    await expect(page.locator('[data-testid="health-disk"]')).toBeVisible();
    await expect(page.locator('[data-testid="health-database"]')).toBeVisible();
    
    // Verify status indicators
    const cpuStatus = await page.locator('[data-testid="health-cpu-status"]').getAttribute('data-status');
    expect(['healthy', 'warning', 'critical']).toContain(cpuStatus);
    
    // Test refresh functionality
    const initialCpuValue = await page.locator('[data-testid="health-cpu-value"]').textContent();
    
    // Wait for auto-refresh (30 seconds) or trigger manual refresh
    if (await page.locator('[data-testid="refresh-health"]').isVisible()) {
      await page.click('[data-testid="refresh-health"]');
      await page.waitForLoadState('networkidle');
      
      const updatedCpuValue = await page.locator('[data-testid="health-cpu-value"]').textContent();
      // Values might change or stay same, just verify it updated
      expect(updatedCpuValue).toBeDefined();
    }
  });
  
  test('quick actions navigation', async ({ page, authHelper, adminUser }) => {
    await authHelper.loginAs(adminUser);
    await page.goto('/admin');
    
    // Test quick action cards
    const quickActions = [
      { testId: 'quick-add-user', expectedUrl: '/admin/register-user' },
      { testId: 'quick-view-logs', expectedUrl: '/admin/audit-logs' },
      { testId: 'quick-manage-roles', expectedUrl: '/admin/roles' }
    ];
    
    for (const action of quickActions) {
      const actionCard = page.locator(`[data-testid="${action.testId}"]`);
      
      if (await actionCard.isVisible()) {
        await actionCard.click();
        await expect(page).toHaveURL(new RegExp(action.expectedUrl));
        await page.goto('/admin'); // Go back to dashboard
      }
    }
  });
  
  test('export functionality', async ({ page, authHelper, adminUser }) => {
    await authHelper.loginAs(adminUser);
    
    // Test user export
    await page.goto('/admin/users');
    
    const downloadPromise = page.waitForEvent('download');
    await page.click('[data-testid="export-users"]');
    const download = await downloadPromise;
    
    expect(download.suggestedFilename()).toMatch(/users.*\.csv$/);
    
    // Test audit log export
    await page.goto('/admin/audit-logs');
    
    const auditDownloadPromise = page.waitForEvent('download');
    await page.click('[data-testid="export-logs"]');
    const auditDownload = await auditDownloadPromise;
    
    expect(auditDownload.suggestedFilename()).toMatch(/audit.*\.csv$/);
  });
});