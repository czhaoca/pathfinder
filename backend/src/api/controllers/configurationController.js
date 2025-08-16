/**
 * Configuration Management Controller
 * 
 * Handles HTTP requests for configuration management operations:
 * - System configuration CRUD
 * - Environment overrides
 * - Feature flag management
 * - Rate limit configuration
 * - Templates and bulk operations
 */

const { ConfigurationService } = require('../../services/configurationService');
const { logger } = require('../../utils/logger');
const { apiResponse } = require('../../utils/apiResponse');

class ConfigurationController {
  constructor(db, cache = null, auditLogger = null) {
    this.configService = new ConfigurationService(db, cache, auditLogger);
  }

  /**
   * Get all system configurations
   */
  async getAllConfigurations(req, res) {
    try {
      const { environment, category, active_only = 'true' } = req.query;
      
      let sql = `
        SELECT 
          sc.id,
          sc.config_key,
          sc.config_value,
          sc.config_type,
          sc.category,
          sc.subcategory,
          sc.display_name,
          sc.description,
          sc.default_value,
          sc.is_required,
          sc.is_active,
          sc.requires_restart,
          sc.cache_ttl_seconds,
          sc.created_at,
          sc.updated_at,
          ec.config_value as override_value,
          ec.environment as override_environment,
          ec.override_reason,
          ec.expires_at as override_expires
        FROM pf_system_config sc
        LEFT JOIN pf_environment_config ec ON sc.config_key = ec.config_key
      `;
      
      const params = [];
      const conditions = [];
      
      if (active_only === 'true') {
        conditions.push('sc.is_active = 1');
      }
      
      if (category) {
        conditions.push('sc.category = ?');
        params.push(category);
      }
      
      if (environment) {
        conditions.push('(ec.environment = ? OR ec.environment IS NULL)');
        params.push(environment);
      }
      
      if (conditions.length > 0) {
        sql += ` WHERE ${conditions.join(' AND ')}`;
      }
      
      sql += ` ORDER BY sc.category, sc.subcategory, sc.config_key`;
      
      const configurations = await req.db.query(sql, params);
      
      // Group by category for better organization
      const grouped = configurations.reduce((acc, config) => {
        const category = config.category;
        if (!acc[category]) {
          acc[category] = [];
        }
        acc[category].push(config);
        return acc;
      }, {});
      
      res.json(apiResponse.success({
        configurations: grouped,
        total_count: configurations.length,
        environment: environment || 'all',
        category: category || 'all'
      }));
    } catch (error) {
      logger.error('Error getting all configurations:', error);
      res.status(500).json(apiResponse.error('Failed to retrieve configurations'));
    }
  }

  /**
   * Get specific configuration with metadata
   */
  async getConfiguration(req, res) {
    try {
      const { key } = req.params;
      const { environment, include_history = 'false' } = req.query;
      
      // Get current value
      const value = await this.configService.getValue(key, environment, req.user?.id);
      
      // Get configuration metadata
      const metadataSql = `
        SELECT 
          sc.*,
          ec.config_value as override_value,
          ec.environment as override_environment,
          ec.override_reason,
          ec.expires_at as override_expires,
          ec.is_temporary as override_temporary
        FROM pf_system_config sc
        LEFT JOIN pf_environment_config ec ON sc.config_key = ec.config_key
        WHERE sc.config_key = ?
        AND (ec.environment = ? OR ec.environment IS NULL OR ? IS NULL)
      `;
      
      const metadata = await req.db.queryOne(metadataSql, [key, environment, environment]);
      
      if (!metadata) {
        return res.status(404).json(apiResponse.error(`Configuration not found: ${key}`));
      }
      
      const result = {
        key,
        value,
        environment: environment || 'global',
        metadata,
        effective_value: value,
        has_override: !!metadata.override_value
      };
      
      // Include history if requested
      if (include_history === 'true') {
        result.history = await this.configService.getConfigurationHistory(key, 20);
      }
      
      res.json(apiResponse.success(result));
    } catch (error) {
      if (error.message.includes('not found')) {
        res.status(404).json(apiResponse.error(`Configuration not found: ${req.params.key}`));
      } else {
        logger.error(`Error getting configuration ${req.params.key}:`, error);
        res.status(500).json(apiResponse.error('Failed to retrieve configuration'));
      }
    }
  }

