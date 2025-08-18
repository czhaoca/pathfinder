/**
 * Registration Service with DDoS Protection
 * 
 * Handles user registration with comprehensive security measures:
 * - Multi-layer DDoS protection
 * - Email verification
 * - Bot detection
 * - Rate limiting
 * - Attack pattern detection
 */

const bcrypt = require('bcrypt');
const crypto = require('crypto');
const dns = require('dns').promises;
const { v4: uuidv4 } = require('uuid');
const speakeasy = require('speakeasy');
const DOMPurify = require('dompurify');
const { JSDOM } = require('jsdom');

const logger = require('../utils/logger');
const { 
  ValidationError, 
  AuthenticationError, 
  ConflictError,
  RateLimitError,
  SecurityError 
} = require('../utils/errors');
const { AUTH, REGEX } = require('../utils/constants');

// Initialize DOMPurify with JSDOM
const window = new JSDOM('').window;
const purify = DOMPurify(window);

class RegistrationService {
  constructor(userService, emailService, protectionService, featureFlagService, auditService) {
    this.userService = userService;
    this.emailService = emailService;
    this.protectionService = protectionService;
    this.featureFlagService = featureFlagService;
    this.auditService = auditService;
    this.notificationService = null; // Injected separately if needed
    this.analyticsService = null; // Injected separately if needed
    
    // Protection thresholds
    this.thresholds = {
      maxAttemptsPerIP: 5,
      maxAttemptsPerEmail: 3,
      windowMinutes: 15,
      blockDurationMinutes: 60,
      suspicionScoreThreshold: 0.7,
      captchaThreshold: 3,
      emergencyDisableThreshold: 500
    };
    
    // Suspicious patterns
    this.suspiciousPatterns = [
      /test\d+@/i,
      /admin@/i,
      /noreply@/i,
      /\d{5,}@/,  // Many numbers in email
      /^[a-z]{1,2}\d+@/i, // Short prefix with numbers
      /temp.*@/i,
      /disposable.*@/i,
      /fake.*@/i
    ];

    // Bot user agent patterns
    this.botUserAgents = [
      /bot/i,
      /spider/i,
      /crawl/i,
      /selenium/i,
      /puppeteer/i,
      /playwright/i,
      /phantomjs/i,
      /headless/i,
      /automated/i,
      /scraper/i
    ];
  }

  /**
   * Main registration method with full protection
   */
  async register(registrationData, requestContext) {
    const { email, username, password, firstName, lastName, captchaToken } = registrationData;
    const { ipAddress, userAgent, fingerprint, headers } = requestContext;

    // Sanitize input
    const sanitizedData = this.sanitizeInput({
      email: email?.toLowerCase().trim(),
      username: username?.toLowerCase().trim(),
      password,
      firstName: firstName?.trim(),
      lastName: lastName?.trim()
    });

    try {
      // Check if registration is enabled
      const isEnabled = await this.checkRegistrationEnabled(ipAddress);
      if (!isEnabled) {
        throw new SecurityError('Registration is currently disabled');
      }

      // Run protection checks
      await this.runProtectionChecks({
        email: sanitizedData.email,
        ipAddress,
        fingerprint,
        userAgent,
        captchaToken,
        headers
      });

      // Validate registration data
      await this.validateRegistrationData(sanitizedData);

      // Check for existing user
      await this.checkExistingUser(sanitizedData.email, sanitizedData.username);

      // Create pending registration
      const pendingRegistration = await this.createPendingRegistration({
        ...sanitizedData,
        ipAddress,
        fingerprint
      });

      // Send verification email
      await this.emailService.sendVerificationEmail({
        email: sanitizedData.email,
        username: sanitizedData.username,
        firstName: sanitizedData.firstName,
        verificationToken: pendingRegistration.verificationToken,
        verificationCode: pendingRegistration.verificationCode
      });

      // Track successful registration attempt
      await this.protectionService.trackSuccessfulRegistration({
        email: sanitizedData.email,
        ipAddress,
        fingerprint
      });

      // Analytics
      if (this.analyticsService) {
        await this.analyticsService.track('registration_initiated', {
          emailDomain: sanitizedData.email.split('@')[1],
          hasFingerprint: !!fingerprint,
          captchaRequired: !!captchaToken
        });
      }

      // Audit log
      await this.auditService.logRegistration({
        action: 'REGISTRATION_INITIATED',
        email: this.hashEmail(sanitizedData.email),
        username: sanitizedData.username,
        ipAddress,
        success: true
      });

      return {
        success: true,
        message: 'Registration successful. Please check your email for verification.',
        requiresVerification: true
      };

    } catch (error) {
      // Track failed attempt
      await this.protectionService.trackFailedAttempt({
        email: email,
        ipAddress,
        fingerprint,
        reason: error.message
      });

      // Check if we should escalate protection
      await this.checkEscalation(ipAddress);

      // Audit log
      await this.auditService.logSecurityEvent({
        action: 'REGISTRATION_FAILED',
        email: email ? this.hashEmail(email) : null,
        ipAddress,
        reason: error.message,
        success: false
      });

      throw error;
    }
  }

