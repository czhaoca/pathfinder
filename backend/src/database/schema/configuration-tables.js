/**
 * Configuration Management Schema
 * Comprehensive database-driven configuration system
 * 
 * This module creates:
 * - System configuration management
 * - Environment-specific overrides
 * - Feature flags with advanced targeting
 * - Configuration change history with audit trails
 * - Dynamic rate limiting configuration
 * - Configuration templates for quick setup
 */

class ConfigurationTables {
  constructor(db) {
    this.db = db;
  }

  async createAll() {
    console.log('Creating configuration management tables...');
    
    await this.createSystemConfigTable();
    await this.createEnvironmentConfigTable();
    await this.createFeatureFlagsTable();
    await this.createConfigHistoryTable();
    await this.createRateLimitsTable();
    await this.createConfigTemplatesTable();
    await this.createIndexes();
    
    console.log('Configuration management tables created successfully');
  }

  async createSystemConfigTable() {
    const sql = `
      CREATE TABLE pf_system_config (
        id VARCHAR2(36) DEFAULT SYS_GUID() PRIMARY KEY,
        config_key VARCHAR2(100) UNIQUE NOT NULL,
        config_value CLOB,
        config_type VARCHAR2(20) NOT NULL,
        category VARCHAR2(50) NOT NULL,
        subcategory VARCHAR2(50),
        
        -- Metadata
        display_name VARCHAR2(255),
        description VARCHAR2(1000),
        help_text CLOB,
        
        -- Validation
        default_value CLOB,
        is_required NUMBER(1) DEFAULT 0,
        is_sensitive NUMBER(1) DEFAULT 0, -- For audit, not storage
        is_encrypted NUMBER(1) DEFAULT 0, -- For non-sensitive encrypted values
        validation_rule VARCHAR2(500),
        allowed_values CLOB CHECK (allowed_values IS JSON),
        min_value NUMBER(20,5),
        max_value NUMBER(20,5),
        regex_pattern VARCHAR2(500),
        
        -- Status and control
        is_active NUMBER(1) DEFAULT 1,
        is_editable NUMBER(1) DEFAULT 1,
        is_deletable NUMBER(1) DEFAULT 1,
        requires_restart NUMBER(1) DEFAULT 0,
        cache_ttl_seconds NUMBER(10) DEFAULT 300,
        
        -- Dependencies
        depends_on CLOB CHECK (depends_on IS JSON), -- Array of config keys
        conflicts_with CLOB CHECK (conflicts_with IS JSON),
        
        -- Audit
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_by VARCHAR2(36),
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_by VARCHAR2(36),
        version NUMBER(10) DEFAULT 1,
        
        CONSTRAINT fk_system_config_created_by FOREIGN KEY (created_by) REFERENCES pf_users(id),
        CONSTRAINT fk_system_config_updated_by FOREIGN KEY (updated_by) REFERENCES pf_users(id),
        CONSTRAINT chk_config_type CHECK (config_type IN 
          ('string', 'number', 'boolean', 'json', 'array', 
           'date', 'url', 'email', 'duration', 'cron')),
        CONSTRAINT chk_config_booleans CHECK (
          is_required IN (0, 1) AND
          is_sensitive IN (0, 1) AND
          is_encrypted IN (0, 1) AND
          is_active IN (0, 1) AND
          is_editable IN (0, 1) AND
          is_deletable IN (0, 1) AND
          requires_restart IN (0, 1)
        )
      )
    `;
    
    await this.db.query(sql);
    console.log('✓ System configuration table created');
  }

