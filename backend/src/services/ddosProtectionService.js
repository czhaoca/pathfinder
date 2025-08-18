/**
 * DDoS Protection Service
 * 
 * Comprehensive protection against DDoS attacks and abuse:
 * - IP blocking and reputation management
 * - Rate limiting with sliding windows
 * - Attack pattern detection
 * - VPN/Proxy detection
 * - Disposable email blocking
 * - Real-time threat analysis
 */

const crypto = require('crypto');
const fetch = require('node-fetch');
const logger = require('../utils/logger');

class DDoSProtectionService {
  constructor(redis, database) {
    this.redis = redis;
    this.database = database;
    this.patterns = new Map();
    this.notificationService = null; // Injected separately
    
    this.initializePatternDetection();
  }

  /**
   * Check if an IP address is blocked
   */
  async checkIPStatus(ipAddress) {
    // Check permanent blocks in database
    const permanentBlock = await this.database.query(
      `SELECT * FROM pf_blocked_ips 
       WHERE ip_address = $1 
       AND (expires_at IS NULL OR expires_at > NOW())`,
      [ipAddress]
    );

    if (permanentBlock.rows.length > 0) {
      return { 
        blocked: true, 
        reason: permanentBlock.rows[0].reason,
        expiresAt: permanentBlock.rows[0].expires_at
      };
    }

    // Check subnet blocks
    const subnetBlock = await this.checkSubnetBlock(ipAddress);
    if (subnetBlock.blocked) {
      return subnetBlock;
    }

    // Check temporary blocks in Redis
    const tempBlock = await this.redis.get(`blocked:${ipAddress}`);
    if (tempBlock) {
      return { 
        blocked: true, 
        reason: 'Temporary block due to suspicious activity',
        temporary: true
      };
    }

    return { blocked: false };
  }

  /**
   * Check if IP is in a blocked subnet
   */
  async checkSubnetBlock(ipAddress) {
    const subnets = await this.database.query(
      `SELECT * FROM pf_blocked_subnets 
       WHERE expires_at IS NULL OR expires_at > NOW()`
    );

    for (const subnet of subnets.rows) {
      if (this.isIPInSubnet(ipAddress, subnet.subnet_cidr)) {
        return {
          blocked: true,
          reason: `Subnet block: ${subnet.reason}`,
          subnet: subnet.subnet_cidr
        };
      }
    }

    return { blocked: false };
  }

  /**
   * Check if IP is in a subnet (CIDR notation)
   */
  isIPInSubnet(ip, subnet) {
    // Simple implementation - would use ip-cidr library in production
    const [subnetIP, bits] = subnet.split('/');
    if (!bits) return ip === subnetIP;
    
    // Convert IPs to numbers for comparison
    const ipNum = this.ipToNumber(ip);
    const subnetNum = this.ipToNumber(subnetIP);
    const mask = (0xffffffff << (32 - parseInt(bits))) >>> 0;
    
    return (ipNum & mask) === (subnetNum & mask);
  }

  /**
   * Convert IP address to number
   */
  ipToNumber(ip) {
    const parts = ip.split('.');
    return parts.reduce((acc, part, i) => acc + (parseInt(part) << (8 * (3 - i))), 0) >>> 0;
  }

  /**
   * Get subnet from IP address
   */
  getSubnet(ipAddress, bits = 24) {
    const parts = ipAddress.split('.');
    if (bits === 24) {
      return `${parts[0]}.${parts[1]}.${parts[2]}.0/24`;
    }
    return ipAddress; // Simplified for now
  }

  /**
   * Block an IP address
   */
  async blockIP(ipAddress, durationMinutes, reason = 'Suspicious activity') {
    // Add to Redis for immediate blocking
    await this.redis.set(
      `blocked:${ipAddress}`,
      'blocked',
      'EX',
      durationMinutes * 60
    );

    // Add to database for persistent record
    const expiresAt = durationMinutes ? 
      new Date(Date.now() + durationMinutes * 60 * 1000) : null;
    
    await this.database.query(
      `INSERT INTO pf_blocked_ips 
       (ip_address, reason, blocked_by, expires_at, auto_blocked) 
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (ip_address) 
       DO UPDATE SET 
         reason = $2,
         expires_at = $4,
         blocked_at = NOW()`,
      [ipAddress, reason, 'system', expiresAt, true]
    );

    logger.info('IP blocked', { ipAddress, durationMinutes, reason });
  }

