import React, { useState, useEffect } from 'react';
import { adminService } from '../../services/admin.service';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { ErrorMessage } from '../common/ErrorMessage';
import { toast } from 'react-toastify';
import './SystemConfiguration.css';

interface ConfigItem {
  key: string;
  value: any;
  type: 'string' | 'number' | 'boolean' | 'json';
  editable: boolean;
  sensitive?: boolean;
  description?: string;
  lastModified?: Date;
  modifiedBy?: string;
}

interface ConfigCategory {
  [key: string]: ConfigItem[];
}

interface ApiKey {
  id: string;
  name: string;
  key: string;
  scopes: string[];
  createdAt: Date;
  expiresAt?: Date;
  lastUsed?: Date;
  usageCount: number;
}

export const SystemConfiguration: React.FC = () => {
  const [config, setConfig] = useState<ConfigCategory>({});
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'config' | 'api-keys'>('config');
  const [showCreateApiKey, setShowCreateApiKey] = useState(false);
  const [newApiKey, setNewApiKey] = useState({
    name: '',
    scopes: [] as string[],
    expiresIn: 30
  });

  useEffect(() => {
    loadConfiguration();
    loadApiKeys();
  }, []);

  const loadConfiguration = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await adminService.getSystemConfiguration();
      setConfig(data);
    } catch (err) {
      setError('Failed to load configuration');
      console.error('Error loading configuration:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadApiKeys = async () => {
    try {
      const data = await adminService.getApiKeys();
      setApiKeys(data.keys);
    } catch (err) {
      console.error('Error loading API keys:', err);
    }
  };

  const handleUpdateConfig = async (key: string, value: any) => {
    const reason = prompt('Please provide a reason for this change:');
    if (!reason) return;

    try {
      await adminService.updateConfiguration(key, value, reason);
      toast.success('Configuration updated successfully');
      setEditingKey(null);
      setEditValue(null);
      await loadConfiguration();
    } catch (err) {
      toast.error('Failed to update configuration');
      console.error('Error updating configuration:', err);
    }
  };

  const handleCreateApiKey = async () => {
    if (!newApiKey.name || newApiKey.scopes.length === 0) {
      toast.error('Please provide a name and at least one scope');
      return;
    }

    try {
      const apiKey = await adminService.createApiKey(
        newApiKey.name,
        newApiKey.scopes,
        newApiKey.expiresIn
      );
      toast.success('API key created successfully');
      toast.info(`Key: ${apiKey.key}`, { autoClose: false });
      setShowCreateApiKey(false);
      setNewApiKey({ name: '', scopes: [], expiresIn: 30 });
      await loadApiKeys();
    } catch (err) {
      toast.error('Failed to create API key');
      console.error('Error creating API key:', err);
    }
  };

  const handleRevokeApiKey = async (keyId: string, keyName: string) => {
    const reason = prompt(`Reason for revoking API key "${keyName}":`);
    if (!reason) return;

    try {
      await adminService.revokeApiKey(keyId, reason);
      toast.success('API key revoked successfully');
      await loadApiKeys();
    } catch (err) {
      toast.error('Failed to revoke API key');
      console.error('Error revoking API key:', err);
    }
  };

  const formatValue = (value: any, type: string): string => {
    if (type === 'boolean') return value ? 'Yes' : 'No';
    if (type === 'json') return JSON.stringify(value, null, 2);
    if (value === null || value === undefined) return 'Not set';
    return String(value);
  };

  const renderConfigEditor = (item: ConfigItem) => {
    if (!item.editable) {
      return <span className="config-value readonly">{formatValue(item.value, item.type)}</span>;
    }

    if (editingKey === item.key) {
      switch (item.type) {
        case 'boolean':
          return (
            <div className="config-editor">
              <select
                value={editValue}
                onChange={(e) => setEditValue(e.target.value === 'true')}
                className="form-select"
              >
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
              <button
                onClick={() => handleUpdateConfig(item.key, editValue)}
                className="btn btn-primary btn-sm"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setEditingKey(null);
                  setEditValue(null);
                }}
                className="btn btn-secondary btn-sm"
              >
                Cancel
              </button>
            </div>
          );
        case 'number':
          return (
            <div className="config-editor">
              <input
                type="number"
                value={editValue}
                onChange={(e) => setEditValue(parseInt(e.target.value))}
                className="form-input"
              />
              <button
                onClick={() => handleUpdateConfig(item.key, editValue)}
                className="btn btn-primary btn-sm"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setEditingKey(null);
                  setEditValue(null);
                }}
                className="btn btn-secondary btn-sm"
              >
                Cancel
              </button>
            </div>
          );
        case 'json':
          return (
            <div className="config-editor">
              <textarea
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="form-textarea"
                rows={5}
              />
              <button
                onClick={() => {
                  try {
                    const parsed = JSON.parse(editValue);
                    handleUpdateConfig(item.key, parsed);
                  } catch {
                    toast.error('Invalid JSON');
                  }
                }}
                className="btn btn-primary btn-sm"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setEditingKey(null);
                  setEditValue(null);
                }}
                className="btn btn-secondary btn-sm"
              >
                Cancel
              </button>
            </div>
          );
        default:
          return (
            <div className="config-editor">
              <input
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="form-input"
              />
              <button
                onClick={() => handleUpdateConfig(item.key, editValue)}
                className="btn btn-primary btn-sm"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setEditingKey(null);
                  setEditValue(null);
                }}
                className="btn btn-secondary btn-sm"
              >
                Cancel
              </button>
            </div>
          );
      }
    }

    return (
      <div className="config-value-wrapper">
        <span className={`config-value ${item.sensitive ? 'sensitive' : ''}`}>
          {item.sensitive ? '••••••••' : formatValue(item.value, item.type)}
        </span>
        <button
          onClick={() => {
            setEditingKey(item.key);
            setEditValue(item.value);
          }}
          className="btn-edit"
          data-testid={`edit-${item.key}`}
        >
          Edit
        </button>
      </div>
    );
  };

  const filteredConfig = Object.entries(config).reduce((acc, [category, items]) => {
    const filtered = items.filter(item =>
      item.key.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.description?.toLowerCase().includes(searchTerm.toLowerCase())
    );
    if (filtered.length > 0) {
      acc[category] = filtered;
    }
    return acc;
  }, {} as ConfigCategory);

  const formatCategoryName = (category: string): string => {
    return category
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return <ErrorMessage message={error} />;
  }

  return (
    <div className="system-configuration" data-testid="system-configuration">
      <div className="config-header">
        <h2>System Configuration</h2>
        <div className="header-tabs">
          <button
            className={`tab-btn ${activeTab === 'config' ? 'active' : ''}`}
            onClick={() => setActiveTab('config')}
          >
            Configuration
          </button>
          <button
            className={`tab-btn ${activeTab === 'api-keys' ? 'active' : ''}`}
            onClick={() => setActiveTab('api-keys')}
          >
            API Keys
          </button>
        </div>
      </div>

      {activeTab === 'config' && (
        <>
          <div className="config-search">
            <input
              type="search"
              placeholder="Search configuration..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="config-search-input"
            />
          </div>

          <div className="config-groups">
            {Object.entries(filteredConfig).map(([category, items]) => (
              <div key={category} className="config-group">
                <h3 className="config-group-title">{formatCategoryName(category)}</h3>
                
                <div className="config-items">
                  {items.map(item => (
                    <div key={item.key} className="config-item">
                      <div className="config-info">
                        <div className="config-key">{item.key}</div>
                        {item.description && (
                          <div className="config-description">{item.description}</div>
                        )}
                        {item.lastModified && (
                          <div className="config-meta">
                            Last modified: {new Date(item.lastModified).toLocaleString()}
                            {item.modifiedBy && ` by ${item.modifiedBy}`}
                          </div>
                        )}
                      </div>

                      <div className="config-value-section">
                        {renderConfigEditor(item)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {activeTab === 'api-keys' && (
        <div className="api-keys-section">
          <div className="api-keys-header">
            <h3>API Keys</h3>
            <button
              onClick={() => setShowCreateApiKey(true)}
              className="btn btn-primary"
            >
              Create API Key
            </button>
          </div>

          <div className="api-keys-list">
            {apiKeys.map(apiKey => (
              <div key={apiKey.id} className="api-key-card">
                <div className="api-key-header">
                  <h4>{apiKey.name}</h4>
                  <div className="api-key-actions">
                    <button
                      onClick={() => handleRevokeApiKey(apiKey.id, apiKey.name)}
                      className="btn btn-danger btn-sm"
                    >
                      Revoke
                    </button>
                  </div>
                </div>
                <div className="api-key-details">
                  <div className="api-key-info">
                    <span className="label">Key:</span>
                    <code>{apiKey.key}</code>
                  </div>
                  <div className="api-key-info">
                    <span className="label">Scopes:</span>
                    <div className="scope-badges">
                      {apiKey.scopes.map(scope => (
                        <span key={scope} className="scope-badge">{scope}</span>
                      ))}
                    </div>
                  </div>
                  <div className="api-key-info">
                    <span className="label">Created:</span>
                    <span>{new Date(apiKey.createdAt).toLocaleDateString()}</span>
                  </div>
                  {apiKey.expiresAt && (
                    <div className="api-key-info">
                      <span className="label">Expires:</span>
                      <span>{new Date(apiKey.expiresAt).toLocaleDateString()}</span>
                    </div>
                  )}
                  {apiKey.lastUsed && (
                    <div className="api-key-info">
                      <span className="label">Last Used:</span>
                      <span>{new Date(apiKey.lastUsed).toLocaleString()}</span>
                    </div>
                  )}
                  <div className="api-key-info">
                    <span className="label">Usage Count:</span>
                    <span>{apiKey.usageCount.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {showCreateApiKey && (
            <div className="modal-overlay" onClick={() => setShowCreateApiKey(false)}>
              <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <h3>Create API Key</h3>
                
                <div className="form-group">
                  <label>Name</label>
                  <input
                    type="text"
                    value={newApiKey.name}
                    onChange={(e) => setNewApiKey({ ...newApiKey, name: e.target.value })}
                    placeholder="Production API Key"
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label>Scopes</label>
                  <div className="scope-checkboxes">
                    {['read', 'write', 'admin'].map(scope => (
                      <label key={scope} className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={newApiKey.scopes.includes(scope)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setNewApiKey({
                                ...newApiKey,
                                scopes: [...newApiKey.scopes, scope]
                              });
                            } else {
                              setNewApiKey({
                                ...newApiKey,
                                scopes: newApiKey.scopes.filter(s => s !== scope)
                              });
                            }
                          }}
                        />
                        {scope}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="form-group">
                  <label>Expires In (days)</label>
                  <input
                    type="number"
                    value={newApiKey.expiresIn}
                    onChange={(e) => setNewApiKey({ ...newApiKey, expiresIn: parseInt(e.target.value) })}
                    min="1"
                    max="365"
                    className="form-input"
                  />
                </div>

                <div className="modal-actions">
                  <button
                    onClick={handleCreateApiKey}
                    className="btn btn-primary"
                  >
                    Create Key
                  </button>
                  <button
                    onClick={() => setShowCreateApiKey(false)}
                    className="btn btn-secondary"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SystemConfiguration;