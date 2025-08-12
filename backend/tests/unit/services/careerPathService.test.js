const CareerPathService = require('../../../src/services/careerPathService');
const DatabaseService = require('../../../src/services/database');

jest.mock('../../../src/services/database');
jest.mock('ulid', () => ({
  ulid: jest.fn(() => 'test-ulid-123')
}));

describe('CareerPathService', () => {
  let careerPathService;
  let mockDb;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    mockDb = {
      query: jest.fn(),
      transaction: jest.fn()
    };
    
    DatabaseService.mockImplementation(() => mockDb);
    careerPathService = new CareerPathService();
    careerPathService.db = mockDb;
  });

  describe('createCareerPath', () => {
    it('should create a new career path', async () => {
      const pathData = {
        userId: 'user-123',
        title: 'Software Engineering Manager',
        currentRole: 'Senior Developer',
        targetRole: 'Engineering Manager',
        timeframe: 24, // months
        skills: ['Leadership', 'Project Management', 'Architecture']
      };
      
      mockDb.transaction.mockImplementation(async (callback) => {
        const mockClient = {
          execute: jest.fn()
            .mockResolvedValueOnce({ 
              rows: [{ 
                id: 'path-123',
                ...pathData,
                created_at: new Date()
              }] 
            })
            .mockResolvedValue({ rowsAffected: 1 })
        };
        return callback(mockClient);
      });
      
      const result = await careerPathService.createCareerPath(pathData);
      
      expect(result).toHaveProperty('id', 'path-123');
      expect(result).toHaveProperty('title', 'Software Engineering Manager');
      expect(mockDb.transaction).toHaveBeenCalled();
    });

    it('should create milestones for the path', async () => {
      const pathData = {
        userId: 'user-123',
        title: 'Data Scientist',
        milestones: [
          { title: 'Learn Python', months: 3 },
          { title: 'Complete ML Course', months: 6 },
          { title: 'Build Portfolio', months: 9 }
        ]
      };
      
      mockDb.transaction.mockImplementation(async (callback) => {
        const mockClient = {
          execute: jest.fn().mockResolvedValue({ 
            rows: [{ id: 'path-123' }] 
          })
        };
        return callback(mockClient);
      });
      
      await careerPathService.createCareerPath(pathData);
      
      const transactionCallback = mockDb.transaction.mock.calls[0][0];
      const mockClient = { execute: jest.fn().mockResolvedValue({ rows: [{ id: 'path-123' }] }) };
      await transactionCallback(mockClient);
      
      expect(mockClient.execute).toHaveBeenCalledTimes(4); // 1 path + 3 milestones
    });
  });

  describe('getCareerPath', () => {
    it('should get career path by ID', async () => {
      const mockPath = {
        id: 'path-123',
        title: 'Product Manager',
        current_role: 'Developer',
        target_role: 'PM',
        milestones: []
      };
      
      mockDb.query
        .mockResolvedValueOnce({ rows: [mockPath] })
        .mockResolvedValueOnce({ rows: [] }); // milestones
      
      const result = await careerPathService.getCareerPath('path-123', 'user-123');
      
      expect(result).toHaveProperty('id', 'path-123');
      expect(result).toHaveProperty('title', 'Product Manager');
      expect(mockDb.query).toHaveBeenCalledTimes(2);
    });

    it('should include milestones with progress', async () => {
      const mockPath = { id: 'path-123', title: 'Tech Lead' };
      const mockMilestones = [
        { id: 'milestone-1', title: 'Lead First Project', completed: true },
        { id: 'milestone-2', title: 'Mentor Junior Devs', completed: false }
      ];
      
      mockDb.query
        .mockResolvedValueOnce({ rows: [mockPath] })
        .mockResolvedValueOnce({ rows: mockMilestones });
      
      const result = await careerPathService.getCareerPath('path-123', 'user-123');
      
      expect(result.milestones).toHaveLength(2);
      expect(result.milestones[0]).toHaveProperty('completed', true);
    });
  });

  describe('updateProgress', () => {
    it('should update milestone progress', async () => {
      mockDb.query.mockResolvedValue({ 
        rows: [{ 
          id: 'milestone-1',
          completed: true,
          completed_at: new Date()
        }],
        rowsAffected: 1
      });
      
      const result = await careerPathService.updateProgress(
        'path-123',
        'milestone-1',
        'user-123',
        { completed: true, notes: 'Finished successfully' }
      );
      
      expect(result).toHaveProperty('completed', true);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE'),
        expect.objectContaining({
          milestoneId: 'milestone-1',
          completed: true
        })
      );
    });
  });

  describe('suggestCareerPaths', () => {
    it('should suggest paths based on current role', async () => {
      const mockSuggestions = [
        { title: 'Senior Developer', match_score: 0.9 },
        { title: 'Tech Lead', match_score: 0.85 },
        { title: 'Solutions Architect', match_score: 0.8 }
      ];
      
      mockDb.query.mockResolvedValue({ rows: mockSuggestions });
      
      const suggestions = await careerPathService.suggestCareerPaths(
        'user-123',
        { currentRole: 'Developer', skills: ['JavaScript', 'React'] }
      );
      
      expect(suggestions).toHaveLength(3);
      expect(suggestions[0]).toHaveProperty('match_score', 0.9);
    });

    it('should filter by industry if specified', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });
      
      await careerPathService.suggestCareerPaths(
        'user-123',
        { industry: 'Healthcare' }
      );
      
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('industry'),
        expect.objectContaining({ industry: 'Healthcare' })
      );
    });
  });

  describe('analyzeSkillGaps', () => {
    it('should identify skill gaps for target role', async () => {
      const currentSkills = ['JavaScript', 'React', 'Node.js'];
      const targetSkills = ['JavaScript', 'React', 'Node.js', 'AWS', 'Docker', 'Kubernetes'];
      
      mockDb.query
        .mockResolvedValueOnce({ rows: currentSkills.map(s => ({ skill: s })) })
        .mockResolvedValueOnce({ rows: targetSkills.map(s => ({ skill: s, required: true })) });
      
      const gaps = await careerPathService.analyzeSkillGaps(
        'user-123',
        'path-123'
      );
      
      expect(gaps).toHaveProperty('missing');
      expect(gaps.missing).toContain('AWS');
      expect(gaps.missing).toContain('Docker');
      expect(gaps.missing).toContain('Kubernetes');
    });

    it('should calculate gap score', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ skill: 'JavaScript' }] })
        .mockResolvedValueOnce({ rows: [
          { skill: 'JavaScript', required: true },
          { skill: 'Python', required: true },
          { skill: 'AWS', required: true }
        ]});
      
      const gaps = await careerPathService.analyzeSkillGaps('user-123', 'path-123');
      
      expect(gaps).toHaveProperty('gapScore');
      expect(gaps.gapScore).toBeGreaterThan(0);
      expect(gaps.gapScore).toBeLessThanOrEqual(1);
    });
  });

  describe('getRecommendedResources', () => {
    it('should recommend learning resources for skill gaps', async () => {
      const mockResources = [
        { 
          type: 'course',
          title: 'AWS Certified Solutions Architect',
          provider: 'Udemy',
          url: 'https://udemy.com/aws-course'
        },
        {
          type: 'book',
          title: 'Docker Deep Dive',
          author: 'Nigel Poulton'
        }
      ];
      
      mockDb.query.mockResolvedValue({ rows: mockResources });
      
      const resources = await careerPathService.getRecommendedResources(
        'path-123',
        ['AWS', 'Docker']
      );
      
      expect(resources).toHaveLength(2);
      expect(resources[0]).toHaveProperty('type', 'course');
    });
  });

  describe('trackProgress', () => {
    it('should track overall career path progress', async () => {
      const mockMilestones = [
        { id: 'm1', completed: true },
        { id: 'm2', completed: true },
        { id: 'm3', completed: false },
        { id: 'm4', completed: false }
      ];
      
      mockDb.query.mockResolvedValue({ rows: mockMilestones });
      
      const progress = await careerPathService.trackProgress('path-123', 'user-123');
      
      expect(progress).toHaveProperty('completedMilestones', 2);
      expect(progress).toHaveProperty('totalMilestones', 4);
      expect(progress).toHaveProperty('percentComplete', 50);
    });

    it('should estimate time to completion', async () => {
      const mockData = {
        milestones: [
          { completed: false, estimated_months: 3 },
          { completed: false, estimated_months: 6 }
        ],
        average_completion_time: 4.5
      };
      
      mockDb.query.mockResolvedValue({ rows: mockData.milestones });
      
      const progress = await careerPathService.trackProgress('path-123', 'user-123');
      
      expect(progress).toHaveProperty('estimatedMonthsRemaining');
      expect(progress.estimatedMonthsRemaining).toBeGreaterThan(0);
    });
  });

  describe('shareCareerPath', () => {
    it('should generate shareable link for career path', async () => {
      mockDb.query.mockResolvedValue({ 
        rows: [{ 
          share_token: 'share-token-123',
          share_url: 'https://pathfinder.com/shared/share-token-123'
        }] 
      });
      
      const shareData = await careerPathService.shareCareerPath(
        'path-123',
        'user-123',
        { expiresIn: 7 } // days
      );
      
      expect(shareData).toHaveProperty('share_token');
      expect(shareData).toHaveProperty('share_url');
    });
  });

  describe('cloneCareerPath', () => {
    it('should clone existing career path for new user', async () => {
      const mockOriginalPath = {
        id: 'path-original',
        title: 'Data Engineer Path',
        milestones: [
          { title: 'Learn SQL', order: 1 },
          { title: 'Learn Python', order: 2 }
        ]
      };
      
      mockDb.query.mockResolvedValueOnce({ rows: [mockOriginalPath] });
      mockDb.transaction.mockImplementation(async (callback) => {
        const mockClient = {
          execute: jest.fn().mockResolvedValue({ 
            rows: [{ id: 'path-cloned' }] 
          })
        };
        return callback(mockClient);
      });
      
      const cloned = await careerPathService.cloneCareerPath(
        'path-original',
        'user-456'
      );
      
      expect(cloned).toHaveProperty('id', 'path-cloned');
      expect(mockDb.transaction).toHaveBeenCalled();
    });
  });
});