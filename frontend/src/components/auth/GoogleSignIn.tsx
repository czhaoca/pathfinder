/**
 * Google Sign-In Component
 * Provides Google OAuth authentication with feature flag support
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../ui/button';
import { Alert } from '../ui/alert';
import { Loader2 } from 'lucide-react';
import { authService } from '../../services/authService';
import { featureFlagService } from '../../services/featureFlagService';
import { useAuth } from '../../hooks/useAuth';

interface GoogleSignInButtonProps {
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg';
  fullWidth?: boolean;
  returnUrl?: string;
  className?: string;
}

export const GoogleSignInButton: React.FC<GoogleSignInButtonProps> = ({
  variant = 'outline',
  size = 'default',
  fullWidth = false,
  returnUrl = '/dashboard',
  className = ''
}) => {
  const [isAvailable, setIsAvailable] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Check if Google OAuth is enabled via feature flag
    checkGoogleOAuthAvailability();
  }, []);

  const checkGoogleOAuthAvailability = async () => {
    try {
      const enabled = await featureFlagService.isEnabled('google_oauth_enabled', user?.id);
      setIsAvailable(enabled);
    } catch (error) {
      console.warn('Could not check Google OAuth availability');
      setIsAvailable(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { authUrl } = await authService.getGoogleAuthUrl(returnUrl);
      
      // Redirect to Google OAuth
      window.location.href = authUrl;
    } catch (error: any) {
      setError(error.message || 'Failed to initiate Google sign-in');
      setIsLoading(false);
    }
  };

  if (!isAvailable) {
    return null;
  }

  return (
    <>
      {error && (
        <Alert variant="destructive" className="mb-4">
          {error}
        </Alert>
      )}
      
      <Button
        variant={variant}
        size={size}
        onClick={handleGoogleSignIn}
        disabled={isLoading}
        className={`${fullWidth ? 'w-full' : ''} ${className} flex items-center gap-2`}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <GoogleIcon className="h-4 w-4" />
        )}
        Continue with Google
      </Button>
    </>
  );
};

// Google Icon Component
const GoogleIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      fill="#4285F4"
    />
    <path
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      fill="#34A853"
    />
    <path
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      fill="#FBBC05"
    />
    <path
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      fill="#EA4335"
    />
  </svg>
);

// Divider with text component for sign-in forms
export const OrDivider: React.FC = () => (
  <div className="relative my-6">
    <div className="absolute inset-0 flex items-center">
      <span className="w-full border-t" />
    </div>
    <div className="relative flex justify-center text-xs uppercase">
      <span className="bg-background px-2 text-muted-foreground">
        Or continue with
      </span>
    </div>
  </div>
);

// Account merge component
interface GoogleAccountMergeProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export const GoogleAccountMerge: React.FC<GoogleAccountMergeProps> = ({
  onSuccess,
  onCancel
}) => {
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  // Get Google auth code from URL params
  const urlParams = new URLSearchParams(window.location.search);
  const googleAuthCode = urlParams.get('code');

  const handleMerge = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!password) {
      setError('Password is required');
      return;
    }

    if (!googleAuthCode) {
      setError('Google authentication code is missing');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await authService.mergeGoogleAccount(password, googleAuthCode);
      
      if (onSuccess) {
        onSuccess();
      } else {
        navigate('/profile?tab=security');
      }
    } catch (error: any) {
      setError(error.message || 'Failed to link Google account');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    } else {
      navigate('/login');
    }
  };

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div className="space-y-2 text-center">
        <h2 className="text-2xl font-bold">Link Google Account</h2>
        <p className="text-muted-foreground">
          An account with this email already exists. Enter your password to link your Google account.
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          {error}
        </Alert>
      )}

      <form onSubmit={handleMerge} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="password" className="text-sm font-medium">
            Current Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="Enter your password"
            disabled={isLoading}
            required
          />
        </div>

        <div className="flex gap-3">
          <Button
            type="submit"
            disabled={isLoading}
            className="flex-1"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Linking...
              </>
            ) : (
              'Link Accounts'
            )}
          </Button>
          
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            disabled={isLoading}
            className="flex-1"
          >
            Cancel
          </Button>
        </div>
      </form>

      <div className="space-y-2 text-sm text-muted-foreground">
        <p>Or you can:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <a href="/auth/google?force=new" className="underline hover:text-primary">
              Create a new account with Google
            </a>
          </li>
          <li>
            <a href="/login" className="underline hover:text-primary">
              Sign in with password instead
            </a>
          </li>
        </ul>
      </div>
    </div>
  );
};

// Linked accounts settings component
export const LinkedAccountsSettings: React.FC = () => {
  const { user } = useAuth();
  const [providers, setProviders] = useState<any[]>([]);
  const [hasPassword, setHasPassword] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadLinkedProviders();
  }, []);

  const loadLinkedProviders = async () => {
    try {
      const data = await authService.getLinkedProviders();
      setProviders(data.providers);
      setHasPassword(data.hasPassword);
    } catch (error) {
      console.error('Failed to load linked providers:', error);
    }
  };

  const handleUnlink = async (provider: string) => {
    if (!hasPassword && providers.length === 1) {
      setError('Set a password before unlinking your only sign-in method');
      return;
    }

    if (!window.confirm(`Unlink ${provider} account?`)) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await authService.unlinkProvider(provider);
      await loadLinkedProviders();
    } catch (error: any) {
      setError(error.message || `Failed to unlink ${provider} account`);
    } finally {
      setIsLoading(false);
    }
  };

  const isProviderLinked = (provider: string) => {
    return providers.some(p => p.provider === provider);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Linked Accounts</h3>
        <p className="text-sm text-muted-foreground">
          Manage your connected social accounts for sign-in
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          {error}
        </Alert>
      )}

      <div className="space-y-4">
        {/* Google */}
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <GoogleIcon className="h-5 w-5" />
            <div>
              <p className="font-medium">Google</p>
              {isProviderLinked('google') && (
                <p className="text-sm text-muted-foreground">
                  {providers.find(p => p.provider === 'google')?.email}
                </p>
              )}
            </div>
          </div>
          
          <div>
            {isProviderLinked('google') ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleUnlink('google')}
                disabled={isLoading}
              >
                Unlink
              </Button>
            ) : (
              <GoogleSignInButton
                variant="default"
                size="sm"
                returnUrl="/profile?tab=security"
              />
            )}
          </div>
        </div>

        {/* Future providers can be added here */}
      </div>

      {!hasPassword && providers.length > 0 && (
        <Alert>
          <p className="text-sm">
            You're using social login only. Consider{' '}
            <a href="/settings/password" className="font-medium underline">
              setting a password
            </a>{' '}
            to secure your account.
          </p>
        </Alert>
      )}
    </div>
  );
};

export default GoogleSignInButton;