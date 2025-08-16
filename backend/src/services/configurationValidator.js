/**
 * Configuration Validation Service
 * 
 * Comprehensive validation system for configuration values:
 * - Type validation and conversion
 * - Range and format validation
 * - Dependency checking and resolution
 * - Circular dependency detection
 * - Custom validation rules
 * - Validation rule inheritance
 * - Batch validation for consistency
 */

const { logger } = require('../utils/logger');

class ValidationRule {
  constructor(type, params = {}, message = null) {
    this.type = type;
    this.params = params;
    this.message = message;
  }

  validate(value, context = {}) {
    throw new Error('Validation rule must implement validate method');
  }
}

class TypeValidationRule extends ValidationRule {
  constructor(expectedType, params = {}) {
    super('type', { expectedType, ...params });
  }

  validate(value, context = {}) {
    if (value === null || value === undefined) {
      return { valid: true }; // Null checks are handled separately
    }

    const { expectedType } = this.params;
    let convertedValue = value;
    let valid = true;
    let error = null;

    try {
      switch (expectedType) {
        case 'boolean':
          if (typeof value === 'boolean') {
            convertedValue = value;
          } else if (typeof value === 'string') {
            const lower = value.toLowerCase();
            if (['true', '1', 'yes', 'on'].includes(lower)) {
              convertedValue = true;
            } else if (['false', '0', 'no', 'off'].includes(lower)) {
              convertedValue = false;
            } else {
              valid = false;
              error = `Cannot convert "${value}" to boolean`;
            }
          } else if (typeof value === 'number') {
            convertedValue = value !== 0;
          } else {
            valid = false;
            error = `Expected boolean, got ${typeof value}`;
          }
          break;

        case 'number':
          if (typeof value === 'number') {
            convertedValue = value;
          } else if (typeof value === 'string') {
            const parsed = parseFloat(value);
            if (isNaN(parsed)) {
              valid = false;
              error = `Cannot convert "${value}" to number`;
            } else {
              convertedValue = parsed;
            }
          } else {
            valid = false;
            error = `Expected number, got ${typeof value}`;
          }
          break;

        case 'integer':
          if (Number.isInteger(value)) {
            convertedValue = value;
          } else if (typeof value === 'string') {
            const parsed = parseInt(value, 10);
            if (isNaN(parsed) || parsed.toString() !== value) {
              valid = false;
              error = `Cannot convert "${value}" to integer`;
            } else {
              convertedValue = parsed;
            }
          } else {
            valid = false;
            error = `Expected integer, got ${typeof value}`;
          }
          break;

        case 'string':
          convertedValue = String(value);
          break;

        case 'json':
        case 'object':
          if (typeof value === 'object') {
            convertedValue = value;
          } else if (typeof value === 'string') {
            try {
              convertedValue = JSON.parse(value);
            } catch (e) {
              valid = false;
              error = `Invalid JSON: ${e.message}`;
            }
          } else {
            valid = false;
            error = `Expected JSON object, got ${typeof value}`;
          }
          break;

        case 'array':
          if (Array.isArray(value)) {
            convertedValue = value;
          } else if (typeof value === 'string') {
            try {
              const parsed = JSON.parse(value);
              if (Array.isArray(parsed)) {
                convertedValue = parsed;
              } else {
                valid = false;
                error = 'Parsed JSON is not an array';
              }
            } catch (e) {
              valid = false;
              error = `Invalid JSON array: ${e.message}`;
            }
          } else {
            valid = false;
            error = `Expected array, got ${typeof value}`;
          }
          break;

        case 'date':
          if (value instanceof Date) {
            convertedValue = value;
          } else {
            const parsed = new Date(value);
            if (isNaN(parsed.getTime())) {
              valid = false;
              error = `Cannot convert "${value}" to valid date`;
            } else {
              convertedValue = parsed;
            }
          }
          break;

        case 'url':
          try {
            new URL(value);
            convertedValue = String(value);
          } catch (e) {
            valid = false;
            error = `Invalid URL: ${e.message}`;
          }
          break;

        case 'email':
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (typeof value === 'string' && emailRegex.test(value)) {
            convertedValue = value;
          } else {
            valid = false;
            error = 'Invalid email format';
          }
          break;

        case 'duration':
          // Parse duration strings like "1h", "30m", "2d"
          if (typeof value === 'number') {
            convertedValue = value; // Assume seconds
          } else if (typeof value === 'string') {
            const match = value.match(/^(\d+)([smhd])$/);
            if (match) {
              const [, num, unit] = match;
              const multipliers = { s: 1, m: 60, h: 3600, d: 86400 };
              convertedValue = parseInt(num) * multipliers[unit];
            } else {
              valid = false;
              error = 'Invalid duration format (use: 1s, 5m, 2h, 1d)';
            }
          } else {
            valid = false;
            error = `Expected duration, got ${typeof value}`;
          }
          break;

        case 'cron':
          // Basic cron validation
          if (typeof value === 'string') {
            const parts = value.split(' ');
            if (parts.length === 5 || parts.length === 6) {
              convertedValue = value;
            } else {
              valid = false;
              error = 'Invalid cron expression format';
            }
          } else {
            valid = false;
            error = `Expected cron string, got ${typeof value}`;
          }
          break;

        default:
          valid = false;
          error = `Unknown validation type: ${expectedType}`;
      }
    } catch (e) {
      valid = false;
      error = e.message;
    }

    return {
      valid,
      convertedValue: valid ? convertedValue : value,
      error: valid ? null : error
    };
  }
}

