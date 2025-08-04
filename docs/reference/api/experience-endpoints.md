# Experience Management API Endpoints

## Overview

The Experience Management API provides comprehensive endpoints for managing user experiences, including work history, education, projects, and volunteer activities. This API supports bulk operations, AI-powered skill extraction, and experience templates.

## Authentication

All experience endpoints require JWT authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

## Base URL

```
/api/experiences
```

## Endpoints

### 1. List Experiences

Get all experiences for the authenticated user with optional filtering.

**Endpoint:** `GET /api/experiences`

**Query Parameters:**
- `type` (string, optional): Filter by experience type (work, education, volunteer, project, certification, other)
- `current` (boolean, optional): Filter by current experiences
- `from` (string, optional): Filter experiences starting from date (ISO 8601)
- `to` (string, optional): Filter experiences ending before date (ISO 8601)
- `search` (string, optional): Search in title, organization, and description
- `limit` (number, optional): Limit number of results

**Response:**
```json
{
  "experiences": [
    {
      "experienceId": "123e4567-e89b-12d3-a456-426614174000",
      "title": "Senior Software Engineer",
      "organization": "Tech Corp",
      "department": "Engineering",
      "location": "San Francisco, CA",
      "description": "Led development of cloud-native applications",
      "startDate": "2020-01-01",
      "endDate": "2023-12-31",
      "isCurrent": false,
      "experienceType": "work",
      "employmentType": "full-time",
      "extractedSkills": ["React", "Node.js", "AWS"],
      "keyHighlights": ["Reduced load time by 40%"],
      "teamSize": 8,
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-01T00:00:00Z"
    }
  ],
  "count": 1
}
```

### 2. Get Experience Statistics

Get aggregated statistics about user's experiences.

**Endpoint:** `GET /api/experiences/stats`

**Response:**
```json
{
  "totalExperiences": 15,
  "currentExperiences": 2,
  "uniqueOrganizations": 8,
  "earliestExperience": "2015-06-01T00:00:00Z",
  "latestExperience": "2024-01-15T00:00:00Z",
  "totalMonthsExperience": 96
}
```

### 3. Get Experience Templates

Get pre-defined experience templates by category.

**Endpoint:** `GET /api/experiences/templates`

**Query Parameters:**
- `category` (string, optional): Filter by category (technology, management, data, nonprofit)

**Response:**
```json
{
  "templates": [
    {
      "id": "software-engineer",
      "category": "technology",
      "title": "Software Engineer",
      "description": "Design, develop, and maintain software applications",
      "suggestedSkills": ["Programming", "Problem Solving", "Software Design", "Testing"],
      "template": {
        "experienceType": "work",
        "title": "Software Engineer",
        "description": "• Developed and maintained [type] using [technologies]..."
      }
    }
  ],
  "count": 4
}
```

### 4. Get Single Experience

Get details of a specific experience.

**Endpoint:** `GET /api/experiences/:id`

**Path Parameters:**
- `id` (string): Experience ID

**Response:**
```json
{
  "experienceId": "123e4567-e89b-12d3-a456-426614174000",
  "title": "Senior Software Engineer",
  "organization": "Tech Corp",
  // ... full experience object
}
```

### 5. Create Experience

Create a new experience entry.

**Endpoint:** `POST /api/experiences`

**Request Body:**
```json
{
  "title": "Software Engineer",
  "organization": "Tech Startup",
  "department": "Engineering",
  "location": "Remote",
  "description": "Developed web applications using modern frameworks",
  "startDate": "2021-01-01",
  "endDate": "2023-12-31",
  "isCurrent": false,
  "experienceType": "work",
  "employmentType": "full-time",
  "keyHighlights": ["Implemented CI/CD pipeline"],
  "technologiesUsed": ["React", "Python", "Docker"],
  "teamSize": 5
}
```

**Response:**
```json
{
  "message": "Experience created successfully",
  "experience": {
    "experienceId": "new-id",
    // ... full experience object
  }
}
```

### 6. Update Experience

Update an existing experience.

**Endpoint:** `PUT /api/experiences/:id`

**Path Parameters:**
- `id` (string): Experience ID

**Request Body:** (Partial experience object - only fields to update)
```json
{
  "title": "Lead Software Engineer",
  "endDate": "2024-01-15",
  "isCurrent": true
}
```

**Response:**
```json
{
  "message": "Experience updated successfully",
  "experience": {
    // ... updated experience object
  }
}
```

