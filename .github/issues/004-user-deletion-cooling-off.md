---
name: Security Feature  
about: Implement security-related features or improvements
title: 'feat: [Security] Implement 7-day cooling-off period for user deletion'
labels: security, user-management, priority:high, gdpr, compliance
assignees: ''

---

## 📋 Description
Implement a user deletion system with a 7-day cooling-off period for self-deletion requests. Users can cancel deletion during this period, with automated email reminders. Site admins can override the cooling-off period for immediate deletion. The system ensures GDPR compliance while preventing accidental data loss.

## 🎯 Acceptance Criteria
- [ ] User self-deletion triggers 7-day cooling-off period
- [ ] Account remains accessible during cooling-off with warning banner
- [ ] Users can cancel deletion at any time during cooling-off
- [ ] Email reminders sent at days 1, 3, and 6
- [ ] Site admin can override cooling-off for immediate deletion
- [ ] Only site admin can permanently delete users (not regular admin)
- [ ] Automatic permanent deletion after 7 days via scheduled job
- [ ] All deletion activities comprehensively audit logged
- [ ] Data anonymization option for GDPR compliance
- [ ] Export user data before deletion
- [ ] Cascade deletion to all user-specific tables
- [ ] Recovery mechanism for accidental deletions within 30 days

## 🔒 Security Considerations
- **Impact on existing security**: Protects against accidental or malicious deletion
- **New vulnerabilities mitigated**:
  - Prevents impulsive account deletion
  - Protects against account hijacking deletion
  - Enables recovery from mistaken deletions
  - Maintains audit trail for compliance
- **Compliance requirements**:
  - GDPR Article 17: Right to erasure
  - CCPA: Consumer deletion rights
  - HIPAA: Retention requirements for health data
  - Data retention policies

## 📊 Technical Implementation

### Database Schema
```sql
-- User deletion queue with enhanced tracking
CREATE TABLE pf_user_deletion_queue (
    user_id VARCHAR2(36) PRIMARY KEY,
    deletion_requested_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deletion_scheduled_for TIMESTAMP NOT NULL,
    deletion_type VARCHAR2(20) DEFAULT 'soft', -- soft, hard, anonymize
    requested_by VARCHAR2(36) NOT NULL,
    cancellation_token VARCHAR2(255) UNIQUE,
    reason VARCHAR2(500),
    category VARCHAR2(50), -- self, admin, compliance, inactive
    status VARCHAR2(20) DEFAULT 'pending',
    override_cooling_off NUMBER(1) DEFAULT 0,
    
    -- Reminder tracking
    reminder_1_sent NUMBER(1) DEFAULT 0,
    reminder_3_sent NUMBER(1) DEFAULT 0,
    reminder_6_sent NUMBER(1) DEFAULT 0,
    last_reminder_at TIMESTAMP,
    
    -- Data export
    data_export_requested NUMBER(1) DEFAULT 0,
    data_export_completed NUMBER(1) DEFAULT 0,
    export_url VARCHAR2(500),
    export_expires_at TIMESTAMP,
    
    -- Processing
    processed_at TIMESTAMP,
    processed_by VARCHAR2(36),
    error_message VARCHAR2(1000),
    retry_count NUMBER(3) DEFAULT 0,
    
    FOREIGN KEY (user_id) REFERENCES pf_users(id),
    FOREIGN KEY (requested_by) REFERENCES pf_users(id),
    FOREIGN KEY (processed_by) REFERENCES pf_users(id),
    CONSTRAINT chk_deletion_status CHECK (status IN 
        ('pending', 'cancelled', 'processing', 'completed', 'failed'))
);

-- Deletion backup for recovery
CREATE TABLE pf_deleted_users_backup (
    deletion_id VARCHAR2(36) PRIMARY KEY,
    user_id VARCHAR2(36) NOT NULL,
    user_data CLOB NOT NULL, -- JSON backup of all user data
    deleted_at TIMESTAMP NOT NULL,
    deleted_by VARCHAR2(36),
    recovery_available_until TIMESTAMP,
    recovered NUMBER(1) DEFAULT 0,
    recovered_at TIMESTAMP,
    recovered_by VARCHAR2(36),
    FOREIGN KEY (deleted_by) REFERENCES pf_users(id),
    FOREIGN KEY (recovered_by) REFERENCES pf_users(id)
);

-- Anonymized data for GDPR compliance
CREATE TABLE pf_anonymized_users (
    anonymization_id VARCHAR2(36) PRIMARY KEY,
    original_user_id VARCHAR2(36) UNIQUE,
    anonymized_at TIMESTAMP NOT NULL,
    retention_reason VARCHAR2(500),
    data_categories_retained VARCHAR2(1000), -- JSON array
    expiry_date DATE,
    legal_basis VARCHAR2(100)
);

-- Indexes for performance
CREATE INDEX idx_deletion_queue_status ON pf_user_deletion_queue(status, deletion_scheduled_for);
CREATE INDEX idx_deletion_queue_reminders ON pf_user_deletion_queue(status, reminder_1_sent, reminder_3_sent, reminder_6_sent);
CREATE INDEX idx_deleted_backup_recovery ON pf_deleted_users_backup(recovery_available_until, recovered);
```

