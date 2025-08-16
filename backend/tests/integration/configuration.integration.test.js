/**
 * Configuration Management Integration Tests
 * 
 * End-to-end integration tests for the configuration management system:
 * - API endpoint testing
 * - Database operations
 * - Cache behavior
 * - Feature flag evaluation flow
 * - Template application
 * - Audit logging
 */

const request = require('supertest');
const app = require('../../src/api/app');
const { setupTestDatabase, cleanupTestDatabase } = require('../setup');

describe('Configuration Management Integration', () => {
  let authToken;
  let testUser;
  let adminUser;

  beforeAll(async () => {
    await setupTestDatabase();
    
    // Create test users
    testUser = await createTestUser('testuser@example.com', ['user']);
    adminUser = await createTestUser('admin@example.com', ['admin', 'site_admin']);
    
    // Get auth tokens
    authToken = await getAuthToken(testUser.email, 'password123');
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  describe('Configuration CRUD Operations', () => {
    let configKey = 'test.integration.config';

    afterEach(async () => {
      // Cleanup test configuration
      try {
        await request(app)
          .delete(`/api/config/${configKey}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ reason: 'Test cleanup' });
      } catch (error) {
        // Ignore cleanup errors
      }
    });

    it('should create a new configuration', async () => {
      const configData = {
        config_key: configKey,
        config_value: 'test_value',
        config_type: 'string',
        category: 'test',
        display_name: 'Test Configuration',
        description: 'A configuration for integration testing',
        is_required: false,
        cache_ttl_seconds: 300
      };

      const response = await request(app)
        .post('/api/config')
        .set('Authorization', `Bearer ${authToken}`)
        .send(configData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.config_key).toBe(configKey);
    });

    it('should retrieve configuration value', async () => {
      // First create the configuration
      await createTestConfiguration(configKey, 'initial_value', 'string');

      const response = await request(app)
        .get(`/api/config/${configKey}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.key).toBe(configKey);
      expect(response.body.data.value).toBe('initial_value');
    });

    it('should update configuration value', async () => {
      // Create initial configuration
      await createTestConfiguration(configKey, 'initial_value', 'string');

      const updateData = {
        value: 'updated_value',
        reason: 'Integration test update'
      };

      const response = await request(app)
        .put(`/api/config/${configKey}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.value).toBe('updated_value');

      // Verify the update
      const getResponse = await request(app)
        .get(`/api/config/${configKey}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(getResponse.body.data.value).toBe('updated_value');
    });

    it('should apply environment override', async () => {
      // Create base configuration
      await createTestConfiguration(configKey, 'base_value', 'string');

      // Apply environment override
      const overrideData = {
        value: 'production_value',
        environment: 'production',
        reason: 'Production-specific configuration'
      };

      await request(app)
        .put(`/api/config/${configKey}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(overrideData)
        .expect(200);

      // Check base environment still has base value
      const baseResponse = await request(app)
        .get(`/api/config/${configKey}`)
        .set('Authorization', `Bearer ${authToken}`)
        .query({ environment: 'development' })
        .expect(200);

      expect(baseResponse.body.data.value).toBe('base_value');

      // Check production environment has override value
      const prodResponse = await request(app)
        .get(`/api/config/${configKey}`)
        .set('Authorization', `Bearer ${authToken}`)
        .query({ environment: 'production' })
        .expect(200);

      expect(prodResponse.body.data.value).toBe('production_value');
    });

    it('should validate configuration values', async () => {
      // Create configuration with validation rules
      const configData = {
        config_key: configKey,
        config_value: '50',
        config_type: 'number',
        category: 'test',
        min_value: 0,
        max_value: 100
      };

      await request(app)
        .post('/api/config')
        .set('Authorization', `Bearer ${authToken}`)
        .send(configData)
        .expect(201);

      // Try to update with invalid value
      const invalidUpdate = {
        value: 150, // Exceeds max_value
        reason: 'Testing validation'
      };

      await request(app)
        .put(`/api/config/${configKey}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidUpdate)
        .expect(400);
    });

    it('should rollback configuration changes', async () => {
      // Create initial configuration
      await createTestConfiguration(configKey, 'original_value', 'string');

      // Update configuration
      await request(app)
        .put(`/api/config/${configKey}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ value: 'updated_value', reason: 'First update' })
        .expect(200);

      // Update again
      await request(app)
        .put(`/api/config/${configKey}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ value: 'second_update', reason: 'Second update' })
        .expect(200);

      // Rollback one step
      const rollbackData = {
        steps: 1,
        reason: 'Rolling back to previous value'
      };

      const rollbackResponse = await request(app)
        .post(`/api/config/${configKey}/rollback`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(rollbackData)
        .expect(200);

      expect(rollbackResponse.body.success).toBe(true);

      // Verify rollback
      const getResponse = await request(app)
        .get(`/api/config/${configKey}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(getResponse.body.data.value).toBe('updated_value');
    });

    it('should track configuration history', async () => {
      // Create and update configuration multiple times
      await createTestConfiguration(configKey, 'value1', 'string');
      
      await request(app)
        .put(`/api/config/${configKey}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ value: 'value2', reason: 'Update 1' })
        .expect(200);

      await request(app)
        .put(`/api/config/${configKey}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ value: 'value3', reason: 'Update 2' })
        .expect(200);

      // Get history
      const historyResponse = await request(app)
        .get(`/api/config/${configKey}/history`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(historyResponse.body.success).toBe(true);
      expect(historyResponse.body.data.history.length).toBeGreaterThan(0);
      
      const history = historyResponse.body.data.history;
      expect(history[0].new_value).toContain('value3'); // Most recent change
      expect(history[0].change_reason).toBe('Update 2');
    });
  });

  describe('Feature Flag Management', () => {
    let featureKey = 'test.integration.feature';

    afterEach(async () => {
      // Cleanup test feature flag
      try {
        await request(app)
          .delete(`/api/config/features/${featureKey}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ reason: 'Test cleanup' });
      } catch (error) {
        // Ignore cleanup errors
      }
    });

    it('should create and manage feature flags', async () => {
      // Create feature flag
      const flagData = {
        feature_key: featureKey,
        feature_name: 'Test Integration Feature',
        description: 'A feature flag for integration testing',
        feature_category: 'experimental',
        feature_type: 'release'
      };

      await request(app)
        .post('/api/config/features')
        .set('Authorization', `Bearer ${authToken}`)
        .send(flagData)
        .expect(201);

      // Check feature flag (should be disabled by default)
      const checkResponse = await request(app)
        .get(`/api/config/features/${featureKey}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(checkResponse.body.data.enabled).toBe(false);

      // Enable feature flag
      await request(app)
        .post(`/api/config/features/${featureKey}/enable`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ rollout_percentage: 100, reason: 'Full rollout' })
        .expect(200);

      // Check feature flag again
      const enabledResponse = await request(app)
        .get(`/api/config/features/${featureKey}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(enabledResponse.body.data.enabled).toBe(true);
    });

    it('should handle percentage rollout', async () => {
      // Create and enable feature with 50% rollout
      await createTestFeatureFlag(featureKey, {
        is_enabled: true,
        rollout_percentage: 50
      });

      // Test multiple users - results should be consistent for same user
      const user1Results = [];
      const user2Results = [];
      
      for (let i = 0; i < 3; i++) {
        const response1 = await request(app)
          .get(`/api/config/features/${featureKey}`)
          .set('Authorization', `Bearer ${authToken}`)
          .set('X-User-ID', 'consistent_user_1')
          .expect(200);
        
        const response2 = await request(app)
          .get(`/api/config/features/${featureKey}`)
          .set('Authorization', `Bearer ${authToken}`)
          .set('X-User-ID', 'consistent_user_2')
          .expect(200);
        
        user1Results.push(response1.body.data.enabled);
        user2Results.push(response2.body.data.enabled);
      }

      // Results should be consistent for each user
      expect(user1Results.every(r => r === user1Results[0])).toBe(true);
      expect(user2Results.every(r => r === user2Results[0])).toBe(true);
    });

    it('should handle environment targeting', async () => {
      // Create feature flag enabled only for production
      await createTestFeatureFlag(featureKey, {
        is_enabled: true,
        enabled_environments: ['production']
      });

      // Check in development environment
      const devResponse = await request(app)
        .get(`/api/config/features/${featureKey}`)
        .set('Authorization', `Bearer ${authToken}`)
        .query({ environment: 'development' })
        .expect(200);

      expect(devResponse.body.data.enabled).toBe(false);

      // Check in production environment
      const prodResponse = await request(app)
        .get(`/api/config/features/${featureKey}`)
        .set('Authorization', `Bearer ${authToken}`)
        .query({ environment: 'production' })
        .expect(200);

      expect(prodResponse.body.data.enabled).toBe(true);
    });

    it('should disable feature flag', async () => {
      // Create and enable feature flag
      await createTestFeatureFlag(featureKey, { is_enabled: true });

      // Disable feature flag
      await request(app)
        .post(`/api/config/features/${featureKey}/disable`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ reason: 'Disabling for testing' })
        .expect(200);

      // Verify it's disabled
      const response = await request(app)
        .get(`/api/config/features/${featureKey}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.enabled).toBe(false);
    });
  });

  describe('Rate Limiting Configuration', () => {
    let limitKey = 'test.integration.limit';

    afterEach(async () => {
      // Cleanup test rate limit
      try {
        await request(app)
          .delete(`/api/config/rate-limits/${limitKey}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ reason: 'Test cleanup' });
      } catch (error) {
        // Ignore cleanup errors
      }
    });

    it('should create and manage rate limits', async () => {
      // Create rate limit
      const limitData = {
        limit_key: limitKey,
        limit_name: 'Test Integration Rate Limit',
        description: 'A rate limit for integration testing',
        max_requests: 100,
        time_window_seconds: 3600,
        scope_type: 'user',
        action_on_limit: 'block'
      };

      await request(app)
        .post('/api/config/rate-limits')
        .set('Authorization', `Bearer ${authToken}`)
        .send(limitData)
        .expect(201);

      // Retrieve rate limit
      const response = await request(app)
        .get(`/api/config/rate-limits/${limitKey}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.max_requests).toBe(100);
      expect(response.body.data.scope_type).toBe('user');
    });

    it('should update rate limit configuration', async () => {
      // Create initial rate limit
      await createTestRateLimit(limitKey, {
        max_requests: 100,
        time_window_seconds: 3600
      });

      // Update rate limit
      const updateData = {
        max_requests: 200,
        time_window_seconds: 1800,
        description: 'Updated rate limit'
      };

      await request(app)
        .put(`/api/config/rate-limits/${limitKey}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      // Verify update
      const response = await request(app)
        .get(`/api/config/rate-limits/${limitKey}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.max_requests).toBe(200);
      expect(response.body.data.time_window_seconds).toBe(1800);
    });
  });

  describe('Configuration Templates', () => {
    let templateName = 'test-integration-template';

    afterEach(async () => {
      // Cleanup test template
      try {
        await request(app)
          .delete(`/api/config/templates/${templateName}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ reason: 'Test cleanup' });
      } catch (error) {
        // Ignore cleanup errors
      }
    });

    it('should create and apply configuration template', async () => {
      // Create template
      const templateData = {
        template_name: templateName,
        template_type: 'development',
        description: 'Integration test template',
        config_values: {
          'test.template.config1': 'value1',
          'test.template.config2': 42,
          'test.template.config3': true
        },
        suitable_environments: ['development', 'test']
      };

      await request(app)
        .post('/api/config/templates')
        .set('Authorization', `Bearer ${authToken}`)
        .send(templateData)
        .expect(201);

      // Preview template application
      const previewResponse = await request(app)
        .post(`/api/config/templates/${templateName}/apply`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          environment: 'development',
          dry_run: true,
          reason: 'Testing template preview'
        })
        .expect(200);

      expect(previewResponse.body.data.dry_run).toBe(true);
      expect(previewResponse.body.data.results.configurations.length).toBe(3);

      // Actually apply template
      const applyResponse = await request(app)
        .post(`/api/config/templates/${templateName}/apply`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          environment: 'development',
          reason: 'Applying integration test template'
        })
        .expect(200);

      expect(applyResponse.body.data.dry_run).toBe(false);
      expect(applyResponse.body.data.summary.successful).toBeGreaterThan(0);
    });

    it('should handle template application errors gracefully', async () => {
      // Create template with invalid configuration
      const templateData = {
        template_name: templateName,
        template_type: 'test',
        description: 'Template with errors',
        config_values: {
          'nonexistent.config': 'value'
        }
      };

      await request(app)
        .post('/api/config/templates')
        .set('Authorization', `Bearer ${authToken}`)
        .send(templateData)
        .expect(201);

      // Apply template - should handle errors gracefully
      const response = await request(app)
        .post(`/api/config/templates/${templateName}/apply`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          environment: 'development',
          reason: 'Testing error handling'
        })
        .expect(200);

      expect(response.body.data.summary.failed).toBeGreaterThan(0);
    });
  });

  describe('Bulk Operations', () => {
    const configKeys = [
      'test.bulk.config1',
      'test.bulk.config2',
      'test.bulk.config3'
    ];

    beforeEach(async () => {
      // Create test configurations
      for (const key of configKeys) {
        await createTestConfiguration(key, 'initial_value', 'string');
      }
    });

    afterEach(async () => {
      // Cleanup test configurations
      for (const key of configKeys) {
        try {
          await request(app)
            .delete(`/api/config/${key}`)
            .set('Authorization', `Bearer ${authToken}`)
            .send({ reason: 'Test cleanup' });
        } catch (error) {
          // Ignore cleanup errors
        }
      }
    });

    it('should perform bulk configuration updates', async () => {
      const bulkUpdateData = {
        configurations: [
          { key: 'test.bulk.config1', value: 'bulk_value1' },
          { key: 'test.bulk.config2', value: 'bulk_value2' },
          { key: 'test.bulk.config3', value: 'bulk_value3' }
        ],
        environment: 'development',
        reason: 'Bulk update integration test'
      };

      const response = await request(app)
        .post('/api/config/bulk-update')
        .set('Authorization', `Bearer ${authToken}`)
        .send(bulkUpdateData)
        .expect(200);

      expect(response.body.data.summary.successful).toBe(3);
      expect(response.body.data.summary.failed).toBe(0);

      // Verify updates
      for (let i = 0; i < configKeys.length; i++) {
        const getResponse = await request(app)
          .get(`/api/config/${configKeys[i]}`)
          .set('Authorization', `Bearer ${authToken}`)
          .query({ environment: 'development' })
          .expect(200);

        expect(getResponse.body.data.value).toBe(`bulk_value${i + 1}`);
      }
    });

    it('should validate bulk configuration updates', async () => {
      const validateData = {
        configurations: [
          { key: 'test.bulk.config1', value: 'valid_value' },
          { key: 'test.bulk.config2', value: 'another_valid_value' }
        ]
      };

      const response = await request(app)
        .post('/api/config/validate')
        .set('Authorization', `Bearer ${authToken}`)
        .send(validateData)
        .expect(200);

      expect(response.body.data.all_valid).toBe(true);
      expect(response.body.data.results.length).toBe(2);
    });
  });

  describe('System Health and Statistics', () => {
    it('should retrieve system health status', async () => {
      const response = await request(app)
        .get('/api/config/health')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.status).toBeDefined();
      expect(response.body.data.database).toBeDefined();
      expect(response.body.data.cache).toBeDefined();
      expect(response.body.data.timestamp).toBeDefined();
    });

    it('should retrieve configuration statistics', async () => {
      const response = await request(app)
        .get('/api/config/stats')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ environment: 'development' })
        .expect(200);

      expect(response.body.data.total_configurations).toBeGreaterThanOrEqual(0);
      expect(response.body.data.active_configurations).toBeGreaterThanOrEqual(0);
      expect(response.body.data.categories).toBeDefined();
    });
  });

  describe('Audit Trail', () => {
    it('should record and retrieve audit trail', async () => {
      const configKey = 'test.audit.config';
      
      // Create configuration
      await createTestConfiguration(configKey, 'initial_value', 'string');
      
      // Update configuration
      await request(app)
        .put(`/api/config/${configKey}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ 
          value: 'updated_value', 
          reason: 'Audit trail test update' 
        })
        .expect(200);

      // Get audit trail
      const auditResponse = await request(app)
        .get('/api/config/audit')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ 
          resource_id: configKey,
          limit: 10
        })
        .expect(200);

      expect(auditResponse.body.data.length).toBeGreaterThan(0);
      
      const auditEntry = auditResponse.body.data[0];
      expect(auditEntry.config_key).toBe(configKey);
      expect(auditEntry.action).toBe('update');
      expect(auditEntry.change_reason).toBe('Audit trail test update');

      // Cleanup
      await request(app)
        .delete(`/api/config/${configKey}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ reason: 'Test cleanup' });
    });

    it('should export audit trail', async () => {
      const response = await request(app)
        .get('/api/config/audit/export')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ 
          format: 'json',
          limit: 5
        })
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('Access Control', () => {
    let userToken;

    beforeAll(async () => {
      const regularUser = await createTestUser('regular@example.com', ['user']);
      userToken = await getAuthToken(regularUser.email, 'password123');
    });

    it('should deny configuration access to non-admin users', async () => {
      await request(app)
        .get('/api/config')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });

    it('should allow configuration read access to admin users', async () => {
      await request(app)
        .get('/api/config')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
    });

    it('should require authentication for all endpoints', async () => {
      await request(app)
        .get('/api/config')
        .expect(401);
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection errors gracefully', async () => {
      // This would require mocking database failures
      // Implementation depends on your test infrastructure
    });

    it('should handle cache failures gracefully', async () => {
      // This would require mocking cache failures
      // The system should continue to work even if cache is unavailable
    });

    it('should validate input data', async () => {
      // Test invalid JSON input
      await request(app)
        .post('/api/config')
        .set('Authorization', `Bearer ${authToken}`)
        .send('invalid json')
        .expect(400);

      // Test missing required fields
      await request(app)
        .post('/api/config')
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400);
    });
  });

  // Helper functions
  async function createTestUser(email, roles) {
    // Implementation depends on your user creation logic
    return {
      id: 'test-user-id',
      email,
      roles
    };
  }

  async function getAuthToken(email, password) {
    // Implementation depends on your auth system
    return 'test-auth-token';
  }

  async function createTestConfiguration(key, value, type) {
    const configData = {
      config_key: key,
      config_value: value,
      config_type: type,
      category: 'test',
      display_name: `Test ${key}`,
      description: `Test configuration ${key}`
    };

    await request(app)
      .post('/api/config')
      .set('Authorization', `Bearer ${authToken}`)
      .send(configData);
  }

  async function createTestFeatureFlag(key, options = {}) {
    const flagData = {
      feature_key: key,
      feature_name: `Test Feature ${key}`,
      description: `Test feature flag ${key}`,
      feature_category: 'experimental',
      feature_type: 'release',
      ...options
    };

    await request(app)
      .post('/api/config/features')
      .set('Authorization', `Bearer ${authToken}`)
      .send(flagData);

    if (options.is_enabled) {
      await request(app)
        .post(`/api/config/features/${key}/enable`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          rollout_percentage: options.rollout_percentage || 100,
          reason: 'Test setup'
        });
    }
  }

  async function createTestRateLimit(key, options = {}) {
    const limitData = {
      limit_key: key,
      limit_name: `Test Rate Limit ${key}`,
      description: `Test rate limit ${key}`,
      max_requests: 100,
      time_window_seconds: 3600,
      scope_type: 'global',
      action_on_limit: 'block',
      ...options
    };

    await request(app)
      .post('/api/config/rate-limits')
      .set('Authorization', `Bearer ${authToken}`)
      .send(limitData);
  }
});