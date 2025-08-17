/**
 * ProfileFieldsService - Manages profile field definitions and requirements
 */

const { ulid } = require('ulid');
const logger = require('../utils/logger');

class ProfileFieldsService {
  constructor(db, encryptionService, cacheService) {
    this.db = db;
    this.encryptionService = encryptionService;
    this.cacheService = cacheService;
    this.tablePrefix = 'pf_';
  }

  /**
   * Get all profile fields with optional filtering
   */
  async getAllFields(filters = {}) {
    const cacheKey = `profile:fields:${JSON.stringify(filters)}`;
    const cached = await this.cacheService?.get(cacheKey);
    if (cached) return cached;

    let query = `
      SELECT 
        field_id,
        field_name,
        field_label,
        field_type,
        field_group,
        validation_rules,
        options,
        help_text,
        placeholder,
        default_value,
        is_essential,
        is_sensitive,
        encryption_required,
        display_order,
        is_active
      FROM ${this.tablePrefix}profile_fields
      WHERE 1=1
    `;

    const params = [];
    
    if (filters.group) {
      query += ` AND field_group = :field_group`;
      params.push(filters.group);
    }

    if (filters.isEssential !== undefined) {
      query += ` AND is_essential = :is_essential`;
      params.push(filters.isEssential ? 'Y' : 'N');
    }

    if (filters.isActive !== undefined) {
      query += ` AND is_active = :is_active`;
      params.push(filters.isActive ? 'Y' : 'N');
    }

    query += ` ORDER BY display_order, field_name`;

    const result = await this.db.execute(query, params);
    const fields = result.rows.map(row => this.transformField(row));

    await this.cacheService?.set(cacheKey, fields, 3600); // Cache for 1 hour
    return fields;
  }

  /**
   * Get a specific field by ID or name
   */
  async getField(fieldIdentifier) {
    const query = `
      SELECT * FROM ${this.tablePrefix}profile_fields
      WHERE field_id = :identifier OR field_name = :identifier
    `;

    const result = await this.db.execute(query, [fieldIdentifier]);
    
    if (result.rows.length === 0) {
      return null;
    }

    return this.transformField(result.rows[0]);
  }

  /**
   * Create a new profile field
   */
  async createField(fieldData) {
    const fieldId = ulid();
    
    const query = `
      INSERT INTO ${this.tablePrefix}profile_fields (
        field_id,
        field_name,
        field_label,
        field_type,
        field_group,
        validation_rules,
        options,
        help_text,
        placeholder,
        default_value,
        is_essential,
        is_sensitive,
        encryption_required,
        display_order,
        is_active
      ) VALUES (
        :field_id,
        :field_name,
        :field_label,
        :field_type,
        :field_group,
        :validation_rules,
        :options,
        :help_text,
        :placeholder,
        :default_value,
        :is_essential,
        :is_sensitive,
        :encryption_required,
        :display_order,
        :is_active
      )
    `;

    const params = {
      field_id: fieldId,
      field_name: fieldData.fieldName,
      field_label: fieldData.fieldLabel,
      field_type: fieldData.fieldType,
      field_group: fieldData.fieldGroup || null,
      validation_rules: fieldData.validationRules ? JSON.stringify(fieldData.validationRules) : null,
      options: fieldData.options ? JSON.stringify(fieldData.options) : null,
      help_text: fieldData.helpText || null,
      placeholder: fieldData.placeholder || null,
      default_value: fieldData.defaultValue || null,
      is_essential: fieldData.isEssential ? 'Y' : 'N',
      is_sensitive: fieldData.isSensitive ? 'Y' : 'N',
      encryption_required: fieldData.encryptionRequired ? 'Y' : 'N',
      display_order: fieldData.displayOrder || 0,
      is_active: fieldData.isActive !== false ? 'Y' : 'N'
    };

    await this.db.execute(query, params);
    await this.invalidateFieldCache();

    return { fieldId, ...fieldData };
  }

