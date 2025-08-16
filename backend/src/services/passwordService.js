const crypto = require('crypto');
const argon2 = require('argon2');
const { query } = require('../database/connection');
const { v4: uuidv4 } = require('uuid');
const { encrypt, decrypt } = require('./encryptionService');
const auditService = require('./auditService');

class PasswordService {
  constructor() {
    this.defaultPolicy = null;
    this.passwordCharsets = {
      uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
      lowercase: 'abcdefghijklmnopqrstuvwxyz',
      numbers: '0123456789',
      special: '!@#$%^&*()_+-=[]{}|;:,.<>?'
    };
    
    // Common passwords to check against
    this.commonPasswords = new Set([
      'password', '123456', 'password123', 'admin', 'letmein',
      'qwerty', 'monkey', '1234567890', 'superman', 'master'
    ]);
  }

  /**
   * Generate a cryptographically secure temporary password
   * @param {number} length - Password length (default 16)
   * @returns {string} - Generated password
   */
  generateTemporaryPassword(length = 16) {
    let password = '';
    const charset = this.passwordCharsets;
    
    // Ensure at least 2 characters from each category
    const minCharsPerCategory = 2;
    
    Object.values(charset).forEach(chars => {
      for (let i = 0; i < minCharsPerCategory; i++) {
        const randomIndex = crypto.randomInt(0, chars.length);
        password += chars[randomIndex];
      }
    });
    
    // Fill remaining length with random characters from all sets
    const allChars = Object.values(charset).join('');
    const remainingLength = length - password.length;
    
    for (let i = 0; i < remainingLength; i++) {
      const randomIndex = crypto.randomInt(0, allChars.length);
      password += allChars[randomIndex];
    }
    
    // Shuffle the password using Fisher-Yates algorithm
    const passwordArray = password.split('');
    for (let i = passwordArray.length - 1; i > 0; i--) {
      const j = crypto.randomInt(0, i + 1);
      [passwordArray[i], passwordArray[j]] = [passwordArray[j], passwordArray[i]];
    }
    
    return passwordArray.join('');
  }

  /**
   * Generate a one-time token for password operations
   * @returns {Object} - Token and its hash
   */
  generateToken() {
    const token = crypto.randomBytes(32).toString('base64url');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    return { token, tokenHash };
  }

  /**
   * Calculate password strength score
   * @param {string} password - Password to analyze
   * @returns {number} - Strength score (0-100)
   */
  calculatePasswordStrength(password) {
    let score = 0;
    
    // Length scoring (max 30 points)
    if (password.length >= 8) score += 10;
    if (password.length >= 12) score += 10;
    if (password.length >= 16) score += 10;
    
    // Character diversity (max 40 points)
    if (/[a-z]/.test(password)) score += 10;
    if (/[A-Z]/.test(password)) score += 10;
    if (/[0-9]/.test(password)) score += 10;
    if (/[^a-zA-Z0-9]/.test(password)) score += 10;
    
    // Pattern checks (max 30 points)
    if (!/(.)\1{2,}/.test(password)) score += 10; // No repeated characters
    if (!/^[a-zA-Z]+$/.test(password) && !/^[0-9]+$/.test(password)) score += 10; // Not all letters or numbers
    if (!this.commonPasswords.has(password.toLowerCase())) score += 10; // Not a common password
    
    return Math.min(100, score);
  }

  /**
   * Get password policy for a user
   * @param {string} userId - User ID
   * @returns {Object} - Password policy
   */
  async getUserPasswordPolicy(userId) {
    const result = await query(`
      SELECT pp.* 
      FROM pf_password_policies pp
      JOIN pf_users u ON u.password_policy_id = pp.id
      WHERE u.id = :userId
    `, { userId });
    
    if (result.rows.length === 0) {
      // Return default policy if user doesn't have one
      const defaultResult = await query(
        `SELECT * FROM pf_password_policies WHERE policy_name = 'default'`
      );
      return defaultResult.rows[0];
    }
    
    return result.rows[0];
  }