  /**
   * Check if registration is enabled via feature flag
   */
  async checkRegistrationEnabled(ipAddress) {
    const context = { ipAddress };
    
    // Get geo-location if needed
    if (this.protectionService.getGeoLocation) {
      const geo = await this.protectionService.getGeoLocation(ipAddress);
      context.country = geo?.country;
      context.region = geo?.region;
    }

    return await this.featureFlagService.evaluateFlag('self_registration_enabled', context);
  }

  /**
   * Run all protection checks
   */
  async runProtectionChecks({ email, ipAddress, fingerprint, userAgent, captchaToken, headers }) {
    // 1. Check if IP is blocked
    const ipStatus = await this.protectionService.checkIPStatus(ipAddress);
    if (ipStatus.blocked) {
      throw new SecurityError('Registration temporarily blocked. Please try again later.');
    }

    // 2. Check user agent for bots
    if (this.isSuspiciousUserAgent(userAgent)) {
      const behaviorScore = await this.analyzeBehavior({ ipAddress, userAgent });
      if (behaviorScore.isBot) {
        await this.protectionService.blockIP(ipAddress, 24 * 60); // 24 hour block
        throw new SecurityError('Automated registration detected.');
      }
    }

    // 3. Rate limiting check
    const rateLimitStatus = await this.checkRateLimit(ipAddress, email);
    if (rateLimitStatus.exceeded) {
      await this.protectionService.blockIP(ipAddress, this.thresholds.blockDurationMinutes);
      throw new RateLimitError('Too many registration attempts. Please try again later.');
    }

    // 4. Calculate suspicion score
    const suspicionScore = await this.calculateSuspicionScore({
      email,
      ipAddress,
      fingerprint,
      userAgent
    });

    // 5. CAPTCHA verification if needed
    const captchaRequired = suspicionScore > 0.5 || 
                           rateLimitStatus.attempts >= this.thresholds.captchaThreshold;
    
    if (captchaRequired) {
      if (!captchaToken) {
        const error = new ValidationError('CAPTCHA_REQUIRED');
        error.requireCaptcha = true;
        throw error;
      }
      
      const captchaValid = await this.verifyCaptcha(captchaToken, ipAddress);
      if (!captchaValid) {
        throw new ValidationError('Invalid CAPTCHA. Please try again.');
      }
    }

    // 6. Email validation
    await this.validateEmail(email);

    // 7. Device fingerprint validation
    if (fingerprint) {
      const fingerprintStatus = await this.validateFingerprint(fingerprint);
      if (fingerprintStatus.suspicious) {
        await this.protectionService.flagSuspiciousDevice(fingerprint);
        if (suspicionScore > this.thresholds.suspicionScoreThreshold) {
          throw new SecurityError('Suspicious activity detected. Registration blocked.');
        }
      }
    }

    // 8. Check for attack patterns
    const patterns = await this.protectionService.detectAttackPatterns(ipAddress);
    if (patterns.length > 0) {
      logger.warn('Attack patterns detected during registration', { ipAddress, patterns });
      if (patterns.includes('distributed_attack') || patterns.includes('credential_stuffing')) {
        throw new SecurityError('Suspicious activity detected. Registration blocked.');
      }
    }
  }

