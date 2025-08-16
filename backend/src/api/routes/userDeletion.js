const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const UserDeletionService = require('../../services/userDeletionService');
const EmailService = require('../../services/emailService');
const ExportService = require('../../services/exportService');
const AuditLogger = require('../../services/auditLogger');

// Initialize services (in production, use dependency injection)
let deletionService;

const initDeletionService = (db) => {
  const emailService = new EmailService();
  const exportService = new ExportService(db);
  const auditLogger = new AuditLogger(db);
  deletionService = new UserDeletionService(db, emailService, exportService, auditLogger);
};

// Request account deletion (self or admin)
router.delete('/users/:userId', authenticate, async (req, res) => {
  try {
    const { userId } = req.params;
    const { confirmation, reason } = req.body;
    const requestingUser = req.user.id;

    // Verify confirmation
    if (confirmation !== 'DELETE') {
      return res.status(400).json({
        error: 'Please confirm deletion by providing confirmation: "DELETE"'
      });
    }

    // Check if user is deleting own account or is an admin
    const isAdmin = req.user.roles && req.user.roles.includes('admin');
    if (userId !== requestingUser && !isAdmin) {
      return res.status(403).json({
        error: 'You can only delete your own account'
      });
    }

    const result = await deletionService.requestDeletion(
      userId,
      requestingUser,
      reason || 'User requested deletion',
      isAdmin
    );

    res.json({
      message: 'Account scheduled for deletion',
      scheduledFor: result.scheduledFor,
      cancellationToken: result.cancellationToken,
      canBeCancelled: result.canBeCancelled
    });
  } catch (error) {
    console.error('Error requesting deletion:', error);
    res.status(400).json({ error: error.message });
  }
});

// Cancel deletion request
router.post('/users/:userId/cancel-deletion', authenticate, async (req, res) => {
  try {
    const { userId } = req.params;
    const { cancellation_token } = req.body;

    // Verify user is cancelling own deletion
    if (userId !== req.user.id) {
      return res.status(403).json({
        error: 'You can only cancel your own deletion request'
      });
    }

    const result = await deletionService.cancelDeletion(userId, cancellation_token);
    res.json(result);
  } catch (error) {
    console.error('Error cancelling deletion:', error);
    res.status(400).json({ error: error.message });
  }
});

// Get deletion status
router.get('/users/:userId/deletion-status', authenticate, async (req, res) => {
  try {
    const { userId } = req.params;

    // Verify user is checking own status or is admin
    const isAdmin = req.user.roles && req.user.roles.includes('admin');
    if (userId !== req.user.id && !isAdmin) {
      return res.status(403).json({
        error: 'You can only check your own deletion status'
      });
    }

    const status = await deletionService.getDeletionStatus(userId);
    
    if (!status) {
      return res.json({
        isScheduled: false,
        message: 'No deletion scheduled for this account'
      });
    }

    res.json(status);
  } catch (error) {
    console.error('Error getting deletion status:', error);
    res.status(500).json({ error: 'Failed to get deletion status' });
  }
});

// Admin: Override deletion (immediate deletion)
router.post('/admin/users/:userId/override-deletion', 
  authenticate, 
  requireRole('site_admin'), 
  async (req, res) => {
    try {
      const { userId } = req.params;
      const adminId = req.user.id;

      await deletionService.overrideDeletion(userId, adminId);

      res.json({
        message: 'User deletion override successful',
        deletedUserId: userId,
        deletedBy: adminId,
        deletedAt: new Date()
      });
    } catch (error) {
      console.error('Error overriding deletion:', error);
      res.status(400).json({ error: error.message });
    }
});

// Admin: Recover deleted user
router.post('/admin/users/:userId/recover',
  authenticate,
  requireRole('site_admin'),
  async (req, res) => {
    try {
      const { userId } = req.params;
      const adminId = req.user.id;

      const result = await deletionService.recoverDeletedUser(userId, adminId);

      res.json({
        message: 'User successfully recovered',
        recoveredUserId: userId,
        recoveredBy: adminId,
        recoveredAt: new Date()
      });
    } catch (error) {
      console.error('Error recovering user:', error);
      res.status(400).json({ error: error.message });
    }
});

// Admin: Get deletion queue
router.get('/admin/deletion-queue',
  authenticate,
  requireRole('admin'),
  async (req, res) => {
    try {
      const { status, limit = 50, offset = 0 } = req.query;

      let query = `
        SELECT 
          dq.*,
          u.username,
          u.email,
          u.full_name,
          ru.username as requested_by_username
        FROM pf_user_deletion_queue dq
        JOIN pf_users u ON dq.user_id = u.id
        LEFT JOIN pf_users ru ON dq.requested_by = ru.id
      `;

      const params = {};
      
      if (status) {
        query += ' WHERE dq.status = :status';
        params.status = status;
      }

      query += ' ORDER BY dq.deletion_scheduled_for ASC';
      query += ' OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY';
      
      params.offset = parseInt(offset);
      params.limit = parseInt(limit);

      const result = await req.db.execute(query, params);

      res.json({
        deletions: result.rows,
        total: result.rows.length,
        offset: parseInt(offset),
        limit: parseInt(limit)
      });
    } catch (error) {
      console.error('Error getting deletion queue:', error);
      res.status(500).json({ error: 'Failed to get deletion queue' });
    }
});

// Admin: Get deletion statistics
router.get('/admin/deletion-stats',
  authenticate,
  requireRole('admin'),
  async (req, res) => {
    try {
      const stats = {};

      // Pending deletions
      const pending = await req.db.execute(`
        SELECT COUNT(*) as count FROM pf_user_deletion_queue 
        WHERE status = 'pending'
      `);
      stats.pending = pending.rows[0].COUNT;

      // Completed deletions (last 30 days)
      const completed = await req.db.execute(`
        SELECT COUNT(*) as count FROM pf_user_deletion_queue 
        WHERE status = 'completed'
        AND processed_at > CURRENT_TIMESTAMP - INTERVAL '30' DAY
      `);
      stats.completedLast30Days = completed.rows[0].COUNT;

      // Cancelled deletions (last 30 days)
      const cancelled = await req.db.execute(`
        SELECT COUNT(*) as count FROM pf_user_deletion_queue 
        WHERE status = 'cancelled'
        AND deletion_requested_at > CURRENT_TIMESTAMP - INTERVAL '30' DAY
      `);
      stats.cancelledLast30Days = cancelled.rows[0].COUNT;

      // Failed deletions
      const failed = await req.db.execute(`
        SELECT COUNT(*) as count FROM pf_user_deletion_queue 
        WHERE status = 'failed'
      `);
      stats.failed = failed.rows[0].COUNT;

      // Recoverable backups
      const recoverable = await req.db.execute(`
        SELECT COUNT(*) as count FROM pf_deleted_users_backup 
        WHERE recovered = 0
        AND recovery_available_until > CURRENT_TIMESTAMP
      `);
      stats.recoverableBackups = recoverable.rows[0].COUNT;

      // Anonymized users
      const anonymized = await req.db.execute(`
        SELECT COUNT(*) as count FROM pf_anonymized_users
      `);
      stats.anonymizedUsers = anonymized.rows[0].COUNT;

      res.json(stats);
    } catch (error) {
      console.error('Error getting deletion stats:', error);
      res.status(500).json({ error: 'Failed to get deletion statistics' });
    }
});

// Initialize deletion service with database
router.initWithDb = (db) => {
  initDeletionService(db);
};

module.exports = router;