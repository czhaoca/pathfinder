const crypto = require('crypto');
const { differenceInDays } = require('date-fns');

class UserDeletionService {
  constructor(db, emailService, exportService, auditLogger) {
    this.db = db;
    this.emailService = emailService;
    this.exportService = exportService;
    this.auditLogger = auditLogger;
  }

  async requestDeletion(userId, requestedBy, reason, isAdmin = false) {
    // Validate permissions
    if (userId !== requestedBy && !isAdmin) {
      throw new Error('Users can only delete their own accounts');
    }

    // Check if already in deletion queue
    const existing = await this.db.execute(
      `SELECT * FROM pf_user_deletion_queue 
       WHERE user_id = :userId AND status = :status`,
      { userId, status: 'pending' }
    );

    if (existing.rows.length > 0) {
      throw new Error('Deletion already in progress');
    }

    // Check for data retention requirements
    const retentionRequired = await this.checkRetentionRequirements(userId);
    if (retentionRequired.required) {
      throw new Error(`Data retention required: ${retentionRequired.reason}`);
    }

    // Generate cancellation token
    const cancellationToken = crypto.randomBytes(32).toString('hex');
    
    // Calculate deletion date (7 days from now)
    const deletionDate = new Date();
    deletionDate.setDate(deletionDate.getDate() + 7);

    // Insert into deletion queue
    await this.db.execute(`
      INSERT INTO pf_user_deletion_queue (
        user_id, deletion_scheduled_for, requested_by,
        cancellation_token, reason, category, status,
        data_export_requested
      ) VALUES (:userId, :deletionDate, :requestedBy, 
               :cancellationToken, :reason, :category, 'pending', 1)
    `, {
      userId,
      deletionDate,
      requestedBy,
      cancellationToken,
      reason,
      category: userId === requestedBy ? 'self' : 'admin'
    });

    // Start data export
    this.exportService.exportUserData(userId).catch(err => {
      console.error('Failed to start data export:', err);
    });

    // Send initial notification
    await this.sendDeletionNotification(userId, 'initiated', {
      scheduledDate: deletionDate,
      cancellationToken
    });

    // Audit log
    await this.auditLogger.log({
      action: 'user_deletion_requested',
      user_id: userId,
      requested_by: requestedBy,
      scheduled_for: deletionDate,
      reason: reason
    });

    return {
      scheduledFor: deletionDate,
      cancellationToken,
      canBeCancelled: true
    };
  }

  async cancelDeletion(userId, cancellationToken) {
    // Verify token
    const deletion = await this.db.execute(
      `SELECT * FROM pf_user_deletion_queue 
       WHERE user_id = :userId AND cancellation_token = :token 
       AND status = 'pending'`,
      { userId, token: cancellationToken }
    );

    if (!deletion.rows || deletion.rows.length === 0) {
      throw new Error('Invalid cancellation token or deletion not pending');
    }

    // Update status
    await this.db.execute(
      `UPDATE pf_user_deletion_queue 
       SET status = 'cancelled' 
       WHERE user_id = :userId`,
      { userId }
    );

    // Notify user
    await this.sendDeletionNotification(userId, 'cancelled');

    // Audit log
    await this.auditLogger.log({
      action: 'user_deletion_cancelled',
      user_id: userId,
      cancelled_at: new Date()
    });

    return { success: true, message: 'Deletion cancelled successfully' };
  }

  async overrideDeletion(userId, adminId) {
    // Verify site admin role
    const adminRoles = await this.getUserRoles(adminId);
    if (!adminRoles.includes('site_admin')) {
      throw new Error('Only site admins can override deletion cooling-off period');
    }

    // Update deletion to immediate
    await this.db.execute(`
      UPDATE pf_user_deletion_queue 
      SET override_cooling_off = 1,
          deletion_scheduled_for = CURRENT_TIMESTAMP,
          status = 'processing'
      WHERE user_id = :userId AND status = 'pending'
    `, { userId });

    // Process deletion immediately
    await this.processDeletion(userId, true);

    // Audit log with alert
    await this.auditLogger.criticalLog({
      action: 'user_deletion_override',
      user_id: userId,
      admin_id: adminId,
      alert: 'IMMEDIATE_DELETION'
    });
  }

