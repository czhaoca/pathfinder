const BaseController = require('./BaseController');
const { ValidationError, NotFoundError, UnauthorizedError } = require('../../utils/errors');

class InvitationController extends BaseController {
  constructor(invitationService) {
    super();
    this.invitationService = invitationService;
  }

  /**
   * Send invitations to multiple email addresses
   * POST /api/admin/invitations/send
   */
  async sendInvitations(req, res, next) {
    try {
      const { emails, role, featureGroupId, customMessage, expirationDays } = req.body;
      const invitedBy = req.user.userId;

      // Validate admin role
      if (!req.user.roles?.includes('admin') && !req.user.roles?.includes('super_admin')) {
        throw new UnauthorizedError('Admin access required');
      }

      if (!emails || !Array.isArray(emails) || emails.length === 0) {
        throw new ValidationError('Emails array is required');
      }

      if (emails.length > 100) {
        throw new ValidationError('Maximum 100 invitations at once');
      }

      // Validate email formats
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const invalidEmails = emails.filter(email => !emailRegex.test(email));
      if (invalidEmails.length > 0) {
        throw new ValidationError(`Invalid email format: ${invalidEmails.join(', ')}`);
      }

      // Validate custom message length
      if (customMessage && customMessage.length > 500) {
        throw new ValidationError('Custom message must be 500 characters or less');
      }

      const result = await this.invitationService.sendInvitations({
        emails,
        invitedBy,
        role,
        featureGroupId,
        customMessage,
        expirationDays
      });

      this.sendSuccess(res, result, 'Invitations processed');
    } catch (error) {
      next(error);
    }
  }

  /**
   * List invitations with filtering and pagination
   * GET /api/admin/invitations
   */
  async listInvitations(req, res, next) {
    try {
      // Validate admin role
      if (!req.user.roles?.includes('admin') && !req.user.roles?.includes('super_admin')) {
        throw new UnauthorizedError('Admin access required');
      }

      const { status, page = 1, limit = 20, search } = req.query;
      const invitedBy = req.user.roles?.includes('super_admin') ? null : req.user.userId;

      // Validate pagination params
      const pageNum = Math.max(1, parseInt(page) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));

      const result = await this.invitationService.listInvitations({
        status,
        page: pageNum,
        limit: limitNum,
        search,
        invitedBy
      });

      this.sendSuccess(res, result, 'Invitations retrieved');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Resend an invitation
   * POST /api/admin/invitations/:id/resend
   */
  async resendInvitation(req, res, next) {
    try {
      // Validate admin role
      if (!req.user.roles?.includes('admin') && !req.user.roles?.includes('super_admin')) {
        throw new UnauthorizedError('Admin access required');
      }

      const { id } = req.params;
      const resendingUserId = req.user.userId;

      const result = await this.invitationService.resendInvitation(id, resendingUserId);
      this.sendSuccess(res, result, 'Invitation resent');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Revoke an invitation
   * DELETE /api/admin/invitations/:id
   */
  async revokeInvitation(req, res, next) {
    try {
      // Validate admin role
      if (!req.user.roles?.includes('admin') && !req.user.roles?.includes('super_admin')) {
        throw new UnauthorizedError('Admin access required');
      }

      const { id } = req.params;
      const revokingUserId = req.user.userId;

      const result = await this.invitationService.revokeInvitation(id, revokingUserId);
      this.sendSuccess(res, result, 'Invitation revoked');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Process bulk CSV invitations
   * POST /api/admin/invitations/bulk
   */
  async bulkInvitations(req, res, next) {
    try {
      // Validate admin role
      if (!req.user.roles?.includes('admin') && !req.user.roles?.includes('super_admin')) {
        throw new UnauthorizedError('Admin access required');
      }

      const { csvData } = req.body;
      const invitedBy = req.user.userId;

      if (!csvData) {
        throw new ValidationError('CSV data is required');
      }

      const result = await this.invitationService.processBulkCSV(csvData, invitedBy);
      this.sendSuccess(res, result, 'Bulk invitations processed');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get invitation statistics for the current admin
   * GET /api/admin/invitations/stats
   */
  async getInvitationStats(req, res, next) {
    try {
      // Validate admin role
      if (!req.user.roles?.includes('admin') && !req.user.roles?.includes('super_admin')) {
        throw new UnauthorizedError('Admin access required');
      }

      const userId = req.user.userId;
      const stats = await this.invitationService.getInvitationStats(userId);
      this.sendSuccess(res, stats, 'Invitation statistics retrieved');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Validate an invitation token (public endpoint)
   * GET /api/invitations/validate/:token
   */
  async validateInvitation(req, res, next) {
    try {
      const { token } = req.params;

      if (!token) {
        throw new ValidationError('Token is required');
      }

      const result = await this.invitationService.validateToken(token);
      this.sendSuccess(res, result, 'Token validation completed');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Accept an invitation and create account (public endpoint)
   * POST /api/invitations/accept
   */
  async acceptInvitation(req, res, next) {
    try {
      const { 
        token, 
        password, 
        firstName, 
        lastName, 
        username,
        acceptTerms 
      } = req.body;

      if (!token) {
        throw new ValidationError('Token is required');
      }

      if (!password || !firstName || !lastName || !username) {
        throw new ValidationError('All fields are required');
      }

      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const result = await this.invitationService.acceptInvitation({
        token,
        password,
        firstName,
        lastName,
        username,
        acceptTerms,
        ipAddress,
        userAgent
      });

      this.sendSuccess(res, result, 'Account created successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Import invitations from CSV file
   * POST /api/admin/invitations/import-csv
   */
  async importCSV(req, res, next) {
    try {
      // Validate admin role
      if (!req.user.roles?.includes('admin') && !req.user.roles?.includes('super_admin')) {
        throw new UnauthorizedError('Admin access required');
      }

      if (!req.file) {
        throw new ValidationError('CSV file is required');
      }

      // Check file type
      if (!req.file.mimetype.includes('csv') && !req.file.mimetype.includes('text/csv')) {
        throw new ValidationError('File must be a CSV');
      }

      // Check file size (max 5MB)
      if (req.file.size > 5 * 1024 * 1024) {
        throw new ValidationError('File size must be less than 5MB');
      }

      const invitedBy = req.user.userId;
      const csvContent = req.file.buffer.toString('utf-8');

      const result = await this.invitationService.importFromCSV({
        csvContent,
        invitedBy
      });

      this.sendSuccess(res, result, 'CSV import completed');
    } catch (error) {
      next(error);
    }
  }
}

module.exports = InvitationController;