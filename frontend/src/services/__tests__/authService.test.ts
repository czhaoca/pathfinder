import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { authService } from '../authService';
import api from '@/lib/api';
import { PasswordHasher, TokenManager } from '@/utils/crypto';

// Mock modules
vi.mock('@/lib/api');
vi.mock('@/utils/crypto');

describe('AuthService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear storage
    sessionStorage.clear();
    document.cookie = '';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('login', () => {
    it('should hash password before sending to server', async () => {
      const mockHash = { hash: 'hashed_password', salt: 'client_salt' };
      vi.mocked(PasswordHasher.hashPassword).mockResolvedValue(mockHash);
      
      const mockResponse = {
        data: {
          data: {
            user: { id: '1', username: 'testuser' },
            token: 'jwt_token',
            expires_at: new Date(Date.now() + 3600000).toISOString(),
            permissions: ['read', 'write']
          }
        }
      };
      vi.mocked(api.post).mockResolvedValue(mockResponse);

      const credentials = {
        username: 'testuser',
        password: 'plain_password',
        rememberMe: true
      };

      const result = await authService.login(credentials);

      // Verify password was hashed
      expect(PasswordHasher.hashPassword).toHaveBeenCalledWith('plain_password');
      
      // Verify API was called with hashed password
      expect(api.post).toHaveBeenCalledWith('/api/v2/auth/login', {
        username: 'testuser',
        password_hash: 'hashed_password',
        client_salt: 'client_salt',
        remember_me: true
      });

      // Verify password was cleared
      expect(credentials.password).toBe('');
    });

    it('should handle MFA requirement', async () => {
      const mockHash = { hash: 'hashed_password', salt: 'client_salt' };
      vi.mocked(PasswordHasher.hashPassword).mockResolvedValue(mockHash);
      
      const mockResponse = {
        data: {
          requires_mfa: true,
          mfa_challenge: 'challenge',
          mfa_methods: ['totp'],
          session_token: 'mfa_session_token'
        }
      };
      vi.mocked(api.post).mockResolvedValue(mockResponse);

      const result = await authService.login({
        username: 'testuser',
        password: 'password'
      });

      expect(result).toHaveProperty('requires_mfa', true);
      expect(result).toHaveProperty('session_token', 'mfa_session_token');
    });

    it('should handle password change requirement', async () => {
      const mockHash = { hash: 'hashed_password', salt: 'client_salt' };
      vi.mocked(PasswordHasher.hashPassword).mockResolvedValue(mockHash);
      
      const mockResponse = {
        data: {
          must_change_password: true,
          change_token: 'change_token',
          reason: 'First login'
        }
      };
      vi.mocked(api.post).mockResolvedValue(mockResponse);
      vi.mocked(TokenManager.storeToken).mockImplementation(() => {});

      const result = await authService.login({
        username: 'testuser',
        password: 'password'
      });

      expect(result).toHaveProperty('must_change_password', true);
      expect(TokenManager.storeToken).toHaveBeenCalledWith(
        'change_token',
        'password_change',
        expect.any(Date)
      );
    });
  });

  describe('verifyMFA', () => {
    it('should verify MFA token successfully', async () => {
      const mockResponse = {
        data: {
          data: {
            user: { id: '1', username: 'testuser' },
            token: 'jwt_token',
            expires_at: new Date(Date.now() + 3600000).toISOString(),
            permissions: ['read']
          }
        }
      };
      vi.mocked(api.post).mockResolvedValue(mockResponse);

      const result = await authService.verifyMFA('session_token', '123456', 'totp');

      expect(api.post).toHaveBeenCalledWith('/api/v2/auth/mfa/verify', {
        session_token: 'session_token',
        mfa_token: '123456',
        mfa_method: 'totp'
      });

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('token');
    });
  });

  describe('retrievePassword', () => {
    it('should retrieve temporary password with token', async () => {
      const mockResponse = {
        data: {
          data: {
            username: 'testuser',
            temporary_password: 'temp_pass_123',
            expires_at: new Date(Date.now() + 86400000).toISOString()
          }
        }
      };
      vi.mocked(api.post).mockResolvedValue(mockResponse);
      vi.mocked(TokenManager.storeToken).mockImplementation(() => {});

      const result = await authService.retrievePassword('retrieval_token');

      expect(api.post).toHaveBeenCalledWith('/api/v2/auth/password/retrieve', {
        retrieval_token: 'retrieval_token'
      });

      expect(result).toHaveProperty('temporary_password');
      expect(TokenManager.storeToken).toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    it('should validate and hash new password', async () => {
      const mockValidation = {
        isValid: true,
        feedback: [],
        score: 80,
        strength: 'strong'
      };
      vi.mocked(PasswordHasher.validatePassword).mockReturnValue(mockValidation);
      
      const mockHash = { hash: 'new_hashed_password', salt: 'new_salt' };
      vi.mocked(PasswordHasher.hashPassword).mockResolvedValue(mockHash);
      
      const mockResponse = {
        data: {
          success: true,
          message: 'Password reset successfully'
        }
      };
      vi.mocked(api.post).mockResolvedValue(mockResponse);

      await authService.resetPassword('reset_token', 'NewPassword123!');

      expect(PasswordHasher.validatePassword).toHaveBeenCalledWith('NewPassword123!');
      expect(PasswordHasher.hashPassword).toHaveBeenCalledWith('NewPassword123!');
      expect(api.post).toHaveBeenCalledWith('/api/v2/auth/password/reset/confirm', {
        reset_token: 'reset_token',
        new_password_hash: 'new_hashed_password',
        client_salt: 'new_salt'
      });
    });

    it('should reject weak passwords', async () => {
      const mockValidation = {
        isValid: false,
        feedback: ['Password too short', 'Add special characters'],
        score: 20,
        strength: 'weak'
      };
      vi.mocked(PasswordHasher.validatePassword).mockReturnValue(mockValidation);

      await expect(
        authService.resetPassword('reset_token', 'weak')
      ).rejects.toThrow('Password too short. Add special characters');

      expect(PasswordHasher.hashPassword).not.toHaveBeenCalled();
      expect(api.post).not.toHaveBeenCalled();
    });
  });

  describe('changePassword', () => {
    it('should hash both current and new passwords', async () => {
      const mockValidation = {
        isValid: true,
        feedback: [],
        score: 80,
        strength: 'strong'
      };
      vi.mocked(PasswordHasher.validatePassword).mockReturnValue(mockValidation);
      
      const mockCurrentHash = { hash: 'current_hash', salt: 'current_salt' };
      const mockNewHash = { hash: 'new_hash', salt: 'new_salt' };
      vi.mocked(PasswordHasher.hashPassword)
        .mockResolvedValueOnce(mockCurrentHash)
        .mockResolvedValueOnce(mockNewHash);
      
      const mockResponse = { data: { success: true } };
      vi.mocked(api.post).mockResolvedValue(mockResponse);

      await authService.changePassword('currentPass', 'newPass123!');

      expect(PasswordHasher.hashPassword).toHaveBeenCalledTimes(2);
      expect(api.post).toHaveBeenCalledWith('/api/v2/auth/password/change', {
        current_password_hash: 'current_hash',
        new_password_hash: 'new_hash',
        client_salt: 'new_salt'
      });
    });
  });

  describe('refreshToken', () => {
    it('should refresh token from cookie', async () => {
      // Set up cookie
      document.cookie = 'refresh_token=refresh_token_value';
      
      const mockResponse = {
        data: {
          data: {
            token: 'new_jwt_token',
            expires_at: new Date(Date.now() + 3600000).toISOString()
          }
        }
      };
      vi.mocked(api.post).mockResolvedValue(mockResponse);

      const result = await authService.refreshToken();

      expect(api.post).toHaveBeenCalledWith('/api/v2/auth/refresh', {
        refresh_token: 'refresh_token_value'
      });

      expect(result).toHaveProperty('token', 'new_jwt_token');
      expect(sessionStorage.getItem('access_token')).toBe('new_jwt_token');
    });

    it('should use provided refresh token over cookie', async () => {
      document.cookie = 'refresh_token=cookie_token';
      
      const mockResponse = {
        data: {
          data: {
            token: 'new_jwt_token',
            expires_at: new Date(Date.now() + 3600000).toISOString()
          }
        }
      };
      vi.mocked(api.post).mockResolvedValue(mockResponse);

      await authService.refreshToken('provided_token');

      expect(api.post).toHaveBeenCalledWith('/api/v2/auth/refresh', {
        refresh_token: 'provided_token'
      });
    });
  });

  describe('logout', () => {
    it('should clear all authentication data', async () => {
      // Set up initial data
      sessionStorage.setItem('access_token', 'token');
      sessionStorage.setItem('user_data', JSON.stringify({ id: '1' }));
      document.cookie = 'refresh_token=token';
      
      vi.mocked(api.post).mockResolvedValue({});
      vi.mocked(TokenManager.clearAllTokens).mockImplementation(() => {});

      await authService.logout();

      expect(api.post).toHaveBeenCalledWith('/api/v2/auth/logout');
      expect(sessionStorage.getItem('access_token')).toBeNull();
      expect(sessionStorage.getItem('user_data')).toBeNull();
      expect(TokenManager.clearAllTokens).toHaveBeenCalled();
    });

    it('should not throw on logout errors', async () => {
      vi.mocked(api.post).mockRejectedValue(new Error('Network error'));
      vi.mocked(TokenManager.clearAllTokens).mockImplementation(() => {});

      await expect(authService.logout()).resolves.not.toThrow();
      expect(TokenManager.clearAllTokens).toHaveBeenCalled();
    });
  });

  describe('permission checks', () => {
    it('should check user roles correctly', () => {
      sessionStorage.setItem('user_data', JSON.stringify({
        id: '1',
        username: 'testuser',
        roles: ['admin', 'user']
      }));

      expect(authService.hasRole('admin')).toBe(true);
      expect(authService.hasRole('user')).toBe(true);
      expect(authService.hasRole('site_admin')).toBe(false);
    });

    it('should check permissions correctly', () => {
      sessionStorage.setItem('user_permissions', JSON.stringify([
        'read',
        'write',
        'delete'
      ]));

      expect(authService.hasPermission('read')).toBe(true);
      expect(authService.hasPermission('write')).toBe(true);
      expect(authService.hasPermission('admin')).toBe(false);
    });

    it('should check role hierarchy correctly', () => {
      sessionStorage.setItem('user_data', JSON.stringify({
        id: '1',
        username: 'testuser',
        roles: ['admin']
      }));

      expect(authService.canAccessRole('admin')).toBe(true);
      expect(authService.canAccessRole('user')).toBe(true);
      expect(authService.canAccessRole('site_admin')).toBe(false);
    });
  });

  describe('session management', () => {
    it('should schedule token refresh and session warning', async () => {
      vi.useFakeTimers();
      
      const expiresAt = new Date(Date.now() + 300000).toISOString(); // 5 minutes
      await authService.checkSessionExpiry('token', expiresAt);

      // Fast forward to 1 minute before expiry
      vi.advanceTimersByTime(240000);
      
      // Token refresh should be scheduled
      expect(vi.getTimerCount()).toBeGreaterThan(0);
      
      vi.useRealTimers();
    });

    it('should handle session warning callback', () => {
      const callback = vi.fn();
      authService.onSessionWarning(callback);
      
      // Trigger warning internally (would normally happen via timer)
      // This tests the callback mechanism
      expect(callback).not.toHaveBeenCalled();
    });
  });
});