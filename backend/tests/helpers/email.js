/**
 * Mock email service for testing
 */
class MockEmailService {
  constructor() {
    this.sentEmails = [];
  }

  /**
   * Send email (mock)
   */
  async sendEmail(to, subject, body, type = 'general') {
    const email = {
      id: `email_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      to,
      subject,
      body,
      type,
      sentAt: new Date()
    };

    this.sentEmails.push(email);
    return email;
  }

  /**
   * Send deletion reminder
   */
  async sendDeletionReminder(userId, daysRemaining) {
    const typeMap = {
      6: 'deletion_reminder_day_1',
      4: 'deletion_reminder_day_3',
      1: 'deletion_final_warning'
    };

    return this.sendEmail(
      userId,
      `Account Deletion - ${daysRemaining} days remaining`,
      `Your account is scheduled for deletion in ${daysRemaining} days.`,
      typeMap[daysRemaining] || 'deletion_reminder'
    );
  }

  /**
   * Get emails sent to a user
   */
  getEmailsSentTo(userId) {
    return this.sentEmails.filter(email => email.to === userId);
  }

  /**
   * Get emails by type
   */
  getEmailsByType(type) {
    return this.sentEmails.filter(email => email.type === type);
  }

  /**
   * Clear sent emails
   */
  clearSentEmails() {
    this.sentEmails = [];
  }

  /**
   * Get all sent emails
   */
  getAllSentEmails() {
    return this.sentEmails;
  }
}

// Create singleton instance
const emailService = new MockEmailService();

/**
 * Get emails sent to user
 */
async function getEmailsSentTo(userId) {
  return emailService.getEmailsSentTo(userId);
}

/**
 * Send deletion reminder email
 */
async function sendDeletionReminder(userId, daysRemaining) {
  return emailService.sendDeletionReminder(userId, daysRemaining);
}

/**
 * Clear all sent emails
 */
function clearSentEmails() {
  emailService.clearSentEmails();
}

/**
 * Process scheduled email jobs
 */
async function processScheduledJobs() {
  // Simulate processing scheduled deletion reminders
  const { query } = require('./database');
  
  const pendingDeletions = await query(
    `SELECT id, deletion_scheduled_at 
     FROM pf_users 
     WHERE account_status = 'pending_deletion'`
  );

  for (const user of pendingDeletions) {
    const daysRemaining = Math.ceil(
      (new Date(user.DELETION_SCHEDULED_AT) - new Date()) / (1000 * 60 * 60 * 24)
    );

    if ([6, 4, 1].includes(daysRemaining)) {
      await sendDeletionReminder(user.ID, daysRemaining);
    }
  }
}

module.exports = {
  emailService,
  getEmailsSentTo,
  sendDeletionReminder,
  clearSentEmails,
  processScheduledJobs
};