  /**
   * Check rate limits for IP and email
   */
  async checkRateLimit(ipAddress, email) {
    const ipAttempts = await this.protectionService.getRecentAttempts(
      ipAddress,
      this.thresholds.windowMinutes
    );
    
    const emailAttempts = email ? 
      await this.protectionService.getRecentEmailAttempts(
        email,
        this.thresholds.windowMinutes
      ) : 0;

    return {
      attempts: ipAttempts,
      emailAttempts,
      exceeded: ipAttempts >= this.thresholds.maxAttemptsPerIP ||
                emailAttempts >= this.thresholds.maxAttemptsPerEmail
    };
  }

  /**
   * Calculate suspicion score based on multiple factors
   */
  async calculateSuspicionScore({ email, ipAddress, fingerprint, userAgent }) {
    let score = 0;
    const factors = [];

    // Check email patterns
    for (const pattern of this.suspiciousPatterns) {
      if (pattern.test(email)) {
        score += 0.3;
        factors.push('suspicious_email_pattern');
        break;
      }
    }

    // Check disposable email
    if (await this.isDisposableEmail(email)) {
      score += 0.4;
      factors.push('disposable_email');
    }

    // Check IP reputation
    const ipReputation = await this.protectionService.getIPReputation(ipAddress);
    if (ipReputation.score < 50) {
      score += 0.3;
      factors.push('poor_ip_reputation');
    }

    // Check for VPN/Proxy
    const vpnCheck = await this.protectionService.detectVPNProxy(ipAddress);
    if (vpnCheck.isVPN || vpnCheck.isProxy) {
      score += 0.2;
      factors.push('vpn_proxy_detected');
    }

    // Check user agent
    if (this.isSuspiciousUserAgent(userAgent)) {
      score += 0.2;
      factors.push('suspicious_user_agent');
    }

    // Check timing patterns
    const timingScore = await this.analyzeTimingPatterns(ipAddress);
    score += timingScore * 0.3;

    // Previous failed attempts
    const failedAttempts = await this.protectionService.getFailedAttempts(ipAddress, 24 * 60);
    if (failedAttempts > 10) {
      score += 0.3;
      factors.push('high_failed_attempts');
    }

    logger.info('Suspicion score calculated', {
      ipAddress,
      emailDomain: email.split('@')[1],
      score: Math.min(1, score),
      factors
    });

    return Math.min(1, score);
  }

  /**
   * Validate email format and domain
   */
  async validateEmail(email) {
    // Check email format
    if (!REGEX.EMAIL.test(email)) {
      throw new ValidationError('Invalid email format');
    }

    // Check disposable email domains
    if (await this.isDisposableEmail(email)) {
      throw new ValidationError('Disposable email addresses are not allowed');
    }

    // Check blacklisted domains
    const domain = email.split('@')[1];
    if (await this.protectionService.isDomainBlacklisted(domain)) {
      throw new ValidationError('Email domain is not allowed');
    }

    // DNS validation
    const hasMX = await this.validateEmailDNS(domain);
    if (!hasMX) {
      throw new ValidationError('Invalid email domain');
    }
  }

  /**
   * Check if email is from a disposable email service
   */
  async isDisposableEmail(email) {
    const domain = email.split('@')[1];
    const disposableDomains = await this.protectionService.getDisposableDomains();
    return disposableDomains.includes(domain);
  }

  /**
   * Validate email domain has valid MX records
   */
  async validateEmailDNS(domain) {
    try {
      const mxRecords = await dns.resolveMx(domain);
      return mxRecords && mxRecords.length > 0;
    } catch (error) {
      logger.warn('DNS validation failed for domain', { domain, error: error.message });
      return false;
    }
  }

