import React, { useState, useEffect } from 'react';
import { adminService } from '../../services/admin.service';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { ErrorMessage } from '../common/ErrorMessage';
import { toast } from 'react-toastify';
import './ServiceHealthMonitor.css';

interface ServiceHealthItem {
  status: 'healthy' | 'unhealthy' | 'degraded' | 'error';
  responseTime?: number;
  details?: any;
  lastCheck: Date;
  error?: string;
}

interface ServiceHealth {
  [service: string]: ServiceHealthItem;
}

interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  keys: number;
  evictions: number;
}

interface BackgroundJob {
  id: string;
  type: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  retryCount: number;
}

export const ServiceHealthMonitor: React.FC = () => {
  const [serviceHealth, setServiceHealth] = useState<ServiceHealth | null>(null);
  const [cacheStats, setCacheStats] = useState<CacheStats | null>(null);
  const [backgroundJobs, setBackgroundJobs] = useState<BackgroundJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'health' | 'cache' | 'jobs'>('health');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [clearCachePattern, setClearCachePattern] = useState('');

  useEffect(() => {
    loadAllData();
    
    if (autoRefresh) {
      const interval = setInterval(loadAllData, 30000); // Refresh every 30 seconds
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const loadAllData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [health, cache, jobs] = await Promise.all([
        adminService.getServicesHealth(),
        adminService.getCacheStats(),
        adminService.getBackgroundJobs()
      ]);
      
      setServiceHealth(health);
      setCacheStats(cache);
      setBackgroundJobs(jobs);
    } catch (err) {
      setError('Failed to load monitoring data');
      console.error('Error loading monitoring data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRestartService = async (service: string) => {
    const reason = prompt(`Reason for restarting ${service}:`);
    if (!reason) return;

    try {
      await adminService.restartService(service, reason);
      toast.success(`Service ${service} restarted successfully`);
      await loadAllData();
    } catch (err) {
      toast.error(`Failed to restart ${service}`);
      console.error('Error restarting service:', err);
    }
  };

  const handleClearCache = async () => {
    if (!clearCachePattern) {
      toast.error('Please enter a cache pattern');
      return;
    }

    const reason = prompt(`Reason for clearing cache pattern "${clearCachePattern}":`);
    if (!reason) return;

    try {
      const result = await adminService.clearCache(clearCachePattern, reason);
      toast.success(`Cleared ${result.keysCleared} cache keys`);
      setClearCachePattern('');
      await loadAllData();
    } catch (err) {
      toast.error('Failed to clear cache');
      console.error('Error clearing cache:', err);
    }
  };

  const handleRetryJob = async (jobId: string) => {
    try {
      await adminService.retryJob(jobId);
      toast.success('Job retry initiated');
      await loadAllData();
    } catch (err) {
      toast.error('Failed to retry job');
      console.error('Error retrying job:', err);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'status-healthy';
      case 'degraded':
        return 'status-degraded';
      case 'unhealthy':
      case 'error':
        return 'status-error';
      default:
        return 'status-unknown';
    }
  };

  const getJobStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'job-completed';
      case 'running':
        return 'job-running';
      case 'queued':
        return 'job-queued';
      case 'failed':
        return 'job-failed';
      default:
        return '';
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (loading && !serviceHealth) {
    return <LoadingSpinner />;
  }

  if (error && !serviceHealth) {
    return <ErrorMessage message={error} />;
  }

  return (
    <div className="service-health-monitor">
      <div className="monitor-header">
        <h2>Service Health Monitor</h2>
        <div className="header-controls">
          <label className="auto-refresh-toggle">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            Auto-refresh
          </label>
          <button
            onClick={loadAllData}
            className="btn btn-secondary"
            disabled={loading}
          >
            🔄 Refresh Now
          </button>
        </div>
      </div>

      <div className="monitor-tabs">
        <button
          className={`tab-btn ${activeTab === 'health' ? 'active' : ''}`}
          onClick={() => setActiveTab('health')}
        >
          Service Health
        </button>
        <button
          className={`tab-btn ${activeTab === 'cache' ? 'active' : ''}`}
          onClick={() => setActiveTab('cache')}
        >
          Cache Statistics
        </button>
        <button
          className={`tab-btn ${activeTab === 'jobs' ? 'active' : ''}`}
          onClick={() => setActiveTab('jobs')}
        >
          Background Jobs
        </button>
      </div>

      {activeTab === 'health' && serviceHealth && (
        <div className="service-health-grid">
          {Object.entries(serviceHealth).map(([service, health]) => (
            <div key={service} className={`service-card ${getStatusColor(health.status)}`}>
              <div className="service-header">
                <h3>{service.replace('_', ' ').toUpperCase()}</h3>
                <span className={`status-indicator ${getStatusColor(health.status)}`}>
                  {health.status}
                </span>
              </div>
              
              <div className="service-details">
                {health.responseTime !== undefined && (
                  <div className="detail-item">
                    <span className="detail-label">Response Time:</span>
                    <span className="detail-value">{health.responseTime}ms</span>
                  </div>
                )}
                
                {health.details && (
                  <>
                    {health.details.connections !== undefined && (
                      <div className="detail-item">
                        <span className="detail-label">Connections:</span>
                        <span className="detail-value">
                          {health.details.connections} / {health.details.maxConnections || '∞'}
                        </span>
                      </div>
                    )}
                    {health.details.memory && (
                      <div className="detail-item">
                        <span className="detail-label">Memory:</span>
                        <span className="detail-value">{health.details.memory}</span>
                      </div>
                    )}
                    {health.details.error && (
                      <div className="detail-item error">
                        <span className="detail-label">Error:</span>
                        <span className="detail-value">{health.details.error}</span>
                      </div>
                    )}
                  </>
                )}
                
                {health.error && (
                  <div className="service-error">
                    {health.error}
                  </div>
                )}
                
                <div className="detail-item">
                  <span className="detail-label">Last Check:</span>
                  <span className="detail-value">
                    {new Date(health.lastCheck).toLocaleTimeString()}
                  </span>
                </div>
              </div>
              
              {(health.status === 'unhealthy' || health.status === 'error') && (
                <div className="service-actions">
                  <button
                    onClick={() => handleRestartService(service)}
                    className="btn btn-danger btn-sm"
                  >
                    Restart Service
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {activeTab === 'cache' && cacheStats && (
        <div className="cache-statistics">
          <div className="stats-grid">
            <div className="stat-card">
              <h4>Hit Rate</h4>
              <div className="stat-value large">{cacheStats.hitRate.toFixed(1)}%</div>
              <div className="stat-details">
                {cacheStats.hits.toLocaleString()} hits / {cacheStats.misses.toLocaleString()} misses
              </div>
            </div>
            
            <div className="stat-card">
              <h4>Memory Usage</h4>
              <div className="stat-value large">{cacheStats.memory.percentage.toFixed(1)}%</div>
              <div className="stat-details">
                {formatBytes(cacheStats.memory.used)} / {formatBytes(cacheStats.memory.total)}
              </div>
            </div>
            
            <div className="stat-card">
              <h4>Total Keys</h4>
              <div className="stat-value large">{cacheStats.keys.toLocaleString()}</div>
              <div className="stat-details">
                {cacheStats.evictions.toLocaleString()} evictions
              </div>
            </div>
          </div>
          
          <div className="cache-actions">
            <h4>Cache Management</h4>
            <div className="cache-clear-form">
              <input
                type="text"
                value={clearCachePattern}
                onChange={(e) => setClearCachePattern(e.target.value)}
                placeholder="Enter cache pattern (e.g., user:*, config:*)"
                className="form-input"
              />
              <button
                onClick={handleClearCache}
                className="btn btn-danger"
                disabled={!clearCachePattern}
              >
                Clear Cache
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'jobs' && (
        <div className="background-jobs">
          <div className="jobs-summary">
            <div className="summary-item">
              <span className="summary-label">Queued:</span>
              <span className="summary-value">
                {backgroundJobs.filter(j => j.status === 'queued').length}
              </span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Running:</span>
              <span className="summary-value">
                {backgroundJobs.filter(j => j.status === 'running').length}
              </span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Completed:</span>
              <span className="summary-value">
                {backgroundJobs.filter(j => j.status === 'completed').length}
              </span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Failed:</span>
              <span className="summary-value error">
                {backgroundJobs.filter(j => j.status === 'failed').length}
              </span>
            </div>
          </div>
          
          <div className="jobs-table">
            <table>
              <thead>
                <tr>
                  <th>Job Type</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Started</th>
                  <th>Completed</th>
                  <th>Retries</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {backgroundJobs.map(job => (
                  <tr key={job.id}>
                    <td>{job.type}</td>
                    <td>
                      <span className={`job-status ${getJobStatusColor(job.status)}`}>
                        {job.status}
                      </span>
                    </td>
                    <td>{new Date(job.createdAt).toLocaleString()}</td>
                    <td>{job.startedAt ? new Date(job.startedAt).toLocaleString() : '-'}</td>
                    <td>{job.completedAt ? new Date(job.completedAt).toLocaleString() : '-'}</td>
                    <td>{job.retryCount}</td>
                    <td>
                      {job.status === 'failed' && (
                        <button
                          onClick={() => handleRetryJob(job.id)}
                          className="btn btn-sm btn-secondary"
                        >
                          Retry
                        </button>
                      )}
                      {job.error && (
                        <span className="job-error" title={job.error}>
                          ⚠️
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default ServiceHealthMonitor;