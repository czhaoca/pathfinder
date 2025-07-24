#!/usr/bin/env node

/**
 * Multi-Environment Prefixed Schema Deployment Script
 * Deploys Career Navigator schema with proper table prefixing for shared databases
 * Supports development and production environments with isolation
 */

const oracledb = require('oracledb');
const path = require('path');
const fs = require('fs');

// Load environment configuration
require('dotenv').config();
const mcpConfig = require('../config/mcp-config');

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
async function createSystemSchema(connection, environment) {
  const projectSettings = mcpConfig.database[environment].projectSettings;
  const tablePrefix = projectSettings.tablePrefix;
  const tableSpace = projectSettings.tableSpace;
  
  console.log(`\n🔐 Creating system authentication schema for ${environment}...`);
  console.log(`   Table prefix: ${tablePrefix}`);
  console.log(`   Tablespace: ${tableSpace}`);

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
      project_environment VARCHAR2(50) DEFAULT '${environment}',
      CONSTRAINT chk_${tablePrefix}account_status CHECK (account_status IN ('active', 'suspended', 'locked', 'deleted')),
      CONSTRAINT chk_${tablePrefix}email_verified CHECK (email_verified IN (0, 1))
    ) TABLESPACE ${tableSpace}
  `, `Create ${tablePrefix}users table`);

  // 2. User sessions table
  await executeSQL(connection, `
    CREATE TABLE ${tablePrefix}user_sessions (
      session_id RAW(16) DEFAULT SYS_GUID() PRIMARY KEY,
      user_id RAW(16) NOT NULL,
      token_hash VARCHAR2(255) UNIQUE NOT NULL,
      ip_address VARCHAR2(45),
      user_agent CLOB,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      expires_at TIMESTAMP NOT NULL,
      last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      is_active NUMBER(1) DEFAULT 1,
      environment VARCHAR2(50) DEFAULT '${environment}',
      CONSTRAINT fk_${tablePrefix}session_user FOREIGN KEY (user_id) REFERENCES ${tablePrefix}users(user_id) ON DELETE CASCADE,
      CONSTRAINT chk_${tablePrefix}session_active CHECK (is_active IN (0, 1))
    ) TABLESPACE ${tableSpace}
  `, `Create ${tablePrefix}user_sessions table`);

  // 3. API keys table for programmatic access
  await executeSQL(connection, `
    CREATE TABLE ${tablePrefix}api_keys (
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
      environment VARCHAR2(50) DEFAULT '${environment}',
      CONSTRAINT fk_${tablePrefix}apikey_user FOREIGN KEY (user_id) REFERENCES ${tablePrefix}users(user_id) ON DELETE CASCADE,
      CONSTRAINT chk_${tablePrefix}apikey_active CHECK (is_active IN (0, 1))
    ) TABLESPACE ${tableSpace}
  `, `Create ${tablePrefix}api_keys table`);

  // 4. Audit log table
  await executeSQL(connection, `
    CREATE TABLE ${tablePrefix}audit_log (
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
      environment VARCHAR2(50) DEFAULT '${environment}',
      project_name VARCHAR2(100) DEFAULT '${mcpConfig.project.name}',
      CONSTRAINT fk_${tablePrefix}audit_user FOREIGN KEY (user_id) REFERENCES ${tablePrefix}users(user_id) ON DELETE SET NULL,
      CONSTRAINT chk_${tablePrefix}audit_success CHECK (success IN (0, 1))
    ) TABLESPACE ${tableSpace}
  `, `Create ${tablePrefix}audit_log table`);

  // 5. Legal holds table for compliance
  await executeSQL(connection, `
    CREATE TABLE ${tablePrefix}legal_holds (
      hold_id RAW(16) DEFAULT SYS_GUID() PRIMARY KEY,
      resource_type VARCHAR2(100) NOT NULL,
      resource_id VARCHAR2(255) NOT NULL,
      reason CLOB NOT NULL,
      created_by VARCHAR2(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      released_at TIMESTAMP,
      released_by VARCHAR2(255),
      release_reason CLOB,
      is_active NUMBER(1) DEFAULT 1,
      environment VARCHAR2(50) DEFAULT '${environment}',
      CONSTRAINT chk_${tablePrefix}hold_active CHECK (is_active IN (0, 1))
    ) TABLESPACE ${tableSpace}
  `, `Create ${tablePrefix}legal_holds table`);

  // 6. Create indexes for system tables
  await executeSQL(connection, `
    CREATE INDEX idx_${tablePrefix}sessions_user_active ON ${tablePrefix}user_sessions(user_id, is_active, expires_at)
  `, `Create sessions user index`);

  await executeSQL(connection, `
    CREATE INDEX idx_${tablePrefix}sessions_token ON ${tablePrefix}user_sessions(token_hash)
  `, `Create sessions token index`);

  await executeSQL(connection, `
    CREATE INDEX idx_${tablePrefix}apikeys_user ON ${tablePrefix}api_keys(user_id, is_active)
  `, `Create API keys user index`);

  await executeSQL(connection, `
    CREATE INDEX idx_${tablePrefix}audit_user_time ON ${tablePrefix}audit_log(user_id, timestamp DESC)
  `, `Create audit log user/time index`);

  await executeSQL(connection, `
    CREATE INDEX idx_${tablePrefix}audit_env_action ON ${tablePrefix}audit_log(environment, action, timestamp DESC)
  `, `Create audit log environment/action index`);

  await executeSQL(connection, `
    CREATE INDEX idx_${tablePrefix}holds_resource ON ${tablePrefix}legal_holds(resource_type, resource_id, is_active)
  `, `Create legal holds resource index`);

  console.log('✅ System authentication schema created with project isolation');
}

/**
 * Create reference data schema (shared across environments but prefixed)
 */
async function createReferenceSchema(connection, environment) {
  const projectSettings = mcpConfig.database[environment].projectSettings;
  const tablePrefix = projectSettings.tablePrefix;
  const tableSpace = projectSettings.tableSpace;
  
  console.log(`\n📚 Creating reference data schema for ${environment}...`);

  // 1. Skills catalog with project prefix
  await executeSQL(connection, `
    CREATE TABLE ${tablePrefix}ref_skills_catalog (
      skill_id RAW(16) DEFAULT SYS_GUID() PRIMARY KEY,
      skill_name VARCHAR2(255) UNIQUE NOT NULL,
      category VARCHAR2(100),
      skill_type VARCHAR2(50) CHECK (skill_type IN ('technical', 'soft', 'certification', 'language')),
      description CLOB,
      market_demand NUMBER(2) CHECK (market_demand BETWEEN 1 AND 10),
      related_skills JSON,
      industry_relevance JSON,
      proficiency_levels JSON,
      environment VARCHAR2(50) DEFAULT '${environment}',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) TABLESPACE ${tableSpace}
  `, `Create ${tablePrefix}skills catalog`);

  // 2. Career paths reference
  await executeSQL(connection, `
    CREATE TABLE ${tablePrefix}ref_career_paths (
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
      environment VARCHAR2(50) DEFAULT '${environment}',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) TABLESPACE ${tableSpace}
  `, `Create ${tablePrefix}career paths reference`);

  // 3. Role templates
  await executeSQL(connection, `
    CREATE TABLE ${tablePrefix}ref_role_templates (
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
      environment VARCHAR2(50) DEFAULT '${environment}',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_${tablePrefix}role_career_path FOREIGN KEY (career_path_id) REFERENCES ${tablePrefix}ref_career_paths(path_id)
    ) TABLESPACE ${tableSpace}
  `, `Create ${tablePrefix}role templates`);

  // 4. Industry standards
  await executeSQL(connection, `
    CREATE TABLE ${tablePrefix}ref_industry_standards (
      standard_id RAW(16) DEFAULT SYS_GUID() PRIMARY KEY,
      industry VARCHAR2(100) NOT NULL,
      standard_name VARCHAR2(255) NOT NULL,
      standard_type VARCHAR2(50),
      description CLOB,
      requirements JSON,
      compliance_levels JSON,
      related_roles JSON,
      environment VARCHAR2(50) DEFAULT '${environment}',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) TABLESPACE ${tableSpace}
  `, `Create ${tablePrefix}industry standards`);

  // 5. Create indexes for reference tables
  await executeSQL(connection, `
    CREATE INDEX idx_${tablePrefix}skills_category ON ${tablePrefix}ref_skills_catalog(category, skill_type)
  `, `Create skills category index`);

  await executeSQL(connection, `
    CREATE INDEX idx_${tablePrefix}career_paths_industry ON ${tablePrefix}ref_career_paths(industry)
  `, `Create career paths industry index`);

  await executeSQL(connection, `
    CREATE INDEX idx_${tablePrefix}roles_industry_level ON ${tablePrefix}ref_role_templates(industry, role_level)
  `, `Create roles industry/level index`);

  console.log('✅ Reference data schema created with project isolation');
}

/**
 * Create user-specific table templates with environment awareness
 */
function getUserTableTemplates(userPrefix, environment) {
  const projectSettings = mcpConfig.database[environment].projectSettings;
  const tableSpace = projectSettings.tableSpace;
  
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
        environment VARCHAR2(50) DEFAULT '${environment}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT chk_${userPrefix}_exp_current CHECK (is_current IN (0, 1)),
        CONSTRAINT chk_${userPrefix}_exp_type CHECK (experience_type IN ('work', 'education', 'certification', 'project', 'volunteer', 'achievement', 'training')),
        CONSTRAINT chk_${userPrefix}_employment_type CHECK (employment_type IN ('full-time', 'part-time', 'contract', 'freelance', 'internship', 'volunteer'))
      ) TABLESPACE ${tableSpace}`,
    
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
        environment VARCHAR2(50) DEFAULT '${environment}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) TABLESPACE ${tableSpace}`,
    
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
        environment VARCHAR2(50) DEFAULT '${environment}',
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) TABLESPACE ${tableSpace}`,
    
    user_preferences: `
      CREATE TABLE ${userPrefix}_preferences (
        preference_id RAW(16) DEFAULT SYS_GUID() PRIMARY KEY,
        category VARCHAR2(100) NOT NULL,
        preference_key VARCHAR2(255) NOT NULL,
        preference_value JSON,
        environment VARCHAR2(50) DEFAULT '${environment}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT uk_${userPrefix}_pref_key UNIQUE (category, preference_key)
      ) TABLESPACE ${tableSpace}`
  };
}

/**
 * Create user-specific schema for a user with environment isolation
 */
async function createUserSchema(connection, userPrefix, environment) {
  console.log(`\n👤 Creating user schema: ${userPrefix} (${environment})...`);
  
  const templates = getUserTableTemplates(userPrefix, environment);
  
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
    CREATE INDEX idx_${userPrefix}_exp_env ON ${userPrefix}_experiences_detailed(environment, updated_at DESC)
  `, `Create ${userPrefix} experience environment index`);
  
  // Create user-specific views
  await executeSQL(connection, `
    CREATE OR REPLACE VIEW ${userPrefix}_current_experiences AS
    SELECT * FROM ${userPrefix}_experiences_detailed
    WHERE is_current = 1 OR end_date >= ADD_MONTHS(SYSDATE, -6)
    ORDER BY start_date DESC
  `, `Create ${userPrefix} current experiences view`);
  
  console.log(`✅ User schema created: ${userPrefix} with environment isolation`);
}

