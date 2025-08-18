/**
 * Tests for LinkedIn OAuth Components
 * Tests sign-in button, import preview, and sync dashboard
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LinkedInSignInButton } from '../../src/components/auth/LinkedInSignInButton';
import { LinkedInImportPreview } from '../../src/components/profile/LinkedInImportPreview';
import { LinkedInSyncDashboard } from '../../src/components/profile/LinkedInSyncDashboard';
import { AccountMergeModal } from '../../src/components/auth/AccountMergeModal';
import { useAuthStore } from '../../src/stores/authStore';
import { useProfileStore } from '../../src/stores/profileStore';
import { linkedInService } from '../../src/services/linkedInService';

// Mock stores
jest.mock('../../src/stores/authStore');
jest.mock('../../src/stores/profileStore');
jest.mock('../../src/services/linkedInService');

describe('LinkedInSignInButton', () => {
  const mockGenerateAuthUrl = jest.fn();
  const mockNavigate = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    linkedInService.generateAuthUrl = mockGenerateAuthUrl;
  });

  test('should render LinkedIn sign-in button', () => {
    render(<LinkedInSignInButton />);
    
    const button = screen.getByRole('button', { name: /sign in with linkedin/i });
    expect(button).toBeInTheDocument();
    expect(button).toHaveClass('linkedin-signin-button');
  });

  test('should show loading state when clicked', async () => {
    mockGenerateAuthUrl.mockReturnValue(
      new Promise(resolve => setTimeout(() => resolve({ authUrl: 'https://linkedin.com/oauth' }), 100))
    );

    render(<LinkedInSignInButton />);
    
    const button = screen.getByRole('button', { name: /sign in with linkedin/i });
    fireEvent.click(button);

    expect(button).toBeDisabled();
    expect(screen.getByText(/connecting/i)).toBeInTheDocument();
  });

  test('should redirect to LinkedIn OAuth URL', async () => {
    const authUrl = 'https://www.linkedin.com/oauth/v2/authorization?client_id=123';
    mockGenerateAuthUrl.mockResolvedValue({ authUrl });

    // Mock window.location
    delete window.location;
    window.location = { href: '' };

    render(<LinkedInSignInButton returnUrl="/dashboard" />);
    
    const button = screen.getByRole('button', { name: /sign in with linkedin/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockGenerateAuthUrl).toHaveBeenCalledWith('/dashboard');
      expect(window.location.href).toBe(authUrl);
    });
  });

  test('should handle errors gracefully', async () => {
    mockGenerateAuthUrl.mockRejectedValue(new Error('LinkedIn OAuth is not enabled'));

    render(<LinkedInSignInButton />);
    
    const button = screen.getByRole('button', { name: /sign in with linkedin/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText(/linkedin oauth is not enabled/i)).toBeInTheDocument();
      expect(button).not.toBeDisabled();
    });
  });

  test('should include custom className', () => {
    render(<LinkedInSignInButton className="custom-class" />);
    
    const button = screen.getByRole('button', { name: /sign in with linkedin/i });
    expect(button).toHaveClass('linkedin-signin-button', 'custom-class');
  });

  test('should support different button variants', () => {
    const { rerender } = render(<LinkedInSignInButton variant="primary" />);
    
    let button = screen.getByRole('button', { name: /sign in with linkedin/i });
    expect(button).toHaveClass('linkedin-signin-button--primary');

    rerender(<LinkedInSignInButton variant="secondary" />);
    button = screen.getByRole('button', { name: /sign in with linkedin/i });
    expect(button).toHaveClass('linkedin-signin-button--secondary');
  });
});

describe('LinkedInImportPreview', () => {
  const mockImportProfile = jest.fn();
  const mockPreviewImport = jest.fn();
  const mockProfileData = {
    profile: {
      localizedFirstName: 'John',
      localizedLastName: 'Doe',
      headline: 'Software Engineer',
      summary: 'Experienced developer'
    },
    workExperience: [
      {
        title: 'Senior Developer',
        companyName: 'Tech Corp',
        startDate: { year: 2020, month: 1 },
        endDate: null,
        description: 'Leading development team',
        location: 'San Francisco, CA'
      }
    ],
    education: [
      {
        schoolName: 'University',
        degreeName: 'Bachelor of Science',
        fieldOfStudy: 'Computer Science',
        startDate: { year: 2012 },
        endDate: { year: 2016 }
      }
    ],
    skills: ['JavaScript', 'Python', 'React', 'Node.js'],
    certifications: [
      {
        name: 'AWS Certified',
        authority: 'Amazon',
        licenseNumber: '123456',
        startDate: { year: 2021, month: 6 }
      }
    ]
  };

  beforeEach(() => {
    jest.clearAllMocks();
    linkedInService.previewImport = mockPreviewImport;
    linkedInService.importProfile = mockImportProfile;
    mockPreviewImport.mockResolvedValue({ preview: mockProfileData });
  });

  test('should load and display profile preview', async () => {
    render(<LinkedInImportPreview />);

    await waitFor(() => {
      expect(mockPreviewImport).toHaveBeenCalled();
    });

    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Software Engineer')).toBeInTheDocument();
    expect(screen.getByText('Senior Developer')).toBeInTheDocument();
    expect(screen.getByText('Tech Corp')).toBeInTheDocument();
  });

  test('should show loading state while fetching preview', () => {
    mockPreviewImport.mockReturnValue(new Promise(() => {})); // Never resolves

    render(<LinkedInImportPreview />);

    expect(screen.getByText(/loading preview/i)).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  test('should allow selective import with checkboxes', async () => {
    render(<LinkedInImportPreview />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Check import options
    const workExpCheckbox = screen.getByRole('checkbox', { name: /work experience/i });
    const educationCheckbox = screen.getByRole('checkbox', { name: /education/i });
    const skillsCheckbox = screen.getByRole('checkbox', { name: /skills/i });
    const certsCheckbox = screen.getByRole('checkbox', { name: /certifications/i });

    expect(workExpCheckbox).toBeChecked();
    expect(educationCheckbox).toBeChecked();
    expect(skillsCheckbox).toBeChecked();
    expect(certsCheckbox).toBeChecked();

    // Uncheck education
    fireEvent.click(educationCheckbox);
    expect(educationCheckbox).not.toBeChecked();
  });

  test('should handle import with selected options', async () => {
    mockImportProfile.mockResolvedValue({
      imported: {
        workExperience: 1,
        skills: 4
      }
    });

    render(<LinkedInImportPreview />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Uncheck education and certifications
    fireEvent.click(screen.getByRole('checkbox', { name: /education/i }));
    fireEvent.click(screen.getByRole('checkbox', { name: /certifications/i }));

    // Click import button
    const importButton = screen.getByRole('button', { name: /import selected/i });
    fireEvent.click(importButton);

    await waitFor(() => {
      expect(mockImportProfile).toHaveBeenCalledWith({
        workExperience: true,
        education: false,
        skills: true,
        certifications: false
      });
    });

    expect(screen.getByText(/successfully imported/i)).toBeInTheDocument();
    expect(screen.getByText(/1 work experience/i)).toBeInTheDocument();
    expect(screen.getByText(/4 skills/i)).toBeInTheDocument();
  });

  test('should show individual item selection', async () => {
    render(<LinkedInImportPreview detailed />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Should show checkboxes for each work experience
    const workExpItems = screen.getAllByTestId('work-experience-item');
    expect(workExpItems).toHaveLength(1);

    const itemCheckbox = screen.getByRole('checkbox', { name: /senior developer at tech corp/i });
    expect(itemCheckbox).toBeChecked();

    // Uncheck specific item
    fireEvent.click(itemCheckbox);
    expect(itemCheckbox).not.toBeChecked();
  });

  test('should handle import errors', async () => {
    mockImportProfile.mockRejectedValue(new Error('Import failed'));

    render(<LinkedInImportPreview />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    const importButton = screen.getByRole('button', { name: /import selected/i });
    fireEvent.click(importButton);

    await waitFor(() => {
      expect(screen.getByText(/import failed/i)).toBeInTheDocument();
      expect(screen.getByRole('alert')).toHaveClass('alert--error');
    });
  });

  test('should support cancellation', async () => {
    const onCancel = jest.fn();
    
    render(<LinkedInImportPreview onCancel={onCancel} />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    fireEvent.click(cancelButton);

    expect(onCancel).toHaveBeenCalled();
  });
});

describe('LinkedInSyncDashboard', () => {
  const mockSyncProfile = jest.fn();
  const mockGetSyncStatus = jest.fn();
  const mockUpdateSyncSettings = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    linkedInService.syncProfile = mockSyncProfile;
    linkedInService.getSyncStatus = mockGetSyncStatus;
    linkedInService.updateSyncSettings = mockUpdateSyncSettings;
    
    mockGetSyncStatus.mockResolvedValue({
      lastSyncAt: new Date(Date.now() - 86400000), // 24 hours ago
      syncEnabled: true,
      syncInterval: 86400000, // 24 hours
      nextSyncAt: new Date(Date.now() + 3600000) // 1 hour from now
    });
  });

  test('should display sync status', async () => {
    render(<LinkedInSyncDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/last synced/i)).toBeInTheDocument();
      expect(screen.getByText(/24 hours ago/i)).toBeInTheDocument();
      expect(screen.getByText(/next sync/i)).toBeInTheDocument();
    });
  });

  test('should show sync in progress', async () => {
    mockSyncProfile.mockReturnValue(
      new Promise(resolve => setTimeout(() => resolve({ synced: true }), 1000))
    );

    render(<LinkedInSyncDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/last synced/i)).toBeInTheDocument();
    });

    const syncButton = screen.getByRole('button', { name: /sync now/i });
    fireEvent.click(syncButton);

    expect(screen.getByText(/syncing/i)).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  test('should handle manual sync', async () => {
    mockSyncProfile.mockResolvedValue({
      synced: true,
      profile: { localizedFirstName: 'John' },
      changes: {
        workExperience: { added: 1, updated: 0, removed: 0 },
        skills: { added: 2, updated: 0, removed: 0 }
      }
    });

    render(<LinkedInSyncDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/last synced/i)).toBeInTheDocument();
    });

    const syncButton = screen.getByRole('button', { name: /sync now/i });
    fireEvent.click(syncButton);

    await waitFor(() => {
      expect(mockSyncProfile).toHaveBeenCalledWith(false); // Not forced
      expect(screen.getByText(/sync completed/i)).toBeInTheDocument();
      expect(screen.getByText(/1 work experience added/i)).toBeInTheDocument();
      expect(screen.getByText(/2 skills added/i)).toBeInTheDocument();
    });
  });

  test('should handle force sync', async () => {
    mockSyncProfile.mockResolvedValue({ synced: true });

    render(<LinkedInSyncDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/last synced/i)).toBeInTheDocument();
    });

    // Open sync menu
    const menuButton = screen.getByRole('button', { name: /sync options/i });
    fireEvent.click(menuButton);

    const forceSyncButton = screen.getByRole('menuitem', { name: /force sync/i });
    fireEvent.click(forceSyncButton);

    await waitFor(() => {
      expect(mockSyncProfile).toHaveBeenCalledWith(true); // Force sync
    });
  });

  test('should toggle auto-sync', async () => {
    render(<LinkedInSyncDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/auto-sync enabled/i)).toBeInTheDocument();
    });

    const autoSyncToggle = screen.getByRole('switch', { name: /auto-sync/i });
    expect(autoSyncToggle).toBeChecked();

    // Disable auto-sync
    fireEvent.click(autoSyncToggle);

    await waitFor(() => {
      expect(mockUpdateSyncSettings).toHaveBeenCalledWith({
        syncEnabled: false
      });
      expect(autoSyncToggle).not.toBeChecked();
    });
  });

  test('should update sync interval', async () => {
    render(<LinkedInSyncDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/sync interval/i)).toBeInTheDocument();
    });

    const intervalSelect = screen.getByRole('combobox', { name: /sync interval/i });
    expect(intervalSelect).toHaveValue('86400000'); // 24 hours

    // Change to weekly
    fireEvent.change(intervalSelect, { target: { value: '604800000' } });

    await waitFor(() => {
      expect(mockUpdateSyncSettings).toHaveBeenCalledWith({
        syncInterval: 604800000
      });
    });
  });

  test('should handle sync errors', async () => {
    mockSyncProfile.mockRejectedValue(new Error('Sync failed: API rate limit'));

    render(<LinkedInSyncDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/last synced/i)).toBeInTheDocument();
    });

    const syncButton = screen.getByRole('button', { name: /sync now/i });
    fireEvent.click(syncButton);

    await waitFor(() => {
      expect(screen.getByText(/sync failed/i)).toBeInTheDocument();
      expect(screen.getByText(/api rate limit/i)).toBeInTheDocument();
      expect(screen.getByRole('alert')).toHaveClass('alert--error');
    });
  });

  test('should show sync history', async () => {
    const syncHistory = [
      {
        syncedAt: new Date(Date.now() - 86400000),
        status: 'success',
        changes: { workExperience: 1, skills: 2 }
      },
      {
        syncedAt: new Date(Date.now() - 172800000),
        status: 'success',
        changes: { education: 1 }
      },
      {
        syncedAt: new Date(Date.now() - 259200000),
        status: 'failed',
        error: 'Network error'
      }
    ];

    mockGetSyncStatus.mockResolvedValue({
      lastSyncAt: new Date(Date.now() - 86400000),
      syncEnabled: true,
      syncHistory
    });

    render(<LinkedInSyncDashboard showHistory />);

    await waitFor(() => {
      expect(screen.getByText(/sync history/i)).toBeInTheDocument();
    });

    // Should show history items
    expect(screen.getByText(/1 work experience, 2 skills/i)).toBeInTheDocument();
    expect(screen.getByText(/1 education/i)).toBeInTheDocument();
    expect(screen.getByText(/network error/i)).toBeInTheDocument();
  });
});

describe('AccountMergeModal', () => {
  const mockMergeAccounts = jest.fn();
  const mockOnClose = jest.fn();
  const mockOnSuccess = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    linkedInService.mergeAccounts = mockMergeAccounts;
  });

  test('should display merge confirmation modal', () => {
    render(
      <AccountMergeModal
        isOpen={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
        existingEmail="user@example.com"
        linkedInEmail="linkedin@example.com"
      />
    );

    expect(screen.getByText(/account already exists/i)).toBeInTheDocument();
    expect(screen.getByText(/user@example.com/i)).toBeInTheDocument();
    expect(screen.getByText(/linkedin@example.com/i)).toBeInTheDocument();
  });

  test('should require password for merge', async () => {
    render(
      <AccountMergeModal
        isOpen={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
        existingEmail="user@example.com"
      />
    );

    const mergeButton = screen.getByRole('button', { name: /merge accounts/i });
    expect(mergeButton).toBeDisabled();

    const passwordInput = screen.getByLabelText(/password/i);
    await userEvent.type(passwordInput, 'password123');

    expect(mergeButton).not.toBeDisabled();
  });

  test('should handle successful merge', async () => {
    mockMergeAccounts.mockResolvedValue({
      success: true,
      user: { id: 'user-id' }
    });

    render(
      <AccountMergeModal
        isOpen={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
        linkedInAuthCode="auth-code"
      />
    );

    const passwordInput = screen.getByLabelText(/password/i);
    await userEvent.type(passwordInput, 'password123');

    const mergeButton = screen.getByRole('button', { name: /merge accounts/i });
    fireEvent.click(mergeButton);

    await waitFor(() => {
      expect(mockMergeAccounts).toHaveBeenCalledWith('password123', 'auth-code');
      expect(mockOnSuccess).toHaveBeenCalled();
      expect(screen.getByText(/accounts successfully merged/i)).toBeInTheDocument();
    });
  });

  test('should handle merge errors', async () => {
    mockMergeAccounts.mockRejectedValue(new Error('Invalid password'));

    render(
      <AccountMergeModal
        isOpen={true}
        onClose={mockOnClose}
        linkedInAuthCode="auth-code"
      />
    );

    const passwordInput = screen.getByLabelText(/password/i);
    await userEvent.type(passwordInput, 'wrongpassword');

    const mergeButton = screen.getByRole('button', { name: /merge accounts/i });
    fireEvent.click(mergeButton);

    await waitFor(() => {
      expect(screen.getByText(/invalid password/i)).toBeInTheDocument();
      expect(screen.getByRole('alert')).toHaveClass('alert--error');
    });
  });

  test('should allow cancellation', () => {
    render(
      <AccountMergeModal
        isOpen={true}
        onClose={mockOnClose}
      />
    );

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    fireEvent.click(cancelButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  test('should show loading state during merge', async () => {
    mockMergeAccounts.mockReturnValue(
      new Promise(resolve => setTimeout(() => resolve({ success: true }), 1000))
    );

    render(
      <AccountMergeModal
        isOpen={true}
        onClose={mockOnClose}
        linkedInAuthCode="auth-code"
      />
    );

    const passwordInput = screen.getByLabelText(/password/i);
    await userEvent.type(passwordInput, 'password123');

    const mergeButton = screen.getByRole('button', { name: /merge accounts/i });
    fireEvent.click(mergeButton);

    expect(screen.getByText(/merging/i)).toBeInTheDocument();
    expect(mergeButton).toBeDisabled();
  });
});