---
name: Security Feature
about: Implement security-related features or improvements
title: 'feat: [Security] Implement site admin provisioning during deployment'
labels: security, deployment, priority:critical, authentication
assignees: ''

---

## 📋 Description
Create an automated site admin provisioning system that runs during initial deployment. The system generates a cryptographically secure temporary password, displays it once during deployment, and requires immediate password change on first login. Includes emergency recovery mechanisms for system lockout scenarios.

## 🎯 Acceptance Criteria
- [ ] Site admin username read from environment configuration
- [ ] System generates cryptographically secure password (16+ characters)
- [ ] Password displayed ONCE in deployment console with clear formatting
- [ ] Password meets maximum complexity requirements
- [ ] First login forces immediate password change
- [ ] Prevents multiple site admin provisioning attempts
- [ ] Provisioning status check available
- [ ] Emergency recovery mechanism implemented
- [ ] Provisioning process fully audit logged
- [ ] Automated alerts for site admin creation
- [ ] Backup recovery codes generated and displayed

## 🔒 Security Considerations
- **Impact on existing security**: Establishes root-level access control
- **New vulnerabilities mitigated**:
  - Prevents unauthorized site admin creation
  - Eliminates default/weak admin passwords
  - Provides audit trail for admin provisioning
  - Emergency recovery without compromising security
- **Compliance requirements**:
  - HIPAA: Administrative safeguards for system access
  - SOC2: Privileged access management
  - ISO 27001: Access control provisioning

## 📊 Technical Implementation