  /**
   * Update an existing field
   */
  async updateField(fieldId, updates) {
    const updateFields = [];
    const params = { field_id: fieldId };

    if (updates.fieldLabel !== undefined) {
      updateFields.push('field_label = :field_label');
      params.field_label = updates.fieldLabel;
    }

    if (updates.fieldType !== undefined) {
      updateFields.push('field_type = :field_type');
      params.field_type = updates.fieldType;
    }

    if (updates.fieldGroup !== undefined) {
      updateFields.push('field_group = :field_group');
      params.field_group = updates.fieldGroup;
    }

    if (updates.validationRules !== undefined) {
      updateFields.push('validation_rules = :validation_rules');
      params.validation_rules = JSON.stringify(updates.validationRules);
    }

    if (updates.options !== undefined) {
      updateFields.push('options = :options');
      params.options = JSON.stringify(updates.options);
    }

    if (updates.helpText !== undefined) {
      updateFields.push('help_text = :help_text');
      params.help_text = updates.helpText;
    }

    if (updates.placeholder !== undefined) {
      updateFields.push('placeholder = :placeholder');
      params.placeholder = updates.placeholder;
    }

    if (updates.defaultValue !== undefined) {
      updateFields.push('default_value = :default_value');
      params.default_value = updates.defaultValue;
    }

    if (updates.isEssential !== undefined) {
      updateFields.push('is_essential = :is_essential');
      params.is_essential = updates.isEssential ? 'Y' : 'N';
    }

    if (updates.isSensitive !== undefined) {
      updateFields.push('is_sensitive = :is_sensitive');
      params.is_sensitive = updates.isSensitive ? 'Y' : 'N';
    }

    if (updates.encryptionRequired !== undefined) {
      updateFields.push('encryption_required = :encryption_required');
      params.encryption_required = updates.encryptionRequired ? 'Y' : 'N';
    }

    if (updates.displayOrder !== undefined) {
      updateFields.push('display_order = :display_order');
      params.display_order = updates.displayOrder;
    }

    if (updates.isActive !== undefined) {
      updateFields.push('is_active = :is_active');
      params.is_active = updates.isActive ? 'Y' : 'N';
    }

    if (updateFields.length === 0) {
      return false;
    }

    updateFields.push('updated_at = CURRENT_TIMESTAMP');

    const query = `
      UPDATE ${this.tablePrefix}profile_fields
      SET ${updateFields.join(', ')}
      WHERE field_id = :field_id
    `;

    const result = await this.db.execute(query, params);
    await this.invalidateFieldCache();

    return result.rowsAffected > 0;
  }

  /**
   * Get feature requirements for a specific feature
   */
  async getFeatureRequirements(featureKey) {
    const cacheKey = `profile:requirements:${featureKey}`;
    const cached = await this.cacheService?.get(cacheKey);
    if (cached) return cached;

    const query = `
      SELECT 
        r.requirement_id,
        r.feature_key,
        r.field_id,
        r.is_required,
        r.requirement_level,
        r.custom_message,
        r.alternative_fields,
        f.field_name,
        f.field_label,
        f.field_type,
        f.validation_rules,
        f.options,
        f.help_text,
        f.placeholder,
        f.is_essential,
        f.is_sensitive,
        f.encryption_required
      FROM ${this.tablePrefix}feature_field_requirements r
      JOIN ${this.tablePrefix}profile_fields f ON r.field_id = f.field_id
      WHERE r.feature_key = :feature_key
        AND f.is_active = 'Y'
      ORDER BY 
        CASE r.requirement_level 
          WHEN 'required' THEN 1
          WHEN 'recommended' THEN 2
          ELSE 3
        END,
        f.display_order
    `;

    const result = await this.db.execute(query, [featureKey]);
    const requirements = result.rows.map(row => this.transformRequirement(row));

    await this.cacheService?.set(cacheKey, requirements, 3600);
    return requirements;
  }

