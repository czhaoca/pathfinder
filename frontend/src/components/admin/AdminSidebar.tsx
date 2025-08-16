import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  FileText,
  Trash2,
  Settings,
  Shield,
  Activity,
  UserPlus,
  Key,
  AlertTriangle
} from 'lucide-react';

interface AdminSidebarProps {
  userRole: string;
}

export const AdminSidebar: React.FC<AdminSidebarProps> = ({ userRole }) => {
  const isSiteAdmin = userRole === 'site_admin';
  
  const navItems = [
    {
      label: 'Dashboard',
      path: '/admin',
      icon: LayoutDashboard,
      roles: ['admin', 'site_admin']
    },
    {
      label: 'User Management',
      path: '/admin/users',
      icon: Users,
      roles: ['admin', 'site_admin']
    },
    {
      label: 'Role Management',
      path: '/admin/roles',
      icon: Shield,
      roles: ['admin', 'site_admin']
    },
    {
      label: 'Audit Logs',
      path: '/admin/audit-logs',
      icon: FileText,
      roles: ['admin', 'site_admin']
    },
    {
      label: 'Deletion Queue',
      path: '/admin/deletion-queue',
      icon: Trash2,
      roles: ['admin', 'site_admin']
    },
    {
      label: 'Security Alerts',
      path: '/admin/security',
      icon: AlertTriangle,
      roles: ['site_admin']
    },
    {
      label: 'System Settings',
      path: '/admin/settings',
      icon: Settings,
      roles: ['site_admin']
    },
    {
      label: 'User Registration',
      path: '/admin/register-user',
      icon: UserPlus,
      roles: ['admin', 'site_admin']
    },
    {
      label: 'Access Control',
      path: '/admin/access-control',
      icon: Key,
      roles: ['site_admin']
    },
    {
      label: 'System Health',
      path: '/admin/health',
      icon: Activity,
      roles: ['site_admin']
    }
  ];
  
  const filteredItems = navItems.filter(item => 
    item.roles.includes(userRole)
  );
  
  return (
    <aside className="w-64 bg-gray-900 text-white h-screen flex flex-col">
      <div className="p-6 border-b border-gray-800">
        <h2 className="text-xl font-bold">Admin Panel</h2>
        <p className="text-sm text-gray-400 mt-1">
          {isSiteAdmin ? 'Site Administrator' : 'Administrator'}
        </p>
      </div>
      
      <nav className="flex-1 overflow-y-auto p-4">
        <ul className="space-y-1">
          {filteredItems.map(item => (
            <li key={item.path}>
              <NavLink
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                  }`
                }
                end={item.path === '/admin'}
              >
                <item.icon className="h-5 w-5" />
                <span>{item.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      
      <div className="p-4 border-t border-gray-800">
        <NavLink
          to="/dashboard"
          className="flex items-center space-x-3 px-4 py-3 text-gray-300 hover:bg-gray-800 hover:text-white rounded-lg transition-colors"
        >
          <LayoutDashboard className="h-5 w-5" />
          <span>Back to Dashboard</span>
        </NavLink>
      </div>
    </aside>
  );
};