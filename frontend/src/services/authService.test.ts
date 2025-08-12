import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as authService from './authService';
import axios from 'axios';
import { config } from '@/config';

// Mock axios
vi.mock('axios');

describe('AuthService', () => {
  const mockAxios = vi.mocked(axios);

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    
    // Setup default axios mock
    mockAxios.create = vi.fn(() => mockAxios);
    mockAxios.interceptors = {
      request: { use: vi.fn() },
      response: { use: vi.fn() }
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('login', () => {
    it('should login successfully and store tokens', async () => {
      const credentials = {
        username: 'testuser',
        password: 'TestPassword123!'
      };

      const mockResponse = {
        data: {
          success: true,
          data: {
            token: 'mock-token',
            refreshToken: 'mock-refresh-token',
            user: {
              id: 'user-123',
              username: 'testuser',
              email: 'test@example.com'
            }
          }
        }
      };

      mockAxios.post.mockResolvedValue(mockResponse);

      const result = await authService.login(credentials);

      expect(mockAxios.post).toHaveBeenCalledWith(
        config.endpoints.auth.login,
        credentials
      );

      expect(result).toEqual(mockResponse.data.data);
      expect(localStorage.getItem(config.storage.authToken)).toBe('mock-token');
      expect(localStorage.getItem(config.storage.refreshToken)).toBe('mock-refresh-token');
      expect(JSON.parse(localStorage.getItem(config.storage.user)!)).toEqual(mockResponse.data.data.user);
    });

    it('should handle login failure', async () => {
      const credentials = {
        username: 'testuser',
        password: 'wrongpassword'
      };

      const mockError = {
        response: {
          data: {
            success: false,
            message: 'Invalid credentials'
          },
          status: 401
        }
      };

      mockAxios.post.mockRejectedValue(mockError);

      await expect(authService.login(credentials)).rejects.toThrow('Invalid credentials');

      expect(localStorage.getItem(config.storage.authToken)).toBeNull();
      expect(localStorage.getItem(config.storage.refreshToken)).toBeNull();
    });

    it('should handle network errors', async () => {
      const credentials = {
        username: 'testuser',
        password: 'TestPassword123!'
      };

      mockAxios.post.mockRejectedValue(new Error('Network Error'));

      await expect(authService.login(credentials)).rejects.toThrow('Network Error');
    });
  });

  describe('register', () => {
    it('should register successfully', async () => {
      const userData = {
        username: 'newuser',
        email: 'new@example.com',
        password: 'TestPassword123!',
        firstName: 'New',
        lastName: 'User'
      };

      const mockResponse = {
        data: {
          success: true,
          data: {
            token: 'mock-token',
            refreshToken: 'mock-refresh-token',
            user: {
              id: 'user-456',
              username: 'newuser',
              email: 'new@example.com'
            }
          }
        }
      };

      mockAxios.post.mockResolvedValue(mockResponse);

      const result = await authService.register(userData);

      expect(mockAxios.post).toHaveBeenCalledWith(
        config.endpoints.auth.register,
        userData
      );

      expect(result).toEqual(mockResponse.data.data);
      expect(localStorage.getItem(config.storage.authToken)).toBe('mock-token');
    });

    it('should handle registration errors', async () => {
      const userData = {
        username: 'existinguser',
        email: 'existing@example.com',
        password: 'TestPassword123!',
        firstName: 'Existing',
        lastName: 'User'
      };

      const mockError = {
        response: {
          data: {
            success: false,
            message: 'Username already exists',
            errors: {
              username: 'This username is already taken'
            }
          },
          status: 400
        }
      };

      mockAxios.post.mockRejectedValue(mockError);

      await expect(authService.register(userData)).rejects.toThrow('Username already exists');
    });
  });

  describe('logout', () => {
    it('should logout successfully', async () => {
      // Setup initial auth state
      localStorage.setItem(config.storage.authToken, 'mock-token');
      localStorage.setItem(config.storage.refreshToken, 'mock-refresh-token');
      localStorage.setItem(config.storage.user, JSON.stringify({ id: 'user-123' }));

      mockAxios.post.mockResolvedValue({ data: { success: true } });

      await authService.logout();

      expect(mockAxios.post).toHaveBeenCalledWith(config.endpoints.auth.logout);
      expect(localStorage.getItem(config.storage.authToken)).toBeNull();
      expect(localStorage.getItem(config.storage.refreshToken)).toBeNull();
      expect(localStorage.getItem(config.storage.user)).toBeNull();
    });

    it('should clear local storage even if API call fails', async () => {
      localStorage.setItem(config.storage.authToken, 'mock-token');
      localStorage.setItem(config.storage.refreshToken, 'mock-refresh-token');
      localStorage.setItem(config.storage.user, JSON.stringify({ id: 'user-123' }));

      mockAxios.post.mockRejectedValue(new Error('Network error'));

      await authService.logout();

      expect(localStorage.getItem(config.storage.authToken)).toBeNull();
      expect(localStorage.getItem(config.storage.refreshToken)).toBeNull();
      expect(localStorage.getItem(config.storage.user)).toBeNull();
    });
  });

  describe('refreshToken', () => {
    it('should refresh token successfully', async () => {
      localStorage.setItem(config.storage.refreshToken, 'old-refresh-token');

      const mockResponse = {
        data: {
          success: true,
          data: {
            token: 'new-token',
            refreshToken: 'new-refresh-token'
          }
        }
      };

      mockAxios.post.mockResolvedValue(mockResponse);

      const result = await authService.refreshToken();

      expect(mockAxios.post).toHaveBeenCalledWith(
        config.endpoints.auth.refresh,
        { refreshToken: 'old-refresh-token' }
      );

      expect(result).toEqual(mockResponse.data.data);
      expect(localStorage.getItem(config.storage.authToken)).toBe('new-token');
      expect(localStorage.getItem(config.storage.refreshToken)).toBe('new-refresh-token');
    });

    it('should handle refresh token failure', async () => {
      localStorage.setItem(config.storage.refreshToken, 'expired-refresh-token');

      const mockError = {
        response: {
          data: {
            success: false,
            message: 'Invalid refresh token'
          },
          status: 401
        }
      };

      mockAxios.post.mockRejectedValue(mockError);

      await expect(authService.refreshToken()).rejects.toThrow('Invalid refresh token');

      // Should clear tokens on refresh failure
      expect(localStorage.getItem(config.storage.authToken)).toBeNull();
      expect(localStorage.getItem(config.storage.refreshToken)).toBeNull();
    });

    it('should handle missing refresh token', async () => {
      await expect(authService.refreshToken()).rejects.toThrow('No refresh token available');
    });
  });

  describe('getCurrentUser', () => {
    it('should return current user from localStorage', () => {
      const mockUser = {
        id: 'user-123',
        username: 'testuser',
        email: 'test@example.com'
      };

      localStorage.setItem(config.storage.user, JSON.stringify(mockUser));

      const user = authService.getCurrentUser();

      expect(user).toEqual(mockUser);
    });

    it('should return null if no user in localStorage', () => {
      const user = authService.getCurrentUser();

      expect(user).toBeNull();
    });

    it('should handle invalid JSON in localStorage', () => {
      localStorage.setItem(config.storage.user, 'invalid-json');

      const user = authService.getCurrentUser();

      expect(user).toBeNull();
    });
  });

  describe('getAuthToken', () => {
    it('should return auth token from localStorage', () => {
      localStorage.setItem(config.storage.authToken, 'mock-token');

      const token = authService.getAuthToken();

      expect(token).toBe('mock-token');
    });

    it('should return null if no token', () => {
      const token = authService.getAuthToken();

      expect(token).toBeNull();
    });
  });

  describe('isAuthenticated', () => {
    it('should return true when token and user exist', () => {
      localStorage.setItem(config.storage.authToken, 'mock-token');
      localStorage.setItem(config.storage.user, JSON.stringify({ id: 'user-123' }));

      const isAuth = authService.isAuthenticated();

      expect(isAuth).toBe(true);
    });

    it('should return false when token is missing', () => {
      localStorage.setItem(config.storage.user, JSON.stringify({ id: 'user-123' }));

      const isAuth = authService.isAuthenticated();

      expect(isAuth).toBe(false);
    });

    it('should return false when user is missing', () => {
      localStorage.setItem(config.storage.authToken, 'mock-token');

      const isAuth = authService.isAuthenticated();

      expect(isAuth).toBe(false);
    });

    it('should return false when both are missing', () => {
      const isAuth = authService.isAuthenticated();

      expect(isAuth).toBe(false);
    });
  });

  describe('verifyEmail', () => {
    it('should verify email successfully', async () => {
      const token = 'verification-token';

      mockAxios.post.mockResolvedValue({
        data: {
          success: true,
          message: 'Email verified successfully'
        }
      });

      const result = await authService.verifyEmail(token);

      expect(mockAxios.post).toHaveBeenCalledWith(
        config.endpoints.auth.verify,
        { token }
      );

      expect(result).toBe(true);
    });

    it('should handle verification failure', async () => {
      const token = 'invalid-token';

      mockAxios.post.mockRejectedValue({
        response: {
          data: {
            success: false,
            message: 'Invalid or expired token'
          }
        }
      });

      await expect(authService.verifyEmail(token)).rejects.toThrow('Invalid or expired token');
    });
  });

  describe('axios interceptors', () => {
    it('should add auth token to requests', async () => {
      localStorage.setItem(config.storage.authToken, 'mock-token');

      const mockRequest = { headers: {} };
      const requestInterceptor = mockAxios.interceptors.request.use.mock.calls[0][0];
      const modifiedRequest = requestInterceptor(mockRequest);

      expect(modifiedRequest.headers.Authorization).toBe('Bearer mock-token');
    });

    it('should handle 401 responses by refreshing token', async () => {
      const responseInterceptor = mockAxios.interceptors.response.use.mock.calls[0][1];
      
      const mockError = {
        response: { status: 401 },
        config: { url: '/api/some-endpoint' }
      };

      localStorage.setItem(config.storage.refreshToken, 'refresh-token');

      mockAxios.post.mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            token: 'new-token',
            refreshToken: 'new-refresh-token'
          }
        }
      });

      mockAxios.request.mockResolvedValueOnce({ data: 'retry-success' });

      const result = await responseInterceptor(mockError);

      expect(mockAxios.post).toHaveBeenCalledWith(
        config.endpoints.auth.refresh,
        { refreshToken: 'refresh-token' }
      );

      expect(result).toEqual({ data: 'retry-success' });
    });
  });
});