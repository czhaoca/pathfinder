# CPA PERT API Documentation

## Base URL
```
https://api.pathfinder.app/api/cpa-pert
```

## Authentication
All endpoints require JWT authentication via Bearer token in the Authorization header.

```http
Authorization: Bearer <jwt_token>
```

## Endpoints

### 1. Get Competency Framework

Retrieve the complete CPA competency framework.

```http
GET /competencies
```

#### Response
```json
200 OK
[
  {
    "competency_id": "1",
    "main_code": "FR",
    "main_name": "Financial Reporting",
    "sub_code": "FR1",
    "sub_name": "Financial Reporting Needs and Systems",
    "category": "Technical",
    "description": "Assesses financial reporting needs and evaluates the adequacy of systems",
    "level0_description": "Basic understanding...",
    "level1_description": "Can independently...",
    "level2_description": "Can lead and advise..."
  }
]
```

### 2. Analyze Experience

Analyze a work experience to identify relevant CPA competencies.

```http
POST /analyze
Content-Type: application/json

{
  "experienceId": "exp_123456"
}
```

#### Response
```json
200 OK
[
  {
    "mapping_id": "map_789",
    "experience_id": "exp_123456",
    "competency_id": "1",
    "main_code": "FR",
    "main_name": "Financial Reporting",
    "sub_code": "FR1",
    "sub_name": "Financial Reporting Needs and Systems",
    "category": "Technical",
    "relevance_score": 0.95,
    "evidence": "[\"Prepared financial statements\", \"Analyzed reporting requirements\"]",
    "suggested_proficiency": 2,
    "created_at": "2025-01-30T10:00:00Z"
  }
]
```

#### Errors
- `400 Bad Request` - Missing or invalid experience ID
- `404 Not Found` - Experience not found
- `500 Internal Server Error` - Analysis failed

### 3. Generate PERT Response

Generate a PERT response for a specific experience and competency.

```http
POST /generate
Content-Type: application/json

{
  "experienceId": "exp_123456",
  "competencyId": "1",
  "proficiencyLevel": 2
}
```

#### Parameters
- `experienceId` (required): ID of the experience
- `competencyId` (required): ID of the CPA competency
- `proficiencyLevel` (required): Target proficiency level (0, 1, or 2)

#### Response
```json
200 OK
{
  "response_id": "resp_456",
  "user_id": "user_123",
  "experience_id": "exp_123456",
  "competency_id": "1",
  "main_code": "FR",
  "main_name": "Financial Reporting",
  "sub_code": "FR1",
  "sub_name": "Financial Reporting Needs and Systems",
  "proficiency_level": 2,
  "situation_text": "As a Senior Accountant at...",
  "task_text": "I was responsible for...",
  "action_text": "I implemented a comprehensive...",
  "result_text": "This resulted in a 30% reduction...",
  "response_text": "SITUATION:\nAs a Senior Accountant...",
  "character_count": 3500,
  "quantified_impact": "30% reduction in reporting time, $50K annual savings",
  "is_current": 1,
  "created_at": "2025-01-30T10:00:00Z",
  "updated_at": "2025-01-30T10:00:00Z"
}
```

#### Errors
- `400 Bad Request` - Invalid parameters or proficiency level
- `404 Not Found` - Experience or competency not found
- `500 Internal Server Error` - Generation failed

### 4. Update PERT Response

Update an existing PERT response.

```http
PUT /response/:responseId
Content-Type: application/json

{
  "responseText": "Updated full response text",
  "situationText": "Updated situation",
  "taskText": "Updated task",
  "actionText": "Updated action",
  "resultText": "Updated result",
  "quantifiedImpact": "Updated impact metrics"
}
```

#### Parameters
All parameters are optional. Only provided fields will be updated.

#### Response
```json
200 OK
{
  "response_id": "resp_456",
  // ... updated response object
}
```

#### Errors
- `400 Bad Request` - Invalid update data
- `404 Not Found` - Response not found or not owned by user
- `413 Payload Too Large` - Response exceeds 5000 character limit

### 5. Get PERT Responses

Retrieve user's PERT responses with pagination and filtering.

```http
GET /responses?limit=20&offset=0&experienceId=exp_123
```

#### Query Parameters
- `limit` (optional): Number of responses to return (default: 20, max: 100)
- `offset` (optional): Pagination offset (default: 0)
- `experienceId` (optional): Filter by specific experience
- `competencyId` (optional): Filter by specific competency
- `isCurrent` (optional): Filter by current status (0 or 1)

#### Response
```json
200 OK
[
  {
    "response_id": "resp_456",
    "experience_id": "exp_123456",
    "competency_id": "1",
    "sub_code": "FR1",
    "sub_name": "Financial Reporting Needs and Systems",
    "proficiency_level": 2,
    "response_text": "SITUATION:\n...",
    "character_count": 3500,
    "is_current": 1,
    "created_at": "2025-01-30T10:00:00Z"
  }
]
```

### 6. Check EVR Compliance

Check current EVR compliance status.

```http
GET /compliance
```

#### Response
```json
200 OK
{
  "isCompliant": true,
  "complianceCheck": {
    "compliance_check_id": "check_789",
    "user_id": "user_123",
    "is_compliant": true,
    "total_competencies": 8,
    "level2_count": 2,
    "level1_or_higher_count": 8,
    "issues": null,
    "recommendations": "[\"Continue developing TX competencies\", \"Consider more strategic roles\"]",
    "created_at": "2025-01-30T10:00:00Z"
  },
  "summary": {
    "totalCompetencies": 8,
    "level2Count": 2,
    "level1OrHigherCount": 8,
    "missingCompetencies": []
  }
}
```

### 7. Validate EVR Requirements