### Provisioning Script
```javascript
// backend/src/scripts/provision-site-admin.js
const crypto = require('crypto');
const argon2 = require('argon2');
const qrcode = require('qrcode');
const speakeasy = require('speakeasy');

class SiteAdminProvisioner {
  constructor(db, config) {
    this.db = db;
    this.config = config;
    this.auditLogger = new AuditLogger();
  }

  async provision() {
    console.log('\n========================================');
    console.log('   PATHFINDER SITE ADMIN PROVISIONING   ');
    console.log('========================================\n');

    try {
      // Check if site admin already exists
      const existingAdmin = await this.checkExistingSiteAdmin();
      if (existingAdmin) {
        console.error('❌ Site admin already exists!');
        console.log(`   Username: ${existingAdmin.username}`);
        console.log(`   Created: ${existingAdmin.created_at}`);
        console.log('\nUse emergency recovery if locked out.');
        process.exit(1);
      }

      // Get username from environment
      const username = process.env.SITE_ADMIN_USERNAME || 'siteadmin';
      console.log(`📝 Creating site admin: ${username}`);

      // Generate secure temporary password
      const tempPassword = this.generateSecurePassword();
      
      // Generate recovery codes
      const recoveryCodes = this.generateRecoveryCodes();
      
      // Generate MFA secret
      const mfaSecret = speakeasy.generateSecret({
        name: `Pathfinder (${username})`,
        issuer: 'Pathfinder'
      });

      // Create the site admin user
      const userId = await this.createSiteAdmin(
        username,
        tempPassword,
        recoveryCodes,
        mfaSecret
      );

      // Generate QR code for MFA
      const qrCodeUrl = await qrcode.toDataURL(mfaSecret.otpauth_url);

      // Display credentials
      this.displayCredentials(
        username,
        tempPassword,
        recoveryCodes,
        mfaSecret.base32,
        qrCodeUrl
      );

      // Audit log the creation
      await this.auditLogger.log({
        action: 'site_admin_provisioned',
        user_id: userId,
        username: username,
        ip_address: 'system',
        timestamp: new Date(),
        details: {
          provisioning_method: 'deployment_script',
          mfa_enabled: true,
          recovery_codes_generated: recoveryCodes.length
        }
      });

      // Send alert if configured
      await this.sendProvisioningAlert(username);

      console.log('\n✅ Site admin provisioned successfully!');
      console.log('⚠️  IMPORTANT: Save these credentials immediately!');
      console.log('    They will not be shown again.\n');

      process.exit(0);

    } catch (error) {
      console.error('❌ Provisioning failed:', error.message);
      await this.auditLogger.log({
        action: 'site_admin_provisioning_failed',
        error: error.message,
        timestamp: new Date()
      });
      process.exit(1);
    }
  }

  generateSecurePassword() {
    const length = 20; // Exceed minimum requirements
    const charset = {
      uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
      lowercase: 'abcdefghijklmnopqrstuvwxyz',
      numbers: '0123456789',
      special: '!@#$%^&*()_+-=[]{}|;:,.<>?'
    };
    
    let password = '';
    
    // Ensure at least 3 characters from each category
    Object.values(charset).forEach(chars => {
      for (let i = 0; i < 3; i++) {
        password += chars[crypto.randomInt(0, chars.length)];
      }
    });
    
    // Fill remaining with random mix
    const allChars = Object.values(charset).join('');
    while (password.length < length) {
      password += allChars[crypto.randomInt(0, allChars.length)];
    }
    
    // Shuffle using Fisher-Yates
    const arr = password.split('');
    for (let i = arr.length - 1; i > 0; i--) {
      const j = crypto.randomInt(0, i + 1);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    
    return arr.join('');
  }

  generateRecoveryCodes() {
    const codes = [];
    for (let i = 0; i < 10; i++) {
      const code = crypto.randomBytes(4).toString('hex').toUpperCase();
      codes.push(`${code.slice(0, 4)}-${code.slice(4, 8)}`);
    }
    return codes;
  }

  displayCredentials(username, password, recoveryCodes, mfaSecret, qrCode) {
    console.log('\n' + '='.repeat(60));
    console.log('         SITE ADMIN CREDENTIALS - SAVE IMMEDIATELY');
    console.log('='.repeat(60));
    
    console.log('\n📌 LOGIN CREDENTIALS:');
    console.log('   Username: ' + username);
    console.log('   Password: ' + password);
    console.log('   URL:      ' + (process.env.APP_URL || 'http://localhost:3000'));
    
    console.log('\n🔐 MULTI-FACTOR AUTHENTICATION:');
    console.log('   Secret Key: ' + mfaSecret);
    console.log('   Setup URL:  Use QR code below or enter secret manually');
    
    console.log('\n📱 QR CODE FOR MFA APP:');
    console.log(qrCode);
    
    console.log('\n🔑 RECOVERY CODES (SINGLE USE):');
    recoveryCodes.forEach((code, index) => {
      if (index % 2 === 0) {
        process.stdout.write(`   ${(index + 1).toString().padStart(2, '0')}. ${code.padEnd(12)}`);
      } else {
        console.log(`   ${(index + 1).toString().padStart(2, '0')}. ${code}`);
      }
    });
    if (recoveryCodes.length % 2 !== 0) console.log();
    
    console.log('\n⚠️  SECURITY REQUIREMENTS:');
    console.log('   • Password expires in: 24 hours');
    console.log('   • Must change password on first login');
    console.log('   • MFA is MANDATORY for site admin');
    console.log('   • Store recovery codes in secure location');
    
    console.log('\n' + '='.repeat(60));
  }

  async createSiteAdmin(username, password, recoveryCodes, mfaSecret) {
    // Hash password
    const salt = crypto.randomBytes(32).toString('hex');
    const passwordHash = await argon2.hash(password + salt, {
      type: argon2.argon2id,
      memoryCost: 2 ** 16,
      timeCost: 3,
      parallelism: 1,
    });

    // Start transaction
    await this.db.beginTransaction();

    try {
      // Create user
      const userId = crypto.randomUUID();
      await this.db.query(`
        INSERT INTO pf_users (
          id, username, email, password_hash, 
          email_verified, is_active, created_at
        ) VALUES (?, ?, ?, ?, 1, 1, CURRENT_TIMESTAMP)
      `, [userId, username, `${username}@localhost`, passwordHash]);

      // Assign site_admin role
      await this.db.query(`
        INSERT INTO pf_user_roles (
          user_id, role_name, granted_at, is_active
        ) VALUES (?, 'site_admin', CURRENT_TIMESTAMP, 1)
      `, [userId]);

      // Store password with expiry
      await this.db.query(`
        INSERT INTO pf_user_passwords (
          user_id, password_hash, server_salt, client_salt,
          expires_at, must_change
        ) VALUES (?, ?, ?, 'initial', ?, 1)
      `, [userId, passwordHash, salt, 
          new Date(Date.now() + 24*60*60*1000)]);

      // Store recovery codes (hashed)
      for (const code of recoveryCodes) {
        const codeHash = crypto.createHash('sha256').update(code).digest('hex');
        await this.db.query(`
          INSERT INTO pf_recovery_codes (
            user_id, code_hash, created_at
          ) VALUES (?, ?, CURRENT_TIMESTAMP)
        `, [userId, codeHash]);
      }

      // Store MFA secret (encrypted)
      const encryptedSecret = await this.encryptData(mfaSecret.base32);
      await this.db.query(`
        INSERT INTO pf_mfa_settings (
          user_id, mfa_enabled, mfa_type, secret_encrypted
        ) VALUES (?, 1, 'totp', ?)
      `, [userId, encryptedSecret]);

      await this.db.commit();
      return userId;

    } catch (error) {
      await this.db.rollback();
      throw error;
    }
  }
}

// Emergency Recovery Mechanism
class EmergencyRecovery {
  async initiateRecovery() {
    console.log('\n🚨 EMERGENCY RECOVERY MODE 🚨');
    
    // Require physical server access
    if (!this.hasPhysicalAccess()) {
      throw new Error('Emergency recovery requires physical server access');
    }

    // Generate recovery challenge
    const challenge = crypto.randomBytes(32).toString('hex');
    console.log('\nRecovery Challenge:', challenge);
    console.log('Enter this challenge into the recovery tool...');

    // Require 2FA from recovery device
    const recoveryToken = await this.get2FAToken();
    
    // Validate recovery attempt
    if (await this.validateRecovery(challenge, recoveryToken)) {
      // Create temporary site admin
      const tempAdmin = await this.createTemporarySiteAdmin();
      
      // Log emergency access
      await this.auditLogger.criticalAlert({
        action: 'emergency_recovery_used',
        timestamp: new Date(),
        recovery_admin: tempAdmin.username
      });

      console.log('\n✅ Emergency recovery successful');
      console.log(`Temporary admin created: ${tempAdmin.username}`);
      console.log(`Expires in: 1 hour`);
      
      return tempAdmin;
    }
    
    throw new Error('Emergency recovery validation failed');
  }

  hasPhysicalAccess() {
    // Check if running from console (not network request)
    return process.stdin.isTTY && !process.env.SSH_CLIENT;
  }

  async createTemporarySiteAdmin() {
    const username = `recovery_${Date.now()}`;
    const password = this.generateSecurePassword();
    
    // Create with 1-hour expiry
    const userId = await this.createSiteAdmin(username, password, [], null);
    
    await this.db.query(`
      UPDATE pf_user_roles 
      SET expires_at = ?
      WHERE user_id = ? AND role_name = 'site_admin'
    `, [new Date(Date.now() + 60*60*1000), userId]);

    return { username, password, userId };
  }
}
```

