import React, { useState, useEffect } from 'react';
import { auditService } from '@/services/audit.service';
import { AuditLogFilters } from '@/components/admin/AuditLogFilters';
import { AuditLogEntry } from '@/components/admin/AuditLogEntry';
import { useWebSocket } from '@/hooks/useWebSocket';
import { toast } from 'sonner';
import { Loader2, Download, AlertCircle } from 'lucide-react';
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

interface AuditFilters {
  dateRange: { start: Date | null; end: Date | null };
  eventType: string;
  severity: string;
  actor: string;
  target: string;
  searchText: string;
}

export const AuditLogViewer: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [filters, setFilters] = useState<AuditFilters>({
    dateRange: { start: null, end: null },
    eventType: 'all',
    severity: 'all',
    actor: '',
    target: '',
    searchText: ''
  });
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  
  // Real-time updates
  useWebSocket('audit:log', (newLog: AuditLog) => {
    if (matchesFilters(newLog, filters)) {
      setLogs(prev => [newLog, ...prev]);
    }
  });
  
  useEffect(() => {
    loadAuditLogs(true);
  }, [filters]);
  
  const matchesFilters = (log: AuditLog, filters: AuditFilters): boolean => {
    if (filters.eventType !== 'all' && log.event_type !== filters.eventType) return false;
    if (filters.severity !== 'all' && log.event_severity !== filters.severity) return false;
    if (filters.actor && !log.actor_username?.toLowerCase().includes(filters.actor.toLowerCase())) return false;
    if (filters.target && !log.target_name?.toLowerCase().includes(filters.target.toLowerCase())) return false;
    if (filters.searchText && !JSON.stringify(log).toLowerCase().includes(filters.searchText.toLowerCase())) return false;
    
    if (filters.dateRange.start || filters.dateRange.end) {
      const logDate = new Date(log.event_timestamp);
      if (filters.dateRange.start && logDate < filters.dateRange.start) return false;
      if (filters.dateRange.end && logDate > filters.dateRange.end) return false;
    }
    
    return true;
  };
  
  const loadAuditLogs = async (reset = false) => {
    setLoading(true);
    try {
      const currentPage = reset ? 1 : page;
      const response = await auditService.getLogs({
        ...filters,
        page: currentPage,
        limit: 50
      });
      
      if (reset) {
        setLogs(response.logs);
        setPage(1);
      } else {
        setLogs(prev => [...prev, ...response.logs]);
      }
      
      setHasMore(response.hasMore);
      if (!reset) setPage(currentPage + 1);
    } catch (error) {
      toast.error('Failed to load audit logs');
      console.error('Error loading audit logs:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const toggleExpanded = (logId: string) => {
    setExpandedLogs(prev => {
      const next = new Set(prev);
      if (next.has(logId)) {
        next.delete(logId);
      } else {
        next.add(logId);
      }
      return next;
    });
  };
  
  const exportAuditLogs = async () => {
    try {
      const blob = await auditService.exportLogs(filters);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-logs-${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success('Audit logs exported successfully');
    } catch (error) {
      toast.error('Failed to export audit logs');
    }
  };
  
  const getSeverityColor = (severity: string): string => {
    const colors: Record<string, string> = {
      debug: 'bg-gray-100 text-gray-800',
      info: 'bg-blue-100 text-blue-800',
      warning: 'bg-yellow-100 text-yellow-800',
      error: 'bg-red-100 text-red-800',
      critical: 'bg-red-200 text-red-900',
      emergency: 'bg-purple-100 text-purple-800'
    };
    return colors[severity] || 'bg-gray-100 text-gray-800';
  };
  
  const criticalCount = logs.filter(l => l.event_severity === 'critical' || l.event_severity === 'emergency').length;
  
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Audit Logs</h2>
          <div className="flex items-center space-x-4 mt-2">
            <span className="text-sm text-gray-600">Total: {logs.length}</span>
            {criticalCount > 0 && (
              <span className="inline-flex items-center text-sm text-red-600">
                <AlertCircle className="h-4 w-4 mr-1" />
                Critical: {criticalCount}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={exportAuditLogs}
          className="inline-flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
        >
          <Download className="h-4 w-4 mr-2" />
          Export
        </button>
      </div>
      
      <AuditLogFilters
        filters={filters}
        onChange={setFilters}
      />
      
      <div className="bg-white rounded-lg shadow">
        {loading && logs.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <AlertCircle className="h-12 w-12 mb-4" />
            <p>No audit logs match your filters</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {logs.map(log => (
              <AuditLogEntry
                key={log.id}
                log={log}
                expanded={expandedLogs.has(log.id)}
                onToggle={() => toggleExpanded(log.id)}
                getSeverityColor={getSeverityColor}
              />
            ))}
          </div>
        )}
        
        {hasMore && !loading && (
          <div className="p-4 text-center border-t border-gray-200">
            <button
              onClick={() => loadAuditLogs(false)}
              className="text-blue-600 hover:text-blue-800"
            >
              Load More
            </button>
          </div>
        )}
        
        {loading && logs.length > 0 && (
          <div className="p-4 text-center border-t border-gray-200">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600 mx-auto" />
          </div>
        )}
      </div>
    </div>
  );
};

export default AuditLogViewer;