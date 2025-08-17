/**
 * Tests for ProfileCompletionService
 */

const ProfileCompletionService = require('../../src/services/ProfileCompletionService');
const { ulid } = require('ulid');

describe('ProfileCompletionService', () => {
  let service;
  let mockDb;
  let mockProfileFieldsService;
  let mockCacheService;

  beforeEach(() => {
    // Mock database
    mockDb = {
      execute: jest.fn()
    };

    // Mock ProfileFieldsService
    mockProfileFieldsService = {
      getAllFields: jest.fn(),
      getUserProfileData: jest.fn()
    };

    // Mock cache service
    mockCacheService = {
      get: jest.fn(),
      set: jest.fn(),
      delete: jest.fn()
    };

    service = new ProfileCompletionService(mockDb, mockProfileFieldsService, mockCacheService);
  });

  describe('updateCompletionTracking', () => {
    it('should calculate completion stats correctly', async () => {
      const mockFields = [
        { fieldId: '1', fieldName: 'email', isEssential: true, fieldGroup: 'personal' },
        { fieldId: '2', fieldName: 'first_name', isEssential: true, fieldGroup: 'personal' },
        { fieldId: '3', fieldName: 'current_title', isEssential: false, fieldGroup: 'professional' },
        { fieldId: '4', fieldName: 'bio', isEssential: false, fieldGroup: 'optional' }
      ];

      const mockUserProfile = {
        email: { value: 'test@example.com', verified: true },
        first_name: { value: 'John', verified: false },
        current_title: { value: 'Developer', verified: false }
        // bio is missing
      };

      mockProfileFieldsService.getAllFields.mockResolvedValue(mockFields);
      mockProfileFieldsService.getUserProfileData.mockResolvedValue(mockUserProfile);
      
      // Mock getSkippedFields
      service.getSkippedFields = jest.fn().mockResolvedValue([]);
      
      // Mock saveCompletionStats
      service.saveCompletionStats = jest.fn().mockResolvedValue();

      const stats = await service.updateCompletionTracking('user123');

      expect(stats.totalFields).toBe(4);
      expect(stats.completedFields).toBe(3);
      expect(stats.requiredFields).toBe(2);
      expect(stats.completedRequired).toBe(2);
      expect(stats.completionPercentage).toBe(75); // 3/4 = 75%
      
      expect(stats.breakdown.essential.total).toBe(2);
      expect(stats.breakdown.essential.completed).toBe(2);
      expect(stats.breakdown.essential.percentage).toBe(100);
      
      expect(stats.breakdown.professional.total).toBe(1);
      expect(stats.breakdown.professional.completed).toBe(1);
      expect(stats.breakdown.professional.percentage).toBe(100);
      
      expect(stats.breakdown.optional.total).toBe(1);
      expect(stats.breakdown.optional.completed).toBe(0);
      expect(stats.breakdown.optional.percentage).toBe(0);
    });

    it('should handle empty profile correctly', async () => {
      const mockFields = [
        { fieldId: '1', fieldName: 'email', isEssential: true, fieldGroup: 'personal' },
        { fieldId: '2', fieldName: 'first_name', isEssential: true, fieldGroup: 'personal' }
      ];

      mockProfileFieldsService.getAllFields.mockResolvedValue(mockFields);
      mockProfileFieldsService.getUserProfileData.mockResolvedValue({});
      
      service.getSkippedFields = jest.fn().mockResolvedValue([]);
      service.saveCompletionStats = jest.fn().mockResolvedValue();

      const stats = await service.updateCompletionTracking('user123');

      expect(stats.totalFields).toBe(2);
      expect(stats.completedFields).toBe(0);
      expect(stats.completionPercentage).toBe(0);
      expect(stats.profileScore).toBeLessThanOrEqual(100);
    });
  });

  describe('calculateProfileScore', () => {
    it('should calculate weighted profile score', () => {
      const data = {
        essentialFields: [
          { fieldId: '1', fieldName: 'email' },
          { fieldId: '2', fieldName: 'first_name' }
        ],
        professionalFields: [
          { fieldId: '3', fieldName: 'current_title' }
        ],
        optionalFields: [
          { fieldId: '4', fieldName: 'bio' }
        ],
        completedEssential: 2,
        completedProfessional: 1,
        completedOptional: 0,
        userProfile: {
          email: { value: 'test@example.com', verified: true },
          first_name: { value: 'John', verified: false },
          current_title: { value: 'Developer', verified: true }
        }
      };

      const score = service.calculateProfileScore(data);

      // Essential: 100% * 40 = 40
      // Professional: 100% * 35 = 35
      // Optional: 0% * 15 = 0
      // Verified bonus: 2/4 * 10 = 5
      // Total: 40 + 35 + 0 + 5 = 80

      expect(score).toBe(80);
    });

    it('should cap score at 100', () => {
      const data = {
        essentialFields: [],
        professionalFields: [],
        optionalFields: [],
        completedEssential: 0,
        completedProfessional: 0,
        completedOptional: 0,
        userProfile: {}
      };

      // When no fields are defined, full points are given (minus verified bonus)
      const score = service.calculateProfileScore(data);
      expect(score).toBe(90); // 40 + 35 + 15 = 90 (no verified bonus)
    });
  });

  describe('getFieldSuggestions', () => {
    it('should prioritize essential fields', async () => {
      const mockFields = [
        { fieldId: '1', fieldName: 'bio', isEssential: false, fieldGroup: 'optional', displayOrder: 1 },
        { fieldId: '2', fieldName: 'email', isEssential: true, fieldGroup: 'personal', displayOrder: 2 },
        { fieldId: '3', fieldName: 'phone', isEssential: true, fieldGroup: 'personal', displayOrder: 3 },
        { fieldId: '4', fieldName: 'current_title', isEssential: false, fieldGroup: 'professional', displayOrder: 4 }
      ];

      mockProfileFieldsService.getUserProfileData.mockResolvedValue({});
      mockProfileFieldsService.getAllFields.mockResolvedValue(mockFields);
      service.getSkippedFields = jest.fn().mockResolvedValue([]);

      const suggestions = await service.getFieldSuggestions('user123', 3);

      expect(suggestions).toHaveLength(3);
      expect(suggestions[0].fieldName).toBe('email'); // Essential first
      expect(suggestions[1].fieldName).toBe('phone'); // Essential second
      expect(suggestions[2].fieldName).toBe('current_title'); // Professional third
    });

    it('should deprioritize skipped fields', async () => {
      const mockFields = [
        { fieldId: '1', fieldName: 'phone', isEssential: false, fieldGroup: 'personal', displayOrder: 1 },
        { fieldId: '2', fieldName: 'bio', isEssential: false, fieldGroup: 'optional', displayOrder: 2 }
      ];

      const skippedFields = [
        { fieldId: '1', fieldName: 'phone', fieldLabel: 'Phone', lastSkipped: new Date() }
      ];

      mockProfileFieldsService.getUserProfileData.mockResolvedValue({});
      mockProfileFieldsService.getAllFields.mockResolvedValue(mockFields);
      service.getSkippedFields = jest.fn().mockResolvedValue(skippedFields);

      const suggestions = await service.getFieldSuggestions('user123', 2);

      expect(suggestions).toHaveLength(2);
      expect(suggestions[0].fieldName).toBe('bio'); // Non-skipped first
      expect(suggestions[1].fieldName).toBe('phone'); // Skipped last
    });
  });

  describe('importProfileData', () => {
    it('should map LinkedIn data correctly', async () => {
      const linkedInData = {
        headline: 'Senior Developer',
        summary: 'Experienced developer',
        location: { name: 'New York' },
        positions: [{
          title: 'Software Engineer',
          company: { name: 'Tech Corp' }
        }],
        skills: ['JavaScript', 'Python'],
        educations: [{
          school: { name: 'MIT' },
          degree: 'BS',
          fieldOfStudy: 'Computer Science'
        }]
      };

      mockProfileFieldsService.saveUserProfileData = jest.fn().mockResolvedValue({
        saved: [
          { field: 'professional_headline', value: 'Senior Developer' },
          { field: 'bio', value: 'Experienced developer' },
          { field: 'location', value: 'New York' },
          { field: 'current_title', value: 'Software Engineer' },
          { field: 'current_company', value: 'Tech Corp' }
        ],
        failed: []
      });

      service.updateCompletionTracking = jest.fn().mockResolvedValue({});

      const result = await service.importProfileData('user123', 'linkedin', linkedInData);

      expect(result.imported).toBe(5);
      expect(result.failed).toBe(0);
      expect(mockProfileFieldsService.saveUserProfileData).toHaveBeenCalledWith(
        'user123',
        expect.objectContaining({
          professional_headline: 'Senior Developer',
          bio: 'Experienced developer',
          location: 'New York',
          current_title: 'Software Engineer',
          current_company: 'Tech Corp'
        }),
        'linkedin_import'
      );
    });

    it('should handle nested data extraction', () => {
      const data = {
        contact: {
          email: 'test@example.com',
          phone: {
            primary: '555-1234'
          }
        },
        skills: ['JavaScript', 'Python']
      };

      expect(service.getNestedValue(data, 'contact.email')).toBe('test@example.com');
      expect(service.getNestedValue(data, 'contact.phone.primary')).toBe('555-1234');
      expect(service.getNestedValue(data, 'skills')).toEqual(['JavaScript', 'Python']);
      expect(service.getNestedValue(data, 'nonexistent.path')).toBeUndefined();
    });

    it('should handle array notation in paths', () => {
      const data = {
        positions: [
          { title: 'Engineer', company: 'Company A' },
          { title: 'Manager', company: 'Company B' }
        ]
      };

      expect(service.getNestedValue(data, 'positions[0].title')).toBe('Engineer');
      expect(service.getNestedValue(data, 'positions[1].company')).toBe('Company B');
      expect(service.getNestedValue(data, 'positions[2].title')).toBeUndefined();
    });
  });

  describe('createFieldPrompt', () => {
    it('should create new prompt if none exists', async () => {
      mockDb.execute
        .mockResolvedValueOnce({ rows: [] }) // No existing prompt
        .mockResolvedValueOnce({ rowsAffected: 1 }); // Insert successful

      service.updateLastPrompted = jest.fn().mockResolvedValue();

      const result = await service.createFieldPrompt('user123', 'field1', 'feature1', 'modal');

      expect(result.alreadyExists).toBe(false);
      expect(result.promptId).toBeDefined();
      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO'),
        expect.objectContaining({
          user_id: 'user123',
          field_id: 'field1',
          feature_key: 'feature1',
          prompt_type: 'modal'
        })
      );
    });

    it('should return existing prompt if pending', async () => {
      mockDb.execute.mockResolvedValueOnce({
        rows: [{ prompt_id: 'existing-prompt' }]
      });

      const result = await service.createFieldPrompt('user123', 'field1', 'feature1');

      expect(result.alreadyExists).toBe(true);
      expect(result.promptId).toBe('existing-prompt');
    });
  });

  describe('updatePromptResponse', () => {
    it('should update prompt with correct status', async () => {
      mockDb.execute.mockResolvedValue({ rowsAffected: 1 });

      await service.updatePromptResponse('prompt1', 'provided');

      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE'),
        expect.objectContaining({
          prompt_status: 'completed',
          response: 'provided',
          prompt_id: 'prompt1'
        })
      );
    });

    it('should map response types to status correctly', async () => {
      mockDb.execute.mockResolvedValue({ rowsAffected: 1 });

      const mappings = [
        { response: 'provided', status: 'completed' },
        { response: 'skipped', status: 'skipped' },
        { response: 'remind_later', status: 'deferred' },
        { response: 'dismissed', status: 'dismissed' }
      ];

      for (const mapping of mappings) {
        await service.updatePromptResponse('prompt1', mapping.response);
        
        expect(mockDb.execute).toHaveBeenCalledWith(
          expect.stringContaining('UPDATE'),
          expect.objectContaining({
            prompt_status: mapping.status,
            response: mapping.response
          })
        );
      }
    });
  });
});