  /**
   * Block a subnet
   */
  async blockSubnet(subnet, durationMinutes, reason = 'Subnet-wide suspicious activity') {
    const expiresAt = durationMinutes ? 
      new Date(Date.now() + durationMinutes * 60 * 1000) : null;
    
    await this.database.query(
      `INSERT INTO pf_blocked_subnets 
       (subnet_cidr, reason, blocked_by, expires_at) 
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (subnet_cidr) 
       DO UPDATE SET 
         reason = $2,
         expires_at = $4,
         blocked_at = NOW()`,
      [subnet, reason, 'system', expiresAt]
    );

    logger.warn('Subnet blocked', { subnet, durationMinutes, reason });
  }

  /**
   * Get recent attempts from an IP with sliding window
   */
  async getRecentAttempts(ipAddress, windowMinutes) {
    const key = `attempts:${ipAddress}`;
    const now = Date.now();
    const windowStart = now - (windowMinutes * 60 * 1000);

    // Remove old entries outside the window
    await this.redis.zremrangebyscore(key, '-inf', windowStart);
    
    // Count remaining entries
    const count = await this.redis.zcard(key);

    // Add current attempt
    await this.redis.zadd(key, now, `${now}`);
    
    // Set expiry on the key
    await this.redis.expire(key, windowMinutes * 60);

    return count;
  }

  /**
   * Get recent email attempts
   */
  async getRecentEmailAttempts(email, windowMinutes) {
    const emailHash = this.hashEmail(email);
    const key = `attempts:email:${emailHash}`;
    const now = Date.now();
    const windowStart = now - (windowMinutes * 60 * 1000);

    await this.redis.zremrangebyscore(key, '-inf', windowStart);
    const count = await this.redis.zcard(key);
    await this.redis.zadd(key, now, `${now}`);
    await this.redis.expire(key, windowMinutes * 60);

    return count;
  }

  /**
   * Get recent attempt details for analysis
   */
  async getRecentAttemptDetails(ipAddress, limit = 20) {
    const result = await this.database.query(
      `SELECT * FROM pf_registration_attempts 
       WHERE ip_address = $1 
       ORDER BY attempted_at DESC 
       LIMIT $2`,
      [ipAddress, limit]
    );
    
    return result.rows.map(row => ({
      email: row.email_hash,
      username: row.username,
      timestamp: row.attempted_at.getTime(),
      success: row.success,
      userAgent: row.user_agent,
      hasMouseMovement: row.has_mouse_movement,
      hasKeyboardVariation: row.has_keyboard_variation,
      passwordLength: row.password_length,
      passwordHint: row.password_hint
    }));
  }

  /**
   * Increment counter with TTL
   */
  async incrementCounter(key, ttlSeconds) {
    await this.redis.incr(key);
    await this.redis.expire(key, ttlSeconds);
  }

