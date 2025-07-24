/**
 * Field-Level Encryption Service for Career Navigator
 * Implements AES-256-GCM encryption for sensitive user data
 * HIPAA-compliant encryption at rest with user-specific keys
 */

const crypto = require('crypto');
const winston = require('winston');

// Configure logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

class EncryptionService {
  constructor() {
    this.algorithm = 'aes-256-gcm';
    this.keyLength = 32; // 256 bits
    this.ivLength = 16;  // 128 bits
    this.tagLength = 16; // 128 bits
    this.isEnabled = process.env.ENABLE_FIELD_ENCRYPTION === 'true';
    this.masterKey = this.getMasterKey();
    
    // Cache for user encryption keys
    this.userKeyCache = new Map();
    this.cacheTimeout = 300000; // 5 minutes
    
    logger.info('Encryption service initialized', {
      enabled: this.isEnabled,
      algorithm: this.algorithm
    });
  }

  /**
   * Get master encryption key from environment
   */
  getMasterKey() {
    const key = process.env.FIELD_ENCRYPTION_KEY;
    if (!key) {
      if (this.isEnabled) {
        throw new Error('FIELD_ENCRYPTION_KEY environment variable required when encryption is enabled');
      }
      return null;
    }
    
    if (key.length !== 64) { // 32 bytes = 64 hex characters
      throw new Error('FIELD_ENCRYPTION_KEY must be 32 bytes (64 hex characters)');
    }
    
    return Buffer.from(key, 'hex');
  }

  /**
   * Derive user-specific encryption key from master key and user ID
   */
  deriveUserKey(userId) {
    if (!this.masterKey) {
      throw new Error('Master encryption key not available');
    }

    // Check cache first
    const cacheKey = `user_key_${userId}`;
    const cached = this.userKeyCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.key;
    }

    // Derive key using PBKDF2 with user ID as salt
    const salt = crypto.createHash('sha256').update(userId).digest();
    const userKey = crypto.pbkdf2Sync(this.masterKey, salt, 100000, this.keyLength, 'sha256');
    
    // Cache the derived key
    this.userKeyCache.set(cacheKey, {
      key: userKey,
      timestamp: Date.now()
    });