### Database Schema
```sql
-- Recovery codes table
CREATE TABLE pf_recovery_codes (
    id VARCHAR2(36) PRIMARY KEY,
    user_id VARCHAR2(36) NOT NULL,
    code_hash VARCHAR2(255) NOT NULL,
    used_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES pf_users(id) ON DELETE CASCADE
);

-- Emergency access log
CREATE TABLE pf_emergency_access_log (
    id VARCHAR2(36) PRIMARY KEY,
    recovery_method VARCHAR2(50),
    initiated_at TIMESTAMP NOT NULL,
    completed_at TIMESTAMP,
    success NUMBER(1),
    recovery_admin_id VARCHAR2(36),
    challenge_token VARCHAR2(255),
    ip_address VARCHAR2(45),
    alert_sent NUMBER(1) DEFAULT 0,
    FOREIGN KEY (recovery_admin_id) REFERENCES pf_users(id)
);
```

### Deployment Configuration
```yaml
# docker-compose.yml
services:
  backend:
    environment:
      - SITE_ADMIN_USERNAME=${SITE_ADMIN_USERNAME:-siteadmin}
      - ENABLE_SITE_ADMIN_PROVISIONING=true
      - PROVISIONING_ALERT_EMAIL=${ALERT_EMAIL}
      - PROVISIONING_ALERT_WEBHOOK=${ALERT_WEBHOOK}
      - EMERGENCY_RECOVERY_ENABLED=true
      - RECOVERY_2FA_REQUIRED=true

# Kubernetes ConfigMap
apiVersion: v1
kind: ConfigMap
metadata:
  name: pathfinder-provisioning
data:
  site_admin_username: "siteadmin"
  provisioning_enabled: "true"
  recovery_enabled: "true"
  alert_webhook_url: "https://alerts.company.com/webhook"
```

