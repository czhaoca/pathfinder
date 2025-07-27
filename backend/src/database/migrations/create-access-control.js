#!/usr/bin/env node

/**
 * Access Control Setup for Shared Database Environments
 * Creates roles, permissions, and access controls for Career Navigator
 * Ensures proper isolation between projects and environments
 */

const oracledb = require('oracledb');
const config = require('../../config');

// Load environment configuration
require('dotenv').config();

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
    if (error.errorNum === 1921 || error.errorNum === 1925) { // Role/user already exists
      console.log(`   ⚠️  ${description} - object already exists, continuing...`);
      return null;
    }
    console.error(`   ❌ ${description} failed:`, error.message);
    throw error;
  }
}

/**
 * Create application-specific roles for Career Navigator
 */
async function createApplicationRoles(connection, environment) {
  const tablePrefix = (config.project.tablePrefix || 'skill_').toUpperCase();
  
  console.log(`\n🔐 Creating Career Navigator access control roles for ${environment}...`);

  // 1. Application Role
  await executeSQL(connection, `
    CREATE ROLE SKILL_${environment.toUpperCase()}_APP_ROLE
  `, `Create application role for ${environment}`);

  // 2. Read-Only Role
  await executeSQL(connection, `
    CREATE ROLE SKILL_${environment.toUpperCase()}_READONLY_ROLE
  `, `Create read-only role for ${environment}`);

  // 3. Admin Role
  await executeSQL(connection, `
    CREATE ROLE SKILL_${environment.toUpperCase()}_ADMIN_ROLE
  `, `Create admin role for ${environment}`);

  // 4. User Role (for individual users)
  await executeSQL(connection, `
    CREATE ROLE SKILL_${environment.toUpperCase()}_USER_ROLE
  `, `Create user role for ${environment}`);

  console.log('✅ Application roles created successfully');
}

/**
 * Grant table permissions to roles
 */
async function grantTablePermissions(connection, environment) {
  const tablePrefix = config.project.tablePrefix || 'skill_';
  const envUpper = environment.toUpperCase();
  
  console.log(`\n📋 Granting table permissions for ${environment}...`);

  // Application role permissions (full CRUD on Career Navigator tables)
  const appTables = [
    `${tablePrefix}users`,
    `${tablePrefix}user_sessions`, 
    `${tablePrefix}api_keys`,
    `${tablePrefix}audit_log`,
    `${tablePrefix}legal_holds`,
    `${tablePrefix}ref_skills_catalog`,
    `${tablePrefix}ref_career_paths`,
    `${tablePrefix}ref_role_templates`,
    `${tablePrefix}ref_industry_standards`
  ];

  for (const table of appTables) {
    // Application role gets full access
    await executeSQL(connection, `
      GRANT SELECT, INSERT, UPDATE, DELETE ON ${table} TO SKILL_${envUpper}_APP_ROLE
    `, `Grant app permissions on ${table}`);

    // Read-only role gets SELECT only
    await executeSQL(connection, `
      GRANT SELECT ON ${table} TO SKILL_${envUpper}_READONLY_ROLE
    `, `Grant read-only permissions on ${table}`);

    // Admin role gets full access plus admin operations
    await executeSQL(connection, `
      GRANT ALL ON ${table} TO SKILL_${envUpper}_ADMIN_ROLE
    `, `Grant admin permissions on ${table}`);
  }

  // User role permissions (limited to own data)
  await executeSQL(connection, `
    GRANT SELECT ON ${tablePrefix}ref_skills_catalog TO SKILL_${envUpper}_USER_ROLE
  `, `Grant user access to skills catalog`);

  await executeSQL(connection, `
    GRANT SELECT ON ${tablePrefix}ref_career_paths TO SKILL_${envUpper}_USER_ROLE
  `, `Grant user access to career paths`);

  await executeSQL(connection, `
    GRANT SELECT ON ${tablePrefix}ref_role_templates TO SKILL_${envUpper}_USER_ROLE
  `, `Grant user access to role templates`);

  console.log('✅ Table permissions granted successfully');
}

/**
 * Create Row Level Security (RLS) policies
 */
