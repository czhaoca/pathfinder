const request = require('supertest');
const app = require('../../src/app');
const database = require('../../src/config/database');
const jwt = require('jsonwebtoken');

// Mock database
jest.mock('../../src/config/database');

// Mock OpenAI
jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn()
      }
    }
  }));
});

describe('CPA PERT API Integration Tests', () => {
  let mockDb;
  let authToken;
  const testUser = {
    userId: 'test123',
    username: 'testuser',
    email: 'test@example.com'
  };

  beforeEach(() => {
    // Setup mock database connection
    mockDb = {
      execute: jest.fn(),
      close: jest.fn()
    };
    database.getConnection.mockResolvedValue(mockDb);

    // Create auth token
    authToken = jwt.sign(
      { userId: testUser.userId, username: testUser.username },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );

    // Mock user authentication
    mockDb.execute.mockImplementation((query) => {
      if (query.includes('cn_user_sessions')) {
        return { rows: [{ user_id: testUser.userId, is_active: true }] };
      }
      if (query.includes('cn_users') && query.includes('WHERE user_id')) {
        return { rows: [testUser] };
      }
      return { rows: [] };
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/cpa-pert/competencies', () => {
    it('should return competency framework', async () => {
      const mockCompetencies = [
        {
          competency_id: '1',
          main_code: 'FR',
          main_name: 'Financial Reporting',
          sub_code: 'FR1',
          sub_name: 'Financial Reporting Needs'
        }
      ];

      mockDb.execute.mockResolvedValueOnce({ rows: mockCompetencies });

      const response = await request(app)
        .get('/api/cpa-pert/competencies')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockCompetencies);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/cpa-pert/competencies');

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/cpa-pert/analyze', () => {
    it('should analyze experience for competency mappings', async () => {
      const mockExperience = {
        experienceId: 'exp123',
        title: 'Senior Accountant',
        description: 'Managed financial reporting'
      };

      const mockCompetencies = [
        {
          competency_id: '1',
          sub_code: 'FR1',
          sub_name: 'Financial Reporting Needs'
        }
      ];

      const mockAnalysis = {
        mappings: [
          {
            competency_id: '1',
            sub_code: 'FR1',
            sub_name: 'Financial Reporting Needs',
            relevance_score: 0.95
          }
        ]
      };

      // Mock database and OpenAI calls
      mockDb.execute
        .mockResolvedValueOnce({ rows: [{ user_id: testUser.userId }] }) // Auth check
        .mockResolvedValueOnce({ rows: [testUser] }) // User lookup
        .mockResolvedValueOnce({ rows: [mockExperience] }) // Experience lookup
        .mockResolvedValueOnce({ rows: mockCompetencies }) // Competencies
        .mockResolvedValueOnce({ rows: [] }); // Insert mapping

      const OpenAI = require('openai');
      OpenAI.mockImplementation(() => ({
        chat: {
          completions: {
            create: jest.fn().mockResolvedValue({
              choices: [{
                message: {
                  content: JSON.stringify(mockAnalysis)
                }
              }]
            })
          }
        }
      }));

      const response = await request(app)
        .post('/api/cpa-pert/analyze')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ experienceId: 'exp123' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0]).toMatchObject({
        competency_id: '1',
        relevance_score: 0.95
      });
    });

    it('should validate request body', async () => {
      const response = await request(app)
        .post('/api/cpa-pert/analyze')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Experience ID is required');
    });
  });

  describe('POST /api/cpa-pert/generate', () => {
    it('should generate PERT response', async () => {
      const mockExperience = {
        experienceId: 'exp123',
        title: 'Senior Accountant'
      };

      const mockCompetency = {
        competency_id: '1',
        sub_code: 'FR1'
      };

      const mockPERTResponse = {
        situation: 'Test situation',
        task: 'Test task',
        action: 'Test action',
        result: 'Test result'
      };

      mockDb.execute
        .mockResolvedValueOnce({ rows: [{ user_id: testUser.userId }] }) // Auth
        .mockResolvedValueOnce({ rows: [testUser] }) // User
        .mockResolvedValueOnce({ rows: [mockExperience] }) // Experience
        .mockResolvedValueOnce({ rows: [mockCompetency] }) // Competency
        .mockResolvedValueOnce({ rows: [] }) // No existing response
        .mockResolvedValueOnce({ rows: [] }); // Insert response

      const OpenAI = require('openai');
      OpenAI.mockImplementation(() => ({
        chat: {
          completions: {
            create: jest.fn().mockResolvedValue({
              choices: [{
                message: {
                  content: JSON.stringify(mockPERTResponse)
                }
              }]
            })
          }
        }
      }));

      const response = await request(app)
        .post('/api/cpa-pert/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          experienceId: 'exp123',
          competencyId: '1',
          proficiencyLevel: 2
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        experience_id: 'exp123',
        competency_id: '1',
        proficiency_level: 2
      });
    });

    it('should validate proficiency level', async () => {
      const response = await request(app)
        .post('/api/cpa-pert/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          experienceId: 'exp123',
          competencyId: '1',
          proficiencyLevel: 5
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid proficiency level');
    });
  });

  describe('GET /api/cpa-pert/compliance', () => {
    it('should check EVR compliance', async () => {
      const mockProficiencies = [
        { competency_id: '1', current_level: 2, evidence_count: 3 },
        { competency_id: '2', current_level: 2, evidence_count: 2 },
        { competency_id: '3', current_level: 1, evidence_count: 2 },
        { competency_id: '4', current_level: 1, evidence_count: 2 },
        { competency_id: '5', current_level: 1, evidence_count: 1 },
        { competency_id: '6', current_level: 1, evidence_count: 1 },
        { competency_id: '7', current_level: 1, evidence_count: 1 },
        { competency_id: '8', current_level: 1, evidence_count: 1 }
      ];

      mockDb.execute
        .mockResolvedValueOnce({ rows: [{ user_id: testUser.userId }] }) // Auth
        .mockResolvedValueOnce({ rows: [testUser] }) // User
        .mockResolvedValueOnce({ rows: mockProficiencies }) // Proficiencies
        .mockResolvedValueOnce({ rows: [] }); // Insert compliance check

      const response = await request(app)
        .get('/api/cpa-pert/compliance')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.isCompliant).toBe(true);
      expect(response.body.summary.totalCompetencies).toBe(8);
      expect(response.body.summary.level2Count).toBe(2);
    });
  });

  describe('PUT /api/cpa-pert/response/:responseId', () => {
    it('should update PERT response', async () => {
      const updates = {
        responseText: 'Updated response',
        situationText: 'Updated situation'
      };

      mockDb.execute
        .mockResolvedValueOnce({ rows: [{ user_id: testUser.userId }] }) // Auth
        .mockResolvedValueOnce({ rows: [testUser] }) // User
        .mockResolvedValueOnce({ rows: [{ response_id: 'resp123' }] }) // Check existing
        .mockResolvedValueOnce({ rows: [] }); // Update

      const response = await request(app)
        .put('/api/cpa-pert/response/resp123')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updates);

      expect(response.status).toBe(200);
      expect(response.body.response_id).toBe('resp123');
    });

    it('should handle non-existent response', async () => {
      mockDb.execute
        .mockResolvedValueOnce({ rows: [{ user_id: testUser.userId }] }) // Auth
        .mockResolvedValueOnce({ rows: [testUser] }) // User
        .mockResolvedValueOnce({ rows: [] }); // No response found

      const response = await request(app)
        .put('/api/cpa-pert/response/invalid')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ responseText: 'test' });

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('not found');
    });
  });

  describe('GET /api/cpa-pert/responses', () => {
    it('should retrieve paginated PERT responses', async () => {
      const mockResponses = [
        {
          response_id: 'resp1',
          experience_id: 'exp1',
          competency_id: '1',
          proficiency_level: 2
        }
      ];

      mockDb.execute
        .mockResolvedValueOnce({ rows: [{ user_id: testUser.userId }] }) // Auth
        .mockResolvedValueOnce({ rows: [testUser] }) // User
        .mockResolvedValueOnce({ rows: mockResponses }); // Responses

      const response = await request(app)
        .get('/api/cpa-pert/responses?limit=10&offset=0')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockResponses);
    });

    it('should filter by experience ID', async () => {
      mockDb.execute
        .mockResolvedValueOnce({ rows: [{ user_id: testUser.userId }] }) // Auth
        .mockResolvedValueOnce({ rows: [testUser] }) // User
        .mockResolvedValueOnce({ rows: [] }); // Responses

      const response = await request(app)
        .get('/api/cpa-pert/responses?experienceId=exp123')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining('AND experience_id = ?'),
        expect.any(Array)
      );
    });
  });

  describe('POST /api/cpa-pert/batch-analyze', () => {
    it('should analyze multiple experiences', async () => {
      const mockExperiences = [
        { experienceId: 'exp1', title: 'Accountant' },
        { experienceId: 'exp2', title: 'Senior Accountant' }
      ];

      const mockCompetencies = [
        { competency_id: '1', sub_code: 'FR1' }
      ];

      // Mock for each experience analysis
      mockDb.execute
        .mockResolvedValueOnce({ rows: [{ user_id: testUser.userId }] }) // Auth
        .mockResolvedValueOnce({ rows: [testUser] }) // User
        .mockResolvedValueOnce({ rows: [mockExperiences[0]] }) // First experience
        .mockResolvedValueOnce({ rows: mockCompetencies }) // Competencies
        .mockResolvedValueOnce({ rows: [] }) // Insert
        .mockResolvedValueOnce({ rows: [mockExperiences[1]] }) // Second experience
        .mockResolvedValueOnce({ rows: mockCompetencies }) // Competencies
        .mockResolvedValueOnce({ rows: [] }); // Insert

      const OpenAI = require('openai');
      OpenAI.mockImplementation(() => ({
        chat: {
          completions: {
            create: jest.fn().mockResolvedValue({
              choices: [{
                message: {
                  content: JSON.stringify({
                    mappings: [{
                      competency_id: '1',
                      relevance_score: 0.9
                    }]
                  })
                }
              }]
            })
          }
        }
      }));

      const response = await request(app)
        .post('/api/cpa-pert/batch-analyze')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ experienceIds: ['exp1', 'exp2'] });

      expect(response.status).toBe(200);
      expect(response.body.results).toHaveLength(2);
    });
  });

  describe('GET /api/cpa-pert/report', () => {
    it('should generate competency report', async () => {
      const mockProficiencies = [
        {
          competency_id: '1',
          sub_code: 'FR1',
          current_level: 2,
          evidence_count: 3
        }
      ];

      mockDb.execute
        .mockResolvedValueOnce({ rows: [{ user_id: testUser.userId }] }) // Auth
        .mockResolvedValueOnce({ rows: [testUser] }) // User
        .mockResolvedValueOnce({ rows: mockProficiencies }) // Proficiencies
        .mockResolvedValueOnce({ rows: mockProficiencies }) // For compliance
        .mockResolvedValueOnce({ rows: [] }); // Insert compliance check

      const response = await request(app)
        .get('/api/cpa-pert/report')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('summary');
      expect(response.body).toHaveProperty('competencyDetails');
      expect(response.body).toHaveProperty('developmentPlan');
      expect(response.body).toHaveProperty('compliance');
    });
  });
});