### Backend Implementation
```javascript
// backend/src/services/userDeletionService.js
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
    const existing = await this.db.query(
      'SELECT * FROM pf_user_deletion_queue WHERE user_id = ? AND status = ?',
      [userId, 'pending']
    );

    if (existing) {
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
    await this.db.query(`
      INSERT INTO pf_user_deletion_queue (
        user_id, deletion_scheduled_for, requested_by,
        cancellation_token, reason, category, status,
        data_export_requested
      ) VALUES (?, ?, ?, ?, ?, ?, 'pending', 1)
    `, [
      userId, deletionDate, requestedBy,
      cancellationToken, reason,
      userId === requestedBy ? 'self' : 'admin'
    ]);

    // Start data export
    await this.exportService.exportUserData(userId);

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
    const deletion = await this.db.query(
      'SELECT * FROM pf_user_deletion_queue WHERE user_id = ? AND cancellation_token = ?',
      [userId, cancellationToken]
    );

    if (!deletion || deletion.status !== 'pending') {
      throw new Error('Invalid cancellation token or deletion not pending');
    }

    // Update status
    await this.db.query(
      'UPDATE pf_user_deletion_queue SET status = ? WHERE user_id = ?',
      ['cancelled', userId]
    );

    // Notify user
    await this.sendDeletionNotification(userId, 'cancelled');

    // Audit log
    await this.auditLogger.log({
      action: 'user_deletion_cancelled',
      user_id: userId,
      cancelled_at: new Date()
    });

    return { success: true };
  }

  async overrideDeletion(userId, adminId) {
    // Verify site admin role
    const adminRoles = await this.getUserRoles(adminId);
    if (!adminRoles.includes('site_admin')) {
      throw new Error('Only site admins can override deletion cooling-off');
    }

    // Update deletion to immediate
    await this.db.query(`
      UPDATE pf_user_deletion_queue 
      SET override_cooling_off = 1,
          deletion_scheduled_for = CURRENT_TIMESTAMP,
          status = 'processing'
      WHERE user_id = ? AND status = 'pending'
    `, [userId]);

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
    try {
      // Start transaction
      await this.db.beginTransaction();

      // Create backup before deletion
      const backupData = await this.createBackup(userId);

      // Check deletion type
      const queue = await this.db.query(
        'SELECT * FROM pf_user_deletion_queue WHERE user_id = ?',
        [userId]
      );

      if (queue.deletion_type === 'anonymize') {
        await this.anonymizeUser(userId);
      } else {
        await this.deleteUserData(userId);
      }

      // Update queue status
      await this.db.query(`
        UPDATE pf_user_deletion_queue 
        SET status = 'completed',
            processed_at = CURRENT_TIMESTAMP,
            processed_by = ?
        WHERE user_id = ?
      `, ['system', userId]);

      // Store backup for recovery
      await this.db.query(`
        INSERT INTO pf_deleted_users_backup (
          deletion_id, user_id, user_data,
          deleted_at, deleted_by, recovery_available_until
        ) VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?, ?)
      `, [
        crypto.randomUUID(),
        userId,
        JSON.stringify(backupData),
        queue.requested_by,
        new Date(Date.now() + 30*24*60*60*1000) // 30 days
      ]);

      await this.db.commit();

      // Send confirmation
      await this.sendDeletionNotification(userId, 'completed');

      // Audit log
      await this.auditLogger.log({
        action: 'user_deletion_completed',
        user_id: userId,
        deletion_type: queue.deletion_type,
        immediate: immediate
      });

    } catch (error) {
      await this.db.rollback();
      
      // Update queue with error
      await this.db.query(`
        UPDATE pf_user_deletion_queue 
        SET status = 'failed',
            error_message = ?,
            retry_count = retry_count + 1
        WHERE user_id = ?
      `, [error.message, userId]);

      throw error;
    }
  }

  async deleteUserData(userId) {
    // Get list of user-specific tables
    const userTables = await this.getUserTables(userId);

    // Delete from each table
    for (const table of userTables) {
      await this.db.query(`DROP TABLE IF EXISTS ${table}`);
    }

    // Delete from core tables
    const coreTables = [
      'pf_user_sessions',
      'pf_user_roles',
      'pf_user_passwords',
      'pf_user_preferences',
      'pf_user_profiles'
    ];

    for (const table of coreTables) {
      await this.db.query(`DELETE FROM ${table} WHERE user_id = ?`, [userId]);
    }

    // Finally delete user record
    await this.db.query('DELETE FROM pf_users WHERE id = ?', [userId]);
  }

  async anonymizeUser(userId) {
    // Generate anonymous identifier
    const anonId = `ANON_${crypto.randomBytes(16).toString('hex')}`;

    // Update user record
    await this.db.query(`
      UPDATE pf_users 
      SET username = ?,
          email = ?,
          full_name = 'Anonymous User',
          first_name = NULL,
          last_name = NULL,
          phone = NULL,
          bio = NULL,
          avatar_url = NULL,
          is_active = 0,
          account_status = 'anonymized'
      WHERE id = ?
    `, [anonId, `${anonId}@anonymous.local`, userId]);

    // Record anonymization
    await this.db.query(`
      INSERT INTO pf_anonymized_users (
        anonymization_id, original_user_id,
        anonymized_at, retention_reason
      ) VALUES (?, ?, CURRENT_TIMESTAMP, ?)
    `, [crypto.randomUUID(), userId, 'User requested anonymization']);
  }

  async sendReminders() {
    // Day 1 reminders
    const day1Users = await this.db.query(`
      SELECT * FROM pf_user_deletion_queue 
      WHERE status = 'pending'
      AND reminder_1_sent = 0
      AND deletion_requested_at < DATE_SUB(NOW(), INTERVAL 1 DAY)
    `);

    for (const user of day1Users) {
      await this.sendDeletionNotification(user.user_id, 'reminder_day_1', {
        daysRemaining: 6,
        cancellationToken: user.cancellation_token
      });
      
      await this.db.query(
        'UPDATE pf_user_deletion_queue SET reminder_1_sent = 1 WHERE user_id = ?',
        [user.user_id]
      );
    }

    // Day 3 reminders
    const day3Users = await this.db.query(`
      SELECT * FROM pf_user_deletion_queue 
      WHERE status = 'pending'
      AND reminder_3_sent = 0
      AND deletion_requested_at < DATE_SUB(NOW(), INTERVAL 3 DAY)
    `);

    for (const user of day3Users) {
      await this.sendDeletionNotification(user.user_id, 'reminder_day_3', {
        daysRemaining: 4,
        cancellationToken: user.cancellation_token
      });
      
      await this.db.query(
        'UPDATE pf_user_deletion_queue SET reminder_3_sent = 1 WHERE user_id = ?',
        [user.user_id]
      );
    }

    // Day 6 reminders (final warning)
    const day6Users = await this.db.query(`
      SELECT * FROM pf_user_deletion_queue 
      WHERE status = 'pending'
      AND reminder_6_sent = 0
      AND deletion_requested_at < DATE_SUB(NOW(), INTERVAL 6 DAY)
    `);

    for (const user of day6Users) {
      await this.sendDeletionNotification(user.user_id, 'final_warning', {
        hoursRemaining: 24,
        cancellationToken: user.cancellation_token
      });
      
      await this.db.query(
        'UPDATE pf_user_deletion_queue SET reminder_6_sent = 1 WHERE user_id = ?',
        [user.user_id]
      );
    }
  }

  async processScheduledDeletions() {
    // Find users ready for deletion
    const readyForDeletion = await this.db.query(`
      SELECT * FROM pf_user_deletion_queue 
      WHERE status = 'pending'
      AND deletion_scheduled_for <= CURRENT_TIMESTAMP
    `);

    for (const user of readyForDeletion) {
      try {
        await this.processDeletion(user.user_id);
      } catch (error) {
        console.error(`Failed to delete user ${user.user_id}:`, error);
        
        // Retry logic
        if (user.retry_count < 3) {
          // Reschedule for 1 hour later
          await this.db.query(`
            UPDATE pf_user_deletion_queue 
            SET deletion_scheduled_for = DATE_ADD(NOW(), INTERVAL 1 HOUR)
            WHERE user_id = ?
          `, [user.user_id]);
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
    const backup = await this.db.query(`
      SELECT * FROM pf_deleted_users_backup 
      WHERE user_id = ? 
      AND recovered = 0
      AND recovery_available_until > CURRENT_TIMESTAMP
    `, [userId]);

    if (!backup) {
      throw new Error('No recoverable backup found');
    }

    // Restore user data
    const userData = JSON.parse(backup.user_data);
    await this.restoreUserData(userId, userData);

    // Mark as recovered
    await this.db.query(`
      UPDATE pf_deleted_users_backup 
      SET recovered = 1,
          recovered_at = CURRENT_TIMESTAMP,
          recovered_by = ?
      WHERE user_id = ?
    `, [adminId, userId]);

    // Audit log
    await this.auditLogger.criticalLog({
      action: 'user_recovered',
      user_id: userId,
      admin_id: adminId,
      alert: 'USER_DATA_RECOVERED'
    });

    return { success: true };
  }
}

// Scheduled job for processing deletions
class DeletionScheduler {
  constructor(deletionService) {
    this.deletionService = deletionService;
  }

  start() {
    // Send reminders every hour
    setInterval(() => {
      this.deletionService.sendReminders();
    }, 60 * 60 * 1000);

    // Process deletions every 15 minutes
    setInterval(() => {
      this.deletionService.processScheduledDeletions();
    }, 15 * 60 * 1000);

    // Clean old backups daily
    setInterval(() => {
      this.cleanOldBackups();
    }, 24 * 60 * 60 * 1000);
  }

  async cleanOldBackups() {
    await this.db.query(`
      DELETE FROM pf_deleted_users_backup 
      WHERE recovery_available_until < CURRENT_TIMESTAMP
      AND recovered = 0
    `);
  }
}
```

