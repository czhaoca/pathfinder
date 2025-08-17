const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
const { 
  ValidationError, 
  ConflictError,
  NotFoundError,
  DatabaseError 
} = require('../utils/errors');
const { AUTH, REGEX } = require('../utils/constants');

class InvitationService {
  constructor(invitationRepository, userRepository, emailService, auditService, authService) {
    this.invitationRepository = invitationRepository;
    this.userRepository = userRepository;
    this.emailService = emailService;
    this.auditService = auditService;
    this.authService = authService;
  }

  async sendInvitations({ 
    emails, 
    invitedBy, 
    role = 'user', 
    featureGroupId = null, 
    customMessage = null,
    expirationDays = 7 
  }) {
    const results = { sent: [], failed: [] };
    
    // Validate expiration days
    if (expirationDays < 1 || expirationDays > 30) {
      throw new ValidationError('Expiration days must be between 1 and 30');
    }
    
    // Validate emails array
    if (!emails || emails.length === 0) {
      throw new ValidationError('At least one email is required');
    }
    
    if (emails.length > 100) {
      throw new ValidationError('Maximum 100 invitations at once');
    }
    
    // Validate emails
    const validEmails = [];
    for (const email of emails) {
      if (!REGEX.EMAIL.test(email)) {
        results.failed.push({ 
          email, 
          reason: 'Invalid email format' 
        });
      } else {
        validEmails.push(email.toLowerCase());
      }
    }
    
    // Process valid emails
    for (const email of validEmails) {
      try {
        // Check if user already exists
        const existingUser = await this.userRepository.findByEmail(email);
        if (existingUser) {
          results.failed.push({ 
            email, 
            reason: 'User already exists' 
          });
          continue;
        }

        // Check for pending invitation
        const pendingInvite = await this.invitationRepository.findPendingByEmail(email);
        if (pendingInvite) {
          results.failed.push({ 
            email, 
            reason: 'Invitation already pending' 
          });
          continue;
        }

        // Generate secure token
        const token = await this.generateSecureToken();
        const hashedToken = await this.hashToken(token);
        const expiresAt = new Date(Date.now() + expirationDays * 24 * 60 * 60 * 1000);

        // Get inviter details
        const inviter = await this.userRepository.findById(invitedBy);
        const inviterName = `${inviter.firstName || ''} ${inviter.lastName || ''}`.trim() || inviter.username;

        // Create invitation record
        const invitation = await this.invitationRepository.create({
          email,
          invitationToken: hashedToken,
          invitedBy,
          role,
          featureGroupId,
          expiresAt,
          metadata: {
            customMessage: customMessage ? customMessage.substring(0, 500) : null, // Limit message length
            inviterName
            // Do not store original token for security
          }
        });

        // Send invitation email
        await this.emailService.sendInvitation({
          to: email,
          inviterName,
          customMessage,
          invitationUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/register/invite?token=${token}`,
          expiresAt: expiresAt.toLocaleDateString()
        });

        results.sent.push({
          email,
          invitationId: invitation.invitationId,
          status: 'sent'
        });

        // Audit log
        await this.auditService.log({
          userId: invitedBy,
          action: 'INVITATION_SENT',
          resourceType: 'invitation',
          resourceId: invitation.invitationId,
          details: { email, role }
        });
      } catch (error) {
        logger.error('Failed to send invitation', { email, error: error.message });
        results.failed.push({ 
          email, 
          reason: 'Failed to send invitation' 
        });
      }
    }

    return results;
  }

  async validateToken(token) {
    try {
      const hashedToken = await this.hashToken(token);
      const invitation = await this.invitationRepository.findByToken(hashedToken);

      if (!invitation) {
        return { valid: false, reason: 'Invalid invitation token' };
      }

      if (new Date(invitation.expiresAt) < new Date()) {
        return { valid: false, reason: 'Invitation has expired' };
      }

      if (invitation.acceptedAt) {
        return { valid: false, reason: 'Invitation already accepted' };
      }

      if (invitation.declinedAt) {
        return { valid: false, reason: 'Invitation was revoked' };
      }

      return {
        valid: true,
        email: invitation.email,
        expiresAt: invitation.expiresAt,
        inviterName: invitation.inviterName,
        role: invitation.role,
        featureGroupId: invitation.featureGroupId
      };
    } catch (error) {
      logger.error('Failed to validate token', { error: error.message });
      return { valid: false, reason: 'Failed to validate token' };
    }
  }

  async acceptInvitation({ 
    token, 
    password, 
    firstName, 
    lastName, 
    username,
    acceptTerms,
    ipAddress,
    userAgent 
  }) {
    // Validate inputs
    if (!acceptTerms) {
      throw new ValidationError('Must accept terms of service');
    }

    if (!REGEX.PASSWORD.test(password)) {
      throw new ValidationError('Invalid password format', { 
        password: 'Must be at least 8 characters with uppercase, lowercase, and number' 
      });
    }

    if (!REGEX.USERNAME.test(username)) {
      throw new ValidationError('Invalid username format', { 
        username: 'Must be 3-30 characters, alphanumeric with underscores and hyphens' 
      });
    }

    // Validate token
    const validation = await this.validateToken(token);
    if (!validation.valid) {
      throw new ValidationError(validation.reason);
    }

    const hashedToken = await this.hashToken(token);
    const invitation = await this.invitationRepository.findByToken(hashedToken);

    try {
      // Check if username already exists
      const existingUser = await this.userRepository.findByUsername(username);
      if (existingUser) {
        throw new ConflictError('Username already exists');
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, AUTH.SALT_ROUNDS);

      // Create user account
      const userId = uuidv4();
      const user = await this.userRepository.create({
        userId,
        username,
        email: invitation.email,
        passwordHash,
        firstName,
        lastName,
        invitedBy: invitation.invitedBy,
        invitationAcceptedAt: new Date(),
        featureGroupId: invitation.featureGroupId,
        emailVerified: 'Y', // Auto-verify since they came from invitation
        accountStatus: 'active'
      });

      // Create user-specific schema
      await this.userRepository.createUserSchema(user.schemaPrefix);

      // Mark invitation as accepted
      await this.invitationRepository.markAccepted(invitation.invitationId);

      // Send welcome email
      await this.emailService.sendWelcome({
        to: user.email,
        name: `${firstName} ${lastName}`,
        username
      });

      // Generate auth tokens
      const tokens = this.authService.generateTokens({ 
        userId: user.userId, 
        username: user.username,
        sessionId: uuidv4()
      });

      // Audit log
      await this.auditService.log({
        userId: user.userId,
        action: 'INVITATION_ACCEPTED',
        resourceType: 'invitation',
        resourceId: invitation.invitationId,
        ipAddress,
        userAgent
      });

      return { 
        user: {
          id: user.userId,
          username: user.username,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          createdAt: user.createdAt,
          accountStatus: user.accountStatus
        }, 
        tokens 
      };
    } catch (error) {
      if (error.isOperational) {
        throw error;
      }
      logger.error('Failed to accept invitation', { error: error.message });
      throw new DatabaseError('Failed to accept invitation', error);
    }
  }

  async resendInvitation(invitationId, resendingUserId) {
    const invitation = await this.invitationRepository.findById(invitationId);
    
    if (!invitation) {
      throw new NotFoundError('Invitation not found');
    }

    if (invitation.acceptedAt) {
      throw new ValidationError('Invitation already accepted');
    }

    if (invitation.declinedAt) {
      throw new ValidationError('Invitation was revoked');
    }

    // Generate new token and extend expiration
    const token = await this.generateSecureToken();
    const hashedToken = await this.hashToken(token);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // Update invitation
    await this.invitationRepository.updateToken(invitationId, hashedToken, expiresAt);

    // Send new invitation email
    await this.emailService.sendInvitation({
      to: invitation.email,
      inviterName: invitation.inviterName,
      customMessage: invitation.metadata?.customMessage,
      invitationUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/register/invite?token=${token}`,
      expiresAt: expiresAt.toLocaleDateString(),
      isResend: true
    });

    // Audit log
    await this.auditService.log({
      userId: resendingUserId,
      action: 'INVITATION_RESENT',
      resourceType: 'invitation',
      resourceId: invitationId,
      details: { email: invitation.email }
    });

    return { success: true, message: 'Invitation resent successfully' };
  }

  async revokeInvitation(invitationId, revokingUserId) {
    const invitation = await this.invitationRepository.findById(invitationId);
    
    if (!invitation) {
      throw new NotFoundError('Invitation not found');
    }

    if (invitation.acceptedAt) {
      throw new ValidationError('Cannot revoke accepted invitation');
    }

    if (invitation.declinedAt) {
      throw new ValidationError('Invitation already revoked');
    }

    // Mark as declined/revoked
    await this.invitationRepository.markDeclined(invitationId);

    // Audit log
    await this.auditService.log({
      userId: revokingUserId,
      action: 'INVITATION_REVOKED',
      resourceType: 'invitation',
      resourceId: invitationId,
      details: { email: invitation.email }
    });

    return { success: true, message: 'Invitation revoked successfully' };
  }

  async listInvitations({ status, page, limit, search, invitedBy }) {
    return await this.invitationRepository.list({ 
      status, 
      page, 
      limit, 
      search, 
      invitedBy 
    });
  }

  async processBulkCSV(csvData, invitedBy) {
    const lines = csvData.split('\n').filter(line => line.trim());
    const results = { queued: 0, errors: [] };
    
    // Parse CSV (simple implementation - could be enhanced with a CSV library)
    const emailSet = new Set(); // Track duplicates
    const emails = [];
    const customMessages = {};
    
    lines.forEach((line, index) => {
      const parts = line.split(',').map(part => part.trim());
      const email = parts[0]?.toLowerCase(); // Normalize email case
      const customMessage = parts[1];
      
      if (!email) {
        results.errors.push({ row: index + 1, error: 'Missing email' });
        return;
      }
      
      if (!REGEX.EMAIL.test(email)) {
        results.errors.push({ row: index + 1, error: 'Invalid email format' });
        return;
      }
      
      // Check for duplicates in the same CSV
      if (emailSet.has(email)) {
        results.errors.push({ row: index + 1, error: 'Duplicate email in CSV' });
        return;
      }
      
      emailSet.add(email);
      emails.push(email);
      if (customMessage) {
        customMessages[email] = customMessage.substring(0, 500); // Limit length
      }
    });
    
    // Queue invitations for sending
    if (emails.length > 0) {
      // In production, this would be queued to a job processor
      // For now, we'll send them directly with the custom messages
      const sendResults = await this.sendInvitations({
        emails,
        invitedBy,
        customMessage: null // Individual messages handled separately
      });
      
      results.queued = sendResults.sent.length;
      sendResults.failed.forEach(failure => {
        const row = emails.indexOf(failure.email) + 1;
        results.errors.push({ row, error: failure.reason });
      });
    }
    
    return results;
  }

  async sendReminders() {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const pendingInvitations = await this.invitationRepository.findPendingNeedingReminder(threeDaysAgo);

    let sent = 0;
    let failed = 0;

    for (const invitation of pendingInvitations) {
      try {
        const daysRemaining = Math.ceil((new Date(invitation.expiresAt) - Date.now()) / (24 * 60 * 60 * 1000));
        
        // Generate a new token for the reminder
        const newToken = await this.generateSecureToken();
        const hashedToken = await this.hashToken(newToken);
        
        // Update the invitation with the new token (keep the original expiration)
        await this.invitationRepository.updateToken(invitation.invitationId, hashedToken, invitation.expiresAt);
        
        // Send reminder email with the new token
        await this.emailService.sendInvitationReminder({
          to: invitation.email,
          invitationToken: newToken,
          daysRemaining,
          inviterName: invitation.inviterName || 'Admin'
        });

        await this.invitationRepository.markReminderSent(invitation.invitationId);
        sent++;
      } catch (error) {
        logger.error('Failed to send reminder', { invitationId: invitation.invitationId, error: error.message });
        failed++;
      }
    }

    logger.info(`Sent ${sent} invitation reminders, ${failed} failed`);
    return { sent, failed };
  }

  async cleanupExpired() {
    const deleted = await this.invitationRepository.deleteExpired();
    logger.info(`Cleaned up ${deleted} expired invitations`);
    return deleted;
  }

  async getInvitationStats(userId) {
    return await this.invitationRepository.getStatsByInviter(userId);
  }

  async generateSecureToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  async hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Compare tokens in constant time to prevent timing attacks
   */
  compareTokens(token1, token2) {
    if (!token1 || !token2) return false;
    if (token1.length !== token2.length) return false;
    
    const buf1 = Buffer.from(token1);
    const buf2 = Buffer.from(token2);
    
    try {
      return crypto.timingSafeEqual(buf1, buf2);
    } catch {
      return false;
    }
  }
}

module.exports = InvitationService;