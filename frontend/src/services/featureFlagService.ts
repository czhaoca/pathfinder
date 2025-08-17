/**
 * Feature Flag Service
 * 
 * Client-side service for feature flag management
 */

import { api } from './api';

class FeatureFlagService {
  private baseUrl = '/api/feature-flags';

  /**
   * Get all feature flags
   */
  async getAllFlags(filters?: {
    category?: string;
    enabled?: boolean;
    system_wide?: boolean;
  }) {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined) {
          params.append(key, String(value));
        }
      });
    }

    const response = await api.get(`${this.baseUrl}?${params.toString()}`);
    return response.data;
  }

  /**
   * Get specific feature flag
   */
  async getFlag(flagKey: string) {
    const response = await api.get(`${this.baseUrl}/${flagKey}`);
    return response.data;
  }

  /**
   * Evaluate feature flags for current user
   */
  async evaluateFlags(flags: string[], context?: any) {
    const response = await api.post(`${this.baseUrl}/evaluate`, {
      flags,
      context
    });
    return response.data;
  }

  /**
   * Create new feature flag
   */
  async createFlag(flagData: {
    flag_key: string;
    flag_name: string;
    description?: string;
    flag_type: string;
    default_value: string;
    category?: string;
    is_system_wide?: boolean;
    rollout_percentage?: number;
  }) {
    const response = await api.post(this.baseUrl, flagData);
    return response.data;
  }

  /**
   * Update feature flag
   */
  async updateFlag(flagKey: string, updates: any, reason: string) {
    const response = await api.put(`${this.baseUrl}/${flagKey}`, {
      updates,
      reason
    });
    return response.data;
  }

  /**
   * Delete/archive feature flag
   */
  async deleteFlag(flagKey: string, reason: string) {
    const response = await api.delete(`${this.baseUrl}/${flagKey}`, {
      data: { reason }
    });
    return response.data;
  }

  /**
   * Emergency disable a feature flag
   */
  async emergencyDisable(flagKey: string, reason: string) {
    const response = await api.post(`${this.baseUrl}/${flagKey}/emergency-disable`, {
      reason
    });
    return response.data;
  }

  /**
   * Toggle self-registration
   */
  async toggleSelfRegistration(enabled: boolean, reason: string) {
    const response = await api.post(`${this.baseUrl}/self-registration/toggle`, {
      enabled,
      reason
    });
    return response.data;
  }

  /**
   * Get registration metrics
   */
  async getRegistrationMetrics(timeRange: string = '24h') {
    const response = await api.get(`${this.baseUrl}/self-registration/metrics?timeRange=${timeRange}`);
    return response.data;
  }

  /**
   * Update DDoS protection settings
   */
  async updateProtectionSettings(settings: {
    rateLimit?: number;
    windowMinutes?: number;
    blockDurationMinutes?: number;
    captchaThreshold?: number;
    suspicionThreshold?: number;
  }) {
    const response = await api.post(`${this.baseUrl}/self-registration/protection`, settings);
    return response.data;
  }

  /**
   * Get flag history
   */
  async getFlagHistory(flagKey: string, limit: number = 20) {
    const response = await api.get(`${this.baseUrl}/${flagKey}/history?limit=${limit}`);
    return response.data.history;
  }

  /**
   * Rollback flag to previous state
   */
  async rollbackFlag(flagKey: string, historyId: string) {
    const response = await api.post(`${this.baseUrl}/${flagKey}/rollback`, {
      historyId
    });
    return response.data;
  }

  /**
   * Set user or group override
   */
  async setOverride(
    flagKey: string,
    type: 'user' | 'group',
    targetId: string,
    enabled: boolean,
    reason: string
  ) {
    const response = await api.post(`${this.baseUrl}/${flagKey}/override`, {
      type,
      targetId,
      enabled,
      reason
    });
    return response.data;
  }

  /**
   * Get flag categories
   */
  async getCategories() {
    const response = await api.get(`${this.baseUrl}/categories`);
    return response.data;
  }

  /**
   * Get system metrics
   */
  async getSystemMetrics() {
    const response = await api.get(`${this.baseUrl}/system/metrics`);
    return response.data;
  }

  /**
   * Check if a feature is enabled for current user
   * This is a client-side helper that caches results
   */
  private flagCache = new Map<string, { value: boolean; expiry: number }>();
  
  async isFeatureEnabled(flagKey: string, useCache: boolean = true): Promise<boolean> {
    // Check cache first
    if (useCache) {
      const cached = this.flagCache.get(flagKey);
      if (cached && cached.expiry > Date.now()) {
        return cached.value;
      }
    }

    try {
      const result = await this.evaluateFlags([flagKey]);
      const value = result[flagKey]?.value || false;
      
      // Cache for 5 minutes
      this.flagCache.set(flagKey, {
        value,
        expiry: Date.now() + 5 * 60 * 1000
      });
      
      return value;
    } catch (error) {
      console.error(`Failed to evaluate feature flag ${flagKey}:`, error);
      return false; // Default to disabled on error
    }
  }

  /**
   * Clear flag cache
   */
  clearCache() {
    this.flagCache.clear();
  }
}

export const featureFlagService = new FeatureFlagService();