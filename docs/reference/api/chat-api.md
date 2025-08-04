# Chat API

Real-time AI chat integration for career guidance and experience management.

## Overview

The Chat API provides access to Pathfinder's AI-powered career assistant. It supports both REST endpoints for message history and WebSocket connections for real-time conversations.

## Base URL

```
https://api.pathfinder.ai/v1/chat
```

## Authentication

All chat endpoints require authentication:

```http
Authorization: Bearer <access_token>
```

## REST Endpoints

### 1. Start New Conversation

**POST** `/api/chat/conversations`

Creates a new chat conversation session.

#### Request

```javascript
POST /api/chat/conversations
Content-Type: application/json
Authorization: Bearer <token>

{
  "title": "Career Transition Planning",
  "context": {
    "targetRole": "Product Manager",
    "currentRole": "Software Engineer",
    "timeframe": "6 months"
  },
  "preferences": {
    "responseStyle": "detailed", // brief, detailed, conversational
    "focusAreas": ["skills_gap", "networking", "resume"]
  }
}
```

#### Response

```javascript
201 Created
{
  "success": true,
  "data": {
    "conversationId": "conv_7Np4Qs8Rx2Yt",
    "title": "Career Transition Planning",
    "createdAt": "2024-01-15T10:30:00Z",
    "status": "active",
    "aiModel": "gpt-4-career-v2",
    "tokenUsage": {
      "limit": 100000,
      "used": 0
    }
  }
}
```

### 2. Send Message

**POST** `/api/chat/conversations/{conversationId}/messages`

Sends a message to the AI assistant and receives a response.

#### Request

```javascript
POST /api/chat/conversations/conv_7Np4Qs8Rx2Yt/messages
Content-Type: application/json
Authorization: Bearer <token>

{
  "message": "What skills do I need to transition from software engineering to product management?",
  "attachments": [
    {
      "type": "experience",
      "id": "exp_3Km7Lp9Wx5Zn"
    },
    {
      "type": "job_description",
      "content": "Product Manager role at TechCorp..."
    }
  ],
  "options": {
    "includeExamples": true,
    "suggestResources": true,
    "analyzeGaps": true
  }
}
```

#### Response

```javascript
200 OK
{
  "success": true,
  "data": {
    "messageId": "msg_9Ty3Wx5Km7Lp",
    "conversationId": "conv_7Np4Qs8Rx2Yt",
    "timestamp": "2024-01-15T10:31:23Z",
    "userMessage": {
      "content": "What skills do I need to transition...",
      "attachments": [...]
    },
    "aiResponse": {
      "content": "Based on your software engineering background, here's a comprehensive skills analysis for transitioning to product management:\n\n**Skills You Already Have:**\n1. Technical Understanding - Strong advantage\n2. Problem-Solving - Directly transferable\n3. Data Analysis - Valuable for PM metrics\n\n**Skills to Develop:**\n1. **Business Strategy**\n   - Market analysis\n   - Competitive intelligence\n   - Revenue modeling\n   \n2. **Product Skills**\n   - User research methods\n   - Product roadmapping\n   - A/B testing frameworks\n   \n3. **Leadership & Communication**\n   - Stakeholder management\n   - Executive presentations\n   - Cross-functional leadership\n\n**Recommended Actions:**\n- Take a Product Management course (Reforge, Product School)\n- Lead a cross-functional project at your current job\n- Start a side project to practice PM skills\n- Network with current PMs in your target companies",
      "metadata": {
        "confidence": 0.92,
        "sources": ["career_transitions", "pm_skills_framework"],
        "processingTime": 1.23
      },
      "suggestions": {
        "nextSteps": [
          "Review PM job descriptions to identify common requirements",
          "Create a skills development timeline",
          "Update resume to highlight transferable skills"
        ],
        "resources": [
          {
            "title": "Cracking the PM Interview",
            "type": "book",
            "relevance": 0.95
          },
          {
            "title": "Product Management Fundamentals",
            "type": "course",
            "provider": "Coursera",
            "relevance": 0.88
          }
        ]
      }
    },
    "tokenUsage": {
      "prompt": 245,
      "completion": 412,
      "total": 657
    }
  }
}
```

### 3. Get Conversation History

**GET** `/api/chat/conversations/{conversationId}/messages`

Retrieves message history for a conversation.

#### Request

```http
GET /api/chat/conversations/conv_7Np4Qs8Rx2Yt/messages?limit=20&offset=0
Authorization: Bearer <token>
```

#### Response

