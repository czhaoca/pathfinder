/**
 * Test Suite: User Management Schema Optimization
 * 
 * Tests for Issue #21: Database Schema Optimization for User Management
 * Verifies all new tables, columns, indexes, and constraints are properly created
 */

const oracledb = require('oracledb');
const path = require('path');
const DatabaseManager = require('../../src/services/database');

// Import schema creation function
const createUserTables = require('../../src/database/schema/user-tables');

describe('User Management Schema Optimization', () => {
  let connection;
  const tablePrefix = 'test_pf_';
  
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
    // Setup test database connection
    await DatabaseManager.initialize();
    connection = DatabaseManager.getConnection();
    
    // Clean up any existing test tables
    await cleanupTables();
  });

  afterAll(async () => {
    // Final cleanup
    await cleanupTables();
    
    // Close connection
    await DatabaseManager.close();
  });

  describe('Schema Creation', () => {
    test('should successfully create all user management tables', async () => {
      await expect(createUserTables(DatabaseManager, tablePrefix)).resolves.not.toThrow();
    });
    
    test('should handle re-creation gracefully', async () => {
      // Create tables
      await createUserTables(DatabaseManager, tablePrefix);
      
      // Try to create again - should handle existing tables gracefully
      await expect(createUserTables(DatabaseManager, tablePrefix)).resolves.not.toThrow();
    });
  });

  describe('Extended Users Table', () => {
    beforeEach(async () => {
      await cleanupTables();
      await createUserTables(DatabaseManager, tablePrefix);
    });

    afterEach(async () => {
      await cleanupTables();
    });

    test('should have all new profile fields', async () => {
      const result = await connection.execute(`
        SELECT column_name, data_type, nullable
        FROM user_tab_columns
        WHERE table_name = UPPER('${tablePrefix}users')
        AND column_name IN (
          'PHONE_NUMBER', 'PHONE_VERIFIED', 'AVATAR_URL', 'BIO',
          'TIMEZONE', 'LANGUAGE', 'DATE_OF_BIRTH', 'GENDER',
          'NATIONALITY', 'CURRENT_TITLE', 'CURRENT_COMPANY',
          'YEARS_EXPERIENCE', 'INVITED_BY', 'INVITATION_ACCEPTED_AT',
          'FEATURE_GROUP_ID', 'LAST_ACTIVITY_AT', 'TOTAL_LOGINS'
        )
      `);

      expect(result.rows.length).toBe(17);
      
      // Verify specific field properties
      const phoneNumberField = result.rows.find(r => r[0] === 'PHONE_NUMBER');
      expect(phoneNumberField).toBeDefined();
      expect(phoneNumberField[1]).toContain('VARCHAR2');

      const phoneVerifiedField = result.rows.find(r => r[0] === 'PHONE_VERIFIED');
      expect(phoneVerifiedField).toBeDefined();
      expect(phoneVerifiedField[1]).toBe('CHAR');
    });

    test('should have proper check constraints', async () => {
      const result = await connection.execute(`
        SELECT constraint_name, search_condition
        FROM user_constraints
        WHERE table_name = UPPER('${tablePrefix}users')
        AND constraint_type = 'C'
        AND constraint_name LIKE 'CHK_USERS_%'
      `);

      const phoneVerifiedCheck = result.rows.find(r => 
        r[1] && r[1].includes('PHONE_VERIFIED'));
      expect(phoneVerifiedCheck).toBeDefined();
    });

    test('should have proper indexes on new fields', async () => {
      const result = await connection.execute(`
        SELECT index_name, column_name
        FROM user_ind_columns
        WHERE table_name = UPPER('${tablePrefix}users')
        AND UPPER(index_name) IN (
          UPPER('${tablePrefix}idx_users_email_verified'),
          UPPER('${tablePrefix}idx_users_invited_by'),
          UPPER('${tablePrefix}idx_users_last_activity'),
          UPPER('${tablePrefix}idx_users_feature_group')
        )
      `);

      expect(result.rows.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe('User Invitations Table', () => {
    beforeEach(async () => {
      await cleanupTables();
      await createUserTables(DatabaseManager, tablePrefix);
    });

    afterEach(async () => {
      await cleanupTables();
    });

    test('should create user_invitations table', async () => {
      const result = await connection.execute(`
        SELECT table_name
        FROM user_tables
        WHERE table_name = UPPER('${tablePrefix}user_invitations')
      `);

      expect(result.rows.length).toBe(1);
    });

    test('should have all required columns', async () => {
      const result = await connection.execute(`
        SELECT column_name, data_type, nullable
        FROM user_tab_columns
        WHERE table_name = UPPER('${tablePrefix}user_invitations')
      `);

      const columnNames = result.rows.map(r => r[0]);
      expect(columnNames).toContain('INVITATION_ID');
      expect(columnNames).toContain('EMAIL');
      expect(columnNames).toContain('INVITATION_TOKEN');
      expect(columnNames).toContain('INVITED_BY');
      expect(columnNames).toContain('ROLE');
      expect(columnNames).toContain('FEATURE_GROUP_ID');
      expect(columnNames).toContain('EXPIRES_AT');
      expect(columnNames).toContain('ACCEPTED_AT');
      expect(columnNames).toContain('DECLINED_AT');
      expect(columnNames).toContain('REMINDER_SENT_AT');
      expect(columnNames).toContain('METADATA');
      expect(columnNames).toContain('CREATED_AT');
    });

    test('should have unique constraint on invitation_token', async () => {
      const result = await connection.execute(`
        SELECT constraint_name, constraint_type
        FROM user_constraints
        WHERE table_name = UPPER('${tablePrefix}user_invitations')
        AND constraint_type = 'U'
      `);

      expect(result.rows.length).toBeGreaterThanOrEqual(1);
    });

    test('should have foreign key to pf_users', async () => {
      const result = await connection.execute(`
        SELECT constraint_name, r_constraint_name
        FROM user_constraints
        WHERE table_name = UPPER('${tablePrefix}user_invitations')
        AND constraint_type = 'R'
        AND UPPER(constraint_name) = UPPER('${tablePrefix}fk_invitation_inviter')
      `);

      expect(result.rows.length).toBe(1);
    });
  });

  describe('SSO Accounts Table', () => {
    beforeEach(async () => {
      await cleanupTables();
      await createUserTables(DatabaseManager, tablePrefix);
    });

    afterEach(async () => {
      await cleanupTables();
    });

    test('should create sso_accounts table', async () => {
      const result = await connection.execute(`
        SELECT table_name
        FROM user_tables
        WHERE table_name = UPPER('${tablePrefix}sso_accounts')
      `);

      expect(result.rows.length).toBe(1);
    });

    test('should have unique constraint on provider and provider_user_id', async () => {
      const result = await connection.execute(`
        SELECT constraint_name, constraint_type
        FROM user_constraints
        WHERE table_name = UPPER('${tablePrefix}sso_accounts')
        AND constraint_type = 'U'
      `);

      expect(result.rows.length).toBeGreaterThanOrEqual(1);
    });

    test('should have check constraint for is_primary field', async () => {
      const result = await connection.execute(`
        SELECT constraint_name, search_condition
        FROM user_constraints
        WHERE table_name = UPPER('${tablePrefix}sso_accounts')
        AND constraint_type = 'C'
        AND search_condition LIKE '%IS_PRIMARY%'
      `);

      expect(result.rows.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Feature Flags Tables', () => {
    beforeEach(async () => {
      await cleanupTables();
      await createUserTables(DatabaseManager, tablePrefix);
    });

    afterEach(async () => {
      await cleanupTables();
    });

    test('should create feature_flags table', async () => {
      const result = await connection.execute(`
        SELECT table_name
        FROM user_tables
        WHERE table_name = UPPER('${tablePrefix}feature_flags')
      `);

      expect(result.rows.length).toBe(1);
    });

    test('should create user_groups table', async () => {
      const result = await connection.execute(`
        SELECT table_name
        FROM user_tables
        WHERE table_name = UPPER('${tablePrefix}user_groups')
      `);

      expect(result.rows.length).toBe(1);
    });

    test('should create user_feature_flags table', async () => {
      const result = await connection.execute(`
        SELECT table_name
        FROM user_tables
        WHERE table_name = UPPER('${tablePrefix}user_feature_flags')
      `);

      expect(result.rows.length).toBe(1);
    });

    test('should have mutual exclusion check on user_id and group_id', async () => {
      const result = await connection.execute(`
        SELECT search_condition
        FROM user_constraints
        WHERE table_name = UPPER('${tablePrefix}user_feature_flags')
        AND constraint_type = 'C'
        AND search_condition LIKE '%USER_ID IS NOT NULL AND GROUP_ID IS NULL%'
      `);

      expect(result.rows.length).toBe(1);
    });
  });

  describe('User Analytics Table', () => {
    beforeEach(async () => {
      await cleanupTables();
      await createUserTables(DatabaseManager, tablePrefix);
    });

    afterEach(async () => {
      await cleanupTables();
    });

    test('should create user_analytics table with partitioning', async () => {
      const result = await connection.execute(`
        SELECT table_name, partitioned
        FROM user_tables
        WHERE table_name = UPPER('${tablePrefix}user_analytics')
      `);

      expect(result.rows.length).toBe(1);
      expect(result.rows[0][1]).toBe('YES');
    });

    test('should have proper indexes for analytics queries', async () => {
      const result = await connection.execute(`
        SELECT index_name
        FROM user_indexes
        WHERE table_name = UPPER('${tablePrefix}user_analytics')
      `);

      const indexNames = result.rows.map(r => r[0].toUpperCase());
      expect(indexNames).toContain(`${tablePrefix.toUpperCase()}IDX_ANALYTICS_USER`);
      expect(indexNames).toContain(`${tablePrefix.toUpperCase()}IDX_ANALYTICS_EVENT`);
      expect(indexNames).toContain(`${tablePrefix.toUpperCase()}IDX_ANALYTICS_TIMESTAMP`);
    });
  });

  describe('User Preferences Table', () => {
    beforeEach(async () => {
      await cleanupTables();
      await createUserTables(DatabaseManager, tablePrefix);
    });

    afterEach(async () => {
      await cleanupTables();
    });

    test('should create user_preferences table', async () => {
      const result = await connection.execute(`
        SELECT table_name
        FROM user_tables
        WHERE table_name = UPPER('${tablePrefix}user_preferences')
      `);

      expect(result.rows.length).toBe(1);
    });

    test('should have JSON check constraints on preference columns', async () => {
      const result = await connection.execute(`
        SELECT constraint_name, search_condition
        FROM user_constraints
        WHERE table_name = UPPER('${tablePrefix}user_preferences')
        AND constraint_type = 'C'
        AND search_condition LIKE '%IS JSON%'
      `);

      expect(result.rows.length).toBeGreaterThanOrEqual(5);
    });
  });

  describe('Performance Optimizations', () => {
    beforeEach(async () => {
      await cleanupTables();
      await createUserTables(DatabaseManager, tablePrefix);
    });

    afterEach(async () => {
      await cleanupTables();
    });

    test('should create composite search index on users table', async () => {
      const result = await connection.execute(`
        SELECT index_name, column_name, column_position
        FROM user_ind_columns
        WHERE UPPER(index_name) = UPPER('${tablePrefix}idx_users_search')
        ORDER BY column_position
      `);

      expect(result.rows.length).toBeGreaterThanOrEqual(4);
    });

    test('should create filtered index for active users', async () => {
      const result = await connection.execute(`
        SELECT index_name
        FROM user_indexes
        WHERE UPPER(index_name) = UPPER('${tablePrefix}idx_users_active_recent')
      `);

      expect(result.rows.length).toBe(1);
    });

    test('should create materialized view for user statistics', async () => {
      const result = await connection.execute(`
        SELECT mview_name
        FROM user_mviews
        WHERE UPPER(mview_name) = UPPER('${tablePrefix}mv_user_stats')
      `);

      expect(result.rows.length).toBe(1);
    });

    test('should have index on materialized view', async () => {
      const result = await connection.execute(`
        SELECT index_name
        FROM user_indexes
        WHERE UPPER(table_name) = UPPER('${tablePrefix}mv_user_stats')
        AND UPPER(index_name) = UPPER('${tablePrefix}idx_mv_user_stats_activity')
      `);

      expect(result.rows.length).toBe(1);
    });
  });

  // Note: Audit triggers will be implemented separately
  // This test suite focuses on the base schema structure

  describe('Foreign Key Constraints', () => {
    beforeEach(async () => {
      await cleanupTables();
      await createUserTables(DatabaseManager, tablePrefix);
    });

    afterEach(async () => {
      await cleanupTables();
    });

    test('should have cascade delete rules properly configured', async () => {
      const result = await connection.execute(`
        SELECT constraint_name, delete_rule
        FROM user_constraints
        WHERE constraint_type = 'R'
        AND table_name IN (
          UPPER('${tablePrefix}user_invitations'),
          UPPER('${tablePrefix}sso_accounts'),
          UPPER('${tablePrefix}user_feature_flags'),
          UPPER('${tablePrefix}user_analytics'),
          UPPER('${tablePrefix}user_preferences')
        )
        AND delete_rule = 'CASCADE'
      `);

      expect(result.rows.length).toBeGreaterThanOrEqual(5);
    });
  });

  describe('Default Values', () => {
    beforeEach(async () => {
      await cleanupTables();
      await createUserTables(DatabaseManager, tablePrefix);
    });

    afterEach(async () => {
      await cleanupTables();
    });

    test('should have proper default values for new fields', async () => {
      const result = await connection.execute(`
        SELECT column_name, data_default
        FROM user_tab_columns
        WHERE table_name = UPPER('${tablePrefix}users')
        AND column_name IN ('PHONE_VERIFIED', 'TIMEZONE', 'LANGUAGE', 'TOTAL_LOGINS')
        AND data_default IS NOT NULL
      `);

      expect(result.rows.length).toBe(4);

      const defaults = Object.fromEntries(result.rows.map(r => [r[0], r[1]]));
      expect(defaults.PHONE_VERIFIED).toContain('N');
      expect(defaults.TIMEZONE).toContain('UTC');
      expect(defaults.LANGUAGE).toContain('en');
      expect(defaults.TOTAL_LOGINS).toContain('0');
    });
  });
});