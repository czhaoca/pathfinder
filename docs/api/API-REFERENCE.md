# Pathfinder API Reference

## Overview

The Pathfinder API is a RESTful API that provides comprehensive career navigation and experience management functionality. All API responses follow a standardized format for consistency.

## Base URL

```
Development: http://localhost:3000/api
Production: https://api.pathfinder.ai/api
```

## Authentication

Most endpoints require authentication using JWT tokens.

### Headers

```http
Authorization: Bearer <token>
Content-Type: application/json
```

## Standard Response Format

All API responses follow this structure:

### Success Response

```json
{
  "success": true,
  "message": "Success message",
  "data": {
    // Response data
  },
  "timestamp": "2025-08-07T12:00:00.000Z"
}
```

### Error Response

```json
{
  "success": false,
  "message": "Error message",
  "errors": [
    {
      "field": "fieldName",
      "message": "Validation error message"
    }
  ],
  "timestamp": "2025-08-07T12:00:00.000Z"
}
```

### Paginated Response

```json
{
  "success": true,
  "message": "Success",
  "data": {
    "items": [],
    "pagination": {
      "total": 100,
      "page": 1,
      "perPage": 20,
      "totalPages": 5,
      "hasNext": true,
      "hasPrev": false
    }
  },
  "timestamp": "2025-08-07T12:00:00.000Z"
}
```

## API Endpoints

### Authentication

#### POST /auth/register
Create a new user account.

**Request Body:**
```json
{
  "username": "string",
  "email": "string",
  "password": "string",
  "firstName": "string",
  "lastName": "string"
}
```

**Response:** User object with tokens

---

#### POST /auth/login
Authenticate user and receive tokens.

**Request Body:**
```json
{
  "username": "string",
  "password": "string"
}
```

**Response:**
```json
{
  "user": { /* user object */ },
  "token": "jwt_token",
  "refreshToken": "refresh_token"
}
```

---

#### POST /auth/refresh
Refresh access token.

**Request Body:**
```json
{
  "refreshToken": "string"
}
```

---

#### POST /auth/logout
Logout user and invalidate tokens.

---

### User Management

#### GET /users/profile
Get current user profile.

**Response:** User object

---

#### PUT /users/profile
Update user profile.

**Request Body:**
```json
{
  "firstName": "string",
  "lastName": "string",
  "email": "string",
  "phone": "string",
  "bio": "string"
}
```

---

### Experiences

#### GET /experiences
Get user's experiences with pagination.

**Query Parameters:**
- `page` (number): Page number (default: 1)
- `limit` (number): Items per page (default: 20)
- `sort` (string): Sort field
- `order` (string): Sort order (ASC/DESC)

---

#### POST /experiences
Create new experience.

**Request Body:**
```json
{
  "title": "string",
  "company": "string",
  "location": "string",
  "startDate": "date",
  "endDate": "date",
  "description": "string",
  "skills": ["string"],
  "achievements": ["string"]
}
```

---

#### PUT /experiences/:id
Update experience.

---

#### DELETE /experiences/:id
Delete experience.

---

### Career Chat

#### GET /chat/conversations
Get user's chat conversations.

---

#### POST /chat/conversations
Create new conversation.

**Request Body:**
```json
{
  "title": "string",
  "context": "string"
}
```

---

#### POST /chat/conversations/:id/messages
Send message in conversation.

**Request Body:**
```json
{
  "message": "string",
  "context": {}
}
```

---

### Career Path Planning

#### GET /career-paths/search
Search career paths.

**Query Parameters:**
- `q` (string): Search query
- `industry` (string): Industry filter
- `level` (string): Career level

---

#### GET /career-paths/visualization
Get career path visualization.

**Query Parameters:**
- `targetNodeId` (string): Target career node
- `currentNodeId` (string): Current position

---

#### POST /career-paths/goals
Create career goal.

**Request Body:**
```json
{
  "targetNodeId": "string",
  "targetDate": "date",
  "description": "string"
}
```

---

### Job Search

#### GET /job-search/jobs/search
Search job listings.

