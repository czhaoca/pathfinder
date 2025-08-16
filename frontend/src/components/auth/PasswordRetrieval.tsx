import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { authService } from '@/services/authService';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Copy, CheckCircle, AlertCircle, Key, Clock, User, Loader2 } from 'lucide-react';

export const PasswordRetrieval: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [passwordData, setPasswordData] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<string>('');

  useEffect(() => {
    const token = searchParams.get('token');
    const username = searchParams.get('username');
    
    if (!token) {
      setError('No retrieval token provided');
      setLoading(false);
      return;
    }

    retrievePassword(token);
  }, [searchParams]);

  // Update time remaining countdown
  useEffect(() => {
    if (!passwordData?.expires_at) return;

    const updateTimer = () => {
      const now = new Date().getTime();
      const expiry = new Date(passwordData.expires_at).getTime();
      const diff = expiry - now;

      if (diff <= 0) {
        setTimeRemaining('Expired');
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      setTimeRemaining(`${hours}h ${minutes}m`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [passwordData]);

  const retrievePassword = async (token: string) => {
    try {
      const result = await authService.retrievePassword(token);
      setPasswordData(result);
    } catch (err: any) {
      setError(err.message || 'Failed to retrieve password. Token may be invalid or expired.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyPassword = async () => {
    if (!passwordData?.temporary_password) return;

    try {
      await navigator.clipboard.writeText(passwordData.temporary_password);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch (err) {
      console.error('Failed to copy password:', err);
    }
  };

  const handleCopyAll = async () => {
    if (!passwordData) return;

    const text = `
Username: ${passwordData.username}
Temporary Password: ${passwordData.temporary_password}
Expires: ${new Date(passwordData.expires_at).toLocaleString()}

Note: You must change this password on first login.
    `.trim();

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-4" />
            <p className="text-gray-600">Retrieving your password...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-red-600 flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Error
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive">
              {error}
            </Alert>
            <p className="mt-4 text-sm text-gray-600">
              Please contact your administrator for a new password retrieval link.
            </p>
          </CardContent>
          <CardFooter>
            <Button 
              onClick={() => navigate('/login')} 
              variant="outline"
              className="w-full"
            >
              Go to Login
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5 text-blue-600" />
              Your Temporary Password
            </CardTitle>
            <Badge variant={timeRemaining === 'Expired' ? 'destructive' : 'secondary'}>
              <Clock className="h-3 w-3 mr-1" />
              {timeRemaining}
            </Badge>
          </div>
          <CardDescription>
            Save this password securely. You can only view it once.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <Alert className="bg-amber-50 border-amber-200">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <div className="ml-2">
              <p className="text-sm font-medium text-amber-800">Important</p>
              <p className="text-sm text-amber-700 mt-1">
                This password expires in 24 hours and must be changed on first login.
              </p>
            </div>
          </Alert>

          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-600 flex items-center gap-1">
                <User className="h-3 w-3" />
                Username
              </label>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-3 py-2 bg-gray-100 rounded-md font-mono text-sm">
                  {passwordData?.username || searchParams.get('username')}
                </code>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-600 flex items-center gap-1">
                <Key className="h-3 w-3" />
                Temporary Password
              </label>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-3 py-2 bg-gray-100 rounded-md font-mono text-sm select-all">
                  {passwordData?.temporary_password}
                </code>
                <Button
                  onClick={handleCopyPassword}
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                >
                  {copied ? (
                    <>
                      <CheckCircle className="h-4 w-4 mr-1 text-green-600" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-1" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
            </div>

            {passwordData?.client_salt && (
              <div className="text-xs text-gray-500 mt-2">
                <p>Security info: Client salt provided for enhanced security</p>
              </div>
            )}
          </div>

          <div className="border-t pt-4">
            <h4 className="text-sm font-medium mb-2">Next Steps:</h4>
            <ol className="space-y-2 text-sm text-gray-600">
              <li className="flex items-start">
                <span className="font-medium mr-2">1.</span>
                Copy this password (use the button above)
              </li>
              <li className="flex items-start">
                <span className="font-medium mr-2">2.</span>
                Go to the login page
              </li>
              <li className="flex items-start">
                <span className="font-medium mr-2">3.</span>
                Sign in with your username and this temporary password
              </li>
              <li className="flex items-start">
                <span className="font-medium mr-2">4.</span>
                You'll be prompted to create a new, permanent password
              </li>
            </ol>
          </div>

          <Alert>
            <CheckCircle className="h-4 w-4 text-green-600" />
            <div className="ml-2">
              <p className="text-sm font-medium">Security Tips</p>
              <ul className="text-sm text-gray-600 mt-1 space-y-1">
                <li>• Never share this password with anyone</li>
                <li>• Use a password manager to store passwords securely</li>
                <li>• Create a strong, unique password when you change it</li>
                <li>• Close this window after copying the password</li>
              </ul>
            </div>
          </Alert>
        </CardContent>

        <CardFooter className="flex gap-2">
          <Button
            onClick={handleCopyAll}
            variant="outline"
            className="flex-1"
          >
            <Copy className="h-4 w-4 mr-2" />
            Copy All Details
          </Button>
          <Button
            onClick={() => navigate('/login')}
            className="flex-1"
          >
            Go to Login
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default PasswordRetrieval;