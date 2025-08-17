/**
 * Self-Registration Control Panel
 * 
 * Dedicated control panel for managing self-registration with DDoS protection
 * Real-time metrics, emergency controls, and protection settings
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Progress } from '../ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import {
  Shield,
  Users,
  AlertTriangle,
  Activity,
  Clock,
  Ban,
  CheckCircle,
  XCircle,
  RefreshCw,
  Zap,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Settings,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useFeatureFlags } from '../../hooks/useFeatureFlags';

interface RegistrationMetrics {
  totalAttempts: number;
  successfulRegistrations: number;
  blockedAttempts: number;
  uniqueIps: number;
  suspiciousIps: number;
  avgSuccessTime: number;
  captchaSolveRate: number;
  timeRange: string;
}

interface ProtectionSettings {
  enabled: boolean;
  rateLimit: number;
  windowMinutes: number;
  blockDurationMinutes: number;
  captchaThreshold: number;
  suspicionThreshold: number;
}

export const SelfRegistrationControl: React.FC = () => {
  const {
    flags,
    toggleSelfRegistration,
    getRegistrationMetrics,
    updateProtectionSettings,
    emergencyDisable,
  } = useFeatureFlags();

  const [metrics, setMetrics] = useState<RegistrationMetrics | null>(null);
  const [protection, setProtection] = useState<ProtectionSettings>({
    enabled: false,
    rateLimit: 5,
    windowMinutes: 15,
    blockDurationMinutes: 60,
    captchaThreshold: 3,
    suspicionThreshold: 0.8,
  });
  const [loading, setLoading] = useState(false);
  const [timeRange, setTimeRange] = useState('24h');
  const [showSettings, setShowSettings] = useState(false);
  const [alertLevel, setAlertLevel] = useState<'normal' | 'warning' | 'critical'>('normal');

  // Find self-registration flag
  const selfRegFlag = flags.find(f => f.flag_key === 'self_registration_enabled');
  const isEnabled = selfRegFlag?.enabled === 'Y' && selfRegFlag?.default_value === 'true';

  // Load metrics periodically
  useEffect(() => {
    if (isEnabled) {
      loadMetrics();
      const interval = setInterval(loadMetrics, 30000); // Update every 30 seconds
      return () => clearInterval(interval);
    }
  }, [isEnabled, timeRange]);

  // Calculate alert level based on metrics
  useEffect(() => {
    if (!metrics) {
      setAlertLevel('normal');
      return;
    }

    const blockRate = metrics.totalAttempts > 0 
      ? (metrics.blockedAttempts / metrics.totalAttempts) * 100 
      : 0;
    
    const suspiciousRate = metrics.uniqueIps > 0
      ? (metrics.suspiciousIps / metrics.uniqueIps) * 100
      : 0;

    if (blockRate > 50 || suspiciousRate > 30 || metrics.suspiciousIps > 50) {
      setAlertLevel('critical');
    } else if (blockRate > 25 || suspiciousRate > 15 || metrics.suspiciousIps > 20) {
      setAlertLevel('warning');
    } else {
      setAlertLevel('normal');
    }
  }, [metrics]);

  const loadMetrics = async () => {
    try {
      const data = await getRegistrationMetrics(timeRange);
      setMetrics(data.metrics);
      setProtection(data.protection);
    } catch (error) {
      console.error('Failed to load metrics:', error);
    }
  };

  const handleToggle = async () => {
    setLoading(true);
    try {
      const newState = !isEnabled;
      const reason = newState
        ? 'Enabling self-registration from admin panel'
        : 'Disabling self-registration from admin panel';

      await toggleSelfRegistration(newState, reason);
      
      if (newState) {
        // Reload metrics when enabling
        setTimeout(loadMetrics, 1000);
      }
    } catch (error) {
      console.error('Failed to toggle self-registration:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEmergencyStop = async () => {
    if (!confirm('This will IMMEDIATELY disable self-registration. Continue?')) {
      return;
    }

    const reason = prompt('Reason for emergency stop:');
    if (!reason) return;

    setLoading(true);
    try {
      await emergencyDisable('self_registration_enabled', `EMERGENCY STOP: ${reason}`);
      alert('Self-registration has been emergency disabled. Please review security logs.');
    } catch (error) {
      console.error('Emergency stop failed:', error);
      alert('Failed to execute emergency stop. Please try again or contact support.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProtection = async () => {
    setLoading(true);
    try {
      await updateProtectionSettings(protection);
      alert('Protection settings updated successfully');
    } catch (error) {
      console.error('Failed to update protection settings:', error);
      alert('Failed to update settings. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = () => {
    if (!isEnabled) return 'text-gray-500';
    switch (alertLevel) {
      case 'critical': return 'text-red-500';
      case 'warning': return 'text-yellow-500';
      default: return 'text-green-500';
    }
  };

  const getStatusIcon = () => {
    if (!isEnabled) return <Ban className="w-5 h-5" />;
    switch (alertLevel) {
      case 'critical': return <AlertTriangle className="w-5 h-5" />;
      case 'warning': return <AlertCircle className="w-5 h-5" />;
      default: return <CheckCircle className="w-5 h-5" />;
    }
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat().format(num);
  };

  const formatPercentage = (num: number) => {
    return `${num.toFixed(1)}%`;
  };

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card className={alertLevel === 'critical' ? 'border-red-500' : alertLevel === 'warning' ? 'border-yellow-500' : ''}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Shield className={`w-8 h-8 ${getStatusColor()}`} />
              <div>
                <CardTitle className="text-2xl">Self-Registration Control</CardTitle>
                <CardDescription>
                  Manage user self-registration with DDoS protection
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                {getStatusIcon()}
                <span className={`font-semibold ${getStatusColor()}`}>
                  {isEnabled ? 'Active' : 'Inactive'}
                </span>
              </div>
              {isEnabled && alertLevel === 'critical' && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleEmergencyStop}
                  disabled={loading}
                >
                  <AlertTriangle className="w-4 h-4 mr-1" />
                  Emergency Stop
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Label htmlFor="registration-toggle">Registration Status:</Label>
                <Switch
                  id="registration-toggle"
                  checked={isEnabled}
                  onCheckedChange={handleToggle}
                  disabled={loading}
                  className="data-[state=checked]:bg-green-500"
                />
              </div>
              <Badge variant={isEnabled ? 'default' : 'secondary'}>
                {isEnabled ? 'Accepting Registrations' : 'Registration Closed'}
              </Badge>
            </div>
            
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSettings(!showSettings)}
              >
                <Settings className="w-4 h-4 mr-1" />
                Protection Settings
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={loadMetrics}
                disabled={!isEnabled}
              >
                <RefreshCw className="w-4 h-4 mr-1" />
                Refresh
              </Button>
            </div>
          </div>

          {/* Alert Messages */}
          {alertLevel === 'critical' && (
            <Alert variant="destructive" className="mt-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Critical Alert</AlertTitle>
              <AlertDescription>
                High number of suspicious activities detected. Consider reviewing security settings
                or temporarily disabling registration.
              </AlertDescription>
            </Alert>
          )}
          
          {alertLevel === 'warning' && (
            <Alert className="mt-4 border-yellow-500">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Warning</AlertTitle>
              <AlertDescription>
                Elevated suspicious activity detected. Monitor closely.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Metrics Dashboard */}
      {isEnabled && metrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Attempts</p>
                  <p className="text-3xl font-bold">{formatNumber(metrics.totalAttempts)}</p>
                  <p className="text-xs text-muted-foreground mt-1">Last {timeRange}</p>
                </div>
                <Users className="w-10 h-10 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Successful</p>
                  <p className="text-3xl font-bold text-green-600">
                    {formatNumber(metrics.successfulRegistrations)}
                  </p>
                  <Progress 
                    value={(metrics.successfulRegistrations / Math.max(1, metrics.totalAttempts)) * 100}
                    className="mt-2 h-2"
                  />
                </div>
                <CheckCircle className="w-10 h-10 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Blocked</p>
                  <p className="text-3xl font-bold text-red-600">
                    {formatNumber(metrics.blockedAttempts)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatPercentage((metrics.blockedAttempts / Math.max(1, metrics.totalAttempts)) * 100)} of attempts
                  </p>
                </div>
                <Ban className="w-10 h-10 text-red-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Unique IPs</p>
                  <p className="text-3xl font-bold">{formatNumber(metrics.uniqueIps)}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="destructive" className="text-xs">
                      {metrics.suspiciousIps} suspicious
                    </Badge>
                  </div>
                </div>
                <Activity className="w-10 h-10 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Avg Response Time</p>
                  <p className="text-3xl font-bold">
                    {metrics.avgSuccessTime ? `${metrics.avgSuccessTime.toFixed(0)}ms` : 'N/A'}
                  </p>
                  <div className="flex items-center gap-1 mt-1">
                    {metrics.avgSuccessTime < 1000 ? (
                      <TrendingDown className="w-4 h-4 text-green-500" />
                    ) : (
                      <TrendingUp className="w-4 h-4 text-red-500" />
                    )}
                    <span className="text-xs text-muted-foreground">
                      {metrics.avgSuccessTime < 1000 ? 'Optimal' : 'Slow'}
                    </span>
                  </div>
                </div>
                <Zap className="w-10 h-10 text-yellow-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">CAPTCHA Success</p>
                  <p className="text-3xl font-bold">{formatPercentage(metrics.captchaSolveRate)}</p>
                  <Progress 
                    value={metrics.captchaSolveRate}
                    className="mt-2 h-2"
                  />
                </div>
                <Eye className="w-10 h-10 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Time Range Selector */}
      {isEnabled && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Metrics Time Range</CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1h">Last Hour</SelectItem>
                <SelectItem value="24h">Last 24 Hours</SelectItem>
                <SelectItem value="7d">Last 7 Days</SelectItem>
                <SelectItem value="30d">Last 30 Days</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      )}

      {/* Protection Settings */}
      {showSettings && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Shield className="w-5 h-5" />
              DDoS Protection Settings
            </CardTitle>
            <CardDescription>
              Configure rate limiting and protection thresholds
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="rate-limit">
                  Rate Limit (attempts per window)
                </Label>
                <Input
                  id="rate-limit"
                  type="number"
                  min="1"
                  max="100"
                  value={protection.rateLimit}
                  onChange={(e) => setProtection({
                    ...protection,
                    rateLimit: parseInt(e.target.value)
                  })}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Maximum registration attempts allowed per IP
                </p>
              </div>

              <div>
                <Label htmlFor="window-minutes">
                  Time Window (minutes)
                </Label>
                <Input
                  id="window-minutes"
                  type="number"
                  min="1"
                  max="60"
                  value={protection.windowMinutes}
                  onChange={(e) => setProtection({
                    ...protection,
                    windowMinutes: parseInt(e.target.value)
                  })}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Time window for rate limiting
                </p>
              </div>

              <div>
                <Label htmlFor="block-duration">
                  Block Duration (minutes)
                </Label>
                <Input
                  id="block-duration"
                  type="number"
                  min="1"
                  max="1440"
                  value={protection.blockDurationMinutes}
                  onChange={(e) => setProtection({
                    ...protection,
                    blockDurationMinutes: parseInt(e.target.value)
                  })}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  How long to block IPs after rate limit exceeded
                </p>
              </div>

              <div>
                <Label htmlFor="captcha-threshold">
                  CAPTCHA Threshold (attempts)
                </Label>
                <Input
                  id="captcha-threshold"
                  type="number"
                  min="1"
                  max="10"
                  value={protection.captchaThreshold}
                  onChange={(e) => setProtection({
                    ...protection,
                    captchaThreshold: parseInt(e.target.value)
                  })}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Show CAPTCHA after this many attempts
                </p>
              </div>

              <div className="md:col-span-2">
                <Label htmlFor="suspicion-threshold">
                  Suspicion Threshold
                </Label>
                <div className="flex items-center gap-4">
                  <input
                    id="suspicion-threshold"
                    type="range"
                    min="0"
                    max="100"
                    value={protection.suspicionThreshold * 100}
                    onChange={(e) => setProtection({
                      ...protection,
                      suspicionThreshold: parseInt(e.target.value) / 100
                    })}
                    className="flex-1"
                  />
                  <span className="w-12 text-right">
                    {(protection.suspicionThreshold * 100).toFixed(0)}%
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Threshold for triggering additional verification
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => setShowSettings(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleUpdateProtection}
                disabled={loading}
              >
                Save Settings
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Disabled State */}
      {!isEnabled && (
        <Card>
          <CardContent className="p-8 text-center">
            <EyeOff className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-lg font-medium mb-2">Registration is Disabled</p>
            <p className="text-muted-foreground mb-4">
              Self-registration is currently turned off. Enable it to start accepting new users.
            </p>
            <Button onClick={handleToggle} disabled={loading}>
              Enable Self-Registration
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};