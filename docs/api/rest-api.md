# REST API Reference

## Authentication Endpoints

### Register User
```http
POST /api/auth/register
```

**Request Body:**
```json
{
  "username": "johndoe",
  "email": "john@example.com",
  "password": "SecurePass123!",
  "firstName": "John",
  "lastName": "Doe"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "username": "johndoe",
    "email": "john@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "createdAt": "2024-01-01T00:00:00Z",
    "accountStatus": "active"
  }
}
```

### Login
```http
POST /api/auth/login
```

**Request Body:**
```json
{
  "username": "johndoe",
  "password": "SecurePass123!"
}
```

**Response:** Same as registration

### Refresh Token
```http
POST /api/auth/refresh
```

**Request Body:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

### Logout
```http
POST /api/auth/logout
Authorization: Bearer <token>
```

**Response:**
```json
{
  "message": "Logged out successfully"
}
```

## Profile Endpoints

### Get Profile
```http
GET /api/profile
Authorization: Bearer <token>
```

**Response:**
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "username": "johndoe",
  "email": "john@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "createdAt": "2024-01-01T00:00:00Z",
  "lastLogin": "2024-01-15T00:00:00Z",
  "accountStatus": "active"
}
```

### Update Profile
```http
PUT /api/profile
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "firstName": "John",
  "lastName": "Smith",
  "email": "john.smith@example.com"
}
```

### Change Password
```http
POST /api/profile/change-password
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "currentPassword": "OldPass123!",
  "newPassword": "NewPass456!",
  "confirmPassword": "NewPass456!"
}
```

## Experience Endpoints

### List Experiences
```http
GET /api/experiences
Authorization: Bearer <token>
```

**Query Parameters:**
- `type` - Filter by experience type (work, education, volunteer, project, certification, other)
- `current` - Filter current experiences (true/false)
- `from` - Start date filter (ISO date)
- `to` - End date filter (ISO date)
- `search` - Search in title, organization, description
- `limit` - Number of results per page
- `page` - Page number

**Response:**
```json
{
  "experiences": [
    {
      "experienceId": "456e7890-e89b-12d3-a456-426614174000",
      "title": "Senior Software Engineer",
      "organization": "Tech Corp",
      "department": "Engineering",
      "location": "San Francisco, CA",
      "description": "Led development of microservices architecture...",
      "startDate": "2020-01-01",
      "endDate": "2023-12-31",
      "isCurrent": false,
      "experienceType": "work",
      "employmentType": "full-time",
      "extractedSkills": ["JavaScript", "React", "Node.js"],
      "keyHighlights": [
        "Reduced system latency by 40%",
        "Led team of 5 engineers"
      ],
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-01T00:00:00Z"
    }
  ],
  "count": 15
}
```

### Get Experience
```http
GET /api/experiences/:id
Authorization: Bearer <token>
```

### Create Experience
```http
POST /api/experiences
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "title": "Software Engineer",
  "organization": "StartupXYZ",
  "department": "Engineering",
  "location": "Remote",
  "description": "Developed full-stack applications...",
  "startDate": "2024-01-01",
  "isCurrent": true,
  "experienceType": "work",
  "employmentType": "full-time",
  "keyHighlights": [
    "Built RESTful APIs serving 1M+ requests/day",
    "Implemented CI/CD pipeline"
  ],
  "technologiesUsed": ["Python", "Django", "PostgreSQL", "Docker"]
}
```

### Update Experience
```http
PUT /api/experiences/:id
Authorization: Bearer <token>
```

**Request Body:** Same as create (partial updates supported)

### Delete Experience
```http
DELETE /api/experiences/:id
Authorization: Bearer <token>
```

## Chat Endpoints

### Send Message
```http
POST /api/chat/message
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "message": "How can I transition from engineering to product management?",
  "conversationId": "789e0123-e89b-12d3-a456-426614174000"
}
```

**Response:**
```json
{
  "conversationId": "789e0123-e89b-12d3-a456-426614174000",
  "message": {
    "id": "msg_123",
    "role": "assistant",
    "content": "Transitioning from engineering to product management...",
    "timestamp": "2024-01-01T00:00:00Z",
    "metadata": {
      "toolsUsed": ["get_career_paths", "analyze_skills"],
      "processingTime": 1250
    }
  }
}
```

### Get Chat History
```http
GET /api/chat/history
Authorization: Bearer <token>
```

**Query Parameters:**
- `conversationId` - Filter by conversation
- `limit` - Number of messages (default: 50, max: 200)

## CPA PERT Endpoints (Add-on)

### Analyze Experience Competencies
```http
POST /api/cpa-pert/analyze-experience
Authorization: Bearer <token>
```

Maps an experience to relevant CPA competencies using AI analysis.

**Request Body:**
```json
{
  "experienceId": "456e7890-e89b-12d3-a456-426614174000"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "experienceId": "456e7890-e89b-12d3-a456-426614174000",
    "mappings": [
      {
        "mapping_id": "789e0123-e89b-12d3-a456-426614174000",
        "competency_id": "FR1",
        "relevance_score": 0.85,
        "evidence_extracted": "Prepared consolidated financial statements...",
        "competency_name": "Financial Reporting Needs and Systems",
        "area_name": "Financial Reporting"
      }
    ],
    "totalMapped": 5
  }
}
```

### Get Competency Mapping
```http
GET /api/cpa-pert/competency-mapping/:experienceId
Authorization: Bearer <token>
```

Retrieves all competency mappings for a specific experience.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "mapping_id": "789e0123-e89b-12d3-a456-426614174000",
      "competency_id": "FR1",
      "area_code": "FR",
      "sub_code": "FR1",
      "sub_name": "Financial Reporting Needs and Systems",
      "category": "Technical",
      "relevance_score": 0.85,
      "evidence_extracted": "Prepared consolidated financial statements..."
    }
  ]
}
```