```javascript
200 OK
{
  "success": true,
  "data": {
    "messages": [
      {
        "messageId": "msg_9Ty3Wx5Km7Lp",
        "timestamp": "2024-01-15T10:31:23Z",
        "role": "user",
        "content": "What skills do I need to transition...",
        "attachments": []
      },
      {
        "messageId": "msg_8Rx2Yt7Np4Qs",
        "timestamp": "2024-01-15T10:31:25Z",
        "role": "assistant",
        "content": "Based on your software engineering background...",
        "metadata": {
          "confidence": 0.92,
          "edited": false
        }
      }
    ],
    "pagination": {
      "total": 47,
      "limit": 20,
      "offset": 0,
      "hasMore": true
    }
  }
}
```

### 4. List Conversations

**GET** `/api/chat/conversations`

Lists all conversations for the authenticated user.

#### Request

```http
GET /api/chat/conversations?status=active&sort=recent&limit=10
Authorization: Bearer <token>
```

#### Response

```javascript
200 OK
{
  "success": true,
  "data": {
    "conversations": [
      {
        "conversationId": "conv_7Np4Qs8Rx2Yt",
        "title": "Career Transition Planning",
        "lastMessage": "Based on your software engineering...",
        "lastActivity": "2024-01-15T10:31:25Z",
        "messageCount": 12,
        "status": "active",
        "tags": ["career_change", "product_management"]
      },
      {
        "conversationId": "conv_5Lm8Qr3Ty6Wx",
        "title": "Resume Review for PM Roles",
        "lastMessage": "I've reviewed your resume...",
        "lastActivity": "2024-01-14T15:20:10Z",
        "messageCount": 8,
        "status": "active",
        "tags": ["resume", "product_management"]
      }
    ],
    "pagination": {
      "total": 23,
      "limit": 10,
      "offset": 0
    }
  }
}
```

### 5. Update Conversation

**PATCH** `/api/chat/conversations/{conversationId}`

Updates conversation metadata.

#### Request

```javascript
PATCH /api/chat/conversations/conv_7Np4Qs8Rx2Yt
Content-Type: application/json
Authorization: Bearer <token>

{
  "title": "PM Transition - Skills & Timeline",
  "tags": ["career_change", "product_management", "action_plan"],
  "status": "archived" // active, archived, deleted
}
```

### 6. Generate Summary

**POST** `/api/chat/conversations/{conversationId}/summary`

Generates an AI summary of the conversation.

#### Request

```javascript
POST /api/chat/conversations/conv_7Np4Qs8Rx2Yt/summary
Content-Type: application/json
Authorization: Bearer <token>

{
  "format": "action_items", // action_items, key_insights, full_summary
  "length": "medium" // brief, medium, detailed
}
```

#### Response

```javascript
200 OK
{
  "success": true,
  "data": {
    "summary": {
      "type": "action_items",
      "content": {
        "immediate": [
          "Enroll in Product Management Fundamentals course",
          "Schedule coffee chats with 3 PMs in target companies",
          "Rewrite resume to emphasize product-thinking examples"
        ],
        "shortTerm": [
          "Lead a cross-functional project at current job",
          "Complete PM interview preparation book",
          "Build a product case study portfolio"
        ],
        "longTerm": [
          "Apply to APM programs if eligible",
          "Target internal transfer opportunities",
          "Consider product-focused MBA programs"
        ]
      },
      "metadata": {
        "conversationLength": 12,
        "keyTopics": ["skills_gap", "career_transition", "pm_roles"],
        "generatedAt": "2024-01-15T11:00:00Z"
      }
    }
  }
}
```

## WebSocket API

For real-time chat interactions, connect via WebSocket:

### Connection

```javascript
const ws = new WebSocket('wss://api.pathfinder.ai/chat/ws');

// Authenticate after connection
ws.onopen = () => {
  ws.send(JSON.stringify({
    type: 'auth',
    token: 'Bearer <access_token>'
  }));
};

// Join conversation
ws.send(JSON.stringify({
  type: 'join',
  conversationId: 'conv_7Np4Qs8Rx2Yt'
}));
```

### Message Types

#### Send Message

```javascript
ws.send(JSON.stringify({
  type: 'message',
  data: {
    conversationId: 'conv_7Np4Qs8Rx2Yt',
    content: 'What certifications would help my transition?',
    attachments: []
  }
}));
```

#### Receive Message

```javascript
ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  
  switch(message.type) {
    case 'message':
      // AI response
      console.log(message.data.content);
      break;
      
    case 'typing':
      // AI is typing
      console.log('AI is thinking...');
      break;
      
    case 'error':
      // Handle error
      console.error(message.error);
      break;
  }
};
```

