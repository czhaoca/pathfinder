# Issue #30: Self-Registration System with DDoS Protection

## Title
Implement Public Self-Registration with Comprehensive DDoS Protection and Quick Disable

## User Story
As a platform owner, I want to allow public user registration with robust DDoS protection so that legitimate users can sign up while preventing abuse and maintaining the ability to quickly disable registration during attacks.

## Description
Build a public self-registration system with multiple layers of DDoS protection including rate limiting, CAPTCHA integration, email verification, and behavioral analysis. The system includes a feature flag for instant disabling and comprehensive monitoring to detect and respond to attacks automatically.

## Acceptance Criteria

### Registration System
- [ ] Public registration endpoint accessible without authentication
- [ ] Email and username validation with availability checking
- [ ] Password strength requirements enforcement
- [ ] Email verification workflow
- [ ] Welcome email upon successful registration
- [ ] Progressive profile completion prompts

### DDoS Protection Layers
- [ ] IP-based rate limiting with sliding window
- [ ] CAPTCHA for suspicious requests
- [ ] Email domain validation and disposable email blocking
- [ ] Browser fingerprinting for device tracking
- [ ] Behavioral analysis for bot detection
- [ ] Automatic blocking of suspicious patterns

### Quick Controls
- [ ] Master feature flag for instant disable
- [ ] Emergency stop button in admin panel
- [ ] Gradual rollout percentage control
- [ ] Geographic restrictions capability
- [ ] Time-based registration windows
- [ ] Whitelist/blacklist management

### Monitoring & Alerts
- [ ] Real-time registration metrics dashboard
- [ ] Automated alerts for suspicious activity
- [ ] Failed attempt tracking and analysis
- [ ] Pattern recognition for attack detection
- [ ] Automatic response escalation
- [ ] Incident reporting and analysis

## Technical Implementation

### Registration Service with Protection

