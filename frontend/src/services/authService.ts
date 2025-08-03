import api from '@/lib/api';
import { LoginCredentials, RegisterData, AuthResponse } from '@/types';
import { handleApiError, validateEmail, validatePassword, validateRequired } from '@/utils/errorHandler';

class AuthService {
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      // Validate inputs
      validateRequired(credentials.username, 'Username');
      validateRequired(credentials.password, 'Password');
      
      const response = await api.post<AuthResponse>('/auth/login', credentials);
      return response.data || response;
    } catch (error) {
      throw handleApiError(error);
    }
  }

  async register(data: RegisterData): Promise<AuthResponse> {
    try {
      // Validate inputs
      validateRequired(data.username, 'Username');
      validateEmail(data.email);
      validatePassword(data.password);
      validateRequired(data.firstName, 'First name');
      validateRequired(data.lastName, 'Last name');
      
      const response = await api.post<AuthResponse>('/auth/register', data);
      return response.data || response;
    } catch (error) {
      throw handleApiError(error);
    }
  }

  async refreshToken(refreshToken: string): Promise<AuthResponse> {
    try {
      validateRequired(refreshToken, 'Refresh token');
      
      const response = await api.post<AuthResponse>('/auth/refresh', { refreshToken });
      return response.data || response;
    } catch (error) {
      throw handleApiError(error);
    }
  }

  async logout(): Promise<void> {
    try {
      await api.post('/auth/logout');
    } catch (error) {
      // Don't throw on logout errors, just log them
      console.error('Logout error:', error);
    }
  }

  async validateToken(token: string): Promise<boolean> {
    try {
      validateRequired(token, 'Token');
      
      const response = await api.get<{ valid: boolean }>('/auth/validate', {
        headers: { Authorization: `Bearer ${token}` }
      });
      return response.data?.valid || false;
    } catch {
      return false;
    }
  }
}

export const authService = new AuthService();