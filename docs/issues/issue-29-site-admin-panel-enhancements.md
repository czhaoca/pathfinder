# Issue #29: Site Admin Management Panel Enhancements

## Title
Enhance Site Admin Panel with Feature Flags, System Configuration, and User Management

## User Story
As a site administrator, I want a comprehensive admin panel with all system management tools in one place so that I can efficiently configure the platform, manage users, and control features without direct database access.

## Description
Enhance the existing admin panel to include feature flag controls, system configuration interface, security settings management, and user invitation interface. This creates a centralized hub for all administrative functions with a consistent, intuitive UI that integrates with existing admin features.

## Acceptance Criteria

### Admin Panel Structure
- [ ] Unified navigation with all admin sections
- [ ] Role-based access to different admin features
- [ ] Dashboard with system health overview
- [ ] Quick actions for common tasks
- [ ] Search functionality across all admin features
- [ ] Mobile-responsive design

### Feature Management
- [ ] Feature flag control interface (from Issue #24)
- [ ] System configuration editor
- [ ] Environment variable management
- [ ] Service health monitoring
- [ ] Background job management
- [ ] Cache management interface

### User Management
- [ ] User invitation interface (from Issue #22)
- [ ] User search and filtering
- [ ] Bulk user operations
- [ ] User impersonation (for support)
- [ ] Account status management
- [ ] Permission and role assignment

### Security Settings
- [ ] Security policy configuration
- [ ] Rate limiting settings
- [ ] CAPTCHA configuration
- [ ] Audit log viewer
- [ ] Security alerts configuration
- [ ] Backup and restore interface

## Technical Implementation

### Admin Panel Architecture

```javascript
// backend/src/api/routes/adminRoutes.js
const adminRouter = express.Router();

// Middleware
adminRouter.use(authenticate);
adminRouter.use(authorize('admin'));
adminRouter.use(auditLog('admin_access'));

// Dashboard
adminRouter.get('/dashboard', async (req, res) => {
  const dashboard = await adminService.getDashboardData();
  res.json(dashboard);
});

// System Configuration
adminRouter.get('/config', async (req, res) => {
  const config = await adminService.getSystemConfig();
  res.json(config);
});

adminRouter.put('/config/:key', validateConfig, async (req, res) => {
  const { key } = req.params;
  const { value, reason } = req.body;
  
  const updated = await adminService.updateConfig(key, value, reason, req.user.id);
  res.json(updated);
});

// Service Management
adminRouter.get('/services/health', async (req, res) => {
  const health = await adminService.getServicesHealth();
  res.json(health);
});

adminRouter.post('/services/:service/restart', async (req, res) => {
  const { service } = req.params;
  const result = await adminService.restartService(service, req.user.id);
  res.json(result);
});

// Background Jobs
adminRouter.get('/jobs', async (req, res) => {
  const jobs = await adminService.getBackgroundJobs();
  res.json(jobs);
});

adminRouter.post('/jobs/:jobId/retry', async (req, res) => {
  const { jobId } = req.params;
  const result = await adminService.retryJob(jobId);
  res.json(result);
});

// Cache Management
adminRouter.get('/cache/stats', async (req, res) => {
  const stats = await cacheService.getStats();
  res.json(stats);
});

adminRouter.delete('/cache/:pattern', async (req, res) => {
  const { pattern } = req.params;
  const cleared = await cacheService.clearPattern(pattern);
  res.json({ cleared });
});

// User Management
adminRouter.get('/users', async (req, res) => {
  const { page, limit, search, status, role } = req.query;
  const users = await adminService.getUsers({ page, limit, search, status, role });
  res.json(users);
});

adminRouter.post('/users/:userId/impersonate', async (req, res) => {
  const { userId } = req.params;
  const token = await adminService.createImpersonationToken(userId, req.user.id);
  res.json({ token });
});

adminRouter.put('/users/:userId/status', async (req, res) => {
  const { userId } = req.params;
  const { status, reason } = req.body;
  
  const updated = await adminService.updateUserStatus(userId, status, reason, req.user.id);
  res.json(updated);
});

// Security Settings
adminRouter.get('/security/policies', async (req, res) => {
  const policies = await securityService.getPolicies();
  res.json(policies);
});

adminRouter.put('/security/policies/:policyId', async (req, res) => {
  const { policyId } = req.params;
  const { settings } = req.body;
  
  const updated = await securityService.updatePolicy(policyId, settings, req.user.id);
  res.json(updated);
});

// Audit Logs
adminRouter.get('/audit-logs', async (req, res) => {
  const { startDate, endDate, userId, action, page, limit } = req.query;
  const logs = await auditService.getLogs({
    startDate,
    endDate,
    userId,
    action,
    page,
    limit
  });
  res.json(logs);
});

// System Backups
adminRouter.get('/backups', async (req, res) => {
  const backups = await backupService.listBackups();
  res.json(backups);
});

adminRouter.post('/backups', async (req, res) => {
  const { type, description } = req.body;
  const backup = await backupService.createBackup(type, description, req.user.id);
  res.json(backup);
});

module.exports = adminRouter;
```

### Admin Service Implementation

```javascript
// backend/src/services/adminService.js
class AdminService {
  constructor(repositories, services) {
    this.userRepository = repositories.user;
    this.configRepository = repositories.config;
    this.auditService = services.audit;
    this.cacheService = services.cache;
    this.healthChecks = new Map();
    
    this.initializeHealthChecks();
  }

  async getDashboardData() {
    const [
      systemStats,
      userStats,
      recentActivity,
      alerts,
      jobStatus
    ] = await Promise.all([
      this.getSystemStats(),
      this.getUserStats(),
      this.getRecentActivity(),
      this.getActiveAlerts(),
      this.getJobStatus()
    ]);

    return {
      systemStats,
      userStats,
      recentActivity,
      alerts,
      jobStatus,
      timestamp: new Date()
    };
  }

  async getSystemStats() {
    return {
      uptime: process.uptime(),
      memory: {
        used: process.memoryUsage().heapUsed,
        total: process.memoryUsage().heapTotal,
        percentage: (process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) * 100
      },
      cpu: process.cpuUsage(),
      database: await this.getDatabaseStats(),
      cache: await this.cacheService.getStats(),
      storage: await this.getStorageStats()
    };
  }

  async getUserStats() {
    const now = new Date();
    const today = new Date(now.setHours(0, 0, 0, 0));
    const thisWeek = new Date(now.setDate(now.getDate() - 7));
    const thisMonth = new Date(now.setMonth(now.getMonth() - 1));

    return {
      total: await this.userRepository.countTotal(),
      active: await this.userRepository.countActive(),
      new: {
        today: await this.userRepository.countNewSince(today),
        week: await this.userRepository.countNewSince(thisWeek),
        month: await this.userRepository.countNewSince(thisMonth)
      },
      byStatus: await this.userRepository.countByStatus(),
      byRole: await this.userRepository.countByRole()
    };
  }

  async getSystemConfig() {
    const config = await this.configRepository.getAll();
    
    // Group by category
    const grouped = {};
    for (const item of config) {
      if (!grouped[item.category]) {
        grouped[item.category] = [];
      }
      grouped[item.category].push({
        key: item.key,
        value: item.value,
        type: item.type,
        description: item.description,
        editable: item.editable,
        sensitive: item.sensitive,
        lastModified: item.updatedAt,
        modifiedBy: item.modifiedBy
      });
    }

    return grouped;
  }

  async updateConfig(key, value, reason, userId) {
    // Validate configuration change
    const config = await this.configRepository.getByKey(key);
    if (!config) {
      throw new Error('Configuration key not found');
    }

    if (!config.editable) {
      throw new Error('Configuration is not editable');
    }

    // Validate value type
    if (!this.validateConfigValue(value, config.type)) {
      throw new Error(`Invalid value type. Expected ${config.type}`);
    }

    // Create backup of current value
    await this.configRepository.createBackup(key, config.value, userId);

    // Update configuration
    await this.configRepository.update(key, value, userId);

    // Clear relevant caches
    await this.cacheService.clearPattern(`config:${key}:*`);

    // Audit log
    await this.auditService.log({
      userId,
      action: 'CONFIG_UPDATE',
      resourceType: 'configuration',
      resourceId: key,
      details: {
        oldValue: config.value,
        newValue: value,
        reason
      }
    });

    // Broadcast configuration change
    this.broadcastConfigChange(key, value);

    return { success: true, key, value };
  }

  async getServicesHealth() {
    const services = [
      { name: 'database', check: () => this.checkDatabase() },
      { name: 'redis', check: () => this.checkRedis() },
      { name: 'mcp_server', check: () => this.checkMCPServer() },
      { name: 'email', check: () => this.checkEmailService() },
      { name: 'storage', check: () => this.checkStorage() }
    ];

    const health = {};
    for (const service of services) {
      try {
        const result = await service.check();
        health[service.name] = {
          status: result.healthy ? 'healthy' : 'unhealthy',
          responseTime: result.responseTime,
          details: result.details,
          lastCheck: new Date()
        };
      } catch (error) {
        health[service.name] = {
          status: 'error',
          error: error.message,
          lastCheck: new Date()
        };
      }
    }

    return health;
  }

  async createImpersonationToken(targetUserId, adminUserId) {
    // Verify target user exists
    const targetUser = await this.userRepository.findById(targetUserId);
    if (!targetUser) {
      throw new Error('User not found');
    }

    // Create impersonation token with metadata
    const token = await this.authService.generateImpersonationToken(
      targetUser,
      adminUserId,
      {
        expiresIn: '1h',
        scope: 'impersonation',
        adminId: adminUserId
      }
    );

    // Audit log
    await this.auditService.log({
      userId: adminUserId,
      action: 'USER_IMPERSONATION_START',
      resourceType: 'user',
      resourceId: targetUserId,
      details: {
        targetUser: targetUser.username,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000)
      }
    });

    return token;
  }

  async updateUserStatus(userId, status, reason, adminUserId) {
    const validStatuses = ['active', 'inactive', 'suspended', 'deleted'];
    if (!validStatuses.includes(status)) {
      throw new Error('Invalid status');
    }

    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const oldStatus = user.accountStatus;
    await this.userRepository.updateStatus(userId, status);

    // Send notification to user if suspended/deleted
    if (['suspended', 'deleted'].includes(status)) {
      await this.notificationService.sendAccountStatusChange(
        user.email,
        status,
        reason
      );
    }

    // Invalidate user sessions if deactivated
    if (status !== 'active') {
      await this.sessionRepository.invalidateUserSessions(userId);
    }

    // Audit log
    await this.auditService.log({
      userId: adminUserId,
      action: 'USER_STATUS_CHANGE',
      resourceType: 'user',
      resourceId: userId,
      details: {
        oldStatus,
        newStatus: status,
        reason
      }
    });

    return { userId, status, updatedBy: adminUserId };
  }

  initializeHealthChecks() {
    // Set up periodic health checks
    setInterval(() => {
      this.getServicesHealth().then(health => {
        this.healthChecks.set(Date.now(), health);
        // Keep only last 100 checks
        if (this.healthChecks.size > 100) {
          const oldest = Math.min(...this.healthChecks.keys());
          this.healthChecks.delete(oldest);
        }
      });
    }, 60000); // Every minute
  }

  validateConfigValue(value, type) {
    switch (type) {
      case 'boolean':
        return typeof value === 'boolean';
      case 'number':
        return typeof value === 'number' && !isNaN(value);
      case 'string':
        return typeof value === 'string';
      case 'json':
        try {
          JSON.parse(value);
          return true;
        } catch {
          return false;
        }
      default:
        return true;
    }
  }

  broadcastConfigChange(key, value) {
    // Notify all connected services about config change
    this.eventEmitter.emit('config:changed', { key, value });
  }
}
```

### Frontend Admin Panel Components

```typescript
// frontend/src/components/admin/AdminPanel.tsx
import React, { useState } from 'react';
import { 
  AdminDashboard,
  FeatureFlagManager,
  SystemConfiguration,
  UserManagement,
  SecuritySettings,
  AuditLogViewer
} from './sections';

export const AdminPanel: React.FC = () => {
  const [activeSection, setActiveSection] = useState('dashboard');
  const { isAdmin } = useAuth();

  if (!isAdmin) {
    return <Unauthorized />;
  }

  const sections = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊', component: AdminDashboard },
    { id: 'users', label: 'Users', icon: '👥', component: UserManagement },
    { id: 'features', label: 'Feature Flags', icon: '🚀', component: FeatureFlagManager },
    { id: 'config', label: 'Configuration', icon: '⚙️', component: SystemConfiguration },
    { id: 'security', label: 'Security', icon: '🔒', component: SecuritySettings },
    { id: 'audit', label: 'Audit Logs', icon: '📝', component: AuditLogViewer }
  ];

  const ActiveComponent = sections.find(s => s.id === activeSection)?.component;

  return (
    <div className="admin-panel">
      <div className="admin-sidebar">
        <h2>Admin Panel</h2>
        <nav className="admin-nav">
          {sections.map(section => (
            <button
              key={section.id}
              className={`nav-item ${activeSection === section.id ? 'active' : ''}`}
              onClick={() => setActiveSection(section.id)}
            >
              <span className="icon">{section.icon}</span>
              <span className="label">{section.label}</span>
            </button>
          ))}
        </nav>
      </div>

      <div className="admin-content">
        {ActiveComponent && <ActiveComponent />}
      </div>
    </div>
  );
};

// System Configuration Component
export const SystemConfiguration: React.FC = () => {
  const [config, setConfig] = useState<ConfigGroups>({});
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const { updateConfig, loading } = useSystemConfig();

  const handleUpdateConfig = async (key: string, value: any) => {
    const reason = prompt('Please provide a reason for this change:');
    if (!reason) return;

    try {
      await updateConfig(key, value, reason);
      toast.success('Configuration updated');
      setEditingKey(null);
    } catch (error) {
      toast.error('Failed to update configuration');
    }
  };

  const filteredConfig = Object.entries(config).reduce((acc, [category, items]) => {
    const filtered = items.filter(item => 
      item.key.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.description?.toLowerCase().includes(searchTerm.toLowerCase())
    );
    if (filtered.length > 0) {
      acc[category] = filtered;
    }
    return acc;
  }, {} as ConfigGroups);

  return (
    <div className="system-configuration">
      <div className="config-header">
        <h2>System Configuration</h2>
        <input
          type="search"
          placeholder="Search configuration..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="config-search"
        />
      </div>

      <div className="config-groups">
        {Object.entries(filteredConfig).map(([category, items]) => (
          <div key={category} className="config-group">
            <h3>{formatCategoryName(category)}</h3>
            
            <div className="config-items">
              {items.map(item => (
                <div key={item.key} className="config-item">
                  <div className="config-info">
                    <div className="config-key">{item.key}</div>
                    <div className="config-description">{item.description}</div>
                    {item.lastModified && (
                      <div className="config-meta">
                        Last modified: {formatDate(item.lastModified)} by {item.modifiedBy}
                      </div>
                    )}
                  </div>

                  <div className="config-value">
                    {editingKey === item.key ? (
                      <ConfigEditor
                        value={item.value}
                        type={item.type}
                        onSave={(value) => handleUpdateConfig(item.key, value)}
                        onCancel={() => setEditingKey(null)}
                      />
                    ) : (
                      <>
                        <span className={item.sensitive ? 'sensitive' : ''}>
                          {item.sensitive ? '••••••••' : formatValue(item.value, item.type)}
                        </span>
                        {item.editable && (
                          <button
                            onClick={() => setEditingKey(item.key)}
                            className="btn-edit"
                          >
                            Edit
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// User Management Component
export const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [filters, setFilters] = useState({
    search: '',
    status: 'all',
    role: 'all'
  });
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const { 
    searchUsers, 
    updateUserStatus, 
    impersonateUser,
    sendInvitation 
  } = useUserManagement();

  const handleStatusChange = async (userId: string, newStatus: string) => {
    const reason = prompt(`Reason for changing status to ${newStatus}:`);
    if (!reason) return;

    try {
      await updateUserStatus(userId, newStatus, reason);
      toast.success('User status updated');
      refreshUsers();
    } catch (error) {
      toast.error('Failed to update user status');
    }
  };

  const handleImpersonate = async (userId: string) => {
    if (!confirm('Are you sure you want to impersonate this user?')) return;

    try {
      const token = await impersonateUser(userId);
      // Store token and redirect to user view
      localStorage.setItem('impersonation_token', token);
      window.location.href = '/dashboard?impersonating=true';
    } catch (error) {
      toast.error('Failed to impersonate user');
    }
  };

  return (
    <div className="user-management">
      <div className="user-header">
        <h2>User Management</h2>
        
        <div className="user-actions">
          <button 
            onClick={() => setShowInviteModal(true)}
            className="btn-primary"
          >
            Invite Users
          </button>
          <button 
            onClick={() => exportUsers()}
            className="btn-secondary"
          >
            Export Users
          </button>
        </div>
      </div>

      <div className="user-filters">
        <input
          type="search"
          placeholder="Search users..."
          value={filters.search}
          onChange={(e) => setFilters({ ...filters, search: e.target.value })}
        />
        
        <select 
          value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value })}
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="suspended">Suspended</option>
        </select>

        <select 
          value={filters.role}
          onChange={(e) => setFilters({ ...filters, role: e.target.value })}
        >
          <option value="all">All Roles</option>
          <option value="admin">Admin</option>
          <option value="user">User</option>
        </select>
      </div>

      <div className="user-table">
        <table>
          <thead>
            <tr>
              <th>User</th>
              <th>Email</th>
              <th>Status</th>
              <th>Role</th>
              <th>Joined</th>
              <th>Last Active</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id}>
                <td>
                  <div className="user-info">
                    {user.avatar && <img src={user.avatar} alt="" />}
                    <span>{user.name}</span>
                  </div>
                </td>
                <td>{user.email}</td>
                <td>
                  <select 
                    value={user.status}
                    onChange={(e) => handleStatusChange(user.id, e.target.value)}
                    className={`status-select ${user.status}`}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </td>
                <td>{user.role}</td>
                <td>{formatDate(user.createdAt)}</td>
                <td>{formatRelativeTime(user.lastActivity)}</td>
                <td>
                  <div className="user-actions">
                    <button 
                      onClick={() => setSelectedUser(user)}
                      title="View Details"
                    >
                      👁️
                    </button>
                    <button 
                      onClick={() => handleImpersonate(user.id)}
                      title="Impersonate"
                    >
                      🎭
                    </button>
                    <button 
                      onClick={() => handleResetPassword(user.id)}
                      title="Reset Password"
                    >
                      🔑
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedUser && (
        <UserDetailModal 
          user={selectedUser}
          onClose={() => setSelectedUser(null)}
        />
      )}
    </div>
  );
};

// Service Health Monitor
export const ServiceHealthMonitor: React.FC = () => {
  const [services, setServices] = useState<ServiceHealth[]>([]);
  const { checkHealth, restartService } = useServiceHealth();

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return '#22c55e';
      case 'unhealthy': return '#f59e0b';
      case 'error': return '#ef4444';
      default: return '#6b7280';
    }
  };

  return (
    <div className="service-health">
      <h3>Service Health</h3>
      
      <div className="service-grid">
        {services.map(service => (
          <div key={service.name} className="service-card">
            <div className="service-header">
              <span 
                className="status-indicator"
                style={{ backgroundColor: getStatusColor(service.status) }}
              />
              <span className="service-name">{service.name}</span>
            </div>
            
            <div className="service-details">
              <div>Response: {service.responseTime}ms</div>
              <div>Last Check: {formatTime(service.lastCheck)}</div>
              {service.error && (
                <div className="error">{service.error}</div>
              )}
            </div>

            {service.status !== 'healthy' && (
              <button 
                onClick={() => restartService(service.name)}
                className="btn-restart"
              >
                Restart Service
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
```

## Security Considerations

1. **Access Control**
   - Role-based access to admin features
   - Granular permissions for different admin sections
   - Audit logging of all admin actions
   - Session timeout for admin access

2. **Configuration Security**
   - Encryption of sensitive configuration values
   - Change approval workflow for critical settings
   - Configuration backup before changes
   - Rollback capability for configurations

3. **Impersonation Security**
   - Time-limited impersonation tokens
   - Clear indication when impersonating
   - Audit trail of impersonation activities
   - Restricted actions during impersonation

## Testing Requirements

1. **Unit Tests**
   - Admin service methods
   - Configuration validation
   - Permission checks
   - Health check logic

2. **Integration Tests**
   - Admin panel workflows
   - Configuration updates
   - User management operations
   - Service health checks

3. **UI Tests**
   - Admin panel navigation
   - Form validations
   - Real-time updates
   - Mobile responsiveness

## Documentation Updates

- Admin panel user guide
- Configuration management guide
- Security best practices for admins
- Troubleshooting guide for services

## Dependencies

- Issue #22: Admin Invitation System
- Issue #24: Feature Flag Management
- Issue #27: User Analytics System
- WebSocket support for real-time updates

## Estimated Effort

**Large (L)** - 6-8 days

### Justification:
- Multiple admin sections to integrate
- Complex UI components
- Real-time monitoring features
- Security implementations
- Comprehensive testing

## Priority

**High** - Critical for platform administration and operations

## Labels

- `feature`
- `admin`
- `ui`
- `security`
- `management`