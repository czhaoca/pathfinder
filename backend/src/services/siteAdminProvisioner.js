const crypto = require('crypto');
const argon2 = require('argon2');
const qrcode = require('qrcode');
const speakeasy = require('speakeasy');
const chalk = require('chalk');
const { v4: uuidv4 } = require('uuid');
const { query } = require('../database/connection');
const auditService = require('./auditService');
const { encrypt } = require('./encryptionService');
const alertService = require('./alertService');

class SiteAdminProvisioner {
  constructor(config = {}) {
    this.config = {
      passwordLength: config.passwordLength || 20,
      recoveryCodeCount: config.recoveryCodeCount || 10,
      tempPasswordExpiry: config.tempPasswordExpiry || 24 * 60 * 60 * 1000, // 24 hours
      mfaRequired: config.mfaRequired !== false, // Default true
      alertsEnabled: config.alertsEnabled !== false,
      environment: config.environment || process.env.NODE_ENV || 'development',
      ...config
    };
  }

  /**
   * Main provisioning method
   */
  async provision() {
    console.log('\n' + '='.repeat(60));
    console.log(chalk.cyan.bold('   PATHFINDER SITE ADMIN PROVISIONING'));
    console.log('='.repeat(60) + '\n');

    const startTime = Date.now();
    let provisioningId = null;
    let userId = null;

    try {
      // Step 1: Validate provisioning can proceed
      console.log(chalk.yellow('📋 Checking provisioning requirements...'));
      const validation = await this.validateProvisioning();
      
      if (!validation.canProceed) {
        throw new Error(validation.message);
      }

      // Step 2: Get username from environment
      const username = process.env.SITE_ADMIN_USERNAME || 'siteadmin';
      const email = process.env.SITE_ADMIN_EMAIL || `${username}@localhost`;
      
      console.log(chalk.green(`✓ Username: ${username}`));
      console.log(chalk.green(`✓ Email: ${email}`));

      // Step 3: Start provisioning record
      provisioningId = await this.startProvisioningRecord(username);

      // Step 4: Generate secure credentials
      console.log(chalk.yellow('\n🔐 Generating secure credentials...'));
      const tempPassword = this.generateSecurePassword();
      const recoveryCodes = this.generateRecoveryCodes();
      
      // Step 5: Generate MFA secret
      let mfaSecret = null;
      let qrCodeData = null;
      
      if (this.config.mfaRequired) {
        console.log(chalk.yellow('🔑 Setting up multi-factor authentication...'));
        mfaSecret = speakeasy.generateSecret({
          name: `Pathfinder (${username})`,
          issuer: 'Pathfinder',
          length: 32
        });
        
        // Generate QR code
        try {
          qrCodeData = await qrcode.toDataURL(mfaSecret.otpauth_url);
        } catch (err) {
          console.warn(chalk.yellow('⚠️  Could not generate QR code:', err.message));
        }
      }

      // Step 6: Create the site admin user
      console.log(chalk.yellow('\n👤 Creating site admin user...'));
      userId = await this.createSiteAdmin({
        username,
        email,
        tempPassword,
        recoveryCodes,
        mfaSecret
      });

      // Step 7: Display credentials
      console.log(chalk.green('\n✅ Site admin created successfully!\n'));
      await this.displayCredentials({
        username,
        tempPassword,
        recoveryCodes,
        mfaSecret,
        qrCodeData,
        email
      });

      // Step 8: Update provisioning record
      await this.completeProvisioningRecord(provisioningId, userId, recoveryCodes.length);

      // Step 9: Audit log
      await auditService.log({
        eventType: 'site_admin_provisioned',
        eventCategory: 'security',
        userId,
        eventDescription: 'Site admin provisioned during deployment',
        metadata: {
          username,
          environment: this.config.environment,
          mfaEnabled: this.config.mfaRequired,
          recoveryCodesGenerated: recoveryCodes.length,
          provisioningId,
          duration: Date.now() - startTime
        }
      });

      // Step 10: Send alerts
      if (this.config.alertsEnabled) {
        await this.sendProvisioningAlerts(username, userId);
      }

      console.log(chalk.cyan.bold('\n' + '='.repeat(60)));
      console.log(chalk.cyan.bold('   PROVISIONING COMPLETE'));
      console.log(chalk.cyan.bold('='.repeat(60) + '\n'));

      return {
        success: true,
        userId,
        username,
        provisioningId
      };

    } catch (error) {
      console.error(chalk.red('\n❌ Provisioning failed:'), error.message);
      
      // Rollback if needed
      if (provisioningId) {
        await this.rollbackProvisioning(provisioningId, error.message);
      }

      // Audit log failure
      await auditService.log({
        eventType: 'site_admin_provisioning_failed',
        eventCategory: 'security',
        eventStatus: 'failure',
        eventDescription: 'Site admin provisioning failed',
        metadata: {
          error: error.message,
          environment: this.config.environment,
          duration: Date.now() - startTime
        }
      });

      throw error;
    }
  }