  async createEnvironmentConfigTable() {
    const sql = `
      CREATE TABLE pf_environment_config (
        id VARCHAR2(36) DEFAULT SYS_GUID() PRIMARY KEY,
        environment VARCHAR2(20) NOT NULL,
        config_key VARCHAR2(100) NOT NULL,
        config_value CLOB,
        
        -- Override control
        base_config_id VARCHAR2(36),
        override_reason VARCHAR2(500),
        override_approved_by VARCHAR2(36),
        
        -- Temporary overrides
        is_temporary NUMBER(1) DEFAULT 0,
        expires_at TIMESTAMP,
        revert_to_value CLOB,
        
        -- Status
        is_active NUMBER(1) DEFAULT 1,
        priority NUMBER(5) DEFAULT 100, -- Higher priority wins
        
        -- Audit
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_by VARCHAR2(36),
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_by VARCHAR2(36),
        
        CONSTRAINT uk_env_config_env_key UNIQUE (environment, config_key),
        CONSTRAINT fk_env_config_base FOREIGN KEY (base_config_id) REFERENCES pf_system_config(id),
        CONSTRAINT fk_env_config_approved_by FOREIGN KEY (override_approved_by) REFERENCES pf_users(id),
        CONSTRAINT fk_env_config_created_by FOREIGN KEY (created_by) REFERENCES pf_users(id),
        CONSTRAINT fk_env_config_updated_by FOREIGN KEY (updated_by) REFERENCES pf_users(id),
        CONSTRAINT chk_environment CHECK (environment IN 
          ('development', 'test', 'staging', 'production', 'demo', 'local')),
        CONSTRAINT chk_env_config_booleans CHECK (
          is_temporary IN (0, 1) AND
          is_active IN (0, 1)
        ),
        CONSTRAINT chk_env_config_priority CHECK (priority BETWEEN 1 AND 1000)
      )
    `;
    
    await this.db.query(sql);
    console.log('✓ Environment configuration table created');
  }

  async createFeatureFlagsTable() {
    const sql = `
      CREATE TABLE pf_feature_flags (
        id VARCHAR2(36) DEFAULT SYS_GUID() PRIMARY KEY,
        feature_key VARCHAR2(100) UNIQUE NOT NULL,
        feature_name VARCHAR2(255) NOT NULL,
        description VARCHAR2(1000),
        
        -- Feature control
        is_enabled NUMBER(1) DEFAULT 0,
        rollout_percentage NUMBER(3) DEFAULT 0,
        rollout_strategy VARCHAR2(50), -- percentage, user_list, gradual, ring
        
        -- Targeting rules (JSON)
        enabled_for_users CLOB CHECK (enabled_for_users IS JSON),
        enabled_for_roles CLOB CHECK (enabled_for_roles IS JSON),
        enabled_for_groups CLOB CHECK (enabled_for_groups IS JSON),
        enabled_environments CLOB CHECK (enabled_environments IS JSON),
        targeting_rules CLOB CHECK (targeting_rules IS JSON), -- Complex rules
        
        -- Scheduling
        start_date TIMESTAMP,
        end_date TIMESTAMP,
        schedule_cron VARCHAR2(100), -- For time-based features
        
        -- Dependencies
        prerequisite_features CLOB CHECK (prerequisite_features IS JSON),
        conflicts_with CLOB CHECK (conflicts_with IS JSON),
        
        -- Categorization
        feature_category VARCHAR2(50),
        feature_type VARCHAR2(50), -- release, experiment, ops, permission
        impact_level VARCHAR2(20), -- low, medium, high, critical
        
        -- Ownership
        owner_team VARCHAR2(100),
        owner_email VARCHAR2(255),
        documentation_url VARCHAR2(500),
        jira_ticket VARCHAR2(50),
        
        -- Monitoring
        metrics_enabled NUMBER(1) DEFAULT 1,
        success_metrics CLOB CHECK (success_metrics IS JSON),
        failure_threshold NUMBER(10,2),
        auto_disable_on_error NUMBER(1) DEFAULT 0,
        
        -- Status
        is_active NUMBER(1) DEFAULT 1,
        is_permanent NUMBER(1) DEFAULT 0,
        is_deprecated NUMBER(1) DEFAULT 0,
        deprecation_date TIMESTAMP,
        
        -- Evaluation cache
        cache_ttl_seconds NUMBER(10) DEFAULT 60,
        last_evaluated TIMESTAMP,
        evaluation_count NUMBER(20) DEFAULT 0,
        
        -- Audit
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_by VARCHAR2(36),
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_by VARCHAR2(36),
        
        CONSTRAINT fk_feature_flags_created_by FOREIGN KEY (created_by) REFERENCES pf_users(id),
        CONSTRAINT fk_feature_flags_updated_by FOREIGN KEY (updated_by) REFERENCES pf_users(id),
        CONSTRAINT chk_rollout CHECK (rollout_percentage BETWEEN 0 AND 100),
        CONSTRAINT chk_feature_category CHECK (feature_category IN 
          ('experimental', 'beta', 'stable', 'deprecated', 'sunset')),
        CONSTRAINT chk_feature_type CHECK (feature_type IN 
          ('release', 'experiment', 'ops', 'permission', 'kill_switch')),
        CONSTRAINT chk_impact_level CHECK (impact_level IN 
          ('low', 'medium', 'high', 'critical')),
        CONSTRAINT chk_rollout_strategy CHECK (rollout_strategy IN 
          ('percentage', 'user_list', 'gradual', 'ring', 'canary')),
        CONSTRAINT chk_feature_flags_booleans CHECK (
          is_enabled IN (0, 1) AND
          metrics_enabled IN (0, 1) AND
          auto_disable_on_error IN (0, 1) AND
          is_active IN (0, 1) AND
          is_permanent IN (0, 1) AND
          is_deprecated IN (0, 1)
        ),
        CONSTRAINT chk_failure_threshold CHECK (failure_threshold >= 0),
        CONSTRAINT chk_cache_ttl CHECK (cache_ttl_seconds >= 0),
        CONSTRAINT chk_evaluation_count CHECK (evaluation_count >= 0)
      )
    `;
    
    await this.db.query(sql);
    console.log('✓ Feature flags table created');
  }

