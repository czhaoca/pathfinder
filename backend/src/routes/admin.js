const express = require('express');
const router = express.Router();
const { query } = require('../database/connection');
const { authenticate, requireRole } = require('../middleware/auth');
const auditService = require('../services/auditService');
const SiteAdminProvisioner = require('../services/siteAdminProvisioner');
const EmergencyRecovery = require('../services/emergencyRecovery');

/**
 * GET /admin/provisioning/status
 * Check site admin provisioning status
 */
router.get('/provisioning/status', async (req, res) => {
  try {
    // Check if site admin exists
    const adminExists = await query(`
      SELECT COUNT(*) as count
      FROM pf_users u
      JOIN pf_user_roles ur ON u.id = ur.user_id
      JOIN pf_roles r ON ur.role_id = r.id
      WHERE r.name = 'site_admin'
      AND ur.is_active = 1
      AND u.status = 'active'
    `);

    const hasAdmin = adminExists.rows[0].COUNT > 0;

    // Get provisioning history
    const provisioningHistory = await query(`
      SELECT 
        provisioning_status,
        provisioned_username,
        provisioning_method,
        started_at,
        completed_at,
        first_login_at,
        password_changed_at,
        error_message
      FROM pf_site_admin_provisioning
      ORDER BY started_at DESC
      FETCH FIRST 5 ROWS ONLY
    `);

    // Get emergency recovery attempts
    const recoveryAttempts = await query(`
      SELECT COUNT(*) as count
      FROM pf_emergency_access_log
      WHERE initiated_at > CURRENT_TIMESTAMP - INTERVAL '30' DAY
    `);

    // Get active temporary admins
    const tempAdmins = await query(`
      SELECT COUNT(*) as count
      FROM pf_temporary_admin_sessions
      WHERE expires_at > CURRENT_TIMESTAMP
      AND revoked = 0
    `);

    res.json({
      success: true,
      data: {
        siteAdminExists: hasAdmin,
        canProvision: !hasAdmin,
        provisioningHistory: provisioningHistory.rows,
        recentRecoveryAttempts: parseInt(recoveryAttempts.rows[0].COUNT),
        activeTempAdmins: parseInt(tempAdmins.rows[0].COUNT),
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error checking provisioning status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check provisioning status'
    });
  }
});

/**
 * POST /admin/provisioning/validate
 * Validate if provisioning can proceed
 */
router.post('/provisioning/validate', async (req, res) => {
  try {
    const { username } = req.body;

    // Use stored procedure to validate
    const result = await query(`
      DECLARE
        v_can_proceed NUMBER;
        v_message VARCHAR2(500);
      BEGIN
        validate_provisioning_attempt(:username, v_can_proceed, v_message);
        :can_proceed := v_can_proceed;
        :message := v_message;
      END;
    `, {
      username: username || process.env.SITE_ADMIN_USERNAME || 'siteadmin',
      can_proceed: { dir: 'out', type: 'NUMBER' },
      message: { dir: 'out', type: 'STRING', maxSize: 500 }
    });

    const canProceed = result.outBinds.can_proceed === 1;

    // Audit log the validation attempt
    await auditService.log({
      eventType: 'provisioning_validation',
      eventCategory: 'security',
      eventDescription: 'Site admin provisioning validation',
      metadata: {
        username,
        canProceed,
        message: result.outBinds.message,
        ip: req.ip
      }
    });

    res.json({
      success: true,
      data: {
        canProceed,
        message: result.outBinds.message,
        username: username || process.env.SITE_ADMIN_USERNAME || 'siteadmin'
      }
    });

  } catch (error) {
    console.error('Error validating provisioning:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to validate provisioning'
    });
  }
});

/**
 * GET /admin/recovery/status
 * Get emergency recovery status
 */
