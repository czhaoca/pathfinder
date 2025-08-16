import api from '@/lib/api';
import { LoginCredentials, RegisterData, AuthResponse, User } from '@/types';
import { handleApiError, validateEmail, validatePassword, validateRequired } from '@/utils/errorHandler';
import { PasswordHasher, TokenManager } from '@/utils/crypto';

interface MFAResponse {
  requires_mfa: boolean;
  mfa_challenge?: string;
  mfa_methods?: string[];
  session_token?: string;
}

interface PasswordChangeResponse {
  must_change_password: boolean;
  change_token?: string;
  reason?: string;
}

interface SessionInfo {
  session_id: string;
  user_id: string;
  created_at: string;
  last_activity: string;
  expires_at: string;
  ip_address: string;
  user_agent: string;
}

class AuthService {
  private refreshTimer: NodeJS.Timeout | null = null;
  private sessionWarningTimer: NodeJS.Timeout | null = null;
  private sessionWarningCallback: (() => void) | null = null;

  /**
   * Login with client-side password hashing
   */
  async login(credentials: LoginCredentials & { rememberMe?: boolean; mfaToken?: string }): Promise<AuthResponse | MFAResponse | PasswordChangeResponse> {
    try {
      // Validate inputs
      validateRequired(credentials.username, 'Username');
      validateRequired(credentials.password, 'Password');
      
      // Generate client salt and hash password
      const { hash, salt } = await PasswordHasher.hashPassword(credentials.password);
      
      // Clear password from memory
      credentials.password = '';
      
      const response = await api.post<any>('/api/v2/auth/login', {
        username: credentials.username,
        password_hash: hash,
        client_salt: salt,
        mfa_token: credentials.mfaToken,
        remember_me: credentials.rememberMe || false
      });
      
      const data = response.data || response;
      
      // Handle MFA requirement
      if (data.requires_mfa) {
        return data as MFAResponse;
      }
      
      // Handle password change requirement
      if (data.must_change_password) {
        TokenManager.storeToken(
          data.change_token,
          'password_change',
          new Date(Date.now() + 3600000) // 1 hour
        );
        return data as PasswordChangeResponse;
      }
      
      // Successful authentication
      this.handleAuthSuccess(data.data);
      return data.data as AuthResponse;
      
    } catch (error) {
      throw handleApiError(error);
    }
  }

  /**
   * Verify MFA token
   */
  async verifyMFA(sessionToken: string, mfaToken: string, mfaMethod: string = 'totp'): Promise<AuthResponse> {
    try {
      validateRequired(sessionToken, 'Session token');
      validateRequired(mfaToken, 'MFA token');
      
      const response = await api.post<any>('/api/v2/auth/mfa/verify', {
        session_token: sessionToken,
        mfa_token: mfaToken,
        mfa_method: mfaMethod
      });
      
      const data = response.data?.data || response.data;
      this.handleAuthSuccess(data);
      return data as AuthResponse;
      
    } catch (error) {
      throw handleApiError(error);
    }
  }

  /**
   * Register new user (admin only)
   */
  async register(data: RegisterData): Promise<any> {
    try {
      // Validate inputs
      validateRequired(data.username, 'Username');
      validateEmail(data.email);
      validateRequired(data.firstName, 'First name');
      validateRequired(data.lastName, 'Last name');
      
      // Admin registers users without password - system generates it
      const response = await api.post<any>('/api/v2/auth/register', {
        username: data.username,
        email: data.email,
        first_name: data.firstName,
        last_name: data.lastName,
        role: data.role || 'user',
        department: data.department,
        phone: data.phone
      });
      
      const result = response.data?.data || response.data;
      
      // Store the password retrieval token temporarily
      if (result.password_retrieval_token) {
        TokenManager.storeToken(
          result.password_retrieval_token,
          'password_retrieval',
          new Date(result.token_expires_at)
        );
      }
      
      return result;
    } catch (error) {
      throw handleApiError(error);
    }
  }

