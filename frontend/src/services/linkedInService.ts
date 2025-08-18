/**
 * LinkedIn Service
 * Handles LinkedIn OAuth and profile import API calls
 */

import { apiClient } from './apiClient';
import { AuthResponse, ApiResponse } from '../types/api';

interface LinkedInAuthUrlResponse {
  authUrl: string;
}

interface LinkedInImportOptions {
  workExperience?: boolean;
  education?: boolean;
  skills?: boolean;
  certifications?: boolean;
  summary?: boolean;
  profilePhoto?: boolean;
  location?: boolean;
  industry?: boolean;
}

interface LinkedInImportResult {
  imported: {
    workExperience?: { imported: number; skipped: number };
    education?: { imported: number; skipped: number };
    skills?: { imported: number; skipped: number };
    certifications?: { imported: number; skipped: number };
  };
  profile?: any;
}

interface LinkedInSyncStatus {
  lastSyncAt: Date | null;
  syncEnabled: boolean;
  syncInterval: number;
  nextSyncAt: Date | null;
  syncHistory?: Array<{
    syncedAt: Date;
    status: 'success' | 'failed';
    changes?: Record<string, number>;
    error?: string;
  }>;
}

interface LinkedInSyncResult {
  synced: boolean;
  message?: string;
  profile?: any;
  lastSyncAt?: Date;
  changes?: {
    workExperience?: { added: number; updated: number; removed: number };
    education?: { added: number; updated: number; removed: number };
    skills?: { added: number; updated: number; removed: number };
    certifications?: { added: number; updated: number; removed: number };
  };
}

class LinkedInService {
  private baseUrl = '/api/auth';

  /**
   * Generate LinkedIn OAuth URL
   */
  async generateAuthUrl(returnUrl?: string): Promise<LinkedInAuthUrlResponse> {
    const params = returnUrl ? `?returnUrl=${encodeURIComponent(returnUrl)}` : '';
    const response = await apiClient.get<ApiResponse<LinkedInAuthUrlResponse>>(
      `${this.baseUrl}/linkedin${params}`
    );
    return response.data.data;
  }

  /**
   * Merge LinkedIn account with existing account
   */
  async mergeAccounts(password: string, linkedInAuthCode: string): Promise<{ success: boolean; user?: any }> {
    const response = await apiClient.post<ApiResponse<{ success: boolean; message: string }>>(
      `${this.baseUrl}/linkedin/merge`,
      {
        password,
        linkedInAuthCode
      }
    );
    return response.data.data;
  }

  /**
   * Unlink LinkedIn account
   */
  async unlinkAccount(): Promise<{ success: boolean }> {
    const response = await apiClient.delete<ApiResponse<{ success: boolean }>>(
      `${this.baseUrl}/linkedin/unlink`
    );
    return response.data.data;
  }

  /**
   * Preview LinkedIn profile import
   */
  async previewImport(): Promise<{ preview: any }> {
    const response = await apiClient.post<ApiResponse<{ preview: any }>>(
      `${this.baseUrl}/linkedin/import`,
      {
        preview: true
      }
    );
    return response.data.data;
  }

  /**
   * Import LinkedIn profile with options
   */
  async importProfile(importOptions?: LinkedInImportOptions): Promise<LinkedInImportResult> {
    const response = await apiClient.post<ApiResponse<LinkedInImportResult>>(
      `${this.baseUrl}/linkedin/import`,
      {
        importOptions,
        preview: false
      }
    );
    return response.data.data;
  }

  /**
   * Import selected profile items
   */
  async importProfileSelective(data: any): Promise<LinkedInImportResult> {
    const response = await apiClient.post<ApiResponse<LinkedInImportResult>>(
      `${this.baseUrl}/linkedin/import`,
      {
        importOptions: data,
        preview: false
      }
    );
    return response.data.data;
  }

  /**
   * Sync LinkedIn profile
   */
  async syncProfile(force: boolean = false): Promise<LinkedInSyncResult> {
    const response = await apiClient.post<ApiResponse<LinkedInSyncResult>>(
      `${this.baseUrl}/linkedin/sync`,
      {
        force
      }
    );
    return response.data.data;
  }

  /**
   * Get sync status
   */
  async getSyncStatus(): Promise<LinkedInSyncStatus> {
    const response = await apiClient.get<ApiResponse<LinkedInSyncStatus>>(
      `${this.baseUrl}/linkedin/sync/status`
    );
    return response.data.data;
  }

  /**
   * Update sync settings
   */
  async updateSyncSettings(settings: Partial<LinkedInSyncStatus>): Promise<{ success: boolean }> {
    const response = await apiClient.put<ApiResponse<{ success: boolean }>>(
      `${this.baseUrl}/linkedin/sync/settings`,
      settings
    );
    return response.data.data;
  }

  /**
   * Get linked providers
   */
  async getLinkedProviders(): Promise<{
    providers: Array<{
      provider: string;
      email: string;
      displayName: string;
      linkedAt: Date;
      isPrimary: boolean;
    }>;
    hasPassword: boolean;
  }> {
    const response = await apiClient.get<ApiResponse<any>>(
      `${this.baseUrl}/sso/providers`
    );
    return response.data.data;
  }

  /**
   * Handle OAuth callback
   */
  handleCallback(code: string, state: string): void {
    // This is typically handled by the backend redirect
    // But we can store the auth code temporarily if needed
    sessionStorage.setItem('linkedin_auth_code', code);
    sessionStorage.setItem('linkedin_auth_state', state);
  }

  /**
   * Check if LinkedIn is linked
   */
  async isLinkedInLinked(): Promise<boolean> {
    try {
      const { providers } = await this.getLinkedProviders();
      return providers.some(p => p.provider === 'linkedin');
    } catch {
      return false;
    }
  }

  /**
   * Get LinkedIn profile from SSO
   */
  async getLinkedInProfile(): Promise<any> {
    const response = await apiClient.get<ApiResponse<any>>(
      `${this.baseUrl}/linkedin/profile`
    );
    return response.data.data;
  }
}

export const linkedInService = new LinkedInService();