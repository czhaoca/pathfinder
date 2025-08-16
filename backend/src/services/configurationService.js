/**
 * Configuration Management Service
 * 
 * Provides comprehensive configuration management with:
 * - Multi-layer caching strategy
 * - Environment-specific overrides
 * - Feature flag evaluation
 * - Audit logging and rollback capability
 * - Dependency checking and validation
 */

const crypto = require('crypto');
const { logger } = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

class ConfigurationCache {
  constructor(redis = null) {
    this.redis = redis;
    this.localCache = new Map();
    this.maxLocalSize = 1000;
    this.defaultTTL = 300; // 5 minutes
  }

  _generateCacheKey(key, environment = null, userId = null) {
    return `config:${environment || 'global'}:${key}:${userId || 'all'}`;
  }

  async get(key, environment = null, userId = null) {
    const cacheKey = this._generateCacheKey(key, environment, userId);
    
    // L1: Local memory cache
    if (this.localCache.has(cacheKey)) {
      const cached = this.localCache.get(cacheKey);
      if (cached.expires > Date.now()) {
        return cached.value;
      } else {
        this.localCache.delete(cacheKey);
      }
    }

    // L2: Redis cache (if available)
    if (this.redis) {
      try {
        const cached = await this.redis.get(cacheKey);
        if (cached) {
          const value = JSON.parse(cached);
          this._setLocal(cacheKey, value, this.defaultTTL);
          return value;
        }
      } catch (error) {
        logger.warn('Redis cache error:', error.message);
      }
    }

    return null;
  }

  async set(key, value, ttl = null, environment = null, userId = null) {
    const cacheKey = this._generateCacheKey(key, environment, userId);
    const cacheTTL = ttl || this.defaultTTL;
    
    // L1: Local cache
    this._setLocal(cacheKey, value, cacheTTL);
    
    // L2: Redis cache (if available)
    if (this.redis) {
      try {
        await this.redis.setex(cacheKey, cacheTTL, JSON.stringify(value));
      } catch (error) {
        logger.warn('Redis cache write error:', error.message);
      }
    }
  }

  _setLocal(key, value, ttl) {
    // Manage cache size
    if (this.localCache.size >= this.maxLocalSize) {
      const firstKey = this.localCache.keys().next().value;
      this.localCache.delete(firstKey);
    }

    this.localCache.set(key, {
      value,
      expires: Date.now() + (ttl * 1000)
    });
  }

  async invalidate(pattern) {
    // Clear local cache
    for (const key of this.localCache.keys()) {
      if (key.includes(pattern)) {
        this.localCache.delete(key);
      }
    }

    // Clear Redis cache
    if (this.redis) {
      try {
        const keys = await this.redis.keys(`*${pattern}*`);
        if (keys.length > 0) {
          await this.redis.del(...keys);
        }
      } catch (error) {
        logger.warn('Redis cache invalidation error:', error.message);
      }
    }
  }

  async clear() {
    this.localCache.clear();
    if (this.redis) {
      try {
        const keys = await this.redis.keys('config:*');
        if (keys.length > 0) {
          await this.redis.del(...keys);
        }
      } catch (error) {
        logger.warn('Redis cache clear error:', error.message);
      }
    }
  }
}

class ConfigurationService {
  constructor(db, cache = null, auditLogger = null) {
    this.db = db;
    this.cache = new ConfigurationCache(cache);
    this.auditLogger = auditLogger;
    this.featureFlagCache = new Map();
    this.dependencyGraph = new Map();
  }

  /**
   * Get configuration value with environment override support
   */
  async getValue(key, environment = null, userId = null) {
    try {
      // Check cache first
      const cached = await this.cache.get(key, environment, userId);
      if (cached !== null) {
        return cached;
      }

      // Get base configuration
      const baseConfigSql = `
        SELECT * FROM pf_system_config 
        WHERE config_key = ? AND is_active = 1
      `;
      const baseConfig = await this.db.queryOne(baseConfigSql, [key]);

      if (!baseConfig) {
        throw new Error(`Configuration key not found: ${key}`);
      }

      let value = baseConfig.config_value;

      // Check for environment override
      if (environment) {
        const overrideSql = `
          SELECT * FROM pf_environment_config 
          WHERE config_key = ? 
          AND environment = ? 
          AND is_active = 1
          AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
          ORDER BY priority DESC
          FETCH FIRST 1 ROW ONLY
        `;
        const override = await this.db.queryOne(overrideSql, [key, environment]);

        if (override) {
          value = override.config_value;
        }
      }

      // Parse value based on type
      const parsedValue = this._parseValue(value, baseConfig.config_type);

      // Validate value
      this._validateValue(parsedValue, baseConfig);

      // Cache the result
      await this.cache.set(
        key, 
        parsedValue, 
        baseConfig.cache_ttl_seconds, 
        environment, 
        userId
      );

      return parsedValue;

    } catch (error) {
      logger.error(`Error getting configuration ${key}:`, error);
      throw error;
    }
  }

