import React from 'react';
import { useNavigate } from 'react-router-dom';
import { UserPlus, Shield, FileText, Settings, Key, AlertTriangle } from 'lucide-react';

interface QuickActionsProps {
  role: string;
}

export const QuickActions: React.FC<QuickActionsProps> = ({ role }) => {
  const navigate = useNavigate();
  const isSiteAdmin = role === 'site_admin';
  
  const actions = [
    {
      label: 'Add New User',
      description: 'Register a new user account',
      icon: UserPlus,
      path: '/admin/register-user',
      color: 'bg-blue-100 text-blue-600',
      roles: ['admin', 'site_admin']
    },
    {
      label: 'Manage Roles',
      description: 'Configure user roles and permissions',
      icon: Shield,
      path: '/admin/roles',
      color: 'bg-purple-100 text-purple-600',
      roles: ['admin', 'site_admin']
    },
    {
      label: 'View Audit Logs',
      description: 'Review system activity logs',
      icon: FileText,
      path: '/admin/audit-logs',
      color: 'bg-green-100 text-green-600',
      roles: ['admin', 'site_admin']
    },
    {
      label: 'System Settings',
      description: 'Configure system-wide settings',
      icon: Settings,
      path: '/admin/settings',
      color: 'bg-gray-100 text-gray-600',
      roles: ['site_admin']
    },
    {
      label: 'Access Control',
      description: 'Manage API keys and access tokens',
      icon: Key,
      path: '/admin/access-control',
      color: 'bg-yellow-100 text-yellow-600',
      roles: ['site_admin']
    },
    {
      label: 'Security Alerts',
      description: 'View and manage security incidents',
      icon: AlertTriangle,
      path: '/admin/security',
      color: 'bg-red-100 text-red-600',
      roles: ['site_admin']
    }
  ];
  
  const filteredActions = actions.filter(action => 
    action.roles.includes(role)
  );
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {filteredActions.map((action, index) => (
        <button
          key={index}
          onClick={() => navigate(action.path)}
          className="p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow text-left"
        >
          <div className="flex items-start space-x-3">
            <div className={`p-2 rounded-lg ${action.color}`}>
              <action.icon className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-medium text-gray-900">{action.label}</h4>
              <p className="text-xs text-gray-500 mt-1">{action.description}</p>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
};