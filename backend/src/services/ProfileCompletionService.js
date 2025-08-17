/**
 * ProfileCompletionService - Manages profile completion tracking and scoring
 */

const { ulid } = require('ulid');
const logger = require('../utils/logger');

class ProfileCompletionService {
  constructor(db, profileFieldsService, cacheService) {
    this.db = db;
    this.profileFieldsService = profileFieldsService;
    this.cacheService = cacheService;
    this.tablePrefix = 'pf_';
  }

  /**
   * Calculate and update profile completion for a user
   */
  async updateCompletionTracking(userId) {
    try {
      // Get all fields and user's profile data
      const [allFields, userProfile] = await Promise.all([
        this.profileFieldsService.getAllFields({ isActive: true }),
        this.profileFieldsService.getUserProfileData(userId, true)
      ]);

      // Separate essential and optional fields
      const essentialFields = allFields.filter(f => f.isEssential);
      const professionalFields = allFields.filter(f => f.fieldGroup === 'professional');
      const optionalFields = allFields.filter(f => !f.isEssential && f.fieldGroup !== 'professional');

      // Count completed fields
      const completedFieldNames = Object.keys(userProfile).filter(
        fieldName => {
          const value = userProfile[fieldName];
          return value !== null && value !== '' && 
                 (typeof value === 'object' ? value.value !== null && value.value !== '' : true);
        }
      );

      const completedEssential = essentialFields.filter(
        f => completedFieldNames.includes(f.fieldName)
      ).length;

      const completedProfessional = professionalFields.filter(
        f => completedFieldNames.includes(f.fieldName)
      ).length;

      const completedOptional = optionalFields.filter(
        f => completedFieldNames.includes(f.fieldName)
      ).length;

      // Calculate completion percentage
      const completionPercentage = allFields.length > 0
        ? Math.round((completedFieldNames.length / allFields.length) * 100)
        : 0;

      // Calculate profile score (weighted)
      const profileScore = this.calculateProfileScore({
        essentialFields,
        professionalFields,
        optionalFields,
        completedEssential,
        completedProfessional,
        completedOptional,
        userProfile
      });

      // Get skipped fields from prompts
      const skippedFields = await this.getSkippedFields(userId);

      // Prepare stats
      const stats = {
        totalFields: allFields.length,
        completedFields: completedFieldNames.length,
        requiredFields: essentialFields.length,
        completedRequired: completedEssential,
        completionPercentage,
        profileScore,
        fieldsSkipped: JSON.stringify(skippedFields)
      };

      // Update or insert completion record
      await this.saveCompletionStats(userId, stats);

      // Invalidate cache
      await this.cacheService?.delete(`profile:completion:${userId}`);

      return {
        ...stats,
        fieldsSkipped: skippedFields,
        breakdown: {
          essential: {
            total: essentialFields.length,
            completed: completedEssential,
            percentage: essentialFields.length > 0 
              ? Math.round((completedEssential / essentialFields.length) * 100)
              : 100
          },
          professional: {
            total: professionalFields.length,
            completed: completedProfessional,
            percentage: professionalFields.length > 0
              ? Math.round((completedProfessional / professionalFields.length) * 100)
              : 100
          },
          optional: {
            total: optionalFields.length,
            completed: completedOptional,
            percentage: optionalFields.length > 0
              ? Math.round((completedOptional / optionalFields.length) * 100)
              : 100
          }
        }
      };
    } catch (error) {
      logger.error('Failed to update completion tracking', { userId, error });
      throw error;
    }
  }

  /**
   * Calculate weighted profile score
   */
  calculateProfileScore(data) {
    const {
      essentialFields,
      professionalFields,
      optionalFields,
      completedEssential,
      completedProfessional,
      completedOptional,
      userProfile
    } = data;

    // Weight configuration
    const weights = {
      essential: 40,     // 40% weight for essential fields
      professional: 35,  // 35% weight for professional fields
      optional: 15,      // 15% weight for optional fields
      verified: 10       // 10% bonus for verified fields
    };

    let score = 0;

    // Essential fields score
    if (essentialFields.length > 0) {
      score += (completedEssential / essentialFields.length) * weights.essential;
    } else {
      score += weights.essential; // Full points if no essential fields defined
    }

    // Professional fields score
    if (professionalFields.length > 0) {
      score += (completedProfessional / professionalFields.length) * weights.professional;
    } else {
      score += weights.professional; // Full points if no professional fields defined
    }

    // Optional fields score
    if (optionalFields.length > 0) {
      score += (completedOptional / optionalFields.length) * weights.optional;
    } else {
      score += weights.optional; // Full points if no optional fields defined
    }

    // Bonus for verified fields
    const verifiedCount = Object.values(userProfile).filter(
      field => typeof field === 'object' && field.verified
    ).length;

    const totalFields = essentialFields.length + professionalFields.length + optionalFields.length;
    
    if (totalFields > 0) {
      const verificationBonus = (verifiedCount / totalFields) * weights.verified;
      score += verificationBonus;
    }

    return Math.min(100, Math.round(score));
  }

