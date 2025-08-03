const { ulid } = require('ulid');
const logger = require('../utils/logger');

class ContactService {
  constructor(databaseService, auditService) {
    this.db = databaseService;
    this.auditService = auditService;
  }

  /**
   * Create a new contact
   */
  async createContact(userId, contactData) {
    try {
      const contactId = ulid();
      
      const sql = `
        INSERT INTO pf_contacts (
          contact_id, user_id, first_name, last_name, preferred_name,
          email, phone, linkedin_url, current_title, current_company,
          location, bio, contact_source, relationship_type,
          relationship_strength, personal_interests, professional_context
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const params = [
        contactId,
        userId,
        contactData.firstName,
        contactData.lastName,
        contactData.preferredName || null,
        contactData.email || null,
        contactData.phone || null,
        contactData.linkedinUrl || null,
        contactData.currentTitle || null,
        contactData.currentCompany || null,
        contactData.location || null,
        contactData.bio || null,
        contactData.contactSource || 'manual',
        contactData.relationshipType || 'peer',
        contactData.relationshipStrength || 1,
        JSON.stringify(contactData.personalInterests || []),
        JSON.stringify(contactData.professionalContext || {})
      ];

      await this.db.execute(sql, params);

      // Add tags if provided
      if (contactData.tags && contactData.tags.length > 0) {
        await this.addContactTags(contactId, contactData.tags);
      }

      // Audit log
      await this.auditService.log({
        userId,
        action: 'contact.create',
        resourceType: 'contact',
        resourceId: contactId,
        details: { contactName: `${contactData.firstName} ${contactData.lastName}` }
      });

      return { contactId };
    } catch (error) {
      logger.error('Failed to create contact', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Get contact by ID
   */
  async getContact(userId, contactId) {
    try {
      const sql = `
        SELECT 
          c.*,
          (SELECT COUNT(*) FROM pf_interactions WHERE contact_id = c.contact_id) as interaction_count,
          (SELECT MAX(interaction_date) FROM pf_interactions WHERE contact_id = c.contact_id) as last_interaction
        FROM pf_contacts c
        WHERE c.contact_id = ? AND c.user_id = ?
      `;

      const result = await this.db.execute(sql, [contactId, userId]);

      if (result.rows.length === 0) {
        throw new Error('Contact not found');
      }

      const contact = result.rows[0];
      
      // Parse JSON fields
      contact.personal_interests = JSON.parse(contact.personal_interests || '[]');
      contact.professional_context = JSON.parse(contact.professional_context || '{}');

      // Get tags
      contact.tags = await this.getContactTags(contactId);

      // Get recent interactions
      contact.recent_interactions = await this.getRecentInteractions(contactId, 5);

      return contact;
    } catch (error) {
      logger.error('Failed to get contact', { error: error.message, contactId });
      throw error;
    }
  }

  /**
   * Update contact
   */
  async updateContact(userId, contactId, updateData) {
    try {
      // Verify ownership
      const checkSql = 'SELECT contact_id FROM pf_contacts WHERE contact_id = ? AND user_id = ?';
      const checkResult = await this.db.execute(checkSql, [contactId, userId]);
      
      if (checkResult.rows.length === 0) {
        throw new Error('Contact not found');
      }

      // Build dynamic update query
      const updateFields = [];
      const params = [];

      const allowedFields = [
        'first_name', 'last_name', 'preferred_name', 'email', 'phone',
        'linkedin_url', 'current_title', 'current_company', 'location',
        'bio', 'contact_source', 'relationship_type', 'relationship_strength'
      ];

      for (const field of allowedFields) {
        if (updateData[field] !== undefined) {
          updateFields.push(`${field} = ?`);
          params.push(updateData[field]);
        }
      }

      // Handle JSON fields
      if (updateData.personalInterests) {
        updateFields.push('personal_interests = ?');
        params.push(JSON.stringify(updateData.personalInterests));
      }

      if (updateData.professionalContext) {
        updateFields.push('professional_context = ?');
        params.push(JSON.stringify(updateData.professionalContext));
      }

      if (updateFields.length === 0) {
        return { message: 'No fields to update' };
      }

      updateFields.push('updated_at = CURRENT_TIMESTAMP');
      params.push(contactId, userId);

      const sql = `
        UPDATE pf_contacts 
        SET ${updateFields.join(', ')}
        WHERE contact_id = ? AND user_id = ?
      `;

      await this.db.execute(sql, params);

      // Update tags if provided
      if (updateData.tags) {
        await this.updateContactTags(contactId, updateData.tags);
      }

      // Audit log
      await this.auditService.log({
        userId,
        action: 'contact.update',
        resourceType: 'contact',
        resourceId: contactId,
        details: { updatedFields: Object.keys(updateData) }
      });

      return { success: true };
    } catch (error) {
      logger.error('Failed to update contact', { error: error.message, contactId });
      throw error;
    }
  }

  /**
   * Delete contact
   */
  async deleteContact(userId, contactId) {
    try {
      const sql = 'DELETE FROM pf_contacts WHERE contact_id = ? AND user_id = ?';
      const result = await this.db.execute(sql, [contactId, userId]);

      if (result.rowsAffected === 0) {
        throw new Error('Contact not found');
      }

      // Audit log
      await this.auditService.log({
        userId,
        action: 'contact.delete',
        resourceType: 'contact',
        resourceId: contactId
      });

      return { success: true };
    } catch (error) {
      logger.error('Failed to delete contact', { error: error.message, contactId });
      throw error;
    }
  }

  /**
   * List contacts with filtering
   */
  async listContacts(userId, filters = {}) {
    try {
      let sql = `
        SELECT 
          c.*,
          (SELECT COUNT(*) FROM pf_interactions WHERE contact_id = c.contact_id) as interaction_count,
          (SELECT MAX(interaction_date) FROM pf_interactions WHERE contact_id = c.contact_id) as last_interaction
        FROM pf_contacts c
        WHERE c.user_id = ?
      `;
      const params = [userId];

      // Apply filters
      if (filters.search) {
        sql += ` AND (
          UPPER(c.first_name) LIKE UPPER(?) OR 
          UPPER(c.last_name) LIKE UPPER(?) OR 
          UPPER(c.current_company) LIKE UPPER(?) OR
          UPPER(c.current_title) LIKE UPPER(?)
        )`;
        const searchTerm = `%${filters.search}%`;
        params.push(searchTerm, searchTerm, searchTerm, searchTerm);
      }

      if (filters.relationshipType) {
        sql += ` AND c.relationship_type = ?`;
        params.push(filters.relationshipType);
      }

      if (filters.minStrength) {
        sql += ` AND c.relationship_strength >= ?`;
        params.push(filters.minStrength);
      }

      if (filters.company) {
        sql += ` AND UPPER(c.current_company) LIKE UPPER(?)`;
        params.push(`%${filters.company}%`);
      }

      // Sorting
      const sortField = filters.sortBy || 'last_name';
      const sortOrder = filters.sortOrder || 'ASC';
      sql += ` ORDER BY ${sortField} ${sortOrder}`;

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

      // Parse JSON fields for each contact
      const contacts = result.rows.map(contact => ({
        ...contact,
        personal_interests: JSON.parse(contact.personal_interests || '[]'),
        professional_context: JSON.parse(contact.professional_context || '{}')
      }));

      return contacts;
    } catch (error) {
      logger.error('Failed to list contacts', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Add tags to a contact
   */
  async addContactTags(contactId, tags) {
    try {
      const tagInserts = tags.map(tag => {
        const tagId = ulid();
        return this.db.execute(
          'INSERT INTO pf_contact_tags (tag_id, contact_id, tag_name) VALUES (?, ?, ?)',
          [tagId, contactId, tag]
        );
      });

      await Promise.all(tagInserts);
    } catch (error) {
      logger.error('Failed to add contact tags', { error: error.message, contactId });
      throw error;
    }
  }

  /**
   * Get tags for a contact
   */
  async getContactTags(contactId) {
    try {
      const sql = 'SELECT tag_name FROM pf_contact_tags WHERE contact_id = ? ORDER BY tag_name';
      const result = await this.db.execute(sql, [contactId]);
      return result.rows.map(row => row.tag_name);
    } catch (error) {
      logger.error('Failed to get contact tags', { error: error.message, contactId });
      return [];
    }
  }

  /**
   * Update contact tags (replace all)
   */
  async updateContactTags(contactId, tags) {
    try {
      // Remove existing tags
      await this.db.execute('DELETE FROM pf_contact_tags WHERE contact_id = ?', [contactId]);
      
      // Add new tags
      if (tags.length > 0) {
        await this.addContactTags(contactId, tags);
      }
    } catch (error) {
      logger.error('Failed to update contact tags', { error: error.message, contactId });
      throw error;
    }
  }

  /**
   * Get recent interactions for a contact
   */
  async getRecentInteractions(contactId, limit = 5) {
    try {
      const sql = `
        SELECT 
          interaction_id,
          interaction_type,
          interaction_date,
          subject,
          sentiment
        FROM pf_interactions
        WHERE contact_id = ?
        ORDER BY interaction_date DESC
        LIMIT ?
      `;

      const result = await this.db.execute(sql, [contactId, limit]);
      return result.rows;
    } catch (error) {
      logger.error('Failed to get recent interactions', { error: error.message, contactId });
      return [];
    }
  }

  /**
   * Calculate relationship strength
   */
  async calculateRelationshipStrength(userId, contactId) {
    try {
      // Get interaction metrics
      const metricsSql = `
        SELECT 
          COUNT(*) as total_interactions,
          AVG(CASE WHEN sentiment = 'positive' THEN 1 WHEN sentiment = 'neutral' THEN 0.5 ELSE 0 END) as sentiment_score,
          MIN(JULIANDAY('now') - JULIANDAY(interaction_date)) as days_since_last,
          AVG(duration_minutes) as avg_duration
        FROM pf_interactions
        WHERE contact_id = ? AND user_id = ?
        AND interaction_date > date('now', '-1 year')
      `;

      const result = await this.db.execute(metricsSql, [contactId, userId]);
      const metrics = result.rows[0];

      // Calculate scores
      const frequencyScore = Math.min(metrics.total_interactions / 12, 1); // Monthly interaction = 1.0
      const recencyScore = Math.max(1 - (metrics.days_since_last / 90), 0); // 90 days = 0
      const sentimentScore = metrics.sentiment_score || 0.5;
      const depthScore = Math.min((metrics.avg_duration || 0) / 60, 1); // 60 min avg = 1.0

      // Calculate overall strength (1-5 scale)
      const overallScore = (
        0.3 * frequencyScore +
        0.3 * recencyScore +
        0.2 * sentimentScore +
        0.2 * depthScore
      ) * 5;

      const strength = Math.max(1, Math.round(overallScore));

      // Update contact
      await this.db.execute(
        'UPDATE pf_contacts SET relationship_strength = ? WHERE contact_id = ?',
        [strength, contactId]
      );

      // Update metrics table
      const metricId = ulid();
      await this.db.execute(
        `INSERT INTO pf_relationship_metrics (
          metric_id, contact_id, user_id,
          interaction_frequency_score, response_time_score,
          meeting_depth_score, mutual_benefit_score, overall_strength
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (contact_id, user_id) 
        DO UPDATE SET
          interaction_frequency_score = EXCLUDED.interaction_frequency_score,
          meeting_depth_score = EXCLUDED.meeting_depth_score,
          overall_strength = EXCLUDED.overall_strength,
          last_calculated = CURRENT_TIMESTAMP`,
        [metricId, contactId, userId, frequencyScore, recencyScore, depthScore, sentimentScore, overallScore]
      );

      return { strength, metrics: { frequencyScore, recencyScore, sentimentScore, depthScore } };
    } catch (error) {
      logger.error('Failed to calculate relationship strength', { error: error.message });
      throw error;
    }
  }

  /**
   * Import contacts from CSV or JSON
   */
  async importContacts(userId, contacts, source = 'import') {
    const results = {
      successful: 0,
      failed: 0,
      errors: []
    };

    for (const contact of contacts) {
      try {
        await this.createContact(userId, {
          ...contact,
          contactSource: source
        });
        results.successful++;
      } catch (error) {
        results.failed++;
        results.errors.push({
          contact: `${contact.firstName} ${contact.lastName}`,
          error: error.message
        });
      }
    }

    return results;
  }

  /**
   * Get contact analytics
   */
  async getContactAnalytics(userId) {
    try {
      const analyticsSql = `
        SELECT 
          COUNT(*) as total_contacts,
          AVG(relationship_strength) as avg_strength,
          COUNT(CASE WHEN relationship_type = 'mentor' THEN 1 END) as mentors,
          COUNT(CASE WHEN relationship_type = 'peer' THEN 1 END) as peers,
          COUNT(CASE WHEN last_interaction_date > date('now', '-30 days') THEN 1 END) as active_last_30_days,
          COUNT(CASE WHEN last_interaction_date < date('now', '-90 days') THEN 1 END) as inactive_90_days
        FROM pf_contacts
        WHERE user_id = ?
      `;

      const result = await this.db.execute(analyticsSql, [userId]);
      
      return result.rows[0];
    } catch (error) {
      logger.error('Failed to get contact analytics', { error: error.message });
      throw error;
    }
  }
}

module.exports = ContactService;