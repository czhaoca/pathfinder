/**
 * Tests for ProfileFieldsService
 */

const ProfileFieldsService = require('../../src/services/ProfileFieldsService');
const { ulid } = require('ulid');

describe('ProfileFieldsService', () => {
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

  describe('getAllFields', () => {
    it('should retrieve all active fields', async () => {
      const mockFields = [
        {
          field_id: '1',
          field_name: 'email',
          field_label: 'Email',
          field_type: 'email',
          field_group: 'personal',
          validation_rules: '{"required": true}',
          options: null,
          help_text: 'Your email address',
          placeholder: 'email@example.com',
          default_value: null,
          is_essential: 'Y',
          is_sensitive: 'N',
          encryption_required: 'N',
          display_order: 1,
          is_active: 'Y'
        }
      ];

      mockDb.execute.mockResolvedValue({ rows: mockFields });

      const fields = await service.getAllFields();

      expect(fields).toHaveLength(1);
      expect(fields[0]).toEqual({
        fieldId: '1',
        fieldName: 'email',
        fieldLabel: 'Email',
        fieldType: 'email',
        fieldGroup: 'personal',
        validationRules: { required: true },
        options: null,
        helpText: 'Your email address',
        placeholder: 'email@example.com',
        defaultValue: null,
        isEssential: true,
        isSensitive: false,
        encryptionRequired: false,
        displayOrder: 1,
        isActive: true
      });
    });

    it('should filter fields by group', async () => {
      mockDb.execute.mockResolvedValue({ rows: [] });

      await service.getAllFields({ group: 'professional' });

      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining('field_group = :field_group'),
        ['professional']
      );
    });

    it('should use cache when available', async () => {
      const cachedFields = [{ fieldId: '1', fieldName: 'cached' }];
      mockCacheService.get.mockResolvedValue(cachedFields);

      const fields = await service.getAllFields();

      expect(fields).toEqual(cachedFields);
      expect(mockDb.execute).not.toHaveBeenCalled();
    });
  });

  describe('validateFieldValue', () => {
    it('should validate required fields', async () => {
      const field = {
        fieldName: 'email',
        fieldLabel: 'Email',
        fieldType: 'email',
        isEssential: true,
        validationRules: { required: true }
      };

      const result = await service.validateFieldValue(field, '');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Email is required');
    });

    it('should validate email format', async () => {
      const field = {
        fieldName: 'email',
        fieldLabel: 'Email',
        fieldType: 'email',
        validationRules: {}
      };

      const invalidResult = await service.validateFieldValue(field, 'invalid-email');
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.error).toBe('Invalid email format');

      const validResult = await service.validateFieldValue(field, 'test@example.com');
      expect(validResult.valid).toBe(true);
      expect(validResult.normalized).toBe('test@example.com');
    });

    it('should validate phone numbers', async () => {
      const field = {
        fieldName: 'phone',
        fieldLabel: 'Phone',
        fieldType: 'phone',
        validationRules: {}
      };

      const validResult = await service.validateFieldValue(field, '+1 (555) 123-4567');
      expect(validResult.valid).toBe(true);
      expect(validResult.normalized).toBe('+15551234567');

      const invalidResult = await service.validateFieldValue(field, 'abc123');
      expect(invalidResult.valid).toBe(false);
    });

    it('should validate min/max length', async () => {
      const field = {
        fieldName: 'bio',
        fieldLabel: 'Bio',
        fieldType: 'text',
        validationRules: {
          minLength: 10,
          maxLength: 100
        }
      };

      const tooShort = await service.validateFieldValue(field, 'Short');
      expect(tooShort.valid).toBe(false);
      expect(tooShort.error).toBe('Minimum 10 characters required');

      const tooLong = await service.validateFieldValue(field, 'a'.repeat(101));
      expect(tooLong.valid).toBe(false);
      expect(tooLong.error).toBe('Maximum 100 characters allowed');

      const justRight = await service.validateFieldValue(field, 'This is a valid bio');
      expect(justRight.valid).toBe(true);
    });

    it('should validate pattern matching', async () => {
      const field = {
        fieldName: 'zipcode',
        fieldLabel: 'Zip Code',
        fieldType: 'text',
        validationRules: {
          pattern: '^\\d{5}$',
          patternMessage: 'Must be 5 digits'
        }
      };

      const invalid = await service.validateFieldValue(field, '1234');
      expect(invalid.valid).toBe(false);
      expect(invalid.error).toBe('Must be 5 digits');

      const valid = await service.validateFieldValue(field, '12345');
      expect(valid.valid).toBe(true);
    });
  });

  describe('saveUserProfileData', () => {
    it('should save valid profile data', async () => {
      const mockConnection = {
        execute: jest.fn(),
        commit: jest.fn(),
        rollback: jest.fn(),
        close: jest.fn()
      };
      mockDb.getConnection.mockResolvedValue(mockConnection);

      // Mock field lookup
      service.getField = jest.fn().mockResolvedValue({
        fieldId: 'field1',
        fieldName: 'first_name',
        fieldLabel: 'First Name',
        fieldType: 'text',
        encryptionRequired: false
      });

      // Spy on validateFieldValue instead of mocking it
      jest.spyOn(service, 'validateFieldValue').mockResolvedValue({
        valid: true,
        normalized: 'John',
        error: null
      });

      // Mock existing check
      mockConnection.execute.mockResolvedValueOnce({ rows: [] });
      // Mock insert
      mockConnection.execute.mockResolvedValueOnce({ rowsAffected: 1 });

      const result = await service.saveUserProfileData(
        'user123',
        { first_name: 'John' },
        'manual'
      );

      expect(result.saved).toHaveLength(1);
      expect(result.saved[0]).toEqual({
        field: 'first_name',
        value: 'John'
      });
      expect(result.failed).toHaveLength(0);
      expect(mockConnection.commit).toHaveBeenCalled();
    });

    it('should encrypt sensitive fields', async () => {
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

      mockConnection.execute.mockResolvedValueOnce({ rows: [] });

      await service.saveUserProfileData(
        'user123',
        { ssn: '123-45-6789' },
        'manual'
      );

      expect(mockEncryptionService.encryptField).toHaveBeenCalledWith(
        '123-45-6789',
        'user123'
      );
    });

    it('should handle validation errors', async () => {
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
        validationRules: { required: true }
      });

      const result = await service.saveUserProfileData(
        'user123',
        { email: 'invalid-email' },
        'manual'
      );

      expect(result.failed).toHaveLength(1);
      expect(result.failed[0]).toEqual({
        field: 'email',
        error: 'Invalid email format'
      });
      expect(result.validated).toBe(false);
    });
  });

  describe('checkFeatureAccess', () => {
    it('should grant access when all required fields are present', async () => {
      const mockRequirements = [
        {
          requirement_id: 'req1',
          feature_key: 'advanced_search',
          field_id: 'field1',
          field_name: 'location',
          field_label: 'Location',
          field_type: 'text',
          is_required: 'Y',
          requirement_level: 'required',
          custom_message: null,
          alternative_fields: null,
          validation_rules: null,
          options: null,
          help_text: null,
          placeholder: null,
          is_essential: 'N',
          is_sensitive: 'N',
          encryption_required: 'N'
        }
      ];

      service.getFeatureRequirements = jest.fn().mockResolvedValue(
        mockRequirements.map(r => service.transformRequirement(r))
      );

      service.getUserProfileData = jest.fn().mockResolvedValue({
        location: 'New York'
      });

      const result = await service.checkFeatureAccess('user123', 'advanced_search');

      expect(result.canAccess).toBe(true);
      expect(result.missingRequired).toHaveLength(0);
      expect(result.completionPercentage).toBe(100);
    });

    it('should deny access when required fields are missing', async () => {
      const mockRequirements = [
        {
          requirement_id: 'req1',
          feature_key: 'advanced_search',
          field_id: 'field1',
          field_name: 'location',
          field_label: 'Location',
          field_type: 'text',
          is_required: 'Y',
          requirement_level: 'required',
          custom_message: 'Location is required for search',
          alternative_fields: null,
          validation_rules: null,
          options: null,
          help_text: null,
          placeholder: null,
          is_essential: 'N',
          is_sensitive: 'N',
          encryption_required: 'N'
        }
      ];

      service.getFeatureRequirements = jest.fn().mockResolvedValue(
        mockRequirements.map(r => service.transformRequirement(r))
      );

      service.getUserProfileData = jest.fn().mockResolvedValue({});

      const result = await service.checkFeatureAccess('user123', 'advanced_search');

      expect(result.canAccess).toBe(false);
      expect(result.missingRequired).toHaveLength(1);
      expect(result.missingRequired[0].fieldName).toBe('location');
      expect(result.missingRequired[0].customMessage).toBe('Location is required for search');
      expect(result.completionPercentage).toBe(0);
    });

    it('should check alternative fields', async () => {
      const mockRequirements = [
        {
          requirement_id: 'req1',
          feature_key: 'contact',
          field_id: 'field1',
          field_name: 'phone',
          field_label: 'Phone',
          field_type: 'phone',
          is_required: 'Y',
          requirement_level: 'required',
          custom_message: null,
          alternative_fields: '["email"]',
          validation_rules: null,
          options: null,
          help_text: null,
          placeholder: null,
          is_essential: 'N',
          is_sensitive: 'N',
          encryption_required: 'N'
        }
      ];

      service.getFeatureRequirements = jest.fn().mockResolvedValue(
        mockRequirements.map(r => service.transformRequirement(r))
      );

      // Has email but not phone - should still grant access
      service.getUserProfileData = jest.fn().mockResolvedValue({
        email: 'test@example.com'
      });

      const result = await service.checkFeatureAccess('user123', 'contact');

      expect(result.canAccess).toBe(true);
      expect(result.missingRequired).toHaveLength(0);
    });
  });
});