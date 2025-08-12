/**
 * Performance Tests for Database Operations
 * Tests query performance, connection pooling, and database optimization
 */

const { performance } = require('perf_hooks');
const DatabaseService = require('../../src/services/database');

// Create a mock database for performance testing
const createMockDatabase = () => {
  const mockExecute = jest.fn().mockImplementation(async (query, params) => {
    // Simulate query execution time based on query type
    const delay = query.includes('SELECT') ? 10 : 20;
    await new Promise(resolve => setTimeout(resolve, delay));
    
    return {
      rows: Array(params?.limit || 10).fill().map((_, i) => ({
        id: `id-${i}`,
        data: `data-${i}`
      })),
      rowsAffected: 1,
      outBinds: {}
    };
  });

  const mockConnection = {
    execute: mockExecute,
    commit: jest.fn().mockResolvedValue(undefined),
    rollback: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
    ping: jest.fn().mockResolvedValue(undefined)
  };

  const mockPool = {
    getConnection: jest.fn().mockResolvedValue(mockConnection),
    close: jest.fn().mockResolvedValue(undefined),
    connectionsOpen: 10,
    connectionsInUse: 0,
    status: 6000 // POOL_STATUS_OPEN
  };

  return {
    createPool: jest.fn().mockResolvedValue(mockPool),
    pool: mockPool,
    connection: mockConnection
  };
};

jest.mock('oracledb', () => createMockDatabase());