### Frontend Implementation
```javascript
// frontend/src/components/AccountDeletion.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { WarningBanner } from './WarningBanner';

export function AccountDeletion() {
  const [deletionStatus, setDeletionStatus] = useState(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    checkDeletionStatus();
  }, []);

  const checkDeletionStatus = async () => {
    const response = await api.get(`/users/${user.id}/deletion-status`);
    setDeletionStatus(response.data);
  };

  const requestDeletion = async (reason) => {
    if (!window.confirm(
      'Are you sure you want to delete your account?\n\n' +
      'This action will:\n' +
      '• Schedule your account for deletion in 7 days\n' +
      '• Send you email reminders\n' +
      '• Allow you to cancel anytime within 7 days\n' +
      '• Permanently delete all your data after 7 days'
    )) {
      return;
    }

    const response = await api.delete(`/users/${user.id}`, {
      data: { 
        confirmation: 'DELETE',
        reason 
      }
    });

    setDeletionStatus(response.data);
    localStorage.setItem('deletion_token', response.data.cancellationToken);
  };

  const cancelDeletion = async () => {
    const token = localStorage.getItem('deletion_token');
    await api.post(`/users/${user.id}/cancel-deletion`, {
      cancellation_token: token
    });
    
    localStorage.removeItem('deletion_token');
    setDeletionStatus(null);
  };

  if (deletionStatus?.is_scheduled) {
    const daysRemaining = Math.ceil(
      (new Date(deletionStatus.scheduled_for) - new Date()) / (1000 * 60 * 60 * 24)
    );

    return (
      <div className="deletion-warning">
        <WarningBanner type="critical">
          <h3>⚠️ Account Scheduled for Deletion</h3>
          <p>Your account will be permanently deleted in {daysRemaining} days.</p>
          <p>Deletion date: {new Date(deletionStatus.scheduled_for).toLocaleDateString()}</p>
          <button onClick={cancelDeletion} className="btn-primary">
            Cancel Deletion
          </button>
        </WarningBanner>
      </div>
    );
  }

  return (
    <div className="account-deletion">
      <h3>Delete Account</h3>
      <p>Once you delete your account, there is no going back for 7 days.</p>
      <button 
        onClick={() => setShowConfirmDialog(true)}
        className="btn-danger"
      >
        Delete My Account
      </button>

      {showConfirmDialog && (
        <DeletionConfirmDialog
          onConfirm={requestDeletion}
          onCancel={() => setShowConfirmDialog(false)}
        />
      )}
    </div>
  );
}
```

