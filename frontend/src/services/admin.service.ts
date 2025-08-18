import { api } from './api';
import { AxiosResponse } from 'axios';

export interface DashboardMetrics {
  totalUsers: number;
  userGrowth: number;
  activeSessions: number;
  failedLogins: number;
  pendingApprovals: number;
}

export interface SecurityAlert {
  id: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  timestamp: Date;
  resolved: boolean;
}

export interface ActivityLog {
  id: string;
  type: string;
  action: string;
  actor: string;
  target?: string;
  timestamp: Date;
  result: 'success' | 'failure';
}

export interface SystemHealth {
  cpu: number;
  memory: number;
  disk: number;
  database: {
    connected: boolean;
    latency: number;
    activeConnections: number;
  };
  api: {
    status: 'healthy' | 'degraded' | 'down';
    responseTime: number;
    errorRate: number;
  };
  websocket: {
    connected: boolean;
    clients: number;
  };
}

export interface User {
  id: string;
  username: string;
  email: string;
  status: 'active' | 'inactive' | 'suspended' | 'deleted';
  role: string;
  createdAt: Date;
  lastActive: Date;
  avatar?: string;
}

export interface BulkOperationResult {
  processed: number;
  successful: number;
  failed: number;
  details: Array<{
    userId: string;
    status: 'success' | 'failed';
    error?: string;
  }>;
}

export interface FeatureFlag {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  rolloutPercentage: number;
  targetGroups: string[];
  conditions: any[];
  history: Array<{
    action: string;
    timestamp: Date;
    user: string;
    details?: string;
  }>;
  metrics?: {
    enabledUsers: number;
    totalUsers: number;
    adoptionRate: number;
  };
}

export interface SystemConfig {
  [category: string]: Array<{
    key: string;
    value: any;
    type: string;
    editable: boolean;
    sensitive?: boolean;
    description?: string;
    lastModified?: Date;
    modifiedBy?: string;
  }>;
}

export interface ApiKey {
  id: string;
  name: string;
  key: string;
  scopes: string[];
  createdAt: Date;
  expiresAt?: Date;
  lastUsed?: Date;
  usageCount: number;
}

export interface InvitationDashboard {
  invitations: Array<{
    id: string;
    email: string;
    status: 'pending' | 'accepted' | 'expired';
    sentAt: Date;
    expiresAt: Date;
  }>;
  statistics: {
    total: number;
    pending: number;
    accepted: number;
    expired: number;
    acceptanceRate: number;
    averageTimeToAccept: number;
  };
  templates: Array<{
    id: string;
    name: string;
    usageCount: number;
  }>;
}

export interface SecurityPolicies {
  passwordPolicy: {
    minLength: number;
    requireUppercase: boolean;
    requireLowercase: boolean;
    requireNumbers: boolean;
    requireSpecialChars: boolean;
    maxAge: number;
  };
  sessionPolicy: {
    timeout: number;
    maxConcurrent: number;
    requireMFA: boolean;
  };
  rateLimiting: {
    [endpoint: string]: {
      attempts: number;
      window: number;
    };
  };
}

export interface ServiceHealth {
  [service: string]: {
    status: 'healthy' | 'unhealthy' | 'degraded' | 'error';
    responseTime?: number;
    details?: any;
    lastCheck: Date;
    error?: string;
  };
}

export interface BackgroundJob {
  id: string;
  type: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  retryCount: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  keys: number;
  evictions: number;
}

class AdminService {
  async getDashboardMetrics(): Promise<DashboardMetrics> {
    const response = await api.get('/admin/metrics');
    return response.data;
  }
  
  async getSecurityAlerts(): Promise<SecurityAlert[]> {
    const response = await api.get('/admin/security/alerts');
    return response.data;
  }
  
  async dismissAlert(alertId: string): Promise<void> {
    await api.post(`/admin/security/alerts/${alertId}/dismiss`);
  }
  
  async getRecentActivity(limit: number): Promise<ActivityLog[]> {
    const response = await api.get('/admin/activity', {
      params: { limit }
    });
    return response.data;
  }
  
  async getSystemHealth(): Promise<SystemHealth> {
    const response = await api.get('/admin/system/health');
    return response.data;
  }
  
  async getUserStats(period: 'day' | 'week' | 'month' | 'year' = 'month') {
    const response = await api.get('/admin/stats/users', {
      params: { period }
    });
    return response.data;
  }
  
  async getSystemConfig() {
    const response = await api.get('/admin/system/config');
    return response.data;
  }
  
  async updateSystemConfig(config: any) {
    const response = await api.put('/admin/system/config', config);
    return response.data;
  }
  
  async getRoleStats() {
    const response = await api.get('/admin/stats/roles');
    return response.data;
  }
  
  async getComplianceReport(framework: 'hipaa' | 'gdpr' | 'sox' | 'all' = 'all') {
    const response = await api.get('/admin/compliance/report', {
      params: { framework }
    });
    return response.data;
  }
  
  async exportComplianceReport(framework: string): Promise<Blob> {
    const response = await api.get('/admin/compliance/export', {
      params: { framework },
      responseType: 'blob'
    });
    return response.data;
  }