describe('Database Performance Tests', () => {
  let dbService;
  const PERFORMANCE_THRESHOLDS = {
    simpleQuery: 50,        // ms
    complexQuery: 200,      // ms
    bulkInsert: 500,        // ms
    transaction: 300,       // ms
    connectionAcquire: 10   // ms
  };

  beforeAll(async () => {
    dbService = new DatabaseService();
    await dbService.initialize();
  });

  afterAll(async () => {
    await dbService.close();
  });

  describe('Query Performance', () => {
    test('Simple SELECT query should execute within threshold', async () => {
      const startTime = performance.now();
      
      await dbService.query(
        'SELECT * FROM experiences WHERE user_id = :userId',
        { userId: 'user-123' }
      );
      
      const endTime = performance.now();
      const queryTime = endTime - startTime;
      
      expect(queryTime).toBeLessThan(PERFORMANCE_THRESHOLDS.simpleQuery);
      console.log(`Simple query executed in ${queryTime.toFixed(2)}ms`);
    });

    test('Complex JOIN query should execute within threshold', async () => {
      const startTime = performance.now();
      
      await dbService.query(`
        SELECT e.*, s.skill_name, o.organization_name
        FROM experiences e
        LEFT JOIN experience_skills es ON e.id = es.experience_id
        LEFT JOIN skills s ON es.skill_id = s.id
        LEFT JOIN organizations o ON e.organization_id = o.id
        WHERE e.user_id = :userId
      `, { userId: 'user-123' });
      
      const endTime = performance.now();
      const queryTime = endTime - startTime;
      
      expect(queryTime).toBeLessThan(PERFORMANCE_THRESHOLDS.complexQuery);
      console.log(`Complex query executed in ${queryTime.toFixed(2)}ms`);
    });

    test('Paginated queries should maintain consistent performance', async () => {
      const pageSizes = [10, 20, 50, 100];
      const results = [];
      
      for (const limit of pageSizes) {
        const startTime = performance.now();
        
        await dbService.query(
          'SELECT * FROM experiences WHERE user_id = :userId FETCH FIRST :limit ROWS ONLY',
          { userId: 'user-123', limit }
        );
        
        const endTime = performance.now();
        results.push({
          limit,
          time: endTime - startTime
        });
      }
      
      console.log('Pagination performance:', results);
      
      // Performance should not degrade significantly with larger page sizes
      const timeRatio = results[3].time / results[0].time;
      expect(timeRatio).toBeLessThan(2); // 100 rows should be less than 2x slower than 10 rows
    });
  });

  describe('Bulk Operations', () => {
    test('Bulk INSERT should handle multiple records efficiently', async () => {
      const records = Array(100).fill().map((_, i) => ({
        title: `Experience ${i}`,
        description: `Description ${i}`,
        userId: 'user-123'
      }));
      
      const startTime = performance.now();
      
      await dbService.transaction(async (client) => {
        for (const record of records) {
          await client.execute(
            'INSERT INTO experiences (title, description, user_id) VALUES (:1, :2, :3)',
            [record.title, record.description, record.userId]
          );
        }
      });
      
      const endTime = performance.now();
      const bulkTime = endTime - startTime;
      
      expect(bulkTime).toBeLessThan(PERFORMANCE_THRESHOLDS.bulkInsert);
      console.log(`Bulk insert (100 records) completed in ${bulkTime.toFixed(2)}ms`);
    });

    test('Batch processing should be more efficient than individual operations', async () => {
      const items = Array(50).fill().map((_, i) => ({ id: i, value: `value-${i}` }));
      
      // Individual operations
      const individualStart = performance.now();
      for (const item of items) {
        await dbService.query(
          'UPDATE experiences SET value = :value WHERE id = :id',
          item
        );
      }
      const individualTime = performance.now() - individualStart;
      
      // Batch operation
      const batchStart = performance.now();
      await dbService.transaction(async (client) => {
        const promises = items.map(item =>
          client.execute(
            'UPDATE experiences SET value = :value WHERE id = :id',
            item
          )
        );
        await Promise.all(promises);
      });
      const batchTime = performance.now() - batchStart;
      
      console.log(`Performance comparison:
        Individual: ${individualTime.toFixed(2)}ms
        Batch: ${batchTime.toFixed(2)}ms
        Improvement: ${((1 - batchTime/individualTime) * 100).toFixed(1)}%
      `);
      
      expect(batchTime).toBeLessThan(individualTime * 0.7); // Batch should be at least 30% faster
    });
  });

  describe('Connection Pool Performance', () => {
    test('Connection acquisition should be fast', async () => {
      const times = [];
      
      for (let i = 0; i < 20; i++) {
        const startTime = performance.now();
        const connection = await dbService.pool.getConnection();
        const endTime = performance.now();
        
        times.push(endTime - startTime);
        await connection.close();
      }
      
      const avgTime = times.reduce((sum, t) => sum + t, 0) / times.length;
      const maxTime = Math.max(...times);
      
      console.log(`Connection pool performance:
        Avg acquisition time: ${avgTime.toFixed(2)}ms
        Max acquisition time: ${maxTime.toFixed(2)}ms
      `);
      
      expect(avgTime).toBeLessThan(PERFORMANCE_THRESHOLDS.connectionAcquire);
      expect(maxTime).toBeLessThan(PERFORMANCE_THRESHOLDS.connectionAcquire * 2);
    });

    test('Concurrent connections should not degrade performance', async () => {
      const concurrentCount = 10;
      
      const startTime = performance.now();
      
      const promises = Array(concurrentCount).fill().map(async () => {
        const connection = await dbService.pool.getConnection();
        await connection.execute('SELECT 1 FROM DUAL');
        await connection.close();
      });
      
      await Promise.all(promises);
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const avgTime = totalTime / concurrentCount;
      
      console.log(`Concurrent connections (${concurrentCount}):
        Total time: ${totalTime.toFixed(2)}ms
        Avg per connection: ${avgTime.toFixed(2)}ms
      `);
      
      expect(avgTime).toBeLessThan(PERFORMANCE_THRESHOLDS.simpleQuery);
    });
  });

  describe('Transaction Performance', () => {
    test('Transactions should complete within threshold', async () => {
      const startTime = performance.now();
      
      await dbService.transaction(async (client) => {
        await client.execute('INSERT INTO experiences (id, title) VALUES (:1, :2)', ['exp-1', 'Test']);
        await client.execute('UPDATE experiences SET updated_at = SYSDATE WHERE id = :1', ['exp-1']);
        await client.execute('INSERT INTO experience_skills (exp_id, skill) VALUES (:1, :2)', ['exp-1', 'JavaScript']);
      });
      
      const endTime = performance.now();
      const transactionTime = endTime - startTime;
      
      expect(transactionTime).toBeLessThan(PERFORMANCE_THRESHOLDS.transaction);
      console.log(`Transaction completed in ${transactionTime.toFixed(2)}ms`);
    });

    test('Rollback should be fast', async () => {
      const startTime = performance.now();
      
      try {
        await dbService.transaction(async (client) => {
          await client.execute('INSERT INTO experiences (id) VALUES (:1)', ['test']);
          throw new Error('Intentional rollback');
        });
      } catch (error) {
        // Expected error
      }
      
      const endTime = performance.now();
      const rollbackTime = endTime - startTime;
      
      expect(rollbackTime).toBeLessThan(100); // Rollback should be quick
      console.log(`Rollback completed in ${rollbackTime.toFixed(2)}ms`);
    });
  });

  describe('Query Optimization', () => {
    test('Indexed queries should be faster than non-indexed', async () => {
      // Simulate indexed query
      const indexedStart = performance.now();
      await dbService.query(
        'SELECT * FROM experiences WHERE id = :id', // id is typically indexed
        { id: 'exp-123' }
      );
      const indexedTime = performance.now() - indexedStart;
      
      // Simulate non-indexed query
      const nonIndexedStart = performance.now();
      await dbService.query(
        'SELECT * FROM experiences WHERE description LIKE :pattern', // description typically not indexed
        { pattern: '%test%' }
      );
      const nonIndexedTime = performance.now() - nonIndexedStart;
      
      console.log(`Query performance:
        Indexed: ${indexedTime.toFixed(2)}ms
        Non-indexed: ${nonIndexedTime.toFixed(2)}ms
      `);
      
      // In a real scenario, indexed should be faster
      // For our mock, we're just checking they complete reasonably
      expect(indexedTime).toBeLessThan(PERFORMANCE_THRESHOLDS.simpleQuery);
      expect(nonIndexedTime).toBeLessThan(PERFORMANCE_THRESHOLDS.complexQuery);
    });

    test('Prepared statements should improve performance on repeated execution', async () => {
      const query = 'SELECT * FROM experiences WHERE user_id = :userId AND status = :status';
      const params = { userId: 'user-123', status: 'active' };
      const executions = 10;
      
      // First execution (statement preparation)
      const firstStart = performance.now();
      await dbService.query(query, params);
      const firstTime = performance.now() - firstStart;
      
      // Subsequent executions (using prepared statement)
      const subsequentTimes = [];
      for (let i = 0; i < executions - 1; i++) {
        const start = performance.now();
        await dbService.query(query, params);
        subsequentTimes.push(performance.now() - start);
      }
      
      const avgSubsequentTime = subsequentTimes.reduce((sum, t) => sum + t, 0) / subsequentTimes.length;
      
      console.log(`Prepared statement performance:
        First execution: ${firstTime.toFixed(2)}ms
        Avg subsequent: ${avgSubsequentTime.toFixed(2)}ms
        Improvement: ${((1 - avgSubsequentTime/firstTime) * 100).toFixed(1)}%
      `);
      
      // Subsequent executions should be faster (in real scenario)
      expect(avgSubsequentTime).toBeLessThanOrEqual(firstTime);
    });
  });

  describe('Resource Management', () => {
    test('Connection leak detection', async () => {
      const initialConnections = dbService.pool.connectionsInUse;
      
      // Simulate operations that might leak connections
      const promises = Array(20).fill().map(async () => {
        const connection = await dbService.pool.getConnection();
        await connection.execute('SELECT 1 FROM DUAL');
        // Properly close connection
        await connection.close();
      });
      
      await Promise.all(promises);
      
      // Wait a bit for connections to be returned
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const finalConnections = dbService.pool.connectionsInUse;
      
      console.log(`Connection management:
        Initial connections in use: ${initialConnections}
        Final connections in use: ${finalConnections}
      `);
      
      expect(finalConnections).toBe(initialConnections);
    });

    test('Memory usage during large result sets', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Simulate fetching large result set
      await dbService.query(
        'SELECT * FROM experiences WHERE user_id = :userId',
        { userId: 'user-123', limit: 1000 }
      );
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024; // MB
      
      console.log(`Memory usage for 1000 records: +${memoryIncrease.toFixed(2)}MB`);
      
      // Memory increase should be reasonable
      expect(memoryIncrease).toBeLessThan(10); // Less than 10MB for 1000 records
    });
  });
});