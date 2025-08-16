/**
 * Feature Flag Evaluation Service
 * 
 * Specialized service for advanced feature flag management:
 * - Complex targeting rules evaluation
 * - A/B testing and gradual rollouts
 * - Performance optimized evaluation
 * - Analytics and metrics collection
 * - Circuit breaker patterns for safety
 */

const crypto = require('crypto');
const { logger } = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

class FeatureFlagEvaluationEngine {
  constructor() {
    this.ruleEvaluators = new Map();
    this.registerDefaultEvaluators();
  }

  /**
   * Register default rule evaluators
   */
  registerDefaultEvaluators() {
    // User attribute evaluators
    this.ruleEvaluators.set('user_attribute', (rule, context) => {
      const userValue = context[rule.attribute];
      switch (rule.operator) {
        case 'equals':
          return userValue === rule.value;
        case 'not_equals':
          return userValue !== rule.value;
        case 'contains':
          return userValue && userValue.toString().includes(rule.value);
        case 'not_contains':
          return !userValue || !userValue.toString().includes(rule.value);
        case 'starts_with':
          return userValue && userValue.toString().startsWith(rule.value);
        case 'ends_with':
          return userValue && userValue.toString().endsWith(rule.value);
        case 'regex':
          return userValue && new RegExp(rule.value).test(userValue.toString());
        case 'in':
          return Array.isArray(rule.value) && rule.value.includes(userValue);
        case 'not_in':
          return !Array.isArray(rule.value) || !rule.value.includes(userValue);
        case 'greater_than':
          return parseFloat(userValue) > parseFloat(rule.value);
        case 'less_than':
          return parseFloat(userValue) < parseFloat(rule.value);
        case 'greater_equal':
          return parseFloat(userValue) >= parseFloat(rule.value);
        case 'less_equal':
          return parseFloat(userValue) <= parseFloat(rule.value);
        default:
          return false;
      }
    });

    // Date/time evaluators
    this.ruleEvaluators.set('datetime', (rule, context) => {
      const now = new Date();
      const targetDate = new Date(rule.value);
      
      switch (rule.operator) {
        case 'before':
          return now < targetDate;
        case 'after':
          return now > targetDate;
        case 'between':
          const startDate = new Date(rule.start_value);
          const endDate = new Date(rule.end_value);
          return now >= startDate && now <= endDate;
        case 'day_of_week':
          return now.getDay() === parseInt(rule.value);
        case 'hour_of_day':
          return now.getHours() === parseInt(rule.value);
        default:
          return false;
      }
    });

    // Geographic evaluators
    this.ruleEvaluators.set('geography', (rule, context) => {
      const userCountry = context.country;
      const userRegion = context.region;
      const userCity = context.city;
      
      switch (rule.operator) {
        case 'country_equals':
          return userCountry === rule.value;
        case 'country_in':
          return Array.isArray(rule.value) && rule.value.includes(userCountry);
        case 'region_equals':
          return userRegion === rule.value;
        case 'city_equals':
          return userCity === rule.value;
        default:
          return false;
      }
    });

    // Device/platform evaluators
    this.ruleEvaluators.set('device', (rule, context) => {
      const userAgent = context.userAgent || '';
      const platform = context.platform;
      const deviceType = context.deviceType;
      
      switch (rule.operator) {
        case 'platform_equals':
          return platform === rule.value;
        case 'device_type_equals':
          return deviceType === rule.value;
        case 'user_agent_contains':
          return userAgent.includes(rule.value);
        case 'mobile':
          return deviceType === 'mobile';
        case 'desktop':
          return deviceType === 'desktop';
        case 'tablet':
          return deviceType === 'tablet';
        default:
          return false;
      }
    });

    // Version evaluators
    this.ruleEvaluators.set('version', (rule, context) => {
      const userVersion = context.app_version;
      if (!userVersion) return false;
      
      const compareVersions = (v1, v2) => {
        const parts1 = v1.split('.').map(Number);
        const parts2 = v2.split('.').map(Number);
        
        for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
          const part1 = parts1[i] || 0;
          const part2 = parts2[i] || 0;
          
          if (part1 > part2) return 1;
          if (part1 < part2) return -1;
        }
        return 0;
      };
      
      switch (rule.operator) {
        case 'version_equals':
          return compareVersions(userVersion, rule.value) === 0;
        case 'version_greater':
          return compareVersions(userVersion, rule.value) > 0;
        case 'version_less':
          return compareVersions(userVersion, rule.value) < 0;
        case 'version_greater_equal':
          return compareVersions(userVersion, rule.value) >= 0;
        case 'version_less_equal':
          return compareVersions(userVersion, rule.value) <= 0;
        default:
          return false;
      }
    });

