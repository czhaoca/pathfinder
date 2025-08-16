# Configuration Management API Documentation

This document provides comprehensive documentation for the Configuration Management API endpoints in the Pathfinder system.

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Configuration Endpoints](#configuration-endpoints)
4. [Feature Flag Endpoints](#feature-flag-endpoints)
5. [Rate Limiting Endpoints](#rate-limiting-endpoints)
6. [Template Endpoints](#template-endpoints)
7. [Audit and Monitoring](#audit-and-monitoring)
8. [Error Responses](#error-responses)
9. [Rate Limiting](#rate-limiting)
10. [Examples](#examples)

## Overview

The Configuration Management API provides a comprehensive system for managing application configurations, feature flags, rate limits, and configuration templates. All endpoints support environment-specific overrides and include comprehensive audit logging.

**Base URL**: `/api/config`

**API Version**: v1

**Content Type**: `application/json`

## Authentication

All endpoints require authentication using JWT tokens:

```http
Authorization: Bearer <jwt_token>
```

Most configuration management operations require admin privileges:
- **Admin roles**: `admin`, `site_admin`
- **Read-only access**: Available to authenticated users for specific endpoints

## Configuration Endpoints

### Get Configuration Value

Retrieve a specific configuration value with environment and user context.

```http
GET /api/config/{key}
```

**Parameters:**
- `key` (path, required): Configuration key
- `environment` (query, optional): Target environment
- `user_id` (query, optional): User context for personalized configs

**Response:**
```json
{
  "success": true,
  "data": {
    "key": "app.max_upload_size",
    "value": "50MB",
    "type": "string",
    "environment": "production",
    "has_override": true,
    "requires_restart": false,
    "last_modified": "2024-01-15T10:30:00Z"
  }
}
```

### List All Configurations

Retrieve all system configurations with filtering options.

```http
GET /api/config
```

**Query Parameters:**
- `environment` (optional): Filter by environment
- `category` (optional): Filter by category
- `search` (optional): Search in keys and descriptions
- `limit` (optional, default: 50): Maximum results
- `offset` (optional, default: 0): Pagination offset

**Response:**
```json
{
  "success": true,
  "data": {
    "configurations": [
      {
        "config_key": "app.max_upload_size",
        "config_value": "50MB",
        "config_type": "string",
        "category": "file_handling",
        "display_name": "Maximum Upload Size",
        "description": "Maximum file upload size allowed",
        "has_override": false,
        "requires_restart": false
      }
    ],
    "total": 150,
    "limit": 50,
    "offset": 0
  }
}
```

### Create Configuration

Create a new system configuration.

```http
POST /api/config
```

**Request Body:**
```json
{
  "config_key": "app.new_feature_timeout",
  "config_value": "30000",
  "config_type": "number",
  "category": "performance",
  "subcategory": "timeouts",
  "display_name": "New Feature Timeout",
  "description": "Timeout for new feature operations in milliseconds",
  "is_required": false,
  "min_value": 1000,
  "max_value": 300000,
  "cache_ttl_seconds": 300,
  "requires_restart": false
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "config_key": "app.new_feature_timeout",
    "created_at": "2024-01-15T10:30:00Z"
  }
}
```

### Update Configuration

Update an existing configuration value.

```http
PUT /api/config/{key}
```

**Request Body:**
```json
{
  "value": "45000",
  "environment": "production",
  "reason": "Increased timeout for better user experience",
  "validate_only": false
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "config_key": "app.new_feature_timeout",
    "previous_value": "30000",
    "new_value": "45000",
    "requires_restart": false,
    "updated_at": "2024-01-15T10:35:00Z"
  }
}
```

### Delete Configuration

Soft delete a configuration (marks as inactive).

```http
DELETE /api/config/{key}
```

**Request Body:**
```json
{
  "reason": "Configuration no longer needed"
}
```

### Get Configuration History

Retrieve change history for a specific configuration.

```http
GET /api/config/{key}/history
```

**Query Parameters:**
- `limit` (optional, default: 20): Maximum history entries
- `offset` (optional): Pagination offset

**Response:**
```json
{
  "success": true,
  "data": {
    "config_key": "app.max_upload_size",
    "history": [
      {
        "id": "hist_123",
        "action": "update",
        "old_value": "25MB",
        "new_value": "50MB",
        "environment": "production",
        "changed_by": "admin@example.com",
        "change_reason": "Increased for premium users",
        "change_timestamp": "2024-01-15T10:30:00Z"
      }
    ],
    "total": 5
  }
}
```

### Rollback Configuration

Rollback configuration to a previous value.

```http
POST /api/config/{key}/rollback
```

**Request Body:**
```json
{
  "steps": 1,
  "environment": "production",
  "reason": "Reverting problematic change"
}
```

### Bulk Operations

#### Bulk Update
```http
POST /api/config/bulk-update
```

**Request Body:**
```json
{
  "configurations": [
    {
      "key": "app.timeout",
      "value": "5000"
    },
    {
      "key": "app.retry_count",
      "value": "3"
    }
  ],
  "environment": "production",
  "reason": "Performance optimization batch update"
}
```

#### Bulk Validation
```http
POST /api/config/validate
```

**Request Body:**
```json
{
  "configurations": [
    {
      "key": "app.timeout",
      "value": "5000"
    },
    {
      "key": "app.invalid_config",
      "value": "invalid_value"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "all_valid": false,
    "results": [
      {
        "key": "app.timeout",
        "valid": true
      },
      {
        "key": "app.invalid_config",
        "valid": false,
        "errors": ["Value invalid_value is not in allowed values: option1, option2"]
      }
    ]
  }
}
```

## Feature Flag Endpoints

### List Feature Flags

```http
GET /api/config/features
```

**Query Parameters:**
- `environment` (optional): Filter by environment
- `category` (optional): Filter by category
- `enabled` (optional): Filter by enabled status

### Create Feature Flag

```http
POST /api/config/features
```

**Request Body:**
```json
{
  "feature_key": "new_ui_redesign",
  "feature_name": "New UI Redesign",
  "description": "Complete redesign of the user interface",
  "feature_category": "ui",
  "feature_type": "release",
  "enabled_environments": ["development", "staging"]
}
```

### Get Feature Flag Status

```http
GET /api/config/features/{key}
```

**Query Parameters:**
- `environment` (optional): Environment context
- `user_id` (optional): User context for targeting

**Response:**
```json
{
  "success": true,
  "data": {
    "feature_key": "new_ui_redesign",
    "enabled": true,
    "rollout_percentage": 25,
    "targeting_active": true,
    "user_eligible": true,
    "evaluation_reason": "percentage_rollout"
  }
}
```

### Enable Feature Flag

```http
POST /api/config/features/{key}/enable
```

**Request Body:**
```json
{
  "rollout_percentage": 50,
  "enabled_environments": ["production"],
  "enabled_for_users": ["user123", "user456"],
  "enabled_for_roles": ["beta_tester"],
  "targeting_rules": [
    {
      "type": "user_attribute",
      "attribute": "country",
      "operator": "in",
      "value": ["US", "CA"]
    }
  ],
  "reason": "Gradual rollout to US and CA users"
}
```

### Disable Feature Flag

```http
POST /api/config/features/{key}/disable
```

**Request Body:**
```json
{
  "reason": "Performance issues detected"
}
```

### Update Feature Flag

```http
PUT /api/config/features/{key}
```

**Request Body:**
```json
{
  "rollout_percentage": 75,
  "description": "Updated description",
  "targeting_rules": [
    {
      "type": "percentage",
      "operator": "percentage_in",
      "value": "75"
    }
  ],
  "reason": "Increasing rollout percentage"
}
```

## Rate Limiting Endpoints

### List Rate Limits

```http
GET /api/config/rate-limits
```

### Create Rate Limit

```http
POST /api/config/rate-limits
```

**Request Body:**
```json
{
  "limit_key": "api_requests_per_user",
  "limit_name": "API Requests Per User",
  "description": "Rate limit for API requests per user",
  "max_requests": 1000,
  "time_window_seconds": 3600,
  "scope_type": "user",
  "action_on_limit": "block",
  "exempted_users": ["admin@example.com"],
  "exempted_ips": ["192.168.1.100"]
}
```

### Get Rate Limit

```http
GET /api/config/rate-limits/{key}
```

### Update Rate Limit

```http
PUT /api/config/rate-limits/{key}
```

### Delete Rate Limit

```http
DELETE /api/config/rate-limits/{key}
```

### Check Rate Limit

```http
POST /api/config/rate-limits/{key}/check
```

**Request Body:**
```json
{
  "user_id": "user123",
  "ip_address": "192.168.1.50",
  "additional_context": {
    "endpoint": "/api/data",
    "method": "POST"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "allowed": true,
    "remaining_requests": 950,
    "reset_time": "2024-01-15T11:30:00Z",
    "limit_exceeded": false
  }
}
```

## Template Endpoints

### List Templates

```http
GET /api/config/templates
```

### Create Template

```http
POST /api/config/templates
```

**Request Body:**
```json
{
  "template_name": "microservice_defaults",
  "template_type": "microservice",
  "description": "Default configuration for microservices",
  "config_values": {
    "app.timeout": "30000",
    "app.retry_count": "3",
    "app.max_connections": "100"
  },
  "suitable_environments": ["development", "staging", "production"]
}
```

### Get Template

```http
GET /api/config/templates/{name}
```

### Apply Template

```http
POST /api/config/templates/{name}/apply
```

**Request Body:**
```json
{
  "environment": "development",
  "dry_run": false,
  "override_existing": false,
  "reason": "Setting up new development environment"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "template_name": "microservice_defaults",
    "environment": "development",
    "dry_run": false,
    "summary": {
      "total_configurations": 10,
      "successful": 8,
      "failed": 2,
      "skipped": 0
    },
    "results": {
      "configurations": [
        {
          "key": "app.timeout",
          "status": "success",
          "message": "Configuration created successfully"
        },
        {
          "key": "app.existing_config",
          "status": "failed",
          "message": "Configuration already exists"
        }
      ]
    }
  }
}
```

### Update Template

```http
PUT /api/config/templates/{name}
```

### Delete Template

```http
DELETE /api/config/templates/{name}
```

## Audit and Monitoring

### System Health

```http
GET /api/config/health
```

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2024-01-15T10:30:00Z",
    "database": {
      "status": "connected",
      "response_time_ms": 2.5
    },
    "cache": {
      "status": "connected",
      "hit_rate": 0.95,
      "memory_usage_mb": 128
    },
    "services": {
      "configuration_service": "healthy",
      "feature_flag_service": "healthy",
      "rate_limiter": "healthy"
    }
  }
}
```

### Configuration Statistics

```http
GET /api/config/stats
```

**Query Parameters:**
- `environment` (optional): Filter by environment
- `category` (optional): Filter by category

**Response:**
```json
{
  "success": true,
  "data": {
    "total_configurations": 150,
    "active_configurations": 148,
    "configurations_with_overrides": 25,
    "feature_flags": {
      "total": 45,
      "enabled": 32,
      "disabled": 13
    },
    "rate_limits": {
      "total": 20,
      "active": 18
    },
    "categories": {
      "performance": 45,
      "security": 30,
      "ui": 25,
      "integrations": 20,
      "other": 30
    },
    "cache_performance": {
      "hit_rate": 0.95,
      "avg_response_time_ms": 1.2
    }
  }
}
```

### Audit Trail

```http
GET /api/config/audit
```

**Query Parameters:**
- `action` (optional): Filter by action type
- `user_id` (optional): Filter by user
- `resource_type` (optional): Filter by resource type
- `resource_id` (optional): Filter by specific resource
- `start_date` (optional): Start date for filtering
- `end_date` (optional): End date for filtering
- `limit` (optional, default: 50): Maximum results

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "audit_123",
      "action": "config_updated",
      "resource_type": "system_config",
      "resource_id": "app.max_upload_size",
      "user_id": "admin@example.com",
      "user_email": "admin@example.com",
      "timestamp": "2024-01-15T10:30:00Z",
      "details": {
        "old_value": "25MB",
        "new_value": "50MB",
        "environment": "production",
        "reason": "Increased for premium users"
      },
      "ip_address": "192.168.1.100",
      "user_agent": "Mozilla/5.0..."
    }
  ]
}
```

### Export Audit Trail

```http
GET /api/config/audit/export
```

**Query Parameters:**
- `format` (required): Export format (`json`, `csv`, `xml`)
- `start_date` (optional): Start date
- `end_date` (optional): End date
- `limit` (optional): Maximum records

## Error Responses

All endpoints follow consistent error response format:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Configuration validation failed",
    "details": {
      "field": "config_value",
      "reason": "Value exceeds maximum allowed range"
    }
  }
}
```

### Common Error Codes

- `AUTHENTICATION_REQUIRED` (401): Missing or invalid authentication
- `INSUFFICIENT_PERMISSIONS` (403): User lacks required permissions
- `RESOURCE_NOT_FOUND` (404): Configuration/resource not found
- `VALIDATION_ERROR` (400): Input validation failed
- `CONFLICT` (409): Resource already exists or conflict detected
- `RATE_LIMITED` (429): Request rate limit exceeded
- `INTERNAL_ERROR` (500): Internal server error

## Rate Limiting

API endpoints are rate limited per user:

- **Default limit**: 1000 requests per hour
- **Admin operations**: 500 requests per hour
- **Bulk operations**: 100 requests per hour

Rate limit headers are included in responses:
```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 950
X-RateLimit-Reset: 1642251600
```

## Examples

### Complete Configuration Management Workflow

```bash
# 1. Create a new configuration
curl -X POST /api/config \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "config_key": "app.new_timeout",
    "config_value": "30000",
    "config_type": "number",
    "category": "performance",
    "description": "Timeout for new operations"
  }'

# 2. Update for production environment
curl -X PUT /api/config/app.new_timeout \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "value": "45000",
    "environment": "production",
    "reason": "Increased timeout for production load"
  }'

# 3. Check current value
curl -X GET /api/config/app.new_timeout?environment=production \
  -H "Authorization: Bearer $TOKEN"

# 4. View change history
curl -X GET /api/config/app.new_timeout/history \
  -H "Authorization: Bearer $TOKEN"
```

### Feature Flag Management

```bash
# 1. Create feature flag
curl -X POST /api/config/features \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "feature_key": "new_dashboard",
    "feature_name": "New Dashboard",
    "description": "Redesigned user dashboard",
    "feature_category": "ui"
  }'

# 2. Enable with 25% rollout
curl -X POST /api/config/features/new_dashboard/enable \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "rollout_percentage": 25,
    "reason": "Initial rollout to 25% of users"
  }'

# 3. Check if feature is enabled for specific user
curl -X GET /api/config/features/new_dashboard?user_id=user123 \
  -H "Authorization: Bearer $TOKEN"
```

### Template Application

```bash
# 1. Create configuration template
curl -X POST /api/config/templates \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "template_name": "api_defaults",
    "template_type": "api_service",
    "description": "Default configuration for API services",
    "config_values": {
      "api.timeout": "30000",
      "api.retry_count": "3",
      "api.rate_limit": "1000"
    }
  }'

# 2. Apply template to environment
curl -X POST /api/config/templates/api_defaults/apply \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "environment": "staging",
    "reason": "Setting up staging environment"
  }'
```

This documentation provides comprehensive coverage of all configuration management API endpoints, including detailed request/response examples, error handling, and practical usage scenarios.