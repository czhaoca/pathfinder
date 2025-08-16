import React from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { format } from 'date-fns';

interface AuditLog {
  id: string;
  event_id: string;
  event_type: string;
  event_name: string;
  event_timestamp: Date;
  event_severity: 'debug' | 'info' | 'warning' | 'error' | 'critical' | 'emergency';
  actor_id: string;
  actor_username: string;
  target_id?: string;
  target_name?: string;
  action_result: 'success' | 'failure' | 'partial';
  ip_address: string;
  user_agent: string;
  session_id: string;
  error_message?: string;
  old_values?: any;
  new_values?: any;
  event_hash: string;
  risk_score: number;
  compliance_frameworks?: string;
}

interface AuditLogEntryProps {
  log: AuditLog;
  expanded: boolean;
  onToggle: () => void;
  getSeverityColor: (severity: string) => string;
}

export const AuditLogEntry: React.FC<AuditLogEntryProps> = ({
  log,
  expanded,
  onToggle,
  getSeverityColor
}) => {
  const getResultIcon = (result: string) => {
    switch (result) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failure':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'partial':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default:
        return null;
    }
  };
  
  return (
    <div className="border-b border-gray-200 last:border-0">
      <div
        className="px-6 py-4 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4 flex-1">
            <div className="text-sm text-gray-500">
              {format(new Date(log.event_timestamp), 'MMM d, yyyy h:mm:ss a')}
            </div>
            <span className={`px-2 py-1 text-xs rounded-full ${getSeverityColor(log.event_severity)}`}>
              {log.event_severity}
            </span>
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-gray-900">{log.event_type}</span>
              <span className="text-sm text-gray-600">-</span>
              <span className="text-sm text-gray-700">{log.event_name}</span>
            </div>
            <div className="text-sm text-gray-600">
              by <span className="font-medium">{log.actor_username || log.actor_id}</span>
            </div>
            {log.target_name && (
              <div className="text-sm text-gray-600">
                on <span className="font-medium">{log.target_name}</span>
              </div>
            )}
          </div>
          <div className="flex items-center space-x-3">
            {getResultIcon(log.action_result)}
            {expanded ? (
              <ChevronUp className="h-5 w-5 text-gray-400" />
            ) : (
              <ChevronDown className="h-5 w-5 text-gray-400" />
            )}
          </div>
        </div>
      </div>
      
      {expanded && (
        <div className="px-6 pb-4 bg-gray-50 border-t border-gray-100">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <p className="text-xs text-gray-500 mb-1">Event ID</p>
              <p className="text-sm font-mono text-gray-700">{log.event_id}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Session ID</p>
              <p className="text-sm font-mono text-gray-700">{log.session_id}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Actor</p>
              <p className="text-sm text-gray-700">
                {log.actor_username} ({log.actor_id})
              </p>
            </div>
            {log.target_id && (
              <div>
                <p className="text-xs text-gray-500 mb-1">Target</p>
                <p className="text-sm text-gray-700">
                  {log.target_name || log.target_id}
                </p>
              </div>
            )}
            <div>
              <p className="text-xs text-gray-500 mb-1">IP Address</p>
              <p className="text-sm font-mono text-gray-700">{log.ip_address}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Risk Score</p>
              <p className="text-sm text-gray-700">
                <span className={`font-medium ${
                  log.risk_score > 70 ? 'text-red-600' :
                  log.risk_score > 40 ? 'text-yellow-600' : 'text-green-600'
                }`}>
                  {log.risk_score}/100
                </span>
              </p>
            </div>
          </div>
          
          {log.user_agent && (
            <div className="mb-4">
              <p className="text-xs text-gray-500 mb-1">User Agent</p>
              <p className="text-sm font-mono text-gray-700 break-all">{log.user_agent}</p>
            </div>
          )}
          
          {log.error_message && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded">
              <p className="text-xs text-red-600 font-medium mb-1">Error Message</p>
              <p className="text-sm text-red-700">{log.error_message}</p>
            </div>
          )}
          
          {(log.old_values || log.new_values) && (
            <div className="mb-4">
              <p className="text-xs text-gray-500 mb-2">Data Changes</p>
              <div className="grid grid-cols-2 gap-4">
                {log.old_values && (
                  <div>
                    <p className="text-xs font-medium text-gray-600 mb-1">Before</p>
                    <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto">
                      {JSON.stringify(log.old_values, null, 2)}
                    </pre>
                  </div>
                )}
                {log.new_values && (
                  <div>
                    <p className="text-xs font-medium text-gray-600 mb-1">After</p>
                    <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto">
                      {JSON.stringify(log.new_values, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          )}
          
          <div className="flex items-center space-x-4 text-xs text-gray-500">
            <span>Hash: {log.event_hash.substring(0, 16)}...</span>
            {log.compliance_frameworks && (
              <span>Compliance: {JSON.parse(log.compliance_frameworks).join(', ')}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};