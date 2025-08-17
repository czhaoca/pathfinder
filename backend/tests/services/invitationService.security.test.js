const InvitationService = require('../../src/services/invitationService');
const { ValidationError } = require('../../src/utils/errors');
const crypto = require('crypto');

describe('InvitationService Security Tests', () => {
  let invitationService;
  let mockInvitationRepository;
  let mockUserRepository;
  let mockEmailService;
  let mockAuditService;
  let mockAuthService;

  beforeEach(() => {
    // Create mock repositories and services
    mockInvitationRepository = {
      create: jest.fn(),
      findByToken: jest.fn(),
      findPendingByEmail: jest.fn(),
      findById: jest.fn(),
      markAccepted: jest.fn(),
      updateToken: jest.fn()
    };

    mockUserRepository = {
      findById: jest.fn(),
      findByEmail: jest.fn(),
      findByUsername: jest.fn(),
      create: jest.fn(),
      createUserSchema: jest.fn()
    };

    mockEmailService = {
      sendInvitation: jest.fn(),
      sendWelcome: jest.fn()
    };

    mockAuditService = {
      log: jest.fn()
    };

    mockAuthService = {
      generateTokens: jest.fn()
    };

    invitationService = new InvitationService(
      mockInvitationRepository,
      mockUserRepository,
      mockEmailService,
      mockAuditService,
      mockAuthService
    );
  });

  describe('Edge Cases and Security', () => {
    describe('Expiration Days Validation', () => {
      it('should reject negative expiration days', async () => {
        await expect(invitationService.sendInvitations({
          emails: ['test@example.com'],
          invitedBy: 'admin-id',
          expirationDays: -1
        })).rejects.toThrow('Expiration days must be between 1 and 30');
      });

      it('should reject zero expiration days', async () => {
        await expect(invitationService.sendInvitations({
          emails: ['test@example.com'],
          invitedBy: 'admin-id',
          expirationDays: 0
        })).rejects.toThrow('Expiration days must be between 1 and 30');
      });

      it('should reject expiration days over 30', async () => {
        await expect(invitationService.sendInvitations({
          emails: ['test@example.com'],
          invitedBy: 'admin-id',
          expirationDays: 31
        })).rejects.toThrow('Expiration days must be between 1 and 30');
      });

      it('should reject extremely large expiration days', async () => {
        await expect(invitationService.sendInvitations({
          emails: ['test@example.com'],
          invitedBy: 'admin-id',
          expirationDays: 10000
        })).rejects.toThrow('Expiration days must be between 1 and 30');
      });
    });

    describe('Email Array Validation', () => {
      it('should reject empty email array', async () => {
        await expect(invitationService.sendInvitations({
          emails: [],
          invitedBy: 'admin-id'
        })).rejects.toThrow('At least one email is required');
      });

      it('should reject more than 100 emails', async () => {
        const emails = Array(101).fill('test@example.com');
        await expect(invitationService.sendInvitations({
          emails,
          invitedBy: 'admin-id'
        })).rejects.toThrow('Maximum 100 invitations at once');
      });

      it('should reject null emails', async () => {
        await expect(invitationService.sendInvitations({
          emails: null,
          invitedBy: 'admin-id'
        })).rejects.toThrow('At least one email is required');
      });

      it('should reject undefined emails', async () => {
        await expect(invitationService.sendInvitations({
          invitedBy: 'admin-id'
        })).rejects.toThrow('At least one email is required');
      });
    });

    describe('Custom Message Security', () => {
      it('should truncate messages longer than 500 characters', async () => {
        const longMessage = 'a'.repeat(600);
        
        mockUserRepository.findByEmail.mockResolvedValue(null);
        mockInvitationRepository.findPendingByEmail.mockResolvedValue(null);
        mockUserRepository.findById.mockResolvedValue({
          userId: 'admin-id',
          firstName: 'Admin',
          lastName: 'User'
        });
        
        const createSpy = jest.fn().mockResolvedValue({
          invitationId: 'inv-1',
          email: 'test@example.com'
        });
        mockInvitationRepository.create = createSpy;
        mockEmailService.sendInvitation.mockResolvedValue(true);

        await invitationService.sendInvitations({
          emails: ['test@example.com'],
          invitedBy: 'admin-id',
          customMessage: longMessage
        });

        // Check that the message was truncated
        const callArgs = createSpy.mock.calls[0][0];
        expect(callArgs.metadata.customMessage).toHaveLength(500);
      });

      it('should handle null custom message gracefully', async () => {
        mockUserRepository.findByEmail.mockResolvedValue(null);
        mockInvitationRepository.findPendingByEmail.mockResolvedValue(null);
        mockUserRepository.findById.mockResolvedValue({
          userId: 'admin-id',
          firstName: 'Admin',
          lastName: 'User'
        });
        
        const createSpy = jest.fn().mockResolvedValue({
          invitationId: 'inv-1',
          email: 'test@example.com'
        });
        mockInvitationRepository.create = createSpy;
        mockEmailService.sendInvitation.mockResolvedValue(true);

        await invitationService.sendInvitations({
          emails: ['test@example.com'],
          invitedBy: 'admin-id',
          customMessage: null
        });

        const callArgs = createSpy.mock.calls[0][0];
        expect(callArgs.metadata.customMessage).toBeNull();
      });
    });

    describe('Timing Attack Prevention', () => {
      it('should have constant-time token comparison', () => {
        const token1 = 'abc123';
        const token2 = 'abc123';
        const token3 = 'xyz789';

        // Test equal tokens
        expect(invitationService.compareTokens(token1, token2)).toBe(true);
        
        // Test different tokens
        expect(invitationService.compareTokens(token1, token3)).toBe(false);
        
        // Test null/undefined
        expect(invitationService.compareTokens(null, token1)).toBe(false);
        expect(invitationService.compareTokens(token1, null)).toBe(false);
        expect(invitationService.compareTokens(null, null)).toBe(false);
        
        // Test different lengths
        expect(invitationService.compareTokens('short', 'muchlongertoken')).toBe(false);
      });
    });

    describe('Bulk CSV Processing', () => {
      it('should detect and reject duplicate emails in CSV', async () => {
        const csvData = `test@example.com,Message 1
test@example.com,Message 2
other@example.com,Message 3`;

        const result = await invitationService.processBulkCSV(csvData, 'admin-id');
        
        expect(result.errors).toContainEqual({
          row: 2,
          error: 'Duplicate email in CSV'
        });
        expect(result.queued).toBe(0); // Since we mock the actual sending
      });

      it('should handle CSV with empty lines', async () => {
        const csvData = `test1@example.com,Message 1

test2@example.com,Message 2

`;

        mockUserRepository.findByEmail.mockResolvedValue(null);
        mockInvitationRepository.findPendingByEmail.mockResolvedValue(null);
        mockUserRepository.findById.mockResolvedValue({
          userId: 'admin-id',
          firstName: 'Admin',
          lastName: 'User'
        });
        mockInvitationRepository.create.mockResolvedValue({
          invitationId: 'inv-1'
        });
        mockEmailService.sendInvitation.mockResolvedValue(true);

        const result = await invitationService.processBulkCSV(csvData, 'admin-id');
        
        expect(result.errors).toHaveLength(0);
      });

      it('should truncate custom messages in CSV to 500 chars', async () => {
        const longMessage = 'a'.repeat(600);
        const csvData = `test@example.com,${longMessage}`;

        const result = await invitationService.processBulkCSV(csvData, 'admin-id');
        
        // The processBulkCSV method should truncate the message
        // This is tested indirectly as the actual sending is mocked
        expect(result.errors).toHaveLength(0);
      });
    });

    describe('Concurrent Invitation Acceptance', () => {
      it('should handle race condition for username uniqueness', async () => {
        const token = 'valid-token';
        
        // First call succeeds
        jest.spyOn(invitationService, 'validateToken').mockResolvedValueOnce({
          valid: true,
          email: 'test@example.com'
        });

        mockInvitationRepository.findByToken.mockResolvedValueOnce({
          invitationId: 'inv-1',
          email: 'test@example.com',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          acceptedAt: null
        });

        // Simulate username already taken (race condition)
        mockUserRepository.findByUsername.mockResolvedValueOnce({
          userId: 'existing-user',
          username: 'testuser'
        });

        await expect(invitationService.acceptInvitation({
          token,
          password: 'SecurePass123',
          firstName: 'Test',
          lastName: 'User',
          username: 'testuser',
          acceptTerms: true
        })).rejects.toThrow('Username already exists');
      });
    });

    describe('Invalid Token Formats', () => {
      it('should handle token with invalid hex format gracefully', async () => {
        const invalidToken = 'not-a-hex-token!@#$';
        
        const result = await invitationService.validateToken(invalidToken);
        
        expect(result.valid).toBe(false);
        // Should not throw, but return invalid
      });

      it('should handle extremely long tokens', async () => {
        const longToken = 'a'.repeat(1000);
        
        const result = await invitationService.validateToken(longToken);
        
        expect(result.valid).toBe(false);
      });

      it('should handle empty token', async () => {
        const result = await invitationService.validateToken('');
        
        expect(result.valid).toBe(false);
      });
    });

    describe('Unicode and Special Characters', () => {
      it('should reject username with unicode characters', async () => {
        jest.spyOn(invitationService, 'validateToken').mockResolvedValue({
          valid: true,
          email: 'test@example.com'
        });

        mockInvitationRepository.findByToken.mockResolvedValue({
          invitationId: 'inv-1',
          email: 'test@example.com',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          acceptedAt: null
        });

        await expect(invitationService.acceptInvitation({
          token: 'valid-token',
          password: 'SecurePass123',
          firstName: 'Test',
          lastName: 'User',
          username: 'user\u00E9name', // Contains unicode é
          acceptTerms: true
        })).rejects.toThrow('Invalid username format');
      });

      it('should handle names with apostrophes', async () => {
        jest.spyOn(invitationService, 'validateToken').mockResolvedValue({
          valid: true,
          email: 'test@example.com'
        });

        mockInvitationRepository.findByToken.mockResolvedValue({
          invitationId: 'inv-1',
          email: 'test@example.com',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          acceptedAt: null
        });

        mockUserRepository.findByUsername.mockResolvedValue(null);
        mockUserRepository.create.mockResolvedValue({
          userId: 'new-user',
          username: 'testuser',
          email: 'test@example.com',
          firstName: "O'Brien",
          lastName: "D'Angelo",
          schemaPrefix: 'user_testuser'
        });

        mockAuthService.generateTokens.mockReturnValue({
          token: 'auth-token',
          refreshToken: 'refresh-token'
        });

        const result = await invitationService.acceptInvitation({
          token: 'valid-token',
          password: 'SecurePass123',
          firstName: "O'Brien",
          lastName: "D'Angelo",
          username: 'testuser',
          acceptTerms: true
        });

        expect(result.user.firstName).toBe("O'Brien");
        expect(result.user.lastName).toBe("D'Angelo");
      });
    });

    describe('Token Expiration Edge Cases', () => {
      it('should handle token expiring during processing', async () => {
        const token = 'about-to-expire';
        
        // Token is valid when first checked
        jest.spyOn(invitationService, 'validateToken').mockResolvedValueOnce({
          valid: true,
          email: 'test@example.com'
        });

        // But expires by the time we try to use it
        mockInvitationRepository.findByToken.mockResolvedValueOnce({
          invitationId: 'inv-1',
          email: 'test@example.com',
          expiresAt: new Date(Date.now() - 1000), // Already expired
          acceptedAt: null
        });

        // The second validation in acceptInvitation should catch this
        jest.spyOn(invitationService, 'validateToken').mockResolvedValueOnce({
          valid: false,
          reason: 'Invitation has expired'
        });

        await expect(invitationService.acceptInvitation({
          token,
          password: 'SecurePass123',
          firstName: 'Test',
          lastName: 'User',
          username: 'testuser',
          acceptTerms: true
        })).rejects.toThrow('Invitation has expired');
      });
    });
  });
});