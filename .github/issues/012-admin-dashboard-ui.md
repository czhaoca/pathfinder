---
name: Frontend Feature
about: Create admin dashboard for user management
title: 'feat: [Frontend] Create comprehensive admin dashboard UI'
labels: frontend, admin, enhancement, priority:high
assignees: ''

---

## 📋 Description
Create a comprehensive admin dashboard UI for managing users, roles, permissions, viewing audit logs, monitoring system health, and handling administrative tasks. The dashboard should enforce RBAC with different views for admin vs site_admin roles.

## 🎯 Acceptance Criteria
- [ ] User management interface (list, search, filter, bulk actions)
- [ ] Role management with approval workflows
- [ ] User registration form for admins
- [ ] Deletion queue management with cooling-off visibility
- [ ] Audit log viewer with search and filters
- [ ] System configuration management (site_admin only)
- [ ] Security alerts and critical events dashboard
- [ ] User activity analytics and reports
- [ ] Batch operations interface
- [ ] Responsive design for mobile/tablet
- [ ] Real-time updates using WebSockets
- [ ] Export functionality for reports

## 🎨 UI Implementation

### Admin Dashboard Layout
```tsx
// frontend/src/pages/admin/Dashboard.tsx
import React, { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { AdminSidebar } from '../../components/admin/AdminSidebar';
import { DashboardMetrics } from '../../components/admin/DashboardMetrics';
import { RecentActivity } from '../../components/admin/RecentActivity';
import { SecurityAlerts } from '../../components/admin/SecurityAlerts';
import { QuickActions } from '../../components/admin/QuickActions';

export const AdminDashboard: React.FC = () => {
  const { user, hasRole } = useAuth();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
  
  const isSiteAdmin = hasRole('site_admin');
  const isAdmin = hasRole('admin');
  
  if (!isAdmin && !isSiteAdmin) {
    return <Navigate to="/dashboard" />;
  }
  
  useEffect(() => {
    loadDashboardData();
    subscribeToRealTimeUpdates();
  }, []);
  
  return (
    <div className="admin-dashboard">
      <AdminSidebar role={user?.roles[0]} />
      
      <div className="dashboard-content">
        <header className="dashboard-header">
          <h1>Admin Dashboard</h1>
          <div className="header-actions">
            <NotificationBell />
            <UserMenu />
          </div>
        </header>
        
        <div className="dashboard-grid">
          {/* Metrics Cards */}
          <section className="metrics-section">
            <DashboardMetrics data={metrics} />
          </section>
          
          {/* Security Alerts - Priority for site_admin */}
          {(isSiteAdmin || alerts.length > 0) && (
            <section className="alerts-section">
              <h2>Security Alerts</h2>
              <SecurityAlerts 
                alerts={alerts}
                canDismiss={isSiteAdmin}
              />
            </section>
          )}
          
          {/* Quick Actions */}
          <section className="quick-actions">
            <h2>Quick Actions</h2>
            <QuickActions role={user?.roles[0]} />
          </section>
          
          {/* Recent Activity */}
          <section className="activity-section">
            <h2>Recent Activity</h2>
            <RecentActivity limit={10} />
          </section>
          
          {/* System Health - Site Admin Only */}
          {isSiteAdmin && (
            <section className="system-health">
              <h2>System Health</h2>
              <SystemHealthMonitor />
            </section>
          )}
        </div>
      </div>
    </div>
  );
};

// Dashboard Metrics Component
const DashboardMetrics: React.FC<{ data: any }> = ({ data }) => {
  if (!data) return <LoadingSpinner />;
  
  return (
    <div className="metrics-grid">
      <MetricCard
        title="Total Users"
        value={data.totalUsers}
        change={data.userGrowth}
        icon="👥"
      />
      <MetricCard
        title="Active Sessions"
        value={data.activeSessions}
        realTime
        icon="🟢"
      />
      <MetricCard
        title="Failed Logins (24h)"
        value={data.failedLogins}
        severity={data.failedLogins > 10 ? 'warning' : 'normal'}
        icon="🔒"
      />
      <MetricCard
        title="Pending Approvals"
        value={data.pendingApprovals}
        actionable
        icon="⏳"
      />
    </div>
  );
};
```

