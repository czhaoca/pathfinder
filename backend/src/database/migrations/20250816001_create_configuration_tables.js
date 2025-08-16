/**
 * Migration: Create Configuration Management Tables
 * 
 * Creates all tables needed for the database-driven configuration system:
 * - System configuration table
 * - Environment-specific overrides
 * - Feature flags with advanced targeting
 * - Configuration change history
 * - Dynamic rate limits
 * - Configuration templates
 */

const ConfigurationTables = require('../schema/configuration-tables');

class CreateConfigurationTablesMigration {
  constructor(db) {
    this.db = db;
    this.configTables = new ConfigurationTables(db);
  }

  async up() {
    console.log('Running migration: Create Configuration Management Tables');
    
    try {
      // Create all configuration tables
      await this.configTables.createAll();
      
      // Create additional tables for template history and metrics
      await this.createTemplateHistoryTable();
      await this.createRateLimitMetricsTable();
      await this.createFeatureFlagEvaluationsTable();
      
      // Seed default data
      await this.configTables.seedDefaultConfigurations();
      await this.seedDefaultTemplates();
      
      console.log('✓ Configuration management tables created successfully');
      
    } catch (error) {
      console.error('❌ Migration failed:', error);
      throw error;
    }
  }

  async down() {
    console.log('Rolling back migration: Create Configuration Management Tables');
    
    try {
      // Drop additional tables first (due to foreign key constraints)
      await this.dropAdditionalTables();
      
      // Drop main configuration tables
      await this.configTables.dropAll();
      
      console.log('✓ Configuration management tables dropped successfully');
      
    } catch (error) {
      console.error('❌ Rollback failed:', error);
      throw error;
    }
  }

  async createTemplateHistoryTable() {
    const sql = `
      CREATE TABLE template_application_history (
        id VARCHAR2(36) DEFAULT SYS_GUID() PRIMARY KEY,
        template_id VARCHAR2(36) NOT NULL,
        environment VARCHAR2(20) NOT NULL,
        applied_by VARCHAR2(36) NOT NULL,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        -- Application details
        results CLOB CHECK (results IS JSON),
        reason VARCHAR2(1000),
        success_count NUMBER(10) DEFAULT 0,
        error_count NUMBER(10) DEFAULT 0,
        
        -- Status
        status VARCHAR2(20) DEFAULT 'completed',
        
        CONSTRAINT fk_template_history_template FOREIGN KEY (template_id) REFERENCES pf_config_templates(id),
        CONSTRAINT fk_template_history_user FOREIGN KEY (applied_by) REFERENCES pf_users(id),
        CONSTRAINT chk_template_history_status CHECK (status IN ('completed', 'failed', 'partial')),
        CONSTRAINT chk_template_history_counts CHECK (success_count >= 0 AND error_count >= 0)
      )
    `;
    
    await this.db.query(sql);
    
    // Create indexes
    const indexes = [
      'CREATE INDEX idx_template_history_template ON template_application_history(template_id)',
      'CREATE INDEX idx_template_history_env ON template_application_history(environment)',
      'CREATE INDEX idx_template_history_user ON template_application_history(applied_by)',
      'CREATE INDEX idx_template_history_date ON template_application_history(applied_at DESC)'
    ];
    
    for (const index of indexes) {
      try {
        await this.db.query(index);
      } catch (error) {
        if (!error.message.includes('ORA-00955')) {
          console.warn(`Warning creating index: ${error.message}`);
        }
      }
    }
    
    console.log('✓ Template application history table created');
  }

