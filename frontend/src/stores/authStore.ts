import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User, LoginCredentials, RegisterData, AuthResponse } from '@/types';
import { authService } from '@/services/authService';
import { PasswordHasher } from '@/utils/crypto';
import api from '@/lib/api';

interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  expiresAt: string | null;
  permissions: string[];
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  mustChangePassword: boolean;
  sessionWarningShown: boolean;
  
  // Actions
  login: (credentials: LoginCredentials & { rememberMe?: boolean }) => Promise<void>;
  loginWithHash: (username: string, passwordHash: string, clientSalt: string, rememberMe?: boolean) => Promise<void>;
  verifyMFA: (sessionToken: string, mfaToken: string, method?: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  refreshAccessToken: () => Promise<void>;
  clearError: () => void;
  setSessionWarningShown: (shown: boolean) => void;
  checkSession: () => Promise<void>;
  hasRole: (role: string) => boolean;
  hasPermission: (permission: string) => boolean;
  canAccessRole: (targetRole: string) => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      refreshToken: null,
      expiresAt: null,
      permissions: [],
      isAuthenticated: false,
      isLoading: false,
      error: null,
      mustChangePassword: false,
      sessionWarningShown: false,

      login: async (credentials) => {
        set({ isLoading: true, error: null });
        
        try {
          // Hash password on client side
          const { hash, salt } = await PasswordHasher.hashPassword(credentials.password);
          
          // Clear password from memory
          credentials.password = '';
          
          const response = await api.post<any>('/api/v2/auth/login', {
            username: credentials.username,
            password_hash: hash,
            client_salt: salt,
            remember_me: credentials.rememberMe || false
          });
          
          const data = response.data || response;
          
          // Handle MFA requirement
          if (data.requires_mfa) {
            set({ isLoading: false });
            // Store session token temporarily for MFA
            sessionStorage.setItem('mfa_session_token', data.session_token);
            throw { 
              type: 'MFA_REQUIRED', 
              mfaMethods: data.mfa_methods,
              sessionToken: data.session_token 
            };
          }
          
          // Handle password change requirement
          if (data.must_change_password) {
            set({ 
              isLoading: false,
              mustChangePassword: true 
            });
            sessionStorage.setItem('change_token', data.change_token);
            throw { 
              type: 'PASSWORD_CHANGE_REQUIRED',
              changeToken: data.change_token,
              reason: data.reason
            };
          }
          
          // Successful authentication
          const authData = data.data;
          set({
            user: authData.user,
            token: authData.token,
            refreshToken: authData.refresh_token,
            expiresAt: authData.expires_at,
            permissions: authData.permissions || [],
            isAuthenticated: true,
            isLoading: false,
            error: null,
            mustChangePassword: false
          });
          
          // Set authorization header for future requests
          api.defaults.headers.common['Authorization'] = `Bearer ${authData.token}`;
          
          // Schedule token refresh
          authService.checkSessionExpiry(authData.token, authData.expires_at);
          
        } catch (error: any) {
          // Re-throw special error types
          if (error.type === 'MFA_REQUIRED' || error.type === 'PASSWORD_CHANGE_REQUIRED') {
            throw error;
          }
          
          set({
            error: error.response?.data?.message || error.message || 'Login failed',
            isLoading: false,
          });
          throw error;
        }
      },

      loginWithHash: async (username, passwordHash, clientSalt, rememberMe = false) => {
        set({ isLoading: true, error: null });
        
        try {
          const response = await api.post<any>('/api/v2/auth/login', {
            username,
            password_hash: passwordHash,
            client_salt: clientSalt,
            remember_me: rememberMe
          });
          
          const data = response.data?.data || response.data;
          
          set({
            user: data.user,
            token: data.token,
            refreshToken: data.refresh_token,
            expiresAt: data.expires_at,
            permissions: data.permissions || [],
            isAuthenticated: true,
            isLoading: false,
            error: null
          });
          
          api.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
          authService.checkSessionExpiry(data.token, data.expires_at);
          
        } catch (error: any) {
          set({
            error: error.response?.data?.message || 'Login failed',
            isLoading: false,
          });
          throw error;
        }
      },

      verifyMFA: async (sessionToken, mfaToken, method = 'totp') => {
        set({ isLoading: true, error: null });
        
        try {
          const response = await api.post<any>('/api/v2/auth/mfa/verify', {
            session_token: sessionToken,
            mfa_token: mfaToken,
            mfa_method: method
          });
          
          const data = response.data?.data || response.data;
          
          set({
            user: data.user,
            token: data.token,
            refreshToken: data.refresh_token,
            expiresAt: data.expires_at,
            permissions: data.permissions || [],
            isAuthenticated: true,
            isLoading: false,
            error: null
          });
          
          // Clear MFA session token
          sessionStorage.removeItem('mfa_session_token');
          
          api.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
          authService.checkSessionExpiry(data.token, data.expires_at);
          
        } catch (error: any) {
          set({
            error: error.response?.data?.message || 'MFA verification failed',
            isLoading: false,
          });
          throw error;
        }
      },

      register: async (data) => {
        set({ isLoading: true, error: null });
        
        try {
          const response = await authService.register(data);
          set({ isLoading: false });
          return response;
        } catch (error: any) {
          set({
            error: error.response?.data?.message || 'Registration failed',
            isLoading: false,
          });
          throw error;
        }
      },

      logout: async () => {
        const token = get().token;
        
        // Call logout endpoint if authenticated
        if (token) {
          try {
            await authService.logout();
          } catch (error) {
            console.error('Logout error:', error);
          }
        }
        
        // Clear all auth data
        set({
          user: null,
          token: null,
          refreshToken: null,
          expiresAt: null,
          permissions: [],
          isAuthenticated: false,
          error: null,
          mustChangePassword: false,
          sessionWarningShown: false
        });
        
        // Clear auth header
        delete api.defaults.headers.common['Authorization'];
        
        // Clear session storage
        sessionStorage.removeItem('mfa_session_token');
        sessionStorage.removeItem('change_token');
      },

      refreshAccessToken: async () => {
        const refreshToken = get().refreshToken;
        
        if (!refreshToken) {
          throw new Error('No refresh token available');
        }

        try {
          const response = await authService.refreshToken(refreshToken);
          
          set({
            token: response.token,
            expiresAt: response.expires_at,
            refreshToken: response.refresh_token || refreshToken
          });
          
          api.defaults.headers.common['Authorization'] = `Bearer ${response.token}`;
          authService.checkSessionExpiry(response.token, response.expires_at);
          
        } catch (error) {
          // If refresh fails, logout
          get().logout();
          throw error;
        }
      },

      checkSession: async () => {
        const state = get();
        if (!state.token || !state.expiresAt) return;
        
        const now = new Date().getTime();
        const expiry = new Date(state.expiresAt).getTime();
        const timeUntilExpiry = expiry - now;
        
        // If expired, try to refresh
        if (timeUntilExpiry <= 0) {
          try {
            await state.refreshAccessToken();
          } catch (error) {
            state.logout();
          }
        }
        // If expiring soon (< 2 minutes), show warning
        else if (timeUntilExpiry < 120000 && !state.sessionWarningShown) {
          set({ sessionWarningShown: true });
          
          // Show session warning
          const shouldExtend = window.confirm(
            'Your session is about to expire. Would you like to extend it?'
          );
          
          if (shouldExtend) {
            try {
              await state.refreshAccessToken();
              set({ sessionWarningShown: false });
            } catch (error) {
              state.logout();
            }
          } else {
            // User chose not to extend, logout when expired
            setTimeout(() => {
              state.logout();
            }, timeUntilExpiry);
          }
        }
      },

      clearError: () => set({ error: null }),
      
      setSessionWarningShown: (shown) => set({ sessionWarningShown: shown }),

      hasRole: (role) => {
        const user = get().user;
        return user?.roles?.includes(role) || false;
      },

      hasPermission: (permission) => {
        const permissions = get().permissions;
        return permissions.includes(permission);
      },

      canAccessRole: (targetRole) => {
        const hierarchy: Record<string, string[]> = {
          site_admin: ['site_admin', 'admin', 'user'],
          admin: ['admin', 'user'],
          user: ['user']
        };
        
        const user = get().user;
        const userRoles = user?.roles || [];
        
        return userRoles.some((role: string) => 
          hierarchy[role]?.includes(targetRole)
        );
      }
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        refreshToken: state.refreshToken,
        expiresAt: state.expiresAt,
        permissions: state.permissions,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        // Restore auth header on rehydration
        if (state?.token) {
          api.defaults.headers.common['Authorization'] = `Bearer ${state.token}`;
          
          // Check session expiry
          if (state.expiresAt) {
            authService.checkSessionExpiry(state.token, state.expiresAt);
          }
        }
      }
    }
  )
);

// Setup session checking interval
if (typeof window !== 'undefined') {
  setInterval(() => {
    useAuthStore.getState().checkSession();
  }, 60000); // Check every minute
}

// Setup session warning callback
authService.onSessionWarning(() => {
  useAuthStore.getState().setSessionWarningShown(true);
  
  const shouldExtend = window.confirm(
    'Your session is about to expire. Would you like to extend it?'
  );
  
  if (shouldExtend) {
    useAuthStore.getState().refreshAccessToken().catch(() => {
      useAuthStore.getState().logout();
    });
  }
});

export const authStore = useAuthStore;