  /**
   * Set configuration value with validation and audit logging
   */
  async setValue(key, value, environment = null, userId = null, reason = null) {
    const connection = await this.db.getConnection();
    
    try {
      await connection.execute('BEGIN');

      // Get current value for history
      let currentValue = null;
      try {
        currentValue = await this.getValue(key, environment, userId);
      } catch (error) {
        // Value might not exist yet
      }
      
      // Get base configuration for validation
      const configSql = `
        SELECT * FROM pf_system_config WHERE config_key = ?
      `;
      const config = await connection.queryOne(configSql, [key]);
      
      if (!config) {
        throw new Error(`Configuration key not found: ${key}`);
      }

      // Validate new value
      this._validateValue(value, config);

      // Check dependencies
      await this._checkDependencies(key, value, connection);

      // Update configuration
      if (environment) {
        await this._updateEnvironmentConfig(
          key, value, environment, userId, reason, connection
        );
      } else {
        await this._updateSystemConfig(key, value, userId, connection);
      }

      // Record history
      await this._recordHistory({
        table_name: environment ? 'pf_environment_config' : 'pf_system_config',
        config_key: key,
        action: 'update',
        old_value: currentValue,
        new_value: value,
        environment,
        changed_by: userId,
        change_reason: reason
      }, connection);

      // Invalidate cache
      await this.cache.invalidate(key);

      // Check if restart required
      const restartRequired = config.requires_restart === 1;
      if (restartRequired) {
        await this._notifyRestartRequired(key);
      }

      await connection.execute('COMMIT');

      // Audit log
      if (this.auditLogger) {
        await this.auditLogger.log({
          action: 'config_updated',
          config_key: key,
          environment,
          old_value: currentValue,
          new_value: value,
          user_id: userId
        });
      }

      return { 
        success: true, 
        requires_restart: restartRequired,
        previous_value: currentValue
      };

    } catch (error) {
      await connection.execute('ROLLBACK');
      logger.error(`Error setting configuration ${key}:`, error);
      throw error;
    } finally {
      await connection.close();
    }
  }

  /**
   * Evaluate feature flag with advanced targeting
   */
  async isFeatureEnabled(featureKey, context = {}) {
    try {
      // Check cache
      const cacheKey = `${featureKey}:${context.userId || 'anonymous'}:${context.environment || 'default'}`;
      if (this.featureFlagCache.has(cacheKey)) {
        const cached = this.featureFlagCache.get(cacheKey);
        if (cached.expires > Date.now()) {
          return cached.enabled;
        } else {
          this.featureFlagCache.delete(cacheKey);
        }
      }

      // Get feature flag
      const flagSql = `
        SELECT * FROM pf_feature_flags 
        WHERE feature_key = ? AND is_active = 1
      `;
      const flag = await this.db.queryOne(flagSql, [featureKey]);

      if (!flag) {
        return false; // Default to disabled if not found
      }

      // Check if globally enabled
      if (flag.is_enabled !== 1) {
        return this._cacheAndReturn(cacheKey, false, flag.cache_ttl_seconds);
      }

      // Check date range
      const now = new Date();
      if (flag.start_date && now < new Date(flag.start_date)) {
        return this._cacheAndReturn(cacheKey, false, flag.cache_ttl_seconds);
      }
      if (flag.end_date && now > new Date(flag.end_date)) {
        return this._cacheAndReturn(cacheKey, false, flag.cache_ttl_seconds);
      }

      // Check environment targeting
      if (flag.enabled_environments && context.environment) {
        const environments = JSON.parse(flag.enabled_environments);
        if (!environments.includes(context.environment)) {
          return this._cacheAndReturn(cacheKey, false, flag.cache_ttl_seconds);
        }
      }

      // Check user targeting
      if (context.userId) {
        // Check specific user list
        if (flag.enabled_for_users) {
          const users = JSON.parse(flag.enabled_for_users);
          if (users.includes(context.userId)) {
            return this._cacheAndReturn(cacheKey, true, flag.cache_ttl_seconds);
          }
        }

        // Check role targeting
        if (flag.enabled_for_roles && context.userRoles) {
          const roles = JSON.parse(flag.enabled_for_roles);
          if (context.userRoles.some(role => roles.includes(role))) {
            return this._cacheAndReturn(cacheKey, true, flag.cache_ttl_seconds);
          }
        }

        // Check percentage rollout
        if (flag.rollout_percentage > 0) {
          const enabled = this._isUserInRollout(
            context.userId, 
            featureKey, 
            flag.rollout_percentage
          );
          return this._cacheAndReturn(cacheKey, enabled, flag.cache_ttl_seconds);
        }
      }

      // Check complex targeting rules
      if (flag.targeting_rules) {
        const rules = JSON.parse(flag.targeting_rules);
        const enabled = this._evaluateTargetingRules(rules, context);
        return this._cacheAndReturn(cacheKey, enabled, flag.cache_ttl_seconds);
      }

      // Default to enabled if no specific targeting
      return this._cacheAndReturn(cacheKey, true, flag.cache_ttl_seconds);

    } catch (error) {
      logger.error(`Error evaluating feature flag ${featureKey}:`, error);
      return false; // Fail safe
    }
  }

