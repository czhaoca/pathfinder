import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { api } from '../services/api';
import { WarningBanner } from './WarningBanner';
import { DeletionConfirmDialog } from './DeletionConfirmDialog';
import './AccountDeletion.css';

interface DeletionStatus {
  isScheduled: boolean;
  scheduledFor?: string;
  requestedAt?: string;
  canCancel?: boolean;
  type?: string;
  reason?: string;
}

export const AccountDeletion: React.FC = () => {
  const [deletionStatus, setDeletionStatus] = useState<DeletionStatus | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    checkDeletionStatus();
  }, []);

  const checkDeletionStatus = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/users/${user?.id}/deletion-status`);
      setDeletionStatus(response.data);
    } catch (err) {
      console.error('Error checking deletion status:', err);
    } finally {
      setLoading(false);
    }
  };

  const requestDeletion = async (reason: string) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await api.delete(`/users/${user?.id}`, {
        data: {
          confirmation: 'DELETE',
          reason
        }
      });

      setDeletionStatus({
        isScheduled: true,
        scheduledFor: response.data.scheduledFor,
        canCancel: response.data.canBeCancelled
      });

      // Store cancellation token
      if (response.data.cancellationToken) {
        localStorage.setItem('deletion_token', response.data.cancellationToken);
      }

      setShowConfirmDialog(false);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to request deletion');
    } finally {
      setLoading(false);
    }
  };

  const cancelDeletion = async () => {
    if (!window.confirm('Are you sure you want to cancel the deletion request?')) {
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const token = localStorage.getItem('deletion_token');
      await api.post(`/users/${user?.id}/cancel-deletion`, {
        cancellation_token: token
      });

      localStorage.removeItem('deletion_token');
      setDeletionStatus(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to cancel deletion');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading deletion status...</div>;
  }

  if (deletionStatus?.isScheduled) {
    const scheduledDate = new Date(deletionStatus.scheduledFor!);
    const now = new Date();
    const daysRemaining = Math.ceil(
      (scheduledDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    return (
      <div className="deletion-warning">
        <WarningBanner type="critical">
          <h3>⚠️ Account Scheduled for Deletion</h3>
          <div className="deletion-details">
            <p className="deletion-countdown">
              Your account will be permanently deleted in{' '}
              <span className="days-remaining">{daysRemaining}</span> days
            </p>
            <p className="deletion-date">
              Deletion date: {scheduledDate.toLocaleDateString()} at{' '}
              {scheduledDate.toLocaleTimeString()}
            </p>
            {deletionStatus.reason && (
              <p className="deletion-reason">Reason: {deletionStatus.reason}</p>
            )}
          </div>
          
          {deletionStatus.canCancel && (
            <div className="deletion-actions">
              <button 
                onClick={cancelDeletion}
                className="btn-cancel-deletion"
                disabled={loading}
              >
                Cancel Deletion Request
              </button>
            </div>
          )}

          {error && <div className="error-message">{error}</div>}
        </WarningBanner>

        <div className="deletion-info">
          <h4>What happens during the cooling-off period?</h4>
          <ul>
            <li>Your account remains fully accessible</li>
            <li>You'll receive reminder emails on days 1, 3, and 6</li>
            <li>You can cancel the deletion at any time</li>
            <li>Your data export will be prepared and sent to you</li>
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className="account-deletion">
      <div className="deletion-header">
        <h3>Delete Account</h3>
        <p className="deletion-warning">
          Once you delete your account, there is a 7-day cooling-off period before 
          your data is permanently removed.
        </p>
      </div>

      <div className="deletion-info-box">
        <h4>Before you go...</h4>
        <ul>
          <li>You'll have 7 days to change your mind</li>
          <li>We'll export all your data for you to keep</li>
          <li>You can cancel the deletion at any time during the cooling-off period</li>
          <li>After 7 days, your data will be permanently deleted</li>
        </ul>
      </div>

      <div className="deletion-consequences">
        <h4>What will be deleted?</h4>
        <ul>
          <li>Your profile and account information</li>
          <li>All your experiences and career data</li>
          <li>Your preferences and settings</li>
          <li>Session history and activity logs</li>
          <li>Any custom data you've created</li>
        </ul>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="deletion-action">
        <button 
          onClick={() => setShowConfirmDialog(true)}
          className="btn-danger"
          disabled={loading}
        >
          Delete My Account
        </button>
      </div>

      {showConfirmDialog && (
        <DeletionConfirmDialog
          onConfirm={requestDeletion}
          onCancel={() => setShowConfirmDialog(false)}
          loading={loading}
        />
      )}
    </div>
  );
};