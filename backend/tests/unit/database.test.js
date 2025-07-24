/**
 * Unit Tests for Database Manager
 * Tests core database functionality without requiring actual Oracle connection
 */

const DatabaseManager = require('../../src/services/database');

// Mock oracledb for unit testing
jest.mock('oracledb', () => ({
  initOracleClient: jest.fn(),
  createPool: jest.fn(),
  getConnection: jest.fn(),
  OUT_FORMAT_OBJECT: 4002,
  BIND_OUT: 3003,
  STRING: 2001
}));

// Mock winston for logging
jest.mock('winston', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    add: jest.fn()
  })),
  format: {
    combine: jest.fn(),
    timestamp: jest.fn(),
    json: jest.fn(),
    colorize: jest.fn(),
    simple: jest.fn()
  },
  transports: {
    Console: jest.fn(),
    File: jest.fn()
  }
}));

// Mock config
jest.mock('../../config/mcp-config', () => ({
  environment: 'test',
  database: {
    test: {
      username: 'test_user',
      password: 'test_password',
      serviceName: 'test_service',
      walletLocation: './test-wallet',
      walletPassword: '',
      pool: {
        min: 2,
        max: 8,
        increment: 1,
        timeout: 60000,
        pingInterval: 60,
        enableStatistics: true
      },
      options: {
        autoCommit: false,
        fetchAsString: ['CLOB'],
        outFormat: 4002
      }
    }
  },
  monitoring: {
    enableHealthCheck: false,
    healthCheckInterval: 30000
  },
  logging: {
    level: 'error',
    enableQueryLogging: false,
    enablePerformanceLogging: false
  }
}));

