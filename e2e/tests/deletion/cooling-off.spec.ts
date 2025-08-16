import { test, expect } from '../../fixtures/auth.fixture';
import { UserFactory } from '../../factories/user.factory';

test.describe('User Deletion with Cooling-Off', () => {
  test('complete deletion flow with cooling-off period', async ({ page, authHelper, regularUser }) => {
    await authHelper.loginAs(regularUser);
    
    // Navigate to account settings
    await page.goto('/settings/account');
    await page.click('[data-testid="delete-account-button"]');
    
    // Confirm deletion dialog
    await expect(page.locator('[data-testid="deletion-warning"]')).toContainText('7 days');
    await expect(page.locator('[data-testid="deletion-warning"]')).toContainText('cooling-off period');
    
    // Fill deletion form
    await page.fill('[data-testid="confirm-delete"]', 'DELETE');
    await page.fill('[data-testid="deletion-reason"]', 'Testing deletion process');
    await page.selectOption('[data-testid="deletion-category"]', 'other');
    await page.click('[data-testid="confirm-deletion"]');
    
    // Verify scheduled deletion
    await expect(page.locator('[data-testid="deletion-scheduled"]')).toBeVisible();
    await expect(page.locator('[data-testid="deletion-scheduled"]')).toContainText('scheduled for deletion');
    
    // Get cancellation token
    const cancellationToken = await page.getAttribute('[data-testid="cancellation-token"]', 'data-token');
    expect(cancellationToken).toBeTruthy();
    expect(cancellationToken).toMatch(/^[A-Za-z0-9]{32,}$/);
    
    // Verify countdown timer
    await expect(page.locator('[data-testid="deletion-countdown"]')).toBeVisible();
    await expect(page.locator('[data-testid="deletion-countdown"]')).toContainText('6 days');
    
    // Test cancellation
    await page.click('[data-testid="cancel-deletion"]');
    await expect(page.locator('[data-testid="cancel-confirmation"]')).toBeVisible();
    await page.fill('[data-testid="cancellation-token-input"]', cancellationToken!);
    await page.click('[data-testid="confirm-cancellation"]');
    
    await expect(page.locator('text=Deletion cancelled successfully')).toBeVisible();
    
    // Verify account is active again
    await page.reload();
    await expect(page.locator('[data-testid="deletion-scheduled"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="delete-account-button"]')).toBeVisible();
  });
  
  test('site admin can override cooling-off period', async ({ page, authHelper, siteAdminUser }) => {
    // Create user scheduled for deletion
    const userToDelete = await UserFactory.createUserWithDeletionScheduled();
    
    await authHelper.loginAs(siteAdminUser);
    await page.goto('/admin/deletion-queue');
    
    // Find user in deletion queue
    const userRow = page.locator(`[data-testid="deletion-row"][data-user="${userToDelete.id}"]`);
    await expect(userRow).toBeVisible();
    
    // Verify countdown is visible
    await expect(userRow.locator('[data-testid="time-remaining"]')).toBeVisible();
    
    // Override cooling-off
    await userRow.locator('[data-testid="override-deletion"]').click();
    
    // Confirm override with strong warning
    await expect(page.locator('[data-testid="override-warning"]')).toBeVisible();
    await expect(page.locator('[data-testid="override-warning"]')).toContainText('immediately');
    await expect(page.locator('[data-testid="override-warning"]')).toContainText('cannot be undone');
    
    await page.fill('[data-testid="confirm-override"]', 'DELETE');
    await page.click('[data-testid="confirm-override-button"]');
    
    // Verify immediate deletion
    await expect(page.locator('text=User deleted immediately')).toBeVisible();
    
    // Verify user no longer in queue
    await page.reload();
    await expect(page.locator(`[data-user="${userToDelete.id}"]`)).not.toBeVisible();
    
    // Verify user no longer exists
    await page.goto(`/admin/users/${userToDelete.id}`);
    await expect(page.locator('text=User not found')).toBeVisible();
  });
  
  test('deletion reminders are sent on schedule', async ({ page }) => {
    // This test simulates the reminder schedule
    const testSchedule = async (daysElapsed: number, expectedReminder: string) => {
      const user = await UserFactory.createUserWithDeletionScheduled({
        daysAgo: daysElapsed
      });
      
      // Check for expected reminder state
      await page.goto(`/admin/deletion-queue`);
      const userRow = page.locator(`[data-user="${user.id}"]`);
      
      if (daysElapsed >= 1) {
        await expect(userRow.locator('[data-testid="reminder-1-sent"]')).toBeVisible();
      }
      if (daysElapsed >= 3) {
        await expect(userRow.locator('[data-testid="reminder-3-sent"]')).toBeVisible();
      }
      if (daysElapsed >= 6) {
        await expect(userRow.locator('[data-testid="reminder-6-sent"]')).toBeVisible();
      }
      
      await UserFactory.cleanup(user);
    };
    
    // Test different reminder stages
    await testSchedule(1, 'day-1');
    await testSchedule(3, 'day-3');
    await testSchedule(6, 'day-6');
  });
  
  test('user cannot login during deletion cooling-off', async ({ page, authHelper }) => {
    const user = await UserFactory.createUser('user');
    await authHelper.loginAs(user);
    
    // Schedule deletion
    await page.goto('/settings/account');
    await page.click('[data-testid="delete-account-button"]');
    await page.fill('[data-testid="confirm-delete"]', 'DELETE');
    await page.fill('[data-testid="deletion-reason"]', 'Test');
    await page.click('[data-testid="confirm-deletion"]');
    
    // Logout
    await authHelper.logout();
    
    // Try to login again
    await page.goto('/login');
    await page.fill('[data-testid="username"]', user.username);
    await page.fill('[data-testid="password"]', user.password);
    await page.click('[data-testid="login-button"]');
    
    // Should show account scheduled for deletion message
    await expect(page.locator('[data-testid="account-deletion-notice"]')).toBeVisible();
    await expect(page.locator('[data-testid="account-deletion-notice"]')).toContainText('scheduled for deletion');
    
    // Should provide cancellation option
    await expect(page.locator('[data-testid="cancel-deletion-link"]')).toBeVisible();
    
    await UserFactory.cleanup(user);
  });
  
  test('deletion queue filtering and search', async ({ page, authHelper, siteAdminUser }) => {
    // Create multiple users with different deletion states
    const pendingUser = await UserFactory.createUserWithDeletionScheduled({ daysAgo: 1 });
    const recentUser = await UserFactory.createUserWithDeletionScheduled({ daysAgo: 0 });
    
    await authHelper.loginAs(siteAdminUser);
    await page.goto('/admin/deletion-queue');
    
    // Test status filter
    await page.selectOption('[data-testid="status-filter"]', 'pending');
    await expect(page.locator('[data-testid="deletion-row"]')).toHaveCount(2);
    
    // Test search by username
    await page.fill('[data-testid="search-input"]', pendingUser.username);
    await page.waitForTimeout(500); // Debounce
    await expect(page.locator('[data-testid="deletion-row"]')).toHaveCount(1);
    await expect(page.locator(`[data-user="${pendingUser.id}"]`)).toBeVisible();
    
    // Test date range filter
    const today = new Date().toISOString().split('T')[0];
    await page.fill('[data-testid="date-from"]', today);
    await page.fill('[data-testid="date-to"]', today);
    await page.click('[data-testid="apply-filters"]');
    
    await expect(page.locator(`[data-user="${recentUser.id}"]`)).toBeVisible();
    await expect(page.locator(`[data-user="${pendingUser.id}"]`)).not.toBeVisible();
    
    // Cleanup
    await UserFactory.cleanup(pendingUser);
    await UserFactory.cleanup(recentUser);
  });
  
  test('automatic deletion after cooling-off expires', async ({ page }) => {
    // Create user scheduled for deletion 7 days ago
    const user = await UserFactory.createUserWithDeletionScheduled({ daysAgo: 7 });
    
    // Simulate scheduled job execution
    await page.evaluate(async () => {
      await fetch('/api/v2/admin/jobs/process-deletions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.ADMIN_TOKEN}`
        }
      });
    });
    
    // Verify user has been deleted
    await page.goto(`/admin/users/${user.id}`);
    await expect(page.locator('text=User not found')).toBeVisible();
    
    // Verify deletion is logged
    await page.goto('/admin/audit-logs');
    await page.fill('[data-testid="audit-search"]', user.username);
    await page.waitForTimeout(500);
    
    const deletionLog = page.locator('[data-testid="audit-log-entry"]').filter({
      hasText: 'user_deletion_completed'
    });
    await expect(deletionLog).toBeVisible();
  });
});