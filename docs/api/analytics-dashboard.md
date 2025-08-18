# Analytics Dashboard API Documentation

## Overview

The Analytics Dashboard API provides comprehensive endpoints for accessing user metrics, engagement data, and platform performance analytics.

## Authentication

All analytics dashboard endpoints require:
- Valid JWT authentication token
- Admin role authorization

## Base URL

```
/api/analytics/dashboard
```

## Endpoints

### Get Dashboard Overview

Returns comprehensive dashboard metrics for the specified date range.

**Endpoint:** `GET /overview`

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| startDate | ISO 8601 | No | Start of date range (default: 30 days ago) |
| endDate | ISO 8601 | No | End of date range (default: today) |

**Response:**
```json
{
  "success": true,
  "data": {
    "userMetrics": {
      "totalUsers": 1000,
      "newUsers": 50,
      "activeUsers": {
        "daily": 300,
        "weekly": 600,
        "monthly": 800
      },
      "growth": {
        "rate": 5.2,
        "trend": "growing"
      },
      "churn": {
        "rate": 2.1,
        "count": 21
      }
    },
    "engagementMetrics": {
      "sessions": {
        "total": 5000,
        "average": 5,
        "duration": {
          "average": 300,
          "median": 250
        }
      },
      "pageViews": {
        "total": 20000,
        "perSession": 4,
        "unique": 150
      },
      "bounce": {
        "rate": 25,
        "count": 1250
      }
    },
    "performanceMetrics": {
      "pageLoad": {
        "average": 1500,
        "median": 1200,
        "p95": 3000,
        "p99": 5000
      },
      "apiLatency": {
        "average": 200,
        "median": 150,
        "p95": 500,
        "p99": 1000
      },
      "errors": {
        "total": 50,
        "rate": 1.5
      },
      "availability": {
        "uptime": 99.9,
        "incidents": 1
      }
    },
    "generatedAt": "2024-01-31T12:00:00Z"
  }
}
```

### Get Real-time Metrics

Returns current real-time metrics for the last 5 minutes.

**Endpoint:** `GET /realtime`

**Response:**
```json
{
  "success": true,
  "data": {
    "timestamp": "2024-01-31T12:00:00Z",
    "activeUsers": 45,
    "activeSessions": 78,
    "eventsPerSecond": 12.5,
    "errorRate": 0.5,
    "topPages": [
      { "url": "/dashboard", "views": 23 },
      { "url": "/profile", "views": 15 }
    ],
    "recentErrors": [
      {
        "message": "API timeout",
        "timestamp": "2024-01-31T11:59:45Z"
      }
    ]
  }
}
```

### Get Retention Cohorts

Returns user retention cohort analysis.

**Endpoint:** `GET /cohorts/retention`

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| cohortType | string | No | 'daily', 'weekly', or 'monthly' (default: 'weekly') |
| startDate | ISO 8601 | No | Start of cohort period |
| endDate | ISO 8601 | No | End of cohort period |

**Response:**
```json
{
  "success": true,
  "data": {
    "cohortType": "weekly",
    "cohorts": [
      {
        "cohortDate": "2024-01-01",
        "cohortSize": 100,
        "retention": [
          { "day": 0, "retained": 100, "percentage": 100 },
          { "day": 1, "retained": 80, "percentage": 80 },
          { "day": 7, "retained": 50, "percentage": 50 },
          { "day": 30, "retained": 30, "percentage": 30 }
        ]
      }
    ],
    "summary": {
      "averageDay1Retention": 77.5,
      "averageDay7Retention": 47.9,
      "averageDay30Retention": 29.6
    }
  }
}
```

### Get Funnel Analysis

Returns conversion funnel analysis for specified funnel.

**Endpoint:** `GET /funnels/:funnelId`

**Path Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| funnelId | string | Funnel identifier (e.g., 'onboarding', 'engagement', 'conversion') |

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| startDate | ISO 8601 | No | Start of analysis period |
| endDate | ISO 8601 | No | End of analysis period |
| segment | string | No | User segment filter |

**Response:**
```json
{
  "success": true,
  "data": {
    "funnelId": "onboarding",
    "name": "Onboarding Funnel",
    "steps": [
      {
        "name": "Registration",
        "users": 1000,
        "conversionRate": 100,
        "dropoff": 0,
        "dropoffRate": 0
      },
      {
        "name": "Profile Setup",
        "users": 750,
        "conversionRate": 75,
        "dropoff": 250,
        "dropoffRate": 25
      },
      {
        "name": "First Experience",
        "users": 500,
        "conversionRate": 66.7,
        "dropoff": 250,
        "dropoffRate": 33.3
      }
    ],
    "overallConversion": 50,
    "period": {
      "startDate": "2024-01-01",
      "endDate": "2024-01-31"
    }
  }
}
```

