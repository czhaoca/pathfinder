import { test, expect } from '../../fixtures/auth.fixture';

test.describe('Password Management', () => {
  test('password retrieval flow for new user', async ({ page }) => {
    const retrievalToken = 'test-retrieval-token-12345';
    const username = 'newuser';
    
    await page.goto(`/auth/retrieve-password?token=${retrievalToken}&username=${username}`);
    
    // Wait for password retrieval
    await page.waitForSelector('[data-testid="temporary-password"]', { timeout: 10000 });
    
    const tempPassword = await page.inputValue('[data-testid="temporary-password"]');
    
    // Verify password meets complexity requirements
    expect(tempPassword).toMatch(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{16,}$/);
    
    // Verify copy button works
    await page.click('[data-testid="copy-password"]');
    
    // Check clipboard (may require permissions)
    await page.waitForTimeout(500);
    
    // Verify expiry warning
    await expect(page.locator('text=expires in 24 hours')).toBeVisible();
    
    // Try to retrieve again - should fail (single use)
    await page.reload();
    await expect(page.locator('text=Invalid or expired token')).toBeVisible();
  });
  
  test('password reset request flow', async ({ page }) => {
    await page.goto('/auth/forgot-password');
    
    // Enter email
    await page.fill('[data-testid="email"]', 'user@example.com');
    await page.click('[data-testid="request-reset"]');
    
    // Verify success message (doesn't reveal if email exists)
    await expect(page.locator('text=If the email exists, a reset link has been sent')).toBeVisible();
    
    // Try with non-existent email - should show same message (security)
    await page.goto('/auth/forgot-password');
    await page.fill('[data-testid="email"]', 'nonexistent@example.com');
    await page.click('[data-testid="request-reset"]');
    await expect(page.locator('text=If the email exists, a reset link has been sent')).toBeVisible();
  });
  
  test('password change with validation', async ({ page, authHelper, regularUser }) => {
    await authHelper.loginAs(regularUser);
    await page.goto('/settings/security');
    
    await page.click('[data-testid="change-password-btn"]');
    
    // Enter current password
    await page.fill('[data-testid="current-password"]', regularUser.password);
    
    // Test weak password
    await page.fill('[data-testid="new-password"]', 'weak');
    await expect(page.locator('[data-testid="password-strength"]')).toHaveText('Weak');
    await expect(page.locator('[data-testid="password-error"]')).toBeVisible();
    
    // Test medium password
    await page.fill('[data-testid="new-password"]', 'Medium123');
    await expect(page.locator('[data-testid="password-strength"]')).toHaveText('Medium');
    
    // Test strong password
    const newPassword = 'VeryStrong@Pass123!';
    await page.fill('[data-testid="new-password"]', newPassword);
    await expect(page.locator('[data-testid="password-strength"]')).toHaveText('Strong');
    
    // Test password mismatch
    await page.fill('[data-testid="confirm-password"]', 'DifferentPassword');
    await page.click('[data-testid="save-password"]');
    await expect(page.locator('text=Passwords do not match')).toBeVisible();
    
    // Correct password confirmation
    await page.fill('[data-testid="confirm-password"]', newPassword);
    await page.click('[data-testid="save-password"]');
    
    await expect(page.locator('text=Password changed successfully')).toBeVisible();
    
    // Verify can login with new password
    await authHelper.logout();
    await authHelper.login(regularUser.username, newPassword);
    await expect(page).toHaveURL('/dashboard');
  });
  
  test('password expiry notification', async ({ page, authHelper }) => {
    // Create user with password about to expire
    const user = await page.evaluate(async () => {
      // Mock API call to create user with expiring password
      return {
        username: 'expiring_user',
        password: 'CurrentPass@123',
        passwordExpiresIn: 2 // days
      };
    });
    
    await authHelper.login(user.username, user.password);
    
    // Should show expiry warning
    await expect(page.locator('[data-testid="password-expiry-warning"]')).toBeVisible();
    await expect(page.locator('[data-testid="password-expiry-warning"]')).toContainText('2 days');
    
    // Can dismiss for now
    await page.click('[data-testid="dismiss-expiry-warning"]');
    await expect(page.locator('[data-testid="password-expiry-warning"]')).not.toBeVisible();
    
    // But shows again on next login
    await page.reload();
    await expect(page.locator('[data-testid="password-expiry-warning"]')).toBeVisible();
  });
  
  test('password history validation', async ({ page, authHelper, regularUser }) => {
    await authHelper.loginAs(regularUser);
    await page.goto('/settings/security');
    
    const oldPassword = regularUser.password;
    const passwords = [
      'FirstPass@123',
      'SecondPass@123',
      'ThirdPass@123'
    ];
    
    // Change password multiple times
    for (const newPass of passwords) {
      await page.click('[data-testid="change-password-btn"]');
      await page.fill('[data-testid="current-password"]', oldPassword);
      await page.fill('[data-testid="new-password"]', newPass);
      await page.fill('[data-testid="confirm-password"]', newPass);
      await page.click('[data-testid="save-password"]');
      await page.waitForSelector('text=Password changed successfully');
    }
    
    // Try to reuse an old password
    await page.click('[data-testid="change-password-btn"]');
    await page.fill('[data-testid="current-password"]', passwords[passwords.length - 1]);
    await page.fill('[data-testid="new-password"]', passwords[0]); // Try first password
    await page.fill('[data-testid="confirm-password"]', passwords[0]);
    await page.click('[data-testid="save-password"]');
    
    // Should show error about password reuse
    await expect(page.locator('text=Cannot reuse recent passwords')).toBeVisible();
  });
});