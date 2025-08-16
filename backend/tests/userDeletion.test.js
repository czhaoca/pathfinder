const UserDeletionService = require('../src/services/userDeletionService');
const DeletionScheduler = require('../src/services/deletionScheduler');
const EmailService = require('../src/services/emailService');
const ExportService = require('../src/services/exportService');
const AuditLogger = require('../src/services/auditLogger');
const { differenceInDays, addDays } = require('date-fns');

// Mock dependencies
jest.mock('../src/services/emailService');
jest.mock('../src/services/exportService');
jest.mock('../src/services/auditLogger');

describe('User Deletion with Cooling-Off Period', () => {
  let deletionService;
  let mockDb;
  let mockEmailService;
  let mockExportService;
  let mockAuditLogger;

  beforeEach(() => {
    // Setup mock database
    mockDb = {
      execute: jest.fn(),
      getConnection: jest.fn()
    };

    // Setup mock services
    mockEmailService = new EmailService();
    mockExportService = new ExportService();
    mockAuditLogger = new AuditLogger();

    // Initialize deletion service
    deletionService = new UserDeletionService(
      mockDb,
      mockEmailService,
      mockExportService,
      mockAuditLogger
    );

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('Deletion Request', () => {
    test('Self-deletion triggers 7-day cooling-off period', async () => {
      const userId = 'user-123';
      const requestedBy = 'user-123';

      // Mock database responses
      mockDb.execute.mockResolvedValueOnce({ rows: [] }); // No existing deletion
      mockDb.execute.mockResolvedValueOnce({ rows: [] }); // No retention requirements
      mockDb.execute.mockResolvedValueOnce({ rowsAffected: 1 }); // Insert deletion queue

      const result = await deletionService.requestDeletion(userId, requestedBy, 'Test reason');

      expect(result).toHaveProperty('scheduledFor');
      expect(result).toHaveProperty('cancellationToken');
      expect(result.canBeCancelled).toBe(true);

      // Check that deletion is scheduled for 7 days
      const daysDiff = differenceInDays(new Date(result.scheduledFor), new Date());
      expect(daysDiff).toBe(7);
    });

    test('Users cannot delete other users accounts', async () => {
      const userId = 'user-123';
      const requestedBy = 'user-456';

      await expect(
        deletionService.requestDeletion(userId, requestedBy, 'Test reason', false)
      ).rejects.toThrow('Users can only delete their own accounts');
    });

    test('Admin can request deletion for other users', async () => {
      const userId = 'user-123';
      const adminId = 'admin-456';

      mockDb.execute.mockResolvedValueOnce({ rows: [] }); // No existing deletion
      mockDb.execute.mockResolvedValueOnce({ rows: [] }); // No retention requirements
      mockDb.execute.mockResolvedValueOnce({ rowsAffected: 1 }); // Insert deletion queue

      const result = await deletionService.requestDeletion(
        userId, 
        adminId, 
        'Admin requested', 
        true
      );

      expect(result).toHaveProperty('scheduledFor');
      expect(result.canBeCancelled).toBe(true);
    });

    test('Cannot request deletion if already pending', async () => {
      const userId = 'user-123';

      mockDb.execute.mockResolvedValueOnce({ 
        rows: [{ USER_ID: userId, STATUS: 'pending' }] 
      });

      await expect(
        deletionService.requestDeletion(userId, userId, 'Test')
      ).rejects.toThrow('Deletion already in progress');
    });

    test('Deletion blocked if data retention required', async () => {
      const userId = 'user-123';

      mockDb.execute.mockResolvedValueOnce({ rows: [] }); // No existing deletion
      
      // Mock retention requirement check
      deletionService.checkRetentionRequirements = jest.fn().mockResolvedValue({
        required: true,
        reason: 'Legal hold active'
      });

      await expect(
        deletionService.requestDeletion(userId, userId, 'Test')
      ).rejects.toThrow('Data retention required: Legal hold active');
    });
  });

  describe('Deletion Cancellation', () => {
    test('User can cancel their own deletion request', async () => {
      const userId = 'user-123';
      const cancellationToken = 'valid-token';

      mockDb.execute.mockResolvedValueOnce({
        rows: [{
          USER_ID: userId,
          CANCELLATION_TOKEN: cancellationToken,
          STATUS: 'pending'
        }]
      });
      mockDb.execute.mockResolvedValueOnce({ rowsAffected: 1 }); // Update status

      const result = await deletionService.cancelDeletion(userId, cancellationToken);

      expect(result.success).toBe(true);
      expect(mockEmailService.send).toHaveBeenCalled();
      expect(mockAuditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'user_deletion_cancelled',
          user_id: userId
        })
      );
    });

    test('Cannot cancel with invalid token', async () => {
      const userId = 'user-123';
      const invalidToken = 'invalid-token';

      mockDb.execute.mockResolvedValueOnce({ rows: [] });

      await expect(
        deletionService.cancelDeletion(userId, invalidToken)
      ).rejects.toThrow('Invalid cancellation token or deletion not pending');
    });

    test('Cannot cancel completed deletion', async () => {
      const userId = 'user-123';
      const token = 'valid-token';

      mockDb.execute.mockResolvedValueOnce({
        rows: [{
          USER_ID: userId,
          CANCELLATION_TOKEN: token,
          STATUS: 'completed'
        }]
      });

      await expect(
        deletionService.cancelDeletion(userId, token)
      ).rejects.toThrow('Invalid cancellation token or deletion not pending');
    });
  });

  describe('Admin Override', () => {
    test('Site admin can override cooling-off period', async () => {
      const userId = 'user-123';
      const siteAdminId = 'admin-456';

      // Mock getUserRoles to return site_admin
      deletionService.getUserRoles = jest.fn().mockResolvedValue(['site_admin']);

      // Mock database operations
      mockDb.execute.mockResolvedValueOnce({ rowsAffected: 1 }); // Update to immediate
      
      // Mock processDeletion
      deletionService.processDeletion = jest.fn().mockResolvedValue(true);

      await deletionService.overrideDeletion(userId, siteAdminId);

      expect(deletionService.processDeletion).toHaveBeenCalledWith(userId, true);
      expect(mockAuditLogger.criticalLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'user_deletion_override',
          user_id: userId,
          admin_id: siteAdminId,
          alert: 'IMMEDIATE_DELETION'
        })
      );
    });

    test('Regular admin cannot override cooling-off', async () => {
      const userId = 'user-123';
      const adminId = 'admin-456';

      deletionService.getUserRoles = jest.fn().mockResolvedValue(['admin']);

      await expect(
        deletionService.overrideDeletion(userId, adminId)
      ).rejects.toThrow('Only site admins can override deletion cooling-off period');
    });
  });

  describe('Reminders', () => {
    test('Day 1 reminder sent after 24 hours', async () => {
      const userId = 'user-123';
      const requestedAt = new Date();
      requestedAt.setDate(requestedAt.getDate() - 2); // 2 days ago

      mockDb.execute.mockResolvedValueOnce({
        rows: [{
          USER_ID: userId,
          CANCELLATION_TOKEN: 'token',
          DELETION_REQUESTED_AT: requestedAt,
          REMINDER_1_SENT: 0
        }]
      });

      mockDb.execute.mockResolvedValueOnce({ rowsAffected: 1 }); // Update reminder sent

      await deletionService.sendReminders();

      expect(mockEmailService.send).toHaveBeenCalled();
    });

    test('Day 3 reminder sent after 3 days', async () => {
      const userId = 'user-123';
      const requestedAt = new Date();
      requestedAt.setDate(requestedAt.getDate() - 4); // 4 days ago

      mockDb.execute.mockResolvedValueOnce({ rows: [] }); // No day 1 reminders
      mockDb.execute.mockResolvedValueOnce({
        rows: [{
          USER_ID: userId,
          CANCELLATION_TOKEN: 'token',
          DELETION_REQUESTED_AT: requestedAt,
          REMINDER_3_SENT: 0
        }]
      });

      mockDb.execute.mockResolvedValueOnce({ rowsAffected: 1 }); // Update reminder sent

      await deletionService.sendReminders();

      expect(mockEmailService.send).toHaveBeenCalled();
    });

    test('Final warning sent on day 6', async () => {
      const userId = 'user-123';
      const requestedAt = new Date();
      requestedAt.setDate(requestedAt.getDate() - 6); // 6 days ago

      mockDb.execute.mockResolvedValueOnce({ rows: [] }); // No day 1 reminders
      mockDb.execute.mockResolvedValueOnce({ rows: [] }); // No day 3 reminders
      mockDb.execute.mockResolvedValueOnce({
        rows: [{
          USER_ID: userId,
          CANCELLATION_TOKEN: 'token',
          DELETION_REQUESTED_AT: requestedAt,
          REMINDER_6_SENT: 0
        }]
      });

      mockDb.execute.mockResolvedValueOnce({ rowsAffected: 1 }); // Update reminder sent

      await deletionService.sendReminders();

      expect(mockEmailService.send).toHaveBeenCalled();
    });
  });

  describe('Scheduled Deletion Processing', () => {
    test('Processes deletions after 7 days', async () => {
      const userId = 'user-123';
      const scheduledFor = new Date();
      scheduledFor.setDate(scheduledFor.getDate() - 1); // Yesterday (past due)

      mockDb.execute.mockResolvedValueOnce({
        rows: [{
          USER_ID: userId,
          DELETION_SCHEDULED_FOR: scheduledFor,
          STATUS: 'pending',
          RETRY_COUNT: 0
        }]
      });

      // Mock processDeletion
      deletionService.processDeletion = jest.fn().mockResolvedValue(true);

      await deletionService.processScheduledDeletions();

      expect(deletionService.processDeletion).toHaveBeenCalledWith(userId);
    });

    test('Retries failed deletions up to 3 times', async () => {
      const userId = 'user-123';

      mockDb.execute.mockResolvedValueOnce({
        rows: [{
          USER_ID: userId,
          STATUS: 'pending',
          RETRY_COUNT: 2
        }]
      });

      // Mock processDeletion to fail
      deletionService.processDeletion = jest.fn().mockRejectedValue(
        new Error('Processing failed')
      );

      mockDb.execute.mockResolvedValueOnce({ rowsAffected: 1 }); // Reschedule

      await deletionService.processScheduledDeletions();

      expect(deletionService.processDeletion).toHaveBeenCalled();
      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE pf_user_deletion_queue'),
        expect.objectContaining({ userId })
      );
    });
  });

  describe('Data Backup and Recovery', () => {
    test('Creates backup before deletion', async () => {
      const userId = 'user-123';
      const mockConnection = {
        execute: jest.fn(),
        close: jest.fn()
      };

      mockDb.getConnection.mockResolvedValue(mockConnection);
      
      // Mock backup creation
      deletionService.createBackup = jest.fn().mockResolvedValue({
        user: { id: userId },
        profiles: {},
        roles: [],
        preferences: {}
      });

      // Mock queue data
      mockConnection.execute.mockResolvedValueOnce({
        rows: [{ 
          USER_ID: userId, 
          DELETION_TYPE: 'hard',
          REQUESTED_BY: 'user-123'
        }]
      });

      // Mock other operations
      deletionService.deleteUserData = jest.fn().mockResolvedValue(true);
      mockConnection.execute.mockResolvedValue({ rowsAffected: 1 });

      await deletionService.processDeletion(userId);

      expect(deletionService.createBackup).toHaveBeenCalledWith(userId, mockConnection);
    });

    test('Site admin can recover deleted user within 30 days', async () => {
      const userId = 'user-123';
      const siteAdminId = 'admin-456';

      deletionService.getUserRoles = jest.fn().mockResolvedValue(['site_admin']);

      const recoveryDate = new Date();
      recoveryDate.setDate(recoveryDate.getDate() + 10); // 10 days from now

      mockDb.execute.mockResolvedValueOnce({
        rows: [{
          USER_ID: userId,
          USER_DATA: JSON.stringify({ user: { id: userId } }),
          RECOVERY_AVAILABLE_UNTIL: recoveryDate,
          RECOVERED: 0
        }]
      });

      // Mock restore
      deletionService.restoreUserData = jest.fn().mockResolvedValue(true);
      mockDb.execute.mockResolvedValueOnce({ rowsAffected: 1 }); // Mark recovered

      const result = await deletionService.recoverDeletedUser(userId, siteAdminId);

      expect(result.success).toBe(true);
      expect(deletionService.restoreUserData).toHaveBeenCalled();
      expect(mockAuditLogger.criticalLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'user_recovered',
          user_id: userId,
          admin_id: siteAdminId,
          alert: 'USER_DATA_RECOVERED'
        })
      );
    });

    test('Cannot recover after 30 days', async () => {
      const userId = 'user-123';
      const siteAdminId = 'admin-456';

      deletionService.getUserRoles = jest.fn().mockResolvedValue(['site_admin']);

      mockDb.execute.mockResolvedValueOnce({ rows: [] }); // No recoverable backup

      await expect(
        deletionService.recoverDeletedUser(userId, siteAdminId)
      ).rejects.toThrow('No recoverable backup found');
    });

    test('Only site admin can recover users', async () => {
      const userId = 'user-123';
      const adminId = 'admin-456';

      deletionService.getUserRoles = jest.fn().mockResolvedValue(['admin']);

      await expect(
        deletionService.recoverDeletedUser(userId, adminId)
      ).rejects.toThrow('Only site admins can recover deleted users');
    });
  });

  describe('Anonymization', () => {
    test('Can anonymize user instead of delete', async () => {
      const userId = 'user-123';
      const mockConnection = {
        execute: jest.fn(),
        close: jest.fn()
      };

      mockDb.getConnection.mockResolvedValue(mockConnection);

      // Mock backup
      deletionService.createBackup = jest.fn().mockResolvedValue({});

      // Mock queue with anonymize type
      mockConnection.execute.mockResolvedValueOnce({
        rows: [{ 
          USER_ID: userId, 
          DELETION_TYPE: 'anonymize',
          REQUESTED_BY: userId
        }]
      });

      // Mock anonymization operations
      mockConnection.execute.mockResolvedValue({ rowsAffected: 1 });

      await deletionService.processDeletion(userId);

      // Check that anonymization was called
      expect(mockConnection.execute).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE pf_users'),
        expect.objectContaining({
          anonId: expect.stringContaining('ANON_'),
          email: expect.stringContaining('@anonymous.local'),
          userId
        })
      );
    });
  });

  describe('Deletion Scheduler', () => {
    test('Scheduler starts all jobs', () => {
      const scheduler = new DeletionScheduler(deletionService, mockDb);
      
      scheduler.start();

      expect(scheduler.jobs.length).toBeGreaterThan(0);
      
      scheduler.stop();
    });

    test('Scheduler cleans old backups daily', async () => {
      const scheduler = new DeletionScheduler(deletionService, mockDb);
      
      mockDb.execute.mockResolvedValueOnce({ rowsAffected: 5 });

      await deletionService.cleanOldBackups();

      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM pf_deleted_users_backup')
      );
    });
  });

  describe('Export Service', () => {
    test('Exports user data before deletion', async () => {
      const userId = 'user-123';
      const exportService = new ExportService(mockDb);

      // Mock database queries
      mockDb.execute.mockImplementation((query) => {
        if (query.includes('pf_users')) {
          return { rows: [{ ID: userId, USERNAME: 'testuser' }] };
        }
        return { rows: [] };
      });

      // Mock file operations
      jest.spyOn(exportService, 'writeDataFiles').mockResolvedValue();
      jest.spyOn(exportService, 'createArchive').mockResolvedValue('/tmp/export.zip');
      jest.spyOn(exportService, 'generateDownloadUrl').mockResolvedValue('http://example.com/download');

      const result = await exportService.exportUserData(userId);

      expect(result).toHaveProperty('exportId');
      expect(result).toHaveProperty('downloadUrl');
      expect(result).toHaveProperty('expiresAt');
    });
  });
});