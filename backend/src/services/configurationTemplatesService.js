/**
 * Configuration Templates Service
 * 
 * Manages configuration templates for quick environment setup:
 * - Template creation and management
 * - Environment-specific template application
 * - Template versioning and inheritance
 * - Rollback to template state
 * - Template validation and preview
 * - Custom template marketplace
 */

const { logger } = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

class ConfigurationTemplatesService {
  constructor(db, configService, auditLogger = null) {
    this.db = db;
    this.configService = configService;
    this.auditLogger = auditLogger;
    this.templateCache = new Map();
  }

  /**
   * Create a new configuration template
   */
  async createTemplate(templateData, userId) {
    try {
      const {
        template_name,
        template_type,
        description,
        config_values,
        feature_flags = {},
        rate_limits = {},
        suitable_environments = ['development', 'staging'],
        suitable_scale = 'medium',
        prerequisites = [],
        version = '1.0.0',
        author,
        team
      } = templateData;

      // Validate required fields
      if (!template_name || !template_type || !config_values) {
        throw new Error('template_name, template_type, and config_values are required');
      }

      // Validate configuration values
      await this._validateTemplateConfigurations(config_values);

      // Check if template name already exists
      const existingSql = `SELECT id FROM pf_config_templates WHERE template_name = ?`;
      const existing = await this.db.queryOne(existingSql, [template_name]);

      if (existing) {
        throw new Error('Template name already exists');
      }

      // Create template
      const templateId = uuidv4();
      const insertSql = `
        INSERT INTO pf_config_templates (
          id, template_name, template_type, description,
          config_values, feature_flags, rate_limits,
          suitable_environments, suitable_scale, prerequisites,
          version, author, team
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      await this.db.execute(insertSql, [
        templateId,
        template_name,
        template_type,
        description,
        JSON.stringify(config_values),
        JSON.stringify(feature_flags),
        JSON.stringify(rate_limits),
        JSON.stringify(suitable_environments),
        suitable_scale,
        JSON.stringify(prerequisites),
        version,
        author,
        team
      ]);

      // Clear template cache
      this.templateCache.clear();

      // Audit log
      if (this.auditLogger) {
        await this.auditLogger.log({
          action: 'template_created',
          template_id: templateId,
          template_name,
          user_id: userId,
          details: { template_type, version }
        });
      }

      return {
        id: templateId,
        template_name,
        success: true
      };

    } catch (error) {
      logger.error('Error creating configuration template:', error);
      throw error;
    }
  }

  /**
   * Get template by name
   */
  async getTemplate(templateName) {
    try {
      // Check cache
      if (this.templateCache.has(templateName)) {
        const cached = this.templateCache.get(templateName);
        if (cached.expires > Date.now()) {
          return cached.template;
        } else {
          this.templateCache.delete(templateName);
        }
      }

      const sql = `
        SELECT * FROM pf_config_templates 
        WHERE template_name = ? AND is_active = 1
      `;
      const template = await this.db.queryOne(sql, [templateName]);

      if (!template) {
        throw new Error(`Template not found: ${templateName}`);
      }

      // Parse JSON fields
      template.config_values = JSON.parse(template.config_values);
      template.feature_flags = template.feature_flags ? JSON.parse(template.feature_flags) : {};
      template.rate_limits = template.rate_limits ? JSON.parse(template.rate_limits) : {};
      template.suitable_environments = template.suitable_environments ? JSON.parse(template.suitable_environments) : [];
      template.prerequisites = template.prerequisites ? JSON.parse(template.prerequisites) : [];

      // Cache result
      this.templateCache.set(templateName, {
        template,
        expires: Date.now() + 300000 // 5 minutes
      });

      return template;

    } catch (error) {
      logger.error(`Error getting template ${templateName}:`, error);
      throw error;
    }
  }

  /**
   * List all available templates
   */
  async listTemplates(filters = {}) {
    try {
      const {
        template_type,
        suitable_environment,
        suitable_scale,
        search,
        is_default,
        limit = 50,
        offset = 0
      } = filters;

      let sql = `
        SELECT 
          id, template_name, template_type, description,
          suitable_environments, suitable_scale, version,
          is_default, usage_count, author, team,
          created_at, updated_at
        FROM pf_config_templates 
        WHERE is_active = 1
      `;
      const params = [];

      if (template_type) {
        sql += ` AND template_type = ?`;
        params.push(template_type);
      }

      if (suitable_environment) {
        sql += ` AND suitable_environments LIKE ?`;
        params.push(`%"${suitable_environment}"%`);
      }

      if (suitable_scale) {
        sql += ` AND suitable_scale = ?`;
        params.push(suitable_scale);
      }

      if (search) {
        sql += ` AND (template_name LIKE ? OR description LIKE ?)`;
        params.push(`%${search}%`, `%${search}%`);
      }

      if (is_default !== undefined) {
        sql += ` AND is_default = ?`;
        params.push(is_default ? 1 : 0);
      }

      sql += ` ORDER BY is_default DESC, usage_count DESC, template_name`;
      sql += ` LIMIT ? OFFSET ?`;
      params.push(limit, offset);

      const templates = await this.db.query(sql, params);

      // Parse JSON fields for each template
      return templates.map(template => ({
        ...template,
        suitable_environments: template.suitable_environments ? JSON.parse(template.suitable_environments) : []
      }));

    } catch (error) {
      logger.error('Error listing templates:', error);
      throw error;
    }
  }

  /**
   * Apply template to environment
   */
  async applyTemplate(templateName, environment, options = {}, userId) {
    const connection = await this.db.getConnection();
    
    try {
      await connection.execute('BEGIN');

      const {
        dry_run = false,
        override_existing = false,
        selective_keys = null, // Array of specific keys to apply
        reason = `Applied template: ${templateName}`
      } = options;

      // Get template
      const template = await this.getTemplate(templateName);

      // Validate environment compatibility
      if (template.suitable_environments.length > 0 && 
          !template.suitable_environments.includes(environment)) {
        logger.warn(`Template ${templateName} may not be suitable for ${environment} environment`);
      }

      // Check prerequisites
      await this._checkPrerequisites(template.prerequisites, environment);

      const results = {
        configurations: [],
        feature_flags: [],
        rate_limits: [],
        errors: []
      };

      // Apply system configurations
      for (const [key, value] of Object.entries(template.config_values)) {
        // Skip if selective application and key not included
        if (selective_keys && !selective_keys.includes(key)) {
          continue;
        }

        try {
          if (dry_run) {
            // Validate only
            const configSql = `SELECT * FROM pf_system_config WHERE config_key = ?`;
            const config = await connection.queryOne(configSql, [key]);
            if (config) {
              this.configService._validateValue(value, config);
              results.configurations.push({
                key,
                action: 'would_update',
                current_value: await this.configService.getValue(key, environment),
                new_value: value,
                success: true
              });
            } else {
              results.errors.push({
                key,
                error: 'Configuration key not found'
              });
            }
          } else {
            // Check if should override existing
            if (!override_existing) {
              const existing = await this._getExistingConfiguration(key, environment, connection);
              if (existing && existing.source === 'user') {
                results.configurations.push({
                  key,
                  action: 'skipped',
                  reason: 'Configuration has user modifications',
                  success: true
                });
                continue;
              }
            }

            // Apply configuration
            const result = await this.configService.setValue(
              key,
              value,
              environment,
              userId,
              reason
            );

            results.configurations.push({
              key,
              action: 'updated',
              new_value: value,
              success: true,
              ...result
            });
          }
        } catch (error) {
          results.errors.push({
            key,
            action: 'configuration',
            error: error.message
          });
        }
      }

      // Apply feature flags
      for (const [flagKey, flagConfig] of Object.entries(template.feature_flags)) {
        try {
          if (dry_run) {
            results.feature_flags.push({
              key: flagKey,
              action: 'would_update',
              config: flagConfig,
              success: true
            });
          } else {
            await this._applyFeatureFlag(flagKey, flagConfig, userId, connection);
            results.feature_flags.push({
              key: flagKey,
              action: 'updated',
              config: flagConfig,
              success: true
            });
          }
        } catch (error) {
          results.errors.push({
            key: flagKey,
            action: 'feature_flag',
            error: error.message
          });
        }
      }

      // Apply rate limits
      for (const [limitKey, limitConfig] of Object.entries(template.rate_limits)) {
        try {
          if (dry_run) {
            results.rate_limits.push({
              key: limitKey,
              action: 'would_update',
              config: limitConfig,
              success: true
            });
          } else {
            await this._applyRateLimit(limitKey, limitConfig, environment, connection);
            results.rate_limits.push({
              key: limitKey,
              action: 'updated',
              config: limitConfig,
              success: true
            });
          }
        } catch (error) {
          results.errors.push({
            key: limitKey,
            action: 'rate_limit',
            error: error.message
          });
        }
      }

      if (!dry_run) {
        // Update template usage count
        const updateUsageSql = `
          UPDATE pf_config_templates 
          SET usage_count = usage_count + 1, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `;
        await connection.execute(updateUsageSql, [template.id]);

        // Record template application history
        await this._recordTemplateApplication(
          template.id,
          environment,
          userId,
          results,
          reason,
          connection
        );
      }

      if (!dry_run) {
        await connection.execute('COMMIT');
      }

      // Calculate summary
      const successful = results.configurations.filter(r => r.success).length +
                        results.feature_flags.filter(r => r.success).length +
                        results.rate_limits.filter(r => r.success).length;

      const total = results.configurations.length +
                   results.feature_flags.length +
                   results.rate_limits.length;

      return {
        template_name: templateName,
        environment,
        dry_run,
        results,
        summary: {
          total,
          successful,
          failed: results.errors.length,
          success_rate: total > 0 ? ((successful / total) * 100).toFixed(1) + '%' : '0%'
        }
      };

    } catch (error) {
      if (!dry_run) {
        await connection.execute('ROLLBACK');
      }
      logger.error(`Error applying template ${templateName}:`, error);
      throw error;
    } finally {
      await connection.close();
    }
  }

  /**
   * Create template from current environment configuration
   */
  async createTemplateFromEnvironment(templateData, environment, userId) {
    try {
      const {
        template_name,
        template_type,
        description,
        include_patterns = [], // Patterns to include
        exclude_patterns = [], // Patterns to exclude
        include_feature_flags = true,
        include_rate_limits = true
      } = templateData;

      // Get current configurations
      const configurations = await this.configService.getAllConfigurations(environment);
      
      // Filter configurations based on patterns
      const filteredConfigs = this._filterConfigurationsByPatterns(
        configurations,
        include_patterns,
        exclude_patterns
      );

      // Build config values object
      const config_values = {};
      for (const config of filteredConfigs) {
        const value = config.override_value || config.config_value;
        config_values[config.config_key] = this._parseConfigValue(value, config.config_type);
      }

      // Get feature flags if requested
      let feature_flags = {};
      if (include_feature_flags) {
        const flags = await this.configService.getActiveFeatureFlags();
        for (const flag of flags) {
          feature_flags[flag.feature_key] = {
            enabled: flag.is_enabled === 1,
            rollout_percentage: flag.rollout_percentage,
            description: flag.description
          };
        }
      }

      // Get rate limits if requested
      let rate_limits = {};
      if (include_rate_limits) {
        const limits = await this._getRateLimitsForEnvironment(environment);
        for (const limit of limits) {
          rate_limits[limit.limit_key] = {
            max_requests: limit.max_requests,
            time_window_seconds: limit.time_window_seconds,
            scope_type: limit.scope_type,
            action_on_limit: limit.action_on_limit
          };
        }
      }

      // Create template
      return await this.createTemplate({
        template_name,
        template_type,
        description: description || `Template created from ${environment} environment`,
        config_values,
        feature_flags,
        rate_limits,
        suitable_environments: [environment],
        author: userId
      }, userId);

    } catch (error) {
      logger.error('Error creating template from environment:', error);
      throw error;
    }
  }

  /**
   * Update existing template
   */
  async updateTemplate(templateName, updates, userId) {
    try {
      const template = await this.getTemplate(templateName);
      
      // Build update query
      const updateFields = [];
      const updateValues = [];
      
      const allowedFields = [
        'description', 'config_values', 'feature_flags', 'rate_limits',
        'suitable_environments', 'suitable_scale', 'prerequisites', 'version'
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

      updateFields.push('updated_at = CURRENT_TIMESTAMP');

      const sql = `
        UPDATE pf_config_templates 
        SET ${updateFields.join(', ')}
        WHERE id = ?
      `;
      updateValues.push(template.id);

      await this.db.execute(sql, updateValues);

      // Clear cache
      this.templateCache.delete(templateName);

      return { success: true };

    } catch (error) {
      logger.error(`Error updating template ${templateName}:`, error);
      throw error;
    }
  }

  /**
   * Delete template
   */
  async deleteTemplate(templateName, userId) {
    try {
      const template = await this.getTemplate(templateName);
      
      const sql = `
        UPDATE pf_config_templates 
        SET is_active = 0, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `;
      
      await this.db.execute(sql, [template.id]);

      // Clear cache
      this.templateCache.delete(templateName);

      // Audit log
      if (this.auditLogger) {
        await this.auditLogger.log({
          action: 'template_deleted',
          template_id: template.id,
          template_name: templateName,
          user_id: userId
        });
      }

      return { success: true };

    } catch (error) {
      logger.error(`Error deleting template ${templateName}:`, error);
      throw error;
    }
  }

  /**
   * Preview template application without applying
   */
  async previewTemplate(templateName, environment) {
    return await this.applyTemplate(templateName, environment, { dry_run: true });
  }

  /**
   * Get template application history
   */
  async getTemplateHistory(templateName = null, environment = null, limit = 50) {
    try {
      let sql = `
        SELECT 
          th.*,
          ct.template_name,
          u.email as applied_by_email
        FROM template_application_history th
        JOIN pf_config_templates ct ON th.template_id = ct.id
        LEFT JOIN pf_users u ON th.applied_by = u.id
        WHERE 1=1
      `;
      const params = [];

      if (templateName) {
        sql += ` AND ct.template_name = ?`;
        params.push(templateName);
      }

      if (environment) {
        sql += ` AND th.environment = ?`;
        params.push(environment);
      }

      sql += ` ORDER BY th.applied_at DESC LIMIT ?`;
      params.push(limit);

      return await this.db.query(sql, params);

    } catch (error) {
      logger.error('Error getting template history:', error);
      return [];
    }
  }

  // Private helper methods

  async _validateTemplateConfigurations(config_values) {
    for (const [key, value] of Object.entries(config_values)) {
      // Get configuration schema
      const configSql = `SELECT * FROM pf_system_config WHERE config_key = ?`;
      const config = await this.db.queryOne(configSql, [key]);
      
      if (!config) {
        throw new Error(`Configuration key not found: ${key}`);
      }

      // Validate value
      this.configService._validateValue(value, config);
    }
  }

  async _checkPrerequisites(prerequisites, environment) {
    for (const prereq of prerequisites) {
      if (prereq.type === 'configuration') {
        try {
          const value = await this.configService.getValue(prereq.key, environment);
          if (value === null || value === undefined) {
            throw new Error(`Prerequisite configuration missing: ${prereq.key}`);
          }
          
          if (prereq.expected_value && value !== prereq.expected_value) {
            throw new Error(`Prerequisite configuration ${prereq.key} has incorrect value`);
          }
        } catch (error) {
          throw new Error(`Prerequisite check failed: ${error.message}`);
        }
      }
    }
  }

  async _getExistingConfiguration(key, environment, connection) {
    // This would check if configuration has been manually modified
    // by checking the audit trail
    const sql = `
      SELECT * FROM pf_config_history 
      WHERE config_key = ? 
      AND environment = ?
      AND change_reason NOT LIKE '%template%'
      ORDER BY change_timestamp DESC
      FETCH FIRST 1 ROW ONLY
    `;
    
    const history = await connection.queryOne(sql, [key, environment]);
    return history ? { source: 'user' } : null;
  }

  async _applyFeatureFlag(flagKey, flagConfig, userId, connection) {
    const sql = `
      UPDATE pf_feature_flags 
      SET is_enabled = ?,
          rollout_percentage = ?,
          updated_at = CURRENT_TIMESTAMP,
          updated_by = ?
      WHERE feature_key = ?
    `;
    
    await connection.execute(sql, [
      flagConfig.enabled ? 1 : 0,
      flagConfig.rollout_percentage || 0,
      userId,
      flagKey
    ]);
  }

  async _applyRateLimit(limitKey, limitConfig, environment, connection) {
    const existingSql = `SELECT id FROM pf_rate_limits WHERE limit_key = ?`;
    const existing = await connection.queryOne(existingSql, [limitKey]);

    if (existing) {
      const updateSql = `
        UPDATE pf_rate_limits 
        SET max_requests = ?,
            time_window_seconds = ?,
            scope_type = ?,
            action_on_limit = ?,
            environment = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `;
      
      await connection.execute(updateSql, [
        limitConfig.max_requests,
        limitConfig.time_window_seconds,
        limitConfig.scope_type,
        limitConfig.action_on_limit,
        environment,
        existing.id
      ]);
    } else {
      const insertSql = `
        INSERT INTO pf_rate_limits (
          limit_key, max_requests, time_window_seconds,
          scope_type, action_on_limit, environment
        ) VALUES (?, ?, ?, ?, ?, ?)
      `;
      
      await connection.execute(insertSql, [
        limitKey,
        limitConfig.max_requests,
        limitConfig.time_window_seconds,
        limitConfig.scope_type,
        limitConfig.action_on_limit,
        environment
      ]);
    }
  }

  async _recordTemplateApplication(templateId, environment, userId, results, reason, connection) {
    // This would create a template_application_history table entry
    const sql = `
      INSERT INTO template_application_history (
        id, template_id, environment, applied_by, applied_at,
        results, reason, success_count, error_count
      ) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?, ?, ?)
    `;
    
    const successCount = results.configurations.filter(r => r.success).length +
                        results.feature_flags.filter(r => r.success).length +
                        results.rate_limits.filter(r => r.success).length;
    
    try {
      await connection.execute(sql, [
        uuidv4(),
        templateId,
        environment,
        userId,
        JSON.stringify(results),
        reason,
        successCount,
        results.errors.length
      ]);
    } catch (error) {
      logger.warn('Failed to record template application history:', error);
    }
  }

  _filterConfigurationsByPatterns(configurations, includePatterns, excludePatterns) {
    let filtered = configurations;

    // Apply include patterns
    if (includePatterns.length > 0) {
      filtered = filtered.filter(config => {
        return includePatterns.some(pattern => {
          const regex = new RegExp(pattern);
          return regex.test(config.config_key) || regex.test(config.category);
        });
      });
    }

    // Apply exclude patterns
    if (excludePatterns.length > 0) {
      filtered = filtered.filter(config => {
        return !excludePatterns.some(pattern => {
          const regex = new RegExp(pattern);
          return regex.test(config.config_key) || regex.test(config.category);
        });
      });
    }

    return filtered;
  }

  _parseConfigValue(value, type) {
    if (value === null || value === undefined) {
      return null;
    }

    switch (type) {
      case 'boolean':
        return value === 'true' || value === '1' || value === 1 || value === true;
      case 'number':
        return parseFloat(value);
      case 'json':
      case 'array':
        try {
          return JSON.parse(value);
        } catch {
          return value;
        }
      case 'date':
        return new Date(value);
      default:
        return String(value);
    }
  }

  async _getRateLimitsForEnvironment(environment) {
    const sql = `
      SELECT * FROM pf_rate_limits 
      WHERE (environment = ? OR environment IS NULL)
      AND is_active = 1
      ORDER BY priority DESC
    `;
    
    return await this.db.query(sql, [environment]);
  }
}

module.exports = ConfigurationTemplatesService;