  /**
   * Set feature requirements
   */
  async setFeatureRequirements(featureKey, requirements) {
    const connection = await this.db.getConnection();
    
    try {
      await connection.execute('BEGIN');

      // Delete existing requirements for this feature
      await connection.execute(
        `DELETE FROM ${this.tablePrefix}feature_field_requirements WHERE feature_key = :feature_key`,
        [featureKey]
      );

      // Insert new requirements
      for (const req of requirements) {
        const requirementId = ulid();
        
        const query = `
          INSERT INTO ${this.tablePrefix}feature_field_requirements (
            requirement_id,
            feature_key,
            field_id,
            is_required,
            requirement_level,
            custom_message,
            alternative_fields
          ) VALUES (
            :requirement_id,
            :feature_key,
            :field_id,
            :is_required,
            :requirement_level,
            :custom_message,
            :alternative_fields
          )
        `;

        const params = {
          requirement_id: requirementId,
          feature_key: featureKey,
          field_id: req.fieldId,
          is_required: req.isRequired !== false ? 'Y' : 'N',
          requirement_level: req.requirementLevel || 'required',
          custom_message: req.customMessage || null,
          alternative_fields: req.alternativeFields ? JSON.stringify(req.alternativeFields) : null
        };

        await connection.execute(query, params);
      }

      await connection.commit();
      await this.invalidateRequirementsCache(featureKey);

      return true;
    } catch (error) {
      await connection.rollback();
      logger.error('Failed to set feature requirements', { featureKey, error });
      throw error;
    } finally {
      await connection.close();
    }
  }

  /**
   * Get user's profile data
   */
  async getUserProfileData(userId, includeMetadata = false) {
    const query = `
      SELECT 
        d.data_id,
        d.field_id,
        d.field_value,
        d.field_value_encrypted,
        d.verified,
        d.verified_at,
        d.verified_by,
        d.source,
        d.updated_at,
        f.field_name,
        f.field_label,
        f.field_type,
        f.field_group,
        f.is_sensitive,
        f.encryption_required
      FROM ${this.tablePrefix}user_profile_data d
      JOIN ${this.tablePrefix}profile_fields f ON d.field_id = f.field_id
      WHERE d.user_id = :user_id
        AND f.is_active = 'Y'
    `;

    const result = await this.db.execute(query, [userId]);
    const profileData = {};

    for (const row of result.rows) {
      let value = row.field_value;

      // Decrypt if necessary
      if (row.field_value_encrypted && this.encryptionService) {
        try {
          value = await this.encryptionService.decryptField(
            row.field_value_encrypted,
            userId
          );
        } catch (error) {
          logger.error('Failed to decrypt field', { 
            fieldId: row.field_id, 
            userId,
            error 
          });
          continue;
        }
      }

      if (includeMetadata) {
        profileData[row.field_name] = {
          value,
          fieldId: row.field_id,
          fieldLabel: row.field_label,
          fieldType: row.field_type,
          fieldGroup: row.field_group,
          verified: row.verified === 'Y',
          verifiedAt: row.verified_at,
          verifiedBy: row.verified_by,
          source: row.source,
          updatedAt: row.updated_at
        };
      } else {
        profileData[row.field_name] = value;
      }
    }

    return profileData;
  }

