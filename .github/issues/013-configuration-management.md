---
name: Database Change
about: Database schema changes or migrations  
title: 'feat: [DB] Implement database-driven configuration management system'
labels: database, configuration, feature, priority:high
assignees: ''

---

## 📋 Description
Create a comprehensive configuration management system stored in the database, allowing dynamic configuration changes without code deployment or restart. This system will manage non-sensitive settings including feature flags, rate limits, system configurations, and maintenance windows. All configurations will be versioned, audited, and support environment-specific overrides.

## 🎯 Purpose
Moving configuration from environment files to database provides:
- Dynamic configuration updates without deployment
- Environment-specific overrides with inheritance
- Feature flag management with gradual rollout
- Complete audit trail of configuration changes
- Rollback capability for problematic changes
- Centralized configuration management UI
- Reduced deployment complexity

## 📊 Schema Changes

### New Configuration Tables
```sql
-- File: /database/core/configuration.sql

-- =====================================================
-- System Configuration Management
-- =====================================================

-- Global system configuration
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
    
    FOREIGN KEY (created_by) REFERENCES pf_users(id),
    FOREIGN KEY (updated_by) REFERENCES pf_users(id),
    CONSTRAINT chk_config_type CHECK (config_type IN 
        ('string', 'number', 'boolean', 'json', 'array', 
         'date', 'url', 'email', 'duration', 'cron'))
);

-- Environment-specific overrides
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
    
    UNIQUE (environment, config_key),
    FOREIGN KEY (base_config_id) REFERENCES pf_system_config(id),
    FOREIGN KEY (override_approved_by) REFERENCES pf_users(id),
    FOREIGN KEY (created_by) REFERENCES pf_users(id),
    FOREIGN KEY (updated_by) REFERENCES pf_users(id),
    CONSTRAINT chk_environment CHECK (environment IN 
        ('development', 'test', 'staging', 'production', 'demo', 'local'))
);

-- Feature flags with advanced targeting
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
    
    FOREIGN KEY (created_by) REFERENCES pf_users(id),
    FOREIGN KEY (updated_by) REFERENCES pf_users(id),
    CONSTRAINT chk_rollout CHECK (rollout_percentage BETWEEN 0 AND 100),
    CONSTRAINT chk_feature_category CHECK (feature_category IN 
        ('experimental', 'beta', 'stable', 'deprecated', 'sunset'))
);

-- Configuration change history with diff
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
    
    FOREIGN KEY (changed_by) REFERENCES pf_users(id),
    FOREIGN KEY (approved_by) REFERENCES pf_users(id),
    FOREIGN KEY (rollback_by) REFERENCES pf_users(id),
    CONSTRAINT chk_history_action CHECK (action IN 
        ('create', 'update', 'delete', 'enable', 'disable', 'rollback'))
);

-- Dynamic rate limiting configuration
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
        ('block', 'throttle', 'queue', 'log', 'captcha'))
);

-- Configuration templates for quick setup
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
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_config_key ON pf_system_config(config_key);
CREATE INDEX idx_config_category ON pf_system_config(category, subcategory);
CREATE INDEX idx_config_active ON pf_system_config(is_active);

CREATE INDEX idx_env_config_env ON pf_environment_config(environment, config_key);
CREATE INDEX idx_env_config_active ON pf_environment_config(is_active, environment);
CREATE INDEX idx_env_config_expires ON pf_environment_config(expires_at) 
    WHERE expires_at IS NOT NULL;

CREATE INDEX idx_feature_key ON pf_feature_flags(feature_key);
CREATE INDEX idx_feature_enabled ON pf_feature_flags(is_enabled, is_active);
CREATE INDEX idx_feature_dates ON pf_feature_flags(start_date, end_date);
CREATE INDEX idx_feature_category ON pf_feature_flags(feature_category);

CREATE INDEX idx_config_history_time ON pf_config_history(change_timestamp DESC);
CREATE INDEX idx_config_history_key ON pf_config_history(config_key);
CREATE INDEX idx_config_history_user ON pf_config_history(changed_by);

CREATE INDEX idx_rate_limits_key ON pf_rate_limits(limit_key);
CREATE INDEX idx_rate_limits_active ON pf_rate_limits(is_active, priority DESC);
CREATE INDEX idx_rate_limits_scope ON pf_rate_limits(scope_type, scope_pattern);
```