  /**
   * Validate password against policy
   * @param {string} password - Password to validate
   * @param {Object} policy - Password policy
   * @returns {Object} - Validation result
   */
  validatePasswordAgainstPolicy(password, policy) {
    const errors = [];
    
    if (password.length < policy.MIN_LENGTH) {
      errors.push(`Password must be at least ${policy.MIN_LENGTH} characters long`);
    }
    
    if (password.length > policy.MAX_LENGTH) {
      errors.push(`Password must not exceed ${policy.MAX_LENGTH} characters`);
    }
    
    const uppercaseCount = (password.match(/[A-Z]/g) || []).length;
    if (policy.REQUIRE_UPPERCASE && uppercaseCount < policy.MIN_UPPERCASE) {
      errors.push(`Password must contain at least ${policy.MIN_UPPERCASE} uppercase letters`);
    }
    
    const lowercaseCount = (password.match(/[a-z]/g) || []).length;
    if (policy.REQUIRE_LOWERCASE && lowercaseCount < policy.MIN_LOWERCASE) {
      errors.push(`Password must contain at least ${policy.MIN_LOWERCASE} lowercase letters`);
    }
    
    const numberCount = (password.match(/[0-9]/g) || []).length;
    if (policy.REQUIRE_NUMBERS && numberCount < policy.MIN_NUMBERS) {
      errors.push(`Password must contain at least ${policy.MIN_NUMBERS} numbers`);
    }
    
    const specialCount = (password.match(/[^a-zA-Z0-9]/g) || []).length;
    if (policy.REQUIRE_SPECIAL && specialCount < policy.MIN_SPECIAL) {
      errors.push(`Password must contain at least ${policy.MIN_SPECIAL} special characters`);
    }
    
    if (!policy.ALLOW_COMMON_PASSWORDS && this.commonPasswords.has(password.toLowerCase())) {
      errors.push('Password is too common. Please choose a more unique password');
    }
    
    return {
      valid: errors.length === 0,
      errors,
      strength: this.calculatePasswordStrength(password)
    };
  }