/**
 * Create environment-specific monitoring views
 */
async function createMonitoringViews(connection, environment) {
  const projectSettings = mcpConfig.database[environment].projectSettings;
  const tablePrefix = projectSettings.tablePrefix;
  
  console.log(`\n📊 Creating monitoring views for ${environment}...`);

  // Environment-specific system overview
  await executeSQL(connection, `
    CREATE OR REPLACE VIEW v_${tablePrefix}system_overview AS
    SELECT 
      '${environment}' as environment,
      '${mcpConfig.project.name}' as project_name,
      (SELECT COUNT(*) FROM ${tablePrefix}users WHERE account_status = 'active') as active_users,
      (SELECT COUNT(*) FROM ${tablePrefix}users WHERE account_status = 'suspended') as suspended_users,
      (SELECT COUNT(*) FROM ${tablePrefix}user_sessions WHERE is_active = 1 AND expires_at > SYSDATE) as active_sessions,
      (SELECT COUNT(*) FROM ${tablePrefix}api_keys WHERE is_active = 1) as active_api_keys,
      (SELECT COUNT(*) FROM ${tablePrefix}audit_log WHERE timestamp >= SYSDATE - 1) as actions_last_24h
    FROM dual
  `, 'Create environment-specific system overview view');

  // Environment-specific user statistics
  await executeSQL(connection, `
    CREATE OR REPLACE VIEW v_${tablePrefix}user_statistics AS
    SELECT 
      '${environment}' as environment,
      u.username,
      u.email,
      u.schema_prefix,
      u.account_status,
      u.created_at,
      u.last_login,
      COUNT(DISTINCT s.session_id) as active_sessions,
      COUNT(DISTINCT ak.key_id) as api_keys,
      (SELECT COUNT(*) FROM ${tablePrefix}audit_log al WHERE al.user_id = u.user_id 
       AND al.timestamp >= SYSDATE - 1) as actions_last_24h
    FROM ${tablePrefix}users u
    LEFT JOIN ${tablePrefix}user_sessions s ON u.user_id = s.user_id AND s.is_active = 1 AND s.expires_at > SYSDATE
    LEFT JOIN ${tablePrefix}api_keys ak ON u.user_id = ak.user_id AND ak.is_active = 1
    GROUP BY u.user_id, u.username, u.email, u.schema_prefix, u.account_status, u.created_at, u.last_login
  `, 'Create environment-specific user statistics view');

  console.log('✅ Monitoring views created with environment isolation');
}

