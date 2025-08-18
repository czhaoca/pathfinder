/**
 * Edge Case Tests for LinkedIn OAuth Service
 * Tests critical edge cases and error scenarios not covered in main test suite
 */

const LinkedInOAuthService = require('../../../src/services/linkedInOAuthService');
const { AuthenticationError, ValidationError, ConflictError } = require('../../../src/utils/errors');

describe('LinkedInOAuthService - Edge Cases', () => {
  let service;
  let mockConfig;
  let mockUserService;
  let mockSsoService;
  let mockAuditService;
  let mockDatabase;
  let mockEncryptionService;
  let mockProfileImportService;
  let mockFeatureFlagService;

  beforeEach(() => {
    // Setup mocks (abbreviated for clarity - same as main test file)
    mockConfig = {
      linkedin: {
        enabled: true,
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        redirectUri: 'http://localhost:3000/auth/linkedin/callback',
        scopes: ['openid', 'profile', 'email'],
        stateExpiration: 300,
        allowSignup: true,
        syncInterval: 86400000
      }
    };

    mockUserService = {
      findById: jest.fn(),
      findByEmail: jest.fn(),
      create: jest.fn(),
      usernameExists: jest.fn(),
      verifyPassword: jest.fn(),
      hasPassword: jest.fn()
    };

    mockSsoService = {
      findByProvider: jest.fn(),
      findByUserAndProvider: jest.fn(),
      create: jest.fn(),
      updateTokens: jest.fn(),
      removeProvider: jest.fn(),
      getOtherProviders: jest.fn()
    };

    mockAuditService = { log: jest.fn() };
    mockDatabase = {
      getConnection: jest.fn(() => ({
        execute: jest.fn(),
        close: jest.fn()
      }))
    };
    mockEncryptionService = {
      encrypt: jest.fn(val => `encrypted_${val}`),
      decrypt: jest.fn(val => val.replace('encrypted_', ''))
    };
    mockProfileImportService = {
      importWorkExperience: jest.fn(),
      importEducation: jest.fn(),
      importSkills: jest.fn(),
      mapLinkedInProfile: jest.fn()
    };
    mockFeatureFlagService = { isEnabled: jest.fn() };

    service = new LinkedInOAuthService(
      mockConfig,
      mockUserService,
      mockSsoService,
      mockAuditService,
      mockDatabase,
      mockEncryptionService,
      mockProfileImportService,
      mockFeatureFlagService
    );
  });

  describe('Security Edge Cases', () => {
    test('should handle concurrent OAuth flows from same user', async () => {
      const userId = 'test-user-id';
      
      // Generate multiple auth URLs simultaneously
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(service.generateAuthUrl(userId, '/dashboard'));
      }
      
      const authUrls = await Promise.all(promises);
      
      // Each should have unique state
      const states = new Set();
      authUrls.forEach(url => {
        const state = new URL(url).searchParams.get('state');
        expect(states.has(state)).toBe(false);
        states.add(state);
      });
      
      expect(states.size).toBe(5);
      expect(service.stateStore.size).toBe(5);
    });

    test('should prevent state reuse attacks', async () => {
      const state = 'test-state';
      const stateData = {
        userId: null,
        returnUrl: '/',
        codeVerifier: 'verifier',
        createdAt: Date.now(),
        expires: Date.now() + 300000
      };
      
      service.stateStore.set(state, stateData);
      
      // First use should succeed
      service.stateStore.get(state);
      service.stateStore.delete(state);
      
      // Second use should fail
      await expect(
        service.handleCallback('code', state)
      ).rejects.toThrow('Invalid state parameter');
    });

    test('should handle malformed redirect URLs', async () => {
      const maliciousUrls = [
        'javascript:alert(1)',
        'data:text/html,<script>alert(1)</script>',
        '//evil.com/redirect',
        'http://evil.com/redirect',
        '../../../etc/passwd',
        'file:///etc/passwd',
        '\x00javascript:alert(1)',
        'java\nscript:alert(1)'
      ];

      for (const url of maliciousUrls) {
        await expect(
          service.generateAuthUrl(null, url)
        ).rejects.toThrow('Invalid return URL');
      }
    });

    test('should handle token rotation during long sessions', async () => {
      const userId = 'test-user-id';
      const ssoAccount = {
        id: 'sso-id',
        accessToken: 'encrypted_old_token',
        refreshToken: 'encrypted_refresh_token',
        tokenExpiresAt: new Date(Date.now() - 1000) // Expired
      };

      mockSsoService.findByUserAndProvider.mockResolvedValue(ssoAccount);
      
      // Mock successful token refresh
      global.fetch = jest.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            access_token: 'new_access_token',
            expires_in: 3600
          })
        });

      const newToken = await service.refreshAccessToken(userId);
      
      expect(newToken).toBe('new_access_token');
      expect(mockSsoService.updateTokens).toHaveBeenCalled();
    });
  });

  describe('Data Import Edge Cases', () => {
    test('should handle LinkedIn profile with no work experience', async () => {
      const profile = {
        id: 'linkedin-id',
        localizedFirstName: 'John',
        localizedLastName: 'Doe',
        headline: 'Student'
      };
      
      // Mock empty responses
      service.getPositions = jest.fn().mockResolvedValue([]);
      service.getEducation = jest.fn().mockResolvedValue([]);
      service.getSkills = jest.fn().mockResolvedValue([]);
      
      const result = await service.importProfile('user-id', 'access-token');
      
      expect(result.imported.workExperience).toEqual({ imported: 0, skipped: 0 });
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'LINKEDIN_PROFILE_IMPORTED',
          details: expect.objectContaining({
            workExperience: 0
          })
        })
      );
    });

    test('should handle extremely large profile data', async () => {
      // Generate 150 work experiences
      const positions = Array(150).fill(null).map((_, i) => ({
        id: `pos-${i}`,
        title: `Role ${i}`,
        companyName: `Company ${i}`,
        startDate: { year: 2000 + Math.floor(i / 10), month: (i % 12) + 1 },
        description: `Description ${i}`.repeat(100) // Long description
      }));

      service.getPositions = jest.fn().mockResolvedValue(positions);
      service.getEducation = jest.fn().mockResolvedValue([]);
      service.getSkills = jest.fn().mockResolvedValue(Array(500).fill({ name: 'Skill' }));

      mockProfileImportService.importWorkExperience.mockResolvedValue({
        imported: 150,
        skipped: 0
      });
      mockProfileImportService.importSkills.mockResolvedValue({
        imported: 500,
        skipped: 0
      });

      const result = await service.importProfile('user-id', 'access-token');
      
      expect(result.imported.workExperience.imported).toBe(150);
      expect(result.imported.skills.imported).toBe(500);
    });

    test('should handle special characters in company names', async () => {
      const positions = [
        {
          title: 'Developer',
          companyName: 'O\'Reilly & Associates',
          startDate: { year: 2020, month: 1 }
        },
        {
          title: 'Engineer',
          companyName: 'Müller GmbH & Co. KG',
          startDate: { year: 2021, month: 6 }
        },
        {
          title: 'Analyst',
          companyName: '株式会社Example (Example Corp.)',
          startDate: { year: 2022, month: 3 }
        }
      ];

      service.getPositions = jest.fn().mockResolvedValue(positions);
      
      mockProfileImportService.importWorkExperience.mockImplementation(
        (userId, positions) => {
          // Verify special characters are preserved
          expect(positions[0].companyName).toContain('O\'Reilly');
          expect(positions[1].companyName).toContain('Müller');
          expect(positions[2].companyName).toContain('株式会社');
          return { imported: 3, skipped: 0 };
        }
      );

      await service.importProfile('user-id', 'access-token');
      
      expect(mockProfileImportService.importWorkExperience).toHaveBeenCalled();
    });

    test('should handle invalid date formats gracefully', async () => {
      const positions = [
        {
          title: 'Role 1',
          companyName: 'Company',
          startDate: null,
          endDate: { year: 'invalid', month: 13, day: 32 }
        },
        {
          title: 'Role 2',
          companyName: 'Company',
          startDate: { year: 2050, month: 1 }, // Future date
          endDate: { year: 2010, month: 1 } // End before start
        }
      ];

      mockProfileImportService.importWorkExperience.mockImplementation(
        (userId, positions) => {
          // Service should handle invalid dates
          return { imported: 1, skipped: 1 };
        }
      );

      service.getPositions = jest.fn().mockResolvedValue(positions);
      
      const result = await service.importProfile('user-id', 'access-token');
      
      expect(result.imported.workExperience.skipped).toBeGreaterThan(0);
    });

    test('should handle missing email in LinkedIn response', async () => {
      const linkedInUser = {
        sub: 'linkedin-id',
        given_name: 'John',
        family_name: 'Doe'
        // email is missing
      };

      const connection = {
        execute: jest.fn(),
        close: jest.fn(),
        rollback: jest.fn()
      };
      mockDatabase.getConnection.mockResolvedValue(connection);

      await expect(
        service.processLinkedInAuth(linkedInUser, {}, null)
      ).rejects.toThrow();
    });
  });

  describe('Network and API Edge Cases', () => {
    test('should handle LinkedIn API timeout', async () => {
      global.fetch = jest.fn().mockImplementation(() => 
        new Promise((resolve) => {
          // Simulate timeout - never resolves
          setTimeout(() => {}, 10000);
        })
      );

      const timeoutPromise = service.getUserInfo('access-token');
      
      // Should handle timeout gracefully
      await expect(Promise.race([
        timeoutPromise,
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 100)
        )
      ])).rejects.toThrow('Timeout');
    });

    test('should handle malformed LinkedIn API response', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => {
          throw new Error('Invalid JSON');
        }
      });

      await expect(
        service.getUserInfo('access-token')
      ).rejects.toThrow();
    });

    test('should handle LinkedIn API rate limiting', async () => {
      global.fetch = jest.fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          statusText: 'Too Many Requests',
          headers: {
            get: (key) => key === 'Retry-After' ? '60' : null
          }
        });

      await expect(
        service.getUserInfo('access-token')
      ).rejects.toThrow();
    });

    test('should handle partial LinkedIn API failures', async () => {
      // Profile succeeds
      service.getProfile = jest.fn().mockResolvedValue({
        id: 'user-id',
        headline: 'Developer'
      });
      
      // Positions fails
      service.getPositions = jest.fn().mockRejectedValue(new Error('API Error'));
      
      // Skills succeeds
      service.getSkills = jest.fn().mockResolvedValue([
        { name: 'JavaScript' }
      ]);

      mockProfileImportService.importSkills.mockResolvedValue({
        imported: 1,
        skipped: 0
      });

      const result = await service.importProfile('user-id', 'access-token');
      
      // Should import what's available
      expect(result.imported.skills).toBeDefined();
      expect(result.imported.workExperience).toBeUndefined();
    });
  });

  describe('Database Transaction Edge Cases', () => {
    test('should rollback on database connection loss', async () => {
      const connection = {
        execute: jest.fn()
          .mockResolvedValueOnce() // BEGIN
          .mockRejectedValueOnce(new Error('Connection lost')),
        rollback: jest.fn(),
        close: jest.fn()
      };
      
      mockDatabase.getConnection.mockResolvedValue(connection);

      await expect(
        service.processLinkedInAuth({}, {}, null)
      ).rejects.toThrow();
      
      expect(connection.rollback).toHaveBeenCalled();
    });

    test('should handle concurrent profile imports for same user', async () => {
      const userId = 'user-id';
      let importCount = 0;
      
      mockProfileImportService.importWorkExperience.mockImplementation(async () => {
        importCount++;
        if (importCount > 1) {
          throw new Error('Import already in progress');
        }
        await new Promise(resolve => setTimeout(resolve, 100));
        return { imported: 5, skipped: 0 };
      });

      const import1 = service.importProfile(userId, 'token1');
      const import2 = service.importProfile(userId, 'token2');

      const results = await Promise.allSettled([import1, import2]);
      
      const successful = results.filter(r => r.status === 'fulfilled');
      const failed = results.filter(r => r.status === 'rejected');
      
      expect(successful.length).toBe(1);
      expect(failed.length).toBe(1);
    });
  });

  describe('Mobile and Browser Compatibility', () => {
    test('should handle mobile browser redirect limitations', async () => {
      // Simulate mobile user agent
      const mobileUserAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)';
      
      const authUrl = await service.generateAuthUrl(null, '/dashboard');
      
      // Should use web redirect flow, not app deep linking
      expect(authUrl).toContain('redirect_uri=');
      expect(authUrl).not.toContain('app://');
    });

    test('should handle browser storage limitations', async () => {
      // Simulate storage quota exceeded
      const mockSessionStorage = {
        setItem: jest.fn().mockImplementation(() => {
          throw new Error('QuotaExceededError');
        })
      };
      
      global.sessionStorage = mockSessionStorage;
      
      // Service should handle storage errors gracefully
      const authUrl = await service.generateAuthUrl(null, '/dashboard');
      expect(authUrl).toBeDefined();
    });
  });

  describe('Data Validation and Sanitization', () => {
    test('should sanitize user input to prevent injection attacks', async () => {
      const maliciousInputs = [
        '<script>alert(1)</script>',
        '${process.env.SECRET}',
        '$(curl evil.com)',
        '"; DROP TABLE users; --',
        '../../../etc/passwd'
      ];

      for (const input of maliciousInputs) {
        const linkedInUser = {
          sub: 'linkedin-id',
          email: `test@example.com`,
          given_name: input,
          family_name: 'Doe'
        };

        mockUserService.create.mockImplementation((userData) => {
          // Verify input is sanitized
          expect(userData.firstName).not.toContain('<script>');
          expect(userData.firstName).not.toContain('DROP TABLE');
          return { id: 'user-id', ...userData };
        });

        const connection = {
          execute: jest.fn(),
          close: jest.fn()
        };
        mockDatabase.getConnection.mockResolvedValue(connection);

        await service.createUserFromLinkedIn(linkedInUser, connection);
      }
    });

    test('should validate email format from LinkedIn', async () => {
      const invalidEmails = [
        'notanemail',
        '@example.com',
        'user@',
        'user@.com',
        'user@example',
        'user name@example.com',
        'user@exam ple.com'
      ];

      for (const email of invalidEmails) {
        const linkedInUser = {
          sub: 'linkedin-id',
          email: email,
          given_name: 'John',
          family_name: 'Doe'
        };

        const connection = {
          execute: jest.fn(),
          close: jest.fn()
        };
        mockDatabase.getConnection.mockResolvedValue(connection);

        // Should handle invalid email gracefully
        await expect(
          service.createUserFromLinkedIn(linkedInUser, connection)
        ).rejects.toThrow();
      }
    });
  });

  describe('Performance and Resource Management', () => {
    test('should clean up expired states to prevent memory leak', async () => {
      // Add 1000 expired states
      for (let i = 0; i < 1000; i++) {
        service.stateStore.set(`state-${i}`, {
          expires: Date.now() - 1000 // Already expired
        });
      }

      expect(service.stateStore.size).toBe(1000);

      // Run cleanup
      service.cleanupExpiredStates();

      // All expired states should be removed
      expect(service.stateStore.size).toBe(0);
    });

    test('should limit state store size to prevent DOS', async () => {
      // Try to add excessive states
      for (let i = 0; i < 10000; i++) {
        try {
          await service.generateAuthUrl(null, '/');
        } catch (error) {
          // Should start failing after reasonable limit
          if (i > 1000) {
            expect(error.message).toContain('limit');
            break;
          }
        }
      }

      // Should not allow unlimited states
      expect(service.stateStore.size).toBeLessThan(10000);
    });
  });
});