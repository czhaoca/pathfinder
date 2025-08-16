import React from 'react';
import { Search, Filter } from 'lucide-react';

interface UserFiltersState {
  search: string;
  role: string;
  status: string;
  dateRange: { start: Date | null; end: Date | null } | null;
}

interface UserFiltersProps {
  filters: UserFiltersState;
  onChange: (filters: UserFiltersState) => void;
}

export const UserFilters: React.FC<UserFiltersProps> = ({ filters, onChange }) => {
  const handleFilterChange = (field: keyof UserFiltersState, value: any) => {
    onChange({ ...filters, [field]: value });
  };
  
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="md:col-span-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              placeholder="Search by username or email..."
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        
        <div>
          <select
            value={filters.role}
            onChange={(e) => handleFilterChange('role', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Roles</option>
            <option value="user">User</option>
            <option value="admin">Admin</option>
            <option value="site_admin">Site Admin</option>
          </select>
        </div>
        
        <div>
          <select
            value={filters.status}
            onChange={(e) => handleFilterChange('status', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="suspended">Suspended</option>
            <option value="pending">Pending</option>
          </select>
        </div>
      </div>
    </div>
  );
};