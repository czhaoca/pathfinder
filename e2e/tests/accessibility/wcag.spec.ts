import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('WCAG 2.1 AA Compliance', () => {
  test('login page accessibility', async ({ page }) => {
    await page.goto('/login');
    
    // Run axe accessibility scan
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    
    // Log violations for debugging
    if (accessibilityScanResults.violations.length > 0) {
      console.log('Accessibility violations:', JSON.stringify(accessibilityScanResults.violations, null, 2));
    }
    
    // Assert no violations
    expect(accessibilityScanResults.violations).toEqual([]);
  });
  
  test('keyboard navigation', async ({ page }) => {
    await page.goto('/login');
    
    // Start from document body
    await page.keyboard.press('Tab');
    
    // First tab should focus on skip link if present
    const skipLink = page.locator('[data-testid="skip-to-content"]');
    if (await skipLink.count() > 0) {
      await expect(skipLink).toBeFocused();
      await page.keyboard.press('Tab');
    }
    
    // Tab through form elements
    await expect(page.locator('[data-testid="username"]')).toBeFocused();
    
    await page.keyboard.press('Tab');
    await expect(page.locator('[data-testid="password"]')).toBeFocused();
    
    await page.keyboard.press('Tab');
    const rememberMe = page.locator('[data-testid="remember-me"]');
    if (await rememberMe.isVisible()) {
      await expect(rememberMe).toBeFocused();
      await page.keyboard.press('Tab');
    }
    
    await expect(page.locator('[data-testid="login-button"]')).toBeFocused();
    
    // Test reverse tab navigation
    await page.keyboard.press('Shift+Tab');
    if (await rememberMe.isVisible()) {
      await expect(rememberMe).toBeFocused();
      await page.keyboard.press('Shift+Tab');
    }
    await expect(page.locator('[data-testid="password"]')).toBeFocused();
    
    // Test form submission with Enter key
    await page.keyboard.type('testuser');
    await page.keyboard.press('Tab');
    await page.keyboard.type('password');
    await page.keyboard.press('Enter');
    
    // Should attempt to submit
    await expect(page.locator('[data-testid="error-message"], [data-testid="dashboard"]')).toBeVisible({ timeout: 5000 });
  });
  
  test('screen reader compatibility', async ({ page }) => {
    await page.goto('/login');
    
    // Check ARIA labels
    const usernameInput = page.locator('[data-testid="username"]');
    await expect(usernameInput).toHaveAttribute('aria-label', /username|user/i);
    
    const passwordInput = page.locator('[data-testid="password"]');
    await expect(passwordInput).toHaveAttribute('aria-label', /password/i);
    
    // Check form landmark
    const form = page.locator('form');
    await expect(form).toHaveAttribute('role', 'form');
    
    // Check heading hierarchy
    const h1 = await page.locator('h1').count();
    expect(h1).toBe(1); // Should have exactly one h1
    
    // Check that h2 comes after h1, h3 after h2, etc.
    const headings = await page.locator('h1, h2, h3, h4, h5, h6').allTextContents();
    let lastLevel = 0;
    for (const heading of headings) {
      const element = await page.locator(`h1:has-text("${heading}"), h2:has-text("${heading}"), h3:has-text("${heading}"), h4:has-text("${heading}"), h5:has-text("${heading}"), h6:has-text("${heading}")`).first();
      const tagName = await element.evaluate(el => el.tagName);
      const level = parseInt(tagName.substring(1));
      
      // Heading levels shouldn't skip (e.g., h1 to h3)
      expect(level).toBeLessThanOrEqual(lastLevel + 1);
      lastLevel = level;
    }
    
    // Check error announcements
    await page.fill('[data-testid="username"]', '');
    await page.click('[data-testid="login-button"]');
    
    const errorMessage = page.locator('[data-testid="error-message"]');
    if (await errorMessage.isVisible()) {
      await expect(errorMessage).toHaveAttribute('role', 'alert');
      await expect(errorMessage).toHaveAttribute('aria-live', /polite|assertive/);
    }
  });
  
  test('focus management', async ({ page }) => {
    await page.goto('/login');
    
    // Check focus visible styles
    await page.keyboard.press('Tab');
    const focusedElement = page.locator(':focus');
    
    // Get computed styles of focused element
    const outlineStyle = await focusedElement.evaluate(el => {
      const styles = window.getComputedStyle(el);
      return {
        outlineWidth: styles.outlineWidth,
        outlineStyle: styles.outlineStyle,
        outlineColor: styles.outlineColor,
        boxShadow: styles.boxShadow
      };
    });
    
    // Should have visible focus indicator
    const hasOutline = outlineStyle.outlineWidth !== '0px' && outlineStyle.outlineStyle !== 'none';
    const hasBoxShadow = outlineStyle.boxShadow !== 'none';
    expect(hasOutline || hasBoxShadow).toBe(true);
    
    // Test focus trap in modal
    await page.goto('/dashboard');
    const modalTrigger = page.locator('[data-testid="open-modal"]');
    if (await modalTrigger.isVisible()) {
      await modalTrigger.click();
      
      // Focus should be trapped in modal
      const modal = page.locator('[role="dialog"]');
      await expect(modal).toBeVisible();
      
      // Tab through modal elements
      await page.keyboard.press('Tab');
      const focusedInModal = await page.evaluate(() => {
        const focused = document.activeElement;
        const modal = document.querySelector('[role="dialog"]');
        return modal?.contains(focused);
      });
      
      expect(focusedInModal).toBe(true);
    }
  });
  
  test('color contrast', async ({ page }) => {
    await page.goto('/login');
    
    // Use axe to check color contrast specifically
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2aa'])
      .withRules(['color-contrast'])
      .analyze();
    
    expect(accessibilityScanResults.violations).toEqual([]);
    
    // Manual check for important elements
    const button = page.locator('[data-testid="login-button"]');
    const buttonContrast = await button.evaluate(el => {
      const styles = window.getComputedStyle(el);
      const bg = styles.backgroundColor;
      const color = styles.color;
      
      // Simple contrast calculation (would need proper library in production)
      return { background: bg, text: color };
    });
    
    // Verify button has sufficient contrast (this is simplified)
    expect(buttonContrast.background).not.toBe(buttonContrast.text);
  });
  
  test('responsive text sizing', async ({ page }) => {
    await page.goto('/login');
    
    // Test zoom levels
    const zoomLevels = [1, 1.5, 2];
    
    for (const zoom of zoomLevels) {
      await page.evaluate((z) => {
        document.body.style.zoom = z.toString();
      }, zoom);
      
      // Check that text is still readable and layout isn't broken
      const isOverflowing = await page.evaluate(() => {
        const elements = document.querySelectorAll('*');
        for (const el of elements) {
          if (el.scrollWidth > el.clientWidth || el.scrollHeight > el.clientHeight) {
            return true;
          }
        }
        return false;
      });
      
      expect(isOverflowing).toBe(false);
    }
    
    // Reset zoom
    await page.evaluate(() => {
      document.body.style.zoom = '1';
    });
  });
  
  test('form validation accessibility', async ({ page }) => {
    await page.goto('/register');
    
    // Submit empty form
    await page.click('[data-testid="register-button"]');
    
    // Check that error messages are associated with inputs
    const usernameInput = page.locator('[data-testid="username"]');
    const usernameError = page.locator('[data-testid="username-error"]');
    
    if (await usernameError.isVisible()) {
      const errorId = await usernameError.getAttribute('id');
      await expect(usernameInput).toHaveAttribute('aria-describedby', errorId!);
      await expect(usernameInput).toHaveAttribute('aria-invalid', 'true');
    }
    
    // Check inline validation
    await usernameInput.fill('a'); // Too short
    await usernameInput.blur();
    
    const liveRegion = page.locator('[aria-live]');
    if (await liveRegion.isVisible()) {
      await expect(liveRegion).toContainText(/too short|minimum/i);
    }
  });
  
  test('landmarks and regions', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Check for proper landmark roles
    await expect(page.locator('header, [role="banner"]')).toBeVisible();
    await expect(page.locator('nav, [role="navigation"]')).toBeVisible();
    await expect(page.locator('main, [role="main"]')).toBeVisible();
    await expect(page.locator('footer, [role="contentinfo"]')).toBeVisible();
    
    // Check that main content has proper structure
    const main = page.locator('main, [role="main"]');
    const mainHeading = main.locator('h1, h2').first();
    await expect(mainHeading).toBeVisible();
  });
  
  test('alternative text for images', async ({ page }) => {
    await page.goto('/');
    
    // Get all images
    const images = page.locator('img');
    const imageCount = await images.count();
    
    for (let i = 0; i < imageCount; i++) {
      const img = images.nth(i);
      const alt = await img.getAttribute('alt');
      const role = await img.getAttribute('role');
      
      // Images should have alt text or be marked as decorative
      if (role !== 'presentation') {
        expect(alt).toBeTruthy();
        expect(alt).not.toBe(''); // Alt should not be empty unless decorative
      }
    }
    
    // Check for icon buttons with proper labels
    const iconButtons = page.locator('button:has(svg), button:has(i)');
    const iconButtonCount = await iconButtons.count();
    
    for (let i = 0; i < iconButtonCount; i++) {
      const button = iconButtons.nth(i);
      const ariaLabel = await button.getAttribute('aria-label');
      const text = await button.textContent();
      
      // Icon buttons should have aria-label or visible text
      expect(ariaLabel || text?.trim()).toBeTruthy();
    }
  });
  
  test('mobile accessibility', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/login');
    
    // Check touch target sizes
    const interactiveElements = page.locator('button, a, input, select, textarea');
    const elementCount = await interactiveElements.count();
    
    for (let i = 0; i < elementCount; i++) {
      const element = interactiveElements.nth(i);
      const box = await element.boundingBox();
      
      if (box) {
        // WCAG 2.1 AA requires 44x44 pixel touch targets
        expect(box.width).toBeGreaterThanOrEqual(44);
        expect(box.height).toBeGreaterThanOrEqual(44);
      }
    }
    
    // Check that viewport zooming is not disabled
    const viewportMeta = await page.locator('meta[name="viewport"]').getAttribute('content');
    if (viewportMeta) {
      expect(viewportMeta).not.toContain('user-scalable=no');
      expect(viewportMeta).not.toContain('maximum-scale=1');
    }
  });
});