**Query Parameters:**
- `q` (string): Search query
- `location` (string): Location filter
- `remoteOnly` (boolean): Remote jobs only
- `experienceLevel` (string): Experience level
- `jobType` (string): Job type
- `salaryMin` (number): Minimum salary
- `salaryMax` (number): Maximum salary

---

#### GET /job-search/jobs/recommended
Get recommended jobs based on profile.

---

#### POST /job-search/applications
Create job application.

**Request Body:**
```json
{
  "jobId": "string",
  "status": "string",
  "applicationDate": "date",
  "notes": "string"
}
```

---

#### GET /job-search/applications
Get user's job applications.

---

### Learning & Development

#### GET /learning/courses/search
Search courses.

**Query Parameters:**
- `q` (string): Search query
- `provider` (string): Course provider
- `difficulty` (string): Difficulty level
- `maxPrice` (number): Maximum price

---

#### GET /learning/courses/recommended
Get recommended courses.

---

#### POST /learning/courses/enroll
Enroll in course.

**Request Body:**
```json
{
  "courseId": "string",
  "startDate": "date"
}
```

---

#### GET /learning/certifications/catalog
Browse certifications.

---

#### POST /learning/certifications/add
Add user certification.

**Request Body:**
```json
{
  "certificationId": "string",
  "issueDate": "date",
  "expiryDate": "date",
  "credentialNumber": "string"
}
```

---

#### GET /learning/learning-paths
Browse learning paths.

---

#### POST /learning/learning-paths/:id/enroll
Enroll in learning path.

---

### Professional Networking

#### GET /networking/contacts
Get professional contacts.

---

#### POST /networking/contacts
Add new contact.

**Request Body:**
```json
{
  "name": "string",
  "title": "string",
  "company": "string",
  "email": "string",
  "phone": "string",
  "linkedinUrl": "string",
  "notes": "string"
}
```

---

#### POST /networking/interactions
Log interaction with contact.

**Request Body:**
```json
{
  "contactId": "string",
  "type": "string",
  "date": "date",
  "notes": "string",
  "followUpDate": "date"
}
```

---

### Resume Builder

#### GET /resume/templates
Get available resume templates.

---

#### POST /resume/generate
Generate resume.

**Request Body:**
```json
{
  "templateId": "string",
  "experienceIds": ["string"],
  "sections": {
    "summary": "string",
    "skills": ["string"],
    "education": [],
    "certifications": []
  }
}
```

---

#### GET /resume/:id/export
Export resume.

**Query Parameters:**
- `format` (string): Export format (pdf/docx)

---

### Analytics

#### GET /analytics/dashboard
Get analytics dashboard data.

---

#### GET /analytics/skills-progression
Get skills progression data.

---

#### GET /analytics/career-trajectory
Get career trajectory analysis.

---

## Error Codes

| Status Code | Description |
|------------|-------------|
| 200 | Success |
| 201 | Created |
| 204 | No Content |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 409 | Conflict |
| 422 | Unprocessable Entity |
| 429 | Too Many Requests |
| 500 | Internal Server Error |

## Rate Limiting

API requests are rate limited to prevent abuse:

- **Authenticated users**: 1000 requests per hour
- **Unauthenticated users**: 100 requests per hour

Rate limit headers are included in responses:
- `X-RateLimit-Limit`: Request limit
- `X-RateLimit-Remaining`: Remaining requests
- `X-RateLimit-Reset`: Reset timestamp

## Webhooks

Pathfinder supports webhooks for real-time notifications:

### Available Events

- `user.created`
- `experience.added`
- `goal.completed`
- `application.status_changed`
- `certification.expiring`

### Webhook Payload

```json
{
  "event": "event.type",
  "timestamp": "2025-08-07T12:00:00.000Z",
  "data": {
    // Event-specific data
  }
}
```

## SDKs

Official SDKs are available for:

- JavaScript/TypeScript
- Python
- Java
- Go

## Support

For API support, contact:
- Email: api-support@pathfinder.ai
- Documentation: https://docs.pathfinder.ai
- Status: https://status.pathfinder.ai