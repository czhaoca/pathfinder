# API Reference

The Pathfinder API is a RESTful service that provides endpoints for all application features. All endpoints require authentication unless otherwise specified.

## Base URL

```
Development: http://localhost:3000/api
Production: https://api.pathfinder.app/api
```

## Authentication

Most endpoints require JWT authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

## API Endpoints

### Core APIs

#### [Authentication](./authentication.md)
- `POST /auth/register` - Register new user
- `POST /auth/login` - User login
- `POST /auth/logout` - User logout
- `POST /auth/refresh` - Refresh JWT token
- `POST /auth/verify-email` - Email verification
- `POST /auth/reset-password` - Password reset

#### [User Profile](./profile.md)
- `GET /profile` - Get user profile
- `PUT /profile` - Update profile
- `POST /profile/avatar` - Upload avatar
- `DELETE /profile` - Delete account

#### [Experiences](./experiences.md)
- `GET /experiences` - List all experiences
- `POST /experiences` - Create experience
- `GET /experiences/:id` - Get experience details
- `PUT /experiences/:id` - Update experience
- `DELETE /experiences/:id` - Delete experience
- `POST /experiences/bulk` - Bulk import

### Feature APIs

#### [Chat](./chat.md)
- `POST /chat/message` - Send chat message
- `POST /chat/stream` - Stream chat response
- `GET /chat/conversations` - List conversations
- `GET /chat/conversations/:id` - Get conversation
- `DELETE /chat/conversations/:id` - Delete conversation

#### [Analytics](./analytics.md)
- `GET /analytics/overview` - Career overview
- `GET /analytics/skills` - Skills analysis
- `GET /analytics/trajectory` - Career trajectory
- `GET /analytics/impact` - Impact metrics
- `GET /analytics/export` - Export analytics

#### [Resume Builder](./resume.md)
- `POST /resume/generate` - Generate resume
- `GET /resume/templates` - List templates
- `POST /resume/optimize` - ATS optimization
- `GET /resume/:id` - Get resume
- `POST /resume/:id/download` - Download resume

#### [CPA PERT](./cpa-pert.md)
- `GET /cpa-pert/competencies` - List competencies
- `POST /cpa-pert/responses` - Create response
- `GET /cpa-pert/responses` - List responses
- `PUT /cpa-pert/responses/:id` - Update response
- `GET /cpa-pert/progress` - Track progress
- `POST /cpa-pert/validate` - Validate compliance

### Advanced Features

#### [Career Paths](./career-paths.md)
- `GET /career-paths` - Explore career paths
- `GET /career-paths/:id` - Path details
- `POST /career-paths/recommend` - Get recommendations
- `GET /career-paths/skills-gap` - Skills gap analysis

#### [Professional Networking](./networking.md)
- `GET /networking/contacts` - List contacts
- `POST /networking/contacts` - Add contact
- `GET /networking/interactions` - List interactions
- `POST /networking/reminders` - Set reminders

#### [Job Search](./job-search.md)
- `GET /jobs/search` - Search jobs
- `GET /jobs/:id` - Job details
- `POST /jobs/applications` - Track application
- `GET /jobs/matches` - Get job matches

#### [Learning & Development](./learning.md)
- `GET /learning/recommendations` - Get recommendations
- `GET /learning/courses` - Browse courses
- `POST /learning/progress` - Track progress
- `GET /learning/certifications` - Manage certifications

## Common Patterns

### Request Format
```json
{
  "data": {
    // Request payload
  }
}
```

### Response Format
```json
{
  "success": true,
  "data": {
    // Response data
  },
  "meta": {
    "timestamp": "2025-02-03T10:00:00Z",
    "version": "1.0.0"
  }
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message",
    "details": {}
  }
}
```

### Pagination
```
GET /api/experiences?page=1&limit=20&sort=createdAt&order=desc
```

Response includes pagination metadata:
```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "pages": 5
  }
}
```

### Filtering
```
GET /api/experiences?role=developer&company=tech&year=2024
```

### Sorting
```
GET /api/experiences?sort=startDate&order=asc
```

## Rate Limiting

- **Default**: 100 requests per 15 minutes per IP
- **Authenticated**: 1000 requests per 15 minutes per user
- **Headers**:
  - `X-RateLimit-Limit`: Request limit
  - `X-RateLimit-Remaining`: Remaining requests
  - `X-RateLimit-Reset`: Reset timestamp

## Status Codes

- `200 OK` - Successful request
- `201 Created` - Resource created
- `204 No Content` - Successful with no response body
- `400 Bad Request` - Invalid request
- `401 Unauthorized` - Authentication required
- `403 Forbidden` - Access denied
- `404 Not Found` - Resource not found
- `409 Conflict` - Resource conflict
- `422 Unprocessable Entity` - Validation error
- `429 Too Many Requests` - Rate limit exceeded
- `500 Internal Server Error` - Server error

## Security Headers

All API responses include security headers:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Strict-Transport-Security: max-age=31536000`

## API Versioning

The API uses URL versioning. Current version: v1
Future versions will be available at `/api/v2/...`

## SDK Support

Official SDKs planned for:
- JavaScript/TypeScript
- Python
- Go

## Testing

Use the provided Postman collection or curl examples in each endpoint documentation.

## Support

- [API Status Page](https://status.pathfinder.app)
- [Developer Forum](https://forum.pathfinder.app)
- [GitHub Issues](https://github.com/czhaoca/pathfinder/issues)