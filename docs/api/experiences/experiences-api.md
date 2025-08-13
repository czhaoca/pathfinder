# Experiences API Documentation

## Overview

The Experiences API manages user career experiences, including work history, projects, achievements, and skills extraction.

## Base Endpoints

All experience endpoints are prefixed with `/api/experiences`.

## Experience Management

### GET /experiences

**Description:** Get user's experiences with pagination and filtering.

**Authentication:** Required

**Query Parameters:**
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 20, max: 100)
- `sort` - Sort field (title, company, start_date, end_date, created_at)
- `order` - Sort order (asc, desc)
- `status` - Filter by status (active, completed, draft)
- `company` - Filter by company name
- `from_date` - Filter experiences after this date
- `to_date` - Filter experiences before this date
- `skills` - Filter by skills (comma-separated)

**Response:**
```json
{
  "success": true,
  "data": {
    "experiences": [
      {
        "id": "uuid",
        "title": "Senior Software Engineer",
        "company": "Tech Corp",
        "location": "San Francisco, CA",
        "employment_type": "full-time",
        "start_date": "2022-01-15",
        "end_date": "2024-06-30",
        "is_current": false,
        "description": "Led development of microservices architecture...",
        "responsibilities": [
          "Designed and implemented RESTful APIs",
          "Mentored junior developers",
          "Conducted code reviews"
        ],
        "achievements": [
          "Reduced API response time by 40%",
          "Implemented CI/CD pipeline",
          "Led team of 5 developers"
        ],
        "skills": [
          "JavaScript",
          "Node.js",
          "AWS",
          "Docker"
        ],
        "impact_metrics": {
          "revenue_impact": "$2M increase",
          "efficiency_gain": "40% reduction in processing time",
          "team_growth": "Mentored 5 junior developers"
        },
        "created_at": "2024-07-01T10:00:00Z",
        "updated_at": "2024-07-15T14:30:00Z"
      }
    ],
    "pagination": {
      "total": 15,
      "page": 1,
      "limit": 20,
      "total_pages": 1
    }
  }
}
```

### POST /experiences

**Description:** Create a new experience entry.

**Authentication:** Required

**Request Body:**
```json
{
  "title": "Senior Software Engineer",
  "company": "Tech Corp",
  "location": "San Francisco, CA",
  "employment_type": "full-time",
  "start_date": "2022-01-15",
  "end_date": "2024-06-30",
  "is_current": false,
  "description": "Led development of microservices architecture...",
  "responsibilities": [
    "Designed and implemented RESTful APIs",
    "Mentored junior developers"
  ],
  "achievements": [
    "Reduced API response time by 40%",
    "Implemented CI/CD pipeline"
  ],
  "skills": ["JavaScript", "Node.js", "AWS"],
  "industry": "Technology",
  "team_size": 5,
  "direct_reports": 2
}
```

**Response:**
```json
{
  "success": true,
  "message": "Experience created successfully",
  "data": {
    "id": "uuid",
    // Full experience object
  }
}
```

### GET /experiences/:id

**Description:** Get a specific experience by ID.

**Authentication:** Required

**Response:**
```json
{
  "success": true,
  "data": {
    // Full experience object with all details
  }
}
```

### PUT /experiences/:id

**Description:** Update an existing experience.

**Authentication:** Required

**Request Body:** Same as POST, all fields optional

**Response:**
```json
{
  "success": true,
  "message": "Experience updated successfully",
  "data": {
    // Updated experience object
  }
}
```

### DELETE /experiences/:id

**Description:** Delete an experience.

**Authentication:** Required

**Response:**
```json
{
  "success": true,
  "message": "Experience deleted successfully"
}
```

## Skills Management

### POST /experiences/:id/skills/extract

**Description:** Use AI to extract skills from experience description.

**Authentication:** Required

**Request Body:**
```json
{
  "analyze_achievements": true,
  "include_soft_skills": true,
  "match_to_catalog": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "extracted_skills": [
      {
        "name": "Project Management",
        "category": "Management",
        "confidence": 0.95,
        "evidence": ["Led team of 5 developers", "Managed project timeline"]
      },
      {
        "name": "API Development",
        "category": "Technical",
        "confidence": 0.98,
        "evidence": ["Designed and implemented RESTful APIs"]
      }
    ],
    "suggested_skills": [
      {
        "name": "Agile Methodology",
        "reason": "Common with project management role"
      }
    ]
  }
}
```

### PUT /experiences/:id/skills

**Description:** Update skills for an experience.

**Authentication:** Required

**Request Body:**
```json
{
  "skills": ["JavaScript", "Node.js", "AWS", "Docker"],
  "skill_levels": {
    "JavaScript": "expert",
    "Node.js": "advanced",
    "AWS": "intermediate",
    "Docker": "intermediate"
  }
}
```

