---
name: Testing
about: Comprehensive end-to-end testing suite
title: 'test: [E2E] Create comprehensive end-to-end testing suite'
labels: testing, e2e, quality, priority:critical
assignees: ''

---

## 📋 Description
Implement comprehensive end-to-end testing that validates complete user journeys through the application, including authentication flows, RBAC enforcement, admin operations, and security scenarios. Tests should run in real browser environments and validate both functionality and security.

## 🎯 Acceptance Criteria
- [ ] Complete authentication flow tests (login, logout, password reset)
- [ ] User registration and onboarding flow
- [ ] Password lifecycle (retrieval, change, expiry)
- [ ] RBAC permission validation across UI
- [ ] Admin dashboard functionality tests
- [ ] User deletion with cooling-off period
- [ ] Audit logging verification
- [ ] Security vulnerability tests
- [ ] Performance benchmarks
- [ ] Cross-browser compatibility
- [ ] Mobile responsive testing
- [ ] Accessibility compliance validation

## 🧪 E2E Test Implementation

### Test Setup and Configuration
```typescript
// e2e/playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html'],
    ['junit', { outputFile: 'test-results/junit.xml' }],
    ['json', { outputFile: 'test-results/results.json' }]
  ],
  
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    
    // Authentication state
    storageState: 'auth.json'
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
  ],

  webServer: {
    command: 'npm run start:test',
    port: 3000,
    reuseExistingServer: !process.env.CI,
  },
});

// e2e/fixtures/auth.fixture.ts
import { test as base } from '@playwright/test';
import { AuthHelper } from '../helpers/auth.helper';
import { UserFactory } from '../factories/user.factory';

type AuthFixtures = {
  authHelper: AuthHelper;
  regularUser: User;
  adminUser: User;
  siteAdminUser: User;
};

export const test = base.extend<AuthFixtures>({
  authHelper: async ({ page }, use) => {
    const helper = new AuthHelper(page);
    await use(helper);
  },
  
  regularUser: async ({ page }, use) => {
    const user = await UserFactory.createUser('user');
    await use(user);
    await UserFactory.cleanup(user);
  },
  
  adminUser: async ({ page }, use) => {
    const user = await UserFactory.createUser('admin');
    await use(user);
    await UserFactory.cleanup(user);
  },
  
  siteAdminUser: async ({ page }, use) => {
    const user = await UserFactory.createUser('site_admin');
    await use(user);
    await UserFactory.cleanup(user);
  },
});
```

### Authentication Flow Tests
```typescript
// e2e/tests/auth/login.spec.ts
import { test, expect } from '../../fixtures/auth.fixture';

test.describe('Authentication Flow', () => {
  test('successful login with client-side hashing', async ({ page, regularUser }) => {
    await page.goto('/login');
    
    // Fill login form
    await page.fill('[data-testid="username"]', regularUser.username);
    await page.fill('[data-testid="password"]', regularUser.temporaryPassword);
    
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
    await authHelper.login(newUser.username, newUser.temporaryPassword);
    
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
    const mfaToken = authHelper.generateTOTP(adminUser.mfaSecret);
    await page.fill('[data-testid="mfa-token"]', mfaToken);
    await page.click('[data-testid="verify-mfa"]');
    
    // Should complete login
    await page.waitForURL('/dashboard');
    expect(page.url()).toContain('/dashboard');
  });
  
  test('automatic token refresh', async ({ page, authHelper, regularUser }) => {
    await authHelper.loginAs(regularUser);
    
    // Get initial token
    const initialToken = await page.evaluate(() => sessionStorage.getItem('access_token'));
    
    // Wait for token to be close to expiry (14 minutes)
    await page.evaluate(() => {
      // Fast-forward time
      const originalSetTimeout = window.setTimeout;
      window.setTimeout = (fn, delay) => originalSetTimeout(fn, 100);
    });
    
    // Wait for refresh to occur
    await page.waitForTimeout(1000);
    
    // Verify token was refreshed
    const refreshedToken = await page.evaluate(() => sessionStorage.getItem('access_token'));
    expect(refreshedToken).not.toBe(initialToken);
    
    // Verify user remains logged in
    await page.reload();
    await expect(page).toHaveURL('/dashboard');
  });
});

test.describe('Password Management', () => {
  test('password retrieval flow for new user', async ({ page }) => {
    const retrievalToken = 'test-retrieval-token-12345';
    const username = 'newuser';
    
    await page.goto(`/auth/retrieve-password?token=${retrievalToken}&username=${username}`);
    
    // Wait for password retrieval
    await page.waitForSelector('[data-testid="temporary-password"]');
    
    const tempPassword = await page.inputValue('[data-testid="temporary-password"]');
    expect(tempPassword).toMatch(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{16,}$/);
    
    // Verify copy button works
    await page.click('[data-testid="copy-password"]');
    const clipboard = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboard).toBe(tempPassword);
    
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
    
    // Try with non-existent email - should show same message
    await page.fill('[data-testid="email"]', 'nonexistent@example.com');
    await page.click('[data-testid="request-reset"]');
    await expect(page.locator('text=If the email exists, a reset link has been sent')).toBeVisible();
  });
});
```