  /**
   * Get completion statistics for a user
   */
  async getCompletionStats(userId) {
    const cacheKey = `profile:completion:${userId}`;
    const cached = await this.cacheService?.get(cacheKey);
    if (cached) return cached;

    const query = `
      SELECT 
        total_fields,
        completed_fields,
        required_fields,
        completed_required,
        completion_percentage,
        profile_score,
        last_prompted,
        fields_skipped,
        reminder_settings,
        updated_at
      FROM ${this.tablePrefix}user_profile_completion
      WHERE user_id = :user_id
    `;

    const result = await this.db.execute(query, [userId]);

    if (result.rows.length === 0) {
      // Calculate and save initial stats
      return await this.updateCompletionTracking(userId);
    }

    const stats = {
      totalFields: result.rows[0].total_fields,
      completedFields: result.rows[0].completed_fields,
      requiredFields: result.rows[0].required_fields,
      completedRequired: result.rows[0].completed_required,
      completionPercentage: result.rows[0].completion_percentage,
      profileScore: result.rows[0].profile_score,
      lastPrompted: result.rows[0].last_prompted,
      fieldsSkipped: result.rows[0].fields_skipped ? JSON.parse(result.rows[0].fields_skipped) : [],
      reminderSettings: result.rows[0].reminder_settings ? JSON.parse(result.rows[0].reminder_settings) : {},
      updatedAt: result.rows[0].updated_at
    };

    await this.cacheService?.set(cacheKey, stats, 900); // Cache for 15 minutes
    return stats;
  }

  /**
   * Save completion statistics
   */
  async saveCompletionStats(userId, stats) {
    // Check if record exists
    const checkQuery = `
      SELECT completion_id FROM ${this.tablePrefix}user_profile_completion
      WHERE user_id = :user_id
    `;

    const existing = await this.db.execute(checkQuery, [userId]);

    if (existing.rows.length > 0) {
      // Update existing record
      const updateQuery = `
        UPDATE ${this.tablePrefix}user_profile_completion
        SET 
          total_fields = :total_fields,
          completed_fields = :completed_fields,
          required_fields = :required_fields,
          completed_required = :completed_required,
          completion_percentage = :completion_percentage,
          profile_score = :profile_score,
          fields_skipped = :fields_skipped,
          updated_at = CURRENT_TIMESTAMP
        WHERE user_id = :user_id
      `;

      await this.db.execute(updateQuery, {
        total_fields: stats.totalFields,
        completed_fields: stats.completedFields,
        required_fields: stats.requiredFields,
        completed_required: stats.completedRequired,
        completion_percentage: stats.completionPercentage,
        profile_score: stats.profileScore,
        fields_skipped: stats.fieldsSkipped,
        user_id: userId
      });
    } else {
      // Insert new record
      const insertQuery = `
        INSERT INTO ${this.tablePrefix}user_profile_completion (
          completion_id,
          user_id,
          total_fields,
          completed_fields,
          required_fields,
          completed_required,
          completion_percentage,
          profile_score,
          fields_skipped
        ) VALUES (
          :completion_id,
          :user_id,
          :total_fields,
          :completed_fields,
          :required_fields,
          :completed_required,
          :completion_percentage,
          :profile_score,
          :fields_skipped
        )
      `;

      await this.db.execute(insertQuery, {
        completion_id: ulid(),
        user_id: userId,
        total_fields: stats.totalFields,
        completed_fields: stats.completedFields,
        required_fields: stats.requiredFields,
        completed_required: stats.completedRequired,
        completion_percentage: stats.completionPercentage,
        profile_score: stats.profileScore,
        fields_skipped: stats.fieldsSkipped
      });
    }
  }