  /**
   * Check if user agent appears to be a bot
   */
  isSuspiciousUserAgent(userAgent) {
    if (!userAgent) return true;
    
    // Check against bot patterns
    for (const pattern of this.botUserAgents) {
      if (pattern.test(userAgent)) {
        return true;
      }
    }

    // Check for missing standard browser identifiers
    const hasBrowserIdentifier = /Mozilla|Chrome|Safari|Firefox|Edge/i.test(userAgent);
    return !hasBrowserIdentifier;
  }

  /**
   * Check if browser appears to be headless
   */
  isHeadlessBrowser(userAgent) {
    if (!userAgent) return false;
    return /headless|phantom/i.test(userAgent);
  }

  /**
   * Analyze behavioral patterns
   */
  async analyzeBehavior({ ipAddress, userAgent, timingPatterns }) {
    const scores = {
      isBot: false,
      confidence: 0,
      factors: []
    };

    // Check for headless browser
    if (this.isHeadlessBrowser(userAgent)) {
      scores.confidence += 0.4;
      scores.factors.push('headless_browser');
    }

    // Check timing patterns (bots often have consistent timing)
    if (timingPatterns && timingPatterns.length > 2) {
      const variance = this.calculateVariance(timingPatterns);
      if (variance < 0.1) { // Very consistent timing
        scores.confidence += 0.3;
        scores.factors.push('consistent_timing');
      }
    }

    // Check for automation tools in user agent
    const automationKeywords = ['selenium', 'puppeteer', 'playwright', 'phantomjs', 'webdriver'];
    const userAgentLower = userAgent?.toLowerCase() || '';
    if (automationKeywords.some(keyword => userAgentLower.includes(keyword))) {
      scores.confidence += 0.5;
      scores.factors.push('automation_tool');
    }

    // Check for missing browser features (would need client-side detection)
    // This would be enhanced with client-side JavaScript detection

    scores.isBot = scores.confidence > 0.6;
    
    return scores;
  }

  /**
   * Analyze timing patterns for bot detection
   */
  async analyzeTimingPatterns(ipAddress) {
    const attempts = await this.protectionService.getRecentAttemptDetails(ipAddress, 10);
    if (attempts.length < 3) return 0;

    const timestamps = attempts.map(a => a.timestamp);
    const intervals = [];
    
    for (let i = 1; i < timestamps.length; i++) {
      intervals.push(timestamps[i] - timestamps[i-1]);
    }

    const variance = this.calculateVariance(intervals);
    
    // Low variance indicates bot-like behavior
    if (variance < 100) return 0.8;
    if (variance < 500) return 0.5;
    if (variance < 1000) return 0.3;
    
    return 0;
  }

  /**
   * Calculate variance of an array of numbers
   */
  calculateVariance(numbers) {
    if (numbers.length === 0) return 0;
    
    const mean = numbers.reduce((a, b) => a + b, 0) / numbers.length;
    const squaredDiffs = numbers.map(n => Math.pow(n - mean, 2));
    return squaredDiffs.reduce((a, b) => a + b, 0) / numbers.length;
  }

  /**
   * Extract timing patterns from request
   */
  extractTimingPatterns(ipAddress) {
    // This would be implemented with actual timing data from requests
    // For now, return null to indicate no data
    return null;
  }

  /**
   * Verify CAPTCHA token
   */
  async verifyCaptcha(token, ipAddress) {
    try {
      const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `secret=${process.env.RECAPTCHA_SECRET}&response=${token}&remoteip=${ipAddress}`
      });

      const result = await response.json();
      
      // For reCAPTCHA v3, check score
      if (result.score !== undefined) {
        return result.success && result.score > 0.5;
      }
      
