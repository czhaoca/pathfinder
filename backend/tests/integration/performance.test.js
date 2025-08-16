const request = require('supertest');
const app = require('../../src/api/app');
const { 
  setupTestDatabase, 
  cleanupTestDatabase, 
  clearTestData 
} = require('../helpers/database');
const { 
  generateTestUsers,
  createTestUsers,
  loginAs,
  hashPassword
} = require('../helpers/users');

describe('Performance and Load Tests', () => {
  let testUsers;
  let testApp;

  beforeAll(async () => {
    await setupTestDatabase();
    testApp = app.getExpressApp();
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  beforeEach(async () => {
    await clearTestData();
    testUsers = await generateTestUsers();
  });

  describe('Concurrent Operations', () => {
    test('Handles concurrent user registrations', async () => {
      const adminToken = await loginAs(testUsers.admin1);
      const promises = [];
      const userCount = 50;
      
      // Create multiple users concurrently
      for (let i = 0; i < userCount; i++) {
        promises.push(
          request(testApp)
            .post('/api/auth/register')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
              username: `concurrent_user_${i}`,
              email: `user${i}@concurrent.test`,
              first_name: 'Concurrent',
              last_name: `User${i}`
            })
        );
      }
      
      const startTime = Date.now();
      const results = await Promise.allSettled(promises);
      const duration = Date.now() - startTime;
      
      const successful = results.filter(r => 
        r.status === 'fulfilled' && r.value.status === 201
      );
      
      // At least 90% should succeed
      expect(successful.length).toBeGreaterThan(userCount * 0.9);
      
      // Should complete within reasonable time (adjust based on environment)
      expect(duration).toBeLessThan(30000); // 30 seconds for 50 users
      
      // Average time per user
      const avgTime = duration / userCount;
      expect(avgTime).toBeLessThan(600); // 600ms per user average
    });

    test('Handles concurrent login attempts', async () => {
      // Create test users
      const users = await createTestUsers(20);
      const loginPromises = [];
      
      const startTime = Date.now();
      
      for (const user of users) {
        const { hash, salt } = await hashPassword('Test@Password123');
        loginPromises.push(
          request(testApp)
            .post('/api/auth/login')
            .send({
              username: user.username,
              password_hash: hash,
              client_salt: salt
            })
        );
      }
      
      const results = await Promise.allSettled(loginPromises);
      const duration = Date.now() - startTime;
      
      const successful = results.filter(r => 
        r.status === 'fulfilled' && r.value.status === 200
      );
      
      expect(successful.length).toBe(users.length);
      
      // Average login time should be < 200ms
      const avgLoginTime = duration / users.length;
      expect(avgLoginTime).toBeLessThan(200);
    });

    test('Handles concurrent data reads', async () => {
      const tokens = [
        await loginAs(testUsers.user1),
        await loginAs(testUsers.user2),
        await loginAs(testUsers.regularUser)
      ];
      
      const promises = [];
      const requestsPerUser = 10;
      
      // Each user makes multiple concurrent requests
      for (const token of tokens) {
        for (let i = 0; i < requestsPerUser; i++) {
          promises.push(
            request(testApp)
              .get('/api/profile')
              .set('Authorization', `Bearer ${token}`)
          );
        }
      }
      
      const startTime = Date.now();
      const results = await Promise.all(promises);
      const duration = Date.now() - startTime;
      
      // All requests should succeed
      expect(results.every(r => r.status === 200)).toBe(true);
      
      // Should handle 30 concurrent reads in < 5 seconds
      expect(duration).toBeLessThan(5000);
    });
  });

  describe('Response Time', () => {
    test('Authentication endpoints respond quickly', async () => {
      const { hash, salt } = await hashPassword('Test@Password123');
      
      const measurements = [];
      const iterations = 10;
      
      for (let i = 0; i < iterations; i++) {
        const startTime = Date.now();
        
        await request(testApp)
          .post('/api/auth/login')
          .send({
            username: testUsers.regularUser.username,
            password_hash: hash,
            client_salt: salt
          });
        
        measurements.push(Date.now() - startTime);
      }
      
      const avgResponseTime = measurements.reduce((a, b) => a + b, 0) / iterations;
      const maxResponseTime = Math.max(...measurements);
      
      // Average response time < 100ms
      expect(avgResponseTime).toBeLessThan(100);
      
      // Max response time < 500ms
      expect(maxResponseTime).toBeLessThan(500);
    });

    test('Profile endpoints respond quickly', async () => {
      const token = await loginAs(testUsers.regularUser);
      
      const measurements = [];
      const iterations = 20;
      
      for (let i = 0; i < iterations; i++) {
        const startTime = Date.now();
        
        await request(testApp)
          .get('/api/profile')
          .set('Authorization', `Bearer ${token}`);
        
        measurements.push(Date.now() - startTime);
      }
      
      const avgResponseTime = measurements.reduce((a, b) => a + b, 0) / iterations;
      
      // Average response time < 50ms for simple reads
      expect(avgResponseTime).toBeLessThan(50);
    });
  });

  describe('Database Performance', () => {
    test('Bulk operations are optimized', async () => {
      const adminToken = await loginAs(testUsers.admin1);
      
      // Create bulk data
      const bulkUsers = [];
      for (let i = 0; i < 100; i++) {
        bulkUsers.push({
          username: `bulk_${i}`,
          email: `bulk${i}@test.com`,
          first_name: 'Bulk',
          last_name: `User${i}`
        });
      }
      
      const startTime = Date.now();
      
      // If bulk endpoint exists, use it
      const response = await request(testApp)
        .post('/api/admin/users/bulk')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ users: bulkUsers });
      
      const duration = Date.now() - startTime;
      
      if (response.status === 200 || response.status === 201) {
        // Bulk creation of 100 users should take < 10 seconds
        expect(duration).toBeLessThan(10000);
      }
    });

    test('Pagination works efficiently', async () => {
      // Create many users
      await createTestUsers(100);
      
      const adminToken = await loginAs(testUsers.admin1);
      
      const startTime = Date.now();
      
      // Fetch paginated results
      const response = await request(testApp)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({
          page: 1,
          limit: 20
        });
      
      const duration = Date.now() - startTime;
      
      expect(response.status).toBe(200);
      expect(response.body.data.users).toHaveLength(20);
      
      // Paginated query should be fast < 100ms
      expect(duration).toBeLessThan(100);
    });
  });

  describe('Memory Usage', () => {
    test('No memory leaks during repeated operations', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      const token = await loginAs(testUsers.regularUser);
      
      // Perform many operations
      for (let i = 0; i < 100; i++) {
        await request(testApp)
          .get('/api/profile')
          .set('Authorization', `Bearer ${token}`);
      }
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Memory increase should be reasonable (< 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });
  });

  describe('Stress Testing', () => {
    test('System remains stable under load', async () => {
      const tokens = [];
      
      // Create multiple user sessions
      for (let i = 0; i < 10; i++) {
        const user = await createTestUsers(1);
        tokens.push(await loginAs(user[0]));
      }
      
      const promises = [];
      const requestsPerSecond = 50;
      const durationSeconds = 5;
      
      const startTime = Date.now();
      
      // Generate load for specified duration
      for (let second = 0; second < durationSeconds; second++) {
        for (let req = 0; req < requestsPerSecond; req++) {
          const token = tokens[Math.floor(Math.random() * tokens.length)];
          
          promises.push(
            request(testApp)
              .get('/api/profile')
              .set('Authorization', `Bearer ${token}`)
              .then(res => ({ status: res.status, time: Date.now() - startTime }))
              .catch(err => ({ status: 'error', time: Date.now() - startTime }))
          );
        }
        
        // Wait 1 second before next batch
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      const results = await Promise.all(promises);
      
      const successful = results.filter(r => r.status === 200);
      const failed = results.filter(r => r.status !== 200);
      
      // Success rate should be > 95%
      const successRate = (successful.length / results.length) * 100;
      expect(successRate).toBeGreaterThan(95);
      
      // Calculate response time percentiles
      const responseTimes = successful.map(r => r.time).sort((a, b) => a - b);
      const p50 = responseTimes[Math.floor(responseTimes.length * 0.5)];
      const p95 = responseTimes[Math.floor(responseTimes.length * 0.95)];
      const p99 = responseTimes[Math.floor(responseTimes.length * 0.99)];
      
      // Performance SLAs
      expect(p50).toBeLessThan(100); // 50th percentile < 100ms
      expect(p95).toBeLessThan(500); // 95th percentile < 500ms
      expect(p99).toBeLessThan(1000); // 99th percentile < 1s
    });
  });

  describe('Caching Performance', () => {
    test('Repeated requests benefit from caching', async () => {
      const token = await loginAs(testUsers.regularUser);
      
      // First request (cache miss)
      const firstStart = Date.now();
      await request(testApp)
        .get('/api/profile')
        .set('Authorization', `Bearer ${token}`);
      const firstDuration = Date.now() - firstStart;
      
      // Subsequent requests (cache hit)
      const cachedDurations = [];
      for (let i = 0; i < 5; i++) {
        const start = Date.now();
        await request(testApp)
          .get('/api/profile')
          .set('Authorization', `Bearer ${token}`);
        cachedDurations.push(Date.now() - start);
      }
      
      const avgCachedDuration = cachedDurations.reduce((a, b) => a + b, 0) / cachedDurations.length;
      
      // Cached requests should be faster
      expect(avgCachedDuration).toBeLessThan(firstDuration * 0.5);
    });
  });
});