### User Management Interface
```tsx
// frontend/src/components/admin/UserManagement.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { DataTable } from '../common/DataTable';
import { UserFilters } from './UserFilters';
import { BulkActions } from './BulkActions';
import { UserDetailsModal } from './UserDetailsModal';
import { useDebounce } from '../../hooks/useDebounce';

export const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [filters, setFilters] = useState<UserFilters>({
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
  
  const debouncedSearch = useDebounce(filters.search, 300);
  
  useEffect(() => {
    loadUsers();
  }, [debouncedSearch, filters.role, filters.status, sortBy, pagination.page]);
  
  const loadUsers = async () => {
    const response = await userService.getUsers({
      ...filters,
      search: debouncedSearch,
      sort: sortBy,
      page: pagination.page,
      limit: pagination.limit
    });
    
    setUsers(response.users);
    setPagination(prev => ({ ...prev, total: response.total }));
  };
  
  const handleBulkAction = async (action: string) => {
    if (selectedUsers.length === 0) return;
    
    const confirmed = await confirmDialog({
      title: 'Confirm Bulk Action',
      message: `Are you sure you want to ${action} ${selectedUsers.length} users?`,
      confirmText: 'Proceed',
      type: 'warning'
    });
    
    if (!confirmed) return;
    
    try {
      await userService.bulkAction({
        action,
        userIds: selectedUsers
      });
      
      toast.success(`Successfully ${action}d ${selectedUsers.length} users`);
      setSelectedUsers([]);
      loadUsers();
    } catch (error) {
      toast.error(`Failed to ${action} users: ${error.message}`);
    }
  };
  
  const columns = [
    {
      key: 'select',
      header: (
        <Checkbox
          checked={selectedUsers.length === users.length}
          indeterminate={selectedUsers.length > 0 && selectedUsers.length < users.length}
          onChange={(checked) => {
            setSelectedUsers(checked ? users.map(u => u.id) : []);
          }}
        />
      ),
      render: (user: User) => (
        <Checkbox
          checked={selectedUsers.includes(user.id)}
          onChange={(checked) => {
            setSelectedUsers(prev => 
              checked 
                ? [...prev, user.id]
                : prev.filter(id => id !== user.id)
            );
          }}
        />
      ),
      width: '40px'
    },
    {
      key: 'username',
      header: 'Username',
      sortable: true,
      render: (user: User) => (
        <div className="user-cell">
          <Avatar user={user} size="small" />
          <span>{user.username}</span>
        </div>
      )
    },
    {
      key: 'email',
      header: 'Email',
      sortable: true
    },
    {
      key: 'roles',
      header: 'Role',
      render: (user: User) => (
        <RoleBadge roles={user.roles} />
      )
    },
    {
      key: 'status',
      header: 'Status',
      render: (user: User) => (
        <StatusBadge status={user.account_status} />
      )
    },
    {
      key: 'last_login',
      header: 'Last Login',
      sortable: true,
      render: (user: User) => (
        <TimeAgo date={user.last_login} />
      )
    },
    {
      key: 'created_at',
      header: 'Created',
      sortable: true,
      render: (user: User) => (
        <DateDisplay date={user.created_at} />
      )
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (user: User) => (
        <UserActions 
          user={user}
          onView={() => setSelectedUser(user)}
          onEdit={() => handleEditUser(user)}
          onDelete={() => handleDeleteUser(user)}
        />
      )
    }
  ];
  
  return (
    <div className="user-management">
      <div className="management-header">
        <h2>User Management</h2>
        <div className="header-actions">
          <Button 
            variant="primary"
            onClick={() => navigate('/admin/users/new')}
            icon="➕"
          >
            Add User
          </Button>
          <Button
            variant="secondary"
            onClick={exportUsers}
            icon="📥"
          >
            Export
          </Button>
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
            { id: 'activate', label: 'Activate', icon: '✅' },
            { id: 'deactivate', label: 'Deactivate', icon: '⛔' },
            { id: 'reset_password', label: 'Reset Password', icon: '🔑' },
            { id: 'delete', label: 'Delete', icon: '🗑️', variant: 'danger' }
          ]}
        />
      )}
      
      <DataTable
        columns={columns}
        data={users}
        sortBy={sortBy}
        onSort={setSortBy}
        loading={loading}
        emptyMessage="No users found"
      />
      
      <Pagination
        current={pagination.page}
        total={Math.ceil(pagination.total / pagination.limit)}
        onChange={(page) => setPagination(prev => ({ ...prev, page }))}
      />
      
      {selectedUser && (
        <UserDetailsModal
          user={selectedUser}
          onClose={() => setSelectedUser(null)}
          onUpdate={loadUsers}
        />
      )}
    </div>
  );
};
```

