# Learning & Development API Endpoints

## Overview

The Learning & Development API provides endpoints for managing courses, skill assessments, certifications, and learning paths. All endpoints require authentication via JWT token.

## Base URL

```
/api/learning
```

## Authentication

All endpoints require a valid JWT token in the Authorization header:

```
Authorization: Bearer <token>
```

## Course Management

### Search Courses

Search for courses based on various criteria.

**Endpoint:** `GET /api/learning/courses/search`

**Query Parameters:**
- `q` (string, optional): Search query for course title/description
- `provider` (string, optional): Filter by course provider
- `skills` (string, optional): Comma-separated list of skill IDs
- `difficulty` (string, optional): Difficulty level (beginner, intermediate, advanced, expert)
- `maxPrice` (number, optional): Maximum price in USD
- `minRating` (number, optional): Minimum rating (0-5)
- `certificateRequired` (boolean, optional): Whether certificate is required
- `language` (string, optional): Course language
- `sortBy` (string, optional): Sort field (rating, price_usd, duration_hours, enrolled_count)
- `sortOrder` (string, optional): Sort order (ASC, DESC)
- `limit` (number, optional): Results per page (1-100, default: 50)
- `offset` (number, optional): Pagination offset

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "course_id": "01HX8K9FN2QWXYZ123456789AB",
      "external_course_id": "coursera-python-101",
      "provider": "Coursera",
      "course_title": "Python for Everybody",
      "description": "Learn Python programming fundamentals",
      "duration_hours": 40,
      "difficulty_level": "beginner",
      "price_usd": 49.99,
      "skills_taught": ["Python", "Programming", "Data Analysis"],
      "rating": 4.8,
      "enrolled_count": 2500000
    }
  ],
  "message": "Courses retrieved successfully"
}
```

### Get Recommended Courses

Get personalized course recommendations based on skill gaps and career goals.

**Endpoint:** `GET /api/learning/courses/recommended`

**Query Parameters:**
- `limit` (number, optional): Number of recommendations (1-20, default: 10)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "course_id": "01HX8K9FN2QWXYZ123456789AB",
      "course_title": "Advanced React Development",
      "provider": "Udemy",
      "recommendation_score": 0.85,
      "recommendation_reason": "Addresses your JavaScript framework skill gap",
      "skills_taught": ["React", "Redux", "JavaScript"],
      "difficulty_level": "intermediate",
      "duration_hours": 30
    }
  ],
  "message": "Recommended courses retrieved successfully"
}
```

### Get Enrolled Courses

Get user's enrolled courses with progress tracking.

**Endpoint:** `GET /api/learning/courses/enrolled`

**Query Parameters:**
- `status` (string, optional): Filter by status (enrolled, in_progress, completed, abandoned)
- `provider` (string, optional): Filter by provider
- `sortBy` (string, optional): Sort field
- `sortOrder` (string, optional): Sort order (ASC, DESC)

### Get Course Details

Get detailed information about a specific course.

**Endpoint:** `GET /api/learning/courses/:courseId`

### Enroll in Course

Enroll in a course.

**Endpoint:** `POST /api/learning/courses/enroll`

**Request Body:**
```json
{
  "courseId": "01HX8K9FN2QWXYZ123456789AB",
  "startDate": "2024-01-15",
  "expectedCompletionDate": "2024-03-15",
  "notes": "Taking this course for React certification prep"
}
```

### Update Course Progress

Update progress for an enrolled course.

**Endpoint:** `PUT /api/learning/courses/:enrollmentId/progress`

**Request Body:**
```json
{
  "progressPercentage": 45,
  "timeSpentHours": 12.5,
  "status": "in_progress"
}
```

### Complete Course

Mark a course as completed.

**Endpoint:** `POST /api/learning/courses/:enrollmentId/complete`

**Request Body:**
```json
{
  "userRating": 5,
  "userReview": "Excellent course with practical examples",
  "certificateUrl": "https://certificates.provider.com/verify/ABC123"
}
```

