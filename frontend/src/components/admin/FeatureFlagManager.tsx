/**
 * Feature Flag Manager Component
 * 
 * Comprehensive admin interface for feature flag management
 * Includes flag CRUD, emergency controls, and real-time metrics
 */

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Alert, AlertDescription } from '../ui/alert';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { useFeatureFlags } from '../../hooks/useFeatureFlags';
import { FlagEditModal } from './FlagEditModal';
import { FlagCreateModal } from './FlagCreateModal';
import { FlagHistoryModal } from './FlagHistoryModal';
import { 
  AlertCircle, 
  Shield, 
  Activity, 
  Users, 
  Settings,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  Zap
} from 'lucide-react';

interface FeatureFlag {
  flag_id: string;
  flag_key: string;
  flag_name: string;
  description?: string;
  flag_type: 'boolean' | 'percentage' | 'variant' | 'numeric' | 'string';
  default_value: string;
  enabled: 'Y' | 'N';
  is_system_wide: 'Y' | 'N';
  category?: string;
  rollout_percentage?: number;
  targeting_rules?: any[];
  start_date?: string;
  end_date?: string;
  evaluation_count?: number;
  last_evaluated?: string;
}

export const FeatureFlagManager: React.FC = () => {
  const {
    flags,
    loading,
    error,
    metrics,
    createFlag,
    updateFlag,
    deleteFlag,
    toggleFlag,
    emergencyDisable,
    getHistory,
    refreshFlags
  } = useFeatureFlags();

  const [selectedFlag, setSelectedFlag] = useState<FeatureFlag | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Auto-refresh metrics every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      refreshFlags();
    }, 30000);
    return () => clearInterval(interval);
  }, [refreshFlags]);

  const handleToggleFlag = useCallback(async (flag: FeatureFlag) => {
    try {
      await toggleFlag(flag.flag_key, flag.enabled !== 'Y');
      refreshFlags();
    } catch (error) {
      console.error('Failed to toggle flag:', error);
    }
  }, [toggleFlag, refreshFlags]);

  const handleEmergencyDisable = useCallback(async (flagKey: string) => {
    if (!confirm(`Are you sure you want to EMERGENCY DISABLE ${flagKey}? This action is immediate and will be logged.`)) {
      return;
    }

    const reason = prompt('Please provide a reason for emergency disable:');
    if (!reason) return;

    try {
      await emergencyDisable(flagKey, reason);
      refreshFlags();
    } catch (error) {
      console.error('Failed to emergency disable:', error);
    }
  }, [emergencyDisable, refreshFlags]);

  const handleRolloutChange = useCallback(async (flag: FeatureFlag, percentage: number) => {
    try {
      await updateFlag(flag.flag_key, { rollout_percentage: percentage }, 'Rollout percentage update');
      refreshFlags();
    } catch (error) {
      console.error('Failed to update rollout:', error);
    }
  }, [updateFlag, refreshFlags]);

  const filteredFlags = flags.filter(flag => {
    // Apply search filter
    if (searchTerm && !flag.flag_key.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !flag.flag_name.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }

    // Apply category filter
    if (categoryFilter !== 'all' && flag.category !== categoryFilter) {
      return false;
    }

    // Apply status filter
    switch (filter) {
      case 'enabled':
        return flag.enabled === 'Y';
      case 'disabled':
        return flag.enabled === 'N';
      case 'system':
        return flag.is_system_wide === 'Y';
      case 'critical':
        return flag.category === 'security' || flag.category === 'system';
      default:
        return true;
    }
  });

  const categories = Array.from(new Set(flags.map(f => f.category).filter(Boolean)));

  const renderFlagCard = (flag: FeatureFlag) => {
    const isEnabled = flag.enabled === 'Y';
    const isSystemWide = flag.is_system_wide === 'Y';
    const isCritical = flag.category === 'security' || flag.category === 'system';

    return (
      <Card key={flag.flag_id} className={`mb-4 ${!isEnabled ? 'opacity-75' : ''}`}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-lg flex items-center gap-2">
                {flag.flag_name}
                {isSystemWide && (
                  <Badge variant="secondary" className="ml-2">
                    <Shield className="w-3 h-3 mr-1" />
                    System
                  </Badge>
                )}
                {isCritical && (
                  <Badge variant="destructive" className="ml-2">
                    Critical
                  </Badge>
                )}
              </CardTitle>
              <code className="text-sm text-muted-foreground">{flag.flag_key}</code>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={isEnabled}
                onCheckedChange={() => handleToggleFlag(flag)}
                disabled={loading}
                aria-label={`Toggle ${flag.flag_name}`}
              />
              {isCritical && isEnabled && (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleEmergencyDisable(flag.flag_key)}
                  title="Emergency Disable"
                >
                  <AlertTriangle className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {flag.description && (
            <CardDescription className="mb-3">{flag.description}</CardDescription>
          )}
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Type:</span>
              <Badge variant="outline" className="ml-2">{flag.flag_type}</Badge>
            </div>
            
            {flag.category && (
              <div>
                <span className="text-muted-foreground">Category:</span>
                <Badge variant="outline" className="ml-2">{flag.category}</Badge>
              </div>
            )}
            
            {flag.rollout_percentage !== undefined && flag.rollout_percentage < 100 && (
              <div className="col-span-2">
                <span className="text-muted-foreground">Rollout:</span>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={flag.rollout_percentage}
                    onChange={(e) => handleRolloutChange(flag, parseInt(e.target.value))}
                    className="flex-1"
                    disabled={!isEnabled}
                  />
                  <span className="w-12 text-right">{flag.rollout_percentage}%</span>
                </div>
              </div>
            )}
            
            {flag.evaluation_count !== undefined && (
              <div>
                <span className="text-muted-foreground">Evaluations:</span>
                <span className="ml-2 font-mono">{flag.evaluation_count.toLocaleString()}</span>
              </div>
            )}
            
            {flag.last_evaluated && (
              <div>
                <span className="text-muted-foreground">Last Used:</span>
                <span className="ml-2">{new Date(flag.last_evaluated).toLocaleTimeString()}</span>
              </div>
            )}
          </div>
          
          <div className="flex gap-2 mt-4">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setSelectedFlag(flag)}
            >
              <Settings className="w-4 h-4 mr-1" />
              Edit
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setSelectedFlag(flag);
                setShowHistoryModal(true);
              }}
            >
              <Clock className="w-4 h-4 mr-1" />
              History
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (loading && !flags.length) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="w-6 h-6 animate-spin mr-2" />
        Loading feature flags...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with metrics */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Feature Flags</h2>
            <p className="text-muted-foreground">Manage feature rollouts and experiments</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={refreshFlags} variant="outline" size="sm">
              <RefreshCw className="w-4 h-4 mr-1" />
              Refresh
            </Button>
            <Button onClick={() => setShowCreateModal(true)}>
              + New Flag
            </Button>
          </div>
        </div>

        {/* Metrics Cards */}
        {metrics && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Flags</p>
                    <p className="text-2xl font-bold">{metrics.totalFlags}</p>
                  </div>
                  <Activity className="w-8 h-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">System Flags</p>
                    <p className="text-2xl font-bold">{metrics.systemFlags}</p>
                  </div>
                  <Shield className="w-8 h-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Avg Eval Time</p>
                    <p className="text-2xl font-bold">
                      {metrics.avgEvaluationTime?.toFixed(2) || '0'} ms
                    </p>
                  </div>
                  <Zap className="w-8 h-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Cache Hit Rate</p>
                    <p className="text-2xl font-bold">
                      {metrics.cacheHitRate?.toFixed(1) || '0'}%
                    </p>
                  </div>
                  <TrendingUp className="w-8 h-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <Input
          placeholder="Search flags..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="md:w-64"
        />
        
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="md:w-48">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Flags</SelectItem>
            <SelectItem value="enabled">Enabled</SelectItem>
            <SelectItem value="disabled">Disabled</SelectItem>
            <SelectItem value="system">System Wide</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
          </SelectContent>
        </Select>
        
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="md:w-48">
            <SelectValue placeholder="Filter by category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map(cat => (
              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Flags List */}
      <div className="space-y-4">
        {filteredFlags.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground">
                {searchTerm || filter !== 'all' || categoryFilter !== 'all'
                  ? 'No flags match your filters'
                  : 'No feature flags configured'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <Tabs defaultValue="grid" className="w-full">
            <TabsList>
              <TabsTrigger value="grid">Grid View</TabsTrigger>
              <TabsTrigger value="list">List View</TabsTrigger>
            </TabsList>
            
            <TabsContent value="grid" className="mt-4">
              <div className="grid md:grid-cols-2 gap-4">
                {filteredFlags.map(renderFlagCard)}
              </div>
            </TabsContent>
            
            <TabsContent value="list" className="mt-4">
              <Card>
                <CardContent className="p-0">
                  <table className="w-full">
                    <thead className="border-b">
                      <tr className="text-left">
                        <th className="p-4">Flag</th>
                        <th className="p-4">Type</th>
                        <th className="p-4">Category</th>
                        <th className="p-4">Status</th>
                        <th className="p-4">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredFlags.map(flag => (
                        <tr key={flag.flag_id} className="border-b hover:bg-muted/50">
                          <td className="p-4">
                            <div>
                              <p className="font-medium">{flag.flag_name}</p>
                              <code className="text-xs text-muted-foreground">{flag.flag_key}</code>
                            </div>
                          </td>
                          <td className="p-4">
                            <Badge variant="outline">{flag.flag_type}</Badge>
                          </td>
                          <td className="p-4">
                            {flag.category && <Badge variant="outline">{flag.category}</Badge>}
                          </td>
                          <td className="p-4">
                            <Switch
                              checked={flag.enabled === 'Y'}
                              onCheckedChange={() => handleToggleFlag(flag)}
                            />
                          </td>
                          <td className="p-4">
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setSelectedFlag(flag)}
                              >
                                Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setSelectedFlag(flag);
                                  setShowHistoryModal(true);
                                }}
                              >
                                History
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>

      {/* Modals */}
      {showCreateModal && (
        <FlagCreateModal
          onClose={() => setShowCreateModal(false)}
          onCreate={async (flagData) => {
            await createFlag(flagData);
            setShowCreateModal(false);
            refreshFlags();
          }}
        />
      )}

      {selectedFlag && !showHistoryModal && (
        <FlagEditModal
          flag={selectedFlag}
          onClose={() => setSelectedFlag(null)}
          onSave={async (updates, reason) => {
            await updateFlag(selectedFlag.flag_key, updates, reason);
            setSelectedFlag(null);
            refreshFlags();
          }}
        />
      )}

      {selectedFlag && showHistoryModal && (
        <FlagHistoryModal
          flag={selectedFlag}
          onClose={() => {
            setShowHistoryModal(false);
            setSelectedFlag(null);
          }}
          getHistory={getHistory}
        />
      )}
    </div>
  );
};