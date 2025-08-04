# AI Chat Integration

## Overview

The Pathfinder chat system provides AI-powered career guidance through an intelligent conversational interface. The system integrates with both MCP (Model Context Protocol) servers and OpenAI to deliver personalized, context-aware career advice.

## Architecture

### Backend Integration

The chat system follows a layered architecture:

```
Frontend (React) 
    ↓
Chat API (Express)
    ↓
Chat Service
    ↓
MCP Server / OpenAI Fallback
```

### Key Components

1. **Chat Controller** (`/backend/src/api/controllers/chatController.js`)
   - Handles HTTP requests
   - Validates input
   - Returns formatted responses

2. **Chat Service** (`/backend/src/services/chatService.js`)
   - Business logic layer
   - Manages conversations
   - Integrates with AI providers
   - Handles user context

3. **OpenAI Chat Service** (`/backend/src/services/openaiChatService.js`)
   - Direct OpenAI integration
   - Specialized career guidance prompts
   - Streaming support

4. **Chat Repository** (`/backend/src/repositories/chatRepository.js`)
   - Database operations
   - Conversation persistence
   - Message history

## Features

### 1. Dual AI Provider Support

- **Primary**: MCP Server for integrated context
- **Fallback**: OpenAI GPT-4 for reliable responses
- Automatic failover between providers

### 2. Streaming Responses

Real-time streaming via Server-Sent Events (SSE):
- Character-by-character display
- Better user experience
- Reduced perceived latency

### 3. Conversation Context

- Full conversation history
- User profile integration
- Experience and skills awareness
- Persistent conversations

### 4. Career-Focused AI

Specialized system prompts for:
- Career planning and exploration
- Skill development guidance
- Experience optimization
- Job search strategies
- Professional growth advice

## API Endpoints

### Send Message
```http
POST /api/chat/message
Content-Type: application/json
Authorization: Bearer <token>

{
  "message": "What career path should I consider?",
  "conversationId": "optional-existing-id"
}
```

Response:
```json
{
  "conversationId": "conv_123",
  "message": {
    "id": "msg_456",
    "role": "assistant",
    "content": "Based on your background...",
    "timestamp": "2025-01-30T10:00:00Z"
  }
}
```

### Stream Message
```http
POST /api/chat/message/stream
Content-Type: application/json
Authorization: Bearer <token>

{
  "message": "Tell me about data science careers",
  "conversationId": "optional-existing-id"
}
```

Response (SSE):
```
event: connected
data: {"status": "connected"}

event: message
data: {"type": "chunk", "content": "Data science "}

event: message
data: {"type": "chunk", "content": "is a rapidly "}

event: message
data: {"type": "complete", "conversationId": "conv_123"}
```

### Get History
```http
GET /api/chat/history?conversationId=conv_123&limit=50
Authorization: Bearer <token>
```

### Search Conversations
```http
GET /api/chat/conversations/search?q=python
Authorization: Bearer <token>
```

## Frontend Integration

### React Hook Usage

```typescript
import { useChatStream } from '@/hooks/useChatStream';

function ChatComponent() {
  const { 
    messages, 
    sendMessage, 
    streaming,
    loading 
  } = useChatStream();

  const handleSend = async (message: string) => {
    await sendMessage(message, true); // true for streaming
  };

  return (
    // Chat UI
  );
}
```

### Service Layer

The frontend uses two services:
1. `chatService.ts` - Standard request/response
2. `chatStreamService.ts` - SSE streaming

## User Context Integration

The AI has access to:
- User's name and profile
- Number of experiences
- Top 5 skills
- Recent conversation history

This enables personalized responses like:
- "Given your Python expertise..."
- "Based on your 5 years of experience..."
- "Considering your interest in data science..."

## Security

- JWT authentication required
- Rate limiting: 20 messages/minute
- Message length limit: 2000 characters
- User data isolation
- Audit logging

## Performance Optimizations

1. **Conversation Caching**
   - Recent messages cached in memory
   - Reduces database queries

2. **Streaming Responses**
   - Immediate feedback to users
   - Progressive rendering

3. **Fallback Mechanism**
   - Automatic failover to OpenAI
   - Rule-based responses as last resort

## Configuration

### Environment Variables

```env
# OpenAI Configuration
OPENAI_API_KEY=sk-...

# MCP Server (optional)
MCP_SERVER_URL=http://localhost:3001
MCP_SERVER_TOKEN=...

# Chat Settings
CHAT_MAX_MESSAGE_LENGTH=2000
CHAT_HISTORY_LIMIT=50
CHAT_RATE_LIMIT_WINDOW=60000
CHAT_RATE_LIMIT_MAX=20
```

## Testing

### Manual Testing
1. Start the backend server
2. Login to get auth token
3. Send chat messages via API or UI
4. Verify streaming works
5. Check conversation persistence

### Automated Tests
```bash
# Run chat integration tests
npm test tests/integration/chat-openai.test.js
```

## Troubleshooting

### Common Issues

1. **"No response from AI"**
   - Check OPENAI_API_KEY is set
   - Verify MCP server is running (if used)
   - Check network connectivity

2. **"Streaming not working"**
   - Ensure SSE is not blocked by proxy
   - Check CORS settings
   - Verify frontend SSE handling

3. **"Conversation not found"**
   - Verify conversation ID is valid
   - Check user owns the conversation
   - Ensure conversation wasn't deleted

## Future Enhancements

1. **Voice Integration**
   - Speech-to-text input
   - Text-to-speech responses

2. **Multi-language Support**
   - Detect user language
   - Respond in preferred language

3. **Advanced Context**
   - Industry-specific knowledge
   - Job market data integration
   - Salary insights

4. **Proactive Guidance**
   - Career milestone reminders
   - Skill development suggestions
   - Job opportunity alerts

## Best Practices

1. **Keep Messages Concise**
   - Clear, specific questions
   - One topic per message

2. **Provide Context**
   - Share relevant background
   - Mention specific goals

3. **Use Follow-ups**
   - Build on previous responses
   - Ask for clarification

4. **Review History**
   - Reference past conversations
   - Track advice over time