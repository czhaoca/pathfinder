import { renderHook, act, waitFor } from '@testing-library/react';
import { useAuth } from '@/hooks/useAuth';
import { authService } from '@/services/authService';
import { authStore } from '@/stores/authStore';

// Mock dependencies
jest.mock('@/services/authService');
jest.mock('@/stores/authStore');

describe('useAuth', () => {
  const mockLogin = jest.fn();
  const mockRegister = jest.fn();
  const mockLogout = jest.fn();
  const mockSetAuth = jest.fn();
  const mockClearAuth = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock authStore
    (authStore as unknown as jest.Mock).mockReturnValue({
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
      (authService.login as jest.Mock) = mockLogin;

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.login(credentials);
      });

      expect(mockLogin).toHaveBeenCalledWith(credentials);
      expect(mockSetAuth).toHaveBeenCalledWith(
        mockResponse.token,
        mockResponse.refreshToken,
        mockResponse.user
      );
      expect(result.current.error).toBeNull();
    });

    it('should handle login error', async () => {
      const credentials = { username: 'testuser', password: 'wrongpassword' };
      const error = new Error('Invalid credentials');

      mockLogin.mockRejectedValue(error);
      (authService.login as jest.Mock) = mockLogin;

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.login(credentials);
      });

      expect(mockLogin).toHaveBeenCalledWith(credentials);
      expect(mockSetAuth).not.toHaveBeenCalled();
      expect(result.current.error).toBe('Invalid credentials');
    });
  });

  describe('register', () => {
    it('should register successfully', async () => {
      const registerData = {
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
      (authService.register as jest.Mock) = mockRegister;

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.register(registerData);
      });

      expect(mockRegister).toHaveBeenCalledWith(registerData);
      expect(mockSetAuth).toHaveBeenCalledWith(
        mockResponse.token,
        mockResponse.refreshToken,
        mockResponse.user
      );
      expect(result.current.error).toBeNull();
    });

    it('should handle registration error', async () => {
      const registerData = {
        username: 'existinguser',
        email: 'existing@example.com',
        password: 'password123',
        firstName: 'Existing',
        lastName: 'User'
      };
      const error = new Error('Username already exists');

      mockRegister.mockRejectedValue(error);
      (authService.register as jest.Mock) = mockRegister;

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.register(registerData);
      });

      expect(mockRegister).toHaveBeenCalledWith(registerData);
      expect(mockSetAuth).not.toHaveBeenCalled();
      expect(result.current.error).toBe('Username already exists');
    });
  });

  describe('logout', () => {
    it('should logout successfully', async () => {
      mockLogout.mockResolvedValue(undefined);
      (authService.logout as jest.Mock) = mockLogout;

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
      (authService.logout as jest.Mock) = mockLogout;

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.logout();
      });

      expect(mockLogout).toHaveBeenCalled();
      expect(mockClearAuth).toHaveBeenCalled();
    });
  });

  describe('loading state', () => {
    it('should set loading state during operations', async () => {
      const credentials = { username: 'testuser', password: 'password123' };
      let resolveLogin: (value: any) => void;
      const loginPromise = new Promise((resolve) => {
        resolveLogin = resolve;
      });

      mockLogin.mockReturnValue(loginPromise);
      (authService.login as jest.Mock) = mockLogin;

      const { result } = renderHook(() => useAuth());

      expect(result.current.isLoading).toBe(false);

      act(() => {
        result.current.login(credentials);
      });

      expect(result.current.isLoading).toBe(true);

      await act(async () => {
        resolveLogin!({
          token: 'token',
          refreshToken: 'refresh',
          user: { id: '1', username: 'test' }
        });
        await waitFor(() => expect(result.current.isLoading).toBe(false));
      });
    });
  });
});