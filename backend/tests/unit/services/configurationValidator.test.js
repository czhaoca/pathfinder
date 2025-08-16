/**
 * Configuration Validator Unit Tests
 * 
 * Comprehensive test suite for the ConfigurationValidator class:
 * - Type validation and conversion
 * - Range and format validation
 * - Dependency checking
 * - Custom validation rules
 * - Batch validation
 */

const {
  ConfigurationValidator,
  TypeValidationRule,
  RangeValidationRule,
  AllowedValuesValidationRule,
  RegexValidationRule,
  CustomValidationRule,
  DependencyGraph
} = require('../../../src/services/configurationValidator');

// Mock database
const mockDb = {
  queryOne: jest.fn(),
  query: jest.fn()
};

describe('TypeValidationRule', () => {
  describe('boolean validation', () => {
    let rule;

    beforeEach(() => {
      rule = new TypeValidationRule('boolean');
    });

    it('should validate true boolean values', () => {
      expect(rule.validate(true).valid).toBe(true);
      expect(rule.validate('true').valid).toBe(true);
      expect(rule.validate('1').valid).toBe(true);
      expect(rule.validate(1).valid).toBe(true);
      expect(rule.validate('yes').valid).toBe(true);
      expect(rule.validate('on').valid).toBe(true);
    });

    it('should validate false boolean values', () => {
      expect(rule.validate(false).valid).toBe(true);
      expect(rule.validate('false').valid).toBe(true);
      expect(rule.validate('0').valid).toBe(true);
      expect(rule.validate(0).valid).toBe(true);
      expect(rule.validate('no').valid).toBe(true);
      expect(rule.validate('off').valid).toBe(true);
    });

    it('should convert string booleans correctly', () => {
      expect(rule.validate('true').convertedValue).toBe(true);
      expect(rule.validate('false').convertedValue).toBe(false);
    });

    it('should reject invalid boolean values', () => {
      const result = rule.validate('invalid');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Cannot convert "invalid" to boolean');
    });

    it('should handle null values', () => {
      expect(rule.validate(null).valid).toBe(true);
      expect(rule.validate(undefined).valid).toBe(true);
    });
  });

  describe('number validation', () => {
    let rule;

    beforeEach(() => {
      rule = new TypeValidationRule('number');
    });

    it('should validate numeric values', () => {
      expect(rule.validate(42).valid).toBe(true);
      expect(rule.validate(3.14).valid).toBe(true);
      expect(rule.validate(-10).valid).toBe(true);
      expect(rule.validate(0).valid).toBe(true);
    });

    it('should convert string numbers correctly', () => {
      expect(rule.validate('42').convertedValue).toBe(42);
      expect(rule.validate('3.14').convertedValue).toBe(3.14);
      expect(rule.validate('-10').convertedValue).toBe(-10);
    });

    it('should reject invalid numeric strings', () => {
      const result = rule.validate('not-a-number');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Cannot convert "not-a-number" to number');
    });

    it('should reject non-numeric types', () => {
      const result = rule.validate(true);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Expected number, got boolean');
    });
  });

  describe('integer validation', () => {
    let rule;

    beforeEach(() => {
      rule = new TypeValidationRule('integer');
    });

    it('should validate integer values', () => {
      expect(rule.validate(42).valid).toBe(true);
      expect(rule.validate(-10).valid).toBe(true);
      expect(rule.validate(0).valid).toBe(true);
    });

    it('should convert string integers correctly', () => {
      expect(rule.validate('42').convertedValue).toBe(42);
      expect(rule.validate('-10').convertedValue).toBe(-10);
    });

    it('should reject float values', () => {
      expect(rule.validate(3.14).valid).toBe(false);
      expect(rule.validate('3.14').valid).toBe(false);
    });

    it('should reject invalid integer strings', () => {
      const result = rule.validate('42.5');
      expect(result.valid).toBe(false);
    });
  });

  describe('JSON validation', () => {
    let rule;

    beforeEach(() => {
      rule = new TypeValidationRule('json');
    });

    it('should validate object values', () => {
      const obj = { key: 'value', number: 42 };
      expect(rule.validate(obj).valid).toBe(true);
      expect(rule.validate(obj).convertedValue).toEqual(obj);
    });

    it('should parse valid JSON strings', () => {
      const jsonString = '{"key": "value", "number": 42}';
      const result = rule.validate(jsonString);
      
      expect(result.valid).toBe(true);
      expect(result.convertedValue).toEqual({ key: 'value', number: 42 });
    });

    it('should reject invalid JSON strings', () => {
      const result = rule.validate('invalid json');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid JSON');
    });
  });

  describe('array validation', () => {
    let rule;

    beforeEach(() => {
      rule = new TypeValidationRule('array');
    });

    it('should validate array values', () => {
      const arr = [1, 2, 3];
      expect(rule.validate(arr).valid).toBe(true);
      expect(rule.validate(arr).convertedValue).toEqual(arr);
    });

    it('should parse valid JSON array strings', () => {
      const jsonString = '[1, 2, 3]';
      const result = rule.validate(jsonString);
      
      expect(result.valid).toBe(true);
      expect(result.convertedValue).toEqual([1, 2, 3]);
    });

    it('should reject non-array JSON', () => {
      const result = rule.validate('{"key": "value"}');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Parsed JSON is not an array');
    });
  });

  describe('date validation', () => {
    let rule;

    beforeEach(() => {
      rule = new TypeValidationRule('date');
    });

    it('should validate Date objects', () => {
      const date = new Date();
      expect(rule.validate(date).valid).toBe(true);
      expect(rule.validate(date).convertedValue).toEqual(date);
    });

    it('should parse valid date strings', () => {
      const result = rule.validate('2024-01-01T12:00:00Z');
      expect(result.valid).toBe(true);
      expect(result.convertedValue).toBeInstanceOf(Date);
    });

    it('should reject invalid date strings', () => {
      const result = rule.validate('invalid-date');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Cannot convert "invalid-date" to valid date');
    });
  });

  describe('URL validation', () => {
    let rule;

    beforeEach(() => {
      rule = new TypeValidationRule('url');
    });

    it('should validate valid URLs', () => {
      expect(rule.validate('https://example.com').valid).toBe(true);
      expect(rule.validate('http://localhost:3000').valid).toBe(true);
      expect(rule.validate('ftp://files.example.com').valid).toBe(true);
    });

    it('should reject invalid URLs', () => {
      const result = rule.validate('not-a-url');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid URL');
    });
  });

  describe('email validation', () => {
    let rule;

    beforeEach(() => {
      rule = new TypeValidationRule('email');
    });

    it('should validate valid email addresses', () => {
      expect(rule.validate('user@example.com').valid).toBe(true);
      expect(rule.validate('test.email+tag@domain.co.uk').valid).toBe(true);
    });

    it('should reject invalid email addresses', () => {
      expect(rule.validate('invalid-email').valid).toBe(false);
      expect(rule.validate('@example.com').valid).toBe(false);
      expect(rule.validate('user@').valid).toBe(false);
    });
  });

  describe('duration validation', () => {
    let rule;

    beforeEach(() => {
      rule = new TypeValidationRule('duration');
    });

    it('should validate numeric durations as seconds', () => {
      expect(rule.validate(3600).valid).toBe(true);
      expect(rule.validate(3600).convertedValue).toBe(3600);
    });

    it('should parse duration strings', () => {
      expect(rule.validate('30s').convertedValue).toBe(30);
      expect(rule.validate('5m').convertedValue).toBe(300);
      expect(rule.validate('2h').convertedValue).toBe(7200);
      expect(rule.validate('1d').convertedValue).toBe(86400);
    });

    it('should reject invalid duration formats', () => {
      const result = rule.validate('invalid');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid duration format');
    });
  });

  describe('cron validation', () => {
    let rule;

    beforeEach(() => {
      rule = new TypeValidationRule('cron');
    });

    it('should validate 5-part cron expressions', () => {
      expect(rule.validate('0 0 * * *').valid).toBe(true);
      expect(rule.validate('*/5 * * * *').valid).toBe(true);
    });

    it('should validate 6-part cron expressions', () => {
      expect(rule.validate('0 0 0 * * *').valid).toBe(true);
    });

    it('should reject invalid cron expressions', () => {
      expect(rule.validate('invalid cron').valid).toBe(false);
      expect(rule.validate('* *').valid).toBe(false);
    });
  });
});

