const ExperienceService = require('../../../src/services/experienceService');
const DatabaseService = require('../../../src/services/database');
const { encryptionService } = require('../../../src/services/encryption');

jest.mock('../../../src/services/database');
jest.mock('../../../src/services/encryption');

describe('ExperienceService', () => {
  let experienceService;
  let mockDb;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    mockDb = {
      query: jest.fn(),
      transaction: jest.fn()
    };
    
    DatabaseService.mockImplementation(() => mockDb);
    experienceService = new ExperienceService();
    experienceService.db = mockDb;
  });

  describe('createExperience', () => {
    it('should create a new experience', async () => {
      const experienceData = {
        userId: 'user-123',
        title: 'Senior Developer',
        company: 'Tech Corp',
        startDate: '2020-01-01',
        endDate: '2023-12-31',
        description: 'Led development team',
        skills: ['JavaScript', 'React', 'Node.js']
      };
      
      mockDb.transaction.mockImplementation(async (callback) => {
        const mockClient = {
          execute: jest.fn()
            .mockResolvedValueOnce({ 
              rows: [{ id: 'exp-123', ...experienceData }] 
            })
            .mockResolvedValue({ rowsAffected: 1 })
        };
        return callback(mockClient);
      });
      
      const result = await experienceService.createExperience(experienceData);
      
      expect(result).toHaveProperty('id', 'exp-123');
      expect(result).toHaveProperty('title', 'Senior Developer');
      expect(mockDb.transaction).toHaveBeenCalled();
    });

    it('should encrypt sensitive fields', async () => {
      const experienceData = {
        userId: 'user-123',
        title: 'Confidential Role',
        company: 'Secret Company',
        salary: 100000
      };
      
      encryptionService.encryptField = jest.fn().mockImplementation((val) => `encrypted_${val}`);
      
      mockDb.transaction.mockImplementation(async (callback) => {
        const mockClient = {
          execute: jest.fn().mockResolvedValue({ 
            rows: [{ id: 'exp-123' }] 
          })
        };
        return callback(mockClient);
      });
      
      await experienceService.createExperience(experienceData);
      
      expect(encryptionService.encryptField).toHaveBeenCalledWith('Secret Company', 'user-123');
    });

    it('should extract and store skills', async () => {
      const experienceData = {
        userId: 'user-123',
        title: 'Developer',
        description: 'Worked with Python, Django, and PostgreSQL',
        skills: ['Python', 'Django', 'PostgreSQL']
      };
      
      mockDb.transaction.mockImplementation(async (callback) => {
        const mockClient = {
          execute: jest.fn().mockResolvedValue({ 
            rows: [{ id: 'exp-123' }] 
          })
        };
        return callback(mockClient);
      });
      
      await experienceService.createExperience(experienceData);
      
      expect(mockDb.transaction).toHaveBeenCalled();
      const transactionCallback = mockDb.transaction.mock.calls[0][0];
      const mockClient = { execute: jest.fn().mockResolvedValue({ rows: [{ id: 'exp-123' }] }) };
      await transactionCallback(mockClient);
      
      expect(mockClient.execute).toHaveBeenCalledWith(
        expect.stringContaining('experience_skills'),
        expect.any(Object)
      );
    });
  });

  describe('getExperienceById', () => {
    it('should get experience by ID', async () => {
      const mockExperience = {
        id: 'exp-123',
        title: 'Developer',
        company: 'encrypted_company',
        skills: ['JavaScript', 'React']
      };
      
      mockDb.query
        .mockResolvedValueOnce({ rows: [mockExperience] })
        .mockResolvedValueOnce({ rows: [
          { skill_name: 'JavaScript' },
          { skill_name: 'React' }
        ]});
      
      encryptionService.decryptField = jest.fn().mockReturnValue('Tech Corp');
      
      const result = await experienceService.getExperienceById('exp-123', 'user-123');
      
      expect(result).toHaveProperty('id', 'exp-123');
      expect(result).toHaveProperty('skills');
      expect(result.skills).toHaveLength(2);
    });

    it('should return null for non-existent experience', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });
      
      const result = await experienceService.getExperienceById('non-existent', 'user-123');
      
      expect(result).toBeNull();
    });
  });

  describe('getUserExperiences', () => {
    it('should get all user experiences', async () => {
      const mockExperiences = [
        { id: 'exp-1', title: 'Developer', start_date: '2020-01-01' },
        { id: 'exp-2', title: 'Senior Developer', start_date: '2022-01-01' }
      ];
      
      mockDb.query.mockResolvedValue({ rows: mockExperiences });
      
      const result = await experienceService.getUserExperiences('user-123');
      
      expect(result).toHaveLength(2);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY start_date DESC'),
        expect.objectContaining({ userId: 'user-123' })
      );
    });

    it('should filter by date range', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });
      
      await experienceService.getUserExperiences('user-123', {
        startDate: '2020-01-01',
        endDate: '2023-12-31'
      });
      
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('start_date >= :startDate'),
        expect.objectContaining({
          startDate: '2020-01-01',
          endDate: '2023-12-31'
        })
      );
    });
  });

  describe('updateExperience', () => {
    it('should update experience', async () => {
      const updates = {
        title: 'Lead Developer',
        endDate: '2024-01-01'
      };
      
      mockDb.query.mockResolvedValue({ 
        rows: [{ 
          id: 'exp-123',
          title: 'Lead Developer',
          end_date: '2024-01-01'
        }],
        rowsAffected: 1
      });
      
      const result = await experienceService.updateExperience('exp-123', 'user-123', updates);
      
      expect(result).toHaveProperty('title', 'Lead Developer');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE'),
        expect.objectContaining({
          id: 'exp-123',
          userId: 'user-123',
          title: 'Lead Developer'
        })
      );
    });

    it('should not update if not owner', async () => {
      mockDb.query.mockResolvedValue({ rows: [], rowsAffected: 0 });
      
      const result = await experienceService.updateExperience(
        'exp-123',
        'different-user',
        { title: 'New Title' }
      );
      
      expect(result).toBeNull();
    });
  });

  describe('deleteExperience', () => {
    it('should delete experience', async () => {
      mockDb.transaction.mockImplementation(async (callback) => {
        const mockClient = {
          execute: jest.fn().mockResolvedValue({ rowsAffected: 1 })
        };
        return callback(mockClient);
      });
      
      const result = await experienceService.deleteExperience('exp-123', 'user-123');
      
      expect(result).toBe(true);
      expect(mockDb.transaction).toHaveBeenCalled();
    });

    it('should not delete if not owner', async () => {
      mockDb.transaction.mockImplementation(async (callback) => {
        const mockClient = {
          execute: jest.fn().mockResolvedValue({ rowsAffected: 0 })
        };
        return callback(mockClient);
      });
      
      const result = await experienceService.deleteExperience('exp-123', 'different-user');
      
      expect(result).toBe(false);
    });
  });

  describe('extractSkills', () => {
    it('should extract skills from description', () => {
      const description = 'Experienced in JavaScript, React, Node.js, and MongoDB. Also worked with Docker and Kubernetes.';
      
      const skills = experienceService.extractSkills(description);
      
      expect(skills).toContain('JavaScript');
      expect(skills).toContain('React');
      expect(skills).toContain('Docker');
      expect(skills.length).toBeGreaterThan(3);
    });

    it('should remove duplicates', () => {
      const description = 'JavaScript expert with JavaScript and React. More JavaScript experience.';
      
      const skills = experienceService.extractSkills(description);
      
      const jsCount = skills.filter(s => s === 'JavaScript').length;
      expect(jsCount).toBe(1);
    });
  });

  describe('analyzeExperience', () => {
    it('should analyze experience and generate insights', async () => {
      const experienceId = 'exp-123';
      
      mockDb.query
        .mockResolvedValueOnce({ 
          rows: [{ 
            id: experienceId,
            title: 'Senior Developer',
            description: 'Led team of 5 developers',
            start_date: '2020-01-01',
            end_date: '2023-12-31'
          }] 
        })
        .mockResolvedValueOnce({ 
          rows: [
            { skill_name: 'Leadership' },
            { skill_name: 'JavaScript' }
          ] 
        });
      
      const analysis = await experienceService.analyzeExperience(experienceId, 'user-123');
      
      expect(analysis).toHaveProperty('duration');
      expect(analysis).toHaveProperty('skillsCount', 2);
      expect(analysis).toHaveProperty('insights');
      expect(analysis.insights).toContain('leadership');
    });
  });

  describe('generateSummary', () => {
    it('should generate experience summary', async () => {
      const mockExperiences = [
        { 
          id: 'exp-1',
          title: 'Developer',
          company: 'Company A',
          start_date: '2018-01-01',
          end_date: '2020-12-31'
        },
        { 
          id: 'exp-2',
          title: 'Senior Developer',
          company: 'Company B',
          start_date: '2021-01-01',
          end_date: null
        }
      ];
      
      mockDb.query.mockResolvedValue({ rows: mockExperiences });
      
      const summary = await experienceService.generateSummary('user-123');
      
      expect(summary).toHaveProperty('totalExperiences', 2);
      expect(summary).toHaveProperty('totalYears');
      expect(summary).toHaveProperty('currentRole', 'Senior Developer');
      expect(summary).toHaveProperty('companies');
      expect(summary.companies).toHaveLength(2);
    });
  });

  describe('searchExperiences', () => {
    it('should search experiences by keyword', async () => {
      const mockResults = [
        { id: 'exp-1', title: 'JavaScript Developer' },
        { id: 'exp-2', title: 'React Developer' }
      ];
      
      mockDb.query.mockResolvedValue({ rows: mockResults });
      
      const results = await experienceService.searchExperiences('user-123', 'JavaScript');
      
      expect(results).toHaveLength(2);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('LIKE'),
        expect.objectContaining({
          searchTerm: '%JavaScript%'
        })
      );
    });

    it('should search with filters', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });
      
      await experienceService.searchExperiences('user-123', 'Developer', {
        company: 'Tech Corp',
        skills: ['React', 'Node.js']
      });
      
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('company'),
        expect.objectContaining({
          company: '%Tech Corp%',
          skills: ['React', 'Node.js']
        })
      );
    });
  });

  describe('exportExperiences', () => {
    it('should export experiences to JSON format', async () => {
      const mockExperiences = [
        { id: 'exp-1', title: 'Developer' },
        { id: 'exp-2', title: 'Senior Developer' }
      ];
      
      mockDb.query.mockResolvedValue({ rows: mockExperiences });
      
      const exported = await experienceService.exportExperiences('user-123', 'json');
      
      expect(exported).toHaveProperty('format', 'json');
      expect(exported).toHaveProperty('data');
      expect(JSON.parse(exported.data)).toHaveLength(2);
    });

    it('should export experiences to CSV format', async () => {
      const mockExperiences = [
        { id: 'exp-1', title: 'Developer', company: 'Company A' }
      ];
      
      mockDb.query.mockResolvedValue({ rows: mockExperiences });
      
      const exported = await experienceService.exportExperiences('user-123', 'csv');
      
      expect(exported).toHaveProperty('format', 'csv');
      expect(exported.data).toContain('title,company');
      expect(exported.data).toContain('Developer,Company A');
    });
  });
});