  /**
   * Track failed registration attempt
   */
  async trackFailedAttempt({ email, ipAddress, fingerprint, reason }) {
    const emailHash = email ? this.hashEmail(email) : null;
    
    // Store in database
    await this.database.query(
      `INSERT INTO pf_registration_attempts 
       (email_hash, ip_address, fingerprint, success, reason, attempted_at) 
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [emailHash, ipAddress, fingerprint, false, reason]
    );

    // Update Redis counters
    await this.incrementCounter(`failed:${ipAddress}`, 3600);
    if (emailHash) {
      await this.incrementCounter(`failed:email:${emailHash}`, 3600);
    }

    // Update device fingerprint if provided
    if (fingerprint) {
      await this.updateFingerprintData(fingerprint, false);
    }

    // Check for attack patterns
    await this.detectAttackPatterns(ipAddress);
  }

  /**
   * Track successful registration
   */
  async trackSuccessfulRegistration({ userId, email, ipAddress, fingerprint }) {
    const emailHash = this.hashEmail(email);
    
    // Store in database
    await this.database.query(
      `INSERT INTO pf_registration_attempts 
       (email_hash, ip_address, fingerprint, success, attempted_at) 
       VALUES ($1, $2, $3, $4, NOW())`,
      [emailHash, ipAddress, fingerprint, true]
    );

    // Update IP reputation
    await this.updateIPReputation(ipAddress, true);

    // Update device fingerprint
    if (fingerprint) {
      await this.updateFingerprintData(fingerprint, true);
    }

    // Clear failure counters
    await this.redis.del(`failed:${ipAddress}`);
    await this.redis.del(`failed:email:${emailHash}`);
  }

  /**
   * Track successful email verification
   */
  async trackSuccessfulVerification({ userId, email }) {
    // Update metrics
    await this.updateMetrics('verification_completed', 1);
    
    logger.info('Email verification completed', { userId, emailDomain: email.split('@')[1] });
  }

  /**
   * Detect attack patterns
   */
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

    // Pattern 3: Distributed attack
    const similarPatterns = await this.findSimilarPatterns(attempts);
    if (similarPatterns.length > 5) {
      patterns.push('distributed_attack');
    }

    // Pattern 4: Known bot signatures
    if (await this.matchesBotSignature(ipAddress)) {
      patterns.push('bot_signature');
    }

    // Pattern 5: Credential stuffing
    if (await this.detectCredentialStuffing(attempts)) {
      patterns.push('credential_stuffing');
    }

    if (patterns.length > 0) {
      await this.handleDetectedPatterns(ipAddress, patterns);
    }

    return patterns;
  }

  /**
   * Check for sequential patterns in attempts
   */
  hasSequentialPattern(attempts) {
    if (attempts.length < 3) return false;

    const usernames = attempts.map(a => a.username).filter(Boolean);

    // Check for patterns like user1, user2, user3
    const numberPattern = /\d+$/;
    const numbers = usernames.map(u => {
      const match = u?.match(numberPattern);
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

  /**
   * Find similar patterns across different IPs
   */
  async findSimilarPatterns(attempts) {
    if (attempts.length === 0) return [];

    // Look for similar attempts from different IPs in the last hour
    const result = await this.database.query(
      `SELECT DISTINCT ip_address 
       FROM pf_registration_attempts 
       WHERE attempted_at > NOW() - INTERVAL '1 hour'
       AND ip_address != $1
       GROUP BY ip_address 
       HAVING COUNT(*) > 5`,
      [attempts[0]?.ipAddress]
    );

    return result.rows;
  }

  /**
   * Check if attempts match bot signature
   */
  async matchesBotSignature(ipAddress) {
    const attempts = await this.getRecentAttemptDetails(ipAddress, 20);
    if (attempts.length < 5) return false;

    // Bot signatures
    const signatures = {
      // Consistent timing between requests
      consistentTiming: () => {
        const timestamps = attempts.map(a => a.timestamp);
        const intervals = [];
        for (let i = 1; i < timestamps.length; i++) {
          intervals.push(timestamps[i] - timestamps[i-1]);
        }
        if (intervals.length === 0) return false;
        
        const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        const variance = intervals.reduce((sum, val) => 
          sum + Math.pow(val - avgInterval, 2), 0) / intervals.length;
        
        return variance < 100; // Very low variance indicates bot
      },

      // Same user agent for all attempts
      sameUserAgent: () => {
        const userAgents = new Set(attempts.map(a => a.userAgent).filter(Boolean));
        return userAgents.size === 1 && attempts.length > 5;
      },

      // No human behavior indicators
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

  /**
   * Detect credential stuffing attacks
   */
  async detectCredentialStuffing(attempts) {
    if (attempts.length < 10) return false;

    // Check if many different emails with similar passwords
    const passwordLengths = attempts.map(a => a.passwordLength).filter(Boolean);
    const uniqueLengths = new Set(passwordLengths);
    
    // If all passwords have same length, might be credential stuffing
    if (uniqueLengths.size === 1 && attempts.length > 10) {
      return true;
    }

    // Check for common password patterns
    const commonPasswords = ['password', '123456', 'admin', 'test'];
    const hasCommonPasswords = attempts.filter(a => 
      commonPasswords.includes(a.passwordHint)
    ).length > attempts.length * 0.3;

    return hasCommonPasswords;
  }

  /**
   * Handle detected attack patterns
   */
  async handleDetectedPatterns(ipAddress, patterns) {
    logger.warn('Attack patterns detected', { ipAddress, patterns });

    // Store in database
    await this.database.query(
      `INSERT INTO pf_detected_attacks 
       (attack_type, severity, ip_addresses, pattern_data, detected_at) 
       VALUES ($1, $2, $3, $4, NOW())`,
      [
        patterns.join(','),
        this.getAttackSeverity(patterns),
        [ipAddress],
        JSON.stringify({ patterns, ipAddress })
      ]
    );

    // Immediate block for severe patterns
    if (patterns.includes('distributed_attack') || patterns.includes('bot_signature')) {
      await this.blockIP(ipAddress, 24 * 60); // 24 hours
      
      // Block entire subnet if distributed
      if (patterns.includes('distributed_attack')) {
        const subnet = this.getSubnet(ipAddress);
        await this.blockSubnet(subnet, 60); // 1 hour for subnet
      }
    } else if (patterns.includes('credential_stuffing')) {
      await this.blockIP(ipAddress, 6 * 60); // 6 hours
    } else {
      await this.blockIP(ipAddress, 60); // 1 hour
    }

    // Send alert
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

  /**
   * Get attack severity
   */
  getAttackSeverity(patterns) {
    if (patterns.includes('distributed_attack')) return 'critical';
    if (patterns.includes('bot_signature') || patterns.includes('credential_stuffing')) return 'high';
    if (patterns.includes('rapid_succession')) return 'medium';
    return 'low';
  }

  /**
   * Get recommendation based on patterns
   */
  getRecommendation(patterns) {
    if (patterns.includes('distributed_attack')) {
      return 'Consider temporarily disabling registration and reviewing security measures';
    }
    if (patterns.includes('bot_signature')) {
      return 'Enable CAPTCHA for all registrations and review bot detection rules';
    }
    if (patterns.includes('credential_stuffing')) {
      return 'Monitor for compromised credentials and enforce strong password requirements';
    }
    return 'Increase rate limiting and monitoring';
  }

  /**
   * Update protection rules based on detected patterns
   */
  async updateProtectionRules(patterns) {
    // This would update dynamic protection rules
    // For now, just log the action
    logger.info('Updating protection rules', { patterns });
  }

  /**
   * Send alert to administrators
   */
  async sendAlert(alertData) {
    // Store alert in database
    await this.database.query(
      `INSERT INTO pf_registration_alerts 
       (alert_type, severity, title, message, details, created_at) 
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [
        alertData.type,
        alertData.severity,
        `Attack Pattern Detected: ${alertData.patterns.join(', ')}`,
        `Suspicious activity detected from IP ${alertData.ipAddress}`,
        JSON.stringify(alertData)
      ]
    );

    // Send notification if service is available
    if (this.notificationService) {
      await this.notificationService.sendAdminAlert(alertData);
    }
  }

