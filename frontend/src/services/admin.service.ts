import { api } from './api';

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
}

export const adminService = new AdminService();