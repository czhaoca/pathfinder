# Issue #23: Progressive Profile Data Collection System

## Title
Implement Progressive Profile Data Collection with Dynamic Field Requirements

## User Story
As a product manager, I want to collect user profile data progressively based on the features they use, so that we minimize friction during onboarding while ensuring we have necessary data when features require it.

## Description
Build a flexible system that collects user profile information progressively. Essential fields (email, name, password) are collected at registration, while extended profile data is requested only when users access features that require it. This reduces onboarding friction while ensuring data completeness for feature functionality.

## Acceptance Criteria

### Core System
- [ ] Define field requirement metadata for all profile fields
- [ ] Implement lazy loading of profile data
- [ ] Create field validation framework with custom validators
- [ ] Build profile completion tracking system
- [ ] Implement profile data caching layer
- [ ] Create profile completeness scoring algorithm

### Field Management
- [ ] Essential fields enforced at registration (email, name, password)
- [ ] Feature-specific field requirements mapping
- [ ] Optional vs required field designation per feature
- [ ] Field grouping for logical data collection
- [ ] Progressive disclosure UI components
- [ ] Skip/remind-later functionality for non-critical fields

### User Experience
- [ ] Non-blocking prompts for missing data
- [ ] In-context data collection when accessing features
- [ ] Profile completion progress indicator
- [ ] Bulk profile update interface
- [ ] Smart suggestions for profile completion
- [ ] Data import from LinkedIn/resume

### Data Quality
- [ ] Field-level validation rules
- [ ] Format standardization (phone, address, etc.)
- [ ] Duplicate detection for key fields
- [ ] Data completeness reporting
- [ ] Missing data impact analysis
- [ ] Data quality scoring

## Technical Implementation

### Database Schema

```sql
-- Profile field definitions
CREATE TABLE pf_profile_fields (
  field_id VARCHAR2(26) DEFAULT SYS_GUID() PRIMARY KEY,
  field_name VARCHAR2(100) UNIQUE NOT NULL,
  field_label VARCHAR2(200) NOT NULL,
  field_type VARCHAR2(50) NOT NULL, -- text, email, phone, date, select, etc.
  field_group VARCHAR2(100), -- personal, professional, preferences, etc.
  validation_rules CLOB CHECK (validation_rules IS JSON),
  options CLOB CHECK (options IS JSON), -- for select/multi-select fields
  help_text VARCHAR2(500),
  placeholder VARCHAR2(200),
  default_value VARCHAR2(500),
  is_essential CHAR(1) DEFAULT 'N' CHECK (is_essential IN ('Y', 'N')),
  is_sensitive CHAR(1) DEFAULT 'N' CHECK (is_sensitive IN ('Y', 'N')),
  encryption_required CHAR(1) DEFAULT 'N' CHECK (encryption_required IN ('Y', 'N')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Feature field requirements
CREATE TABLE pf_feature_field_requirements (
  requirement_id VARCHAR2(26) DEFAULT SYS_GUID() PRIMARY KEY,
  feature_key VARCHAR2(100) NOT NULL,
  field_id VARCHAR2(26) NOT NULL,
  is_required CHAR(1) DEFAULT 'Y' CHECK (is_required IN ('Y', 'N')),
  requirement_level VARCHAR2(20) DEFAULT 'required', -- required, recommended, optional
  custom_message VARCHAR2(500),
  alternative_fields CLOB CHECK (alternative_fields IS JSON), -- alternative fields that can satisfy requirement
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_ffr_field FOREIGN KEY (field_id) 
    REFERENCES pf_profile_fields(field_id) ON DELETE CASCADE,
  INDEX idx_ffr_feature (feature_key),
  INDEX idx_ffr_field (field_id)
);

-- User profile data (flexible key-value store)
CREATE TABLE pf_user_profile_data (
  data_id VARCHAR2(26) DEFAULT SYS_GUID() PRIMARY KEY,
  user_id VARCHAR2(26) NOT NULL,
  field_id VARCHAR2(26) NOT NULL,
  field_value CLOB,
  field_value_encrypted VARCHAR2(2000), -- for sensitive data
  verified CHAR(1) DEFAULT 'N' CHECK (verified IN ('Y', 'N')),
  verified_at TIMESTAMP,
  verified_by VARCHAR2(26),
  source VARCHAR2(50), -- manual, import, api, etc.
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_upd_user FOREIGN KEY (user_id) 
    REFERENCES pf_users(user_id) ON DELETE CASCADE,
  CONSTRAINT fk_upd_field FOREIGN KEY (field_id) 
    REFERENCES pf_profile_fields(field_id) ON DELETE CASCADE,
  UNIQUE (user_id, field_id),
  INDEX idx_upd_user (user_id),
  INDEX idx_upd_field (field_id)
);

-- Profile completion tracking
CREATE TABLE pf_user_profile_completion (
  completion_id VARCHAR2(26) DEFAULT SYS_GUID() PRIMARY KEY,
  user_id VARCHAR2(26) UNIQUE NOT NULL,
  total_fields NUMBER(10) DEFAULT 0,
  completed_fields NUMBER(10) DEFAULT 0,
  required_fields NUMBER(10) DEFAULT 0,
  completed_required NUMBER(10) DEFAULT 0,
  completion_percentage NUMBER(5,2) DEFAULT 0,
  profile_score NUMBER(5,2) DEFAULT 0,
  last_prompted TIMESTAMP,
  fields_skipped CLOB CHECK (fields_skipped IS JSON),
  reminder_settings CLOB CHECK (reminder_settings IS JSON),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_upc_user FOREIGN KEY (user_id) 
    REFERENCES pf_users(user_id) ON DELETE CASCADE
);

-- Field collection prompts
CREATE TABLE pf_field_collection_prompts (
  prompt_id VARCHAR2(26) DEFAULT SYS_GUID() PRIMARY KEY,
  user_id VARCHAR2(26) NOT NULL,
  field_id VARCHAR2(26) NOT NULL,
  feature_key VARCHAR2(100),
  prompt_type VARCHAR2(50), -- modal, inline, notification, etc.
  prompt_status VARCHAR2(50), -- pending, shown, completed, skipped, dismissed
  shown_at TIMESTAMP,
  responded_at TIMESTAMP,
  response VARCHAR2(50), -- provided, skipped, remind_later
  remind_after TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_fcp_user FOREIGN KEY (user_id) 
    REFERENCES pf_users(user_id) ON DELETE CASCADE,
  CONSTRAINT fk_fcp_field FOREIGN KEY (field_id) 
    REFERENCES pf_profile_fields(field_id) ON DELETE CASCADE,
  INDEX idx_fcp_user_status (user_id, prompt_status),
  INDEX idx_fcp_remind (remind_after)
);
```