  /**
   * Get IP reputation
   */
  async getIPReputation(ipAddress) {
    // Check cache first
    const cached = await this.getCachedIPReputation(ipAddress);
    if (cached && this.isReputationFresh(cached)) {
      return cached;
    }

    // Fetch fresh reputation data
    const [
      abuseIPDB,
      spamhaus,
      internalHistory
    ] = await Promise.all([
      this.checkAbuseIPDB(ipAddress).catch(() => ({ abuseScore: 0 })),
      this.checkSpamhaus(ipAddress).catch(() => ({ clean: true })),
      this.getInternalReputation(ipAddress)
    ]);

    // Calculate combined score (0-100, higher is better)
    const score = Math.round(
      (100 - (abuseIPDB.abuseScore || 0)) * 0.4 +
      (spamhaus.clean ? 100 : 0) * 0.3 +
      internalHistory.score * 0.3
    );

    const reputation = {
      score,
      details: {
        abuseIPDB,
        spamhaus,
        internal: internalHistory
      }
    };

    // Cache the reputation
    await this.cacheIPReputation(ipAddress, reputation);

    return reputation;
  }

  /**
   * Get cached IP reputation
   */
  async getCachedIPReputation(ipAddress) {
    const result = await this.database.query(
      'SELECT * FROM pf_ip_reputation WHERE ip_address = $1',
      [ipAddress]
    );
    
    return result.rows[0] || null;
  }