### RBAC Permission Tests
```typescript
// e2e/tests/rbac/permissions.spec.ts
import { test, expect } from '../../fixtures/auth.fixture';

test.describe('RBAC Permissions', () => {
  test('user can only access own profile', async ({ page, authHelper, regularUser }) => {
    await authHelper.loginAs(regularUser);
    
    // Can access own profile
    await page.goto(`/users/${regularUser.id}`);
    await expect(page.locator('h1')).toContainText(regularUser.username);
    
    // Cannot access other user's profile
    const otherUserId = 'other-user-id';
    await page.goto(`/users/${otherUserId}`);
    await expect(page.locator('text=Access Denied')).toBeVisible();
    
    // Cannot access admin dashboard
    await page.goto('/admin');
    await expect(page).toHaveURL('/dashboard'); // Redirected
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
    
    // Cannot create admin
    await page.click('[data-testid="add-user"]');
    await expect(page.locator('[data-testid="role"] option[value="admin"]')).not.toBeVisible();
    
    // Cannot delete another admin
    const otherAdmin = await page.locator(`[data-testid="user-row"][data-role="admin"]`).first();
    await otherAdmin.locator('[data-testid="delete-user"]').click();
    await expect(page.locator('text=Cannot delete admin users')).toBeVisible();
  });
  
  test('site admin has full access', async ({ page, authHelper, siteAdminUser }) => {
    await authHelper.loginAs(siteAdminUser);
    
    // Can access all areas
    await page.goto('/admin');
    await expect(page.locator('[data-testid="site-admin-badge"]')).toBeVisible();
    
    // Can create admin
    await page.click('[data-testid="add-user"]');
    await page.selectOption('[data-testid="role"]', 'admin');
    await expect(page.locator('[data-testid="role"] option[value="admin"]')).toBeVisible();
    
    // Can access system configuration
    await page.click('[data-testid="system-config-menu"]');
    await expect(page.locator('[data-testid="config-editor"]')).toBeVisible();
    
    // Can override user deletion
    await page.goto('/admin/deletion-queue');
    const pendingDeletion = page.locator('[data-testid="deletion-pending"]').first();
    await expect(pendingDeletion.locator('[data-testid="override-deletion"]')).toBeVisible();
  });
});
```