describe('RangeValidationRule', () => {
  it('should validate values within range', () => {
    const rule = new RangeValidationRule(0, 100);
    
    expect(rule.validate(50).valid).toBe(true);
    expect(rule.validate(0).valid).toBe(true);
    expect(rule.validate(100).valid).toBe(true);
  });

  it('should reject values outside range', () => {
    const rule = new RangeValidationRule(0, 100);
    
    expect(rule.validate(-1).valid).toBe(false);
    expect(rule.validate(101).valid).toBe(false);
  });

  it('should handle min-only validation', () => {
    const rule = new RangeValidationRule(0, null);
    
    expect(rule.validate(0).valid).toBe(true);
    expect(rule.validate(1000).valid).toBe(true);
    expect(rule.validate(-1).valid).toBe(false);
  });

  it('should handle max-only validation', () => {
    const rule = new RangeValidationRule(null, 100);
    
    expect(rule.validate(100).valid).toBe(true);
    expect(rule.validate(-1000).valid).toBe(true);
    expect(rule.validate(101).valid).toBe(false);
  });

  it('should reject non-numeric values', () => {
    const rule = new RangeValidationRule(0, 100);
    
    const result = rule.validate('not-a-number');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Range validation requires numeric value');
  });
});

describe('AllowedValuesValidationRule', () => {
  it('should validate allowed values', () => {
    const rule = new AllowedValuesValidationRule(['option1', 'option2', 'option3']);
    
    expect(rule.validate('option1').valid).toBe(true);
    expect(rule.validate('option2').valid).toBe(true);
    expect(rule.validate('option3').valid).toBe(true);
  });

  it('should reject disallowed values', () => {
    const rule = new AllowedValuesValidationRule(['option1', 'option2']);
    
    const result = rule.validate('option3');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('not in allowed values: option1, option2');
  });

  it('should handle non-array allowed values', () => {
    const rule = new AllowedValuesValidationRule('not-an-array');
    
    const result = rule.validate('any-value');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Allowed values must be an array');
  });
});

