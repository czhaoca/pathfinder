#!/usr/bin/env node

/**
 * Multi-User Database Schema Deployment Script
 * Deploys the Career Navigator multi-user database schema to Oracle Autonomous Database
 * Maintains the 3-tier performance architecture with user-prefixed schema isolation
 */

const oracledb = require('oracledb');
const path = require('path');
const fs = require('fs');

// Load environment configuration
require('dotenv').config();

const mcpConfig = require('../config/mcp-config');

const config = {
  development: {
    user: process.env.OCI_DB_DEV_USERNAME || 'ADMIN',
    password: process.env.OCI_DB_DEV_PASSWORD,
    connectString: process.env.OCI_DB_DEV_SERVICE_NAME,
    walletLocation: process.env.OCI_DB_DEV_WALLET_PATH || './wallets/dev-wallet',
    walletPassword: ''
  },
  production: {
    user: process.env.OCI_DB_PROD_USERNAME || 'ADMIN',
    password: process.env.OCI_DB_PROD_PASSWORD,
    connectString: process.env.OCI_DB_PROD_SERVICE_NAME,
    walletLocation: process.env.OCI_DB_PROD_WALLET_PATH || './wallets/prod-wallet',
    walletPassword: ''
  }
};

/**
 * Initialize Oracle client
 */
function initializeOracleClient() {
  try {
    if (process.platform === 'linux' || process.platform === 'darwin') {
      oracledb.initOracleClient();
    }
    console.log('✅ Oracle client initialized');
  } catch (error) {
    console.log('ℹ️  Oracle client already initialized or using thick mode');
  }
}

/**
 * Execute SQL statement with error handling
 */
async function executeSQL(connection, sql, description) {
  try {
    console.log(`   🔄 ${description}...`);
    const result = await connection.execute(sql, {}, { autoCommit: true });
    console.log(`   ✅ ${description} completed`);
    return result;
  } catch (error) {
    if (error.errorNum === 955) { // Object already exists
      console.log(`   ⚠️  ${description} - object already exists, continuing...`);
      return null;
    }
    console.error(`   ❌ ${description} failed:`, error.message);
    throw error;
  }
}

/**
 * Create system authentication and user management schema with project prefixing
 */