  /**
   * Create new system configuration
   */
  async createConfiguration(req, res) {
    try {
      const {
        config_key,
        config_value,
        config_type,
        category,
        subcategory,
        display_name,
        description,
        default_value,
        is_required = 0,
        validation_rule,
        allowed_values,
        min_value,
        max_value,
        requires_restart = 0,
        cache_ttl_seconds = 300
      } = req.body;
      
      // Validate required fields
      if (!config_key || !config_type || !category) {
        return res.status(400).json(apiResponse.error('config_key, config_type, and category are required'));
      }
      
      // Check if configuration already exists
      const existingSql = `SELECT id FROM pf_system_config WHERE config_key = ?`;
      const existing = await req.db.queryOne(existingSql, [config_key]);
      
      if (existing) {
        return res.status(409).json(apiResponse.error('Configuration already exists'));
      }
      
      // Create configuration
      const insertSql = `
        INSERT INTO pf_system_config (
          config_key, config_value, config_type, category, subcategory,
          display_name, description, default_value, is_required,
          validation_rule, allowed_values, min_value, max_value,
          requires_restart, cache_ttl_seconds, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      await req.db.execute(insertSql, [
        config_key,
        config_value || default_value,
        config_type,
        category,
        subcategory,
        display_name,
        description,
        default_value,
        is_required,
        validation_rule,
        allowed_values ? JSON.stringify(allowed_values) : null,
        min_value,
        max_value,
        requires_restart,
        cache_ttl_seconds,
        req.user.id
      ]);
      
      // Clear cache
      await this.configService.cache.clear();
      
      res.status(201).json(apiResponse.success({
        config_key,
        message: 'Configuration created successfully'
      }));
    } catch (error) {
      logger.error('Error creating configuration:', error);
      res.status(500).json(apiResponse.error('Failed to create configuration'));
    }
  }

  /**
   * Update configuration value
   */
  async updateConfiguration(req, res) {
    try {
      const { key } = req.params;
      const { value, environment, reason, validate_only = false } = req.body;
      
      if (value === undefined) {
        return res.status(400).json(apiResponse.error('Value is required'));
      }
      
      // If validate_only, just validate without saving
      if (validate_only) {
        try {
          const configSql = `SELECT * FROM pf_system_config WHERE config_key = ?`;
          const config = await req.db.queryOne(configSql, [key]);
          
          if (!config) {
            return res.status(404).json(apiResponse.error('Configuration not found'));
          }
          
          this.configService._validateValue(value, config);
          
          return res.json(apiResponse.success({
            key,
            value,
            valid: true,
            message: 'Validation passed'
          }));
        } catch (validationError) {
          return res.status(400).json(apiResponse.error(validationError.message));
        }
      }
      
      const result = await this.configService.setValue(
        key,
        value,
        environment,
        req.user.id,
        reason
      );
      
      res.json(apiResponse.success({
        key,
        value,
        environment: environment || 'global',
        reason,
        ...result
      }));
    } catch (error) {
      if (error.message.includes('not found')) {
        res.status(404).json(apiResponse.error(`Configuration not found: ${req.params.key}`));
      } else if (error.message.includes('validation') || error.message.includes('Invalid')) {
        res.status(400).json(apiResponse.error(error.message));
      } else {
        logger.error(`Error updating configuration ${req.params.key}:`, error);
        res.status(500).json(apiResponse.error('Failed to update configuration'));
      }
    }
  }

  /**
   * Delete configuration
   */
  async deleteConfiguration(req, res) {
    try {
      const { key } = req.params;
      const { reason } = req.body;
      
      // Check if configuration is deletable
      const configSql = `
        SELECT is_deletable, is_required 
        FROM pf_system_config 
        WHERE config_key = ?
      `;
      const config = await req.db.queryOne(configSql, [key]);
      
      if (!config) {
        return res.status(404).json(apiResponse.error('Configuration not found'));
      }
      
      if (config.is_deletable !== 1) {
        return res.status(403).json(apiResponse.error('Configuration is not deletable'));
      }
      
      if (config.is_required === 1) {
        return res.status(403).json(apiResponse.error('Required configuration cannot be deleted'));
      }
      
      // Record history before deletion
      await this.configService._recordHistory({
        table_name: 'pf_system_config',
        config_key: key,
        action: 'delete',
        old_value: await this.configService.getValue(key),
        new_value: null,
        changed_by: req.user.id,
        change_reason: reason
      }, req.db);
      
      // Delete configuration
      const deleteSql = `DELETE FROM pf_system_config WHERE config_key = ?`;
      await req.db.execute(deleteSql, [key]);
      
      // Clear cache
      await this.configService.cache.invalidate(key);
      
      res.json(apiResponse.success({
        key,
        message: 'Configuration deleted successfully',
        reason
      }));
    } catch (error) {
      logger.error(`Error deleting configuration ${req.params.key}:`, error);
      res.status(500).json(apiResponse.error('Failed to delete configuration'));
    }
  }

  /**
   * Get configuration change history
   */
  async getConfigurationHistory(req, res) {
    try {
      const { key } = req.params;
      const { limit = 50, offset = 0 } = req.query;
      
      const history = await this.configService.getConfigurationHistory(
        key, 
        parseInt(limit)
      );
      
      res.json(apiResponse.success({
        key,
        history,
        count: history.length,
        limit: parseInt(limit),
        offset: parseInt(offset)
      }));
    } catch (error) {
      logger.error(`Error getting configuration history for ${req.params.key}:`, error);
      res.status(500).json(apiResponse.error('Failed to retrieve configuration history'));
    }
  }

  /**
   * Rollback configuration
   */
  async rollbackConfiguration(req, res) {
    try {
      const { key } = req.params;
      const { environment, steps = 1, reason } = req.body;
      
      if (steps < 1 || steps > 10) {
        return res.status(400).json(apiResponse.error('Steps must be between 1 and 10'));
      }
      
      const result = await this.configService.rollback(
        key,
        environment,
        steps,
        req.user.id
      );
      
      res.json(apiResponse.success({
        key,
        environment: environment || 'global',
        steps,
        reason,
        ...result
      }));
    } catch (error) {
      if (error.message.includes('No rollback history')) {
        res.status(404).json(apiResponse.error('No rollback history available'));
      } else {
        logger.error(`Error rolling back configuration ${req.params.key}:`, error);
        res.status(500).json(apiResponse.error('Failed to rollback configuration'));
      }
    }
  }

  /**
   * Get configuration categories and statistics
   */
  async getConfigurationStats(req, res) {
    try {
      const { environment } = req.query;
      
      // Get category statistics
      const categorySql = `
        SELECT 
          category,
          COUNT(*) as total_configs,
          SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_configs,
          SUM(CASE WHEN requires_restart = 1 THEN 1 ELSE 0 END) as restart_required_configs
        FROM pf_system_config
        GROUP BY category
        ORDER BY category
      `;
      
      const categoryStats = await req.db.query(categorySql);
      
      // Get environment override statistics
      let overrideStats = [];
      if (environment) {
        const overrideSql = `
          SELECT 
            ec.environment,
            COUNT(*) as override_count,
            SUM(CASE WHEN ec.is_temporary = 1 THEN 1 ELSE 0 END) as temporary_overrides
          FROM pf_environment_config ec
          WHERE ec.environment = ? AND ec.is_active = 1
          GROUP BY ec.environment
        `;
        overrideStats = await req.db.query(overrideSql, [environment]);
      }
      
      // Get recent changes
      const recentChangesSql = `
        SELECT 
          config_key,
          action,
          changed_by,
          change_timestamp,
          environment
        FROM pf_config_history
        WHERE change_timestamp >= ?
        ORDER BY change_timestamp DESC
        FETCH FIRST 10 ROWS ONLY
      `;
      
      const recentChanges = await req.db.query(recentChangesSql, [
        new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
      ]);
      
      res.json(apiResponse.success({
        categories: categoryStats,
        environment_overrides: overrideStats,
        recent_changes: recentChanges,
        cache_stats: {
          local_cache_size: this.configService.cache.localCache.size,
          feature_flag_cache_size: this.configService.featureFlagCache.size
        }
      }));
    } catch (error) {
      logger.error('Error getting configuration statistics:', error);
      res.status(500).json(apiResponse.error('Failed to retrieve configuration statistics'));
    }
  }

  /**
   * Bulk configuration operations
   */
  async bulkUpdate(req, res) {
    try {
      const { operations, environment, reason } = req.body;
      
      if (!Array.isArray(operations) || operations.length === 0) {
        return res.status(400).json(apiResponse.error('Operations array is required'));
      }
      
      if (operations.length > 100) {
        return res.status(400).json(apiResponse.error('Maximum 100 operations allowed'));
      }
      
      const results = [];
      
      for (const operation of operations) {
        try {
          const { action, key, value } = operation;
          
          switch (action) {
            case 'update':
              const result = await this.configService.setValue(
                key,
                value,
                environment,
                req.user.id,
                reason || `Bulk operation: ${action} ${key}`
              );
              results.push({ key, action, success: true, ...result });
              break;
              
            case 'delete':
              // Implementation for bulk delete
              const deleteSql = `UPDATE pf_system_config SET is_active = 0 WHERE config_key = ?`;
              await req.db.execute(deleteSql, [key]);
              results.push({ key, action, success: true });
              break;
              
            default:
              results.push({ 
                key, 
                action, 
                success: false, 
                error: `Unknown action: ${action}` 
              });
          }
        } catch (error) {
          results.push({
            key: operation.key,
            action: operation.action,
            success: false,
            error: error.message
          });
        }
      }
      
      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;
      
      res.json(apiResponse.success({
        environment: environment || 'global',
        reason,
        results,
        summary: {
          total: results.length,
          successful,
          failed,
          success_rate: (successful / results.length * 100).toFixed(1) + '%'
        }
      }));
    } catch (error) {
      logger.error('Error in bulk configuration operation:', error);
      res.status(500).json(apiResponse.error('Failed to perform bulk operation'));
    }
  }

  /**
   * Export configurations
   */
  async exportConfigurations(req, res) {
    try {
      const { environment, category, format = 'json' } = req.query;
      
      const configurations = await this.configService.getAllConfigurations(environment);
      
      let filteredConfigs = configurations;
      if (category) {
        filteredConfigs = configurations.filter(config => config.category === category);
      }
      
      const exportData = {
        export_timestamp: new Date().toISOString(),
        export_by: req.user.id,
        environment: environment || 'all',
        category: category || 'all',
        configuration_count: filteredConfigs.length,
        configurations: filteredConfigs.map(config => ({
          key: config.config_key,
          value: config.config_value,
          type: config.config_type,
          category: config.category,
          subcategory: config.subcategory,
          description: config.description,
          override_value: config.override_value,
          override_environment: config.override_environment
        }))
      };
      
      if (format === 'csv') {
        // CSV export implementation
        const csv = this._convertToCSV(exportData.configurations);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=configurations.csv');
        res.send(csv);
      } else {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', 'attachment; filename=configurations.json');
        res.json(exportData);
      }
    } catch (error) {
      logger.error('Error exporting configurations:', error);
      res.status(500).json(apiResponse.error('Failed to export configurations'));
    }
  }

  // Helper method for CSV conversion
  _convertToCSV(data) {
    if (!data.length) return '';
    
    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => 
        headers.map(header => {
          const value = row[header];
          return typeof value === 'string' && value.includes(',') 
            ? `"${value}"` 
            : value;
        }).join(',')
      )
    ].join('\n');
    
    return csvContent;
  }
}

module.exports = ConfigurationController;