  /**
   * Check if reputation data is fresh
   */
  isReputationFresh(reputation) {
    const age = Date.now() - reputation.last_checked.getTime();
    return age < 24 * 60 * 60 * 1000; // 24 hours
  }

  /**
   * Cache IP reputation
   */
  async cacheIPReputation(ipAddress, reputation) {
    await this.database.query(
      `INSERT INTO pf_ip_reputation 
       (ip_address, reputation_score, last_checked) 
       VALUES ($1, $2, NOW())
       ON CONFLICT (ip_address) 
       DO UPDATE SET 
         reputation_score = $2,
         last_checked = NOW()`,
      [ipAddress, reputation.score]
    );
  }

  /**
   * Check AbuseIPDB (would require API key in production)
   */
  async checkAbuseIPDB(ipAddress) {
    // Simulated for development
    // In production, would call: https://api.abuseipdb.com/api/v2/check
    return {
      abuseScore: Math.random() * 30, // Random score for testing
      isWhitelisted: false,
      usageType: 'Commercial',
      isp: 'Example ISP'
    };
  }

  /**
   * Check Spamhaus (would require API in production)
   */
  async checkSpamhaus(ipAddress) {
    // Simulated for development
    return {
      clean: Math.random() > 0.1, // 90% clean for testing
      listed: false
    };
  }

  /**
   * Get internal reputation based on history
   */
  async getInternalReputation(ipAddress) {
    const result = await this.database.query(
      `SELECT 
         COUNT(*) FILTER (WHERE success = true) as successful,
         COUNT(*) FILTER (WHERE success = false) as failed,
         COUNT(*) as total
       FROM pf_registration_attempts 
       WHERE ip_address = $1 
       AND attempted_at > NOW() - INTERVAL '30 days'`,
      [ipAddress]
    );

    const { successful, failed, total } = result.rows[0];
    
    if (total === 0) {
      return { score: 70, registrations: 0, failures: 0 }; // Neutral score for new IPs
    }

    const successRate = successful / total;
    const score = Math.round(successRate * 100);

    return {
      score: Math.max(0, Math.min(100, score)),
      registrations: successful,
      failures: failed
    };
  }

  /**
   * Update IP reputation after registration attempt
   */
  async updateIPReputation(ipAddress, success) {
    const field = success ? 'successful_registrations' : 'failed_attempts';
    
    await this.database.query(
      `INSERT INTO pf_ip_reputation (ip_address, ${field}) 
       VALUES ($1, 1)
       ON CONFLICT (ip_address) 
       DO UPDATE SET ${field} = pf_ip_reputation.${field} + 1`,
      [ipAddress]
    );
  }

  /**
   * Detect VPN/Proxy
   */
  async detectVPNProxy(ipAddress) {
    // Check cache first
    const cached = await this.database.query(
      'SELECT is_vpn, is_proxy, is_hosting, is_tor FROM pf_ip_reputation WHERE ip_address = $1',
      [ipAddress]
    );

    if (cached.rows.length > 0) {
      return {
        isVPN: cached.rows[0].is_vpn,
        isProxy: cached.rows[0].is_proxy,
        isHosting: cached.rows[0].is_hosting,
        isTor: cached.rows[0].is_tor
      };
    }

    // In production, would use services like IPQualityScore or similar
    // For now, simple heuristic based on IP ranges
    const isVPN = this.isKnownVPNRange(ipAddress);
    const isProxy = this.isKnownProxyRange(ipAddress);
    const isTor = this.isKnownTorExit(ipAddress);

    // Cache the result
    await this.database.query(
      `INSERT INTO pf_ip_reputation (ip_address, is_vpn, is_proxy, is_tor) 
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (ip_address) 
       DO UPDATE SET is_vpn = $2, is_proxy = $3, is_tor = $4`,
      [ipAddress, isVPN, isProxy, isTor]
    );

    return { isVPN, isProxy, isTor };
  }

