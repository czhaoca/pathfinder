const request = require('supertest');
const { createTestUser, cleanupTestUser } = require('../helpers/testHelpers');
const app = require('../../src/app');

describe('Enhanced Experience Management', () => {
  let authToken;
  let userId;
  let testExperienceId;

  beforeAll(async () => {
    const testUser = await createTestUser();
    authToken = testUser.token;
    userId = testUser.userId;
  });

  afterAll(async () => {
    await cleanupTestUser(userId);
  });

  beforeEach(async () => {
    // Create a test experience
    const response = await request(app)
      .post('/api/experiences')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        title: 'Senior Software Engineer',
        organization: 'Tech Corp',
        description: 'Led development of React-based web applications using Node.js and AWS',
        startDate: '2020-01-01',
        endDate: '2023-12-31',
        experienceType: 'work',
        employmentType: 'full-time'
      });
    
    testExperienceId = response.body.experience.experienceId;
  });

  describe('GET /api/experiences/stats', () => {
    it('should return experience statistics', async () => {
      const response = await request(app)
        .get('/api/experiences/stats')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('totalExperiences');
      expect(response.body).toHaveProperty('currentExperiences');
      expect(response.body).toHaveProperty('uniqueOrganizations');
      expect(response.body.totalExperiences).toBeGreaterThan(0);
    });
  });

  describe('GET /api/experiences/templates', () => {
    it('should return experience templates', async () => {
      const response = await request(app)
        .get('/api/experiences/templates')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('templates');
      expect(response.body).toHaveProperty('count');
      expect(Array.isArray(response.body.templates)).toBe(true);
      expect(response.body.templates.length).toBeGreaterThan(0);
      
      const template = response.body.templates[0];
      expect(template).toHaveProperty('id');
      expect(template).toHaveProperty('category');
      expect(template).toHaveProperty('title');
      expect(template).toHaveProperty('template');
    });

    it('should filter templates by category', async () => {
      const response = await request(app)
        .get('/api/experiences/templates?category=technology')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.templates.every(t => t.category === 'technology')).toBe(true);
    });
  });

  describe('POST /api/experiences/bulk', () => {
    it('should create multiple experiences', async () => {
      const experiences = [
        {
          title: 'Junior Developer',
          organization: 'Startup Inc',
          description: 'Developed features for mobile app',
          startDate: '2018-01-01',
          endDate: '2019-12-31',
          experienceType: 'work',
          employmentType: 'full-time'
        },
        {
          title: 'Intern',
          organization: 'Big Corp',
          description: 'Assisted with data analysis projects',
          startDate: '2017-06-01',
          endDate: '2017-08-31',
          experienceType: 'work',
          employmentType: 'internship'
        }
      ];

      const response = await request(app)
        .post('/api/experiences/bulk')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ experiences })
        .expect(201);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('experiences');
      expect(response.body.experiences.length).toBe(2);
    });

    it('should validate each experience in bulk creation', async () => {
      const experiences = [
        {
          title: 'Valid Experience',
          organization: 'Company',
          description: 'Description',
          startDate: '2020-01-01',
          experienceType: 'work'
        },
        {
          // Missing required title
          organization: 'Company',
          description: 'Description',
          startDate: '2020-01-01',
          experienceType: 'work'
        }
      ];

      const response = await request(app)
        .post('/api/experiences/bulk')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ experiences })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('details');
    });
  });

  describe('PUT /api/experiences/bulk', () => {
    it('should update multiple experiences', async () => {
      // First create another experience
      const createResponse = await request(app)
        .post('/api/experiences')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Product Manager',
          organization: 'Another Corp',
          description: 'Managed product roadmap',
          startDate: '2021-01-01',
          experienceType: 'work'
        });
      
      const secondExperienceId = createResponse.body.experience.experienceId;

      const updates = [
        {
          id: testExperienceId,
          data: { title: 'Updated Senior Software Engineer' }
        },
        {
          id: secondExperienceId,
          data: { description: 'Updated product management description' }
        }
      ];

      const response = await request(app)
        .put('/api/experiences/bulk')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ updates })
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('experiences');
      expect(response.body.experiences.length).toBe(2);
      expect(response.body.experiences[0].title).toBe('Updated Senior Software Engineer');
    });
  });

  describe('POST /api/experiences/:id/duplicate', () => {
    it('should duplicate an experience', async () => {
      const response = await request(app)
        .post(`/api/experiences/${testExperienceId}/duplicate`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          modifications: {
            title: 'Lead Software Engineer',
            startDate: '2024-01-01',
            isCurrent: true
          }
        })
        .expect(201);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('experience');
      expect(response.body.experience.title).toBe('Lead Software Engineer');
      expect(response.body.experience.organization).toBe('Tech Corp');
      expect(response.body.experience.experienceId).not.toBe(testExperienceId);
    });

    it('should handle duplication of non-existent experience', async () => {
      const response = await request(app)
        .post('/api/experiences/invalid-id/duplicate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/experiences/:id/extract-skills', () => {
    it('should extract skills from experience', async () => {
      const response = await request(app)
        .post(`/api/experiences/${testExperienceId}/extract-skills`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('skills');
      expect(Array.isArray(response.body.skills)).toBe(true);
      
      // Should find React and Node.js from the description
      const skillNames = response.body.skills.map(s => s.name);
      expect(skillNames).toContain('React');
      expect(skillNames).toContain('Node.js');
      expect(skillNames).toContain('AWS');
    });

    it('should regenerate skills when requested', async () => {
      // First extraction
      await request(app)
        .post(`/api/experiences/${testExperienceId}/extract-skills`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(200);

      // Regenerate
      const response = await request(app)
        .post(`/api/experiences/${testExperienceId}/extract-skills`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ regenerate: true })
        .expect(200);

      expect(response.body).toHaveProperty('skills');
    });
  });
});