/**
 * Edge Case Test Suite: User Management Schema Optimization
 * 
 * Tests for Issue #21: Database Schema Optimization for User Management
 * This file covers edge cases and error scenarios not covered in the main test suite
 */

const oracledb = require('oracledb');
const DatabaseManager = require('../../src/services/database');
const createUserTables = require('../../src/database/schema/user-tables');

describe('User Management Schema - Edge Cases', () => {
  let connection;
  const tablePrefix = 'test_edge_pf_';
  
  // Helper function to clean up test tables
  const cleanupTables = async () => {
    const tables = [
      'mv_user_stats',
      'user_preferences',
      'user_analytics',
      'user_feature_flags',
      'user_groups',
      'feature_flags',
      'sso_accounts',
      'user_invitations',
      'api_keys',
      'user_profiles',
      'audit_log',
      'user_sessions',
      'users'
    ];
    
    for (const table of tables) {
      try {
        await connection.execute(`DROP TABLE ${tablePrefix}${table} CASCADE CONSTRAINTS`);
      } catch (error) {
        // Ignore if table doesn't exist
      }
    }
    
    // Drop materialized view
    try {
      await connection.execute(`DROP MATERIALIZED VIEW ${tablePrefix}mv_user_stats`);
    } catch (error) {
      // Ignore if doesn't exist
    }
  };

  beforeAll(async () => {
    await DatabaseManager.initialize();
    connection = DatabaseManager.getConnection();
    await cleanupTables();
    await createUserTables(DatabaseManager, tablePrefix);
  });

  afterAll(async () => {
    await cleanupTables();
    await DatabaseManager.close();
  });

  describe('Data Type Validation Edge Cases', () => {
    test('should enforce maximum length on VARCHAR2 fields', async () => {
      const longString = 'a'.repeat(256); // Exceeds VARCHAR2(255)
      
      await expect(connection.execute(
        `INSERT INTO ${tablePrefix}users (username, email, password_hash) VALUES (?, ?, ?)`,
        [longString, 'test@example.com', 'hash']
      )).rejects.toThrow(/ORA-12899/); // Value too large for column
    });

    test('should reject invalid date formats', async () => {
      await expect(connection.execute(
        `INSERT INTO ${tablePrefix}users (username, email, password_hash, date_of_birth) 
         VALUES (?, ?, ?, ?)`,
        ['testuser', 'test@example.com', 'hash', 'invalid-date']
      )).rejects.toThrow(/ORA-01843|ORA-01861/); // Not a valid date
    });

    test('should enforce numeric precision boundaries', async () => {
      await expect(connection.execute(
        `INSERT INTO ${tablePrefix}users (username, email, password_hash, years_experience) 
         VALUES (?, ?, ?, ?)`,
        ['testuser', 'test@example.com', 'hash', 1000] // Exceeds NUMBER(3,1)
      )).rejects.toThrow(/ORA-01438/); // Value larger than specified precision
    });

    test('should handle negative years_experience correctly', async () => {
      await expect(connection.execute(
        `INSERT INTO ${tablePrefix}users (username, email, password_hash, years_experience) 
         VALUES (?, ?, ?, ?)`,
        ['testuser', 'test@example.com', 'hash', -1]
      )).rejects.toThrow(/ORA-02290/); // Check constraint violated
    });

    test('should handle negative total_logins correctly', async () => {
      await expect(connection.execute(
        `INSERT INTO ${tablePrefix}users (username, email, password_hash, total_logins) 
         VALUES (?, ?, ?, ?)`,
        ['testuser', 'test@example.com', 'hash', -1]
      )).rejects.toThrow(/ORA-02290/); // Check constraint violated
    });

    test('should validate JSON check constraints', async () => {
      // First create a valid user
      await connection.execute(
        `INSERT INTO ${tablePrefix}users (user_id, username, email, password_hash) 
         VALUES (?, ?, ?, ?)`,
        ['test_user_1', 'testuser', 'test@example.com', 'hash']
      );

      // Try to insert invalid JSON
      await expect(connection.execute(
        `INSERT INTO ${tablePrefix}user_preferences (user_id, notification_preferences) 
         VALUES (?, ?)`,
        ['test_user_1', 'not-valid-json']
      )).rejects.toThrow(/ORA-02290|ORA-40441/); // JSON validation error
    });
  });

  describe('Constraint Violation Scenarios', () => {
    beforeEach(async () => {
      // Clean up data between tests
      await connection.execute(`DELETE FROM ${tablePrefix}users WHERE username LIKE 'test%'`);
      await connection.commit();
    });

    test('should reject duplicate usernames', async () => {
      await connection.execute(
        `INSERT INTO ${tablePrefix}users (username, email, password_hash) 
         VALUES (?, ?, ?)`,
        ['duplicate_user', 'test1@example.com', 'hash']
      );

      await expect(connection.execute(
        `INSERT INTO ${tablePrefix}users (username, email, password_hash) 
         VALUES (?, ?, ?)`,
        ['duplicate_user', 'test2@example.com', 'hash']
      )).rejects.toThrow(/ORA-00001/); // Unique constraint violated
    });

    test('should reject duplicate emails', async () => {
      await connection.execute(
        `INSERT INTO ${tablePrefix}users (username, email, password_hash) 
         VALUES (?, ?, ?)`,
        ['user1', 'duplicate@example.com', 'hash']
      );

      await expect(connection.execute(
        `INSERT INTO ${tablePrefix}users (username, email, password_hash) 
         VALUES (?, ?, ?)`,
        ['user2', 'duplicate@example.com', 'hash']
      )).rejects.toThrow(/ORA-00001/); // Unique constraint violated
    });

    test('should enforce foreign key constraints', async () => {
      await expect(connection.execute(
        `INSERT INTO ${tablePrefix}user_sessions (user_id, token, expires_at) 
         VALUES (?, ?, ?)`,
        ['non_existent_user', 'token123', new Date()]
      )).rejects.toThrow(/ORA-02291/); // Parent key not found
    });

    test('should enforce check constraints on enum fields', async () => {
      await expect(connection.execute(
        `INSERT INTO ${tablePrefix}users (username, email, password_hash, account_status) 
         VALUES (?, ?, ?, ?)`,
        ['testuser', 'test@example.com', 'hash', 'invalid_status']
      )).rejects.toThrow(/ORA-02290/); // Check constraint violated
    });

    test('should enforce mutual exclusion in user_feature_flags', async () => {
      // Create prerequisite data
      await connection.execute(
        `INSERT INTO ${tablePrefix}users (user_id, username, email, password_hash) 
         VALUES (?, ?, ?, ?)`,
        ['user1', 'testuser', 'test@example.com', 'hash']
      );
      
      await connection.execute(
        `INSERT INTO ${tablePrefix}user_groups (group_id, group_name) 
         VALUES (?, ?)`,
        ['group1', 'Test Group']
      );
      
      await connection.execute(
        `INSERT INTO ${tablePrefix}feature_flags (flag_id, flag_key, flag_name) 
         VALUES (?, ?, ?)`,
        ['flag1', 'test_flag', 'Test Flag']
      );

      // Try to insert with both user_id and group_id
      await expect(connection.execute(
        `INSERT INTO ${tablePrefix}user_feature_flags (user_id, group_id, flag_id) 
         VALUES (?, ?, ?)`,
        ['user1', 'group1', 'flag1']
      )).rejects.toThrow(/ORA-02290/); // Check constraint violated
    });

    test('should handle NULL vs NOT NULL enforcement', async () => {
      await expect(connection.execute(
        `INSERT INTO ${tablePrefix}users (username, email) 
         VALUES (?, ?)`,
        ['testuser', 'test@example.com']
      )).rejects.toThrow(/ORA-01400/); // Cannot insert NULL
    });
  });

  describe('Partitioning Edge Cases', () => {
    test('should handle data older than initial partition date', async () => {
      // Create a user first
      await connection.execute(
        `INSERT INTO ${tablePrefix}users (user_id, username, email, password_hash) 
         VALUES (?, ?, ?, ?)`,
        ['user_old', 'olduser', 'old@example.com', 'hash']
      );

      // Try to insert analytics data before partition start date
      const oldDate = new Date('2024-01-01');
      
      const result = await connection.execute(
        `INSERT INTO ${tablePrefix}user_analytics (user_id, event_type, event_timestamp) 
         VALUES (?, ?, ?)`,
        ['user_old', 'login', oldDate]
      );

      expect(result.rowsAffected).toBe(1); // Should create new partition automatically
    });

    test('should verify partition pruning with date range queries', async () => {
      // Create a user
      await connection.execute(
        `INSERT INTO ${tablePrefix}users (user_id, username, email, password_hash) 
         VALUES (?, ?, ?, ?)`,
        ['user_part', 'partuser', 'part@example.com', 'hash']
      );

      // Insert data across multiple dates
      const dates = [
        new Date('2025-01-01'),
        new Date('2025-01-02'),
        new Date('2025-01-03')
      ];

      for (const date of dates) {
        await connection.execute(
          `INSERT INTO ${tablePrefix}user_analytics (user_id, event_type, event_timestamp) 
           VALUES (?, ?, ?)`,
          ['user_part', 'login', date]
        );
      }

      // Query with date range (should use partition pruning)
      const result = await connection.execute(
        `SELECT COUNT(*) FROM ${tablePrefix}user_analytics 
         WHERE event_timestamp >= ? AND event_timestamp < ?`,
        [new Date('2025-01-02'), new Date('2025-01-03')]
      );

      expect(result.rows[0][0]).toBe(1);
    });
  });

  describe('Materialized View Edge Cases', () => {
    test('should handle materialized view refresh', async () => {
      // Insert test data
      await connection.execute(
        `INSERT INTO ${tablePrefix}users (user_id, username, email, password_hash) 
         VALUES (?, ?, ?, ?)`,
        ['user_mv', 'mvuser', 'mv@example.com', 'hash']
      );

      await connection.execute(
        `INSERT INTO ${tablePrefix}user_analytics (user_id, event_type, session_id) 
         VALUES (?, ?, ?)`,
        ['user_mv', 'login', 'session1']
      );

      // Refresh materialized view
      await connection.execute(
        `BEGIN DBMS_MVIEW.REFRESH('${tablePrefix}mv_user_stats', 'C'); END;`
      );

      // Query materialized view
      const result = await connection.execute(
        `SELECT total_events FROM ${tablePrefix}mv_user_stats WHERE user_id = ?`,
        ['user_mv']
      );

      expect(result.rows[0][0]).toBe(1);
    });

    test('should handle stale data in materialized view', async () => {
      // Query staleness
      const result = await connection.execute(`
        SELECT staleness 
        FROM user_mviews 
        WHERE UPPER(mview_name) = UPPER('${tablePrefix}mv_user_stats')
      `);

      expect(['FRESH', 'STALE', 'NEEDS_COMPILE']).toContain(result.rows[0][0]);
    });
  });

  describe('Concurrent Access Scenarios', () => {
    test('should handle concurrent inserts to the same table', async () => {
      const promises = [];
      
      // Simulate 10 concurrent inserts
      for (let i = 0; i < 10; i++) {
        promises.push(
          connection.execute(
            `INSERT INTO ${tablePrefix}users (username, email, password_hash) 
             VALUES (?, ?, ?)`,
            [`concurrent_user_${i}`, `concurrent${i}@example.com`, 'hash']
          )
        );
      }

      const results = await Promise.allSettled(promises);
      const successful = results.filter(r => r.status === 'fulfilled').length;
      
      expect(successful).toBe(10); // All should succeed with different usernames
    });

    test('should handle race condition on unique constraints', async () => {
      const promises = [];
      
      // Try to insert the same username concurrently
      for (let i = 0; i < 5; i++) {
        promises.push(
          connection.execute(
            `INSERT INTO ${tablePrefix}users (username, email, password_hash) 
             VALUES (?, ?, ?)`,
            ['race_user', `race${i}@example.com`, 'hash']
          ).catch(err => err)
        );
      }

      const results = await Promise.all(promises);
      const successful = results.filter(r => !(r instanceof Error)).length;
      const failed = results.filter(r => r instanceof Error && r.message.includes('ORA-00001')).length;
      
      expect(successful).toBe(1); // Only one should succeed
      expect(failed).toBe(4); // Others should fail with unique constraint violation
    });
  });

  describe('Security Edge Cases', () => {
    test('should handle SQL injection attempts in JSON fields', async () => {
      // Create a user
      await connection.execute(
        `INSERT INTO ${tablePrefix}users (user_id, username, email, password_hash) 
         VALUES (?, ?, ?, ?)`,
        ['user_sec', 'secuser', 'sec@example.com', 'hash']
      );

      // Try SQL injection in JSON field
      const maliciousJSON = '{"key": "value\'); DROP TABLE users; --"}';
      
      const result = await connection.execute(
        `INSERT INTO ${tablePrefix}user_preferences (user_id, notification_preferences) 
         VALUES (?, ?)`,
        ['user_sec', maliciousJSON]
      );

      expect(result.rowsAffected).toBe(1); // Should be safely stored as JSON
      
      // Verify the table still exists
      const tableCheck = await connection.execute(
        `SELECT COUNT(*) FROM ${tablePrefix}users`
      );
      expect(tableCheck.rows[0][0]).toBeGreaterThanOrEqual(1);
    });

    test('should handle large payload attacks on CLOB fields', async () => {
      // Create a very large string (1MB)
      const largePayload = 'x'.repeat(1024 * 1024);
      
      // Create a user
      await connection.execute(
        `INSERT INTO ${tablePrefix}users (user_id, username, email, password_hash) 
         VALUES (?, ?, ?, ?)`,
        ['user_large', 'largeuser', 'large@example.com', 'hash']
      );

      // Insert large CLOB data
      const result = await connection.execute(
        `INSERT INTO ${tablePrefix}user_preferences (user_id, notification_preferences) 
         VALUES (?, ?)`,
        ['user_large', JSON.stringify({ data: largePayload })]
      );

      expect(result.rowsAffected).toBe(1); // Should handle large CLOBs
    });

    test('should prevent resource exhaustion via rapid analytics inserts', async () => {
      // Create a user
      await connection.execute(
        `INSERT INTO ${tablePrefix}users (user_id, username, email, password_hash) 
         VALUES (?, ?, ?, ?)`,
        ['user_exhaust', 'exhaustuser', 'exhaust@example.com', 'hash']
      );

      const startTime = Date.now();
      const promises = [];
      
      // Try to insert 1000 analytics events rapidly
      for (let i = 0; i < 1000; i++) {
        promises.push(
          connection.execute(
            `INSERT INTO ${tablePrefix}user_analytics (user_id, event_type, event_data) 
             VALUES (?, ?, ?)`,
            ['user_exhaust', 'spam_event', JSON.stringify({ index: i })]
          ).catch(err => err)
        );
      }

      await Promise.all(promises);
      const duration = Date.now() - startTime;
      
      // Should complete within reasonable time (< 30 seconds)
      expect(duration).toBeLessThan(30000);
    });
  });

  describe('Index Performance Edge Cases', () => {
    test('should verify composite index column order effectiveness', async () => {
      // Insert test data with various patterns
      for (let i = 0; i < 100; i++) {
        await connection.execute(
          `INSERT INTO ${tablePrefix}users (username, email, password_hash, first_name, last_name) 
           VALUES (?, ?, ?, ?, ?)`,
          [`user${i}`, `user${i}@example.com`, 'hash', `First${i}`, `Last${i}`]
        );
      }

      // Test query that should use composite index
      const explainPlan = await connection.execute(`
        EXPLAIN PLAN FOR
        SELECT * FROM ${tablePrefix}users
        WHERE LOWER(username) = 'user50'
        AND LOWER(email) = 'user50@example.com'
      `);

      const planResult = await connection.execute(`
        SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY())
      `);

      // Check if index is being used (plan should mention index)
      const planText = planResult.rows.map(r => r[0]).join('\n');
      expect(planText.toLowerCase()).toContain('index');
    });

    test('should handle queries on non-indexed columns', async () => {
      const startTime = Date.now();
      
      // Query on non-indexed column
      const result = await connection.execute(
        `SELECT COUNT(*) FROM ${tablePrefix}users WHERE bio LIKE '%test%'`
      );

      const duration = Date.now() - startTime;
      
      // Should complete even without index (but might be slower)
      expect(duration).toBeLessThan(5000);
      expect(result.rows[0][0]).toBeGreaterThanOrEqual(0);
    });
  });

  describe('CASCADE Delete Scenarios', () => {
    test('should cascade delete all related records when user is deleted', async () => {
      // Create a user with related data
      const userId = 'cascade_user';
      
      await connection.execute(
        `INSERT INTO ${tablePrefix}users (user_id, username, email, password_hash) 
         VALUES (?, ?, ?, ?)`,
        [userId, 'cascadeuser', 'cascade@example.com', 'hash']
      );

      // Create related records
      await connection.execute(
        `INSERT INTO ${tablePrefix}user_sessions (user_id, token, expires_at) 
         VALUES (?, ?, ?)`,
        [userId, 'token123', new Date()]
      );

      await connection.execute(
        `INSERT INTO ${tablePrefix}user_profiles (user_id, headline) 
         VALUES (?, ?)`,
        [userId, 'Test Headline']
      );

      await connection.execute(
        `INSERT INTO ${tablePrefix}user_preferences (user_id, ui_preferences) 
         VALUES (?, ?)`,
        [userId, '{"theme": "dark"}']
      );

      // Delete the user
      await connection.execute(
        `DELETE FROM ${tablePrefix}users WHERE user_id = ?`,
        [userId]
      );

      // Verify all related records are deleted
      const sessionCount = await connection.execute(
        `SELECT COUNT(*) FROM ${tablePrefix}user_sessions WHERE user_id = ?`,
        [userId]
      );
      expect(sessionCount.rows[0][0]).toBe(0);

      const profileCount = await connection.execute(
        `SELECT COUNT(*) FROM ${tablePrefix}user_profiles WHERE user_id = ?`,
        [userId]
      );
      expect(profileCount.rows[0][0]).toBe(0);

      const prefCount = await connection.execute(
        `SELECT COUNT(*) FROM ${tablePrefix}user_preferences WHERE user_id = ?`,
        [userId]
      );
      expect(prefCount.rows[0][0]).toBe(0);
    });
  });

  describe('Default Values Verification', () => {
    test('should apply all default values correctly', async () => {
      // Insert minimal user data
      await connection.execute(
        `INSERT INTO ${tablePrefix}users (username, email, password_hash) 
         VALUES (?, ?, ?)`,
        ['defaultuser', 'default@example.com', 'hash']
      );

      // Query the inserted record
      const result = await connection.execute(
        `SELECT account_status, mfa_enabled, email_verified, phone_verified, 
                timezone, language, total_logins
         FROM ${tablePrefix}users 
         WHERE username = ?`,
        ['defaultuser']
      );

      const [status, mfa, emailVerified, phoneVerified, timezone, language, logins] = result.rows[0];

      expect(status).toBe('active');
      expect(mfa).toBe('N');
      expect(emailVerified).toBe('N');
      expect(phoneVerified).toBe('N');
      expect(timezone).toBe('UTC');
      expect(language).toBe('en');
      expect(logins).toBe(0);
    });
  });
});