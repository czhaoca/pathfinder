import React from 'react';
import { Check, X, Key, Trash2 } from 'lucide-react';

interface BulkAction {
  id: string;
  label: string;
  icon: string;
  variant?: 'default' | 'danger';
}

interface BulkActionsProps {
  selectedCount: number;
  onAction: (action: string) => void;
  actions: BulkAction[];
}

export const BulkActions: React.FC<BulkActionsProps> = ({
  selectedCount,
  onAction,
  actions
}) => {
  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'check':
        return <Check className="h-4 w-4" />;
      case 'x':
        return <X className="h-4 w-4" />;
      case 'key':
        return <Key className="h-4 w-4" />;
      case 'trash':
        return <Trash2 className="h-4 w-4" />;
      default:
        return null;
    }
  };
  
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium text-blue-900">
            {selectedCount} item{selectedCount !== 1 ? 's' : ''} selected
          </span>
        </div>
        
        <div className="flex items-center space-x-2">
          {actions.map(action => (
            <button
              key={action.id}
              onClick={() => onAction(action.id)}
              className={`inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-lg ${
                action.variant === 'danger'
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              {getIcon(action.icon)}
              <span className="ml-2">{action.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};