  async createRateLimitMetricsTable() {
    const sql = `
      CREATE TABLE rate_limit_metrics (
        id VARCHAR2(36) DEFAULT SYS_GUID() PRIMARY KEY,
        limit_key VARCHAR2(100) NOT NULL,
        limited NUMBER(1) NOT NULL,
        processing_time_ms NUMBER(10),
        
        -- Request context
        user_id VARCHAR2(36),
        ip_address VARCHAR2(45),
        user_agent VARCHAR2(500),
        endpoint VARCHAR2(255),
        method VARCHAR2(10),
        
        -- Timing
        recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        CONSTRAINT fk_rate_metrics_user FOREIGN KEY (user_id) REFERENCES pf_users(id),
        CONSTRAINT chk_rate_metrics_limited CHECK (limited IN (0, 1)),
        CONSTRAINT chk_rate_metrics_timing CHECK (processing_time_ms >= 0)
      )
    `;
    
    await this.db.query(sql);
    
    // Create indexes
    const indexes = [
      'CREATE INDEX idx_rate_metrics_key ON rate_limit_metrics(limit_key)',
      'CREATE INDEX idx_rate_metrics_time ON rate_limit_metrics(recorded_at DESC)',
      'CREATE INDEX idx_rate_metrics_limited ON rate_limit_metrics(limited, limit_key)',
      'CREATE INDEX idx_rate_metrics_user ON rate_limit_metrics(user_id)',
      'CREATE INDEX idx_rate_metrics_endpoint ON rate_limit_metrics(endpoint, method)'
    ];
    
    for (const index of indexes) {
      try {
        await this.db.query(index);
      } catch (error) {
        if (!error.message.includes('ORA-00955')) {
          console.warn(`Warning creating index: ${error.message}`);
        }
      }
    }
    
    console.log('✓ Rate limit metrics table created');
  }

  async createFeatureFlagEvaluationsTable() {
    const sql = `
      CREATE TABLE feature_flag_evaluations (
        id VARCHAR2(36) DEFAULT SYS_GUID() PRIMARY KEY,
        feature_key VARCHAR2(100) NOT NULL,
        enabled NUMBER(1) NOT NULL,
        evaluation_time_ms NUMBER(10),
        
        -- User context
        user_id VARCHAR2(36),
        user_roles CLOB CHECK (user_roles IS JSON),
        environment VARCHAR2(20),
        
        -- Additional context
        ip_address VARCHAR2(45),
        user_agent VARCHAR2(500),
        from_cache NUMBER(1) DEFAULT 0,
        
        -- Timing
        evaluated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        CONSTRAINT fk_ff_eval_user FOREIGN KEY (user_id) REFERENCES pf_users(id),
        CONSTRAINT chk_ff_eval_enabled CHECK (enabled IN (0, 1)),
        CONSTRAINT chk_ff_eval_from_cache CHECK (from_cache IN (0, 1)),
        CONSTRAINT chk_ff_eval_timing CHECK (evaluation_time_ms >= 0)
      )
    `;
    
    await this.db.query(sql);
    
    // Create indexes
    const indexes = [
      'CREATE INDEX idx_ff_eval_feature ON feature_flag_evaluations(feature_key)',
      'CREATE INDEX idx_ff_eval_time ON feature_flag_evaluations(evaluated_at DESC)',
      'CREATE INDEX idx_ff_eval_user ON feature_flag_evaluations(user_id)',
      'CREATE INDEX idx_ff_eval_enabled ON feature_flag_evaluations(enabled, feature_key)',
      'CREATE INDEX idx_ff_eval_env ON feature_flag_evaluations(environment)'
    ];
    
    for (const index of indexes) {
      try {
        await this.db.query(index);
      } catch (error) {
        if (!error.message.includes('ORA-00955')) {
          console.warn(`Warning creating index: ${error.message}`);
        }
      }
    }
    
    console.log('✓ Feature flag evaluations table created');
  }

