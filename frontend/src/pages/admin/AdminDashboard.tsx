import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { authStore } from '@/stores/authStore';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { DashboardMetrics } from '@/components/admin/DashboardMetrics';
import { RecentActivity } from '@/components/admin/RecentActivity';
import { SecurityAlerts } from '@/components/admin/SecurityAlerts';
import { QuickActions } from '@/components/admin/QuickActions';
import { SystemHealthMonitor } from '@/components/admin/SystemHealthMonitor';
import { InvitationManager } from '@/components/admin/InvitationManager';
import { adminService } from '@/services/admin.service';
import { useWebSocket } from '@/hooks/useWebSocket';
import { Loader2, Bell, User } from 'lucide-react';

interface DashboardData {
  metrics: {
    totalUsers: number;
    userGrowth: number;
    activeSessions: number;
    failedLogins: number;
    pendingApprovals: number;
  };
  alerts: SecurityAlert[];
}

interface SecurityAlert {
  id: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  timestamp: Date;
  resolved: boolean;
}

export const AdminDashboard: React.FC = () => {
  const { user } = authStore();
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
  
  const hasRole = (role: string) => {
    return user?.roles?.some(r => r.role_name === role) || false;
  };
  
  const isSiteAdmin = hasRole('site_admin');
  const isAdmin = hasRole('admin');
  
  // Real-time updates
  useWebSocket('dashboard:update', (data) => {
    if (data.metrics) {
      setDashboardData(prev => prev ? { ...prev, metrics: data.metrics } : null);
    }
  });
  
  useWebSocket('security:alert', (alert) => {
    setAlerts(prev => [alert, ...prev]);
  });
  
  useEffect(() => {
    loadDashboardData();
  }, []);
  
  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [metricsData, alertsData] = await Promise.all([
        adminService.getDashboardMetrics(),
        adminService.getSecurityAlerts()
      ]);
      
      setDashboardData({
        metrics: metricsData,
        alerts: alertsData
      });
      setAlerts(alertsData);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };
  
  if (!isAdmin && !isSiteAdmin) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return (
    <div className="flex h-screen bg-gray-50">
      <AdminSidebar userRole={user?.roles?.[0]?.role_name || 'admin'} />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="px-6 py-4 flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
            <div className="flex items-center space-x-4">
              <div className="relative">
                <Bell className="h-6 w-6 text-gray-500 cursor-pointer hover:text-gray-700" />
                {alerts.filter(a => !a.resolved).length > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 rounded-full text-white text-xs flex items-center justify-center">
                    {alerts.filter(a => !a.resolved).length}
                  </span>
                )}
              </div>
              <div className="flex items-center space-x-2">
                <User className="h-6 w-6 text-gray-500" />
                <span className="text-sm text-gray-700">{user?.username}</span>
              </div>
            </div>
          </div>
        </header>
        
        <main className="flex-1 overflow-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          ) : (
            <div className="space-y-6">
              <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <DashboardMetrics data={dashboardData?.metrics || null} />
              </section>
              
              {(isSiteAdmin || alerts.length > 0) && (
                <section className="bg-white rounded-lg shadow-sm">
                  <div className="px-6 py-4 border-b border-gray-200">
                    <h2 className="text-lg font-semibold text-gray-900">Security Alerts</h2>
                  </div>
                  <div className="p-6">
                    <SecurityAlerts 
                      alerts={alerts}
                      canDismiss={isSiteAdmin}
                      onDismiss={(id) => {
                        setAlerts(prev => prev.map(a => a.id === id ? { ...a, resolved: true } : a));
                      }}
                    />
                  </div>
                </section>
              )}
              
              <section className="bg-white rounded-lg shadow-sm">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-900">Quick Actions</h2>
                </div>
                <div className="p-6">
                  <QuickActions role={user?.roles?.[0]?.role_name || 'admin'} />
                </div>
              </section>
              
              <section className="bg-white rounded-lg shadow-sm">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
                </div>
                <div className="p-6">
                  <RecentActivity limit={10} />
                </div>
              </section>
              
              {isSiteAdmin && (
                <section className="bg-white rounded-lg shadow-sm">
                  <div className="px-6 py-4 border-b border-gray-200">
                    <h2 className="text-lg font-semibold text-gray-900">System Health</h2>
                  </div>
                  <div className="p-6">
                    <SystemHealthMonitor />
                  </div>
                </section>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default AdminDashboard;