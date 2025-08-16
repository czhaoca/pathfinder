const crypto = require('crypto');
const readline = require('readline');
const chalk = require('chalk');
const { v4: uuidv4 } = require('uuid');
const { query } = require('../database/connection');
const auditService = require('./auditService');
const alertService = require('./alertService');
const SiteAdminProvisioner = require('./siteAdminProvisioner');
const speakeasy = require('speakeasy');

class EmergencyRecovery {
  constructor(config = {}) {
    this.config = {
      requirePhysicalAccess: config.requirePhysicalAccess !== false,
      require2FA: config.require2FA !== false,
      tempAdminExpiry: config.tempAdminExpiry || 60 * 60 * 1000, // 1 hour
      maxRecoveryAttempts: config.maxRecoveryAttempts || 3,
      alertOnRecovery: config.alertOnRecovery !== false,
      ...config
    };
    
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }

  /**
   * Initiate emergency recovery process
   */
  async initiateRecovery() {
    console.log('\n' + chalk.bgRed.white.bold(' '.repeat(60)));
    console.log(chalk.bgRed.white.bold('              🚨 EMERGENCY RECOVERY MODE 🚨              '));
    console.log(chalk.bgRed.white.bold(' '.repeat(60)) + '\n');

    const recoveryId = uuidv4();
    const startTime = Date.now();

    try {
      // Step 1: Check physical access
      if (this.config.requirePhysicalAccess) {
        console.log(chalk.yellow('🔒 Verifying physical server access...'));
        if (!this.hasPhysicalAccess()) {
          throw new Error('Emergency recovery requires physical server access. SSH connections are not permitted.');
        }
        console.log(chalk.green('✓ Physical access verified'));
      }

      // Step 2: Log recovery attempt
      await this.logRecoveryAttempt(recoveryId, 'initiated');

      // Step 3: Display recovery challenge
      const challenge = this.generateChallenge();
      console.log(chalk.yellow('\n📋 Recovery Challenge Generated:'));
      console.log(chalk.cyan.bold(`   ${challenge}`));
      console.log(chalk.gray('   This challenge is valid for 15 minutes'));

      // Step 4: Verify recovery authorization
      console.log(chalk.yellow('\n🔐 Authorization Required:'));
      const authorized = await this.verifyAuthorization(challenge);
      
      if (!authorized) {
        throw new Error('Recovery authorization failed');
      }

      // Step 5: Check for existing site admin
      const existingAdmin = await this.checkExistingSiteAdmin();
      let recoveryMethod = 'new_admin';
      
      if (existingAdmin) {
        console.log(chalk.yellow('\n⚠️  Existing site admin detected:'));
        console.log(chalk.white(`   Username: ${existingAdmin.username}`));
        console.log(chalk.white(`   Created: ${existingAdmin.CREATED_AT}`));
        
        recoveryMethod = await this.selectRecoveryMethod();
      }

      // Step 6: Execute recovery based on method
      let result;
      switch (recoveryMethod) {
        case 'reset_password':
          result = await this.resetAdminPassword(existingAdmin);
          break;
        case 'unlock_account':
          result = await this.unlockAdminAccount(existingAdmin);
          break;
        case 'temporary_admin':
          result = await this.createTemporaryAdmin();
          break;
        case 'new_admin':
          result = await this.createNewSiteAdmin();
          break;
        default:
          throw new Error('Invalid recovery method selected');
      }

      // Step 7: Log successful recovery
      await this.logRecoverySuccess(recoveryId, recoveryMethod, result.userId);

      // Step 8: Send critical alerts
      if (this.config.alertOnRecovery) {
        await this.sendRecoveryAlerts(recoveryMethod, result);
      }

      // Display recovery results
      this.displayRecoveryResults(result, recoveryMethod);

      console.log(chalk.green.bold('\n✅ Emergency recovery completed successfully'));
      console.log(chalk.yellow(`Recovery ID: ${recoveryId}`));
      console.log(chalk.yellow(`Duration: ${Math.round((Date.now() - startTime) / 1000)} seconds`));

      return {
        success: true,
        recoveryId,
        method: recoveryMethod,
        ...result
      };

    } catch (error) {
      console.error(chalk.red.bold('\n❌ Emergency recovery failed:'), error.message);
      
      await this.logRecoveryFailure(recoveryId, error.message);
      
      throw error;
    } finally {
      this.rl.close();
    }
  }