### 7. Delete Experience

Delete an experience.

**Endpoint:** `DELETE /api/experiences/:id`

**Path Parameters:**
- `id` (string): Experience ID

**Response:**
```json
{
  "message": "Experience deleted successfully"
}
```

### 8. Bulk Create Experiences

Create multiple experiences in a single request.

**Endpoint:** `POST /api/experiences/bulk`

**Request Body:**
```json
{
  "experiences": [
    {
      "title": "Junior Developer",
      "organization": "Startup Inc",
      "description": "Developed features for mobile app",
      "startDate": "2018-01-01",
      "endDate": "2019-12-31",
      "experienceType": "work",
      "employmentType": "full-time"
    },
    {
      "title": "Intern",
      "organization": "Big Corp",
      "description": "Assisted with data analysis",
      "startDate": "2017-06-01",
      "endDate": "2017-08-31",
      "experienceType": "work",
      "employmentType": "internship"
    }
  ]
}
```

**Response:**
```json
{
  "message": "2 experiences created successfully",
  "experiences": [
    // ... array of created experiences
  ]
}
```

### 9. Bulk Update Experiences

Update multiple experiences in a single request.

**Endpoint:** `PUT /api/experiences/bulk`

**Request Body:**
```json
{
  "updates": [
    {
      "id": "experience-id-1",
      "data": {
        "title": "Updated Title",
        "isCurrent": false
      }
    },
    {
      "id": "experience-id-2",
      "data": {
        "endDate": "2024-01-01"
      }
    }
  ]
}
```

**Response:**
```json
{
  "message": "2 experiences updated successfully",
  "experiences": [
    // ... array of updated experiences
  ]
}
```

### 10. Duplicate Experience

Create a copy of an existing experience with optional modifications.

**Endpoint:** `POST /api/experiences/:id/duplicate`

**Path Parameters:**
- `id` (string): Experience ID to duplicate

**Request Body:**
```json
{
  "modifications": {
    "title": "Lead Software Engineer",
    "startDate": "2024-01-01",
    "isCurrent": true
  }
}
```

**Response:**
```json
{
  "message": "Experience duplicated successfully",
  "experience": {
    "experienceId": "new-id",
    // ... duplicated experience with modifications
  }
}
```

### 11. Extract Skills (AI-Powered)

Extract skills from an experience using OpenAI GPT-4 analysis.

**Endpoint:** `POST /api/experiences/:id/extract-skills`

**Path Parameters:**
- `id` (string): Experience ID

**Request Body:**
```json
{
  "regenerate": false  // Set to true to force regeneration
}
```

**Response:**
```json
{
  "message": "Skills extracted successfully",
  "skills": [
    {
      "name": "React",
      "category": "frontend",
      "confidence": 0.95
    },
    {
      "name": "Node.js",
      "category": "backend",
      "confidence": 0.92
    },
    {
      "name": "AWS",
      "category": "cloud",
      "confidence": 0.88
    }
  ]
}
```

**Note:** This endpoint uses OpenAI's GPT-4 model to analyze the experience description and extract relevant skills. The confidence score indicates the AI's certainty about the skill's relevance to the experience.

## Error Responses

All endpoints may return the following error responses:

### 400 Bad Request
```json
{
  "error": "Validation failed",
  "details": [
    {
      "field": "title",
      "message": "Title is required"
    }
  ]
}
```

### 401 Unauthorized
```json
{
  "error": "Unauthorized",
  "message": "Invalid or expired token"
}
```

### 404 Not Found
```json
{
  "error": "Experience not found"
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal server error",
  "message": "An unexpected error occurred"
}
```

## Rate Limiting

- Standard endpoints: 100 requests per minute
- Bulk operations: 20 requests per minute
- AI operations (skill extraction): 30 requests per minute

## Best Practices

1. **Use Bulk Operations**: When creating or updating multiple experiences, use the bulk endpoints to reduce API calls.

2. **Filter Appropriately**: Use query parameters to filter results and reduce response size.

3. **Extract Skills Wisely**: Skill extraction uses AI and may be rate-limited. Cache results when possible.

4. **Templates for Consistency**: Use templates when creating similar experiences to maintain consistency.

5. **Error Handling**: Always handle potential errors, especially for bulk operations where partial failures are possible.

## Future Enhancements

- LinkedIn import functionality
- Resume parsing and import
- Advanced AI skill categorization
- Experience recommendations based on career goals
- Collaboration features for team experiences