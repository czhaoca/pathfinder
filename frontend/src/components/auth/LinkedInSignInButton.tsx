/**
 * LinkedIn Sign-In Button Component
 * Handles LinkedIn OAuth authentication flow
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { linkedInService } from '../../services/linkedInService';
import { useAuthStore } from '../../stores/authStore';
import { LinkedInIcon } from '../icons/LinkedInIcon';
import { Button } from '../ui/Button';
import { useToast } from '../../hooks/useToast';

interface LinkedInSignInButtonProps {
  className?: string;
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'small' | 'medium' | 'large';
  returnUrl?: string;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

export const LinkedInSignInButton: React.FC<LinkedInSignInButtonProps> = ({
  className = '',
  variant = 'primary',
  size = 'medium',
  returnUrl = '/',
  onSuccess,
  onError
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { user } = useAuthStore();

  const handleLinkedInSignIn = async () => {
    setIsLoading(true);

    try {
      // Generate OAuth URL
      const { authUrl } = await linkedInService.generateAuthUrl(returnUrl);
      
      // Store return URL in session storage for callback
      sessionStorage.setItem('linkedin_return_url', returnUrl);
      
      // Redirect to LinkedIn OAuth
      window.location.href = authUrl;
      
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error('LinkedIn sign-in error:', error);
      setIsLoading(false);
      
      const errorMessage = error instanceof Error ? error.message : 'LinkedIn sign-in failed';
      showToast({
        type: 'error',
        message: errorMessage
      });
      
      if (onError) {
        onError(error as Error);
      }
    }
  };

  const getButtonText = () => {
    if (isLoading) {
      return 'Connecting...';
    }
    return user ? 'Link LinkedIn Account' : 'Sign in with LinkedIn';
  };

  return (
    <Button
      className={`linkedin-signin-button linkedin-signin-button--${variant} ${className}`}
      onClick={handleLinkedInSignIn}
      disabled={isLoading}
      size={size}
      variant={variant}
      aria-label="Sign in with LinkedIn"
    >
      <LinkedInIcon className="linkedin-signin-button__icon" />
      <span className="linkedin-signin-button__text">
        {getButtonText()}
      </span>
    </Button>
  );
};

// Mobile-optimized variant
export const LinkedInSignInButtonMobile: React.FC<LinkedInSignInButtonProps> = (props) => {
  return (
    <LinkedInSignInButton
      {...props}
      className={`linkedin-signin-button--mobile ${props.className || ''}`}
      size="large"
    />
  );
};