### User Deletion with Cooling-Off Tests
```typescript
// e2e/tests/deletion/cooling-off.spec.ts
import { test, expect } from '../../fixtures/auth.fixture';

test.describe('User Deletion with Cooling-Off', () => {
  test('complete deletion flow with cooling-off period', async ({ page, authHelper, regularUser }) => {
    await authHelper.loginAs(regularUser);
    
    // Navigate to account settings
    await page.goto('/settings/account');
    await page.click('[data-testid="delete-account-button"]');
    
    // Confirm deletion dialog
    await expect(page.locator('[data-testid="deletion-warning"]')).toContainText('7 days');
    await page.fill('[data-testid="confirm-delete"]', 'DELETE');
    await page.fill('[data-testid="deletion-reason"]', 'Testing deletion');
    await page.click('[data-testid="confirm-deletion"]');
    
    // Verify scheduled deletion
    await expect(page.locator('[data-testid="deletion-scheduled"]')).toBeVisible();
    const cancellationToken = await page.getAttribute('[data-testid="cancellation-token"]', 'data-token');
    expect(cancellationToken).toBeTruthy();
    
    // Verify countdown timer
    await expect(page.locator('[data-testid="deletion-countdown"]')).toContainText('6 days');
    
    // Test cancellation
    await page.click('[data-testid="cancel-deletion"]');
    await expect(page.locator('text=Deletion cancelled successfully')).toBeVisible();
    
    // Verify account is active again
    await page.reload();
    await expect(page.locator('[data-testid="deletion-scheduled"]')).not.toBeVisible();
  });
  
  test('site admin can override cooling-off period', async ({ page, authHelper, siteAdminUser }) => {
    // Create user scheduled for deletion
    const userToDelete = await UserFactory.createUserWithDeletionScheduled();
    
    await authHelper.loginAs(siteAdminUser);
    await page.goto('/admin/deletion-queue');
    
    // Find user in deletion queue
    const userRow = page.locator(`[data-testid="deletion-row"][data-user="${userToDelete.id}"]`);
    await expect(userRow).toBeVisible();
    
    // Override cooling-off
    await userRow.locator('[data-testid="override-deletion"]').click();
    
    // Confirm override
    await expect(page.locator('[data-testid="override-warning"]')).toContainText('immediately');
    await page.fill('[data-testid="confirm-override"]', 'DELETE');
    await page.click('[data-testid="confirm-override-button"]');
    
    // Verify immediate deletion
    await expect(page.locator('text=User deleted immediately')).toBeVisible();
    
    // Verify user no longer exists
    await page.goto(`/admin/users/${userToDelete.id}`);
    await expect(page.locator('text=User not found')).toBeVisible();
  });
  
  test('deletion reminders are sent on schedule', async ({ page, authHelper }) => {
    const user = await UserFactory.createUserWithDeletionScheduled({
      daysAgo: 1 // Scheduled 1 day ago
    });
    
    // Check email mock for day 1 reminder
    const emails = await getEmailsForUser(user.email);
    expect(emails).toContainEqual(
      expect.objectContaining({
        subject: 'Account deletion reminder - 6 days remaining',
        type: 'deletion_reminder_day_1'
      })
    );
    
    // Fast-forward to day 3
    await advanceTime(2 * 24 * 60 * 60 * 1000);
    await triggerScheduledJobs();
    
    const emails3 = await getEmailsForUser(user.email);
    expect(emails3).toContainEqual(
      expect.objectContaining({
        subject: 'Account deletion reminder - 4 days remaining',
        type: 'deletion_reminder_day_3'
      })
    );
    
    // Fast-forward to day 6
    await advanceTime(3 * 24 * 60 * 60 * 1000);
    await triggerScheduledJobs();
    
    const emails6 = await getEmailsForUser(user.email);
    expect(emails6).toContainEqual(
      expect.objectContaining({
        subject: 'FINAL WARNING - Account deletion in 24 hours',
        type: 'deletion_final_warning'
      })
    );
  });
});
```

