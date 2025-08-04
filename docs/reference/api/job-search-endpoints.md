# Job Search Integration API Endpoints

## Overview

The Job Search Integration API provides comprehensive endpoints for job searching, matching, application tracking, and interview preparation. This system helps users discover relevant opportunities, track their job search progress, and prepare effectively for interviews.

## Base URL
```
/api
```

## Authentication
All endpoints require JWT authentication. Include the token in the Authorization header:
```
Authorization: Bearer <token>
```

## Job Search Endpoints

### Search Jobs
Search for job listings with various filters and sorting options.

**Endpoint:** `GET /api/jobs/search`

**Query Parameters:**
- `q` (string, optional): Search query for job title, company, or description
- `location` (string, optional): Location filter
- `remoteOnly` (boolean, optional): Filter for remote positions only
- `experienceLevel` (string, optional): Experience level (entry, mid, senior, executive)
- `jobType` (string, optional): Job type (full-time, part-time, contract, internship)
- `salaryMin` (integer, optional): Minimum salary filter
- `salaryMax` (integer, optional): Maximum salary filter
- `skills` (string, optional): Comma-separated list of required skills
- `companies` (string, optional): Comma-separated list of company names
- `industries` (string, optional): Comma-separated list of industries
- `sortBy` (string, optional): Sort field (posting_date, salary_max, match_score, company_name)
- `sortOrder` (string, optional): Sort order (ASC, DESC)
- `limit` (integer, optional): Results per page (default: 50, max: 100)
- `offset` (integer, optional): Pagination offset

**Response:**
```json
{
  "jobs": [
    {
      "job_id": "job123",
      "job_title": "Senior Software Engineer",
      "company_name": "Tech Corp",
      "company_id": "company456",
      "location": "San Francisco, CA",
      "is_remote": "Y",
      "remote_type": "hybrid",
      "salary_min": 120000,
      "salary_max": 180000,
      "salary_currency": "USD",
      "experience_level": "senior",
      "job_type": "full-time",
      "required_skills": ["Python", "AWS", "Docker"],
      "preferred_skills": ["Kubernetes", "React"],
      "posting_date": "2025-01-15",
      "match_score": 0.85,
      "job_url": "https://example.com/job/123"
    }
  ],
  "pagination": {
    "total": 245,
    "limit": 50,
    "offset": 0,
    "hasMore": true
  }
}
```

### Get Recommended Jobs
Get AI-recommended jobs based on user profile and preferences.

**Endpoint:** `GET /api/jobs/recommended`

**Query Parameters:**
- `limit` (integer, optional): Number of recommendations (default: 20, max: 50)

**Response:** Array of job objects with high match scores

### Get Job Details
Get detailed information about a specific job listing.

**Endpoint:** `GET /api/jobs/:jobId`

**Response:**
```json
{
  "job_id": "job123",
  "job_title": "Senior Software Engineer",
  "company_name": "Tech Corp",
  "job_description": "Full job description...",
  "requirements": "Job requirements...",
  "responsibilities": "Job responsibilities...",
  "required_skills": ["Python", "AWS", "Docker"],
  "preferred_skills": ["Kubernetes", "React"],
  "benefits": ["Health insurance", "401k", "Remote work"],
  "company": {
    "company_id": "company456",
    "industry": "Technology",
    "company_size": "1000-5000",
    "rating_glassdoor": 4.2,
    "culture_values": ["Innovation", "Collaboration"],
    "tech_stack": ["Python", "AWS", "React"]
  },
  "match_score": {
    "overall_score": 0.85,
    "skills_match_score": 0.90,
    "experience_match_score": 0.80,
    "culture_fit_score": 0.75,
    "location_match_score": 1.0,
    "salary_match_score": 0.80,
    "match_reasons": ["Strong skills match", "Perfect location match"],
    "missing_skills": ["Kubernetes"]
  }
}
```

### Calculate Match Scores
Calculate match scores for multiple jobs.

**Endpoint:** `POST /api/jobs/match-scores`

