/**
 * Tests for ProgressiveProfileForm Component
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProgressiveProfileForm } from '../ProgressiveProfileForm';
import { useProfileStore } from '../../../stores/profileStore';
import { toast } from 'react-toastify';

// Mock dependencies
jest.mock('../../../stores/profileStore');
jest.mock('react-toastify', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn()
  }
}));

describe('ProgressiveProfileForm', () => {
  const mockSaveProfileData = jest.fn();
  const mockGetUserProfile = jest.fn();
  const mockOnComplete = jest.fn();
  const mockOnSkip = jest.fn();

  const defaultProps = {
    requiredFields: [
      {
        fieldId: '1',
        fieldName: 'email',
        fieldLabel: 'Email',
        fieldType: 'email',
        validationRules: { required: true },
        helpText: 'Enter your email address',
        placeholder: 'email@example.com'
      },
      {
        fieldId: '2',
        fieldName: 'phone',
        fieldLabel: 'Phone',
        fieldType: 'phone',
        validationRules: { required: false },
        helpText: 'Enter your phone number',
        placeholder: '+1 (555) 123-4567'
      }
    ],
    onComplete: mockOnComplete,
    onSkip: mockOnSkip,
    featureKey: 'advanced_search'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useProfileStore as jest.Mock).mockReturnValue({
      saveProfileData: mockSaveProfileData,
      getUserProfile: mockGetUserProfile
    });
    mockGetUserProfile.mockResolvedValue({});
    mockSaveProfileData.mockResolvedValue({ success: true });
  });

  describe('Rendering', () => {
    it('should render the form with first field', () => {
      render(<ProgressiveProfileForm {...defaultProps} />);
      
      expect(screen.getByText('Complete Your Profile')).toBeInTheDocument();
      expect(screen.getByText('We need a few more details to enable advanced_search')).toBeInTheDocument();
      expect(screen.getByLabelText(/Email/)).toBeInTheDocument();
      expect(screen.getByText('Enter your email address')).toBeInTheDocument();
    });

    it('should show progress indicator', () => {
      render(<ProgressiveProfileForm {...defaultProps} />);
      
      expect(screen.getByText('Step 1 of 2')).toBeInTheDocument();
      expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50');
    });

    it('should render different field types correctly', () => {
      const fields = [
        {
          fieldId: '1',
          fieldName: 'bio',
          fieldLabel: 'Bio',
          fieldType: 'textarea',
          placeholder: 'Tell us about yourself'
        }
      ];

      render(
        <ProgressiveProfileForm
          {...defaultProps}
          requiredFields={fields}
        />
      );

      expect(screen.getByPlaceholderText('Tell us about yourself')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Tell us about yourself').tagName).toBe('TEXTAREA');
    });

    it('should show required indicator for required fields', () => {
      render(<ProgressiveProfileForm {...defaultProps} />);
      
      const requiredIndicator = screen.getByLabelText('required');
      expect(requiredIndicator).toBeInTheDocument();
      expect(requiredIndicator).toHaveTextContent('*');
    });
  });

  describe('Navigation', () => {
    it('should navigate to next field on Next click', async () => {
      render(<ProgressiveProfileForm {...defaultProps} />);
      
      const emailInput = screen.getByLabelText(/Email/);
      await userEvent.type(emailInput, 'test@example.com');
      
      const nextButton = screen.getByRole('button', { name: 'Next' });
      await userEvent.click(nextButton);
      
      await waitFor(() => {
        expect(screen.getByLabelText(/Phone/)).toBeInTheDocument();
        expect(screen.getByText('Step 2 of 2')).toBeInTheDocument();
      });
    });

    it('should navigate back to previous field', async () => {
      render(<ProgressiveProfileForm {...defaultProps} />);
      
      // Go to second field
      const emailInput = screen.getByLabelText(/Email/);
      await userEvent.type(emailInput, 'test@example.com');
      await userEvent.click(screen.getByRole('button', { name: 'Next' }));
      
      // Go back
      await waitFor(() => screen.getByRole('button', { name: 'Back' }));
      await userEvent.click(screen.getByRole('button', { name: 'Back' }));
      
      await waitFor(() => {
        expect(screen.getByLabelText(/Email/)).toBeInTheDocument();
        expect(screen.getByText('Step 1 of 2')).toBeInTheDocument();
      });
    });

    it('should not show Back button on first field', () => {
      render(<ProgressiveProfileForm {...defaultProps} />);
      
      expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument();
    });
  });

  describe('Validation', () => {
    it('should validate required fields', async () => {
      render(<ProgressiveProfileForm {...defaultProps} />);
      
      const nextButton = screen.getByRole('button', { name: 'Next' });
      await userEvent.click(nextButton);
      
      await waitFor(() => {
        expect(screen.getByText('Email is required')).toBeInTheDocument();
      });
    });

    it('should validate email format', async () => {
      render(<ProgressiveProfileForm {...defaultProps} />);
      
      const emailInput = screen.getByLabelText(/Email/);
      await userEvent.type(emailInput, 'invalid-email');
      fireEvent.blur(emailInput);
      
      await waitFor(() => {
        expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();
      });
    });

    it('should validate phone format', async () => {
      render(<ProgressiveProfileForm {...defaultProps} />);
      
      // Navigate to phone field
      const emailInput = screen.getByLabelText(/Email/);
      await userEvent.type(emailInput, 'test@example.com');
      await userEvent.click(screen.getByRole('button', { name: 'Next' }));
      
      await waitFor(() => screen.getByLabelText(/Phone/));
      
      const phoneInput = screen.getByLabelText(/Phone/);
      await userEvent.type(phoneInput, 'abc123');
      fireEvent.blur(phoneInput);
      
      await waitFor(() => {
        expect(screen.getByText('Please enter a valid phone number')).toBeInTheDocument();
      });
    });

    it('should clear error when user corrects input', async () => {
      render(<ProgressiveProfileForm {...defaultProps} />);
      
      const emailInput = screen.getByLabelText(/Email/);
      await userEvent.type(emailInput, 'invalid');
      fireEvent.blur(emailInput);
      
      await waitFor(() => {
        expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();
      });
      
      await userEvent.clear(emailInput);
      await userEvent.type(emailInput, 'valid@example.com');
      
      await waitFor(() => {
        expect(screen.queryByText('Please enter a valid email address')).not.toBeInTheDocument();
      });
    });

    it('should validate min/max length', async () => {
      const fields = [{
        fieldId: '1',
        fieldName: 'bio',
        fieldLabel: 'Bio',
        fieldType: 'textarea',
        validationRules: { minLength: 10, maxLength: 100 }
      }];

      render(
        <ProgressiveProfileForm
          {...defaultProps}
          requiredFields={fields}
        />
      );

      const bioInput = screen.getByRole('textbox');
      
      // Test min length
      await userEvent.type(bioInput, 'Short');
      fireEvent.blur(bioInput);
      
      await waitFor(() => {
        expect(screen.getByText('Minimum 10 characters required')).toBeInTheDocument();
      });

      // Test max length
      await userEvent.clear(bioInput);
      await userEvent.type(bioInput, 'a'.repeat(101));
      fireEvent.blur(bioInput);
      
      await waitFor(() => {
        expect(screen.getByText('Maximum 100 characters allowed')).toBeInTheDocument();
      });
    });
  });

  describe('Skip Functionality', () => {
    it('should show skip button for optional fields', async () => {
      render(<ProgressiveProfileForm {...defaultProps} />);
      
      // Navigate to optional phone field
      const emailInput = screen.getByLabelText(/Email/);
      await userEvent.type(emailInput, 'test@example.com');
      await userEvent.click(screen.getByRole('button', { name: 'Next' }));
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Skip for now' })).toBeInTheDocument();
      });
    });

    it('should not show skip button for required fields', () => {
      render(<ProgressiveProfileForm {...defaultProps} />);
      
      // Email is required
      expect(screen.queryByRole('button', { name: 'Skip for now' })).not.toBeInTheDocument();
    });

    it('should skip to next field when skip is clicked', async () => {
      const fields = [
        ...defaultProps.requiredFields,
        {
          fieldId: '3',
          fieldName: 'location',
          fieldLabel: 'Location',
          fieldType: 'text',
          validationRules: { required: false }
        }
      ];

      render(
        <ProgressiveProfileForm
          {...defaultProps}
          requiredFields={fields}
        />
      );

      // Navigate to optional phone field
      const emailInput = screen.getByLabelText(/Email/);
      await userEvent.type(emailInput, 'test@example.com');
      await userEvent.click(screen.getByRole('button', { name: 'Next' }));
      
      // Skip phone field
      await waitFor(() => screen.getByRole('button', { name: 'Skip for now' }));
      await userEvent.click(screen.getByRole('button', { name: 'Skip for now' }));
      
      await waitFor(() => {
        expect(screen.getByLabelText(/Location/)).toBeInTheDocument();
        expect(screen.getByText('Step 3 of 3')).toBeInTheDocument();
      });
    });

    it('should warn when trying to skip essential field', async () => {
      const fields = [{
        fieldId: '1',
        fieldName: 'ssn',
        fieldLabel: 'SSN',
        fieldType: 'text',
        isEssential: true,
        validationRules: { required: false }
      }];

      render(
        <ProgressiveProfileForm
          {...defaultProps}
          requiredFields={fields}
        />
      );

      // Should not show skip button for essential fields
      expect(screen.queryByRole('button', { name: 'Skip for now' })).not.toBeInTheDocument();
    });
  });

  describe('Form Submission', () => {
    it('should save all data on completion', async () => {
      render(<ProgressiveProfileForm {...defaultProps} />);
      
      // Fill first field
      const emailInput = screen.getByLabelText(/Email/);
      await userEvent.type(emailInput, 'test@example.com');
      await userEvent.click(screen.getByRole('button', { name: 'Next' }));
      
      // Fill second field
      await waitFor(() => screen.getByLabelText(/Phone/));
      const phoneInput = screen.getByLabelText(/Phone/);
      await userEvent.type(phoneInput, '555-1234');
      
      // Complete form
      await userEvent.click(screen.getByRole('button', { name: 'Complete' }));
      
      await waitFor(() => {
        expect(mockSaveProfileData).toHaveBeenCalledWith({
          email: 'test@example.com',
          phone: '555-1234'
        });
        expect(mockOnComplete).toHaveBeenCalledWith({
          email: 'test@example.com',
          phone: '555-1234'
        });
        expect(toast.success).toHaveBeenCalledWith('Profile updated successfully');
      });
    });

    it('should handle save errors gracefully', async () => {
      mockSaveProfileData.mockResolvedValue({ success: false });
      
      render(<ProgressiveProfileForm {...defaultProps} />);
      
      const emailInput = screen.getByLabelText(/Email/);
      await userEvent.type(emailInput, 'test@example.com');
      await userEvent.click(screen.getByRole('button', { name: 'Next' }));
      
      await waitFor(() => screen.getByRole('button', { name: 'Complete' }));
      await userEvent.click(screen.getByRole('button', { name: 'Complete' }));
      
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Failed to save profile data');
        expect(mockOnComplete).not.toHaveBeenCalled();
      });
    });

    it('should handle network errors', async () => {
      mockSaveProfileData.mockRejectedValue(new Error('Network error'));
      
      render(<ProgressiveProfileForm {...defaultProps} />);
      
      const emailInput = screen.getByLabelText(/Email/);
      await userEvent.type(emailInput, 'test@example.com');
      await userEvent.click(screen.getByRole('button', { name: 'Next' }));
      
      await waitFor(() => screen.getByRole('button', { name: 'Complete' }));
      await userEvent.click(screen.getByRole('button', { name: 'Complete' }));
      
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('An error occurred while saving your profile');
      });
    });
  });

  describe('Pre-filling Data', () => {
    it('should pre-fill existing profile data', async () => {
      mockGetUserProfile.mockResolvedValue({
        email: 'existing@example.com',
        phone: '555-9999'
      });

      render(<ProgressiveProfileForm {...defaultProps} />);
      
      await waitFor(() => {
        const emailInput = screen.getByLabelText(/Email/) as HTMLInputElement;
        expect(emailInput.value).toBe('existing@example.com');
      });
    });

    it('should handle errors loading existing data', async () => {
      mockGetUserProfile.mockRejectedValue(new Error('Failed to load'));
      
      render(<ProgressiveProfileForm {...defaultProps} />);
      
      await waitFor(() => {
        const emailInput = screen.getByLabelText(/Email/) as HTMLInputElement;
        expect(emailInput.value).toBe('');
      });
    });
  });

  describe('Different Field Types', () => {
    it('should render select field correctly', () => {
      const fields = [{
        fieldId: '1',
        fieldName: 'country',
        fieldLabel: 'Country',
        fieldType: 'select',
        options: [
          { value: 'us', label: 'United States' },
          { value: 'ca', label: 'Canada' }
        ]
      }];

      render(
        <ProgressiveProfileForm
          {...defaultProps}
          requiredFields={fields}
        />
      );

      const select = screen.getByRole('combobox');
      expect(select).toBeInTheDocument();
      expect(screen.getByText('Select Country')).toBeInTheDocument();
      expect(screen.getByText('United States')).toBeInTheDocument();
      expect(screen.getByText('Canada')).toBeInTheDocument();
    });

    it('should render checkbox field correctly', async () => {
      const fields = [{
        fieldId: '1',
        fieldName: 'newsletter',
        fieldLabel: 'Newsletter',
        fieldType: 'checkbox',
        placeholder: 'Subscribe to newsletter'
      }];

      render(
        <ProgressiveProfileForm
          {...defaultProps}
          requiredFields={fields}
        />
      );

      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toBeInTheDocument();
      expect(screen.getByText('Subscribe to newsletter')).toBeInTheDocument();
      
      await userEvent.click(checkbox);
      expect(checkbox).toBeChecked();
    });

    it('should render radio field correctly', async () => {
      const fields = [{
        fieldId: '1',
        fieldName: 'gender',
        fieldLabel: 'Gender',
        fieldType: 'radio',
        options: [
          { value: 'male', label: 'Male' },
          { value: 'female', label: 'Female' },
          { value: 'other', label: 'Other' }
        ]
      }];

      render(
        <ProgressiveProfileForm
          {...defaultProps}
          requiredFields={fields}
        />
      );

      const maleRadio = screen.getByLabelText('Male');
      const femaleRadio = screen.getByLabelText('Female');
      
      expect(maleRadio).toBeInTheDocument();
      expect(femaleRadio).toBeInTheDocument();
      
      await userEvent.click(maleRadio);
      expect(maleRadio).toBeChecked();
      expect(femaleRadio).not.toBeChecked();
    });

    it('should render date field correctly', () => {
      const fields = [{
        fieldId: '1',
        fieldName: 'birthdate',
        fieldLabel: 'Birth Date',
        fieldType: 'date'
      }];

      render(
        <ProgressiveProfileForm
          {...defaultProps}
          requiredFields={fields}
        />
      );

      const dateInput = screen.getByLabelText(/Birth Date/);
      expect(dateInput).toHaveAttribute('type', 'date');
    });

    it('should render number field correctly', async () => {
      const fields = [{
        fieldId: '1',
        fieldName: 'age',
        fieldLabel: 'Age',
        fieldType: 'number',
        validationRules: { min: 18, max: 100 }
      }];

      render(
        <ProgressiveProfileForm
          {...defaultProps}
          requiredFields={fields}
        />
      );

      const numberInput = screen.getByLabelText(/Age/);
      expect(numberInput).toHaveAttribute('type', 'number');
      
      await userEvent.type(numberInput, '15');
      fireEvent.blur(numberInput);
      
      await waitFor(() => {
        expect(screen.getByText('Value must be at least 18')).toBeInTheDocument();
      });
    });
  });

  describe('Different Modes', () => {
    it('should render wizard mode with step indicators', () => {
      render(
        <ProgressiveProfileForm
          {...defaultProps}
          mode="wizard"
        />
      );

      const steps = screen.getAllByRole('generic').filter(el => 
        el.className.includes('step')
      );
      expect(steps.length).toBeGreaterThan(0);
    });

    it('should apply correct CSS class for mode', () => {
      const { container } = render(
        <ProgressiveProfileForm
          {...defaultProps}
          mode="inline"
        />
      );

      const form = container.querySelector('.progressive-profile-form');
      expect(form).toHaveClass('inline');
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      render(<ProgressiveProfileForm {...defaultProps} />);
      
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow', '50');
      expect(progressBar).toHaveAttribute('aria-valuemin', '0');
      expect(progressBar).toHaveAttribute('aria-valuemax', '100');
    });

    it('should have proper error announcements', async () => {
      render(<ProgressiveProfileForm {...defaultProps} />);
      
      const emailInput = screen.getByLabelText(/Email/);
      await userEvent.type(emailInput, 'invalid');
      fireEvent.blur(emailInput);
      
      await waitFor(() => {
        const error = screen.getByRole('alert');
        expect(error).toHaveTextContent('Please enter a valid email address');
        expect(emailInput).toHaveAttribute('aria-invalid', 'true');
      });
    });

    it('should have keyboard navigation support', async () => {
      render(<ProgressiveProfileForm {...defaultProps} />);
      
      const emailInput = screen.getByLabelText(/Email/);
      emailInput.focus();
      expect(document.activeElement).toBe(emailInput);
      
      // Tab to next button
      await userEvent.tab();
      expect(document.activeElement).toHaveTextContent('Next');
    });
  });
});