      // For reCAPTCHA v2
      return result.success;
    } catch (error) {
      logger.error('CAPTCHA verification failed', { error: error.message });
      return false;
    }
  }

  /**
   * Validate device fingerprint
   */
  async validateFingerprint(fingerprint) {
    const fingerprintData = await this.protectionService.getFingerprintData(fingerprint);
    
    if (!fingerprintData) {
      // New fingerprint
      await this.protectionService.recordFingerprint(fingerprint);
      return { suspicious: false, new: true };
    }

    // Check if fingerprint is blocked
    if (fingerprintData.blocked) {
      return { suspicious: true, blocked: true };
    }

    // Check if fingerprint has suspicious history
    if (fingerprintData.failedAttempts > 10 || fingerprintData.suspicious) {
      return { suspicious: true, history: 'suspicious' };
    }

    // Check registration velocity
    const recentRegistrations = fingerprintData.recentRegistrations || 0;
    if (recentRegistrations > 3) {
      return { suspicious: true, reason: 'high_velocity' };
    }

    return { suspicious: false };
  }

  /**
   * Validate registration data
   */
  async validateRegistrationData({ email, username, password, firstName, lastName }) {
    const errors = {};

    // Email validation
    if (!email) {
      errors.email = 'Email is required';
    } else if (!REGEX.EMAIL.test(email)) {
      errors.email = 'Invalid email format';
    }

    // Username validation
    if (!username) {
      errors.username = 'Username is required';
    } else if (!REGEX.USERNAME.test(username)) {
      errors.username = 'Username must be 3-30 characters, alphanumeric with underscores and hyphens';
    }

    // Password validation
    if (!password) {
      errors.password = 'Password is required';
    } else if (!REGEX.PASSWORD.test(password)) {
      errors.password = 'Password must be at least 8 characters with uppercase, lowercase, and number';
    }

    // Name validation (optional but validated if provided)
    if (firstName && firstName.length > 100) {
      errors.firstName = 'First name is too long';
    }
    if (lastName && lastName.length > 100) {
      errors.lastName = 'Last name is too long';
    }

    if (Object.keys(errors).length > 0) {
      throw new ValidationError('Validation failed', errors);
    }
  }

  /**
   * Check if user already exists
   */
  async checkExistingUser(email, username) {
    const existingByEmail = await this.userService.findByEmail(email);
    if (existingByEmail) {
      throw new ConflictError('Email address is already registered');
    }

    const existingByUsername = await this.userService.findByUsername(username);
    if (existingByUsername) {
      throw new ConflictError('Username is already taken');
    }
  }

  /**
   * Create pending registration entry
   */
  async createPendingRegistration({ email, username, password, firstName, lastName, ipAddress, fingerprint }) {
    // Hash password
    const passwordHash = await bcrypt.hash(password, AUTH.SALT_ROUNDS);
    
    // Generate verification token and code
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationCode = speakeasy.totp({
      secret: process.env.VERIFICATION_SECRET || 'pathfinder-verify',
      digits: 6,
      step: 86400 // 24 hours
    });

    // Store in pending registrations table
    const pendingRegistration = await this.protectionService.createPendingRegistration({
      email,
      username,
      passwordHash,
      firstName,
      lastName,
      verificationToken,
      verificationCode,
      ipAddress,
      fingerprint,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
    });

    return pendingRegistration;
  }

  /**
   * Complete registration after email verification
   */
  async completeRegistration(verificationToken) {
    // Get pending registration
    const pending = await this.protectionService.getPendingRegistration(verificationToken);
    
    if (!pending) {
      throw new ValidationError('Invalid or expired verification token');
    }

    if (pending.expiresAt < new Date()) {
      await this.protectionService.deletePendingRegistration(verificationToken);
      throw new ValidationError('Verification token has expired');
    }

    try {
      // Create actual user account
      const user = await this.userService.create({
        username: pending.username,
        email: pending.email,
        passwordHash: pending.passwordHash,
        firstName: pending.firstName,
        lastName: pending.lastName,
        emailVerified: true,
        source: 'self_registration'
      });

      // Delete pending registration
      await this.protectionService.deletePendingRegistration(verificationToken);

      // Send welcome email
      await this.emailService.sendWelcomeEmail({
        email: user.email,
        firstName: user.firstName,
        username: user.username
      });

      // Track successful verification
      await this.protectionService.trackSuccessfulVerification({
        userId: user.id,
        email: user.email
      });

      // Analytics
      if (this.analyticsService) {
        await this.analyticsService.track('registration_completed', {
          userId: user.id,
          emailDomain: user.email.split('@')[1]
        });
      }

      return user;
    } catch (error) {
      logger.error('Failed to complete registration', { error: error.message, token: verificationToken });
      throw error;
    }
  }

  /**
   * Check if escalation is needed
   */
  async checkEscalation(ipAddress) {
    const recentAttempts = await this.protectionService.getRecentAttempts(ipAddress, 5);
    
    // Auto-escalate if seeing rapid attempts
    if (recentAttempts > 10) {
      await this.escalateProtection('rapid_attempts', {
        ipAddress,
        attempts: recentAttempts
      });
    }

    // Check for distributed attack
    const uniqueIPs = await this.protectionService.getUniqueIPsLastMinute();
    if (uniqueIPs > 100) {
      await this.escalateProtection('distributed_attack', {
        uniqueIPs,
        threshold: 100
      });
    }
  }

  /**
   * Escalate protection measures
   */
  async escalateProtection(reason, details) {
    logger.warn('Protection escalation triggered', { reason, details });

    // Send alert to admins
    if (this.notificationService) {
      await this.notificationService.sendAdminAlert({
        type: 'registration_attack',
        severity: reason === 'distributed_attack' ? 'critical' : 'high',
        reason,
        details,
        recommendation: 'Consider disabling self-registration temporarily'
      });
    }

    // Increase protection thresholds
    this.thresholds.maxAttemptsPerIP = Math.max(1, this.thresholds.maxAttemptsPerIP - 1);
    this.thresholds.captchaThreshold = 1;

    // Enable stricter validation
    await this.protectionService.enableStrictMode();

    // Consider auto-disable if severe
    if (reason === 'distributed_attack' && details.uniqueIPs > this.thresholds.emergencyDisableThreshold) {
      await this.emergencyDisable('Automated: Distributed attack detected');
    }
  }

  /**
   * Emergency disable registration
   */
  async emergencyDisable(reason) {
    logger.error('Emergency registration disable', { reason });

    // Disable registration feature flag
    await this.featureFlagService.updateFlag('self_registration_enabled', {
      defaultValue: 'false',
      maintenanceMode: true
    }, `EMERGENCY: ${reason}`);

    // Clear all pending registrations
    await this.protectionService.clearPendingRegistrations();

    // Send notifications
    if (this.notificationService) {
      await this.notificationService.sendEmergencyAlert({
        action: 'registration_disabled',
        reason,
        timestamp: new Date()
      });
    }

    // Audit log
    await this.auditService.logSecurityEvent({
      action: 'EMERGENCY_REGISTRATION_DISABLE',
      reason,
      severity: 'critical'
    });

    return { disabled: true, reason };
  }

  /**
   * Sanitize user input to prevent XSS
   */
  sanitizeInput(data) {
    const sanitized = {};
    
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'string') {
        // Don't sanitize password
        if (key === 'password') {
          sanitized[key] = value;
        } else {
          sanitized[key] = purify.sanitize(value, { ALLOWED_TAGS: [] });
        }
      } else {
        sanitized[key] = value;
      }
    }
    
    return sanitized;
  }

  /**
   * Hash email for privacy
   */
  hashEmail(email) {
    return crypto.createHash('sha256').update(email.toLowerCase()).digest('hex');
  }

  /**
   * Check username availability
   */
  async checkUsernameAvailability(username) {
    const sanitized = purify.sanitize(username.toLowerCase().trim(), { ALLOWED_TAGS: [] });
    
    if (!REGEX.USERNAME.test(sanitized)) {
      return { available: false, reason: 'Invalid username format' };
    }

    const existing = await this.userService.findByUsername(sanitized);
    return { 
      available: !existing,
      reason: existing ? 'Username already taken' : null
    };
  }

  /**
   * Check email availability
   */
  async checkEmailAvailability(email) {
    const sanitized = purify.sanitize(email.toLowerCase().trim(), { ALLOWED_TAGS: [] });
    
    if (!REGEX.EMAIL.test(sanitized)) {
      return { available: false, reason: 'Invalid email format' };
    }

    const existing = await this.userService.findByEmail(sanitized);
    return { 
      available: !existing,
      reason: existing ? 'Email already registered' : null
    };
  }
}

module.exports = { RegistrationService };