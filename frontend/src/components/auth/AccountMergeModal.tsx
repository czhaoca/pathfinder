/**
 * Account Merge Modal Component
 * Handles merging LinkedIn account with existing local account
 */

import React, { useState } from 'react';
import { linkedInService } from '../../services/linkedInService';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Alert } from '../ui/Alert';
import { useToast } from '../../hooks/useToast';
import { useAuthStore } from '../../stores/authStore';

interface AccountMergeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  existingEmail?: string;
  linkedInEmail?: string;
  linkedInAuthCode?: string;
}

export const AccountMergeModal: React.FC<AccountMergeModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  existingEmail,
  linkedInEmail,
  linkedInAuthCode
}) => {
  const [password, setPassword] = useState('');
  const [isMerging, setIsMerging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mergeSuccess, setMergeSuccess] = useState(false);

  const { showToast } = useToast();
  const { refreshUser } = useAuthStore();

  const handleMerge = async () => {
    if (!password) {
      setError('Password is required');
      return;
    }

    setIsMerging(true);
    setError(null);

    try {
      const result = await linkedInService.mergeAccounts(
        password,
        linkedInAuthCode || ''
      );

      if (result.success) {
        setMergeSuccess(true);
        showToast({
          type: 'success',
          message: 'Accounts successfully merged'
        });

        // Refresh user data
        await refreshUser();

        // Call success callback
        if (onSuccess) {
          onSuccess();
        }

        // Close modal after a short delay
        setTimeout(() => {
          onClose();
        }, 2000);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to merge accounts';
      setError(errorMessage);
      showToast({
        type: 'error',
        message: errorMessage
      });
    } finally {
      setIsMerging(false);
    }
  };

  const handleCancel = () => {
    setPassword('');
    setError(null);
    setMergeSuccess(false);
    onClose();
  };

  if (mergeSuccess) {
    return (
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Account Merge Successful"
        className="account-merge-modal account-merge-modal--success"
      >
        <div className="account-merge-modal__content">
          <Alert type="success">
            <p>Your LinkedIn account has been successfully linked!</p>
            <p>You can now sign in with either your password or LinkedIn.</p>
          </Alert>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleCancel}
      title="Link LinkedIn Account"
      className="account-merge-modal"
    >
      <div className="account-merge-modal__content">
        <Alert type="info">
          <p>An account already exists with this email address.</p>
          {existingEmail && (
            <p className="account-merge-modal__email">
              Existing account: <strong>{existingEmail}</strong>
            </p>
          )}
          {linkedInEmail && linkedInEmail !== existingEmail && (
            <p className="account-merge-modal__email">
              LinkedIn email: <strong>{linkedInEmail}</strong>
            </p>
          )}
          <p>Enter your password to link your LinkedIn account.</p>
        </Alert>

        <form onSubmit={(e) => { e.preventDefault(); handleMerge(); }}>
          <div className="account-merge-modal__form">
            <Input
              type="password"
              label="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              autoFocus
              disabled={isMerging}
              aria-label="Password"
            />

            {error && (
              <Alert type="error" className="alert--error">
                {error}
              </Alert>
            )}
          </div>

          <div className="account-merge-modal__actions">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={isMerging}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={!password || isMerging}
            >
              {isMerging ? 'Merging...' : 'Merge Accounts'}
            </Button>
          </div>
        </form>

        <div className="account-merge-modal__info">
          <p className="account-merge-modal__note">
            <strong>Note:</strong> After merging, you'll be able to:
          </p>
          <ul>
            <li>Sign in with LinkedIn</li>
            <li>Import your LinkedIn profile data</li>
            <li>Keep your profile synchronized</li>
            <li>Use either authentication method</li>
          </ul>
        </div>
      </div>
    </Modal>
  );
};

// Mobile-optimized variant
export const AccountMergeModalMobile: React.FC<AccountMergeModalProps> = (props) => {
  return (
    <AccountMergeModal
      {...props}
      className="account-merge-modal--mobile"
    />
  );
};