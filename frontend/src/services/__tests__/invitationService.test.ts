import invitationService from '../invitationService';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock the fetch function
global.fetch = vi.fn();

describe('InvitationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset fetch mock
    (global.fetch as any).mockReset();
  });

  describe('sendInvitations', () => {
    it('should send invitations successfully', async () => {
      const mockResponse = {
        success: true,
        data: {
          sent: [
            { email: 'test1@example.com', invitationId: 'inv-1', status: 'sent' },
            { email: 'test2@example.com', invitationId: 'inv-2', status: 'sent' }
          ],
          failed: []
        }
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await invitationService.sendInvitations({
        emails: ['test1@example.com', 'test2@example.com'],
        customMessage: 'Welcome to our platform!'
      });

      expect(result.success).toBe(true);
      expect(result.data?.sent).toHaveLength(2);
      expect(result.data?.failed).toHaveLength(0);
    });

    it('should handle partial failures', async () => {
      const mockResponse = {
        success: true,
        data: {
          sent: [
            { email: 'test1@example.com', invitationId: 'inv-1', status: 'sent' }
          ],
          failed: [
            { email: 'test2@example.com', reason: 'User already exists' }
          ]
        }
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await invitationService.sendInvitations({
        emails: ['test1@example.com', 'test2@example.com']
      });

      expect(result.success).toBe(true);
      expect(result.data?.sent).toHaveLength(1);
      expect(result.data?.failed).toHaveLength(1);
      expect(result.data?.failed[0].reason).toBe('User already exists');
    });
  });

  describe('validateToken', () => {
    it('should validate a valid token', async () => {
      const mockResponse = {
        success: true,
        data: {
          valid: true,
          email: 'test@example.com',
          expiresAt: '2025-01-31',
          inviterName: 'Admin User'
        }
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await invitationService.validateToken('valid-token');

      expect(result.success).toBe(true);
      expect(result.data?.valid).toBe(true);
      expect(result.data?.email).toBe('test@example.com');
    });

    it('should handle invalid token', async () => {
      const mockResponse = {
        success: true,
        data: {
          valid: false,
          reason: 'Invalid invitation token'
        }
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await invitationService.validateToken('invalid-token');

      expect(result.success).toBe(true);
      expect(result.data?.valid).toBe(false);
      expect(result.data?.reason).toBe('Invalid invitation token');
    });
  });

  describe('acceptInvitation', () => {
    it('should accept invitation and create account', async () => {
      const mockResponse = {
        success: true,
        data: {
          user: {
            id: 'user-123',
            username: 'testuser',
            email: 'test@example.com',
            firstName: 'Test',
            lastName: 'User',
            createdAt: '2025-01-20',
            accountStatus: 'active'
          },
          tokens: {
            token: 'auth-token',
            refreshToken: 'refresh-token'
          }
        }
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await invitationService.acceptInvitation({
        token: 'valid-token',
        password: 'SecurePassword123',
        firstName: 'Test',
        lastName: 'User',
        username: 'testuser',
        acceptTerms: true
      });

      expect(result.success).toBe(true);
      expect(result.data?.user.username).toBe('testuser');
      expect(result.data?.tokens.token).toBe('auth-token');
    });
  });

  describe('listInvitations', () => {
    it('should list invitations with filters', async () => {
      const mockResponse = {
        success: true,
        data: {
          invitations: [
            {
              invitationId: 'inv-1',
              email: 'test1@example.com',
              status: 'pending',
              inviterName: 'Admin User',
              expiresAt: '2025-01-31',
              createdAt: '2025-01-20'
            }
          ],
          total: 1,
          page: 1,
          limit: 20,
          pages: 1
        }
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await invitationService.listInvitations({
        status: 'pending',
        page: 1,
        limit: 20
      });

      expect(result.success).toBe(true);
      expect(result.data?.invitations).toHaveLength(1);
      expect(result.data?.invitations[0].status).toBe('pending');
    });
  });

  describe('resendInvitation', () => {
    it('should resend invitation successfully', async () => {
      const mockResponse = {
        success: true,
        data: {
          success: true,
          message: 'Invitation resent successfully'
        }
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await invitationService.resendInvitation('inv-123');

      expect(result.success).toBe(true);
      expect(result.data?.message).toBe('Invitation resent successfully');
    });
  });

  describe('revokeInvitation', () => {
    it('should revoke invitation successfully', async () => {
      const mockResponse = {
        success: true,
        data: {
          success: true,
          message: 'Invitation revoked successfully'
        }
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await invitationService.revokeInvitation('inv-123');

      expect(result.success).toBe(true);
      expect(result.data?.message).toBe('Invitation revoked successfully');
    });
  });

  describe('Helper Methods', () => {
    describe('isValidEmail', () => {
      it('should validate correct email formats', () => {
        expect(invitationService.isValidEmail('test@example.com')).toBe(true);
        expect(invitationService.isValidEmail('user.name@company.co.uk')).toBe(true);
        expect(invitationService.isValidEmail('test+tag@example.com')).toBe(true);
      });

      it('should reject invalid email formats', () => {
        expect(invitationService.isValidEmail('invalid')).toBe(false);
        expect(invitationService.isValidEmail('@example.com')).toBe(false);
        expect(invitationService.isValidEmail('test@')).toBe(false);
        expect(invitationService.isValidEmail('test @example.com')).toBe(false);
      });
    });

    describe('formatExpirationDate', () => {
      it('should format expiration dates correctly', () => {
        const now = new Date();
        const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        const inThreeDays = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        expect(invitationService.formatExpirationDate(tomorrow.toISOString())).toBe('Expires tomorrow');
        expect(invitationService.formatExpirationDate(inThreeDays.toISOString())).toBe('Expires in 3 days');
        expect(invitationService.formatExpirationDate(yesterday.toISOString())).toBe('Expired');
      });
    });

    describe('parseCSV', () => {
      it('should parse CSV data correctly', () => {
        const csvData = `test1@example.com,Welcome to the team!
test2@example.com,Looking forward to working with you
invalid-email
test3@example.com`;

        const result = invitationService.parseCSV(csvData);

        expect(result.emails).toHaveLength(3);
        expect(result.emails).toContain('test1@example.com');
        expect(result.emails).toContain('test2@example.com');
        expect(result.emails).toContain('test3@example.com');
        expect(result.emails).not.toContain('invalid-email');
        expect(result.customMessages.get('test1@example.com')).toBe('Welcome to the team!');
        expect(result.customMessages.get('test2@example.com')).toBe('Looking forward to working with you');
        expect(result.customMessages.has('test3@example.com')).toBe(false);
      });

      it('should handle empty lines and whitespace', () => {
        const csvData = `
        test1@example.com  ,  Custom message  

        test2@example.com
        `;

        const result = invitationService.parseCSV(csvData);

        expect(result.emails).toHaveLength(2);
        expect(result.customMessages.get('test1@example.com')).toBe('Custom message');
      });
    });
  });

  describe('bulkInvitations', () => {
    it('should process bulk CSV invitations', async () => {
      const mockResponse = {
        success: true,
        data: {
          queued: 3,
          errors: []
        }
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const csvData = `test1@example.com
test2@example.com
test3@example.com`;

      const result = await invitationService.bulkInvitations(csvData);

      expect(result.success).toBe(true);
      expect(result.data?.queued).toBe(3);
      expect(result.data?.errors).toHaveLength(0);
    });

    it('should handle bulk invitation errors', async () => {
      const mockResponse = {
        success: true,
        data: {
          queued: 1,
          errors: [
            { row: 2, error: 'Invalid email format' },
            { row: 3, error: 'User already exists' }
          ]
        }
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const csvData = `test1@example.com
invalid-email
existing@example.com`;

      const result = await invitationService.bulkInvitations(csvData);

      expect(result.success).toBe(true);
      expect(result.data?.queued).toBe(1);
      expect(result.data?.errors).toHaveLength(2);
    });
  });

  describe('getInvitationStats', () => {
    it('should retrieve invitation statistics', async () => {
      const mockResponse = {
        success: true,
        data: {
          total: 100,
          accepted: 75,
          declined: 5,
          pending: 15,
          expired: 5
        }
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await invitationService.getInvitationStats();

      expect(result.success).toBe(true);
      expect(result.data?.total).toBe(100);
      expect(result.data?.accepted).toBe(75);
      expect(result.data?.pending).toBe(15);
    });
  });
});