## 🧪 Testing Requirements
- [ ] Unit tests for deletion queue management
- [ ] Unit tests for reminder scheduling
- [ ] Integration tests for complete deletion flow
- [ ] Integration tests for cancellation flow
- [ ] Integration tests for admin override
- [ ] Security tests for token validation
- [ ] Load tests for bulk deletions
- [ ] E2E tests for user experience
- [ ] Recovery tests for backup restoration

### Test Scenarios
```javascript
describe('User Deletion with Cooling-Off', () => {
  test('Self-deletion triggers 7-day wait', async () => {
    const result = await requestDeletion(userId, userId);
    const daysDiff = differenceInDays(result.scheduledFor, new Date());
    expect(daysDiff).toBe(7);
  });

  test('Reminders sent on schedule', async () => {
    await requestDeletion(userId);
    
    // Fast-forward 1 day
    jest.advanceTimersByTime(24 * 60 * 60 * 1000);
    await sendReminders();
    expect(emailService.send).toHaveBeenCalledWith('reminder_day_1');
    
    // Fast-forward to day 3
    jest.advanceTimersByTime(2 * 24 * 60 * 60 * 1000);
    await sendReminders();
    expect(emailService.send).toHaveBeenCalledWith('reminder_day_3');
  });

  test('Only site admin can override cooling-off', async () => {
    await requestDeletion(userId);
    
    // Regular admin cannot override
    await expect(overrideDeletion(userId, adminId))
      .rejects.toThrow('Only site admins');
    
    // Site admin can override
    await overrideDeletion(userId, siteAdminId);
    expect(getUserById(userId)).toBeNull();
  });

  test('Deleted user data is recoverable for 30 days', async () => {
    await processDeletion(userId);
    
    // Can recover within 30 days
    await recoverUser(userId, siteAdminId);
    expect(getUserById(userId)).toBeDefined();
    
    // Cannot recover after 30 days
    jest.advanceTimersByTime(31 * 24 * 60 * 60 * 1000);
    await expect(recoverUser(userId, siteAdminId))
      .rejects.toThrow('No recoverable backup');
  });
});
```

