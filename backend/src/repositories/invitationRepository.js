const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
const { DatabaseError } = require('../utils/errors');

class InvitationRepository {
  constructor(database) {
    this.db = database;
    this.prefix = 'pf_';
  }

  async create({
    email,
    invitationToken,
    invitedBy,
    role = 'user',
    featureGroupId = null,
    expiresAt,
    metadata = {}
  }) {
    const invitationId = uuidv4();
    const query = `
      INSERT INTO ${this.prefix}user_invitations (
        invitation_id,
        email,
        invitation_token,
        invited_by,
        role,
        feature_group_id,
        expires_at,
        metadata,
        created_at
      ) VALUES (
        :invitationId,
        :email,
        :invitationToken,
        :invitedBy,
        :role,
        :featureGroupId,
        :expiresAt,
        :metadata,
        CURRENT_TIMESTAMP
      )
    `;

    try {
      await this.db.execute(query, {
        invitationId,
        email,
        invitationToken,
        invitedBy,
        role,
        featureGroupId,
        expiresAt,
        metadata: JSON.stringify(metadata)
      });

      return {
        invitationId,
        email,
        invitedBy,
        role,
        featureGroupId,
        expiresAt,
        metadata
      };
    } catch (error) {
      logger.error('Failed to create invitation', { error: error.message, email });
      throw new DatabaseError('Failed to create invitation', error);
    }
  }

  async findByToken(hashedToken) {
    const query = `
      SELECT 
        i.*,
        u.username as inviter_username,
        u.first_name as inviter_first_name,
        u.last_name as inviter_last_name
      FROM ${this.prefix}user_invitations i
      LEFT JOIN ${this.prefix}users u ON i.invited_by = u.user_id
      WHERE i.invitation_token = :hashedToken
        AND i.accepted_at IS NULL
        AND i.declined_at IS NULL
    `;

    try {
      const result = await this.db.execute(query, { hashedToken });
      if (result.rows && result.rows.length > 0) {
        const row = result.rows[0];
        return {
          invitationId: row.INVITATION_ID,
          email: row.EMAIL,
          invitationToken: row.INVITATION_TOKEN,
          invitedBy: row.INVITED_BY,
          role: row.ROLE,
          featureGroupId: row.FEATURE_GROUP_ID,
          expiresAt: row.EXPIRES_AT,
          acceptedAt: row.ACCEPTED_AT,
          declinedAt: row.DECLINED_AT,
          reminderSentAt: row.REMINDER_SENT_AT,
          metadata: row.METADATA ? JSON.parse(row.METADATA) : {},
          createdAt: row.CREATED_AT,
          inviterName: `${row.INVITER_FIRST_NAME || ''} ${row.INVITER_LAST_NAME || ''}`.trim() || row.INVITER_USERNAME
        };
      }
      return null;
    } catch (error) {
      logger.error('Failed to find invitation by token', { error: error.message });
      throw new DatabaseError('Failed to find invitation', error);
    }
  }

  async findByEmail(email) {
    const query = `
      SELECT * FROM ${this.prefix}user_invitations
      WHERE LOWER(email) = LOWER(:email)
      ORDER BY created_at DESC
    `;

    try {
      const result = await this.db.execute(query, { email });
      return result.rows.map(row => ({
        invitationId: row.INVITATION_ID,
        email: row.EMAIL,
        invitedBy: row.INVITED_BY,
        role: row.ROLE,
        featureGroupId: row.FEATURE_GROUP_ID,
        expiresAt: row.EXPIRES_AT,
        acceptedAt: row.ACCEPTED_AT,
        declinedAt: row.DECLINED_AT,
        reminderSentAt: row.REMINDER_SENT_AT,
        metadata: row.METADATA ? JSON.parse(row.METADATA) : {},
        createdAt: row.CREATED_AT
      }));
    } catch (error) {
      logger.error('Failed to find invitations by email', { error: error.message, email });
      throw new DatabaseError('Failed to find invitations', error);
    }
  }

  async findPendingByEmail(email) {
    const query = `
      SELECT * FROM ${this.prefix}user_invitations
      WHERE LOWER(email) = LOWER(:email)
        AND accepted_at IS NULL
        AND declined_at IS NULL
        AND expires_at > CURRENT_TIMESTAMP
      ORDER BY created_at DESC
      FETCH FIRST 1 ROWS ONLY
    `;

    try {
      const result = await this.db.execute(query, { email });
      if (result.rows && result.rows.length > 0) {
        const row = result.rows[0];
        return {
          invitationId: row.INVITATION_ID,
          email: row.EMAIL,
          invitedBy: row.INVITED_BY,
          role: row.ROLE,
          featureGroupId: row.FEATURE_GROUP_ID,
          expiresAt: row.EXPIRES_AT,
          reminderSentAt: row.REMINDER_SENT_AT,
          metadata: row.METADATA ? JSON.parse(row.METADATA) : {},
          createdAt: row.CREATED_AT
        };
      }
      return null;
    } catch (error) {
      logger.error('Failed to find pending invitation', { error: error.message, email });
      throw new DatabaseError('Failed to find pending invitation', error);
    }
  }