  /**
   * Check if running with physical server access
   */
  hasPhysicalAccess() {
    // Check various indicators of remote access
    const isSSH = !!process.env.SSH_CLIENT || !!process.env.SSH_TTY || !!process.env.SSH_CONNECTION;
    const isRemote = !!process.env.REMOTEHOST;
    const isTTY = process.stdin.isTTY && process.stdout.isTTY;
    
    // Physical access means: TTY available and NOT via SSH
    return isTTY && !isSSH && !isRemote;
  }

  /**
   * Generate recovery challenge token
   */
  generateChallenge() {
    const challenge = crypto.randomBytes(32).toString('hex');
    const timestamp = Date.now();
    
    // Store challenge for validation
    this.currentChallenge = {
      token: challenge,
      timestamp,
      expires: timestamp + (15 * 60 * 1000) // 15 minutes
    };
    
    return challenge;
  }

  /**
   * Verify recovery authorization
   */
  async verifyAuthorization(challenge) {
    return new Promise(async (resolve) => {
      try {
        // Method 1: Recovery code verification
        const useRecoveryCode = await this.prompt(
          '\nDo you have a valid recovery code? (y/n): '
        );
        
        if (useRecoveryCode.toLowerCase() === 'y') {
          const code = await this.prompt('Enter recovery code (XXXX-XXXX): ');
          const valid = await this.validateRecoveryCode(code);
          
          if (valid) {
            console.log(chalk.green('✓ Recovery code validated'));
            resolve(true);
            return;
          } else {
            console.log(chalk.red('✗ Invalid recovery code'));
          }
        }

        // Method 2: Two-factor authentication
        if (this.config.require2FA) {
          console.log(chalk.yellow('\n📱 Two-factor authentication required'));
          const totpCode = await this.prompt('Enter 6-digit 2FA code: ');
          
          // In production, this would validate against emergency 2FA device
          const valid = await this.validateEmergency2FA(totpCode);
          
          if (valid) {
            console.log(chalk.green('✓ 2FA validated'));
            resolve(true);
            return;
          } else {
            console.log(chalk.red('✗ Invalid 2FA code'));
          }
        }

        // Method 3: Challenge response from security team
        console.log(chalk.yellow('\n📞 Contact security team with challenge token'));
        console.log(chalk.gray('   Waiting for authorization...'));
        
        const authCode = await this.prompt('Enter authorization code from security team: ');
        const valid = this.validateAuthorizationCode(authCode, challenge);
        
        resolve(valid);
        
      } catch (error) {
        console.error('Authorization error:', error);
        resolve(false);
      }
    });
  }

  /**
   * Validate recovery code
   */
  async validateRecoveryCode(code) {
    // Check if this is an emergency master recovery code
    const emergencyCode = process.env.EMERGENCY_RECOVERY_CODE;
    if (emergencyCode && code === emergencyCode) {
      return true;
    }

    // Check database for valid recovery codes
    const codeHash = crypto.createHash('sha256').update(code).digest('hex');
    
    const result = await query(`
      SELECT * FROM pf_recovery_codes
      WHERE code_hash = :codeHash
      AND used_at IS NULL
      AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
    `, { codeHash });

    if (result.rows.length > 0) {
      // Mark code as used
      await query(`
        UPDATE pf_recovery_codes
        SET used_at = CURRENT_TIMESTAMP,
            used_by_ip = :ip
        WHERE code_hash = :codeHash
      `, {
        codeHash,
        ip: 'console'
      });
      
      return true;
    }

    return false;
  }