**Request Body:**
```json
{
  "jobIds": ["job123", "job456", "job789"]
}
```

**Response:** Array of match score objects

### Import Job
Import a job listing from an external URL.

**Endpoint:** `POST /api/jobs/import`

**Request Body:**
```json
{
  "url": "https://example.com/job/123",
  "source": "linkedin",
  "jobTitle": "Software Engineer",
  "companyName": "Tech Corp",
  "description": "Job description..."
}
```

## Job Preferences Endpoints

### Get Job Preferences
Get user's job search preferences.

**Endpoint:** `GET /api/job-preferences`

**Response:**
```json
{
  "preference_id": "pref123",
  "target_roles": ["Software Engineer", "Senior Developer"],
  "target_companies": ["Google", "Microsoft", "Apple"],
  "industries": ["Technology", "Finance"],
  "locations": ["San Francisco", "New York", "Remote"],
  "remote_preference": "prefer_remote",
  "salary_min_expected": 120000,
  "salary_max_expected": 180000,
  "job_types": ["full-time"],
  "company_sizes": ["1000-5000", "5000+"],
  "must_have_benefits": ["Health insurance", "401k"],
  "deal_breakers": ["No remote work"],
  "search_status": "active",
  "urgency_level": "3_months"
}
```

### Update Job Preferences
Update user's job search preferences.

**Endpoint:** `PUT /api/job-preferences`

**Request Body:** Same as GET response, all fields optional

### Save Search
Save a job search with criteria for alerts.

**Endpoint:** `POST /api/saved-searches`

**Request Body:**
```json
{
  "searchName": "Senior Python roles in SF",
  "criteria": {
    "query": "Senior Python Developer",
    "location": "San Francisco",
    "salaryMin": 150000
  },
  "notificationFrequency": "weekly"
}
```

### Get Saved Searches
Get user's saved job searches.

**Endpoint:** `GET /api/saved-searches`

### Delete Saved Search
Delete a saved search.

**Endpoint:** `DELETE /api/saved-searches/:searchId`

## Application Management Endpoints

### List Applications
Get user's job applications with filtering and sorting.

**Endpoint:** `GET /api/applications`

**Query Parameters:**
- `status` (string, optional): Filter by status
- `startDate` (ISO 8601, optional): Filter by application date
- `endDate` (ISO 8601, optional): Filter by application date
- `company` (string, optional): Filter by company name
- `sortBy` (string, optional): Sort field
- `sortOrder` (string, optional): Sort order
- `limit` (integer, optional): Results per page
- `offset` (integer, optional): Pagination offset

**Response:**
```json
{
  "applications": [
    {
      "application_id": "app123",
      "job_id": "job123",
      "job_title": "Senior Software Engineer",
      "company_name": "Tech Corp",
      "status": "interviewing",
      "application_date": "2025-01-20",
      "excitement_level": 4,
      "fit_score": 0.85,
      "interview_count": 2,
      "next_interview": "2025-02-05T14:00:00Z"
    }
  ],
  "pagination": {
    "total": 15,
    "limit": 50,
    "offset": 0,
    "hasMore": false
  }
}
```

### Get Application Details
Get detailed information about a specific application.

**Endpoint:** `GET /api/applications/:applicationId`

### Create Application
Create a new job application.

**Endpoint:** `POST /api/applications`

**Request Body:**
```json
{
  "jobId": "job123",
  "status": "applied",
  "applicationDate": "2025-02-03",
  "resumeVersionId": "resume456",
  "coverLetterId": "cover789",
  "applicationMethod": "platform",
  "referralContactId": "contact123",
  "applicationNotes": "Referred by John Doe",
  "excitementLevel": 5,
  "salaryExpectationMin": 150000,
  "salaryExpectationMax": 180000
}
```

### Update Application
Update an existing application.

**Endpoint:** `PUT /api/applications/:applicationId`

**Request Body:** Same as create, all fields optional

### Withdraw Application
Withdraw a job application.

**Endpoint:** `DELETE /api/applications/:applicationId`

