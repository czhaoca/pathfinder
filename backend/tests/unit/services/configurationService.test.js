/**
 * Configuration Service Unit Tests
 * 
 * Comprehensive test suite for the ConfigurationService class:
 * - Configuration CRUD operations
 * - Environment override logic
 * - Feature flag evaluation
 * - Caching behavior
 * - Validation and error handling
 * - Dependency management
 */

const { ConfigurationService } = require('../../../src/services/configurationService');
const { ConfigurationCache } = require('../../../src/services/configurationCache');

// Mock dependencies
const mockDb = {
  query: jest.fn(),
  queryOne: jest.fn(),
  execute: jest.fn(),
  getConnection: jest.fn(),
  beginTransaction: jest.fn(),
  commit: jest.fn(),
  rollback: jest.fn()
};

const mockCache = {
  get: jest.fn(),
  set: jest.fn(),
  invalidate: jest.fn(),
  clear: jest.fn()
};

const mockAuditLogger = {
  log: jest.fn()
};

describe('ConfigurationService', () => {
  let configService;
  let mockConnection;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Setup mock connection
    mockConnection = {
      execute: jest.fn(),
      queryOne: jest.fn(),
      query: jest.fn(),
      close: jest.fn()
    };
    
    mockDb.getConnection.mockResolvedValue(mockConnection);
    
    configService = new ConfigurationService(mockDb, mockCache, mockAuditLogger);
  });

  describe('getValue', () => {
    it('should return cached value when available', async () => {
      const cachedValue = 'cached_value';
      mockCache.get.mockResolvedValue(cachedValue);

      const result = await configService.getValue('test.key', 'development');

      expect(result).toBe(cachedValue);
      expect(mockCache.get).toHaveBeenCalledWith('test.key', 'development', undefined);
      expect(mockDb.queryOne).not.toHaveBeenCalled();
    });

    it('should load from database when not cached', async () => {
      mockCache.get.mockResolvedValue(null);
      
      const baseConfig = {
        config_key: 'test.key',
        config_value: 'base_value',
        config_type: 'string',
        cache_ttl_seconds: 300
      };
      
      mockDb.queryOne.mockResolvedValueOnce(baseConfig);
      mockDb.queryOne.mockResolvedValueOnce(null); // No override

      const result = await configService.getValue('test.key', 'development');

      expect(result).toBe('base_value');
      expect(mockCache.set).toHaveBeenCalledWith(
        'test.key',
        'base_value',
        300,
        'development',
        undefined
      );
    });

    it('should apply environment override when available', async () => {
      mockCache.get.mockResolvedValue(null);
      
      const baseConfig = {
        config_key: 'test.key',
        config_value: 'base_value',
        config_type: 'string',
        cache_ttl_seconds: 300
      };
      
      const override = {
        config_value: 'override_value'
      };
      
      mockDb.queryOne.mockResolvedValueOnce(baseConfig);
      mockDb.queryOne.mockResolvedValueOnce(override);

      const result = await configService.getValue('test.key', 'production');

      expect(result).toBe('override_value');
    });

    it('should parse boolean values correctly', async () => {
      mockCache.get.mockResolvedValue(null);
      
      const baseConfig = {
        config_key: 'test.boolean',
        config_value: 'true',
        config_type: 'boolean',
        cache_ttl_seconds: 300
      };
      
      mockDb.queryOne.mockResolvedValueOnce(baseConfig);
      mockDb.queryOne.mockResolvedValueOnce(null);

      const result = await configService.getValue('test.boolean');

      expect(result).toBe(true);
    });

    it('should parse number values correctly', async () => {
      mockCache.get.mockResolvedValue(null);
      
      const baseConfig = {
        config_key: 'test.number',
        config_value: '42.5',
        config_type: 'number',
        cache_ttl_seconds: 300
      };
      
      mockDb.queryOne.mockResolvedValueOnce(baseConfig);
      mockDb.queryOne.mockResolvedValueOnce(null);

      const result = await configService.getValue('test.number');

      expect(result).toBe(42.5);
    });

    it('should parse JSON values correctly', async () => {
      mockCache.get.mockResolvedValue(null);
      
      const jsonValue = { key: 'value', array: [1, 2, 3] };
      const baseConfig = {
        config_key: 'test.json',
        config_value: JSON.stringify(jsonValue),
        config_type: 'json',
        cache_ttl_seconds: 300
      };
      
      mockDb.queryOne.mockResolvedValueOnce(baseConfig);
      mockDb.queryOne.mockResolvedValueOnce(null);

      const result = await configService.getValue('test.json');

      expect(result).toEqual(jsonValue);
    });

    it('should throw error for non-existent configuration', async () => {
      mockCache.get.mockResolvedValue(null);
      mockDb.queryOne.mockResolvedValue(null);

      await expect(configService.getValue('nonexistent.key'))
        .rejects.toThrow('Configuration key not found: nonexistent.key');
    });

    it('should validate parsed values', async () => {
      mockCache.get.mockResolvedValue(null);
      
      const baseConfig = {
        config_key: 'test.validated',
        config_value: '150',
        config_type: 'number',
        cache_ttl_seconds: 300,
        min_value: 0,
        max_value: 100
      };
      
      mockDb.queryOne.mockResolvedValueOnce(baseConfig);
      mockDb.queryOne.mockResolvedValueOnce(null);

      await expect(configService.getValue('test.validated'))
        .rejects.toThrow('Value 150 is greater than maximum 100');
    });
  });

  describe('setValue', () => {
    beforeEach(() => {
      mockConnection.execute.mockResolvedValue({ rowsAffected: 1 });
    });

    it('should update system configuration successfully', async () => {
      const currentValue = 'old_value';
      const newValue = 'new_value';
      
      // Mock getValue to return current value
      jest.spyOn(configService, 'getValue').mockResolvedValue(currentValue);
      
      const config = {
        config_key: 'test.key',
        config_type: 'string',
        requires_restart: 0
      };
      
      mockConnection.queryOne.mockResolvedValue(config);
      
      // Mock validation
      jest.spyOn(configService, '_validateValue').mockImplementation(() => {});
      jest.spyOn(configService, '_checkDependencies').mockResolvedValue();
      jest.spyOn(configService, '_recordHistory').mockResolvedValue();
      
      mockCache.invalidate.mockResolvedValue();

      const result = await configService.setValue('test.key', newValue, null, 'user123', 'Test update');

      expect(result).toEqual({
        success: true,
        requires_restart: false,
        previous_value: currentValue
      });
      
      expect(mockConnection.execute).toHaveBeenCalledWith('BEGIN');
      expect(mockConnection.execute).toHaveBeenCalledWith('COMMIT');
      expect(mockCache.invalidate).toHaveBeenCalledWith('test.key');
    });

    it('should update environment configuration when environment specified', async () => {
      jest.spyOn(configService, 'getValue').mockResolvedValue('old_value');
      
      const config = {
        config_key: 'test.key',
        config_type: 'string',
        requires_restart: 0
      };
      
      mockConnection.queryOne.mockResolvedValueOnce(config);
      mockConnection.queryOne.mockResolvedValueOnce(null); // No existing override
      
      jest.spyOn(configService, '_validateValue').mockImplementation(() => {});
      jest.spyOn(configService, '_checkDependencies').mockResolvedValue();
      jest.spyOn(configService, '_recordHistory').mockResolvedValue();
      
      mockCache.invalidate.mockResolvedValue();

      await configService.setValue('test.key', 'new_value', 'production', 'user123', 'Prod update');

      // Should insert new environment override
      expect(mockConnection.execute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO pf_environment_config'),
        expect.arrayContaining(['production', 'test.key', '"new_value"', 'user123', 'Prod update'])
      );
    });

    it('should rollback on validation error', async () => {
      jest.spyOn(configService, 'getValue').mockResolvedValue('old_value');
      
      const config = {
        config_key: 'test.key',
        config_type: 'string'
      };
      
      mockConnection.queryOne.mockResolvedValue(config);
      
      // Mock validation to fail
      jest.spyOn(configService, '_validateValue').mockImplementation(() => {
        throw new Error('Validation failed');
      });

      await expect(configService.setValue('test.key', 'invalid_value', null, 'user123'))
        .rejects.toThrow('Validation failed');

      expect(mockConnection.execute).toHaveBeenCalledWith('ROLLBACK');
    });

    it('should detect restart requirement', async () => {
      jest.spyOn(configService, 'getValue').mockResolvedValue('old_value');
      
      const config = {
        config_key: 'test.key',
        config_type: 'string',
        requires_restart: 1
      };
      
      mockConnection.queryOne.mockResolvedValue(config);
      
      jest.spyOn(configService, '_validateValue').mockImplementation(() => {});
      jest.spyOn(configService, '_checkDependencies').mockResolvedValue();
      jest.spyOn(configService, '_recordHistory').mockResolvedValue();
      jest.spyOn(configService, '_notifyRestartRequired').mockResolvedValue();
      
      mockCache.invalidate.mockResolvedValue();

      const result = await configService.setValue('test.key', 'new_value', null, 'user123');

      expect(result.requires_restart).toBe(true);
      expect(configService._notifyRestartRequired).toHaveBeenCalledWith('test.key');
    });
  });

  describe('isFeatureEnabled', () => {
    it('should return false for non-existent feature flag', async () => {
      mockDb.queryOne.mockResolvedValue(null);

      const result = await configService.isFeatureEnabled('nonexistent.feature');

      expect(result).toBe(false);
    });

    it('should return false for disabled feature flag', async () => {
      const flag = {
        feature_key: 'test.feature',
        is_enabled: 0,
        cache_ttl_seconds: 60
      };
      
      mockDb.queryOne.mockResolvedValue(flag);

      const result = await configService.isFeatureEnabled('test.feature');

      expect(result).toBe(false);
    });

    it('should return true for fully enabled feature flag', async () => {
      const flag = {
        feature_key: 'test.feature',
        is_enabled: 1,
        rollout_percentage: 100,
        cache_ttl_seconds: 60
      };
      
      mockDb.queryOne.mockResolvedValue(flag);

      const result = await configService.isFeatureEnabled('test.feature', {
        userId: 'user123'
      });

      expect(result).toBe(true);
    });

    it('should respect date range restrictions', async () => {
      const futureDate = new Date(Date.now() + 86400000); // Tomorrow
      
      const flag = {
        feature_key: 'test.feature',
        is_enabled: 1,
        start_date: futureDate,
        cache_ttl_seconds: 60
      };
      
      mockDb.queryOne.mockResolvedValue(flag);

      const result = await configService.isFeatureEnabled('test.feature');

      expect(result).toBe(false);
    });

    it('should check environment targeting', async () => {
      const flag = {
        feature_key: 'test.feature',
        is_enabled: 1,
        enabled_environments: JSON.stringify(['production']),
        cache_ttl_seconds: 60
      };
      
      mockDb.queryOne.mockResolvedValue(flag);

      const result = await configService.isFeatureEnabled('test.feature', {
        environment: 'development'
      });

      expect(result).toBe(false);
    });

    it('should check user list targeting', async () => {
      const flag = {
        feature_key: 'test.feature',
        is_enabled: 1,
        enabled_for_users: JSON.stringify(['user456', 'user789']),
        cache_ttl_seconds: 60
      };
      
      mockDb.queryOne.mockResolvedValue(flag);

      const result = await configService.isFeatureEnabled('test.feature', {
        userId: 'user456'
      });

      expect(result).toBe(true);
    });

    it('should check role targeting', async () => {
      const flag = {
        feature_key: 'test.feature',
        is_enabled: 1,
        enabled_for_roles: JSON.stringify(['admin', 'moderator']),
        cache_ttl_seconds: 60
      };
      
      mockDb.queryOne.mockResolvedValue(flag);

      const result = await configService.isFeatureEnabled('test.feature', {
        userId: 'user123',
        userRoles: ['admin', 'user']
      });

      expect(result).toBe(true);
    });

    it('should handle percentage rollout consistently', async () => {
      const flag = {
        feature_key: 'test.feature',
        is_enabled: 1,
        rollout_percentage: 50,
        cache_ttl_seconds: 60
      };
      
      mockDb.queryOne.mockResolvedValue(flag);

      // Test same user multiple times - should get consistent result
      const userId = 'consistent_user';
      const result1 = await configService.isFeatureEnabled('test.feature', { userId });
      const result2 = await configService.isFeatureEnabled('test.feature', { userId });
      const result3 = await configService.isFeatureEnabled('test.feature', { userId });

      expect(result1).toBe(result2);
      expect(result2).toBe(result3);
    });

    it('should use cache for repeated evaluations', async () => {
      const flag = {
        feature_key: 'test.feature',
        is_enabled: 1,
        cache_ttl_seconds: 60
      };
      
      mockDb.queryOne.mockResolvedValue(flag);

      const context = { userId: 'user123' };
      
      // First call
      await configService.isFeatureEnabled('test.feature', context);
      
      // Second call should use cache
      await configService.isFeatureEnabled('test.feature', context);

      // Database should only be queried once
      expect(mockDb.queryOne).toHaveBeenCalledTimes(1);
    });
  });

  describe('rollback', () => {
    it('should rollback to previous value', async () => {
      const historyEntry = {
        id: 'history123',
        old_value: '"previous_value"',
        change_timestamp: '2024-01-01T12:00:00Z'
      };
      
      mockConnection.queryOne.mockResolvedValue(historyEntry);
      
      // Mock setValue to handle rollback
      jest.spyOn(configService, 'setValue').mockResolvedValue({
        success: true,
        requires_restart: false
      });

      const result = await configService.rollback('test.key', null, 1, 'user123');

      expect(result).toEqual({
        success: true,
        rolled_back_to: historyEntry.change_timestamp,
        previous_value: 'previous_value'
      });
      
      expect(configService.setValue).toHaveBeenCalledWith(
        'test.key',
        'previous_value',
        null,
        'user123',
        'Rollback to 2024-01-01T12:00:00Z'
      );
    });

    it('should throw error when no rollback history available', async () => {
      mockConnection.queryOne.mockResolvedValue(null);

      await expect(configService.rollback('test.key', null, 1, 'user123'))
        .rejects.toThrow('No rollback history available');
    });

    it('should mark history entry as rolled back', async () => {
      const historyEntry = {
        id: 'history123',
        old_value: '"previous_value"',
        change_timestamp: '2024-01-01T12:00:00Z'
      };
      
      mockConnection.queryOne.mockResolvedValue(historyEntry);
      jest.spyOn(configService, 'setValue').mockResolvedValue({ success: true });

      await configService.rollback('test.key', null, 1, 'user123');

      expect(mockConnection.execute).toHaveBeenCalledWith(
        'UPDATE pf_config_history SET rollback_performed = 1, rollback_at = CURRENT_TIMESTAMP, rollback_by = ? WHERE id = ?',
        ['user123', 'history123']
      );
    });
  });

  describe('_validateValue', () => {
    it('should validate required fields', () => {
      const config = {
        config_key: 'test.key',
        is_required: 1
      };

      expect(() => configService._validateValue(null, config))
        .toThrow('Configuration test.key is required');
      
      expect(() => configService._validateValue('', config))
        .toThrow('Configuration test.key is required');
    });

    it('should validate number ranges', () => {
      const config = {
        config_key: 'test.number',
        config_type: 'number',
        min_value: 0,
        max_value: 100
      };

      expect(() => configService._validateValue(-1, config))
        .toThrow('Value -1 is less than minimum 0');
      
      expect(() => configService._validateValue(101, config))
        .toThrow('Value 101 is greater than maximum 100');
      
      // Valid value should not throw
      expect(() => configService._validateValue(50, config)).not.toThrow();
    });

    it('should validate allowed values', () => {
      const config = {
        config_key: 'test.enum',
        allowed_values: JSON.stringify(['option1', 'option2', 'option3'])
      };

      expect(() => configService._validateValue('invalid', config))
        .toThrow('Value invalid is not in allowed values: option1, option2, option3');
      
      // Valid value should not throw
      expect(() => configService._validateValue('option2', config)).not.toThrow();
    });

    it('should validate regex patterns', () => {
      const config = {
        config_key: 'test.pattern',
        regex_pattern: '^[A-Z][a-z]+$'
      };

      expect(() => configService._validateValue('invalid123', config))
        .toThrow('Value invalid123 does not match pattern ^[A-Z][a-z]+$');
      
      // Valid value should not throw
      expect(() => configService._validateValue('Valid', config)).not.toThrow();
    });
  });

  describe('error handling', () => {
    it('should handle database connection errors gracefully', async () => {
      mockDb.queryOne.mockRejectedValue(new Error('Database connection failed'));

      await expect(configService.getValue('test.key'))
        .rejects.toThrow('Database connection failed');
    });

    it('should handle cache errors gracefully', async () => {
      mockCache.get.mockRejectedValue(new Error('Cache error'));
      
      const baseConfig = {
        config_key: 'test.key',
        config_value: 'value',
        config_type: 'string',
        cache_ttl_seconds: 300
      };
      
      mockDb.queryOne.mockResolvedValueOnce(baseConfig);
      mockDb.queryOne.mockResolvedValueOnce(null);

      // Should still work despite cache error
      const result = await configService.getValue('test.key');
      expect(result).toBe('value');
    });

    it('should handle JSON parsing errors', () => {
      const config = {
        config_key: 'test.json',
        config_type: 'json'
      };

      expect(() => configService._parseValue('invalid json', 'json'))
        .toThrow('Invalid JSON value: invalid json');
    });
  });

  describe('audit logging integration', () => {
    it('should log configuration changes to audit logger', async () => {
      jest.spyOn(configService, 'getValue').mockResolvedValue('old_value');
      
      const config = {
        config_key: 'test.key',
        config_type: 'string',
        requires_restart: 0
      };
      
      mockConnection.queryOne.mockResolvedValue(config);
      jest.spyOn(configService, '_validateValue').mockImplementation(() => {});
      jest.spyOn(configService, '_checkDependencies').mockResolvedValue();
      jest.spyOn(configService, '_recordHistory').mockResolvedValue();
      mockCache.invalidate.mockResolvedValue();

      await configService.setValue('test.key', 'new_value', 'production', 'user123', 'Test');

      expect(mockAuditLogger.log).toHaveBeenCalledWith({
        action: 'config_updated',
        config_key: 'test.key',
        environment: 'production',
        old_value: 'old_value',
        new_value: 'new_value',
        user_id: 'user123'
      });
    });
  });
});