```javascript
// backend/src/services/registrationService.js
const speakeasy = require('speakeasy');
const fingerprintjs = require('@fingerprintjs/fingerprintjs-pro-server-api');

class RegistrationService {
  constructor(userService, emailService, protectionService, featureFlagService) {
    this.userService = userService;
    this.emailService = emailService;
    this.protectionService = protectionService;
    this.featureFlagService = featureFlagService;
    
    // Protection thresholds
    this.thresholds = {
      maxAttemptsPerIP: 5,
      maxAttemptsPerEmail: 3,
      windowMinutes: 15,
      blockDurationMinutes: 60,
      suspicionScoreThreshold: 0.7,
      captchaThreshold: 3
    };
    
    // Suspicious patterns
    this.suspiciousPatterns = [
      /test\d+@/,
      /admin@/,
      /noreply@/,
      /\d{5,}@/  // Many numbers in email
    ];
  }

  async register(registrationData, requestContext) {
    const { email, username, password, firstName, lastName, captchaToken } = registrationData;
    const { ipAddress, userAgent, fingerprint, headers } = requestContext;

    // Check if registration is enabled
    const isEnabled = await this.featureFlagService.evaluateFlag(
      'self_registration_enabled',
      { ipAddress }
    );

    if (!isEnabled) {
      throw new Error('Registration is currently disabled');
    }

    try {
      // Multi-layer protection checks
      await this.runProtectionChecks({
        email,
        ipAddress,
        fingerprint,
        userAgent,
        captchaToken
      });

      // Validate registration data
      await this.validateRegistrationData({
        email,
        username,
        password
      });

      // Create user account
      const user = await this.createUserAccount({
        email,
        username,
        password,
        firstName,
        lastName,
        source: 'self_registration',
        ipAddress
      });

      // Send verification email
      await this.sendVerificationEmail(user);

      // Track successful registration
      await this.protectionService.trackSuccessfulRegistration({
        userId: user.id,
        email,
        ipAddress,
        fingerprint
      });

      // Analytics
      await this.analyticsService.track('registration_success', {
        userId: user.id,
        registrationMethod: 'self',
        emailDomain: email.split('@')[1]
      });

      return {
        success: true,
        message: 'Registration successful. Please check your email for verification.',
        userId: user.id
      };

    } catch (error) {
      // Track failed attempt
      await this.protectionService.trackFailedAttempt({
        email,
        ipAddress,
        fingerprint,
        reason: error.message
      });

      // Check if we should escalate protection
      await this.checkEscalation(ipAddress);

      throw error;
    }
  }

  async runProtectionChecks({ email, ipAddress, fingerprint, userAgent, captchaToken }) {
    // 1. Check if IP is blocked
    const ipStatus = await this.protectionService.checkIPStatus(ipAddress);
    if (ipStatus.blocked) {
      throw new Error('Registration temporarily blocked. Please try again later.');
    }

    // 2. Rate limiting check
    const rateLimitStatus = await this.checkRateLimit(ipAddress, email);
    if (rateLimitStatus.exceeded) {
      await this.protectionService.blockIP(ipAddress, this.thresholds.blockDurationMinutes);
      throw new Error('Too many registration attempts. Please try again later.');
    }

    // 3. Calculate suspicion score
    const suspicionScore = await this.calculateSuspicionScore({
      email,
      ipAddress,
      fingerprint,
      userAgent
    });

    // 4. CAPTCHA verification if needed
    if (suspicionScore > 0.5 || rateLimitStatus.attempts > this.thresholds.captchaThreshold) {
      if (!captchaToken) {
        throw new Error('CAPTCHA_REQUIRED');
      }
      
      const captchaValid = await this.verifyCaptcha(captchaToken, ipAddress);
      if (!captchaValid) {
        throw new Error('Invalid CAPTCHA. Please try again.');
      }
    }

    // 5. Email validation
    await this.validateEmail(email);

    // 6. Device fingerprint validation
    if (fingerprint) {
      const fingerprintStatus = await this.validateFingerprint(fingerprint);
      if (fingerprintStatus.suspicious) {
        await this.protectionService.flagSuspiciousDevice(fingerprint);
        if (suspicionScore > this.thresholds.suspicionScoreThreshold) {
          throw new Error('Suspicious activity detected. Registration blocked.');
        }
      }
    }

    // 7. Behavioral analysis
    const behaviorScore = await this.analyzeBehavior({
      ipAddress,
      userAgent,
      timingPatterns: this.extractTimingPatterns(ipAddress)
    });

    if (behaviorScore.isBot) {
      await this.protectionService.blockIP(ipAddress, 24 * 60); // 24 hour block
      throw new Error('Automated registration detected.');
    }
  }

  async checkRateLimit(ipAddress, email) {
    const ipAttempts = await this.protectionService.getRecentAttempts(
      ipAddress,
      this.thresholds.windowMinutes
    );
    
    const emailAttempts = await this.protectionService.getRecentEmailAttempts(
      email,
      this.thresholds.windowMinutes
    );

    return {
      attempts: ipAttempts,
      exceeded: ipAttempts >= this.thresholds.maxAttemptsPerIP ||
                emailAttempts >= this.thresholds.maxAttemptsPerEmail
    };
  }

  async calculateSuspicionScore({ email, ipAddress, fingerprint, userAgent }) {
    let score = 0;
    const factors = [];

    // Check email patterns
    for (const pattern of this.suspiciousPatterns) {
      if (pattern.test(email)) {
        score += 0.3;
        factors.push('suspicious_email_pattern');
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
    if (await this.isVPNOrProxy(ipAddress)) {
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
      email: email.split('@')[1], // Log domain only
      score: Math.min(1, score),
      factors
    });

    return Math.min(1, score);
  }

  async validateEmail(email) {
    // Check email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error('Invalid email format');
    }

    // Check disposable email domains
    if (await this.isDisposableEmail(email)) {
      throw new Error('Disposable email addresses are not allowed');
    }

    // Check blacklisted domains
    const domain = email.split('@')[1];
    if (await this.protectionService.isDomainBlacklisted(domain)) {
      throw new Error('Email domain is not allowed');
    }

    // DNS validation
    const hasMX = await this.validateEmailDNS(domain);
    if (!hasMX) {
      throw new Error('Invalid email domain');
    }
  }

  async isDisposableEmail(email) {
    const domain = email.split('@')[1];
    const disposableDomains = await this.protectionService.getDisposableDomains();
    return disposableDomains.includes(domain);
  }

  async validateEmailDNS(domain) {
    try {
      const mxRecords = await dns.resolveMx(domain);
      return mxRecords && mxRecords.length > 0;
    } catch (error) {
      return false;
    }
  }

  async isVPNOrProxy(ipAddress) {
    try {
      const detection = await this.protectionService.detectVPNProxy(ipAddress);
      return detection.isVPN || detection.isProxy;
    } catch (error) {
      return false;
    }
  }

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
    if (timingPatterns) {
      const variance = this.calculateVariance(timingPatterns);
      if (variance < 0.1) { // Very consistent timing
        scores.confidence += 0.3;
        scores.factors.push('consistent_timing');
      }
    }

    // Check for automation tools in user agent
    const automationKeywords = ['selenium', 'puppeteer', 'playwright', 'phantomjs'];
    if (automationKeywords.some(keyword => userAgent.toLowerCase().includes(keyword))) {
      scores.confidence += 0.5;
      scores.factors.push('automation_tool');
    }

    scores.isBot = scores.confidence > 0.6;
    
    return scores;
  }

  async verifyCaptcha(token, ipAddress) {
    try {
      const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `secret=${process.env.RECAPTCHA_SECRET}&response=${token}&remoteip=${ipAddress}`
      });

      const result = await response.json();
      return result.success && result.score > 0.5;
    } catch (error) {
      logger.error('CAPTCHA verification failed', { error });
      return false;
    }
  }

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

  async escalateProtection(reason, details) {
    logger.warn('Protection escalation triggered', { reason, details });

    // Send alert to admins
    await this.notificationService.sendAdminAlert({
      type: 'registration_attack',
      severity: 'high',
      reason,
      details,
      recommendation: 'Consider disabling self-registration temporarily'
    });

    // Increase protection thresholds
    this.thresholds.maxAttemptsPerIP = Math.max(1, this.thresholds.maxAttemptsPerIP - 1);
    this.thresholds.captchaThreshold = 1;

    // Enable stricter validation
    await this.protectionService.enableStrictMode();

    // Consider auto-disable if severe
    if (reason === 'distributed_attack' && details.uniqueIPs > 500) {
      await this.emergencyDisable('Automated: Distributed attack detected');
    }
  }

  async emergencyDisable(reason) {
    logger.error('Emergency registration disable', { reason });

    // Disable registration feature flag
    await this.featureFlagService.updateFlag('self_registration_enabled', {
      defaultValue: 'false'
    }, `EMERGENCY: ${reason}`);

    // Clear all pending registrations
    await this.protectionService.clearPendingRegistrations();

    // Send notifications
    await this.notificationService.sendEmergencyAlert({
      action: 'registration_disabled',
      reason,
      timestamp: new Date()
    });

    return { disabled: true, reason };
  }
}
```

