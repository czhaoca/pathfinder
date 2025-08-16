/**
 * Environment Selector Component
 * 
 * Dropdown for selecting environment context:
 * - Environment switching
 * - Visual indicators for environment types
 * - Environment-specific warnings
 */

import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Badge } from '../ui/badge';

interface EnvironmentSelectorProps {
  value: string;
  onChange: (environment: string) => void;
  disabled?: boolean;
}

const environments = [
  { 
    value: 'development', 
    label: 'Development', 
    color: 'bg-green-100 text-green-800',
    description: 'Development environment'
  },
  { 
    value: 'test', 
    label: 'Test', 
    color: 'bg-blue-100 text-blue-800',
    description: 'Testing environment'
  },
  { 
    value: 'staging', 
    label: 'Staging', 
    color: 'bg-yellow-100 text-yellow-800',
    description: 'Pre-production staging'
  },
  { 
    value: 'production', 
    label: 'Production', 
    color: 'bg-red-100 text-red-800',
    description: 'Live production environment'
  },
  { 
    value: 'demo', 
    label: 'Demo', 
    color: 'bg-purple-100 text-purple-800',
    description: 'Demo environment'
  },
  { 
    value: 'local', 
    label: 'Local', 
    color: 'bg-gray-100 text-gray-800',
    description: 'Local development'
  }
];

const EnvironmentSelector: React.FC<EnvironmentSelectorProps> = ({
  value,
  onChange,
  disabled = false
}) => {
  const currentEnv = environments.find(env => env.value === value);

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium">Environment:</span>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger className="w-48">
          <SelectValue>
            {currentEnv && (
              <div className="flex items-center gap-2">
                <Badge className={currentEnv.color} variant="secondary">
                  {currentEnv.label}
                </Badge>
              </div>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {environments.map(env => (
            <SelectItem key={env.value} value={env.value}>
              <div className="flex items-center justify-between w-full">
                <span>{env.label}</span>
                <Badge className={`ml-2 ${env.color}`} variant="secondary">
                  {env.value}
                </Badge>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      
      {value === 'production' && (
        <Badge variant="destructive" className="text-xs">
          ⚠️ PRODUCTION
        </Badge>
      )}
    </div>
  );
};

export default EnvironmentSelector;