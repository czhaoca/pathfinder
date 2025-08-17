import BaseService from './BaseService';
import { ApiResponse } from '../types/api';

export interface Invitation {
  invitationId: string;
  email: string;
  invitedBy: string;
  inviterName: string;
  role: string;
  featureGroupId?: string;
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
  expiresAt: string;
  acceptedAt?: string;
  declinedAt?: string;
  reminderSentAt?: string;
  createdAt: string;
  metadata?: {
    customMessage?: string;
    inviterName?: string;
  };
}

export interface SendInvitationsRequest {
  emails: string[];
  role?: string;
  featureGroupId?: string;
  customMessage?: string;
  expirationDays?: number;
}

export interface SendInvitationsResponse {
  sent: Array<{
    email: string;
    invitationId: string;
    status: string;
  }>;
  failed: Array<{
    email: string;
    reason: string;
  }>;
}

export interface ListInvitationsRequest {
  status?: 'pending' | 'accepted' | 'expired' | 'revoked';
  page?: number;
  limit?: number;
  search?: string;
}

export interface ListInvitationsResponse {
  invitations: Invitation[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface BulkInvitationsRequest {
  csvData: string;
}

export interface BulkInvitationsResponse {
  queued: number;
  errors: Array<{
    row: number;
    error: string;
  }>;
}

export interface InvitationStats {
  total: number;
  accepted: number;
  declined: number;
  pending: number;
  expired: number;
}

export interface ValidateTokenResponse {
  valid: boolean;
  reason?: string;
  email?: string;
  expiresAt?: string;
  inviterName?: string;
  role?: string;
  featureGroupId?: string;
}

export interface AcceptInvitationRequest {
  token: string;
  password: string;
  firstName: string;
  lastName: string;
  username: string;
  acceptTerms: boolean;
}

export interface AcceptInvitationResponse {
  user: {
    id: string;
    username: string;
    email: string;
    firstName: string;
    lastName: string;
    createdAt: string;
    accountStatus: string;
  };
  tokens: {
    token: string;
    refreshToken: string;
  };
}

class InvitationService extends BaseService {
  private csrfToken: string | null = null;
  private csrfTokenExpiry: number = 0;

  constructor() {
    super();
  }

  /**
   * Get CSRF token for protected operations
   */
  private async getCSRFToken(): Promise<string> {
    // Check if we have a valid cached token
    if (this.csrfToken && Date.now() < this.csrfTokenExpiry) {
      return this.csrfToken;
    }

    // Fetch new CSRF token
    const response = await this.get<{ csrfToken: string }>('/admin/invitations/csrf-token');
    if (response.success && response.data) {
      this.csrfToken = response.data.csrfToken;
      this.csrfTokenExpiry = Date.now() + 50 * 60 * 1000; // 50 minutes (token valid for 60)
      return this.csrfToken;
    }

    throw new Error('Failed to get CSRF token');
  }

  /**
   * Send invitations to multiple email addresses (Admin)
   */
  async sendInvitations(data: SendInvitationsRequest): Promise<ApiResponse<SendInvitationsResponse>> {
    const csrfToken = await this.getCSRFToken();
    return this.post<SendInvitationsResponse>('/admin/invitations/send', data, {
      headers: { 'X-CSRF-Token': csrfToken }
    });
  }

  /**
   * List invitations with filtering and pagination (Admin)
   */
  async listInvitations(params?: ListInvitationsRequest): Promise<ApiResponse<ListInvitationsResponse>> {
    const queryParams = new URLSearchParams();
    if (params?.status) queryParams.append('status', params.status);
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.search) queryParams.append('search', params.search);

    return this.get<ListInvitationsResponse>(`/admin/invitations?${queryParams.toString()}`);
  }

  /**
   * Resend an invitation (Admin)
   */
  async resendInvitation(invitationId: string): Promise<ApiResponse<{ success: boolean; message: string }>> {
    const csrfToken = await this.getCSRFToken();
    return this.post<{ success: boolean; message: string }>(`/admin/invitations/${invitationId}/resend`, {}, {
      headers: { 'X-CSRF-Token': csrfToken }
    });
  }

  /**
   * Revoke an invitation (Admin)
   */
  async revokeInvitation(invitationId: string): Promise<ApiResponse<{ success: boolean; message: string }>> {
    const csrfToken = await this.getCSRFToken();
    return this.delete<{ success: boolean; message: string }>(`/admin/invitations/${invitationId}`, {
      headers: { 'X-CSRF-Token': csrfToken }
    });
  }

  /**
   * Process bulk CSV invitations (Admin)
   */
  async bulkInvitations(csvData: string): Promise<ApiResponse<BulkInvitationsResponse>> {
    const csrfToken = await this.getCSRFToken();
    return this.post<BulkInvitationsResponse>('/admin/invitations/bulk', { csvData }, {
      headers: { 'X-CSRF-Token': csrfToken }
    });
  }

  /**
   * Get invitation statistics (Admin)
   */
  async getInvitationStats(): Promise<ApiResponse<InvitationStats>> {
    return this.get<InvitationStats>('/admin/invitations/stats');
  }

  /**
   * Validate an invitation token (Public)
   */
  async validateToken(token: string): Promise<ApiResponse<ValidateTokenResponse>> {
    return this.get<ValidateTokenResponse>(`/invitations/validate/${token}`, { 
      skipAuth: true 
    });
  }

  /**
   * Accept an invitation and create account (Public)
   */
  async acceptInvitation(data: AcceptInvitationRequest): Promise<ApiResponse<AcceptInvitationResponse>> {
    return this.post<AcceptInvitationResponse>('/invitations/accept', data, { 
      skipAuth: true 
    });
  }

  /**
   * Format expiration date for display
   */
  formatExpirationDate(expiresAt: string): string {
    const date = new Date(expiresAt);
    const now = new Date();
    const daysRemaining = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysRemaining < 0) {
      return 'Expired';
    } else if (daysRemaining === 0) {
      return 'Expires today';
    } else if (daysRemaining === 1) {
      return 'Expires tomorrow';
    } else if (daysRemaining <= 7) {
      return `Expires in ${daysRemaining} days`;
    } else {
      return date.toLocaleDateString();
    }
  }

  /**
   * Validate email format
   */
  isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Parse CSV data for bulk invitations
   */
  parseCSV(csvText: string): { emails: string[]; customMessages: Map<string, string> } {
    const lines = csvText.split('\n').filter(line => line.trim());
    const emails: string[] = [];
    const customMessages = new Map<string, string>();

    lines.forEach(line => {
      const parts = line.split(',').map(part => part.trim());
      const email = parts[0];
      const customMessage = parts[1];

      if (email && this.isValidEmail(email)) {
        emails.push(email);
        if (customMessage) {
          customMessages.set(email, customMessage);
        }
      }
    });

    return { emails, customMessages };
  }
}

export default new InvitationService();