import React from 'react';
import { AlertTriangle, AlertCircle, Info, XCircle, CheckCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface SecurityAlert {
  id: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  timestamp: Date;
  resolved: boolean;
}

interface SecurityAlertsProps {
  alerts: SecurityAlert[];
  canDismiss: boolean;
  onDismiss?: (id: string) => void;
}

export const SecurityAlerts: React.FC<SecurityAlertsProps> = ({
  alerts,
  canDismiss,
  onDismiss
}) => {
  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <XCircle className="h-5 w-5 text-red-600" />;
      case 'error':
        return <AlertTriangle className="h-5 w-5 text-red-500" />;
      case 'warning':
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      case 'info':
        return <Info className="h-5 w-5 text-blue-500" />;
      default:
        return <Info className="h-5 w-5 text-gray-500" />;
    }
  };
  
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'border-red-200 bg-red-50';
      case 'error':
        return 'border-red-200 bg-red-50';
      case 'warning':
        return 'border-yellow-200 bg-yellow-50';
      case 'info':
        return 'border-blue-200 bg-blue-50';
      default:
        return 'border-gray-200 bg-gray-50';
    }
  };
  
  const activeAlerts = alerts.filter(a => !a.resolved);
  
  if (activeAlerts.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-gray-500">
        <CheckCircle className="h-6 w-6 mr-2 text-green-500" />
        <span>No active security alerts</span>
      </div>
    );
  }
  
  return (
    <div className="space-y-3">
      {activeAlerts.map(alert => (
        <div
          key={alert.id}
          className={`border rounded-lg p-4 ${getSeverityColor(alert.severity)}`}
        >
          <div className="flex items-start">
            <div className="flex-shrink-0 mt-0.5">
              {getSeverityIcon(alert.severity)}
            </div>
            <div className="ml-3 flex-1">
              <p className="text-sm font-medium text-gray-900">
                {alert.message}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {formatDistanceToNow(new Date(alert.timestamp), { addSuffix: true })}
              </p>
            </div>
            {canDismiss && onDismiss && (
              <button
                onClick={() => onDismiss(alert.id)}
                className="ml-3 text-gray-400 hover:text-gray-600"
              >
                <XCircle className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};