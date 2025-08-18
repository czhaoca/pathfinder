import React, { useState, useEffect } from 'react';
import { adminService } from '../../services/admin.service';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { ErrorMessage } from '../common/ErrorMessage';
import { toast } from 'react-toastify';
import './SecuritySettings.css';

interface PasswordPolicy {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  maxAge: number;
}

interface SessionPolicy {
  timeout: number;
  maxConcurrent: number;
  requireMFA: boolean;
}

interface RateLimitSettings {
  [endpoint: string]: {
    attempts: number;
    window: number;
  };
}

interface SecurityPolicies {
  passwordPolicy: PasswordPolicy;
  sessionPolicy: SessionPolicy;
  rateLimiting: RateLimitSettings;
}

export const SecuritySettings: React.FC = () => {
  const [policies, setPolicies] = useState<SecurityPolicies | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<any>({});

  useEffect(() => {
    loadSecuritySettings();
  }, []);

  const loadSecuritySettings = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await adminService.getSecuritySettings();
      setPolicies(data);
    } catch (err) {
      setError('Failed to load security settings');
      console.error('Error loading security settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePasswordPolicy = async () => {
    const reason = prompt('Reason for updating password policy:');
    if (!reason) return;

    try {
      await adminService.updateSecurityPolicy('password', editValues.passwordPolicy, reason);
      toast.success('Password policy updated successfully');
      setEditingSection(null);
      await loadSecuritySettings();
    } catch (err) {
      toast.error('Failed to update password policy');
      console.error('Error updating password policy:', err);
    }
  };

  const handleUpdateSessionPolicy = async () => {
    const reason = prompt('Reason for updating session policy:');
    if (!reason) return;

    try {
      await adminService.updateSecurityPolicy('session', editValues.sessionPolicy, reason);
      toast.success('Session policy updated successfully');
      setEditingSection(null);
      await loadSecuritySettings();
    } catch (err) {
      toast.error('Failed to update session policy');
      console.error('Error updating session policy:', err);
    }
  };

  const handleUpdateRateLimit = async (endpoint: string) => {
    const reason = prompt(`Reason for updating rate limit for ${endpoint}:`);
    if (!reason) return;

    try {
      await adminService.updateRateLimits(
        endpoint,
        editValues.rateLimiting[endpoint],
        reason
      );
      toast.success('Rate limit updated successfully');
      setEditingSection(null);
      await loadSecuritySettings();
    } catch (err) {
      toast.error('Failed to update rate limit');
      console.error('Error updating rate limit:', err);
    }
  };

  const startEditingPasswordPolicy = () => {
    setEditingSection('password');
    setEditValues({
      ...editValues,
      passwordPolicy: { ...policies?.passwordPolicy }
    });
  };

  const startEditingSessionPolicy = () => {
    setEditingSection('session');
    setEditValues({
      ...editValues,
      sessionPolicy: { ...policies?.sessionPolicy }
    });
  };

  const startEditingRateLimit = (endpoint: string) => {
    setEditingSection(`rate-${endpoint}`);
    setEditValues({
      ...editValues,
      rateLimiting: {
        ...editValues.rateLimiting,
        [endpoint]: { ...policies?.rateLimiting[endpoint] }
      }
    });
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (error || !policies) {
    return <ErrorMessage message={error || 'No security settings available'} />;
  }

  return (
    <div className="security-settings">
      <div className="settings-header">
        <h2>Security Settings</h2>
        <p className="settings-description">
          Configure security policies and rate limiting for your application
        </p>
      </div>

      {/* Password Policy */}
      <div className="settings-section">
        <div className="section-header">
          <h3>Password Policy</h3>
          {editingSection !== 'password' && (
            <button
              onClick={startEditingPasswordPolicy}
              className="btn btn-secondary btn-sm"
            >
              Edit
            </button>
          )}
        </div>

        {editingSection === 'password' ? (
          <div className="policy-editor">
            <div className="form-group">
              <label>Minimum Length</label>
              <input
                type="number"
                value={editValues.passwordPolicy.minLength}
                onChange={(e) => setEditValues({
                  ...editValues,
                  passwordPolicy: {
                    ...editValues.passwordPolicy,
                    minLength: parseInt(e.target.value)
                  }
                })}
                min="6"
                max="32"
                className="form-input"
                aria-label="Minimum Length"
              />
            </div>

            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={editValues.passwordPolicy.requireUppercase}
                  onChange={(e) => setEditValues({
                    ...editValues,
                    passwordPolicy: {
                      ...editValues.passwordPolicy,
                      requireUppercase: e.target.checked
                    }
                  })}
                />
                Require Uppercase Letters
              </label>
            </div>

            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={editValues.passwordPolicy.requireLowercase}
                  onChange={(e) => setEditValues({
                    ...editValues,
                    passwordPolicy: {
                      ...editValues.passwordPolicy,
                      requireLowercase: e.target.checked
                    }
                  })}
                />
                Require Lowercase Letters
              </label>
            </div>

            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={editValues.passwordPolicy.requireNumbers}
                  onChange={(e) => setEditValues({
                    ...editValues,
                    passwordPolicy: {
                      ...editValues.passwordPolicy,
                      requireNumbers: e.target.checked
                    }
                  })}
                />
                Require Numbers
              </label>
            </div>

            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={editValues.passwordPolicy.requireSpecialChars}
                  onChange={(e) => setEditValues({
                    ...editValues,
                    passwordPolicy: {
                      ...editValues.passwordPolicy,
                      requireSpecialChars: e.target.checked
                    }
                  })}
                />
                Require Special Characters
              </label>
            </div>

            <div className="form-group">
              <label>Maximum Age (days)</label>
              <input
                type="number"
                value={editValues.passwordPolicy.maxAge}
                onChange={(e) => setEditValues({
                  ...editValues,
                  passwordPolicy: {
                    ...editValues.passwordPolicy,
                    maxAge: parseInt(e.target.value)
                  }
                })}
                min="0"
                max="365"
                className="form-input"
              />
            </div>

            <div className="editor-actions">
              <button
                onClick={handleUpdatePasswordPolicy}
                className="btn btn-primary"
              >
                Save Changes
              </button>
              <button
                onClick={() => setEditingSection(null)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="policy-display">
            <div className="policy-item">
              <span className="policy-label">Minimum Length:</span>
              <span className="policy-value">{policies.passwordPolicy.minLength}</span>
            </div>
            <div className="policy-item">
              <span className="policy-label">Require Uppercase:</span>
              <span className="policy-value">
                {policies.passwordPolicy.requireUppercase ? 'Yes' : 'No'}
              </span>
            </div>
            <div className="policy-item">
              <span className="policy-label">Require Lowercase:</span>
              <span className="policy-value">
                {policies.passwordPolicy.requireLowercase ? 'Yes' : 'No'}
              </span>
            </div>
            <div className="policy-item">
              <span className="policy-label">Require Numbers:</span>
              <span className="policy-value">
                {policies.passwordPolicy.requireNumbers ? 'Yes' : 'No'}
              </span>
            </div>
            <div className="policy-item">
              <span className="policy-label">Require Special Characters:</span>
              <span className="policy-value">
                {policies.passwordPolicy.requireSpecialChars ? 'Yes' : 'No'}
              </span>
            </div>
            <div className="policy-item">
              <span className="policy-label">Maximum Age:</span>
              <span className="policy-value">
                {policies.passwordPolicy.maxAge > 0
                  ? `${policies.passwordPolicy.maxAge} days`
                  : 'No expiration'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Session Policy */}
      <div className="settings-section">
        <div className="section-header">
          <h3>Session Policy</h3>
          {editingSection !== 'session' && (
            <button
              onClick={startEditingSessionPolicy}
              className="btn btn-secondary btn-sm"
            >
              Edit
            </button>
          )}
        </div>

        {editingSection === 'session' ? (
          <div className="policy-editor">
            <div className="form-group">
              <label>Session Timeout (seconds)</label>
              <input
                type="number"
                value={editValues.sessionPolicy.timeout}
                onChange={(e) => setEditValues({
                  ...editValues,
                  sessionPolicy: {
                    ...editValues.sessionPolicy,
                    timeout: parseInt(e.target.value)
                  }
                })}
                min="300"
                max="86400"
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label>Max Concurrent Sessions</label>
              <input
                type="number"
                value={editValues.sessionPolicy.maxConcurrent}
                onChange={(e) => setEditValues({
                  ...editValues,
                  sessionPolicy: {
                    ...editValues.sessionPolicy,
                    maxConcurrent: parseInt(e.target.value)
                  }
                })}
                min="1"
                max="10"
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={editValues.sessionPolicy.requireMFA}
                  onChange={(e) => setEditValues({
                    ...editValues,
                    sessionPolicy: {
                      ...editValues.sessionPolicy,
                      requireMFA: e.target.checked
                    }
                  })}
                />
                Require Multi-Factor Authentication
              </label>
            </div>

            <div className="editor-actions">
              <button
                onClick={handleUpdateSessionPolicy}
                className="btn btn-primary"
              >
                Save Changes
              </button>
              <button
                onClick={() => setEditingSection(null)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="policy-display">
            <div className="policy-item">
              <span className="policy-label">Session Timeout:</span>
              <span className="policy-value">
                {Math.floor(policies.sessionPolicy.timeout / 60)} minutes
              </span>
            </div>
            <div className="policy-item">
              <span className="policy-label">Max Concurrent Sessions:</span>
              <span className="policy-value">{policies.sessionPolicy.maxConcurrent}</span>
            </div>
            <div className="policy-item">
              <span className="policy-label">Require MFA:</span>
              <span className="policy-value">
                {policies.sessionPolicy.requireMFA ? 'Yes' : 'No'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Rate Limiting */}
      <div className="settings-section">
        <h3>Rate Limiting</h3>
        <div className="rate-limits-grid">
          {Object.entries(policies.rateLimiting).map(([endpoint, limits]) => (
            <div key={endpoint} className="rate-limit-card">
              <div className="rate-limit-header">
                <h4>{endpoint}</h4>
                {editingSection !== `rate-${endpoint}` && (
                  <button
                    onClick={() => startEditingRateLimit(endpoint)}
                    className="btn btn-secondary btn-sm"
                    data-testid={`edit-rate-limit-${endpoint}`}
                  >
                    Edit
                  </button>
                )}
              </div>

              {editingSection === `rate-${endpoint}` ? (
                <div className="rate-limit-editor">
                  <div className="form-group">
                    <label>Max Attempts</label>
                    <input
                      type="number"
                      value={editValues.rateLimiting[endpoint].attempts}
                      onChange={(e) => setEditValues({
                        ...editValues,
                        rateLimiting: {
                          ...editValues.rateLimiting,
                          [endpoint]: {
                            ...editValues.rateLimiting[endpoint],
                            attempts: parseInt(e.target.value)
                          }
                        }
                      })}
                      min="1"
                      max="1000"
                      className="form-input"
                      aria-label="Max Attempts"
                    />
                  </div>

                  <div className="form-group">
                    <label>Time Window (seconds)</label>
                    <input
                      type="number"
                      value={editValues.rateLimiting[endpoint].window}
                      onChange={(e) => setEditValues({
                        ...editValues,
                        rateLimiting: {
                          ...editValues.rateLimiting,
                          [endpoint]: {
                            ...editValues.rateLimiting[endpoint],
                            window: parseInt(e.target.value)
                          }
                        }
                      })}
                      min="1"
                      max="86400"
                      className="form-input"
                      aria-label="Time Window (seconds)"
                    />
                  </div>

                  <div className="editor-actions">
                    <button
                      onClick={() => handleUpdateRateLimit(endpoint)}
                      className="btn btn-primary btn-sm"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingSection(null)}
                      className="btn btn-secondary btn-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="rate-limit-display">
                  <div className="rate-limit-info">
                    <span className="rate-limit-value">{limits.attempts}</span>
                    <span className="rate-limit-label">attempts</span>
                  </div>
                  <div className="rate-limit-info">
                    <span className="rate-limit-value">{limits.window}s</span>
                    <span className="rate-limit-label">window</span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Additional Security Features */}
      <div className="settings-section">
        <h3>Additional Security Features</h3>
        <div className="security-features">
          <div className="feature-card">
            <h4>CAPTCHA Settings</h4>
            <p>Configure CAPTCHA for forms and authentication</p>
            <button className="btn btn-secondary">Configure</button>
          </div>
          <div className="feature-card">
            <h4>IP Allowlist/Blocklist</h4>
            <p>Manage IP-based access controls</p>
            <button className="btn btn-secondary">Manage</button>
          </div>
          <div className="feature-card">
            <h4>Security Headers</h4>
            <p>Configure HTTP security headers</p>
            <button className="btn btn-secondary">Configure</button>
          </div>
          <div className="feature-card">
            <h4>Backup & Recovery</h4>
            <p>Manage system backups and recovery procedures</p>
            <button className="btn btn-secondary">Manage</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SecuritySettings;