  async findById(invitationId) {
    const query = `
      SELECT 
        i.*,
        u.username as inviter_username,
        u.first_name as inviter_first_name,
        u.last_name as inviter_last_name
      FROM ${this.prefix}user_invitations i
      LEFT JOIN ${this.prefix}users u ON i.invited_by = u.user_id
      WHERE i.invitation_id = :invitationId
    `;

    try {
      const result = await this.db.execute(query, { invitationId });
      if (result.rows && result.rows.length > 0) {
        const row = result.rows[0];
        return {
          invitationId: row.INVITATION_ID,
          email: row.EMAIL,
          invitationToken: row.INVITATION_TOKEN,
          invitedBy: row.INVITED_BY,
          role: row.ROLE,
          featureGroupId: row.FEATURE_GROUP_ID,
          expiresAt: row.EXPIRES_AT,
          acceptedAt: row.ACCEPTED_AT,
          declinedAt: row.DECLINED_AT,
          reminderSentAt: row.REMINDER_SENT_AT,
          metadata: row.METADATA ? JSON.parse(row.METADATA) : {},
          createdAt: row.CREATED_AT,
          inviterName: `${row.INVITER_FIRST_NAME || ''} ${row.INVITER_LAST_NAME || ''}`.trim() || row.INVITER_USERNAME
        };
      }
      return null;
    } catch (error) {
      logger.error('Failed to find invitation by ID', { error: error.message, invitationId });
      throw new DatabaseError('Failed to find invitation', error);
    }
  }

  async list({ status, page = 1, limit = 20, search, invitedBy }) {
    let query = `
      SELECT 
        i.*,
        u.username as inviter_username,
        u.first_name as inviter_first_name,
        u.last_name as inviter_last_name
      FROM ${this.prefix}user_invitations i
      LEFT JOIN ${this.prefix}users u ON i.invited_by = u.user_id
      WHERE 1=1
    `;
    
    const params = {};
    
    // Status filter
    if (status) {
      switch (status) {
        case 'pending':
          query += ` AND i.accepted_at IS NULL AND i.declined_at IS NULL AND i.expires_at > CURRENT_TIMESTAMP`;
          break;
        case 'accepted':
          query += ` AND i.accepted_at IS NOT NULL`;
          break;
        case 'expired':
          query += ` AND i.accepted_at IS NULL AND i.declined_at IS NULL AND i.expires_at <= CURRENT_TIMESTAMP`;
          break;
        case 'revoked':
          query += ` AND i.declined_at IS NOT NULL`;
          break;
      }
    }
    
    // Search filter
    if (search) {
      query += ` AND LOWER(i.email) LIKE LOWER(:search)`;
      params.search = `%${search}%`;
    }
    
    // Inviter filter
    if (invitedBy) {
      query += ` AND i.invited_by = :invitedBy`;
      params.invitedBy = invitedBy;
    }
    
    // Count total
    const countQuery = query.replace(/SELECT.*FROM/, 'SELECT COUNT(*) as total FROM');
    const countResult = await this.db.execute(countQuery, params);
    const total = countResult.rows[0].TOTAL;
    
    // Add pagination
    const offset = (page - 1) * limit;
    query += ` ORDER BY i.created_at DESC`;
    query += ` OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY`;
    params.offset = offset;
    params.limit = limit;
    
    try {
      const result = await this.db.execute(query, params);
      const invitations = result.rows.map(row => ({
        invitationId: row.INVITATION_ID,
        email: row.EMAIL,
        invitedBy: row.INVITED_BY,
        role: row.ROLE,
        featureGroupId: row.FEATURE_GROUP_ID,
        expiresAt: row.EXPIRES_AT,
        acceptedAt: row.ACCEPTED_AT,
        declinedAt: row.DECLINED_AT,
        reminderSentAt: row.REMINDER_SENT_AT,
        metadata: row.METADATA ? JSON.parse(row.METADATA) : {},
        createdAt: row.CREATED_AT,
        inviterName: `${row.INVITER_FIRST_NAME || ''} ${row.INVITER_LAST_NAME || ''}`.trim() || row.INVITER_USERNAME,
        status: this.getInvitationStatus(row)
      }));
      
      return {
        invitations,
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      };
    } catch (error) {
      logger.error('Failed to list invitations', { error: error.message });
      throw new DatabaseError('Failed to list invitations', error);
    }
  }

  getInvitationStatus(row) {
    if (row.ACCEPTED_AT) return 'accepted';
    if (row.DECLINED_AT) return 'revoked';
    if (new Date(row.EXPIRES_AT) < new Date()) return 'expired';
    return 'pending';
  }

