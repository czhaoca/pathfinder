import React, { useState } from 'react';
import { X, User, Mail, Shield, Calendar, Activity, Key } from 'lucide-react';
import { format } from 'date-fns';

interface UserDetails {
  id: string;
  username: string;
  email: string;
  roles: { role_name: string }[];
  account_status: 'active' | 'inactive' | 'suspended' | 'pending';
  last_login: Date | null;
  created_at: Date;
  mfa_enabled?: boolean;
  email_verified?: boolean;
}

interface UserDetailsModalProps {
  user: UserDetails;
  onClose: () => void;
  onUpdate: () => void;
}

export const UserDetailsModal: React.FC<UserDetailsModalProps> = ({
  user,
  onClose,
  onUpdate
}) => {
  const [activeTab, setActiveTab] = useState<'details' | 'activity' | 'sessions'>('details');
  
  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-full max-w-3xl shadow-lg rounded-lg bg-white">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">User Details</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
        
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            <button
              onClick={() => setActiveTab('details')}
              className={`px-6 py-3 text-sm font-medium ${
                activeTab === 'details'
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Details
            </button>
            <button
              onClick={() => setActiveTab('activity')}
              className={`px-6 py-3 text-sm font-medium ${
                activeTab === 'activity'
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Activity
            </button>
            <button
              onClick={() => setActiveTab('sessions')}
              className={`px-6 py-3 text-sm font-medium ${
                activeTab === 'sessions'
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Sessions
            </button>
          </nav>
        </div>
        
        <div className="py-6">
          {activeTab === 'details' && (
            <div className="space-y-6">
              <div className="flex items-start space-x-4">
                <div className="h-16 w-16 rounded-full bg-gray-200 flex items-center justify-center">
                  <span className="text-2xl font-medium text-gray-600">
                    {user.username.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1">
                  <h4 className="text-xl font-medium text-gray-900">{user.username}</h4>
                  <p className="text-sm text-gray-500">{user.email}</p>
                  <div className="flex items-center space-x-2 mt-2">
                    <span className={`inline-flex items-center px-2 py-1 text-xs rounded-full ${
                      user.account_status === 'active'
                        ? 'bg-green-100 text-green-800'
                        : user.account_status === 'suspended'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {user.account_status}
                    </span>
                    {user.roles.map(role => (
                      <span
                        key={role.role_name}
                        className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full"
                      >
                        {role.role_name}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <div className="flex items-center space-x-2 text-sm text-gray-500 mb-1">
                    <User className="h-4 w-4" />
                    <span>User ID</span>
                  </div>
                  <p className="text-sm font-mono text-gray-900">{user.id}</p>
                </div>
                
                <div>
                  <div className="flex items-center space-x-2 text-sm text-gray-500 mb-1">
                    <Mail className="h-4 w-4" />
                    <span>Email Verified</span>
                  </div>
                  <p className="text-sm text-gray-900">
                    {user.email_verified ? 'Yes' : 'No'}
                  </p>
                </div>
                
                <div>
                  <div className="flex items-center space-x-2 text-sm text-gray-500 mb-1">
                    <Key className="h-4 w-4" />
                    <span>MFA Enabled</span>
                  </div>
                  <p className="text-sm text-gray-900">
                    {user.mfa_enabled ? 'Yes' : 'No'}
                  </p>
                </div>
                
                <div>
                  <div className="flex items-center space-x-2 text-sm text-gray-500 mb-1">
                    <Calendar className="h-4 w-4" />
                    <span>Created</span>
                  </div>
                  <p className="text-sm text-gray-900">
                    {format(new Date(user.created_at), 'MMM d, yyyy h:mm a')}
                  </p>
                </div>
                
                <div>
                  <div className="flex items-center space-x-2 text-sm text-gray-500 mb-1">
                    <Activity className="h-4 w-4" />
                    <span>Last Login</span>
                  </div>
                  <p className="text-sm text-gray-900">
                    {user.last_login 
                      ? format(new Date(user.last_login), 'MMM d, yyyy h:mm a')
                      : 'Never'
                    }
                  </p>
                </div>
              </div>
              
              <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    // Handle edit
                    onUpdate();
                  }}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                >
                  Edit User
                </button>
              </div>
            </div>
          )}
          
          {activeTab === 'activity' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-500">Recent activity for this user will be displayed here.</p>
            </div>
          )}
          
          {activeTab === 'sessions' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-500">Active sessions for this user will be displayed here.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};