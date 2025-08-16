import { test, expect } from '../../fixtures/auth.fixture';

test.describe('RBAC Permissions', () => {
  test('user can only access own profile', async ({ page, authHelper, regularUser }) => {
    await authHelper.loginAs(regularUser);
    
    // Can access own profile
    await page.goto(`/users/${regularUser.id}`);
    await expect(page.locator('h1')).toContainText(regularUser.username);
    
    // Cannot access other user's profile
    const otherUserId = 'other-user-id-123';
    await page.goto(`/users/${otherUserId}`);
    await expect(page.locator('text=Access Denied')).toBeVisible();
    
    // Cannot access admin dashboard
    await page.goto('/admin');
    await expect(page).toHaveURL('/dashboard'); // Redirected
    
    // Admin menu should not be visible
    await expect(page.locator('[data-testid="admin-menu"]')).not.toBeVisible();
  });
  
  test('admin can manage users but not other admins', async ({ page, authHelper, adminUser }) => {
    await authHelper.loginAs(adminUser);
    
    // Can access admin dashboard
    await page.goto('/admin');
    await expect(page).toHaveURL('/admin');
    
    // Can view users list
    await page.click('[data-testid="users-menu"]');
    await expect(page.locator('[data-testid="users-table"]')).toBeVisible();
    
    // Can create regular user
    await page.click('[data-testid="add-user"]');
    await page.fill('[data-testid="username"]', 'newuser');
    await page.fill('[data-testid="email"]', 'new@example.com');
    await page.selectOption('[data-testid="role"]', 'user');
    await page.click('[data-testid="create-user"]');
    await expect(page.locator('text=User created successfully')).toBeVisible();
    
    // Cannot create admin role
    await page.click('[data-testid="add-user"]');
    const roleOptions = await page.locator('[data-testid="role"] option').allTextContents();
    expect(roleOptions).not.toContain('admin');
    expect(roleOptions).not.toContain('site_admin');
    
    // Cannot delete another admin
    await page.goto('/admin/users');
    const adminRow = await page.locator('[data-testid="user-row"][data-role="admin"]').first();
    
    if (await adminRow.count() > 0) {
      const deleteButton = adminRow.locator('[data-testid="delete-user"]');
      
      // Delete button should be disabled or show error
      if (await deleteButton.isEnabled()) {
        await deleteButton.click();
        await expect(page.locator('text=Cannot delete admin users')).toBeVisible();
      } else {
        await expect(deleteButton).toBeDisabled();
      }
    }
  });
  
  test('site admin has full access', async ({ page, authHelper, siteAdminUser }) => {
    await authHelper.loginAs(siteAdminUser);
    
    // Can access all admin areas
    await page.goto('/admin');
    await expect(page.locator('[data-testid="site-admin-badge"]')).toBeVisible();
    
    // Can create admin users
    await page.click('[data-testid="add-user"]');
    await page.fill('[data-testid="username"]', 'newadmin');
    await page.fill('[data-testid="email"]', 'newadmin@example.com');
    
    // Admin role should be available
    const roleOptions = await page.locator('[data-testid="role"] option').allTextContents();
    expect(roleOptions).toContain('admin');
    
    await page.selectOption('[data-testid="role"]', 'admin');
    await page.click('[data-testid="create-user"]');
    await expect(page.locator('text=User created successfully')).toBeVisible();
    
    // Can access system configuration
    await page.click('[data-testid="system-config-menu"]');
    await expect(page.locator('[data-testid="config-editor"]')).toBeVisible();
    
    // Can override user deletion
    await page.goto('/admin/deletion-queue');
    const pendingDeletion = page.locator('[data-testid="deletion-pending"]').first();
    
    if (await pendingDeletion.count() > 0) {
      await expect(pendingDeletion.locator('[data-testid="override-deletion"]')).toBeVisible();
      await expect(pendingDeletion.locator('[data-testid="override-deletion"]')).toBeEnabled();
    }
  });
  
  test('role escalation prevention', async ({ page, authHelper, adminUser }) => {
    await authHelper.loginAs(adminUser);
    await page.goto('/admin/users');
    
    // Find a regular user
    const userRow = await page.locator('[data-testid="user-row"][data-role="user"]').first();
    
    if (await userRow.count() > 0) {
      await userRow.locator('[data-testid="edit-user"]').click();
      
      // Try to escalate to site_admin via API manipulation
      await page.route('**/api/v2/admin/users/*', async (route) => {
        const request = route.request();
        if (request.method() === 'PUT') {
          const postData = request.postDataJSON();
          // Try to inject site_admin role
          postData.roles = ['site_admin'];
          await route.continue({ postData: JSON.stringify(postData) });
        } else {
          await route.continue();
        }
      });
      
      await page.selectOption('[data-testid="role"]', 'user');
      await page.click('[data-testid="save-user"]');
      
      // Should show permission error
      await expect(page.locator('text=Insufficient permissions')).toBeVisible();
    }
  });
  
  test('API endpoint protection', async ({ page, authHelper, regularUser }) => {
    await authHelper.loginAs(regularUser);
    const token = await authHelper.getStoredToken();
    
    // Try to access admin API directly
    const response = await page.evaluate(async (authToken) => {
      const res = await fetch('/api/v2/admin/users', {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      return {
        status: res.status,
        ok: res.ok
      };
    }, token);
    
    expect(response.status).toBe(403);
    expect(response.ok).toBe(false);
  });
  
  test('UI element visibility based on role', async ({ page, authHelper, regularUser, adminUser, siteAdminUser }) => {
    // Test as regular user
    await authHelper.loginAs(regularUser);
    await expect(page.locator('[data-testid="admin-dashboard-link"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="user-management-link"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="system-settings-link"]')).not.toBeVisible();
    
    // Test as admin
    await authHelper.logout();
    await authHelper.loginAs(adminUser);
    await expect(page.locator('[data-testid="admin-dashboard-link"]')).toBeVisible();
    await expect(page.locator('[data-testid="user-management-link"]')).toBeVisible();
    await expect(page.locator('[data-testid="system-settings-link"]')).not.toBeVisible();
    
    // Test as site admin
    await authHelper.logout();
    await authHelper.loginAs(siteAdminUser);
    await expect(page.locator('[data-testid="admin-dashboard-link"]')).toBeVisible();
    await expect(page.locator('[data-testid="user-management-link"]')).toBeVisible();
    await expect(page.locator('[data-testid="system-settings-link"]')).toBeVisible();
  });
});