  async processDeletion(userId, immediate = false) {
    const connection = await this.db.getConnection();
    
    try {
      // Start transaction
      await connection.execute('BEGIN');

      // Create backup before deletion
      const backupData = await this.createBackup(userId, connection);

      // Check deletion type
      const queueResult = await connection.execute(
        'SELECT * FROM pf_user_deletion_queue WHERE user_id = :userId',
        { userId }
      );
      const queue = queueResult.rows[0];

      if (queue.DELETION_TYPE === 'anonymize') {
        await this.anonymizeUser(userId, connection);
      } else {
        await this.deleteUserData(userId, connection);
      }

      // Update queue status
      await connection.execute(`
        UPDATE pf_user_deletion_queue 
        SET status = 'completed',
            processed_at = CURRENT_TIMESTAMP,
            processed_by = :processedBy
        WHERE user_id = :userId
      `, { processedBy: 'system', userId });

      // Store backup for recovery
      const deletionId = crypto.randomUUID();
      const recoveryDate = new Date();
      recoveryDate.setDate(recoveryDate.getDate() + 30);

      await connection.execute(`
        INSERT INTO pf_deleted_users_backup (
          deletion_id, user_id, user_data,
          deleted_at, deleted_by, recovery_available_until
        ) VALUES (:deletionId, :userId, :userData, 
                  CURRENT_TIMESTAMP, :deletedBy, :recoveryDate)
      `, {
        deletionId,
        userId,
        userData: JSON.stringify(backupData),
        deletedBy: queue.REQUESTED_BY,
        recoveryDate
      });

      await connection.execute('COMMIT');
      await connection.close();

      // Send confirmation
      await this.sendDeletionNotification(userId, 'completed');

      // Audit log
      await this.auditLogger.log({
        action: 'user_deletion_completed',
        user_id: userId,
        deletion_type: queue.DELETION_TYPE,
        immediate: immediate
      });

    } catch (error) {
      await connection.execute('ROLLBACK');
      await connection.close();
      
      // Update queue with error
      await this.db.execute(`
        UPDATE pf_user_deletion_queue 
        SET status = 'failed',
            error_message = :errorMsg,
            retry_count = retry_count + 1
        WHERE user_id = :userId
      `, { errorMsg: error.message, userId });

      throw error;
    }
  }

  async createBackup(userId, connection) {
    const backup = {
      user: {},
      profiles: {},
      sessions: [],
      roles: [],
      preferences: {},
      experiences: []
    };

    // Backup user record
    const userResult = await connection.execute(
      'SELECT * FROM pf_users WHERE id = :userId',
      { userId }
    );
    backup.user = userResult.rows[0];

    // Backup profile
    const profileResult = await connection.execute(
      'SELECT * FROM pf_user_profiles WHERE user_id = :userId',
      { userId }
    );
    backup.profiles = profileResult.rows[0] || {};

    // Backup roles
    const rolesResult = await connection.execute(
      'SELECT * FROM pf_user_roles WHERE user_id = :userId',
      { userId }
    );
    backup.roles = rolesResult.rows;

    // Backup preferences
    const prefsResult = await connection.execute(
      'SELECT * FROM pf_user_preferences WHERE user_id = :userId',
      { userId }
    );
    backup.preferences = prefsResult.rows[0] || {};

    // Get user-specific tables
    const userTables = await this.getUserTables(userId, connection);
    backup.userTables = {};

    for (const tableName of userTables) {
      const tableData = await connection.execute(
        `SELECT * FROM ${tableName}`
      );
      backup.userTables[tableName] = tableData.rows;
    }

    return backup;
  }

  async deleteUserData(userId, connection) {
    // Get list of user-specific tables
    const userTables = await this.getUserTables(userId, connection);

    // Delete from each user-specific table
    for (const table of userTables) {
      await connection.execute(`DROP TABLE ${table} PURGE`);
    }

    // Delete from core tables
    const coreTables = [
      'pf_user_sessions',
      'pf_user_roles',
      'pf_user_passwords',
      'pf_user_preferences',
      'pf_user_profiles',
      'pf_audit_log'
    ];

    for (const table of coreTables) {
      await connection.execute(
        `DELETE FROM ${table} WHERE user_id = :userId`,
        { userId }
      );
    }

    // Finally delete user record
    await connection.execute(
      'DELETE FROM pf_users WHERE id = :userId',
      { userId }
    );
  }