**Request Body:**
```json
{
  "reason": "Accepted another offer"
}
```

### Get Application Timeline
Get the timeline of events for an application.

**Endpoint:** `GET /api/applications/:applicationId/timeline`

**Response:**
```json
{
  "applicationId": "app123",
  "events": [
    {
      "type": "application_created",
      "date": "2025-01-20T10:00:00Z",
      "title": "Application Started",
      "description": "Initial status: interested",
      "icon": "file-text"
    },
    {
      "type": "status_change",
      "date": "2025-01-22T14:00:00Z",
      "title": "Status Changed to Applied",
      "description": "From interested",
      "icon": "send"
    }
  ],
  "currentStatus": "interviewing",
  "totalEvents": 5
}
```

### Get Application Statistics
Get statistics about user's job applications.

**Endpoint:** `GET /api/applications/stats`

**Query Parameters:**
- `timeframe` (integer, optional): Days to analyze (default: 30)

**Response:**
```json
{
  "timeframe_days": 30,
  "applications": {
    "total": 25,
    "by_status": {
      "interested": 5,
      "applied": 8,
      "screening": 4,
      "interviewing": 3,
      "offers": 2,
      "rejected": 2,
      "withdrawn": 1
    },
    "unique_companies": 18,
    "avg_excitement": 3.8
  },
  "interviews": {
    "total": 10,
    "passed": 7,
    "failed": 1,
    "applications_with_interviews": 6
  },
  "conversion_rates": {
    "applied_to_screening": 0.625,
    "screening_to_interview": 0.75,
    "interview_to_offer": 0.67,
    "overall_success": 0.08
  }
}
```

### Bulk Update Application Status
Update multiple applications at once.

**Endpoint:** `POST /api/applications/bulk-update`

**Request Body:**
```json
{
  "applicationIds": ["app123", "app456", "app789"],
  "newStatus": "rejected",
  "notes": "Positions filled"
}
```

## Interview Preparation Endpoints

### Get Interview Questions
Browse interview questions database.

**Endpoint:** `GET /api/interview-prep/questions`

**Query Parameters:**
- `companyId` (string, optional): Filter by company
- `roleCategory` (string, optional): Filter by role
- `questionType` (string, optional): Type (behavioral, technical, situational)
- `difficulty` (string, optional): Difficulty level (easy, medium, hard)
- `limit` (integer, optional): Results per page
- `offset` (integer, optional): Pagination offset

**Response:**
```json
[
  {
    "prep_id": "prep123",
    "company_name": "Tech Corp",
    "role_category": "software_engineer",
    "question_text": "Tell me about a time you had to debug a complex issue",
    "question_type": "behavioral",
    "difficulty_level": "medium",
    "sample_answer": "Sample STAR format answer...",
    "answer_framework": "STAR",
    "tips": "Focus on your problem-solving process",
    "times_asked": 15,
    "response_count": 3
  }
]
```

### Get Application Interview Prep
Get personalized interview preparation for a specific application.

**Endpoint:** `GET /api/interview-prep/application/:applicationId`

**Response:**
```json
{
  "application": {
    "job_title": "Senior Software Engineer",
    "company_name": "Tech Corp",
    "industry": "Technology"
  },
  "questions": {
    "company_specific": [...],
    "role_specific": [...],
    "behavioral": [...],
    "personalized": [...]
  },
  "tips": [
    {
      "category": "Company Research",
      "tips": ["Research Tech Corp's recent news", "Understand their products"]
    }
  ],
  "preparation_checklist": [
    {
      "task": "Research company thoroughly",
      "category": "research"
    }
  ]
}
```

### Save Interview Response
Save your practice response to an interview question.

**Endpoint:** `POST /api/interview-prep/responses`

**Request Body:**
```json
{
  "prepId": "prep123",
  "responseText": "My response using STAR method...",
  "interviewId": "interview456",
  "selfRating": 4,
  "needsImprovement": false,
  "requestFeedback": true
}
```

