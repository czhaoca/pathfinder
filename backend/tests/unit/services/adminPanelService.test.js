const { describe, it, expect, beforeEach, afterEach, jest } = require('@jest/globals');
const AdminPanelService = require('../../../src/services/adminPanelService');

// Mock dependencies
jest.mock('../../../src/services/database');
jest.mock('../../../src/services/auditService');
jest.mock('../../../src/services/cacheService');
jest.mock('../../../src/services/emailService');
jest.mock('../../../src/services/authService');
jest.mock('../../../src/repositories/userRepository');
jest.mock('../../../src/repositories/configurationRepository');

const db = require('../../../src/services/database');
const AuditService = require('../../../src/services/auditService');
const CacheService = require('../../../src/services/cacheService');
const EmailService = require('../../../src/services/emailService');
const AuthService = require('../../../src/services/authService');
const UserRepository = require('../../../src/repositories/userRepository');
const ConfigurationRepository = require('../../../src/repositories/configurationRepository');

describe('AdminPanelService', () => {
  let adminPanelService;
  let mockDb, mockAuditService, mockCacheService, mockEmailService, mockAuthService;
  let mockUserRepository, mockConfigRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create mock instances
    mockDb = {
      query: jest.fn(),
      execute: jest.fn(),
      transaction: jest.fn()
    };
    
    mockAuditService = new AuditService();
    mockCacheService = new CacheService();
    mockEmailService = new EmailService();
    mockAuthService = new AuthService();
    mockUserRepository = new UserRepository();
    mockConfigRepository = new ConfigurationRepository();

    // Initialize service with mocked dependencies
    adminPanelService = new AdminPanelService({
      db: mockDb,
      auditService: mockAuditService,
      cacheService: mockCacheService,
      emailService: mockEmailService,
      authService: mockAuthService,
      userRepository: mockUserRepository,
      configRepository: mockConfigRepository
    });
  });

  describe('Dashboard Data', () => {
    it('should aggregate comprehensive dashboard data', async () => {
      // Mock system stats
      mockDb.query.mockResolvedValueOnce({
        rows: [{
          TOTAL_USERS: 1000,
          ACTIVE_USERS: 850,
          NEW_TODAY: 10,
          NEW_WEEK: 50,
          NEW_MONTH: 150
        }]
      });

      // Mock service health
      mockDb.query.mockResolvedValueOnce({
        rows: [{
          SERVICE_NAME: 'database',
          STATUS: 'healthy',
          RESPONSE_TIME: 15
        }]
      });

      // Mock recent activity
      mockDb.query.mockResolvedValueOnce({
        rows: [
          { ACTION: 'login', USERNAME: 'user1', TIMESTAMP: new Date() },
          { ACTION: 'profile_update', USERNAME: 'user2', TIMESTAMP: new Date() }
        ]
      });

      // Mock alerts
      mockDb.query.mockResolvedValueOnce({
        rows: [
          { ID: '1', SEVERITY: 'warning', MESSAGE: 'High memory usage', CREATED_AT: new Date() }
        ]
      });

      const result = await adminPanelService.getDashboardData();

      expect(result).toHaveProperty('systemStats');
      expect(result).toHaveProperty('userStats');
      expect(result).toHaveProperty('recentActivity');
      expect(result).toHaveProperty('alerts');
      expect(result).toHaveProperty('jobStatus');
      expect(result.userStats.total).toBe(1000);
      expect(result.userStats.active).toBe(850);
    });

    it('should handle dashboard data retrieval errors gracefully', async () => {
      mockDb.query.mockRejectedValue(new Error('Database connection failed'));

      await expect(adminPanelService.getDashboardData()).rejects.toThrow('Failed to load dashboard data');
    });
  });

  describe('User Management', () => {
    describe('getUsers', () => {
      it('should return paginated users with filters', async () => {
        const filters = {
          page: 1,
          limit: 20,
          search: 'john',
          status: 'active',
          role: 'user'
        };

        mockUserRepository.searchUsers = jest.fn().mockResolvedValue({
          users: [
            { id: '1', username: 'john.doe', email: 'john@example.com', status: 'active' },
            { id: '2', username: 'john.smith', email: 'johns@example.com', status: 'active' }
          ],
          total: 2
        });

        const result = await adminPanelService.getUsers(filters);

        expect(mockUserRepository.searchUsers).toHaveBeenCalledWith(filters);
        expect(result.users).toHaveLength(2);
        expect(result.total).toBe(2);
        expect(result.page).toBe(1);
        expect(result.limit).toBe(20);
      });

      it('should handle empty search results', async () => {
        mockUserRepository.searchUsers = jest.fn().mockResolvedValue({
          users: [],
          total: 0
        });

        const result = await adminPanelService.getUsers({ search: 'nonexistent' });

        expect(result.users).toHaveLength(0);
        expect(result.total).toBe(0);
      });
    });

    describe('bulkUserOperation', () => {
      it('should perform bulk operations on multiple users', async () => {
        const userIds = ['1', '2', '3'];
        const operation = 'suspend';
        const reason = 'Terms violation';
        const adminId = 'admin-1';

        mockDb.transaction.mockImplementation(async (callback) => {
          return callback({
            execute: jest.fn().mockResolvedValue({ rowsAffected: 1 }),
            commit: jest.fn(),
            rollback: jest.fn()
          });
        });

        const result = await adminPanelService.bulkUserOperation(userIds, operation, reason, adminId);

        expect(result.processed).toBe(3);
        expect(result.successful).toBe(3);
        expect(result.failed).toBe(0);
        expect(mockAuditService.log).toHaveBeenCalledTimes(3);
      });

      it('should handle partial failures in bulk operations', async () => {
        const userIds = ['1', '2', '3'];
        const operation = 'delete';
        const reason = 'Account cleanup';
        const adminId = 'admin-1';

        let callCount = 0;
        mockDb.transaction.mockImplementation(async (callback) => {
          return callback({
            execute: jest.fn().mockImplementation(() => {
              callCount++;
              if (callCount === 2) {
                throw new Error('User has active subscriptions');
              }
              return { rowsAffected: 1 };
            }),
            commit: jest.fn(),
            rollback: jest.fn()
          });
        });

        const result = await adminPanelService.bulkUserOperation(userIds, operation, reason, adminId);

        expect(result.processed).toBe(3);
        expect(result.successful).toBe(2);
        expect(result.failed).toBe(1);
        expect(result.details).toContainEqual(
          expect.objectContaining({
            userId: '2',
            status: 'failed',
            error: 'User has active subscriptions'
          })
        );
      });
    });

    describe('createImpersonationToken', () => {
      it('should create impersonation token for regular users', async () => {
        const targetUserId = 'user-1';
        const adminUserId = 'admin-1';

        mockUserRepository.findById = jest.fn().mockResolvedValue({
          id: targetUserId,
          username: 'testuser',
          email: 'test@example.com',
          role: 'user'
        });

        mockAuthService.generateImpersonationToken = jest.fn().mockResolvedValue({
          token: 'imp_token_xyz',
          expiresAt: new Date(Date.now() + 3600000)
        });

        const result = await adminPanelService.createImpersonationToken(targetUserId, adminUserId);

        expect(result.token).toBe('imp_token_xyz');
        expect(mockUserRepository.findById).toHaveBeenCalledWith(targetUserId);
        expect(mockAuthService.generateImpersonationToken).toHaveBeenCalledWith(
          expect.objectContaining({ id: targetUserId }),
          adminUserId,
          expect.objectContaining({ expiresIn: '1h' })
        );
      });

      it('should prevent impersonation of admin users', async () => {
        const targetUserId = 'admin-2';
        const adminUserId = 'admin-1';

        mockUserRepository.findById = jest.fn().mockResolvedValue({
          id: targetUserId,
          username: 'otheradmin',
          role: 'site_admin'
        });

        await expect(
          adminPanelService.createImpersonationToken(targetUserId, adminUserId)
        ).rejects.toThrow('Cannot impersonate other administrators');
      });

      it('should handle non-existent users', async () => {
        mockUserRepository.findById = jest.fn().mockResolvedValue(null);

        await expect(
          adminPanelService.createImpersonationToken('nonexistent', 'admin-1')
        ).rejects.toThrow('User not found');
      });
    });

    describe('advancedUserSearch', () => {
      it('should support complex search queries', async () => {
        const searchParams = {
          email: '@company.com',
          createdAfter: new Date('2024-01-01'),
          createdBefore: new Date('2024-12-31'),
          lastActiveAfter: new Date('2024-06-01'),
          hasProfile: true,
          hasExperiences: true,
          minExperiences: 3,
          tags: ['beta_tester', 'premium'],
          sortBy: 'lastActive',
          sortOrder: 'desc'
        };

        mockDb.query.mockResolvedValue({
          rows: [
            {
              ID: '1',
              EMAIL: 'user1@company.com',
              CREATED_AT: new Date('2024-03-01'),
              LAST_ACTIVE: new Date('2024-11-01'),
              EXPERIENCE_COUNT: 5
            }
          ]
        });

        const result = await adminPanelService.advancedUserSearch(searchParams);

        expect(mockDb.query).toHaveBeenCalledWith(
          expect.stringContaining('WHERE'),
          expect.objectContaining({
            emailPattern: '%@company.com%',
            createdAfter: searchParams.createdAfter,
            createdBefore: searchParams.createdBefore
          })
        );
        expect(result.users).toHaveLength(1);
      });
    });
  });

  describe('System Configuration', () => {
    describe('updateConfig', () => {
      it('should update configuration with validation', async () => {
        const key = 'auth.sessionTimeout';
        const value = 7200;
        const reason = 'Improving UX';
        const userId = 'admin-1';

        mockConfigRepository.getByKey = jest.fn().mockResolvedValue({
          key,
          value: 3600,
          type: 'number',
          editable: true,
          category: 'security'
        });

        mockConfigRepository.update = jest.fn().mockResolvedValue({
          key,
          value,
          updatedAt: new Date()
        });

        const result = await adminPanelService.updateConfig(key, value, reason, userId);

        expect(result.key).toBe(key);
        expect(result.value).toBe(value);
        expect(result.previousValue).toBe(3600);
        expect(mockCacheService.clearPattern).toHaveBeenCalledWith(`config:${key}:*`);
        expect(mockAuditService.log).toHaveBeenCalledWith(
          expect.objectContaining({
            action: 'CONFIG_UPDATE',
            resourceId: key
          })
        );
      });

      it('should validate configuration value types', async () => {
        const key = 'auth.requireMFA';
        const value = 'yes'; // Should be boolean
        const reason = 'Enable MFA';
        const userId = 'admin-1';

        mockConfigRepository.getByKey = jest.fn().mockResolvedValue({
          key,
          value: false,
          type: 'boolean',
          editable: true
        });

        await expect(
          adminPanelService.updateConfig(key, value, reason, userId)
        ).rejects.toThrow('Invalid value type. Expected boolean');
      });

      it('should prevent updating non-editable configurations', async () => {
        const key = 'app.version';
        const value = '2.0.0';

        mockConfigRepository.getByKey = jest.fn().mockResolvedValue({
          key,
          value: '1.0.0',
          type: 'string',
          editable: false
        });

        await expect(
          adminPanelService.updateConfig(key, value, 'Update version', 'admin-1')
        ).rejects.toThrow('Configuration is not editable');
      });
    });

    describe('API Key Management', () => {
      it('should create API keys with specified scopes', async () => {
        const name = 'Production API';
        const scopes = ['read', 'write'];
        const expiresIn = 30;
        const userId = 'admin-1';

        mockDb.execute.mockResolvedValue({
          rows: [{
            ID: 'key-1',
            KEY: 'pk_live_abc123',
            NAME: name,
            SCOPES: JSON.stringify(scopes),
            EXPIRES_AT: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
          }]
        });

        const result = await adminPanelService.createApiKey(name, scopes, expiresIn, userId);

        expect(result.name).toBe(name);
        expect(result.scopes).toEqual(scopes);
        expect(result.key).toContain('pk_live_');
        expect(mockAuditService.log).toHaveBeenCalledWith(
          expect.objectContaining({
            action: 'API_KEY_CREATED',
            details: expect.objectContaining({ name, scopes })
          })
        );
      });

      it('should revoke API keys', async () => {
        const keyId = 'key-1';
        const reason = 'Security rotation';
        const userId = 'admin-1';

        mockDb.execute.mockResolvedValue({ rowsAffected: 1 });

        await adminPanelService.revokeApiKey(keyId, reason, userId);

        expect(mockDb.execute).toHaveBeenCalledWith(
          expect.stringContaining('UPDATE pf_api_keys'),
          expect.objectContaining({ keyId, revokedBy: userId })
        );
        expect(mockAuditService.log).toHaveBeenCalledWith(
          expect.objectContaining({
            action: 'API_KEY_REVOKED',
            targetId: keyId
          })
        );
      });
    });
  });

  describe('Service Health Monitoring', () => {
    it('should check all service health statuses', async () => {
      // Mock health check responses
      adminPanelService.checkDatabase = jest.fn().mockResolvedValue({
        healthy: true,
        responseTime: 15,
        details: { connections: 5, maxConnections: 100 }
      });

      adminPanelService.checkRedis = jest.fn().mockResolvedValue({
        healthy: true,
        responseTime: 2,
        details: { memory: '100MB', keys: 500 }
      });

      adminPanelService.checkMCPServer = jest.fn().mockResolvedValue({
        healthy: false,
        responseTime: 500,
        details: { error: 'High latency detected' }
      });

      const result = await adminPanelService.getServicesHealth();

      expect(result.database.status).toBe('healthy');
      expect(result.redis.status).toBe('healthy');
      expect(result.mcp_server.status).toBe('unhealthy');
      expect(result.mcp_server.details.error).toBe('High latency detected');
    });

    it('should handle service check failures gracefully', async () => {
      adminPanelService.checkDatabase = jest.fn().mockRejectedValue(new Error('Connection timeout'));

      const result = await adminPanelService.getServicesHealth();

      expect(result.database.status).toBe('error');
      expect(result.database.error).toBe('Connection timeout');
    });
  });

  describe('Security Policies', () => {
    it('should retrieve current security policies', async () => {
      mockDb.query.mockResolvedValue({
        rows: [
          { POLICY_TYPE: 'password', SETTINGS: JSON.stringify({ minLength: 8, requireUppercase: true }) },
          { POLICY_TYPE: 'session', SETTINGS: JSON.stringify({ timeout: 3600, maxConcurrent: 3 }) },
          { POLICY_TYPE: 'rate_limiting', SETTINGS: JSON.stringify({ login: { attempts: 5, window: 300 } }) }
        ]
      });

      const result = await adminPanelService.getSecurityPolicies();

      expect(result.passwordPolicy.minLength).toBe(8);
      expect(result.sessionPolicy.timeout).toBe(3600);
      expect(result.rateLimiting.login.attempts).toBe(5);
    });

    it('should update rate limiting settings', async () => {
      const endpoint = 'login';
      const settings = { attempts: 3, window: 600 };
      const reason = 'Increased security';
      const userId = 'admin-1';

      mockDb.query.mockResolvedValueOnce({
        rows: [{ ATTEMPTS: 5, WINDOW: 300 }]
      });

      mockDb.execute.mockResolvedValue({ rowsAffected: 1 });

      const result = await adminPanelService.updateRateLimits(endpoint, settings, reason, userId);

      expect(result.endpoint).toBe(endpoint);
      expect(result.attempts).toBe(3);
      expect(result.window).toBe(600);
      expect(result.previousAttempts).toBe(5);
      expect(mockCacheService.clearPattern).toHaveBeenCalledWith('rate_limit:*');
    });
  });

  describe('Service Restart', () => {
    it('should restart services and verify health', async () => {
      const service = 'mcp_server';
      const reason = 'Service degraded';
      const userId = 'admin-1';

      // Mock service restart logic
      adminPanelService.executorServiceRestart = jest.fn().mockResolvedValue(true);
      
      // Mock health check after restart
      adminPanelService.checkMCPServer = jest.fn()
        .mockResolvedValueOnce({ healthy: false }) // Before restart
        .mockResolvedValueOnce({ healthy: true });  // After restart

      const result = await adminPanelService.restartService(service, reason, userId);

      expect(result.service).toBe(service);
      expect(result.previousStatus).toBe('unhealthy');
      expect(result.newStatus).toBe('healthy');
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'SERVICE_RESTART',
          target: service,
          details: expect.objectContaining({ reason })
        })
      );
    });

    it('should handle failed service restarts', async () => {
      const service = 'database';
      const reason = 'Connection issues';
      const userId = 'admin-1';

      adminPanelService.executorServiceRestart = jest.fn().mockRejectedValue(
        new Error('Cannot restart critical service')
      );

      await expect(
        adminPanelService.restartService(service, reason, userId)
      ).rejects.toThrow('Cannot restart critical service');
    });
  });
});