import React, { useEffect, useState } from 'react';
import { adminService } from '@/services/admin.service';
import { formatDistanceToNow } from 'date-fns';
import { User, Shield, Lock, FileText, AlertTriangle, Activity } from 'lucide-react';

interface ActivityLog {
  id: string;
  type: string;
  action: string;
  actor: string;
  target?: string;
  timestamp: Date;
  result: 'success' | 'failure';
}

interface RecentActivityProps {
  limit: number;
}

export const RecentActivity: React.FC<RecentActivityProps> = ({ limit }) => {
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    loadRecentActivity();
  }, [limit]);
  
  const loadRecentActivity = async () => {
    try {
      setLoading(true);
      const data = await adminService.getRecentActivity(limit);
      setActivities(data);
    } catch (error) {
      console.error('Failed to load recent activity:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'user':
        return <User className="h-4 w-4" />;
      case 'role':
        return <Shield className="h-4 w-4" />;
      case 'auth':
        return <Lock className="h-4 w-4" />;
      case 'audit':
        return <FileText className="h-4 w-4" />;
      case 'security':
        return <AlertTriangle className="h-4 w-4" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };
  
  const getActivityColor = (type: string, result: string) => {
    if (result === 'failure') return 'text-red-600 bg-red-100';
    
    switch (type) {
      case 'security':
        return 'text-orange-600 bg-orange-100';
      case 'auth':
        return 'text-blue-600 bg-blue-100';
      case 'role':
        return 'text-purple-600 bg-purple-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };
  
  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="animate-pulse">
            <div className="flex items-center space-x-3">
              <div className="h-8 w-8 bg-gray-200 rounded-full"></div>
              <div className="flex-1">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }
  
  if (activities.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No recent activity
      </div>
    );
  }
  
  return (
    <div className="space-y-3">
      {activities.map(activity => (
        <div key={activity.id} className="flex items-start space-x-3">
          <div className={`p-2 rounded-full ${getActivityColor(activity.type, activity.result)}`}>
            {getActivityIcon(activity.type)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-gray-900">
              <span className="font-medium">{activity.actor}</span>
              {' '}
              <span className="text-gray-600">{activity.action}</span>
              {activity.target && (
                <>
                  {' '}
                  <span className="font-medium">{activity.target}</span>
                </>
              )}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
            </p>
          </div>
          {activity.result === 'failure' && (
            <span className="px-2 py-1 text-xs bg-red-100 text-red-600 rounded-full">
              Failed
            </span>
          )}
        </div>
      ))}
    </div>
  );
};