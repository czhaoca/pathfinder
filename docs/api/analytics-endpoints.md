# Analytics API Endpoints

## Overview

The Analytics API provides comprehensive insights into career progression, skills development, and professional achievements. These endpoints analyze user experiences using AI-powered analysis (OpenAI GPT-4) to generate actionable insights and visualizations.

## Authentication

All analytics endpoints require JWT authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

## Base URL

```
/api/analytics
```

## Endpoints

### 1. Skills Progression Analysis

Analyze and track skill development over time based on user experiences.

**Endpoint:** `GET /api/analytics/skills-progression`

**Response:**
```json
{
  "skills": [
    {
      "progressionId": "123e4567-e89b-12d3-a456-426614174000",
      "skillName": "JavaScript",
      "skillCategory": "programming",
      "proficiencyLevel": 4,
      "confidenceScore": 0.85,
      "evidenceCount": 8,
      "firstUsedDate": "2018-01-15T00:00:00Z",
      "lastUsedDate": "2024-01-31T00:00:00Z",
      "totalMonthsUsed": 72,
      "contexts": [
        {
          "experienceId": "exp-id-1",
          "title": "Senior Software Engineer",
          "organization": "Tech Corp"
        }
      ]
    }
  ],
  "summary": {
    "totalSkills": 45,
    "expertSkills": 5,
    "advancedSkills": 12,
    "skillsByCategory": {
      "programming": 15,
      "frontend": 8,
      "backend": 10,
      "soft": 12
    },
    "averageProficiency": 3.2
  },
  "lastUpdated": "2024-01-31T10:00:00Z"
}
```

**Proficiency Levels:**
- 1: Beginner
- 2: Basic
- 3: Intermediate
- 4: Advanced
- 5: Expert

### 2. Career Trajectory Visualization

Generate career progression data including milestones, transitions, and velocity.

**Endpoint:** `GET /api/analytics/career-trajectory`

**Response:**
```json
{
  "timeline": [
    {
      "experienceId": "exp-1",
      "title": "Software Engineer",
      "organization": "StartupXYZ",
      "startDate": "2018-01-01",
      "endDate": "2020-06-30",
      "type": "work",
      "level": 2,
      "skills": ["JavaScript", "React", "Node.js"],
      "impact": []
    }
  ],
  "milestones": [
    {
      "milestoneId": "milestone-1",
      "milestoneType": "role_change",
      "milestoneDate": "2020-07-01",
      "title": "Promoted to Senior Engineer",
      "description": "Promoted to senior role after successful project delivery",
      "organization": "StartupXYZ",
      "impactScore": 0.8,
      "relatedExperiences": ["exp-1"]
    }
  ],
  "transitions": [
    {
      "type": "role_pivot",
      "from": {
        "experienceId": "exp-1",
        "title": "Software Engineer"
      },
      "to": {
        "experienceId": "exp-2",
        "title": "Technical Lead"
      },
      "date": "2022-01-01"
    }
  ],
  "careerVelocity": 0.75,
  "projectedPath": [
    {
      "timeframe": "1-2 years",
      "possibleRoles": ["Engineering Manager", "Principal Engineer"],
      "requiredSkills": ["Leadership", "System Design"],
      "probability": 0.7
    }
  ]
}
```

### 3. Analytics Summary

Get comprehensive analytics including scores, recommendations, and insights.

**Endpoint:** `GET /api/analytics/summary`

**Query Parameters:**
- `refresh` (boolean, optional): Force regeneration of analytics data

**Response:**
```json
{
  "summaryId": "summary-123",
  "analysisDate": "2024-01-31",
  "totalYearsExperience": 6.5,
  "careerVelocityScore": 0.75,
  "skillDiversityScore": 0.82,
  "leadershipScore": 0.65,
  "technicalDepthScore": 0.78,
  "industryExpertiseScore": 0.70,
  "topSkills": [
    {
      "name": "JavaScript",
      "category": "programming",
      "proficiencyLevel": 5,
      "monthsUsed": 72
    }
  ],
  "skillGaps": [
    {
      "skill": "Kubernetes",
      "importance": "high",
      "reason": "Common skill for Senior Engineer roles"
    }
  ],
  "careerTrajectory": { /* trajectory data */ },
  "recommendations": [
    {
      "type": "skill_development",
      "priority": "high",
      "recommendation": "Focus on cloud technologies to advance career",
      "action": "Consider AWS or Azure certification"
    }
  ]
}
```

### 4. Impact Scores

Get quantified impact scores for experiences.

**Endpoint:** `GET /api/analytics/impact-scores`

**Query Parameters:**
- `experienceIds` (string, optional): Comma-separated list of experience IDs

**Response:**
```json
{
  "scores": [
    {
      "scoreId": "score-1",
      "experienceId": "exp-1",
      "impactCategory": "revenue",
      "impactScore": 0.85,
      "quantifiedValue": 2500000,
      "valueUnit": "dollars",
      "confidenceLevel": 0.8,
      "calculationMethod": "revenue_increase",
      "createdAt": "2024-01-31T10:00:00Z"
    }
  ],
  "count": 4
}
```

