/**
 * Feature Flag Hook
 * 
 * React hook for managing feature flags
 */

import { useState, useEffect, useCallback } from 'react';
import { featureFlagService } from '../services/featureFlagService';

interface FeatureFlag {
  flag_id: string;
  flag_key: string;
  flag_name: string;
  description?: string;
  flag_type: string;
  default_value: string;
  enabled: 'Y' | 'N';
  is_system_wide: 'Y' | 'N';
  category?: string;
  rollout_percentage?: number;
  evaluation_count?: number;
  last_evaluated?: string;
}

interface FlagMetrics {
  totalFlags: number;
  systemFlags: number;
  avgEvaluationTime: number;
  cacheHitRate: number;
  evaluationMetrics: {
    totalEvaluations: number;
    cacheHits: number;
  };
}

export function useFeatureFlags() {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<FlagMetrics | null>(null);

  // Load all flags
  const loadFlags = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await featureFlagService.getAllFlags();
      setFlags(response.flags);
      setMetrics(response.metrics);
    } catch (err: any) {
      setError(err.message || 'Failed to load feature flags');
    } finally {
      setLoading(false);
    }
  }, []);

  // Load flags on mount
  useEffect(() => {
    loadFlags();
  }, [loadFlags]);

  // Evaluate flags for current user
  const evaluateFlags = useCallback(async (flagKeys: string[], context?: any) => {
    try {
      const results = await featureFlagService.evaluateFlags(flagKeys, context);
      return results;
    } catch (err: any) {
      console.error('Failed to evaluate flags:', err);
      return {};
    }
  }, []);

  // Create new flag
  const createFlag = useCallback(async (flagData: any) => {
    setLoading(true);
    setError(null);
    try {
      await featureFlagService.createFlag(flagData);
      await loadFlags(); // Reload flags
    } catch (err: any) {
      setError(err.message || 'Failed to create flag');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [loadFlags]);

  // Update flag
  const updateFlag = useCallback(async (flagKey: string, updates: any, reason: string) => {
    setLoading(true);
    setError(null);
    try {
      await featureFlagService.updateFlag(flagKey, updates, reason);
      await loadFlags(); // Reload flags
    } catch (err: any) {
      setError(err.message || 'Failed to update flag');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [loadFlags]);

  // Toggle flag enabled state
  const toggleFlag = useCallback(async (flagKey: string, enabled: boolean) => {
    await updateFlag(flagKey, { enabled: enabled ? 'Y' : 'N' }, 'Toggle from admin UI');
  }, [updateFlag]);

  // Delete/archive flag
  const deleteFlag = useCallback(async (flagKey: string, reason: string) => {
    setLoading(true);
    setError(null);
    try {
      await featureFlagService.deleteFlag(flagKey, reason);
      await loadFlags(); // Reload flags
    } catch (err: any) {
      setError(err.message || 'Failed to delete flag');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [loadFlags]);

  // Emergency disable
  const emergencyDisable = useCallback(async (flagKey: string, reason: string) => {
    setLoading(true);
    setError(null);
    try {
      await featureFlagService.emergencyDisable(flagKey, reason);
      await loadFlags(); // Reload flags
    } catch (err: any) {
      setError(err.message || 'Failed to emergency disable flag');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [loadFlags]);

  // Toggle self-registration
  const toggleSelfRegistration = useCallback(async (enabled: boolean, reason: string) => {
    setLoading(true);
    setError(null);
    try {
      await featureFlagService.toggleSelfRegistration(enabled, reason);
      await loadFlags(); // Reload flags
    } catch (err: any) {
      setError(err.message || 'Failed to toggle self-registration');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [loadFlags]);

  // Get registration metrics
  const getRegistrationMetrics = useCallback(async (timeRange: string = '24h') => {
    try {
      const metrics = await featureFlagService.getRegistrationMetrics(timeRange);
      return metrics;
    } catch (err: any) {
      console.error('Failed to get registration metrics:', err);
      throw err;
    }
  }, []);

  // Update protection settings
  const updateProtectionSettings = useCallback(async (settings: any) => {
    try {
      await featureFlagService.updateProtectionSettings(settings);
    } catch (err: any) {
      console.error('Failed to update protection settings:', err);
      throw err;
    }
  }, []);

  // Get flag history
  const getHistory = useCallback(async (flagKey: string, limit?: number) => {
    try {
      const history = await featureFlagService.getFlagHistory(flagKey, limit);
      return history;
    } catch (err: any) {
      console.error('Failed to get flag history:', err);
      return [];
    }
  }, []);

  // Rollback flag
  const rollbackFlag = useCallback(async (flagKey: string, historyId: string) => {
    setLoading(true);
    setError(null);
    try {
      await featureFlagService.rollbackFlag(flagKey, historyId);
      await loadFlags(); // Reload flags
    } catch (err: any) {
      setError(err.message || 'Failed to rollback flag');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [loadFlags]);

  // Set override
  const setOverride = useCallback(async (
    flagKey: string,
    type: 'user' | 'group',
    targetId: string,
    enabled: boolean,
    reason: string
  ) => {
    try {
      await featureFlagService.setOverride(flagKey, type, targetId, enabled, reason);
    } catch (err: any) {
      console.error('Failed to set override:', err);
      throw err;
    }
  }, []);

  // Refresh flags
  const refreshFlags = useCallback(() => {
    loadFlags();
  }, [loadFlags]);

  return {
    flags,
    loading,
    error,
    metrics,
    evaluateFlags,
    createFlag,
    updateFlag,
    toggleFlag,
    deleteFlag,
    emergencyDisable,
    toggleSelfRegistration,
    getRegistrationMetrics,
    updateProtectionSettings,
    getHistory,
    rollbackFlag,
    setOverride,
    refreshFlags,
  };
}