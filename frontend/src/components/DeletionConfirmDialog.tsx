import React, { useState } from 'react';
import './DeletionConfirmDialog.css';

interface DeletionConfirmDialogProps {
  onConfirm: (reason: string) => void;
  onCancel: () => void;
  loading?: boolean;
}

export const DeletionConfirmDialog: React.FC<DeletionConfirmDialogProps> = ({
  onConfirm,
  onCancel,
  loading = false
}) => {
  const [reason, setReason] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [agreement, setAgreement] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (confirmText !== 'DELETE') {
      alert('Please type DELETE to confirm');
      return;
    }

    if (!agreement) {
      alert('Please acknowledge that you understand the consequences');
      return;
    }

    onConfirm(reason || 'User requested account deletion');
  };

  return (
    <div className="dialog-overlay">
      <div className="dialog-content">
        <h2>Confirm Account Deletion</h2>
        
        <div className="dialog-warning">
          <strong>⚠️ Warning:</strong> This action cannot be undone after 7 days.
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="reason">
              Why are you deleting your account? (Optional)
            </label>
            <select 
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="form-control"
            >
              <option value="">Select a reason...</option>
              <option value="Not using the service anymore">Not using the service anymore</option>
              <option value="Privacy concerns">Privacy concerns</option>
              <option value="Found a better alternative">Found a better alternative</option>
              <option value="Too expensive">Too expensive</option>
              <option value="Technical issues">Technical issues</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="confirmText">
              Type <strong>DELETE</strong> to confirm:
            </label>
            <input
              type="text"
              id="confirmText"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="form-control"
              placeholder="Type DELETE here"
              required
              autoComplete="off"
            />
          </div>

          <div className="form-group checkbox-group">
            <label>
              <input
                type="checkbox"
                checked={agreement}
                onChange={(e) => setAgreement(e.target.checked)}
                required
              />
              <span>
                I understand that my account will be deleted in 7 days and that I can 
                cancel this request at any time during the cooling-off period.
              </span>
            </label>
          </div>

          <div className="dialog-timeline">
            <h4>Deletion Timeline:</h4>
            <ul>
              <li>
                <strong>Immediately:</strong> Account marked for deletion, data export begins
              </li>
              <li>
                <strong>Day 1:</strong> First reminder email
              </li>
              <li>
                <strong>Day 3:</strong> Second reminder email
              </li>
              <li>
                <strong>Day 6:</strong> Final warning (24 hours before deletion)
              </li>
              <li>
                <strong>Day 7:</strong> Account and all data permanently deleted
              </li>
            </ul>
          </div>

          <div className="dialog-actions">
            <button 
              type="button"
              onClick={onCancel}
              className="btn-secondary"
              disabled={loading}
            >
              Cancel
            </button>
            <button 
              type="submit"
              className="btn-danger"
              disabled={loading || confirmText !== 'DELETE' || !agreement}
            >
              {loading ? 'Processing...' : 'Confirm Deletion'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};