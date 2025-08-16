# Configuration Management User Guide

This guide provides comprehensive instructions for using the Pathfinder Configuration Management system, covering everything from basic configuration updates to advanced feature flag management.

## Table of Contents

1. [Overview](#overview)
2. [Getting Started](#getting-started)
3. [Managing Configurations](#managing-configurations)
4. [Feature Flag Management](#feature-flag-management)
5. [Rate Limiting Configuration](#rate-limiting-configuration)
6. [Configuration Templates](#configuration-templates)
7. [Environment Management](#environment-management)
8. [Audit and Monitoring](#audit-and-monitoring)
9. [Best Practices](#best-practices)
10. [Troubleshooting](#troubleshooting)

## Overview

The Configuration Management system provides a centralized, database-driven approach to managing application settings, feature flags, and operational parameters. Key features include:

- **Environment-specific overrides**: Different values per environment
- **Feature flag management**: Control feature rollouts and A/B testing
- **Rate limiting configuration**: Dynamic rate limit management
- **Configuration templates**: Quick environment setup
- **Comprehensive audit trail**: Track all changes
- **Real-time updates**: Changes take effect immediately (or after restart)
- **Validation and dependencies**: Prevent invalid configurations

## Getting Started

### Accessing the Configuration Dashboard

1. Log in to the Pathfinder admin panel
2. Navigate to **System** → **Configuration Management**
3. Select your target environment from the environment selector

### Understanding the Interface

The configuration dashboard consists of several key sections:

- **Configuration List**: All system configurations with current values
- **Feature Flags**: Toggle and manage feature rollouts
- **Rate Limits**: Configure API and system rate limits
- **Templates**: Pre-defined configuration sets
- **Audit Trail**: History of all configuration changes
- **System Health**: Real-time system status

### Required Permissions

To manage configurations, you need one of the following roles:
- **System Administrator** (`admin`): Full configuration access
- **Site Administrator** (`site_admin`): Full configuration access
- **Configuration Manager** (`config_manager`): Limited configuration access

Regular users can view non-sensitive configurations but cannot modify them.

## Managing Configurations

### Viewing Configurations

1. In the configuration dashboard, use the filters to find specific configurations:
   - **Search**: Enter keywords to find configurations
   - **Category**: Filter by configuration category
   - **Environment**: View environment-specific values
   - **Type**: Filter by configuration type (string, number, boolean, etc.)

2. Click on any configuration to view detailed information:
   - Current value and type
   - Description and category
   - Environment overrides
   - Change history
   - Dependencies

### Creating New Configurations

1. Click **Add Configuration** in the configuration dashboard
2. Fill in the required fields:
   - **Configuration Key**: Unique identifier (e.g., `app.max_upload_size`)
   - **Display Name**: Human-readable name
   - **Description**: What this configuration controls
   - **Category**: Logical grouping (performance, security, ui, etc.)
   - **Type**: Data type (string, number, boolean, json, array)
   - **Default Value**: Initial value

3. Optional settings:
   - **Validation Rules**: Min/max values, allowed values, regex patterns
   - **Dependencies**: Other configurations this depends on
   - **Cache TTL**: How long to cache this value
   - **Restart Required**: Whether changes require application restart

4. Click **Create Configuration**

### Updating Configurations

#### Basic Update

1. Find the configuration you want to update
2. Click the **Edit** button (pencil icon)
3. Enter the new value in the type-appropriate input field
4. Provide a **change reason** (required for audit trail)
5. Click **Save Changes**

#### Environment-Specific Override

1. Select the target environment from the environment selector
2. Edit the configuration as above
3. The system will create an environment-specific override
4. Base configuration remains unchanged for other environments

**Example**: Setting production timeout higher than development:
- Development: `app.request_timeout = 30000` (30 seconds)
- Production: `app.request_timeout = 60000` (60 seconds, override)

#### Advanced Update Options

- **Validate Only**: Test the change without applying it
- **Schedule Change**: Set the change to take effect at a specific time
- **Bulk Update**: Update multiple configurations simultaneously

### Configuration Types and Examples

#### String Configurations
```
Key: app.welcome_message
Type: string
Value: "Welcome to Pathfinder!"
Use Case: Text messages, URLs, file paths
```

#### Number Configurations
```
Key: app.max_upload_size_mb
Type: number
Value: 50
Validation: Min: 1, Max: 1000
Use Case: Timeouts, limits, thresholds
```

#### Boolean Configurations
```
Key: feature.maintenance_mode
Type: boolean
Value: false
Use Case: Enable/disable features or modes
```

#### JSON Configurations
```
Key: app.email_settings
Type: json
Value: {
  "smtp_host": "smtp.example.com",
  "smtp_port": 587,
  "use_tls": true
}
Use Case: Complex settings, API configurations
```

#### Array Configurations
```
Key: app.allowed_domains
Type: array
Value: ["example.com", "subdomain.example.com"]
Use Case: Lists of values, multiple options
```

### Configuration Dependencies

Some configurations depend on others. The system automatically validates dependencies:

**Example**:
- `database.enable_ssl` (boolean) depends on `database.ssl_cert_path` (string)
- If SSL is enabled, the certificate path must be provided
- If SSL is disabled, the certificate path is optional

### Rollback and History

#### Viewing Change History

1. Click on any configuration
2. Click **View History** 
3. See all changes with:
   - Previous and new values
   - Change timestamp
   - User who made the change
   - Change reason

#### Rolling Back Changes

1. In the configuration history, find the version to roll back to
2. Click **Rollback to this version**
3. Confirm the rollback action
4. Provide a reason for the rollback

**Note**: Rollbacks create new history entries and don't delete the previous change record.

## Feature Flag Management

Feature flags allow you to control feature rollouts, perform A/B testing, and enable/disable functionality without code deployments.

### Creating Feature Flags

1. Navigate to **Feature Flags** tab
2. Click **Add Feature Flag**
3. Configure the feature:
   - **Feature Key**: Unique identifier (e.g., `new_dashboard_ui`)
   - **Feature Name**: Display name
   - **Description**: What this feature does
   - **Category**: Feature category (ui, api, experimental, etc.)
   - **Type**: Feature type (release, experiment, operational)

### Feature Flag States

- **Disabled**: Feature is off for all users
- **Enabled**: Feature follows targeting rules
- **Archived**: Feature is no longer in use

### Targeting and Rollout Options

#### Environment Targeting
Enable features only in specific environments:
```
Enabled Environments: ["development", "staging"]
Production: Feature disabled
```

#### User Targeting
Enable features for specific users:
```
Enabled Users: ["admin@example.com", "beta.tester@example.com"]
```

#### Role Targeting
Enable features for users with specific roles:
```
Enabled Roles: ["admin", "beta_tester", "premium_user"]
```

#### Percentage Rollout
Gradually roll out features to a percentage of users:
```
Rollout Percentage: 25%
- Enables feature for 25% of users
- Uses consistent hashing (same user always gets same result)
- Increase percentage over time for gradual rollout
```

#### Advanced Targeting Rules
Create complex targeting conditions:

```json
{
  "rules": [
    {
      "type": "user_attribute",
      "attribute": "country",
      "operator": "in",
      "value": ["US", "CA", "GB"]
    },
    {
      "type": "user_attribute", 
      "attribute": "subscription_tier",
      "operator": "equals",
      "value": "premium"
    }
  ],
  "combinator": "AND"
}
```

This enables the feature only for premium users in US, Canada, or UK.

### Feature Flag Best Practices

1. **Use descriptive names**: `new_checkout_flow` instead of `feature_123`
2. **Start with small rollouts**: Begin with 1-5% of users
3. **Monitor metrics**: Track feature performance and user behavior
4. **Clean up old flags**: Remove flags after features are fully released
5. **Document dependencies**: Note which features depend on others

### Common Feature Flag Scenarios

#### Gradual Rollout
```
Day 1: Enable for 5% of users
Day 3: Increase to 25% if metrics look good
Day 7: Increase to 50%
Day 10: Full rollout (100%)
```

#### A/B Testing
```
Feature A: control_group = false (50% of users)
Feature B: new_algorithm = true (50% of users)
Measure conversion rates for each group
```

#### Emergency Disable
```
If issues detected:
1. Go to Feature Flags dashboard
2. Find the problematic feature
3. Click "Disable" immediately
4. Feature turns off for all users
```

## Rate Limiting Configuration

Rate limiting helps protect your system from abuse and ensures fair resource usage.

### Creating Rate Limits

1. Navigate to **Rate Limits** tab
2. Click **Add Rate Limit**
3. Configure the limit:
   - **Limit Key**: Unique identifier (e.g., `api_requests_per_user`)
   - **Name**: Human-readable name
   - **Description**: What this limit protects
   - **Max Requests**: Number of allowed requests
   - **Time Window**: Time period in seconds
   - **Scope**: How to group requests (user, IP, global, custom)

### Rate Limit Scopes

#### Per User
```
Scope: user
Max Requests: 1000
Time Window: 3600 seconds (1 hour)
Result: Each user can make 1000 requests per hour
```

#### Per IP Address
```
Scope: ip
Max Requests: 100
Time Window: 60 seconds
Result: Each IP can make 100 requests per minute
```

#### Global
```
Scope: global
Max Requests: 10000
Time Window: 60 seconds
Result: All users combined can make 10,000 requests per minute
```

#### Custom Scope
```
Scope: custom
Scope Key: "api_endpoint_{endpoint}_user_{user_id}"
Result: Rate limit per endpoint per user
```

### Rate Limit Actions

When a rate limit is exceeded, you can configure different actions:

- **Block**: Reject the request with 429 status
- **Throttle**: Delay the request
- **Warning**: Log the event but allow the request
- **Graceful Degradation**: Return cached or simplified response

### Exemptions

Configure exemptions for specific users or IP addresses:

```
Exempted Users: ["admin@example.com", "monitoring@service.com"]
Exempted IPs: ["192.168.1.100", "10.0.0.0/8"]
```

### Monitoring Rate Limits

1. View current rate limit usage in the **Rate Limits** dashboard
2. Set up alerts for when limits are frequently exceeded
3. Monitor the **Rate Limit Statistics** page for trends

## Configuration Templates

Templates allow you to quickly apply sets of configurations to new environments or services.

### Creating Templates

1. Navigate to **Templates** tab
2. Click **Create Template**
3. Configure the template:
   - **Template Name**: Unique identifier
   - **Type**: Template category (microservice, frontend, database, etc.)
   - **Description**: What this template sets up
   - **Suitable Environments**: Which environments this applies to

4. Add configurations:
   ```json
   {
     "app.timeout": "30000",
     "app.retry_count": "3",
     "app.max_connections": "100",
     "logging.level": "info"
   }
   ```

### Applying Templates

1. Select the template to apply
2. Choose the target environment
3. Configure application options:
   - **Dry Run**: Preview changes without applying
   - **Override Existing**: Whether to update existing configurations
   - **Skip Conflicts**: Skip configurations that already exist

4. Click **Apply Template**
5. Review the results and any conflicts

### Template Examples

#### Microservice Template
```json
{
  "service.port": "3000",
  "service.timeout": "30000",
  "service.max_connections": "100",
  "logging.level": "info",
  "metrics.enabled": "true",
  "health_check.interval": "30000"
}
```

#### Development Environment Template
```json
{
  "debug.enabled": "true",
  "logging.level": "debug",
  "cache.ttl": "60",
  "database.connection_pool_size": "5",
  "feature.debug_toolbar": "true"
}
```

#### Production Environment Template
```json
{
  "debug.enabled": "false",
  "logging.level": "warn",
  "cache.ttl": "3600",
  "database.connection_pool_size": "20",
  "security.strict_mode": "true"
}
```

## Environment Management

The system supports multiple environments with inheritance and overrides.

### Environment Hierarchy

```
Production (prod)
├── Staging (staging) - inherits from prod
├── Development (dev) - inherits from staging
└── Testing (test) - inherits from dev
```

### Environment-Specific Configurations

1. **Base Configuration**: Applies to all environments
2. **Environment Override**: Specific value for an environment
3. **Inheritance**: Child environments inherit parent values unless overridden

### Managing Environment Overrides

1. Select the target environment
2. Edit any configuration
3. The system creates an environment-specific override
4. Other environments continue using the base value or their own overrides

### Environment Promotion

Promote configurations from one environment to another:

1. In the source environment, select configurations to promote
2. Click **Promote to [Target Environment]**
3. Review the changes that will be applied
4. Confirm the promotion

**Example**: Promoting staging configurations to production:
```
Staging: app.new_feature_timeout = 45000
Production: app.new_feature_timeout = 30000 (current)

After promotion:
Production: app.new_feature_timeout = 45000 (updated)
```

## Audit and Monitoring

### Viewing Audit Logs

1. Navigate to **Audit Trail** tab
2. Filter logs by:
   - Date range
   - User
   - Action type
   - Configuration key
   - Environment

3. View detailed information for each change:
   - What changed
   - Who made the change
   - When it happened
   - Why it was changed
   - Previous and new values

### System Health Monitoring

The **System Health** dashboard shows:

- **Configuration Service**: Status and response times
- **Feature Flag Service**: Status and evaluation performance
- **Rate Limiter**: Status and current limits
- **Database**: Connection status and query performance
- **Cache**: Hit rates and memory usage

### Setting Up Alerts

Configure alerts for important events:

1. Go to **Settings** → **Alerts**
2. Create alert rules:
   - Configuration changes in production
   - Feature flags disabled due to errors
   - Rate limits frequently exceeded
   - System health degradation

### Exporting Audit Data

Export audit logs for compliance or analysis:

1. Navigate to **Audit Trail**
2. Set date range and filters
3. Click **Export**
4. Choose format (JSON, CSV, XML)
5. Download the file

## Best Practices

### Configuration Management

1. **Use descriptive keys**: `email.smtp.timeout` instead of `timeout1`
2. **Group related configs**: Use consistent category naming
3. **Document everything**: Provide clear descriptions
4. **Set appropriate validation**: Prevent invalid values
5. **Use environment overrides**: Don't duplicate configurations
6. **Test changes**: Use validation before applying
7. **Provide change reasons**: Always explain why changes are made

### Feature Flag Management

1. **Start small**: Begin with limited rollouts
2. **Monitor actively**: Track metrics during rollouts
3. **Clean up regularly**: Remove unused flags
4. **Use consistent naming**: Follow team conventions
5. **Document dependencies**: Note feature interactions
6. **Plan for rollback**: Always have a disable strategy

### Security Considerations

1. **Protect sensitive configs**: Mark as sensitive to hide values
2. **Use least privilege**: Grant minimal necessary permissions
3. **Audit regularly**: Review who has access and what they're changing
4. **Monitor for anomalies**: Set up alerts for unusual changes
5. **Backup configurations**: Regular exports for disaster recovery

### Performance Optimization

1. **Set appropriate cache TTLs**: Balance freshness vs. performance
2. **Use batch operations**: Update multiple configs together
3. **Monitor cache hit rates**: Ensure caching is effective
4. **Optimize database queries**: Regular performance reviews
5. **Consider restart requirements**: Minimize configs requiring restarts

## Troubleshooting

### Common Issues

#### Configuration Not Taking Effect

**Symptoms**: Changed configuration but application still uses old value

**Solutions**:
1. Check if configuration requires restart (look for restart badge)
2. Verify correct environment is selected
3. Check cache TTL - may need to wait for cache expiration
4. Clear application cache if necessary

#### Feature Flag Not Working

**Symptoms**: Feature flag enabled but feature not showing for users

**Solutions**:
1. Verify targeting rules are correctly configured
2. Check if user meets targeting criteria
3. Ensure feature flag is enabled (not just created)
4. Check environment targeting
5. Verify percentage rollout includes the test user

#### Rate Limit Too Restrictive

**Symptoms**: Legitimate users being blocked by rate limits

**Solutions**:
1. Review rate limit metrics to understand usage patterns
2. Increase limit values or extend time windows
3. Add user/IP exemptions for known good actors
4. Consider changing scope (e.g., per-user instead of per-IP)

#### Validation Errors

**Symptoms**: Cannot save configuration due to validation errors

**Solutions**:
1. Check value format matches configuration type
2. Verify value is within allowed range
3. Ensure value matches regex pattern if specified
4. Check for dependency conflicts

### Getting Help

1. **Documentation**: Check this user guide and API documentation
2. **System Health**: Review health dashboard for system issues
3. **Audit Logs**: Check recent changes that might have caused issues
4. **Support Team**: Contact system administrators with:
   - Configuration key affected
   - Error messages
   - Expected vs. actual behavior
   - Steps to reproduce

### Debugging Tips

1. **Use dry runs**: Test changes before applying
2. **Check logs**: Review application logs for configuration-related errors
3. **Validate incrementally**: Make small changes and test each one
4. **Use templates**: Start with known-good configurations
5. **Monitor metrics**: Watch system performance after changes

This user guide provides comprehensive coverage of the Configuration Management system. For technical details and API usage, refer to the [Configuration Management API Documentation](../api/configuration-management.md).