### DDoS Protection Service

```javascript
// backend/src/services/ddosProtectionService.js
class DDoSProtectionService {
  constructor(redis, database) {
    this.redis = redis;
    this.database = database;
    this.patterns = new Map();
    this.initializePatternDetection();
  }

  async checkIPStatus(ipAddress) {
    // Check permanent blocks
    const permanentBlock = await this.database.query(
      'SELECT * FROM pf_blocked_ips WHERE ip_address = ? AND (expires_at IS NULL OR expires_at > NOW())',
      [ipAddress]
    );

    if (permanentBlock.rows.length > 0) {
      return { blocked: true, reason: permanentBlock.rows[0].reason };
    }

    // Check temporary blocks in Redis
    const tempBlock = await this.redis.get(`blocked:${ipAddress}`);
    if (tempBlock) {
      return { blocked: true, reason: 'Temporary block due to suspicious activity' };
    }

    return { blocked: false };
  }

  async getRecentAttempts(ipAddress, windowMinutes) {
    const key = `attempts:${ipAddress}`;
    const now = Date.now();
    const windowStart = now - (windowMinutes * 60 * 1000);

    // Remove old entries and count recent ones
    await this.redis.zremrangebyscore(key, '-inf', windowStart);
    const count = await this.redis.zcard(key);

    // Add current attempt
    await this.redis.zadd(key, now, `${now}`);
    await this.redis.expire(key, windowMinutes * 60);

    return count;
  }

  async trackFailedAttempt({ email, ipAddress, fingerprint, reason }) {
    const attemptData = {
      email: this.hashEmail(email),
      ipAddress,
      fingerprint,
      reason,
      timestamp: new Date()
    };

    // Store in database for analysis
    await this.database.query(
      'INSERT INTO pf_registration_attempts (email_hash, ip_address, fingerprint, success, reason, attempted_at) VALUES (?, ?, ?, ?, ?, ?)',
      [attemptData.email, ipAddress, fingerprint, false, reason, attemptData.timestamp]
    );

    // Update Redis counters
    await this.incrementCounter(`failed:${ipAddress}`, 3600); // 1 hour TTL
    await this.incrementCounter(`failed:email:${attemptData.email}`, 3600);

    // Check for patterns
    await this.detectAttackPatterns(ipAddress);
  }

  async detectAttackPatterns(ipAddress) {
    const patterns = [];

    // Pattern 1: Rapid succession attempts
    const recentAttempts = await this.getRecentAttempts(ipAddress, 1);
    if (recentAttempts > 10) {
      patterns.push('rapid_succession');
    }

    // Pattern 2: Sequential usernames/emails
    const attempts = await this.getRecentAttemptDetails(ipAddress, 10);
    if (this.hasSequentialPattern(attempts)) {
      patterns.push('sequential_pattern');
    }

    // Pattern 3: Distributed attack (many IPs, similar pattern)
    const similarPatterns = await this.findSimilarPatterns(attempts);
    if (similarPatterns.length > 5) {
      patterns.push('distributed_attack');
    }

    // Pattern 4: Known bot signatures
    if (await this.matchesBotSignature(ipAddress)) {
      patterns.push('bot_signature');
    }

    if (patterns.length > 0) {
      await this.handleDetectedPatterns(ipAddress, patterns);
    }

    return patterns;
  }

  async handleDetectedPatterns(ipAddress, patterns) {
    logger.warn('Attack patterns detected', { ipAddress, patterns });

    // Immediate block for severe patterns
    if (patterns.includes('distributed_attack') || patterns.includes('bot_signature')) {
      await this.blockIP(ipAddress, 24 * 60); // 24 hours
      
      // Block entire subnet if distributed
      if (patterns.includes('distributed_attack')) {
        const subnet = this.getSubnet(ipAddress);
        await this.blockSubnet(subnet, 60); // 1 hour for subnet
      }
    }

    // Alert admins
    await this.sendAlert({
      severity: patterns.includes('distributed_attack') ? 'critical' : 'high',
      type: 'attack_pattern_detected',
      ipAddress,
      patterns,
      recommendation: this.getRecommendation(patterns)
    });

    // Update protection rules
    await this.updateProtectionRules(patterns);
  }

  hasSequentialPattern(attempts) {
    if (attempts.length < 3) return false;

    const emails = attempts.map(a => a.email);
    const usernames = attempts.map(a => a.username).filter(Boolean);

    // Check for patterns like user1, user2, user3
    const numberPattern = /\d+$/;
    const numbers = usernames.map(u => {
      const match = u.match(numberPattern);
      return match ? parseInt(match[0]) : null;
    }).filter(n => n !== null);

    if (numbers.length >= 3) {
      const sorted = [...numbers].sort((a, b) => a - b);
      for (let i = 1; i < sorted.length; i++) {
        if (sorted[i] - sorted[i-1] === 1) {
          return true;
        }
      }
    }

    return false;
  }

  async matchesBotSignature(ipAddress) {
    const attempts = await this.getRecentAttemptDetails(ipAddress, 20);
    
    // Bot signatures
    const signatures = {
      // Consistent timing between requests
      consistentTiming: () => {
        const timestamps = attempts.map(a => a.timestamp);
        const intervals = [];
        for (let i = 1; i < timestamps.length; i++) {
          intervals.push(timestamps[i] - timestamps[i-1]);
        }
        const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        const variance = intervals.reduce((sum, val) => sum + Math.pow(val - avgInterval, 2), 0) / intervals.length;
        return variance < 100; // Very low variance indicates bot
      },

      // Same user agent for all attempts
      sameUserAgent: () => {
        const userAgents = new Set(attempts.map(a => a.userAgent));
        return userAgents.size === 1 && attempts.length > 5;
      },

      // No mouse movements or realistic behavior
      noHumanBehavior: () => {
        return attempts.every(a => !a.hasMouseMovement && !a.hasKeyboardVariation);
      }
    };

    for (const [name, check] of Object.entries(signatures)) {
      if (check()) {
        logger.info('Bot signature matched', { ipAddress, signature: name });
        return true;
      }
    }

    return false;
  }

  async getIPReputation(ipAddress) {
    // Check against known threat databases
    const [
      abuseIPDB,
      spamhaus,
      internalHistory
    ] = await Promise.all([
      this.checkAbuseIPDB(ipAddress),
      this.checkSpamhaus(ipAddress),
      this.getInternalReputation(ipAddress)
    ]);

    // Calculate combined score (0-100, higher is better)
    const score = (
      (100 - abuseIPDB.abuseScore) * 0.4 +
      (spamhaus.clean ? 100 : 0) * 0.3 +
      internalHistory.score * 0.3
    );

    return {
      score,
      details: {
        abuseIPDB,
        spamhaus,
        internal: internalHistory
      }
    };
  }

  async enableStrictMode() {
    await this.redis.set('protection:strict_mode', 'true', 'EX', 3600);
    
    // Update all thresholds
    await this.redis.mset(
      'protection:max_attempts', '2',
      'protection:captcha_always', 'true',
      'protection:email_verification', 'required',
      'protection:block_duration', '7200'
    );

    logger.info('Strict protection mode enabled');
  }

  initializePatternDetection() {
    // Set up pattern detection rules
    this.patterns.set('credential_stuffing', {
      check: async (attempts) => {
        // Many different emails, same password pattern
        const passwords = attempts.map(a => a.passwordLength);
        const uniquePasswords = new Set(passwords);
        return attempts.length > 10 && uniquePasswords.size < 3;
      },
      action: 'block_24h'
    });

    this.patterns.set('email_enumeration', {
      check: async (attempts) => {
        // Testing many emails with same password
        const emails = attempts.map(a => a.email);
        return emails.length > 20 && new Set(emails).size === emails.length;
      },
      action: 'block_1h'
    });

    this.patterns.set('dictionary_attack', {
      check: async (attempts) => {
        // Common passwords being tried
        const commonPasswords = ['password', '123456', 'admin', 'test'];
        return attempts.some(a => commonPasswords.includes(a.passwordHint));
      },
      action: 'require_captcha'
    });
  }
}
```

