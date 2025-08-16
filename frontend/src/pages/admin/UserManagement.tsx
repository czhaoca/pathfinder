import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { authStore } from '@/stores/authStore';
import { userService } from '@/services/user.service';
import { DataTable } from '@/components/common/DataTable';
import { UserFilters } from '@/components/admin/UserFilters';
import { BulkActions } from '@/components/admin/BulkActions';
import { UserDetailsModal } from '@/components/admin/UserDetailsModal';
import { useDebounce } from '@/hooks/useDebounce';
import { toast } from 'sonner';
import { Loader2, Plus, Download, Check, X } from 'lucide-react';
import { format } from 'date-fns';

interface User {
  id: string;
  username: string;
  email: string;
  roles: { role_name: string }[];
  account_status: 'active' | 'inactive' | 'suspended' | 'pending';
  last_login: Date | null;
  created_at: Date;
}

interface UserFiltersState {
  search: string;
  role: string;
  status: string;
  dateRange: { start: Date | null; end: Date | null } | null;
}

interface SortConfig {
  field: string;
  direction: 'asc' | 'desc';
}

export const UserManagement: React.FC = () => {
  const navigate = useNavigate();
  const { user } = authStore();
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<UserFiltersState>({
    search: '',
    role: 'all',
    status: 'all',
    dateRange: null
  });
  const [sortBy, setSortBy] = useState<SortConfig>({
    field: 'created_at',
    direction: 'desc'
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0
  });
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  
  const debouncedSearch = useDebounce(filters.search, 300);
  
  useEffect(() => {
    loadUsers();
  }, [debouncedSearch, filters.role, filters.status, sortBy, pagination.page]);
  
  const loadUsers = async () => {
    try {
      setLoading(true);
      const response = await userService.getUsers({
        ...filters,
        search: debouncedSearch,
        sort: sortBy,
        page: pagination.page,
        limit: pagination.limit
      });
      
      setUsers(response.users);
      setPagination(prev => ({ ...prev, total: response.total }));
    } catch (error) {
      toast.error('Failed to load users');
      console.error('Error loading users:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const handleBulkAction = async (action: string) => {
    if (selectedUsers.length === 0) return;
    
    const confirmed = window.confirm(
      `Are you sure you want to ${action} ${selectedUsers.length} users?`
    );
    
    if (!confirmed) return;
    
    try {
      await userService.bulkAction({
        action,
        userIds: selectedUsers
      });
      
      toast.success(`Successfully ${action}d ${selectedUsers.length} users`);
      setSelectedUsers([]);
      loadUsers();
    } catch (error: any) {
      toast.error(`Failed to ${action} users: ${error.message}`);
    }
  };
  
  const handleEditUser = (user: User) => {
    navigate(`/admin/users/${user.id}/edit`);
  };
  
  const handleDeleteUser = async (user: User) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete user ${user.username}? They will have 7 days to cancel this action.`
    );
    
    if (!confirmed) return;
    
    try {
      await userService.deleteUser(user.id);
      toast.success(`User ${user.username} scheduled for deletion`);
      loadUsers();
    } catch (error: any) {
      toast.error(`Failed to delete user: ${error.message}`);
    }
  };
  
  const exportUsers = async () => {
    try {
      const blob = await userService.exportUsers(filters);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `users-export-${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success('Users exported successfully');
    } catch (error) {
      toast.error('Failed to export users');
    }
  };
  
  const columns = [
    {
      key: 'select',
      header: (
        <input
          type="checkbox"
          checked={selectedUsers.length === users.length && users.length > 0}
          onChange={(e) => {
            setSelectedUsers(e.target.checked ? users.map(u => u.id) : []);
          }}
          className="rounded border-gray-300"
        />
      ),
      render: (user: User) => (
        <input
          type="checkbox"
          checked={selectedUsers.includes(user.id)}
          onChange={(e) => {
            setSelectedUsers(prev => 
              e.target.checked 
                ? [...prev, user.id]
                : prev.filter(id => id !== user.id)
            );
          }}
          className="rounded border-gray-300"
        />
      ),
      width: '40px'
    },
    {
      key: 'username',
      header: 'Username',
      sortable: true,
      render: (user: User) => (
        <div className="flex items-center space-x-2">
          <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center">
            <span className="text-sm font-medium text-gray-600">
              {user.username.charAt(0).toUpperCase()}
            </span>
          </div>
          <span className="font-medium">{user.username}</span>
        </div>
      )
    },
    {
      key: 'email',
      header: 'Email',
      sortable: true,
      render: (user: User) => user.email
    },
    {
      key: 'roles',
      header: 'Role',
      render: (user: User) => (
        <div className="flex flex-wrap gap-1">
          {user.roles.map(role => (
            <span
              key={role.role_name}
              className={`px-2 py-1 text-xs rounded-full ${
                role.role_name === 'site_admin' 
                  ? 'bg-red-100 text-red-800'
                  : role.role_name === 'admin'
                  ? 'bg-blue-100 text-blue-800'
                  : 'bg-gray-100 text-gray-800'
              }`}
            >
              {role.role_name}
            </span>
          ))}
        </div>
      )
    },
    {
      key: 'status',
      header: 'Status',
      render: (user: User) => (
        <span className={`inline-flex items-center px-2 py-1 text-xs rounded-full ${
          user.account_status === 'active'
            ? 'bg-green-100 text-green-800'
            : user.account_status === 'suspended'
            ? 'bg-red-100 text-red-800'
            : user.account_status === 'inactive'
            ? 'bg-gray-100 text-gray-800'
            : 'bg-yellow-100 text-yellow-800'
        }`}>
          {user.account_status === 'active' && <Check className="h-3 w-3 mr-1" />}
          {user.account_status === 'suspended' && <X className="h-3 w-3 mr-1" />}
          {user.account_status}
        </span>
      )
    },
    {
      key: 'last_login',
      header: 'Last Login',
      sortable: true,
      render: (user: User) => (
        <span className="text-sm text-gray-600">
          {user.last_login 
            ? format(new Date(user.last_login), 'MMM d, yyyy h:mm a')
            : 'Never'
          }
        </span>
      )
    },
    {
      key: 'created_at',
      header: 'Created',
      sortable: true,
      render: (user: User) => (
        <span className="text-sm text-gray-600">
          {format(new Date(user.created_at), 'MMM d, yyyy')}
        </span>
      )
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (user: User) => (
        <div className="flex items-center space-x-2">
          <button
            onClick={() => {
              setSelectedUser(user);
              setShowDetailsModal(true);
            }}
            className="text-blue-600 hover:text-blue-800 text-sm"
          >
            View
          </button>
          <button
            onClick={() => handleEditUser(user)}
            className="text-gray-600 hover:text-gray-800 text-sm"
          >
            Edit
          </button>
          <button
            onClick={() => handleDeleteUser(user)}
            className="text-red-600 hover:text-red-800 text-sm"
          >
            Delete
          </button>
        </div>
      )
    }
  ];
  
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">User Management</h2>
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/admin/users/new')}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add User
          </button>
          <button
            onClick={exportUsers}
            className="inline-flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </button>
        </div>
      </div>
      
      <UserFilters 
        filters={filters}
        onChange={setFilters}
      />
      
      {selectedUsers.length > 0 && (
        <BulkActions
          selectedCount={selectedUsers.length}
          onAction={handleBulkAction}
          actions={[
            { id: 'activate', label: 'Activate', icon: 'check' },
            { id: 'deactivate', label: 'Deactivate', icon: 'x' },
            { id: 'reset_password', label: 'Reset Password', icon: 'key' },
            { id: 'delete', label: 'Delete', icon: 'trash', variant: 'danger' }
          ]}
        />
      )}
      
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      ) : (
        <>
          <DataTable
            columns={columns}
            data={users}
            sortBy={sortBy}
            onSort={setSortBy}
            emptyMessage="No users found"
          />
          
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">
              Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
              {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
              {pagination.total} users
            </span>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                disabled={pagination.page === 1}
                className="px-3 py-1 border border-gray-300 rounded-lg disabled:opacity-50"
              >
                Previous
              </button>
              <span className="px-3 py-1">
                Page {pagination.page} of {Math.ceil(pagination.total / pagination.limit)}
              </span>
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                disabled={pagination.page >= Math.ceil(pagination.total / pagination.limit)}
                className="px-3 py-1 border border-gray-300 rounded-lg disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
      
      {showDetailsModal && selectedUser && (
        <UserDetailsModal
          user={selectedUser}
          onClose={() => {
            setShowDetailsModal(false);
            setSelectedUser(null);
          }}
          onUpdate={loadUsers}
        />
      )}
    </div>
  );
};

export default UserManagement;