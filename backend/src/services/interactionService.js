const { ulid } = require('ulid');
const logger = require('../utils/logger');

class InteractionService {
  constructor(databaseService, contactService, auditService) {
    this.db = databaseService;
    this.contactService = contactService;
    this.auditService = auditService;
  }

  /**
   * Log a new interaction
   */
  async logInteraction(userId, interactionData) {
    try {
      // Verify contact belongs to user
      await this.verifyContactOwnership(userId, interactionData.contactId);

      const interactionId = ulid();
      
      const sql = `
        INSERT INTO pf_interactions (
          interaction_id, user_id, contact_id, interaction_type,
          interaction_date, subject, notes, location,
          duration_minutes, sentiment, follow_up_required, value_exchanged
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const params = [
        interactionId,
        userId,
        interactionData.contactId,
        interactionData.interactionType,
        interactionData.interactionDate || new Date(),
        interactionData.subject,
        interactionData.notes,
        interactionData.location || null,
        interactionData.durationMinutes || null,
        interactionData.sentiment || 'neutral',
        interactionData.followUpRequired ? 'Y' : 'N',
        JSON.stringify(interactionData.valueExchanged || {})
      ];

      await this.db.execute(sql, params);

      // Create meeting notes if provided
      if (interactionData.meetingNotes) {
        await this.createMeetingNotes(interactionId, interactionData.meetingNotes);
      }

      // Update relationship strength
      await this.contactService.calculateRelationshipStrength(userId, interactionData.contactId);

      // Create follow-up reminder if requested
      if (interactionData.followUpRequired && interactionData.followUpDate) {
        await this.createFollowUpReminder(userId, interactionData.contactId, {
          reminderDate: interactionData.followUpDate,
          subject: `Follow up: ${interactionData.subject}`,
          notes: interactionData.followUpNotes
        });
      }

      // Audit log
      await this.auditService.log({
        userId,
        action: 'interaction.create',
        resourceType: 'interaction',
        resourceId: interactionId,
        details: { 
          contactId: interactionData.contactId,
          type: interactionData.interactionType 
        }
      });

      return { interactionId };
    } catch (error) {
      logger.error('Failed to log interaction', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Get interaction details
   */
  async getInteraction(userId, interactionId) {
    try {
      const sql = `
        SELECT 
          i.*,
          c.first_name,
          c.last_name,
          c.current_company,
          c.current_title,
          mn.note_id,
          mn.meeting_purpose,
          mn.key_topics,
          mn.action_items,
          mn.next_steps
        FROM pf_interactions i
        JOIN pf_contacts c ON i.contact_id = c.contact_id
        LEFT JOIN pf_meeting_notes mn ON i.interaction_id = mn.interaction_id
        WHERE i.interaction_id = ? AND i.user_id = ?
      `;

      const result = await this.db.execute(sql, [interactionId, userId]);

      if (result.rows.length === 0) {
        throw new Error('Interaction not found');
      }

      const interaction = result.rows[0];
      
      // Parse JSON fields
      interaction.value_exchanged = JSON.parse(interaction.value_exchanged || '{}');
      if (interaction.key_topics) {
        interaction.key_topics = JSON.parse(interaction.key_topics);
      }
      if (interaction.action_items) {
        interaction.action_items = JSON.parse(interaction.action_items);
      }

      return interaction;
    } catch (error) {
      logger.error('Failed to get interaction', { error: error.message, interactionId });
      throw error;
    }
  }

  /**
   * Update interaction
   */
  async updateInteraction(userId, interactionId, updateData) {
    try {
      // Verify ownership
      const checkSql = 'SELECT interaction_id FROM pf_interactions WHERE interaction_id = ? AND user_id = ?';
      const checkResult = await this.db.execute(checkSql, [interactionId, userId]);
      
      if (checkResult.rows.length === 0) {
        throw new Error('Interaction not found');
      }

      // Build dynamic update query
      const updateFields = [];
      const params = [];

      const allowedFields = [
        'subject', 'notes', 'location', 'duration_minutes',
        'sentiment', 'follow_up_required'
      ];

      for (const field of allowedFields) {
        if (updateData[field] !== undefined) {
          updateFields.push(`${field} = ?`);
          params.push(updateData[field]);
        }
      }

      if (updateData.valueExchanged) {
        updateFields.push('value_exchanged = ?');
        params.push(JSON.stringify(updateData.valueExchanged));
      }

      if (updateFields.length === 0) {
        return { message: 'No fields to update' };
      }

      params.push(interactionId, userId);

      const sql = `
        UPDATE pf_interactions 
        SET ${updateFields.join(', ')}
        WHERE interaction_id = ? AND user_id = ?
      `;

      await this.db.execute(sql, params);

      // Update meeting notes if provided
      if (updateData.meetingNotes) {
        await this.updateMeetingNotes(interactionId, updateData.meetingNotes);
      }

      // Audit log
      await this.auditService.log({
        userId,
        action: 'interaction.update',
        resourceType: 'interaction',
        resourceId: interactionId,
        details: { updatedFields: Object.keys(updateData) }
      });

      return { success: true };
    } catch (error) {
      logger.error('Failed to update interaction', { error: error.message, interactionId });
      throw error;
    }
  }

  /**
   * List interactions with filtering
   */
  async listInteractions(userId, filters = {}) {
    try {
      let sql = `
        SELECT 
          i.*,
          c.first_name,
          c.last_name,
          c.current_company,
          c.current_title
        FROM pf_interactions i
        JOIN pf_contacts c ON i.contact_id = c.contact_id
        WHERE i.user_id = ?
      `;
      const params = [userId];

      // Apply filters
      if (filters.contactId) {
        sql += ` AND i.contact_id = ?`;
        params.push(filters.contactId);
      }

      if (filters.interactionType) {
        sql += ` AND i.interaction_type = ?`;
        params.push(filters.interactionType);
      }

      if (filters.startDate) {
        sql += ` AND i.interaction_date >= ?`;
        params.push(filters.startDate);
      }

      if (filters.endDate) {
        sql += ` AND i.interaction_date <= ?`;
        params.push(filters.endDate);
      }

      if (filters.sentiment) {
        sql += ` AND i.sentiment = ?`;
        params.push(filters.sentiment);
      }

      if (filters.followUpRequired) {
        sql += ` AND i.follow_up_required = 'Y'`;
      }

      // Sorting
      sql += ` ORDER BY i.interaction_date DESC`;

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

      // Parse JSON fields
      const interactions = result.rows.map(interaction => ({
        ...interaction,
        value_exchanged: JSON.parse(interaction.value_exchanged || '{}')
      }));

      return interactions;
    } catch (error) {
      logger.error('Failed to list interactions', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Create meeting notes
   */
  async createMeetingNotes(interactionId, notesData) {
    try {
      const noteId = ulid();
      
      const sql = `
        INSERT INTO pf_meeting_notes (
          note_id, interaction_id, meeting_purpose,
          key_topics, action_items, decisions_made,
          next_steps, personal_notes, professional_insights
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const params = [
        noteId,
        interactionId,
        notesData.meetingPurpose,
        JSON.stringify(notesData.keyTopics || []),
        JSON.stringify(notesData.actionItems || []),
        JSON.stringify(notesData.decisionsMade || []),
        notesData.nextSteps || null,
        notesData.personalNotes || null,
        notesData.professionalInsights || null
      ];

      await this.db.execute(sql, params);

      return { noteId };
    } catch (error) {
      logger.error('Failed to create meeting notes', { error: error.message });
      throw error;
    }
  }

  /**
   * Update meeting notes
   */
  async updateMeetingNotes(interactionId, notesData) {
    try {
      // Check if notes exist
      const checkSql = 'SELECT note_id FROM pf_meeting_notes WHERE interaction_id = ?';
      const checkResult = await this.db.execute(checkSql, [interactionId]);

      if (checkResult.rows.length === 0) {
        // Create new notes
        return await this.createMeetingNotes(interactionId, notesData);
      }

      // Update existing notes
      const updateFields = [];
      const params = [];

      if (notesData.meetingPurpose !== undefined) {
        updateFields.push('meeting_purpose = ?');
        params.push(notesData.meetingPurpose);
      }

      if (notesData.keyTopics !== undefined) {
        updateFields.push('key_topics = ?');
        params.push(JSON.stringify(notesData.keyTopics));
      }

      if (notesData.actionItems !== undefined) {
        updateFields.push('action_items = ?');
        params.push(JSON.stringify(notesData.actionItems));
      }

      if (notesData.decisionsMade !== undefined) {
        updateFields.push('decisions_made = ?');
        params.push(JSON.stringify(notesData.decisionsMade));
      }

      if (notesData.nextSteps !== undefined) {
        updateFields.push('next_steps = ?');
        params.push(notesData.nextSteps);
      }

      if (notesData.personalNotes !== undefined) {
        updateFields.push('personal_notes = ?');
        params.push(notesData.personalNotes);
      }

      if (notesData.professionalInsights !== undefined) {
        updateFields.push('professional_insights = ?');
        params.push(notesData.professionalInsights);
      }

      updateFields.push('updated_at = CURRENT_TIMESTAMP');
      params.push(interactionId);

      const sql = `
        UPDATE pf_meeting_notes 
        SET ${updateFields.join(', ')}
        WHERE interaction_id = ?
      `;

      await this.db.execute(sql, params);

      return { success: true };
    } catch (error) {
      logger.error('Failed to update meeting notes', { error: error.message });
      throw error;
    }
  }

  /**
   * Get meeting insights
   */
  async getMeetingInsights(userId, timeframe = 30) {
    try {
      const sql = `
        SELECT 
          COUNT(DISTINCT i.interaction_id) as total_meetings,
          COUNT(DISTINCT i.contact_id) as unique_contacts,
          AVG(i.duration_minutes) as avg_duration,
          COUNT(CASE WHEN i.sentiment = 'positive' THEN 1 END) as positive_meetings,
          COUNT(CASE WHEN i.follow_up_required = 'Y' THEN 1 END) as follow_ups_needed,
          SUM(i.duration_minutes) as total_time_invested
        FROM pf_interactions i
        WHERE i.user_id = ?
          AND i.interaction_type IN ('meeting', 'coffee_chat', 'call')
          AND i.interaction_date >= date('now', '-${timeframe} days')
      `;

      const result = await this.db.execute(sql, [userId]);
      const insights = result.rows[0];

      // Get top contacts by interaction
      const topContactsSql = `
        SELECT 
          c.contact_id,
          c.first_name,
          c.last_name,
          c.current_company,
          COUNT(*) as interaction_count,
          SUM(i.duration_minutes) as total_time
        FROM pf_interactions i
        JOIN pf_contacts c ON i.contact_id = c.contact_id
        WHERE i.user_id = ?
          AND i.interaction_date >= date('now', '-${timeframe} days')
        GROUP BY c.contact_id, c.first_name, c.last_name, c.current_company
        ORDER BY interaction_count DESC
        LIMIT 5
      `;

      const topContactsResult = await this.db.execute(topContactsSql, [userId]);

      // Get common topics
      const topicsSql = `
        SELECT 
          key_topics
        FROM pf_meeting_notes mn
        JOIN pf_interactions i ON mn.interaction_id = i.interaction_id
        WHERE i.user_id = ?
          AND i.interaction_date >= date('now', '-${timeframe} days')
      `;

      const topicsResult = await this.db.execute(topicsSql, [userId]);
      
      // Aggregate topics
      const topicCounts = {};
      topicsResult.rows.forEach(row => {
        const topics = JSON.parse(row.key_topics || '[]');
        topics.forEach(topic => {
          topicCounts[topic] = (topicCounts[topic] || 0) + 1;
        });
      });

      const topTopics = Object.entries(topicCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([topic, count]) => ({ topic, count }));

      return {
        summary: insights,
        top_contacts: topContactsResult.rows,
        common_topics: topTopics,
        timeframe_days: timeframe
      };
    } catch (error) {
      logger.error('Failed to get meeting insights', { error: error.message });
      throw error;
    }
  }

  /**
   * Create follow-up reminder
   */
  async createFollowUpReminder(userId, contactId, reminderData) {
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
        contactId,
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

      return { reminderId };
    } catch (error) {
      logger.error('Failed to create follow-up reminder', { error: error.message });
      throw error;
    }
  }