    // Percentage/bucket evaluators
    this.ruleEvaluators.set('percentage', (rule, context) => {
      const userId = context.userId || context.sessionId || 'anonymous';
      const percentage = this._calculateUserPercentage(userId, rule.feature_key || '');
      
      switch (rule.operator) {
        case 'percentage_in':
          return percentage <= parseFloat(rule.value);
        case 'bucket_in':
          const buckets = Array.isArray(rule.value) ? rule.value : [rule.value];
          const bucket = Math.floor(percentage / (100 / buckets.length));
          return buckets.includes(bucket);
        default:
          return false;
      }
    });

    // Custom evaluators
    this.ruleEvaluators.set('custom', (rule, context) => {
      try {
        // Safe custom rule evaluation using Function constructor
        // This should be carefully controlled in production
        const evaluator = new Function('context', 'rule', rule.custom_code);
        return evaluator(context, rule);
      } catch (error) {
        logger.warn('Custom rule evaluation error:', error);
        return false;
      }
    });
  }

  /**
   * Evaluate targeting rules
   */
  evaluateRules(rules, context) {
    if (!Array.isArray(rules) || rules.length === 0) {
      return true; // No rules means enabled
    }

    for (const rule of rules) {
      const result = this._evaluateRule(rule, context);
      
      // Support for rule combinators (AND, OR, NOT)
      if (rule.combinator === 'AND' && !result) {
        return false;
      } else if (rule.combinator === 'OR' && result) {
        return true;
      } else if (rule.combinator === 'NOT' && result) {
        return false;
      }
      
      // Default behavior: any matching rule enables the feature
      if (result && !rule.combinator) {
        return true;
      }
    }

    return false;
  }

  _evaluateRule(rule, context) {
    const evaluator = this.ruleEvaluators.get(rule.type);
    if (!evaluator) {
      logger.warn(`Unknown rule type: ${rule.type}`);
      return false;
    }

    try {
      return evaluator(rule, context);
    } catch (error) {
      logger.error(`Error evaluating rule ${rule.type}:`, error);
      return false;
    }
  }

  _calculateUserPercentage(identifier, seed = '') {
    const hash = crypto.createHash('md5')
      .update(`${identifier}:${seed}`)
      .digest('hex');
    const hashInt = parseInt(hash.substring(0, 8), 16);
    return (hashInt % 100) + 1;
  }
}

class FeatureFlagService {
  constructor(db, cache = null, analyticsService = null) {
    this.db = db;
    this.cache = cache;
    this.analyticsService = analyticsService;
    this.evaluationEngine = new FeatureFlagEvaluationEngine();
    this.circuitBreakers = new Map();
    this.evaluationCache = new Map();
    this.maxCacheSize = 10000;
    this.defaultCacheTTL = 60; // 1 minute
  }

  /**
   * Evaluate if feature is enabled with comprehensive context
   */
  async isFeatureEnabled(featureKey, context = {}) {
    const startTime = Date.now();
    
    try {
      // Check circuit breaker
      if (this._isCircuitBreakerOpen(featureKey)) {
        logger.warn(`Circuit breaker open for feature: ${featureKey}`);
        return false;
      }

      // Enhance context with additional data
      const enrichedContext = await this._enrichContext(context);
      
      // Check cache first
      const cacheKey = this._generateCacheKey(featureKey, enrichedContext);
      const cached = this._getCachedEvaluation(cacheKey);
      if (cached !== null) {
        await this._recordEvaluation(featureKey, cached, enrichedContext, Date.now() - startTime, true);
        return cached;
      }

      // Get feature flag from database
      const flag = await this._getFeatureFlag(featureKey);
      if (!flag) {
        await this._recordEvaluation(featureKey, false, enrichedContext, Date.now() - startTime, false);
        return false;
      }

      // Evaluate feature flag
      const enabled = await this._evaluateFeatureFlag(flag, enrichedContext);
      
      // Cache result
      this._setCachedEvaluation(cacheKey, enabled, flag.cache_ttl_seconds);
      
      // Record evaluation for analytics
      await this._recordEvaluation(featureKey, enabled, enrichedContext, Date.now() - startTime, false);
      
      // Update evaluation count
      await this._updateEvaluationCount(flag.id);
      
      return enabled;

    } catch (error) {
      logger.error(`Error evaluating feature flag ${featureKey}:`, error);
      
      // Increment circuit breaker error count
      this._recordCircuitBreakerError(featureKey);
      
      // Return fail-safe value
      const failSafe = await this._getFailSafeValue(featureKey);
      await this._recordEvaluation(featureKey, failSafe, context, Date.now() - startTime, false);
      return failSafe;
    }
  }