  /**
   * Validate that provisioning can proceed
   */
  async validateProvisioning() {
    // Check if site admin already exists
    const existingAdmin = await this.checkExistingSiteAdmin();
    if (existingAdmin) {
      return {
        canProceed: false,
        message: `Site admin already exists: ${existingAdmin.username} (created: ${existingAdmin.created_at})`
      };
    }

    // Check for pending provisioning
    const pendingProvisioning = await query(`
      SELECT * FROM pf_site_admin_provisioning
      WHERE provisioning_status IN ('pending', 'in_progress')
      AND started_at > CURRENT_TIMESTAMP - INTERVAL '1' HOUR
    `);

    if (pendingProvisioning.rows.length > 0) {
      return {
        canProceed: false,
        message: 'Another provisioning process is already in progress'
      };
    }

    return {
      canProceed: true,
      message: 'Provisioning can proceed'
    };
  }

  /**
   * Check if site admin already exists
   */
  async checkExistingSiteAdmin() {
    const result = await query(`
      SELECT u.id, u.username, u.created_at
      FROM pf_users u
      JOIN pf_user_roles ur ON u.id = ur.user_id
      JOIN pf_roles r ON ur.role_id = r.id
      WHERE r.name = 'site_admin'
      AND ur.is_active = 1
      AND u.status = 'active'
      FETCH FIRST 1 ROW ONLY
    `);

    return result.rows.length > 0 ? result.rows[0] : null;
  }

  /**
   * Generate cryptographically secure password
   */
  generateSecurePassword() {
    const length = this.config.passwordLength;
    const charset = {
      uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
      lowercase: 'abcdefghijklmnopqrstuvwxyz',
      numbers: '0123456789',
      special: '!@#$%^&*()_+-=[]{}|;:,.<>?'
    };
    
    let password = '';
    
    // Ensure at least 3 characters from each category for maximum complexity
    Object.values(charset).forEach(chars => {
      for (let i = 0; i < 3; i++) {
        const randomIndex = crypto.randomInt(0, chars.length);
        password += chars[randomIndex];
      }
    });
    
    // Fill remaining length with random characters
    const allChars = Object.values(charset).join('');
    while (password.length < length) {
      const randomIndex = crypto.randomInt(0, allChars.length);
      password += allChars[randomIndex];
    }
    
    // Shuffle password using Fisher-Yates algorithm
    const passwordArray = password.split('');
    for (let i = passwordArray.length - 1; i > 0; i--) {
      const j = crypto.randomInt(0, i + 1);
      [passwordArray[i], passwordArray[j]] = [passwordArray[j], passwordArray[i]];
    }
    
    return passwordArray.join('');
  }

  /**
   * Generate recovery codes
   */
  generateRecoveryCodes() {
    const codes = [];
    for (let i = 0; i < this.config.recoveryCodeCount; i++) {
      const bytes = crypto.randomBytes(4);
      const code = bytes.toString('hex').toUpperCase();
      codes.push(`${code.slice(0, 4)}-${code.slice(4, 8)}`);
    }
    return codes;
  }

  /**
   * Start provisioning record
   */
  async startProvisioningRecord(username) {
    const provisioningId = uuidv4();
    
    await query(`
      INSERT INTO pf_site_admin_provisioning (
        id, provisioning_status, provisioned_username,
        provisioning_method, started_at, deployment_environment,
        deployment_version, deployed_by
      ) VALUES (
        :id, 'in_progress', :username,
        'deployment_script', CURRENT_TIMESTAMP, :environment,
        :version, :deployedBy
      )
    `, {
      id: provisioningId,
      username,
      environment: this.config.environment,
      version: process.env.APP_VERSION || 'unknown',
      deployedBy: process.env.DEPLOYED_BY || 'system'
    });

    return provisioningId;
  }

