import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAuth } from '@/hooks/useAuth';
import { authService } from '@/services/authService';
import { authStore } from '@/stores/authStore';

// Mock dependencies
vi.mock('@/services/authService');
vi.mock('@/stores/authStore');

describe('useAuth', () => {
  const mockLogin = vi.fn();
  const mockRegister = vi.fn();
  const mockLogout = vi.fn();
  const mockSetAuth = vi.fn();
  const mockClearAuth = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock authStore
    vi.mocked(authStore).mockReturnValue({
      isAuthenticated: false,
      user: null,
      token: null,
      setAuth: mockSetAuth,
      clearAuth: mockClearAuth
    });
  });

  describe('login', () => {
    it('should login successfully', async () => {
      const credentials = { username: 'testuser', password: 'password123' };
      const mockResponse = {
        token: 'mock-token',
        refreshToken: 'mock-refresh-token',
        user: {
          id: 'user-123',
          username: 'testuser',
          email: 'test@example.com'
        }
      };

      mockLogin.mockResolvedValue(mockResponse);
      vi.mocked(authService.login).mockImplementation(mockLogin);

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.login(credentials);
      });

      expect(mockLogin).toHaveBeenCalledWith(credentials);
      expect(mockSetAuth).toHaveBeenCalledWith(
        mockResponse.user,
        mockResponse.token,
        mockResponse.refreshToken
      );
    });

    it('should handle login error', async () => {
      const credentials = { username: 'testuser', password: 'wrongpass' };
      const error = new Error('Invalid credentials');

      mockLogin.mockRejectedValue(error);
      vi.mocked(authService.login).mockImplementation(mockLogin);

      const { result } = renderHook(() => useAuth());

      await expect(
        act(async () => {
          await result.current.login(credentials);
        })
      ).rejects.toThrow('Invalid credentials');

      expect(mockSetAuth).not.toHaveBeenCalled();
    });
  });

  describe('register', () => {
    it('should register successfully', async () => {
      const userData = {
        username: 'newuser',
        email: 'new@example.com',
        password: 'password123',
        firstName: 'New',
        lastName: 'User'
      };
      const mockResponse = {
        token: 'mock-token',
        refreshToken: 'mock-refresh-token',
        user: {
          id: 'user-456',
          username: 'newuser',
          email: 'new@example.com'
        }
      };

      mockRegister.mockResolvedValue(mockResponse);
      vi.mocked(authService.register).mockImplementation(mockRegister);

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.register(userData);
      });

      expect(mockRegister).toHaveBeenCalledWith(userData);
      expect(mockSetAuth).toHaveBeenCalledWith(
        mockResponse.user,
        mockResponse.token,
        mockResponse.refreshToken
      );
    });

    it('should handle registration error', async () => {
      const userData = {
        username: 'existinguser',
        email: 'existing@example.com',
        password: 'password123',
        firstName: 'Existing',
        lastName: 'User'
      };
      const error = new Error('Username already exists');

      mockRegister.mockRejectedValue(error);
      vi.mocked(authService.register).mockImplementation(mockRegister);

      const { result } = renderHook(() => useAuth());

      await expect(
        act(async () => {
          await result.current.register(userData);
        })
      ).rejects.toThrow('Username already exists');

      expect(mockSetAuth).not.toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('should logout successfully', async () => {
      mockLogout.mockResolvedValue(undefined);
      vi.mocked(authService.logout).mockImplementation(mockLogout);

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.logout();
      });

      expect(mockLogout).toHaveBeenCalled();
      expect(mockClearAuth).toHaveBeenCalled();
    });

    it('should clear auth even if logout API fails', async () => {
      const error = new Error('Network error');
      mockLogout.mockRejectedValue(error);
      vi.mocked(authService.logout).mockImplementation(mockLogout);

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.logout();
      });

      expect(mockLogout).toHaveBeenCalled();
      expect(mockClearAuth).toHaveBeenCalled();
    });
  });

  describe('isAuthenticated', () => {
    it('should return authentication status', () => {
      vi.mocked(authStore).mockReturnValue({
        isAuthenticated: true,
        user: { id: 'user-123', username: 'testuser' },
        token: 'mock-token',
        setAuth: mockSetAuth,
        clearAuth: mockClearAuth
      });

      const { result } = renderHook(() => useAuth());

      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.user).toEqual({
        id: 'user-123',
        username: 'testuser'
      });
    });
  });
});