  async createConfigHistoryTable() {
    const sql = `
      CREATE TABLE pf_config_history (
        id VARCHAR2(36) DEFAULT SYS_GUID() PRIMARY KEY,
        change_timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        
        -- What changed
        table_name VARCHAR2(50) NOT NULL,
        record_id VARCHAR2(36) NOT NULL,
        config_key VARCHAR2(100) NOT NULL,
        
        -- Change details
        action VARCHAR2(20) NOT NULL,
        old_value CLOB,
        new_value CLOB,
        value_diff CLOB, -- JSON diff format
        change_reason VARCHAR2(1000),
        change_ticket VARCHAR2(100),
        
        -- Environment context
        environment VARCHAR2(20),
        deployment_id VARCHAR2(36),
        release_version VARCHAR2(50),
        
        -- Who made the change
        changed_by VARCHAR2(36) NOT NULL,
        changed_by_role VARCHAR2(50),
        approved_by VARCHAR2(36),
        approval_ticket VARCHAR2(100),
        
        -- Impact analysis
        affected_services CLOB CHECK (affected_services IS JSON),
        affected_users_count NUMBER(10),
        risk_level VARCHAR2(20), -- low, medium, high
        
        -- Rollback info
        rollback_available NUMBER(1) DEFAULT 1,
        rollback_command CLOB,
        rollback_performed NUMBER(1) DEFAULT 0,
        rollback_at TIMESTAMP,
        rollback_by VARCHAR2(36),
        rollback_reason VARCHAR2(500),
        
        CONSTRAINT fk_config_history_changed_by FOREIGN KEY (changed_by) REFERENCES pf_users(id),
        CONSTRAINT fk_config_history_approved_by FOREIGN KEY (approved_by) REFERENCES pf_users(id),
        CONSTRAINT fk_config_history_rollback_by FOREIGN KEY (rollback_by) REFERENCES pf_users(id),
        CONSTRAINT chk_history_action CHECK (action IN 
          ('create', 'update', 'delete', 'enable', 'disable', 'rollback')),
        CONSTRAINT chk_history_table_name CHECK (table_name IN 
          ('pf_system_config', 'pf_environment_config', 'pf_feature_flags', 'pf_rate_limits')),
        CONSTRAINT chk_history_risk_level CHECK (risk_level IN 
          ('low', 'medium', 'high', 'critical')),
        CONSTRAINT chk_history_booleans CHECK (
          rollback_available IN (0, 1) AND
          rollback_performed IN (0, 1)
        ),
        CONSTRAINT chk_history_affected_users CHECK (affected_users_count >= 0)
      )
    `;
    
    await this.db.query(sql);
    console.log('✓ Configuration history table created');
  }

