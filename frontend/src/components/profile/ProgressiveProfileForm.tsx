/**
 * Progressive Profile Form Component
 * Collects profile data progressively with validation and skip functionality
 */

import React, { useState, useEffect } from 'react';
import { useProfileStore } from '../../stores/profileStore';
import { toast } from 'react-toastify';
import DOMPurify from 'dompurify';
import './ProgressiveProfileForm.css';

interface ProfileField {
  fieldId: string;
  fieldName: string;
  fieldLabel: string;
  fieldType: string;
  fieldGroup?: string;
  validationRules?: any;
  helpText?: string;
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
  isEssential?: boolean;
}

interface Props {
  requiredFields: ProfileField[];
  onComplete: (data: any) => void;
  onSkip?: () => void;
  featureKey: string;
  mode?: 'modal' | 'inline' | 'wizard';
}

export const ProgressiveProfileForm: React.FC<Props> = ({
  requiredFields,
  onComplete,
  onSkip,
  featureKey,
  mode = 'modal'
}) => {
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const { saveProfileData, getUserProfile } = useProfileStore();

  const currentField = requiredFields[currentStep];
  const isLastStep = currentStep === requiredFields.length - 1;
  const progress = ((currentStep + 1) / requiredFields.length) * 100;

  useEffect(() => {
    // Pre-fill any existing data
    loadExistingData();
  }, []);

  const loadExistingData = async () => {
    try {
      const profile = await getUserProfile();
      const existingData: Record<string, any> = {};
      
      requiredFields.forEach(field => {
        if (profile[field.fieldName]) {
          existingData[field.fieldName] = profile[field.fieldName];
        }
      });
      
      setFormData(existingData);
    } catch (error) {
      console.error('Failed to load existing profile data:', error);
    }
  };

  const renderField = (field: ProfileField) => {
    const value = formData[field.fieldName] || '';
    const error = errors[field.fieldName];
    const isTouched = touched[field.fieldName];
    const showError = error && isTouched;

    switch (field.fieldType) {
      case 'text':
      case 'email':
      case 'phone':
        return (
          <input
            type={field.fieldType}
            value={value}
            onChange={(e) => handleFieldChange(field.fieldName, e.target.value)}
            onBlur={() => handleFieldBlur(field.fieldName)}
            placeholder={field.placeholder}
            className={`form-input ${showError ? 'error' : ''}`}
            aria-invalid={showError}
            aria-describedby={showError ? `${field.fieldName}-error` : undefined}
          />
        );

      case 'date':
        return (
          <input
            type="date"
            value={value}
            onChange={(e) => handleFieldChange(field.fieldName, e.target.value)}
            onBlur={() => handleFieldBlur(field.fieldName)}
            className={`form-input ${showError ? 'error' : ''}`}
            aria-invalid={showError}
          />
        );

      case 'select':
        return (
          <select
            value={value}
            onChange={(e) => handleFieldChange(field.fieldName, e.target.value)}
            onBlur={() => handleFieldBlur(field.fieldName)}
            className={`form-select ${showError ? 'error' : ''}`}
            aria-invalid={showError}
          >
            <option value="">Select {field.fieldLabel}</option>
            {field.options?.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        );

      case 'textarea':
        return (
          <textarea
            value={value}
            onChange={(e) => handleFieldChange(field.fieldName, e.target.value)}
            onBlur={() => handleFieldBlur(field.fieldName)}
            placeholder={field.placeholder}
            rows={4}
            className={`form-textarea ${showError ? 'error' : ''}`}
            aria-invalid={showError}
          />
        );

      case 'number':
        return (
          <input
            type="number"
            value={value}
            onChange={(e) => handleFieldChange(field.fieldName, e.target.value)}
            onBlur={() => handleFieldBlur(field.fieldName)}
            placeholder={field.placeholder}
            className={`form-input ${showError ? 'error' : ''}`}
            aria-invalid={showError}
          />
        );

      case 'checkbox':
        return (
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={value === true || value === 'true'}
              onChange={(e) => handleFieldChange(field.fieldName, e.target.checked)}
              className="form-checkbox"
            />
            <span>{field.placeholder || field.fieldLabel}</span>
          </label>
        );

      case 'radio':
        return (
          <div className="radio-group">
            {field.options?.map(opt => (
              <label key={opt.value} className="radio-label">
                <input
                  type="radio"
                  name={field.fieldName}
                  value={opt.value}
                  checked={value === opt.value}
                  onChange={(e) => handleFieldChange(field.fieldName, e.target.value)}
                  className="form-radio"
                />
                <span>{opt.label}</span>
              </label>
            ))}
          </div>
        );

      default:
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => handleFieldChange(field.fieldName, e.target.value)}
            onBlur={() => handleFieldBlur(field.fieldName)}
            placeholder={field.placeholder}
            className={`form-input ${showError ? 'error' : ''}`}
            aria-invalid={showError}
          />
        );
    }
  };

  const handleFieldChange = (fieldName: string, value: any) => {
    // Sanitize string inputs to prevent XSS attacks
    let sanitizedValue = value;
    if (typeof value === 'string') {
      sanitizedValue = DOMPurify.sanitize(value, { 
        ALLOWED_TAGS: [], // No HTML tags allowed in profile fields
        ALLOWED_ATTR: [],
        KEEP_CONTENT: true 
      });
    }
    
    setFormData(prev => ({ ...prev, [fieldName]: sanitizedValue }));
    
    // Clear error when user types
    if (errors[fieldName]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[fieldName];
        return newErrors;
      });
    }
  };

  const handleFieldBlur = (fieldName: string) => {
    setTouched(prev => ({ ...prev, [fieldName]: true }));
    
    // Find the field and validate on blur
    const field = requiredFields.find(f => f.fieldName === fieldName);
    if (field) {
      validateField(field);
    }
  };

  const validateField = (field: ProfileField): boolean => {
    const value = formData[field.fieldName];
    const rules = field.validationRules || {};

    // Required field validation
    if (rules.required && !value) {
      setErrors(prev => ({
        ...prev,
        [field.fieldName]: `${field.fieldLabel} is required`
      }));
      return false;
    }

    // Email validation
    if (field.fieldType === 'email' && value) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        setErrors(prev => ({
          ...prev,
          [field.fieldName]: 'Please enter a valid email address'
        }));
        return false;
      }
    }

    // Phone validation
    if (field.fieldType === 'phone' && value) {
      const phoneRegex = /^[\d\s\-\+\(\)]+$/;
      if (!phoneRegex.test(value)) {
        setErrors(prev => ({
          ...prev,
          [field.fieldName]: 'Please enter a valid phone number'
        }));
        return false;
      }
    }

    // Min length validation
    if (rules.minLength && value && value.length < rules.minLength) {
      setErrors(prev => ({
        ...prev,
        [field.fieldName]: `Minimum ${rules.minLength} characters required`
      }));
      return false;
    }

    // Max length validation
    if (rules.maxLength && value && value.length > rules.maxLength) {
      setErrors(prev => ({
        ...prev,
        [field.fieldName]: `Maximum ${rules.maxLength} characters allowed`
      }));
      return false;
    }

    // Pattern validation
    if (rules.pattern && value) {
      const regex = new RegExp(rules.pattern);
      if (!regex.test(value)) {
        setErrors(prev => ({
          ...prev,
          [field.fieldName]: rules.patternMessage || 'Invalid format'
        }));
        return false;
      }
    }

    // Min/Max for numbers
    if (field.fieldType === 'number' && value) {
      const numValue = Number(value);
      if (rules.min !== undefined && numValue < rules.min) {
        setErrors(prev => ({
          ...prev,
          [field.fieldName]: `Value must be at least ${rules.min}`
        }));
        return false;
      }
      if (rules.max !== undefined && numValue > rules.max) {
        setErrors(prev => ({
          ...prev,
          [field.fieldName]: `Value must be at most ${rules.max}`
        }));
        return false;
      }
    }

    return true;
  };

  const handleNext = async () => {
    if (!currentField) return;

    // Mark field as touched and validate
    setTouched(prev => ({ ...prev, [currentField.fieldName]: true }));

    if (!validateField(currentField)) {
      return;
    }

    if (isLastStep) {
      // Save all data
      await handleSave();
    } else {
      // Move to next field
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSkip = () => {
    if (currentField?.validationRules?.required || currentField?.isEssential) {
      toast.warning('This field is required to continue');
      return;
    }

    if (isLastStep) {
      handleSave();
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handleSkipAll = () => {
    if (onSkip) {
      onSkip();
    }
  };

  const handleSave = async () => {
    setLoading(true);
    
    try {
      // Validate all fields before saving
      let hasErrors = false;
      for (const field of requiredFields) {
        if (!validateField(field)) {
          hasErrors = true;
        }
      }

      if (hasErrors) {
        toast.error('Please fix all errors before continuing');
        setLoading(false);
        return;
      }

      // Save profile data
      const result = await saveProfileData(formData);
      
      if (result.success) {
        toast.success('Profile updated successfully');
        onComplete(formData);
      } else {
        toast.error('Failed to save profile data');
      }
    } catch (error) {
      console.error('Failed to save profile:', error);
      toast.error('An error occurred while saving your profile');
    } finally {
      setLoading(false);
    }
  };

  const renderStepIndicator = () => {
    if (mode === 'wizard' && requiredFields.length > 1) {
      return (
        <div className="step-indicator">
          {requiredFields.map((_, index) => (
            <div
              key={index}
              className={`step ${index === currentStep ? 'active' : ''} ${
                index < currentStep ? 'completed' : ''
              }`}
            />
          ))}
        </div>
      );
    }
    return null;
  };

  const renderProgressBar = () => {
    return (
      <div className="progress-container">
        <div className="progress-bar">
          <div 
            className="progress-fill" 
            style={{ width: `${progress}%` }}
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>
        <span className="progress-text">
          Step {currentStep + 1} of {requiredFields.length}
        </span>
      </div>
    );
  };

  if (!currentField) {
    return null;
  }

  return (
    <div className={`progressive-profile-form ${mode}`}>
      <div className="form-header">
        <h3>Complete Your Profile</h3>
        <p>We need a few more details to enable {featureKey}</p>
        {renderStepIndicator()}
        {renderProgressBar()}
      </div>

      <div className="form-body">
        <div className="field-group">
          <label htmlFor={currentField.fieldName} className="field-label">
            {currentField.fieldLabel}
            {currentField.validationRules?.required && (
              <span className="required-indicator" aria-label="required">*</span>
            )}
          </label>
          
          {currentField.helpText && (
            <p className="help-text">{currentField.helpText}</p>
          )}
          
          {renderField(currentField)}
          
          {errors[currentField.fieldName] && touched[currentField.fieldName] && (
            <span 
              id={`${currentField.fieldName}-error`}
              className="error-message"
              role="alert"
            >
              {errors[currentField.fieldName]}
            </span>
          )}
        </div>
      </div>

      <div className="form-footer">
        <div className="footer-left">
          {currentStep > 0 && (
            <button 
              onClick={handlePrevious}
              className="btn btn-secondary"
              disabled={loading}
            >
              Back
            </button>
          )}
        </div>

        <div className="footer-right">
          {!currentField.validationRules?.required && !currentField.isEssential && (
            <button 
              onClick={handleSkip} 
              className="btn btn-link"
              disabled={loading}
            >
              Skip for now
            </button>
          )}

          {requiredFields.every(f => !f.isEssential && !f.validationRules?.required) && (
            <button 
              onClick={handleSkipAll} 
              className="btn btn-link"
              disabled={loading}
            >
              Skip all
            </button>
          )}
          
          <button 
            onClick={handleNext}
            disabled={loading}
            className="btn btn-primary"
          >
            {loading ? 'Saving...' : isLastStep ? 'Complete' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
};