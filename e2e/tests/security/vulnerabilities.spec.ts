import { test, expect } from '@playwright/test';

test.describe('Security Vulnerabilities', () => {
  test('prevents XSS attacks', async ({ page }) => {
    const xssPayloads = [
      '<script>alert("XSS")</script>',
      '<img src=x onerror=alert("XSS")>',
      'javascript:alert("XSS")',
      '<svg onload=alert("XSS")>',
      '"><script>alert("XSS")</script>',
      '<iframe src="javascript:alert(\'XSS\')"></iframe>',
      '<body onload=alert("XSS")>',
      '<input onfocus=alert("XSS") autofocus>'
    ];
    
    for (const payload of xssPayloads) {
      await page.goto('/login');
      
      // Test in username field
      await page.fill('[data-testid="username"]', payload);
      await page.fill('[data-testid="password"]', 'password');
      
      // Set up dialog handler to catch any alerts
      let alertFired = false;
      page.on('dialog', async dialog => {
        alertFired = true;
        await dialog.dismiss();
      });
      
      await page.click('[data-testid="login-button"]');
      await page.waitForTimeout(1000);
      
      // Verify no alert was triggered
      expect(alertFired).toBe(false);
      
      // Verify payload is properly escaped in any error message
      const errorMessage = await page.locator('[data-testid="error-message"]');
      if (await errorMessage.isVisible()) {
        const errorText = await errorMessage.textContent();
        expect(errorText).not.toContain('<script>');
        expect(errorText).not.toContain('onerror=');
        expect(errorText).not.toContain('javascript:');
      }
      
      // Remove dialog handler
      page.removeAllListeners('dialog');
    }
  });
  
  test('prevents SQL injection', async ({ page }) => {
    const sqlPayloads = [
      "admin' OR '1'='1",
      "'; DROP TABLE users; --",
      "admin'--",
      "' UNION SELECT * FROM users --",
      "1' AND '1' = '1",
      "admin' /*",
      "' OR 1=1--",
      "admin'; DELETE FROM users WHERE '1'='1"
    ];
    
    for (const payload of sqlPayloads) {
      await page.goto('/login');
      await page.fill('[data-testid="username"]', payload);
      await page.fill('[data-testid="password"]', 'password');
      await page.click('[data-testid="login-button"]');
      
      // Should show generic login failure, not SQL error
      await expect(page.locator('text=Invalid credentials')).toBeVisible();
      
      // Should not expose database errors
      const pageContent = await page.content();
      expect(pageContent.toLowerCase()).not.toContain('sql');
      expect(pageContent.toLowerCase()).not.toContain('database');
      expect(pageContent.toLowerCase()).not.toContain('syntax error');
      expect(pageContent.toLowerCase()).not.toContain('oracle');
      expect(pageContent.toLowerCase()).not.toContain('mysql');
      expect(pageContent.toLowerCase()).not.toContain('postgres');
    }
  });
  
  test('enforces rate limiting', async ({ page }) => {
    const maxAttempts = 10;
    let rateLimited = false;
    
    // Attempt multiple rapid logins
    for (let i = 0; i < maxAttempts + 2; i++) {
      await page.goto('/login');
      await page.fill('[data-testid="username"]', 'testuser');
      await page.fill('[data-testid="password"]', `wrong${i}`);
      
      const responsePromise = page.waitForResponse(resp => 
        resp.url().includes('/api/v2/auth/login')
      );
      
      await page.click('[data-testid="login-button"]');
      const response = await responsePromise;
      
      if (response.status() === 429) {
        rateLimited = true;
        
        // Verify rate limit headers
        const headers = response.headers();
        expect(headers['x-ratelimit-limit']).toBeDefined();
        expect(headers['x-ratelimit-remaining']).toBe('0');
        expect(headers['retry-after']).toBeDefined();
        
        // Verify user-friendly error message
        await expect(page.locator('text=Too many attempts')).toBeVisible();
        break;
      }
    }
    
    expect(rateLimited).toBe(true);
  });
  
  test('validates CORS policy', async ({ page }) => {
    await page.goto('/login');
    
    // Try to make cross-origin request
    const corsTest = await page.evaluate(async () => {
      try {
        const response = await fetch('http://evil.com/api/v2/auth/login', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'Origin': 'http://evil.com'
          },
          body: JSON.stringify({
            username: 'admin',
            password_hash: 'hash'
          })
        });
        return { 
          success: true, 
          status: response.status,
          headers: Object.fromEntries(response.headers.entries())
        };
      } catch (error: any) {
        return { 
          success: false, 
          error: error.message 
        };
      }
    });
    
    // Should fail due to CORS
    expect(corsTest.success).toBe(false);
    if (corsTest.error) {
      expect(corsTest.error.toLowerCase()).toContain('cors');
    }
  });
  
  test('prevents CSRF attacks', async ({ page, context }) => {
    // Login to get valid session
    await page.goto('/login');
    await page.fill('[data-testid="username"]', 'testuser');
    await page.fill('[data-testid="password"]', 'password');
    await page.click('[data-testid="login-button"]');
    
    // Get CSRF token if present
    const csrfToken = await page.evaluate(() => {
      return document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
    });
    
    // Try to make request without CSRF token
    const response = await page.evaluate(async () => {
      const res = await fetch('/api/v2/users/delete', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ userId: 'some-id' })
      });
      return { status: res.status, ok: res.ok };
    });
    
    // Should be rejected without proper CSRF token
    if (csrfToken) {
      expect(response.status).toBe(403);
      expect(response.ok).toBe(false);
    }
  });
  
  test('secure headers are present', async ({ page }) => {
    const response = await page.goto('/');
    const headers = response?.headers() || {};
    
    // Security headers that should be present
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['x-frame-options']).toMatch(/DENY|SAMEORIGIN/);
    expect(headers['x-xss-protection']).toBe('1; mode=block');
    expect(headers['strict-transport-security']).toContain('max-age=');
    
    // Content Security Policy
    if (headers['content-security-policy']) {
      const csp = headers['content-security-policy'];
      expect(csp).toContain("default-src");
      expect(csp).not.toContain("unsafe-inline");
      expect(csp).not.toContain("unsafe-eval");
    }
  });
  
  test('prevents path traversal attacks', async ({ page }) => {
    const pathTraversalPayloads = [
      '../../../etc/passwd',
      '..\\..\\..\\windows\\system32\\config\\sam',
      '....//....//....//etc/passwd',
      '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd',
      '..;/etc/passwd'
    ];
    
    for (const payload of pathTraversalPayloads) {
      const response = await page.evaluate(async (path) => {
        const res = await fetch(`/api/v2/files/${path}`, {
          method: 'GET',
          credentials: 'include'
        });
        return { 
          status: res.status, 
          text: await res.text() 
        };
      }, payload);
      
      // Should not return system files
      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response.text.toLowerCase()).not.toContain('root:');
      expect(response.text.toLowerCase()).not.toContain('administrator:');
    }
  });
  
  test('session fixation prevention', async ({ page, context }) => {
    // Get session ID before login
    await page.goto('/login');
    const preLoginSession = await page.evaluate(() => {
      return document.cookie.match(/session_id=([^;]+)/)?.[1];
    });
    
    // Login
    await page.fill('[data-testid="username"]', 'testuser');
    await page.fill('[data-testid="password"]', 'password');
    await page.click('[data-testid="login-button"]');
    await page.waitForURL('/dashboard');
    
    // Get session ID after login
    const postLoginSession = await page.evaluate(() => {
      return document.cookie.match(/session_id=([^;]+)/)?.[1];
    });
    
    // Session ID should change after login (session fixation prevention)
    if (preLoginSession && postLoginSession) {
      expect(postLoginSession).not.toBe(preLoginSession);
    }
  });
  
  test('sensitive data not in URLs', async ({ page }) => {
    await page.goto('/login');
    
    // Login with credentials
    await page.fill('[data-testid="username"]', 'testuser');
    await page.fill('[data-testid="password"]', 'MySecretPass123');
    await page.click('[data-testid="login-button"]');
    
    // Check that sensitive data is not in URL
    const url = page.url();
    expect(url).not.toContain('password');
    expect(url).not.toContain('MySecretPass123');
    expect(url).not.toContain('token');
    expect(url).not.toContain('session');
    
    // Navigate to password reset
    await page.goto('/auth/forgot-password');
    await page.fill('[data-testid="email"]', 'user@example.com');
    await page.click('[data-testid="request-reset"]');
    
    // Reset token should not be in URL (should be in email)
    const resetUrl = page.url();
    expect(resetUrl).not.toMatch(/token=[A-Za-z0-9]+/);
  });
  
  test('secure password storage verification', async ({ page }) => {
    // Intercept registration request to verify password handling
    await page.goto('/register');
    
    let requestData: any = null;
    await page.route('**/api/v2/auth/register', async route => {
      requestData = route.request().postDataJSON();
      await route.continue();
    });
    
    await page.fill('[data-testid="username"]', 'newuser');
    await page.fill('[data-testid="email"]', 'new@example.com');
    await page.fill('[data-testid="password"]', 'SecurePass@123');
    await page.fill('[data-testid="confirm-password"]', 'SecurePass@123');
    await page.click('[data-testid="register-button"]');
    
    // Verify password is hashed before sending
    if (requestData) {
      expect(requestData.password).toBeUndefined();
      expect(requestData.password_hash).toBeDefined();
      expect(requestData.password_hash).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hash
    }
  });
});