  /**
   * Get rate limit configuration
   */
  async getRateLimit(key, scope = 'global', context = {}) {
    try {
      const limitSql = `
        SELECT * FROM pf_rate_limits 
        WHERE limit_key = ? 
        AND scope_type = ?
        AND is_active = 1
        ORDER BY priority DESC
        FETCH FIRST 1 ROW ONLY
      `;
      const limit = await this.db.queryOne(limitSql, [key, scope]);

      if (!limit) {
        // Return default rate limit
        return {
          max_requests: 1000,
          time_window_seconds: 3600,
          action_on_limit: 'block',
          exempt: false
        };
      }

      // Check exemptions
      const exempt = this._checkRateLimitExemptions(limit, context);

      return {
        ...limit,
        exempt
      };

    } catch (error) {
      logger.error(`Error getting rate limit ${key}:`, error);
      return {
        max_requests: 1000,
        time_window_seconds: 3600,
        action_on_limit: 'block',
        exempt: false
      };
    }
  }

  /**
   * Rollback configuration to previous value
   */
  async rollback(configKey, environment = null, steps = 1, userId = null) {
    const connection = await this.db.getConnection();
    
    try {
      await connection.execute('BEGIN');

      // Get history
      const historySql = `
        SELECT * FROM pf_config_history 
        WHERE config_key = ? 
        AND (environment = ? OR (environment IS NULL AND ? IS NULL))
        AND rollback_available = 1
        ORDER BY change_timestamp DESC
        OFFSET ? ROWS
        FETCH FIRST 1 ROW ONLY
      `;
      const history = await connection.queryOne(historySql, [
        configKey, 
        environment, 
        environment,
        steps - 1
      ]);

      if (!history) {
        throw new Error('No rollback history available');
      }

      const oldValue = JSON.parse(history.old_value);

      // Apply old value
      await this.setValue(
        configKey, 
        oldValue,
        environment,
        userId,
        `Rollback to ${history.change_timestamp}`
      );

      // Mark as rolled back
      const updateHistorySql = `
        UPDATE pf_config_history 
        SET rollback_performed = 1, rollback_at = CURRENT_TIMESTAMP, rollback_by = ?
        WHERE id = ?
      `;
      await connection.execute(updateHistorySql, [userId, history.id]);

      await connection.execute('COMMIT');

      return { 
        success: true, 
        rolled_back_to: history.change_timestamp,
        previous_value: oldValue
      };

    } catch (error) {
      await connection.execute('ROLLBACK');
      logger.error(`Error rolling back configuration ${configKey}:`, error);
      throw error;
    } finally {
      await connection.close();
    }
  }

  /**
   * Apply configuration template
   */
  async applyTemplate(templateName, environment, userId) {
    try {
      const templateSql = `
        SELECT * FROM pf_config_templates 
        WHERE template_name = ? AND is_active = 1
      `;
      const template = await this.db.queryOne(templateSql, [templateName]);

      if (!template) {
        throw new Error(`Template not found: ${templateName}`);
      }

      const configs = JSON.parse(template.config_values);
      const results = [];

      for (const [key, value] of Object.entries(configs)) {
        try {
          await this.setValue(
            key, 
            value, 
            environment, 
            userId, 
            `Applied from template: ${templateName}`
          );
          results.push({ key, success: true });
        } catch (error) {
          results.push({ key, success: false, error: error.message });
        }
      }

      // Update usage count
      const updateUsageSql = `
        UPDATE pf_config_templates 
        SET usage_count = usage_count + 1 
        WHERE id = ?
      `;
      await this.db.execute(updateUsageSql, [template.id]);

      return results;

    } catch (error) {
      logger.error(`Error applying template ${templateName}:`, error);
      throw error;
    }
  }