async function createRLSPolicies(connection, environment) {
  const tablePrefix = config.project.tablePrefix || 'skill_';
  const envUpper = environment.toUpperCase();
  
  console.log(`\n🛡️  Creating Row Level Security policies for ${environment}...`);

  // RLS policy for users table (users can only see their own record)
  await executeSQL(connection, `
    CREATE OR REPLACE FUNCTION skill_${environment}_user_rls_policy(schema_name VARCHAR2 DEFAULT NULL)
    RETURN VARCHAR2
    IS
    BEGIN
      -- Allow admin role to see all
      IF SYS_CONTEXT('USERENV', 'CURRENT_USER') LIKE 'SKILL_${envUpper}_ADMIN%' THEN
        RETURN '1=1';
      END IF;
      
      -- Regular users can only see their own records
      RETURN 'user_id = SYS_CONTEXT(''USERENV'', ''SESSION_USER'') OR 
              username = SYS_CONTEXT(''USERENV'', ''SESSION_USER'')';
    END;
  `, `Create user RLS policy function for ${environment}`);

  // Enable RLS on users table
  await executeSQL(connection, `
    BEGIN
      DBMS_RLS.ADD_POLICY(
        object_schema => USER,
        object_name => '${tablePrefix.toUpperCase()}USERS',
        policy_name => 'SKILL_${envUpper}_USER_POLICY',
        function_schema => USER,
        policy_function => 'skill_${environment}_user_rls_policy',
        statement_types => 'SELECT,UPDATE,DELETE'
      );
    END;
  `, `Enable RLS policy on users table`);

  // RLS policy for audit logs (users can only see their own logs)
  await executeSQL(connection, `
    BEGIN
      DBMS_RLS.ADD_POLICY(
        object_schema => USER,
        object_name => '${tablePrefix.toUpperCase()}AUDIT_LOG',
        policy_name => 'SKILL_${envUpper}_AUDIT_POLICY',
        function_schema => USER,
        policy_function => 'skill_${environment}_user_rls_policy',
        statement_types => 'SELECT'
      );
    END;
  `, `Enable RLS policy on audit log table`);

  console.log('✅ Row Level Security policies created successfully');
}

/**
 * Create application user accounts
 */
async function createApplicationUsers(connection, environment) {
  const envUpper = environment.toUpperCase();
  
  console.log(`\n👥 Creating application user accounts for ${environment}...`);

  // 1. Application service account
  const appUserPassword = process.env[`SKILL_${envUpper}_APP_PASSWORD`] || 'ChangeMe123!';
  await executeSQL(connection, `
    CREATE USER SKILL_${envUpper}_APP IDENTIFIED BY "${appUserPassword}"
  `, `Create application user for ${environment}`);

  await executeSQL(connection, `
    GRANT SKILL_${envUpper}_APP_ROLE TO SKILL_${envUpper}_APP
  `, `Grant application role to app user`);

  await executeSQL(connection, `
    GRANT CREATE SESSION TO SKILL_${envUpper}_APP
  `, `Grant session privileges to app user`);

  // 2. Read-only service account
  const readOnlyPassword = process.env[`SKILL_${envUpper}_READONLY_PASSWORD`] || 'ReadOnly123!';
  await executeSQL(connection, `
    CREATE USER SKILL_${envUpper}_READONLY IDENTIFIED BY "${readOnlyPassword}"
  `, `Create read-only user for ${environment}`);

  await executeSQL(connection, `
    GRANT SKILL_${envUpper}_READONLY_ROLE TO SKILL_${envUpper}_READONLY
  `, `Grant read-only role to readonly user`);

  await executeSQL(connection, `
    GRANT CREATE SESSION TO SKILL_${envUpper}_READONLY
  `, `Grant session privileges to readonly user`);

  console.log('✅ Application users created successfully');
  console.log('⚠️  Please update .env file with the new user credentials:');
  console.log(`   SKILL_${envUpper}_APP_USERNAME=SKILL_${envUpper}_APP`);
  console.log(`   SKILL_${envUpper}_APP_PASSWORD=${appUserPassword}`);
  console.log(`   SKILL_${envUpper}_READONLY_USERNAME=SKILL_${envUpper}_READONLY`);
  console.log(`   SKILL_${envUpper}_READONLY_PASSWORD=${readOnlyPassword}`);
}

/**
 * Create Virtual Private Database (VPD) policies for multi-tenant isolation
 */
async function createVPDPolicies(connection, environment) {
  const tablePrefix = config.project.tablePrefix || 'skill_';
  
  console.log(`\n🏢 Creating Virtual Private Database policies for ${environment}...`);

  // VPD function for environment isolation
  await executeSQL(connection, `
    CREATE OR REPLACE FUNCTION skill_${environment}_vpd_policy(
      schema_name VARCHAR2,
      table_name VARCHAR2
    ) RETURN VARCHAR2
    IS
      v_predicate VARCHAR2(4000);
    BEGIN
      -- Only show records for current environment
      v_predicate := 'environment = ''${environment}''';
      
      -- Add project name filter if project_name column exists
      IF UPPER(table_name) LIKE '%AUDIT_LOG%' THEN
        v_predicate := v_predicate || ' AND project_name = ''${mcpConfig.project.name}''';
      END IF;
      
      RETURN v_predicate;
    END;
  `, `Create VPD policy function for ${environment}`);

  // Apply VPD to audit log table
  await executeSQL(connection, `
    BEGIN
      DBMS_RLS.ADD_POLICY(
        object_schema => USER,
        object_name => '${tablePrefix.toUpperCase()}AUDIT_LOG',
        policy_name => 'SKILL_${environment.toUpperCase()}_VPD_POLICY',
        function_schema => USER,
        policy_function => 'skill_${environment}_vpd_policy',
        statement_types => 'SELECT,INSERT,UPDATE,DELETE'
      );
    END;
  `, `Apply VPD policy to audit log table`);

  console.log('✅ Virtual Private Database policies created successfully');
}