### 5. Quantify Achievements

Analyze and quantify achievements for a specific experience.

**Endpoint:** `POST /api/analytics/experiences/:experienceId/quantify`

**Path Parameters:**
- `experienceId` (string): Experience ID to analyze

**Response:**
```json
{
  "experienceId": "exp-1",
  "metrics": {
    "revenue": {
      "value": 2500000,
      "unit": "dollars",
      "context": "Increased revenue by $2.5M through new feature"
    },
    "efficiency": {
      "value": 40,
      "unit": "percentage",
      "context": "Reduced processing time by 40%"
    },
    "teamSize": {
      "value": 12,
      "unit": "people",
      "context": "Led team of 12 engineers"
    }
  },
  "impactScores": {
    "revenue": 0.85,
    "efficiency": 0.75,
    "teamGrowth": 0.60,
    "innovation": 0.70,
    "overall": 0.725
  },
  "suggestions": [
    {
      "category": "revenue",
      "suggestion": "Add specific dollar amounts or percentages to quantify revenue impact"
    }
  ]
}
```

### 6. Career Insights

Get personalized career insights based on experience analysis.

**Endpoint:** `GET /api/analytics/insights`

**Response:**
```json
{
  "strengths": [
    "Strong technical foundation in modern web technologies",
    "Proven leadership experience with growing teams",
    "Track record of delivering high-impact projects"
  ],
  "growthAreas": [
    "Cloud infrastructure expertise",
    "Formal project management certification",
    "Public speaking and conference presentations"
  ],
  "industryPosition": "Above average for years of experience",
  "marketDemand": [
    "Full-stack engineers with your skillset are in high demand",
    "Leadership experience increases market value by 25-30%"
  ],
  "competitiveAdvantage": [
    "Combination of technical depth and leadership experience",
    "Experience with both startups and enterprise environments"
  ]
}
```

### 7. Skill Recommendations

Get skill recommendations based on target career goals.

**Endpoint:** `POST /api/analytics/skill-recommendations`

**Request Body:**
```json
{
  "targetRole": "Engineering Manager",
  "currentSkills": ["JavaScript", "React", "Team Leadership"]
}
```

**Response:**
```json
[
  {
    "skill": "Agile Project Management",
    "priority": "high",
    "reason": "Essential for Engineering Manager roles",
    "learningResources": [
      "Scrum Master certification",
      "Agile coaching courses"
    ],
    "timeToAcquire": "3-6 months"
  },
  {
    "skill": "Budget Management",
    "priority": "medium",
    "reason": "Required for senior management positions",
    "timeToAcquire": "2-3 months"
  }
]
```

### 8. Export Analytics

Export analytics data in various formats.

**Endpoint:** `GET /api/analytics/export`

**Query Parameters:**
- `format` (string): Export format - `json`, `csv`, or `pdf` (default: `json`)

**Response:**
- For JSON: Application/json content type with full analytics data
- For CSV: Text/csv content type with tabular data
- For PDF: Application/pdf content type with formatted report

**Headers:**
```
Content-Type: [varies by format]
Content-Disposition: attachment; filename="career-analytics-2024-01-31.[format]"
```

## Error Responses

### 400 Bad Request
```json
{
  "error": "Invalid request",
  "message": "Target role is required for skill recommendations"
}
```

### 404 Not Found
```json
{
  "error": "Experience not found",
  "message": "No experience found with ID: exp-123"
}
```

### 500 Internal Server Error
```json
{
  "error": "Analytics generation failed",
  "message": "Unable to process analytics data"
}
```

## Rate Limiting

- Standard endpoints: 60 requests per minute
- AI-powered endpoints (quantify, recommendations): 20 requests per minute
- Export endpoint: 10 requests per minute

## Best Practices

1. **Cache Analytics Data**: Summary and trajectory data can be cached client-side for better performance.

2. **Refresh Periodically**: Use the refresh parameter sparingly to regenerate analytics when experiences are updated.

3. **Batch Requests**: When analyzing multiple experiences, use the impact-scores endpoint with multiple IDs rather than individual requests.

4. **Progressive Loading**: Load summary first, then detailed analytics as needed for better UX.

## Analytics Scores Explained

### Career Velocity Score (0-1)
Measures the speed of career progression based on role changes, promotions, and responsibility increases.

### Skill Diversity Score (0-1)
Evaluates the breadth of skills across different categories and domains.

### Leadership Score (0-1)
Assesses leadership experience based on team sizes, management roles, and mentoring activities.

### Technical Depth Score (0-1)
Measures expertise depth in technical skills based on usage duration and proficiency levels.

### Industry Expertise Score (0-1)
Evaluates domain knowledge and industry-specific experience concentration.