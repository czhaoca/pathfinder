import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '@/services/authService';
import { authStore } from '@/stores/authStore';
import { PasswordInput } from '@/components/common/PasswordInput';
import { MfaInput } from '@/components/auth/MfaInput';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, AlertCircle, Loader2 } from 'lucide-react';

interface LoginFormProps {
  onSuccess?: () => void;
  redirectTo?: string;
}

export const SecureLoginForm: React.FC<LoginFormProps> = ({ 
  onSuccess, 
  redirectTo = '/dashboard' 
}) => {
  const navigate = useNavigate();
  const passwordRef = useRef<HTMLInputElement>(null);
  
  // Form state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // MFA state
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaToken, setMfaToken] = useState('');
  const [mfaSessionToken, setMfaSessionToken] = useState('');
  const [mfaMethods, setMfaMethods] = useState<string[]>([]);
  
  // Password change state
  const [passwordChangeRequired, setPasswordChangeRequired] = useState(false);
  const [passwordChangeToken, setPasswordChangeToken] = useState('');
  
  // Clear sensitive data on unmount
  useEffect(() => {
    return () => {
      setPassword('');
      setMfaToken('');
      if (passwordRef.current) {
        passwordRef.current.value = '';
      }
    };
  }, []);

  // Set up session warning handler
  useEffect(() => {
    authService.onSessionWarning(() => {
      // Show session expiry warning
      const shouldExtend = window.confirm(
        'Your session is about to expire. Would you like to extend it?'
      );
      if (shouldExtend) {
        authService.refreshToken().catch(() => {
          navigate('/login');
        });
      }
    });
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const result = await authService.login({
        username,
        password,
        rememberMe,
        mfaToken: mfaRequired ? mfaToken : undefined
      });

      // Clear password immediately after use
      setPassword('');
      if (passwordRef.current) {
        passwordRef.current.value = '';
      }

      // Handle different response types
      if ('requires_mfa' in result && result.requires_mfa) {
        // MFA required
        setMfaRequired(true);
        setMfaSessionToken(result.session_token || '');
        setMfaMethods(result.mfa_methods || ['totp']);
        setIsLoading(false);
        return;
      }

      if ('must_change_password' in result && result.must_change_password) {
        // Password change required
        setPasswordChangeRequired(true);
        setPasswordChangeToken(result.change_token || '');
        setIsLoading(false);
        navigate('/auth/change-password', {
          state: { 
            changeToken: result.change_token,
            reason: result.reason 
          }
        });
        return;
      }

      // Success - update auth store
      if ('user' in result && 'token' in result) {
        authStore.getState().login({
          username,
          password: '' // Don't store password
        });
        
        if (onSuccess) {
          onSuccess();
        } else {
          navigate(redirectTo);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.');
      // Clear MFA state on error
      setMfaRequired(false);
      setMfaToken('');
      setMfaSessionToken('');
    } finally {
      setIsLoading(false);
    }
  };

  const handleMfaSubmit = async () => {
    if (!mfaToken || mfaToken.length !== 6) {
      setError('Please enter a valid 6-digit code');
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const result = await authService.verifyMFA(
        mfaSessionToken,
        mfaToken,
        mfaMethods[0] || 'totp'
      );

      // Success
      authStore.getState().login({
        username,
        password: '' // Don't store password
      });

      if (onSuccess) {
        onSuccess();
      } else {
        navigate(redirectTo);
      }
    } catch (err: any) {
      setError(err.message || 'Invalid MFA code. Please try again.');
      setMfaToken('');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="space-y-1">
        <div className="flex items-center gap-2">
          <Shield className="h-6 w-6 text-blue-600" />
          <CardTitle className="text-2xl">Secure Sign In</CardTitle>
        </div>
        <CardDescription>
          Enter your credentials to access your account
        </CardDescription>
      </CardHeader>

      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <span className="ml-2">{error}</span>
            </Alert>
          )}

          {!mfaRequired ? (
            <>
              <div className="space-y-2">
                <label htmlFor="username" className="text-sm font-medium">
                  Username
                </label>
                <Input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your username"
                  required
                  autoComplete="username"
                  autoFocus
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <PasswordInput
                  ref={passwordRef}
                  id="password"
                  label="Password"
                  value={password}
                  onChange={setPassword}
                  placeholder="Enter your password"
                  required
                  autoComplete="current-password"
                  disabled={isLoading}
                  showStrength={false}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="remember"
                    checked={rememberMe}
                    onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                    disabled={isLoading}
                  />
                  <label
                    htmlFor="remember"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Remember me
                  </label>
                </div>

                <a
                  href="/auth/forgot-password"
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  Forgot password?
                </a>
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <MfaInput
                value={mfaToken}
                onChange={setMfaToken}
                onComplete={handleMfaSubmit}
                autoFocus
                disabled={isLoading}
                error={error || undefined}
                method={mfaMethods[0] as any || 'totp'}
              />
            </div>
          )}
        </CardContent>

        <CardFooter className="flex flex-col space-y-4">
          {!mfaRequired ? (
            <Button
              type="submit"
              className="w-full"
              disabled={isLoading || !username || !password}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleMfaSubmit}
              className="w-full"
              disabled={isLoading || mfaToken.length !== 6}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                'Verify Code'
              )}
            </Button>
          )}

          <div className="w-full space-y-2">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-gray-500">Security Notice</span>
              </div>
            </div>

            <div className="text-xs text-gray-600 text-center space-y-1">
              <p className="flex items-center justify-center gap-1">
                <Shield className="h-3 w-3" />
                Your password is encrypted before transmission
              </p>
              <p>We never store or transmit passwords in plain text</p>
            </div>
          </div>
        </CardFooter>
      </form>
    </Card>
  );
};

export default SecureLoginForm;