import React, { useState, useEffect } from 'react';
import { adminService } from '../../services/admin.service';
import { userService } from '../../services/user.service';
import { UserDetailsModal } from './UserDetailsModal';
import { BulkActions } from './BulkActions';
import { UserFilters } from './UserFilters';
import { DataTable } from '../common/DataTable';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { ErrorMessage } from '../common/ErrorMessage';
import { toast } from 'react-toastify';
import './UserManagement.css';

interface User {
  id: string;
  username: string;
  email: string;
  status: 'active' | 'inactive' | 'suspended' | 'deleted';
  role: string;
  createdAt: Date;
  lastActive: Date;
  avatar?: string;
}

interface UserFiltersState {
  search: string;
  status: string;
  role: string;
  createdAfter?: Date;
  createdBefore?: Date;
  lastActiveAfter?: Date;
}

export const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [filters, setFilters] = useState<UserFiltersState>({
    search: '',
    status: 'all',
    role: 'all'
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  });

  useEffect(() => {
    loadUsers();
  }, [filters, pagination.page]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await userService.searchUsers({
        ...filters,
        page: pagination.page,
        limit: pagination.limit
      });
      
      setUsers(response.users);
      setPagination({
        ...pagination,
        total: response.total,
        totalPages: response.totalPages
      });
    } catch (err) {
      setError('Failed to load users');
      console.error('Error loading users:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (userId: string, newStatus: string) => {
    const reason = prompt(`Reason for changing status to ${newStatus}:`);
    if (!reason) return;

    try {
      await adminService.updateUserStatus(userId, newStatus, reason);
      toast.success('User status updated successfully');
      await loadUsers();
    } catch (err) {
      toast.error('Failed to update user status');
      console.error('Error updating user status:', err);
    }
  };

  const handleImpersonate = async (userId: string) => {
    if (!confirm('Are you sure you want to impersonate this user?')) return;

    try {
      const { token } = await adminService.impersonateUser(userId);
      localStorage.setItem('impersonation_token', token);
      window.location.href = '/dashboard?impersonating=true';
    } catch (err) {
      toast.error('Failed to impersonate user');
      console.error('Error impersonating user:', err);
    }
  };

  const handleResetPassword = async (userId: string) => {
    if (!confirm('Send password reset email to this user?')) return;

    try {
      await userService.resetUserPassword(userId);
      toast.success('Password reset email sent');
    } catch (err) {
      toast.error('Failed to send password reset');
      console.error('Error resetting password:', err);
    }
  };

  const handleBulkOperation = async (operation: string, reason: string) => {
    try {
      const userIds = Array.from(selectedUsers);
      const result = await adminService.bulkUserOperation(userIds, operation, reason);
      
      toast.success(`Bulk operation completed: ${result.successful} successful, ${result.failed} failed`);
      setSelectedUsers(new Set());
      setShowBulkActions(false);
      await loadUsers();
    } catch (err) {
      toast.error('Bulk operation failed');
      console.error('Error in bulk operation:', err);
    }
  };

  const handleSelectUser = (userId: string) => {
    const newSelection = new Set(selectedUsers);
    if (newSelection.has(userId)) {
      newSelection.delete(userId);
    } else {
      newSelection.add(userId);
    }
    setSelectedUsers(newSelection);
  };

  const handleSelectAll = () => {
    if (selectedUsers.size === users.length) {
      setSelectedUsers(new Set());
    } else {
      setSelectedUsers(new Set(users.map(u => u.id)));
    }
  };

  const handleExportUsers = async () => {
    try {
      const blob = await userService.exportUsers(filters);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `users-export-${Date.now()}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('Users exported successfully');
    } catch (err) {
      toast.error('Failed to export users');
      console.error('Error exporting users:', err);
    }
  };

  const columns = [
    {
      key: 'select',
      label: (
        <input
          type="checkbox"
          checked={selectedUsers.size === users.length && users.length > 0}
          onChange={handleSelectAll}
        />
      ),
      render: (user: User) => (
        <input
          type="checkbox"
          checked={selectedUsers.has(user.id)}
          onChange={() => handleSelectUser(user.id)}
        />
      )
    },
    {
      key: 'user',
      label: 'User',
      render: (user: User) => (
        <div className="user-info">
          {user.avatar ? (
            <img src={user.avatar} alt={user.username} className="user-avatar" />
          ) : (
            <div className="user-avatar-placeholder">
              {user.username.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <div className="user-name">{user.username}</div>
            <div className="user-email">{user.email}</div>
          </div>
        </div>
      )
    },
    {
      key: 'status',
      label: 'Status',
      render: (user: User) => (
        <select
          value={user.status}
          onChange={(e) => handleStatusChange(user.id, e.target.value)}
          className={`status-select status-${user.status}`}
          aria-label="Status Filter"
        >
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="suspended">Suspended</option>
        </select>
      )
    },
    {
      key: 'role',
      label: 'Role',
      render: (user: User) => (
        <span className={`role-badge role-${user.role}`}>{user.role}</span>
      )
    },
    {
      key: 'createdAt',
      label: 'Joined',
      render: (user: User) => new Date(user.createdAt).toLocaleDateString()
    },
    {
      key: 'lastActive',
      label: 'Last Active',
      render: (user: User) => {
        const date = new Date(user.lastActive);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        
        if (days === 0) return 'Today';
        if (days === 1) return 'Yesterday';
        if (days < 7) return `${days} days ago`;
        if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
        return date.toLocaleDateString();
      }
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (user: User) => (
        <div className="user-actions">
          <button
            onClick={() => setSelectedUser(user)}
            title="View Details"
            className="action-btn"
          >
            👁️
          </button>
          <button
            onClick={() => handleImpersonate(user.id)}
            title="Impersonate"
            className="action-btn"
          >
            🎭
          </button>
          <button
            onClick={() => handleResetPassword(user.id)}
            title="Reset Password"
            className="action-btn"
          >
            🔑
          </button>
        </div>
      )
    }
  ];

  if (loading && users.length === 0) {
    return <LoadingSpinner />;
  }

  if (error && users.length === 0) {
    return <ErrorMessage message={error} />;
  }

  return (
    <div className="user-management" data-testid="user-management">
      <div className="management-header">
        <h2>User Management</h2>
        <div className="header-actions">
          <button 
            onClick={() => window.location.href = '/admin/invitations'}
            className="btn btn-primary"
          >
            Invite Users
          </button>
          {selectedUsers.size > 0 && (
            <button 
              onClick={() => setShowBulkActions(true)}
              className="btn btn-secondary"
            >
              Bulk Actions ({selectedUsers.size})
            </button>
          )}
          <button 
            onClick={handleExportUsers}
            className="btn btn-secondary"
          >
            Export Users
          </button>
        </div>
      </div>

      <UserFilters 
        filters={filters}
        onFiltersChange={setFilters}
        onSearch={loadUsers}
      />

      <div className="user-table-container">
        <DataTable
          columns={columns}
          data={users}
          keyField="id"
          loading={loading}
        />
      </div>

      <div className="pagination-controls">
        <button
          onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
          disabled={pagination.page === 1}
          className="btn btn-secondary"
        >
          Previous
        </button>
        <span className="pagination-info">
          Page {pagination.page} of {pagination.totalPages} ({pagination.total} users)
        </span>
        <button
          onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
          disabled={pagination.page === pagination.totalPages}
          className="btn btn-secondary"
        >
          Next
        </button>
      </div>

      {selectedUser && (
        <UserDetailsModal
          user={selectedUser}
          onClose={() => setSelectedUser(null)}
          onUpdate={loadUsers}
        />
      )}

      {showBulkActions && (
        <BulkActions
          selectedCount={selectedUsers.size}
          onAction={handleBulkOperation}
          onClose={() => setShowBulkActions(false)}
        />
      )}
    </div>
  );
};

export default UserManagement;