Force a fresh validation of EVR requirements.

```http
POST /compliance/validate
```

#### Response
```json
200 OK
{
  // Same as GET /compliance response
}
```

### 8. Get Competency Report

Generate a comprehensive competency progress report.

```http
GET /report
```

#### Response
```json
200 OK
{
  "summary": {
    "totalCompetencies": 8,
    "level2Achieved": 2,
    "level1Achieved": 6,
    "level0Only": 0,
    "totalPERTResponses": 15
  },
  "competencyDetails": [
    {
      "assessment_id": "assess_123",
      "competency_id": "1",
      "sub_code": "FR1",
      "sub_name": "Financial Reporting Needs and Systems",
      "category": "Technical",
      "current_level": 2,
      "target_level": 2,
      "evidence_count": 3,
      "last_assessment_date": "2025-01-30"
    }
  ],
  "developmentPlan": {
    "immediate": [
      {
        "competencyId": "3",
        "action": "Gain Level 2 proficiency in TX1",
        "target": "Within 3 months",
        "reason": "Required for EVR compliance"
      }
    ],
    "shortTerm": [],
    "longTerm": []
  },
  "compliance": {
    "isCompliant": true,
    // ... compliance details
  }
}
```

### 9. Batch Analyze Experiences

Analyze multiple experiences in a single request.

```http
POST /batch-analyze
Content-Type: application/json

{
  "experienceIds": ["exp_123", "exp_456", "exp_789"]
}
```

#### Response
```json
200 OK
{
  "results": [
    {
      "experienceId": "exp_123",
      "mappings": [
        // ... competency mappings
      ]
    },
    {
      "experienceId": "exp_456",
      "mappings": [
        // ... competency mappings
      ]
    }
  ],
  "errors": [
    {
      "experienceId": "exp_789",
      "error": "Experience not found"
    }
  ]
}
```

### 10. Batch Generate PERT Responses

Generate multiple PERT responses for an experience.

```http
POST /batch-generate
Content-Type: application/json

{
  "experienceId": "exp_123456",
  "competencyIds": ["1", "2", "3"],
  "proficiencyLevel": 1
}
```

#### Response
```json
200 OK
[
  {
    "response_id": "resp_001",
    "competency_id": "1",
    // ... full response object
  },
  {
    "response_id": "resp_002",
    "competency_id": "2",
    // ... full response object
  }
]
```

### 11. Archive/Activate Response

Change the current status of a PERT response.

```http
PUT /response/:responseId/archive
PUT /response/:responseId/activate
```

#### Response
```json
200 OK
{
  "response_id": "resp_456",
  "is_current": 0, // or 1 for activate
  "updated_at": "2025-01-30T10:00:00Z"
}
```

### 12. Delete PERT Response

Permanently delete a PERT response.

```http
DELETE /response/:responseId
```

#### Response
```json
200 OK
{
  "message": "Response deleted successfully"
}
```

#### Errors
- `404 Not Found` - Response not found
- `403 Forbidden` - Cannot delete current responses

## Error Responses

All errors follow a consistent format:

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {
    // Additional error details if available
  }
}
```

### Common Error Codes
- `UNAUTHORIZED` - Missing or invalid authentication
- `FORBIDDEN` - Insufficient permissions
- `NOT_FOUND` - Resource not found
- `BAD_REQUEST` - Invalid request parameters
- `VALIDATION_ERROR` - Request validation failed
- `RATE_LIMITED` - Too many requests
- `INTERNAL_ERROR` - Server error

## Rate Limiting

AI-intensive endpoints have rate limits:
- `/analyze`: 10 requests per minute
- `/generate`: 20 requests per minute
- `/batch-analyze`: 5 requests per minute
- `/batch-generate`: 5 requests per minute

Rate limit headers:
```http
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 7
X-RateLimit-Reset: 1706615400
```

## Pagination

List endpoints support pagination:

```http
GET /responses?limit=20&offset=40

Response Headers:
X-Total-Count: 150
X-Page-Count: 8
```

## Data Formats

### Dates
All dates are in ISO 8601 format: `2025-01-30T10:00:00Z`

### Evidence Arrays
Evidence is stored as JSON-encoded arrays:
```json
"evidence": "[\"Evidence item 1\", \"Evidence item 2\"]"
```

### Proficiency Levels
- `0`: Entry level (CPA student or new graduate)
- `1`: Intermediate level (experienced professional)
- `2`: Advanced level (senior/leadership role)

## Best Practices

1. **Batch Operations**: Use batch endpoints when processing multiple items
2. **Caching**: Cache competency framework data (changes rarely)
3. **Pagination**: Always paginate when retrieving lists
4. **Error Handling**: Implement exponential backoff for rate limits
5. **Character Limits**: Validate response length before submission (5000 chars max)

## SDK Examples

### JavaScript/TypeScript
```typescript
import { CPAPertClient } from '@pathfinder/cpa-pert-sdk';

const client = new CPAPertClient({
  apiKey: process.env.PATHFINDER_API_KEY
});

// Analyze experience
const mappings = await client.analyzeExperience('exp_123456');

// Generate PERT response
const response = await client.generateResponse({
  experienceId: 'exp_123456',
  competencyId: '1',
  proficiencyLevel: 2
});
```

### Python
```python
from pathfinder import CPAPertClient

client = CPAPertClient(api_key=os.getenv('PATHFINDER_API_KEY'))

# Check compliance
compliance = client.check_compliance()

# Get competency report
report = client.get_competency_report()
```

## Webhooks

Coming soon: Webhook support for async operations and notifications.

## Changelog

### v1.0 (January 2025)
- Initial API release
- Core CRUD operations
- Compliance checking
- Batch operations support