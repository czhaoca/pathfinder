/**
 * Progressive Profile API Service
 * Handles all API calls related to progressive profile collection
 */

import axios from 'axios';
import { getAuthToken } from '../utils/auth';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

// Create axios instance with default config
const apiClient = axios.create({
  baseURL: `${API_BASE_URL}/progressive-profile`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
apiClient.interceptors.request.use(
  (config) => {
    const token = getAuthToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Handle response errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Handle unauthorized - redirect to login
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const progressiveProfileAPI = {
  /**
   * Get all profile fields with optional filtering
   */
  async getProfileFields(filters?: {
    group?: string;
    essential?: boolean;
    active?: boolean;
  }) {
    try {
      const response = await apiClient.get('/fields', { params: filters });
      return response.data;
    } catch (error) {
      console.error('Error fetching profile fields:', error);
      throw error;
    }
  },

  /**
   * Get user's profile data
   */
  async getUserProfileData(includeMetadata = false) {
    try {
      const response = await apiClient.get('/data', {
        params: { includeMetadata }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching user profile data:', error);
      throw error;
    }
  },

  /**
   * Update user's profile data (partial update)
   */
  async updateProfileData(fields: Record<string, any>, source = 'manual') {
    try {
      const response = await apiClient.patch('/data', {
        fields,
        source
      });
      return response.data;
    } catch (error) {
      console.error('Error updating profile data:', error);
      throw error;
    }
  },

  /**
   * Get profile completion statistics
   */
  async getCompletionStats() {
    try {
      const response = await apiClient.get('/completion');
      return response.data;
    } catch (error) {
      console.error('Error fetching completion stats:', error);
      throw error;
    }
  },

  /**
   * Get field suggestions for profile completion
   */
  async getFieldSuggestions(limit = 5) {
    try {
      const response = await apiClient.get('/suggestions', {
        params: { limit }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching field suggestions:', error);
      throw error;
    }
  },

  /**
   * Check feature access requirements
   */
  async checkFeatureAccess(featureKey: string) {
    try {
      const response = await apiClient.get(`/feature-access/${featureKey}`);
      return response.data;
    } catch (error) {
      console.error('Error checking feature access:', error);
      throw error;
    }
  },

  /**
   * Get pending prompts for user
   */
  async getPendingPrompts() {
    try {
      const response = await apiClient.get('/prompts');
      return response.data;
    } catch (error) {
      console.error('Error fetching pending prompts:', error);
      throw error;
    }
  },

  /**
   * Create a field collection prompt
   */
  async createPrompt(
    fieldId: string,
    featureKey?: string,
    promptType = 'modal'
  ) {
    try {
      const response = await apiClient.post('/prompts', {
        fieldId,
        featureKey,
        promptType
      });
      return response.data;
    } catch (error) {
      console.error('Error creating prompt:', error);
      throw error;
    }
  },

  /**
   * Update prompt response
   */
  async updatePromptResponse(
    promptId: string,
    response: 'provided' | 'skipped' | 'remind_later' | 'dismissed',
    remindAfter?: string
  ) {
    try {
      const apiResponse = await apiClient.patch(`/prompts/${promptId}`, {
        response,
        remindAfter
      });
      return apiResponse.data;
    } catch (error) {
      console.error('Error updating prompt response:', error);
      throw error;
    }
  },

  /**
   * Import profile data from external source
   */
  async importProfileData(
    source: 'linkedin' | 'resume',
    data: any
  ) {
    try {
      const response = await apiClient.post('/import', {
        source,
        data
      });
      return response.data;
    } catch (error) {
      console.error('Error importing profile data:', error);
      throw error;
    }
  },

  /**
   * Update reminder settings
   */
  async updateReminderSettings(settings: {
    enableReminders?: boolean;
    reminderFrequency?: string;
    reminderTime?: string;
    reminderDays?: string[];
  }) {
    try {
      const response = await apiClient.put('/reminder-settings', {
        settings
      });
      return response.data;
    } catch (error) {
      console.error('Error updating reminder settings:', error);
      throw error;
    }
  },

  /**
   * Admin: Create or update field definition
   */
  async createField(fieldData: {
    fieldName: string;
    fieldLabel: string;
    fieldType: string;
    fieldGroup?: string;
    validationRules?: any;
    options?: any;
    helpText?: string;
    placeholder?: string;
    defaultValue?: string;
    isEssential?: boolean;
    isSensitive?: boolean;
    encryptionRequired?: boolean;
    displayOrder?: number;
  }) {
    try {
      const response = await apiClient.post('/admin/fields', fieldData);
      return response.data;
    } catch (error) {
      console.error('Error creating field:', error);
      throw error;
    }
  },

  /**
   * Admin: Update field definition
   */
  async updateField(fieldId: string, updates: any) {
    try {
      const response = await apiClient.put(`/admin/fields/${fieldId}`, updates);
      return response.data;
    } catch (error) {
      console.error('Error updating field:', error);
      throw error;
    }
  },

  /**
   * Admin: Set feature requirements
   */
  async setFeatureRequirements(
    featureKey: string,
    requirements: Array<{
      fieldId: string;
      isRequired?: boolean;
      requirementLevel?: 'required' | 'recommended' | 'optional';
      customMessage?: string;
      alternativeFields?: string[];
    }>
  ) {
    try {
      const response = await apiClient.put(
        `/admin/features/${featureKey}/requirements`,
        { requirements }
      );
      return response.data;
    } catch (error) {
      console.error('Error setting feature requirements:', error);
      throw error;
    }
  },
};

// Export types for TypeScript
export interface ProfileField {
  fieldId: string;
  fieldName: string;
  fieldLabel: string;
  fieldType: string;
  fieldGroup?: string;
  validationRules?: {
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    patternMessage?: string;
    min?: number;
    max?: number;
  };
  options?: Array<{ value: string; label: string }>;
  helpText?: string;
  placeholder?: string;
  defaultValue?: string;
  isEssential?: boolean;
  isSensitive?: boolean;
  encryptionRequired?: boolean;
  displayOrder?: number;
  isActive?: boolean;
}

export interface CompletionStats {
  totalFields: number;
  completedFields: number;
  requiredFields: number;
  completedRequired: number;
  completionPercentage: number;
  profileScore: number;
  lastPrompted?: string;
  fieldsSkipped?: any[];
  reminderSettings?: any;
  updatedAt?: string;
  breakdown?: {
    essential: {
      total: number;
      completed: number;
      percentage: number;
    };
    professional: {
      total: number;
      completed: number;
      percentage: number;
    };
    optional: {
      total: number;
      completed: number;
      percentage: number;
    };
  };
}

export interface FeatureAccessInfo {
  canAccess: boolean;
  missingRequired: ProfileField[];
  missingRecommended: ProfileField[];
  completionPercentage: number;
  totalRequired: number;
  completedRequired: number;
}

export interface ProfilePrompt {
  promptId: string;
  fieldId: string;
  fieldName: string;
  fieldLabel: string;
  fieldType: string;
  featureKey?: string;
  promptType: string;
  helpText?: string;
  placeholder?: string;
  validationRules?: any;
  options?: any;
  createdAt: string;
}