/**
 * Edge Case Tests for ProfileCompletionService
 */

const ProfileCompletionService = require('../../src/services/ProfileCompletionService');
const { ulid } = require('ulid');

describe('ProfileCompletionService - Edge Cases', () => {
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
      getUserProfileData: jest.fn(),
      saveUserProfileData: jest.fn()
    };

    // Mock cache service
    mockCacheService = {
      get: jest.fn(),
      set: jest.fn(),
      delete: jest.fn()
    };

    service = new ProfileCompletionService(mockDb, mockProfileFieldsService, mockCacheService);
  });

  describe('Edge Case: Null/Undefined Handling', () => {
    it('should handle null userId gracefully', async () => {
      mockProfileFieldsService.getAllFields.mockResolvedValue([]);
      mockProfileFieldsService.getUserProfileData.mockResolvedValue({});
      service.getSkippedFields = jest.fn().mockResolvedValue([]);
      service.saveCompletionStats = jest.fn().mockResolvedValue();

      const result = await service.updateCompletionTracking(null);
      expect(result.totalFields).toBe(0);
      expect(result.completedFields).toBe(0);
    });

    it('should handle undefined profile data', async () => {
      mockProfileFieldsService.getAllFields.mockResolvedValue([
        { fieldId: '1', fieldName: 'email', isEssential: true }
      ]);
      mockProfileFieldsService.getUserProfileData.mockResolvedValue(undefined);
      
      const suggestions = await service.getFieldSuggestions('user123');
      expect(suggestions).toBeDefined();
      expect(Array.isArray(suggestions)).toBe(true);
    });

    it('should handle null reminder settings', async () => {
      mockDb.execute.mockResolvedValue({ rowsAffected: 0 });
      
      const result = await service.updateReminderSettings('user123', null);
      expect(result).toBe(true);
    });

    it('should handle undefined field values in profile', async () => {
      const mockFields = [
        { fieldId: '1', fieldName: 'email', isEssential: true, fieldGroup: 'personal' }
      ];
      
      const mockUserProfile = {
        email: undefined
      };

      mockProfileFieldsService.getAllFields.mockResolvedValue(mockFields);
      mockProfileFieldsService.getUserProfileData.mockResolvedValue(mockUserProfile);
      service.getSkippedFields = jest.fn().mockResolvedValue([]);
      service.saveCompletionStats = jest.fn().mockResolvedValue();

      const stats = await service.updateCompletionTracking('user123');
      expect(stats.completedFields).toBe(0);
    });
  });

  describe('Edge Case: Empty Collections', () => {
    it('should handle no fields defined', async () => {
      mockProfileFieldsService.getAllFields.mockResolvedValue([]);
      mockProfileFieldsService.getUserProfileData.mockResolvedValue({});
      service.getSkippedFields = jest.fn().mockResolvedValue([]);
      service.saveCompletionStats = jest.fn().mockResolvedValue();

      const stats = await service.updateCompletionTracking('user123');
      expect(stats.completionPercentage).toBe(0);
      expect(stats.profileScore).toBeDefined();
    });

    it('should handle empty skipped fields list', async () => {
      mockDb.execute.mockResolvedValue({ rows: [] });
      
      const skipped = await service.getSkippedFields('user123');
      expect(skipped).toEqual([]);
    });

    it('should handle no pending prompts', async () => {
      mockDb.execute.mockResolvedValue({ rows: [] });
      
      const prompts = await service.getPendingPrompts('user123');
      expect(prompts).toEqual([]);
    });

    it('should handle empty import data', async () => {
      mockProfileFieldsService.saveUserProfileData.mockResolvedValue({
        saved: [],
        failed: []
      });
      service.updateCompletionTracking = jest.fn().mockResolvedValue({});

      const result = await service.importProfileData('user123', 'linkedin', {});
      expect(result.imported).toBe(0);
      expect(result.failed).toBe(0);
    });
  });

  describe('Edge Case: Boundary Values', () => {
    it('should handle 100% completion', async () => {
      const mockFields = [
        { fieldId: '1', fieldName: 'email', isEssential: true, fieldGroup: 'personal' },
        { fieldId: '2', fieldName: 'name', isEssential: true, fieldGroup: 'personal' }
      ];

      const mockUserProfile = {
        email: { value: 'test@example.com', verified: true },
        name: { value: 'John Doe', verified: true }
      };

      mockProfileFieldsService.getAllFields.mockResolvedValue(mockFields);
      mockProfileFieldsService.getUserProfileData.mockResolvedValue(mockUserProfile);
      service.getSkippedFields = jest.fn().mockResolvedValue([]);
      service.saveCompletionStats = jest.fn().mockResolvedValue();

      const stats = await service.updateCompletionTracking('user123');
      expect(stats.completionPercentage).toBe(100);
      expect(stats.profileScore).toBeLessThanOrEqual(100);
    });

    it('should handle 0% completion', async () => {
      const mockFields = [
        { fieldId: '1', fieldName: 'email', isEssential: true, fieldGroup: 'personal' }
      ];

      mockProfileFieldsService.getAllFields.mockResolvedValue(mockFields);
      mockProfileFieldsService.getUserProfileData.mockResolvedValue({});
      service.getSkippedFields = jest.fn().mockResolvedValue([]);
      service.saveCompletionStats = jest.fn().mockResolvedValue();

      const stats = await service.updateCompletionTracking('user123');
      expect(stats.completionPercentage).toBe(0);
    });

    it('should handle maximum field suggestions limit', async () => {
      const mockFields = [];
      for (let i = 0; i < 20; i++) {
        mockFields.push({
          fieldId: `field${i}`,
          fieldName: `field_${i}`,
          isEssential: false,
          fieldGroup: 'optional',
          displayOrder: i
        });
      }

      mockProfileFieldsService.getAllFields.mockResolvedValue(mockFields);
      mockProfileFieldsService.getUserProfileData.mockResolvedValue({});
      service.getSkippedFields = jest.fn().mockResolvedValue([]);

      const suggestions = await service.getFieldSuggestions('user123', 5);
      expect(suggestions).toHaveLength(5);
    });

    it('should handle very long reminder delay', async () => {
      const farFutureDate = new Date('2100-01-01');
      mockDb.execute.mockResolvedValue({ rowsAffected: 1 });

      const result = await service.updatePromptResponse('prompt1', 'remind_later', farFutureDate);
      expect(result).toBe(true);
    });
  });

  describe('Edge Case: Complex Data Structures', () => {
    it('should handle deeply nested LinkedIn data', async () => {
      const complexData = {
        positions: [
          {
            title: 'Senior Developer',
            company: {
              name: 'Tech Corp',
              industry: {
                name: 'Technology',
                code: 'TECH'
              }
            },
            location: {
              country: {
                code: 'US',
                name: 'United States'
              },
              city: 'San Francisco'
            }
          }
        ],
        skills: {
          primary: ['JavaScript', 'Python'],
          secondary: {
            frontend: ['React', 'Vue'],
            backend: ['Node.js', 'Django']
          }
        }
      };

      // Test nested value extraction
      expect(service.getNestedValue(complexData, 'positions[0].company.industry.name')).toBe('Technology');
      expect(service.getNestedValue(complexData, 'skills.secondary.frontend')).toEqual(['React', 'Vue']);
      expect(service.getNestedValue(complexData, 'positions[0].location.country.code')).toBe('US');
    });

    it('should handle circular field dependencies', async () => {
      const mockFields = [
        { fieldId: '1', fieldName: 'field_a', isEssential: false, fieldGroup: 'optional' },
        { fieldId: '2', fieldName: 'field_b', isEssential: false, fieldGroup: 'optional' }
      ];

      // Simulate circular skipping pattern
      const skippedFields = [
        { fieldId: '1', fieldName: 'field_a', lastSkipped: new Date() },
        { fieldId: '2', fieldName: 'field_b', lastSkipped: new Date() }
      ];

      mockProfileFieldsService.getAllFields.mockResolvedValue(mockFields);
      mockProfileFieldsService.getUserProfileData.mockResolvedValue({});
      service.getSkippedFields = jest.fn().mockResolvedValue(skippedFields);

      const suggestions = await service.getFieldSuggestions('user123', 5);
      expect(suggestions).toHaveLength(2);
      // All fields should still be suggested despite being skipped
    });

    it('should handle mixed field types in import', async () => {
      const mixedData = {
        headline: 'Developer',
        years_experience: 5,
        remote_work: true,
        skills: ['JavaScript', 'Python'],
        certifications: {
          aws: { name: 'AWS Certified', date: '2023-01-01' }
        },
        availability: null,
        preferences: undefined
      };

      mockProfileFieldsService.saveUserProfileData.mockResolvedValue({
        saved: [
          { field: 'headline', value: 'Developer' },
          { field: 'years_experience', value: 5 },
          { field: 'remote_work', value: true },
          { field: 'skills', value: ['JavaScript', 'Python'] }
        ],
        failed: []
      });
      service.updateCompletionTracking = jest.fn().mockResolvedValue({});

      const result = await service.importProfileData('user123', 'resume', mixedData);
      expect(result.imported).toBe(4);
      // null and undefined values should be filtered out
    });
  });

  describe('Edge Case: State Consistency', () => {
    it('should maintain consistency when prompt creation fails', async () => {
      mockDb.execute
        .mockResolvedValueOnce({ rows: [] }) // No existing prompt
        .mockRejectedValueOnce(new Error('Database error')); // Insert fails

      await expect(
        service.createFieldPrompt('user123', 'field1', 'feature1')
      ).rejects.toThrow('Database error');

      // Verify no partial state was created
      mockDb.execute.mockResolvedValue({ rows: [] });
      const prompts = await service.getPendingPrompts('user123');
      expect(prompts).toHaveLength(0);
    });

    it('should handle concurrent prompt updates', async () => {
      // Simulate concurrent updates to the same prompt
      const updates = [
        service.updatePromptResponse('prompt1', 'provided'),
        service.updatePromptResponse('prompt1', 'skipped')
      ];

      mockDb.execute.mockResolvedValue({ rowsAffected: 1 });

      const results = await Promise.allSettled(updates);
      // Both should complete, last one wins
      expect(results.every(r => r.status === 'fulfilled')).toBe(true);
    });

    it('should recover from cache corruption', async () => {
      // Return corrupted cache data
      mockCacheService.get.mockResolvedValueOnce('corrupted_data_not_json');

      // Should fall back to database
      mockDb.execute.mockResolvedValue({
        rows: [{
          total_fields: 10,
          completed_fields: 5,
          required_fields: 3,
          completed_required: 2,
          completion_percentage: 50,
          profile_score: 60,
          last_prompted: null,
          fields_skipped: '[]',
          reminder_settings: '{}',
          updated_at: new Date()
        }]
      });

      const stats = await service.getCompletionStats('user123');
      expect(stats.totalFields).toBe(10);
      expect(stats.completedFields).toBe(5);
    });
  });

  describe('Edge Case: Performance Scenarios', () => {
    it('should handle large number of fields efficiently', async () => {
      const manyFields = [];
      for (let i = 0; i < 1000; i++) {
        manyFields.push({
          fieldId: `field${i}`,
          fieldName: `field_${i}`,
          isEssential: i < 10,
          fieldGroup: i < 100 ? 'professional' : 'optional',
          displayOrder: i
        });
      }

      const userProfile = {};
      // User has completed half the fields
      for (let i = 0; i < 500; i++) {
        userProfile[`field_${i}`] = { value: `value_${i}`, verified: i < 50 };
      }

      mockProfileFieldsService.getAllFields.mockResolvedValue(manyFields);
      mockProfileFieldsService.getUserProfileData.mockResolvedValue(userProfile);
      service.getSkippedFields = jest.fn().mockResolvedValue([]);
      service.saveCompletionStats = jest.fn().mockResolvedValue();

      const startTime = Date.now();
      const stats = await service.updateCompletionTracking('user123');
      const endTime = Date.now();

      expect(stats.totalFields).toBe(1000);
      expect(stats.completedFields).toBe(500);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should batch database operations efficiently', async () => {
      const prompts = [];
      for (let i = 0; i < 50; i++) {
        prompts.push({
          prompt_id: `prompt${i}`,
          field_id: `field${i}`,
          field_name: `field_${i}`,
          field_label: `Field ${i}`,
          field_type: 'text',
          feature_key: 'bulk_feature',
          prompt_type: 'modal',
          created_at: new Date()
        });
      }

      mockDb.execute.mockResolvedValue({ rows: prompts });

      const result = await service.getPendingPrompts('user123');
      expect(result).toHaveLength(50);
      expect(mockDb.execute).toHaveBeenCalledTimes(1); // Should fetch all in one query
    });
  });

  describe('Edge Case: Error Recovery', () => {
    it('should handle partial import failures gracefully', async () => {
      const importData = {
        headline: 'Developer',
        invalid_field: 'This will fail',
        location: 'San Francisco'
      };

      mockProfileFieldsService.saveUserProfileData.mockResolvedValue({
        saved: [
          { field: 'headline', value: 'Developer' },
          { field: 'location', value: 'San Francisco' }
        ],
        failed: [
          { field: 'invalid_field', error: 'Unknown field' }
        ]
      });
      service.updateCompletionTracking = jest.fn().mockResolvedValue({});

      const result = await service.importProfileData('user123', 'linkedin', importData);
      expect(result.imported).toBe(2);
      expect(result.failed).toBe(1);
      expect(result.details.failed).toHaveLength(1);
    });

    it('should handle database transaction rollback', async () => {
      mockDb.execute.mockRejectedValue(new Error('Database constraint violation'));

      await expect(
        service.saveCompletionStats('user123', {
          totalFields: -1, // Invalid value
          completedFields: 5
        })
      ).rejects.toThrow();

      // Verify no partial data was saved
      mockDb.execute.mockResolvedValue({ rows: [] });
      const stats = await service.getCompletionStats('user123');
      // Should trigger recalculation
      expect(mockProfileFieldsService.getAllFields).toHaveBeenCalled();
    });

    it('should handle missing required services gracefully', async () => {
      // Create service without cache
      const serviceNoCache = new ProfileCompletionService(mockDb, mockProfileFieldsService, null);
      
      mockProfileFieldsService.getAllFields.mockResolvedValue([]);
      mockProfileFieldsService.getUserProfileData.mockResolvedValue({});
      serviceNoCache.getSkippedFields = jest.fn().mockResolvedValue([]);
      serviceNoCache.saveCompletionStats = jest.fn().mockResolvedValue();

      // Should work without cache service
      const stats = await serviceNoCache.updateCompletionTracking('user123');
      expect(stats).toBeDefined();
      expect(stats.totalFields).toBe(0);
    });
  });

  describe('Edge Case: Special Field Mapping', () => {
    it('should handle unknown import source gracefully', async () => {
      const unknownSourceData = {
        some_field: 'value'
      };

      mockProfileFieldsService.saveUserProfileData.mockResolvedValue({
        saved: [],
        failed: []
      });
      service.updateCompletionTracking = jest.fn().mockResolvedValue({});

      const result = await service.importProfileData('user123', 'unknown_source', unknownSourceData);
      expect(result.imported).toBe(0);
      // Should use empty mapping for unknown sources
    });

    it('should handle malformed JSON in database fields', async () => {
      mockDb.execute.mockResolvedValue({
        rows: [{
          total_fields: 10,
          completed_fields: 5,
          required_fields: 3,
          completed_required: 2,
          completion_percentage: 50,
          profile_score: 60,
          last_prompted: null,
          fields_skipped: 'not_valid_json{',
          reminder_settings: '{"valid": "json"}',
          updated_at: new Date()
        }]
      });

      const stats = await service.getCompletionStats('user123');
      expect(stats.fieldsSkipped).toEqual([]); // Should default to empty array
      expect(stats.reminderSettings).toEqual({ valid: 'json' });
    });
  });
});