### Audit Log Viewer
```tsx
// frontend/src/components/admin/AuditLogViewer.tsx
import React, { useState, useEffect } from 'react';
import { VirtualList } from '../common/VirtualList';
import { AuditLogFilters } from './AuditLogFilters';
import { AuditLogEntry } from './AuditLogEntry';

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
  
  useEffect(() => {
    loadAuditLogs();
  }, [filters]);
  
  // Real-time updates
  useEffect(() => {
    const subscription = auditService.subscribeToLogs((newLog) => {
      if (matchesFilters(newLog, filters)) {
        setLogs(prev => [newLog, ...prev]);
      }
    });
    
    return () => subscription.unsubscribe();
  }, [filters]);
  
  const loadAuditLogs = async () => {
    setLoading(true);
    try {
      const response = await auditService.getLogs(filters);
      setLogs(response);
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
  
  const getSeverityColor = (severity: string) => {
    const colors = {
      debug: '#gray',
      info: '#blue',
      warning: '#orange',
      error: '#red',
      critical: '#darkred',
      emergency: '#purple'
    };
    return colors[severity] || '#gray';
  };
  
  return (
    <div className="audit-log-viewer">
      <div className="viewer-header">
        <h2>Audit Logs</h2>
        <div className="header-stats">
          <span>Total: {logs.length}</span>
          <span>
            Critical: {logs.filter(l => l.event_severity === 'critical').length}
          </span>
        </div>
      </div>
      
      <AuditLogFilters
        filters={filters}
        onChange={setFilters}
        onExport={() => exportAuditLogs(filters)}
      />
      
      <div className="log-list">
        {loading ? (
          <LoadingSpinner />
        ) : logs.length === 0 ? (
          <EmptyState message="No audit logs match your filters" />
        ) : (
          <VirtualList
            items={logs}
            itemHeight={expandedLogs.has(logs[0]?.id) ? 200 : 80}
            renderItem={(log) => (
              <AuditLogEntry
                key={log.id}
                log={log}
                expanded={expandedLogs.has(log.id)}
                onToggle={() => toggleExpanded(log.id)}
              />
            )}
          />
        )}
      </div>
    </div>
  );
};

// Individual Audit Log Entry
const AuditLogEntry: React.FC<{
  log: AuditLog;
  expanded: boolean;
  onToggle: () => void;
}> = ({ log, expanded, onToggle }) => {
  return (
    <div className={`audit-log-entry severity-${log.event_severity}`}>
      <div className="log-header" onClick={onToggle}>
        <div className="log-timestamp">
          {new Date(log.event_timestamp).toLocaleString()}
        </div>
        <div className="log-severity">
          <SeverityBadge severity={log.event_severity} />
        </div>
        <div className="log-summary">
          <span className="event-type">{log.event_type}</span>
          <span className="event-name">{log.event_name}</span>
          <span className="actor">{log.actor_username || log.actor_id}</span>
        </div>
        <div className="log-result">
          <ResultBadge result={log.action_result} />
        </div>
        <ChevronIcon direction={expanded ? 'up' : 'down'} />
      </div>
      
      {expanded && (
        <div className="log-details">
          <div className="detail-grid">
            <DetailItem label="Event ID" value={log.event_id} />
            <DetailItem label="Actor" value={`${log.actor_username} (${log.actor_id})`} />
            <DetailItem label="Target" value={log.target_name || log.target_id} />
            <DetailItem label="IP Address" value={log.ip_address} />
            <DetailItem label="Session ID" value={log.session_id} />
            <DetailItem label="User Agent" value={log.user_agent} />
          </div>
          
          {log.error_message && (
            <div className="error-section">
              <h4>Error Details</h4>
              <pre>{log.error_message}</pre>
            </div>
          )}
          
          {log.old_values && (
            <div className="changes-section">
              <h4>Data Changes</h4>
              <DataDiff
                before={log.old_values}
                after={log.new_values}
              />
            </div>
          )}
          
          <div className="metadata">
            <span>Hash: {log.event_hash.substring(0, 16)}...</span>
            <span>Risk Score: {log.risk_score}/100</span>
            {log.compliance_frameworks && (
              <span>Compliance: {JSON.parse(log.compliance_frameworks).join(', ')}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
```