  async createRateLimitsTable() {
    const sql = `
      CREATE TABLE pf_rate_limits (
        id VARCHAR2(36) DEFAULT SYS_GUID() PRIMARY KEY,
        limit_key VARCHAR2(100) UNIQUE NOT NULL,
        limit_name VARCHAR2(255) NOT NULL,
        description VARCHAR2(500),
        
        -- Rate limit settings
        max_requests NUMBER(10) NOT NULL,
        time_window_seconds NUMBER(10) NOT NULL,
        burst_size NUMBER(10),
        queue_size NUMBER(10) DEFAULT 0,
        
        -- Scope and targeting
        scope_type VARCHAR2(50) NOT NULL,
        scope_pattern VARCHAR2(255), -- URL pattern, user pattern, etc.
        applies_to VARCHAR2(500), -- Specific targets
        http_methods VARCHAR2(100), -- Comma-separated: GET,POST,PUT
        
        -- Response handling
        action_on_limit VARCHAR2(50) DEFAULT 'block',
        block_duration_seconds NUMBER(10) DEFAULT 60,
        retry_after_header NUMBER(1) DEFAULT 1,
        custom_error_message VARCHAR2(500),
        redirect_url VARCHAR2(500),
        
        -- Exemptions
        exempt_roles CLOB CHECK (exempt_roles IS JSON),
        exempt_users CLOB CHECK (exempt_users IS JSON),
        exempt_ips CLOB CHECK (exempt_ips IS JSON),
        exempt_api_keys CLOB CHECK (exempt_api_keys IS JSON),
        
        -- Advanced features
        sliding_window NUMBER(1) DEFAULT 1,
        distributed NUMBER(1) DEFAULT 1, -- Across multiple servers
        inherit_from VARCHAR2(100), -- Parent rate limit
        
        -- Status and priority
        is_active NUMBER(1) DEFAULT 1,
        priority NUMBER(5) DEFAULT 100,
        environment VARCHAR2(20),
        
        -- Monitoring
        track_metrics NUMBER(1) DEFAULT 1,
        alert_threshold_percentage NUMBER(3) DEFAULT 80,
        last_triggered TIMESTAMP,
        trigger_count NUMBER(20) DEFAULT 0,
        
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        CONSTRAINT chk_scope_type CHECK (scope_type IN 
          ('global', 'user', 'role', 'ip', 'api_key', 'endpoint', 'service')),
        CONSTRAINT chk_action_on_limit CHECK (action_on_limit IN 
          ('block', 'throttle', 'queue', 'log', 'captcha')),
        CONSTRAINT chk_rate_limits_positive CHECK (
          max_requests > 0 AND
          time_window_seconds > 0 AND
          (burst_size IS NULL OR burst_size >= 0) AND
          queue_size >= 0 AND
          block_duration_seconds >= 0
        ),
        CONSTRAINT chk_rate_limits_booleans CHECK (
          retry_after_header IN (0, 1) AND
          sliding_window IN (0, 1) AND
          distributed IN (0, 1) AND
          is_active IN (0, 1) AND
          track_metrics IN (0, 1)
        ),
        CONSTRAINT chk_rate_limits_percentages CHECK (
          alert_threshold_percentage BETWEEN 0 AND 100
        ),
        CONSTRAINT chk_rate_limits_priority CHECK (priority BETWEEN 1 AND 1000),
        CONSTRAINT chk_rate_limits_trigger_count CHECK (trigger_count >= 0)
      )
    `;
    
    await this.db.query(sql);
    console.log('✓ Rate limits table created');
  }

