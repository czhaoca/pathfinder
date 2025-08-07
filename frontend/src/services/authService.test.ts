import { describe, it, expect, beforeEach, vi } from 'vitest';
import authService from './authService';
import { API_BASE_URL } from '@/config';

// Mock fetch globally
global.fetch = vi.fn();

describe('AuthService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
  });

  describe('login', () => {
    it('should login successfully and store tokens', async () => {
      const mockResponse = {
        success: true,
        data: {
          user: {
            id: 'user-123',
            username: 'testuser',
            email: 'test@example.com',
          },
          token: 'mock-token',
          refreshToken: 'mock-refresh-token',
        },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await authService.login('testuser', 'password123');

      expect(global.fetch).toHaveBeenCalledWith(
        `${API_BASE_URL}/auth/login`,
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            username: 'testuser',
            password: 'password123',
          }),
        })
      );

      expect(result).toEqual(mockResponse.data);
      expect(localStorage.getItem('token')).toBe('mock-token');
      expect(localStorage.getItem('refreshToken')).toBe('mock-refresh-token');
    });

    it('should handle login failure', async () => {
      const mockError = {
        success: false,
        message: 'Invalid credentials',
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => mockError,
      });

      await expect(
        authService.login('testuser', 'wrongpassword')
      ).rejects.toThrow('Invalid credentials');

      expect(localStorage.getItem('token')).toBeNull();
    });

    it('should handle network errors', async () => {
      (global.fetch as any).mockRejectedValueOnce(
        new Error('Network error')
      );

      await expect(
        authService.login('testuser', 'password')
      ).rejects.toThrow('Network error');
    });
  });

  describe('register', () => {
    it('should register successfully', async () => {
      const userData = {
        username: 'newuser',
        email: 'new@example.com',
        password: 'Password123!',
        firstName: 'New',
        lastName: 'User',
      };

      const mockResponse = {
        success: true,
        data: {
          user: {
            id: 'user-456',
            ...userData,
          },
          token: 'mock-token',
          refreshToken: 'mock-refresh-token',
        },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await authService.register(userData);

      expect(global.fetch).toHaveBeenCalledWith(
        `${API_BASE_URL}/auth/register`,
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(userData),
        })
      );

      expect(result).toEqual(mockResponse.data);
      expect(localStorage.getItem('token')).toBe('mock-token');
    });

    it('should handle registration errors', async () => {
      const mockError = {
        success: false,
        message: 'Username already exists',
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: async () => mockError,
      });

      await expect(
        authService.register({
          username: 'existinguser',
          email: 'test@example.com',
          password: 'Password123!',
          firstName: 'Test',
          lastName: 'User',
        })
      ).rejects.toThrow('Username already exists');
    });
  });

  describe('logout', () => {
    it('should logout successfully and clear tokens', async () => {
      localStorage.setItem('token', 'mock-token');
      localStorage.setItem('refreshToken', 'mock-refresh-token');

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      await authService.logout();

      expect(global.fetch).toHaveBeenCalledWith(
        `${API_BASE_URL}/auth/logout`,
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Authorization': 'Bearer mock-token',
            'Content-Type': 'application/json',
          },
        })
      );

      expect(localStorage.getItem('token')).toBeNull();
      expect(localStorage.getItem('refreshToken')).toBeNull();
    });

    it('should clear tokens even if logout request fails', async () => {
      localStorage.setItem('token', 'mock-token');
      localStorage.setItem('refreshToken', 'mock-refresh-token');

      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      await authService.logout();

      expect(localStorage.getItem('token')).toBeNull();
      expect(localStorage.getItem('refreshToken')).toBeNull();
    });
  });

  describe('refreshToken', () => {
    it('should refresh token successfully', async () => {
      localStorage.setItem('refreshToken', 'old-refresh-token');

      const mockResponse = {
        success: true,
        data: {
          token: 'new-token',
          refreshToken: 'new-refresh-token',
        },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await authService.refreshToken();

      expect(global.fetch).toHaveBeenCalledWith(
        `${API_BASE_URL}/auth/refresh`,
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            refreshToken: 'old-refresh-token',
          }),
        })
      );

      expect(result).toEqual(mockResponse.data);
      expect(localStorage.getItem('token')).toBe('new-token');
      expect(localStorage.getItem('refreshToken')).toBe('new-refresh-token');
    });

    it('should handle refresh token failure', async () => {
      localStorage.setItem('refreshToken', 'invalid-refresh-token');

      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ message: 'Invalid refresh token' }),
      });

      await expect(authService.refreshToken()).rejects.toThrow(
        'Invalid refresh token'
      );

      expect(localStorage.getItem('token')).toBeNull();
      expect(localStorage.getItem('refreshToken')).toBeNull();
    });
  });

  describe('getCurrentUser', () => {
    it('should get current user when token exists', async () => {
      localStorage.setItem('token', 'valid-token');

      const mockUser = {
        id: 'user-123',
        username: 'testuser',
        email: 'test@example.com',
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: mockUser,
        }),
      });

      const result = await authService.getCurrentUser();

      expect(global.fetch).toHaveBeenCalledWith(
        `${API_BASE_URL}/auth/me`,
        expect.objectContaining({
          headers: {
            'Authorization': 'Bearer valid-token',
          },
        })
      );

      expect(result).toEqual(mockUser);
    });

    it('should return null when no token exists', async () => {
      localStorage.removeItem('token');

      const result = await authService.getCurrentUser();

      expect(result).toBeNull();
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should handle unauthorized response', async () => {
      localStorage.setItem('token', 'invalid-token');

      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      const result = await authService.getCurrentUser();

      expect(result).toBeNull();
      expect(localStorage.getItem('token')).toBeNull();
    });
  });

  describe('isAuthenticated', () => {
    it('should return true when token exists', () => {
      localStorage.setItem('token', 'valid-token');
      expect(authService.isAuthenticated()).toBe(true);
    });

    it('should return false when token does not exist', () => {
      localStorage.removeItem('token');
      expect(authService.isAuthenticated()).toBe(false);
    });
  });

  describe('getToken', () => {
    it('should return token from localStorage', () => {
      localStorage.setItem('token', 'test-token');
      expect(authService.getToken()).toBe('test-token');
    });

    it('should return null when no token exists', () => {
      localStorage.removeItem('token');
      expect(authService.getToken()).toBeNull();
    });
  });

  describe('interceptors', () => {
    it('should add auth header to requests', async () => {
      localStorage.setItem('token', 'auth-token');

      const mockResponse = { success: true, data: {} };
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      // Simulate an authenticated API call
      await fetch(`${API_BASE_URL}/api/profile`, {
        headers: authService.getAuthHeaders(),
      });

      expect(global.fetch).toHaveBeenCalledWith(
        `${API_BASE_URL}/api/profile`,
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer auth-token',
          }),
        })
      );
    });

    it('should handle 401 responses by refreshing token', async () => {
      localStorage.setItem('token', 'expired-token');
      localStorage.setItem('refreshToken', 'valid-refresh-token');

      // First call returns 401
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      // Refresh token call
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            token: 'new-token',
            refreshToken: 'new-refresh-token',
          },
        }),
      });

      // Retry original request
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: { profile: {} } }),
      });

      // This would typically be handled by an interceptor
      const makeAuthenticatedRequest = async () => {
        const response = await fetch(`${API_BASE_URL}/api/profile`, {
          headers: authService.getAuthHeaders(),
        });

        if (response.status === 401) {
          await authService.refreshToken();
          // Retry with new token
          return fetch(`${API_BASE_URL}/api/profile`, {
            headers: authService.getAuthHeaders(),
          });
        }

        return response;
      };

      const result = await makeAuthenticatedRequest();
      expect(result.ok).toBe(true);
      expect(localStorage.getItem('token')).toBe('new-token');
    });
  });

  describe('getAuthHeaders', () => {
    it('should return headers with Authorization when token exists', () => {
      localStorage.setItem('token', 'test-token');
      
      const headers = authService.getAuthHeaders();
      
      expect(headers).toEqual({
        'Authorization': 'Bearer test-token',
        'Content-Type': 'application/json',
      });
    });

    it('should return headers without Authorization when no token', () => {
      localStorage.removeItem('token');
      
      const headers = authService.getAuthHeaders();
      
      expect(headers).toEqual({
        'Content-Type': 'application/json',
      });
    });
  });
});