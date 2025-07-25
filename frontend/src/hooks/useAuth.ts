import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { authStore } from '@/stores/authStore';
import { authService } from '@/services/authService';
import { LoginCredentials, RegisterData } from '@/types';

export function useAuth() {
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoading, error, clearError } = authStore();

  const login = useCallback(async (credentials: LoginCredentials) => {
    try {
      await authStore.getState().login(credentials);
      toast.success('Welcome back!');
      navigate('/dashboard');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Login failed');
    }
  }, [navigate]);

  const register = useCallback(async (data: RegisterData) => {
    try {
      await authStore.getState().register(data);
      toast.success('Account created successfully!');
      navigate('/dashboard');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Registration failed');
    }
  }, [navigate]);

  const logout = useCallback(async () => {
    try {
      await authService.logout();
      authStore.getState().logout();
      toast.success('Logged out successfully');
      navigate('/login');
    } catch (error) {
      // Even if the API call fails, still log out locally
      authStore.getState().logout();
      navigate('/login');
    }
  }, [navigate]);

  return {
    user,
    isAuthenticated,
    isLoading,
    error,
    login,
    register,
    logout,
    clearError
  };
}