## Skill Assessments

### Browse Assessments

Get available skill assessments.

**Endpoint:** `GET /api/learning/assessments`

**Query Parameters:**
- `skillId` (string, optional): Filter by skill
- `type` (string, optional): Assessment type (quiz, project, peer_review, self_assessment)
- `difficulty` (string, optional): Difficulty level
- `isActive` (boolean, optional): Active assessments only
- `limit` (number, optional): Results per page
- `offset` (number, optional): Pagination offset

### Get Assessment Details

Get details of a specific assessment.

**Endpoint:** `GET /api/learning/assessments/:assessmentId`

### Start Assessment

Start a skill assessment.

**Endpoint:** `POST /api/learning/assessments/:assessmentId/start`

**Response:**
```json
{
  "success": true,
  "data": {
    "resultId": "01HX8K9FN2QWXYZ123456789AB",
    "assessmentId": "01HX8K9FN2QWXYZ123456789AC",
    "assessmentName": "JavaScript Fundamentals",
    "skillName": "JavaScript",
    "timeLimitMinutes": 30,
    "questions": [
      {
        "question_id": "q1",
        "question_text": "What is the output of console.log(typeof null)?",
        "question_type": "multiple_choice",
        "options": ["'null'", "'object'", "'undefined'", "'boolean'"],
        "points": 1
      }
    ],
    "startTime": "2024-01-15T10:00:00Z"
  }
}
```

### Submit Assessment

Submit assessment answers.

**Endpoint:** `POST /api/learning/assessments/:assessmentId/submit`

**Request Body:**
```json
{
  "resultId": "01HX8K9FN2QWXYZ123456789AB",
  "answers": {
    "q1": "b",
    "q2": "true",
    "q3": "function example() { return 42; }"
  },
  "timeSpent": 25
}
```

### Get Assessment Results

Get user's assessment results.

**Endpoint:** `GET /api/learning/assessments/results`

**Query Parameters:**
- `skillId` (string, optional): Filter by skill
- `passed` (boolean, optional): Filter by pass/fail
- `limit` (number, optional): Results per page
- `offset` (number, optional): Pagination offset

### Generate AI Assessment

Generate an AI-powered assessment for a skill.

**Endpoint:** `POST /api/learning/assessments/generate`

**Request Body:**
```json
{
  "skillId": "01HX8K9FN2QWXYZ123456789AB",
  "difficultyLevel": "intermediate",
  "questionCount": 10,
  "assessmentType": "quiz"
}
```

## Certifications

### Browse Certifications

Browse certification catalog.

**Endpoint:** `GET /api/learning/certifications/catalog`

**Query Parameters:**
- `industry` (string, optional): Filter by industry
- `level` (string, optional): Certification level (foundational, associate, professional, expert)
- `organization` (string, optional): Issuing organization
- `q` (string, optional): Search query
- `minDemand` (number, optional): Minimum market demand score (0-5)
- `maxCost` (number, optional): Maximum cost in USD
- `sortBy` (string, optional): Sort field
- `sortOrder` (string, optional): Sort order
- `limit` (number, optional): Results per page
- `offset` (number, optional): Pagination offset

### Get My Certifications

Get user's certifications.

**Endpoint:** `GET /api/learning/certifications/my`

**Query Parameters:**
- `includeExpired` (boolean, optional): Include expired certifications

### Get Expiring Certifications

Get certifications expiring soon.

**Endpoint:** `GET /api/learning/certifications/expiring`

**Query Parameters:**
- `days` (number, optional): Days ahead to check (1-365, default: 90)

### Get Recommended Certifications

Get certification recommendations.

**Endpoint:** `GET /api/learning/certifications/recommended`

**Query Parameters:**
- `limit` (number, optional): Number of recommendations (1-10, default: 5)

### Add Certification

Add a user certification.

**Endpoint:** `POST /api/learning/certifications/add`

