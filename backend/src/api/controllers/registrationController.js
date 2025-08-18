/**
 * Registration Controller
 * 
 * Handles HTTP requests for user registration with DDoS protection
 */

const logger = require('../../utils/logger');
const { successResponse, errorResponse } = require('../../utils/apiResponse');

class RegistrationController {
  constructor(registrationService, protectionService, featureFlagService) {
    this.registrationService = registrationService;
    this.protectionService = protectionService;
    this.featureFlagService = featureFlagService;
  }

  /**
   * Register a new user
   */
  async register(req, res) {
    try {
      const registrationData = {
        email: req.body.email,
        username: req.body.username,
        password: req.body.password,
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        captchaToken: req.body.captchaToken
      };

      const requestContext = {
        ipAddress: req.ipAddress || req.ip,
        userAgent: req.headers['user-agent'],
        fingerprint: req.body.fingerprint,
        headers: req.headers
      };

      const result = await this.registrationService.register(registrationData, requestContext);
      
      return successResponse(res, 'Registration initiated successfully', result, 201);
    } catch (error) {
      logger.error('Registration failed', { 
        error: error.message, 
        ip: req.ipAddress,
        email: req.body.email 
      });

      // Handle special error cases
      if (error.message === 'CAPTCHA_REQUIRED') {
        return errorResponse(res, 'CAPTCHA_REQUIRED', 400, {
          requireCaptcha: true
        });
      }

      if (error.name === 'RateLimitError') {
        return errorResponse(res, error.message, 429);
      }

      if (error.name === 'SecurityError') {
        return errorResponse(res, error.message, 403);
      }

      if (error.name === 'ConflictError') {
        return errorResponse(res, error.message, 409);
      }

      if (error.name === 'ValidationError') {
        return errorResponse(res, error.message, 400, error.details);
      }

      return errorResponse(res, 'Registration failed. Please try again later.', 500);
    }
  }

  /**
   * Check username availability
   */
  async checkUsername(req, res) {
    try {
      const { username } = req.body;
      const result = await this.registrationService.checkUsernameAvailability(username);
      
      return successResponse(res, 'Username check completed', result);
    } catch (error) {
      logger.error('Username check failed', { error: error.message });
      return errorResponse(res, 'Unable to check username availability', 500);
    }
  }

  /**
   * Check email availability
   */
  async checkEmail(req, res) {
    try {
      const { email } = req.body;
      const result = await this.registrationService.checkEmailAvailability(email);
      
      return successResponse(res, 'Email check completed', result);
    } catch (error) {
      logger.error('Email check failed', { error: error.message });
      return errorResponse(res, 'Unable to check email availability', 500);
    }
  }

  /**
   * Verify email with token
   */
  async verifyEmail(req, res) {
    try {
      const { token } = req.query;
      const user = await this.registrationService.completeRegistration(token);
      
      return successResponse(res, 'Email verified successfully', {
        success: true,
        username: user.username,
        message: 'Your email has been verified. You can now log in.'
      });
    } catch (error) {
      logger.error('Email verification failed', { error: error.message });
      
      if (error.name === 'ValidationError') {
        return errorResponse(res, error.message, 400);
      }
      
      return errorResponse(res, 'Email verification failed', 500);
    }
  }

  /**
   * Verify email with 6-digit code
   */
  async verifyEmailCode(req, res) {
    try {
      const { email, code } = req.body;
      const user = await this.registrationService.verifyWithCode(email, code);
      
      return successResponse(res, 'Email verified successfully', {
        success: true,
        username: user.username
      });
    } catch (error) {
      logger.error('Code verification failed', { error: error.message });
      return errorResponse(res, 'Invalid or expired verification code', 400);
    }
  }

  /**
   * Resend verification email
   */
  async resendVerification(req, res) {
    try {
      const { email } = req.body;
      await this.registrationService.resendVerificationEmail(email);
      
      return successResponse(res, 'Verification email sent', {
        success: true,
        message: 'If this email is registered, a verification email has been sent.'
      });
    } catch (error) {
      // Don't reveal if email exists or not
      logger.error('Resend verification failed', { error: error.message });
      return successResponse(res, 'Verification email sent', {
        success: true,
        message: 'If this email is registered, a verification email has been sent.'
      });
    }
  }

  /**
   * Get registration status
   */
  async getRegistrationStatus(req, res) {
    try {
      const ipAddress = req.ipAddress || req.ip;
      const enabled = await this.registrationService.checkRegistrationEnabled(ipAddress);
      
      return successResponse(res, 'Registration status', {
        enabled,
        message: enabled ? 
          'Registration is open' : 
          'Registration is currently closed'
      });
    } catch (error) {
      logger.error('Status check failed', { error: error.message });
      return errorResponse(res, 'Unable to check registration status', 500);
    }
  }

  /**
   * Get registration metrics (Admin)
   */
  async getMetrics(req, res) {
    try {
      const metrics = await this.getRegistrationMetrics();
      return successResponse(res, 'Registration metrics', metrics);
    } catch (error) {
      logger.error('Failed to get metrics', { error: error.message });
      return errorResponse(res, 'Unable to retrieve metrics', 500);
    }
  }

