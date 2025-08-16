/**
 * Configuration List Component
 * 
 * Displays and manages system configurations:
 * - Searchable and filterable configuration list
 * - Inline editing capabilities
 * - Bulk operations
 * - Environment override management
 * - Configuration validation
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Card } from '../ui/card';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Alert, AlertDescription } from '../ui/alert';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { configurationService } from '../../services/configurationService';
import ConfigurationEditor from './ConfigurationEditor';
import BulkConfigurationEditor from './BulkConfigurationEditor';

interface Configuration {
  config_key: string;
  config_value: string;
  config_type: string;
  category: string;
  subcategory?: string;
  display_name?: string;
  description?: string;
  is_active: boolean;
  requires_restart: boolean;
  override_value?: string;
  override_environment?: string;
  has_override: boolean;
}

interface ConfigurationListProps {
  environment: string;
  onConfigurationChange: () => void;
}

const ConfigurationList: React.FC<ConfigurationListProps> = ({
  environment,
  onConfigurationChange
}) => {
  const [configurations, setConfigurations] = useState<Record<string, Configuration[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [activeFilter, setActiveFilter] = useState('all');
  const [selectedConfigs, setSelectedConfigs] = useState<Set<string>>(new Set());
  const [editingConfig, setEditingConfig] = useState<Configuration | null>(null);
  const [showBulkEditor, setShowBulkEditor] = useState(false);

  useEffect(() => {
    loadConfigurations();
  }, [environment]);

  const loadConfigurations = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const data = await configurationService.getConfigurations(environment);
      setConfigurations(data.configurations);
    } catch (err) {
      console.error('Error loading configurations:', err);
      setError(err instanceof Error ? err.message : 'Failed to load configurations');
    } finally {
      setLoading(false);
    }
  };

  const handleConfigurationUpdate = async (key: string, value: any, reason?: string) => {
    try {
      await configurationService.updateConfiguration(key, {
        value,
        environment,
        reason
      });
      
      await loadConfigurations();
      onConfigurationChange();
      setEditingConfig(null);
    } catch (err) {
      console.error('Error updating configuration:', err);
      throw err;
    }
  };

  const handleBulkUpdate = async (updates: Array<{key: string, value: any}>, reason: string) => {
    try {
      await configurationService.bulkUpdateConfigurations({
        configurations: updates.map(u => ({ key: u.key, value: u.value })),
        environment,
        reason
      });
      
      await loadConfigurations();
      onConfigurationChange();
      setShowBulkEditor(false);
      setSelectedConfigs(new Set());
    } catch (err) {
      console.error('Error in bulk update:', err);
      throw err;
    }
  };

  const handleToggleSelect = (configKey: string) => {
    const newSelected = new Set(selectedConfigs);
    if (newSelected.has(configKey)) {
      newSelected.delete(configKey);
    } else {
      newSelected.add(configKey);
    }
    setSelectedConfigs(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedConfigs.size === filteredConfigurations.length) {
      setSelectedConfigs(new Set());
    } else {
      setSelectedConfigs(new Set(filteredConfigurations.map(c => c.config_key)));
    }
  };

  // Flatten configurations for filtering
  const allConfigurations = useMemo(() => {
    return Object.values(configurations).flat();
  }, [configurations]);

  // Get unique categories
  const categories = useMemo(() => {
    return Array.from(new Set(allConfigurations.map(c => c.category))).sort();
  }, [allConfigurations]);

  // Filter configurations
  const filteredConfigurations = useMemo(() => {
    return allConfigurations.filter(config => {
      const matchesSearch = !searchTerm || 
        config.config_key.toLowerCase().includes(searchTerm.toLowerCase()) ||
        config.display_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        config.description?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesCategory = categoryFilter === 'all' || config.category === categoryFilter;
      
      const matchesActive = activeFilter === 'all' || 
        (activeFilter === 'active' && config.is_active) ||
        (activeFilter === 'inactive' && !config.is_active) ||
        (activeFilter === 'overridden' && config.has_override);
      
      return matchesSearch && matchesCategory && matchesActive;
    });
  }, [allConfigurations, searchTerm, categoryFilter, activeFilter]);

  const getValueDisplay = (config: Configuration) => {
    const value = config.override_value || config.config_value;
    
    switch (config.config_type) {
      case 'boolean':
        return value === 'true' ? 'Enabled' : 'Disabled';
      case 'json':
      case 'array':
        try {
          const parsed = JSON.parse(value);
          return Array.isArray(parsed) ? `Array (${parsed.length} items)` : 'Object';
        } catch {
          return value;
        }
      default:
        return value;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <Alert>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header and Filters */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          <div className="flex-1 space-y-2 md:space-y-0 md:flex md:gap-4">
            <Input
              placeholder="Search configurations..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="md:w-64"
            />
            
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="md:w-48">
                <SelectValue placeholder="Filter by category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map(category => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={activeFilter} onValueChange={setActiveFilter}>
              <SelectTrigger className="md:w-48">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Configurations</SelectItem>
                <SelectItem value="active">Active Only</SelectItem>
                <SelectItem value="inactive">Inactive Only</SelectItem>
                <SelectItem value="overridden">Overridden Only</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex gap-2">
            {selectedConfigs.size > 0 && (
              <Button
                onClick={() => setShowBulkEditor(true)}
                variant="outline"
              >
                Bulk Edit ({selectedConfigs.size})
              </Button>
            )}
            <Button onClick={loadConfigurations} variant="outline">
              Refresh
            </Button>
          </div>
        </div>

        {filteredConfigurations.length > 0 && (
          <div className="mt-4 flex items-center gap-2">
            <Button
              onClick={handleSelectAll}
              variant="ghost"
              size="sm"
            >
              {selectedConfigs.size === filteredConfigurations.length ? 'Deselect All' : 'Select All'}
            </Button>
            <span className="text-sm text-muted-foreground">
              {filteredConfigurations.length} configuration(s) found
            </span>
          </div>
        )}
      </Card>

      {/* Configuration List */}
      <div className="space-y-2">
        {filteredConfigurations.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">
              No configurations found matching your filters.
            </p>
          </Card>
        ) : (
          filteredConfigurations.map(config => (
            <Card key={config.config_key} className="p-4">
              <div className="flex items-start gap-4">
                <input
                  type="checkbox"
                  checked={selectedConfigs.has(config.config_key)}
                  onChange={() => handleToggleSelect(config.config_key)}
                  className="mt-1"
                />
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium">{config.display_name || config.config_key}</h4>
                        <Badge variant="outline">{config.category}</Badge>
                        {config.subcategory && (
                          <Badge variant="secondary" className="text-xs">
                            {config.subcategory}
                          </Badge>
                        )}
                        {config.has_override && (
                          <Badge variant="default">
                            Override ({config.override_environment})
                          </Badge>
                        )}
                        {config.requires_restart && (
                          <Badge variant="destructive">Restart Required</Badge>
                        )}
                        {!config.is_active && (
                          <Badge variant="outline">Inactive</Badge>
                        )}
                      </div>
                      
                      <p className="text-sm text-muted-foreground mb-2">
                        {config.description || config.config_key}
                      </p>
                      
                      <div className="flex items-center gap-4 text-sm">
                        <span>
                          <strong>Type:</strong> {config.config_type}
                        </span>
                        <span>
                          <strong>Value:</strong> 
                          <code className="ml-1 px-1 py-0.5 bg-muted rounded text-xs">
                            {getValueDisplay(config)}
                          </code>
                        </span>
                      </div>
                    </div>
                    
                    <Button
                      onClick={() => setEditingConfig(config)}
                      size="sm"
                      variant="outline"
                    >
                      Edit
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Configuration Editor Modal */}
      {editingConfig && (
        <ConfigurationEditor
          configuration={editingConfig}
          environment={environment}
          onSave={handleConfigurationUpdate}
          onCancel={() => setEditingConfig(null)}
        />
      )}

      {/* Bulk Editor Modal */}
      {showBulkEditor && (
        <BulkConfigurationEditor
          configurations={filteredConfigurations.filter(c => 
            selectedConfigs.has(c.config_key)
          )}
          environment={environment}
          onSave={handleBulkUpdate}
          onCancel={() => setShowBulkEditor(false)}
        />
      )}
    </div>
  );
};

export default ConfigurationList;