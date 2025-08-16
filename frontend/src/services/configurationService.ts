/**
 * Configuration Management Service
 * 
 * Frontend service for configuration management operations:
 * - Configuration CRUD operations
 * - Feature flag management
 * - Rate limit configuration
 * - Template operations
 * - Audit trail access
 */

import { BaseService } from './BaseService';

export interface Configuration {
  config_key: string;
  config_value: string;
  config_type: string;
  category: string;
  subcategory?: string;
  display_name?: string;
  description?: string;
  default_value?: string;
  is_required: boolean;
  is_active: boolean;
  requires_restart: boolean;
  cache_ttl_seconds: number;
  override_value?: string;
  override_environment?: string;
  has_override: boolean;
  validation_rule?: string;
  allowed_values?: string[];
  min_value?: number;
  max_value?: number;
  regex_pattern?: string;
  created_at: string;
  updated_at: string;
}

export interface FeatureFlag {
  feature_key: string;
  feature_name: string;
  description?: string;
  is_enabled: boolean;
  rollout_percentage: number;
  rollout_strategy: string;
  enabled_for_users?: string[];
  enabled_for_roles?: string[];
  enabled_environments?: string[];
  targeting_rules?: any;
  start_date?: string;
  end_date?: string;
  feature_category: string;
  feature_type: string;
  impact_level: string;
  owner_team?: string;
  owner_email?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RateLimit {
  limit_key: string;
  limit_name: string;
  description?: string;
  max_requests: number;
  time_window_seconds: number;
  scope_type: string;
  scope_pattern?: string;
  action_on_limit: string;
  sliding_window: boolean;
  is_active: boolean;
  priority: number;
  environment?: string;
  exempt_roles?: string[];
  exempt_users?: string[];
  exempt_ips?: string[];
  created_at: string;
  updated_at: string;
}

export interface Template {
  id: string;
  template_name: string;
  template_type: string;
  description?: string;
  config_values: Record<string, any>;
  feature_flags?: Record<string, any>;
  rate_limits?: Record<string, any>;
  suitable_environments: string[];
  suitable_scale: string;
  is_default: boolean;
  is_active: boolean;
  usage_count: number;
  author?: string;
  team?: string;
  created_at: string;
  updated_at: string;
}

export interface AuditEntry {
  id: string;
  change_timestamp: string;
  table_name: string;
  record_id: string;
  config_key: string;
  action: string;
  old_value?: any;
  new_value?: any;
  value_diff?: any;
  change_reason?: string;
  environment?: string;
  changed_by: string;
  user_email?: string;
  first_name?: string;
  last_name?: string;
  risk_level: string;
}

export interface ConfigurationStats {
  total_configurations: number;
  active_configurations: number;
  feature_flags: number;
  rate_limits: number;
  templates: number;
  recent_changes: number;
  categories: Array<{
    category: string;
    total_configs: number;
    active_configs: number;
    restart_required_configs: number;
  }>;
  environment_overrides?: Array<{
    environment: string;
    override_count: number;
    temporary_overrides: number;
  }>;
  recent_changes_detail: AuditEntry[];
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'error';
  database: {
    configurations: number;
    feature_flags: number;
    rate_limits: number;
  };
  cache: {
    local_cache_size: number;
    feature_flag_cache_size: number;
  };
  restart_required: string[];
  timestamp: string;
}

class ConfigurationService extends BaseService {
  private readonly baseUrl = '/api/config';

  // Configuration Management
  async getConfigurations(environment?: string, category?: string) {
    const params = new URLSearchParams();
    if (environment) params.append('environment', environment);
    if (category) params.append('category', category);
    
    return this.get(`${this.baseUrl}?${params.toString()}`);
  }

  async getConfiguration(key: string, environment?: string) {
    const params = new URLSearchParams();
    if (environment) params.append('environment', environment);
    params.append('include_history', 'false');
    
    return this.get(`${this.baseUrl}/${key}?${params.toString()}`);
  }

  async updateConfiguration(key: string, data: {
    value: any;
    environment?: string;
    reason?: string;
    validate_only?: boolean;
  }) {
    return this.put(`${this.baseUrl}/${key}`, data);
  }

  async createConfiguration(data: {
    config_key: string;
    config_value: any;
    config_type: string;
    category: string;
    subcategory?: string;
    display_name?: string;
    description?: string;
    default_value?: any;
    is_required?: boolean;
    validation_rule?: string;
    allowed_values?: any[];
    min_value?: number;
    max_value?: number;
    requires_restart?: boolean;
    cache_ttl_seconds?: number;
  }) {
    return this.post(this.baseUrl, data);
  }