  /**
   * Save user profile data
   */
  async saveUserProfileData(userId, fieldData, source = 'manual') {
    const results = {
      saved: [],
      failed: [],
      validated: true
    };

    const connection = await this.db.getConnection();

    try {
      await connection.execute('BEGIN');

      for (const [fieldName, value] of Object.entries(fieldData)) {
        try {
          // Get field definition
          const field = await this.getField(fieldName);
          if (!field) {
            results.failed.push({
              field: fieldName,
              error: 'Unknown field'
            });
            continue;
          }

          // Validate field value
          const validation = await this.validateFieldValue(field, value);
          if (!validation.valid) {
            results.failed.push({
              field: fieldName,
              error: validation.error
            });
            results.validated = false;
            continue;
          }

          // Prepare value for storage
          let fieldValue = validation.normalized;
          let encryptedValue = null;

          if (field.encryptionRequired && this.encryptionService) {
            encryptedValue = await this.encryptionService.encryptField(
              fieldValue,
              userId
            );
            fieldValue = null; // Don't store plain text
          }

          // Check if record exists
          const existingQuery = `
            SELECT data_id FROM ${this.tablePrefix}user_profile_data
            WHERE user_id = :user_id AND field_id = :field_id
          `;

          const existing = await connection.execute(existingQuery, [userId, field.fieldId]);

          if (existing.rows.length > 0) {
            // Update existing record
            const updateQuery = `
              UPDATE ${this.tablePrefix}user_profile_data
              SET 
                field_value = :field_value,
                field_value_encrypted = :field_value_encrypted,
                source = :source,
                updated_at = CURRENT_TIMESTAMP
              WHERE user_id = :user_id AND field_id = :field_id
            `;

            await connection.execute(updateQuery, {
              field_value: fieldValue,
              field_value_encrypted: encryptedValue,
              source,
              user_id: userId,
              field_id: field.fieldId
            });
          } else {
            // Insert new record
            const insertQuery = `
              INSERT INTO ${this.tablePrefix}user_profile_data (
                data_id,
                user_id,
                field_id,
                field_value,
                field_value_encrypted,
                source
              ) VALUES (
                :data_id,
                :user_id,
                :field_id,
                :field_value,
                :field_value_encrypted,
                :source
              )
            `;

            await connection.execute(insertQuery, {
              data_id: ulid(),
              user_id: userId,
              field_id: field.fieldId,
              field_value: fieldValue,
              field_value_encrypted: encryptedValue,
              source
            });
          }

          results.saved.push({
            field: fieldName,
            value: validation.normalized
          });

        } catch (error) {
          logger.error('Failed to save field data', {
            userId,
            field: fieldName,
            error
          });
          results.failed.push({
            field: fieldName,
            error: 'Save failed'
          });
        }
      }

      await connection.commit();

      // Invalidate user profile cache
      await this.cacheService?.delete(`profile:user:${userId}`);

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      await connection.close();
    }

    return results;
  }

  /**
   * Validate field value based on validation rules
   */
  async validateFieldValue(field, value) {
    const validation = { valid: true, normalized: value, error: null };

    if (!value && field.isEssential) {
      return {
        valid: false,
        error: `${field.fieldLabel} is required`,
        normalized: null
      };
    }

    if (!value) {
      return validation; // Empty non-essential field is valid
    }

    const rules = field.validationRules || {};

    // Type validation
    switch (field.fieldType) {
      case 'email':
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
          return { valid: false, error: 'Invalid email format', normalized: null };
        }
        validation.normalized = value.toLowerCase();
        break;

      case 'phone':
        const phoneRegex = /^[\d\s\-\+\(\)]+$/;
        if (!phoneRegex.test(value)) {
          return { valid: false, error: 'Invalid phone number', normalized: null };
        }
        validation.normalized = value.replace(/[\s\-\(\)]/g, '');
        break;

      case 'date':
        const date = new Date(value);
        if (isNaN(date.getTime())) {
          return { valid: false, error: 'Invalid date format', normalized: null };
        }
        validation.normalized = date.toISOString().split('T')[0];
        break;

      case 'number':
        const num = Number(value);
        if (isNaN(num)) {
          return { valid: false, error: 'Must be a number', normalized: null };
        }
        validation.normalized = num;
        break;

      case 'select':
        if (field.options && !field.options.find(opt => opt.value === value)) {
          return { valid: false, error: 'Invalid selection', normalized: null };
        }
        break;
    }

    // Custom validation rules
    if (rules.minLength && value.length < rules.minLength) {
      return {
        valid: false,
        error: `Minimum ${rules.minLength} characters required`,
        normalized: null
      };
    }

    if (rules.maxLength && value.length > rules.maxLength) {
      return {
        valid: false,
        error: `Maximum ${rules.maxLength} characters allowed`,
        normalized: null
      };
    }

    if (rules.pattern) {
      const regex = new RegExp(rules.pattern);
      if (!regex.test(value)) {
        return {
          valid: false,
          error: rules.patternMessage || 'Invalid format',
          normalized: null
        };
      }
    }

    if (rules.min !== undefined && Number(value) < rules.min) {
      return {
        valid: false,
        error: `Value must be at least ${rules.min}`,
        normalized: null
      };
    }

    if (rules.max !== undefined && Number(value) > rules.max) {
      return {
        valid: false,
        error: `Value must be at most ${rules.max}`,
        normalized: null
      };
    }

