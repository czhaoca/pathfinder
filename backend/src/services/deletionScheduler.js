const cron = require('node-cron');

class DeletionScheduler {
  constructor(deletionService, db) {
    this.deletionService = deletionService;
    this.db = db;
    this.jobs = [];
  }

  start() {
    console.log('Starting deletion scheduler...');

    // Send reminders every hour at minute 0
    const reminderJob = cron.schedule('0 * * * *', async () => {
      console.log('Running deletion reminders...');
      try {
        await this.deletionService.sendReminders();
      } catch (error) {
        console.error('Error sending deletion reminders:', error);
      }
    });
    this.jobs.push(reminderJob);

    // Process deletions every 15 minutes
    const deletionJob = cron.schedule('*/15 * * * *', async () => {
      console.log('Processing scheduled deletions...');
      try {
        await this.deletionService.processScheduledDeletions();
      } catch (error) {
        console.error('Error processing scheduled deletions:', error);
      }
    });
    this.jobs.push(deletionJob);

    // Clean old backups daily at 3 AM
    const cleanupJob = cron.schedule('0 3 * * *', async () => {
      console.log('Cleaning old deletion backups...');
      try {
        await this.deletionService.cleanOldBackups();
      } catch (error) {
        console.error('Error cleaning old backups:', error);
      }
    });
    this.jobs.push(cleanupJob);

    // Check for failed deletions and retry every hour
    const retryJob = cron.schedule('30 * * * *', async () => {
      console.log('Retrying failed deletions...');
      try {
        await this.retryFailedDeletions();
      } catch (error) {
        console.error('Error retrying failed deletions:', error);
      }
    });
    this.jobs.push(retryJob);

    console.log('Deletion scheduler started successfully');
  }

  stop() {
    console.log('Stopping deletion scheduler...');
    this.jobs.forEach(job => job.stop());
    this.jobs = [];
    console.log('Deletion scheduler stopped');
  }

  async retryFailedDeletions() {
    const failedDeletions = await this.db.execute(`
      SELECT * FROM pf_user_deletion_queue 
      WHERE status = 'failed' 
      AND retry_count < 3
      AND processed_at < CURRENT_TIMESTAMP - INTERVAL '1' HOUR
    `);

    for (const deletion of failedDeletions.rows) {
      console.log(`Retrying deletion for user ${deletion.USER_ID}`);
      try {
        await this.deletionService.processDeletion(deletion.USER_ID);
      } catch (error) {
        console.error(`Retry failed for user ${deletion.USER_ID}:`, error);
      }
    }
  }

  async getSchedulerStatus() {
    const pendingDeletions = await this.db.execute(`
      SELECT COUNT(*) as count FROM pf_user_deletion_queue 
      WHERE status = 'pending'
    `);

    const failedDeletions = await this.db.execute(`
      SELECT COUNT(*) as count FROM pf_user_deletion_queue 
      WHERE status = 'failed'
    `);

    const completedToday = await this.db.execute(`
      SELECT COUNT(*) as count FROM pf_user_deletion_queue 
      WHERE status = 'completed' 
      AND processed_at > CURRENT_TIMESTAMP - INTERVAL '1' DAY
    `);

    return {
      isRunning: this.jobs.length > 0,
      pendingDeletions: pendingDeletions.rows[0].COUNT,
      failedDeletions: failedDeletions.rows[0].COUNT,
      completedToday: completedToday.rows[0].COUNT,
      activeJobs: this.jobs.length
    };
  }
}

module.exports = DeletionScheduler;