  async anonymizeUser(userId, connection) {
    // Generate anonymous identifier
    const anonId = `ANON_${crypto.randomBytes(16).toString('hex')}`;

    // Update user record
    await connection.execute(`
      UPDATE pf_users 
      SET username = :anonId,
          email = :email,
          full_name = 'Anonymous User',
          first_name = NULL,
          last_name = NULL,
          phone = NULL,
          bio = NULL,
          avatar_url = NULL,
          is_active = 0,
          account_status = 'anonymized'
      WHERE id = :userId
    `, {
      anonId,
      email: `${anonId}@anonymous.local`,
      userId
    });

    // Record anonymization
    await connection.execute(`
      INSERT INTO pf_anonymized_users (
        anonymization_id, original_user_id,
        anonymized_at, retention_reason
      ) VALUES (:anonId, :userId, CURRENT_TIMESTAMP, :reason)
    `, {
      anonId: crypto.randomUUID(),
      userId,
      reason: 'User requested anonymization'
    });

    // Clear personal data from related tables
    await connection.execute(
      `UPDATE pf_user_profiles 
       SET bio = NULL, location = NULL, company = NULL 
       WHERE user_id = :userId`,
      { userId }
    );
  }

  async getUserTables(userId, connection) {
    // Get username for table prefix
    const userResult = await connection.execute(
      'SELECT username FROM pf_users WHERE id = :userId',
      { userId }
    );
    
    if (!userResult.rows || userResult.rows.length === 0) {
      return [];
    }

    const username = userResult.rows[0].USERNAME;
    const tablePrefix = `career_nav_${username.toLowerCase()}_`;

    // Get all tables with user prefix
    const tablesResult = await connection.execute(`
      SELECT table_name 
      FROM user_tables 
      WHERE table_name LIKE :prefix
    `, { prefix: `${tablePrefix.toUpperCase()}%` });

    return tablesResult.rows.map(row => row.TABLE_NAME);
  }

  async getUserRoles(userId) {
    const result = await this.db.execute(
      `SELECT r.role_name 
       FROM pf_user_roles ur
       JOIN pf_roles r ON ur.role_id = r.id
       WHERE ur.user_id = :userId`,
      { userId }
    );

    return result.rows.map(row => row.ROLE_NAME);
  }

  async checkRetentionRequirements(userId) {
    // Check for legal holds
    const legalHold = await this.db.execute(
      `SELECT * FROM pf_legal_holds 
       WHERE user_id = :userId 
       AND status = 'active'`,
      { userId }
    );

    if (legalHold.rows && legalHold.rows.length > 0) {
      return {
        required: true,
        reason: 'User data under legal hold'
      };
    }

    // Check for pending investigations
    const investigations = await this.db.execute(
      `SELECT * FROM pf_audit_log 
       WHERE user_id = :userId 
       AND action LIKE '%investigation%' 
       AND created_at > CURRENT_TIMESTAMP - INTERVAL '90' DAY`,
      { userId }
    );

    if (investigations.rows && investigations.rows.length > 0) {
      return {
        required: true,
        reason: 'User data required for ongoing investigation'
      };
    }

    return { required: false };
  }

  async sendDeletionNotification(userId, type, data = {}) {
    // Get user email
    const userResult = await this.db.execute(
      'SELECT email, full_name FROM pf_users WHERE id = :userId',
      { userId }
    );

    if (!userResult.rows || userResult.rows.length === 0) {
      return;
    }

    const user = userResult.rows[0];
    const templates = {
      initiated: {
        subject: 'Account Deletion Scheduled',
        template: 'deletion-initiated'
      },
      reminder_day_1: {
        subject: 'Account Deletion Reminder - 6 Days Remaining',
        template: 'deletion-reminder'
      },
      reminder_day_3: {
        subject: 'Account Deletion Reminder - 4 Days Remaining',
        template: 'deletion-reminder'
      },
      final_warning: {
        subject: 'FINAL WARNING: Account Deletion in 24 Hours',
        template: 'deletion-final-warning'
      },
      cancelled: {
        subject: 'Account Deletion Cancelled',
        template: 'deletion-cancelled'
      },
      completed: {
        subject: 'Account Successfully Deleted',
        template: 'deletion-completed'
      }
    };

    const emailConfig = templates[type];
    if (!emailConfig) return;

    await this.emailService.send({
      to: user.EMAIL,
      subject: emailConfig.subject,
      template: emailConfig.template,
      data: {
        name: user.FULL_NAME,
        ...data
      }
    });
  }