/**
 * Create monitoring and alerting for access control
 */
async function createAccessMonitoring(connection, environment) {
  const projectSettings = mcpConfig.database[environment].projectSettings;
  const tablePrefix = projectSettings.tablePrefix;
  
  console.log(`\n📊 Creating access monitoring for ${environment}...`);

  // Create access monitoring view
  await executeSQL(connection, `
    CREATE OR REPLACE VIEW v_skill_${environment}_access_monitor AS
    SELECT 
      al.timestamp,
      al.user_id,
      u.username,
      al.action,
      al.resource_type,
      al.ip_address,
      al.success,
      CASE 
        WHEN al.action LIKE '%LOGIN%' THEN 'Authentication'
        WHEN al.action LIKE '%DATA%' THEN 'Data Access'
        WHEN al.action LIKE '%ADMIN%' THEN 'Administrative'
        ELSE 'Other'
      END as activity_category,
      CASE
        WHEN al.success = 0 THEN 'FAILED'
        WHEN al.action LIKE '%DELETE%' THEN 'HIGH_RISK'
        WHEN al.action LIKE '%ADMIN%' THEN 'MEDIUM_RISK'
        ELSE 'NORMAL'
      END as risk_level
    FROM ${tablePrefix}audit_log al
    LEFT JOIN ${tablePrefix}users u ON al.user_id = u.user_id
    WHERE al.environment = '${environment}'
      AND al.timestamp >= SYSDATE - 30
    ORDER BY al.timestamp DESC
  `, `Create access monitoring view for ${environment}`);

  // Create suspicious activity detection function
  await executeSQL(connection, `
    CREATE OR REPLACE FUNCTION detect_suspicious_activity_${environment}(
      p_user_id RAW,
      p_time_window_hours NUMBER DEFAULT 1
    ) RETURN NUMBER
    IS
      v_failed_attempts NUMBER;
      v_risk_score NUMBER := 0;
    BEGIN
      -- Count failed login attempts
      SELECT COUNT(*)
      INTO v_failed_attempts
      FROM ${tablePrefix}audit_log
      WHERE user_id = p_user_id
        AND action LIKE '%FAILED%'
        AND timestamp >= SYSDATE - (p_time_window_hours/24)
        AND environment = '${environment}';
      
      -- Calculate risk score
      IF v_failed_attempts >= 5 THEN
        v_risk_score := 100; -- Critical
      ELSIF v_failed_attempts >= 3 THEN
        v_risk_score := 75;  -- High
      ELSIF v_failed_attempts >= 1 THEN
        v_risk_score := 25;  -- Low
      END IF;
      
      RETURN v_risk_score;
    END;
  `, `Create suspicious activity detection function for ${environment}`);

  console.log('✅ Access monitoring created successfully');
}

/**
 * Deploy access control for specific environment
 */
async function deployAccessControl(environment) {
  const dbConfig = mcpConfig.database[environment];
  
  if (!dbConfig.password || !dbConfig.serviceName) {
    throw new Error(`Missing required configuration for ${environment} environment`);
  }

  console.log(`🔐 Deploying Career Navigator access control for ${environment} environment...`);
  console.log(`   Project: ${mcpConfig.project.name}`);
  console.log(`   Table prefix: ${dbConfig.projectSettings.tablePrefix}`);

  let connection;
  
  try {
    // Connect as admin user to create roles and users
    connection = await oracledb.getConnection({
      user: dbConfig.username,
      password: dbConfig.password,
      connectString: dbConfig.serviceName,
      walletLocation: dbConfig.walletLocation,
      walletPassword: dbConfig.walletPassword
    });

    console.log('✅ Connected to Oracle Autonomous Database as admin');

    // Deploy access control components
    await createApplicationRoles(connection, environment);
    await grantTablePermissions(connection, environment);
    await createRLSPolicies(connection, environment);
    await createApplicationUsers(connection, environment);
    await createVPDPolicies(connection, environment);
    await createAccessMonitoring(connection, environment);

    console.log(`\n🎉 Access control deployment completed for ${environment} environment!`);
    console.log('   📋 Next steps:');
    console.log('   1. Update .env file with new application user credentials');
    console.log('   2. Test connectivity with application users');
    console.log('   3. Verify Row Level Security policies are working');
    console.log('   4. Monitor access logs for proper isolation');

  } catch (error) {
    console.error(`\n❌ Access control deployment failed for ${environment}:`, error.message);
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
    console.error('Usage: node scripts/create-access-control.js [development|production]');
    process.exit(1);
  }

  try {
    initializeOracleClient();
    await deployAccessControl(environment);
    process.exit(0);
  } catch (error) {
    console.error('\n💥 Access control deployment failed:', error.message);
    console.error('\n🔧 Troubleshooting:');
    console.error('   1. Ensure you have SYSDBA or admin privileges');
    console.error('   2. Check database connectivity');
    console.error('   3. Verify Career Navigator schema is deployed');
    console.error('   4. Check Oracle wallet permissions');
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { deployAccessControl };