async function createSystemSchema(connection, environment = 'development') {
  const projectSettings = mcpConfig.database[environment].projectSettings;
  const tablePrefix = projectSettings.tablePrefix;
  
  console.log(`\n🔐 Creating system authentication schema for ${environment}...`);
  console.log(`   Using table prefix: ${tablePrefix}`);

  // 1. Users table with project prefix
  await executeSQL(connection, `
    CREATE TABLE ${tablePrefix}users (
      user_id RAW(16) DEFAULT SYS_GUID() PRIMARY KEY,
      username VARCHAR2(255) UNIQUE NOT NULL,
      email VARCHAR2(255) UNIQUE NOT NULL,
      password_hash VARCHAR2(255) NOT NULL,
      mfa_secret VARCHAR2(255),
      schema_prefix VARCHAR2(64) UNIQUE NOT NULL,
      first_name VARCHAR2(255),
      last_name VARCHAR2(255),
      timezone VARCHAR2(100) DEFAULT 'UTC',
      preferences JSON,
      account_status VARCHAR2(50) DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      last_login TIMESTAMP,
      email_verified NUMBER(1) DEFAULT 0,
      terms_accepted_at TIMESTAMP,
      privacy_policy_accepted_at TIMESTAMP,
      CONSTRAINT chk_account_status CHECK (account_status IN ('active', 'suspended', 'locked', 'deleted')),
      CONSTRAINT chk_email_verified CHECK (email_verified IN (0, 1))
    )
  `, 'Create users table');

  // 2. User sessions table
  await executeSQL(connection, `
    CREATE TABLE user_sessions (
      session_id RAW(16) DEFAULT SYS_GUID() PRIMARY KEY,
      user_id RAW(16) NOT NULL,
      token_hash VARCHAR2(255) UNIQUE NOT NULL,
      ip_address VARCHAR2(45),
      user_agent CLOB,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      expires_at TIMESTAMP NOT NULL,
      last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      is_active NUMBER(1) DEFAULT 1,
      CONSTRAINT fk_session_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
      CONSTRAINT chk_session_active CHECK (is_active IN (0, 1))
    )
  `, 'Create user_sessions table');

  // 3. API keys table for programmatic access
  await executeSQL(connection, `
    CREATE TABLE api_keys (
      key_id RAW(16) DEFAULT SYS_GUID() PRIMARY KEY,
      user_id RAW(16) NOT NULL,
      key_hash VARCHAR2(255) NOT NULL,
      key_prefix VARCHAR2(10) NOT NULL,
      name VARCHAR2(255),
      permissions JSON,
      rate_limit_per_hour NUMBER DEFAULT 1000,
      last_used TIMESTAMP,
      expires_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      is_active NUMBER(1) DEFAULT 1,
      CONSTRAINT fk_apikey_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
      CONSTRAINT chk_apikey_active CHECK (is_active IN (0, 1))
    )
  `, 'Create api_keys table');

  // 4. Audit log table
  await executeSQL(connection, `
    CREATE TABLE audit_log (
      log_id RAW(16) DEFAULT SYS_GUID() PRIMARY KEY,
      user_id RAW(16),
      action VARCHAR2(100) NOT NULL,
      resource_type VARCHAR2(100),
      resource_id VARCHAR2(255),
      ip_address VARCHAR2(45),
      user_agent CLOB,
      request_data JSON,
      response_code NUMBER(3),
      execution_time_ms NUMBER,
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      success NUMBER(1) DEFAULT 1,
      error_message CLOB,
      CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL,
      CONSTRAINT chk_audit_success CHECK (success IN (0, 1))
    )
  `, 'Create audit_log table');

  // 5. Create indexes for system tables
  await executeSQL(connection, `
    CREATE INDEX idx_sessions_user_active ON user_sessions(user_id, is_active, expires_at)
  `, 'Create sessions user index');

  await executeSQL(connection, `
    CREATE INDEX idx_sessions_token ON user_sessions(token_hash)
  `, 'Create sessions token index');

  await executeSQL(connection, `
    CREATE INDEX idx_apikeys_user ON api_keys(user_id, is_active)
  `, 'Create API keys user index');

  await executeSQL(connection, `
    CREATE INDEX idx_audit_user_time ON audit_log(user_id, timestamp DESC)
  `, 'Create audit log user/time index');

  await executeSQL(connection, `
    CREATE INDEX idx_audit_action ON audit_log(action, timestamp DESC)
  `, 'Create audit log action index');

  console.log('✅ System authentication schema created');
}

/**
 * Create reference data schema (shared across all users)
 */
async function createReferenceSchema(connection) {
  console.log('\n📚 Creating reference data schema...');

  // 1. Skills catalog
  await executeSQL(connection, `
    CREATE TABLE ref_skills_catalog (
      skill_id RAW(16) DEFAULT SYS_GUID() PRIMARY KEY,
      skill_name VARCHAR2(255) UNIQUE NOT NULL,
      category VARCHAR2(100),
      skill_type VARCHAR2(50) CHECK (skill_type IN ('technical', 'soft', 'certification', 'language')),
      description CLOB,
      market_demand NUMBER(2) CHECK (market_demand BETWEEN 1 AND 10),
      related_skills JSON,
      industry_relevance JSON,
      proficiency_levels JSON,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `, 'Create skills catalog');

  // 2. Career paths reference
  await executeSQL(connection, `
    CREATE TABLE ref_career_paths (
      path_id RAW(16) DEFAULT SYS_GUID() PRIMARY KEY,
      path_name VARCHAR2(255) NOT NULL,
      industry VARCHAR2(100),
      description CLOB,
      entry_level_roles JSON,
      mid_level_roles JSON,
      senior_level_roles JSON,
      required_skills JSON,
      typical_progression JSON,
      salary_ranges JSON,
      growth_outlook NUMBER(2) CHECK (growth_outlook BETWEEN 1 AND 10),
      education_requirements JSON,
      certifications JSON,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `, 'Create career paths reference');

  // 3. Role templates
  await executeSQL(connection, `
    CREATE TABLE ref_role_templates (
      role_id RAW(16) DEFAULT SYS_GUID() PRIMARY KEY,
      role_title VARCHAR2(255) NOT NULL,
      role_level VARCHAR2(50) CHECK (role_level IN ('entry', 'mid', 'senior', 'executive', 'c-suite')),
      industry VARCHAR2(100),
      department VARCHAR2(100),
      typical_responsibilities JSON,
      required_skills JSON,
      preferred_skills JSON,
      experience_requirements JSON,
      education_requirements JSON,
      salary_ranges JSON,
      career_path_id RAW(16),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_role_career_path FOREIGN KEY (career_path_id) REFERENCES ref_career_paths(path_id)
    )
  `, 'Create role templates');

  // 4. Industry standards
  await executeSQL(connection, `
    CREATE TABLE ref_industry_standards (
      standard_id RAW(16) DEFAULT SYS_GUID() PRIMARY KEY,
      industry VARCHAR2(100) NOT NULL,
      standard_name VARCHAR2(255) NOT NULL,
      standard_type VARCHAR2(50),
      description CLOB,
      requirements JSON,
      compliance_levels JSON,
      related_roles JSON,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `, 'Create industry standards');

  // 5. Create indexes for reference tables
  await executeSQL(connection, `
    CREATE INDEX idx_skills_category ON ref_skills_catalog(category, skill_type)
  `, 'Create skills category index');

  await executeSQL(connection, `
    CREATE INDEX idx_career_paths_industry ON ref_career_paths(industry)
  `, 'Create career paths industry index');

  await executeSQL(connection, `
    CREATE INDEX idx_roles_industry_level ON ref_role_templates(industry, role_level)
  `, 'Create roles industry/level index');

  console.log('✅ Reference data schema created');
}