  /**
   * Retrieve password using one-time token
   */
  async retrievePassword(retrievalToken: string): Promise<any> {
    try {
      validateRequired(retrievalToken, 'Retrieval token');
      
      const response = await api.post<any>('/api/v2/auth/password/retrieve', {
        retrieval_token: retrievalToken
      });
      
      const data = response.data?.data || response.data;
      
      // Store temporary password info
      if (data.temporary_password) {
        TokenManager.storeToken(
          data.temporary_password,
          'temp_password',
          new Date(data.expires_at)
        );
      }
      
      return data;
    } catch (error) {
      throw handleApiError(error);
    }
  }

  /**
   * Request password reset
   */
  async requestPasswordReset(emailOrUsername: string): Promise<any> {
    try {
      validateRequired(emailOrUsername, 'Email or username');
      
      const isEmail = emailOrUsername.includes('@');
      const payload = isEmail
        ? { email: emailOrUsername }
        : { username: emailOrUsername };
      
      const response = await api.post<any>('/api/v2/auth/password/reset/request', payload);
      return response.data || response;
    } catch (error) {
      // Always return success to prevent enumeration
      return {
        success: true,
        message: 'If an account exists with this email/username, a reset link has been sent',
        expires_in_hours: 3
      };
    }
  }

  /**
   * Reset password with token
   */
  async resetPassword(resetToken: string, newPassword: string): Promise<any> {
    try {
      validateRequired(resetToken, 'Reset token');
      validateRequired(newPassword, 'New password');
      
      // Validate password strength
      const validation = PasswordHasher.validatePassword(newPassword);
      if (!validation.isValid) {
        throw new Error(validation.feedback.join('. '));
      }
      
      // Hash the new password
      const { hash, salt } = await PasswordHasher.hashPassword(newPassword);
      
      // Clear password from memory
      newPassword = '';
      
      const response = await api.post<any>('/api/v2/auth/password/reset/confirm', {
        reset_token: resetToken,
        new_password_hash: hash,
        client_salt: salt
      });
      
      return response.data || response;
    } catch (error) {
      throw handleApiError(error);
    }
  }

  /**
   * Change password for authenticated user
   */
  async changePassword(currentPassword: string, newPassword: string): Promise<any> {
    try {
      validateRequired(currentPassword, 'Current password');
      validateRequired(newPassword, 'New password');
      
      // Validate new password strength
      const validation = PasswordHasher.validatePassword(newPassword);
      if (!validation.isValid) {
        throw new Error(validation.feedback.join('. '));
      }
      
      // Hash both passwords
      const currentHash = await PasswordHasher.hashPassword(currentPassword);
      const newHash = await PasswordHasher.hashPassword(newPassword);
      
      // Clear passwords from memory
      currentPassword = '';
      newPassword = '';
      
      const response = await api.post<any>('/api/v2/auth/password/change', {
        current_password_hash: currentHash.hash,
        new_password_hash: newHash.hash,
        client_salt: newHash.salt
      });
      
      return response.data || response;
    } catch (error) {
      throw handleApiError(error);
    }
  }

  /**
   * Refresh JWT token
   */
  async refreshToken(refreshToken?: string): Promise<AuthResponse> {
    try {
      // Use provided token or get from cookie
      const token = refreshToken || this.getRefreshTokenFromCookie();
      
      if (!token) {
        throw new Error('No refresh token available');
      }
      
      const response = await api.post<any>('/api/v2/auth/refresh', {
        refresh_token: token
      });
      
      const data = response.data?.data || response.data;
      
      // Update stored token
      if (data.token) {
        this.updateStoredToken(data.token, data.expires_at);
      }
      
      return data as AuthResponse;
    } catch (error) {
      throw handleApiError(error);
    }
  }

  /**
   * Logout and invalidate session
   */
  async logout(): Promise<void> {
    try {
      await api.post('/api/v2/auth/logout');
    } catch (error) {
      // Don't throw on logout errors, just log them
      console.error('Logout error:', error);
    } finally {
      // Clear all authentication data
      this.clearAuthData();
      TokenManager.clearAllTokens();
    }
  }