class RangeValidationRule extends ValidationRule {
  constructor(min = null, max = null) {
    super('range', { min, max });
  }

  validate(value, context = {}) {
    if (value === null || value === undefined) {
      return { valid: true };
    }

    if (typeof value !== 'number') {
      return { valid: false, error: 'Range validation requires numeric value' };
    }

    const { min, max } = this.params;

    if (min !== null && value < min) {
      return { valid: false, error: `Value ${value} is less than minimum ${min}` };
    }

    if (max !== null && value > max) {
      return { valid: false, error: `Value ${value} is greater than maximum ${max}` };
    }

    return { valid: true, convertedValue: value };
  }
}

class AllowedValuesValidationRule extends ValidationRule {
  constructor(allowedValues) {
    super('allowed_values', { allowedValues });
  }

  validate(value, context = {}) {
    const { allowedValues } = this.params;
    
    if (!Array.isArray(allowedValues)) {
      return { valid: false, error: 'Allowed values must be an array' };
    }

    if (allowedValues.includes(value)) {
      return { valid: true, convertedValue: value };
    }

    return { 
      valid: false, 
      error: `Value "${value}" is not in allowed values: ${allowedValues.join(', ')}` 
    };
  }
}

class RegexValidationRule extends ValidationRule {
  constructor(pattern, flags = '') {
    super('regex', { pattern, flags });
  }

  validate(value, context = {}) {
    if (typeof value !== 'string') {
      return { valid: false, error: 'Regex validation requires string value' };
    }

    try {
      const regex = new RegExp(this.params.pattern, this.params.flags);
      if (regex.test(value)) {
        return { valid: true, convertedValue: value };
      } else {
        return { valid: false, error: `Value does not match pattern: ${this.params.pattern}` };
      }
    } catch (e) {
      return { valid: false, error: `Invalid regex pattern: ${e.message}` };
    }
  }
}

class CustomValidationRule extends ValidationRule {
  constructor(validatorFunction, errorMessage = 'Custom validation failed') {
    super('custom', { validatorFunction, errorMessage });
  }

  validate(value, context = {}) {
    try {
      const result = this.params.validatorFunction(value, context);
      
      if (typeof result === 'boolean') {
        return {
          valid: result,
          convertedValue: value,
          error: result ? null : this.params.errorMessage
        };
      } else if (typeof result === 'object') {
        return {
          valid: result.valid || false,
          convertedValue: result.value !== undefined ? result.value : value,
          error: result.error || (result.valid ? null : this.params.errorMessage)
        };
      } else {
        return {
          valid: false,
          convertedValue: value,
          error: 'Custom validator must return boolean or object'
        };
      }
    } catch (e) {
      return {
        valid: false,
        convertedValue: value,
        error: `Custom validation error: ${e.message}`
      };
    }
  }
}

class DependencyGraph {
  constructor() {
    this.nodes = new Map();
    this.edges = new Map();
  }

  addNode(key, dependencies = [], conflicts = []) {
    this.nodes.set(key, { dependencies, conflicts });
    
    if (!this.edges.has(key)) {
      this.edges.set(key, new Set());
    }

    // Add dependency edges
    for (const dep of dependencies) {
      if (!this.edges.has(dep)) {
        this.edges.set(dep, new Set());
      }
      this.edges.get(dep).add(key);
    }
  }

  hasCircularDependency() {
    const visited = new Set();
    const recursionStack = new Set();

    const dfs = (node) => {
      if (recursionStack.has(node)) {
        return true; // Circular dependency found
      }
      if (visited.has(node)) {
        return false;
      }

      visited.add(node);
      recursionStack.add(node);

      const nodeData = this.nodes.get(node);
      if (nodeData) {
        for (const dep of nodeData.dependencies) {
          if (dfs(dep)) {
            return true;
          }
        }
      }

      recursionStack.delete(node);
      return false;
    };

    for (const node of this.nodes.keys()) {
      if (dfs(node)) {
        return true;
      }
    }

    return false;
  }