  /**
   * Check if IP is in known VPN range
   */
  isKnownVPNRange(ipAddress) {
    // Simplified check - in production would use comprehensive lists
    const vpnRanges = ['10.', '172.16.', '192.168.'];
    return vpnRanges.some(range => ipAddress.startsWith(range));
  }

  /**
   * Check if IP is in known proxy range
   */
  isKnownProxyRange(ipAddress) {
    // Simplified check
    return false;
  }

  /**
   * Check if IP is known Tor exit node
   */
  isKnownTorExit(ipAddress) {
    // Would check against Tor exit node list
    return false;
  }

  /**
   * Get list of disposable email domains
   */
  async getDisposableDomains() {
    const result = await this.database.query(
      'SELECT domain FROM pf_disposable_email_domains'
    );
    
    return result.rows.map(row => row.domain);
  }

  /**
   * Check if domain is blacklisted
   */
  async isDomainBlacklisted(domain) {
    const result = await this.database.query(
      'SELECT 1 FROM pf_blacklisted_domains WHERE domain = $1',
      [domain]
    );
    
    return result.rows.length > 0;
  }

  /**
   * Get failed attempts count
   */
  async getFailedAttempts(ipAddress, windowMinutes) {
    const key = `failed:${ipAddress}`;
    const count = await this.redis.get(key);
    return parseInt(count) || 0;
  }

  /**
   * Get unique IPs in last minute
   */
  async getUniqueIPsLastMinute() {
    const result = await this.database.query(
      `SELECT COUNT(DISTINCT ip_address) as unique_ips 
       FROM pf_registration_attempts 
       WHERE attempted_at > NOW() - INTERVAL '1 minute'`
    );
    
    return result.rows[0]?.unique_ips || 0;
  }

  /**
   * Enable strict protection mode
   */
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

  /**
   * Clear pending registrations
   */
  async clearPendingRegistrations() {
    const result = await this.database.query(
      'DELETE FROM pf_pending_registrations'
    );
    
    logger.info('Cleared pending registrations', { count: result.rowCount });
    
    return { cleared: result.rowCount };
  }

  /**
   * Flag suspicious device fingerprint
   */
  async flagSuspiciousDevice(fingerprint) {
    await this.database.query(
      `INSERT INTO pf_device_fingerprints (fingerprint, suspicious, last_seen) 
       VALUES ($1, true, NOW())
       ON CONFLICT (fingerprint) 
       DO UPDATE SET suspicious = true, last_seen = NOW()`,
      [fingerprint]
    );
  }

  /**
   * Get fingerprint data
   */
  async getFingerprintData(fingerprint) {
    const result = await this.database.query(
      'SELECT * FROM pf_device_fingerprints WHERE fingerprint = $1',
      [fingerprint]
    );
    
    if (result.rows.length === 0) return null;
    
    const data = result.rows[0];
    
    // Get recent registrations
    const recentRegs = await this.database.query(
      `SELECT COUNT(*) as count 
       FROM pf_registration_attempts 
       WHERE fingerprint = $1 
       AND success = true 
       AND attempted_at > NOW() - INTERVAL '24 hours'`,
      [fingerprint]
    );
    
    data.recentRegistrations = recentRegs.rows[0]?.count || 0;
    data.failedAttempts = data.registration_attempts - data.successful_registrations;
    
    return data;
  }

  /**
   * Record new fingerprint
   */
  async recordFingerprint(fingerprint, deviceInfo = {}) {
    await this.database.query(
      `INSERT INTO pf_device_fingerprints 
       (fingerprint, first_seen, last_seen, device_info) 
       VALUES ($1, NOW(), NOW(), $2)
       ON CONFLICT (fingerprint) 
       DO UPDATE SET last_seen = NOW()`,
      [fingerprint, JSON.stringify(deviceInfo)]
    );
  }