  async sendReminders() {
    // Day 1 reminders
    const day1Users = await this.db.execute(`
      SELECT * FROM pf_user_deletion_queue 
      WHERE status = 'pending'
      AND reminder_1_sent = 0
      AND deletion_requested_at < CURRENT_TIMESTAMP - INTERVAL '1' DAY
    `);

    for (const user of day1Users.rows) {
      await this.sendDeletionNotification(user.USER_ID, 'reminder_day_1', {
        daysRemaining: 6,
        cancellationToken: user.CANCELLATION_TOKEN
      });
      
      await this.db.execute(
        'UPDATE pf_user_deletion_queue SET reminder_1_sent = 1, last_reminder_at = CURRENT_TIMESTAMP WHERE user_id = :userId',
        { userId: user.USER_ID }
      );
    }

    // Day 3 reminders
    const day3Users = await this.db.execute(`
      SELECT * FROM pf_user_deletion_queue 
      WHERE status = 'pending'
      AND reminder_3_sent = 0
      AND deletion_requested_at < CURRENT_TIMESTAMP - INTERVAL '3' DAY
    `);

    for (const user of day3Users.rows) {
      await this.sendDeletionNotification(user.USER_ID, 'reminder_day_3', {
        daysRemaining: 4,
        cancellationToken: user.CANCELLATION_TOKEN
      });
      
      await this.db.execute(
        'UPDATE pf_user_deletion_queue SET reminder_3_sent = 1, last_reminder_at = CURRENT_TIMESTAMP WHERE user_id = :userId',
        { userId: user.USER_ID }
      );
    }

    // Day 6 reminders (final warning)
    const day6Users = await this.db.execute(`
      SELECT * FROM pf_user_deletion_queue 
      WHERE status = 'pending'
      AND reminder_6_sent = 0
      AND deletion_requested_at < CURRENT_TIMESTAMP - INTERVAL '6' DAY
    `);

    for (const user of day6Users.rows) {
      await this.sendDeletionNotification(user.USER_ID, 'final_warning', {
        hoursRemaining: 24,
        cancellationToken: user.CANCELLATION_TOKEN
      });
      
      await this.db.execute(
        'UPDATE pf_user_deletion_queue SET reminder_6_sent = 1, last_reminder_at = CURRENT_TIMESTAMP WHERE user_id = :userId',
        { userId: user.USER_ID }
      );
    }
  }

  async processScheduledDeletions() {
    // Find users ready for deletion
    const readyForDeletion = await this.db.execute(`
      SELECT * FROM pf_user_deletion_queue 
      WHERE status = 'pending'
      AND deletion_scheduled_for <= CURRENT_TIMESTAMP
    `);

    for (const user of readyForDeletion.rows) {
      try {
        await this.processDeletion(user.USER_ID);
      } catch (error) {
        console.error(`Failed to delete user ${user.USER_ID}:`, error);
        
        // Retry logic
        if (user.RETRY_COUNT < 3) {
          // Reschedule for 1 hour later
          await this.db.execute(`
            UPDATE pf_user_deletion_queue 
            SET deletion_scheduled_for = CURRENT_TIMESTAMP + INTERVAL '1' HOUR
            WHERE user_id = :userId
          `, { userId: user.USER_ID });
        }
      }
    }
  }

