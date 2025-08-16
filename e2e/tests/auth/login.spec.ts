import { test, expect } from '../../fixtures/auth.fixture';
import { UserFactory } from '../../factories/user.factory';

test.describe('Authentication Flow', () => {
  test('successful login with client-side hashing', async ({ page, regularUser }) => {
    await page.goto('/login');
    
    // Fill login form
    await page.fill('[data-testid="username"]', regularUser.username);
    await page.fill('[data-testid="password"]', regularUser.password);
    
    // Intercept network request to verify hashing
    const loginRequest = page.waitForRequest(req => 
      req.url().includes('/api/v2/auth/login') &&
      req.method() === 'POST'
    );
    
    await page.click('[data-testid="login-button"]');
    
    const request = await loginRequest;
    const postData = request.postDataJSON();
    
    // Verify password is hashed, not plain text
    expect(postData.password_hash).toBeDefined();
    expect(postData.password_hash).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hash
    expect(postData.client_salt).toBeDefined();
    expect(postData.password).toBeUndefined();
    
    // Wait for redirect to dashboard
    await page.waitForURL('/dashboard');
    expect(page.url()).toContain('/dashboard');
    
    // Verify JWT token stored
    const token = await page.evaluate(() => sessionStorage.getItem('access_token'));
    expect(token).toBeTruthy();
  });
  
  test('forces password change on first login', async ({ page, authHelper }) => {
    const newUser = await UserFactory.createUserWithTempPassword();
    
    await page.goto('/login');
    await authHelper.login(newUser.username, newUser.temporaryPassword!);
    
    // Should redirect to password change
    await page.waitForURL('/auth/change-password');
    
    // Verify warning message
    await expect(page.locator('[data-testid="password-change-required"]')).toBeVisible();
    await expect(page.locator('text=You must change your password')).toBeVisible();
    
    // Change password
    const newPassword = 'NewSecure@Password123';
    await page.fill('[data-testid="new-password"]', newPassword);
    await page.fill('[data-testid="confirm-password"]', newPassword);
    
    // Verify password strength indicator
    await expect(page.locator('[data-testid="password-strength"]')).toHaveText('Strong');
    
    await page.click('[data-testid="change-password-button"]');
    
    // Should redirect to dashboard after password change
    await page.waitForURL('/dashboard');
    
    // Verify can login with new password
    await authHelper.logout();
    await authHelper.login(newUser.username, newPassword);
    await expect(page).toHaveURL('/dashboard');
    
    // Cleanup
    await UserFactory.cleanup(newUser);
  });
  
  test('MFA flow for admin users', async ({ page, adminUser, authHelper }) => {
    // Enable MFA for admin
    await authHelper.enableMFA(adminUser);
    
    await page.goto('/login');
    await page.fill('[data-testid="username"]', adminUser.username);
    await page.fill('[data-testid="password"]', adminUser.password);
    await page.click('[data-testid="login-button"]');
    
    // Should show MFA input
    await expect(page.locator('[data-testid="mfa-input"]')).toBeVisible();
    
    // Enter MFA token
    const mfaToken = authHelper.generateTOTP(adminUser.mfaSecret!);
    await page.fill('[data-testid="mfa-token"]', mfaToken);
    await page.click('[data-testid="verify-mfa"]');
    
    // Should complete login
    await page.waitForURL('/dashboard');
    expect(page.url()).toContain('/dashboard');
  });
  
  test('automatic token refresh', async ({ page, authHelper, regularUser }) => {
    await authHelper.loginAs(regularUser);
    
    // Get initial token
    const initialToken = await authHelper.getStoredToken();
    
    // Wait for token to be close to expiry (simulate 14 minutes)
    await page.evaluate(() => {
      // Mock time progression
      const originalDate = Date.now;
      let timeOffset = 0;
      Date.now = () => originalDate() + timeOffset;
      
      // Fast-forward 14 minutes
      timeOffset = 14 * 60 * 1000;
    });
    
    // Trigger an API call to force token refresh
    await page.goto('/profile');
    await page.waitForLoadState('networkidle');
    
    // Verify token was refreshed
    const refreshedToken = await authHelper.getStoredToken();
    expect(refreshedToken).not.toBe(initialToken);
    
    // Verify user remains logged in
    await page.reload();
    await expect(page).toHaveURL('/profile');
  });
  
  test('logout clears session properly', async ({ page, authHelper, regularUser }) => {
    await authHelper.loginAs(regularUser);
    
    // Verify logged in
    await expect(page).toHaveURL('/dashboard');
    const token = await authHelper.getStoredToken();
    expect(token).toBeTruthy();
    
    // Logout
    await authHelper.logout();
    
    // Verify session cleared
    const clearedToken = await authHelper.getStoredToken();
    expect(clearedToken).toBeNull();
    
    // Verify redirected to login
    await expect(page).toHaveURL('/login');
    
    // Try to access protected route
    await page.goto('/dashboard');
    await expect(page).toHaveURL('/login');
  });
  
  test('handles invalid credentials', async ({ page }) => {
    await page.goto('/login');
    
    await page.fill('[data-testid="username"]', 'nonexistent');
    await page.fill('[data-testid="password"]', 'wrongpassword');
    await page.click('[data-testid="login-button"]');
    
    // Should show error message
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="error-message"]')).toContainText('Invalid credentials');
    
    // Should remain on login page
    await expect(page).toHaveURL('/login');
  });
});