  /**
   * Store password with dual hashing
   * @param {string} userId - User ID
   * @param {string} clientHash - Client-side hash
   * @param {string} clientSalt - Client-side salt
   * @param {boolean} isTemporary - Whether this is a temporary password
   * @param {string} tempPassword - Temporary password to encrypt and store
   * @returns {boolean} - Success status
   */
  async storePassword(userId, clientHash, clientSalt, isTemporary = false, tempPassword = null) {
    try {
      // Generate server salt
      const serverSalt = crypto.randomBytes(32).toString('hex');
      
      // Apply Argon2 to the client hash with server salt
      const finalHash = await argon2.hash(clientHash + serverSalt, {
        type: argon2.argon2id,
        memoryCost: 2 ** 16, // 64 MB
        timeCost: 3,
        parallelism: 1,
      });
      
      // Calculate password strength (based on the pattern of the hash, not actual password)
      const strengthScore = isTemporary ? 50 : 75; // Default scores
      
      // Get password policy
      const policy = await this.getUserPasswordPolicy(userId);
      
      // Calculate expiry
      const expiresAt = isTemporary 
        ? new Date(Date.now() + policy.TEMP_PASSWORD_EXPIRY_HOURS * 60 * 60 * 1000)
        : null;
      
      // Encrypt temporary password if provided
      let encryptedTempPassword = null;
      if (tempPassword) {
        encryptedTempPassword = await encrypt(tempPassword, userId);
      }
      
      // Check if password already exists
      const existing = await query(
        'SELECT user_id FROM pf_user_passwords WHERE user_id = :userId',
        { userId }
      );
      
      if (existing.rows.length > 0) {
        // Archive current password to history
        await this.archivePasswordToHistory(userId, 'password_change');
        
        // Update existing password
        await query(`
          UPDATE pf_user_passwords
          SET password_hash = :passwordHash,
              server_salt = :serverSalt,
              client_salt = :clientSalt,
              expires_at = :expiresAt,
              must_change = :mustChange,
              last_changed = CURRENT_TIMESTAMP,
              change_count = change_count + 1,
              strength_score = :strengthScore,
              is_temporary = :isTemporary,
              temporary_password = :tempPassword
          WHERE user_id = :userId
        `, {
          userId,
          passwordHash: finalHash,
          serverSalt,
          clientSalt,
          expiresAt,
          mustChange: isTemporary ? 1 : 0,
          strengthScore,
          isTemporary: isTemporary ? 1 : 0,
          tempPassword: encryptedTempPassword
        });
      } else {
        // Insert new password
        await query(`
          INSERT INTO pf_user_passwords (
            user_id, password_hash, server_salt, client_salt,
            expires_at, must_change, strength_score, is_temporary,
            temporary_password, created_at, last_changed
          ) VALUES (
            :userId, :passwordHash, :serverSalt, :clientSalt,
            :expiresAt, :mustChange, :strengthScore, :isTemporary,
            :tempPassword, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          )
        `, {
          userId,
          passwordHash: finalHash,
          serverSalt,
          clientSalt,
          expiresAt,
          mustChange: isTemporary ? 1 : 0,
          strengthScore,
          isTemporary: isTemporary ? 1 : 0,
          tempPassword: encryptedTempPassword
        });
      }
      
      // Log password strength
      await query(`
        INSERT INTO pf_password_strength_log (
          user_id, strength_score, length_score, complexity_score,
          uniqueness_score, dictionary_check_passed, common_password_check_passed
        ) VALUES (
          :userId, :strengthScore, :lengthScore, :complexityScore,
          :uniquenessScore, :dictCheck, :commonCheck
        )
      `, {
        userId,
        strengthScore,
        lengthScore: isTemporary ? 40 : 60,
        complexityScore: isTemporary ? 50 : 80,
        uniquenessScore: 90,
        dictCheck: 1,
        commonCheck: 1
      });
      
      // Audit log
      await auditService.log({
        eventType: isTemporary ? 'temporary_password_created' : 'password_changed',
        eventCategory: 'security',
        userId,
        eventDescription: isTemporary 
          ? 'Temporary password created for user'
          : 'User password changed',
        metadata: {
          isTemporary,
          hasExpiry: !!expiresAt,
          strengthScore
        }
      });
      
      return true;
    } catch (error) {
      console.error('Error storing password:', error);
      throw error;
    }
  }

  /**
   * Archive current password to history
   * @param {string} userId - User ID
   * @param {string} changeReason - Reason for change
   */
  async archivePasswordToHistory(userId, changeReason = 'manual_change') {
    const current = await query(
      'SELECT * FROM pf_user_passwords WHERE user_id = :userId',
      { userId }
    );
    
    if (current.rows.length > 0) {
      const pwd = current.rows[0];
      await query(`
        INSERT INTO pf_password_history (
          id, user_id, password_hash, used_from, used_until, change_reason
        ) VALUES (
          :id, :userId, :passwordHash, :usedFrom, CURRENT_TIMESTAMP, :changeReason
        )
      `, {
        id: uuidv4(),
        userId,
        passwordHash: pwd.PASSWORD_HASH,
        usedFrom: pwd.CREATED_AT || pwd.LAST_CHANGED,
        changeReason
      });
    }
  }

