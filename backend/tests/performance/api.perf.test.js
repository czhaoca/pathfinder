/**
 * Performance Tests for API Endpoints
 * Tests response times, throughput, and resource usage
 */

const request = require('supertest');
const express = require('express');
const { performance } = require('perf_hooks');

// Mock the database to avoid real DB overhead in perf tests
jest.mock('../../src/services/database', () => ({
  initialize: jest.fn().mockResolvedValue(undefined),
  close: jest.fn().mockResolvedValue(undefined),
  query: jest.fn().mockResolvedValue({ rows: [] }),
  transaction: jest.fn().mockImplementation(async (callback) => {
    const mockClient = {
      execute: jest.fn().mockResolvedValue({ rows: [] }),
      commit: jest.fn().mockResolvedValue(undefined),
      rollback: jest.fn().mockResolvedValue(undefined)
    };
    return callback(mockClient);
  })
}));

describe('API Performance Tests', () => {
  let app;
  const PERFORMANCE_THRESHOLDS = {
    auth: {
      login: 100,        // ms
      register: 150,     // ms
      verify: 50         // ms
    },
    experience: {
      create: 200,       // ms
      fetch: 100,        // ms
      search: 150,       // ms
      bulk: 500          // ms
    },
    profile: {
      get: 75,           // ms
      update: 150        // ms
    }
  };

  beforeAll(async () => {
    // Create minimal Express app for testing
    app = express();
    app.use(express.json());
    
    // Add routes
    const authRoutes = require('../../src/api/routes/authRoutes');
    const experienceRoutes = require('../../src/api/routes/experienceRoutes');
    const profileRoutes = require('../../src/api/routes/profileRoutes');
    
    app.use('/api/auth', authRoutes);
    app.use('/api/experiences', experienceRoutes);
    app.use('/api/profile', profileRoutes);
    
    // Error handler
    app.use((err, req, res, next) => {
      res.status(err.status || 500).json({ error: err.message });
    });
  });

  describe('Authentication Endpoint Performance', () => {
    test('POST /api/auth/login should respond within threshold', async () => {
      const startTime = performance.now();
      
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'testuser',
          password: 'TestPassword123!'
        });
      
      const endTime = performance.now();
      const responseTime = endTime - startTime;
      
      expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.auth.login);
      console.log(`Login endpoint responded in ${responseTime.toFixed(2)}ms`);
    });

    test('POST /api/auth/register should respond within threshold', async () => {
      const startTime = performance.now();
      
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'newuser',
          email: 'new@example.com',
          password: 'TestPassword123!',
          fullName: 'New User'
        });
      
      const endTime = performance.now();
      const responseTime = endTime - startTime;
      
      expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.auth.register);
      console.log(`Register endpoint responded in ${responseTime.toFixed(2)}ms`);
    });

    test('Concurrent login requests should maintain performance', async () => {
      const concurrentRequests = 10;
      const requests = [];
      
      const startTime = performance.now();
      
      for (let i = 0; i < concurrentRequests; i++) {
        requests.push(
          request(app)
            .post('/api/auth/login')
            .send({
              username: `user${i}`,
              password: 'TestPassword123!'
            })
        );
      }
      
      await Promise.all(requests);
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const avgTime = totalTime / concurrentRequests;
      
      expect(avgTime).toBeLessThan(PERFORMANCE_THRESHOLDS.auth.login * 1.5);
      console.log(`${concurrentRequests} concurrent logins: avg ${avgTime.toFixed(2)}ms`);
    });
  });

  describe('Experience Endpoint Performance', () => {
    test('POST /api/experiences should handle creation within threshold', async () => {
      const startTime = performance.now();
      
      const response = await request(app)
        .post('/api/experiences')
        .set('Authorization', 'Bearer mock-token')
        .send({
          title: 'Senior Developer',
          description: 'Led development of microservices architecture',
          organization: 'Tech Corp',
          startDate: '2022-01-01',
          endDate: '2023-12-31',
          skills: ['Node.js', 'React', 'AWS'],
          experienceType: 'work'
        });
      
      const endTime = performance.now();
      const responseTime = endTime - startTime;
      
      expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.experience.create);
      console.log(`Experience creation responded in ${responseTime.toFixed(2)}ms`);
    });

    test('GET /api/experiences should fetch quickly', async () => {
      const startTime = performance.now();
      
      const response = await request(app)
        .get('/api/experiences')
        .set('Authorization', 'Bearer mock-token');
      
      const endTime = performance.now();
      const responseTime = endTime - startTime;
      
      expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.experience.fetch);
      console.log(`Experience fetch responded in ${responseTime.toFixed(2)}ms`);
    });

    test('GET /api/experiences/search should perform within threshold', async () => {
      const startTime = performance.now();
      
      const response = await request(app)
        .get('/api/experiences/search')
        .query({ 
          q: 'developer',
          limit: 20,
          skills: 'javascript,react'
        })
        .set('Authorization', 'Bearer mock-token');
      
      const endTime = performance.now();
      const responseTime = endTime - startTime;
      
      expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.experience.search);
      console.log(`Experience search responded in ${responseTime.toFixed(2)}ms`);
    });

    test('Bulk experience operations should complete within threshold', async () => {
      const experiences = Array(10).fill().map((_, i) => ({
        title: `Role ${i}`,
        description: `Description ${i}`,
        organization: `Company ${i}`,
        startDate: '2020-01-01',
        experienceType: 'work'
      }));
      
      const startTime = performance.now();
      
      const response = await request(app)
        .post('/api/experiences/bulk')
        .set('Authorization', 'Bearer mock-token')
        .send({ experiences });
      
      const endTime = performance.now();
      const responseTime = endTime - startTime;
      
      expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.experience.bulk);
      console.log(`Bulk operation (10 items) responded in ${responseTime.toFixed(2)}ms`);
    });
  });

  describe('Profile Endpoint Performance', () => {
    test('GET /api/profile should respond quickly', async () => {
      const startTime = performance.now();
      
      const response = await request(app)
        .get('/api/profile')
        .set('Authorization', 'Bearer mock-token');
      
      const endTime = performance.now();
      const responseTime = endTime - startTime;
      
      expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.profile.get);
      console.log(`Profile fetch responded in ${responseTime.toFixed(2)}ms`);
    });

    test('PUT /api/profile should update within threshold', async () => {
      const startTime = performance.now();
      
      const response = await request(app)
        .put('/api/profile')
        .set('Authorization', 'Bearer mock-token')
        .send({
          executiveSummary: 'Experienced software engineer',
          coreStrengths: {
            technical: ['JavaScript', 'Python', 'AWS'],
            leadership: ['Team Management', 'Mentoring']
          },
          careerGoals: 'Seeking technical leadership role'
        });
      
      const endTime = performance.now();
      const responseTime = endTime - startTime;
      
      expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.profile.update);
      console.log(`Profile update responded in ${responseTime.toFixed(2)}ms`);
    });
  });

  describe('Load Testing', () => {
    test('System should handle sustained load', async () => {
      const duration = 5000; // 5 seconds
      const requestsPerSecond = 10;
      const results = [];
      
      const startTime = Date.now();
      const endTime = startTime + duration;
      
      while (Date.now() < endTime) {
        const batchStart = performance.now();
        
        const promises = Array(requestsPerSecond).fill().map(() =>
          request(app)
            .get('/api/experiences')
            .set('Authorization', 'Bearer mock-token')
        );
        
        await Promise.all(promises);
        
        const batchEnd = performance.now();
        results.push({
          time: Date.now() - startTime,
          responseTime: (batchEnd - batchStart) / requestsPerSecond
        });
        
        // Wait for the remainder of the second
        const elapsed = Date.now() - (startTime + results.length * 1000);
        if (elapsed < 1000) {
          await new Promise(resolve => setTimeout(resolve, 1000 - elapsed));
        }
      }
      
      const avgResponseTime = results.reduce((sum, r) => sum + r.responseTime, 0) / results.length;
      const maxResponseTime = Math.max(...results.map(r => r.responseTime));
      
      console.log(`Load test results:
        Duration: ${duration}ms
        Requests/sec: ${requestsPerSecond}
        Avg response time: ${avgResponseTime.toFixed(2)}ms
        Max response time: ${maxResponseTime.toFixed(2)}ms
      `);
      
      expect(avgResponseTime).toBeLessThan(200); // Average should stay under 200ms
      expect(maxResponseTime).toBeLessThan(500); // Max should stay under 500ms
    });
  });

  describe('Memory Usage', () => {
    test('Memory should not leak during repeated operations', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      const iterations = 100;
      
      for (let i = 0; i < iterations; i++) {
        await request(app)
          .post('/api/experiences')
          .set('Authorization', 'Bearer mock-token')
          .send({
            title: `Experience ${i}`,
            description: 'Test description',
            organization: 'Test Org',
            startDate: '2020-01-01',
            experienceType: 'work'
          });
        
        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024; // MB
      
      console.log(`Memory usage after ${iterations} operations: +${memoryIncrease.toFixed(2)}MB`);
      
      // Memory increase should be reasonable (less than 50MB for 100 operations)
      expect(memoryIncrease).toBeLessThan(50);
    });
  });

  describe('Response Size Optimization', () => {
    test('Paginated responses should have consistent size', async () => {
      const pageSizes = [10, 20, 50];
      const responseSizes = [];
      
      for (const pageSize of pageSizes) {
        const response = await request(app)
          .get('/api/experiences')
          .query({ limit: pageSize })
          .set('Authorization', 'Bearer mock-token');
        
        const size = JSON.stringify(response.body).length;
        responseSizes.push({ pageSize, size });
      }
      
      console.log('Response sizes:', responseSizes);
      
      // Response size should scale linearly with page size
      const ratio1 = responseSizes[1].size / responseSizes[0].size;
      const ratio2 = responseSizes[2].size / responseSizes[1].size;
      const expectedRatio1 = responseSizes[1].pageSize / responseSizes[0].pageSize;
      const expectedRatio2 = responseSizes[2].pageSize / responseSizes[1].pageSize;
      
      expect(Math.abs(ratio1 - expectedRatio1)).toBeLessThan(0.5);
      expect(Math.abs(ratio2 - expectedRatio2)).toBeLessThan(0.5);
    });
  });

  describe('Caching Performance', () => {
    test('Cached responses should be significantly faster', async () => {
      // First request (cache miss)
      const firstStart = performance.now();
      await request(app)
        .get('/api/profile')
        .set('Authorization', 'Bearer mock-token');
      const firstTime = performance.now() - firstStart;
      
      // Second request (cache hit)
      const secondStart = performance.now();
      await request(app)
        .get('/api/profile')
        .set('Authorization', 'Bearer mock-token');
      const secondTime = performance.now() - secondStart;
      
      console.log(`Cache performance:
        First request: ${firstTime.toFixed(2)}ms
        Second request: ${secondTime.toFixed(2)}ms
        Improvement: ${((1 - secondTime/firstTime) * 100).toFixed(1)}%
      `);
      
      // Cached response should be at least 20% faster
      expect(secondTime).toBeLessThan(firstTime * 0.8);
    });
  });
});