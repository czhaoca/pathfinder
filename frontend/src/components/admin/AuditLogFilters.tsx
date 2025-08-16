import React from 'react';
import { Search, Calendar, Filter } from 'lucide-react';

interface AuditFilters {
  dateRange: { start: Date | null; end: Date | null };
  eventType: string;
  severity: string;
  actor: string;
  target: string;
  searchText: string;
}

interface AuditLogFiltersProps {
  filters: AuditFilters;
  onChange: (filters: AuditFilters) => void;
}

export const AuditLogFilters: React.FC<AuditLogFiltersProps> = ({
  filters,
  onChange
}) => {
  const handleFilterChange = (field: keyof AuditFilters, value: any) => {
    onChange({ ...filters, [field]: value });
  };
  
  const eventTypes = [
    { value: 'all', label: 'All Events' },
    { value: 'auth', label: 'Authentication' },
    { value: 'user', label: 'User Management' },
    { value: 'role', label: 'Role Management' },
    { value: 'data', label: 'Data Access' },
    { value: 'security', label: 'Security' },
    { value: 'system', label: 'System' }
  ];
  
  const severityLevels = [
    { value: 'all', label: 'All Severities' },
    { value: 'debug', label: 'Debug' },
    { value: 'info', label: 'Info' },
    { value: 'warning', label: 'Warning' },
    { value: 'error', label: 'Error' },
    { value: 'critical', label: 'Critical' },
    { value: 'emergency', label: 'Emergency' }
  ];
  
  return (
    <div className="bg-white rounded-lg shadow p-4 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Event Type
          </label>
          <select
            value={filters.eventType}
            onChange={(e) => handleFilterChange('eventType', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {eventTypes.map(type => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Severity
          </label>
          <select
            value={filters.severity}
            onChange={(e) => handleFilterChange('severity', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {severityLevels.map(level => (
              <option key={level.value} value={level.value}>
                {level.label}
              </option>
            ))}
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Actor
          </label>
          <input
            type="text"
            value={filters.actor}
            onChange={(e) => handleFilterChange('actor', e.target.value)}
            placeholder="Username or ID"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Target
          </label>
          <input
            type="text"
            value={filters.target}
            onChange={(e) => handleFilterChange('target', e.target.value)}
            placeholder="Resource name or ID"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Date Range
          </label>
          <div className="flex items-center space-x-2">
            <input
              type="date"
              value={filters.dateRange.start ? filters.dateRange.start.toISOString().split('T')[0] : ''}
              onChange={(e) => handleFilterChange('dateRange', {
                ...filters.dateRange,
                start: e.target.value ? new Date(e.target.value) : null
              })}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-gray-500">to</span>
            <input
              type="date"
              value={filters.dateRange.end ? filters.dateRange.end.toISOString().split('T')[0] : ''}
              onChange={(e) => handleFilterChange('dateRange', {
                ...filters.dateRange,
                end: e.target.value ? new Date(e.target.value) : null
              })}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Search
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              value={filters.searchText}
              onChange={(e) => handleFilterChange('searchText', e.target.value)}
              placeholder="Search in logs..."
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>
      
      <div className="flex justify-end">
        <button
          onClick={() => onChange({
            dateRange: { start: null, end: null },
            eventType: 'all',
            severity: 'all',
            actor: '',
            target: '',
            searchText: ''
          })}
          className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
        >
          Clear Filters
        </button>
      </div>
    </div>
  );
};