### Monitoring & Alerts
```javascript
// backend/src/monitoring/adminAlerts.js
class AdminProvisioningMonitor {
  async monitorProvisioning() {
    // Check for provisioning attempts
    const attempts = await db.query(`
      SELECT * FROM pf_audit_log 
      WHERE action LIKE 'site_admin%'
      AND created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)
    `);

    if (attempts.length > 0) {
      await this.sendAlert({
        level: 'CRITICAL',
        message: 'Site admin provisioning activity detected',
        details: attempts,
        channels: ['email', 'slack', 'pagerduty']
      });
    }

    // Check for emergency recovery usage
    const recoveries = await db.query(`
      SELECT * FROM pf_emergency_access_log
      WHERE initiated_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)
    `);

    if (recoveries.length > 0) {
      await this.sendCriticalAlert({
        message: 'EMERGENCY RECOVERY USED',
        require_acknowledgment: true
      });
    }
  }

  async detectAnomalies() {
    // Multiple failed provisioning attempts
    const failedAttempts = await this.getFailedProvisioningAttempts();
    if (failedAttempts > 3) {
      await this.lockdownSystem('Multiple provisioning failures detected');
    }

    // Concurrent site admin sessions
    const adminSessions = await this.getActiveSiteAdminSessions();
    if (adminSessions > 1) {
      await this.alertSecurityTeam('Multiple site admin sessions detected');
    }
  }
}
```

## 🧪 Testing Requirements
- [ ] Unit tests for password generation (entropy, complexity)
- [ ] Unit tests for recovery code generation
- [ ] Integration tests for provisioning flow
- [ ] Integration tests for emergency recovery
- [ ] Security tests for provisioning protection
- [ ] Load tests for concurrent provisioning attempts
- [ ] E2E tests for first login flow
- [ ] Disaster recovery drill tests

### Test Scenarios
```javascript
describe('Site Admin Provisioning', () => {
  test('Prevents multiple site admin provisioning', async () => {
    await provisionSiteAdmin();
    await expect(provisionSiteAdmin()).rejects.toThrow('already exists');
  });

  test('Generated password meets complexity requirements', () => {
    const pwd = generateSecurePassword();
    expect(pwd.length).toBeGreaterThanOrEqual(20);
    expect(pwd).toMatch(/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/);
    expect(calculateEntropy(pwd)).toBeGreaterThan(100);
  });

  test('Emergency recovery requires physical access', async () => {
    process.env.SSH_CLIENT = 'remote';
    await expect(emergencyRecovery()).rejects.toThrow('physical server access');
  });

  test('Recovery codes are single-use', async () => {
    const code = recoveryCodes[0];
    await useRecoveryCode(code);
    await expect(useRecoveryCode(code)).rejects.toThrow('Already used');
  });

  test('Temporary admin expires after 1 hour', async () => {
    const tempAdmin = await createTemporarySiteAdmin();
    jest.advanceTimersByTime(61 * 60 * 1000);
    await expect(authenticate(tempAdmin)).rejects.toThrow('Role expired');
  });
});
```

## 📚 Documentation Updates
- [ ] Create provisioning runbook
- [ ] Document emergency recovery procedures
- [ ] Add security incident response plan
- [ ] Create training materials for site admins
- [ ] Document monitoring and alerting setup
- [ ] Add disaster recovery procedures
- [ ] Create compliance documentation

## ⚠️ Breaking Changes
None - This is initial provisioning functionality.

## 🔗 Dependencies
- Depends on: 
  - #8 (RBAC system for site_admin role)
  - #9 (Password system for secure storage)
- Blocks:
  - Initial production deployment
  - Admin user creation

## 📈 Success Metrics
- **Security Metrics:**
  - Zero unauthorized site admin creations
  - 100% of provisioning attempts logged
  - All emergency recoveries tracked
  - Password complexity score > 100 bits entropy
  
- **Operational Metrics:**
  - Provisioning completion < 30 seconds
  - First login success rate > 95%
  - Recovery mechanism tested monthly
  - Zero lockout incidents without recovery
  
- **Compliance Metrics:**
  - Audit trail for all admin access
  - MFA adoption rate: 100% for site admins
  - Recovery drill success rate: 100%

## 🏃 Implementation Checklist

### Backend Tasks:
- [ ] Create provisioning script
- [ ] Implement password generation with maximum entropy
- [ ] Create recovery code system
- [ ] Implement emergency recovery mechanism
- [ ] Add MFA setup during provisioning
- [ ] Create provisioning status check endpoint
- [ ] Implement comprehensive audit logging

### DevOps Tasks:
- [ ] Add provisioning to deployment pipeline
- [ ] Configure monitoring and alerting
- [ ] Set up emergency recovery procedures
- [ ] Create backup access methods
- [ ] Document runbook procedures
- [ ] Set up security alerts

### Security Tasks:
- [ ] Penetration test provisioning process
- [ ] Test emergency recovery procedures
- [ ] Validate password entropy
- [ ] Audit log analysis setup
- [ ] Incident response plan
- [ ] Regular recovery drills

---

**Estimated Effort**: 5 story points
**Sprint**: 1 (Critical Security)
**Target Completion**: Week 1
**Risk Level**: Critical - Blocks all system access if failed