  // User Management
  async getUsers(filters?: any): Promise<{ users: User[]; total: number; page: number; totalPages: number }> {
    const response = await api.get('/admin/users', { params: filters });
    return response.data.data;
  }

  async advancedUserSearch(params: any): Promise<{ users: User[]; total: number }> {
    const response = await api.get('/admin/users/search', { params });
    return response.data.data;
  }

  async bulkUserOperation(userIds: string[], operation: string, reason: string): Promise<BulkOperationResult> {
    const response = await api.post('/admin/users/bulk', {
      userIds,
      operation,
      reason
    });
    return response.data.data;
  }

  async impersonateUser(userId: string): Promise<{ token: string; expiresAt: Date }> {
    const response = await api.post(`/admin/users/${userId}/impersonate`);
    return response.data.data;
  }

  async updateUserStatus(userId: string, status: string, reason: string): Promise<void> {
    await api.put(`/admin/users/${userId}/status`, { status, reason });
  }

  // Feature Flag Management
  async getFeatureFlags(): Promise<{ flags: FeatureFlag[]; statistics: any }> {
    const response = await api.get('/admin/feature-flags');
    return response.data.data;
  }

  async updateFeatureFlag(flagId: string, updates: any, reason: string): Promise<FeatureFlag> {
    const response = await api.put(`/admin/feature-flags/${flagId}`, {
      ...updates,
      reason
    });
    return response.data.data;
  }

  async createABTest(flagId: string, config: any): Promise<any> {
    const response = await api.post(`/admin/feature-flags/${flagId}/test`, config);
    return response.data.data;
  }

  // System Configuration
  async getSystemConfiguration(): Promise<SystemConfig> {
    const response = await api.get('/admin/config');
    return response.data.data;
  }

  async updateConfiguration(key: string, value: any, reason: string): Promise<any> {
    const response = await api.put(`/admin/config/${key}`, { value, reason });
    return response.data.data;
  }

  async getApiKeys(): Promise<{ keys: ApiKey[]; total: number }> {
    const response = await api.get('/admin/api-keys');
    return response.data.data;
  }

  async createApiKey(name: string, scopes: string[], expiresIn?: number): Promise<ApiKey> {
    const response = await api.post('/admin/api-keys', {
      name,
      scopes,
      expiresIn
    });
    return response.data.data;
  }

  async revokeApiKey(keyId: string, reason: string): Promise<void> {
    await api.delete(`/admin/api-keys/${keyId}`, { data: { reason } });
  }

  // Invitation Management
  async getInvitationDashboard(): Promise<InvitationDashboard> {
    const response = await api.get('/admin/invitations/dashboard');
    return response.data.data;
  }

  async sendBulkInvitations(emails: string[], options: any): Promise<any> {
    const response = await api.post('/admin/invitations/bulk', {
      emails,
      ...options
    });
    return response.data.data;
  }

  async resendInvitation(invitationId: string): Promise<void> {
    await api.post(`/admin/invitations/${invitationId}/resend`);
  }

  // Security Settings
  async getSecuritySettings(): Promise<SecurityPolicies> {
    const response = await api.get('/admin/security/policies');
    return response.data.data;
  }

  async updateRateLimits(endpoint: string, settings: any, reason: string): Promise<any> {
    const response = await api.put('/admin/security/rate-limits', {
      endpoint,
      ...settings,
      reason
    });
    return response.data.data;
  }

  async updateSecurityPolicy(policyType: string, settings: any, reason: string): Promise<void> {
    await api.put(`/admin/security/policies/${policyType}`, {
      settings,
      reason
    });
  }

  // Service Health
  async getServicesHealth(): Promise<ServiceHealth> {
    const response = await api.get('/admin/services/health');
    return response.data.data;
  }

  async restartService(service: string, reason: string): Promise<any> {
    const response = await api.post(`/admin/services/${service}/restart`, { reason });
    return response.data.data;
  }

  // Cache Management
  async getCacheStats(): Promise<CacheStats> {
    const response = await api.get('/admin/cache/stats');
    return response.data.data;
  }

  async clearCache(pattern: string, reason: string): Promise<any> {
    const response = await api.delete(`/admin/cache/${pattern}`, { data: { reason } });
    return response.data.data;
  }

  // Background Jobs
  async getBackgroundJobs(filters?: any): Promise<BackgroundJob[]> {
    const response = await api.get('/admin/jobs', { params: filters });
    return response.data.data;
  }

  async retryJob(jobId: string): Promise<any> {
    const response = await api.post(`/admin/jobs/${jobId}/retry`);
    return response.data.data;
  }

  // Audit Logs
  async getAuditLogs(filters?: any): Promise<any> {
    const response = await api.get('/admin/audit-logs', { params: filters });
    return response.data.data;
  }

  async exportAuditLogs(format: string, filters?: any): Promise<Blob> {
    const response = await api.get('/admin/audit-logs/export', {
      params: { format, ...filters },
      responseType: 'blob'
    });
    return response.data;
  }
}

export const adminService = new AdminService();