  async deleteConfiguration(key: string, reason?: string) {
    return this.delete(`${this.baseUrl}/${key}`, { reason });
  }

  async getConfigurationHistory(key: string, limit = 50) {
    return this.get(`${this.baseUrl}/${key}/history?limit=${limit}`);
  }

  async rollbackConfiguration(key: string, data: {
    environment?: string;
    steps?: number;
    reason?: string;
  }) {
    return this.post(`${this.baseUrl}/${key}/rollback`, data);
  }

  async bulkUpdateConfigurations(data: {
    configurations: Array<{ key: string; value: any }>;
    environment?: string;
    reason: string;
  }) {
    return this.post(`${this.baseUrl}/bulk-update`, data);
  }

  async validateConfigurations(configurations: Array<{ key: string; value: any }>) {
    return this.post(`${this.baseUrl}/validate`, { configurations });
  }

  async exportConfigurations(options: {
    environment?: string;
    category?: string;
    format?: 'json' | 'csv';
  } = {}) {
    const params = new URLSearchParams();
    if (options.environment) params.append('environment', options.environment);
    if (options.category) params.append('category', options.category);
    if (options.format) params.append('format', options.format);

    const response = await fetch(`${this.baseUrl}/export?${params.toString()}`, {
      headers: this.getHeaders()
    });

    if (!response.ok) {
      throw new Error(`Export failed: ${response.statusText}`);
    }

    if (options.format === 'csv') {
      return response.text();
    } else {
      return response.json();
    }
  }

  // Feature Flag Management
  async getFeatureFlags() {
    return this.get(`${this.baseUrl}/features/flags`);
  }

  async checkFeatureFlag(featureKey: string, environment?: string) {
    const params = new URLSearchParams();
    if (environment) params.append('environment', environment);
    
    return this.get(`${this.baseUrl}/features/${featureKey}?${params.toString()}`);
  }

  async enableFeatureFlag(featureKey: string, data: {
    rollout_percentage?: number;
    targeting_rules?: any;
    reason?: string;
  }) {
    return this.post(`${this.baseUrl}/features/${featureKey}/enable`, data);
  }

  async disableFeatureFlag(featureKey: string, reason?: string) {
    return this.post(`${this.baseUrl}/features/${featureKey}/disable`, { reason });
  }

  async updateFeatureFlag(featureKey: string, data: {
    is_enabled?: boolean;
    rollout_percentage?: number;
    rollout_strategy?: string;
    enabled_for_users?: string[];
    enabled_for_roles?: string[];
    enabled_environments?: string[];
    targeting_rules?: any;
    start_date?: string;
    end_date?: string;
    description?: string;
    reason?: string;
  }) {
    return this.put(`${this.baseUrl}/features/${featureKey}`, data);
  }

  async createFeatureFlag(data: {
    feature_key: string;
    feature_name: string;
    description?: string;
    feature_category?: string;
    feature_type?: string;
    impact_level?: string;
    owner_team?: string;
    owner_email?: string;
    rollout_strategy?: string;
  }) {
    return this.post(`${this.baseUrl}/features`, data);
  }

  async deleteFeatureFlag(featureKey: string, reason?: string) {
    return this.delete(`${this.baseUrl}/features/${featureKey}`, { reason });
  }

  // Rate Limit Management
  async getRateLimits(environment?: string) {
    const params = new URLSearchParams();
    if (environment) params.append('environment', environment);
    
    return this.get(`${this.baseUrl}/rate-limits?${params.toString()}`);
  }

  async getRateLimit(key: string, scope = 'global') {
    return this.get(`${this.baseUrl}/rate-limits/${key}?scope=${scope}`);
  }

  async createRateLimit(data: {
    limit_key: string;
    limit_name: string;
    description?: string;
    max_requests: number;
    time_window_seconds: number;
    scope_type?: string;
    scope_pattern?: string;
    action_on_limit?: string;
    sliding_window?: boolean;
    priority?: number;
    environment?: string;
  }) {
    return this.post(`${this.baseUrl}/rate-limits`, data);
  }

