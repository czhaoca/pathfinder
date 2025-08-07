/**
 * Career Path Integration Tests
 */

const request = require('supertest');
const app = require('../../src/api/app');

describe('Career Path Endpoints', () => {
  let authToken;
  let userId;

  beforeAll(async () => {
    // Register and login to get auth token
    const registerResponse = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'careertest',
        email: 'career@test.com',
        password: 'Test123!@#',
        firstName: 'Career',
        lastName: 'Test'
      });

    if (registerResponse.status === 201) {
      authToken = registerResponse.body.data.token;
      userId = registerResponse.body.data.user.id;
    } else {
      // Login if already registered
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'careertest',
          password: 'Test123!@#'
        });
      authToken = loginResponse.body.data.token;
      userId = loginResponse.body.data.user.id;
    }
  });

  describe('GET /api/career-paths', () => {
    it('should get all available career paths', async () => {
      const response = await request(app)
        .get('/api/career-paths')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.data[0]).toHaveProperty('id');
      expect(response.body.data[0]).toHaveProperty('title');
      expect(response.body.data[0]).toHaveProperty('description');
      expect(response.body.data[0]).toHaveProperty('requiredSkills');
    });

    it('should filter career paths by category', async () => {
      const response = await request(app)
        .get('/api/career-paths?category=technology')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      response.body.data.forEach(path => {
        expect(path.category).toBe('technology');
      });
    });

    it('should fail without authentication', async () => {
      const response = await request(app)
        .get('/api/career-paths')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Unauthorized');
    });
  });

  describe('GET /api/career-paths/:id', () => {
    it('should get specific career path details', async () => {
      // First get list to get valid ID
      const listResponse = await request(app)
        .get('/api/career-paths')
        .set('Authorization', `Bearer ${authToken}`);

      const pathId = listResponse.body.data[0].id;

      const response = await request(app)
        .get(`/api/career-paths/${pathId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id', pathId);
      expect(response.body.data).toHaveProperty('title');
      expect(response.body.data).toHaveProperty('description');
      expect(response.body.data).toHaveProperty('requiredSkills');
      expect(response.body.data).toHaveProperty('averageSalary');
      expect(response.body.data).toHaveProperty('growthRate');
    });

    it('should return 404 for non-existent path', async () => {
      const response = await request(app)
        .get('/api/career-paths/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('not found');
    });
  });

  describe('POST /api/career-paths/analyze', () => {
    it('should analyze skills gap for career path', async () => {
      const response = await request(app)
        .post('/api/career-paths/analyze')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          targetPathId: 'software-engineer',
          currentSkills: ['JavaScript', 'React', 'Node.js']
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('gapAnalysis');
      expect(response.body.data).toHaveProperty('recommendations');
      expect(response.body.data).toHaveProperty('estimatedTimeToTarget');
      expect(response.body.data.gapAnalysis).toHaveProperty('missingSkills');
      expect(response.body.data.gapAnalysis).toHaveProperty('matchPercentage');
    });

    it('should fail with invalid data', async () => {
      const response = await request(app)
        .post('/api/career-paths/analyze')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          // Missing required fields
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Validation');
    });
  });

  describe('GET /api/career-paths/recommendations', () => {
    it('should get personalized career recommendations', async () => {
      const response = await request(app)
        .get('/api/career-paths/recommendations')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data[0]).toHaveProperty('pathId');
      expect(response.body.data[0]).toHaveProperty('matchScore');
      expect(response.body.data[0]).toHaveProperty('reasons');
    });

    it('should include query parameters for filtering', async () => {
      const response = await request(app)
        .get('/api/career-paths/recommendations?limit=5&minMatch=0.7')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBeLessThanOrEqual(5);
      response.body.data.forEach(rec => {
        expect(rec.matchScore).toBeGreaterThanOrEqual(0.7);
      });
    });
  });

  describe('POST /api/career-paths/goals', () => {
    let goalId;

    it('should create a career goal', async () => {
      const response = await request(app)
        .post('/api/career-paths/goals')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          pathId: 'senior-software-engineer',
          targetDate: '2026-12-31',
          milestones: [
            { title: 'Learn AWS', deadline: '2025-06-30' },
            { title: 'Lead a project', deadline: '2025-12-31' }
          ]
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data).toHaveProperty('pathId');
      expect(response.body.data).toHaveProperty('targetDate');
      expect(response.body.data).toHaveProperty('milestones');
      
      goalId = response.body.data.id;
    });

    it('should get user career goals', async () => {
      const response = await request(app)
        .get('/api/career-paths/goals')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBeGreaterThan(0);
    });

    it('should update goal progress', async () => {
      const response = await request(app)
        .patch(`/api/career-paths/goals/${goalId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          progress: 25,
          completedMilestones: ['Learn AWS']
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('progress', 25);
    });

    it('should delete a career goal', async () => {
      const response = await request(app)
        .delete(`/api/career-paths/goals/${goalId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('deleted');
    });
  });

  describe('GET /api/career-paths/transitions', () => {
    it('should get career transition paths', async () => {
      const response = await request(app)
        .get('/api/career-paths/transitions')
        .query({
          from: 'frontend-developer',
          to: 'fullstack-developer'
        })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('transitionPlan');
      expect(response.body.data).toHaveProperty('skillsToAcquire');
      expect(response.body.data).toHaveProperty('estimatedDuration');
      expect(response.body.data).toHaveProperty('learningResources');
    });
  });

  describe('POST /api/career-paths/skills-assessment', () => {
    it('should assess user skills for career path', async () => {
      const response = await request(app)
        .post('/api/career-paths/skills-assessment')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          skills: [
            { name: 'JavaScript', level: 'expert' },
            { name: 'Python', level: 'intermediate' },
            { name: 'AWS', level: 'beginner' }
          ]
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('overallLevel');
      expect(response.body.data).toHaveProperty('strengths');
      expect(response.body.data).toHaveProperty('improvements');
      expect(response.body.data).toHaveProperty('suitableCareerPaths');
    });
  });

  describe('GET /api/career-paths/market-insights', () => {
    it('should get market insights for career path', async () => {
      const response = await request(app)
        .get('/api/career-paths/market-insights')
        .query({ pathId: 'data-scientist' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('demandTrend');
      expect(response.body.data).toHaveProperty('salaryRange');
      expect(response.body.data).toHaveProperty('topEmployers');
      expect(response.body.data).toHaveProperty('emergingSkills');
      expect(response.body.data).toHaveProperty('jobOpenings');
    });

    it('should get market insights with location filter', async () => {
      const response = await request(app)
        .get('/api/career-paths/market-insights')
        .query({ 
          pathId: 'data-scientist',
          location: 'San Francisco, CA'
        })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('location', 'San Francisco, CA');
    });
  });
});