/**
 * Create user-specific table templates (used by schema creation function)
 */
function getUserTableTemplates(userPrefix) {
  return {
    experiences_detailed: `
      CREATE TABLE ${userPrefix}_experiences_detailed (
        experience_id RAW(16) DEFAULT SYS_GUID() PRIMARY KEY,
        title VARCHAR2(255) NOT NULL,
        organization VARCHAR2(255),
        department VARCHAR2(255),
        location VARCHAR2(255),
        description CLOB NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE,
        is_current NUMBER(1) DEFAULT 0,
        experience_type VARCHAR2(50) NOT NULL,
        employment_type VARCHAR2(50),
        raw_text CLOB,
        extracted_skills JSON,
        key_highlights JSON,
        quantified_impacts JSON,
        technologies_used JSON,
        role_progression JSON,
        achievements JSON,
        challenges_overcome JSON,
        projects_led JSON,
        team_size NUMBER,
        budget_managed NUMBER,
        revenue_impact NUMBER,
        cost_savings NUMBER,
        industry_tags JSON,
        soft_skills_demonstrated JSON,
        leadership_examples JSON,
        metadata JSON,
        quality_score NUMBER(3,2),
        verification_status VARCHAR2(50) DEFAULT 'unverified',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT chk_${userPrefix}_exp_current CHECK (is_current IN (0, 1)),
        CONSTRAINT chk_${userPrefix}_exp_type CHECK (experience_type IN ('work', 'education', 'certification', 'project', 'volunteer', 'achievement', 'training')),
        CONSTRAINT chk_${userPrefix}_employment_type CHECK (employment_type IN ('full-time', 'part-time', 'contract', 'freelance', 'internship', 'volunteer'))
      )`,
    
    profile_summaries: `
      CREATE TABLE ${userPrefix}_profile_summaries (
        profile_id RAW(16) DEFAULT SYS_GUID() PRIMARY KEY,
        total_years_experience NUMBER(3,1),
        industries JSON,
        core_strengths JSON,
        technical_skills JSON,
        soft_skills JSON,
        leadership_skills JSON,
        career_interests JSON,
        career_goals JSON,
        career_progression JSON,
        key_achievements JSON,
        education_summary JSON,
        certifications JSON,
        languages JSON,
        volunteer_experience JSON,
        unique_value_propositions JSON,
        career_transitions JSON,
        industry_expertise JSON,
        management_experience JSON,
        project_management_experience JSON,
        budget_management_experience JSON,
        team_leadership_experience JSON,
        strategic_planning_experience JSON,
        client_relationship_experience JSON,
        last_regenerated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        generation_metadata JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
    
    quick_summaries: `
      CREATE TABLE ${userPrefix}_quick_summaries (
        summary_id RAW(16) DEFAULT SYS_GUID() PRIMARY KEY,
        executive_summary CLOB NOT NULL,
        headline VARCHAR2(255) NOT NULL,
        key_skills JSON,
        years_experience NUMBER(3,1),
        current_role VARCHAR2(255),
        current_company VARCHAR2(255),
        industries JSON,
        education_level VARCHAR2(100),
        top_certifications JSON,
        location VARCHAR2(255),
        career_goals JSON,
        unique_value_props JSON,
        availability VARCHAR2(100),
        salary_expectations JSON,
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
    
    user_preferences: `
      CREATE TABLE ${userPrefix}_preferences (
        preference_id RAW(16) DEFAULT SYS_GUID() PRIMARY KEY,
        category VARCHAR2(100) NOT NULL,
        preference_key VARCHAR2(255) NOT NULL,
        preference_value JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT uk_${userPrefix}_pref_key UNIQUE (category, preference_key)
      )`,
    
    saved_searches: `
      CREATE TABLE ${userPrefix}_saved_searches (
        search_id RAW(16) DEFAULT SYS_GUID() PRIMARY KEY,
        search_name VARCHAR2(255) NOT NULL,
        search_type VARCHAR2(50),
        search_criteria JSON,
        results_count NUMBER,
        last_executed TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`
  };
}

/**
 * Create user-specific schema for a user
 */
async function createUserSchema(connection, userPrefix) {
  console.log(`\n👤 Creating user schema: ${userPrefix}...`);
  
  const templates = getUserTableTemplates(userPrefix);
  
  // Create all user tables
  for (const [tableName, sql] of Object.entries(templates)) {
    await executeSQL(connection, sql, `Create ${userPrefix}_${tableName} table`);
  }
  
  // Create user-specific indexes
  await executeSQL(connection, `
    CREATE INDEX idx_${userPrefix}_exp_type_date ON ${userPrefix}_experiences_detailed(experience_type, start_date DESC)
  `, `Create ${userPrefix} experience type/date index`);
  
  await executeSQL(connection, `
    CREATE INDEX idx_${userPrefix}_exp_current ON ${userPrefix}_experiences_detailed(is_current, end_date DESC)
  `, `Create ${userPrefix} experience current index`);
  
  await executeSQL(connection, `
    CREATE INDEX idx_${userPrefix}_exp_org ON ${userPrefix}_experiences_detailed(organization, start_date DESC)
  `, `Create ${userPrefix} experience organization index`);
  
  await executeSQL(connection, `
    CREATE INDEX idx_${userPrefix}_profile_updated ON ${userPrefix}_profile_summaries(last_regenerated DESC)
  `, `Create ${userPrefix} profile update index`);
  
  await executeSQL(connection, `
    CREATE INDEX idx_${userPrefix}_quick_updated ON ${userPrefix}_quick_summaries(last_updated DESC)
  `, `Create ${userPrefix} quick summary index`);
  
  // Create user-specific views
  await executeSQL(connection, `
    CREATE OR REPLACE VIEW ${userPrefix}_current_experiences AS
    SELECT * FROM ${userPrefix}_experiences_detailed
    WHERE is_current = 1 OR end_date >= ADD_MONTHS(SYSDATE, -6)
    ORDER BY start_date DESC
  `, `Create ${userPrefix} current experiences view`);
  
  await executeSQL(connection, `
    CREATE OR REPLACE VIEW ${userPrefix}_skills_summary AS
    SELECT 
      JSON_VALUE(extracted_skills, '$[*]' RETURNING CLOB) as all_skills,
      experience_type,
      COUNT(*) as experience_count
    FROM ${userPrefix}_experiences_detailed
    WHERE extracted_skills IS NOT NULL
    GROUP BY JSON_VALUE(extracted_skills, '$[*]' RETURNING CLOB), experience_type
  `, `Create ${userPrefix} skills summary view`);
  
  console.log(`✅ User schema created: ${userPrefix}`);
}

/**
 * Create stored procedures for user management
 */
async function createStoredProcedures(connection) {
  console.log('\n⚙️  Creating stored procedures...');

  // Procedure to create new user schema
  await executeSQL(connection, `
    CREATE OR REPLACE PROCEDURE create_user_schema(
      p_user_id IN RAW,
      p_username IN VARCHAR2,
      p_schema_prefix IN VARCHAR2
    ) AS
      v_sql CLOB;
    BEGIN
      -- Log the schema creation
      INSERT INTO audit_log (user_id, action, resource_type, resource_id)
      VALUES (p_user_id, 'CREATE_USER_SCHEMA', 'USER_SCHEMA', p_schema_prefix);
      
      -- Note: Actual table creation should be done by application
      -- This procedure is for logging and validation only
      
      COMMIT;
    EXCEPTION
      WHEN OTHERS THEN
        ROLLBACK;
        RAISE;
    END create_user_schema;
  `, 'Create user schema procedure');

  // Procedure to clean up user data
  await executeSQL(connection, `
    CREATE OR REPLACE PROCEDURE cleanup_user_data(
      p_user_id IN RAW,
      p_permanent IN NUMBER DEFAULT 0
    ) AS
      v_schema_prefix VARCHAR2(64);
    BEGIN
      -- Get user schema prefix
      SELECT schema_prefix INTO v_schema_prefix 
      FROM users WHERE user_id = p_user_id;
      
      IF p_permanent = 0 THEN
        -- Soft delete - mark as deleted
        UPDATE users SET account_status = 'deleted' WHERE user_id = p_user_id;
        
        -- Log soft delete
        INSERT INTO audit_log (user_id, action, resource_type, resource_id)
        VALUES (p_user_id, 'SOFT_DELETE_USER', 'USER_ACCOUNT', v_schema_prefix);
      ELSE
        -- Log hard delete before removing user
        INSERT INTO audit_log (user_id, action, resource_type, resource_id)
        VALUES (p_user_id, 'HARD_DELETE_USER', 'USER_ACCOUNT', v_schema_prefix);
        
        -- Hard delete - remove user record (cascade will handle sessions, keys)
        DELETE FROM users WHERE user_id = p_user_id;
      END IF;
      
      COMMIT;
    EXCEPTION
      WHEN OTHERS THEN
        ROLLBACK;
        RAISE;
    END cleanup_user_data;
  `, 'Create user cleanup procedure');

  console.log('✅ Stored procedures created');
}

/**
 * Create monitoring and performance views
 */
async function createMonitoringViews(connection) {
  console.log('\n📊 Creating monitoring views...');

  // System overview
  await executeSQL(connection, `
    CREATE OR REPLACE VIEW v_system_overview AS
    SELECT 
      (SELECT COUNT(*) FROM users WHERE account_status = 'active') as active_users,
      (SELECT COUNT(*) FROM users WHERE account_status = 'suspended') as suspended_users,
      (SELECT COUNT(*) FROM user_sessions WHERE is_active = 1 AND expires_at > SYSDATE) as active_sessions,
      (SELECT COUNT(*) FROM api_keys WHERE is_active = 1) as active_api_keys,
      (SELECT COUNT(*) FROM audit_log WHERE timestamp >= SYSDATE - 1) as actions_last_24h
    FROM dual
  `, 'Create system overview view');

  // User statistics
  await executeSQL(connection, `
    CREATE OR REPLACE VIEW v_user_statistics AS
    SELECT 
      u.username,
      u.email,
      u.schema_prefix,
      u.account_status,
      u.created_at,
      u.last_login,
      COUNT(DISTINCT s.session_id) as active_sessions,
      COUNT(DISTINCT ak.key_id) as api_keys,
      (SELECT COUNT(*) FROM audit_log al WHERE al.user_id = u.user_id 
       AND al.timestamp >= SYSDATE - 1) as actions_last_24h
    FROM users u
    LEFT JOIN user_sessions s ON u.user_id = s.user_id AND s.is_active = 1 AND s.expires_at > SYSDATE
    LEFT JOIN api_keys ak ON u.user_id = ak.user_id AND ak.is_active = 1
    GROUP BY u.user_id, u.username, u.email, u.schema_prefix, u.account_status, u.created_at, u.last_login
  `, 'Create user statistics view');

  // Security audit view
  await executeSQL(connection, `
    CREATE OR REPLACE VIEW v_security_audit AS
    SELECT 
      al.timestamp,
      u.username,
      al.action,
      al.resource_type,
      al.resource_id,
      al.ip_address,
      al.success,
      al.execution_time_ms,
      al.error_message
    FROM audit_log al
    LEFT JOIN users u ON al.user_id = u.user_id
    WHERE al.timestamp >= SYSDATE - 7
    ORDER BY al.timestamp DESC
  `, 'Create security audit view');

  console.log('✅ Monitoring views created');
}

/**
 * Deploy complete multi-user schema
 */
async function deploySchema(environment) {
  const envConfig = config[environment];
  
  if (!envConfig.password || !envConfig.connectString) {
    throw new Error(`Missing required configuration for ${environment} environment. Check your .env file.`);
  }

  if (!fs.existsSync(envConfig.walletLocation)) {
    throw new Error(`Wallet location not found: ${envConfig.walletLocation}`);
  }

  console.log(`🚀 Deploying multi-user schema to ${environment} environment...`);
  console.log(`   Database: ${envConfig.connectString}`);
  console.log(`   Wallet: ${envConfig.walletLocation}`);

  let connection;
  
  try {
    // Create connection
    connection = await oracledb.getConnection({
      user: envConfig.user,
      password: envConfig.password,
      connectString: envConfig.connectString,
      walletLocation: envConfig.walletLocation,
      walletPassword: envConfig.walletPassword
    });

    console.log('✅ Connected to Oracle Autonomous Database');

    // Deploy all schema components
    await createSystemSchema(connection);
    await createReferenceSchema(connection);
    await createStoredProcedures(connection);
    await createMonitoringViews(connection);

    // Create a sample user schema for testing
    const sampleUserPrefix = 'usr_sample';
    await createUserSchema(connection, sampleUserPrefix);

    // Verify deployment
    const tableCheck = await connection.execute(`
      SELECT table_name, num_rows 
      FROM user_tables 
      WHERE table_name IN (
        'USERS', 'USER_SESSIONS', 'API_KEYS', 'AUDIT_LOG',
        'REF_SKILLS_CATALOG', 'REF_CAREER_PATHS', 'REF_ROLE_TEMPLATES', 'REF_INDUSTRY_STANDARDS',
        'USR_SAMPLE_EXPERIENCES_DETAILED', 'USR_SAMPLE_PROFILE_SUMMARIES', 'USR_SAMPLE_QUICK_SUMMARIES'
      )
      ORDER BY table_name
    `);

    console.log('\n📊 Multi-User Schema Deployment Summary:');
    console.log('   Tables created:');
    tableCheck.rows.forEach(row => {
      console.log(`   ✅ ${row[0]} (${row[1] || 0} rows)`);
    });

    // Check procedures
    const procCheck = await connection.execute(`
      SELECT object_name FROM user_objects 
      WHERE object_type = 'PROCEDURE'
      ORDER BY object_name
    `);

    console.log('\n   Procedures created:');
    procCheck.rows.forEach(row => {
      console.log(`   ⚙️  ${row[0]}`);
    });

    // Check views
    const viewCheck = await connection.execute(`
      SELECT view_name FROM user_views 
      WHERE view_name LIKE 'V_%'
      ORDER BY view_name
    `);

    console.log('\n   Views created:');
    viewCheck.rows.forEach(row => {
      console.log(`   📊 ${row[0]}`);
    });

    console.log(`\n🎉 Multi-user schema deployment completed successfully for ${environment} environment!`);
    console.log(`   Sample user schema created: ${sampleUserPrefix}`);
    console.log(`   Ready for multi-user MCP server connection`);

  } catch (error) {
    console.error(`\n❌ Schema deployment failed for ${environment}:`, error.message);
    throw error;
  } finally {
    if (connection) {
      await connection.close();
      console.log('🔌 Database connection closed');
    }
  }
}

/**
 * Main execution
 */
async function main() {
  const environment = process.argv[2] || process.env.NODE_ENV || 'development';
  
  if (!['development', 'production'].includes(environment)) {
    console.error('❌ Invalid environment. Use "development" or "production"');
    console.error('Usage: npm run db:migrate [development|production]');
    process.exit(1);
  }

  try {
    initializeOracleClient();
    await deploySchema(environment);
    console.log('\n🚀 Next steps:');
    console.log('   1. Run health check: npm run db:health');
    console.log('   2. Seed reference data: npm run db:seed');
    console.log('   3. Create user accounts and schemas as needed');
    console.log('   4. Start multi-user MCP server: npm run mcp:start');
    process.exit(0);
  } catch (error) {
    console.error('\n💥 Deployment failed:', error.message);
    console.error('\n🔧 Troubleshooting:');
    console.error('   1. Check database credentials in .env file');
    console.error('   2. Verify wallet files are in correct location');
    console.error('   3. Ensure database is accessible and running');
    console.error('   4. Run connection test: npm run db:test-connection');
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { deploySchema, createUserSchema, getUserTableTemplates };