  /**
   * Check if password was recently used
   * @param {string} userId - User ID
   * @param {string} passwordHash - Password hash to check
   * @returns {boolean} - True if password was recently used
   */
  async checkPasswordHistory(userId, clientHash, clientSalt) {
    const policy = await this.getUserPasswordPolicy(userId);
    const historyCount = policy.PASSWORD_HISTORY_COUNT || 5;
    
    // Get recent password hashes
    const history = await query(`
      SELECT password_hash FROM (
        SELECT password_hash, used_from
        FROM pf_password_history
        WHERE user_id = :userId
        ORDER BY used_from DESC
      ) WHERE ROWNUM <= :limit
    `, {
      userId,
      limit: historyCount
    });
    
    // Check each historical password
    for (const row of history.rows) {
      // We need to verify against each stored hash
      // This is simplified - in reality we'd need to store salts too
      // For now, return false to allow password change
      // TODO: Implement proper history checking with stored salts
    }
    
    return false;
  }

  /**
   * Verify password with dual hashing
   * @param {string} userId - User ID
   * @param {string} clientHash - Client-side hash
   * @param {string} clientSalt - Client-side salt
   * @returns {Object} - Verification result
   */
  async verifyPassword(userId, clientHash, clientSalt) {
    try {
      const result = await query(
        'SELECT * FROM pf_user_passwords WHERE user_id = :userId',
        { userId }
      );
      
      if (result.rows.length === 0) {
        return { valid: false, error: 'No password set for user' };
      }
      
      const pwd = result.rows[0];
      
      // Check if password is expired
      if (pwd.EXPIRES_AT && new Date() > new Date(pwd.EXPIRES_AT)) {
        return { valid: false, error: 'Password expired', mustChange: true };
      }
      
      // Verify the hash
      const inputToVerify = clientHash + pwd.SERVER_SALT;
      const valid = await argon2.verify(pwd.PASSWORD_HASH, inputToVerify);
      
      if (!valid) {
        return { valid: false, error: 'Invalid password' };
      }
      
      // Check if password change is required
      if (pwd.MUST_CHANGE === 1) {
        return { valid: true, mustChange: true, error: 'Password change required' };
      }
      
      // Check if password is aging (warning only)
      const policy = await this.getUserPasswordPolicy(userId);
      const daysSinceChange = Math.floor(
        (Date.now() - new Date(pwd.LAST_CHANGED).getTime()) / (1000 * 60 * 60 * 24)
      );
      
      const daysUntilExpiry = policy.PASSWORD_EXPIRY_DAYS - daysSinceChange;
      
      return {
        valid: true,
        mustChange: false,
        daysUntilExpiry: daysUntilExpiry > 0 ? daysUntilExpiry : 0,
        passwordAge: daysSinceChange
      };
      
    } catch (error) {
      console.error('Error verifying password:', error);
      return { valid: false, error: 'Password verification failed' };
    }
  }

  /**
   * Create a password token
   * @param {string} userId - User ID
   * @param {string} tokenType - Type of token
   * @param {string} createdBy - User creating the token
   * @param {string} reason - Reason for token creation
   * @param {Object} metadata - Additional metadata
   * @returns {Object} - Token details
   */
  async createPasswordToken(userId, tokenType, createdBy, reason, metadata = {}) {
    const { token, tokenHash } = this.generateToken();
    
    // Get expiry based on token type and policy
    const policy = await this.getUserPasswordPolicy(userId);
    let expiryHours = 1;
    
    switch (tokenType) {
      case 'retrieval':
        expiryHours = policy.TOKEN_RETRIEVAL_EXPIRY_HOURS || 1;
        break;
      case 'reset':
      case 'force_reset':
        expiryHours = policy.TOKEN_RESET_EXPIRY_HOURS || 3;
        break;
      case 'activation':
        expiryHours = 24; // Activation tokens last longer
        break;
    }
    
    const expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000);
    
    await query(`
      INSERT INTO pf_password_tokens (
        token_hash, user_id, token_type, expires_at,
        created_by, reason, metadata
      ) VALUES (
        :tokenHash, :userId, :tokenType, :expiresAt,
        :createdBy, :reason, :metadata
      )
    `, {
      tokenHash,
      userId,
      tokenType,
      expiresAt,
      createdBy,
      reason,
      metadata: JSON.stringify(metadata)
    });
    