  /**
   * Get security alerts (Admin)
   */
  async getAlerts(req, res) {
    try {
      const alerts = await this.getSecurityAlerts();
      return successResponse(res, 'Security alerts', { alerts });
    } catch (error) {
      logger.error('Failed to get alerts', { error: error.message });
      return errorResponse(res, 'Unable to retrieve alerts', 500);
    }
  }

  /**
   * Emergency disable registration (Admin)
   */
  async emergencyDisable(req, res) {
    try {
      const { reason } = req.body;
      const result = await this.registrationService.emergencyDisable(reason);
      
      logger.warn('Registration emergency disabled', { 
        reason, 
        admin: req.user.username 
      });
      
      return successResponse(res, 'Registration disabled', result);
    } catch (error) {
      logger.error('Failed to disable registration', { error: error.message });
      return errorResponse(res, 'Unable to disable registration', 500);
    }
  }

  /**
   * Block IP address (Admin)
   */
  async blockIP(req, res) {
    try {
      const { ipAddress, duration, reason } = req.body;
      await this.protectionService.blockIP(ipAddress, duration, reason);
      
      logger.info('IP blocked by admin', {
        ipAddress,
        duration,
        reason,
        admin: req.user.username
      });
      
      return successResponse(res, 'IP blocked successfully', {
        ipAddress,
        blockedUntil: new Date(Date.now() + duration * 60 * 1000)
      });
    } catch (error) {
      logger.error('Failed to block IP', { error: error.message });
      return errorResponse(res, 'Unable to block IP', 500);
    }
  }

  /**
   * Unblock IP address (Admin)
   */
  async unblockIP(req, res) {
    try {
      const { ipAddress } = req.body;
      await this.unblockIPAddress(ipAddress);
      
      logger.info('IP unblocked by admin', {
        ipAddress,
        admin: req.user.username
      });
      
      return successResponse(res, 'IP unblocked successfully', { ipAddress });
    } catch (error) {
      logger.error('Failed to unblock IP', { error: error.message });
      return errorResponse(res, 'Unable to unblock IP', 500);
    }
  }

  /**
   * Get blocked IPs (Admin)
   */
  async getBlockedIPs(req, res) {
    try {
      const blockedIPs = await this.getBlockedIPList();
      return successResponse(res, 'Blocked IPs', { blockedIPs });
    } catch (error) {
      logger.error('Failed to get blocked IPs', { error: error.message });
      return errorResponse(res, 'Unable to retrieve blocked IPs', 500);
    }
  }

  /**
   * Blacklist domain (Admin)
   */
  async blacklistDomain(req, res) {
    try {
      const { domain, reason } = req.body;
      await this.addDomainToBlacklist(domain, reason, req.user.username);
      
      logger.info('Domain blacklisted', {
        domain,
        reason,
        admin: req.user.username
      });
      
      return successResponse(res, 'Domain blacklisted successfully', { domain });
    } catch (error) {
      logger.error('Failed to blacklist domain', { error: error.message });
      return errorResponse(res, 'Unable to blacklist domain', 500);
    }
  }

  /**
   * Whitelist domain (Admin)
   */
  async whitelistDomain(req, res) {
    try {
      const { domain } = req.body;
      await this.removeDomainFromBlacklist(domain);
      
      logger.info('Domain whitelisted', {
        domain,
        admin: req.user.username
      });
      
      return successResponse(res, 'Domain whitelisted successfully', { domain });
    } catch (error) {
      logger.error('Failed to whitelist domain', { error: error.message });
      return errorResponse(res, 'Unable to whitelist domain', 500);
    }
  }

  /**
   * Get registration attempts (Admin)
   */
  async getRegistrationAttempts(req, res) {
    try {
      const { limit = 50, offset = 0, success } = req.query;
      const attempts = await this.getAttempts(limit, offset, success);
      
      return successResponse(res, 'Registration attempts', {
        attempts,
        limit,
        offset
      });
    } catch (error) {
      logger.error('Failed to get attempts', { error: error.message });
      return errorResponse(res, 'Unable to retrieve attempts', 500);
    }
  }

  /**
   * Get attack patterns (Admin)
   */
  async getAttackPatterns(req, res) {
    try {
      const patterns = await this.getDetectedAttackPatterns();
      return successResponse(res, 'Attack patterns', { patterns });
    } catch (error) {
      logger.error('Failed to get attack patterns', { error: error.message });
      return errorResponse(res, 'Unable to retrieve attack patterns', 500);
    }
  }

  /**
   * Clear alerts (Admin)
   */
  async clearAlerts(req, res) {
    try {
      const { alertIds } = req.body;
      await this.acknowledgeAlerts(alertIds, req.user.username);
      
      return successResponse(res, 'Alerts cleared', {
        clearedCount: alertIds.length
      });
    } catch (error) {
      logger.error('Failed to clear alerts', { error: error.message });
      return errorResponse(res, 'Unable to clear alerts', 500);
    }
  }

