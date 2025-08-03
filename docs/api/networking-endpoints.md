# Professional Networking API Endpoints

## Overview

The Professional Networking API provides comprehensive endpoints for managing professional contacts, tracking interactions, setting reminders, and receiving AI-powered networking recommendations. This system helps users build and maintain meaningful professional relationships.

## Base URL
```
/api
```

## Authentication
All endpoints require JWT authentication. Include the token in the Authorization header:
```
Authorization: Bearer <token>
```

## Contact Management Endpoints

### List Contacts
Get a paginated list of contacts with optional filtering and sorting.

**Endpoint:** `GET /api/contacts`

**Query Parameters:**
- `search` (string, optional): Search contacts by name, company, or title
- `relationshipType` (string, optional): Filter by relationship type (mentor, peer, report, recruiter, friend)
- `minStrength` (integer, optional): Minimum relationship strength (1-5)
- `company` (string, optional): Filter by company name
- `sortBy` (string, optional): Sort field (first_name, last_name, company, last_interaction, relationship_strength)
- `sortOrder` (string, optional): Sort order (ASC, DESC)
- `limit` (integer, optional): Results per page (default: 50, max: 100)
- `offset` (integer, optional): Pagination offset

**Response:**
```json
[
  {
    "contact_id": "contact123",
    "first_name": "John",
    "last_name": "Doe",
    "preferred_name": "JD",
    "email": "john.doe@example.com",
    "phone": "+1-555-0123",
    "linkedin_url": "https://linkedin.com/in/johndoe",
    "current_title": "Senior Software Engineer",
    "current_company": "Tech Corp",
    "location": "San Francisco, CA",
    "relationship_type": "peer",
    "relationship_strength": 4,
    "last_interaction_date": "2025-01-15",
    "personal_interests": ["hiking", "photography"],
    "professional_context": {
      "industry": "Technology",
      "skills": ["Python", "Machine Learning"]
    },
    "tags": ["conference-2024", "ai-expert"],
    "interaction_count": 12,
    "last_interaction": "2025-01-15T10:30:00Z"
  }
]
```

### Get Contact Details
Get detailed information about a specific contact.

**Endpoint:** `GET /api/contacts/:contactId`

**Response:** Extended contact object with recent interactions

### Create Contact
Add a new professional contact.

**Endpoint:** `POST /api/contacts`

**Request Body:**
```json
{
  "firstName": "Jane",
  "lastName": "Smith",
  "preferredName": "Jane",
  "email": "jane.smith@example.com",
  "phone": "+1-555-0456",
  "linkedinUrl": "https://linkedin.com/in/janesmith",
  "currentTitle": "Product Manager",
  "currentCompany": "StartupCo",
  "location": "New York, NY",
  "bio": "Experienced PM in fintech",
  "contactSource": "conference",
  "relationshipType": "peer",
  "relationshipStrength": 3,
  "personalInterests": ["running", "cooking"],
  "professionalContext": {
    "industry": "Fintech",
    "expertise": ["Product Strategy", "User Research"]
  },
  "tags": ["fintech", "product-management"]
}
```

### Update Contact
Update contact information.

**Endpoint:** `PUT /api/contacts/:contactId`

**Request Body:** Same as create, all fields optional

### Delete Contact
Remove a contact from your network.

**Endpoint:** `DELETE /api/contacts/:contactId`

### Add Contact Tags
Add tags to categorize a contact.

**Endpoint:** `POST /api/contacts/:contactId/tags`

**Request Body:**
```json
{
  "tags": ["mentor", "startup-advisor", "investor"]
}
```

### Search Contacts
Quick search across all contacts.

**Endpoint:** `GET /api/contacts/search`

**Query Parameters:**
- `q` (string, required): Search query

### Get Contact Analytics
Get analytics about your contact network.

**Endpoint:** `GET /api/contacts/analytics`

**Response:**
```json
{
  "total_contacts": 150,
  "avg_strength": 3.4,
  "mentors": 12,
  "peers": 98,
  "active_last_30_days": 45,
  "inactive_90_days": 23
}
```

## Interaction Management Endpoints

### List Interactions
Get interaction history with filtering options.

**Endpoint:** `GET /api/interactions`

**Query Parameters:**
- `contactId` (string, optional): Filter by contact
- `interactionType` (string, optional): Type (meeting, email, call, message, event)
- `startDate` (ISO 8601, optional): Start date filter
- `endDate` (ISO 8601, optional): End date filter
- `sentiment` (string, optional): Filter by sentiment (positive, neutral, negative)
- `followUpRequired` (boolean, optional): Only show interactions needing follow-up
- `limit` (integer, optional): Results per page
- `offset` (integer, optional): Pagination offset

### Log Interaction
Record a new interaction with a contact.

**Endpoint:** `POST /api/interactions`

**Request Body:**
```json
{
  "contactId": "contact123",
  "interactionType": "meeting",
  "interactionDate": "2025-02-03T14:00:00Z",
  "subject": "Coffee chat about career transition",
  "notes": "Discussed move from engineering to product management",
  "location": "Blue Bottle Coffee, SF",
  "durationMinutes": 60,
  "sentiment": "positive",
  "followUpRequired": true,
  "followUpDate": "2025-02-10",
  "followUpNotes": "Send PM resources and introduction to Sarah",
  "valueExchanged": {
    "given": ["Career advice", "Industry insights"],
    "received": ["Startup ideas", "Investment perspectives"]
  },
  "meetingNotes": {
    "meetingPurpose": "Career guidance discussion",
    "keyTopics": ["Product management transition", "Startup opportunities"],
    "actionItems": [
      {
        "item": "Send PM course recommendations",
        "deadline": "2025-02-05"
      }
    ],
    "nextSteps": "Schedule follow-up in 2 weeks"
  }
}
```

### Get Interaction Details
Get detailed information about a specific interaction.

**Endpoint:** `GET /api/interactions/:interactionId`

### Update Interaction
Update interaction details.

**Endpoint:** `PUT /api/interactions/:interactionId`

## Meeting Notes Endpoints

### Create Meeting Notes
Add structured notes to an interaction.

**Endpoint:** `POST /api/meetings`

**Request Body:**
```json
{
  "interactionId": "interaction123",
  "meetingPurpose": "Quarterly catch-up and mentorship",
  "keyTopics": [
    "Career progression",
    "Industry trends",
    "Skill development"
  ],
  "actionItems": [
    {
      "item": "Review resume",
      "owner": "me",
      "deadline": "2025-02-10"
    }
  ],
  "decisionsMade": [
    "Apply for senior role at TechCo",
    "Start ML certification course"
  ],
  "nextSteps": "Schedule mock interview session",
  "personalNotes": "Mentioned family vacation to Hawaii",
  "professionalInsights": "Strong interest in AI/ML leadership roles"
}
```

### Update Meeting Notes
Update existing meeting notes.

**Endpoint:** `PUT /api/meetings/:meetingId`

### Get Meeting Insights
Get analytics and insights from recent meetings.

**Endpoint:** `GET /api/meetings/insights`

**Query Parameters:**
- `timeframe` (integer, optional): Days to analyze (default: 30)

**Response:**
```json
{
  "summary": {
    "total_meetings": 15,
    "unique_contacts": 12,
    "avg_duration": 47.5,
    "positive_meetings": 13,
    "follow_ups_needed": 6,
    "total_time_invested": 712
  },
  "top_contacts": [...],
  "common_topics": [
    {"topic": "Career Development", "count": 8},
    {"topic": "Industry Trends", "count": 6}
  ],
  "timeframe_days": 30
}
```

## Reminder Endpoints

### List Reminders
Get reminders with filtering options.

**Endpoint:** `GET /api/reminders`