  /**
   * Create a field collection prompt
   */
  async createFieldPrompt(userId, fieldId, featureKey, promptType = 'modal') {
    // Check if prompt already exists and is pending
    const existingQuery = `
      SELECT prompt_id FROM ${this.tablePrefix}field_collection_prompts
      WHERE user_id = :user_id 
        AND field_id = :field_id 
        AND prompt_status = 'pending'
    `;

    const existing = await this.db.execute(existingQuery, [userId, fieldId]);

    if (existing.rows.length > 0) {
      return { promptId: existing.rows[0].prompt_id, alreadyExists: true };
    }

    // Create new prompt
    const promptId = ulid();
    
    const insertQuery = `
      INSERT INTO ${this.tablePrefix}field_collection_prompts (
        prompt_id,
        user_id,
        field_id,
        feature_key,
        prompt_type,
        prompt_status
      ) VALUES (
        :prompt_id,
        :user_id,
        :field_id,
        :feature_key,
        :prompt_type,
        'pending'
      )
    `;

    await this.db.execute(insertQuery, {
      prompt_id: promptId,
      user_id: userId,
      field_id: fieldId,
      feature_key: featureKey,
      prompt_type: promptType
    });

    // Update last prompted timestamp
    await this.updateLastPrompted(userId);

    return { promptId, alreadyExists: false };
  }

  /**
   * Update prompt response
   */
  async updatePromptResponse(promptId, response, remindAfter = null) {
    const updateQuery = `
      UPDATE ${this.tablePrefix}field_collection_prompts
      SET 
        prompt_status = :prompt_status,
        responded_at = CURRENT_TIMESTAMP,
        response = :response,
        remind_after = :remind_after
      WHERE prompt_id = :prompt_id
    `;

    const promptStatus = response === 'provided' ? 'completed' : 
                        response === 'skipped' ? 'skipped' : 
                        response === 'remind_later' ? 'deferred' : 'dismissed';

    await this.db.execute(updateQuery, {
      prompt_status: promptStatus,
      response,
      remind_after: remindAfter,
      prompt_id: promptId
    });

    return true;
  }

  /**
   * Get pending prompts for a user
   */
  async getPendingPrompts(userId) {
    const query = `
      SELECT 
        p.prompt_id,
        p.field_id,
        p.feature_key,
        p.prompt_type,
        p.created_at,
        f.field_name,
        f.field_label,
        f.field_type,
        f.help_text,
        f.placeholder,
        f.validation_rules,
        f.options
      FROM ${this.tablePrefix}field_collection_prompts p
      JOIN ${this.tablePrefix}profile_fields f ON p.field_id = f.field_id
      WHERE p.user_id = :user_id
        AND p.prompt_status = 'pending'
        AND (p.remind_after IS NULL OR p.remind_after <= CURRENT_TIMESTAMP)
      ORDER BY p.created_at
    `;

    const result = await this.db.execute(query, [userId]);

    return result.rows.map(row => ({
      promptId: row.prompt_id,
      fieldId: row.field_id,
      fieldName: row.field_name,
      fieldLabel: row.field_label,
      fieldType: row.field_type,
      featureKey: row.feature_key,
      promptType: row.prompt_type,
      helpText: row.help_text,
      placeholder: row.placeholder,
      validationRules: row.validation_rules ? JSON.parse(row.validation_rules) : null,
      options: row.options ? JSON.parse(row.options) : null,
      createdAt: row.created_at
    }));
  }

  /**
   * Get skipped fields for a user
   */
  async getSkippedFields(userId) {
    const query = `
      SELECT DISTINCT
        f.field_id,
        f.field_name,
        f.field_label,
        MAX(p.responded_at) as last_skipped
      FROM ${this.tablePrefix}field_collection_prompts p
      JOIN ${this.tablePrefix}profile_fields f ON p.field_id = f.field_id
      WHERE p.user_id = :user_id
        AND p.response = 'skipped'
      GROUP BY f.field_id, f.field_name, f.field_label
    `;

    const result = await this.db.execute(query, [userId]);

    return result.rows.map(row => ({
      fieldId: row.field_id,
      fieldName: row.field_name,
      fieldLabel: row.field_label,
      lastSkipped: row.last_skipped
    }));
  }

  /**
   * Update reminder settings for a user
   */
  async updateReminderSettings(userId, settings) {
    const updateQuery = `
      UPDATE ${this.tablePrefix}user_profile_completion
      SET 
        reminder_settings = :reminder_settings,
        updated_at = CURRENT_TIMESTAMP
      WHERE user_id = :user_id
    `;

    await this.db.execute(updateQuery, {
      reminder_settings: JSON.stringify(settings),
      user_id: userId
    });

    // Invalidate cache
    await this.cacheService?.delete(`profile:completion:${userId}`);

    return true;
  }

  /**
   * Update last prompted timestamp
   */
  async updateLastPrompted(userId) {
    const updateQuery = `
      UPDATE ${this.tablePrefix}user_profile_completion
      SET last_prompted = CURRENT_TIMESTAMP
      WHERE user_id = :user_id
    `;

    const result = await this.db.execute(updateQuery, [userId]);

    // If no record exists, create one
    if (result.rowsAffected === 0) {
      await this.updateCompletionTracking(userId);
    }
  }

