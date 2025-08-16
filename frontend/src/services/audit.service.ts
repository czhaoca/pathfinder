import { api } from './api';

export interface AuditLog {
  id: string;
  event_id: string;
  event_type: string;
  event_name: string;
  event_timestamp: Date;
  event_severity: 'debug' | 'info' | 'warning' | 'error' | 'critical' | 'emergency';
  actor_id: string;
  actor_username: string;
  target_id?: string;
  target_name?: string;
  action_result: 'success' | 'failure' | 'partial';
  ip_address: string;
  user_agent: string;
  session_id: string;
  error_message?: string;
  old_values?: any;
  new_values?: any;
  event_hash: string;
  risk_score: number;
  compliance_frameworks?: string;
}

export interface AuditFilters {
  dateRange: { start: Date | null; end: Date | null };
  eventType: string;
  severity: string;
  actor: string;
  target: string;
  searchText: string;
  page?: number;
  limit?: number;
}

class AuditService {
  async getLogs(filters: AuditFilters) {
    const response = await api.get('/admin/audit-logs', {
      params: {
        ...filters,
        startDate: filters.dateRange.start?.toISOString(),
        endDate: filters.dateRange.end?.toISOString()
      }
    });
    return response.data;
  }
  
  async getLog(logId: string): Promise<AuditLog> {
    const response = await api.get(`/admin/audit-logs/${logId}`);
    return response.data;
  }
  
  async exportLogs(filters: AuditFilters): Promise<Blob> {
    const response = await api.get('/admin/audit-logs/export', {
      params: {
        ...filters,
        startDate: filters.dateRange.start?.toISOString(),
        endDate: filters.dateRange.end?.toISOString()
      },
      responseType: 'blob'
    });
    return response.data;
  }
  
  async getEventTypes() {
    const response = await api.get('/admin/audit-logs/event-types');
    return response.data;
  }
  
  async getEventStats(period: 'hour' | 'day' | 'week' | 'month' = 'day') {
    const response = await api.get('/admin/audit-logs/stats', {
      params: { period }
    });
    return response.data;
  }
  
  async verifyLogIntegrity(logId: string) {
    const response = await api.post(`/admin/audit-logs/${logId}/verify`);
    return response.data;
  }
  
  async getComplianceEvents(framework: string) {
    const response = await api.get('/admin/audit-logs/compliance', {
      params: { framework }
    });
    return response.data;
  }
  
  async getRiskAnalysis(startDate: Date, endDate: Date) {
    const response = await api.get('/admin/audit-logs/risk-analysis', {
      params: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      }
    });
    return response.data;
  }
  
  subscribeToLogs(callback: (log: AuditLog) => void) {
    // This would typically use WebSocket or SSE
    // For now, return a mock unsubscribe function
    return {
      unsubscribe: () => {}
    };
  }
}

export const auditService = new AuditService();