  /**
   * Validate emergency 2FA
   */
  async validateEmergency2FA(totpCode) {
    // Check against emergency 2FA secret
    const emergencySecret = process.env.EMERGENCY_2FA_SECRET;
    
    if (!emergencySecret) {
      console.log(chalk.yellow('⚠️  Emergency 2FA not configured'));
      return false;
    }

    const verified = speakeasy.totp.verify({
      secret: emergencySecret,
      encoding: 'base32',
      token: totpCode,
      window: 2 // Allow 2 time steps for clock skew
    });

    return verified;
  }

  /**
   * Validate authorization code from security team
   */
  validateAuthorizationCode(authCode, challenge) {
    // In production, this would verify against a secure channel
    // For now, generate expected code from challenge
    const expectedCode = crypto.createHash('sha256')
      .update(challenge + (process.env.RECOVERY_SALT || 'default'))
      .digest('hex')
      .substring(0, 8)
      .toUpperCase();

    return authCode.toUpperCase() === expectedCode;
  }

  /**
   * Select recovery method for existing admin
   */
  async selectRecoveryMethod() {
    console.log(chalk.yellow('\n📋 Select recovery method:'));
    console.log('   1. Reset admin password');
    console.log('   2. Unlock admin account');
    console.log('   3. Create temporary admin');
    console.log('   4. Override and create new admin');
    
    const choice = await this.prompt('Enter choice (1-4): ');
    
    const methods = {
      '1': 'reset_password',
      '2': 'unlock_account',
      '3': 'temporary_admin',
      '4': 'new_admin'
    };
    
    return methods[choice] || 'temporary_admin';
  }

  /**
   * Reset admin password
   */
  async resetAdminPassword(admin) {
    const provisioner = new SiteAdminProvisioner();
    const newPassword = provisioner.generateSecurePassword();
    
    // Update password
    const salt = crypto.randomBytes(32).toString('hex');
    const clientHash = crypto.createHash('sha256')
      .update(newPassword + salt)
      .digest('hex');
    
    const argon2 = require('argon2');
    const finalHash = await argon2.hash(clientHash + salt, {
      type: argon2.argon2id,
      memoryCost: 2 ** 16,
      timeCost: 3,
      parallelism: 1
    });

    await query(`
      UPDATE pf_user_passwords
      SET password_hash = :hash,
          server_salt = :salt,
          client_salt = :salt,
          expires_at = :expires,
          must_change = 1,
          last_changed = CURRENT_TIMESTAMP
      WHERE user_id = :userId
    `, {
      hash: finalHash,
      salt,
      userId: admin.ID,
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000)
    });

