/**
 * Configuration Editor Component
 * 
 * Modal dialog for editing individual configurations:
 * - Type-aware value input
 * - Validation feedback
 * - Preview and test functionality
 * - Rollback options
 */

import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Switch } from '../ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription } from '../ui/alert';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { configurationService, Configuration } from '../../services/configurationService';

interface ConfigurationEditorProps {
  configuration: Configuration;
  environment: string;
  onSave: (key: string, value: any, reason?: string) => Promise<void>;
  onCancel: () => void;
}

const ConfigurationEditor: React.FC<ConfigurationEditorProps> = ({
  configuration,
  environment,
  onSave,
  onCancel
}) => {
  const [value, setValue] = useState<any>(configuration.override_value || configuration.config_value);
  const [reason, setReason] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    // Parse initial value based on type
    const initialValue = configuration.override_value || configuration.config_value;
    setValue(parseValueByType(initialValue, configuration.config_type));
  }, [configuration]);

  const parseValueByType = (val: string, type: string) => {
    if (!val) return '';
    
    switch (type) {
      case 'boolean':
        return val === 'true' || val === '1';
      case 'number':
        return parseFloat(val) || 0;
      case 'json':
      case 'array':
        try {
          return JSON.stringify(JSON.parse(val), null, 2);
        } catch {
          return val;
        }
      default:
        return val;
    }
  };

  const formatValueForSave = (val: any, type: string) => {
    switch (type) {
      case 'boolean':
        return val ? 'true' : 'false';
      case 'number':
        return val.toString();
      case 'json':
      case 'array':
        try {
          JSON.parse(val); // Validate JSON
          return val;
        } catch {
          throw new Error('Invalid JSON format');
        }
      default:
        return val;
    }
  };

  const handleValidate = async () => {
    try {
      setIsValidating(true);
      setValidationError(null);
      
      const formattedValue = formatValueForSave(value, configuration.config_type);
      
      await configurationService.updateConfiguration(configuration.config_key, {
        value: formattedValue,
        environment,
        validate_only: true
      });
      
      setValidationError(null);
    } catch (error) {
      setValidationError(error instanceof Error ? error.message : 'Validation failed');
    } finally {
      setIsValidating(false);
    }
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setValidationError(null);
      
      const formattedValue = formatValueForSave(value, configuration.config_type);
      await onSave(configuration.config_key, formattedValue, reason);
    } catch (error) {
      setValidationError(error instanceof Error ? error.message : 'Save failed');
    } finally {
      setIsSaving(false);
    }
  };

  const loadHistory = async () => {
    try {
      const historyData = await configurationService.getConfigurationHistory(
        configuration.config_key,
        10
      );
      setHistory(historyData.history || []);
      setShowHistory(true);
    } catch (error) {
      console.error('Failed to load history:', error);
    }
  };

  const renderValueInput = () => {
    switch (configuration.config_type) {
      case 'boolean':
        return (
          <div className="flex items-center space-x-2">
            <Switch
              checked={value}
              onCheckedChange={setValue}
              id="boolean-input"
            />
            <label htmlFor="boolean-input" className="text-sm">
              {value ? 'Enabled' : 'Disabled'}
            </label>
          </div>
        );

      case 'number':
        return (
          <Input
            type="number"
            value={value}
            onChange={(e) => setValue(parseFloat(e.target.value) || 0)}
            min={configuration.min_value}
            max={configuration.max_value}
            placeholder="Enter number"
          />
        );

      case 'json':
      case 'array':
        return (
          <Textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Enter valid JSON"
            rows={8}
            className="font-mono text-sm"
          />
        );

      default:
        if (configuration.allowed_values && configuration.allowed_values.length > 0) {
          return (
            <Select value={value} onValueChange={setValue}>
              <SelectTrigger>
                <SelectValue placeholder="Select value" />
              </SelectTrigger>
              <SelectContent>
                {configuration.allowed_values.map(val => (
                  <SelectItem key={val} value={val}>
                    {val}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          );
        }
        
        return (
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Enter value"
            pattern={configuration.regex_pattern}
          />
        );
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold">
                {configuration.display_name || configuration.config_key}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {configuration.description}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="outline">{configuration.category}</Badge>
                {configuration.subcategory && (
                  <Badge variant="secondary" className="text-xs">
                    {configuration.subcategory}
                  </Badge>
                )}
                <Badge variant="outline">{configuration.config_type}</Badge>
                {configuration.requires_restart && (
                  <Badge variant="destructive">Restart Required</Badge>
                )}
              </div>
            </div>
            <Button onClick={onCancel} variant="ghost" size="sm">
              ✕
            </Button>
          </div>

          {/* Current Value Info */}
          <div className="mb-4 p-3 bg-muted rounded-lg">
            <div className="text-sm">
              <div className="mb-2">
                <span className="font-medium">Current Value:</span>
                <code className="ml-2 px-2 py-1 bg-background rounded text-xs">
                  {configuration.override_value || configuration.config_value}
                </code>
              </div>
              {configuration.has_override && (
                <div className="text-xs text-muted-foreground">
                  Override active for {configuration.override_environment} environment
                </div>
              )}
              {configuration.default_value && (
                <div className="text-xs text-muted-foreground">
                  Default: {configuration.default_value}
                </div>
              )}
            </div>
          </div>

          {/* Value Editor */}
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">
                New Value
                {configuration.is_required && (
                  <span className="text-red-500 ml-1">*</span>
                )}
              </label>
              {renderValueInput()}
              
              {/* Validation hints */}
              {configuration.allowed_values && (
                <p className="text-xs text-muted-foreground mt-1">
                  Allowed values: {configuration.allowed_values.join(', ')}
                </p>
              )}
              {configuration.min_value !== undefined && configuration.max_value !== undefined && (
                <p className="text-xs text-muted-foreground mt-1">
                  Range: {configuration.min_value} - {configuration.max_value}
                </p>
              )}
              {configuration.regex_pattern && (
                <p className="text-xs text-muted-foreground mt-1">
                  Pattern: {configuration.regex_pattern}
                </p>
              )}
            </div>

            {/* Change Reason */}
            <div>
              <label className="text-sm font-medium mb-2 block">
                Change Reason
              </label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Describe why this change is being made..."
                rows={3}
              />
            </div>

            {/* Validation Error */}
            {validationError && (
              <Alert>
                <AlertDescription>{validationError}</AlertDescription>
              </Alert>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between pt-4">
              <div className="flex gap-2">
                <Button
                  onClick={loadHistory}
                  variant="outline"
                  size="sm"
                >
                  View History
                </Button>
                <Button
                  onClick={handleValidate}
                  variant="outline"
                  size="sm"
                  disabled={isValidating}
                >
                  {isValidating && <LoadingSpinner size="sm" className="mr-2" />}
                  Validate
                </Button>
              </div>
              
              <div className="flex gap-2">
                <Button onClick={onCancel} variant="outline">
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={isSaving || !reason.trim()}
                >
                  {isSaving && <LoadingSpinner size="sm" className="mr-2" />}
                  Save Changes
                </Button>
              </div>
            </div>
          </div>

          {/* History Modal */}
          {showHistory && (
            <div className="mt-6 border-t pt-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-medium">Change History</h3>
                <Button
                  onClick={() => setShowHistory(false)}
                  variant="ghost"
                  size="sm"
                >
                  Hide
                </Button>
              </div>
              
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {history.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No history available</p>
                ) : (
                  history.map((entry, index) => (
                    <div key={entry.id || index} className="p-3 bg-muted rounded text-sm">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium">{entry.action}</span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(entry.change_timestamp).toLocaleString()}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        By: {entry.user_email || entry.changed_by}
                      </div>
                      {entry.change_reason && (
                        <div className="text-xs mt-1">{entry.change_reason}</div>
                      )}
                      {entry.old_value !== entry.new_value && (
                        <div className="mt-2 text-xs">
                          <span className="text-red-600">- {entry.old_value}</span>
                          <br />
                          <span className="text-green-600">+ {entry.new_value}</span>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

export default ConfigurationEditor;