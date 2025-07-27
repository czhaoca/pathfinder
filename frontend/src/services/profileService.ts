import api from '@/lib/api';
import { User } from '@/types';

export interface ProfileUpdateData {
  firstName?: string;
  lastName?: string;
  email?: string;
  phoneNumber?: string;
  professionalSummary?: string;
  careerGoals?: string[];
  skills?: string[];
}

export interface PasswordChangeData {
  currentPassword: string;
  newPassword: string;
}

class ProfileService {
  async getProfile(): Promise<User> {
    return api.get<User>('/profile');
  }

  async updateProfile(data: ProfileUpdateData): Promise<User> {
    return api.put<User>('/profile', data);
  }

  async changePassword(data: PasswordChangeData): Promise<{ message: string }> {
    return api.post<{ message: string }>('/profile/change-password', data);
  }

  async deleteAccount(): Promise<{ message: string }> {
    return api.delete<{ message: string }>('/profile');
  }
}

export const profileService = new ProfileService();