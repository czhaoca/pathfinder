import { api } from './api';

export interface DeletionRequest {
  user_id: string;
  username: string;
  email: string;
  deletion_requested_at: Date;
  deletion_scheduled_for: Date;
  deletion_type: 'user_requested' | 'admin_initiated' | 'compliance_required';
  reason?: string;
  category: string;
  status: 'pending' | 'cancelled' | 'completed';
  cancellation_token: string;
  reminder_1_sent: boolean;
  reminder_3_sent: boolean;
  reminder_6_sent: boolean;
}

export interface DeletionFilters {
  status?: 'all' | 'pending' | 'cancelled' | 'completed';
  type?: string;
  dateRange?: { start: Date | null; end: Date | null };
}

class DeletionService {
  async getQueue(filters: DeletionFilters = {}) {
    const response = await api.get('/admin/deletion-queue', {
      params: filters
    });
    return response.data;
  }
  
  async getDeletionRequest(userId: string): Promise<DeletionRequest> {
    const response = await api.get(`/admin/deletion-queue/${userId}`);
    return response.data;
  }
  
  async cancelDeletion(userId: string, token: string) {
    const response = await api.post(`/admin/deletion-queue/${userId}/cancel`, {
      cancellation_token: token
    });
    return response.data;
  }
  
  async overrideCoolingOff(userId: string) {
    const response = await api.post(`/admin/deletion-queue/${userId}/override`);
    return response.data;
  }
  
  async scheduleDeletion(userId: string, options: {
    type: 'user_requested' | 'admin_initiated' | 'compliance_required';
    reason?: string;
    category: string;
  }) {
    const response = await api.post('/admin/deletion-queue', {
      user_id: userId,
      ...options
    });
    return response.data;
  }
  
  async getStats() {
    const response = await api.get('/admin/deletion-queue/stats');
    return response.data;
  }
  
  async sendReminder(userId: string, reminderType: '1_day' | '3_day' | '6_day') {
    const response = await api.post(`/admin/deletion-queue/${userId}/reminder`, {
      type: reminderType
    });
    return response.data;
  }
  
  async exportQueue(filters: DeletionFilters = {}): Promise<Blob> {
    const response = await api.get('/admin/deletion-queue/export', {
      params: filters,
      responseType: 'blob'
    });
    return response.data;
  }
}

export const deletionService = new DeletionService();