### Generate PERT Response
```http
POST /api/cpa-pert/generate-response
Authorization: Bearer <token>
```

Generates a STAR-format PERT response for a competency.

**Request Body:**
```json
{
  "experienceId": "456e7890-e89b-12d3-a456-426614174000",
  "competencyCode": "FR1",
  "proficiencyLevel": 2
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "response_id": "123e4567-e89b-12d3-a456-426614174000",
    "response_text": "SITUATION:\nAs Senior Financial Analyst...\n\nTASK:\n...",
    "character_count": 4875,
    "proficiency_level": 2,
    "competency_name": "Financial Reporting Needs and Systems",
    "area_name": "Financial Reporting"
  }
}
```

### Check EVR Compliance
```http
GET /api/cpa-pert/compliance-check
Authorization: Bearer <token>
```

Checks current EVR compliance status.

**Response:**
```json
{
  "success": true,
  "data": {
    "isCompliant": false,
    "summary": {
      "totalCompetencies": 6,
      "level2Count": 1,
      "level1OrHigherCount": 5,
      "missingCompetencies": ["Need 1 more Level 2 competencies"]
    },
    "complianceCheck": {
      "check_id": "456e7890-e89b-12d3-a456-426614174000",
      "check_date": "2025-01-28T12:00:00Z",
      "is_compliant": "N"
    }
  }
}
```

### Validate Requirements
```http
POST /api/cpa-pert/validate-requirements
Authorization: Bearer <token>
```

Performs a full EVR validation and creates a new compliance check.

**Response:**
```json
{
  "success": true,
  "data": {
    "isCompliant": false,
    "details": {
      "totalCompetencies": 6,
      "level2Count": 1,
      "level1OrHigherCount": 5
    },
    "recommendations": [
      "Focus on advancing 1 competencies from Level 1 to Level 2"
    ]
  }
}
```

### Get Competency Framework
```http
GET /api/cpa-pert/competency-framework
Authorization: Bearer <token>
```

Retrieves the complete CPA competency framework.

