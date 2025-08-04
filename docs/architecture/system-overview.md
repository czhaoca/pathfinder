# System Architecture Overview

Pathfinder is a modern, scalable web application built with a microservices-oriented architecture that emphasizes security, performance, and maintainability.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (React)                       │
│  ┌─────────────┐ ┌──────────────┐ ┌────────────────────┐   │
│  │   Pages     │ │  Components  │ │  State (Zustand)   │   │
│  └─────────────┘ └──────────────┘ └────────────────────┘   │
└───────────────────────────┬─────────────────────────────────┘
                            │ HTTPS
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    API Gateway (Nginx)                       │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   Backend API (Node.js)                      │
│  ┌─────────────┐ ┌──────────────┐ ┌────────────────────┐   │
│  │   Routes    │ │  Controllers │ │    Services        │   │
│  └─────────────┘ └──────────────┘ └────────────────────┘   │
└───────────────────────────┬─────────────────────────────────┘
                            │
                ┌───────────┴───────────┐
                ▼                       ▼
┌──────────────────────┐    ┌──────────────────────┐
│  Oracle Database     │    │   MCP Server         │
│  (User Data)         │    │   (AI Context)       │
└──────────────────────┘    └──────────────────────┘
```

## Core Components

### 1. Frontend Application
- **Technology**: React 18 with TypeScript
- **State Management**: Zustand
- **Routing**: React Router v6
- **Styling**: Tailwind CSS + Radix UI
- **Build Tool**: Vite

### 2. Backend API Server
- **Runtime**: Node.js with Express
- **Language**: JavaScript (ES6+)
- **Authentication**: JWT with refresh tokens
- **Session Store**: In-memory (Redis planned)
- **API Style**: RESTful

### 3. Database Layer
- **Primary Database**: Oracle Autonomous Database
- **Architecture**: Multi-user with schema isolation
- **Security**: User-prefixed tables, row-level security
- **Encryption**: Field-level AES-256 encryption

### 4. AI Integration
- **MCP Server**: Model Context Protocol for AI conversations
- **LLM Provider**: OpenAI GPT-4
- **Context Management**: Conversation history and user context

### 5. Infrastructure
- **Containerization**: Docker
- **Reverse Proxy**: Nginx
- **Environment**: Development/Production separation
- **Monitoring**: Built-in health checks

## Key Design Principles

### 1. Security First
- JWT-based authentication with short-lived tokens
- Complete data isolation between users
- Field-level encryption for sensitive data
- Comprehensive audit logging
- Rate limiting and DDoS protection

### 2. Scalability
- Stateless API design
- Horizontal scaling support
- Database connection pooling
- Efficient caching strategies

### 3. Maintainability
- Clear separation of concerns
- Modular service architecture
- Comprehensive error handling
- Extensive logging and monitoring

### 4. User Experience
- Fast, responsive React frontend
- Real-time updates via streaming
- Optimistic UI updates
- Progressive enhancement

## Data Flow

### User Authentication Flow
1. User submits credentials to `/api/auth/login`
2. Backend validates credentials against database
3. JWT token generated and returned
4. Frontend stores token and includes in API requests
5. Backend validates token on each request

### Experience Management Flow
1. User creates/updates experience via frontend form
2. Data sent to `/api/experiences` endpoint
3. Backend validates and processes data
4. Experience stored in user-specific schema
5. AI processes experience for insights
6. Updated data returned to frontend

### AI Chat Flow
1. User sends message via chat interface
2. Frontend streams request to `/api/chat/stream`
3. Backend adds user context from database
4. Request sent to MCP server with context
5. MCP server queries OpenAI API
6. Response streamed back to user

## Security Architecture

### Authentication & Authorization
- JWT tokens with 15-minute expiry
- Refresh token rotation
- Role-based access control
- API key support for programmatic access

### Data Protection
- User data isolation via database schemas
- AES-256 encryption for sensitive fields
- TLS 1.3 for data in transit
- Secure session management

### Compliance
- HIPAA-compliant data handling
- GDPR privacy controls
- Comprehensive audit trails
- Data retention policies

## Deployment Architecture

### Development Environment
- Local Node.js servers
- Docker Compose for services
- Hot module replacement
- Development database

### Production Environment
- Dockerized applications
- Nginx reverse proxy
- SSL/TLS termination
- Production database with backups

## Performance Considerations

### Frontend Optimization
- Code splitting and lazy loading
- Image optimization
- Bundle size monitoring
- Service worker caching

### Backend Optimization
- Connection pooling
- Query optimization
- Response compression
- Efficient pagination

### Database Optimization
- Indexed queries
- Materialized views for analytics
- Partitioned tables
- Regular maintenance

## Monitoring & Observability

### Application Metrics
- Request/response times
- Error rates
- User activity
- Resource utilization

### Health Checks
- API endpoint health
- Database connectivity
- Service availability
- Resource thresholds

### Logging
- Structured JSON logs
- Centralized log aggregation
- Error tracking
- Security audit logs

## Future Enhancements

### Planned Features
- Redis session store
- GraphQL API option
- Real-time notifications
- Mobile applications

### Infrastructure Improvements
- Kubernetes deployment
- Auto-scaling policies
- CDN integration
- Multi-region support