### Admin Dashboard Tests
```typescript
// e2e/tests/admin/dashboard.spec.ts
import { test, expect } from '../../fixtures/auth.fixture';

test.describe('Admin Dashboard', () => {
  test('displays real-time metrics', async ({ page, authHelper, adminUser }) => {
    await authHelper.loginAs(adminUser);
    await page.goto('/admin');
    
    // Verify metrics cards
    await expect(page.locator('[data-testid="metric-total-users"]')).toBeVisible();
    await expect(page.locator('[data-testid="metric-active-sessions"]')).toBeVisible();
    await expect(page.locator('[data-testid="metric-failed-logins"]')).toBeVisible();
    
    // Test real-time updates
    const initialSessions = await page.locator('[data-testid="metric-active-sessions"]').textContent();
    
    // Create new session in another browser
    const context2 = await browser.newContext();
    const page2 = await context2.newPage();
    await authHelper.loginAs(regularUser, page2);
    
    // Wait for real-time update
    await page.waitForFunction(
      (initial) => {
        const current = document.querySelector('[data-testid="metric-active-sessions"]')?.textContent;
        return current !== initial;
      },
      initialSessions,
      { timeout: 5000 }
    );
    
    const updatedSessions = await page.locator('[data-testid="metric-active-sessions"]').textContent();
    expect(parseInt(updatedSessions)).toBeGreaterThan(parseInt(initialSessions));
  });
  
  test('audit log viewer with filtering', async ({ page, authHelper, adminUser }) => {
    await authHelper.loginAs(adminUser);
    await page.goto('/admin/audit-logs');
    
    // Verify logs are visible
    await expect(page.locator('[data-testid="audit-log-entry"]').first()).toBeVisible();
    
    // Test severity filter
    await page.selectOption('[data-testid="severity-filter"]', 'error');
    await page.waitForLoadState('networkidle');
    
    const errorLogs = await page.locator('[data-testid="audit-log-entry"][data-severity="error"]').count();
    const totalLogs = await page.locator('[data-testid="audit-log-entry"]').count();
    expect(errorLogs).toBe(totalLogs);
    
    // Test date range filter
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    await page.fill('[data-testid="date-from"]', yesterday.toISOString().split('T')[0]);
    await page.fill('[data-testid="date-to"]', new Date().toISOString().split('T')[0]);
    await page.click('[data-testid="apply-filters"]');
    
    // Verify filtered results
    await expect(page.locator('[data-testid="audit-log-entry"]').first()).toBeVisible();
    
    // Test search
    await page.fill('[data-testid="audit-search"]', 'login');
    await page.waitForTimeout(500); // Debounce
    
    const searchResults = await page.locator('[data-testid="audit-log-entry"]').allTextContents();
    searchResults.forEach(text => {
      expect(text.toLowerCase()).toContain('login');
    });
    
    // Test log expansion
    const firstLog = page.locator('[data-testid="audit-log-entry"]').first();
    await firstLog.click();
    await expect(firstLog.locator('[data-testid="log-details"]')).toBeVisible();
    await expect(firstLog.locator('[data-testid="event-hash"]')).toBeVisible();
  });
  
  test('batch user operations', async ({ page, authHelper, adminUser }) => {
    await authHelper.loginAs(adminUser);
    await page.goto('/admin/users');
    
    // Select multiple users
    await page.check('[data-testid="select-all-users"]');
    const selectedCount = await page.locator('[data-testid="selected-count"]').textContent();
    expect(parseInt(selectedCount)).toBeGreaterThan(0);
    
    // Perform batch deactivation
    await page.click('[data-testid="batch-actions"]');
    await page.click('[data-testid="batch-deactivate"]');
    
    // Confirm action
    await expect(page.locator('[data-testid="batch-confirm-dialog"]')).toBeVisible();
    await page.click('[data-testid="confirm-batch-action"]');
    
    // Wait for completion
    await expect(page.locator('text=Successfully deactivated')).toBeVisible();
    
    // Verify users are deactivated
    await page.reload();
    const deactivatedUsers = await page.locator('[data-testid="user-status"][data-status="inactive"]').count();
    expect(deactivatedUsers).toBeGreaterThan(0);
  });
});
```