  async recoverDeletedUser(userId, adminId) {
    // Verify site admin
    const adminRoles = await this.getUserRoles(adminId);
    if (!adminRoles.includes('site_admin')) {
      throw new Error('Only site admins can recover deleted users');
    }

    // Find backup
    const backupResult = await this.db.execute(`
      SELECT * FROM pf_deleted_users_backup 
      WHERE user_id = :userId 
      AND recovered = 0
      AND recovery_available_until > CURRENT_TIMESTAMP
    `, { userId });

    if (!backupResult.rows || backupResult.rows.length === 0) {
      throw new Error('No recoverable backup found for this user');
    }

    const backup = backupResult.rows[0];
    const userData = JSON.parse(backup.USER_DATA);

    // Restore user data
    await this.restoreUserData(userId, userData);

    // Mark as recovered
    await this.db.execute(`
      UPDATE pf_deleted_users_backup 
      SET recovered = 1,
          recovered_at = CURRENT_TIMESTAMP,
          recovered_by = :adminId
      WHERE user_id = :userId
    `, { adminId, userId });

    // Audit log
    await this.auditLogger.criticalLog({
      action: 'user_recovered',
      user_id: userId,
      admin_id: adminId,
      alert: 'USER_DATA_RECOVERED'
    });

    return { success: true, message: 'User successfully recovered' };
  }

  async restoreUserData(userId, userData) {
    const connection = await this.db.getConnection();
    
    try {
      await connection.execute('BEGIN');

      // Restore user record
      if (userData.user) {
        const user = userData.user;
        await connection.execute(`
          INSERT INTO pf_users (
            id, username, email, full_name, first_name, last_name,
            phone, bio, avatar_url, is_active, account_status,
            created_at, updated_at
          ) VALUES (
            :id, :username, :email, :fullName, :firstName, :lastName,
            :phone, :bio, :avatarUrl, :isActive, :accountStatus,
            :createdAt, :updatedAt
          )
        `, {
          id: user.ID,
          username: user.USERNAME,
          email: user.EMAIL,
          fullName: user.FULL_NAME,
          firstName: user.FIRST_NAME,
          lastName: user.LAST_NAME,
          phone: user.PHONE,
          bio: user.BIO,
          avatarUrl: user.AVATAR_URL,
          isActive: 1,
          accountStatus: 'active',
          createdAt: user.CREATED_AT,
          updatedAt: new Date()
        });
      }

      // Restore profile
      if (userData.profiles) {
        const profile = userData.profiles;
        await connection.execute(`
          INSERT INTO pf_user_profiles (
            user_id, bio, location, company, title, linkedin_url
          ) VALUES (
            :userId, :bio, :location, :company, :title, :linkedinUrl
          )
        `, {
          userId,
          bio: profile.BIO,
          location: profile.LOCATION,
          company: profile.COMPANY,
          title: profile.TITLE,
          linkedinUrl: profile.LINKEDIN_URL
        });
      }

      // Restore roles
      for (const role of userData.roles) {
        await connection.execute(`
          INSERT INTO pf_user_roles (user_id, role_id, assigned_at, assigned_by)
          VALUES (:userId, :roleId, :assignedAt, :assignedBy)
        `, {
          userId,
          roleId: role.ROLE_ID,
          assignedAt: role.ASSIGNED_AT,
          assignedBy: role.ASSIGNED_BY
        });
      }

      // Restore user-specific tables
      if (userData.userTables) {
        for (const [tableName, tableData] of Object.entries(userData.userTables)) {
          // Recreate table structure (would need schema info in backup)
          // For now, assuming tables can be recreated from migrations
          // This would need enhancement to store table DDL in backup
        }
      }

      await connection.execute('COMMIT');
      await connection.close();
    } catch (error) {
      await connection.execute('ROLLBACK');
      await connection.close();
      throw error;
    }
  }

  async getDeletionStatus(userId) {
    const result = await this.db.execute(
      `SELECT * FROM pf_user_deletion_queue 
       WHERE user_id = :userId 
       AND status IN ('pending', 'processing')`,
      { userId }
    );

    if (!result.rows || result.rows.length === 0) {
      return null;
    }

    const deletion = result.rows[0];
    return {
      isScheduled: true,
      scheduledFor: deletion.DELETION_SCHEDULED_FOR,
      requestedAt: deletion.DELETION_REQUESTED_AT,
      canCancel: deletion.STATUS === 'pending',
      type: deletion.DELETION_TYPE,
      reason: deletion.REASON
    };
  }

  async cleanOldBackups() {
    const result = await this.db.execute(`
      DELETE FROM pf_deleted_users_backup 
      WHERE recovery_available_until < CURRENT_TIMESTAMP
      AND recovered = 0
    `);

    console.log(`Cleaned ${result.rowsAffected} old backups`);
  }
}

module.exports = UserDeletionService;