  // Private helper methods

  _parseValue(value, type) {
    if (value === null || value === undefined) {
      return null;
    }

    switch (type) {
      case 'boolean':
        return value === 'true' || value === '1' || value === 1 || value === true;
      case 'number':
        const num = parseFloat(value);
        if (isNaN(num)) {
          throw new Error(`Invalid number value: ${value}`);
        }
        return num;
      case 'json':
      case 'array':
        try {
          return JSON.parse(value);
        } catch (error) {
          throw new Error(`Invalid JSON value: ${value}`);
        }
      case 'date':
        const date = new Date(value);
        if (isNaN(date.getTime())) {
          throw new Error(`Invalid date value: ${value}`);
        }
        return date;
      default:
        return String(value);
    }
  }

  _validateValue(value, config) {
    // Required check
    if (config.is_required === 1 && (value === null || value === undefined || value === '')) {
      throw new Error(`Configuration ${config.config_key} is required`);
    }

    if (value === null || value === undefined) {
      return; // Allow null for non-required fields
    }

    // Type-specific validation
    if (config.config_type === 'number') {
      if (config.min_value !== null && value < config.min_value) {
        throw new Error(`Value ${value} is less than minimum ${config.min_value}`);
      }
      if (config.max_value !== null && value > config.max_value) {
        throw new Error(`Value ${value} is greater than maximum ${config.max_value}`);
      }
    }

    // Allowed values check
    if (config.allowed_values) {
      const allowedValues = JSON.parse(config.allowed_values);
      if (!allowedValues.includes(value)) {
        throw new Error(`Value ${value} is not in allowed values: ${allowedValues.join(', ')}`);
      }
    }

    // Regex pattern check
    if (config.regex_pattern && typeof value === 'string') {
      const regex = new RegExp(config.regex_pattern);
      if (!regex.test(value)) {
        throw new Error(`Value ${value} does not match pattern ${config.regex_pattern}`);
      }
    }
  }

  async _checkDependencies(key, value, connection) {
    // Get configuration with dependencies
    const configSql = `
      SELECT depends_on, conflicts_with FROM pf_system_config 
      WHERE config_key = ?
    `;
    const config = await connection.queryOne(configSql, [key]);

    if (!config) return;

    // Check dependencies
    if (config.depends_on) {
      const dependencies = JSON.parse(config.depends_on);
      for (const depKey of dependencies) {
        try {
          await this.getValue(depKey);
        } catch (error) {
          throw new Error(`Dependency not satisfied: ${depKey}`);
        }
      }
    }

    // Check conflicts
    if (config.conflicts_with) {
      const conflicts = JSON.parse(config.conflicts_with);
      for (const conflictKey of conflicts) {
        try {
          const conflictValue = await this.getValue(conflictKey);
          if (conflictValue !== null) {
            throw new Error(`Configuration conflicts with: ${conflictKey}`);
          }
        } catch (error) {
          // Conflict key doesn't exist, which is fine
        }
      }
    }
  }

  async _updateSystemConfig(key, value, userId, connection) {
    const sql = `
      UPDATE pf_system_config 
      SET config_value = ?, 
          updated_at = CURRENT_TIMESTAMP, 
          updated_by = ?,
          version = version + 1
      WHERE config_key = ?
    `;
    await connection.execute(sql, [JSON.stringify(value), userId, key]);
  }

  async _updateEnvironmentConfig(key, value, environment, userId, reason, connection) {
    // Check if override exists
    const existingSql = `
      SELECT id FROM pf_environment_config 
      WHERE config_key = ? AND environment = ?
    `;
    const existing = await connection.queryOne(existingSql, [key, environment]);

    if (existing) {
      const updateSql = `
        UPDATE pf_environment_config 
        SET config_value = ?, 
            updated_at = CURRENT_TIMESTAMP, 
            updated_by = ?,
            override_reason = ?
        WHERE id = ?
      `;
      await connection.execute(updateSql, [
        JSON.stringify(value), 
        userId, 
        reason,
        existing.id
      ]);
    } else {
      const insertSql = `
        INSERT INTO pf_environment_config 
        (id, environment, config_key, config_value, created_by, override_reason)
        VALUES (?, ?, ?, ?, ?, ?)
      `;
      await connection.execute(insertSql, [
        uuidv4(), 
        environment, 
        key, 
        JSON.stringify(value), 
        userId, 
        reason
      ]);
    }
  }

