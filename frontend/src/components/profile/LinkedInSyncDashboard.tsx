/**
 * LinkedIn Sync Dashboard Component
 * Manages LinkedIn profile synchronization and settings
 */

import React, { useState, useEffect } from 'react';
import { linkedInService } from '../../services/linkedInService';
import { useAuthStore } from '../../stores/authStore';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Switch } from '../ui/Switch';
import { Select } from '../ui/Select';
import { Spinner } from '../ui/Spinner';
import { Alert } from '../ui/Alert';
import { ProgressBar } from '../ui/ProgressBar';
import { useToast } from '../../hooks/useToast';
import { formatDistanceToNow } from 'date-fns';

interface SyncStatus {
  lastSyncAt: Date | null;
  syncEnabled: boolean;
  syncInterval: number;
  nextSyncAt: Date | null;
  syncHistory?: SyncHistoryItem[];
}

interface SyncHistoryItem {
  syncedAt: Date;
  status: 'success' | 'failed';
  changes?: {
    workExperience?: number;
    education?: number;
    skills?: number;
    certifications?: number;
  };
  error?: string;
}

interface LinkedInSyncDashboardProps {
  showHistory?: boolean;
  onSyncComplete?: (result: any) => void;
}

export const LinkedInSyncDashboard: React.FC<LinkedInSyncDashboardProps> = ({
  showHistory = false,
  onSyncComplete
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [syncResult, setSyncResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [showOptions, setShowOptions] = useState(false);

  const { user } = useAuthStore();
  const { showToast } = useToast();

  useEffect(() => {
    loadSyncStatus();
  }, []);

  const loadSyncStatus = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const status = await linkedInService.getSyncStatus();
      setSyncStatus(status);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load sync status';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSync = async (force = false) => {
    setIsSyncing(true);
    setError(null);
    setSyncResult(null);

    try {
      const result = await linkedInService.syncProfile(force);
      setSyncResult(result);
      
      if (result.synced) {
        showToast({
          type: 'success',
          message: 'Profile synced successfully'
        });
        
        // Update sync status
        setSyncStatus(prev => prev ? {
          ...prev,
          lastSyncAt: result.lastSyncAt || new Date()
        } : null);
        
        if (onSyncComplete) {
          onSyncComplete(result);
        }
      } else {
        showToast({
          type: 'info',
          message: result.message || 'Profile recently synced'
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Sync failed';
      setError(errorMessage);
      showToast({
        type: 'error',
        message: errorMessage
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleAutoSyncToggle = async (enabled: boolean) => {
    try {
      await linkedInService.updateSyncSettings({ syncEnabled: enabled });
      setSyncStatus(prev => prev ? { ...prev, syncEnabled: enabled } : null);
      
      showToast({
        type: 'success',
        message: `Auto-sync ${enabled ? 'enabled' : 'disabled'}`
      });
    } catch (err) {
      showToast({
        type: 'error',
        message: 'Failed to update sync settings'
      });
    }
  };

  const handleIntervalChange = async (interval: string) => {
    const intervalMs = parseInt(interval);
    
    try {
      await linkedInService.updateSyncSettings({ syncInterval: intervalMs });
      setSyncStatus(prev => prev ? { 
        ...prev, 
        syncInterval: intervalMs,
        nextSyncAt: prev.lastSyncAt ? 
          new Date(prev.lastSyncAt.getTime() + intervalMs) : null
      } : null);
      
      showToast({
        type: 'success',
        message: 'Sync interval updated'
      });
    } catch (err) {
      showToast({
        type: 'error',
        message: 'Failed to update sync interval'
      });
    }
  };

  const renderSyncHistory = () => {
    if (!showHistory || !syncStatus?.syncHistory || syncStatus.syncHistory.length === 0) {
      return null;
    }

    return (
      <div className="sync-dashboard__history">
        <h3>Sync History</h3>
        <div className="sync-dashboard__history-list">
          {syncStatus.syncHistory.map((item, index) => (
            <Card key={index} className="sync-dashboard__history-item">
              <div className="sync-dashboard__history-header">
                <span className={`sync-dashboard__history-status sync-dashboard__history-status--${item.status}`}>
                  {item.status === 'success' ? '✓' : '✗'}
                </span>
                <span className="sync-dashboard__history-date">
                  {formatDistanceToNow(new Date(item.syncedAt), { addSuffix: true })}
                </span>
              </div>
              
              {item.status === 'success' && item.changes && (
                <div className="sync-dashboard__history-changes">
                  {Object.entries(item.changes).map(([key, value]) => (
                    value > 0 && (
                      <span key={key} className="sync-dashboard__history-change">
                        {value} {key.replace(/([A-Z])/g, ' $1').toLowerCase()}
                      </span>
                    )
                  ))}
                </div>
              )}
              
              {item.status === 'failed' && item.error && (
                <div className="sync-dashboard__history-error">
                  {item.error}
                </div>
              )}
            </Card>
          ))}
        </div>
      </div>
    );
  };

  const renderSyncResult = () => {
    if (!syncResult || !syncResult.synced) {
      return null;
    }

    return (
      <Alert type="success" className="sync-dashboard__result">
        <h4>Sync Completed</h4>
        {syncResult.changes && (
          <ul>
            {syncResult.changes.workExperience && (
              <li>
                Work Experience: {syncResult.changes.workExperience.added} added,
                {syncResult.changes.workExperience.updated} updated
              </li>
            )}
            {syncResult.changes.skills && (
              <li>
                Skills: {syncResult.changes.skills.added} added
              </li>
            )}
          </ul>
        )}
      </Alert>
    );
  };

  if (isLoading) {
    return (
      <Card className="sync-dashboard sync-dashboard--loading">
        <Spinner />
        <p>Loading sync status...</p>
      </Card>
    );
  }

  if (error && !syncStatus) {
    return (
      <Card className="sync-dashboard sync-dashboard--error">
        <Alert type="error" className="alert--error">
          {error}
        </Alert>
        <Button onClick={loadSyncStatus}>Retry</Button>
      </Card>
    );
  }

  return (
    <Card className="sync-dashboard">
      <div className="sync-dashboard__header">
        <h2>LinkedIn Sync</h2>
        <Button
          variant="text"
          size="small"
          onClick={() => setShowOptions(!showOptions)}
          aria-label="Sync options"
        >
          ⚙️
        </Button>
      </div>

      {syncStatus && (
        <div className="sync-dashboard__status">
          <div className="sync-dashboard__status-item">
            <span className="sync-dashboard__label">Last synced:</span>
            <span className="sync-dashboard__value">
              {syncStatus.lastSyncAt ? 
                formatDistanceToNow(new Date(syncStatus.lastSyncAt), { addSuffix: true }) : 
                'Never'
              }
            </span>
          </div>
          
          {syncStatus.nextSyncAt && (
            <div className="sync-dashboard__status-item">
              <span className="sync-dashboard__label">Next sync:</span>
              <span className="sync-dashboard__value">
                {formatDistanceToNow(new Date(syncStatus.nextSyncAt), { addSuffix: true })}
              </span>
            </div>
          )}
          
          <div className="sync-dashboard__status-item">
            <span className="sync-dashboard__label">Auto-sync:</span>
            <Switch
              checked={syncStatus.syncEnabled}
              onChange={handleAutoSyncToggle}
              aria-label="Auto-sync"
            />
            <span className="sync-dashboard__value">
              {syncStatus.syncEnabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>
        </div>
      )}

      {showOptions && syncStatus && (
        <div className="sync-dashboard__options">
          <div className="sync-dashboard__option">
            <label htmlFor="sync-interval">Sync Interval:</label>
            <Select
              id="sync-interval"
              value={syncStatus.syncInterval.toString()}
              onChange={(e) => handleIntervalChange(e.target.value)}
              aria-label="Sync interval"
            >
              <option value="3600000">Every hour</option>
              <option value="21600000">Every 6 hours</option>
              <option value="43200000">Every 12 hours</option>
              <option value="86400000">Daily</option>
              <option value="604800000">Weekly</option>
              <option value="2592000000">Monthly</option>
            </Select>
          </div>
        </div>
      )}

      {isSyncing && (
        <div className="sync-dashboard__progress">
          <ProgressBar indeterminate />
          <p>Syncing...</p>
        </div>
      )}

      {error && (
        <Alert type="error" className="alert--error">
          {error}
        </Alert>
      )}

      {renderSyncResult()}

      <div className="sync-dashboard__actions">
        <Button
          variant="primary"
          onClick={() => handleSync(false)}
          disabled={isSyncing}
        >
          {isSyncing ? 'Syncing...' : 'Sync Now'}
        </Button>
        
        <div className="sync-dashboard__dropdown">
          <Button
            variant="text"
            size="small"
            onClick={() => setShowOptions(!showOptions)}
            role="button"
            aria-haspopup="true"
            aria-expanded={showOptions}
          >
            ▼
          </Button>
          
          {showOptions && (
            <div className="sync-dashboard__dropdown-menu" role="menu">
              <button
                className="sync-dashboard__dropdown-item"
                onClick={() => handleSync(true)}
                disabled={isSyncing}
                role="menuitem"
              >
                Force Sync
              </button>
            </div>
          )}
        </div>
      </div>

      {renderSyncHistory()}
    </Card>
  );
};

// Mobile-optimized variant
export const LinkedInSyncDashboardMobile: React.FC<LinkedInSyncDashboardProps> = (props) => {
  return (
    <div className="sync-dashboard--mobile">
      <LinkedInSyncDashboard {...props} />
    </div>
  );
};