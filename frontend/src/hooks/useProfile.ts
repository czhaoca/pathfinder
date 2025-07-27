import { useState, useEffect } from 'react';
import { profileService, ProfileUpdateData, PasswordChangeData } from '@/services/profileService';
import { User } from '@/types';
import { authStore } from '@/stores/authStore';

export function useProfile() {
  const [profile, setProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { setUser } = authStore();

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await profileService.getProfile();
      setProfile(data);
      setUser(data); // Update auth store
    } catch (err: any) {
      setError(err.message || 'Failed to fetch profile');
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (data: ProfileUpdateData) => {
    try {
      setError(null);
      const updatedProfile = await profileService.updateProfile(data);
      setProfile(updatedProfile);
      setUser(updatedProfile); // Update auth store
      return { success: true };
    } catch (err: any) {
      setError(err.message || 'Failed to update profile');
      return { success: false, error: err.message };
    }
  };

  const changePassword = async (data: PasswordChangeData) => {
    try {
      setError(null);
      const result = await profileService.changePassword(data);
      return { success: true, message: result.message };
    } catch (err: any) {
      setError(err.message || 'Failed to change password');
      return { success: false, error: err.message };
    }
  };

  const deleteAccount = async () => {
    try {
      setError(null);
      const result = await profileService.deleteAccount();
      return { success: true, message: result.message };
    } catch (err: any) {
      setError(err.message || 'Failed to delete account');
      return { success: false, error: err.message };
    }
  };

  return {
    profile,
    loading,
    error,
    updateProfile,
    changePassword,
    deleteAccount,
    refetch: fetchProfile
  };
}