## 📚 Documentation Updates
- [ ] Create user guide for account deletion
- [ ] Document cooling-off period policy
- [ ] Add GDPR compliance documentation
- [ ] Create admin guide for deletion management
- [ ] Document data recovery procedures
- [ ] Add troubleshooting guide
- [ ] Create legal compliance checklist

## ⚠️ Breaking Changes
None - New functionality that doesn't affect existing features.

## 🔗 Dependencies
- Depends on:
  - #1 (RBAC for site admin permissions)
- Blocks:
  - GDPR compliance certification
  - User data management features

## 📈 Success Metrics
- **User Protection:**
  - Accidental deletion prevention rate > 95%
  - Successful cancellation rate when attempted
  - Zero unintended data loss incidents
  
- **Compliance:**
  - GDPR request completion < 30 days
  - 100% audit trail for deletions
  - Data retention policy adherence 100%
  
- **Operational:**
  - Deletion job success rate > 99%
  - Reminder delivery rate > 99%
  - Recovery success rate when needed 100%
  
- **User Experience:**
  - Clear understanding of process (survey)
  - Cancellation process satisfaction > 90%
  - Support ticket reduction for deletions

---

**Estimated Effort**: 8 story points
**Sprint**: 1 (Critical Security)
**Target Completion**: Week 2
**Compliance Impact**: Critical for GDPR/CCPA