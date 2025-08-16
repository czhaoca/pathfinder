import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { authService } from '@/services/authService';
import { PasswordInput } from '@/components/common/PasswordInput';
import { PasswordHasher } from '@/utils/crypto';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { KeyRound, AlertCircle, CheckCircle, Info, Loader2 } from 'lucide-react';

interface PasswordChangeProps {
  isFirstLogin?: boolean;
  onSuccess?: () => void;
}

export const PasswordChange: React.FC<PasswordChangeProps> = ({ 
  isFirstLogin = false, 
  onSuccess 
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Check if this is a forced password change from login
  const changeToken = location.state?.changeToken;
  const changeReason = location.state?.reason || (isFirstLogin ? 'First login - password change required' : null);
  
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [checkingExposure, setCheckingExposure] = useState(false);
  const [exposureWarning, setExposureWarning] = useState<string | null>(null);

  // Check password exposure when new password changes
  const checkPasswordExposure = async (password: string) => {
    if (!password || password.length < 8) return;
    
    setCheckingExposure(true);
    setExposureWarning(null);
    
    try {
      const result = await PasswordHasher.checkPasswordExposure(password);
      if (result.exposed) {
        setExposureWarning(
          `This password has been exposed in ${result.count.toLocaleString()} data breaches. Please choose a different password.`
        );
      }
    } catch (err) {
      console.error('Failed to check password exposure:', err);
    } finally {
      setCheckingExposure(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate passwords match
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    // Validate password strength
    const validation = PasswordHasher.validatePassword(newPassword);
    if (!validation.isValid) {
      setError(validation.feedback.join('. '));
      return;
    }

    // Warn about exposed password but don't block
    if (exposureWarning && !window.confirm(
      `${exposureWarning}\n\nDo you want to continue with this password anyway?`
    )) {
      return;
    }

    setIsLoading(true);

    try {
      await authService.changePassword(currentPassword, newPassword);
      setSuccess(true);
      
      // Clear passwords from memory
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      
      // Redirect or callback after short delay
      setTimeout(() => {
        if (onSuccess) {
          onSuccess();
        } else {
          navigate('/dashboard');
        }
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to change password');
    } finally {
      setIsLoading(false);
    }
  };

  const estimatedCrackTime = newPassword ? 
    PasswordHasher.estimateCrackTime(newPassword) : null;

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-600">
              <CheckCircle className="h-5 w-5" />
              Password Changed Successfully
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Alert className="bg-green-50 border-green-200">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <div className="ml-2">
                <p className="text-sm text-green-800">
                  Your password has been updated. Redirecting to dashboard...
                </p>
              </div>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-blue-600" />
            {isFirstLogin ? 'Set Your Password' : 'Change Your Password'}
          </CardTitle>
          <CardDescription>
            {changeReason || 'Choose a strong password to secure your account'}
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

            {changeReason && (
              <Alert>
                <Info className="h-4 w-4" />
                <div className="ml-2">
                  <p className="text-sm font-medium">Password Change Required</p>
                  <p className="text-sm text-gray-600 mt-1">{changeReason}</p>
                </div>
              </Alert>
            )}

            {!isFirstLogin && !changeToken && (
              <PasswordInput
                id="current-password"
                label="Current Password"
                value={currentPassword}
                onChange={setCurrentPassword}
                placeholder="Enter your current password"
                required
                autoComplete="current-password"
                disabled={isLoading}
                autoFocus
              />
            )}

            <div className="space-y-2">
              <PasswordInput
                id="new-password"
                label="New Password"
                value={newPassword}
                onChange={(value) => {
                  setNewPassword(value);
                  // Debounce exposure check
                  const timer = setTimeout(() => {
                    checkPasswordExposure(value);
                  }, 500);
                  return () => clearTimeout(timer);
                }}
                placeholder="Enter your new password"
                required
                autoComplete="new-password"
                showStrength={true}
                showRequirements={true}
                disabled={isLoading}
                autoFocus={isFirstLogin || !!changeToken}
              />
              
              {estimatedCrackTime && (
                <p className="text-xs text-gray-600">
                  Estimated time to crack: <strong>{estimatedCrackTime}</strong>
                </p>
              )}
              
              {checkingExposure && (
                <p className="text-xs text-gray-500 flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Checking password security...
                </p>
              )}
              
              {exposureWarning && (
                <Alert variant="destructive" className="text-xs">
                  <AlertCircle className="h-3 w-3" />
                  <span className="ml-1">{exposureWarning}</span>
                </Alert>
              )}
            </div>

            <PasswordInput
              id="confirm-password"
              label="Confirm New Password"
              value={confirmPassword}
              onChange={setConfirmPassword}
              placeholder="Confirm your new password"
              required
              autoComplete="new-password"
              disabled={isLoading}
              error={confirmPassword && newPassword !== confirmPassword ? 'Passwords do not match' : undefined}
            />

            <Alert>
              <Info className="h-4 w-4" />
              <div className="ml-2">
                <p className="text-sm font-medium">Password Tips</p>
                <ul className="text-sm text-gray-600 mt-1 space-y-1">
                  <li>• Use a unique password not used elsewhere</li>
                  <li>• Consider using a password manager</li>
                  <li>• Avoid personal information in passwords</li>
                  <li>• Longer passwords are generally stronger</li>
                </ul>
              </div>
            </Alert>
          </CardContent>

          <CardFooter className="flex flex-col gap-2">
            <Button
              type="submit"
              className="w-full"
              disabled={
                isLoading || 
                (!isFirstLogin && !changeToken && !currentPassword) ||
                !newPassword || 
                !confirmPassword || 
                newPassword !== confirmPassword
              }
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Changing Password...
                </>
              ) : (
                'Change Password'
              )}
            </Button>
            
            {!isFirstLogin && !changeToken && (
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => navigate(-1)}
              >
                Cancel
              </Button>
            )}
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};

export default PasswordChange;