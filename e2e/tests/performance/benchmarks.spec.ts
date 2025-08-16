import { test, expect } from '@playwright/test';
import { AuthHelper } from '../../helpers/auth.helper';

test.describe('Performance Benchmarks', () => {
  test('page load performance', async ({ page }) => {
    // Clear cache and cookies
    await page.context().clearCookies();
    
    // Start performance measurement
    await page.goto('/');
    
    // Get navigation timing metrics
    const metrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      const paintEntries = performance.getEntriesByType('paint');
      
      return {
        // Navigation metrics
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
        domInteractive: navigation.domInteractive - navigation.fetchStart,
        
        // Paint metrics
        firstPaint: paintEntries.find(e => e.name === 'first-paint')?.startTime || 0,
        firstContentfulPaint: paintEntries.find(e => e.name === 'first-contentful-paint')?.startTime || 0,
        
        // Resource metrics
        totalTransferSize: navigation.transferSize,
        totalDuration: navigation.loadEventEnd - navigation.fetchStart
      };
    });
    
    // Performance assertions
    expect(metrics.domContentLoaded).toBeLessThan(1000); // < 1 second
    expect(metrics.loadComplete).toBeLessThan(2000); // < 2 seconds
    expect(metrics.firstContentfulPaint).toBeLessThan(1500); // < 1.5 seconds
    expect(metrics.domInteractive).toBeLessThan(1000); // < 1 second
    
    console.log('Page Load Metrics:', metrics);
  });
  
  test('core web vitals', async ({ page }) => {
    await page.goto('/');
    
    // Wait for page to be fully loaded
    await page.waitForLoadState('networkidle');
    
    // Measure Core Web Vitals
    const vitals = await page.evaluate(() => {
      return new Promise((resolve) => {
        let lcp = 0;
        let fid = 0;
        let cls = 0;
        
        // Largest Contentful Paint
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1];
          lcp = lastEntry.startTime;
        }).observe({ entryTypes: ['largest-contentful-paint'] });
        
        // First Input Delay (simulated)
        window.addEventListener('click', (e) => {
          fid = performance.now() - e.timeStamp;
        }, { once: true });
        
        // Cumulative Layout Shift
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (!(entry as any).hadRecentInput) {
              cls += (entry as any).value;
            }
          }
        }).observe({ entryTypes: ['layout-shift'] });
        
        // Wait and collect metrics
        setTimeout(() => {
          resolve({ lcp, fid, cls });
        }, 3000);
      });
    });
    
    // Core Web Vitals thresholds
    expect(vitals.lcp).toBeLessThan(2500); // Good LCP < 2.5s
    expect(vitals.cls).toBeLessThan(0.1); // Good CLS < 0.1
    
    console.log('Core Web Vitals:', vitals);
  });
  
  test('API response times', async ({ page }) => {
    await page.goto('/login');
    
    // Measure login API performance
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
    
    // Check response time
    expect(responseTime).toBeLessThan(500); // < 500ms
    
    // Check server timing header if available
    const serverTiming = response.headers()['server-timing'];
    if (serverTiming) {
      const match = serverTiming.match(/dur=(\d+)/);
      if (match) {
        const serverProcessingTime = parseInt(match[1]);
        expect(serverProcessingTime).toBeLessThan(200); // < 200ms server processing
        console.log('Server Processing Time:', serverProcessingTime, 'ms');
      }
    }
    
    console.log('Total API Response Time:', responseTime, 'ms');
  });
  
  test('handles large datasets efficiently', async ({ page }) => {
    const authHelper = new AuthHelper(page);
    
    // Login as admin to access user list
    await page.goto('/login');
    await page.fill('[data-testid="username"]', 'admin');
    await page.fill('[data-testid="password"]', 'admin');
    await page.click('[data-testid="login-button"]');
    await page.waitForURL('/dashboard');
    
    // Navigate to users page with large dataset
    const startTime = Date.now();
    await page.goto('/admin/users');
    await page.waitForSelector('[data-testid="users-table"]');
    const renderTime = Date.now() - startTime;
    
    // Initial render should be fast even with many users
    expect(renderTime).toBeLessThan(2000); // < 2 seconds
    
    // Check if virtual scrolling is implemented
    const visibleRows = await page.locator('[data-testid="user-row"]:visible').count();
    const totalRows = await page.locator('[data-testid="total-users"]').textContent();
    
    if (totalRows && parseInt(totalRows) > 100) {
      // Should use virtual scrolling for large datasets
      expect(visibleRows).toBeLessThan(50);
    }
    
    // Test scrolling performance
    const scrollStartTime = Date.now();
    await page.evaluate(() => {
      const table = document.querySelector('[data-testid="users-table"]');
      if (table) {
        table.scrollTop = 10000;
      }
    });
    await page.waitForTimeout(100); // Wait for render
    const scrollTime = Date.now() - scrollStartTime;
    
    expect(scrollTime).toBeLessThan(200); // Smooth scrolling < 200ms
    
    console.log('Large Dataset Performance:', {
      initialRender: renderTime,
      visibleRows,
      scrollTime
    });
  });
  
  test('memory leak detection', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Get initial memory usage
    const initialMemory = await page.evaluate(() => {
      if ((performance as any).memory) {
        return (performance as any).memory.usedJSHeapSize;
      }
      return 0;
    });
    
    // Perform repeated actions that could leak memory
    for (let i = 0; i < 10; i++) {
      // Open and close modals
      const modalButton = page.locator('[data-testid="open-modal"]');
      if (await modalButton.isVisible()) {
        await modalButton.click();
        await page.waitForSelector('[role="dialog"]');
        await page.click('[data-testid="close-modal"]');
        await page.waitForSelector('[role="dialog"]', { state: 'hidden' });
      }
      
      // Navigate between pages
      await page.goto('/profile');
      await page.goto('/dashboard');
    }
    
    // Force garbage collection if available
    await page.evaluate(() => {
      if ((window as any).gc) {
        (window as any).gc();
      }
    });
    
    await page.waitForTimeout(1000);
    
    // Get final memory usage
    const finalMemory = await page.evaluate(() => {
      if ((performance as any).memory) {
        return (performance as any).memory.usedJSHeapSize;
      }
      return 0;
    });
    
    // Memory shouldn't grow excessively
    if (initialMemory > 0 && finalMemory > 0) {
      const memoryGrowth = finalMemory - initialMemory;
      const growthPercentage = (memoryGrowth / initialMemory) * 100;
      
      // Allow up to 50% growth (conservative threshold)
      expect(growthPercentage).toBeLessThan(50);
      
      console.log('Memory Usage:', {
        initial: initialMemory,
        final: finalMemory,
        growth: memoryGrowth,
        growthPercentage: growthPercentage.toFixed(2) + '%'
      });
    }
  });
  
  test('bundle size optimization', async ({ page }) => {
    // Get all JavaScript bundles
    const jsRequests: any[] = [];
    
    page.on('response', response => {
      if (response.url().endsWith('.js')) {
        jsRequests.push({
          url: response.url(),
          size: parseInt(response.headers()['content-length'] || '0')
        });
      }
    });
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Calculate total bundle size
    const totalSize = jsRequests.reduce((sum, req) => sum + req.size, 0);
    const totalSizeKB = totalSize / 1024;
    const totalSizeMB = totalSizeKB / 1024;
    
    // Check for code splitting
    const hasCodeSplitting = jsRequests.length > 1;
    expect(hasCodeSplitting).toBe(true);
    
    // Main bundle should be reasonably sized
    const mainBundle = jsRequests.find(r => r.url.includes('main') || r.url.includes('app'));
    if (mainBundle) {
      const mainBundleKB = mainBundle.size / 1024;
      expect(mainBundleKB).toBeLessThan(500); // Main bundle < 500KB
    }
    
    // Total JS should be reasonable
    expect(totalSizeMB).toBeLessThan(5); // Total JS < 5MB
    
    console.log('Bundle Analysis:', {
      totalBundles: jsRequests.length,
      totalSizeMB: totalSizeMB.toFixed(2) + ' MB',
      bundles: jsRequests.map(r => ({
        file: r.url.split('/').pop(),
        sizeKB: (r.size / 1024).toFixed(2) + ' KB'
      }))
    });
  });
  
  test('concurrent request handling', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Track all API requests
    const apiRequests: any[] = [];
    page.on('response', response => {
      if (response.url().includes('/api/')) {
        apiRequests.push({
          url: response.url(),
          status: response.status(),
          timing: response.timing()
        });
      }
    });
    
    // Trigger multiple concurrent requests
    await Promise.all([
      page.goto('/admin/users'),
      page.evaluate(() => fetch('/api/v2/metrics')),
      page.evaluate(() => fetch('/api/v2/audit-logs')),
      page.evaluate(() => fetch('/api/v2/health'))
    ]);
    
    // Check that requests were handled concurrently
    const timings = apiRequests.map(r => r.timing);
    const hasParallelRequests = timings.some((t1, i1) => 
      timings.some((t2, i2) => 
        i1 !== i2 && 
        t1.requestTime < t2.requestTime + t2.responseEnd &&
        t2.requestTime < t1.requestTime + t1.responseEnd
      )
    );
    
    expect(hasParallelRequests).toBe(true);
    
    // All requests should complete successfully
    const failedRequests = apiRequests.filter(r => r.status >= 500);
    expect(failedRequests).toHaveLength(0);
    
    console.log('Concurrent Requests:', {
      total: apiRequests.length,
      parallel: hasParallelRequests,
      failed: failedRequests.length
    });
  });
  
  test('resource caching', async ({ page }) => {
    // First load
    const firstLoadResources: any[] = [];
    page.on('response', response => {
      firstLoadResources.push({
        url: response.url(),
        fromCache: response.fromServiceWorker() || response.fromCache(),
        status: response.status()
      });
    });
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Second load (should use cache)
    const secondLoadResources: any[] = [];
    page.removeAllListeners('response');
    page.on('response', response => {
      secondLoadResources.push({
        url: response.url(),
        fromCache: response.fromServiceWorker() || response.fromCache(),
        status: response.status()
      });
    });
    
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Check cache usage
    const cachedResources = secondLoadResources.filter(r => r.fromCache);
    const cacheRatio = cachedResources.length / secondLoadResources.length;
    
    // At least 50% of resources should be cached
    expect(cacheRatio).toBeGreaterThan(0.5);
    
    console.log('Caching Performance:', {
      firstLoad: firstLoadResources.length,
      secondLoad: secondLoadResources.length,
      cached: cachedResources.length,
      cacheRatio: (cacheRatio * 100).toFixed(2) + '%'
    });
  });
});