### Deletion Queue Management
```tsx
// frontend/src/components/admin/DeletionQueue.tsx
import React, { useState, useEffect } from 'react';
import { deletionService } from '../../services/deletion.service';
import { CountdownTimer } from '../common/CountdownTimer';

export const DeletionQueueManagement: React.FC = () => {
  const [queue, setQueue] = useState<DeletionRequest[]>([]);
  const [filter, setFilter] = useState<'all' | 'pending' | 'cancelled'>('pending');
  const { hasRole } = useAuth();
  const isSiteAdmin = hasRole('site_admin');
  
  useEffect(() => {
    loadDeletionQueue();
    const interval = setInterval(loadDeletionQueue, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [filter]);
  
  const loadDeletionQueue = async () => {
    const response = await deletionService.getQueue({ status: filter });
    setQueue(response);
  };
  
  const handleOverride = async (userId: string) => {
    if (!isSiteAdmin) {
      toast.error('Only site admins can override cooling-off period');
      return;
    }
    
    const confirmed = await confirmDialog({
      title: 'Override Cooling-Off Period',
      message: 'This will immediately and permanently delete the user. This action cannot be undone.',
      confirmText: 'Delete Immediately',
      type: 'danger',
      requireTyping: 'DELETE'
    });
    
    if (!confirmed) return;
    
    try {
      await deletionService.overrideCoolingOff(userId);
      toast.success('User deleted immediately');
      loadDeletionQueue();
    } catch (error) {
      toast.error(`Failed to override: ${error.message}`);
    }
  };
  
  const handleCancel = async (userId: string, token: string) => {
    try {
      await deletionService.cancelDeletion(userId, token);
      toast.success('Deletion cancelled');
      loadDeletionQueue();
    } catch (error) {
      toast.error(`Failed to cancel: ${error.message}`);
    }
  };
  
  return (
    <div className="deletion-queue">
      <div className="queue-header">
        <h2>User Deletion Queue</h2>
        <div className="queue-filters">
          <FilterTabs
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: 'All' },
              { value: 'pending', label: 'Pending', count: queue.filter(q => q.status === 'pending').length },
              { value: 'cancelled', label: 'Cancelled' }
            ]}
          />
        </div>
      </div>
      
      <div className="queue-list">
        {queue.length === 0 ? (
          <EmptyState message="No deletion requests" />
        ) : (
          queue.map(request => (
            <DeletionRequestCard
              key={request.user_id}
              request={request}
              onOverride={handleOverride}
              onCancel={handleCancel}
              canOverride={isSiteAdmin}
            />
          ))
        )}
      </div>
    </div>
  );
};

const DeletionRequestCard: React.FC<{
  request: DeletionRequest;
  onOverride: (userId: string) => void;
  onCancel: (userId: string, token: string) => void;
  canOverride: boolean;
}> = ({ request, onOverride, onCancel, canOverride }) => {
  const isPending = request.status === 'pending';
  const timeRemaining = new Date(request.deletion_scheduled_for).getTime() - Date.now();
  
  return (
    <div className={`deletion-card status-${request.status}`}>
      <div className="card-header">
        <div className="user-info">
          <Avatar userId={request.user_id} />
          <div>
            <h4>{request.username}</h4>
            <span className="email">{request.email}</span>
          </div>
        </div>
        <StatusBadge status={request.status} />
      </div>
      
      <div className="card-body">
        <div className="deletion-details">
          <DetailRow label="Requested" value={formatDate(request.deletion_requested_at)} />
          <DetailRow label="Scheduled For" value={formatDate(request.deletion_scheduled_for)} />
          <DetailRow label="Type" value={request.deletion_type} />
          <DetailRow label="Reason" value={request.reason || 'Not specified'} />
          <DetailRow label="Category" value={request.category} />
        </div>
        
        {isPending && (
          <div className="countdown-section">
            <h5>Time Remaining:</h5>
            <CountdownTimer 
              endTime={request.deletion_scheduled_for}
              onComplete={loadDeletionQueue}
            />
            
            <div className="reminder-status">
              <h5>Reminders Sent:</h5>
              <div className="reminder-badges">
                {request.reminder_1_sent && <Badge>Day 1 ✓</Badge>}
                {request.reminder_3_sent && <Badge>Day 3 ✓</Badge>}
                {request.reminder_6_sent && <Badge>Day 6 ✓</Badge>}
              </div>
            </div>
          </div>
        )}
      </div>
      
      <div className="card-actions">
        {isPending && (
          <>
            {canOverride && (
              <Button
                variant="danger"
                onClick={() => onOverride(request.user_id)}
                icon="⚡"
              >
                Override (Delete Now)
              </Button>
            )}
            <Button
              variant="secondary"
              onClick={() => onCancel(request.user_id, request.cancellation_token)}
              icon="✖️"
            >
              Cancel Deletion
            </Button>
          </>
        )}
      </div>
    </div>
  );
};
```

