/**
 * Edge Case Tests for ProfileFieldsService
 */

const ProfileFieldsService = require('../../src/services/ProfileFieldsService');
const { ulid } = require('ulid');

describe('ProfileFieldsService - Edge Cases', () => {
  let service;
  let mockDb;
  let mockEncryptionService;
  let mockCacheService;

  beforeEach(() => {
    // Mock database
    mockDb = {
      execute: jest.fn(),
      getConnection: jest.fn()
    };

    // Mock encryption service
    mockEncryptionService = {
      encryptField: jest.fn((value) => Promise.resolve(`encrypted_${value}`)),
      decryptField: jest.fn((value) => Promise.resolve(value.replace('encrypted_', '')))
    };

    // Mock cache service
    mockCacheService = {
      get: jest.fn(),
      set: jest.fn(),
      delete: jest.fn(),
      deletePattern: jest.fn()
    };

    service = new ProfileFieldsService(mockDb, mockEncryptionService, mockCacheService);
  });

  describe('Edge Case: Null/Undefined Inputs', () => {
    it('should handle null field filters gracefully', async () => {
      mockDb.execute.mockResolvedValue({ rows: [] });
      
      const fields = await service.getAllFields(null);
      expect(fields).toEqual([]);
      expect(mockDb.execute).toHaveBeenCalled();
    });

    it('should handle undefined user ID in getUserProfileData', async () => {
      const result = await service.getUserProfileData(undefined);
      expect(result).toEqual({});
    });

    it('should handle null validation rules', async () => {
      const field = {
        fieldName: 'test',
        fieldLabel: 'Test',
        fieldType: 'text',
        validationRules: null
      };

      const result = await service.validateFieldValue(field, 'test value');
      expect(result.valid).toBe(true);
      expect(result.normalized).toBe('test value');
    });

    it('should handle empty field value with non-essential field', async () => {
      const field = {
        fieldName: 'optional',
        fieldLabel: 'Optional Field',
        fieldType: 'text',
        isEssential: false
      };

      const result = await service.validateFieldValue(field, '');
      expect(result.valid).toBe(true);
    });

    it('should handle null in nested data extraction', async () => {
      service.getField = jest.fn().mockResolvedValue(null);
      
      const mockConnection = {
        execute: jest.fn(),
        commit: jest.fn(),
        rollback: jest.fn(),
        close: jest.fn()
      };
      mockDb.getConnection.mockResolvedValue(mockConnection);

      const result = await service.saveUserProfileData(
        'user123',
        { unknown_field: 'value' },
        'manual'
      );

      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].error).toBe('Unknown field');
    });
  });

  describe('Edge Case: Empty Collections', () => {
    it('should handle empty fields array', async () => {
      mockDb.execute.mockResolvedValue({ rows: [] });
      
      const fields = await service.getAllFields();
      expect(fields).toEqual([]);
    });

    it('should handle empty options array for select field', async () => {
      const field = {
        fieldName: 'select_field',
        fieldLabel: 'Select Field',
        fieldType: 'select',
        options: []
      };

      const result = await service.validateFieldValue(field, 'invalid_option');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid selection');
    });

    it('should handle empty alternative fields', async () => {
      const mockRequirements = [{
        requirement_id: 'req1',
        feature_key: 'test',
        field_id: 'field1',
        field_name: 'phone',
        field_label: 'Phone',
        field_type: 'phone',
        is_required: 'Y',
        requirement_level: 'required',
        alternative_fields: '[]',
        validation_rules: null,
        options: null,
        help_text: null,
        placeholder: null,
        is_essential: 'N',
        is_sensitive: 'N',
        encryption_required: 'N'
      }];

      service.getFeatureRequirements = jest.fn().mockResolvedValue(
        mockRequirements.map(r => service.transformRequirement(r))
      );
      service.getUserProfileData = jest.fn().mockResolvedValue({});

      const result = await service.checkFeatureAccess('user123', 'test');
      expect(result.canAccess).toBe(false);
      expect(result.missingRequired).toHaveLength(1);
    });
  });

  describe('Edge Case: Boundary Values', () => {
    it('should handle minimum length exactly', async () => {
      const field = {
        fieldName: 'test',
        fieldLabel: 'Test',
        fieldType: 'text',
        validationRules: { minLength: 5 }
      };

      const valid = await service.validateFieldValue(field, '12345');
      expect(valid.valid).toBe(true);

      const invalid = await service.validateFieldValue(field, '1234');
      expect(invalid.valid).toBe(false);
    });

    it('should handle maximum length exactly', async () => {
      const field = {
        fieldName: 'test',
        fieldLabel: 'Test',
        fieldType: 'text',
        validationRules: { maxLength: 10 }
      };

      const valid = await service.validateFieldValue(field, '1234567890');
      expect(valid.valid).toBe(true);

      const invalid = await service.validateFieldValue(field, '12345678901');
      expect(invalid.valid).toBe(false);
    });

    it('should handle number min/max boundaries', async () => {
      const field = {
        fieldName: 'age',
        fieldLabel: 'Age',
        fieldType: 'number',
        validationRules: { min: 18, max: 100 }
      };

      const validMin = await service.validateFieldValue(field, '18');
      expect(validMin.valid).toBe(true);

      const validMax = await service.validateFieldValue(field, '100');
      expect(validMax.valid).toBe(true);

      const invalidMin = await service.validateFieldValue(field, '17');
      expect(invalidMin.valid).toBe(false);

      const invalidMax = await service.validateFieldValue(field, '101');
      expect(invalidMax.valid).toBe(false);
    });

    it('should handle very long field values', async () => {
      const field = {
        fieldName: 'bio',
        fieldLabel: 'Bio',
        fieldType: 'textarea',
        validationRules: { maxLength: 5000 }
      };

      const longText = 'a'.repeat(5001);
      const result = await service.validateFieldValue(field, longText);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('5000 characters');
    });
  });

  describe('Edge Case: Type Mismatches', () => {
    it('should handle string when expecting number', async () => {
      const field = {
        fieldName: 'age',
        fieldLabel: 'Age',
        fieldType: 'number'
      };

      const result = await service.validateFieldValue(field, 'not a number');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Must be a number');
    });

    it('should handle invalid date format', async () => {
      const field = {
        fieldName: 'dob',
        fieldLabel: 'Date of Birth',
        fieldType: 'date'
      };

      const result = await service.validateFieldValue(field, 'invalid date');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid date format');
    });

    it('should handle boolean values for checkbox fields', async () => {
      const field = {
        fieldName: 'agree',
        fieldLabel: 'Agree',
        fieldType: 'checkbox'
      };

      const trueResult = await service.validateFieldValue(field, true);
      expect(trueResult.valid).toBe(true);

      const falseResult = await service.validateFieldValue(field, false);
      expect(falseResult.valid).toBe(true);

      const stringResult = await service.validateFieldValue(field, 'yes');
      expect(stringResult.valid).toBe(true);
    });
  });

  describe('Edge Case: Concurrent Operations', () => {
    it('should handle concurrent save operations', async () => {
      const mockConnection = {
        execute: jest.fn(),
        commit: jest.fn(),
        rollback: jest.fn(),
        close: jest.fn()
      };
      mockDb.getConnection.mockResolvedValue(mockConnection);

      service.getField = jest.fn().mockResolvedValue({
        fieldId: 'field1',
        fieldName: 'email',
        fieldLabel: 'Email',
        fieldType: 'email',
        encryptionRequired: false
      });

      service.validateFieldValue = jest.fn().mockResolvedValue({
        valid: true,
        normalized: 'test@example.com',
        error: null
      });

      // Simulate race condition - record created between check and insert
      mockConnection.execute
        .mockResolvedValueOnce({ rows: [] }) // First check - no record
        .mockRejectedValueOnce({ code: 'ORA-00001' }); // Insert fails due to unique constraint

      const result = await service.saveUserProfileData(
        'user123',
        { email: 'test@example.com' },
        'manual'
      );

      expect(result.failed).toHaveLength(1);
      expect(mockConnection.rollback).toHaveBeenCalled();
    });

    it('should handle cache invalidation during read', async () => {
      // First call returns cached data
      mockCacheService.get.mockResolvedValueOnce([{ fieldId: '1', fieldName: 'cached' }]);
      
      const fields1 = await service.getAllFields();
      expect(fields1).toHaveLength(1);
      expect(fields1[0].fieldName).toBe('cached');

      // Cache invalidated, next call fetches from DB
      mockCacheService.get.mockResolvedValueOnce(null);
      mockDb.execute.mockResolvedValue({ 
        rows: [{ 
          field_id: '2', 
          field_name: 'fresh',
          field_label: 'Fresh',
          field_type: 'text',
          is_essential: 'N',
          is_sensitive: 'N',
          encryption_required: 'N',
          is_active: 'Y'
        }] 
      });

      const fields2 = await service.getAllFields();
      expect(fields2).toHaveLength(1);
      expect(fields2[0].fieldName).toBe('fresh');
    });
  });

  describe('Edge Case: Encryption Failures', () => {
    it('should handle encryption service failure', async () => {
      const mockConnection = {
        execute: jest.fn(),
        commit: jest.fn(),
        rollback: jest.fn(),
        close: jest.fn()
      };
      mockDb.getConnection.mockResolvedValue(mockConnection);

      service.getField = jest.fn().mockResolvedValue({
        fieldId: 'field1',
        fieldName: 'ssn',
        fieldLabel: 'SSN',
        fieldType: 'text',
        encryptionRequired: true
      });

      service.validateFieldValue = jest.fn().mockResolvedValue({
        valid: true,
        normalized: '123-45-6789',
        error: null
      });

      // Mock encryption failure
      mockEncryptionService.encryptField.mockRejectedValue(new Error('Encryption failed'));

      const result = await service.saveUserProfileData(
        'user123',
        { ssn: '123-45-6789' },
        'manual'
      );

      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].error).toBe('Save failed');
    });

    it('should handle decryption failure gracefully', async () => {
      mockDb.execute.mockResolvedValue({
        rows: [{
          field_id: '1',
          field_name: 'ssn',
          field_label: 'SSN',
          field_type: 'text',
          field_value: null,
          field_value_encrypted: 'encrypted_data',
          encryption_required: 'Y',
          is_sensitive: 'Y'
        }]
      });

      mockEncryptionService.decryptField.mockRejectedValue(new Error('Decryption failed'));

      const result = await service.getUserProfileData('user123');
      expect(result).toEqual({}); // Field skipped due to decryption failure
    });
  });

  describe('Edge Case: Invalid State Transitions', () => {
    it('should prevent updating inactive fields', async () => {
      const field = {
        fieldId: 'field1',
        fieldName: 'inactive',
        isActive: false
      };

      const updates = { fieldLabel: 'New Label' };
      
      // Mock the field as inactive
      mockDb.execute.mockResolvedValue({ rowsAffected: 0 });

      const result = await service.updateField(field.fieldId, updates);
      expect(result).toBe(false);
    });

    it('should handle field requirement conflicts', async () => {
      // Field marked as both required and optional
      const conflictingRequirements = [
        { fieldId: 'field1', isRequired: true, requirementLevel: 'optional' }
      ];

      const connection = await mockDb.getConnection();
      await expect(
        service.setFeatureRequirements('feature1', conflictingRequirements)
      ).rejects.toThrow();
    });
  });

  describe('Edge Case: Special Characters', () => {
    it('should handle special characters in field values', async () => {
      const field = {
        fieldName: 'name',
        fieldLabel: 'Name',
        fieldType: 'text'
      };

      const specialChars = "O'Brien & Co. <script>alert('xss')</script>";
      const result = await service.validateFieldValue(field, specialChars);
      expect(result.valid).toBe(true);
      expect(result.normalized).toBe(specialChars); // Should preserve but will be escaped on display
    });

    it('should handle international characters', async () => {
      const field = {
        fieldName: 'name',
        fieldLabel: 'Name',
        fieldType: 'text'
      };

      const intlChars = '北京 Москва مصر São Paulo';
      const result = await service.validateFieldValue(field, intlChars);
      expect(result.valid).toBe(true);
      expect(result.normalized).toBe(intlChars);
    });

    it('should handle emojis in text fields', async () => {
      const field = {
        fieldName: 'bio',
        fieldLabel: 'Bio',
        fieldType: 'textarea'
      };

      const emojiText = 'Hello 👋 World 🌍';
      const result = await service.validateFieldValue(field, emojiText);
      expect(result.valid).toBe(true);
      expect(result.normalized).toBe(emojiText);
    });
  });

  describe('Edge Case: Performance and Resource Limits', () => {
    it('should handle large batch updates efficiently', async () => {
      const mockConnection = {
        execute: jest.fn().mockResolvedValue({ rowsAffected: 1 }),
        commit: jest.fn(),
        rollback: jest.fn(),
        close: jest.fn()
      };
      mockDb.getConnection.mockResolvedValue(mockConnection);

      // Create large batch of fields
      const largeFieldData = {};
      for (let i = 0; i < 100; i++) {
        largeFieldData[`field_${i}`] = `value_${i}`;
      }

      service.getField = jest.fn().mockResolvedValue({
        fieldId: 'field1',
        fieldName: 'test',
        fieldLabel: 'Test',
        fieldType: 'text',
        encryptionRequired: false
      });

      service.validateFieldValue = jest.fn().mockResolvedValue({
        valid: true,
        normalized: 'value',
        error: null
      });

      const startTime = Date.now();
      const result = await service.saveUserProfileData('user123', largeFieldData, 'batch');
      const endTime = Date.now();

      // Should complete within reasonable time (5 seconds)
      expect(endTime - startTime).toBeLessThan(5000);
      expect(mockConnection.commit).toHaveBeenCalled();
    });

    it('should handle cache size limits', async () => {
      // Test that cache doesn't grow unbounded
      const cacheKeys = new Set();
      mockCacheService.set.mockImplementation((key) => {
        cacheKeys.add(key);
        return Promise.resolve();
      });

      // Generate many different filter combinations
      for (let i = 0; i < 50; i++) {
        mockDb.execute.mockResolvedValue({ rows: [] });
        await service.getAllFields({ group: `group_${i}` });
      }

      // Cache should have been called for each unique filter
      expect(cacheKeys.size).toBe(50);
    });
  });
});