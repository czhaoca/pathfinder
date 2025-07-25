import api from '@/lib/api';
import { LoginCredentials, RegisterData, AuthResponse } from '@/types';

class AuthService {
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    return api.post<AuthResponse>('/auth/login', credentials);
  }

  async register(data: RegisterData): Promise<AuthResponse> {
    return api.post<AuthResponse>('/auth/register', data);
  }

  async refreshToken(refreshToken: string): Promise<AuthResponse> {
    return api.post<AuthResponse>('/auth/refresh', { refreshToken });
  }

  async logout(): Promise<void> {
    return api.post('/auth/logout');
  }

  async validateToken(token: string): Promise<boolean> {
    try {
      const response = await api.get('/auth/validate', {
        headers: { Authorization: `Bearer ${token}` }
      });
      return response.valid;
    } catch {
      return false;
    }
  }
}

export const authService = new AuthService();