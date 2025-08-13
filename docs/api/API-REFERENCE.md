# Pathfinder API Reference

## Overview

The Pathfinder API is a RESTful API that provides comprehensive career navigation and experience management functionality. All API responses follow a standardized format for consistency.

## Base URL

```
Development: http://localhost:3000/api
Production: {PRODUCTION_HOST}/api
```

**Note:** The production URL is configured through environment variables. See the deployment configuration documentation for details on setting `PRODUCTION_HOST`.

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

### CPA PERT Module (Enhanced)

#### POST /api/cpa-pert/enhanced/reports
Create a new PERT report for EVR or PPR route.

**Request Body:**
```json
{
  "report_period_start": "2024-01-01",
  "report_period_end": "2024-06-30",
  "submission_deadline": "2024-07-15",
  "route_type": "EVR",
  "employer_name": "ABC Company",
  "position_title": "Senior Accountant",
  "hours_worked": 900
}
```

**Response:** Created report object

---

#### POST /api/cpa-pert/enhanced/reports/:reportId/experiences
Add a new experience to a PERT report with date range tracking.

**Request Body:**
```json
{
  "sub_competency_id": "uuid",
  "experience_title": "Financial Analysis Project",
  "experience_start_date": "2024-01-15",
  "experience_end_date": "2024-02-28",
  "proficiency_level": 1,
  "challenge": "Complex financial analysis required...",
  "actions": "Developed comprehensive model...",
  "results": "Identified $500K in savings...",
  "lessons_learned": "Importance of validation...",
  "time_spent_hours": 120,
  "complexity_level": "complex",
  "collaboration_type": "team"
}
```

---

#### POST /api/cpa-pert/enhanced/experiences/:experienceId/breakdown
Add detailed activity breakdown for an experience.

**Request Body:**
```json
{
  "activity_type": "analysis",
  "activity_description": "Performed variance analysis",
  "start_date": "2024-01-20",
  "end_date": "2024-01-25",
  "hours_spent": 40,
  "competencies_demonstrated": ["FR.1.1", "MA.2.3"],
  "deliverables": ["Variance Report", "Executive Summary"],
  "stakeholders_involved": ["CFO", "Controller"],
  "business_impact": "Identified key cost drivers",
  "skills_applied": ["Excel", "Power BI"]
}
```

---

#### GET /api/cpa-pert/enhanced/experiences/:experienceId/breakdown
Get all activity breakdowns for an experience.

**Response:** Array of breakdown records with timeline

---

#### POST /api/cpa-pert/enhanced/experiences/:experienceId/time-tracking
Track daily time for an experience.

**Request Body:**
```json
{
  "activity_date": "2024-01-20",
  "hours_logged": 8.5,
  "activity_category": "direct_work",
  "description": "Completed financial analysis",
  "is_billable": "Y",
  "is_cpa_eligible": "Y"
}
```

---

#### POST /api/cpa-pert/enhanced/progress/milestones
Record a competency progression milestone.

**Request Body:**
```json
{
  "sub_competency_id": "uuid",
  "milestone_date": "2024-03-01",
  "previous_level": 0,
  "achieved_level": 1,
  "evidence_count": 5,
  "hours_accumulated": 200,
  "key_experiences": ["exp-id-1", "exp-id-2"],
  "mentor_feedback": "Excellent progress shown",
  "self_assessment": "Feel confident at this level",
  "next_steps": "Work towards Level 2"
}
```

---

#### GET /api/cpa-pert/enhanced/progress/timeline
Get user's progress timeline with milestones.

**Query Parameters:**
- `sub_competency_id` (optional) - Filter by specific competency

**Response:** Array of milestones ordered by date

---

#### POST /api/cpa-pert/enhanced/reports/:reportId/submit-to-cpa
Submit a completed report to CPA with full tracking.

**Request Body:**
```json
{
  "submission_type": "final",
  "submission_deadline": "2024-07-15",
  "cpa_reference_number": "CPA-2024-001",
  "exported_file_url": "https://storage.example.com/report.pdf",
  "exported_file_format": "pdf"
}
```

**Response:** Submission record with checksum and tracking info

---

#### GET /api/cpa-pert/enhanced/reports/:reportId/submission-history
Get complete submission history for a report.

**Response:** Array of submission history entries with status transitions

---

#### GET /api/cpa-pert/enhanced/reports/:reportId/export
Export a PERT report in various formats.

**Query Parameters:**
- `format` - Export format (pdf, docx, xml, json)

**Response:** File download or URL

---

#### GET /api/cpa-pert/enhanced/competency-progress
Get user's overall competency progress summary.

**Response:** Progress statistics by competency area

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