const { ulid } = require('ulid');
const logger = require('../utils/logger');

class ReminderService {
  constructor(databaseService, auditService) {
    this.db = databaseService;
    this.auditService = auditService;
  }

  /**
   * Create a reminder
   */
  async createReminder(userId, reminderData) {
    try {
      const reminderId = ulid();
      
      const sql = `
        INSERT INTO pf_follow_up_reminders (
          reminder_id, user_id, contact_id, reminder_type,
          reminder_date, reminder_time, subject, notes,
          is_recurring, recurrence_pattern, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const params = [
        reminderId,
        userId,
        reminderData.contactId,
        reminderData.reminderType || 'follow_up',
        reminderData.reminderDate,
        reminderData.reminderTime || '09:00',
        reminderData.subject,
        reminderData.notes || null,
        reminderData.isRecurring ? 'Y' : 'N',
        reminderData.recurrencePattern || null,
        'pending'
      ];

      await this.db.execute(sql, params);

      // Audit log
      await this.auditService.log({
        userId,
        action: 'reminder.create',
        resourceType: 'reminder',
        resourceId: reminderId,
        details: { 
          contactId: reminderData.contactId,
          type: reminderData.reminderType 
        }
      });

      return { reminderId };
    } catch (error) {
      logger.error('Failed to create reminder', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Get reminder details
   */
  async getReminder(userId, reminderId) {
    try {
      const sql = `
        SELECT 
          r.*,
          c.first_name,
          c.last_name,
          c.current_company,
          c.email
        FROM pf_follow_up_reminders r
        JOIN pf_contacts c ON r.contact_id = c.contact_id
        WHERE r.reminder_id = ? AND r.user_id = ?
      `;

      const result = await this.db.execute(sql, [reminderId, userId]);

      if (result.rows.length === 0) {
        throw new Error('Reminder not found');
      }

      return result.rows[0];
    } catch (error) {
      logger.error('Failed to get reminder', { error: error.message, reminderId });
      throw error;
    }
  }

  /**
   * Update reminder
   */
  async updateReminder(userId, reminderId, updateData) {
    try {
      // Verify ownership
      const checkSql = 'SELECT reminder_id FROM pf_follow_up_reminders WHERE reminder_id = ? AND user_id = ?';
      const checkResult = await this.db.execute(checkSql, [reminderId, userId]);
      
      if (checkResult.rows.length === 0) {
        throw new Error('Reminder not found');
      }

      // Build dynamic update query
      const updateFields = [];
      const params = [];

      const allowedFields = [
        'reminder_date', 'reminder_time', 'subject', 'notes',
        'is_recurring', 'recurrence_pattern', 'status'
      ];

      for (const field of allowedFields) {
        if (updateData[field] !== undefined) {
          updateFields.push(`${field} = ?`);
          params.push(updateData[field]);
        }
      }

      if (updateFields.length === 0) {
        return { message: 'No fields to update' };
      }

      params.push(reminderId, userId);

      const sql = `
        UPDATE pf_follow_up_reminders 
        SET ${updateFields.join(', ')}
        WHERE reminder_id = ? AND user_id = ?
      `;

      await this.db.execute(sql, params);

      // Audit log
      await this.auditService.log({
        userId,
        action: 'reminder.update',
        resourceType: 'reminder',
        resourceId: reminderId,
        details: { updatedFields: Object.keys(updateData) }
      });

      return { success: true };
    } catch (error) {
      logger.error('Failed to update reminder', { error: error.message, reminderId });
      throw error;
    }
  }

  /**
   * Complete a reminder
   */
  async completeReminder(userId, reminderId) {
    try {
      const reminder = await this.getReminder(userId, reminderId);

      if (!reminder) {
        throw new Error('Reminder not found');
      }

      // Update status
      await this.db.execute(
        `UPDATE pf_follow_up_reminders 
         SET status = 'completed', completed_date = CURRENT_TIMESTAMP
         WHERE reminder_id = ? AND user_id = ?`,
        [reminderId, userId]
      );

      // If recurring, create next reminder
      if (reminder.is_recurring === 'Y' && reminder.recurrence_pattern) {
        await this.createNextRecurringReminder(userId, reminder);
      }

      // Audit log
      await this.auditService.log({
        userId,
        action: 'reminder.complete',
        resourceType: 'reminder',
        resourceId: reminderId
      });

      return { success: true };
    } catch (error) {
      logger.error('Failed to complete reminder', { error: error.message, reminderId });
      throw error;
    }
  }

  /**
   * List reminders
   */
  async listReminders(userId, filters = {}) {
    try {
      let sql = `
        SELECT 
          r.*,
          c.first_name,
          c.last_name,
          c.current_company,
          c.email
        FROM pf_follow_up_reminders r
        JOIN pf_contacts c ON r.contact_id = c.contact_id
        WHERE r.user_id = ?
      `;
      const params = [userId];

      // Apply filters
      if (filters.status) {
        sql += ` AND r.status = ?`;
        params.push(filters.status);
      }

      if (filters.contactId) {
        sql += ` AND r.contact_id = ?`;
        params.push(filters.contactId);
      }

      if (filters.reminderType) {
        sql += ` AND r.reminder_type = ?`;
        params.push(filters.reminderType);
      }

      if (filters.startDate) {
        sql += ` AND r.reminder_date >= ?`;
        params.push(filters.startDate);
      }

      if (filters.endDate) {
        sql += ` AND r.reminder_date <= ?`;
        params.push(filters.endDate);
      }

      // Default to pending reminders
      if (!filters.includeCompleted) {
        sql += ` AND r.status = 'pending'`;
      }

      // Sorting
      sql += ` ORDER BY r.reminder_date, r.reminder_time`;

      // Pagination
      if (filters.limit) {
        sql += ` LIMIT ?`;
        params.push(filters.limit);
        
        if (filters.offset) {
          sql += ` OFFSET ?`;
          params.push(filters.offset);
        }
      }

      const result = await this.db.execute(sql, params);

      return result.rows;
    } catch (error) {
      logger.error('Failed to list reminders', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Get upcoming reminders
   */
  async getUpcomingReminders(userId, days = 7) {
    try {
      const sql = `
        SELECT 
          r.*,
          c.first_name,
          c.last_name,
          c.current_company,
          c.email,
          c.relationship_type,
          (SELECT MAX(interaction_date) FROM pf_interactions WHERE contact_id = c.contact_id) as last_interaction
        FROM pf_follow_up_reminders r
        JOIN pf_contacts c ON r.contact_id = c.contact_id
        WHERE r.user_id = ?
          AND r.status = 'pending'
          AND r.reminder_date <= date('now', '+${days} days')
        ORDER BY r.reminder_date, r.reminder_time
      `;

      const result = await this.db.execute(sql, [userId]);

      // Group by date
      const groupedReminders = {};
      result.rows.forEach(reminder => {
        const date = reminder.reminder_date;
        if (!groupedReminders[date]) {
          groupedReminders[date] = [];
        }
        groupedReminders[date].push(reminder);
      });

      return {
        reminders: result.rows,
        grouped_by_date: groupedReminders,
        total_count: result.rows.length
      };
    } catch (error) {
      logger.error('Failed to get upcoming reminders', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Create next recurring reminder
   */
  async createNextRecurringReminder(userId, previousReminder) {
    try {
      const nextDate = this.calculateNextReminderDate(
        previousReminder.reminder_date,
        previousReminder.recurrence_pattern
      );

      if (!nextDate) {
        return null;
      }

      return await this.createReminder(userId, {
        contactId: previousReminder.contact_id,
        reminderType: previousReminder.reminder_type,
        reminderDate: nextDate,
        reminderTime: previousReminder.reminder_time,
        subject: previousReminder.subject,
        notes: previousReminder.notes,
        isRecurring: true,
        recurrencePattern: previousReminder.recurrence_pattern
      });
    } catch (error) {
      logger.error('Failed to create recurring reminder', { error: error.message });
      throw error;
    }
  }

  /**
   * Calculate next reminder date based on pattern
   */
  calculateNextReminderDate(currentDate, pattern) {
    const date = new Date(currentDate);

    switch (pattern) {
      case 'weekly':
        date.setDate(date.getDate() + 7);
        break;
      case 'monthly':
        date.setMonth(date.getMonth() + 1);
        break;
      case 'quarterly':
        date.setMonth(date.getMonth() + 3);
        break;
      case 'yearly':
        date.setFullYear(date.getFullYear() + 1);
        break;
      default:
        return null;
    }

    return date.toISOString().split('T')[0];
  }

  /**
   * Get reminder statistics
   */
  async getReminderStatistics(userId) {
    try {
      const sql = `
        SELECT 
          COUNT(*) as total_reminders,
          COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
          COUNT(CASE WHEN status = 'snoozed' THEN 1 END) as snoozed,
          COUNT(CASE WHEN is_recurring = 'Y' THEN 1 END) as recurring,
          COUNT(CASE WHEN reminder_date < date('now') AND status = 'pending' THEN 1 END) as overdue
        FROM pf_follow_up_reminders
        WHERE user_id = ?
      `;

      const result = await this.db.execute(sql, [userId]);

      // Get completion rate by type
      const typeSql = `
        SELECT 
          reminder_type,
          COUNT(*) as total,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
          ROUND(COUNT(CASE WHEN status = 'completed' THEN 1 END) * 100.0 / COUNT(*), 2) as completion_rate
        FROM pf_follow_up_reminders
        WHERE user_id = ?
        GROUP BY reminder_type
      `;

      const typeResult = await this.db.execute(typeSql, [userId]);

      return {
        overall: result.rows[0],
        by_type: typeResult.rows
      };
    } catch (error) {
      logger.error('Failed to get reminder statistics', { error: error.message });
      throw error;
    }
  }

  /**
   * Bulk create reminders for relationship maintenance
   */
  async createMaintenanceReminders(userId, contacts, frequency = 'quarterly') {
    const results = {
      created: 0,
      failed: 0,
      errors: []
    };

    for (const contact of contacts) {
      try {
        const nextDate = new Date();
        
        // Calculate initial reminder date based on last interaction
        if (contact.last_interaction_date) {
          const lastInteraction = new Date(contact.last_interaction_date);
          const daysSince = Math.floor((nextDate - lastInteraction) / (1000 * 60 * 60 * 24));
          
          // Set reminder based on frequency and time since last interaction
          if (frequency === 'monthly' && daysSince < 30) {
            nextDate.setDate(lastInteraction.getDate() + 30);
          } else if (frequency === 'quarterly' && daysSince < 90) {
            nextDate.setDate(lastInteraction.getDate() + 90);
          }
        }

        await this.createReminder(userId, {
          contactId: contact.contact_id,
          reminderType: 'check_in',
          reminderDate: nextDate.toISOString().split('T')[0],
          subject: `Check in with ${contact.first_name} ${contact.last_name}`,
          notes: `Regular relationship maintenance check-in`,
          isRecurring: true,
          recurrencePattern: frequency
        });

        results.created++;
      } catch (error) {
        results.failed++;
        results.errors.push({
          contact: `${contact.first_name} ${contact.last_name}`,
          error: error.message
        });
      }
    }

    return results;
  }

  /**
   * Get overdue reminders
   */
  async getOverdueReminders(userId) {
    try {
      const sql = `
        SELECT 
          r.*,
          c.first_name,
          c.last_name,
          c.email,
          JULIANDAY('now') - JULIANDAY(r.reminder_date) as days_overdue
        FROM pf_follow_up_reminders r
        JOIN pf_contacts c ON r.contact_id = c.contact_id
        WHERE r.user_id = ?
          AND r.status = 'pending'
          AND r.reminder_date < date('now')
        ORDER BY r.reminder_date
      `;

      const result = await this.db.execute(sql, [userId]);

      return {
        reminders: result.rows,
        total_overdue: result.rows.length,
        oldest_overdue_days: result.rows[0]?.days_overdue || 0
      };
    } catch (error) {
      logger.error('Failed to get overdue reminders', { error: error.message });
      throw error;
    }
  }
}

module.exports = ReminderService;