  async updateRateLimit(key: string, data: {
    limit_name?: string;
    description?: string;
    max_requests?: number;
    time_window_seconds?: number;
    scope_type?: string;
    scope_pattern?: string;
    action_on_limit?: string;
    sliding_window?: boolean;
    priority?: number;
    environment?: string;
    is_active?: boolean;
  }) {
    return this.put(`${this.baseUrl}/rate-limits/${key}`, data);
  }

  async deleteRateLimit(key: string, reason?: string) {
    return this.delete(`${this.baseUrl}/rate-limits/${key}`, { reason });
  }

  // Template Management
  async getTemplates(templateType?: string) {
    const params = new URLSearchParams();
    if (templateType) params.append('template_type', templateType);
    
    return this.get(`${this.baseUrl}/templates?${params.toString()}`);
  }

  async getTemplate(templateName: string) {
    return this.get(`${this.baseUrl}/templates/${templateName}`);
  }

  async applyTemplate(templateName: string, data: {
    environment: string;
    reason?: string;
    dry_run?: boolean;
    override_existing?: boolean;
    selective_keys?: string[];
  }) {
    return this.post(`${this.baseUrl}/templates/${templateName}/apply`, data);
  }

  async createTemplate(data: {
    template_name: string;
    template_type: string;
    description?: string;
    config_values: Record<string, any>;
    feature_flags?: Record<string, any>;
    rate_limits?: Record<string, any>;
    suitable_environments?: string[];
    suitable_scale?: string;
    author?: string;
    team?: string;
  }) {
    return this.post(`${this.baseUrl}/templates`, data);
  }

  async updateTemplate(templateName: string, data: {
    description?: string;
    config_values?: Record<string, any>;
    feature_flags?: Record<string, any>;
    rate_limits?: Record<string, any>;
    suitable_environments?: string[];
    suitable_scale?: string;
  }) {
    return this.put(`${this.baseUrl}/templates/${templateName}`, data);
  }

  async deleteTemplate(templateName: string, reason?: string) {
    return this.delete(`${this.baseUrl}/templates/${templateName}`, { reason });
  }

  async previewTemplate(templateName: string, environment: string) {
    return this.applyTemplate(templateName, { environment, dry_run: true });
  }

  // Audit Trail
  async getAuditTrail(filters: {
    resource_id?: string;
    user_id?: string;
    environment?: string;
    start_date?: string;
    end_date?: string;
    action?: string;
    risk_level?: string;
    limit?: number;
    offset?: number;
  } = {}) {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined) {
        params.append(key, value.toString());
      }
    });
    
    return this.get(`${this.baseUrl}/audit?${params.toString()}`);
  }

  async exportAuditTrail(filters: {
    resource_id?: string;
    user_id?: string;
    environment?: string;
    start_date?: string;
    end_date?: string;
    format?: 'json' | 'csv' | 'xml';
  } = {}) {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined) {
        params.append(key, value.toString());
      }
    });

    const response = await fetch(`${this.baseUrl}/audit/export?${params.toString()}`, {
      headers: this.getHeaders()
    });

    if (!response.ok) {
      throw new Error(`Audit export failed: ${response.statusText}`);
    }

    if (filters.format === 'csv' || filters.format === 'xml') {
      return response.text();
    } else {
      return response.json();
    }
  }

  // System Health and Statistics
  async getHealth(): Promise<HealthStatus> {
    return this.get(`${this.baseUrl}/health`);
  }

  async getStats(environment?: string): Promise<ConfigurationStats> {
    const params = new URLSearchParams();
    if (environment) params.append('environment', environment);
    
    return this.get(`${this.baseUrl}/stats?${params.toString()}`);
  }

  // Compliance and Reporting
  async generateComplianceReport(standard: string, timeRange = '30d') {
    return this.get(`${this.baseUrl}/compliance/${standard}?time_range=${timeRange}`);
  }

  // Utility Methods
  async searchConfigurations(query: string, filters: {
    category?: string;
    environment?: string;
    config_type?: string;
  } = {}) {
    const params = new URLSearchParams();
    params.append('search', query);
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.append(key, value);
    });
    
    return this.get(`${this.baseUrl}/search?${params.toString()}`);
  }

  async getConfigurationDependencies(key: string) {
    return this.get(`${this.baseUrl}/${key}/dependencies`);
  }

  async testConfiguration(key: string, value: any, environment?: string) {
    return this.post(`${this.baseUrl}/${key}/test`, {
      value,
      environment,
      dry_run: true
    });
  }
}

export const configurationService = new ConfigurationService();