### Service Implementation

```javascript
// backend/src/services/profileCollectionService.js
class ProfileCollectionService {
  constructor(profileRepository, cacheService, validationService) {
    this.profileRepository = profileRepository;
    this.cacheService = cacheService;
    this.validationService = validationService;
  }

  async checkFeatureRequirements(userId, featureKey) {
    // Get required fields for feature
    const requirements = await this.profileRepository.getFeatureRequirements(featureKey);
    
    // Get user's current profile data
    const userProfile = await this.getUserProfile(userId);
    
    // Check which fields are missing
    const missingFields = [];
    const recommendedFields = [];
    
    for (const req of requirements) {
      const fieldData = userProfile[req.fieldName];
      
      if (!fieldData || !fieldData.value) {
        if (req.requirementLevel === 'required') {
          missingFields.push({
            fieldId: req.fieldId,
            fieldName: req.fieldName,
            fieldLabel: req.fieldLabel,
            fieldType: req.fieldType,
            validationRules: req.validationRules,
            customMessage: req.customMessage
          });
        } else if (req.requirementLevel === 'recommended') {
          recommendedFields.push({
            fieldId: req.fieldId,
            fieldName: req.fieldName,
            fieldLabel: req.fieldLabel
          });
        }
      }
    }
    
    return {
      canAccess: missingFields.length === 0,
      missingRequired: missingFields,
      missingRecommended: recommendedFields,
      completionPercentage: this.calculateCompletion(userProfile, requirements)
    };
  }

  async collectProfileData(userId, fieldData, source = 'manual') {
    const results = {
      saved: [],
      failed: [],
      validated: true
    };

    for (const [fieldName, value] of Object.entries(fieldData)) {
      try {
        // Get field definition
        const field = await this.profileRepository.getFieldByName(fieldName);
        if (!field) {
          results.failed.push({
            field: fieldName,
            error: 'Unknown field'
          });
          continue;
        }

        // Validate field value
        const validation = await this.validationService.validateField(
          field,
          value
        );
        
        if (!validation.valid) {
          results.failed.push({
            field: fieldName,
            error: validation.error
          });
          results.validated = false;
          continue;
        }

        // Encrypt if necessary
        let fieldValue = validation.normalized;
        let encryptedValue = null;
        
        if (field.encryptionRequired === 'Y') {
          encryptedValue = await this.encryptionService.encryptField(
            fieldValue,
            userId
          );
          fieldValue = null; // Don't store plain text
        }

        // Save to database
        await this.profileRepository.saveFieldData({
          userId,
          fieldId: field.fieldId,
          fieldValue,
          fieldValueEncrypted: encryptedValue,
          source
        });

        results.saved.push({
          field: fieldName,
          value: validation.normalized
        });

        // Invalidate cache
        await this.cacheService.invalidate(`profile:${userId}`);
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

    // Update completion tracking
    await this.updateCompletionTracking(userId);

    return results;
  }

  async getUserProfile(userId, includeMetadata = false) {
    // Check cache first
    const cacheKey = `profile:${userId}`;
    const cached = await this.cacheService.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Load from database
    const profileData = await this.profileRepository.getUserProfileData(userId);
    
    // Transform to usable format
    const profile = {};
    for (const data of profileData) {
      const value = data.fieldValueEncrypted 
        ? await this.encryptionService.decryptField(data.fieldValueEncrypted, userId)
        : data.fieldValue;

      profile[data.fieldName] = includeMetadata ? {
        value,
        verified: data.verified === 'Y',
        verifiedAt: data.verifiedAt,
        source: data.source,
        updatedAt: data.updatedAt
      } : value;
    }

    // Cache for 15 minutes
    await this.cacheService.set(cacheKey, profile, 900);

    return profile;
  }

  async importFromLinkedIn(userId, linkedInData) {
    const fieldMapping = {
      'headline': 'professional_headline',
      'summary': 'bio',
      'location.name': 'location',
      'positions[0].title': 'current_title',
      'positions[0].company.name': 'current_company',
      'skills': 'skills',
      'educations[0].degree': 'highest_degree',
      'educations[0].fieldOfStudy': 'field_of_study'
    };

    const mappedData = {};
    for (const [linkedInField, profileField] of Object.entries(fieldMapping)) {
      const value = this.getNestedValue(linkedInData, linkedInField);
      if (value) {
        mappedData[profileField] = value;
      }
    }

    return await this.collectProfileData(userId, mappedData, 'linkedin_import');
  }

  async createFieldPrompt(userId, fieldId, featureKey, promptType = 'modal') {
    // Check if prompt already exists
    const existing = await this.profileRepository.getPendingPrompt(userId, fieldId);
    if (existing) {
      return existing;
    }

    // Create new prompt
    const prompt = await this.profileRepository.createPrompt({
      userId,
      fieldId,
      featureKey,
      promptType,
      promptStatus: 'pending'
    });

    // Schedule reminder if configured
    const userPreferences = await this.getUserPreferences(userId);
    if (userPreferences.enableReminders) {
      await this.scheduleReminder(prompt.promptId, userPreferences.reminderDelay);
    }

    return prompt;
  }

  async calculateProfileScore(userId) {
    const profile = await this.getUserProfile(userId, true);
    const fields = await this.profileRepository.getAllFields();
    
    let score = 0;
    let weights = {
      essential: 40,
      professional: 30,
      optional: 20,
      verified: 10
    };

    for (const field of fields) {
      if (profile[field.fieldName]) {
        const data = profile[field.fieldName];
        
        // Base score for having the field
        if (field.isEssential === 'Y') {
          score += weights.essential / fields.filter(f => f.isEssential === 'Y').length;
        } else if (field.fieldGroup === 'professional') {
          score += weights.professional / fields.filter(f => f.fieldGroup === 'professional').length;
        } else {
          score += weights.optional / fields.filter(f => f.isEssential === 'N' && f.fieldGroup !== 'professional').length;
        }
        
        // Bonus for verified data
        if (data.verified) {
          score += weights.verified / fields.length;
        }
      }
    }

    return Math.min(100, Math.round(score));
  }

  async updateCompletionTracking(userId) {
    const profile = await this.getUserProfile(userId, true);
    const allFields = await this.profileRepository.getAllFields();
    const requiredFields = allFields.filter(f => f.isEssential === 'Y');
    
    const stats = {
      totalFields: allFields.length,
      completedFields: Object.keys(profile).length,
      requiredFields: requiredFields.length,
      completedRequired: requiredFields.filter(f => profile[f.fieldName]).length,
      completionPercentage: (Object.keys(profile).length / allFields.length) * 100,
      profileScore: await this.calculateProfileScore(userId)
    };

    await this.profileRepository.updateCompletionTracking(userId, stats);
    
    return stats;
  }
}
```