### Security Tests
```typescript
// e2e/tests/security/vulnerabilities.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Security Vulnerabilities', () => {
  test('prevents XSS attacks', async ({ page }) => {
    const xssPayloads = [
      '<script>alert("XSS")</script>',
      '<img src=x onerror=alert("XSS")>',
      'javascript:alert("XSS")',
      '<svg onload=alert("XSS")>'
    ];
    
    for (const payload of xssPayloads) {
      await page.goto('/login');
      await page.fill('[data-testid="username"]', payload);
      await page.fill('[data-testid="password"]', 'password');
      await page.click('[data-testid="login-button"]');
      
      // Verify no alert dialog appeared
      await expect(page.locator('.alert-dialog')).not.toBeVisible();
      
      // Verify payload is escaped in error message
      const errorText = await page.locator('[data-testid="error-message"]').textContent();
      expect(errorText).not.toContain('<script>');
      expect(errorText).not.toContain('onerror=');
    }
  });
  
  test('prevents SQL injection', async ({ page }) => {
    const sqlPayloads = [
      "admin' OR '1'='1",
      "'; DROP TABLE users; --",
      "admin'--",
      "' UNION SELECT * FROM users --"
    ];
    
    for (const payload of sqlPayloads) {
      await page.goto('/login');
      await page.fill('[data-testid="username"]', payload);
      await page.fill('[data-testid="password"]', 'password');
      await page.click('[data-testid="login-button"]');
      
      // Should show normal login failure, not SQL error
      await expect(page.locator('text=Invalid credentials')).toBeVisible();
      await expect(page.locator('text=SQL')).not.toBeVisible();
      await expect(page.locator('text=database')).not.toBeVisible();
    }
  });
  
  test('enforces rate limiting', async ({ page }) => {
    // Attempt multiple rapid logins
    for (let i = 0; i < 11; i++) {
      await page.goto('/login');
      await page.fill('[data-testid="username"]', 'testuser');
      await page.fill('[data-testid="password"]', `wrong${i}`);
      await page.click('[data-testid="login-button"]');
    }
    
    // Should be rate limited after 10 attempts
    await expect(page.locator('text=Too many attempts')).toBeVisible();
    
    // Verify retry-after header
    const response = await page.waitForResponse(resp => 
      resp.url().includes('/api/v2/auth/login') && 
      resp.status() === 429
    );
    expect(response.headers()['retry-after']).toBeDefined();
  });
  
  test('validates CORS policy', async ({ page }) => {
    // Try to make cross-origin request
    const response = await page.evaluate(async () => {
      try {
        const res = await fetch('http://evil.com/api/v2/auth/login', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            username: 'admin',
            password_hash: 'hash'
          })
        });
        return { success: true, status: res.status };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });
    
    expect(response.success).toBe(false);
    expect(response.error).toContain('CORS');
  });
});
```

### Accessibility Tests
```typescript
// e2e/tests/accessibility/wcag.spec.ts
import { test, expect } from '@playwright/test';
import { injectAxe, checkA11y } from 'axe-playwright';

test.describe('WCAG 2.1 AA Compliance', () => {
  test('login page accessibility', async ({ page }) => {
    await page.goto('/login');
    await injectAxe(page);
    
    const violations = await checkA11y(page, null, {
      detailedReport: true,
      detailedReportOptions: {
        html: true
      }
    });
    
    expect(violations).toHaveLength(0);
  });
  
  test('keyboard navigation', async ({ page }) => {
    await page.goto('/login');
    
    // Tab through form elements
    await page.keyboard.press('Tab');
    await expect(page.locator('[data-testid="username"]')).toBeFocused();
    
    await page.keyboard.press('Tab');
    await expect(page.locator('[data-testid="password"]')).toBeFocused();
    
    await page.keyboard.press('Tab');
    await expect(page.locator('[data-testid="login-button"]')).toBeFocused();
    
    // Submit with Enter
    await page.keyboard.type('testuser');
    await page.keyboard.press('Tab');
    await page.keyboard.type('password');
    await page.keyboard.press('Enter');
    
    // Verify form submitted
    await expect(page).toHaveURL('/dashboard');
  });
  
  test('screen reader compatibility', async ({ page }) => {
    await page.goto('/login');
    
    // Check ARIA labels
    await expect(page.locator('[data-testid="username"]')).toHaveAttribute('aria-label');
    await expect(page.locator('[data-testid="password"]')).toHaveAttribute('aria-label');
    
    // Check form structure
    await expect(page.locator('form')).toHaveAttribute('role', 'form');
    
    // Check error announcements
    await page.fill('[data-testid="username"]', '');
    await page.click('[data-testid="login-button"]');
    
    const errorMessage = page.locator('[role="alert"]');
    await expect(errorMessage).toBeVisible();
    await expect(errorMessage).toHaveAttribute('aria-live', 'polite');
  });
});
```