  getResolutionOrder() {
    const visited = new Set();
    const order = [];

    const dfs = (node) => {
      if (visited.has(node)) {
        return;
      }

      visited.add(node);

      const nodeData = this.nodes.get(node);
      if (nodeData) {
        for (const dep of nodeData.dependencies) {
          dfs(dep);
        }
      }

      order.push(node);
    };

    for (const node of this.nodes.keys()) {
      dfs(node);
    }

    return order;
  }

  checkConflicts(key1, key2) {
    const node1 = this.nodes.get(key1);
    const node2 = this.nodes.get(key2);

    if (node1 && node1.conflicts.includes(key2)) {
      return true;
    }
    if (node2 && node2.conflicts.includes(key1)) {
      return true;
    }

    return false;
  }
}

class ConfigurationValidator {
  constructor(db) {
    this.db = db;
    this.validationRules = new Map();
    this.dependencyGraph = new DependencyGraph();
    this.schemaCache = new Map();
    
    this.registerBuiltInValidators();
  }

  registerBuiltInValidators() {
    // Common validation functions
    this.registerCustomValidator('positive_number', (value) => {
      return typeof value === 'number' && value > 0;
    }, 'Value must be a positive number');

    this.registerCustomValidator('non_negative_number', (value) => {
      return typeof value === 'number' && value >= 0;
    }, 'Value must be non-negative');

    this.registerCustomValidator('valid_port', (value) => {
      return Number.isInteger(value) && value >= 1 && value <= 65535;
    }, 'Value must be a valid port number (1-65535)');

    this.registerCustomValidator('valid_percentage', (value) => {
      return typeof value === 'number' && value >= 0 && value <= 100;
    }, 'Value must be a percentage (0-100)');

    this.registerCustomValidator('valid_timeout', (value) => {
      return typeof value === 'number' && value >= 0 && value <= 86400; // Max 24 hours
    }, 'Timeout must be between 0 and 86400 seconds');
  }

  registerCustomValidator(name, validatorFunction, errorMessage) {
    this.validationRules.set(name, new CustomValidationRule(validatorFunction, errorMessage));
  }

  async validateValue(configKey, value, context = {}) {
    try {
      // Get configuration schema
      const schema = await this.getConfigurationSchema(configKey);
      if (!schema) {
        throw new Error(`Configuration schema not found for key: ${configKey}`);
      }

      // Build validation chain
      const validationChain = this.buildValidationChain(schema);

      // Execute validation chain
      let currentValue = value;
      const results = [];

      for (const rule of validationChain) {
        const result = rule.validate(currentValue, { ...context, configKey, schema });
        results.push({
          rule: rule.type,
          valid: result.valid,
          error: result.error
        });

        if (!result.valid) {
          return {
            valid: false,
            errors: results.filter(r => !r.valid).map(r => r.error),
            convertedValue: currentValue
          };
        }

        currentValue = result.convertedValue;
      }

      return {
        valid: true,
        convertedValue: currentValue,
        validationResults: results
      };

    } catch (error) {
      logger.error(`Validation error for ${configKey}:`, error);
      return {
        valid: false,
        errors: [error.message],
        convertedValue: value
      };
    }
  }

  async validateBatch(configurations, context = {}) {
    const results = new Map();
    const dependencies = new Map();

    // First pass: validate individual values and collect dependencies
    for (const [key, value] of Object.entries(configurations)) {
      try {
        const result = await this.validateValue(key, value, context);
        results.set(key, result);

        // Collect dependencies
        const schema = await this.getConfigurationSchema(key);
        if (schema) {
          const deps = schema.depends_on ? JSON.parse(schema.depends_on) : [];
          const conflicts = schema.conflicts_with ? JSON.parse(schema.conflicts_with) : [];
          dependencies.set(key, { deps, conflicts });
        }
      } catch (error) {
        results.set(key, {
          valid: false,
          errors: [error.message],
          convertedValue: value
        });
      }
    }

    // Second pass: validate dependencies and conflicts
    const dependencyErrors = this.validateDependenciesAndConflicts(configurations, dependencies);

    // Merge results
    for (const [key, depError] of dependencyErrors) {
      const existingResult = results.get(key) || { valid: true, errors: [] };
      existingResult.valid = false;
      existingResult.errors = [...(existingResult.errors || []), depError];
      results.set(key, existingResult);
    }

    // Calculate overall success
    const allValid = Array.from(results.values()).every(r => r.valid);

    return {
      valid: allValid,
      results: Object.fromEntries(results),
      summary: {
        total: results.size,
        valid: Array.from(results.values()).filter(r => r.valid).length,
        invalid: Array.from(results.values()).filter(r => !r.valid).length
      }
    };
  }