## AI Context Management

### Available Context Types

1. **User Profile Context**
   - Automatically included
   - Contains career history, skills, goals

2. **Experience Context**
   ```javascript
   {
     "type": "experience",
     "id": "exp_3Km7Lp9Wx5Zn"
   }
   ```

3. **Job Description Context**
   ```javascript
   {
     "type": "job_description",
     "content": "Full job description text...",
     "url": "https://example.com/jobs/123"
   }
   ```

4. **Resume Context**
   ```javascript
   {
     "type": "resume",
     "id": "res_5Ty8Wx9Zn3Lm"
   }
   ```

5. **Document Context**
   ```javascript
   {
     "type": "document",
     "name": "Performance Review 2023.pdf",
     "content": "base64_encoded_content"
   }
   ```

## Chat Features

### 1. Smart Suggestions

The AI provides contextual suggestions based on conversation:

```javascript
{
  "suggestions": {
    "questions": [
      "How long will this transition realistically take?",
      "What salary range should I expect as a new PM?",
      "Which companies are best for PM career growth?"
    ],
    "actions": [
      "Create a 90-day transition plan",
      "Analyze my resume for PM keywords",
      "Find PM networking events in my area"
    ]
  }
}
```

### 2. Interactive Elements

Responses may include interactive elements:

```javascript
{
  "interactive": {
    "type": "skill_assessment",
    "data": {
      "skills": [
        {"name": "Market Research", "current": 2, "required": 4},
        {"name": "Data Analysis", "current": 4, "required": 4},
        {"name": "Stakeholder Management", "current": 3, "required": 5}
      ],
      "actions": {
        "assessSkill": "/api/skills/assess",
        "createPlan": "/api/learning/plan"
      }
    }
  }
}
```

### 3. File Generation

The AI can generate downloadable files:

```javascript
{
  "files": [
    {
      "type": "pdf",
      "name": "PM_Transition_Plan.pdf",
      "url": "/api/files/download/tmp_9Wx5Zn3Lm7Ty",
      "expiresIn": 3600
    }
  ]
}
```

## Rate Limits

| Endpoint | Limit | Window |
|----------|-------|---------|
| Send Message | 60 | 1 minute |
| Start Conversation | 10 | 1 hour |
| Generate Summary | 20 | 1 hour |
| WebSocket Messages | 120 | 1 minute |

## Error Handling

### Error Response Format

```javascript
{
  "success": false,
  "error": {
    "code": "CHAT_RATE_LIMIT",
    "message": "Message rate limit exceeded. Please wait 30 seconds.",
    "details": {
      "limit": 60,
      "window": "1 minute",
      "retryAfter": 30
    }
  }
}
```

### Common Error Codes

| Code | Description |
|------|-------------|
| `CHAT_CONVERSATION_NOT_FOUND` | Invalid conversation ID |
| `CHAT_RATE_LIMIT` | Rate limit exceeded |
| `CHAT_CONTEXT_TOO_LARGE` | Attachment size exceeds limit |
| `CHAT_AI_UNAVAILABLE` | AI service temporarily unavailable |
| `CHAT_INVALID_ATTACHMENT` | Unsupported attachment type |
| `CHAT_TOKEN_LIMIT` | Monthly token limit reached |

## Best Practices

### 1. Context Management

```javascript
// Good: Provide specific context
{
  "message": "Review my experience as Senior Developer at TechCorp",
  "attachments": [{"type": "experience", "id": "exp_123"}]
}

// Better: Add goal context
{
  "message": "Review my experience as Senior Developer at TechCorp for PM transition",
  "attachments": [{"type": "experience", "id": "exp_123"}],
  "context": {"goal": "product_management_transition"}
}
```

### 2. Message Formatting

```javascript
// Use structured questions for better responses
{
  "message": "Help me with PM transition",
  "options": {
    "aspects": ["timeline", "skills", "networking"],
    "depth": "detailed"
  }
}
```

### 3. Session Management

- Start new conversations for different topics
- Archive completed conversations
- Use meaningful titles for easy retrieval

## Integration Examples

### React Hook

```typescript
import { useState, useCallback } from 'react';

function usePathfinderChat(conversationId: string) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);

  const sendMessage = useCallback(async (content: string) => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/chat/conversations/${conversationId}/messages`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ message: content })
        }
      );
      
      const data = await response.json();
      setMessages(prev => [...prev, data.userMessage, data.aiResponse]);
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  return { messages, sendMessage, loading };
}
```

---

**Next:** [Profile API](./profile-api.md) | **Previous:** [Authentication API](./authentication.md)