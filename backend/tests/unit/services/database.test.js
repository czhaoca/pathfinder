const DatabaseService = require('../../../src/services/database');
const oracledb = require('oracledb');

// Use the manual mock
jest.mock('oracledb');

describe('DatabaseService', () => {
  let dbService;
  
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset singleton instance
    DatabaseService.instance = null;
    dbService = new DatabaseService();
  });

  afterEach(() => {
    if (oracledb.__resetMocks) {
      oracledb.__resetMocks();
    }
  });

  describe('initialization', () => {
    it('should create a singleton instance', () => {
      const instance1 = new DatabaseService();
      const instance2 = new DatabaseService();
      expect(instance1).toBe(instance2);
    });

    it('should initialize connection pool', async () => {
      await dbService.initialize();
      
      expect(oracledb.createPool).toHaveBeenCalledWith(
        expect.objectContaining({
          poolMin: expect.any(Number),
          poolMax: expect.any(Number),
          poolIncrement: expect.any(Number)
        })
      );
      expect(dbService.pool).toBeDefined();
    });

    it('should handle initialization errors', async () => {
      oracledb.createPool.mockRejectedValueOnce(new Error('Connection failed'));
      
      await expect(dbService.initialize()).rejects.toThrow('Connection failed');
    });
  });

  describe('query execution', () => {
    beforeEach(async () => {
      await dbService.initialize();
    });

    it('should execute a simple query', async () => {
      const mockRows = [{ id: 1, name: 'Test' }];
      const mockConnection = {
        execute: jest.fn().mockResolvedValue({ rows: mockRows }),
        close: jest.fn().mockResolvedValue(undefined)
      };
      
      dbService.pool.getConnection.mockResolvedValueOnce(mockConnection);
      
      const result = await dbService.query('SELECT * FROM users');
      
      expect(mockConnection.execute).toHaveBeenCalledWith(
        'SELECT * FROM users',
        {},
        expect.any(Object)
      );
      expect(result).toEqual({ rows: mockRows });
      expect(mockConnection.close).toHaveBeenCalled();
    });

    it('should execute query with bindings', async () => {
      const mockRows = [{ id: 1, name: 'John' }];
      const mockConnection = {
        execute: jest.fn().mockResolvedValue({ rows: mockRows }),
        close: jest.fn().mockResolvedValue(undefined)
      };
      
      dbService.pool.getConnection.mockResolvedValueOnce(mockConnection);
      
      const result = await dbService.query(
        'SELECT * FROM users WHERE id = :id',
        { id: 1 }
      );
      
      expect(mockConnection.execute).toHaveBeenCalledWith(
        'SELECT * FROM users WHERE id = :id',
        { id: 1 },
        expect.any(Object)
      );
      expect(result).toEqual({ rows: mockRows });
    });

    it('should handle query errors', async () => {
      const mockConnection = {
        execute: jest.fn().mockRejectedValue(new Error('Query failed')),
        close: jest.fn().mockResolvedValue(undefined)
      };
      
      dbService.pool.getConnection.mockResolvedValueOnce(mockConnection);
      
      await expect(dbService.query('INVALID SQL')).rejects.toThrow('Query failed');
      expect(mockConnection.close).toHaveBeenCalled();
    });

    it('should handle connection errors', async () => {
      dbService.pool.getConnection.mockRejectedValueOnce(new Error('No connections available'));
      
      await expect(dbService.query('SELECT 1 FROM dual')).rejects.toThrow('No connections available');
    });
  });

  describe('transactions', () => {
    beforeEach(async () => {
      await dbService.initialize();
    });

    it('should execute transaction successfully', async () => {
      const mockConnection = {
        execute: jest.fn().mockResolvedValue({ rowsAffected: 1 }),
        commit: jest.fn().mockResolvedValue(undefined),
        rollback: jest.fn().mockResolvedValue(undefined),
        close: jest.fn().mockResolvedValue(undefined)
      };
      
      dbService.pool.getConnection.mockResolvedValueOnce(mockConnection);
      
      const result = await dbService.transaction(async (conn) => {
        await conn.execute('INSERT INTO users VALUES (:1)', [1]);
        return { success: true };
      });
      
      expect(result).toEqual({ success: true });
      expect(mockConnection.commit).toHaveBeenCalled();
      expect(mockConnection.rollback).not.toHaveBeenCalled();
      expect(mockConnection.close).toHaveBeenCalled();
    });

    it('should rollback transaction on error', async () => {
      const mockConnection = {
        execute: jest.fn().mockRejectedValue(new Error('Insert failed')),
        commit: jest.fn().mockResolvedValue(undefined),
        rollback: jest.fn().mockResolvedValue(undefined),
        close: jest.fn().mockResolvedValue(undefined)
      };
      
      dbService.pool.getConnection.mockResolvedValueOnce(mockConnection);
      
      await expect(
        dbService.transaction(async (conn) => {
          await conn.execute('INSERT INTO users VALUES (:1)', [1]);
        })
      ).rejects.toThrow('Insert failed');
      
      expect(mockConnection.rollback).toHaveBeenCalled();
      expect(mockConnection.commit).not.toHaveBeenCalled();
      expect(mockConnection.close).toHaveBeenCalled();
    });
  });

  describe('health check', () => {
    beforeEach(async () => {
      await dbService.initialize();
    });

    it('should return healthy status when pool is open', async () => {
      dbService.pool.status = oracledb.POOL_STATUS_OPEN;
      dbService.pool.connectionsOpen = 5;
      dbService.pool.connectionsInUse = 2;
      
      const mockConnection = {
        execute: jest.fn().mockResolvedValue({ rows: [[1]] }),
        close: jest.fn().mockResolvedValue(undefined)
      };
      
      dbService.pool.getConnection.mockResolvedValueOnce(mockConnection);
      
      const health = await dbService.getHealth();
      
      expect(health).toEqual({
        status: 'healthy',
        pool: {
          status: 'open',
          connectionsOpen: 5,
          connectionsInUse: 2
        },
        responseTime: expect.any(Number)
      });
    });

    it('should return unhealthy status when pool is closed', async () => {
      dbService.pool.status = oracledb.POOL_STATUS_CLOSED;
      
      const health = await dbService.getHealth();
      
      expect(health.status).toBe('unhealthy');
      expect(health.pool.status).toBe('closed');
    });

    it('should handle health check query failure', async () => {
      dbService.pool.status = oracledb.POOL_STATUS_OPEN;
      
      const mockConnection = {
        execute: jest.fn().mockRejectedValue(new Error('Health check failed')),
        close: jest.fn().mockResolvedValue(undefined)
      };
      
      dbService.pool.getConnection.mockResolvedValueOnce(mockConnection);
      
      const health = await dbService.getHealth();
      
      expect(health.status).toBe('unhealthy');
      expect(health.error).toBe('Health check failed');
    });
  });

  describe('connection pool management', () => {
    beforeEach(async () => {
      await dbService.initialize();
    });

    it('should close connection pool', async () => {
      await dbService.close();
      
      expect(dbService.pool.close).toHaveBeenCalled();
      expect(dbService.pool).toBeNull();
    });

    it('should handle close errors gracefully', async () => {
      dbService.pool.close.mockRejectedValueOnce(new Error('Close failed'));
      
      // Should not throw
      await dbService.close();
      
      expect(dbService.pool).toBeNull();
    });

    it('should get pool statistics', () => {
      dbService.pool.connectionsOpen = 10;
      dbService.pool.connectionsInUse = 3;
      
      const stats = dbService.getPoolStatistics();
      
      expect(stats).toEqual({
        connectionsOpen: 10,
        connectionsInUse: 3,
        connectionsAvailable: 7
      });
    });
  });

  describe('utility methods', () => {
    beforeEach(async () => {
      await dbService.initialize();
    });

    it('should execute stored procedure', async () => {
      const mockConnection = {
        execute: jest.fn().mockResolvedValue({
          outBinds: { result: 'success', data: [1, 2, 3] }
        }),
        close: jest.fn().mockResolvedValue(undefined)
      };
      
      dbService.pool.getConnection.mockResolvedValueOnce(mockConnection);
      
      const result = await dbService.executeProcedure('sp_test', {
        input: 'test',
        output: { type: oracledb.STRING, dir: oracledb.BIND_OUT }
      });
      
      expect(mockConnection.execute).toHaveBeenCalledWith(
        expect.stringContaining('BEGIN'),
        expect.objectContaining({ input: 'test' }),
        expect.any(Object)
      );
      expect(result).toEqual({ result: 'success', data: [1, 2, 3] });
    });

    it('should handle batch inserts', async () => {
      const mockConnection = {
        executeMany: jest.fn().mockResolvedValue({ rowsAffected: 3 }),
        commit: jest.fn().mockResolvedValue(undefined),
        close: jest.fn().mockResolvedValue(undefined)
      };
      
      dbService.pool.getConnection.mockResolvedValueOnce(mockConnection);
      
      const data = [
        { id: 1, name: 'John' },
        { id: 2, name: 'Jane' },
        { id: 3, name: 'Bob' }
      ];
      
      const result = await dbService.batchInsert('users', data);
      
      expect(mockConnection.executeMany).toHaveBeenCalled();
      expect(mockConnection.commit).toHaveBeenCalled();
      expect(result.rowsAffected).toBe(3);
    });
  });

  describe('error handling', () => {
    it('should handle missing pool error', async () => {
      dbService.pool = null;
      
      await expect(dbService.query('SELECT 1 FROM dual'))
        .rejects.toThrow('Database connection not initialized');
    });

    it('should retry on connection failure', async () => {
      await dbService.initialize();
      
      const mockConnection = {
        execute: jest.fn().mockResolvedValue({ rows: [] }),
        close: jest.fn().mockResolvedValue(undefined)
      };
      
      // Fail twice, then succeed
      dbService.pool.getConnection
        .mockRejectedValueOnce(new Error('Connection failed'))
        .mockRejectedValueOnce(new Error('Connection failed'))
        .mockResolvedValueOnce(mockConnection);
      
      const result = await dbService.query('SELECT 1 FROM dual', {}, { retries: 3 });
      
      expect(dbService.pool.getConnection).toHaveBeenCalledTimes(3);
      expect(result).toEqual({ rows: [] });
    });
  });
});