  /**
   * Get current session info
   */
  async getSession(): Promise<SessionInfo> {
    try {
      const response = await api.get<any>('/api/v2/auth/session');
      return response.data?.data || response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  }

  /**
   * Invalidate all sessions for current user
   */
  async invalidateAllSessions(): Promise<any> {
    try {
      const response = await api.delete<any>('/api/v2/auth/sessions');
      return response.data || response;
    } catch (error) {
      throw handleApiError(error);
    }
  }

  /**
   * Check session expiry and warn user
   */
  async checkSessionExpiry(token: string, expiresAt: string): Promise<void> {
    const expiryTime = new Date(expiresAt).getTime();
    const now = Date.now();
    const timeUntilExpiry = expiryTime - now;
    
    // Schedule token refresh (1 minute before expiry)
    if (timeUntilExpiry > 60000) {
      this.scheduleTokenRefresh(timeUntilExpiry - 60000);
    }
    
    // Schedule session warning (2 minutes before expiry)
    if (timeUntilExpiry > 120000) {
      this.scheduleSessionWarning(timeUntilExpiry - 120000);
    }
  }

  /**
   * Set callback for session warning
   */
  onSessionWarning(callback: () => void): void {
    this.sessionWarningCallback = callback;
  }

  /**
   * Handle successful authentication
   */
  private handleAuthSuccess(data: any): void {
    const { token, expires_at, user, permissions } = data;
    
    // Store authentication data
    this.updateStoredToken(token, expires_at);
    this.storeUserData(user, permissions);
    
    // Set up session management
    this.checkSessionExpiry(token, expires_at);
  }

  /**
   * Schedule automatic token refresh
   */
  private scheduleTokenRefresh(delay: number): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }
    
    this.refreshTimer = setTimeout(async () => {
      try {
        await this.refreshToken();
      } catch (error) {
        console.error('Token refresh failed:', error);
        // Trigger logout on refresh failure
        this.logout();
      }
    }, delay);
  }

  /**
   * Schedule session warning
   */
  private scheduleSessionWarning(delay: number): void {
    if (this.sessionWarningTimer) {
      clearTimeout(this.sessionWarningTimer);
    }
    
    this.sessionWarningTimer = setTimeout(() => {
      if (this.sessionWarningCallback) {
        this.sessionWarningCallback();
      }
    }, delay);
  }

  /**
   * Update stored token
   */
  private updateStoredToken(token: string, expiresAt: string): void {
    sessionStorage.setItem('access_token', token);
    sessionStorage.setItem('token_expires_at', expiresAt);
  }

  /**
   * Store user data
   */
  private storeUserData(user: User, permissions: string[]): void {
    sessionStorage.setItem('user_data', JSON.stringify(user));
    sessionStorage.setItem('user_permissions', JSON.stringify(permissions));
  }

  /**
   * Get refresh token from cookie
   */
  private getRefreshTokenFromCookie(): string | null {
    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === 'refresh_token') {
        return value;
      }
    }
    return null;
  }

  /**
   * Clear all authentication data
   */
  private clearAuthData(): void {
    // Clear timers
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
    if (this.sessionWarningTimer) {
      clearTimeout(this.sessionWarningTimer);
      this.sessionWarningTimer = null;
    }
    
    // Clear storage
    sessionStorage.removeItem('access_token');
    sessionStorage.removeItem('token_expires_at');
    sessionStorage.removeItem('user_data');
    sessionStorage.removeItem('user_permissions');
    
    // Clear cookies
    document.cookie = 'refresh_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
  }

  /**
   * Check if user has a specific role
   */
  hasRole(role: string): boolean {
    const userData = sessionStorage.getItem('user_data');
    if (!userData) return false;
    
    const user = JSON.parse(userData);
    return user.roles?.includes(role) || false;
  }

  /**
   * Check if user has a specific permission
   */
  hasPermission(permission: string): boolean {
    const permissions = sessionStorage.getItem('user_permissions');
    if (!permissions) return false;
    
    const permList = JSON.parse(permissions);
    return permList.includes(permission);
  }

  /**
   * Check if user can access a role level
   */
  canAccessRole(targetRole: string): boolean {
    const hierarchy: Record<string, string[]> = {
      site_admin: ['site_admin', 'admin', 'user'],
      admin: ['admin', 'user'],
      user: ['user']
    };
    
    const userData = sessionStorage.getItem('user_data');
    if (!userData) return false;
    
    const user = JSON.parse(userData);
    const userRoles = user.roles || [];
    
    return userRoles.some((role: string) => 
      hierarchy[role]?.includes(targetRole)
    );
  }
}

export const authService = new AuthService();