  /**
   * Get field completion suggestions for a user
   */
  async getFieldSuggestions(userId, limit = 5) {
    // Get user's current profile
    const userProfile = await this.profileFieldsService.getUserProfileData(userId);
    
    // Get all active fields
    const allFields = await this.profileFieldsService.getAllFields({ isActive: true });

    // Find incomplete fields
    const incompleteFields = allFields.filter(
      field => !userProfile[field.fieldName] || userProfile[field.fieldName] === ''
    );

    // Sort by priority (essential first, then professional, then by display order)
    incompleteFields.sort((a, b) => {
      if (a.isEssential !== b.isEssential) {
        return a.isEssential ? -1 : 1;
      }
      if (a.fieldGroup === 'professional' && b.fieldGroup !== 'professional') {
        return -1;
      }
      if (a.fieldGroup !== 'professional' && b.fieldGroup === 'professional') {
        return 1;
      }
      return a.displayOrder - b.displayOrder;
    });

    // Get skipped fields to deprioritize them
    const skippedFields = await this.getSkippedFields(userId);
    const skippedFieldIds = new Set(skippedFields.map(f => f.fieldId));

    // Separate skipped and non-skipped fields
    const nonSkipped = incompleteFields.filter(f => !skippedFieldIds.has(f.fieldId));
    const skipped = incompleteFields.filter(f => skippedFieldIds.has(f.fieldId));

    // Combine with non-skipped first
    const prioritizedFields = [...nonSkipped, ...skipped];

    // Return top suggestions
    return prioritizedFields.slice(0, limit).map(field => ({
      fieldId: field.fieldId,
      fieldName: field.fieldName,
      fieldLabel: field.fieldLabel,
      fieldType: field.fieldType,
      fieldGroup: field.fieldGroup,
      helpText: field.helpText,
      placeholder: field.placeholder,
      isEssential: field.isEssential,
      validationRules: field.validationRules,
      options: field.options,
      reason: field.isEssential ? 'Essential field' : 
              field.fieldGroup === 'professional' ? 'Improve professional profile' :
              'Complete your profile'
    }));
  }

  /**
   * Import profile data from external source
   */
  async importProfileData(userId, source, importData) {
    const fieldMapping = this.getFieldMapping(source);
    const mappedData = {};

    for (const [sourceField, profileField] of Object.entries(fieldMapping)) {
      const value = this.getNestedValue(importData, sourceField);
      if (value !== undefined && value !== null && value !== '') {
        mappedData[profileField] = value;
      }
    }

    // Save the mapped data
    const result = await this.profileFieldsService.saveUserProfileData(
      userId,
      mappedData,
      `${source}_import`
    );

    // Update completion tracking
    await this.updateCompletionTracking(userId);

    return {
      imported: result.saved.length,
      failed: result.failed.length,
      details: result
    };
  }

  /**
   * Get field mapping for different import sources
   */
  getFieldMapping(source) {
    const mappings = {
      linkedin: {
        'headline': 'professional_headline',
        'summary': 'bio',
        'location.name': 'location',
        'positions[0].title': 'current_title',
        'positions[0].company.name': 'current_company',
        'skills': 'skills',
        'educations[0].school.name': 'education_institution',
        'educations[0].degree': 'highest_degree',
        'educations[0].fieldOfStudy': 'field_of_study',
        'phoneNumbers[0].number': 'phone_number',
        'websites[0].url': 'portfolio_url'
      },
      resume: {
        'contact.email': 'email',
        'contact.phone': 'phone_number',
        'contact.location': 'location',
        'summary': 'bio',
        'experience[0].title': 'current_title',
        'experience[0].company': 'current_company',
        'skills': 'skills',
        'education[0].institution': 'education_institution',
        'education[0].degree': 'highest_degree',
        'education[0].field': 'field_of_study'
      }
    };

    return mappings[source] || {};
  }

  /**
   * Get nested value from object using dot notation
   */
  getNestedValue(obj, path) {
    const keys = path.split('.');
    let value = obj;

    for (const key of keys) {
      if (key.includes('[') && key.includes(']')) {
        // Handle array notation
        const [arrayKey, indexStr] = key.split('[');
        const index = parseInt(indexStr.replace(']', ''));
        
        if (value[arrayKey] && Array.isArray(value[arrayKey]) && value[arrayKey][index]) {
          value = value[arrayKey][index];
        } else {
          return undefined;
        }
      } else {
        if (value && typeof value === 'object' && key in value) {
          value = value[key];
        } else {
          return undefined;
        }
      }
    }

    return value;
  }
}

module.exports = ProfileCompletionService;