### Frontend Registration Component with Protection

```typescript
// frontend/src/components/registration/PublicRegistration.tsx
import React, { useState, useEffect, useRef } from 'react';
import ReCAPTCHA from 'react-google-recaptcha';
import FingerprintJS from '@fingerprintjs/fingerprintjs';

export const PublicRegistration: React.FC = () => {
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    acceptTerms: false
  });
  
  const [protection, setProtection] = useState({
    requireCaptcha: false,
    captchaToken: null,
    fingerprint: null,
    blocked: false,
    message: null
  });

  const [validation, setValidation] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const recaptchaRef = useRef<ReCAPTCHA>(null);

  useEffect(() => {
    // Initialize fingerprinting
    initializeFingerprint();
    
    // Check if registration is available
    checkRegistrationAvailability();
  }, []);

  const initializeFingerprint = async () => {
    try {
      const fp = await FingerprintJS.load();
      const result = await fp.get();
      setProtection(prev => ({ ...prev, fingerprint: result.visitorId }));
    } catch (error) {
      console.error('Fingerprinting failed', error);
    }
  };

  const checkRegistrationAvailability = async () => {
    try {
      const response = await api.get('/auth/registration/status');
      if (!response.data.enabled) {
        setProtection(prev => ({
          ...prev,
          blocked: true,
          message: 'Registration is currently closed'
        }));
      }
    } catch (error) {
      console.error('Failed to check registration status');
    }
  };

  const validateField = (field: string, value: any): string | null => {
    switch (field) {
      case 'email':
        if (!value) return 'Email is required';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          return 'Invalid email format';
        }
        return null;

      case 'username':
        if (!value) return 'Username is required';
        if (value.length < 3) return 'Username must be at least 3 characters';
        if (!/^[a-zA-Z0-9_-]+$/.test(value)) {
          return 'Username can only contain letters, numbers, _ and -';
        }
        return null;

      case 'password':
        if (!value) return 'Password is required';
        if (value.length < 8) return 'Password must be at least 8 characters';
        if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(value)) {
          return 'Password must contain uppercase, lowercase, and number';
        }
        return null;

      case 'confirmPassword':
        if (value !== formData.password) return 'Passwords do not match';
        return null;

      case 'acceptTerms':
        if (!value) return 'You must accept the terms';
        return null;

      default:
        return null;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (protection.blocked) {
      return;
    }

    // Validate all fields
    const errors: Record<string, string> = {};
    Object.keys(formData).forEach(field => {
      const error = validateField(field, formData[field]);
      if (error) errors[field] = error;
    });

    if (Object.keys(errors).length > 0) {
      setValidation(errors);
      return;
    }

    setLoading(true);

    try {
      const requestData = {
        ...formData,
        captchaToken: protection.captchaToken,
        fingerprint: protection.fingerprint,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        screen: {
          width: window.screen.width,
          height: window.screen.height
        }
      };

      const response = await api.post('/auth/register', requestData);

      if (response.data.success) {
        // Success - redirect to email verification notice
        navigate('/registration/verify-email', {
          state: { email: formData.email }
        });
      }
    } catch (error: any) {
      if (error.response?.data?.error === 'CAPTCHA_REQUIRED') {
        setProtection(prev => ({ ...prev, requireCaptcha: true }));
        toast.warning('Please complete the CAPTCHA verification');
      } else if (error.response?.status === 429) {
        setProtection(prev => ({
          ...prev,
          blocked: true,
          message: 'Too many attempts. Please try again later.'
        }));
      } else {
        toast.error(error.response?.data?.message || 'Registration failed');
      }
    } finally {
      setLoading(false);
      // Reset CAPTCHA if used
      if (recaptchaRef.current) {
        recaptchaRef.current.reset();
      }
    }
  };

  const handleCaptchaChange = (token: string | null) => {
    setProtection(prev => ({ ...prev, captchaToken: token }));
  };

  if (protection.blocked) {
    return (
      <div className="registration-blocked">
        <div className="blocked-message">
          <h2>Registration Unavailable</h2>
          <p>{protection.message}</p>
          <a href="/login">Sign in to existing account</a>
        </div>
      </div>
    );
  }

  return (
    <div className="public-registration">
      <div className="registration-container">
        <div className="registration-header">
          <h1>Create Your Account</h1>
          <p>Join Pathfinder to navigate your career journey</p>
        </div>

        <form onSubmit={handleSubmit} className="registration-form">
          <div className="form-row">
            <div className="form-group">
              <label>First Name</label>
              <input
                type="text"
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                placeholder="John"
              />
            </div>
            
            <div className="form-group">
              <label>Last Name</label>
              <input
                type="text"
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                placeholder="Doe"
              />
            </div>
          </div>

          <div className="form-group">
            <label>Email *</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              onBlur={() => {
                const error = validateField('email', formData.email);
                setValidation(prev => ({ ...prev, email: error || '' }));
              }}
              placeholder="john.doe@example.com"
              required
            />
            {validation.email && (
              <span className="error">{validation.email}</span>
            )}
          </div>

          <div className="form-group">
            <label>Username *</label>
            <input
              type="text"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              onBlur={async () => {
                const error = validateField('username', formData.username);
                setValidation(prev => ({ ...prev, username: error || '' }));
                
                // Check availability
                if (!error && formData.username) {
                  const available = await checkUsernameAvailability(formData.username);
                  if (!available) {
                    setValidation(prev => ({ ...prev, username: 'Username already taken' }));
                  }
                }
              }}
              placeholder="johndoe"
              required
            />
            {validation.username && (
              <span className="error">{validation.username}</span>
            )}
          </div>

          <div className="form-group">
            <label>Password *</label>
            <PasswordStrengthInput
              value={formData.password}
              onChange={(value) => setFormData({ ...formData, password: value })}
              onBlur={() => {
                const error = validateField('password', formData.password);
                setValidation(prev => ({ ...prev, password: error || '' }));
              }}
            />
            {validation.password && (
              <span className="error">{validation.password}</span>
            )}
          </div>

          <div className="form-group">
            <label>Confirm Password *</label>
            <input
              type="password"
              value={formData.confirmPassword}
              onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
              onBlur={() => {
                const error = validateField('confirmPassword', formData.confirmPassword);
                setValidation(prev => ({ ...prev, confirmPassword: error || '' }));
              }}
              required
            />
            {validation.confirmPassword && (
              <span className="error">{validation.confirmPassword}</span>
            )}
          </div>

          {protection.requireCaptcha && (
            <div className="form-group">
              <ReCAPTCHA
                ref={recaptchaRef}
                sitekey={process.env.REACT_APP_RECAPTCHA_SITE_KEY!}
                onChange={handleCaptchaChange}
              />
            </div>
          )}

          <div className="form-group checkbox">
            <label>
              <input
                type="checkbox"
                checked={formData.acceptTerms}
                onChange={(e) => setFormData({ ...formData, acceptTerms: e.target.checked })}
              />
              I accept the <a href="/terms" target="_blank">Terms of Service</a> and{' '}
              <a href="/privacy" target="_blank">Privacy Policy</a>
            </label>
            {validation.acceptTerms && (
              <span className="error">{validation.acceptTerms}</span>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || (protection.requireCaptcha && !protection.captchaToken)}
            className="btn-primary"
          >
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

        <div className="registration-footer">
          <p>
            Already have an account? <a href="/login">Sign in</a>
          </p>
        </div>
      </div>
    </div>
  );
};
```