### Configuration Service Implementation
```javascript
// backend/src/services/configurationService.js
class ConfigurationService {
  constructor(db, cache, auditLogger) {
    this.db = db;
    this.cache = cache;
    this.auditLogger = auditLogger;
    this.configCache = new Map();
    this.featureFlagCache = new Map();
  }

  async getValue(key, environment = null, userId = null) {
    // Check cache first
    const cacheKey = `${environment}:${key}`;
    if (this.configCache.has(cacheKey)) {
      const cached = this.configCache.get(cacheKey);
      if (cached.expires > Date.now()) {
        return cached.value;
      }
    }

    // Get base configuration
    const baseConfig = await this.db.query(
      'SELECT * FROM pf_system_config WHERE config_key = ? AND is_active = 1',
      [key]
    );

    if (!baseConfig) {
      throw new Error(`Configuration key not found: ${key}`);
    }

    let value = baseConfig.config_value;

    // Check for environment override
    if (environment) {
      const override = await this.db.query(`
        SELECT * FROM pf_environment_config 
        WHERE config_key = ? 
        AND environment = ? 
        AND is_active = 1
        AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
        ORDER BY priority DESC
        FETCH FIRST 1 ROW ONLY
      `, [key, environment]);

      if (override) {
        value = override.config_value;
      }
    }

    // Parse value based on type
    value = this.parseValue(value, baseConfig.config_type);

    // Validate value
    this.validateValue(value, baseConfig);

    // Cache the result
    this.configCache.set(cacheKey, {
      value,
      expires: Date.now() + (baseConfig.cache_ttl_seconds * 1000)
    });

    return value;
  }

  async setValue(key, value, environment = null, userId = null, reason = null) {
    // Start transaction
    await this.db.beginTransaction();

    try {
      // Get current value for history
      const current = await this.getValue(key, environment);
      
      // Validate new value
      const config = await this.db.query(
        'SELECT * FROM pf_system_config WHERE config_key = ?',
        [key]
      );
      
      this.validateValue(value, config);

      // Check dependencies
      await this.checkDependencies(key, value);

      // Update configuration
      if (environment) {
        // Update or insert environment override
        const existing = await this.db.query(
          'SELECT id FROM pf_environment_config WHERE config_key = ? AND environment = ?',
          [key, environment]
        );

        if (existing) {
          await this.db.query(`
            UPDATE pf_environment_config 
            SET config_value = ?, updated_at = CURRENT_TIMESTAMP, updated_by = ?
            WHERE id = ?
          `, [JSON.stringify(value), userId, existing.id]);
        } else {
          await this.db.query(`
            INSERT INTO pf_environment_config 
            (id, environment, config_key, config_value, created_by)
            VALUES (?, ?, ?, ?, ?)
          `, [this.generateId(), environment, key, JSON.stringify(value), userId]);
        }
      } else {
        // Update base configuration
        await this.db.query(`
          UPDATE pf_system_config 
          SET config_value = ?, 
              updated_at = CURRENT_TIMESTAMP, 
              updated_by = ?,
              version = version + 1
          WHERE config_key = ?
        `, [JSON.stringify(value), userId, key]);
      }

      // Record history
      await this.recordHistory({
        table_name: environment ? 'pf_environment_config' : 'pf_system_config',
        config_key: key,
        action: 'update',
        old_value: current,
        new_value: value,
        environment,
        changed_by: userId,
        change_reason: reason
      });

      // Invalidate cache
      this.invalidateCache(key, environment);

      // Check if restart required
      if (config.requires_restart) {
        await this.notifyRestartRequired(key);
      }

      await this.db.commit();

      // Audit log
      await this.auditLogger.log({
        action: 'config_updated',
        config_key: key,
        environment,
        old_value: current,
        new_value: value,
        user_id: userId
      });

      return { success: true, requires_restart: config.requires_restart };

    } catch (error) {
      await this.db.rollback();
      throw error;
    }
  }

  async isFeatureEnabled(featureKey, context = {}) {
    // Check cache
    const cacheKey = `${featureKey}:${context.userId || 'anonymous'}`;
    if (this.featureFlagCache.has(cacheKey)) {
      const cached = this.featureFlagCache.get(cacheKey);
      if (cached.expires > Date.now()) {
        return cached.enabled;
      }
    }

    // Get feature flag
    const flag = await this.db.query(
      'SELECT * FROM pf_feature_flags WHERE feature_key = ? AND is_active = 1',
      [featureKey]
    );

    if (!flag) {
      return false; // Default to disabled if not found
    }

    // Check if globally enabled
    if (!flag.is_enabled) {
      return false;
    }

    // Check date range
    const now = new Date();
    if (flag.start_date && now < flag.start_date) {
      return false;
    }
    if (flag.end_date && now > flag.end_date) {
      return false;
    }

    // Check environment
    if (flag.enabled_environments) {
      const environments = JSON.parse(flag.enabled_environments);
      if (!environments.includes(context.environment)) {
        return false;
      }
    }

    // Check user targeting
    if (context.userId) {
      // Check specific user list
      if (flag.enabled_for_users) {
        const users = JSON.parse(flag.enabled_for_users);
        if (users.includes(context.userId)) {
          return this.cacheAndReturn(cacheKey, true, flag.cache_ttl_seconds);
        }
      }

      // Check role targeting
      if (flag.enabled_for_roles && context.userRoles) {
        const roles = JSON.parse(flag.enabled_for_roles);
        if (context.userRoles.some(role => roles.includes(role))) {
          return this.cacheAndReturn(cacheKey, true, flag.cache_ttl_seconds);
        }
      }

      // Check percentage rollout
      if (flag.rollout_percentage > 0) {
        const enabled = this.isUserInRollout(context.userId, featureKey, flag.rollout_percentage);
        return this.cacheAndReturn(cacheKey, enabled, flag.cache_ttl_seconds);
      }
    }

    // Check complex targeting rules
    if (flag.targeting_rules) {
      const rules = JSON.parse(flag.targeting_rules);
      const enabled = this.evaluateTargetingRules(rules, context);
      return this.cacheAndReturn(cacheKey, enabled, flag.cache_ttl_seconds);
    }

    // Default to enabled if no specific targeting
    return this.cacheAndReturn(cacheKey, true, flag.cache_ttl_seconds);
  }

  isUserInRollout(userId, featureKey, percentage) {
    // Consistent hashing for gradual rollout
    const hash = crypto.createHash('md5')
      .update(`${userId}:${featureKey}`)
      .digest('hex');
    const hashInt = parseInt(hash.substring(0, 8), 16);
    const userPercentage = (hashInt % 100) + 1;
    return userPercentage <= percentage;
  }

  async getRateLimit(key, scope = 'global') {
    const limit = await this.db.query(`
      SELECT * FROM pf_rate_limits 
      WHERE limit_key = ? 
      AND scope_type = ?
      AND is_active = 1
      ORDER BY priority DESC
      FETCH FIRST 1 ROW ONLY
    `, [key, scope]);

    if (!limit) {
      // Return default rate limit
      return {
        max_requests: 1000,
        time_window_seconds: 3600,
        action_on_limit: 'block'
      };
    }

    return limit;
  }

  async rollback(configKey, environment = null, steps = 1) {
    // Get history
    const history = await this.db.query(`
      SELECT * FROM pf_config_history 
      WHERE config_key = ? 
      AND environment = ?
      AND rollback_available = 1
      ORDER BY change_timestamp DESC
      OFFSET ? ROWS
      FETCH FIRST 1 ROW ONLY
    `, [configKey, environment, steps - 1]);

    if (!history) {
      throw new Error('No rollback history available');
    }

    // Apply old value
    await this.setValue(
      configKey, 
      JSON.parse(history.old_value),
      environment,
      null,
      `Rollback to ${history.change_timestamp}`
    );

    // Mark as rolled back
    await this.db.query(
      'UPDATE pf_config_history SET rollback_performed = 1 WHERE id = ?',
      [history.id]
    );

    return { success: true, rolled_back_to: history.change_timestamp };
  }

  async applyTemplate(templateName, environment, userId) {
    const template = await this.db.query(
      'SELECT * FROM pf_config_templates WHERE template_name = ?',
      [templateName]
    );

    if (!template) {
      throw new Error(`Template not found: ${templateName}`);
    }

    const configs = JSON.parse(template.config_values);
    const results = [];

    for (const [key, value] of Object.entries(configs)) {
      try {
        await this.setValue(key, value, environment, userId, `Applied from template: ${templateName}`);
        results.push({ key, success: true });
      } catch (error) {
        results.push({ key, success: false, error: error.message });
      }
    }

    // Update usage count
    await this.db.query(
      'UPDATE pf_config_templates SET usage_count = usage_count + 1 WHERE id = ?',
      [template.id]
    );

    return results;
  }
}

// Configuration API endpoints
router.get('/config/:key', async (req, res) => {
  const { key } = req.params;
  const { environment } = req.query;
  
  try {
    const value = await configService.getValue(key, environment, req.user?.id);
    res.json({ success: true, data: { key, value, environment } });
  } catch (error) {
    res.status(404).json({ success: false, message: error.message });
  }
});

router.put('/config/:key', requireRole(['admin', 'site_admin']), async (req, res) => {
  const { key } = req.params;
  const { value, environment, reason } = req.body;
  
  try {
    const result = await configService.setValue(key, value, environment, req.user.id, reason);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.post('/config/rollback', requireRole(['site_admin']), async (req, res) => {
  const { key, environment, steps } = req.body;
  
  try {
    const result = await configService.rollback(key, environment, steps);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});
```