  /**
   * Verify contact ownership
   */
  async verifyContactOwnership(userId, contactId) {
    const sql = 'SELECT contact_id FROM pf_contacts WHERE contact_id = ? AND user_id = ?';
    const result = await this.db.execute(sql, [contactId, userId]);
    
    if (result.rows.length === 0) {
      throw new Error('Contact not found or access denied');
    }
  }

  /**
   * Analyze interaction patterns
   */
  async analyzeInteractionPatterns(userId, contactId) {
    try {
      const sql = `
        SELECT 
          interaction_type,
          COUNT(*) as count,
          AVG(duration_minutes) as avg_duration,
          MAX(interaction_date) as last_occurrence
        FROM pf_interactions
        WHERE user_id = ? AND contact_id = ?
        GROUP BY interaction_type
        ORDER BY count DESC
      `;

      const result = await this.db.execute(sql, [userId, contactId]);

      // Calculate interaction frequency
      const frequencySql = `
        SELECT 
          COUNT(*) as total_interactions,
          MIN(interaction_date) as first_interaction,
          MAX(interaction_date) as last_interaction,
          AVG(JULIANDAY(interaction_date) - JULIANDAY(LAG(interaction_date) OVER (ORDER BY interaction_date))) as avg_days_between
        FROM pf_interactions
        WHERE user_id = ? AND contact_id = ?
      `;

      const frequencyResult = await this.db.execute(frequencySql, [userId, contactId]);

      return {
        interaction_types: result.rows,
        frequency_analysis: frequencyResult.rows[0]
      };
    } catch (error) {
      logger.error('Failed to analyze interaction patterns', { error: error.message });
      throw error;
    }
  }
}

module.exports = InteractionService;