### Frontend Components

```typescript
// frontend/src/components/profile/ProgressiveProfileForm.tsx
import React, { useState, useEffect } from 'react';
import { useProfile } from '../../hooks/useProfile';

interface ProfileField {
  fieldId: string;
  fieldName: string;
  fieldLabel: string;
  fieldType: string;
  validationRules?: any;
  helpText?: string;
  placeholder?: string;
  options?: Array<{value: string, label: string}>;
}

interface Props {
  requiredFields: ProfileField[];
  onComplete: (data: any) => void;
  onSkip?: () => void;
  featureKey: string;
}

export const ProgressiveProfileForm: React.FC<Props> = ({
  requiredFields,
  onComplete,
  onSkip,
  featureKey
}) => {
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [currentStep, setCurrentStep] = useState(0);
  const { saveProfileData, loading } = useProfile();

  const currentField = requiredFields[currentStep];
  const isLastStep = currentStep === requiredFields.length - 1;

  const renderField = (field: ProfileField) => {
    switch (field.fieldType) {
      case 'text':
      case 'email':
      case 'phone':
        return (
          <input
            type={field.fieldType}
            value={formData[field.fieldName] || ''}
            onChange={(e) => handleFieldChange(field.fieldName, e.target.value)}
            placeholder={field.placeholder}
            className={errors[field.fieldName] ? 'error' : ''}
          />
        );
      
      case 'select':
        return (
          <select
            value={formData[field.fieldName] || ''}
            onChange={(e) => handleFieldChange(field.fieldName, e.target.value)}
          >
            <option value="">Select {field.fieldLabel}</option>
            {field.options?.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        );
      
      case 'date':
        return (
          <input
            type="date"
            value={formData[field.fieldName] || ''}
            onChange={(e) => handleFieldChange(field.fieldName, e.target.value)}
          />
        );
      
      case 'textarea':
        return (
          <textarea
            value={formData[field.fieldName] || ''}
            onChange={(e) => handleFieldChange(field.fieldName, e.target.value)}
            placeholder={field.placeholder}
            rows={4}
          />
        );
      
      default:
        return null;
    }
  };

  const handleFieldChange = (fieldName: string, value: any) => {
    setFormData(prev => ({ ...prev, [fieldName]: value }));
    // Clear error when user types
    if (errors[fieldName]) {
      setErrors(prev => ({ ...prev, [fieldName]: '' }));
    }
  };

  const validateField = (field: ProfileField): boolean => {
    const value = formData[field.fieldName];
    
    if (!value && field.validationRules?.required) {
      setErrors(prev => ({
        ...prev,
        [field.fieldName]: `${field.fieldLabel} is required`
      }));
      return false;
    }

    // Additional validation based on rules
    if (field.validationRules) {
      if (field.validationRules.minLength && value.length < field.validationRules.minLength) {
        setErrors(prev => ({
          ...prev,
          [field.fieldName]: `Minimum ${field.validationRules.minLength} characters required`
        }));
        return false;
      }

      if (field.validationRules.pattern) {
        const regex = new RegExp(field.validationRules.pattern);
        if (!regex.test(value)) {
          setErrors(prev => ({
            ...prev,
            [field.fieldName]: field.validationRules.patternMessage || 'Invalid format'
          }));
          return false;
        }
      }
    }

    return true;
  };

  const handleNext = async () => {
    if (!validateField(currentField)) {
      return;
    }

    if (isLastStep) {
      // Save all data
      const result = await saveProfileData(formData);
      if (result.success) {
        onComplete(formData);
      }
    } else {
      // Move to next field
      setCurrentStep(prev => prev + 1);
    }
  };

  const handleSkip = () => {
    if (currentField.validationRules?.required) {
      // Can't skip required fields
      toast.warning('This field is required to continue');
      return;
    }

    if (isLastStep) {
      onSkip?.();
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };

  return (
    <div className="progressive-profile-form">
      <div className="form-header">
        <h3>Complete Your Profile</h3>
        <p>We need a few more details to enable {featureKey}</p>
        <div className="progress-bar">
          <div 
            className="progress-fill" 
            style={{ width: `${((currentStep + 1) / requiredFields.length) * 100}%` }}
          />
        </div>
        <span className="progress-text">
          Step {currentStep + 1} of {requiredFields.length}
        </span>
      </div>

      <div className="form-body">
        <div className="field-group">
          <label>{currentField.fieldLabel}</label>
          {currentField.helpText && (
            <p className="help-text">{currentField.helpText}</p>
          )}
          {renderField(currentField)}
          {errors[currentField.fieldName] && (
            <span className="error-message">
              {errors[currentField.fieldName]}
            </span>
          )}
        </div>
      </div>

      <div className="form-footer">
        {currentStep > 0 && (
          <button 
            onClick={() => setCurrentStep(prev => prev - 1)}
            className="btn-secondary"
          >
            Back
          </button>
        )}
        
        {!currentField.validationRules?.required && (
          <button onClick={handleSkip} className="btn-link">
            Skip for now
          </button>
        )}
        
        <button 
          onClick={handleNext}
          disabled={loading}
          className="btn-primary"
        >
          {isLastStep ? 'Complete' : 'Next'}
        </button>
      </div>
    </div>
  );
};

// Profile completion indicator component
export const ProfileCompletionIndicator: React.FC = () => {
  const { completionStats } = useProfile();

  return (
    <div className="profile-completion-indicator">
      <div className="completion-circle">
        <svg viewBox="0 0 36 36">
          <path
            d="M18 2.0845
              a 15.9155 15.9155 0 0 1 0 31.831
              a 15.9155 15.9155 0 0 1 0 -31.831"
            fill="none"
            stroke="#eee"
            strokeWidth="3"
          />
          <path
            d="M18 2.0845
              a 15.9155 15.9155 0 0 1 0 31.831
              a 15.9155 15.9155 0 0 1 0 -31.831"
            fill="none"
            stroke="#4F46E5"
            strokeWidth="3"
            strokeDasharray={`${completionStats?.completionPercentage || 0}, 100`}
          />
        </svg>
        <span className="percentage">
          {Math.round(completionStats?.completionPercentage || 0)}%
        </span>
      </div>
      <div className="completion-details">
        <p>Profile Score: {completionStats?.profileScore || 0}/100</p>
        <p>
          {completionStats?.completedFields || 0} of {completionStats?.totalFields || 0} fields complete
        </p>
        <a href="/profile/edit">Complete Profile</a>
      </div>
    </div>
  );
};
```

