/**
 * Profile Store - Zustand store for profile management
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { progressiveProfileAPI } from '../services/progressiveProfileAPI';

interface ProfileField {
  fieldId: string;
  fieldName: string;
  fieldLabel: string;
  fieldType: string;
  fieldGroup?: string;
  validationRules?: any;
  options?: Array<{ value: string; label: string }>;
  helpText?: string;
  placeholder?: string;
  isEssential?: boolean;
}

interface CompletionStats {
  totalFields: number;
  completedFields: number;
  requiredFields: number;
  completedRequired: number;
  completionPercentage: number;
  profileScore: number;
  breakdown?: {
    essential: { total: number; completed: number; percentage: number };
    professional: { total: number; completed: number; percentage: number };
    optional: { total: number; completed: number; percentage: number };
  };
}

interface FeatureAccessInfo {
  canAccess: boolean;
  missingRequired: ProfileField[];
  missingRecommended: ProfileField[];
  completionPercentage: number;
  totalRequired: number;
  completedRequired: number;
}

interface ProfilePrompt {
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

interface ProfileState {
  // Data
  profileData: Record<string, any>;
  profileFields: ProfileField[];
  completionStats: CompletionStats | null;
  pendingPrompts: ProfilePrompt[];
  fieldSuggestions: ProfileField[];
  
  // UI State
  isLoading: boolean;
  error: string | null;
  lastUpdated: string | null;
  
  // Actions
  loadProfileData: (includeMetadata?: boolean) => Promise<void>;
  saveProfileData: (fields: Record<string, any>, source?: string) => Promise<any>;
  getUserProfile: () => Promise<Record<string, any>>;
  
  // Field Management
  loadProfileFields: (filters?: any) => Promise<void>;
  getFieldByName: (fieldName: string) => ProfileField | undefined;
  
  // Completion & Stats
  getCompletionStats: () => Promise<CompletionStats>;
  updateCompletionStats: () => Promise<void>;
  getFieldSuggestions: (limit?: number) => Promise<ProfileField[]>;
  
  // Feature Access
  checkFeatureAccess: (featureKey: string) => Promise<FeatureAccessInfo>;
  
  // Prompts
  loadPendingPrompts: () => Promise<void>;
  createPrompt: (fieldId: string, featureKey?: string, promptType?: string) => Promise<void>;
  updatePromptResponse: (promptId: string, response: string, remindAfter?: string) => Promise<void>;
  
  // Import
  importProfileData: (source: 'linkedin' | 'resume', data: any) => Promise<any>;
  
  // Settings
  updateReminderSettings: (settings: any) => Promise<void>;
  
  // Utilities
  clearError: () => void;
  reset: () => void;
}

const initialState = {
  profileData: {},
  profileFields: [],
  completionStats: null,
  pendingPrompts: [],
  fieldSuggestions: [],
  isLoading: false,
  error: null,
  lastUpdated: null,
};

export const useProfileStore = create<ProfileState>()(
  devtools(
    persist(
      (set, get) => ({
        ...initialState,

        loadProfileData: async (includeMetadata = false) => {
          set({ isLoading: true, error: null });
          try {
            const response = await progressiveProfileAPI.getUserProfileData(includeMetadata);
            if (response.success) {
              set({ 
                profileData: response.profile,
                lastUpdated: new Date().toISOString()
              });
            } else {
              throw new Error(response.error || 'Failed to load profile data');
            }
          } catch (error: any) {
            set({ error: error.message });
            throw error;
          } finally {
            set({ isLoading: false });
          }
        },

        saveProfileData: async (fields, source = 'manual') => {
          set({ isLoading: true, error: null });
          try {
            const response = await progressiveProfileAPI.updateProfileData(fields, source);
            if (response.success) {
              // Update local state with new data
              const currentData = get().profileData;
              set({ 
                profileData: { ...currentData, ...fields },
                completionStats: response.completionStats,
                lastUpdated: new Date().toISOString()
              });
              return response;
            } else {
              throw new Error(response.error || 'Failed to save profile data');
            }
          } catch (error: any) {
            set({ error: error.message });
            throw error;
          } finally {
            set({ isLoading: false });
          }
        },

        getUserProfile: async () => {
          const { profileData, lastUpdated } = get();
          
          // If data is fresh (less than 5 minutes old), return cached
          if (lastUpdated) {
            const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
            if (new Date(lastUpdated) > fiveMinutesAgo && Object.keys(profileData).length > 0) {
              return profileData;
            }
          }
          
          // Otherwise, fetch fresh data
          await get().loadProfileData();
          return get().profileData;
        },

        loadProfileFields: async (filters = {}) => {
          set({ isLoading: true, error: null });
          try {
            const response = await progressiveProfileAPI.getProfileFields(filters);
            if (response.success) {
              set({ profileFields: response.fields });
            } else {
              throw new Error(response.error || 'Failed to load profile fields');
            }
          } catch (error: any) {
            set({ error: error.message });
            throw error;
          } finally {
            set({ isLoading: false });
          }
        },

        getFieldByName: (fieldName) => {
          return get().profileFields.find(f => f.fieldName === fieldName);
        },

        getCompletionStats: async () => {
          set({ isLoading: true, error: null });
          try {
            const response = await progressiveProfileAPI.getCompletionStats();
            if (response.success) {
              set({ completionStats: response.stats });
              return response.stats;
            } else {
              throw new Error(response.error || 'Failed to get completion stats');
            }
          } catch (error: any) {
            set({ error: error.message });
            throw error;
          } finally {
            set({ isLoading: false });
          }
        },

        updateCompletionStats: async () => {
          await get().getCompletionStats();
        },

        getFieldSuggestions: async (limit = 5) => {
          set({ isLoading: true, error: null });
          try {
            const response = await progressiveProfileAPI.getFieldSuggestions(limit);
            if (response.success) {
              set({ fieldSuggestions: response.suggestions });
              return response.suggestions;
            } else {
              throw new Error(response.error || 'Failed to get field suggestions');
            }
          } catch (error: any) {
            set({ error: error.message });
            throw error;
          } finally {
            set({ isLoading: false });
          }
        },

        checkFeatureAccess: async (featureKey) => {
          set({ isLoading: true, error: null });
          try {
            const response = await progressiveProfileAPI.checkFeatureAccess(featureKey);
            if (response.success) {
              return {
                canAccess: response.canAccess,
                missingRequired: response.missingRequired || [],
                missingRecommended: response.missingRecommended || [],
                completionPercentage: response.completionPercentage || 0,
                totalRequired: response.totalRequired || 0,
                completedRequired: response.completedRequired || 0
              };
            } else {
              throw new Error(response.error || 'Failed to check feature access');
            }
          } catch (error: any) {
            set({ error: error.message });
            throw error;
          } finally {
            set({ isLoading: false });
          }
        },

        loadPendingPrompts: async () => {
          set({ isLoading: true, error: null });
          try {
            const response = await progressiveProfileAPI.getPendingPrompts();
            if (response.success) {
              set({ pendingPrompts: response.prompts });
            } else {
              throw new Error(response.error || 'Failed to load pending prompts');
            }
          } catch (error: any) {
            set({ error: error.message });
            throw error;
          } finally {
            set({ isLoading: false });
          }
        },

        createPrompt: async (fieldId, featureKey, promptType = 'modal') => {
          set({ isLoading: true, error: null });
          try {
            const response = await progressiveProfileAPI.createPrompt(fieldId, featureKey, promptType);
            if (response.success) {
              // Reload pending prompts
              await get().loadPendingPrompts();
            } else {
              throw new Error(response.error || 'Failed to create prompt');
            }
          } catch (error: any) {
            set({ error: error.message });
            throw error;
          } finally {
            set({ isLoading: false });
          }
        },

        updatePromptResponse: async (promptId, response, remindAfter) => {
          set({ isLoading: true, error: null });
          try {
            const apiResponse = await progressiveProfileAPI.updatePromptResponse(
              promptId,
              response,
              remindAfter
            );
            if (apiResponse.success) {
              // Remove prompt from pending list if completed or dismissed
              if (response === 'provided' || response === 'dismissed') {
                const prompts = get().pendingPrompts.filter(p => p.promptId !== promptId);
                set({ pendingPrompts: prompts });
              }
            } else {
              throw new Error(apiResponse.error || 'Failed to update prompt response');
            }
          } catch (error: any) {
            set({ error: error.message });
            throw error;
          } finally {
            set({ isLoading: false });
          }
        },

        importProfileData: async (source, data) => {
          set({ isLoading: true, error: null });
          try {
            const response = await progressiveProfileAPI.importProfileData(source, data);
            if (response.success) {
              // Reload profile data and stats
              await get().loadProfileData();
              await get().updateCompletionStats();
              return response;
            } else {
              throw new Error(response.error || 'Failed to import profile data');
            }
          } catch (error: any) {
            set({ error: error.message });
            throw error;
          } finally {
            set({ isLoading: false });
          }
        },

        updateReminderSettings: async (settings) => {
          set({ isLoading: true, error: null });
          try {
            const response = await progressiveProfileAPI.updateReminderSettings(settings);
            if (response.success) {
              // Could store settings in local state if needed
            } else {
              throw new Error(response.error || 'Failed to update reminder settings');
            }
          } catch (error: any) {
            set({ error: error.message });
            throw error;
          } finally {
            set({ isLoading: false });
          }
        },

        clearError: () => set({ error: null }),

        reset: () => set(initialState),
      }),
      {
        name: 'profile-store',
        partialize: (state) => ({
          profileData: state.profileData,
          completionStats: state.completionStats,
          lastUpdated: state.lastUpdated,
        }),
      }
    )
  )
);

// Selector hooks for common use cases
export const useProfileCompletion = () => 
  useProfileStore(state => state.completionStats?.completionPercentage || 0);

export const useProfileScore = () => 
  useProfileStore(state => state.completionStats?.profileScore || 0);

export const useHasPendingPrompts = () => 
  useProfileStore(state => state.pendingPrompts.length > 0);

export const useProfileField = (fieldName: string) => 
  useProfileStore(state => state.profileData[fieldName]);