## 🔄 Migration Strategy
- [ ] Create configuration tables
- [ ] Migrate existing environment variables to database
- [ ] Set up default configurations
- [ ] Create configuration UI
- [ ] Test configuration changes
- [ ] Enable caching layer
- [ ] Remove hardcoded configurations
- [ ] Document configuration keys

## 📈 Performance Impact
- **Initial Load**: Slight increase due to database queries
- **Cached Performance**: Faster than file-based configs
- **Change Application**: Instant without restart
- **Memory Usage**: Reduced (configs not in memory)

### Caching Strategy
```javascript
class ConfigCache {
  constructor(redis) {
    this.redis = redis;
    this.localCache = new LRU({ max: 1000, ttl: 60000 });
  }

  async get(key) {
    // L1: Local memory cache
    if (this.localCache.has(key)) {
      return this.localCache.get(key);
    }

    // L2: Redis cache
    const cached = await this.redis.get(`config:${key}`);
    if (cached) {
      const value = JSON.parse(cached);
      this.localCache.set(key, value);
      return value;
    }

    return null;
  }

  async set(key, value, ttl = 300) {
    this.localCache.set(key, value);
    await this.redis.setex(`config:${key}`, ttl, JSON.stringify(value));
  }

  async invalidate(pattern) {
    // Clear local cache
    for (const key of this.localCache.keys()) {
      if (key.match(pattern)) {
        this.localCache.delete(key);
      }
    }

    // Clear Redis cache
    const keys = await this.redis.keys(`config:${pattern}`);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }
}
```