### Get Feature Adoption

Returns feature adoption metrics.

**Endpoint:** `GET /features/adoption`

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| startDate | ISO 8601 | No | Start of period |
| endDate | ISO 8601 | No | End of period |

**Response:**
```json
{
  "success": true,
  "data": {
    "features": [
      {
        "featureName": "Experience Editor",
        "uniqueUsers": 450,
        "totalUsage": 2300,
        "adoptionRate": 45,
        "averageUsagePerUser": 5.1,
        "trend": "growing",
        "firstUsed": "2024-01-01",
        "lastUsed": "2024-01-31"
      }
    ],
    "summary": {
      "totalFeatures": 15,
      "averageAdoptionRate": 32.5,
      "mostUsed": { "feature": "Dashboard", "usage": 5000 },
      "leastUsed": { "feature": "Advanced Settings", "usage": 50 }
    }
  }
}
```

### Get User Lifecycle Stages

Returns user lifecycle stage distribution.

**Endpoint:** `GET /lifecycle/stages`

**Response:**
```json
{
  "success": true,
  "data": {
    "stages": [
      {
        "stage": "new",
        "count": 150,
        "percentage": 15
      },
      {
        "stage": "active",
        "count": 400,
        "percentage": 40
      },
      {
        "stage": "engaged",
        "count": 250,
        "percentage": 25
      },
      {
        "stage": "atRisk",
        "count": 100,
        "percentage": 10
      },
      {
        "stage": "dormant",
        "count": 100,
        "percentage": 10
      }
    ],
    "transitions": {
      "newToActive": 120,
      "activeToEngaged": 80,
      "activeToAtRisk": 30,
      "atRiskToDormant": 20,
      "reactivated": 15
    }
  }
}
```

### Generate Report

Generates a comprehensive analytics report.

**Endpoint:** `POST /reports/generate`

**Request Body:**
```json
{
  "type": "comprehensive",
  "startDate": "2024-01-01",
  "endDate": "2024-01-31",
  "metrics": ["users", "engagement", "retention", "performance"],
  "format": "pdf"
}
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| type | string | No | Report type (default: 'comprehensive') |
| startDate | ISO 8601 | Yes | Start of report period |
| endDate | ISO 8601 | Yes | End of report period |
| metrics | array | Yes | Metrics to include |
| format | string | Yes | 'json', 'csv', 'pdf', or 'excel' |

**Response:**
- For JSON format: Returns data object
- For file formats: Returns file download

### Export Dashboard

Exports current dashboard view.

**Endpoint:** `GET /export`

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| format | string | No | 'json' or 'csv' (default: 'json') |
| startDate | ISO 8601 | No | Start of export period |
| endDate | ISO 8601 | No | End of export period |

## Error Responses

All endpoints may return the following error responses:

### 401 Unauthorized
```json
{
  "success": false,
  "error": "Authentication required",
  "message": "Please provide a valid authentication token"
}
```

### 403 Forbidden
```json
{
  "success": false,
  "error": "Insufficient permissions",
  "message": "Admin role required to access analytics dashboard"
}
```

### 400 Bad Request
```json
{
  "success": false,
  "error": "Invalid parameters",
  "message": "Start date must be before end date"
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "error": "Server error",
  "message": "An unexpected error occurred"
}
```

## Rate Limiting

- General API limit: 100 requests per 15 minutes
- Report generation: 10 requests per hour
- Export operations: 20 requests per hour

## WebSocket Events (Real-time Updates)

Connect to WebSocket endpoint for real-time updates:

```javascript
const ws = new WebSocket('wss://api.example.com/analytics/realtime');

ws.on('message', (data) => {
  const metrics = JSON.parse(data);
  // Handle real-time metrics update
});
```

### Event Types
- `metrics:update` - Real-time metrics update
- `alert:critical` - Critical system alert
- `user:activity` - User activity event

## Examples

### JavaScript/TypeScript
```typescript
// Get dashboard overview
const response = await fetch('/api/analytics/dashboard/overview', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
const data = await response.json();

// Generate monthly report
const report = await fetch('/api/analytics/dashboard/reports/generate', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    startDate: '2024-01-01',
    endDate: '2024-01-31',
    metrics: ['users', 'engagement'],
    format: 'pdf'
  })
});
```

### cURL
```bash
# Get real-time metrics
curl -X GET https://api.example.com/api/analytics/dashboard/realtime \
  -H "Authorization: Bearer YOUR_TOKEN"

# Get retention cohorts
curl -X GET "https://api.example.com/api/analytics/dashboard/cohorts/retention?cohortType=weekly" \
  -H "Authorization: Bearer YOUR_TOKEN"
```