**Request Body:**
```json
{
  "certificationId": "01HX8K9FN2QWXYZ123456789AB",
  "credentialNumber": "AWS-123456",
  "issueDate": "2024-01-01",
  "expiryDate": "2027-01-01",
  "verificationUrl": "https://aws.amazon.com/verify/AWS-123456",
  "certificateFileUrl": "https://storage.example.com/certs/aws-123456.pdf",
  "cpeCreditsEarned": 40,
  "preparationHours": 120,
  "examScore": "Pass",
  "examDate": "2023-12-15",
  "notes": "Passed on first attempt"
}
```

### Update Certification

Update user certification details.

**Endpoint:** `PUT /api/learning/certifications/:userCertId`

### Track Renewal

Track certification renewal.

**Endpoint:** `POST /api/learning/certifications/:userCertId/renew`

**Request Body:**
```json
{
  "targetRenewalDate": "2026-12-15",
  "notes": "Starting renewal process",
  "isComplete": false,
  "newCredentialNumber": "AWS-654321",
  "newIssueDate": "2027-01-01",
  "newExpiryDate": "2030-01-01",
  "verificationUrl": "https://aws.amazon.com/verify/AWS-654321",
  "cpeCreditsUsed": 30
}
```

### Calculate CPE Credits

Calculate CPE credits for a date range.

**Endpoint:** `GET /api/learning/certifications/cpe-credits`

**Query Parameters:**
- `startDate` (string, required): Start date (ISO 8601)
- `endDate` (string, required): End date (ISO 8601)

## Learning Paths

### Browse Learning Paths

Browse available learning paths.

**Endpoint:** `GET /api/learning/learning-paths`

**Query Parameters:**
- `role` (string, optional): Target role
- `level` (string, optional): Target level (entry, mid, senior, expert)
- `difficulty` (string, optional): Difficulty level
- `public` (boolean, optional): Public paths only
- `createdBy` (string, optional): Filter by creator
- `q` (string, optional): Search query
- `sortBy` (string, optional): Sort field
- `sortOrder` (string, optional): Sort order
- `limit` (number, optional): Results per page
- `offset` (number, optional): Pagination offset

### Get My Learning Paths

Get user's enrolled learning paths.

**Endpoint:** `GET /api/learning/learning-paths/my`

**Query Parameters:**
- `status` (string, optional): Filter by status
- `sortBy` (string, optional): Sort field
- `sortOrder` (string, optional): Sort order

### Get Recommended Paths

Get recommended learning paths.

**Endpoint:** `GET /api/learning/learning-paths/recommended`

**Query Parameters:**
- `limit` (number, optional): Number of recommendations (1-10, default: 5)

### Get Path Details

Get learning path details with steps.

**Endpoint:** `GET /api/learning/learning-paths/:pathId`

### Create Learning Path

Create a custom learning path.

**Endpoint:** `POST /api/learning/learning-paths`

**Request Body:**
```json
{
  "pathName": "Full Stack Developer Journey",
  "pathDescription": "Complete path from frontend to backend development",
  "targetRole": "Full Stack Developer",
  "targetLevel": "mid",
  "estimatedDurationWeeks": 24,
  "difficultyLevel": "intermediate",
  "skillsGained": ["React", "Node.js", "MongoDB", "AWS"],
  "prerequisites": ["Basic JavaScript", "HTML/CSS"],
  "isPublic": true,
  "tags": ["web-development", "full-stack"],
  "steps": [
    {
      "stepType": "course",
      "resourceId": "01HX8K9FN2QWXYZ123456789AB",
      "stepName": "React Fundamentals",
      "stepDescription": "Learn React basics",
      "estimatedHours": 40,
      "isOptional": false,
      "dependencies": [],
      "successCriteria": "Complete all modules and pass final project"
    }
  ]
}
```

### Enroll in Path

Enroll in a learning path.

**Endpoint:** `POST /api/learning/learning-paths/:pathId/enroll`

**Request Body:**
```json
{
  "targetCompletionDate": "2024-12-31"
}
```

### Update Path Progress

Update progress on a learning path step.

