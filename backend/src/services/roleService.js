const crypto = require('crypto');
const NodeCache = require('node-cache');

class RoleService {
  constructor(db, auditService) {
    this.db = db;
    this.auditService = auditService;
    // Cache roles for 5 minutes
    this.roleCache = new NodeCache({ stdTTL: 300, checkperiod: 60 });
    // Cache permissions for 5 minutes
    this.permissionCache = new NodeCache({ stdTTL: 300, checkperiod: 60 });
  }

  /**
   * Get user's active roles
   * @param {String} userId - User ID
   * @returns {Promise<Array>} Array of role names
   */
  async getUserRoles(userId) {
    const cacheKey = `roles:${userId}`;
    const cached = this.roleCache.get(cacheKey);
    if (cached) return cached;

    try {
      const roles = await this.db.query(
        `SELECT role_name 
         FROM pf_user_roles 
         WHERE user_id = ? 
         AND is_active = 1 
         AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)`,
        [userId]
      );

      const roleNames = roles.map(r => r.role_name);
      this.roleCache.set(cacheKey, roleNames);
      return roleNames;
    } catch (error) {
      console.error('Error fetching user roles:', error);
      throw error;
    }
  }

  /**
   * Get user's permissions based on roles
   * @param {String} userId - User ID
   * @returns {Promise<Array>} Array of permissions
   */
  async getUserPermissions(userId) {
    const cacheKey = `permissions:${userId}`;
    const cached = this.permissionCache.get(cacheKey);
    if (cached) return cached;

    try {
      const roles = await this.getUserRoles(userId);
      if (roles.length === 0) return [];

      const placeholders = roles.map(() => '?').join(',');
      const permissions = await this.db.query(
        `SELECT DISTINCT permission_code, resource_type, allowed_actions 
         FROM pf_role_permissions 
         WHERE role_name IN (${placeholders})`,
        roles
      );

      this.permissionCache.set(cacheKey, permissions);
      return permissions;
    } catch (error) {
      console.error('Error fetching user permissions:', error);
      throw error;
    }
  }

