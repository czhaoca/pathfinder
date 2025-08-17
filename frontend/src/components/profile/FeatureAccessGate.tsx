/**
 * Feature Access Gate Component
 * Controls access to features based on profile completeness
 */

import React, { useEffect, useState } from 'react';
import { useProfileStore } from '../../stores/profileStore';
import { ProgressiveProfileForm } from './ProgressiveProfileForm';
import './FeatureAccessGate.css';

interface ProfileField {
  fieldId: string;
  fieldName: string;
  fieldLabel: string;
  fieldType: string;
  validationRules?: any;
  options?: Array<{ value: string; label: string }>;
  helpText?: string;
  placeholder?: string;
  customMessage?: string;
}

interface FeatureAccessInfo {
  canAccess: boolean;
  missingRequired: ProfileField[];
  missingRecommended: ProfileField[];
  completionPercentage: number;
  totalRequired: number;
  completedRequired: number;
}

interface Props {
  featureKey: string;
  featureName?: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showRecommended?: boolean;
  allowSkip?: boolean;
  onAccessGranted?: () => void;
  onAccessDenied?: () => void;
}

export const FeatureAccessGate: React.FC<Props> = ({
  featureKey,
  featureName,
  children,
  fallback,
  showRecommended = false,
  allowSkip = false,
  onAccessGranted,
  onAccessDenied
}) => {
  const [accessInfo, setAccessInfo] = useState<FeatureAccessInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [showProfileForm, setShowProfileForm] = useState(false);
  const [bypassGate, setBypassGate] = useState(false);
  
  const { checkFeatureAccess } = useProfileStore();

  useEffect(() => {
    checkAccess();
  }, [featureKey]);

  const checkAccess = async () => {
    try {
      setLoading(true);
      const info = await checkFeatureAccess(featureKey);
      setAccessInfo(info);

      if (info.canAccess) {
        onAccessGranted?.();
      } else {
        onAccessDenied?.();
      }
    } catch (error) {
      console.error('Failed to check feature access:', error);
      // On error, allow access but log the issue
      setAccessInfo({ 
        canAccess: true, 
        missingRequired: [], 
        missingRecommended: [],
        completionPercentage: 100,
        totalRequired: 0,
        completedRequired: 0
      });
    } finally {
      setLoading(false);
    }
  };

  const handleProfileComplete = async (data: any) => {
    // Re-check access after profile update
    await checkAccess();
    setShowProfileForm(false);
    
    if (accessInfo?.canAccess) {
      onAccessGranted?.();
    }
  };

  const handleSkip = () => {
    if (allowSkip) {
      setBypassGate(true);
      setShowProfileForm(false);
    }
  };

  const handleStartProfileUpdate = () => {
    setShowProfileForm(true);
  };

  // Loading state
  if (loading) {
    return (
      <div className="feature-access-gate loading">
        <div className="loading-spinner" />
        <p>Checking access requirements...</p>
      </div>
    );
  }

  // Access granted or bypassed
  if (accessInfo?.canAccess || bypassGate) {
    return <>{children}</>;
  }

  // Show profile form
  if (showProfileForm && accessInfo) {
    const fieldsToCollect = showRecommended 
      ? [...accessInfo.missingRequired, ...accessInfo.missingRecommended]
      : accessInfo.missingRequired;

    return (
      <div className="feature-access-gate profile-collection">
        <ProgressiveProfileForm
          requiredFields={fieldsToCollect}
          onComplete={handleProfileComplete}
          onSkip={allowSkip ? handleSkip : undefined}
          featureKey={featureKey}
          mode="modal"
        />
      </div>
    );
  }

  // Show access denied UI
  if (fallback) {
    return <>{fallback}</>;
  }

  return (
    <div className="feature-access-gate denied">
      <div className="access-denied-card">
        <div className="icon-container">
          <svg className="lock-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0110 0v4" />
          </svg>
        </div>

        <h2>Complete Your Profile to Access {featureName || 'This Feature'}</h2>
        
        <p className="description">
          This feature requires additional profile information to provide you with the best experience.
        </p>

        <div className="progress-info">
          <div className="progress-stat">
            <span className="stat-value">{accessInfo?.completionPercentage || 0}%</span>
            <span className="stat-label">Complete</span>
          </div>
          <div className="progress-stat">
            <span className="stat-value">
              {accessInfo?.completedRequired || 0}/{accessInfo?.totalRequired || 0}
            </span>
            <span className="stat-label">Required Fields</span>
          </div>
        </div>

        {accessInfo && accessInfo.missingRequired.length > 0 && (
          <div className="missing-fields">
            <h3>Required Information:</h3>
            <ul className="fields-list">
              {accessInfo.missingRequired.slice(0, 5).map(field => (
                <li key={field.fieldId}>
                  <span className="field-icon">•</span>
                  {field.customMessage || field.fieldLabel}
                </li>
              ))}
              {accessInfo.missingRequired.length > 5 && (
                <li className="more-fields">
                  <span className="field-icon">•</span>
                  And {accessInfo.missingRequired.length - 5} more...
                </li>
              )}
            </ul>
          </div>
        )}

        {showRecommended && accessInfo && accessInfo.missingRecommended.length > 0 && (
          <div className="recommended-fields">
            <h3>Recommended Information:</h3>
            <ul className="fields-list recommended">
              {accessInfo.missingRecommended.slice(0, 3).map(field => (
                <li key={field.fieldId}>
                  <span className="field-icon">○</span>
                  {field.fieldLabel}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="actions">
          <button 
            className="btn btn-primary"
            onClick={handleStartProfileUpdate}
          >
            Complete Profile Now
          </button>
          
          {allowSkip && (
            <button 
              className="btn btn-link"
              onClick={handleSkip}
            >
              Skip for now (limited access)
            </button>
          )}
        </div>

        <div className="benefits">
          <h4>Why we need this information:</h4>
          <ul>
            <li>Personalized recommendations</li>
            <li>Better matching algorithms</li>
            <li>Enhanced security</li>
            <li>Improved user experience</li>
          </ul>
        </div>
      </div>
    </div>
  );
};