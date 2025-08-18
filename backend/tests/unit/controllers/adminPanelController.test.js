const adminPanelController = require('../../../src/api/controllers/adminPanelController');

// Mock dependencies
jest.mock('../../../src/services/adminPanelService');
jest.mock('../../../src/services/featureFlagService');
jest.mock('../../../src/services/configurationService');
jest.mock('../../../src/services/invitationService');
jest.mock('../../../src/services/auditService');
jest.mock('../../../src/services/cacheService');

const AdminPanelService = require('../../../src/services/adminPanelService');
const FeatureFlagService = require('../../../src/services/featureFlagService');
const ConfigurationService = require('../../../src/services/configurationService');
const InvitationService = require('../../../src/services/invitationService');
const AuditService = require('../../../src/services/auditService');
const CacheService = require('../../../src/services/cacheService');

describe('AdminPanelController', () => {
  let req, res;
  let adminPanelService, featureFlagService, configurationService, invitationService, auditService, cacheService;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Create service instances
    adminPanelService = new AdminPanelService();
    featureFlagService = new FeatureFlagService();
    configurationService = new ConfigurationService();
    invitationService = new InvitationService();
    auditService = new AuditService();
    cacheService = new CacheService();

    // Setup request and response objects
    req = {
      user: {
        id: 'admin-user-id',
        username: 'admin',
        role: 'site_admin'
      },
      query: {},
      params: {},
      body: {},
      ip: '127.0.0.1'
    };

    res = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
      send: jest.fn()
    };
  });

  describe('Dashboard', () => {
    describe('GET /admin/dashboard', () => {
      it('should return comprehensive dashboard data', async () => {
        const mockDashboardData = {
          systemStats: {
            uptime: 86400,
            memory: { used: 1024, total: 2048, percentage: 50 },
            cpu: { user: 20, system: 10 },
            database: { connections: 5, responseTime: 15 },
            cache: { hits: 100, misses: 10, hitRate: 90.9 },
            storage: { used: 50, total: 100, percentage: 50 }
          },
          userStats: {
            total: 1000,
            active: 850,
            new: { today: 10, week: 50, month: 150 },
            byStatus: { active: 850, inactive: 100, suspended: 50 },
            byRole: { user: 900, admin: 50, moderator: 50 }
          },
          recentActivity: [
            { id: '1', action: 'login', user: 'user1', timestamp: new Date() },
            { id: '2', action: 'profile_update', user: 'user2', timestamp: new Date() }
          ],
          alerts: [
            { id: '1', severity: 'warning', message: 'High memory usage', timestamp: new Date() }
          ],
          jobStatus: {
            running: 2,
            queued: 5,
            failed: 1,
            completed: 100
          },
          serviceHealth: {
            database: { status: 'healthy', responseTime: 15 },
            redis: { status: 'healthy', responseTime: 2 },
            mcp_server: { status: 'healthy', responseTime: 30 },
            email: { status: 'healthy', responseTime: 100 },
            storage: { status: 'healthy', responseTime: 50 }
          }
        };

        adminPanelService.getDashboardData = jest.fn().mockResolvedValue(mockDashboardData);

        await adminPanelController.getDashboard(req, res);

        expect(adminPanelService.getDashboardData).toHaveBeenCalled();
        expect(res.json).toHaveBeenCalledWith({
          success: true,
          data: mockDashboardData
        });
      });

      it('should handle errors gracefully', async () => {
        adminPanelService.getDashboardData = jest.fn().mockRejectedValue(new Error('Database error'));

        await adminPanelController.getDashboard(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          error: 'Failed to load dashboard data'
        });
      });
    });
  });

  describe('User Management', () => {
    describe('GET /admin/users', () => {
      it('should return paginated users with filters', async () => {
        req.query = {
          page: '1',
          limit: '20',
          search: 'john',
          status: 'active',
          role: 'user'
        };

        const mockUsers = {
          users: [
            { id: '1', username: 'john.doe', email: 'john@example.com', status: 'active', role: 'user' },
            { id: '2', username: 'john.smith', email: 'johns@example.com', status: 'active', role: 'user' }
          ],
          total: 2,
          page: 1,
          limit: 20,
          totalPages: 1
        };

        adminPanelService.getUsers = jest.fn().mockResolvedValue(mockUsers);

        await adminPanelController.getUsers(req, res);

        expect(adminPanelService.getUsers).toHaveBeenCalledWith({
          page: 1,
          limit: 20,
          search: 'john',
          status: 'active',
          role: 'user'
        });
        expect(res.json).toHaveBeenCalledWith({
          success: true,
          data: mockUsers
        });
      });

      it('should support bulk operations on users', async () => {
        req.body = {
          userIds: ['1', '2', '3'],
          operation: 'suspend',
          reason: 'Terms of service violation'
        };

        const mockResult = {
          processed: 3,
          successful: 3,
          failed: 0,
          details: []
        };

        adminPanelService.bulkUserOperation = jest.fn().mockResolvedValue(mockResult);

        await adminPanelController.bulkUserOperation(req, res);

        expect(adminPanelService.bulkUserOperation).toHaveBeenCalledWith(
          ['1', '2', '3'],
          'suspend',
          'Terms of service violation',
          'admin-user-id'
        );
        expect(res.json).toHaveBeenCalledWith({
          success: true,
          data: mockResult
        });
      });
    });

    describe('POST /admin/users/:userId/impersonate', () => {
      it('should create impersonation token', async () => {
        req.params.userId = 'target-user-id';

        const mockToken = {
          token: 'impersonation-token-xyz',
          expiresAt: new Date(Date.now() + 3600000),
          targetUser: {
            id: 'target-user-id',
            username: 'targetuser',
            email: 'target@example.com'
          }
        };

        adminPanelService.createImpersonationToken = jest.fn().mockResolvedValue(mockToken);

        await adminPanelController.impersonateUser(req, res);

        expect(adminPanelService.createImpersonationToken).toHaveBeenCalledWith(
          'target-user-id',
          'admin-user-id'
        );
        expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({
          action: 'USER_IMPERSONATION_START',
          userId: 'admin-user-id',
          targetId: 'target-user-id'
        }));
        expect(res.json).toHaveBeenCalledWith({
          success: true,
          data: mockToken
        });
      });

      it('should validate impersonation permissions', async () => {
        req.params.userId = 'another-admin-id';
        
        adminPanelService.createImpersonationToken = jest.fn()
          .mockRejectedValue(new Error('Cannot impersonate other admins'));

        await adminPanelController.impersonateUser(req, res);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          error: 'Cannot impersonate other admins'
        });
      });
    });

    describe('GET /admin/users/search', () => {
      it('should support advanced user search', async () => {
        req.query = {
          email: 'example.com',
          createdAfter: '2024-01-01',
          createdBefore: '2024-12-31',
          lastActiveAfter: '2024-06-01',
          hasProfile: 'true',
          sortBy: 'lastActive',
          sortOrder: 'desc'
        };

        const mockResults = {
          users: [
            { id: '1', email: 'user1@example.com', lastActive: '2024-11-01' },
            { id: '2', email: 'user2@example.com', lastActive: '2024-10-15' }
          ],
          total: 2
        };

        adminPanelService.advancedUserSearch = jest.fn().mockResolvedValue(mockResults);

        await adminPanelController.advancedUserSearch(req, res);

        expect(adminPanelService.advancedUserSearch).toHaveBeenCalledWith(expect.objectContaining({
          email: 'example.com',
          createdAfter: new Date('2024-01-01'),
          createdBefore: new Date('2024-12-31'),
          lastActiveAfter: new Date('2024-06-01'),
          hasProfile: true,
          sortBy: 'lastActive',
          sortOrder: 'desc'
        }));
        expect(res.json).toHaveBeenCalledWith({
          success: true,
          data: mockResults
        });
      });
    });
  });

  describe('Feature Flag Management', () => {
    describe('GET /admin/feature-flags', () => {
      it('should return feature flags with visual dashboard data', async () => {
        const mockFeatureFlags = {
          flags: [
            {
              id: 'new-dashboard',
              name: 'New Dashboard',
              description: 'Enable new dashboard UI',
              enabled: true,
              rolloutPercentage: 100,
              targetGroups: ['beta_users'],
              conditions: [],
              history: [
                { action: 'enabled', timestamp: new Date(), user: 'admin' }
              ],
              metrics: {
                enabledUsers: 500,
                totalUsers: 500,
                adoptionRate: 100
              }
            }
          ],
          statistics: {
            total: 10,
            enabled: 6,
            disabled: 4,
            inRollout: 2
          }
        };

        featureFlagService.getAllFlagsWithMetrics = jest.fn().mockResolvedValue(mockFeatureFlags);

        await adminPanelController.getFeatureFlags(req, res);

        expect(featureFlagService.getAllFlagsWithMetrics).toHaveBeenCalled();
        expect(res.json).toHaveBeenCalledWith({
          success: true,
          data: mockFeatureFlags
        });
      });
    });

    describe('PUT /admin/feature-flags/:flagId', () => {
      it('should update feature flag with audit trail', async () => {
        req.params.flagId = 'new-feature';
        req.body = {
          enabled: true,
          rolloutPercentage: 50,
          targetGroups: ['beta_users', 'employees'],
          reason: 'Starting gradual rollout'
        };

        const mockUpdatedFlag = {
          id: 'new-feature',
          enabled: true,
          rolloutPercentage: 50,
          targetGroups: ['beta_users', 'employees']
        };

        featureFlagService.updateFlag = jest.fn().mockResolvedValue(mockUpdatedFlag);

        await adminPanelController.updateFeatureFlag(req, res);

        expect(featureFlagService.updateFlag).toHaveBeenCalledWith(
          'new-feature',
          expect.objectContaining({
            enabled: true,
            rolloutPercentage: 50,
            targetGroups: ['beta_users', 'employees']
          }),
          'admin-user-id'
        );
        expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({
          action: 'FEATURE_FLAG_UPDATE',
          targetId: 'new-feature',
          details: expect.objectContaining({
            reason: 'Starting gradual rollout'
          })
        }));
        expect(res.json).toHaveBeenCalledWith({
          success: true,
          data: mockUpdatedFlag
        });
      });
    });

    describe('POST /admin/feature-flags/:flagId/test', () => {
      it('should support A/B testing configuration', async () => {
        req.params.flagId = 'new-checkout';
        req.body = {
          variants: [
            { name: 'control', weight: 50, config: {} },
            { name: 'variant_a', weight: 25, config: { buttonColor: 'blue' } },
            { name: 'variant_b', weight: 25, config: { buttonColor: 'green' } }
          ],
          metrics: ['conversion_rate', 'cart_abandonment'],
          duration: 14 // days
        };

        const mockTestConfig = {
          flagId: 'new-checkout',
          testId: 'test-123',
          status: 'running',
          startDate: new Date(),
          endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          variants: req.body.variants
        };

        featureFlagService.createABTest = jest.fn().mockResolvedValue(mockTestConfig);

        await adminPanelController.createABTest(req, res);

        expect(featureFlagService.createABTest).toHaveBeenCalledWith(
          'new-checkout',
          req.body,
          'admin-user-id'
        );
        expect(res.json).toHaveBeenCalledWith({
          success: true,
          data: mockTestConfig
        });
      });
    });
  });

  describe('System Configuration', () => {
    describe('GET /admin/config', () => {
      it('should return grouped system configuration', async () => {
        const mockConfig = {
          general: [
            { key: 'app.name', value: 'Pathfinder', type: 'string', editable: false },
            { key: 'app.maintenance', value: false, type: 'boolean', editable: true }
          ],
          security: [
            { key: 'auth.sessionTimeout', value: 3600, type: 'number', editable: true },
            { key: 'auth.maxLoginAttempts', value: 5, type: 'number', editable: true }
          ],
          email: [
            { key: 'email.provider', value: 'smtp', type: 'string', editable: true, sensitive: true }
          ]
        };

        configurationService.getGroupedConfig = jest.fn().mockResolvedValue(mockConfig);

        await adminPanelController.getSystemConfig(req, res);

        expect(configurationService.getGroupedConfig).toHaveBeenCalled();
        expect(res.json).toHaveBeenCalledWith({
          success: true,
          data: mockConfig
        });
      });
    });

    describe('PUT /admin/config/:key', () => {
      it('should update configuration with validation', async () => {
        req.params.key = 'auth.sessionTimeout';
        req.body = {
          value: 7200,
          reason: 'Increasing session timeout for better UX'
        };

        const mockUpdated = {
          key: 'auth.sessionTimeout',
          value: 7200,
          previousValue: 3600,
          updatedBy: 'admin',
          updatedAt: new Date()
        };

        configurationService.updateConfig = jest.fn().mockResolvedValue(mockUpdated);

        await adminPanelController.updateSystemConfig(req, res);

        expect(configurationService.updateConfig).toHaveBeenCalledWith(
          'auth.sessionTimeout',
          7200,
          'Increasing session timeout for better UX',
          'admin-user-id'
        );
        expect(cacheService.clearPattern).toHaveBeenCalledWith('config:auth.sessionTimeout:*');
        expect(res.json).toHaveBeenCalledWith({
          success: true,
          data: mockUpdated
        });
      });

      it('should prevent updating non-editable configurations', async () => {
        req.params.key = 'app.name';
        req.body = { value: 'NewName', reason: 'Rebranding' };

        configurationService.updateConfig = jest.fn()
          .mockRejectedValue(new Error('Configuration is not editable'));

        await adminPanelController.updateSystemConfig(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          error: 'Configuration is not editable'
        });
      });
    });

    describe('GET /admin/config/api-keys', () => {
      it('should manage API keys', async () => {
        const mockApiKeys = {
          keys: [
            {
              id: 'key-1',
              name: 'Production API',
              key: 'pk_live_***',
              scopes: ['read', 'write'],
              createdAt: new Date(),
              lastUsed: new Date(),
              usageCount: 1000
            }
          ],
          total: 1
        };

        configurationService.getApiKeys = jest.fn().mockResolvedValue(mockApiKeys);

        await adminPanelController.getApiKeys(req, res);

        expect(configurationService.getApiKeys).toHaveBeenCalled();
        expect(res.json).toHaveBeenCalledWith({
          success: true,
          data: mockApiKeys
        });
      });
    });

    describe('POST /admin/config/api-keys', () => {
      it('should create new API key', async () => {
        req.body = {
          name: 'Test API Key',
          scopes: ['read'],
          expiresIn: 30 // days
        };

        const mockNewKey = {
          id: 'key-2',
          name: 'Test API Key',
          key: 'pk_test_newkey123',
          scopes: ['read'],
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        };

        configurationService.createApiKey = jest.fn().mockResolvedValue(mockNewKey);

        await adminPanelController.createApiKey(req, res);

        expect(configurationService.createApiKey).toHaveBeenCalledWith(
          'Test API Key',
          ['read'],
          30,
          'admin-user-id'
        );
        expect(res.json).toHaveBeenCalledWith({
          success: true,
          data: mockNewKey
        });
      });
    });
  });

  describe('Invitation Management', () => {
    describe('GET /admin/invitations', () => {
      it('should return invitation dashboard with analytics', async () => {
        const mockInvitationData = {
          invitations: [
            {
              id: '1',
              email: 'newuser@example.com',
              status: 'pending',
              sentAt: new Date(),
              expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
            }
          ],
          statistics: {
            total: 100,
            pending: 20,
            accepted: 70,
            expired: 10,
            acceptanceRate: 70,
            averageTimeToAccept: 48 // hours
          },
          templates: [
            { id: 'welcome', name: 'Welcome Email', usageCount: 50 },
            { id: 'onboarding', name: 'Onboarding Invitation', usageCount: 30 }
          ]
        };

        invitationService.getInvitationDashboard = jest.fn().mockResolvedValue(mockInvitationData);

        await adminPanelController.getInvitationDashboard(req, res);

        expect(invitationService.getInvitationDashboard).toHaveBeenCalled();
        expect(res.json).toHaveBeenCalledWith({
          success: true,
          data: mockInvitationData
        });
      });
    });

    describe('POST /admin/invitations/bulk', () => {
      it('should send bulk invitations', async () => {
        req.body = {
          emails: ['user1@example.com', 'user2@example.com', 'user3@example.com'],
          template: 'welcome',
          customMessage: 'Welcome to our platform!',
          role: 'user',
          expiresIn: 7 // days
        };

        const mockResult = {
          sent: 3,
          failed: 0,
          details: [
            { email: 'user1@example.com', status: 'sent', invitationId: 'inv-1' },
            { email: 'user2@example.com', status: 'sent', invitationId: 'inv-2' },
            { email: 'user3@example.com', status: 'sent', invitationId: 'inv-3' }
          ]
        };

        invitationService.sendBulkInvitations = jest.fn().mockResolvedValue(mockResult);

        await adminPanelController.sendBulkInvitations(req, res);

        expect(invitationService.sendBulkInvitations).toHaveBeenCalledWith(
          req.body.emails,
          {
            template: 'welcome',
            customMessage: 'Welcome to our platform!',
            role: 'user',
            expiresIn: 7
          },
          'admin-user-id'
        );
        expect(res.json).toHaveBeenCalledWith({
          success: true,
          data: mockResult
        });
      });
    });
  });

  describe('Security Settings', () => {
    describe('GET /admin/security/policies', () => {
      it('should return security policies', async () => {
        const mockPolicies = {
          passwordPolicy: {
            minLength: 8,
            requireUppercase: true,
            requireLowercase: true,
            requireNumbers: true,
            requireSpecialChars: true,
            maxAge: 90 // days
          },
          sessionPolicy: {
            timeout: 3600,
            maxConcurrent: 3,
            requireMFA: false
          },
          rateLimiting: {
            login: { attempts: 5, window: 300 },
            api: { requests: 100, window: 60 },
            registration: { attempts: 3, window: 3600 }
          }
        };

        adminPanelService.getSecurityPolicies = jest.fn().mockResolvedValue(mockPolicies);

        await adminPanelController.getSecurityPolicies(req, res);

        expect(adminPanelService.getSecurityPolicies).toHaveBeenCalled();
        expect(res.json).toHaveBeenCalledWith({
          success: true,
          data: mockPolicies
        });
      });
    });

    describe('PUT /admin/security/rate-limits', () => {
      it('should update rate limiting settings', async () => {
        req.body = {
          endpoint: 'login',
          attempts: 3,
          window: 600,
          reason: 'Tightening security after suspicious activity'
        };

        const mockUpdated = {
          endpoint: 'login',
          attempts: 3,
          window: 600,
          previousAttempts: 5,
          previousWindow: 300
        };

        adminPanelService.updateRateLimits = jest.fn().mockResolvedValue(mockUpdated);

        await adminPanelController.updateRateLimits(req, res);

        expect(adminPanelService.updateRateLimits).toHaveBeenCalledWith(
          'login',
          { attempts: 3, window: 600 },
          'Tightening security after suspicious activity',
          'admin-user-id'
        );
        expect(res.json).toHaveBeenCalledWith({
          success: true,
          data: mockUpdated
        });
      });
    });
  });

  describe('Service Health', () => {
    describe('GET /admin/services/health', () => {
      it('should return service health status', async () => {
        const mockHealth = {
          database: { status: 'healthy', responseTime: 15, details: { connections: 5 } },
          redis: { status: 'healthy', responseTime: 2, details: { memory: '100MB' } },
          mcp_server: { status: 'degraded', responseTime: 500, details: { error: 'High latency' } },
          email: { status: 'healthy', responseTime: 100, details: { provider: 'smtp' } },
          storage: { status: 'healthy', responseTime: 50, details: { usage: '50GB' } }
        };

        adminPanelService.getServicesHealth = jest.fn().mockResolvedValue(mockHealth);

        await adminPanelController.getServicesHealth(req, res);

        expect(adminPanelService.getServicesHealth).toHaveBeenCalled();
        expect(res.json).toHaveBeenCalledWith({
          success: true,
          data: mockHealth
        });
      });
    });

    describe('POST /admin/services/:service/restart', () => {
      it('should restart a service', async () => {
        req.params.service = 'mcp_server';
        req.body = { reason: 'Service degraded, attempting recovery' };

        const mockResult = {
          service: 'mcp_server',
          status: 'restarted',
          previousStatus: 'degraded',
          newStatus: 'healthy',
          restartedAt: new Date()
        };

        adminPanelService.restartService = jest.fn().mockResolvedValue(mockResult);

        await adminPanelController.restartService(req, res);

        expect(adminPanelService.restartService).toHaveBeenCalledWith(
          'mcp_server',
          'Service degraded, attempting recovery',
          'admin-user-id'
        );
        expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({
          action: 'SERVICE_RESTART',
          target: 'mcp_server'
        }));
        expect(res.json).toHaveBeenCalledWith({
          success: true,
          data: mockResult
        });
      });
    });
  });

  describe('Cache Management', () => {
    describe('GET /admin/cache/stats', () => {
      it('should return cache statistics', async () => {
        const mockStats = {
          hits: 10000,
          misses: 1000,
          hitRate: 90.9,
          memory: { used: 500, total: 1024, percentage: 48.8 },
          keys: 500,
          evictions: 50
        };

        cacheService.getStats = jest.fn().mockResolvedValue(mockStats);

        await adminPanelController.getCacheStats(req, res);

        expect(cacheService.getStats).toHaveBeenCalled();
        expect(res.json).toHaveBeenCalledWith({
          success: true,
          data: mockStats
        });
      });
    });

    describe('DELETE /admin/cache/:pattern', () => {
      it('should clear cache by pattern', async () => {
        req.params.pattern = 'user:*';
        req.body = { reason: 'User data model updated' };

        const mockResult = {
          pattern: 'user:*',
          keysCleared: 150,
          memoryFreed: '50MB'
        };

        cacheService.clearPattern = jest.fn().mockResolvedValue(mockResult);

        await adminPanelController.clearCache(req, res);

        expect(cacheService.clearPattern).toHaveBeenCalledWith('user:*');
        expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({
          action: 'CACHE_CLEAR',
          details: expect.objectContaining({
            pattern: 'user:*',
            reason: 'User data model updated'
          })
        }));
        expect(res.json).toHaveBeenCalledWith({
          success: true,
          data: mockResult
        });
      });
    });
  });
});