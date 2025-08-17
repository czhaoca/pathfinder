/**
 * User and Authentication Tables
 */

const { ulid } = require('ulid');

async function createUserTables(db, prefix = 'pf_') {
  // Enhanced Users table with extended profile fields
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
      
      -- Extended profile fields
      phone_number VARCHAR2(20),
      phone_verified CHAR(1) DEFAULT 'N' CHECK (phone_verified IN ('Y', 'N')),
      avatar_url VARCHAR2(500),
      bio CLOB,
      timezone VARCHAR2(50) DEFAULT 'UTC',
      language VARCHAR2(10) DEFAULT 'en',
      
      -- Extended profile
      date_of_birth DATE,
      gender VARCHAR2(20),
      nationality VARCHAR2(100),
      
      -- Professional info
      current_title VARCHAR2(200),
      current_company VARCHAR2(200),
      years_experience NUMBER(3,1) CHECK (years_experience >= 0),
      
      -- Invitation tracking
      invited_by VARCHAR2(26),
      invitation_accepted_at TIMESTAMP,
      
      -- Feature flags
      feature_group_id VARCHAR2(26),
      
      -- Analytics
      last_activity_at TIMESTAMP,
      total_logins NUMBER(10) DEFAULT 0 CHECK (total_logins >= 0),
      
      -- Timestamps and tokens
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      last_login TIMESTAMP,
      password_reset_token VARCHAR2(255),
      password_reset_expires TIMESTAMP,
      email_verification_token VARCHAR2(255),
      email_verification_expires TIMESTAMP
    )
  `);
  
  // Create indexes for users table
  const userIndexes = [
    `CREATE INDEX ${prefix}idx_users_email_verified ON ${prefix}users(email_verified)`,
    `CREATE INDEX ${prefix}idx_users_invited_by ON ${prefix}users(invited_by)`,
    `CREATE INDEX ${prefix}idx_users_last_activity ON ${prefix}users(last_activity_at)`,
    `CREATE INDEX ${prefix}idx_users_feature_group ON ${prefix}users(feature_group_id)`,
    `CREATE INDEX ${prefix}idx_users_search ON ${prefix}users(
      LOWER(username), LOWER(email), LOWER(first_name), LOWER(last_name)
    )`,
    `CREATE INDEX ${prefix}idx_users_active_recent ON ${prefix}users(
      CASE WHEN account_status = 'active' THEN account_status END,
      last_activity_at
    )`
  ];
  
  for (const index of userIndexes) {
    try {
      await db.execute(index);
    } catch (error) {
      if (!error.message.includes('ORA-00955')) {
        console.warn(`Warning creating index: ${error.message}`);
      }
    }
  }

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
  
  // User invitations table
  await db.execute(`
    CREATE TABLE ${prefix}user_invitations (
      invitation_id VARCHAR2(26) DEFAULT SYS_GUID() PRIMARY KEY,
      email VARCHAR2(255) NOT NULL,
      invitation_token VARCHAR2(255) UNIQUE NOT NULL,
      invited_by VARCHAR2(26) NOT NULL,
      role VARCHAR2(50) DEFAULT 'user',
      feature_group_id VARCHAR2(26),
      expires_at TIMESTAMP NOT NULL,
      accepted_at TIMESTAMP,
      declined_at TIMESTAMP,
      reminder_sent_at TIMESTAMP,
      metadata CLOB CHECK (metadata IS JSON),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT ${prefix}fk_invitation_inviter FOREIGN KEY (invited_by) 
        REFERENCES ${prefix}users(user_id) ON DELETE CASCADE
    )
  `);
  
  // Create indexes for invitations
  const invitationIndexes = [
    `CREATE INDEX ${prefix}idx_invitation_email ON ${prefix}user_invitations(email)`,
    `CREATE INDEX ${prefix}idx_invitation_token ON ${prefix}user_invitations(invitation_token)`,
    `CREATE INDEX ${prefix}idx_invitation_expires ON ${prefix}user_invitations(expires_at)`
  ];
  
  for (const index of invitationIndexes) {
    try {
      await db.execute(index);
    } catch (error) {
      if (!error.message.includes('ORA-00955')) {
        console.warn(`Warning creating index: ${error.message}`);
      }
    }
  }
  
  // SSO accounts table
  await db.execute(`
    CREATE TABLE ${prefix}sso_accounts (
      sso_account_id VARCHAR2(26) DEFAULT SYS_GUID() PRIMARY KEY,
      user_id VARCHAR2(26) NOT NULL,
      provider VARCHAR2(50) NOT NULL,
      provider_user_id VARCHAR2(255) NOT NULL,
      email VARCHAR2(255),
      display_name VARCHAR2(255),
      avatar_url VARCHAR2(500),
      access_token VARCHAR2(2000),
      refresh_token VARCHAR2(2000),
      token_expires_at TIMESTAMP,
      profile_data CLOB CHECK (profile_data IS JSON),
      linked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      last_sync_at TIMESTAMP,
      is_primary CHAR(1) DEFAULT 'N' CHECK (is_primary IN ('Y', 'N')),
      CONSTRAINT ${prefix}fk_sso_user FOREIGN KEY (user_id) 
        REFERENCES ${prefix}users(user_id) ON DELETE CASCADE,
      UNIQUE (provider, provider_user_id)
    )
  `);
  
  // Create indexes for SSO accounts
  const ssoIndexes = [
    `CREATE INDEX ${prefix}idx_sso_user ON ${prefix}sso_accounts(user_id)`,
    `CREATE INDEX ${prefix}idx_sso_provider ON ${prefix}sso_accounts(provider)`
  ];
  
  for (const index of ssoIndexes) {
    try {
      await db.execute(index);
    } catch (error) {
      if (!error.message.includes('ORA-00955')) {
        console.warn(`Warning creating index: ${error.message}`);
      }
    }
  }
  
  // Feature flags table
  await db.execute(`
    CREATE TABLE ${prefix}feature_flags (
      flag_id VARCHAR2(26) DEFAULT SYS_GUID() PRIMARY KEY,
      flag_key VARCHAR2(100) UNIQUE NOT NULL,
      flag_name VARCHAR2(200) NOT NULL,
      description CLOB,
      flag_type VARCHAR2(50) DEFAULT 'boolean',
      default_value VARCHAR2(500),
      allowed_values CLOB CHECK (allowed_values IS JSON),
      is_system_wide CHAR(1) DEFAULT 'N' CHECK (is_system_wide IN ('Y', 'N')),
      requires_restart CHAR(1) DEFAULT 'N' CHECK (requires_restart IN ('Y', 'N')),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  // Create indexes for feature flags
  const flagIndexes = [
    `CREATE INDEX ${prefix}idx_flag_key ON ${prefix}feature_flags(flag_key)`,
    `CREATE INDEX ${prefix}idx_flag_system ON ${prefix}feature_flags(is_system_wide)`
  ];
  
  for (const index of flagIndexes) {
    try {
      await db.execute(index);
    } catch (error) {
      if (!error.message.includes('ORA-00955')) {
        console.warn(`Warning creating index: ${error.message}`);
      }
    }
  }
  
  // User groups table
  await db.execute(`
    CREATE TABLE ${prefix}user_groups (
      group_id VARCHAR2(26) DEFAULT SYS_GUID() PRIMARY KEY,
      group_name VARCHAR2(100) UNIQUE NOT NULL,
      description CLOB,
      is_default CHAR(1) DEFAULT 'N' CHECK (is_default IN ('Y', 'N')),
      priority NUMBER(5) DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  // User feature flag overrides
  await db.execute(`
    CREATE TABLE ${prefix}user_feature_flags (
      override_id VARCHAR2(26) DEFAULT SYS_GUID() PRIMARY KEY,
      user_id VARCHAR2(26),
      group_id VARCHAR2(26),
      flag_id VARCHAR2(26) NOT NULL,
      override_value VARCHAR2(500),
      reason VARCHAR2(500),
      expires_at TIMESTAMP,
      created_by VARCHAR2(26),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT ${prefix}fk_uff_user FOREIGN KEY (user_id) 
        REFERENCES ${prefix}users(user_id) ON DELETE CASCADE,
      CONSTRAINT ${prefix}fk_uff_group FOREIGN KEY (group_id) 
        REFERENCES ${prefix}user_groups(group_id) ON DELETE CASCADE,
      CONSTRAINT ${prefix}fk_uff_flag FOREIGN KEY (flag_id) 
        REFERENCES ${prefix}feature_flags(flag_id) ON DELETE CASCADE,
      CHECK ((user_id IS NOT NULL AND group_id IS NULL) OR 
             (user_id IS NULL AND group_id IS NOT NULL))
    )
  `);
  
  // Create indexes for user feature flags
  const uffIndexes = [
    `CREATE INDEX ${prefix}idx_uff_user ON ${prefix}user_feature_flags(user_id)`,
    `CREATE INDEX ${prefix}idx_uff_group ON ${prefix}user_feature_flags(group_id)`,
    `CREATE INDEX ${prefix}idx_uff_flag ON ${prefix}user_feature_flags(flag_id)`
  ];
  
  for (const index of uffIndexes) {
    try {
      await db.execute(index);
    } catch (error) {
      if (!error.message.includes('ORA-00955')) {
        console.warn(`Warning creating index: ${error.message}`);
      }
    }
  }
  
  // User analytics table with partitioning
  await db.execute(`
    CREATE TABLE ${prefix}user_analytics (
      analytics_id VARCHAR2(26) DEFAULT SYS_GUID() PRIMARY KEY,
      user_id VARCHAR2(26) NOT NULL,
      event_type VARCHAR2(100) NOT NULL,
      event_data CLOB CHECK (event_data IS JSON),
      session_id VARCHAR2(26),
      ip_address VARCHAR2(45),
      user_agent VARCHAR2(500),
      referrer VARCHAR2(500),
      page_url VARCHAR2(500),
      event_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT ${prefix}fk_analytics_user FOREIGN KEY (user_id) 
        REFERENCES ${prefix}users(user_id) ON DELETE CASCADE
    ) PARTITION BY RANGE (event_timestamp) 
      INTERVAL (NUMTODSINTERVAL(1, 'DAY'))
      (PARTITION p_initial VALUES LESS THAN (DATE '2025-01-01'))
  `);
  
  // Create indexes for analytics
  const analyticsIndexes = [
    `CREATE INDEX ${prefix}idx_analytics_user ON ${prefix}user_analytics(user_id) LOCAL`,
    `CREATE INDEX ${prefix}idx_analytics_event ON ${prefix}user_analytics(event_type) LOCAL`,
    `CREATE INDEX ${prefix}idx_analytics_timestamp ON ${prefix}user_analytics(event_timestamp) LOCAL`,
    `CREATE INDEX ${prefix}idx_analytics_user_date ON ${prefix}user_analytics(
      user_id, event_timestamp
    ) LOCAL`
  ];
  
  for (const index of analyticsIndexes) {
    try {
      await db.execute(index);
    } catch (error) {
      if (!error.message.includes('ORA-00955')) {
        console.warn(`Warning creating index: ${error.message}`);
      }
    }
  }
  
  // User preferences table (lazy-loaded extended profile)
  await db.execute(`
    CREATE TABLE ${prefix}user_preferences (
      preference_id VARCHAR2(26) DEFAULT SYS_GUID() PRIMARY KEY,
      user_id VARCHAR2(26) UNIQUE NOT NULL,
      notification_preferences CLOB CHECK (notification_preferences IS JSON),
      privacy_settings CLOB CHECK (privacy_settings IS JSON),
      ui_preferences CLOB CHECK (ui_preferences IS JSON),
      communication_preferences CLOB CHECK (communication_preferences IS JSON),
      feature_preferences CLOB CHECK (feature_preferences IS JSON),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT ${prefix}fk_preferences_user FOREIGN KEY (user_id) 
        REFERENCES ${prefix}users(user_id) ON DELETE CASCADE
    )
  `);

  // Progressive Profile Collection Tables
  
  // Profile field definitions
  await db.execute(`
    CREATE TABLE ${prefix}profile_fields (
      field_id VARCHAR2(26) DEFAULT SYS_GUID() PRIMARY KEY,
      field_name VARCHAR2(100) UNIQUE NOT NULL,
      field_label VARCHAR2(200) NOT NULL,
      field_type VARCHAR2(50) NOT NULL,
      field_group VARCHAR2(100),
      validation_rules CLOB CHECK (validation_rules IS JSON),
      options CLOB CHECK (options IS JSON),
      help_text VARCHAR2(500),
      placeholder VARCHAR2(200),
      default_value VARCHAR2(500),
      is_essential CHAR(1) DEFAULT 'N' CHECK (is_essential IN ('Y', 'N')),
      is_sensitive CHAR(1) DEFAULT 'N' CHECK (is_sensitive IN ('Y', 'N')),
      encryption_required CHAR(1) DEFAULT 'N' CHECK (encryption_required IN ('Y', 'N')),
      display_order NUMBER(5) DEFAULT 0,
      is_active CHAR(1) DEFAULT 'Y' CHECK (is_active IN ('Y', 'N')),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create indexes for profile fields
  const profileFieldIndexes = [
    `CREATE INDEX ${prefix}idx_profile_fields_name ON ${prefix}profile_fields(field_name)`,
    `CREATE INDEX ${prefix}idx_profile_fields_group ON ${prefix}profile_fields(field_group)`,
    `CREATE INDEX ${prefix}idx_profile_fields_active ON ${prefix}profile_fields(is_active)`
  ];

  for (const index of profileFieldIndexes) {
    try {
      await db.execute(index);
    } catch (error) {
      if (!error.message.includes('ORA-00955')) {
        console.warn(`Warning creating index: ${error.message}`);
      }
    }
  }

  // Feature field requirements
  await db.execute(`
    CREATE TABLE ${prefix}feature_field_requirements (
      requirement_id VARCHAR2(26) DEFAULT SYS_GUID() PRIMARY KEY,
      feature_key VARCHAR2(100) NOT NULL,
      field_id VARCHAR2(26) NOT NULL,
      is_required CHAR(1) DEFAULT 'Y' CHECK (is_required IN ('Y', 'N')),
      requirement_level VARCHAR2(20) DEFAULT 'required',
      custom_message VARCHAR2(500),
      alternative_fields CLOB CHECK (alternative_fields IS JSON),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT ${prefix}fk_ffr_field FOREIGN KEY (field_id) 
        REFERENCES ${prefix}profile_fields(field_id) ON DELETE CASCADE
    )
  `);

  // Create indexes for feature field requirements
  const ffrIndexes = [
    `CREATE INDEX ${prefix}idx_ffr_feature ON ${prefix}feature_field_requirements(feature_key)`,
    `CREATE INDEX ${prefix}idx_ffr_field ON ${prefix}feature_field_requirements(field_id)`
  ];

  for (const index of ffrIndexes) {
    try {
      await db.execute(index);
    } catch (error) {
      if (!error.message.includes('ORA-00955')) {
        console.warn(`Warning creating index: ${error.message}`);
      }
    }
  }

  // User profile data (flexible key-value store)
  await db.execute(`
    CREATE TABLE ${prefix}user_profile_data (
      data_id VARCHAR2(26) DEFAULT SYS_GUID() PRIMARY KEY,
      user_id VARCHAR2(26) NOT NULL,
      field_id VARCHAR2(26) NOT NULL,
      field_value CLOB,
      field_value_encrypted VARCHAR2(2000),
      verified CHAR(1) DEFAULT 'N' CHECK (verified IN ('Y', 'N')),
      verified_at TIMESTAMP,
      verified_by VARCHAR2(26),
      source VARCHAR2(50),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT ${prefix}fk_upd_user FOREIGN KEY (user_id) 
        REFERENCES ${prefix}users(user_id) ON DELETE CASCADE,
      CONSTRAINT ${prefix}fk_upd_field FOREIGN KEY (field_id) 
        REFERENCES ${prefix}profile_fields(field_id) ON DELETE CASCADE,
      CONSTRAINT ${prefix}uq_user_field UNIQUE (user_id, field_id)
    )
  `);

  // Create indexes for user profile data
  const updIndexes = [
    `CREATE INDEX ${prefix}idx_upd_user ON ${prefix}user_profile_data(user_id)`,
    `CREATE INDEX ${prefix}idx_upd_field ON ${prefix}user_profile_data(field_id)`,
    `CREATE INDEX ${prefix}idx_upd_verified ON ${prefix}user_profile_data(verified)`
  ];

  for (const index of updIndexes) {
    try {
      await db.execute(index);
    } catch (error) {
      if (!error.message.includes('ORA-00955')) {
        console.warn(`Warning creating index: ${error.message}`);
      }
    }
  }

  // Profile completion tracking
  await db.execute(`
    CREATE TABLE ${prefix}user_profile_completion (
      completion_id VARCHAR2(26) DEFAULT SYS_GUID() PRIMARY KEY,
      user_id VARCHAR2(26) UNIQUE NOT NULL,
      total_fields NUMBER(10) DEFAULT 0,
      completed_fields NUMBER(10) DEFAULT 0,
      required_fields NUMBER(10) DEFAULT 0,
      completed_required NUMBER(10) DEFAULT 0,
      completion_percentage NUMBER(5,2) DEFAULT 0,
      profile_score NUMBER(5,2) DEFAULT 0,
      last_prompted TIMESTAMP,
      fields_skipped CLOB CHECK (fields_skipped IS JSON),
      reminder_settings CLOB CHECK (reminder_settings IS JSON),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT ${prefix}fk_upc_user FOREIGN KEY (user_id) 
        REFERENCES ${prefix}users(user_id) ON DELETE CASCADE
    )
  `);

  // Create index for profile completion
  await db.execute(`
    CREATE INDEX ${prefix}idx_upc_user ON ${prefix}user_profile_completion(user_id)
  `);

  // Field collection prompts
  await db.execute(`
    CREATE TABLE ${prefix}field_collection_prompts (
      prompt_id VARCHAR2(26) DEFAULT SYS_GUID() PRIMARY KEY,
      user_id VARCHAR2(26) NOT NULL,
      field_id VARCHAR2(26) NOT NULL,
      feature_key VARCHAR2(100),
      prompt_type VARCHAR2(50),
      prompt_status VARCHAR2(50),
      shown_at TIMESTAMP,
      responded_at TIMESTAMP,
      response VARCHAR2(50),
      remind_after TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT ${prefix}fk_fcp_user FOREIGN KEY (user_id) 
        REFERENCES ${prefix}users(user_id) ON DELETE CASCADE,
      CONSTRAINT ${prefix}fk_fcp_field FOREIGN KEY (field_id) 
        REFERENCES ${prefix}profile_fields(field_id) ON DELETE CASCADE
    )
  `);

  // Create indexes for field collection prompts
  const fcpIndexes = [
    `CREATE INDEX ${prefix}idx_fcp_user_status ON ${prefix}field_collection_prompts(user_id, prompt_status)`,
    `CREATE INDEX ${prefix}idx_fcp_remind ON ${prefix}field_collection_prompts(remind_after)`
  ];

  for (const index of fcpIndexes) {
    try {
      await db.execute(index);
    } catch (error) {
      if (!error.message.includes('ORA-00955')) {
        console.warn(`Warning creating index: ${error.message}`);
      }
    }
  }
  
  // Create materialized view for user statistics
  try {
    await db.execute(`
      CREATE MATERIALIZED VIEW ${prefix}mv_user_stats 
      BUILD IMMEDIATE
      REFRESH COMPLETE ON DEMAND AS
      SELECT 
        u.user_id,
        u.username,
        COUNT(DISTINCT a.session_id) as total_sessions,
        COUNT(a.analytics_id) as total_events,
        MAX(a.event_timestamp) as last_activity,
        MIN(a.event_timestamp) as first_activity
      FROM ${prefix}users u
      LEFT JOIN ${prefix}user_analytics a ON u.user_id = a.user_id
      GROUP BY u.user_id, u.username
    `);
    
    // Create index on materialized view
    await db.execute(`
      CREATE INDEX ${prefix}idx_mv_user_stats_activity 
      ON ${prefix}mv_user_stats(last_activity)
    `);
  } catch (error) {
    if (!error.message.includes('ORA-12054')) {
      console.warn(`Warning creating materialized view: ${error.message}`);
    }
  }
}

module.exports = createUserTables;