    logger.debug('User encryption key derived and cached', { userId });
    return userKey;
  }

  /**
   * Encrypt sensitive data for a specific user
   */
  encrypt(plaintext, userId) {
    if (!this.isEnabled || !plaintext) {
      return plaintext;
    }

    try {
      const userKey = this.deriveUserKey(userId);
      const iv = crypto.randomBytes(this.ivLength);
      const cipher = crypto.createCipher(this.algorithm, userKey, { iv });
      
      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const tag = cipher.getAuthTag();
      
      // Combine IV, tag, and encrypted data
      const result = {
        algorithm: this.algorithm,
        iv: iv.toString('hex'),
        tag: tag.toString('hex'),
        data: encrypted,
        timestamp: new Date().toISOString()
      };
      
      return JSON.stringify(result);
    } catch (error) {
      logger.error('Encryption failed', { 
        error: error.message, 
        userId,
        dataLength: plaintext?.length 
      });
      throw new Error('Failed to encrypt sensitive data');
    }
  }

  /**
   * Decrypt sensitive data for a specific user
   */
  decrypt(encryptedData, userId) {
    if (!this.isEnabled || !encryptedData) {
      return encryptedData;
    }

    try {
      // Handle legacy unencrypted data
      if (typeof encryptedData !== 'string' || !encryptedData.startsWith('{')) {
        logger.warn('Attempting to decrypt non-encrypted data', { userId });
        return encryptedData;
      }

      const parsed = JSON.parse(encryptedData);
      
      // Validate encrypted data structure
      if (!parsed.algorithm || !parsed.iv || !parsed.tag || !parsed.data) {
        throw new Error('Invalid encrypted data structure');
      }

      const userKey = this.deriveUserKey(userId);
      const iv = Buffer.from(parsed.iv, 'hex');
      const tag = Buffer.from(parsed.tag, 'hex');
      
      const decipher = crypto.createDecipher(this.algorithm, userKey, { iv });
      decipher.setAuthTag(tag);
      
      let decrypted = decipher.update(parsed.data, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      logger.error('Decryption failed', { 
        error: error.message, 
        userId,
        dataType: typeof encryptedData 
      });
      throw new Error('Failed to decrypt sensitive data');
    }
  }

  /**
   * Encrypt multiple fields for a user
   */
  encryptFields(data, userId, fieldsToEncrypt = []) {
    if (!this.isEnabled || !data || fieldsToEncrypt.length === 0) {
      return data;
    }

    const encrypted = { ...data };
    
    for (const field of fieldsToEncrypt) {
      if (encrypted[field]) {
        encrypted[field] = this.encrypt(encrypted[field], userId);
      }
    }
    
    return encrypted;
  }

  /**
   * Decrypt multiple fields for a user
   */
  decryptFields(data, userId, fieldsToDecrypt = []) {
    if (!this.isEnabled || !data || fieldsToDecrypt.length === 0) {
      return data;
    }

    const decrypted = { ...data };
    
    for (const field of fieldsToDecrypt) {
      if (decrypted[field]) {
        try {
          decrypted[field] = this.decrypt(decrypted[field], userId);
        } catch (error) {
          logger.warn(`Failed to decrypt field: ${field}`, { userId, error: error.message });
          // Keep original value if decryption fails (could be legacy data)
        }
      }
    }
    
    return decrypted;
  }

  /**
   * Generate new encryption key for key rotation
   */
  generateNewKey() {
    return crypto.randomBytes(this.keyLength).toString('hex');
  }

  /**
   * Rotate encryption keys for a user (re-encrypt with new key)
   */
  async rotateUserKey(userId, oldEncryptedData, newMasterKey = null) {
    if (!this.isEnabled) {
      return oldEncryptedData;
    }

    try {
      // Decrypt with old key
      const plaintext = this.decrypt(oldEncryptedData, userId);
      
      // If new master key provided, update it temporarily
      const originalMasterKey = this.masterKey;
      if (newMasterKey) {
        this.masterKey = Buffer.from(newMasterKey, 'hex');
        // Clear user key cache
        this.userKeyCache.delete(`user_key_${userId}`);
      }
      
      // Encrypt with new key
      const newEncryptedData = this.encrypt(plaintext, userId);
      
      // Restore original master key if changed
      if (newMasterKey) {
        this.masterKey = originalMasterKey;
        this.userKeyCache.delete(`user_key_${userId}`);
      }
      
      logger.info('User key rotation completed', { userId });
      return newEncryptedData;
    } catch (error) {
      logger.error('Key rotation failed', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Validate encryption configuration
   */
  validateConfiguration() {
    const issues = [];
    
    if (this.isEnabled) {
      if (!this.masterKey) {
        issues.push('FIELD_ENCRYPTION_KEY not configured');
      }
      
      if (!process.env.FIELD_ENCRYPTION_KEY || process.env.FIELD_ENCRYPTION_KEY.length !== 64) {
        issues.push('FIELD_ENCRYPTION_KEY must be 64 hex characters (32 bytes)');
      }
    }
    
    return {
      valid: issues.length === 0,
      issues,
      enabled: this.isEnabled,
      algorithm: this.algorithm
    };
  }

  /**
   * Clear user key cache (security cleanup)
   */
  clearUserKeyCache(userId = null) {
    if (userId) {
      this.userKeyCache.delete(`user_key_${userId}`);
      logger.debug('User key cache cleared', { userId });
    } else {
      this.userKeyCache.clear();
      logger.info('All user key caches cleared');
    }
  }

  /**
   * Get encryption statistics
   */
  getStats() {
    return {
      enabled: this.isEnabled,
      algorithm: this.algorithm,
      cacheSize: this.userKeyCache.size,
      keyLength: this.keyLength,
      masterKeyConfigured: !!this.masterKey
    };
  }
}

// Define fields that should be encrypted for each table type
const ENCRYPTED_FIELDS = {
  experiences_detailed: [
    'description',
    'raw_text',
    'personal_notes'
  ],
  profile_summaries: [
    'executive_summary',
    'personal_statement'
  ],
  quick_summaries: [
    'executive_summary',
    'personal_notes'
  ],
  user_preferences: [
    'preference_value'
  ]
};

// Export singleton instance
const encryptionService = new EncryptionService();

module.exports = {
  encryptionService,
  ENCRYPTED_FIELDS
};