const CPAPertService = require('../../../src/services/cpaPertService');
const database = require('../../../src/config/database');

// Mock database
jest.mock('../../../src/config/database');

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

describe('CPAPertService', () => {
  let cpaPertService;
  let mockDb;

  beforeEach(() => {
    // Setup mock database connection
    mockDb = {
      execute: jest.fn(),
      close: jest.fn()
    };
    database.getConnection.mockResolvedValue(mockDb);

    // Create service instance
    cpaPertService = new CPAPertService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getCompetencyFramework', () => {
    it('should return all CPA competencies', async () => {
      const mockCompetencies = [
        {
          competency_id: '1',
          main_code: 'FR',
          main_name: 'Financial Reporting',
          sub_code: 'FR1',
          sub_name: 'Financial Reporting Needs',
          category: 'Technical',
          description: 'Assesses financial reporting needs'
        },
        {
          competency_id: '2',
          main_code: 'FR',
          main_name: 'Financial Reporting',
          sub_code: 'FR2',
          sub_name: 'GAAP',
          category: 'Technical',
          description: 'Applies GAAP'
        }
      ];

      mockDb.execute.mockResolvedValueOnce({ rows: mockCompetencies });

      const result = await cpaPertService.getCompetencyFramework('test_user');

      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM cn_cpa_competencies'),
        []
      );
      expect(result).toEqual(mockCompetencies);
    });

    it('should handle database errors', async () => {
      mockDb.execute.mockRejectedValueOnce(new Error('Database error'));

      await expect(cpaPertService.getCompetencyFramework('test_user'))
        .rejects.toThrow('Database error');
    });
  });

  describe('analyzeExperienceCompetencies', () => {
    it('should analyze experience and return competency mappings', async () => {
      const mockExperience = {
        experienceId: 'exp123',
        title: 'Senior Accountant',
        description: 'Prepared financial statements according to GAAP',
        achievements: ['Improved reporting efficiency by 30%']
      };

      const mockCompetencies = [
        {
          competency_id: '1',
          sub_code: 'FR1',
          sub_name: 'Financial Reporting Needs',
          description: 'Assesses financial reporting needs'
        }
      ];

      const mockAnalysis = {
        mappings: [
          {
            competency_id: '1',
            sub_code: 'FR1',
            sub_name: 'Financial Reporting Needs',
            relevance_score: 0.95,
            evidence: ['Prepared financial statements'],
            suggested_proficiency: 2
          }
        ]
      };

      // Mock database calls
      mockDb.execute
        .mockResolvedValueOnce({ rows: [mockExperience] })
        .mockResolvedValueOnce({ rows: mockCompetencies });

      // Mock OpenAI response
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

      const result = await cpaPertService.analyzeExperienceCompetencies('test_user', 'exp123');

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        experience_id: 'exp123',
        competency_id: '1',
        relevance_score: 0.95,
        suggested_proficiency: 2
      });
    });

    it('should handle missing experience', async () => {
      mockDb.execute.mockResolvedValueOnce({ rows: [] });

      await expect(cpaPertService.analyzeExperienceCompetencies('test_user', 'invalid'))
        .rejects.toThrow('Experience not found');
    });
  });

  describe('generatePERTResponse', () => {
    it('should generate a PERT response for given experience and competency', async () => {
      const mockExperience = {
        experienceId: 'exp123',
        title: 'Senior Accountant',
        description: 'Managed financial reporting'
      };

      const mockCompetency = {
        competency_id: '1',
        sub_code: 'FR1',
        sub_name: 'Financial Reporting Needs'
      };

      const mockResponse = {
        situation: 'Working as a Senior Accountant...',
        task: 'Responsible for financial reporting...',
        action: 'Implemented new reporting processes...',
        result: 'Achieved 30% efficiency improvement...'
      };

      // Mock database calls
      mockDb.execute
        .mockResolvedValueOnce({ rows: [mockExperience] })
        .mockResolvedValueOnce({ rows: [mockCompetency] })
        .mockResolvedValueOnce({ rows: [] }); // No existing response

      // Mock OpenAI response
      const OpenAI = require('openai');
      OpenAI.mockImplementation(() => ({
        chat: {
          completions: {
            create: jest.fn().mockResolvedValue({
              choices: [{
                message: {
                  content: JSON.stringify(mockResponse)
                }
              }]
            })
          }
        }
      }));

      const result = await cpaPertService.generatePERTResponse(
        'test_user',
        'exp123',
        '1',
        2
      );

      expect(result).toMatchObject({
        experience_id: 'exp123',
        competency_id: '1',
        proficiency_level: 2,
        situation_text: mockResponse.situation,
        task_text: mockResponse.task,
        action_text: mockResponse.action,
        result_text: mockResponse.result
      });
    });

    it('should validate proficiency level', async () => {
      await expect(cpaPertService.generatePERTResponse('test_user', 'exp123', '1', 5))
        .rejects.toThrow('Invalid proficiency level');
    });
  });

  describe('validateEVRRequirements', () => {
    it('should validate EVR compliance requirements', async () => {
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
        .mockResolvedValueOnce({ rows: mockProficiencies })
        .mockResolvedValueOnce({ rows: [] }); // Insert compliance check

      const result = await cpaPertService.validateEVRRequirements('test_user');

      expect(result.isCompliant).toBe(true);
      expect(result.summary.totalCompetencies).toBe(8);
      expect(result.summary.level2Count).toBe(2);
      expect(result.summary.level1OrHigherCount).toBe(8);
    });

    it('should identify non-compliance', async () => {
      const mockProficiencies = [
        { competency_id: '1', current_level: 2, evidence_count: 3 },
        { competency_id: '2', current_level: 1, evidence_count: 2 },
        { competency_id: '3', current_level: 1, evidence_count: 2 },
        { competency_id: '4', current_level: 0, evidence_count: 1 },
        { competency_id: '5', current_level: 0, evidence_count: 1 }
      ];

      mockDb.execute
        .mockResolvedValueOnce({ rows: mockProficiencies })
        .mockResolvedValueOnce({ rows: [] });

      const result = await cpaPertService.validateEVRRequirements('test_user');

      expect(result.isCompliant).toBe(false);
      expect(result.summary.totalCompetencies).toBe(5);
      expect(result.summary.level2Count).toBe(1);
      expect(result.summary.missingCompetencies).toContain('Need 2 competencies at Level 2 (currently have 1)');
    });
  });

  describe('updatePERTResponse', () => {
    it('should update an existing PERT response', async () => {
      const updates = {
        responseText: 'Updated PERT response text',
        situationText: 'Updated situation',
        taskText: 'Updated task',
        actionText: 'Updated action',
        resultText: 'Updated result'
      };

      mockDb.execute
        .mockResolvedValueOnce({ rows: [{ response_id: 'resp123' }] }) // Check existing
        .mockResolvedValueOnce({ rows: [] }); // Update

      const result = await cpaPertService.updatePERTResponse(
        'test_user',
        'resp123',
        updates
      );

      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE cn_cpa_pert_responses'),
        expect.arrayContaining([
          updates.responseText,
          updates.situationText,
          updates.taskText,
          updates.actionText,
          updates.resultText
        ])
      );
      expect(result.response_id).toBe('resp123');
    });

    it('should handle non-existent response', async () => {
      mockDb.execute.mockResolvedValueOnce({ rows: [] });

      await expect(cpaPertService.updatePERTResponse('test_user', 'invalid', {}))
        .rejects.toThrow('PERT response not found');
    });
  });

  describe('getPERTResponses', () => {
    it('should retrieve PERT responses with pagination', async () => {
      const mockResponses = [
        {
          response_id: 'resp1',
          experience_id: 'exp1',
          competency_id: '1',
          proficiency_level: 2,
          response_text: 'PERT response 1'
        },
        {
          response_id: 'resp2',
          experience_id: 'exp2',
          competency_id: '2',
          proficiency_level: 1,
          response_text: 'PERT response 2'
        }
      ];

      mockDb.execute.mockResolvedValueOnce({ rows: mockResponses });

      const result = await cpaPertService.getPERTResponses('test_user', 10, 0);

      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY created_at DESC'),
        ['test_user', 10, 0]
      );
      expect(result).toEqual(mockResponses);
    });

    it('should filter by experience ID when provided', async () => {
      mockDb.execute.mockResolvedValueOnce({ rows: [] });

      await cpaPertService.getPERTResponses('test_user', 10, 0, 'exp123');

      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining('AND experience_id = ?'),
        ['test_user', 'exp123', 10, 0]
      );
    });
  });

  describe('getCompetencyReport', () => {
    it('should generate a comprehensive competency report', async () => {
      const mockProficiencies = [
        {
          competency_id: '1',
          sub_code: 'FR1',
          sub_name: 'Financial Reporting',
          category: 'Technical',
          current_level: 2,
          evidence_count: 3,
          target_level: 2
        }
      ];

      const mockCompliance = {
        isCompliant: true,
        summary: {
          totalCompetencies: 8,
          level2Count: 2,
          level1OrHigherCount: 8,
          missingCompetencies: []
        }
      };

      mockDb.execute
        .mockResolvedValueOnce({ rows: mockProficiencies }) // Proficiencies
        .mockResolvedValueOnce({ rows: mockProficiencies }) // For compliance check
        .mockResolvedValueOnce({ rows: [] }); // Insert compliance check

      const result = await cpaPertService.getCompetencyReport('test_user');

      expect(result).toHaveProperty('summary');
      expect(result).toHaveProperty('competencyDetails');
      expect(result).toHaveProperty('developmentPlan');
      expect(result).toHaveProperty('compliance');
      expect(result.competencyDetails).toEqual(mockProficiencies);
    });
  });
});