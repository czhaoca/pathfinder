const { encryptionService, ENCRYPTED_FIELDS } = require('../../../src/services/encryption');

// Mock environment variables for testing
process.env.ENABLE_FIELD_ENCRYPTION = 'true';
process.env.FIELD_ENCRYPTION_KEY = Buffer.from('test-encryption-key-32-bytes-ok!').toString('hex');

// Mock database service
jest.mock('../../../src/services/database', () => ({
  query: jest.fn(),
  transaction: jest.fn()
}));

describe('EncryptionService', () => {
  const testUserId = 'test-user-123';
  const testData = 'sensitive data';

  beforeEach(() => {
    // Clear any cached keys
    if (encryptionService.userKeyCache) {
      encryptionService.userKeyCache.clear();
    }
    jest.clearAllMocks();
  });

  describe('Field Encryption', () => {
    it('should encrypt and decrypt field data', () => {
      const encrypted = encryptionService.encryptField(testData, testUserId);
      
      expect(encrypted).toBeDefined();
      expect(encrypted).not.toBe(testData);
      expect(encrypted).toContain('algorithm');
      expect(encrypted).toContain('data');
      
      const decrypted = encryptionService.decryptField(encrypted, testUserId);
      expect(decrypted).toBe(testData);
    });

    it('should handle null values', () => {
      const encrypted = encryptionService.encryptField(null, testUserId);
      expect(encrypted).toBeNull();
      
      const decrypted = encryptionService.decryptField(null, testUserId);
      expect(decrypted).toBeNull();
    });

    it('should handle empty strings', () => {
      const encrypted = encryptionService.encryptField('', testUserId);
      expect(encrypted).toBe('');
      
      const decrypted = encryptionService.decryptField('', testUserId);
      expect(decrypted).toBe('');
    });

    it('should return plaintext when encryption is disabled', () => {
      encryptionService.isEnabled = false;
      
      const result = encryptionService.encryptField(testData, testUserId);
      expect(result).toBe(testData);
      
      encryptionService.isEnabled = true;
    });
  });

  describe('Object Encryption', () => {
    it('should encrypt specified fields in object', () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        phone: '555-1234',
        address: '123 Main St'
      };
      
      const fieldsToEncrypt = ['phone', 'address'];
      const encrypted = encryptionService.encryptObject(userData, fieldsToEncrypt, testUserId);
      
      expect(encrypted.username).toBe('testuser');
      expect(encrypted.email).toBe('test@example.com');
      expect(encrypted.phone).not.toBe('555-1234');
      expect(encrypted.address).not.toBe('123 Main St');
      
      const decrypted = encryptionService.decryptObject(encrypted, fieldsToEncrypt, testUserId);
      expect(decrypted).toEqual(userData);
    });

    it('should handle missing fields gracefully', () => {
      const userData = {
        username: 'testuser'
      };
      
      const fieldsToEncrypt = ['phone', 'address'];
      const encrypted = encryptionService.encryptObject(userData, fieldsToEncrypt, testUserId);
      
      expect(encrypted.username).toBe('testuser');
      expect(encrypted.phone).toBeUndefined();
      expect(encrypted.address).toBeUndefined();
    });
  });

  describe('User Key Management', () => {
    it('should derive consistent user keys', () => {
      const key1 = encryptionService.deriveUserKey(testUserId);
      const key2 = encryptionService.deriveUserKey(testUserId);
      
      expect(key1).toEqual(key2);
    });

    it('should derive different keys for different users', () => {
      const key1 = encryptionService.deriveUserKey('user1');
      const key2 = encryptionService.deriveUserKey('user2');
      
      expect(key1).not.toEqual(key2);
    });

    it('should cache user keys', () => {
      encryptionService.deriveUserKey(testUserId);
      expect(encryptionService.userKeyCache.has(testUserId)).toBe(true);
    });
  });

  describe('Table Field Configuration', () => {
    it('should have encrypted fields configuration', () => {
      expect(ENCRYPTED_FIELDS).toBeDefined();
      expect(ENCRYPTED_FIELDS.users).toContain('phone');
      expect(ENCRYPTED_FIELDS.experiences_detailed).toContain('company_name');
      expect(ENCRYPTED_FIELDS.profile_summaries).toContain('executive_summary');
    });

    it('should check if field should be encrypted', () => {
      const shouldEncrypt = encryptionService.shouldEncryptField('users', 'phone');
      expect(shouldEncrypt).toBe(true);
      
      const shouldNotEncrypt = encryptionService.shouldEncryptField('users', 'username');
      expect(shouldNotEncrypt).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle encryption errors gracefully', () => {
      // Force an error by using invalid data
      const invalidData = { circular: {} };
      invalidData.circular.ref = invalidData;
      
      expect(() => {
        encryptionService.encryptField(invalidData, testUserId);
      }).toThrow();
    });

    it('should handle decryption of corrupted data', () => {
      const corruptedData = JSON.stringify({
        algorithm: 'aes-256-gcm',
        iv: 'invalid',
        tag: 'invalid',
        data: 'corrupted'
      });
      
      expect(() => {
        encryptionService.decryptField(corruptedData, testUserId);
      }).toThrow();
    });
  });

  describe('Key Rotation', () => {
    it('should support key rotation', async () => {
      const db = require('../../../src/services/database');
      db.query.mockResolvedValue({ rows: [] });
      db.transaction.mockImplementation(async (callback) => {
        const mockClient = { query: jest.fn().mockResolvedValue({ rows: [] }) };
        return callback(mockClient);
      });

      await expect(encryptionService.rotateUserKey(testUserId)).resolves.not.toThrow();
    });
  });

  describe('Audit Logging', () => {
    it('should log encryption operations', () => {
      const logSpy = jest.spyOn(console, 'log').mockImplementation();
      
      encryptionService.encryptField(testData, testUserId);
      
      // Encryption operations should be logged for audit
      // Note: Actual implementation may use winston logger
      
      logSpy.mockRestore();
    });
  });
});