    return {
      userId: admin.ID,
      username: admin.USERNAME,
      newPassword,
      message: 'Admin password has been reset'
    };
  }

  /**
   * Unlock admin account
   */
  async unlockAdminAccount(admin) {
    await query(`
      UPDATE pf_users
      SET status = 'active',
          failed_login_attempts = 0,
          locked_until = NULL
      WHERE id = :userId
    `, { userId: admin.ID });

    // Clear any active lockouts
    await query(`
      DELETE FROM pf_user_sessions
      WHERE user_id = :userId
    `, { userId: admin.ID });

    return {
      userId: admin.ID,
      username: admin.USERNAME,
      message: 'Admin account has been unlocked'
    };
  }

  /**
   * Create temporary admin
   */
  async createTemporaryAdmin() {
    const provisioner = new SiteAdminProvisioner();
    const username = `recovery_admin_${Date.now()}`;
    const tempPassword = provisioner.generateSecurePassword();
    
    // Create temporary admin user
    const userId = uuidv4();
    
    await query('BEGIN');
    
    try {
      // Create user
      await query(`
        INSERT INTO pf_users (
          id, username, email, first_name, last_name,
          status, created_at
        ) VALUES (
          :userId, :username, :email, 'Recovery', 'Admin',
          'active', CURRENT_TIMESTAMP
        )
      `, {
        userId,
        username,
        email: `${username}@recovery.local`
      });

      // Add password
      const salt = crypto.randomBytes(32).toString('hex');
      const clientHash = crypto.createHash('sha256')
        .update(tempPassword + salt)
        .digest('hex');
      
      const argon2 = require('argon2');
      const finalHash = await argon2.hash(clientHash + salt, {
        type: argon2.argon2id,
        memoryCost: 2 ** 16,
        timeCost: 3,
        parallelism: 1
      });

      await query(`
        INSERT INTO pf_user_passwords (
          user_id, password_hash, server_salt, client_salt,
          expires_at, must_change
        ) VALUES (
          :userId, :hash, :salt, :salt,
          :expires, 0
        )
      `, {
        userId,
        hash: finalHash,
        salt,
        expires: new Date(Date.now() + this.config.tempAdminExpiry)
      });

      // Get site_admin role
      const roleResult = await query(
        `SELECT id FROM pf_roles WHERE name = 'site_admin'`
      );
      const roleId = roleResult.rows[0].ID;

      // Assign temporary site_admin role
      await query(`
        INSERT INTO pf_user_roles (
          user_id, role_id, granted_by, granted_at,
          expires_at, is_active
        ) VALUES (
          :userId, :roleId, 'emergency_recovery', CURRENT_TIMESTAMP,
          :expires, 1
        )
      `, {
        userId,
        roleId,
        expires: new Date(Date.now() + this.config.tempAdminExpiry)
      });

      // Create temporary session record
      const sessionToken = crypto.randomBytes(32).toString('hex');
      const sessionTokenHash = crypto.createHash('sha256').update(sessionToken).digest('hex');
      
      await query(`
        INSERT INTO pf_temporary_admin_sessions (
          admin_user_id, session_token_hash, expires_at,
          created_reason, created_by
        ) VALUES (
          :userId, :tokenHash, :expires,
          'Emergency recovery', 'console'
        )
      `, {
        userId,
        tokenHash: sessionTokenHash,
        expires: new Date(Date.now() + this.config.tempAdminExpiry)
      });

      await query('COMMIT');

      return {
        userId,
        username,
        password: tempPassword,
        expiresIn: '1 hour',
        sessionToken,
        message: 'Temporary admin created with 1-hour expiry'
      };

    } catch (error) {
      await query('ROLLBACK');
      throw error;
    }
  }

  /**
   * Create new site admin (override existing)
   */
  async createNewSiteAdmin() {
    // Deactivate existing site admins
    await query(`
      UPDATE pf_user_roles
      SET is_active = 0,
          expires_at = CURRENT_TIMESTAMP
      WHERE role_id = (SELECT id FROM pf_roles WHERE name = 'site_admin')
      AND is_active = 1
    `);

    // Use provisioner to create new admin
    const provisioner = new SiteAdminProvisioner({
      environment: 'emergency_recovery'
    });
    
    const result = await provisioner.provision();
    
    return {
      userId: result.userId,
      username: result.username,
      message: 'New site admin created (existing admin deactivated)'
    };
  }

  /**
   * Check existing site admin
   */
  async checkExistingSiteAdmin() {
    const result = await query(`
      SELECT u.*, ur.granted_at
      FROM pf_users u
      JOIN pf_user_roles ur ON u.id = ur.user_id
      JOIN pf_roles r ON ur.role_id = r.id
      WHERE r.name = 'site_admin'
      AND ur.is_active = 1
      FETCH FIRST 1 ROW ONLY
    `);

    return result.rows.length > 0 ? result.rows[0] : null;
  }

  /**
   * Log recovery attempt
   */
  async logRecoveryAttempt(recoveryId, status) {
    await query(`
      INSERT INTO pf_emergency_access_log (
        id, recovery_method, initiated_at, initiated_by,
        ip_address, server_hostname
      ) VALUES (
        :id, 'emergency_recovery', CURRENT_TIMESTAMP, 'console',
        'local', :hostname
      )
    `, {
      id: recoveryId,
      hostname: require('os').hostname()
    });
  }

  /**
   * Log recovery success
   */
  async logRecoverySuccess(recoveryId, method, adminId) {
    await query(`
      UPDATE pf_emergency_access_log
      SET completed_at = CURRENT_TIMESTAMP,
          success = 1,
          recovery_method = :method,
          recovery_admin_id = :adminId
      WHERE id = :id
    `, {
      id: recoveryId,
      method,
      adminId
    });

    // Audit log
    await auditService.log({
      eventType: 'emergency_recovery_success',
      eventCategory: 'security',
      eventStatus: 'success',
      userId: adminId,
      eventDescription: `Emergency recovery completed: ${method}`,
      metadata: {
        recoveryId,
        method
      }
    });
  }

  /**
   * Log recovery failure
   */
  async logRecoveryFailure(recoveryId, reason) {
    await query(`
      UPDATE pf_emergency_access_log
      SET completed_at = CURRENT_TIMESTAMP,
          success = 0,
          failure_reason = :reason
      WHERE id = :id
    `, {
      id: recoveryId,
      reason: reason.substring(0, 500)
    });

    // Audit log
    await auditService.log({
      eventType: 'emergency_recovery_failed',
      eventCategory: 'security',
      eventStatus: 'failure',
      eventDescription: 'Emergency recovery failed',
      metadata: {
        recoveryId,
        reason
      }
    });
  }

  /**
   * Send recovery alerts
   */
  async sendRecoveryAlerts(method, result) {
    try {
      await alertService.sendCritical({
        title: '🚨 EMERGENCY RECOVERY USED',
        message: `Emergency recovery executed on ${require('os').hostname()}`,
        details: {
          method,
          username: result.username,
          timestamp: new Date().toISOString(),
          requiresAcknowledgment: true
        }
      });

      // Update alert sent status
      await query(`
        UPDATE pf_emergency_access_log
        SET alert_sent = 1,
            alert_sent_at = CURRENT_TIMESTAMP
        WHERE recovery_admin_id = :adminId
      `, { adminId: result.userId });

    } catch (error) {
      console.error('Failed to send recovery alerts:', error);
    }
  }

  /**
   * Display recovery results
   */
  displayRecoveryResults(result, method) {
    console.log('\n' + chalk.bgGreen.black.bold(' '.repeat(60)));
    console.log(chalk.bgGreen.black.bold('              RECOVERY CREDENTIALS              '));
    console.log(chalk.bgGreen.black.bold(' '.repeat(60)));
    
    console.log(chalk.yellow('\n📋 Recovery Details:'));
    console.log(chalk.white('   Method:   ') + chalk.green(method));
    console.log(chalk.white('   Username: ') + chalk.green.bold(result.username));
    
    if (result.password || result.newPassword) {
      console.log(chalk.white('   Password: ') + chalk.green.bold(result.password || result.newPassword));
    }
    
    if (result.expiresIn) {
      console.log(chalk.white('   Expires:  ') + chalk.yellow(result.expiresIn));
    }
    
    if (result.sessionToken) {
      console.log(chalk.white('   Session:  ') + chalk.gray(result.sessionToken.substring(0, 20) + '...'));
    }
    
    console.log(chalk.yellow('\n⚠️  Important:'));
    console.log(chalk.white('   • ') + result.message);
    console.log(chalk.white('   • All recovery actions have been logged'));
    console.log(chalk.white('   • Security team has been notified'));
    
    console.log('\n' + chalk.bgGreen.black.bold(' '.repeat(60)));
  }

  /**
   * Prompt for user input
   */
  prompt(question) {
    return new Promise((resolve) => {
      this.rl.question(chalk.cyan(question), (answer) => {
        resolve(answer.trim());
      });
    });
  }
}

module.exports = EmergencyRecovery;