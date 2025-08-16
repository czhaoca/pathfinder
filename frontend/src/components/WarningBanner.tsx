import React from 'react';
import './WarningBanner.css';

interface WarningBannerProps {
  type?: 'warning' | 'critical' | 'info' | 'success';
  children: React.ReactNode;
  dismissible?: boolean;
  onDismiss?: () => void;
}

export const WarningBanner: React.FC<WarningBannerProps> = ({
  type = 'warning',
  children,
  dismissible = false,
  onDismiss
}) => {
  return (
    <div className={`warning-banner warning-banner-${type}`}>
      <div className="warning-banner-content">
        {children}
      </div>
      {dismissible && (
        <button 
          className="warning-banner-dismiss"
          onClick={onDismiss}
          aria-label="Dismiss"
        >
          ×
        </button>
      )}
    </div>
  );
};