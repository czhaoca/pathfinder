/**
 * User and Authentication Tables
 */

const { ulid } = require('ulid');

async function createUserTables(db, prefix = 'pf_') {
  // Users table
  await db.execute(`
    CREATE TABLE ${prefix}users (
      user_id VARCHAR2(26) DEFAULT SYS_GUID() PRIMARY KEY,
      username VARCHAR2(50) UNIQUE NOT NULL,
      email VARCHAR2(255) UNIQUE NOT NULL,
      password_hash VARCHAR2(255) NOT NULL,
      first_name VARCHAR2(100),
      last_name VARCHAR2(100),
      account_status VARCHAR2(20) DEFAULT 'active' CHECK (account_status IN ('active', 'inactive', 'suspended', 'deleted')),
      mfa_enabled CHAR(1) DEFAULT 'N' CHECK (mfa_enabled IN ('Y', 'N')),
      mfa_secret VARCHAR2(255),
      email_verified CHAR(1) DEFAULT 'N' CHECK (email_verified IN ('Y', 'N')),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      last_login TIMESTAMP,
      password_reset_token VARCHAR2(255),
      password_reset_expires TIMESTAMP,
      email_verification_token VARCHAR2(255),
      email_verification_expires TIMESTAMP
    )
  `);

  // User sessions table
  await db.execute(`
    CREATE TABLE ${prefix}user_sessions (
      session_id VARCHAR2(26) DEFAULT SYS_GUID() PRIMARY KEY,
      user_id VARCHAR2(26) NOT NULL,
      token VARCHAR2(500) UNIQUE NOT NULL,
      refresh_token VARCHAR2(500) UNIQUE,
      expires_at TIMESTAMP NOT NULL,
      refresh_expires_at TIMESTAMP,
      ip_address VARCHAR2(45),
      user_agent VARCHAR2(500),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      is_active CHAR(1) DEFAULT 'Y' CHECK (is_active IN ('Y', 'N')),
      CONSTRAINT ${prefix}fk_session_user FOREIGN KEY (user_id) 
        REFERENCES ${prefix}users(user_id) ON DELETE CASCADE
    )
  `);

  // Audit log table
  await db.execute(`
    CREATE TABLE ${prefix}audit_log (
      audit_id VARCHAR2(26) DEFAULT SYS_GUID() PRIMARY KEY,
      user_id VARCHAR2(26),
      action VARCHAR2(100) NOT NULL,
      resource_type VARCHAR2(50),
      resource_id VARCHAR2(26),
      details CLOB CHECK (details IS JSON),
      ip_address VARCHAR2(45),
      user_agent VARCHAR2(500),
      status VARCHAR2(20) DEFAULT 'success',
      error_message VARCHAR2(1000),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT ${prefix}fk_audit_user FOREIGN KEY (user_id) 
        REFERENCES ${prefix}users(user_id) ON DELETE SET NULL
    )
  `);

  // User profiles table
  await db.execute(`
    CREATE TABLE ${prefix}user_profiles (
      profile_id VARCHAR2(26) DEFAULT SYS_GUID() PRIMARY KEY,
      user_id VARCHAR2(26) UNIQUE NOT NULL,
      headline VARCHAR2(200),
      summary VARCHAR2(2000),
      current_role VARCHAR2(200),
      years_experience NUMBER(3,1),
      location VARCHAR2(200),
      industry VARCHAR2(100),
      linkedin_url VARCHAR2(500),
      github_url VARCHAR2(500),
      portfolio_url VARCHAR2(500),
      target_role VARCHAR2(200),
      target_industries CLOB CHECK (target_industries IS JSON),
      career_goals CLOB CHECK (career_goals IS JSON),
      skills CLOB CHECK (skills IS JSON),
      preferences CLOB CHECK (preferences IS JSON),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT ${prefix}fk_profile_user FOREIGN KEY (user_id) 
        REFERENCES ${prefix}users(user_id) ON DELETE CASCADE
    )
  `);

  // API keys table for programmatic access
  await db.execute(`
    CREATE TABLE ${prefix}api_keys (
      key_id VARCHAR2(26) DEFAULT SYS_GUID() PRIMARY KEY,
      user_id VARCHAR2(26) NOT NULL,
      key_name VARCHAR2(100) NOT NULL,
      key_hash VARCHAR2(255) NOT NULL,
      key_prefix VARCHAR2(10) NOT NULL,
      permissions CLOB CHECK (permissions IS JSON),
      rate_limit NUMBER(10) DEFAULT 1000,
      expires_at TIMESTAMP,
      last_used_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      is_active CHAR(1) DEFAULT 'Y' CHECK (is_active IN ('Y', 'N')),
      CONSTRAINT ${prefix}fk_apikey_user FOREIGN KEY (user_id) 
        REFERENCES ${prefix}users(user_id) ON DELETE CASCADE
    )
  `);
}

module.exports = createUserTables;