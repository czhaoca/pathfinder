import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import invitationService, { 
  ValidateTokenResponse, 
  AcceptInvitationRequest 
} from '../services/invitationService';
import { authStore } from '../stores/authStore';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { PasswordInput } from '../components/common/PasswordInput';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Alert } from '../components/ui/alert';
import { Checkbox } from '../components/ui/checkbox';
import { Label } from '../components/ui/label';

interface FormData {
  username: string;
  firstName: string;
  lastName: string;
  password: string;
  confirmPassword: string;
  acceptTerms: boolean;
}

interface FormErrors {
  username?: string;
  firstName?: string;
  lastName?: string;
  password?: string;
  confirmPassword?: string;
  acceptTerms?: string;
}

export const InviteRegistration: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const { login } = authStore();

  // State
  const [validating, setValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [tokenData, setTokenData] = useState<ValidateTokenResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>({
    username: '',
    firstName: '',
    lastName: '',
    password: '',
    confirmPassword: '',
    acceptTerms: false
  });
  const [formErrors, setFormErrors] = useState<FormErrors>({});

  // Validate token on component mount
  useEffect(() => {
    if (!token) {
      setError('No invitation token provided');
      setValidating(false);
      return;
    }

    validateToken();
  }, [token]);

  const validateToken = async () => {
    setValidating(true);
    setError(null);

    try {
      const response = await invitationService.validateToken(token!);
      if (response.success && response.data) {
        if (response.data.valid) {
          setTokenValid(true);
          setTokenData(response.data);
        } else {
          setError(response.data.reason || 'Invalid invitation token');
        }
      }
    } catch (error: any) {
      setError(error.message || 'Failed to validate invitation');
    } finally {
      setValidating(false);
    }
  };

  const validateForm = (): boolean => {
    const errors: FormErrors = {};

    // Username validation
    if (!formData.username) {
      errors.username = 'Username is required';
    } else if (formData.username.length < 3) {
      errors.username = 'Username must be at least 3 characters';
    } else if (!/^[a-zA-Z0-9_-]+$/.test(formData.username)) {
      errors.username = 'Username can only contain letters, numbers, underscores, and hyphens';
    }

    // Name validation
    if (!formData.firstName) {
      errors.firstName = 'First name is required';
    }
    if (!formData.lastName) {
      errors.lastName = 'Last name is required';
    }

    // Password validation
    if (!formData.password) {
      errors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      errors.password = 'Password must be at least 8 characters';
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.password)) {
      errors.password = 'Password must contain uppercase, lowercase, and numbers';
    }

    if (!formData.confirmPassword) {
      errors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    // Terms acceptance
    if (!formData.acceptTerms) {
      errors.acceptTerms = 'You must accept the terms of service';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const request: AcceptInvitationRequest = {
        token: token!,
        username: formData.username,
        password: formData.password,
        firstName: formData.firstName,
        lastName: formData.lastName,
        acceptTerms: formData.acceptTerms
      };

      const response = await invitationService.acceptInvitation(request);
      if (response.success && response.data) {
        // Store tokens and user data
        login(
          response.data.user,
          response.data.tokens.token,
          response.data.tokens.refreshToken
        );

        // Redirect to dashboard
        navigate('/dashboard');
      }
    } catch (error: any) {
      setError(error.message || 'Failed to create account');
    } finally {
      setSubmitting(false);
    }
  };

  const handleInputChange = (field: keyof FormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error for this field when user starts typing
    if (formErrors[field]) {
      setFormErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  // Show loading state while validating
  if (validating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center py-8">
            <LoadingSpinner size="lg" />
            <p className="mt-4 text-gray-600">Validating invitation...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show error if token is invalid
  if (!tokenValid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-red-600">Invalid Invitation</CardTitle>
          </CardHeader>
          <CardContent>
            <Alert className="bg-red-50 border-red-200">
              <p className="text-red-800">{error || 'This invitation is not valid'}</p>
            </Alert>
            <div className="mt-6 space-y-3">
              <p className="text-sm text-gray-600">
                This could happen if:
              </p>
              <ul className="text-sm text-gray-600 list-disc list-inside space-y-1">
                <li>The invitation has expired</li>
                <li>The invitation has already been used</li>
                <li>The invitation link is incorrect</li>
              </ul>
              <Button
                onClick={() => navigate('/login')}
                className="w-full mt-4"
                variant="outline"
              >
                Go to Login
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show registration form
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl">Welcome to Pathfinder</CardTitle>
          <CardDescription className="text-lg mt-2">
            You've been invited to join by {tokenData?.inviterName}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {tokenData?.email && (
            <Alert className="mb-6 bg-blue-50 border-blue-200">
              <p className="text-blue-800">
                Creating account for: <strong>{tokenData.email}</strong>
              </p>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username */}
            <div>
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                value={formData.username}
                onChange={(e) => handleInputChange('username', e.target.value)}
                placeholder="Choose a username"
                className={formErrors.username ? 'border-red-500' : ''}
                disabled={submitting}
              />
              {formErrors.username && (
                <p className="text-red-500 text-sm mt-1">{formErrors.username}</p>
              )}
            </div>

            {/* Name fields */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  type="text"
                  value={formData.firstName}
                  onChange={(e) => handleInputChange('firstName', e.target.value)}
                  placeholder="John"
                  className={formErrors.firstName ? 'border-red-500' : ''}
                  disabled={submitting}
                />
                {formErrors.firstName && (
                  <p className="text-red-500 text-sm mt-1">{formErrors.firstName}</p>
                )}
              </div>
              <div>
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  type="text"
                  value={formData.lastName}
                  onChange={(e) => handleInputChange('lastName', e.target.value)}
                  placeholder="Doe"
                  className={formErrors.lastName ? 'border-red-500' : ''}
                  disabled={submitting}
                />
                {formErrors.lastName && (
                  <p className="text-red-500 text-sm mt-1">{formErrors.lastName}</p>
                )}
              </div>
            </div>

            {/* Password fields */}
            <div>
              <Label htmlFor="password">Password</Label>
              <PasswordInput
                id="password"
                value={formData.password}
                onChange={(e) => handleInputChange('password', e.target.value)}
                placeholder="Create a strong password"
                className={formErrors.password ? 'border-red-500' : ''}
                disabled={submitting}
              />
              {formErrors.password && (
                <p className="text-red-500 text-sm mt-1">{formErrors.password}</p>
              )}
              <p className="text-xs text-gray-500 mt-1">
                Must be at least 8 characters with uppercase, lowercase, and numbers
              </p>
            </div>

            <div>
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <PasswordInput
                id="confirmPassword"
                value={formData.confirmPassword}
                onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                placeholder="Confirm your password"
                className={formErrors.confirmPassword ? 'border-red-500' : ''}
                disabled={submitting}
              />
              {formErrors.confirmPassword && (
                <p className="text-red-500 text-sm mt-1">{formErrors.confirmPassword}</p>
              )}
            </div>

            {/* Terms acceptance */}
            <div className="flex items-start space-x-2">
              <Checkbox
                id="acceptTerms"
                checked={formData.acceptTerms}
                onCheckedChange={(checked) => handleInputChange('acceptTerms', checked)}
                disabled={submitting}
              />
              <div className="flex-1">
                <Label htmlFor="acceptTerms" className="text-sm cursor-pointer">
                  I accept the{' '}
                  <a href="/terms" target="_blank" className="text-blue-600 hover:underline">
                    Terms of Service
                  </a>{' '}
                  and{' '}
                  <a href="/privacy" target="_blank" className="text-blue-600 hover:underline">
                    Privacy Policy
                  </a>
                </Label>
                {formErrors.acceptTerms && (
                  <p className="text-red-500 text-sm mt-1">{formErrors.acceptTerms}</p>
                )}
              </div>
            </div>

            {/* Error message */}
            {error && (
              <ErrorMessage message={error} />
            )}

            {/* Submit button */}
            <Button
              type="submit"
              disabled={submitting}
              className="w-full"
            >
              {submitting ? (
                <>
                  <LoadingSpinner size="sm" className="mr-2" />
                  Creating Account...
                </>
              ) : (
                'Create Account'
              )}
            </Button>

            {/* Expiration warning */}
            {tokenData?.expiresAt && (
              <p className="text-center text-sm text-gray-500 mt-4">
                This invitation expires on{' '}
                {new Date(tokenData.expiresAt).toLocaleDateString()}
              </p>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
};