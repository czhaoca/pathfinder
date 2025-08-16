/**
 * Configuration Manager Component
 * 
 * Main dashboard for configuration management:
 * - System configuration overview
 * - Environment-specific settings
 * - Feature flag management
 * - Rate limiting configuration
 * - Template management
 * - Audit trail viewing
 */

import React, { useState, useEffect } from 'react';
import { Card } from '../ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Alert, AlertDescription } from '../ui/alert';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { ErrorMessage } from '../common/ErrorMessage';
import { useAuth } from '../../hooks/useAuth';
import { configurationService } from '../../services/configurationService';

// Child components
import ConfigurationList from './ConfigurationList';
import FeatureFlagManager from './FeatureFlagManager';
import RateLimitManager from './RateLimitManager';
import TemplateManager from './TemplateManager';
import AuditTrail from './AuditTrail';
import EnvironmentSelector from './EnvironmentSelector';

interface ConfigurationStats {
  total_configurations: number;
  active_configurations: number;
  feature_flags: number;
  rate_limits: number;
  templates: number;
  recent_changes: number;
}

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'error';
  database: {
    configurations: number;
    feature_flags: number;
    rate_limits: number;
  };
  cache: {
    local_cache_size: number;
    feature_flag_cache_size: number;
  };
  restart_required: string[];
}

const ConfigurationManager: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('configurations');
  const [environment, setEnvironment] = useState('development');
  const [stats, setStats] = useState<ConfigurationStats | null>(null);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDashboardData();
  }, [environment]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [statsData, healthData] = await Promise.all([
        configurationService.getStats(environment),
        configurationService.getHealth()
      ]);

      setStats(statsData);
      setHealth(healthData);
    } catch (err) {
      console.error('Error loading configuration dashboard:', err);
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    loadDashboardData();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return <ErrorMessage message={error} onRetry={loadDashboardData} />;
  }

  // Check if user has admin permissions
  const isAdmin = user?.roles?.includes('admin') || user?.roles?.includes('site_admin');
  
  if (!isAdmin) {
    return (
      <Alert className="m-4">
        <AlertDescription>
          You need administrator privileges to access configuration management.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Configuration Management</h1>
          <p className="text-muted-foreground">
            Manage system configurations, feature flags, and rate limits
          </p>
        </div>
        <div className="flex items-center gap-4">
          <EnvironmentSelector 
            value={environment} 
            onChange={setEnvironment}
          />
          <Button onClick={handleRefresh} variant="outline">
            Refresh
          </Button>
        </div>
      </div>

      {/* System Health Status */}
      {health && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">System Health</h3>
            <Badge 
              variant={health.status === 'healthy' ? 'default' : 
                      health.status === 'degraded' ? 'secondary' : 'destructive'}
            >
              {health.status.toUpperCase()}
            </Badge>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="text-center">
              <div className="text-2xl font-bold">{health.database.configurations}</div>
              <div className="text-sm text-muted-foreground">Configurations</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{health.database.feature_flags}</div>
              <div className="text-sm text-muted-foreground">Feature Flags</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{health.database.rate_limits}</div>
              <div className="text-sm text-muted-foreground">Rate Limits</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{health.cache.local_cache_size}</div>
              <div className="text-sm text-muted-foreground">Cache Entries</div>
            </div>
          </div>

          {health.restart_required.length > 0 && (
            <Alert>
              <AlertDescription>
                <strong>Restart Required:</strong> The following configurations require a system restart: {' '}
                {health.restart_required.join(', ')}
              </AlertDescription>
            </Alert>
          )}
        </Card>
      )}

      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{stats.total_configurations}</div>
            <div className="text-sm text-muted-foreground">Total Configs</div>
          </Card>
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{stats.active_configurations}</div>
            <div className="text-sm text-muted-foreground">Active Configs</div>
          </Card>
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-purple-600">{stats.feature_flags}</div>
            <div className="text-sm text-muted-foreground">Feature Flags</div>
          </Card>
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-orange-600">{stats.rate_limits}</div>
            <div className="text-sm text-muted-foreground">Rate Limits</div>
          </Card>
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-teal-600">{stats.templates}</div>
            <div className="text-sm text-muted-foreground">Templates</div>
          </Card>
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-red-600">{stats.recent_changes}</div>
            <div className="text-sm text-muted-foreground">Recent Changes</div>
          </Card>
        </div>
      )}

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="configurations">Configurations</TabsTrigger>
          <TabsTrigger value="features">Feature Flags</TabsTrigger>
          <TabsTrigger value="ratelimits">Rate Limits</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="audit">Audit Trail</TabsTrigger>
        </TabsList>

        <TabsContent value="configurations" className="space-y-4">
          <ConfigurationList 
            environment={environment}
            onConfigurationChange={handleRefresh}
          />
        </TabsContent>

        <TabsContent value="features" className="space-y-4">
          <FeatureFlagManager 
            environment={environment}
            onFeatureFlagChange={handleRefresh}
          />
        </TabsContent>

        <TabsContent value="ratelimits" className="space-y-4">
          <RateLimitManager 
            environment={environment}
            onRateLimitChange={handleRefresh}
          />
        </TabsContent>

        <TabsContent value="templates" className="space-y-4">
          <TemplateManager 
            environment={environment}
            onTemplateChange={handleRefresh}
          />
        </TabsContent>

        <TabsContent value="audit" className="space-y-4">
          <AuditTrail 
            environment={environment}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ConfigurationManager;