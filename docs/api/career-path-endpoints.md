# Career Path API Endpoints

## Overview

The Career Path API provides comprehensive endpoints for career planning, skills gap analysis, learning recommendations, and goal tracking. These endpoints enable users to explore career trajectories, identify skill development needs, and track progress toward their career objectives.

## Base URL
```
/api
```

## Authentication
All endpoints require JWT authentication. Include the token in the Authorization header:
```
Authorization: Bearer <token>
```

## Career Path Endpoints

### Search Career Paths
Search for career paths by role title, industry, or level.

**Endpoint:** `GET /api/career-paths/search`

**Query Parameters:**
- `query` (string, optional): Search term for role titles
- `industry` (string, optional): Filter by industry
- `level` (string, optional): Filter by role level (entry, mid, senior, executive)
- `limit` (integer, optional): Maximum results to return (default: 20, max: 100)

**Response:**
```json
[
  {
    "node_id": "pf_swe_junior",
    "role_title": "Junior Software Engineer",
    "role_level": "entry",
    "industry": "Technology",
    "typical_years_experience": 0,
    "salary_range_min": 60000,
    "salary_range_max": 90000,
    "description": "Entry-level software development role..."
  }
]
```

### Get Career Node Details
Get detailed information about a specific career role.

**Endpoint:** `GET /api/career-paths/:nodeId`

**Response:**
```json
{
  "node_id": "pf_swe_senior",
  "role_title": "Senior Software Engineer",
  "role_level": "senior",
  "industry": "Technology",
  "typical_years_experience": 6,
  "salary_range_min": 120000,
  "salary_range_max": 180000,
  "required_skills": ["system_design", "architecture", "mentoring"],
  "preferred_skills": ["distributed_systems", "security_advanced"],
  "description": "Senior engineer leading technical initiatives...",
  "created_at": "2025-02-01T12:00:00Z",
  "updated_at": "2025-02-01T12:00:00Z"
}
```

### Get Career Transitions
Get possible career transitions from a given role.

**Endpoint:** `GET /api/career-paths/:nodeId/transitions`

**Response:**
```json
[
  {
    "transition_id": "ct_swe_mid_to_senior",
    "from_node_id": "pf_swe_mid",
    "to_node_id": "pf_swe_senior",
    "typical_duration_months": 36,
    "difficulty_score": 0.5,
    "required_skills_gap": ["system_design", "architecture", "mentoring"],
    "success_rate": 0.75,
    "transition_strategies": "Lead technical projects, mentor juniors...",
    "to_role_title": "Senior Software Engineer",
    "to_role_level": "senior",
    "to_industry": "Technology",
    "to_salary_min": 120000,
    "to_salary_max": 180000
  }
]
```

### Visualize Career Path
Generate a visualization of career paths from current to target role.

**Endpoint:** `POST /api/career-paths/visualize`

**Request Body:**
```json
{
  "targetNodeId": "pf_swe_senior",
  "currentNodeId": "pf_swe_junior" // Optional
}
```

**Response:**
```json
{
  "current_node": {
    "node_id": "pf_swe_junior",
    "role_title": "Junior Software Engineer"
  },
  "target_node_id": "pf_swe_senior",
  "nodes": [...], // All nodes in the paths
  "transitions": [...], // All transitions between nodes
  "suggested_paths": [
    ["pf_swe_junior", "pf_swe_mid", "pf_swe_senior"]
  ]
}
```

## Skills Gap Analysis Endpoints

### Analyze Skills Gap
Analyze the skills gap between two career roles.

**Endpoint:** `GET /api/skills-gap/:currentRole/:targetRole`

**Response:**
```json
{
  "current_role": {
    "node_id": "pf_swe_junior",
    "title": "Junior Software Engineer",
    "level": "entry"
  },
  "target_role": {
    "node_id": "pf_swe_senior",
    "title": "Senior Software Engineer",
    "level": "senior",
    "salary_range": {
      "min": 120000,
      "max": 180000
    }
  },
  "skills_gap": {
    "required": [
      {
        "skill_id": "system_design",
        "name": "System Design",
        "category": "Technical",
        "priority": "high",
        "resources": [...]
      }
    ],
    "preferred": [...]
  },
  "transition_info": {
    "typical_duration_months": 60,
    "difficulty_score": 0.7,
    "success_rate": 0.65,
    "strategies": "Focus on system design..."
  },
  "estimated_time_to_transition": {
    "minimum_months": 18,
    "recommended_months": 24
  },
  "transferable_skills": ["programming_fundamentals", "debugging"]
}
```

### Get User Skills Gap
Get skills gap analysis for user's active career goals.

**Endpoint:** `GET /api/skills-gap/user/:userId`

**Response:**
```json
{
  "goals": [
    {
      "goal_id": "goal123",
      "current_role": "Junior Software Engineer",
      "target_role": "Senior Software Engineer",
      "target_date": "2026-12-31",
      "overall_progress": 25,
      "skills_gap": {...},
      "skills_progress": {
        "system_design": {
          "current_level": 2,
          "target_level": 4,
          "hours_logged": 20,
          "progress_percentage": 50
        }
      },
      "estimated_completion": {
        "estimated_date": "2026-10-15",
        "on_track": true,
        "months_remaining": 20
      }
    }
  ]
}
```

### Submit Skills Assessment
Submit a self-assessment of current skill levels.

**Endpoint:** `POST /api/skills-gap/assessment`

**Request Body:**
```json
{
  "goalId": "goal123",
  "skills": [
    {
      "skill_id": "system_design",
      "current_level": 2,
      "target_level": 4
    }
  ]
}
```

## Learning Endpoints

### Get Learning Recommendations
Get learning resources for a specific skill.

**Endpoint:** `GET /api/learning/recommendations/:skillId`

**Query Parameters:**
- `maxCost` (number, optional): Maximum cost filter
- `difficultyLevel` (string, optional): beginner, intermediate, advanced
- `resourceType` (string, optional): course, book, tutorial, certification, workshop, webinar
- `freeOnly` (boolean, optional): Only show free resources

**Response:**
```json
{
  "skill_id": "system_design",
  "resources": [
    {
      "resource_id": "lr_system_design",
      "title": "System Design Interview",
      "provider": "Book",
      "url": "https://...",
      "type": "book",
      "duration_hours": 40,
      "cost": 40,
      "currency": "USD",
      "difficulty_level": "intermediate",
      "rating": 4.7,
      "is_free": false,
      "value_score": 8.7
    }
  ],
  "summary": {
    "total_resources": 5,
    "free_resources": 2,
    "total_hours": 150,
    "average_rating": 4.5,
    "estimated_cost_range": {
      "min": 0,
      "max": 200
    }
  }
}
```

### Get Learning Plan
Get a personalized learning plan based on career goals.

**Endpoint:** `GET /api/learning/user/:userId/plan`

**Response:**
```json
{
  "plan": [
    {
      "goal_id": "goal123",
      "skill": {
        "skill_id": "system_design",
        "skill_name": "System Design",
        "current_level": 2,
        "target_level": 4,
        "gap": 2,
        "hours_logged": 20
      },
      "priority": 95,
      "recommended_hours_per_week": 6,
      "resources": [...],
      "milestones": [
        {
          "level": 3,
          "title": "Reach Level 3 in System Design",
          "hours_required": 20,
          "suggested_checkpoint": "Build a small project using this skill"
        }
      ]
    }
  ],
  "weekly_schedule": {
    "monday": [
      {
        "skill": "System Design",
        "hours": 2,
        "resource": "System Design Interview Book"
      }
    ],
    "tuesday": [...],
    "total_hours": 18
  },
  "estimated_completion": {
    "total_hours_needed": 120,
    "weeks_to_complete": 20,
    "estimated_date": "2025-06-30"
  }
}
```

### Log Learning Progress
Log learning activity and progress.

**Endpoint:** `POST /api/learning/progress`

**Request Body:**
```json
{
  "resourceId": "lr_system_design",
  "skillId": "system_design",
  "activityType": "progress",
  "hoursSpent": 2.5,
  "progressPercentage": 25,
  "notes": "Completed chapter 3 on scalability"
}
```

**Response:**
```json
{
  "activity_id": "activity123",
  "logged": true,
  "achievements": [
    {
      "type": "hours_milestone",
      "title": "25 Hours Invested",
      "description": "You've dedicated 25 hours to learning system_design!"
    }
  ]
}
```

## Goal Management Endpoints

### Get User Goals
Get all career goals for a user.

**Endpoint:** `GET /api/goals/user/:userId`

**Response:**
```json
[
  {
    "goal_id": "goal123",
    "current_node_id": "pf_swe_junior",
    "target_node_id": "pf_swe_senior",
    "target_date": "2026-12-31",
    "status": "active",
    "progress_percentage": 25,
    "notes": "Focus on system design and leadership",
    "created_at": "2025-01-15T10:00:00Z",
    "achieved_date": null,
    "current_role": "Junior Software Engineer",
    "target_role": "Senior Software Engineer"
  }
]
```

### Create Career Goal
Create a new career goal.

**Endpoint:** `POST /api/goals`

**Request Body:**
```json
{
  "currentNodeId": "pf_swe_junior",
  "targetNodeId": "pf_swe_senior",
  "targetDate": "2026-12-31",
  "notes": "Focus on system design and leadership skills"
}
```

**Response:**
```json
{
  "goalId": "goal123"
}
```

### Update Goal
Update goal status or notes.

**Endpoint:** `PUT /api/goals/:goalId`

**Request Body:**
```json
{
  "status": "paused",
  "notes": "Taking a break to focus on current role"
}
```

### Get Goal Milestones
Get milestones for a specific goal.

**Endpoint:** `GET /api/goals/:goalId/milestones`

**Response:**
```json
[
  {
    "milestone_id": "milestone123",
    "title": "Complete System Design Course",
    "description": "Finish the comprehensive system design course",
    "milestone_type": "skill",
    "due_date": "2025-06-30",
    "completed_date": null,
    "status": "pending",
    "completion_evidence": null
  }
]
```

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
- Authentication endpoints: 5 requests per 15 minutes per IP
- Learning progress logging: 50 requests per hour per user

## Best Practices

1. **Cache career path data** - Career nodes and transitions change infrequently
2. **Batch skill assessments** - Submit multiple skills in one request
3. **Regular progress logging** - Log learning activities to track achievements
4. **Set realistic goals** - Use the estimated transition times as guidance
5. **Review learning plans weekly** - Adjust based on actual progress