/**
 * Deploy complete multi-user schema with environment separation
 */
async function deploySchema(environment) {
  const dbConfig = mcpConfig.database[environment];
  
  if (!dbConfig.password || !dbConfig.serviceName) {
    throw new Error(`Missing required configuration for ${environment} environment. Check your .env file.`);
  }

  if (!fs.existsSync(dbConfig.walletLocation)) {
    throw new Error(`Wallet location not found: ${dbConfig.walletLocation}`);
  }

  console.log(`🚀 Deploying Career Navigator schema to ${environment} environment...`);
  console.log(`   Database: ${dbConfig.serviceName}`);
  console.log(`   Wallet: ${dbConfig.walletLocation}`);
  console.log(`   Project: ${mcpConfig.project.name}`);
  console.log(`   Table prefix: ${dbConfig.projectSettings.tablePrefix}`);

  let connection;
  
  try {
    // Create connection
    connection = await oracledb.getConnection({
      user: dbConfig.username,
      password: dbConfig.password,
      connectString: dbConfig.serviceName,
      walletLocation: dbConfig.walletLocation,
      walletPassword: dbConfig.walletPassword
    });

    console.log('✅ Connected to Oracle Autonomous Database');

    // Deploy all schema components with environment isolation
    await createSystemSchema(connection, environment);
    await createReferenceSchema(connection, environment);
    await createMonitoringViews(connection, environment);

    // Create a sample user schema for testing
    const sampleUserPrefix = `${dbConfig.projectSettings.schemaPrefix}sample`;
    await createUserSchema(connection, sampleUserPrefix, environment);

    // Verify deployment
    const tablePrefix = dbConfig.projectSettings.tablePrefix;
    const tableCheck = await connection.execute(`
      SELECT table_name, num_rows 
      FROM user_tables 
      WHERE table_name LIKE '${tablePrefix.toUpperCase()}%'
      ORDER BY table_name
    `);

    console.log(`\n📊 Career Navigator Schema Deployment Summary (${environment.toUpperCase()}):`);
    console.log('   Project tables created:');
    tableCheck.rows.forEach(row => {
      console.log(`   ✅ ${row[0]} (${row[1] || 0} rows)`);
    });

    console.log(`\n🎉 Career Navigator schema deployment completed successfully for ${environment} environment!`);
    console.log(`   Sample user schema created: ${sampleUserPrefix}`);
    console.log(`   Ready for environment-specific MCP server connection`);
    console.log(`   Project isolation: ${mcpConfig.project.name} with prefix ${tablePrefix}`);

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
    console.error('Usage: npm run db:deploy [development|production]');
    process.exit(1);
  }

  try {
    initializeOracleClient();
    await deploySchema(environment);
    console.log('\n🚀 Next steps:');
    console.log(`   1. Run health check: npm run db:health:${environment}`);
    console.log(`   2. Seed reference data: npm run db:seed:${environment}`);
    console.log(`   3. Start MCP server: npm run mcp:${environment}`);
    console.log(`   4. Test deployment: npm run test:${environment}`);
    process.exit(0);
  } catch (error) {
    console.error('\n💥 Deployment failed:', error.message);
    console.error('\n🔧 Troubleshooting:');
    console.error('   1. Check database credentials in .env file');
    console.error('   2. Verify wallet files are in correct location');
    console.error('   3. Ensure database is accessible and running');
    console.error(`   4. Run connection test: npm run db:test:${environment}`);
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