## Security Considerations

1. **Multi-Layer Protection**
   - IP-based rate limiting with sliding window
   - Email validation and disposable email blocking
   - CAPTCHA for suspicious requests
   - Device fingerprinting
   - Behavioral analysis

2. **Attack Detection**
   - Pattern recognition for common attacks
   - Distributed attack detection
   - Bot signature matching
   - Real-time threat analysis

3. **Response Mechanisms**
   - Automatic blocking of suspicious IPs
   - Gradual protection escalation
   - Emergency disable capability
   - Admin alerting and reporting

4. **Data Protection**
   - Email hashing for privacy
   - Secure password requirements
   - Email verification requirement
   - Audit logging of all attempts

## Testing Requirements

1. **Unit Tests**
   - Protection checks logic
   - Suspicion score calculation
   - Pattern detection algorithms
   - Rate limiting logic

2. **Integration Tests**
   - Full registration flow
   - CAPTCHA integration
   - Email verification
   - Protection escalation

3. **Load Tests**
   - High-volume registration attempts
   - Distributed attack simulation
   - Protection system performance
   - Emergency disable response time

## Documentation Updates

- User guide for registration process
- Admin guide for DDoS protection management
- Security documentation for protection layers
- Incident response procedures

## Dependencies

- Issue #24: Feature Flag Management
- Google reCAPTCHA account
- Email verification system
- Redis for rate limiting
- IP reputation service

## Estimated Effort

**Extra Large (XL)** - 8-10 days

### Justification:
- Complex multi-layer protection system
- Pattern detection algorithms
- Real-time monitoring and alerting
- CAPTCHA integration
- Comprehensive testing of protection mechanisms

## Priority

**High** - Critical for platform growth and security

## Labels

- `feature`
- `security`
- `registration`
- `ddos-protection`
- `critical`