  /**
   * Update fingerprint data
   */
  async updateFingerprintData(fingerprint, success) {
    const field = success ? 'successful_registrations' : 'registration_attempts';
    
    await this.database.query(
      `INSERT INTO pf_device_fingerprints 
       (fingerprint, ${field}, last_seen) 
       VALUES ($1, 1, NOW())
       ON CONFLICT (fingerprint) 
       DO UPDATE SET 
         ${field} = pf_device_fingerprints.${field} + 1,
         last_seen = NOW()`,
      [fingerprint]
    );
  }

  /**
   * Create pending registration
   */
  async createPendingRegistration(data) {
    const result = await this.database.query(
      `INSERT INTO pf_pending_registrations 
       (email, username, password_hash, first_name, last_name, 
        verification_token, verification_code, ip_address, 
        fingerprint, expires_at) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        data.email,
        data.username,
        data.passwordHash,
        data.firstName,
        data.lastName,
        data.verificationToken,
        data.verificationCode,
        data.ipAddress,
        data.fingerprint,
        data.expiresAt
      ]
    );
    
    return result.rows[0];
  }

  /**
   * Get pending registration by token
   */
  async getPendingRegistration(token) {
    const result = await this.database.query(
      'SELECT * FROM pf_pending_registrations WHERE verification_token = $1',
      [token]
    );
    
    return result.rows[0] || null;
  }

  /**
   * Delete pending registration
   */
  async deletePendingRegistration(token) {
    await this.database.query(
      'DELETE FROM pf_pending_registrations WHERE verification_token = $1',
      [token]
    );
  }

  /**
   * Get geo-location for IP (would use GeoIP service in production)
   */
  async getGeoLocation(ipAddress) {
    // Check cache
    const cached = await this.database.query(
      'SELECT country_code, region, city FROM pf_ip_reputation WHERE ip_address = $1',
      [ipAddress]
    );

    if (cached.rows.length > 0 && cached.rows[0].country_code) {
      return {
        country: cached.rows[0].country_code,
        region: cached.rows[0].region,
        city: cached.rows[0].city
      };
    }

    // In production, would use MaxMind GeoIP2 or similar
    return {
      country: 'US',
      region: 'Unknown',
      city: 'Unknown'
    };
  }

  /**
   * Update metrics
   */
  async updateMetrics(metric, value = 1) {
    const now = new Date();
    const date = now.toISOString().split('T')[0];
    const hour = now.getHours();

    await this.database.query(
      `INSERT INTO pf_registration_metrics 
       (metric_date, hour, ${metric}) 
       VALUES ($1, $2, $3)
       ON CONFLICT (metric_date, hour) 
       DO UPDATE SET ${metric} = pf_registration_metrics.${metric} + $3`,
      [date, hour, value]
    );
  }

  /**
   * Hash email for privacy
   */
  hashEmail(email) {
    return crypto.createHash('sha256')
      .update(email.toLowerCase())
      .digest('hex');
  }

  /**
   * Initialize pattern detection rules
   */
  initializePatternDetection() {
    // Credential stuffing pattern
    this.patterns.set('credential_stuffing', {
      check: async (attempts) => {
        const passwords = attempts.map(a => a.passwordLength).filter(Boolean);
        const uniquePasswords = new Set(passwords);
        return attempts.length > 10 && uniquePasswords.size < 3;
      },
      action: 'block_24h'
    });

    // Email enumeration pattern
    this.patterns.set('email_enumeration', {
      check: async (attempts) => {
        const emails = attempts.map(a => a.email);
        return emails.length > 20 && new Set(emails).size === emails.length;
      },
      action: 'block_1h'
    });

    // Dictionary attack pattern
    this.patterns.set('dictionary_attack', {
      check: async (attempts) => {
        const commonPasswords = ['password', '123456', 'admin', 'test'];
        return attempts.some(a => commonPasswords.includes(a.passwordHint));
      },
      action: 'require_captcha'
    });

    // Brute force pattern
    this.patterns.set('brute_force', {
      check: async (attempts) => {
        return attempts.filter(a => !a.success).length > 20;
      },
      action: 'block_48h'
    });
  }
}

module.exports = { DDoSProtectionService };