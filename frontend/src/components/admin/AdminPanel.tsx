import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { AdminDashboard } from './AdminDashboard';
import { UserManagement } from './UserManagement';
import { FeatureFlagManager } from './FeatureFlagManager';
import { SystemConfiguration } from './SystemConfiguration';
import { InvitationManager } from './InvitationManager';
import { SecuritySettings } from './SecuritySettings';
import { AuditLogViewer } from './AuditLogViewer';
import { ServiceHealthMonitor } from './ServiceHealthMonitor';
import './AdminPanel.css';

interface Section {
  id: string;
  label: string;
  icon: string;
  component: React.ComponentType;
  requiredRole?: string;
}

export const AdminPanel: React.FC = () => {
  const [activeSection, setActiveSection] = useState('dashboard');
  const { user, isAdmin } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Define admin sections
  const sections: Section[] = [
    { 
      id: 'dashboard', 
      label: 'Dashboard', 
      icon: '📊', 
      component: AdminDashboard 
    },
    { 
      id: 'users', 
      label: 'Users', 
      icon: '👥', 
      component: UserManagement 
    },
    { 
      id: 'features', 
      label: 'Feature Flags', 
      icon: '🚀', 
      component: FeatureFlagManager 
    },
    { 
      id: 'config', 
      label: 'Configuration', 
      icon: '⚙️', 
      component: SystemConfiguration,
      requiredRole: 'site_admin'
    },
    { 
      id: 'invitations', 
      label: 'Invitations', 
      icon: '✉️', 
      component: InvitationManager 
    },
    { 
      id: 'security', 
      label: 'Security', 
      icon: '🔒', 
      component: SecuritySettings,
      requiredRole: 'site_admin'
    },
    { 
      id: 'audit', 
      label: 'Audit Logs', 
      icon: '📝', 
      component: AuditLogViewer 
    },
    { 
      id: 'health', 
      label: 'Service Health', 
      icon: '💚', 
      component: ServiceHealthMonitor 
    }
  ];

  // Filter sections based on user role
  const availableSections = sections.filter(section => {
    if (section.requiredRole === 'site_admin') {
      return user?.role === 'site_admin';
    }
    return true;
  });

  // Check if user has admin access
  if (!isAdmin) {
    return (
      <div className="admin-panel-unauthorized">
        <div className="unauthorized-content">
          <h1>Unauthorized Access</h1>
          <p>You do not have permission to access the admin panel.</p>
          <a href="/" className="btn btn-primary">Return to Home</a>
        </div>
      </div>
    );
  }

  const ActiveComponent = availableSections.find(s => s.id === activeSection)?.component;

  const handleSectionChange = (sectionId: string) => {
    setActiveSection(sectionId);
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="admin-panel">
      {/* Mobile Menu Toggle */}
      <button 
        className="mobile-menu-toggle"
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        aria-label="Toggle menu"
      >
        ☰
      </button>

      {/* Sidebar Navigation */}
      <div className={`admin-sidebar ${isMobileMenuOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-header">
          <h2>Admin Panel</h2>
          <span className="admin-badge">{user?.role}</span>
        </div>

        <nav className="admin-nav">
          {availableSections.map(section => (
            <button
              key={section.id}
              className={`nav-item ${activeSection === section.id ? 'active' : ''}`}
              onClick={() => handleSectionChange(section.id)}
              data-testid={`nav-${section.id}`}
            >
              <span className="nav-icon">{section.icon}</span>
              <span className="nav-label">{section.label}</span>
              {section.requiredRole === 'site_admin' && (
                <span className="nav-badge">Admin Only</span>
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="admin-info">
            <div className="admin-avatar">
              {user?.username?.charAt(0).toUpperCase()}
            </div>
            <div className="admin-details">
              <span className="admin-name">{user?.username}</span>
              <span className="admin-email">{user?.email}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="admin-content">
        <div className="content-header">
          <h1>{availableSections.find(s => s.id === activeSection)?.label}</h1>
          <div className="content-actions">
            <button 
              className="btn-refresh" 
              onClick={() => window.location.reload()}
              title="Refresh"
            >
              🔄
            </button>
            <button 
              className="btn-help" 
              onClick={() => window.open('/docs/admin', '_blank')}
              title="Help"
            >
              ❓
            </button>
          </div>
        </div>

        <div className="content-body" data-testid={`admin-${activeSection}`}>
          {ActiveComponent && <ActiveComponent />}
        </div>
      </div>

      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="mobile-overlay" 
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
    </div>
  );
};

export default AdminPanel;