  async createConfigTemplatesTable() {
    const sql = `
      CREATE TABLE pf_config_templates (
        id VARCHAR2(36) DEFAULT SYS_GUID() PRIMARY KEY,
        template_name VARCHAR2(100) UNIQUE NOT NULL,
        template_type VARCHAR2(50) NOT NULL,
        description VARCHAR2(1000),
        
        -- Template content
        config_values CLOB NOT NULL CHECK (config_values IS JSON),
        feature_flags CLOB CHECK (feature_flags IS JSON),
        rate_limits CLOB CHECK (rate_limits IS JSON),
        
        -- Applicability
        suitable_environments CLOB CHECK (suitable_environments IS JSON),
        suitable_scale VARCHAR2(50),
        prerequisites CLOB CHECK (prerequisites IS JSON),
        
        -- Metadata
        version VARCHAR2(20),
        is_default NUMBER(1) DEFAULT 0,
        is_active NUMBER(1) DEFAULT 1,
        usage_count NUMBER(10) DEFAULT 0,
        
        -- Ownership
        author VARCHAR2(100),
        team VARCHAR2(100),
        
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        CONSTRAINT chk_template_type CHECK (template_type IN 
          ('development', 'staging', 'production', 'performance', 'security', 'custom')),
        CONSTRAINT chk_suitable_scale CHECK (suitable_scale IN 
          ('small', 'medium', 'large', 'enterprise', 'any')),
        CONSTRAINT chk_template_booleans CHECK (
          is_default IN (0, 1) AND
          is_active IN (0, 1)
        ),
        CONSTRAINT chk_template_usage_count CHECK (usage_count >= 0)
      )
    `;
    
    await this.db.query(sql);
    console.log('✓ Configuration templates table created');
  }

  async createIndexes() {
    const indexes = [
      // System config indexes
      'CREATE INDEX idx_system_config_key ON pf_system_config(config_key)',
      'CREATE INDEX idx_system_config_category ON pf_system_config(category, subcategory)',
      'CREATE INDEX idx_system_config_active ON pf_system_config(is_active)',
      'CREATE INDEX idx_system_config_type ON pf_system_config(config_type)',
      'CREATE INDEX idx_system_config_updated ON pf_system_config(updated_at)',
      
      // Environment config indexes
      'CREATE INDEX idx_env_config_env_key ON pf_environment_config(environment, config_key)',
      'CREATE INDEX idx_env_config_active ON pf_environment_config(is_active, environment)',
      'CREATE INDEX idx_env_config_priority ON pf_environment_config(priority DESC)',
      'CREATE INDEX idx_env_config_expires ON pf_environment_config(expires_at) WHERE expires_at IS NOT NULL',
      'CREATE INDEX idx_env_config_base ON pf_environment_config(base_config_id)',
      
      // Feature flags indexes
      'CREATE INDEX idx_feature_flags_key ON pf_feature_flags(feature_key)',
      'CREATE INDEX idx_feature_flags_enabled ON pf_feature_flags(is_enabled, is_active)',
      'CREATE INDEX idx_feature_flags_dates ON pf_feature_flags(start_date, end_date)',
      'CREATE INDEX idx_feature_flags_category ON pf_feature_flags(feature_category)',
      'CREATE INDEX idx_feature_flags_type ON pf_feature_flags(feature_type)',
      'CREATE INDEX idx_feature_flags_rollout ON pf_feature_flags(rollout_percentage)',
      'CREATE INDEX idx_feature_flags_evaluated ON pf_feature_flags(last_evaluated)',
      
      // Config history indexes
      'CREATE INDEX idx_config_history_time ON pf_config_history(change_timestamp DESC)',
      'CREATE INDEX idx_config_history_key ON pf_config_history(config_key)',
      'CREATE INDEX idx_config_history_user ON pf_config_history(changed_by)',
      'CREATE INDEX idx_config_history_table ON pf_config_history(table_name, record_id)',
      'CREATE INDEX idx_config_history_action ON pf_config_history(action)',
      'CREATE INDEX idx_config_history_rollback ON pf_config_history(rollback_available, rollback_performed)',
      
      // Rate limits indexes
      'CREATE INDEX idx_rate_limits_key ON pf_rate_limits(limit_key)',
      'CREATE INDEX idx_rate_limits_active ON pf_rate_limits(is_active, priority DESC)',
      'CREATE INDEX idx_rate_limits_scope ON pf_rate_limits(scope_type, scope_pattern)',
      'CREATE INDEX idx_rate_limits_env ON pf_rate_limits(environment)',
      'CREATE INDEX idx_rate_limits_triggered ON pf_rate_limits(last_triggered)',
      
      // Config templates indexes
      'CREATE INDEX idx_config_templates_name ON pf_config_templates(template_name)',
      'CREATE INDEX idx_config_templates_type ON pf_config_templates(template_type)',
      'CREATE INDEX idx_config_templates_active ON pf_config_templates(is_active)',
      'CREATE INDEX idx_config_templates_default ON pf_config_templates(is_default)',
      'CREATE INDEX idx_config_templates_usage ON pf_config_templates(usage_count DESC)'
    ];

    for (const index of indexes) {
      try {
        await this.db.query(index);
      } catch (error) {
        // Index might already exist, continue
        if (!error.message.includes('ORA-00955')) {
          console.warn(`Warning creating index: ${error.message}`);
        }
      }
    }
    
    console.log('✓ Configuration management indexes created');
  }