## Achievement Analysis

### POST /experiences/:id/achievements/analyze

**Description:** Analyze and enhance achievement descriptions with AI.

**Authentication:** Required

**Request Body:**
```json
{
  "achievements": [
    "Improved system performance",
    "Led development team"
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "enhanced_achievements": [
      {
        "original": "Improved system performance",
        "enhanced": "Optimized system performance resulting in 40% reduction in response time and $500K annual cost savings",
        "metrics_identified": ["40% reduction", "$500K savings"],
        "impact_category": "efficiency"
      },
      {
        "original": "Led development team",
        "enhanced": "Led cross-functional development team of 8 engineers, delivering 3 major features ahead of schedule",
        "metrics_identified": ["8 engineers", "3 major features"],
        "impact_category": "leadership"
      }
    ]
  }
}
```

## Experience Templates

### GET /experiences/templates

**Description:** Get experience templates for common roles.

**Authentication:** Required

**Query Parameters:**
- `role` - Filter by role type
- `industry` - Filter by industry
- `level` - Filter by seniority level

**Response:**
```json
{
  "success": true,
  "data": {
    "templates": [
      {
        "id": "template-001",
        "role": "Software Engineer",
        "level": "Senior",
        "industry": "Technology",
        "suggested_responsibilities": [...],
        "common_achievements": [...],
        "relevant_skills": [...]
      }
    ]
  }
}
```

### POST /experiences/from-template

**Description:** Create experience from template.

**Authentication:** Required

**Request Body:**
```json
{
  "template_id": "template-001",
  "company": "My Company",
  "start_date": "2022-01-15",
  "customizations": {
    "title": "Senior Software Engineer",
    "location": "San Francisco, CA"
  }
}
```

## Bulk Operations

### POST /experiences/import

**Description:** Import multiple experiences from file or external source.

**Authentication:** Required

**Request:** Multipart form data
- `file` - CSV or JSON file with experiences
- `source` - Source type (csv, json, linkedin)

**Response:**
```json
{
  "success": true,
  "data": {
    "imported": 5,
    "failed": 1,
    "errors": [
      {
        "row": 3,
        "error": "Invalid date format"
      }
    ]
  }
}
```

### GET /experiences/export

**Description:** Export user's experiences.

**Authentication:** Required

**Query Parameters:**
- `format` - Export format (json, csv, pdf)
- `include_skills` - Include skills analysis
- `include_achievements` - Include enhanced achievements

**Response:** File download or URL

## Experience Analytics

### GET /experiences/analytics

**Description:** Get analytics about user's experiences.

**Authentication:** Required

**Response:**
```json
{
  "success": true,
  "data": {
    "total_experiences": 8,
    "total_years": 12.5,
    "companies_worked": 4,
    "industries": ["Technology", "Finance"],
    "top_skills": [
      {
        "skill": "JavaScript",
        "years": 8,
        "experiences_count": 5
      }
    ],
    "career_progression": [
      {
        "title": "Junior Developer",
        "years": 2
      },
      {
        "title": "Software Engineer",
        "years": 3
      },
      {
        "title": "Senior Software Engineer",
        "years": 4
      }
    ],
    "achievement_categories": {
      "efficiency": 12,
      "leadership": 8,
      "innovation": 6,
      "revenue": 4
    }
  }
}
```

### GET /experiences/timeline

**Description:** Get visual timeline of experiences.

**Authentication:** Required

**Response:**
```json
{
  "success": true,
  "data": {
    "timeline": [
      {
        "year": 2022,
        "events": [
          {
            "type": "job_start",
            "date": "2022-01-15",
            "title": "Started at Tech Corp",
            "description": "Senior Software Engineer"
          }
        ]
      }
    ]
  }
}
```

## Experience Verification

### POST /experiences/:id/verify

**Description:** Request verification of experience (future feature).

**Authentication:** Required

**Request Body:**
```json
{
  "verification_method": "email",
  "verifier_email": "manager@company.com",
  "verifier_name": "John Manager"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "verification_id": "uuid",
    "status": "pending",
    "expires_at": "2025-09-13T10:00:00Z"
  }
}
```

## Error Responses

Standard error responses apply. Additional experience-specific errors:

### 422 Unprocessable Entity
```json
{
  "success": false,
  "message": "Experience validation failed",
  "errors": [
    {
      "field": "end_date",
      "message": "End date cannot be before start date"
    }
  ]
}
```

## Webhooks

Experience-related webhook events:

- `experience.created` - New experience added
- `experience.updated` - Experience modified
- `experience.deleted` - Experience removed
- `experience.verified` - Experience verification completed