### Real-time WebSocket Integration
```typescript
// frontend/src/services/websocket.service.ts
export class WebSocketService {
  private socket: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private subscriptions = new Map<string, Set<Function>>();
  
  connect(token: string): void {
    const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`;
    
    this.socket = new WebSocket(wsUrl);
    
    this.socket.onopen = () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
      
      // Authenticate
      this.send('auth', { token });
    };
    
    this.socket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      this.handleMessage(message);
    };
    
    this.socket.onclose = () => {
      console.log('WebSocket disconnected');
      this.attemptReconnect();
    };
    
    this.socket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }
  
  private handleMessage(message: any): void {
    const { type, data } = message;
    
    // Notify all subscribers for this message type
    const subscribers = this.subscriptions.get(type);
    if (subscribers) {
      subscribers.forEach(callback => callback(data));
    }
  }
  
  subscribe(type: string, callback: Function): () => void {
    if (!this.subscriptions.has(type)) {
      this.subscriptions.set(type, new Set());
    }
    
    this.subscriptions.get(type)!.add(callback);
    
    // Return unsubscribe function
    return () => {
      this.subscriptions.get(type)?.delete(callback);
    };
  }
  
  send(type: string, data: any): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ type, data }));
    }
  }
  
  private attemptReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
      
      setTimeout(() => {
        console.log(`Attempting reconnect ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
        const token = localStorage.getItem('access_token');
        if (token) {
          this.connect(token);
        }
      }, delay);
    }
  }
}

// Hook for WebSocket subscriptions
export const useWebSocket = (type: string, callback: (data: any) => void) => {
  const wsService = useRef(new WebSocketService());
  
  useEffect(() => {
    const unsubscribe = wsService.current.subscribe(type, callback);
    return unsubscribe;
  }, [type, callback]);
};
```

## 🧪 Testing Requirements
- [ ] Component tests for all admin UI components
- [ ] Integration tests for admin workflows
- [ ] RBAC enforcement tests
- [ ] Real-time update tests
- [ ] Performance tests for large data sets
- [ ] Accessibility tests (WCAG 2.1 AA)
- [ ] Responsive design tests

## 📚 Documentation Updates
- [ ] Admin dashboard user guide
- [ ] Component documentation
- [ ] WebSocket integration guide
- [ ] Troubleshooting guide

## 🔗 Dependencies
- Depends on: #8, #11 (API and auth ready)
- Blocks: #13 (E2E testing)

## 📊 Success Metrics
- Page load time < 2 seconds
- Real-time updates < 100ms latency
- Support for 10,000+ users in list
- Zero unauthorized access incidents

---

**Estimated Effort**: 13 story points
**Sprint**: 4 (Frontend Implementation)
**Target Completion**: Week 8