# Issue #22: Admin Invitation System Implementation

## Title
Implement Secure Admin-Driven User Invitation System with Email Workflow

## User Story
As a platform administrator, I want to invite new users via email with secure time-limited tokens so that I can control user onboarding while allowing users to set their own passwords securely.

## Description
Implement a comprehensive invitation system that allows administrators to invite users via email. The system will generate secure invitation tokens with 7-day expiration, send branded invitation emails, and guide users through a self-registration process where they set their own passwords. This maintains security while providing a smooth onboarding experience.

## Acceptance Criteria

### Admin Interface
- [ ] Admin UI page for sending invitations (bulk and individual)
- [ ] Invitation template customization interface
- [ ] Invitation history and status tracking dashboard
- [ ] Ability to resend or revoke pending invitations
- [ ] CSV upload for bulk invitations
- [ ] Role and feature group assignment during invitation

### Invitation Workflow
- [ ] Generate cryptographically secure invitation tokens
- [ ] Store invitation records with 7-day expiration
- [ ] Send branded HTML invitation emails via email service
- [ ] Track email delivery and open status
- [ ] Automatic reminder email after 3 days if not accepted
- [ ] Automatic cleanup of expired invitations

### User Registration Flow
- [ ] Public invitation acceptance endpoint with token validation
- [ ] Registration form pre-populated with invited email
- [ ] Password strength requirements enforcement
- [ ] Terms of service and privacy policy acceptance
- [ ] Automatic login after successful registration
- [ ] Welcome email upon successful registration

### Security Requirements
- [ ] Rate limiting on invitation sending (max 100/hour per admin)
- [ ] Token validation with timing attack prevention
- [ ] Invitation tokens single-use only
- [ ] IP-based rate limiting on registration endpoint
- [ ] Audit logging of all invitation activities
- [ ] CAPTCHA on registration form if needed

## Technical Implementation

### API Endpoints

```javascript
// Admin invitation endpoints
POST   /api/admin/invitations/send
  Body: {
    emails: string[],
    role?: string,
    featureGroupId?: string,
    customMessage?: string,
    expirationDays?: number (default: 7)
  }
  Response: {
    sent: Array<{email, invitationId, status}>,
    failed: Array<{email, reason}>
  }

GET    /api/admin/invitations
  Query: {
    status?: 'pending' | 'accepted' | 'expired' | 'revoked',
    page?: number,
    limit?: number,
    search?: string
  }
  Response: {
    invitations: Array<Invitation>,
    total: number,
    page: number
  }

POST   /api/admin/invitations/:id/resend
  Response: { success: boolean, message: string }

DELETE /api/admin/invitations/:id
  Response: { success: boolean }

POST   /api/admin/invitations/bulk
  Body: { csvData: string }
  Response: { 
    queued: number,
    errors: Array<{row, error}>
  }

// Public invitation endpoints
GET    /api/invitations/validate/:token
  Response: {
    valid: boolean,
    email?: string,
    expiresAt?: Date,
    inviterName?: string
  }

POST   /api/invitations/accept
  Body: {
    token: string,
    password: string,
    firstName: string,
    lastName: string,
    acceptTerms: boolean
  }
  Response: {
    success: boolean,
    user?: UserProfile,
    tokens?: AuthTokens
  }
```

### Service Implementation