## Security Considerations

1. **Data Privacy**
   - Encrypt sensitive fields at rest
   - Implement field-level access control
   - Audit trail for all profile data changes
   - GDPR-compliant data handling

2. **Validation Security**
   - Server-side validation for all fields
   - Input sanitization to prevent XSS
   - SQL injection prevention
   - Rate limiting on profile updates

3. **Import Security**
   - Validate OAuth tokens for imports
   - Sanitize imported data
   - Virus scanning for uploaded files
   - Size limits on imports

## Testing Requirements

1. **Unit Tests**
   - Field validation logic
   - Completion calculation
   - Score calculation
   - Import mapping

2. **Integration Tests**
   - Progressive collection flow
   - Feature requirement checking
   - Cache invalidation
   - Database transactions

3. **UI Tests**
   - Form rendering for different field types
   - Validation error display
   - Progress tracking
   - Skip/remind functionality

## Documentation Updates

- Field definition guide
- Feature requirement mapping documentation
- Profile import API documentation
- User guide for profile completion

## Dependencies

- Issue #21: Database Schema Optimization
- Validation service implementation
- Cache service (Redis)
- LinkedIn OAuth for import

## Estimated Effort

**Extra Large (XL)** - 7-10 days

### Justification:
- Complex field management system
- Multiple UI components
- Validation framework
- Import functionality
- Extensive testing requirements

## Priority

**High** - Essential for user experience and data quality

## Labels

- `feature`
- `user-experience`
- `data-collection`
- `profile`
- `progressive-disclosure`