**Query Parameters:**
- `status` (string, optional): Filter by status (pending, sent, completed, snoozed, cancelled)
- `contactId` (string, optional): Filter by contact
- `reminderType` (string, optional): Type (follow_up, birthday, milestone, check_in)
- `startDate` (ISO 8601, optional): Start date filter
- `endDate` (ISO 8601, optional): End date filter
- `includeCompleted` (boolean, optional): Include completed reminders

### Create Reminder
Set a new reminder.

**Endpoint:** `POST /api/reminders`

**Request Body:**
```json
{
  "contactId": "contact123",
  "reminderType": "follow_up",
  "reminderDate": "2025-02-15",
  "reminderTime": "09:00",
  "subject": "Follow up on introduction request",
  "notes": "Introduce to Sarah from ProductCo",
  "isRecurring": false,
  "recurrencePattern": null
}
```

### Update Reminder
Modify an existing reminder.

**Endpoint:** `PUT /api/reminders/:reminderId`

### Complete Reminder
Mark a reminder as completed.

**Endpoint:** `POST /api/reminders/:reminderId/complete`

### Get Upcoming Reminders
Get reminders for the next N days.

**Endpoint:** `GET /api/reminders/upcoming`

**Query Parameters:**
- `days` (integer, optional): Days ahead to check (default: 7, max: 90)

**Response:**
```json
{
  "reminders": [...],
  "grouped_by_date": {
    "2025-02-04": [...],
    "2025-02-05": [...]
  },
  "total_count": 8
}
```

## Networking Recommendations Endpoints

### Get Recommendations
Get AI-powered networking recommendations.

**Endpoint:** `GET /api/networking/recommendations`

**Response:**
```json
[
  {
    "recommendation_id": "rec123",
    "recommendation_type": "person",
    "title": "Reconnect with Jane Smith",
    "description": "It's been 4 months since your last interaction with Jane...",
    "reason": "Strong professional relationship worth maintaining",
    "relevance_score": 0.85,
    "metadata": {
      "contact_id": "contact123",
      "last_interaction": "2024-10-15",
      "days_since_last": 120
    }
  },
  {
    "recommendation_type": "event",
    "title": "Tech Leadership Summit 2025",
    "description": "Annual conference for engineering leaders",
    "reason": "Aligns with your career goals in technical leadership",
    "relevance_score": 0.75
  }
]
```

### Dismiss Recommendation
Dismiss a networking recommendation.

**Endpoint:** `POST /api/networking/recommendations/:recommendationId/dismiss`

### Get Networking Insights
Get insights about your networking patterns and health.

**Endpoint:** `GET /api/networking/insights`

**Response:**
```json
{
  "network_growth": {
    "new_contacts_30d": 5,
    "new_contacts_90d": 18,
    "total_contacts": 150
  },
  "interaction_velocity": {
    "interactions_30d": 23,
    "active_contacts_30d": 15,
    "avg_duration_30d": 42.5
  },
  "relationship_health": {
    "avg_relationship_strength": 3.4,
    "strong_relationships": 45,
    "dormant_relationships": 28
  },
  "insights": [
    {
      "type": "maintenance",
      "priority": "high",
      "message": "Many relationships are becoming dormant. Time to reconnect!",
      "action": "Review dormant contacts"
    }
  ]
}
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
- Contact creation: 50 per hour per user
- Bulk operations: 10 per hour per user

## Best Practices

1. **Regular Interaction Logging** - Log interactions soon after they occur for accuracy
2. **Meaningful Tags** - Use consistent tags for better organization
3. **Set Reminders** - Always set follow-up reminders for important connections
4. **Review Recommendations** - Check AI recommendations weekly
5. **Update Relationship Strength** - Periodically review and update relationship strengths
6. **Privacy First** - Only store professional information with consent

## Data Privacy

- All contact data is encrypted at rest
- No contact data is shared between users
- Users can export their contact data at any time
- Deletion is permanent and immediate
- Meeting notes marked as "personal" are additionally encrypted