  /**
   * Create site admin user in database
   */
  async createSiteAdmin({ username, email, tempPassword, recoveryCodes, mfaSecret }) {
    const userId = uuidv4();
    
    // Hash the temporary password
    const salt = crypto.randomBytes(32).toString('hex');
    const clientHash = crypto.createHash('sha256')
      .update(tempPassword + salt)
      .digest('hex');
    
    const finalHash = await argon2.hash(clientHash + salt, {
      type: argon2.argon2id,
      memoryCost: 2 ** 16,
      timeCost: 3,
      parallelism: 1
    });

    // Start transaction
    await query('BEGIN');

    try {
      // Create user
      await query(`
        INSERT INTO pf_users (
          id, username, email, first_name, last_name,
          status, email_verified, created_at
        ) VALUES (
          :userId, :username, :email, 'Site', 'Admin',
          'active', 1, CURRENT_TIMESTAMP
        )
      `, {
        userId,
        username,
        email
      });

      // Store password with expiry
      await query(`
        INSERT INTO pf_user_passwords (
          user_id, password_hash, server_salt, client_salt,
          expires_at, must_change, is_temporary, strength_score
        ) VALUES (
          :userId, :passwordHash, :serverSalt, :clientSalt,
          :expiresAt, 1, 1, 100
        )
      `, {
        userId,
        passwordHash: finalHash,
        serverSalt: salt,
        clientSalt: salt,
        expiresAt: new Date(Date.now() + this.config.tempPasswordExpiry)
      });

      // Get site_admin role ID
      const roleResult = await query(
        `SELECT id FROM pf_roles WHERE name = 'site_admin'`
      );
      
      if (roleResult.rows.length === 0) {
        throw new Error('site_admin role not found - ensure RBAC migration has run');
      }
      
      const roleId = roleResult.rows[0].ID;

      // Assign site_admin role
      await query(`
        INSERT INTO pf_user_roles (
          user_id, role_id, granted_by, granted_at, is_active
        ) VALUES (
          :userId, :roleId, 'system', CURRENT_TIMESTAMP, 1
        )
      `, {
        userId,
        roleId
      });

      // Store recovery codes (hashed)
      for (let i = 0; i < recoveryCodes.length; i++) {
        const codeHash = crypto.createHash('sha256')
          .update(recoveryCodes[i])
          .digest('hex');
        
        await query(`
          INSERT INTO pf_recovery_codes (
            user_id, code_hash, code_index, expires_at
          ) VALUES (
            :userId, :codeHash, :codeIndex, :expiresAt
          )
        `, {
          userId,
          codeHash,
          codeIndex: i + 1,
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year
        });
      }

      // Store MFA settings if provided
      if (mfaSecret) {
        const encryptedSecret = await encrypt(mfaSecret.base32, userId);
        
        await query(`
          INSERT INTO pf_mfa_settings (
            user_id, mfa_enabled, mfa_type, secret_encrypted,
            backup_codes_generated, created_at
          ) VALUES (
            :userId, 1, 'totp', :secret,
            1, CURRENT_TIMESTAMP
          )
        `, {
          userId,
          secret: encryptedSecret
        });
      }

      await query('COMMIT');
      return userId;

    } catch (error) {
      await query('ROLLBACK');
      throw error;
    }
  }

