const InvitationService = require('../../src/services/invitationService');
const { ValidationError, ConflictError, NotFoundError } = require('../../src/utils/errors');
const crypto = require('crypto');

describe('InvitationService', () => {
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
      findByEmail: jest.fn(),
      findPendingByEmail: jest.fn(),
      findById: jest.fn(),
      list: jest.fn(),
      markAccepted: jest.fn(),
      markDeclined: jest.fn(),
      markReminderSent: jest.fn(),
      updateToken: jest.fn(),
      findPendingNeedingReminder: jest.fn(),
      deleteExpired: jest.fn(),
      getStatsByInviter: jest.fn()
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
      sendInvitationReminder: jest.fn(),
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

  describe('sendInvitations', () => {
    it('should successfully send invitations to valid emails', async () => {
      const emails = ['test1@example.com', 'test2@example.com'];
      const invitedBy = 'admin-user-id';
      
      mockUserRepository.findByEmail.mockResolvedValue(null);
      mockInvitationRepository.findPendingByEmail.mockResolvedValue(null);
      mockUserRepository.findById.mockResolvedValue({
        userId: invitedBy,
        firstName: 'Admin',
        lastName: 'User',
        username: 'admin'
      });
      mockInvitationRepository.create.mockResolvedValue({
        invitationId: 'invitation-id',
        email: 'test@example.com'
      });
      mockEmailService.sendInvitation.mockResolvedValue(true);

      const result = await invitationService.sendInvitations({
        emails,
        invitedBy,
        role: 'user'
      });

      expect(result.sent).toHaveLength(2);
      expect(result.failed).toHaveLength(0);
      expect(mockEmailService.sendInvitation).toHaveBeenCalledTimes(2);
      expect(mockAuditService.log).toHaveBeenCalledTimes(2);
    });

    it('should reject invalid email formats', async () => {
      const emails = ['invalid-email', 'test@example.com'];
      const invitedBy = 'admin-user-id';

      mockUserRepository.findByEmail.mockResolvedValue(null);
      mockInvitationRepository.findPendingByEmail.mockResolvedValue(null);
      mockUserRepository.findById.mockResolvedValue({
        userId: invitedBy,
        firstName: 'Admin',
        lastName: 'User',
        username: 'admin'
      });
      mockInvitationRepository.create.mockResolvedValue({
        invitationId: 'invitation-id',
        email: 'test@example.com'
      });

      const result = await invitationService.sendInvitations({
        emails,
        invitedBy
      });

      expect(result.sent).toHaveLength(1);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].reason).toBe('Invalid email format');
    });

    it('should not send invitation to existing users', async () => {
      const emails = ['existing@example.com'];
      const invitedBy = 'admin-user-id';

      mockUserRepository.findByEmail.mockResolvedValue({
        userId: 'existing-user-id',
        email: 'existing@example.com'
      });

      const result = await invitationService.sendInvitations({
        emails,
        invitedBy
      });

      expect(result.sent).toHaveLength(0);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].reason).toBe('User already exists');
    });

    it('should not send duplicate pending invitations', async () => {
      const emails = ['pending@example.com'];
      const invitedBy = 'admin-user-id';

      mockUserRepository.findByEmail.mockResolvedValue(null);
      mockInvitationRepository.findPendingByEmail.mockResolvedValue({
        invitationId: 'existing-invitation-id',
        email: 'pending@example.com'
      });

      const result = await invitationService.sendInvitations({
        emails,
        invitedBy
      });

      expect(result.sent).toHaveLength(0);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].reason).toBe('Invitation already pending');
    });
  });

  describe('validateToken', () => {
    it('should validate a valid token', async () => {
      const token = 'valid-token';
      const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
      
      mockInvitationRepository.findByToken.mockResolvedValue({
        invitationId: 'invitation-id',
        email: 'test@example.com',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        acceptedAt: null,
        declinedAt: null,
        inviterName: 'Admin User'
      });

      const result = await invitationService.validateToken(token);

      expect(result.valid).toBe(true);
      expect(result.email).toBe('test@example.com');
      expect(mockInvitationRepository.findByToken).toHaveBeenCalledWith(hashedToken);
    });

    it('should reject an expired token', async () => {
      const token = 'expired-token';
      
      mockInvitationRepository.findByToken.mockResolvedValue({
        invitationId: 'invitation-id',
        email: 'test@example.com',
        expiresAt: new Date(Date.now() - 1000), // Expired
        acceptedAt: null,
        declinedAt: null
      });

      const result = await invitationService.validateToken(token);

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Invitation has expired');
    });

    it('should reject an already accepted invitation', async () => {
      const token = 'accepted-token';
      
      mockInvitationRepository.findByToken.mockResolvedValue({
        invitationId: 'invitation-id',
        email: 'test@example.com',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        acceptedAt: new Date(),
        declinedAt: null
      });

      const result = await invitationService.validateToken(token);

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Invitation already accepted');
    });

    it('should reject a revoked invitation', async () => {
      const token = 'revoked-token';
      
      mockInvitationRepository.findByToken.mockResolvedValue({
        invitationId: 'invitation-id',
        email: 'test@example.com',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        acceptedAt: null,
        declinedAt: new Date()
      });

      const result = await invitationService.validateToken(token);

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Invitation was revoked');
    });

    it('should reject an invalid token', async () => {
      const token = 'invalid-token';
      
      mockInvitationRepository.findByToken.mockResolvedValue(null);

      const result = await invitationService.validateToken(token);

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Invalid invitation token');
    });
  });

  describe('acceptInvitation', () => {
    it('should successfully accept an invitation and create user', async () => {
      const token = 'valid-token';
      const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
      
      // Mock token validation
      jest.spyOn(invitationService, 'validateToken').mockResolvedValue({
        valid: true,
        email: 'test@example.com'
      });

      mockInvitationRepository.findByToken.mockResolvedValue({
        invitationId: 'invitation-id',
        email: 'test@example.com',
        invitedBy: 'admin-user-id',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        acceptedAt: null,
        declinedAt: null
      });

      mockUserRepository.findByUsername.mockResolvedValue(null);
      mockUserRepository.create.mockResolvedValue({
        userId: 'new-user-id',
        username: 'testuser',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        createdAt: new Date(),
        accountStatus: 'active',
        schemaPrefix: 'user_testuser'
      });

      mockAuthService.generateTokens.mockReturnValue({
        token: 'auth-token',
        refreshToken: 'refresh-token'
      });

      const result = await invitationService.acceptInvitation({
        token,
        password: 'SecurePassword123',
        firstName: 'Test',
        lastName: 'User',
        username: 'testuser',
        acceptTerms: true,
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent'
      });

      expect(result.user).toBeDefined();
      expect(result.user.username).toBe('testuser');
      expect(result.tokens).toBeDefined();
      expect(mockInvitationRepository.markAccepted).toHaveBeenCalledWith('invitation-id');
      expect(mockEmailService.sendWelcome).toHaveBeenCalled();
      expect(mockUserRepository.createUserSchema).toHaveBeenCalledWith('user_testuser');
    });

    it('should reject invalid password format', async () => {
      await expect(invitationService.acceptInvitation({
        token: 'valid-token',
        password: 'weak',
        firstName: 'Test',
        lastName: 'User',
        username: 'testuser',
        acceptTerms: true
      })).rejects.toThrow(ValidationError);
    });

    it('should reject if terms not accepted', async () => {
      await expect(invitationService.acceptInvitation({
        token: 'valid-token',
        password: 'SecurePassword123',
        firstName: 'Test',
        lastName: 'User',
        username: 'testuser',
        acceptTerms: false
      })).rejects.toThrow(ValidationError);
    });

    it('should reject if username already exists', async () => {
      jest.spyOn(invitationService, 'validateToken').mockResolvedValue({
        valid: true,
        email: 'test@example.com'
      });

      mockInvitationRepository.findByToken.mockResolvedValue({
        invitationId: 'invitation-id',
        email: 'test@example.com',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        acceptedAt: null
      });

      mockUserRepository.findByUsername.mockResolvedValue({
        userId: 'existing-user-id',
        username: 'testuser'
      });

      await expect(invitationService.acceptInvitation({
        token: 'valid-token',
        password: 'SecurePassword123',
        firstName: 'Test',
        lastName: 'User',
        username: 'testuser',
        acceptTerms: true
      })).rejects.toThrow(ConflictError);
    });
  });

  describe('resendInvitation', () => {
    it('should successfully resend an invitation', async () => {
      const invitationId = 'invitation-id';
      
      mockInvitationRepository.findById.mockResolvedValue({
        invitationId,
        email: 'test@example.com',
        acceptedAt: null,
        declinedAt: null,
        inviterName: 'Admin User',
        metadata: { customMessage: 'Welcome!' }
      });

      mockInvitationRepository.updateToken.mockResolvedValue(true);
      mockEmailService.sendInvitation.mockResolvedValue(true);

      const result = await invitationService.resendInvitation(invitationId, 'admin-user-id');

      expect(result.success).toBe(true);
      expect(mockInvitationRepository.updateToken).toHaveBeenCalled();
      expect(mockEmailService.sendInvitation).toHaveBeenCalled();
      expect(mockAuditService.log).toHaveBeenCalled();
    });

    it('should reject resending non-existent invitation', async () => {
      mockInvitationRepository.findById.mockResolvedValue(null);

      await expect(invitationService.resendInvitation('invalid-id', 'admin-user-id'))
        .rejects.toThrow(NotFoundError);
    });

    it('should reject resending accepted invitation', async () => {
      mockInvitationRepository.findById.mockResolvedValue({
        invitationId: 'invitation-id',
        acceptedAt: new Date()
      });

      await expect(invitationService.resendInvitation('invitation-id', 'admin-user-id'))
        .rejects.toThrow(ValidationError);
    });
  });

  describe('revokeInvitation', () => {
    it('should successfully revoke an invitation', async () => {
      const invitationId = 'invitation-id';
      
      mockInvitationRepository.findById.mockResolvedValue({
        invitationId,
        email: 'test@example.com',
        acceptedAt: null,
        declinedAt: null
      });

      mockInvitationRepository.markDeclined.mockResolvedValue(true);

      const result = await invitationService.revokeInvitation(invitationId, 'admin-user-id');

      expect(result.success).toBe(true);
      expect(mockInvitationRepository.markDeclined).toHaveBeenCalledWith(invitationId);
      expect(mockAuditService.log).toHaveBeenCalled();
    });

    it('should reject revoking accepted invitation', async () => {
      mockInvitationRepository.findById.mockResolvedValue({
        invitationId: 'invitation-id',
        acceptedAt: new Date()
      });

      await expect(invitationService.revokeInvitation('invitation-id', 'admin-user-id'))
        .rejects.toThrow(ValidationError);
    });
  });

  describe('sendReminders', () => {
    it('should send reminders for pending invitations', async () => {
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      
      mockInvitationRepository.findPendingNeedingReminder.mockResolvedValue([
        {
          invitationId: 'invitation-1',
          email: 'test1@example.com',
          expiresAt: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
          inviterName: 'Admin User',
          metadata: { originalToken: 'token-1' }
        },
        {
          invitationId: 'invitation-2',
          email: 'test2@example.com',
          expiresAt: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
          inviterName: 'Admin User',
          metadata: { originalToken: 'token-2' }
        }
      ]);

      mockEmailService.sendInvitationReminder.mockResolvedValue(true);
      mockInvitationRepository.markReminderSent.mockResolvedValue(true);

      const result = await invitationService.sendReminders();

      expect(result.sent).toBe(2);
      expect(result.failed).toBe(0);
      expect(mockEmailService.sendInvitationReminder).toHaveBeenCalledTimes(2);
      expect(mockInvitationRepository.markReminderSent).toHaveBeenCalledTimes(2);
    });
  });

  describe('cleanupExpired', () => {
    it('should delete expired invitations', async () => {
      mockInvitationRepository.deleteExpired.mockResolvedValue(5);

      const result = await invitationService.cleanupExpired();

      expect(result).toBe(5);
      expect(mockInvitationRepository.deleteExpired).toHaveBeenCalled();
    });
  });
});