**Response:**
```json
{
  "success": true,
  "data": {
    "Technical": [
      {
        "competencyId": "FR1",
        "areaCode": "FR",
        "areaName": "Financial Reporting",
        "subCode": "FR1",
        "subName": "Financial Reporting Needs and Systems",
        "description": "Evaluates financial reporting needs...",
        "evrRelevance": "HIGH",
        "level1Criteria": "- Identifies financial reporting needs...",
        "level2Criteria": "- Evaluates complex financial reporting..."
      }
    ],
    "Enabling": [...]
  }
}
```

### Get Proficiency Assessment
```http
GET /api/cpa-pert/proficiency-assessment/:experienceId?competencyCode=FR1
Authorization: Bearer <token>
```

Assesses proficiency level for a competency based on experience.

**Response:**
```json
{
  "success": true,
  "data": {
    "competency_id": "FR1",
    "competency_name": "Financial Reporting Needs and Systems",
    "current_level": 1,
    "target_level": 2,
    "gap": 1,
    "evidence_count": 2,
    "development_areas": "To reach Level 2, focus on...",
    "next_steps": "Take on leadership roles..."
  }
}
```

### Get User PERT Responses
```http
GET /api/cpa-pert/responses?limit=50
Authorization: Bearer <token>
```

Retrieves user's PERT responses.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "response_id": "123e4567-e89b-12d3-a456-426614174000",
      "competency_id": "FR1",
      "proficiency_level": 2,
      "character_count": 4875,
      "created_at": "2025-01-28T12:00:00Z"
    }
  ],
  "total": 10
}
```

### Get Competency Report
```http
GET /api/cpa-pert/competency-report
Authorization: Bearer <token>
```

Generates comprehensive competency report.

**Response:**
```json
{
  "success": true,
  "data": {
    "userId": "123e4567-e89b-12d3-a456-426614174000",
    "generatedAt": "2025-01-28T12:00:00Z",
    "summary": {
      "totalCompetencies": 8,
      "level2Achieved": 2,
      "level1Achieved": 4,
      "evrCompliant": false
    },
    "competencyDetails": [...],
    "developmentPlan": {...}
  }
}
```

### Update PERT Response
```http
PUT /api/cpa-pert/response/:responseId
Authorization: Bearer <token>
```

Updates an existing PERT response.

**Request Body:**
```json
{
  "responseText": "Updated STAR format response...",
  "situationText": "In my role as...",
  "taskText": "I was responsible for...",
  "actionText": "I implemented...",
  "resultText": "This resulted in...",
  "quantifiedImpact": "Reduced processing time by 40%"
}
```

### Delete PERT Response
```http
DELETE /api/cpa-pert/response/:responseId
Authorization: Bearer <token>
```

Marks a PERT response as inactive.

### Batch Analyze Experiences
```http
POST /api/cpa-pert/batch/analyze
Authorization: Bearer <token>
```

Analyzes multiple experiences for competency mapping.

**Request Body:**
```json
{
  "experienceIds": [
    "456e7890-e89b-12d3-a456-426614174000",
    "567e8901-e89b-12d3-a456-426614174000"
  ]
}
```

### Batch Generate PERT Responses
```http
POST /api/cpa-pert/batch/generate
Authorization: Bearer <token>
```

Generates multiple PERT responses.

**Request Body:**
```json
{
  "requests": [
    {
      "experienceId": "456e7890-e89b-12d3-a456-426614174000",
      "competencyCode": "FR1",
      "proficiencyLevel": 2
    }
  ]
}
```

## Error Responses

### Validation Error (400)
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      {
        "field": "email",
        "message": "Email already exists"
      }
    ]
  }
}
```

### Authentication Error (401)
```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required"
  }
}
```

### Not Found Error (404)
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Experience not found"
  }
}
```

### Rate Limit Error (429)
```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests",
    "retryAfter": 900
  }
}
```

## WebSocket Events (Future)

### Connection
```javascript
ws://localhost:3000/ws
Authorization: Bearer <token>
```

### Events
- `experience.updated` - Experience data changed
- `profile.updated` - Profile information changed
- `chat.message` - New chat message
- `notification` - System notifications