```javascript
// backend/src/services/invitationService.js
class InvitationService {
  constructor(invitationRepository, emailService, auditService) {
    this.invitationRepository = invitationRepository;
    this.emailService = emailService;
    this.auditService = auditService;
  }

  async sendInvitations({ emails, invitedBy, role, featureGroupId, customMessage }) {
    const results = { sent: [], failed: [] };
    
    for (const email of emails) {
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
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

        // Create invitation record
        const invitation = await this.invitationRepository.create({
          email,
          invitationToken: await this.hashToken(token),
          invitedBy,
          role,
          featureGroupId,
          expiresAt,
          metadata: {
            customMessage,
            inviterName: await this.getUserName(invitedBy)
          }
        });

        // Send invitation email
        await this.emailService.sendInvitation({
          to: email,
          invitationUrl: `${process.env.FRONTEND_URL}/register?token=${token}`,
          inviterName: invitation.metadata.inviterName,
          customMessage,
          expiresAt
        });

        results.sent.push({
          email,
          invitationId: invitation.id,
          status: 'sent'
        });

        // Audit log
        await this.auditService.log({
          userId: invitedBy,
          action: 'INVITATION_SENT',
          resourceType: 'invitation',
          resourceId: invitation.id,
          details: { email, role }
        });
      } catch (error) {
        logger.error('Failed to send invitation', { email, error });
        results.failed.push({ 
          email, 
          reason: 'Failed to send' 
        });
      }
    }

    return results;
  }

  async acceptInvitation({ token, password, firstName, lastName, acceptTerms }) {
    // Validate token
    const hashedToken = await this.hashToken(token);
    const invitation = await this.invitationRepository.findByToken(hashedToken);

    if (!invitation) {
      throw new ValidationError('Invalid invitation token');
    }

    if (invitation.expiresAt < new Date()) {
      throw new ValidationError('Invitation has expired');
    }

    if (invitation.acceptedAt) {
      throw new ValidationError('Invitation already accepted');
    }

    // Create user account
    const user = await this.userService.createFromInvitation({
      email: invitation.email,
      password,
      firstName,
      lastName,
      role: invitation.role,
      featureGroupId: invitation.featureGroupId,
      invitedBy: invitation.invitedBy
    });

    // Mark invitation as accepted
    await this.invitationRepository.markAccepted(invitation.id);

    // Send welcome email
    await this.emailService.sendWelcome({
      to: user.email,
      name: `${firstName} ${lastName}`
    });

    // Generate auth tokens
    const tokens = await this.authService.generateTokens(user);

    // Audit log
    await this.auditService.log({
      userId: user.id,
      action: 'INVITATION_ACCEPTED',
      resourceType: 'invitation',
      resourceId: invitation.id
    });

    return { user, tokens };
  }

  async sendReminders() {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const pendingInvitations = await this.invitationRepository.findPendingNeedingReminder(threeDaysAgo);

    for (const invitation of pendingInvitations) {
      try {
        await this.emailService.sendInvitationReminder({
          to: invitation.email,
          invitationUrl: `${process.env.FRONTEND_URL}/register?token=${invitation.token}`,
          daysRemaining: Math.ceil((invitation.expiresAt - Date.now()) / (24 * 60 * 60 * 1000))
        });

        await this.invitationRepository.markReminderSent(invitation.id);
      } catch (error) {
        logger.error('Failed to send reminder', { invitationId: invitation.id, error });
      }
    }
  }

  async cleanupExpired() {
    const expired = await this.invitationRepository.deleteExpired();
    logger.info(`Cleaned up ${expired} expired invitations`);
    return expired;
  }

  async generateSecureToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  async hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}
```

### Email Templates

```html
<!-- Invitation Email Template -->
<!DOCTYPE html>
<html>
<head>
  <style>
    .container { max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; }
    .header { background: #4F46E5; color: white; padding: 20px; text-align: center; }
    .content { padding: 30px; background: #f9fafb; }
    .button { 
      display: inline-block; 
      padding: 12px 24px; 
      background: #4F46E5; 
      color: white; 
      text-decoration: none; 
      border-radius: 6px; 
      margin: 20px 0;
    }
    .footer { padding: 20px; text-align: center; color: #6b7280; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>You're Invited to Pathfinder</h1>
    </div>
    <div class="content">
      <p>Hi there,</p>
      <p>{{inviterName}} has invited you to join Pathfinder, the AI-powered career navigation platform.</p>
      {{#if customMessage}}
        <blockquote style="border-left: 3px solid #4F46E5; padding-left: 15px; margin: 20px 0;">
          {{customMessage}}
        </blockquote>
      {{/if}}
      <p>Click the button below to accept your invitation and create your account:</p>
      <div style="text-align: center;">
        <a href="{{invitationUrl}}" class="button">Accept Invitation</a>
      </div>
      <p style="color: #6b7280; font-size: 14px;">
        This invitation will expire on {{expiresAt}}. 
        If the button doesn't work, copy and paste this link into your browser:
      </p>
      <p style="word-break: break-all; color: #6b7280; font-size: 12px;">
        {{invitationUrl}}
      </p>
    </div>
    <div class="footer">
      <p>© 2025 Pathfinder. All rights reserved.</p>
      <p>This invitation was sent to {{email}}. If you didn't expect this invitation, you can safely ignore this email.</p>
    </div>
  </div>
</body>
</html>
```

### Admin UI Components

