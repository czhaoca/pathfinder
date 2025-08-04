# AI Chat Assistant

The AI Chat Assistant is the core feature of Pathfinder, providing personalized career guidance through natural language conversations.

## Overview

The chat assistant leverages OpenAI's GPT-4 model with custom context management to provide:
- Career exploration and advice
- Skills assessment and gap analysis
- Interview preparation
- Resume optimization suggestions
- Industry insights and trends

## Key Features

### 1. Contextual Conversations
- Maintains conversation history
- References user's experiences and goals
- Provides personalized recommendations
- Learns from user interactions

### 2. Streaming Responses
- Real-time response streaming
- Markdown formatting support
- Code syntax highlighting
- Interactive elements

### 3. Multi-Turn Dialogues
- Complex career planning discussions
- Follow-up questions and clarifications
- Task-oriented conversations
- Goal tracking

### 4. Integration with User Data
- Accesses user's experience database
- References skills and achievements
- Suggests based on career history
- Updates user profile insights

## How It Works

### Architecture
```
User Input → Frontend → API Server → MCP Server → OpenAI API
                ↓                        ↑
            User Context ←───────────────┘
```

### Context Management
The MCP (Model Context Protocol) server:
1. Retrieves user's experiences and profile
2. Builds relevant context for the query
3. Manages conversation history
4. Ensures response relevance

### Response Processing
1. User sends message via chat interface
2. Frontend initiates streaming connection
3. Backend adds user context
4. MCP server queries OpenAI
5. Response streamed back in chunks
6. Frontend renders markdown in real-time

## Usage Examples

### Career Exploration
```
User: "I'm a software developer interested in transitioning to product management"