describe('RegexValidationRule', () => {
  it('should validate matching patterns', () => {
    const rule = new RegexValidationRule('^[A-Z][a-z]+$');
    
    expect(rule.validate('Valid').valid).toBe(true);
    expect(rule.validate('Another').valid).toBe(true);
  });

  it('should reject non-matching patterns', () => {
    const rule = new RegexValidationRule('^[A-Z][a-z]+$');
    
    expect(rule.validate('invalid').valid).toBe(false);
    expect(rule.validate('INVALID').valid).toBe(false);
    expect(rule.validate('Invalid123').valid).toBe(false);
  });

  it('should handle regex flags', () => {
    const rule = new RegexValidationRule('^valid$', 'i');
    
    expect(rule.validate('valid').valid).toBe(true);
    expect(rule.validate('VALID').valid).toBe(true);
    expect(rule.validate('Valid').valid).toBe(true);
  });

  it('should reject non-string values', () => {
    const rule = new RegexValidationRule('^test$');
    
    const result = rule.validate(123);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Regex validation requires string value');
  });

  it('should handle invalid regex patterns', () => {
    const rule = new RegexValidationRule('[invalid');
    
    const result = rule.validate('test');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Invalid regex pattern');
  });
});

describe('CustomValidationRule', () => {
  it('should execute custom validation function', () => {
    const validator = (value) => value > 10;
    const rule = new CustomValidationRule(validator, 'Value must be greater than 10');
    
    expect(rule.validate(15).valid).toBe(true);
    expect(rule.validate(5).valid).toBe(false);
  });

  it('should handle custom validation returning object', () => {
    const validator = (value) => ({
      valid: value >= 0,
      value: Math.abs(value),
      error: value < 0 ? 'Value must be non-negative' : null
    });
    
    const rule = new CustomValidationRule(validator);
    
    const result1 = rule.validate(5);
    expect(result1.valid).toBe(true);
    expect(result1.convertedValue).toBe(5);
    
    const result2 = rule.validate(-5);
    expect(result2.valid).toBe(false);
    expect(result2.convertedValue).toBe(5); // Absolute value applied
    expect(result2.error).toContain('Value must be non-negative');
  });

  it('should handle validation function errors', () => {
    const validator = () => {
      throw new Error('Validation function error');
    };
    
    const rule = new CustomValidationRule(validator);
    
    const result = rule.validate('any-value');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Custom validation error: Validation function error');
  });

  it('should handle context in validation', () => {
    const validator = (value, context) => {
      return context.environment === 'production' ? value <= 100 : true;
    };
    
    const rule = new CustomValidationRule(validator, 'Production values must be <= 100');
    
    expect(rule.validate(150, { environment: 'development' }).valid).toBe(true);
    expect(rule.validate(150, { environment: 'production' }).valid).toBe(false);
    expect(rule.validate(50, { environment: 'production' }).valid).toBe(true);
  });
});