  async _recordHistory(record, connection) {
    const sql = `
      INSERT INTO pf_config_history (
        id, table_name, config_key, action, old_value, new_value,
        environment, changed_by, change_reason
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    await connection.execute(sql, [
      uuidv4(),
      record.table_name,
      record.config_key,
      record.action,
      JSON.stringify(record.old_value),
      JSON.stringify(record.new_value),
      record.environment,
      record.changed_by,
      record.change_reason
    ]);
  }

  _isUserInRollout(userId, featureKey, percentage) {
    // Consistent hashing for gradual rollout
    const hash = crypto.createHash('md5')
      .update(`${userId}:${featureKey}`)
      .digest('hex');
    const hashInt = parseInt(hash.substring(0, 8), 16);
    const userPercentage = (hashInt % 100) + 1;
    return userPercentage <= percentage;
  }

  _evaluateTargetingRules(rules, context) {
    // Simple rule evaluation - can be extended
    for (const rule of rules) {
      if (rule.type === 'user_attribute') {
        const userValue = context[rule.attribute];
        if (rule.operator === 'equals' && userValue === rule.value) {
          return rule.enabled;
        }
        if (rule.operator === 'contains' && userValue && userValue.includes(rule.value)) {
          return rule.enabled;
        }
      }
    }
    return false;
  }

  _checkRateLimitExemptions(limit, context) {
    // Check role exemptions
    if (limit.exempt_roles && context.userRoles) {
      const exemptRoles = JSON.parse(limit.exempt_roles);
      if (context.userRoles.some(role => exemptRoles.includes(role))) {
        return true;
      }
    }

    // Check user exemptions
    if (limit.exempt_users && context.userId) {
      const exemptUsers = JSON.parse(limit.exempt_users);
      if (exemptUsers.includes(context.userId)) {
        return true;
      }
    }

    // Check IP exemptions
    if (limit.exempt_ips && context.ip) {
      const exemptIPs = JSON.parse(limit.exempt_ips);
      if (exemptIPs.includes(context.ip)) {
        return true;
      }
    }

    return false;
  }

  _cacheAndReturn(cacheKey, enabled, ttlSeconds) {
    // Manage cache size
    if (this.featureFlagCache.size >= 1000) {
      const firstKey = this.featureFlagCache.keys().next().value;
      this.featureFlagCache.delete(firstKey);
    }

    this.featureFlagCache.set(cacheKey, {
      enabled,
      expires: Date.now() + (ttlSeconds * 1000)
    });
    
    return enabled;
  }

  async _notifyRestartRequired(configKey) {
    logger.warn(`Configuration change requires restart: ${configKey}`);
    // Could implement notification system here
  }

  // Public utility methods

  async getAllConfigurations(environment = null) {
    try {
      let sql = `
        SELECT 
          sc.config_key,
          sc.config_value,
          sc.config_type,
          sc.category,
          sc.subcategory,
          sc.display_name,
          sc.description,
          sc.is_active,
          sc.requires_restart,
          ec.config_value as override_value,
          ec.environment as override_environment
        FROM pf_system_config sc
        LEFT JOIN pf_environment_config ec ON sc.config_key = ec.config_key
      `;
      
      const params = [];
      if (environment) {
        sql += ` AND (ec.environment = ? OR ec.environment IS NULL)`;
        params.push(environment);
      }
      
      sql += ` WHERE sc.is_active = 1 ORDER BY sc.category, sc.config_key`;
      
      return await this.db.query(sql, params);
    } catch (error) {
      logger.error('Error getting all configurations:', error);
      throw error;
    }
  }

  async getConfigurationHistory(configKey, limit = 50) {
    try {
      const sql = `
        SELECT * FROM pf_config_history 
        WHERE config_key = ?
        ORDER BY change_timestamp DESC
        FETCH FIRST ? ROWS ONLY
      `;
      
      return await this.db.query(sql, [configKey, limit]);
    } catch (error) {
      logger.error(`Error getting configuration history for ${configKey}:`, error);
      throw error;
    }
  }

  async getActiveFeatureFlags() {
    try {
      const sql = `
        SELECT * FROM pf_feature_flags 
        WHERE is_active = 1 
        ORDER BY feature_category, feature_key
      `;
      
      return await this.db.query(sql);
    } catch (error) {
      logger.error('Error getting active feature flags:', error);
      throw error;
    }
  }
}

module.exports = { ConfigurationService, ConfigurationCache };