  /**
   * Assign role to user
   * @param {String} userId - User ID
   * @param {String} roleName - Role to assign
   * @param {String} grantedBy - ID of user granting the role
   * @param {String} notes - Optional notes
   * @returns {Promise<Object>}
   */
  async assignRole(userId, roleName, grantedBy, notes = null) {
    const transaction = await this.db.beginTransaction();

    try {
      // Check if role is valid
      const validRoles = ['site_admin', 'admin', 'user'];
      if (!validRoles.includes(roleName)) {
        throw new Error(`Invalid role: ${roleName}`);
      }

      // Deactivate current roles
      await transaction.query(
        'UPDATE pf_user_roles SET is_active = 0 WHERE user_id = ?',
        [userId]
      );

      // Assign new role
      await transaction.query(
        `INSERT INTO pf_user_roles (user_id, role_name, granted_by, notes, is_active)
         VALUES (?, ?, ?, ?, 1)`,
        [userId, roleName, grantedBy, notes]
      );

      await transaction.commit();

      // Clear caches
      this.clearUserCache(userId);

      // Audit log
      await this.auditService.log({
        event_type: 'authorization',
        event_severity: 'info',
        event_name: 'role_assigned',
        action: 'assign_role',
        action_result: 'success',
        actor_id: grantedBy,
        target_id: userId,
        new_values: { role: roleName },
        notes: notes
      });

      return { success: true, role: roleName };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Create role promotion request
   * @param {Object} params - Promotion parameters
   * @returns {Promise<Object>}
   */
  async createPromotionRequest({
    targetUserId,
    fromRole,
    toRole,
    initiatedBy,
    justification,
    requiredApprovals = 2
  }) {
    const transaction = await this.db.beginTransaction();

    try {
      // Check for existing pending promotion
      const existing = await transaction.query(
        `SELECT id FROM pf_role_promotion_approvals 
         WHERE target_user_id = ? 
         AND status = 'pending'`,
        [targetUserId]
      );

      if (existing.length > 0) {
        throw new Error('User already has pending promotion request');
      }

      // Calculate expiry (72 hours from now)
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 72);

      const promotionId = crypto.randomUUID();

      await transaction.query(
        `INSERT INTO pf_role_promotion_approvals 
         (id, target_user_id, from_role, to_role, initiated_by, 
          required_approvals, justification, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [promotionId, targetUserId, fromRole, toRole, initiatedBy,
         requiredApprovals, justification, expiresAt]
      );

      await transaction.commit();

      // Audit log
      await this.auditService.log({
        event_type: 'authorization',
        event_severity: 'info',
        event_name: 'promotion_requested',
        action: 'request_promotion',
        action_result: 'success',
        actor_id: initiatedBy,
        target_id: targetUserId,
        details: {
          from_role: fromRole,
          to_role: toRole,
          justification: justification
        }
      });

      return {
        id: promotionId,
        status: 'pending',
        expires_at: expiresAt
      };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Record approval vote
   * @param {String} promotionId - Promotion request ID
   * @param {String} voterId - Voter's user ID
   * @param {String} vote - Vote (approve/reject/abstain)
   * @param {String} comments - Optional comments
   * @returns {Promise<Object>}
   */
  async recordVote(promotionId, voterId, vote, comments = null) {
    const transaction = await this.db.beginTransaction();

    try {
      // Get promotion details
      const promotion = await transaction.query(
        'SELECT * FROM pf_role_promotion_approvals WHERE id = ?',
        [promotionId]
      );

      if (promotion.length === 0) {
        throw new Error('Promotion request not found');
      }

      const promo = promotion[0];

      if (promo.status !== 'pending') {
        throw new Error(`Promotion is ${promo.status}, cannot vote`);
      }

      if (new Date() > promo.expires_at) {
        // Mark as expired
        await transaction.query(
          'UPDATE pf_role_promotion_approvals SET status = ? WHERE id = ?',
          ['expired', promotionId]
        );
        throw new Error('Promotion request has expired');
      }

      // Check if already voted
      const existingVote = await transaction.query(
        'SELECT vote FROM pf_approval_votes WHERE approval_id = ? AND voter_id = ?',
        [promotionId, voterId]
      );

      if (existingVote.length > 0) {
        throw new Error('You have already voted on this promotion');
      }

      // Record vote
      await transaction.query(
        `INSERT INTO pf_approval_votes (approval_id, voter_id, vote, comments)
         VALUES (?, ?, ?, ?)`,
        [promotionId, voterId, vote, comments]
      );

      // Update approval count if approved
      if (vote === 'approve') {
        await transaction.query(
          'UPDATE pf_role_promotion_approvals SET current_approvals = current_approvals + 1 WHERE id = ?',
          [promotionId]
        );
      }

      // Check if threshold met
      const updated = await transaction.query(
        'SELECT * FROM pf_role_promotion_approvals WHERE id = ?',
        [promotionId]
      );

      const updatedPromo = updated[0];
      
      if (updatedPromo.current_approvals >= updatedPromo.required_approvals) {
        // Execute promotion
        await this.executePromotion(transaction, updatedPromo);
      }

      await transaction.commit();

      // Audit log
      await this.auditService.log({
        event_type: 'authorization',
        event_severity: 'info',
        event_name: 'promotion_vote_cast',
        action: 'vote_promotion',
        action_result: 'success',
        actor_id: voterId,
        target_id: promotionId,
        details: {
          vote: vote,
          comments: comments
        }
      });

      return {
        success: true,
        status: updatedPromo.current_approvals >= updatedPromo.required_approvals ? 'approved' : 'pending',
        current_approvals: updatedPromo.current_approvals,
        required_approvals: updatedPromo.required_approvals
      };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Execute approved promotion
   * @param {Object} transaction - Database transaction
   * @param {Object} promotion - Promotion details
   */
  async executePromotion(transaction, promotion) {
    // Update promotion status
    await transaction.query(
      'UPDATE pf_role_promotion_approvals SET status = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?',
      ['approved', promotion.id]
    );

    // Deactivate current roles
    await transaction.query(
      'UPDATE pf_user_roles SET is_active = 0 WHERE user_id = ?',
      [promotion.target_user_id]
    );

    // Assign new role
    await transaction.query(
      `INSERT INTO pf_user_roles (user_id, role_name, granted_by, notes, is_active)
       VALUES (?, ?, ?, ?, 1)`,
      [promotion.target_user_id, promotion.to_role, promotion.initiated_by, 
       `Promoted from ${promotion.from_role} via approval workflow`]
    );

    // Clear caches
    this.clearUserCache(promotion.target_user_id);

    // Audit log
    await this.auditService.log({
      event_type: 'authorization',
      event_severity: 'info',
      event_name: 'role_promoted',
      action: 'execute_promotion',
      action_result: 'success',
      target_id: promotion.target_user_id,
      details: {
        from_role: promotion.from_role,
        to_role: promotion.to_role,
        promotion_id: promotion.id
      }
    });
  }

  /**
   * Check if user owns a resource
   * @param {String} userId - User ID
   * @param {String} resourceType - Type of resource
   * @param {String} resourceId - Resource ID
   * @returns {Promise<boolean>}
   */
  async checkResourceOwnership(userId, resourceType, resourceId) {
    try {
      let query;
      let params;

      switch (resourceType) {
        case 'profile':
        case 'user':
          return userId === resourceId;
          
        case 'experience':
          query = 'SELECT user_id FROM pf_experiences WHERE id = ?';
          params = [resourceId];
          break;
          
        case 'skill':
          query = 'SELECT user_id FROM pf_user_skills WHERE id = ?';
          params = [resourceId];
          break;
          
        case 'document':
          query = 'SELECT user_id FROM pf_documents WHERE id = ?';
          params = [resourceId];
          break;
          
        case 'chat':
          query = 'SELECT user_id FROM pf_chat_history WHERE id = ?';
          params = [resourceId];
          break;
          
        default:
          return false;
      }

      if (query) {
        const result = await this.db.query(query, params);
        return result.length > 0 && result[0].user_id === userId;
      }

      return false;
    } catch (error) {
      console.error('Error checking resource ownership:', error);
      return false;
    }
  }

  /**
   * Get all pending promotions (for admin dashboard)
   * @returns {Promise<Array>}
   */
  async getPendingPromotions() {
    try {
      const promotions = await this.db.query(
        `SELECT p.*, u.username, u.email 
         FROM pf_role_promotion_approvals p
         JOIN pf_users u ON p.target_user_id = u.id
         WHERE p.status = 'pending' 
         AND p.expires_at > CURRENT_TIMESTAMP
         ORDER BY p.initiated_at DESC`
      );

      return promotions;
    } catch (error) {
      console.error('Error fetching pending promotions:', error);
      throw error;
    }
  }

  /**
   * Clear user's cached roles and permissions
   * @param {String} userId - User ID
   */
  clearUserCache(userId) {
    this.roleCache.del(`roles:${userId}`);
    this.permissionCache.del(`permissions:${userId}`);
  }

  /**
   * Clear all caches
   */
  clearAllCaches() {
    this.roleCache.flushAll();
    this.permissionCache.flushAll();
  }
}

// Singleton instance
let roleServiceInstance = null;

/**
 * Get or create RoleService instance
 * @param {Object} db - Database connection
 * @param {Object} auditService - Audit service
 * @returns {RoleService}
 */
function getRoleService(db = null, auditService = null) {
  if (!roleServiceInstance && db && auditService) {
    roleServiceInstance = new RoleService(db, auditService);
  }
  return roleServiceInstance;
}

module.exports = {
  RoleService,
  getRoleService
};