describe('DatabaseManager', () => {
  let mockPool;
  let mockConnection;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Setup mock connection
    mockConnection = {
      execute: jest.fn(),
      close: jest.fn().mockResolvedValue(undefined)
    };
    
    // Setup mock pool
    mockPool = {
      getConnection: jest.fn().mockResolvedValue(mockConnection),
      close: jest.fn().mockResolvedValue(undefined),
      connectionsInUse: 1,
      connectionsOpen: 2
    };
    
    const oracledb = require('oracledb');
    oracledb.createPool.mockResolvedValue(mockPool);
    
    // Reset database manager state
    DatabaseManager.pool = null;
    DatabaseManager.isInitialized = false;
    DatabaseManager.connectionStats = {
      totalConnections: 0,
      activeConnections: 0,
      errors: 0,
      queries: 0,
      avgResponseTime: 0
    };
  });

  afterEach(async () => {
    // Clean up any remaining connections
    if (DatabaseManager.pool) {
      await DatabaseManager.close();
    }
  });

  describe('Initialization', () => {
    test('should initialize successfully', async () => {
      await DatabaseManager.initialize();
      
      expect(DatabaseManager.isInitialized).toBe(true);
      expect(DatabaseManager.pool).toBe(mockPool);
      
      const oracledb = require('oracledb');
      expect(oracledb.createPool).toHaveBeenCalledWith(
        expect.objectContaining({
          user: 'test_user',
          password: 'test_password',
          connectString: 'test_service'
        })
      );
    });

    test('should handle initialization failure', async () => {
      const oracledb = require('oracledb');
      oracledb.createPool.mockRejectedValue(new Error('Connection failed'));
      
      await expect(DatabaseManager.initialize()).rejects.toThrow('Connection failed');
      expect(DatabaseManager.isInitialized).toBe(false);
    });
  });

  describe('Connection Management', () => {
    beforeEach(async () => {
      await DatabaseManager.initialize();
    });

    test('should get connection from pool', async () => {
      const connection = await DatabaseManager.getConnection();
      
      expect(connection).toBe(mockConnection);
      expect(mockPool.getConnection).toHaveBeenCalled();
      expect(DatabaseManager.connectionStats.totalConnections).toBe(1);
      expect(DatabaseManager.connectionStats.activeConnections).toBe(1);
    });

    test('should handle connection failure', async () => {
      mockPool.getConnection.mockRejectedValue(new Error('Pool exhausted'));
      
      await expect(DatabaseManager.getConnection()).rejects.toThrow('Pool exhausted');
      expect(DatabaseManager.connectionStats.errors).toBe(1);
    });

    test('should update stats on connection close', async () => {
      const connection = await DatabaseManager.getConnection();
      
      expect(DatabaseManager.connectionStats.activeConnections).toBe(1);
      
      await connection.close();
      
      expect(DatabaseManager.connectionStats.activeConnections).toBe(0);
      expect(mockConnection.close).toHaveBeenCalled();
    });
  });

  describe('Query Execution', () => {
    beforeEach(async () => {
      await DatabaseManager.initialize();
    });

    test('should execute query successfully', async () => {
      const mockResult = { rows: [{ test: 1 }] };
      mockConnection.execute.mockResolvedValue(mockResult);
      
      const result = await DatabaseManager.executeQuery('SELECT 1 as test FROM DUAL');
      
      expect(result).toBe(mockResult);
      expect(mockConnection.execute).toHaveBeenCalledWith(
        'SELECT 1 as test FROM DUAL',
        {},
        expect.objectContaining({ autoCommit: false })
      );
      expect(DatabaseManager.connectionStats.queries).toBe(1);
    });

    test('should handle query failure', async () => {
      mockConnection.execute.mockRejectedValue(new Error('SQL error'));
      
      await expect(DatabaseManager.executeQuery('INVALID SQL')).rejects.toThrow('SQL error');
      expect(DatabaseManager.connectionStats.errors).toBe(1);
    });

    test('should execute query with binds and options', async () => {
      const mockResult = { rows: [{ name: 'test' }] };
      mockConnection.execute.mockResolvedValue(mockResult);
      
      const binds = { id: 1 };
      const options = { autoCommit: true };
      
      await DatabaseManager.executeQuery('SELECT * FROM test WHERE id = :id', binds, options);
      
      expect(mockConnection.execute).toHaveBeenCalledWith(
        'SELECT * FROM test WHERE id = :id',
        binds,
        expect.objectContaining({ autoCommit: true })
      );
    });
  });

  describe('Health Check', () => {
    beforeEach(async () => {
      await DatabaseManager.initialize();
    });

    test('should return healthy status', async () => {
      mockConnection.execute.mockResolvedValue({ rows: [{ health_check: 1 }] });
      
      const health = await DatabaseManager.healthCheck();
      
      expect(health.status).toBe('healthy');
      expect(health.environment).toBe('test');
      expect(health.responseTime).toMatch(/\d+ms/);
      expect(health.poolStats).toBeDefined();
      expect(health.connectionStats).toBeDefined();
    });

    test('should return unhealthy status on failure', async () => {
      mockConnection.execute.mockRejectedValue(new Error('Database down'));
      
      const health = await DatabaseManager.healthCheck();
      
      expect(health.status).toBe('unhealthy');
      expect(health.error).toBe('Database down');
    });
  });

  describe('MCP-Specific Methods', () => {
    beforeEach(async () => {
      await DatabaseManager.initialize();
    });

    describe('getQuickContext', () => {
      test('should return quick context data', async () => {
        const mockData = {
          EXECUTIVE_SUMMARY: 'Test summary',
          KEY_SKILLS: '["JavaScript", "Node.js"]',
          CAREER_GOALS: 'Test goals',
          YEARS_EXPERIENCE: 5,
          CURRENT_ROLE: 'Developer',
          INDUSTRIES: '["Technology"]',
          EDUCATION_LEVEL: 'Bachelor',
          LOCATION: 'Test City',
          AVAILABILITY: 'Available',
          LAST_UPDATED: new Date()
        };
        
        mockConnection.execute.mockResolvedValue({ rows: [mockData] });
        
        const result = await DatabaseManager.getQuickContext();
        
        expect(result).toBe(mockData);
        expect(mockConnection.execute).toHaveBeenCalledWith(
          expect.stringContaining('SELECT'),
          expect.any(Object)
        );
      });

      test('should return null when no data found', async () => {
        mockConnection.execute.mockResolvedValue({ rows: [] });
        
        const result = await DatabaseManager.getQuickContext();
        
        expect(result).toBeNull();
      });
    });

    describe('storeExperience', () => {
      test('should store experience successfully', async () => {
        const mockId = 'test-experience-id';
        mockConnection.execute.mockResolvedValue({
          outBinds: { id: mockId }
        });
        
        const experience = {
          title: 'Software Developer',
          organization: 'Test Company',
          description: 'Test description',
          startDate: '2023-01-01',
          endDate: '2023-12-31',
          isCurrent: false,
          experienceType: 'work',
          extractedSkills: [{ name: 'JavaScript', category: 'technical' }],
          keyHighlights: [{ description: 'Built app', impact: 'high' }]
        };
        
        const result = await DatabaseManager.storeExperience(experience);
        
        expect(result).toBe(mockId);
        expect(mockConnection.execute).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO experiences_detailed'),
          expect.objectContaining({
            title: 'Software Developer',
            organization: 'Test Company',
            isCurrent: 0
          }),
          expect.objectContaining({ autoCommit: true })
        );
      });
    });

    describe('searchExperiences', () => {
      test('should search experiences with filters', async () => {
        const mockExperiences = [
          {
            ID: 'exp1',
            TITLE: 'Developer',
            ORGANIZATION: 'Company A',
            EXPERIENCE_TYPE: 'work'
          },
          {
            ID: 'exp2', 
            TITLE: 'Analyst',
            ORGANIZATION: 'Company B',
            EXPERIENCE_TYPE: 'work'
          }
        ];
        
        mockConnection.execute.mockResolvedValue({ rows: mockExperiences });
        
        const filters = {
          experienceType: 'work',
          searchText: 'Developer',
          limit: 10
        };
        
        const result = await DatabaseManager.searchExperiences(filters);
        
        expect(result).toBe(mockExperiences);
        expect(mockConnection.execute).toHaveBeenCalledWith(
          expect.stringContaining('WHERE 1 = 1'),
          expect.objectContaining({
            experienceType: 'work',
            searchText: '%Developer%',
            limit: 10
          })
        );
      });

      test('should handle empty search results', async () => {
        mockConnection.execute.mockResolvedValue({ rows: [] });
        
        const result = await DatabaseManager.searchExperiences({});
        
        expect(result).toEqual([]);
      });
    });

    describe('updateProfileSummary', () => {
      test('should update existing profile', async () => {
        // Mock successful update (1 row affected)
        mockConnection.execute.mockResolvedValueOnce({ rowsAffected: 1 });
        
        const profileData = {
          coreStrengths: { technical: ['JavaScript', 'Node.js'] },
          careerInterests: { areas: ['Full Stack Development'] }
        };
        
        await DatabaseManager.updateProfileSummary(profileData);
        
        expect(mockConnection.execute).toHaveBeenCalledWith(
          expect.stringContaining('UPDATE profile_summaries'),
          expect.objectContaining({
            coreStrengths: JSON.stringify(profileData.coreStrengths),
            careerInterests: JSON.stringify(profileData.careerInterests)
          }),
          expect.objectContaining({ autoCommit: true })
        );
      });

      test('should insert new profile when no existing record', async () => {
        // Mock failed update (0 rows affected), then successful insert
        mockConnection.execute
          .mockResolvedValueOnce({ rowsAffected: 0 })
          .mockResolvedValueOnce({ rowsAffected: 1 });
        
        const profileData = {
          coreStrengths: { technical: ['Python'] }
        };
        
        await DatabaseManager.updateProfileSummary(profileData);
        
        // Should call both UPDATE and INSERT
        expect(mockConnection.execute).toHaveBeenCalledTimes(2);
        expect(mockConnection.execute).toHaveBeenLastCalledWith(
          expect.stringContaining('INSERT INTO profile_summaries'),
          expect.any(Object),
          expect.objectContaining({ autoCommit: true })
        );
      });
    });
  });

  describe('Performance Tracking', () => {
    beforeEach(async () => {
      await DatabaseManager.initialize();
    });

    test('should track query performance metrics', async () => {
      mockConnection.execute.mockResolvedValue({ rows: [] });
      
      // Execute multiple queries to test average calculation
      await DatabaseManager.executeQuery('SELECT 1 FROM DUAL');
      await DatabaseManager.executeQuery('SELECT 2 FROM DUAL');
      await DatabaseManager.executeQuery('SELECT 3 FROM DUAL');
      
      expect(DatabaseManager.connectionStats.queries).toBe(3);
      expect(DatabaseManager.connectionStats.avgResponseTime).toBeGreaterThan(0);
    });

    test('should track connection statistics', async () => {
      const connection1 = await DatabaseManager.getConnection();
      const connection2 = await DatabaseManager.getConnection();
      
      expect(DatabaseManager.connectionStats.totalConnections).toBe(2);
      expect(DatabaseManager.connectionStats.activeConnections).toBe(2);
      
      await connection1.close();
      expect(DatabaseManager.connectionStats.activeConnections).toBe(1);
      
      await connection2.close();
      expect(DatabaseManager.connectionStats.activeConnections).toBe(0);
    });
  });

  describe('Pool Statistics', () => {
    beforeEach(async () => {
      await DatabaseManager.initialize();
    });

    test('should return pool statistics', async () => {
      const stats = await DatabaseManager.getPoolStatistics();
      
      expect(stats).toEqual({
        connectionsInUse: 1,
        connectionsOpen: 2,
        poolMin: 2,
        poolMax: 8,
        poolIncrement: 1
      });
    });

    test('should return null when pool not initialized', async () => {
      await DatabaseManager.close();
      
      const stats = await DatabaseManager.getPoolStatistics();
      
      expect(stats).toBeNull();
    });
  });

  describe('Cleanup', () => {
    test('should close pool successfully', async () => {
      await DatabaseManager.initialize();
      
      await DatabaseManager.close();
      
      expect(mockPool.close).toHaveBeenCalledWith(10);
      expect(DatabaseManager.isInitialized).toBe(false);
    });

    test('should handle close errors gracefully', async () => {
      await DatabaseManager.initialize();
      mockPool.close.mockRejectedValue(new Error('Close failed'));
      
      // Should not throw, but log error
      await expect(DatabaseManager.close()).resolves.toBeUndefined();
    });
  });
});