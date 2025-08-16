import React, { useEffect, useState } from 'react';
import { adminService } from '@/services/admin.service';
import { Activity, Database, Server, Cpu, HardDrive, Wifi } from 'lucide-react';

interface SystemHealth {
  cpu: number;
  memory: number;
  disk: number;
  database: {
    connected: boolean;
    latency: number;
    activeConnections: number;
  };
  api: {
    status: 'healthy' | 'degraded' | 'down';
    responseTime: number;
    errorRate: number;
  };
  websocket: {
    connected: boolean;
    clients: number;
  };
}

export const SystemHealthMonitor: React.FC = () => {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    loadSystemHealth();
    const interval = setInterval(loadSystemHealth, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);
  
  const loadSystemHealth = async () => {
    try {
      const data = await adminService.getSystemHealth();
      setHealth(data);
    } catch (error) {
      console.error('Failed to load system health:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const getStatusColor = (value: number, thresholds: { warning: number; critical: number }) => {
    if (value >= thresholds.critical) return 'text-red-600 bg-red-100';
    if (value >= thresholds.warning) return 'text-yellow-600 bg-yellow-100';
    return 'text-green-600 bg-green-100';
  };
  
  const getApiStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'text-green-600 bg-green-100';
      case 'degraded':
        return 'text-yellow-600 bg-yellow-100';
      case 'down':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };
  
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-gray-50 rounded-lg p-4 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/2 mb-3"></div>
            <div className="h-8 bg-gray-200 rounded w-3/4"></div>
          </div>
        ))}
      </div>
    );
  }
  
  if (!health) {
    return (
      <div className="text-center py-8 text-gray-500">
        Unable to load system health data
      </div>
    );
  }
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-600">CPU Usage</span>
          <Cpu className="h-4 w-4 text-gray-400" />
        </div>
        <div className="flex items-baseline space-x-2">
          <span className="text-2xl font-bold text-gray-900">{health.cpu}%</span>
          <span className={`text-xs px-2 py-1 rounded-full ${
            getStatusColor(health.cpu, { warning: 70, critical: 90 })
          }`}>
            {health.cpu < 70 ? 'Normal' : health.cpu < 90 ? 'High' : 'Critical'}
          </span>
        </div>
        <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full ${
              health.cpu < 70 ? 'bg-green-500' : health.cpu < 90 ? 'bg-yellow-500' : 'bg-red-500'
            }`}
            style={{ width: `${Math.min(health.cpu, 100)}%` }}
          ></div>
        </div>
      </div>
      
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-600">Memory Usage</span>
          <Server className="h-4 w-4 text-gray-400" />
        </div>
        <div className="flex items-baseline space-x-2">
          <span className="text-2xl font-bold text-gray-900">{health.memory}%</span>
          <span className={`text-xs px-2 py-1 rounded-full ${
            getStatusColor(health.memory, { warning: 80, critical: 95 })
          }`}>
            {health.memory < 80 ? 'Normal' : health.memory < 95 ? 'High' : 'Critical'}
          </span>
        </div>
        <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full ${
              health.memory < 80 ? 'bg-green-500' : health.memory < 95 ? 'bg-yellow-500' : 'bg-red-500'
            }`}
            style={{ width: `${Math.min(health.memory, 100)}%` }}
          ></div>
        </div>
      </div>
      
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-600">Disk Usage</span>
          <HardDrive className="h-4 w-4 text-gray-400" />
        </div>
        <div className="flex items-baseline space-x-2">
          <span className="text-2xl font-bold text-gray-900">{health.disk}%</span>
          <span className={`text-xs px-2 py-1 rounded-full ${
            getStatusColor(health.disk, { warning: 85, critical: 95 })
          }`}>
            {health.disk < 85 ? 'Normal' : health.disk < 95 ? 'High' : 'Critical'}
          </span>
        </div>
        <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full ${
              health.disk < 85 ? 'bg-green-500' : health.disk < 95 ? 'bg-yellow-500' : 'bg-red-500'
            }`}
            style={{ width: `${Math.min(health.disk, 100)}%` }}
          ></div>
        </div>
      </div>
      
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-600">Database</span>
          <Database className="h-4 w-4 text-gray-400" />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">Status</span>
            <span className={`text-xs px-2 py-1 rounded-full ${
              health.database.connected ? 'text-green-600 bg-green-100' : 'text-red-600 bg-red-100'
            }`}>
              {health.database.connected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">Latency</span>
            <span className="text-xs font-medium">{health.database.latency}ms</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">Connections</span>
            <span className="text-xs font-medium">{health.database.activeConnections}</span>
          </div>
        </div>
      </div>
      
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-600">API Status</span>
          <Activity className="h-4 w-4 text-gray-400" />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">Status</span>
            <span className={`text-xs px-2 py-1 rounded-full ${getApiStatusColor(health.api.status)}`}>
              {health.api.status}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">Response Time</span>
            <span className="text-xs font-medium">{health.api.responseTime}ms</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">Error Rate</span>
            <span className="text-xs font-medium">{health.api.errorRate}%</span>
          </div>
        </div>
      </div>
      
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-600">WebSocket</span>
          <Wifi className="h-4 w-4 text-gray-400" />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">Status</span>
            <span className={`text-xs px-2 py-1 rounded-full ${
              health.websocket.connected ? 'text-green-600 bg-green-100' : 'text-red-600 bg-red-100'
            }`}>
              {health.websocket.connected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">Active Clients</span>
            <span className="text-xs font-medium">{health.websocket.clients}</span>
          </div>
        </div>
      </div>
    </div>
  );
};