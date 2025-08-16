import React from 'react';
import { Users, Activity, Lock, Clock, TrendingUp, TrendingDown } from 'lucide-react';

interface MetricsData {
  totalUsers: number;
  userGrowth: number;
  activeSessions: number;
  failedLogins: number;
  pendingApprovals: number;
}

interface DashboardMetricsProps {
  data: MetricsData | null;
}

export const DashboardMetrics: React.FC<DashboardMetricsProps> = ({ data }) => {
  if (!data) {
    return (
      <>
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="bg-white rounded-lg shadow p-6 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
            <div className="h-8 bg-gray-200 rounded w-1/2"></div>
          </div>
        ))}
      </>
    );
  }
  
  const metrics = [
    {
      title: 'Total Users',
      value: data.totalUsers.toLocaleString(),
      change: data.userGrowth,
      icon: Users,
      color: 'bg-blue-100 text-blue-600',
      bgColor: 'bg-blue-50'
    },
    {
      title: 'Active Sessions',
      value: data.activeSessions.toLocaleString(),
      realTime: true,
      icon: Activity,
      color: 'bg-green-100 text-green-600',
      bgColor: 'bg-green-50'
    },
    {
      title: 'Failed Logins (24h)',
      value: data.failedLogins.toLocaleString(),
      severity: data.failedLogins > 10 ? 'warning' : 'normal',
      icon: Lock,
      color: data.failedLogins > 10 ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-600',
      bgColor: data.failedLogins > 10 ? 'bg-red-50' : 'bg-gray-50'
    },
    {
      title: 'Pending Approvals',
      value: data.pendingApprovals.toLocaleString(),
      actionable: true,
      icon: Clock,
      color: data.pendingApprovals > 0 ? 'bg-yellow-100 text-yellow-600' : 'bg-gray-100 text-gray-600',
      bgColor: data.pendingApprovals > 0 ? 'bg-yellow-50' : 'bg-gray-50'
    }
  ];
  
  return (
    <>
      {metrics.map((metric, index) => (
        <MetricCard key={index} {...metric} />
      ))}
    </>
  );
};

interface MetricCardProps {
  title: string;
  value: string;
  change?: number;
  realTime?: boolean;
  severity?: string;
  actionable?: boolean;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
}

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  change,
  realTime,
  severity,
  actionable,
  icon: Icon,
  color,
  bgColor
}) => {
  return (
    <div className={`${bgColor} rounded-lg shadow-sm border border-gray-200 p-6`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-gray-600 mb-1">{title}</p>
          <div className="flex items-baseline space-x-2">
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            {change !== undefined && (
              <span className={`text-sm flex items-center ${
                change >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {change >= 0 ? (
                  <TrendingUp className="h-4 w-4 mr-1" />
                ) : (
                  <TrendingDown className="h-4 w-4 mr-1" />
                )}
                {Math.abs(change)}%
              </span>
            )}
          </div>
          {realTime && (
            <span className="text-xs text-green-600 flex items-center mt-2">
              <span className="h-2 w-2 bg-green-600 rounded-full animate-pulse mr-1"></span>
              Real-time
            </span>
          )}
          {actionable && parseInt(value) > 0 && (
            <span className="text-xs text-blue-600 mt-2 inline-block cursor-pointer hover:underline">
              View all →
            </span>
          )}
        </div>
        <div className={`p-3 rounded-lg ${color}`}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </div>
  );
};