  async seedDefaultConfigurations() {
    console.log('Seeding default configuration data...');

    // System configurations
    const systemConfigs = [
      {
        config_key: 'api.rate_limit.default',
        config_value: '1000',
        config_type: 'number',
        category: 'api',
        subcategory: 'rate_limiting',
        display_name: 'Default API Rate Limit',
        description: 'Default number of requests per hour for API endpoints',
        default_value: '1000',
        min_value: 1,
        max_value: 10000,
        cache_ttl_seconds: 300
      },
      {
        config_key: 'cache.ttl.default',
        config_value: '3600',
        config_type: 'number',
        category: 'cache',
        subcategory: 'ttl',
        display_name: 'Default Cache TTL',
        description: 'Default time-to-live for cache entries in seconds',
        default_value: '3600',
        min_value: 60,
        max_value: 86400,
        cache_ttl_seconds: 600
      },
      {
        config_key: 'auth.session.timeout',
        config_value: '7200',
        config_type: 'number',
        category: 'auth',
        subcategory: 'session',
        display_name: 'Session Timeout',
        description: 'User session timeout in seconds',
        default_value: '7200',
        min_value: 900,
        max_value: 86400,
        requires_restart: 0,
        cache_ttl_seconds: 300
      },
      {
        config_key: 'features.mcp.enabled',
        config_value: 'true',
        config_type: 'boolean',
        category: 'features',
        subcategory: 'mcp',
        display_name: 'MCP Server Enabled',
        description: 'Enable Model Context Protocol server functionality',
        default_value: 'true',
        requires_restart: 1,
        cache_ttl_seconds: 60
      },
      {
        config_key: 'logging.level',
        config_value: 'info',
        config_type: 'string',
        category: 'logging',
        subcategory: 'level',
        display_name: 'Log Level',
        description: 'Application logging level',
        default_value: 'info',
        allowed_values: '["debug", "info", "warn", "error"]',
        cache_ttl_seconds: 300
      }
    ];

    for (const config of systemConfigs) {
      const sql = `
        INSERT INTO pf_system_config (
          config_key, config_value, config_type, category, subcategory,
          display_name, description, default_value, min_value, max_value,
          allowed_values, requires_restart, cache_ttl_seconds, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
      `;
      
      try {
        await this.db.query(sql, [
          config.config_key,
          config.config_value,
          config.config_type,
          config.category,
          config.subcategory,
          config.display_name,
          config.description,
          config.default_value,
          config.min_value || null,
          config.max_value || null,
          config.allowed_values || null,
          config.requires_restart || 0,
          config.cache_ttl_seconds
        ]);
      } catch (error) {
        if (!error.message.includes('ORA-00001')) { // Ignore duplicate key errors
          throw error;
        }
      }
    }

    // Feature flags
    const featureFlags = [
      {
        feature_key: 'new_chat_interface',
        feature_name: 'New Chat Interface',
        description: 'Enhanced chat interface with improved UX',
        is_enabled: 0,
        rollout_percentage: 10,
        rollout_strategy: 'percentage',
        feature_category: 'experimental',
        feature_type: 'release',
        impact_level: 'medium',
        cache_ttl_seconds: 60
      },
      {
        feature_key: 'enhanced_analytics',
        feature_name: 'Enhanced Analytics Dashboard',
        description: 'Advanced analytics and reporting features',
        is_enabled: 1,
        rollout_percentage: 100,
        rollout_strategy: 'percentage',
        feature_category: 'stable',
        feature_type: 'release',
        impact_level: 'low',
        cache_ttl_seconds: 300
      }
    ];

    for (const flag of featureFlags) {
      const sql = `
        INSERT INTO pf_feature_flags (
          feature_key, feature_name, description, is_enabled, rollout_percentage,
          rollout_strategy, feature_category, feature_type, impact_level,
          cache_ttl_seconds, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
      `;
      
      try {
        await this.db.query(sql, [
          flag.feature_key,
          flag.feature_name,
          flag.description,
          flag.is_enabled,
          flag.rollout_percentage,
          flag.rollout_strategy,
          flag.feature_category,
          flag.feature_type,
          flag.impact_level,
          flag.cache_ttl_seconds
        ]);
      } catch (error) {
        if (!error.message.includes('ORA-00001')) { // Ignore duplicate key errors
          throw error;
        }
      }
    }

    // Rate limits
    const rateLimits = [
      {
        limit_key: 'api.general',
        limit_name: 'General API Rate Limit',
        description: 'Default rate limit for all API endpoints',
        max_requests: 1000,
        time_window_seconds: 3600,
        scope_type: 'global',
        action_on_limit: 'block',
        is_active: 1
      },
      {
        limit_key: 'api.auth.login',
        limit_name: 'Login Attempt Rate Limit',
        description: 'Rate limit for login attempts to prevent brute force',
        max_requests: 5,
        time_window_seconds: 300,
        scope_type: 'ip',
        action_on_limit: 'block',
        block_duration_seconds: 900,
        is_active: 1
      }
    ];

    for (const limit of rateLimits) {
      const sql = `
        INSERT INTO pf_rate_limits (
          limit_key, limit_name, description, max_requests, time_window_seconds,
          scope_type, action_on_limit, block_duration_seconds, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      try {
        await this.db.query(sql, [
          limit.limit_key,
          limit.limit_name,
          limit.description,
          limit.max_requests,
          limit.time_window_seconds,
          limit.scope_type,
          limit.action_on_limit,
          limit.block_duration_seconds || null,
          limit.is_active
        ]);
      } catch (error) {
        if (!error.message.includes('ORA-00001')) { // Ignore duplicate key errors
          throw error;
        }
      }
    }

    console.log('✓ Default configuration data seeded');
  }

  async dropAll() {
    console.log('Dropping configuration management tables...');
    
    const tables = [
      'pf_config_templates',
      'pf_rate_limits',
      'pf_config_history',
      'pf_feature_flags',
      'pf_environment_config',
      'pf_system_config'
    ];

    for (const table of tables) {
      try {
        await this.db.query(`DROP TABLE ${table} CASCADE CONSTRAINTS`);
        console.log(`✓ Dropped table ${table}`);
      } catch (error) {
        if (!error.message.includes('ORA-00942')) { // Table doesn't exist
          console.warn(`Warning dropping ${table}: ${error.message}`);
        }
      }
    }
    
    console.log('Configuration management tables dropped');
  }
}

module.exports = ConfigurationTables;