  async markAccepted(invitationId) {
    const query = `
      UPDATE ${this.prefix}user_invitations
      SET accepted_at = CURRENT_TIMESTAMP
      WHERE invitation_id = :invitationId
    `;

    try {
      await this.db.execute(query, { invitationId });
      return true;
    } catch (error) {
      logger.error('Failed to mark invitation as accepted', { error: error.message, invitationId });
      throw new DatabaseError('Failed to update invitation', error);
    }
  }

  async markDeclined(invitationId) {
    const query = `
      UPDATE ${this.prefix}user_invitations
      SET declined_at = CURRENT_TIMESTAMP
      WHERE invitation_id = :invitationId
    `;

    try {
      await this.db.execute(query, { invitationId });
      return true;
    } catch (error) {
      logger.error('Failed to mark invitation as declined', { error: error.message, invitationId });
      throw new DatabaseError('Failed to update invitation', error);
    }
  }

  async markReminderSent(invitationId) {
    const query = `
      UPDATE ${this.prefix}user_invitations
      SET reminder_sent_at = CURRENT_TIMESTAMP
      WHERE invitation_id = :invitationId
    `;

    try {
      await this.db.execute(query, { invitationId });
      return true;
    } catch (error) {
      logger.error('Failed to mark reminder as sent', { error: error.message, invitationId });
      throw new DatabaseError('Failed to update invitation', error);
    }
  }

  async updateToken(invitationId, newToken, newExpiresAt) {
    const query = `
      UPDATE ${this.prefix}user_invitations
      SET 
        invitation_token = :newToken,
        expires_at = :newExpiresAt,
        reminder_sent_at = NULL
      WHERE invitation_id = :invitationId
    `;

    try {
      await this.db.execute(query, { invitationId, newToken, newExpiresAt });
      return true;
    } catch (error) {
      logger.error('Failed to update invitation token', { error: error.message, invitationId });
      throw new DatabaseError('Failed to update invitation', error);
    }
  }

  async findPendingNeedingReminder(reminderThreshold) {
    const query = `
      SELECT 
        i.*,
        u.username as inviter_username,
        u.first_name as inviter_first_name,
        u.last_name as inviter_last_name
      FROM ${this.prefix}user_invitations i
      LEFT JOIN ${this.prefix}users u ON i.invited_by = u.user_id
      WHERE i.accepted_at IS NULL
        AND i.declined_at IS NULL
        AND i.reminder_sent_at IS NULL
        AND i.expires_at > CURRENT_TIMESTAMP
        AND i.created_at <= :reminderThreshold
    `;

    try {
      const result = await this.db.execute(query, { reminderThreshold });
      return result.rows.map(row => ({
        invitationId: row.INVITATION_ID,
        email: row.EMAIL,
        invitationToken: row.INVITATION_TOKEN,
        invitedBy: row.INVITED_BY,
        expiresAt: row.EXPIRES_AT,
        metadata: row.METADATA ? JSON.parse(row.METADATA) : {},
        inviterName: `${row.INVITER_FIRST_NAME || ''} ${row.INVITER_LAST_NAME || ''}`.trim() || row.INVITER_USERNAME
      }));
    } catch (error) {
      logger.error('Failed to find invitations needing reminder', { error: error.message });
      throw new DatabaseError('Failed to find invitations', error);
    }
  }

  async deleteExpired() {
    const query = `
      DELETE FROM ${this.prefix}user_invitations
      WHERE expires_at < CURRENT_TIMESTAMP
        AND accepted_at IS NULL
    `;

    try {
      const result = await this.db.execute(query, {});
      return result.rowsAffected || 0;
    } catch (error) {
      logger.error('Failed to delete expired invitations', { error: error.message });
      throw new DatabaseError('Failed to delete expired invitations', error);
    }
  }

  async getStatsByInviter(invitedBy) {
    const query = `
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN accepted_at IS NOT NULL THEN 1 END) as accepted,
        COUNT(CASE WHEN declined_at IS NOT NULL THEN 1 END) as declined,
        COUNT(CASE WHEN accepted_at IS NULL AND declined_at IS NULL 
                   AND expires_at > CURRENT_TIMESTAMP THEN 1 END) as pending,
        COUNT(CASE WHEN accepted_at IS NULL AND declined_at IS NULL 
                   AND expires_at <= CURRENT_TIMESTAMP THEN 1 END) as expired
      FROM ${this.prefix}user_invitations
      WHERE invited_by = :invitedBy
    `;

    try {
      const result = await this.db.execute(query, { invitedBy });
      if (result.rows && result.rows.length > 0) {
        const row = result.rows[0];
        return {
          total: row.TOTAL || 0,
          accepted: row.ACCEPTED || 0,
          declined: row.DECLINED || 0,
          pending: row.PENDING || 0,
          expired: row.EXPIRED || 0
        };
      }
      return { total: 0, accepted: 0, declined: 0, pending: 0, expired: 0 };
    } catch (error) {
      logger.error('Failed to get invitation stats', { error: error.message, invitedBy });
      throw new DatabaseError('Failed to get invitation stats', error);
    }
  }
}

module.exports = InvitationRepository;