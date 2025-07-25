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

**Request Body:**
```json
{
  "experienceId": "456e7890-e89b-12d3-a456-426614174000"
}
```

**Response:**
```json
{
  "competencies": [
    {
      "code": "FR2",
      "name": "Accounting policies and transactions",
      "category": "technical",
      "proficiencyLevel": 1,
      "examples": ["Implemented new revenue recognition..."]
    }
  ]
}
```

### Generate PERT Response
```http
POST /api/cpa-pert/generate-response
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "experienceId": "456e7890-e89b-12d3-a456-426614174000",
  "competencyCode": "FR2",
  "targetLevel": 2
}
```

**Response:**
```json
{
  "response": "During my role as Senior Accountant...",
  "characterCount": 4875,
  "meetsRequirements": true,
  "suggestions": []
}
```

### Check EVR Compliance
```http
GET /api/cpa-pert/compliance-check
Authorization: Bearer <token>
```

**Response:**
```json
{
  "overallCompliance": true,
  "monthsCompleted": 18,
  "monthsRequired": 30,
  "competenciesMet": {
    "level1": ["FR1", "FR2", "MA1"],
    "level2": ["TX2"]
  },
  "competenciesNeeded": {
    "level1": ["AA1"],
    "level2": ["FR3", "FN1"]
  }
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