### Performance Tests
```typescript
// e2e/tests/performance/benchmarks.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Performance Benchmarks', () => {
  test('page load performance', async ({ page }) => {
    const metrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      return {
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
        firstPaint: performance.getEntriesByName('first-paint')[0]?.startTime,
        firstContentfulPaint: performance.getEntriesByName('first-contentful-paint')[0]?.startTime
      };
    });
    
    expect(metrics.domContentLoaded).toBeLessThan(1000); // < 1 second
    expect(metrics.loadComplete).toBeLessThan(2000); // < 2 seconds
    expect(metrics.firstContentfulPaint).toBeLessThan(1500); // < 1.5 seconds
  });
  
  test('API response times', async ({ page }) => {
    await page.goto('/login');
    
    const startTime = Date.now();
    await page.fill('[data-testid="username"]', 'testuser');
    await page.fill('[data-testid="password"]', 'password');
    
    const responsePromise = page.waitForResponse(resp => 
      resp.url().includes('/api/v2/auth/login')
    );
    
    await page.click('[data-testid="login-button"]');
    const response = await responsePromise;
    const endTime = Date.now();
    
    const responseTime = endTime - startTime;
    expect(responseTime).toBeLessThan(500); // < 500ms
    
    // Check server processing time from headers
    const serverTiming = response.headers()['server-timing'];
    if (serverTiming) {
      const match = serverTiming.match(/dur=(\d+)/);
      if (match) {
        expect(parseInt(match[1])).toBeLessThan(200); // < 200ms server processing
      }
    }
  });
  
  test('handles large datasets efficiently', async ({ page, authHelper, adminUser }) => {
    await authHelper.loginAs(adminUser);
    await page.goto('/admin/users');
    
    // Measure initial render with 1000+ users
    const startTime = Date.now();
    await page.waitForSelector('[data-testid="users-table"]');
    const renderTime = Date.now() - startTime;
    
    expect(renderTime).toBeLessThan(2000); // < 2 seconds
    
    // Test virtual scrolling
    const visibleRows = await page.locator('[data-testid="user-row"]:visible').count();
    expect(visibleRows).toBeLessThan(50); // Should use virtual scrolling
    
    // Scroll and measure render performance
    await page.evaluate(() => {
      document.querySelector('[data-testid="users-table"]')?.scrollTo(0, 10000);
    });
    
    await page.waitForTimeout(100);
    const newVisibleRows = await page.locator('[data-testid="user-row"]:visible').count();
    expect(newVisibleRows).toBeLessThan(50); // Still using virtual scrolling
  });
});
```

## 📊 Test Coverage Requirements
- Browser coverage: Chrome, Firefox, Safari, Edge
- Device coverage: Desktop, Tablet, Mobile
- OS coverage: Windows, macOS, Linux
- Accessibility: WCAG 2.1 AA compliance
- Performance: Core Web Vitals passing

## 🔗 Dependencies
- Depends on: All previous issues (All previous issues (#8-#19))
- Blocks: Production deployment

## 📈 Success Metrics
- All E2E tests passing: 100%
- Cross-browser compatibility: 100%
- Mobile responsive: 100%
- WCAG 2.1 AA compliance: 100%
- Performance benchmarks met
- Zero critical security vulnerabilities

---

**Estimated Effort**: 13 story points
**Sprint**: 4 (Frontend Implementation)
**Target Completion**: Week 8
**Critical for**: Production release