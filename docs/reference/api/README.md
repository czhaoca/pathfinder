# Pathfinder API Documentation

## Overview

Pathfinder provides a comprehensive RESTful API for all platform functionality. The API follows REST principles and uses JSON for request and response payloads.

## API Documentation

1. [**REST API Reference**](./rest-api.md) - Complete endpoint documentation
2. [**Authentication**](./authentication.md) - Auth flows and security
3. [**Experience API**](./experience-api.md) - Experience management
4. [**Chat API**](./chat-api.md) - AI chat integration
5. [**Profile API**](./profile-api.md) - User profile management
6. [**MCP Integration**](./mcp-integration.md) - Model Context Protocol

## Base URL

```
Production: https://api.pathfinder.com/api/v1
Development: http://localhost:3000/api
```

## Authentication

All API requests require authentication using JWT tokens:

```http
Authorization: Bearer <token>
```

See the [Authentication Guide](./authentication.md) for details.

## Common Headers

```http
Content-Type: application/json
Accept: application/json
Authorization: Bearer <token>
X-Request-ID: <uuid>
```

## Response Format

### Success Response

```json
{
  "data": {
    // Response data
  },
  "meta": {
    "timestamp": "2024-01-01T00:00:00Z",
    "version": "1.0.0"
  }
}
```

### Error Response

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      {
        "field": "email",
        "message": "Invalid email format"
      }
    ]
  },
  "meta": {
    "timestamp": "2024-01-01T00:00:00Z",
    "request_id": "123e4567-e89b-12d3-a456-426614174000"
  }
}
```

## HTTP Status Codes

| Code | Description |
|------|-------------|
| 200 | OK - Request succeeded |
| 201 | Created - Resource created |
| 204 | No Content - Request succeeded with no response body |
| 400 | Bad Request - Invalid request data |
| 401 | Unauthorized - Authentication required |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource not found |
| 409 | Conflict - Resource already exists |
| 422 | Unprocessable Entity - Validation failed |
| 429 | Too Many Requests - Rate limit exceeded |
| 500 | Internal Server Error - Server error |

## Rate Limiting

API requests are rate limited per user:

- **General endpoints**: 100 requests per 15 minutes
- **Auth endpoints**: 5 requests per 15 minutes
- **Chat endpoints**: 20 requests per 60 minutes

Rate limit headers:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
```

## Pagination

List endpoints support pagination:

```http
GET /api/experiences?page=2&limit=20
```

Response includes pagination metadata:

```json
{
  "data": [...],
  "pagination": {
    "page": 2,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

## Filtering & Sorting

Many endpoints support filtering and sorting:

```http
GET /api/experiences?type=work&sort=-startDate&current=true
```

- Use `?field=value` for filtering
- Use `?sort=field` for ascending sort
- Use `?sort=-field` for descending sort

## API Versioning

The API uses URL versioning:

- Current version: `/api/v1`
- Version in headers: `X-API-Version: 1.0.0`

## SDK & Client Libraries

Official SDKs available for:

- JavaScript/TypeScript
- Python (coming soon)
- Go (coming soon)

## API Testing

Use our Postman collection for testing:

1. [Download Postman](https://www.postman.com/downloads/)
2. Import our [API Collection](./postman-collection.json)
3. Set up environment variables
4. Start testing

## OpenAPI Specification

Download our [OpenAPI 3.0 spec](./openapi.yaml) for:
- API documentation generation
- Client code generation
- API testing tools

## Related Documentation

- [Development Setup](../development/setup.md)
- [Authentication Guide](./authentication.md)
- [Error Handling](../development/error-handling.md)
- [Security Best Practices](../deployment/security/security-procedures.md)