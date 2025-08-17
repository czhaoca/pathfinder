const nodemailer = require('nodemailer');
const handlebars = require('handlebars');
const fs = require('fs').promises;
const path = require('path');

class EmailService {
  constructor() {
    // Initialize transporter based on environment
    if (process.env.NODE_ENV === 'production') {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });
    } else {
      // Use test account for development
      this.initTestTransporter();
    }

    this.templatesPath = path.join(__dirname, '../templates/emails');
    this.compiledTemplates = new Map();
  }

  async initTestTransporter() {
    // Create test account if in development
    const testAccount = await nodemailer.createTestAccount();
    
    this.transporter = nodemailer.createTransporter({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass
      }
    });
  }

  async loadTemplate(templateName) {
    if (this.compiledTemplates.has(templateName)) {
      return this.compiledTemplates.get(templateName);
    }

    try {
      const templatePath = path.join(this.templatesPath, `${templateName}.hbs`);
      const templateSource = await fs.readFile(templatePath, 'utf-8');
      const compiledTemplate = handlebars.compile(templateSource);
      
      this.compiledTemplates.set(templateName, compiledTemplate);
      return compiledTemplate;
    } catch (error) {
      console.error(`Failed to load email template ${templateName}:`, error);
      throw error;
    }
  }

  async send({ to, subject, template, data }) {
    try {
      // Load and compile template
      const compiledTemplate = await this.loadTemplate(template);
      const html = compiledTemplate(data);

      // Create plain text version
      const text = this.htmlToText(html);

      // Send email
      const info = await this.transporter.sendMail({
        from: process.env.EMAIL_FROM || '"Pathfinder" <noreply@pathfinder.app>',
        to,
        subject,
        text,
        html
      });

      console.log('Email sent:', info.messageId);

      // In development, log preview URL
      if (process.env.NODE_ENV !== 'production') {
        console.log('Preview URL:', nodemailer.getTestMessageUrl(info));
      }

      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('Failed to send email:', error);
      throw error;
    }
  }

  htmlToText(html) {
    // Simple HTML to text conversion
    return html
      .replace(/<style[^>]*>.*?<\/style>/gi, '')
      .replace(/<script[^>]*>.*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  async sendDeletionInitiated(user, data) {
    return this.send({
      to: user.email,
      subject: 'Account Deletion Scheduled - 7 Day Notice',
      template: 'deletion-initiated',
      data: {
        name: user.name,
        scheduledDate: data.scheduledDate,
        cancellationToken: data.cancellationToken,
        cancellationUrl: `${process.env.APP_URL}/account/cancel-deletion?token=${data.cancellationToken}`
      }
    });
  }

  async sendDeletionReminder(user, daysRemaining, cancellationToken) {
    return this.send({
      to: user.email,
      subject: `Account Deletion Reminder - ${daysRemaining} Days Remaining`,
      template: 'deletion-reminder',
      data: {
        name: user.name,
        daysRemaining,
        cancellationUrl: `${process.env.APP_URL}/account/cancel-deletion?token=${cancellationToken}`
      }
    });
  }

  async sendDeletionFinalWarning(user, cancellationToken) {
    return this.send({
      to: user.email,
      subject: '⚠️ FINAL WARNING: Account Deletion in 24 Hours',
      template: 'deletion-final-warning',
      data: {
        name: user.name,
        hoursRemaining: 24,
        cancellationUrl: `${process.env.APP_URL}/account/cancel-deletion?token=${cancellationToken}`,
        urgent: true
      }
    });
  }

  async sendDeletionCancelled(user) {
    return this.send({
      to: user.email,
      subject: 'Account Deletion Cancelled',
      template: 'deletion-cancelled',
      data: {
        name: user.name,
        message: 'Your account deletion request has been cancelled successfully.'
      }
    });
  }

  async sendDeletionCompleted(user) {
    return this.send({
      to: user.email,
      subject: 'Account Successfully Deleted',
      template: 'deletion-completed',
      data: {
        name: user.name || 'User',
        message: 'Your account and all associated data have been permanently deleted.'
      }
    });
  }

  async sendInvitation({ to, inviterName, customMessage, invitationUrl, expiresAt, isResend = false }) {
    return this.send({
      to,
      subject: isResend ? 'Reminder: Your Pathfinder Invitation' : 'You\'re Invited to Join Pathfinder',
      template: 'invitation',
      data: {
        to,
        inviterName,
        customMessage,
        invitationUrl,
        expiresAt,
        isResend,
        unsubscribeUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/unsubscribe`,
        privacyUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/privacy`
      }
    });
  }

  async sendInvitationReminder({ to, inviterName, invitationUrl, daysRemaining }) {
    return this.send({
      to,
      subject: `Action Required: Your Pathfinder Invitation Expires in ${daysRemaining} Days`,
      template: 'invitation-reminder',
      data: {
        to,
        inviterName,
        invitationUrl,
        daysRemaining,
        unsubscribeUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/unsubscribe`,
        privacyUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/privacy`
      }
    });
  }

  async sendWelcome({ to, name, username }) {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    return this.send({
      to,
      subject: 'Welcome to Pathfinder - Let\'s Get Started!',
      template: 'welcome',
      data: {
        to,
        name,
        username,
        dashboardUrl: `${frontendUrl}/dashboard`,
        gettingStartedUrl: `${frontendUrl}/getting-started`,
        videoTutorialsUrl: `${frontendUrl}/tutorials`,
        helpCenterUrl: `${frontendUrl}/help`,
        communityUrl: `${frontendUrl}/community`,
        profileUrl: `${frontendUrl}/profile`,
        privacyUrl: `${frontendUrl}/privacy`,
        supportUrl: `${frontendUrl}/support`
      }
    });
  }
}

module.exports = EmailService;