**Endpoint:** `PUT /api/learning/learning-paths/:userPathId/progress`

**Request Body:**
```json
{
  "stepId": "01HX8K9FN2QWXYZ123456789AB",
  "status": "completed",
  "timeSpent": 8.5,
  "score": 92,
  "feedback": "Excellent understanding of React hooks"
}
```

### Get Path Progress

Get detailed progress for a learning path.

**Endpoint:** `GET /api/learning/learning-paths/:userPathId/progress`

## Learning Goals

### Get Learning Goals

Get user's learning goals.

**Endpoint:** `GET /api/learning/learning-goals`

**Query Parameters:**
- `includeCompleted` (boolean, optional): Include completed goals

### Create Learning Goal

Create a new learning goal.

**Endpoint:** `POST /api/learning/learning-goals`

**Request Body:**
```json
{
  "goalTitle": "Master React Development",
  "goalDescription": "Become proficient in React and its ecosystem",
  "targetDate": "2024-06-30",
  "goalType": "skill_acquisition",
  "targetSkillId": "01HX8K9FN2QWXYZ123456789AB",
  "targetSkillLevel": "expert",
  "relatedPathId": "01HX8K9FN2QWXYZ123456789AC"
}
```

### Update Learning Goal

Update learning goal progress.

**Endpoint:** `PUT /api/learning/learning-goals/:goalId`

**Request Body:**
```json
{
  "progressPercentage": 65,
  "status": "active",
  "notes": "Completed React hooks module"
}
```

### Delete Learning Goal

Delete (cancel) a learning goal.

**Endpoint:** `DELETE /api/learning/learning-goals/:goalId`

## Analytics

### Get Learning Analytics

Get comprehensive learning analytics.

**Endpoint:** `GET /api/learning/learning/analytics`

**Response:**
```json
{
  "success": true,
  "data": {
    "courses": {
      "total_enrolled": 15,
      "completed": 8,
      "in_progress": 5,
      "abandoned": 2,
      "total_hours": 320,
      "skills_learned": ["Python", "JavaScript", "React", "AWS"]
    },
    "certifications": {
      "summary": {
        "total": 5,
        "active": 4,
        "expired": 1,
        "organizations": 3,
        "industries": 2,
        "cpe_credits": 120
      },
      "by_level": [
        { "certification_level": "professional", "count": 3 },
        { "certification_level": "associate", "count": 2 }
      ],
      "skills_validated": ["Cloud Computing", "Security", "DevOps"]
    },
    "assessments": {
      "totalSkillsAssessed": 12,
      "skillsByCategory": {
        "Programming": [
          {
            "skill_name": "JavaScript",
            "attempts": 3,
            "best_score": 92,
            "highest_level": "expert",
            "last_assessed": "2024-01-10"
          }
        ]
      },
      "recentAssessments": []
    },
    "summary": {
      "total_learning_hours": 320,
      "skills_acquired": ["Python", "JavaScript", "React", "AWS", "Cloud Computing"],
      "active_enrollments": 5,
      "completed_courses": 8,
      "active_certifications": 4
    }
  },
  "message": "Learning analytics retrieved successfully"
}
```

## Error Responses

All endpoints may return the following error responses:

### 400 Bad Request
```json
{
  "success": false,
  "error": "Validation error",
  "details": {
    "field": "courseId",
    "message": "Course ID is required"
  }
}
```

### 401 Unauthorized
```json
{
  "success": false,
  "error": "Authentication required"
}
```

### 403 Forbidden
```json
{
  "success": false,
  "error": "Access denied"
}
```

### 404 Not Found
```json
{
  "success": false,
  "error": "Resource not found"
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "error": "Internal server error",
  "message": "An unexpected error occurred"
}
```

## Rate Limiting

API endpoints are rate-limited to:
- 100 requests per minute for authenticated users
- 20 requests per minute for unauthenticated requests

Rate limit headers are included in responses:
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Requests remaining
- `X-RateLimit-Reset`: Time when limit resets (Unix timestamp)