  /**
   * Display credentials to console
   */
  async displayCredentials({ username, tempPassword, recoveryCodes, mfaSecret, qrCodeData, email }) {
    console.log('\n' + chalk.bgRed.white.bold(' '.repeat(60)));
    console.log(chalk.bgRed.white.bold('         SITE ADMIN CREDENTIALS - SAVE IMMEDIATELY         '));
    console.log(chalk.bgRed.white.bold(' '.repeat(60)));
    
    console.log(chalk.yellow('\n📌 LOGIN CREDENTIALS:'));
    console.log(chalk.white('   Username: ') + chalk.green.bold(username));
    console.log(chalk.white('   Password: ') + chalk.green.bold(tempPassword));
    console.log(chalk.white('   Email:    ') + chalk.green(email));
    console.log(chalk.white('   URL:      ') + chalk.cyan(process.env.APP_URL || 'http://localhost:3000'));
    
    if (mfaSecret) {
      console.log(chalk.yellow('\n🔐 MULTI-FACTOR AUTHENTICATION:'));
      console.log(chalk.white('   Secret Key: ') + chalk.green.bold(mfaSecret.base32));
      console.log(chalk.white('   Setup:      ') + chalk.gray('Use authenticator app (Google Authenticator, Authy, etc.)'));
      
      if (qrCodeData) {
        console.log(chalk.yellow('\n📱 QR CODE:'));
        console.log(chalk.gray('   Scan with your authenticator app:'));
        // Display QR code in terminal if possible
        const qrImage = qrCodeData.split(',')[1];
        const qrBuffer = Buffer.from(qrImage, 'base64');
        // Note: Actual QR display would require terminal QR library
        console.log(chalk.gray('   [QR Code Data Available - Use authenticator app]'));
      }
    }
    
    console.log(chalk.yellow('\n🔑 RECOVERY CODES (KEEP SAFE):'));
    recoveryCodes.forEach((code, index) => {
      const num = (index + 1).toString().padStart(2, '0');
      if (index % 2 === 0) {
        process.stdout.write(chalk.white(`   ${num}. `) + chalk.green(code.padEnd(12)));
      } else {
        console.log(chalk.white(`  ${num}. `) + chalk.green(code));
      }
    });
    if (recoveryCodes.length % 2 !== 0) console.log();
    
    console.log(chalk.red.bold('\n⚠️  IMPORTANT SECURITY NOTES:'));
    console.log(chalk.white('   • Password expires in: ') + chalk.yellow('24 hours'));
    console.log(chalk.white('   • ') + chalk.yellow('MUST change password on first login'));
    console.log(chalk.white('   • ') + chalk.yellow('MFA is MANDATORY for site admin'));
    console.log(chalk.white('   • ') + chalk.yellow('Store recovery codes in a secure location'));
    console.log(chalk.white('   • ') + chalk.yellow('This information will NOT be shown again'));
    
    console.log('\n' + chalk.bgRed.white.bold(' '.repeat(60)));
    
    // Mark as displayed
    await query(`
      UPDATE pf_site_admin_provisioning
      SET password_displayed = 1,
          password_displayed_at = CURRENT_TIMESTAMP
      WHERE provisioned_username = :username
    `, { username });
  }

  /**
   * Complete provisioning record
   */
  async completeProvisioningRecord(provisioningId, userId, recoveryCodeCount) {
    await query(`
      UPDATE pf_site_admin_provisioning
      SET provisioning_status = 'completed',
          provisioned_user_id = :userId,
          completed_at = CURRENT_TIMESTAMP,
          mfa_configured = :mfaConfigured,
          recovery_codes_generated = :recoveryCodeCount,
          audit_logged = 1
      WHERE id = :provisioningId
    `, {
      provisioningId,
      userId,
      mfaConfigured: this.config.mfaRequired ? 1 : 0,
      recoveryCodeCount
    });
  }

  /**
   * Rollback provisioning on failure
   */
  async rollbackProvisioning(provisioningId, errorMessage) {
    try {
      await query(`
        UPDATE pf_site_admin_provisioning
        SET provisioning_status = 'failed',
            completed_at = CURRENT_TIMESTAMP,
            error_message = :errorMessage,
            rollback_performed = 1,
            rollback_at = CURRENT_TIMESTAMP
        WHERE id = :provisioningId
      `, {
        provisioningId,
        errorMessage: errorMessage.substring(0, 1000)
      });
    } catch (err) {
      console.error('Failed to update provisioning record:', err);
    }
  }

  /**
   * Send provisioning alerts
   */
  async sendProvisioningAlerts(username, userId) {
    try {
      // Get configured alerts
      const alerts = await query(`
        SELECT * FROM pf_provisioning_alerts
        WHERE enabled = 1
      `);

      for (const alert of alerts.rows) {
        const config = JSON.parse(alert.ALERT_CONFIG);
        
        await alertService.send({
          type: alert.ALERT_TYPE,
          config,
          data: {
            event: 'site_admin_provisioned',
            username,
            userId,
            environment: this.config.environment,
            timestamp: new Date().toISOString()
          }
        });
      }

      // Update alert sent status
      await query(`
        UPDATE pf_site_admin_provisioning
        SET alerts_sent = :alerts
        WHERE provisioned_user_id = :userId
      `, {
        userId,
        alerts: JSON.stringify(alerts.rows.map(a => a.ALERT_TYPE))
      });

    } catch (error) {
      console.error('Failed to send provisioning alerts:', error);
    }
  }

  /**
   * Get provisioning status
   */
  async getProvisioningStatus() {
    const result = await query(`
      SELECT * FROM v_provisioning_status
      FETCH FIRST 1 ROW ONLY
    `);

    return result.rows.length > 0 ? result.rows[0] : null;
  }
}

module.exports = SiteAdminProvisioner;