router.get('/recovery/status', authenticate, requireRole('site_admin'), async (req, res) => {
  try {
    // Get recent recovery attempts
    const recoveryAttempts = await query(`
      SELECT 
        id,
        recovery_method,
        initiated_at,
        completed_at,
        success,
        failure_reason,
        alert_sent
      FROM pf_emergency_access_log
      WHERE initiated_at > CURRENT_TIMESTAMP - INTERVAL '7' DAY
      ORDER BY initiated_at DESC
    `);

    // Get active temporary admins
    const tempAdmins = await query(`
      SELECT 
        t.id,
        u.username,
        t.created_at,
        t.expires_at,
        t.created_reason,
        t.last_activity
      FROM pf_temporary_admin_sessions t
      JOIN pf_users u ON t.admin_user_id = u.id
      WHERE t.expires_at > CURRENT_TIMESTAMP
      AND t.revoked = 0
    `);

    // Get recovery code status
    const recoveryCodes = await query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN used_at IS NULL THEN 1 END) as unused,
        COUNT(CASE WHEN used_at IS NOT NULL THEN 1 END) as used
      FROM pf_recovery_codes
      WHERE user_id = :userId
    `, { userId: req.user.userId });

    res.json({
      success: true,
      data: {
        recentAttempts: recoveryAttempts.rows,
        activeTemporaryAdmins: tempAdmins.rows,
        recoveryCodeStatus: recoveryCodes.rows[0],
        emergencyRecoveryEnabled: process.env.EMERGENCY_RECOVERY_ENABLED === 'true'
      }
    });

  } catch (error) {
    console.error('Error getting recovery status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get recovery status'
    });
  }
});

/**
 * POST /admin/recovery/revoke-temp-admin
 * Revoke a temporary admin session
 */
router.post('/recovery/revoke-temp-admin', authenticate, requireRole('site_admin'), async (req, res) => {
  try {
    const { sessionId, reason } = req.body;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: 'Session ID is required'
      });
    }

    // Revoke the session
    await query(`
      UPDATE pf_temporary_admin_sessions
      SET revoked = 1,
          revoked_at = CURRENT_TIMESTAMP,
          revoked_by = :revokedBy,
          revoked_reason = :reason
      WHERE id = :sessionId
    `, {
      sessionId,
      revokedBy: req.user.userId,
      reason: reason || 'Manual revocation by site admin'
    });

    // Get the affected admin user
    const session = await query(`
      SELECT admin_user_id FROM pf_temporary_admin_sessions
      WHERE id = :sessionId
    `, { sessionId });

    if (session.rows.length > 0) {
      // Deactivate the user
      await query(`
        UPDATE pf_users
        SET status = 'inactive'
        WHERE id = :userId
      `, { userId: session.rows[0].ADMIN_USER_ID });

      // Invalidate all sessions
      await query(`
        UPDATE pf_user_sessions
        SET is_active = 0
        WHERE user_id = :userId
      `, { userId: session.rows[0].ADMIN_USER_ID });
    }

    // Audit log
    await auditService.log({
      eventType: 'temp_admin_revoked',
      eventCategory: 'security',
      userId: req.user.userId,
      eventDescription: 'Temporary admin session revoked',
      metadata: {
        sessionId,
        reason,
        revokedBy: req.user.username
      }
    });

    res.json({
      success: true,
      message: 'Temporary admin session revoked successfully'
    });

  } catch (error) {
    console.error('Error revoking temp admin:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to revoke temporary admin session'
    });
  }
});

/**
 * GET /admin/recovery/codes
 * Get recovery codes for current admin
 */
router.get('/recovery/codes', authenticate, requireRole('site_admin'), async (req, res) => {
  try {
    const codes = await query(`
      SELECT 
        code_index,
        CASE WHEN used_at IS NULL THEN 'unused' ELSE 'used' END as status,
        used_at,
        expires_at
      FROM pf_recovery_codes
      WHERE user_id = :userId
      ORDER BY code_index
    `, { userId: req.user.userId });

    res.json({
      success: true,
      data: {
        codes: codes.rows,
        totalCodes: codes.rows.length,
        unusedCodes: codes.rows.filter(c => c.STATUS === 'unused').length,
        note: 'Actual recovery codes are not displayed for security. Generate new codes if needed.'
      }
    });

  } catch (error) {
    console.error('Error getting recovery codes:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get recovery codes'
    });
  }
});

/**
 * POST /admin/recovery/generate-codes
 * Generate new recovery codes
 */
router.post('/recovery/generate-codes', authenticate, requireRole('site_admin'), async (req, res) => {
  try {
    const crypto = require('crypto');
    
    // Delete existing unused codes
    await query(`
      DELETE FROM pf_recovery_codes
      WHERE user_id = :userId
      AND used_at IS NULL
    `, { userId: req.user.userId });

    // Generate new codes
    const codes = [];
    for (let i = 0; i < 10; i++) {
      const bytes = crypto.randomBytes(4);
      const code = bytes.toString('hex').toUpperCase();
      const formattedCode = `${code.slice(0, 4)}-${code.slice(4, 8)}`;
      codes.push(formattedCode);
      
      // Store hashed code
      const codeHash = crypto.createHash('sha256').update(formattedCode).digest('hex');
      
      await query(`
        INSERT INTO pf_recovery_codes (
          user_id, code_hash, code_index, expires_at
        ) VALUES (
          :userId, :codeHash, :codeIndex, :expiresAt
        )
      `, {
        userId: req.user.userId,
        codeHash,
        codeIndex: i + 1,
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year
      });
    }

    // Update MFA settings
    await query(`
      UPDATE pf_mfa_settings
      SET backup_codes_generated = 1,
          updated_at = CURRENT_TIMESTAMP
      WHERE user_id = :userId
    `, { userId: req.user.userId });

    // Audit log
    await auditService.log({
      eventType: 'recovery_codes_generated',
      eventCategory: 'security',
      userId: req.user.userId,
      eventDescription: 'New recovery codes generated',
      metadata: {
        codeCount: codes.length
      }
    });

    res.json({
      success: true,
      data: {
        codes,
        message: 'New recovery codes generated. Store them securely.',
        warning: 'These codes will only be shown once!'
      }
    });

  } catch (error) {
    console.error('Error generating recovery codes:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate recovery codes'
    });
  }
});

/**
 * GET /admin/mfa/status
 * Get MFA status for admin
 */
router.get('/mfa/status', authenticate, requireRole('site_admin'), async (req, res) => {
  try {
    const mfaStatus = await query(`
      SELECT 
        mfa_enabled,
        mfa_type,
        backup_codes_generated,
        last_used,
        created_at
      FROM pf_mfa_settings
      WHERE user_id = :userId
    `, { userId: req.user.userId });

    if (mfaStatus.rows.length === 0) {
      return res.json({
        success: true,
        data: {
          mfaEnabled: false,
          mfaConfigured: false
        }
      });
    }

    const status = mfaStatus.rows[0];
    
    res.json({
      success: true,
      data: {
        mfaEnabled: status.MFA_ENABLED === 1,
        mfaType: status.MFA_TYPE,
        backupCodesGenerated: status.BACKUP_CODES_GENERATED === 1,
        lastUsed: status.LAST_USED,
        configuredAt: status.CREATED_AT
      }
    });

  } catch (error) {
    console.error('Error getting MFA status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get MFA status'
    });
  }
});

/**
 * POST /admin/mfa/enable
 * Enable MFA for admin
 */
router.post('/mfa/enable', authenticate, requireRole('site_admin'), async (req, res) => {
  try {
    const speakeasy = require('speakeasy');
    const qrcode = require('qrcode');
    
    // Check if MFA already enabled
    const existing = await query(`
      SELECT mfa_enabled FROM pf_mfa_settings
      WHERE user_id = :userId
    `, { userId: req.user.userId });

    if (existing.rows.length > 0 && existing.rows[0].MFA_ENABLED === 1) {
      return res.status(400).json({
        success: false,
        error: 'MFA is already enabled'
      });
    }

    // Generate secret
    const secret = speakeasy.generateSecret({
      name: `Pathfinder (${req.user.username})`,
      issuer: 'Pathfinder',
      length: 32
    });

    // Generate QR code
    const qrCodeData = await qrcode.toDataURL(secret.otpauth_url);

    // Store encrypted secret
    const { encrypt } = require('../services/encryptionService');
    const encryptedSecret = await encrypt(secret.base32, req.user.userId);

    if (existing.rows.length > 0) {
      // Update existing
      await query(`
        UPDATE pf_mfa_settings
        SET secret_encrypted = :secret,
            mfa_type = 'totp',
            updated_at = CURRENT_TIMESTAMP
        WHERE user_id = :userId
      `, {
        userId: req.user.userId,
        secret: encryptedSecret
      });
    } else {
      // Insert new
      await query(`
        INSERT INTO pf_mfa_settings (
          user_id, mfa_enabled, mfa_type, secret_encrypted
        ) VALUES (
          :userId, 0, 'totp', :secret
        )
      `, {
        userId: req.user.userId,
        secret: encryptedSecret
      });
    }

    res.json({
      success: true,
      data: {
        secret: secret.base32,
        qrCode: qrCodeData,
        message: 'Scan QR code with authenticator app, then verify with a code'
      }
    });

  } catch (error) {
    console.error('Error enabling MFA:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to enable MFA'
    });
  }
});

/**
 * POST /admin/mfa/verify
 * Verify and activate MFA
 */
router.post('/mfa/verify', authenticate, requireRole('site_admin'), async (req, res) => {
  try {
    const { token } = req.body;
    const speakeasy = require('speakeasy');
    
    if (!token || token.length !== 6) {
      return res.status(400).json({
        success: false,
        error: 'Invalid verification code'
      });
    }

    // Get encrypted secret
    const result = await query(`
      SELECT secret_encrypted FROM pf_mfa_settings
      WHERE user_id = :userId
    `, { userId: req.user.userId });

    if (result.rows.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'MFA not configured'
      });
    }

    // Decrypt secret
    const { decrypt } = require('../services/encryptionService');
    const secret = await decrypt(result.rows[0].SECRET_ENCRYPTED, req.user.userId);

    // Verify token
    const verified = speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: 2
    });

    if (!verified) {
      return res.status(400).json({
        success: false,
        error: 'Invalid verification code'
      });
    }

    // Enable MFA
    await query(`
      UPDATE pf_mfa_settings
      SET mfa_enabled = 1,
          last_used = CURRENT_TIMESTAMP
      WHERE user_id = :userId
    `, { userId: req.user.userId });

    // Audit log
    await auditService.log({
      eventType: 'mfa_enabled',
      eventCategory: 'security',
      userId: req.user.userId,
      eventDescription: 'MFA enabled for site admin',
      metadata: {
        mfaType: 'totp'
      }
    });

    res.json({
      success: true,
      message: 'MFA enabled successfully'
    });

  } catch (error) {
    console.error('Error verifying MFA:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify MFA'
    });
  }
});

module.exports = router;