## 🔒 Security Considerations
- Never store sensitive data (passwords, keys, secrets)
- All changes audit logged
- Role-based access control for modifications
- Validation before applying changes
- Rollback capability for recovery
- Encrypted storage for semi-sensitive values

## 🧪 Testing Requirements
- [ ] Unit tests for configuration service
- [ ] Integration tests for override logic
- [ ] Tests for feature flag evaluation
- [ ] Tests for rate limit calculation
- [ ] Performance tests for cache hit rates
- [ ] Tests for rollback functionality
- [ ] Load tests for concurrent access
- [ ] Tests for template application

### Test Scenarios
```javascript
describe('Configuration Management', () => {
  test('Environment overrides base configuration', async () => {
    await setConfig('api.timeout', 30, null); // Base
    await setConfig('api.timeout', 60, 'production'); // Override
    
    expect(await getConfig('api.timeout', 'production')).toBe(60);
    expect(await getConfig('api.timeout', 'development')).toBe(30);
  });

  test('Feature flag percentage rollout', async () => {
    await setFeatureFlag('new_feature', { 
      enabled: true, 
      rollout_percentage: 50 
    });

    const enabledCount = 0;
    for (let i = 0; i < 1000; i++) {
      if (await isFeatureEnabled('new_feature', { userId: `user_${i}` })) {
        enabledCount++;
      }
    }

    expect(enabledCount).toBeCloseTo(500, -2); // ~50% ± 10%
  });

  test('Configuration rollback restores previous value', async () => {
    await setConfig('setting', 'value1');
    await setConfig('setting', 'value2');
    await setConfig('setting', 'value3');
    
    await rollback('setting', null, 2); // Roll back 2 steps
    expect(await getConfig('setting')).toBe('value1');
  });

  test('Rate limit exemptions work correctly', async () => {
    await setRateLimit('api', {
      max_requests: 10,
      time_window_seconds: 60,
      exempt_roles: ['admin']
    });

    const limit = await getRateLimit('api', { role: 'admin' });
    expect(limit.exempt).toBe(true);
  });
});
```

## 📚 Documentation Updates
- [ ] Document all configuration keys
- [ ] Create configuration guide
- [ ] Document feature flag strategies
- [ ] Create rate limiting guide
- [ ] Document rollback procedures
- [ ] Create troubleshooting guide
- [ ] Document caching behavior

## ⚠️ Risks
- **Risk**: Misconfiguration could break system
  - **Mitigation**: Validation, testing, rollback capability
  
- **Risk**: Cache inconsistency
  - **Mitigation**: TTL-based expiry, invalidation on change
  
- **Risk**: Performance impact of database queries
  - **Mitigation**: Multi-layer caching strategy

## 🔗 Dependencies
- Related to: All features using configuration
- Depends on: #12 (Database reorganization)
- Blocks: Dynamic system behavior features

## 📊 Success Metrics
- Zero configuration-related downtime
- Configuration change application < 1 second
- Cache hit rate > 95%
- Rollback success rate 100%
- Feature flag evaluation < 5ms
- Audit trail 100% complete
- Developer satisfaction with configuration management

---

**Estimated Effort**: 8 story points
**Sprint**: 2 (Database & Infrastructure)
**Target Completion**: Week 4
**Business Value**: High - Enables dynamic system management