  validateDependenciesAndConflicts(configurations, dependencies) {
    const errors = new Map();

    // Build dependency graph
    const graph = new DependencyGraph();
    for (const [key, { deps, conflicts }] of dependencies) {
      graph.addNode(key, deps, conflicts);
    }

    // Check for circular dependencies
    if (graph.hasCircularDependency()) {
      for (const key of dependencies.keys()) {
        errors.set(key, 'Circular dependency detected');
      }
      return errors;
    }

    // Check dependency satisfaction
    for (const [key, { deps, conflicts }] of dependencies) {
      // Check dependencies
      for (const dep of deps) {
        if (!(dep in configurations)) {
          errors.set(key, `Missing required dependency: ${dep}`);
        }
      }

      // Check conflicts
      for (const conflict of conflicts) {
        if (conflict in configurations) {
          errors.set(key, `Conflicts with: ${conflict}`);
        }
      }
    }

    return errors;
  }

  async getConfigurationSchema(configKey) {
    // Check cache
    if (this.schemaCache.has(configKey)) {
      const cached = this.schemaCache.get(configKey);
      if (cached.expires > Date.now()) {
        return cached.schema;
      }
    }

    // Load from database
    const sql = `
      SELECT * FROM pf_system_config 
      WHERE config_key = ? AND is_active = 1
    `;
    const schema = await this.db.queryOne(sql, [configKey]);

    // Cache result
    if (schema) {
      this.schemaCache.set(configKey, {
        schema,
        expires: Date.now() + 300000 // 5 minutes
      });
    }

    return schema;
  }

  buildValidationChain(schema) {
    const chain = [];

    // Required validation
    if (schema.is_required === 1) {
      chain.push(new CustomValidationRule(
        (value) => value !== null && value !== undefined && value !== '',
        `Configuration ${schema.config_key} is required`
      ));
    }

    // Type validation
    chain.push(new TypeValidationRule(schema.config_type));

    // Range validation
    if (schema.min_value !== null || schema.max_value !== null) {
      chain.push(new RangeValidationRule(schema.min_value, schema.max_value));
    }

    // Allowed values validation
    if (schema.allowed_values) {
      try {
        const allowedValues = JSON.parse(schema.allowed_values);
        chain.push(new AllowedValuesValidationRule(allowedValues));
      } catch (e) {
        logger.warn(`Invalid allowed_values JSON for ${schema.config_key}:`, e);
      }
    }

    // Regex validation
    if (schema.regex_pattern) {
      chain.push(new RegexValidationRule(schema.regex_pattern));
    }

    // Custom validation rule
    if (schema.validation_rule) {
      const customRule = this.validationRules.get(schema.validation_rule);
      if (customRule) {
        chain.push(customRule);
      }
    }

    return chain;
  }

  clearCache() {
    this.schemaCache.clear();
  }

  async validateEnvironmentConsistency(environment) {
    try {
      // Get all configurations for environment
      const sql = `
        SELECT 
          sc.config_key,
          sc.config_value as base_value,
          sc.config_type,
          sc.validation_rule,
          ec.config_value as override_value
        FROM pf_system_config sc
        LEFT JOIN pf_environment_config ec ON sc.config_key = ec.config_key
          AND ec.environment = ? AND ec.is_active = 1
        WHERE sc.is_active = 1
      `;

      const configs = await this.db.query(sql, [environment]);
      const configMap = {};

      for (const config of configs) {
        const effectiveValue = config.override_value || config.base_value;
        configMap[config.config_key] = effectiveValue;
      }

      return await this.validateBatch(configMap, { environment });

    } catch (error) {
      logger.error(`Environment consistency validation failed for ${environment}:`, error);
      throw error;
    }
  }

  getValidationRuleNames() {
    return Array.from(this.validationRules.keys());
  }

  async exportValidationRules() {
    const rules = {};
    
    for (const [name, rule] of this.validationRules.entries()) {
      rules[name] = {
        type: rule.type,
        description: rule.message || `Custom validation rule: ${name}`
      };
    }

    return rules;
  }
}

module.exports = {
  ConfigurationValidator,
  ValidationRule,
  TypeValidationRule,
  RangeValidationRule,
  AllowedValuesValidationRule,
  RegexValidationRule,
  CustomValidationRule,
  DependencyGraph
};