describe('DependencyGraph', () => {
  let graph;

  beforeEach(() => {
    graph = new DependencyGraph();
  });

  it('should detect circular dependencies', () => {
    graph.addNode('A', ['B']);
    graph.addNode('B', ['C']);
    graph.addNode('C', ['A']); // Creates cycle: A -> B -> C -> A
    
    expect(graph.hasCircularDependency()).toBe(true);
  });

  it('should not detect false circular dependencies', () => {
    graph.addNode('A', ['B']);
    graph.addNode('B', ['C']);
    graph.addNode('C', []);
    graph.addNode('D', ['B']); // Diamond dependency, not circular
    
    expect(graph.hasCircularDependency()).toBe(false);
  });

  it('should provide correct resolution order', () => {
    graph.addNode('A', ['B', 'C']);
    graph.addNode('B', ['D']);
    graph.addNode('C', ['D']);
    graph.addNode('D', []);
    
    const order = graph.getResolutionOrder();
    
    // D should come before B and C, B and C should come before A
    expect(order.indexOf('D')).toBeLessThan(order.indexOf('B'));
    expect(order.indexOf('D')).toBeLessThan(order.indexOf('C'));
    expect(order.indexOf('B')).toBeLessThan(order.indexOf('A'));
    expect(order.indexOf('C')).toBeLessThan(order.indexOf('A'));
  });

  it('should detect conflicts correctly', () => {
    graph.addNode('A', [], ['B']);
    graph.addNode('B', [], ['A']);
    
    expect(graph.checkConflicts('A', 'B')).toBe(true);
    expect(graph.checkConflicts('B', 'A')).toBe(true);
    expect(graph.checkConflicts('A', 'C')).toBe(false);
  });
});