```typescript
// frontend/src/components/admin/InvitationManager.tsx
import React, { useState } from 'react';
import { useInvitations } from '../../hooks/useInvitations';

export const InvitationManager: React.FC = () => {
  const [emails, setEmails] = useState<string[]>([]);
  const [customMessage, setCustomMessage] = useState('');
  const { sendInvitations, invitations, loading } = useInvitations();

  const handleSendInvitations = async () => {
    const result = await sendInvitations({
      emails,
      customMessage,
      role: 'user',
      featureGroupId: null
    });

    if (result.sent.length > 0) {
      toast.success(`Successfully sent ${result.sent.length} invitations`);
    }
    if (result.failed.length > 0) {
      toast.error(`Failed to send ${result.failed.length} invitations`);
    }
  };

  const handleBulkUpload = async (file: File) => {
    const text = await file.text();
    const emails = text.split('\n')
      .map(line => line.trim())
      .filter(email => email && isValidEmail(email));
    setEmails(emails);
  };

  return (
    <div className="invitation-manager">
      <h2>Send Invitations</h2>
      
      <div className="invitation-form">
        <div className="form-group">
          <label>Email Addresses</label>
          <textarea
            value={emails.join('\n')}
            onChange={(e) => setEmails(e.target.value.split('\n'))}
            placeholder="Enter email addresses, one per line"
            rows={5}
          />
        </div>

        <div className="form-group">
          <label>Custom Message (Optional)</label>
          <textarea
            value={customMessage}
            onChange={(e) => setCustomMessage(e.target.value)}
            placeholder="Add a personal message to the invitation"
            rows={3}
          />
        </div>

        <div className="form-actions">
          <input
            type="file"
            accept=".csv,.txt"
            onChange={(e) => e.target.files?.[0] && handleBulkUpload(e.target.files[0])}
          />
          <button onClick={handleSendInvitations} disabled={loading || emails.length === 0}>
            Send Invitations
          </button>
        </div>
      </div>

      <div className="invitation-list">
        <h3>Recent Invitations</h3>
        <table>
          <thead>
            <tr>
              <th>Email</th>
              <th>Status</th>
              <th>Invited By</th>
              <th>Expires</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {invitations.map(inv => (
              <tr key={inv.id}>
                <td>{inv.email}</td>
                <td>
                  <span className={`status ${inv.status}`}>
                    {inv.status}
                  </span>
                </td>
                <td>{inv.inviterName}</td>
                <td>{formatDate(inv.expiresAt)}</td>
                <td>
                  {inv.status === 'pending' && (
                    <>
                      <button onClick={() => resendInvitation(inv.id)}>
                        Resend
                      </button>
                      <button onClick={() => revokeInvitation(inv.id)}>
                        Revoke
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
```

## Security Considerations

1. **Token Security**
   - Use cryptographically secure random token generation
   - Store only hashed tokens in database
   - Implement constant-time comparison for token validation
   - Single-use tokens with immediate invalidation after use

2. **Rate Limiting**
   - Admin: Max 100 invitations per hour
   - Public registration: Max 5 attempts per IP per hour
   - Email sending: Queue with rate limits per provider

3. **Email Security**
   - SPF, DKIM, and DMARC configuration
   - Track bounces and complaints
   - Unsubscribe link in all emails
   - Email validation before sending

4. **Audit Trail**
   - Log all invitation creation, sending, and acceptance
   - Track failed attempts and suspicious activity
   - Retain logs for compliance (7 years)

## Testing Requirements

1. **Unit Tests**
   - Token generation and validation
   - Email template rendering
   - Expiration logic
   - Rate limiting logic

2. **Integration Tests**
   - End-to-end invitation flow
   - Email delivery testing
   - Database transaction handling
   - Cleanup job execution

3. **Security Tests**
   - Token entropy testing
   - Rate limit enforcement
   - SQL injection prevention
   - XSS prevention in email templates

## Documentation Updates

- Admin user guide for invitation management
- API documentation for invitation endpoints
- Email template customization guide
- Security best practices for invitation flow

## Dependencies

- Issue #21: Database Schema Optimization (for invitation tables)
- Email service provider (SendGrid/AWS SES)
- Redis for rate limiting
- Background job processor for reminders/cleanup

## Estimated Effort

**Large (L)** - 5-7 days

### Justification:
- Complex multi-step workflow
- Email integration and template design
- Admin UI development
- Security considerations
- Testing of time-based features

## Priority

**High** - Critical for controlled user onboarding

## Labels

- `feature`
- `security`
- `user-management`
- `email`
- `admin`