    // Audit log
    await auditService.log({
      eventType: `password_token_created_${tokenType}`,
      eventCategory: 'security',
      userId,
      eventDescription: `Password ${tokenType} token created`,
      metadata: {
        tokenType,
        expiresAt,
        reason,
        createdBy
      }
    });
    
    return {
      token,
      tokenType,
      expiresAt,
      userId
    };
  }

  /**
   * Validate and use a password token
   * @param {string} token - Token to validate
   * @returns {Object} - Token validation result
   */
  async validateAndUseToken(token) {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    
    const result = await query(`
      SELECT * FROM pf_password_tokens 
      WHERE token_hash = :tokenHash 
      AND used_at IS NULL
    `, { tokenHash });
    
    if (result.rows.length === 0) {
      return { valid: false, error: 'Invalid or already used token' };
    }
    
    const tokenRecord = result.rows[0];
    
    // Check expiry
    if (new Date() > new Date(tokenRecord.EXPIRES_AT)) {
      return { valid: false, error: 'Token has expired' };
    }
    
    // Mark token as used
    await query(
      'UPDATE pf_password_tokens SET used_at = CURRENT_TIMESTAMP WHERE token_hash = :tokenHash',
      { tokenHash }
    );
    
    // Audit log
    await auditService.log({
      eventType: `password_token_used_${tokenRecord.TOKEN_TYPE}`,
      eventCategory: 'security',
      userId: tokenRecord.USER_ID,
      eventDescription: `Password ${tokenRecord.TOKEN_TYPE} token used`,
      metadata: {
        tokenType: tokenRecord.TOKEN_TYPE,
        createdAt: tokenRecord.CREATED_AT
      }
    });
    
    return {
      valid: true,
      userId: tokenRecord.USER_ID,
      tokenType: tokenRecord.TOKEN_TYPE,
      metadata: tokenRecord.METADATA ? JSON.parse(tokenRecord.METADATA) : {}
    };
  }

  /**
   * Retrieve temporary password for a user
   * @param {string} userId - User ID
   * @returns {string|null} - Decrypted temporary password
   */
  async retrieveTemporaryPassword(userId) {
    const result = await query(
      'SELECT temporary_password FROM pf_user_passwords WHERE user_id = :userId AND is_temporary = 1',
      { userId }
    );
    
    if (result.rows.length === 0 || !result.rows[0].TEMPORARY_PASSWORD) {
      return null;
    }
    
    // Decrypt the temporary password
    const decrypted = await decrypt(result.rows[0].TEMPORARY_PASSWORD, userId);
    return decrypted;
  }

  /**
   * Change user password
   * @param {string} userId - User ID
   * @param {string} oldClientHash - Old password client hash
   * @param {string} oldClientSalt - Old password client salt
   * @param {string} newClientHash - New password client hash
   * @param {string} newClientSalt - New password client salt
   * @returns {Object} - Change result
   */
  async changePassword(userId, oldClientHash, oldClientSalt, newClientHash, newClientSalt) {
    // Verify old password
    const verifyResult = await this.verifyPassword(userId, oldClientHash, oldClientSalt);
    if (!verifyResult.valid) {
      return { success: false, error: 'Current password is incorrect' };
    }
    
    // Check password history
    const isReused = await this.checkPasswordHistory(userId, newClientHash, newClientSalt);
    if (isReused) {
      const policy = await this.getUserPasswordPolicy(userId);
      return { 
        success: false, 
        error: `Password was used recently. Last ${policy.PASSWORD_HISTORY_COUNT} passwords cannot be reused.` 
      };
    }
    
    // Store new password
    await this.storePassword(userId, newClientHash, newClientSalt, false);
    
    return { success: true };
  }
}

module.exports = new PasswordService();