  async seedDefaultTemplates() {
    console.log('Seeding default configuration templates...');
    
    const templates = [
      {
        template_name: 'development_default',
        template_type: 'development',
        description: 'Default configuration for development environment',
        config_values: {
          'logging.level': 'debug',
          'cache.ttl.default': '60',
          'auth.session.timeout': '3600',
          'api.rate_limit.default': '10000'
        },
        feature_flags: {
          'debug_mode': { enabled: true, rollout_percentage: 100 },
          'enhanced_logging': { enabled: true, rollout_percentage: 100 }
        },
        rate_limits: {
          'api.dev': {
            max_requests: 10000,
            time_window_seconds: 3600,
            scope_type: 'global',
            action_on_limit: 'log'
          }
        },
        suitable_environments: ['development', 'local'],
        suitable_scale: 'any',
        is_default: 1,
        author: 'System',
        team: 'Platform'
      },
      {
        template_name: 'production_default',
        template_type: 'production',
        description: 'Default configuration for production environment',
        config_values: {
          'logging.level': 'warn',
          'cache.ttl.default': '3600',
          'auth.session.timeout': '7200',
          'api.rate_limit.default': '1000'
        },
        feature_flags: {
          'debug_mode': { enabled: false, rollout_percentage: 0 },
          'enhanced_analytics': { enabled: true, rollout_percentage: 100 }
        },
        rate_limits: {
          'api.prod': {
            max_requests: 1000,
            time_window_seconds: 3600,
            scope_type: 'user',
            action_on_limit: 'block'
          },
          'api.auth.login': {
            max_requests: 5,
            time_window_seconds: 300,
            scope_type: 'ip',
            action_on_limit: 'block'
          }
        },
        suitable_environments: ['production'],
        suitable_scale: 'large',
        is_default: 1,
        author: 'System',
        team: 'Platform'
      },
      {
        template_name: 'high_performance',
        template_type: 'performance',
        description: 'Optimized configuration for high-performance scenarios',
        config_values: {
          'cache.ttl.default': '1800',
          'api.rate_limit.default': '5000',
          'features.mcp.enabled': 'true'
        },
        feature_flags: {
          'enhanced_caching': { enabled: true, rollout_percentage: 100 },
          'performance_monitoring': { enabled: true, rollout_percentage: 100 }
        },
        rate_limits: {
          'api.high_perf': {
            max_requests: 5000,
            time_window_seconds: 3600,
            scope_type: 'user',
            action_on_limit: 'throttle'
          }
        },
        suitable_environments: ['staging', 'production'],
        suitable_scale: 'large',
        author: 'System',
        team: 'Performance'
      },
      {
        template_name: 'security_hardened',
        template_type: 'security',
        description: 'Security-focused configuration with strict limits',
        config_values: {
          'auth.session.timeout': '1800',
          'api.rate_limit.default': '100'
        },
        feature_flags: {
          'enhanced_security': { enabled: true, rollout_percentage: 100 },
          'strict_validation': { enabled: true, rollout_percentage: 100 }
        },
        rate_limits: {
          'api.secure': {
            max_requests: 100,
            time_window_seconds: 3600,
            scope_type: 'user',
            action_on_limit: 'block'
          },
          'api.auth.strict': {
            max_requests: 3,
            time_window_seconds: 300,
            scope_type: 'ip',
            action_on_limit: 'captcha'
          }
        },
        suitable_environments: ['production'],
        suitable_scale: 'any',
        author: 'System',
        team: 'Security'
      }
    ];

    for (const template of templates) {
      const sql = `
        INSERT INTO pf_config_templates (
          template_name, template_type, description, config_values,
          feature_flags, rate_limits, suitable_environments, suitable_scale,
          is_default, author, team
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      try {
        await this.db.execute(sql, [
          template.template_name,
          template.template_type,
          template.description,
          JSON.stringify(template.config_values),
          JSON.stringify(template.feature_flags),
          JSON.stringify(template.rate_limits),
          JSON.stringify(template.suitable_environments),
          template.suitable_scale,
          template.is_default,
          template.author,
          template.team
        ]);
      } catch (error) {
        if (!error.message.includes('ORA-00001')) { // Ignore duplicate key errors
          throw error;
        }
      }
    }
    
    console.log('✓ Default templates seeded');
  }

  async dropAdditionalTables() {
    const tables = [
      'feature_flag_evaluations',
      'rate_limit_metrics', 
      'template_application_history'
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
  }

  // Migration metadata
  static get version() {
    return '20250816001';
  }

  static get description() {
    return 'Create Configuration Management Tables';
  }

  static get dependencies() {
    return []; // No dependencies
  }
}

module.exports = CreateConfigurationTablesMigration;