**Response:**
```json
{
  "responseId": "resp123",
  "feedback": {
    "feedback": "AI-generated feedback on your response...",
    "question_type": "behavioral",
    "framework": "STAR"
  }
}
```

### Update Interview Response
Update a saved interview response.

**Endpoint:** `PUT /api/interview-prep/responses/:responseId`

### Get User Responses
Get user's saved interview responses.

**Endpoint:** `GET /api/interview-prep/responses`

**Query Parameters:**
- `prepId` (string, optional): Filter by question
- `interviewId` (string, optional): Filter by interview
- `needsImprovement` (boolean, optional): Filter by improvement needed
- `limit` (integer, optional): Results per page
- `offset` (integer, optional): Pagination offset

### Add Custom Question
Add a custom interview question to the database.

**Endpoint:** `POST /api/interview-prep/questions`

**Request Body:**
```json
{
  "questionText": "Describe your experience with microservices",
  "companyId": "company123",
  "roleCategory": "software_engineer",
  "questionType": "technical",
  "difficultyLevel": "medium",
  "sampleAnswer": "Sample answer...",
  "answerFramework": "technical-explanation",
  "tips": "Focus on specific examples"
}
```

### Get Interview Insights
Get analytics and insights about your interview preparation.

**Endpoint:** `GET /api/interview-prep/insights`

**Response:**
```json
{
  "overall_stats": {
    "total_responses": 45,
    "avg_rating": 3.7,
    "needs_improvement_count": 12,
    "unique_questions_practiced": 28
  },
  "by_question_type": [
    {
      "question_type": "behavioral",
      "response_count": 20,
      "avg_rating": 3.8
    }
  ],
  "most_practiced_companies": [
    {
      "company_name": "Tech Corp",
      "practice_count": 15
    }
  ],
  "improvement_areas": [...],
  "recommendations": [
    {
      "priority": "high",
      "area": "technical_questions",
      "message": "Practice more technical questions",
      "action": "Focus on system design questions"
    }
  ]
}
```

## Company Endpoints

### Search Companies
Search for companies in the database.

**Endpoint:** `GET /api/companies/search`

**Query Parameters:**
- `q` (string, optional): Search query
- `industry` (string, optional): Filter by industry
- `size` (string, optional): Filter by company size

**Response:** Array of company objects

### Get Company Details
Get detailed information about a company.

**Endpoint:** `GET /api/companies/:companyId`

**Response:**
```json
{
  "company_id": "company123",
  "company_name": "Tech Corp",
  "industry": "Technology",
  "company_size": "1000-5000",
  "headquarters_location": "San Francisco, CA",
  "website_url": "https://techcorp.com",
  "description": "Leading technology company...",
  "culture_values": ["Innovation", "Collaboration", "Excellence"],
  "tech_stack": ["Python", "AWS", "React", "Docker"],
  "rating_glassdoor": 4.2,
  "rating_indeed": 4.0,
  "active_job_count": 15,
  "interview_questions_count": 42
}
```

### Update Company
Update company information.

**Endpoint:** `PUT /api/companies/:companyId`

**Request Body:** Company fields to update

## Error Responses

All endpoints follow a consistent error response format:

```json
{
  "error": "Error type",
  "message": "Detailed error message",
  "statusCode": 400
}
```

Common error codes:
- `400` - Bad Request (invalid parameters)
- `401` - Unauthorized (missing or invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found (resource doesn't exist)
- `429` - Too Many Requests (rate limit exceeded)
- `500` - Internal Server Error

## Rate Limiting

- General API limit: 100 requests per 15 minutes per IP
- Job search: 50 requests per hour per user
- Application creation: 20 per hour per user
- Bulk operations: 10 per hour per user

## Best Practices

1. **Use match scores** - Leverage the AI-powered job matching to find the best opportunities
2. **Track applications** - Keep all applications in the system for better insights
3. **Practice interviews** - Use the interview prep features before real interviews
4. **Update preferences** - Keep your job preferences current for better recommendations
5. **Review analytics** - Check your application stats regularly to improve your job search strategy