  /**
   * Update registration configuration (Admin)
   */
  async updateConfiguration(req, res) {
    try {
      const config = req.body;
      const updated = await this.updateRegistrationConfig(config);
      
      logger.info('Registration configuration updated', {
        config,
        admin: req.user.username
      });
      
      return successResponse(res, 'Configuration updated', updated);
    } catch (error) {
      logger.error('Failed to update configuration', { error: error.message });
      return errorResponse(res, 'Unable to update configuration', 500);
    }
  }

  // Helper methods

  async getRegistrationMetrics() {
    const result = await this.protectionService.database.query(`
      SELECT 
        COUNT(*) as total_attempts,
        COUNT(*) FILTER (WHERE success = true) as successful_registrations,
        COUNT(*) FILTER (WHERE success = false) as failed_attempts,
        COUNT(DISTINCT ip_address) as unique_ips,
        COUNT(*) FILTER (WHERE captcha_required = true) as captcha_challenges,
        COUNT(*) FILTER (WHERE captcha_verified = true) as captcha_passed,
        AVG(suspicion_score) as avg_suspicion_score
      FROM pf_registration_attempts
      WHERE attempted_at > NOW() - INTERVAL '24 hours'
    `);

    const blockedIPs = await this.protectionService.database.query(`
      SELECT COUNT(*) as count 
      FROM pf_blocked_ips 
      WHERE expires_at IS NULL OR expires_at > NOW()
    `);

    return {
      totalAttempts: parseInt(result.rows[0].total_attempts),
      successfulRegistrations: parseInt(result.rows[0].successful_registrations),
      failedAttempts: parseInt(result.rows[0].failed_attempts),
      blockedIPs: parseInt(blockedIPs.rows[0].count),
      uniqueIPs: parseInt(result.rows[0].unique_ips),
      captchaChallenges: parseInt(result.rows[0].captcha_challenges),
      captchaPassed: parseInt(result.rows[0].captcha_passed),
      avgSuspicionScore: parseFloat(result.rows[0].avg_suspicion_score) || 0
    };
  }

  async getSecurityAlerts() {
    const result = await this.protectionService.database.query(`
      SELECT * FROM pf_registration_alerts 
      WHERE acknowledged = false 
      ORDER BY created_at DESC 
      LIMIT 100
    `);
    
    return result.rows;
  }

  async unblockIPAddress(ipAddress) {
    await this.protectionService.redis.del(`blocked:${ipAddress}`);
    await this.protectionService.database.query(
      'DELETE FROM pf_blocked_ips WHERE ip_address = $1',
      [ipAddress]
    );
  }

  async getBlockedIPList() {
    const result = await this.protectionService.database.query(`
      SELECT * FROM pf_blocked_ips 
      WHERE expires_at IS NULL OR expires_at > NOW()
      ORDER BY blocked_at DESC
    `);
    
    return result.rows;
  }

  async addDomainToBlacklist(domain, reason, admin) {
    await this.protectionService.database.query(
      `INSERT INTO pf_blacklisted_domains 
       (domain, reason, blacklisted_by, blacklisted_at) 
       VALUES ($1, $2, $3, NOW())`,
      [domain, reason, admin]
    );
  }

  async removeDomainFromBlacklist(domain) {
    await this.protectionService.database.query(
      'DELETE FROM pf_blacklisted_domains WHERE domain = $1',
      [domain]
    );
  }

  async getAttempts(limit, offset, success) {
    let query = `
      SELECT * FROM pf_registration_attempts 
      WHERE 1=1
    `;
    const params = [];
    
    if (success !== undefined) {
      params.push(success === 'true');
      query += ` AND success = $${params.length}`;
    }
    
    params.push(limit, offset);
    query += ` ORDER BY attempted_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;
    
    const result = await this.protectionService.database.query(query, params);
    return result.rows;
  }

  async getDetectedAttackPatterns() {
    const result = await this.protectionService.database.query(`
      SELECT * FROM pf_detected_attacks 
      WHERE detected_at > NOW() - INTERVAL '7 days'
      ORDER BY detected_at DESC
    `);
    
    return result.rows;
  }

  async acknowledgeAlerts(alertIds, admin) {
    await this.protectionService.database.query(
      `UPDATE pf_registration_alerts 
       SET acknowledged = true, 
           acknowledged_by = $1, 
           acknowledged_at = NOW()
       WHERE id = ANY($2)`,
      [admin, alertIds]
    );
  }

  async updateRegistrationConfig(config) {
    const flagValue = {
      defaultValue: config.enabled ? 'true' : 'false',
      rolloutPercentage: config.rolloutPercentage,
      maxAttemptsPerIP: config.maxAttemptsPerIP,
      maxAttemptsPerEmail: config.maxAttemptsPerEmail,
      blockDurationMinutes: config.blockDurationMinutes,
      requireEmailVerification: true,
      enableCaptcha: config.requireCaptcha,
      allowedCountries: config.allowedCountries || [],
      blockedCountries: config.blockedCountries || []
    };

    await this.featureFlagService.updateFlag(
      'self_registration_enabled',
      flagValue,
      'Admin configuration update'
    );

    return flagValue;
  }
}

module.exports = { RegistrationController };