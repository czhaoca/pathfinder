/**
 * Account Merge Page
 * Handles OAuth account merging when email already exists
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { GoogleAccountMerge } from '@/components/auth/GoogleSignIn';
import { toast } from 'sonner';

export default function MergeAccount() {
  const navigate = useNavigate();

  const handleSuccess = () => {
    toast.success('Google account successfully linked!');
    navigate('/dashboard');
  };

  const handleCancel = () => {
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center">Link Your Account</CardTitle>
        </CardHeader>
        <CardContent>
          <GoogleAccountMerge 
            onSuccess={handleSuccess}
            onCancel={handleCancel}
          />
        </CardContent>
      </Card>
    </div>
  );
}