describe('ConfigurationValidator', () => {
  let validator;

  beforeEach(() => {
    jest.clearAllMocks();
    validator = new ConfigurationValidator(mockDb);
  });

  describe('validateValue', () => {
    it('should validate simple string configuration', async () => {
      const schema = {
        config_key: 'test.string',
        config_type: 'string',
        is_required: 0
      };
      
      mockDb.queryOne.mockResolvedValue(schema);
      
      const result = await validator.validateValue('test.string', 'test value');
      
      expect(result.valid).toBe(true);
      expect(result.convertedValue).toBe('test value');
    });

    it('should validate complex configuration with all rules', async () => {
      const schema = {
        config_key: 'test.complex',
        config_type: 'number',
        is_required: 1,
        min_value: 0,
        max_value: 100,
        validation_rule: 'positive_number'
      };
      
      mockDb.queryOne.mockResolvedValue(schema);
      
      const result = await validator.validateValue('test.complex', '50');
      
      expect(result.valid).toBe(true);
      expect(result.convertedValue).toBe(50);
    });

    it('should fail validation for invalid value', async () => {
      const schema = {
        config_key: 'test.number',
        config_type: 'number',
        min_value: 0,
        max_value: 100
      };
      
      mockDb.queryOne.mockResolvedValue(schema);
      
      const result = await validator.validateValue('test.number', '150');
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Value 150 is greater than maximum 100');
    });

    it('should handle non-existent configuration', async () => {
      mockDb.queryOne.mockResolvedValue(null);
      
      const result = await validator.validateValue('nonexistent.key', 'value');
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Configuration schema not found for key: nonexistent.key');
    });
  });

  describe('validateBatch', () => {
    it('should validate multiple configurations', async () => {
      const schemas = {
        'config1': {
          config_key: 'config1',
          config_type: 'string'
        },
        'config2': {
          config_key: 'config2',
          config_type: 'number',
          min_value: 0
        }
      };
      
      mockDb.queryOne
        .mockResolvedValueOnce(schemas.config1)
        .mockResolvedValueOnce(schemas.config2);
      
      const configurations = {
        config1: 'valid string',
        config2: 42
      };
      
      const result = await validator.validateBatch(configurations);
      
      expect(result.valid).toBe(true);
      expect(result.results.config1.valid).toBe(true);
      expect(result.results.config2.valid).toBe(true);
      expect(result.summary.valid).toBe(2);
      expect(result.summary.invalid).toBe(0);
    });

    it('should detect dependency violations', async () => {
      const schemas = {
        'config1': {
          config_key: 'config1',
          config_type: 'string',
          depends_on: JSON.stringify(['config2'])
        },
        'config2': {
          config_key: 'config2',
          config_type: 'string'
        }
      };
      
      mockDb.queryOne
        .mockResolvedValueOnce(schemas.config1);
      
      const configurations = {
        config1: 'value' // config2 is missing
      };
      
      const result = await validator.validateBatch(configurations);
      
      expect(result.valid).toBe(false);
      expect(result.results.config1.valid).toBe(false);
      expect(result.results.config1.errors).toContain('Missing required dependency: config2');
    });

    it('should detect conflicts', async () => {
      const schemas = {
        'config1': {
          config_key: 'config1',
          config_type: 'string',
          conflicts_with: JSON.stringify(['config2'])
        },
        'config2': {
          config_key: 'config2',
          config_type: 'string'
        }
      };
      
      mockDb.queryOne
        .mockResolvedValueOnce(schemas.config1)
        .mockResolvedValueOnce(schemas.config2);
      
      const configurations = {
        config1: 'value1',
        config2: 'value2' // Conflicts with config1
      };
      
      const result = await validator.validateBatch(configurations);
      
      expect(result.valid).toBe(false);
      expect(result.results.config1.valid).toBe(false);
      expect(result.results.config1.errors).toContain('Conflicts with: config2');
    });
  });

  describe('built-in validators', () => {
    it('should validate positive numbers', () => {
      const rule = validator.validationRules.get('positive_number');
      
      expect(rule.validate(5).valid).toBe(true);
      expect(rule.validate(0).valid).toBe(false);
      expect(rule.validate(-5).valid).toBe(false);
    });

    it('should validate non-negative numbers', () => {
      const rule = validator.validationRules.get('non_negative_number');
      
      expect(rule.validate(5).valid).toBe(true);
      expect(rule.validate(0).valid).toBe(true);
      expect(rule.validate(-1).valid).toBe(false);
    });

    it('should validate port numbers', () => {
      const rule = validator.validationRules.get('valid_port');
      
      expect(rule.validate(80).valid).toBe(true);
      expect(rule.validate(8080).valid).toBe(true);
      expect(rule.validate(65535).valid).toBe(true);
      expect(rule.validate(0).valid).toBe(false);
      expect(rule.validate(65536).valid).toBe(false);
      expect(rule.validate(3.14).valid).toBe(false);
    });

    it('should validate percentages', () => {
      const rule = validator.validationRules.get('valid_percentage');
      
      expect(rule.validate(0).valid).toBe(true);
      expect(rule.validate(50).valid).toBe(true);
      expect(rule.validate(100).valid).toBe(true);
      expect(rule.validate(-1).valid).toBe(false);
      expect(rule.validate(101).valid).toBe(false);
    });

    it('should validate timeouts', () => {
      const rule = validator.validationRules.get('valid_timeout');
      
      expect(rule.validate(0).valid).toBe(true);
      expect(rule.validate(3600).valid).toBe(true);
      expect(rule.validate(86400).valid).toBe(true);
      expect(rule.validate(-1).valid).toBe(false);
      expect(rule.validate(86401).valid).toBe(false);
    });
  });

  describe('environment consistency validation', () => {
    it('should validate environment consistency', async () => {
      const configs = [
        {
          config_key: 'config1',
          base_value: 'value1',
          override_value: null,
          config_type: 'string'
        },
        {
          config_key: 'config2',
          base_value: '42',
          override_value: '50',
          config_type: 'number'
        }
      ];
      
      mockDb.query.mockResolvedValue(configs);
      
      // Mock validation calls
      mockDb.queryOne
        .mockResolvedValueOnce({ config_key: 'config1', config_type: 'string' })
        .mockResolvedValueOnce({ config_key: 'config2', config_type: 'number' });
      
      const result = await validator.validateEnvironmentConsistency('production');
      
      expect(result.valid).toBe(true);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('FROM pf_system_config sc'),
        ['production']
      );
    });
  });

  describe('custom validator registration', () => {
    it('should register custom validator', () => {
      const customValidator = (value) => value.startsWith('PREFIX_');
      
      validator.registerCustomValidator(
        'prefix_validator', 
        customValidator, 
        'Value must start with PREFIX_'
      );
      
      const rule = validator.validationRules.get('prefix_validator');
      expect(rule).toBeDefined();
      expect(rule.validate('PREFIX_test').valid).toBe(true);
      expect(rule.validate('test').valid).toBe(false);
    });

    it('should list all validation rule names', () => {
      const ruleNames = validator.getValidationRuleNames();
      
      expect(ruleNames).toContain('positive_number');
      expect(ruleNames).toContain('non_negative_number');
      expect(ruleNames).toContain('valid_port');
      expect(ruleNames).toContain('valid_percentage');
      expect(ruleNames).toContain('valid_timeout');
    });

    it('should export validation rules', async () => {
      const rules = await validator.exportValidationRules();
      
      expect(rules).toHaveProperty('positive_number');
      expect(rules).toHaveProperty('valid_port');
      expect(rules.positive_number).toHaveProperty('type', 'custom');
      expect(rules.positive_number).toHaveProperty('description');
    });
  });
});