    return validation;
  }

  /**
   * Check if user has required fields for a feature
   */
  async checkFeatureAccess(userId, featureKey) {
    const requirements = await this.getFeatureRequirements(featureKey);
    const userProfile = await this.getUserProfileData(userId);

    const missingRequired = [];
    const missingRecommended = [];

    for (const req of requirements) {
      const hasValue = userProfile[req.fieldName] !== undefined && 
                       userProfile[req.fieldName] !== null &&
                       userProfile[req.fieldName] !== '';

      if (!hasValue) {
        // Check alternative fields if specified
        if (req.alternativeFields && req.alternativeFields.length > 0) {
          const hasAlternative = req.alternativeFields.some(
            altField => userProfile[altField] !== undefined && 
                       userProfile[altField] !== null &&
                       userProfile[altField] !== ''
          );

          if (hasAlternative) {
            continue;
          }
        }

        if (req.requirementLevel === 'required') {
          missingRequired.push({
            fieldId: req.fieldId,
            fieldName: req.fieldName,
            fieldLabel: req.fieldLabel,
            fieldType: req.fieldType,
            validationRules: req.validationRules,
            options: req.options,
            helpText: req.helpText,
            placeholder: req.placeholder,
            customMessage: req.customMessage
          });
        } else if (req.requirementLevel === 'recommended') {
          missingRecommended.push({
            fieldId: req.fieldId,
            fieldName: req.fieldName,
            fieldLabel: req.fieldLabel
          });
        }
      }
    }

    const totalRequired = requirements.filter(r => r.requirementLevel === 'required').length;
    const completedRequired = totalRequired - missingRequired.length;
    const completionPercentage = totalRequired > 0 
      ? Math.round((completedRequired / totalRequired) * 100)
      : 100;

    return {
      canAccess: missingRequired.length === 0,
      missingRequired,
      missingRecommended,
      completionPercentage,
      totalRequired,
      completedRequired
    };
  }

  /**
   * Transform database row to field object
   */
  transformField(row) {
    return {
      fieldId: row.field_id,
      fieldName: row.field_name,
      fieldLabel: row.field_label,
      fieldType: row.field_type,
      fieldGroup: row.field_group,
      validationRules: row.validation_rules ? JSON.parse(row.validation_rules) : null,
      options: row.options ? JSON.parse(row.options) : null,
      helpText: row.help_text,
      placeholder: row.placeholder,
      defaultValue: row.default_value,
      isEssential: row.is_essential === 'Y',
      isSensitive: row.is_sensitive === 'Y',
      encryptionRequired: row.encryption_required === 'Y',
      displayOrder: row.display_order,
      isActive: row.is_active === 'Y'
    };
  }

  /**
   * Transform database row to requirement object
   */
  transformRequirement(row) {
    return {
      requirementId: row.requirement_id,
      featureKey: row.feature_key,
      fieldId: row.field_id,
      fieldName: row.field_name,
      fieldLabel: row.field_label,
      fieldType: row.field_type,
      isRequired: row.is_required === 'Y',
      requirementLevel: row.requirement_level,
      customMessage: row.custom_message,
      alternativeFields: row.alternative_fields ? JSON.parse(row.alternative_fields) : null,
      validationRules: row.validation_rules ? JSON.parse(row.validation_rules) : null,
      options: row.options ? JSON.parse(row.options) : null,
      helpText: row.help_text,
      placeholder: row.placeholder,
      isEssential: row.is_essential === 'Y',
      isSensitive: row.is_sensitive === 'Y',
      encryptionRequired: row.encryption_required === 'Y'
    };
  }

  /**
   * Invalidate field cache
   */
  async invalidateFieldCache() {
    if (this.cacheService) {
      const pattern = 'profile:fields:*';
      await this.cacheService.deletePattern(pattern);
    }
  }

  /**
   * Invalidate requirements cache for a feature
   */
  async invalidateRequirementsCache(featureKey) {
    if (this.cacheService) {
      await this.cacheService.delete(`profile:requirements:${featureKey}`);
    }
  }
}

module.exports = ProfileFieldsService;