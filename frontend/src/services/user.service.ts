import { api } from './api';

export interface User {
  id: string;
  username: string;
  email: string;
  roles: { role_name: string }[];
  account_status: 'active' | 'inactive' | 'suspended' | 'pending';
  last_login: Date | null;
  created_at: Date;
  mfa_enabled?: boolean;
  email_verified?: boolean;
}

export interface UserFilters {
  search?: string;
  role?: string;
  status?: string;
  dateRange?: { start: Date | null; end: Date | null } | null;
  sort?: { field: string; direction: 'asc' | 'desc' };
  page?: number;
  limit?: number;
}

export interface BulkActionRequest {
  action: string;
  userIds: string[];
}

class UserService {
  async getUsers(filters: UserFilters) {
    const response = await api.get('/admin/users', {
      params: filters
    });
    return response.data;
  }
  
  async getUser(userId: string): Promise<User> {
    const response = await api.get(`/admin/users/${userId}`);
    return response.data;
  }
  
  async createUser(userData: {
    username: string;
    email: string;
    password: string;
    roles: string[];
  }) {
    const response = await api.post('/admin/users', userData);
    return response.data;
  }
  
  async updateUser(userId: string, updates: Partial<User>) {
    const response = await api.put(`/admin/users/${userId}`, updates);
    return response.data;
  }
  
  async deleteUser(userId: string) {
    const response = await api.delete(`/admin/users/${userId}`);
    return response.data;
  }
  
  async bulkAction(request: BulkActionRequest) {
    const response = await api.post('/admin/users/bulk', request);
    return response.data;
  }
  
  async resetPassword(userId: string) {
    const response = await api.post(`/admin/users/${userId}/reset-password`);
    return response.data;
  }
  
  async suspendUser(userId: string, reason: string) {
    const response = await api.post(`/admin/users/${userId}/suspend`, { reason });
    return response.data;
  }
  
  async activateUser(userId: string) {
    const response = await api.post(`/admin/users/${userId}/activate`);
    return response.data;
  }
  
  async exportUsers(filters: UserFilters): Promise<Blob> {
    const response = await api.get('/admin/users/export', {
      params: filters,
      responseType: 'blob'
    });
    return response.data;
  }
  
  async getUserActivity(userId: string, days: number = 30) {
    const response = await api.get(`/admin/users/${userId}/activity`, {
      params: { days }
    });
    return response.data;
  }
  
  async getUserSessions(userId: string) {
    const response = await api.get(`/admin/users/${userId}/sessions`);
    return response.data;
  }
  
  async terminateUserSessions(userId: string) {
    const response = await api.post(`/admin/users/${userId}/sessions/terminate`);
    return response.data;
  }
  
  async assignRole(userId: string, roleId: string) {
    const response = await api.post(`/admin/users/${userId}/roles`, { roleId });
    return response.data;
  }
  
  async removeRole(userId: string, roleId: string) {
    const response = await api.delete(`/admin/users/${userId}/roles/${roleId}`);
    return response.data;
  }
}

export const userService = new UserService();