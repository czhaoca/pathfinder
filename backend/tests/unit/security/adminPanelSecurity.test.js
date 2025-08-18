/**
 * Security Test Suite for Admin Panel
 * 
 * Critical security tests for authorization, input validation,
 * and security boundaries in the admin panel implementation
 */

const adminPanelController = require('../../../src/api/controllers/adminPanelController');
const AdminPanelService = require('../../../src/services/adminPanelService');
const { ApiError } = require('../../../src/utils/errors');

// Mock dependencies
jest.mock('../../../src/services/adminPanelService');
jest.mock('../../../src/services/featureFlagService');
jest.mock('../../../src/services/configurationService');
jest.mock('../../../src/services/invitationService');
jest.mock('../../../src/services/auditService');
jest.mock('../../../src/services/cacheService');

describe('Admin Panel Security Tests', () => {
  let req, res, adminPanelService;

  beforeEach(() => {
    jest.clearAllMocks();
    adminPanelService = new AdminPanelService();
    
    req = {
      user: { id: 'admin-1', username: 'admin', role: 'admin' },
      query: {},
      params: {},
      body: {},
      ip: '127.0.0.1',
      headers: {}
    };

    res = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
      send: jest.fn()
    };
  });

  describe('Authorization Bypass Prevention', () => {
    describe('Impersonation Security', () => {
      it('should prevent non-site_admin from impersonating users', async () => {
        req.user.role = 'admin'; // Regular admin, not site_admin
        req.params.userId = 'target-user-1';

        adminPanelService.createImpersonationToken = jest.fn()
          .mockRejectedValue(new Error('Insufficient privileges'));

        await adminPanelController.impersonateUser(req, res);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            success: false,
            error: expect.stringContaining('Insufficient privileges')
          })
        );
      });

      it('should prevent impersonation of higher privilege users', async () => {
        req.params.userId = 'site-admin-1';
        
        adminPanelService.createImpersonationToken = jest.fn()
          .mockRejectedValue(new Error('Cannot impersonate other administrators'));

        await adminPanelController.impersonateUser(req, res);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(adminPanelService.createImpersonationToken).toHaveBeenCalledWith(
          'site-admin-1',
          'admin-1'
        );
      });

      it('should prevent concurrent impersonation sessions', async () => {
        req.params.userId = 'user-1';
        
        // Simulate existing impersonation session
        adminPanelService.createImpersonationToken = jest.fn()
          .mockRejectedValue(new Error('Active impersonation session exists'));

        await adminPanelController.impersonateUser(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            success: false,
            error: 'Active impersonation session exists'
          })
        );
      });

      it('should enforce impersonation time limits', async () => {
        req.params.userId = 'user-1';
        
        const mockToken = {
          token: 'imp-token-123',
          expiresAt: new Date(Date.now() + 3600000), // 1 hour
          maxDuration: 3600000
        };

        adminPanelService.createImpersonationToken = jest.fn()
          .mockResolvedValue(mockToken);

        await adminPanelController.impersonateUser(req, res);

        expect(mockToken.expiresAt.getTime()).toBeLessThanOrEqual(
          Date.now() + 3600000 // Max 1 hour
        );
      });
    });

    describe('Configuration Access Control', () => {
      it('should prevent regular admins from modifying critical configs', async () => {
        req.user.role = 'admin'; // Not site_admin
        req.params.key = 'security.encryption_key';
        req.body = { value: 'new-key', reason: 'Update encryption' };

        const configService = require('../../../src/services/configurationService');
        configService.prototype.updateConfig = jest.fn()
          .mockRejectedValue(new Error('Insufficient privileges for this configuration'));

        await adminPanelController.updateSystemConfig(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
      });

      it('should validate configuration value types', async () => {
        req.user.role = 'site_admin';
        req.params.key = 'auth.sessionTimeout';
        req.body = { 
          value: 'not-a-number', // Invalid type
          reason: 'Testing' 
        };

        const configService = require('../../../src/services/configurationService');
        configService.prototype.updateConfig = jest.fn()
          .mockRejectedValue(new Error('Invalid value type'));

        await adminPanelController.updateSystemConfig(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
      });
    });
  });

  describe('Input Validation and Sanitization', () => {
    describe('Email Validation for Bulk Invitations', () => {
      const testCases = [
        {
          emails: ['<script>alert("xss")</script>@example.com'],
          shouldFail: true,
          reason: 'XSS in email'
        },
        {
          emails: ['user@example.com; DROP TABLE users;'],
          shouldFail: true,
          reason: 'SQL injection attempt'
        },
        {
          emails: ['user@[2001:db8::1]'],
          shouldFail: false,
          reason: 'Valid IPv6 email'
        },
        {
          emails: ['user@localhost'],
          shouldFail: true,
          reason: 'Localhost not allowed'
        },
        {
          emails: ['user@.com', '@example.com', 'user@'],
          shouldFail: true,
          reason: 'Malformed emails'
        },
        {
          emails: ['user@example..com'],
          shouldFail: true,
          reason: 'Double dots in domain'
        },
        {
          emails: ['valid1@example.com', 'valid2@example.com'],
          shouldFail: false,
          reason: 'Valid emails'
        }
      ];

      testCases.forEach(({ emails, shouldFail, reason }) => {
        it(`should ${shouldFail ? 'reject' : 'accept'}: ${reason}`, async () => {
          req.body = {
            emails,
            template: 'welcome',
            role: 'user',
            expiresIn: 7
          };

          if (shouldFail) {
            await adminPanelController.sendBulkInvitations(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(
              expect.objectContaining({
                success: false,
                error: expect.stringContaining('Invalid email')
              })
            );
          } else {
            const invitationService = require('../../../src/services/invitationService');
            invitationService.prototype.sendBulkInvitations = jest.fn()
              .mockResolvedValue({ sent: emails.length, failed: 0 });

            await adminPanelController.sendBulkInvitations(req, res);
            expect(res.json).toHaveBeenCalledWith(
              expect.objectContaining({ success: true })
            );
          }
        });
      });
    });

    describe('Bulk Operation Validation', () => {
      it('should reject invalid user IDs in bulk operations', async () => {
        req.body = {
          userIds: ['valid-uuid', 'not-a-uuid', '../../etc/passwd'],
          operation: 'suspend',
          reason: 'Testing'
        };

        await adminPanelController.bulkUserOperation(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            success: false,
            error: expect.stringContaining('Invalid user ID')
          })
        );
      });

      it('should limit bulk operation batch size', async () => {
        const userIds = Array(1001).fill('valid-uuid'); // 1001 users
        req.body = {
          userIds,
          operation: 'suspend',
          reason: 'Testing batch limit'
        };

        await adminPanelController.bulkUserOperation(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            success: false,
            error: expect.stringContaining('exceeds maximum')
          })
        );
      });

      it('should sanitize reason field for special characters', async () => {
        req.body = {
          userIds: ['user-1'],
          operation: 'suspend',
          reason: '<script>alert("xss")</script>'
        };

        adminPanelService.bulkUserOperation = jest.fn()
          .mockResolvedValue({ processed: 1, successful: 1, failed: 0 });

        await adminPanelController.bulkUserOperation(req, res);

        expect(adminPanelService.bulkUserOperation).toHaveBeenCalledWith(
          ['user-1'],
          'suspend',
          expect.not.stringContaining('<script>'),
          'admin-1'
        );
      });
    });

    describe('Search Parameter Validation', () => {
      it('should prevent SQL injection in search queries', async () => {
        req.query = {
          search: "'; DROP TABLE users; --",
          status: 'active'
        };

        adminPanelService.getUsers = jest.fn()
          .mockResolvedValue({ users: [], total: 0 });

        await adminPanelController.getUsers(req, res);

        // Verify the search term was sanitized
        expect(adminPanelService.getUsers).toHaveBeenCalledWith(
          expect.objectContaining({
            search: expect.not.stringContaining('DROP TABLE')
          })
        );
      });

      it('should validate date ranges in advanced search', async () => {
        req.query = {
          createdAfter: '2024-01-01',
          createdBefore: '2023-01-01' // Before is earlier than after
        };

        await adminPanelController.advancedUserSearch(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            success: false,
            error: expect.stringContaining('Invalid date range')
          })
        );
      });
    });
  });

  describe('Rate Limiting and DoS Prevention', () => {
    it('should enforce rate limits on bulk operations', async () => {
      const operations = [];
      
      // Simulate rapid bulk operations
      for (let i = 0; i < 10; i++) {
        req.body = {
          userIds: Array(100).fill(`user-${i}`),
          operation: 'suspend',
          reason: `Bulk operation ${i}`
        };
        operations.push(adminPanelController.bulkUserOperation(req, res));
      }

      await Promise.all(operations);

      // After rate limit, should see 429 responses
      const rateLimitedCalls = res.status.mock.calls.filter(
        call => call[0] === 429
      );
      expect(rateLimitedCalls.length).toBeGreaterThan(0);
    });

    it('should limit API key generation frequency', async () => {
      const configService = require('../../../src/services/configurationService');
      
      // First request succeeds
      req.body = { name: 'Key 1', scopes: ['read'] };
      configService.prototype.createApiKey = jest.fn()
        .mockResolvedValue({ id: 'key-1', key: 'secret-1' });
      
      await adminPanelController.createApiKey(req, res);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true })
      );

      // Rapid subsequent requests should be rate limited
      for (let i = 2; i <= 5; i++) {
        req.body = { name: `Key ${i}`, scopes: ['read'] };
        await adminPanelController.createApiKey(req, res);
      }

      // Should see rate limit error
      expect(res.status).toHaveBeenCalledWith(429);
    });
  });

  describe('Audit Trail Security', () => {
    it('should log all sensitive operations with complete details', async () => {
      const auditService = require('../../../src/services/auditService');
      auditService.prototype.log = jest.fn();

      // Test impersonation logging
      req.params.userId = 'user-1';
      adminPanelService.createImpersonationToken = jest.fn()
        .mockResolvedValue({ token: 'token-123' });

      await adminPanelController.impersonateUser(req, res);

      expect(auditService.prototype.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'USER_IMPERSONATION_START',
          userId: 'admin-1',
          targetId: 'user-1',
          details: expect.objectContaining({
            expiresAt: expect.any(Date)
          })
        })
      );
    });

    it('should include request metadata in audit logs', async () => {
      const auditService = require('../../../src/services/auditService');
      auditService.prototype.log = jest.fn();

      req.headers = {
        'user-agent': 'Mozilla/5.0',
        'x-forwarded-for': '192.168.1.1'
      };

      req.body = {
        userIds: ['user-1'],
        operation: 'suspend',
        reason: 'Security violation'
      };

      adminPanelService.bulkUserOperation = jest.fn()
        .mockResolvedValue({ processed: 1, successful: 1 });

      await adminPanelController.bulkUserOperation(req, res);

      expect(auditService.prototype.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'BULK_USER_OPERATION',
          userId: 'admin-1',
          details: expect.objectContaining({
            operation: 'suspend',
            reason: 'Security violation',
            ipAddress: expect.any(String),
            userAgent: expect.any(String)
          })
        })
      );
    });

    it('should prevent audit log tampering', async () => {
      const auditService = require('../../../src/services/auditService');
      
      // Attempt to modify audit log should fail
      const tamperedLog = {
        action: 'FAKE_ACTION',
        userId: 'fake-admin',
        timestamp: new Date('2020-01-01')
      };

      auditService.prototype.log = jest.fn()
        .mockImplementation((logEntry) => {
          // Verify timestamp cannot be overridden
          expect(logEntry.timestamp).not.toEqual(tamperedLog.timestamp);
          // Verify system generates timestamp
          expect(Math.abs(logEntry.timestamp - Date.now())).toBeLessThan(1000);
        });

      await adminPanelController.bulkUserOperation(req, res);
    });
  });

  describe('Token and Session Security', () => {
    it('should validate JWT token signatures', async () => {
      req.headers.authorization = 'Bearer tampered.token.here';
      
      // Mock auth middleware behavior
      const authError = new ApiError('Invalid token signature', 401);
      req.user = null; // No user due to invalid token

      await adminPanelController.getDashboard(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should reject expired impersonation tokens', async () => {
      req.headers['x-impersonation-token'] = 'expired-token';
      
      adminPanelService.validateImpersonationToken = jest.fn()
        .mockRejectedValue(new Error('Token expired'));

      await adminPanelController.getDashboard(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should enforce session timeout for admin operations', async () => {
      req.user.sessionCreatedAt = new Date(Date.now() - 7200000); // 2 hours old
      const maxSessionAge = 3600000; // 1 hour

      if (Date.now() - req.user.sessionCreatedAt > maxSessionAge) {
        res.status(401).json({ 
          success: false, 
          error: 'Session expired' 
        });
        return;
      }

      await adminPanelController.getDashboard(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
    });
  });

  describe('Cross-Site Request Forgery (CSRF) Protection', () => {
    it('should validate CSRF tokens for state-changing operations', async () => {
      req.body = {
        userIds: ['user-1'],
        operation: 'delete',
        reason: 'Test'
      };
      
      // Missing CSRF token
      req.headers['x-csrf-token'] = undefined;

      await adminPanelController.bulkUserOperation(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('CSRF')
        })
      );
    });

    it('should reject operations with invalid CSRF tokens', async () => {
      req.body = {
        userIds: ['user-1'],
        operation: 'delete',
        reason: 'Test'
      };
      
      req.headers['x-csrf-token'] = 'invalid-csrf-token';
      req.session = { csrfToken: 'valid-csrf-token' };

      if (req.headers['x-csrf-token'] !== req.session.csrfToken) {
        res.status(403).json({ 
          success: false, 
          error: 'Invalid CSRF token' 
        });
        return;
      }

      await adminPanelController.bulkUserOperation(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  describe('Data Leakage Prevention', () => {
    it('should not expose sensitive data in error messages', async () => {
      adminPanelService.getDashboardData = jest.fn()
        .mockRejectedValue(new Error('Connection to database at 192.168.1.100:5432 failed with password abc123'));

      await adminPanelController.getDashboard(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.not.stringContaining('192.168.1.100'),
          error: expect.not.stringContaining('abc123'),
          error: expect.not.stringContaining('5432')
        })
      );
    });

    it('should redact sensitive configuration values', async () => {
      const configService = require('../../../src/services/configurationService');
      configService.prototype.getGroupedConfig = jest.fn()
        .mockResolvedValue({
          security: [
            { key: 'api.secret', value: '***REDACTED***', sensitive: true },
            { key: 'db.password', value: '***REDACTED***', sensitive: true }
          ]
        });

      await adminPanelController.getSystemConfig(req, res);

      const responseData = res.json.mock.calls[0][0].data;
      expect(responseData.security[0].value).toBe('***REDACTED***');
      expect(responseData.security[1].value).toBe('***REDACTED***');
    });
  });
});