  /**
   * Batch evaluate multiple features for performance
   */
  async evaluateFeatures(featureKeys, context = {}) {
    const enrichedContext = await this._enrichContext(context);
    const results = {};
    
    // Process in batches for database efficiency
    const batchSize = 10;
    for (let i = 0; i < featureKeys.length; i += batchSize) {
      const batch = featureKeys.slice(i, i + batchSize);
      const batchResults = await Promise.allSettled(
        batch.map(key => this.isFeatureEnabled(key, enrichedContext))
      );
      
      batch.forEach((key, index) => {
        const result = batchResults[index];
        results[key] = result.status === 'fulfilled' ? result.value : false;
      });
    }
    
    return results;
  }

  /**
   * Get feature flag configuration
   */
  async getFeatureFlag(featureKey) {
    try {
      return await this._getFeatureFlag(featureKey);
    } catch (error) {
      logger.error(`Error getting feature flag ${featureKey}:`, error);
      throw error;
    }
  }

  /**
   * Create new feature flag
   */
  async createFeatureFlag(flagData) {
    try {
      const {
        feature_key,
        feature_name,
        description,
        feature_category = 'experimental',
        feature_type = 'release',
        impact_level = 'medium',
        owner_team,
        owner_email,
        rollout_strategy = 'percentage',
        created_by
      } = flagData;

      // Validate required fields
      if (!feature_key || !feature_name) {
        throw new Error('feature_key and feature_name are required');
      }

      // Check if feature already exists
      const existing = await this._getFeatureFlag(feature_key);
      if (existing) {
        throw new Error('Feature flag already exists');
      }

      const sql = `
        INSERT INTO pf_feature_flags (
          id, feature_key, feature_name, description, feature_category,
          feature_type, impact_level, owner_team, owner_email,
          rollout_strategy, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const flagId = uuidv4();
      await this.db.execute(sql, [
        flagId,
        feature_key,
        feature_name,
        description,
        feature_category,
        feature_type,
        impact_level,
        owner_team,
        owner_email,
        rollout_strategy,
        created_by
      ]);

      // Clear cache
      if (this.cache) {
        await this.cache.del(`feature_flag:${feature_key}`);
      }

      return { id: flagId, feature_key };

    } catch (error) {
      logger.error('Error creating feature flag:', error);
      throw error;
    }
  }

  /**
   * Update feature flag configuration
   */
  async updateFeatureFlag(featureKey, updates, userId) {
    try {
      const flag = await this._getFeatureFlag(featureKey);
      if (!flag) {
        throw new Error('Feature flag not found');
      }

      // Build update query dynamically
      const updateFields = [];
      const updateValues = [];
      
      const allowedFields = [
        'is_enabled', 'rollout_percentage', 'rollout_strategy',
        'enabled_for_users', 'enabled_for_roles', 'enabled_environments',
        'targeting_rules', 'start_date', 'end_date', 'feature_category',
        'description', 'cache_ttl_seconds'
      ];

      for (const field of allowedFields) {
        if (updates.hasOwnProperty(field)) {
          updateFields.push(`${field} = ?`);
          updateValues.push(
            typeof updates[field] === 'object' 
              ? JSON.stringify(updates[field]) 
              : updates[field]
          );
        }
      }

      if (updateFields.length === 0) {
        throw new Error('No valid fields to update');
      }

      updateFields.push('updated_at = CURRENT_TIMESTAMP', 'updated_by = ?');
      updateValues.push(userId);

      const sql = `
        UPDATE pf_feature_flags 
        SET ${updateFields.join(', ')}
        WHERE feature_key = ?
      `;
      updateValues.push(featureKey);

      await this.db.execute(sql, updateValues);

      // Clear caches
      await this._clearFeatureCaches(featureKey);

      return { success: true };

    } catch (error) {
      logger.error(`Error updating feature flag ${featureKey}:`, error);
      throw error;
    }
  }

  /**
   * Delete/deactivate feature flag
   */
  async deleteFeatureFlag(featureKey, userId) {
    try {
      const sql = `
        UPDATE pf_feature_flags 
        SET is_active = 0, updated_at = CURRENT_TIMESTAMP, updated_by = ?
        WHERE feature_key = ?
      `;

      const result = await this.db.execute(sql, [userId, featureKey]);
      
      if (result.rowsAffected === 0) {
        throw new Error('Feature flag not found');
      }

      // Clear caches
      await this._clearFeatureCaches(featureKey);

      return { success: true };

    } catch (error) {
      logger.error(`Error deleting feature flag ${featureKey}:`, error);
      throw error;
    }
  }

  /**
   * Get feature flag analytics
   */
  async getFeatureFlagAnalytics(featureKey, timeRange = '7d') {
    try {
      const endDate = new Date();
      const startDate = new Date();
      
      switch (timeRange) {
        case '1h':
          startDate.setHours(startDate.getHours() - 1);
          break;
        case '24h':
          startDate.setHours(startDate.getHours() - 24);
          break;
        case '7d':
          startDate.setDate(startDate.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(startDate.getDate() - 30);
          break;
        default:
          startDate.setDate(startDate.getDate() - 7);
      }

      // This would integrate with your analytics service
      if (this.analyticsService) {
        return await this.analyticsService.getFeatureFlagMetrics(
          featureKey,
          startDate,
          endDate
        );
      }

      // Basic analytics from audit logs
      const sql = `
        SELECT 
          DATE_TRUNC('hour', evaluated_at) as hour,
          COUNT(*) as total_evaluations,
          SUM(CASE WHEN enabled = 1 THEN 1 ELSE 0 END) as enabled_count,
          AVG(evaluation_time_ms) as avg_eval_time
        FROM feature_flag_evaluations 
        WHERE feature_key = ?
        AND evaluated_at BETWEEN ? AND ?
        GROUP BY DATE_TRUNC('hour', evaluated_at)
        ORDER BY hour
      `;

      const analytics = await this.db.query(sql, [featureKey, startDate, endDate]);

      return {
        feature_key: featureKey,
        time_range: timeRange,
        analytics: analytics || []
      };

    } catch (error) {
      logger.error(`Error getting analytics for feature ${featureKey}:`, error);
      throw error;
    }
  }

  // Private helper methods

  async _getFeatureFlag(featureKey) {
    // Check cache first
    if (this.cache) {
      const cached = await this.cache.get(`feature_flag:${featureKey}`);
      if (cached) {
        return JSON.parse(cached);
      }
    }

    const sql = `
      SELECT * FROM pf_feature_flags 
      WHERE feature_key = ? AND is_active = 1
    `;
    const flag = await this.db.queryOne(sql, [featureKey]);

    // Cache result
    if (flag && this.cache) {
      await this.cache.setex(
        `feature_flag:${featureKey}`,
        flag.cache_ttl_seconds || 300,
        JSON.stringify(flag)
      );
    }

    return flag;
  }

  async _evaluateFeatureFlag(flag, context) {
    // Check if globally enabled
    if (flag.is_enabled !== 1) {
      return false;
    }

    // Check date range
    const now = new Date();
    if (flag.start_date && now < new Date(flag.start_date)) {
      return false;
    }
    if (flag.end_date && now > new Date(flag.end_date)) {
      return false;
    }

    // Check environment targeting
    if (flag.enabled_environments) {
      const environments = JSON.parse(flag.enabled_environments);
      if (!environments.includes(context.environment)) {
        return false;
      }
    }

    // Check specific user targeting
    if (flag.enabled_for_users && context.userId) {
      const users = JSON.parse(flag.enabled_for_users);
      if (users.includes(context.userId)) {
        return true;
      }
    }

    // Check role targeting
    if (flag.enabled_for_roles && context.userRoles) {
      const roles = JSON.parse(flag.enabled_for_roles);
      if (context.userRoles.some(role => roles.includes(role))) {
        return true;
      }
    }

    // Check complex targeting rules
    if (flag.targeting_rules) {
      const rules = JSON.parse(flag.targeting_rules);
      if (this.evaluationEngine.evaluateRules(rules, context)) {
        return true;
      }
    }

    // Check percentage rollout
    if (flag.rollout_percentage > 0 && context.userId) {
      const userPercentage = this.evaluationEngine._calculateUserPercentage(
        context.userId,
        flag.feature_key
      );
      return userPercentage <= flag.rollout_percentage;
    }

    return false;
  }

  async _enrichContext(context) {
    // Add additional context data
    return {
      ...context,
      timestamp: new Date().toISOString(),
      environment: context.environment || process.env.NODE_ENV || 'development'
    };
  }

  _generateCacheKey(featureKey, context) {
    const contextHash = crypto.createHash('md5')
      .update(JSON.stringify({
        userId: context.userId,
        userRoles: context.userRoles,
        environment: context.environment
      }))
      .digest('hex');
    
    return `ff_eval:${featureKey}:${contextHash}`;
  }

  _getCachedEvaluation(cacheKey) {
    if (this.evaluationCache.has(cacheKey)) {
      const cached = this.evaluationCache.get(cacheKey);
      if (cached.expires > Date.now()) {
        return cached.value;
      } else {
        this.evaluationCache.delete(cacheKey);
      }
    }
    return null;
  }

  _setCachedEvaluation(cacheKey, value, ttlSeconds = null) {
    // Manage cache size
    if (this.evaluationCache.size >= this.maxCacheSize) {
      const firstKey = this.evaluationCache.keys().next().value;
      this.evaluationCache.delete(firstKey);
    }

    const ttl = ttlSeconds || this.defaultCacheTTL;
    this.evaluationCache.set(cacheKey, {
      value,
      expires: Date.now() + (ttl * 1000)
    });
  }

  async _recordEvaluation(featureKey, enabled, context, evaluationTime, fromCache) {
    // Record evaluation for analytics (if analytics service is available)
    if (this.analyticsService) {
      try {
        await this.analyticsService.recordFeatureFlagEvaluation({
          feature_key: featureKey,
          enabled,
          user_id: context.userId,
          environment: context.environment,
          evaluation_time_ms: evaluationTime,
          from_cache: fromCache,
          timestamp: new Date()
        });
      } catch (error) {
        logger.warn('Failed to record feature flag evaluation:', error);
      }
    }
  }

  async _updateEvaluationCount(flagId) {
    try {
      const sql = `
        UPDATE pf_feature_flags 
        SET evaluation_count = evaluation_count + 1,
            last_evaluated = CURRENT_TIMESTAMP
        WHERE id = ?
      `;
      await this.db.execute(sql, [flagId]);
    } catch (error) {
      logger.warn('Failed to update evaluation count:', error);
    }
  }

  _isCircuitBreakerOpen(featureKey) {
    const breaker = this.circuitBreakers.get(featureKey);
    if (!breaker) return false;

    const now = Date.now();
    if (breaker.state === 'open' && now > breaker.nextAttempt) {
      breaker.state = 'half-open';
      return false;
    }

    return breaker.state === 'open';
  }

  _recordCircuitBreakerError(featureKey) {
    const now = Date.now();
    let breaker = this.circuitBreakers.get(featureKey);
    
    if (!breaker) {
      breaker = {
        errors: 0,
        state: 'closed',
        nextAttempt: 0,
        threshold: 5,
        timeout: 60000 // 1 minute
      };
      this.circuitBreakers.set(featureKey, breaker);
    }

    breaker.errors++;
    
    if (breaker.errors >= breaker.threshold && breaker.state === 'closed') {
      breaker.state = 'open';
      breaker.nextAttempt = now + breaker.timeout;
      logger.warn(`Circuit breaker opened for feature: ${featureKey}`);
    }
  }

  async _getFailSafeValue(featureKey) {
    // Return conservative default (false) for fail-safe
    return false;
  }

  async _clearFeatureCaches(featureKey) {
    // Clear Redis cache
    if (this.cache) {
      await this.cache.del(`feature_flag:${featureKey}`);
    }

    // Clear local evaluation cache
    for (const key of this.evaluationCache.keys()) {
      if (key.includes(featureKey)) {
        this.evaluationCache.delete(key);
      }
    }
  }
}

module.exports = { FeatureFlagService, FeatureFlagEvaluationEngine };