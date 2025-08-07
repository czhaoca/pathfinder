# Pathfinder Architecture Documentation

## Table of Contents

1. [System Overview](#system-overview)
2. [Architecture Principles](#architecture-principles)
3. [Technology Stack](#technology-stack)
4. [System Architecture](#system-architecture)
5. [Frontend Architecture](#frontend-architecture)
6. [Backend Architecture](#backend-architecture)
7. [Database Architecture](#database-architecture)
8. [Security Architecture](#security-architecture)
9. [API Design](#api-design)
10. [Development Guidelines](#development-guidelines)

## System Overview

Pathfinder is a multi-tier web application built with modern JavaScript/TypeScript technologies. The system follows a microservices-inspired architecture with clear separation of concerns between frontend, backend, and data layers.

## Architecture Principles

### Core Principles

1. **Separation of Concerns**: Clear boundaries between layers
2. **Single Responsibility**: Each component has one clear purpose
3. **DRY (Don't Repeat Yourself)**: Reusable components and services
4. **SOLID Principles**: Applied throughout the codebase
5. **Security First**: Security considered at every layer
6. **Scalability**: Designed to handle growth
7. **Maintainability**: Clean, documented, testable code

### Design Patterns

- **Repository Pattern**: Data access abstraction
- **Service Layer Pattern**: Business logic encapsulation
- **Dependency Injection**: Loose coupling and testability
- **MVC Pattern**: Clear separation of concerns
- **Observer Pattern**: Event-driven communication
- **Factory Pattern**: Object creation abstraction
- **Singleton Pattern**: Shared service instances

## Technology Stack

### Frontend
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **State Management**: Zustand
- **Routing**: React Router v6
- **UI Components**: Custom components with Tailwind CSS
- **API Client**: Axios
- **Form Handling**: React Hook Form
- **Validation**: Zod

### Backend
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Language**: JavaScript (migrating to TypeScript)
- **Authentication**: JWT with refresh tokens
- **Validation**: express-validator
- **ORM/Query Builder**: Custom repositories
- **Logging**: Winston
- **Testing**: Jest

### Database
- **Primary**: Oracle Autonomous Database
- **Caching**: Redis
- **Sessions**: Redis-backed sessions

### Infrastructure
- **Containerization**: Docker
- **Orchestration**: Docker Compose
- **Reverse Proxy**: Nginx
- **CI/CD**: GitHub Actions

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Client Layer                         │
│                    (Browser / Mobile App)                    │
└─────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────┐
│                      Presentation Layer                      │
│                      (React SPA + Nginx)                     │
└─────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────┐
│                       API Gateway Layer                      │
│                    (Express.js REST API)                     │
└─────────────────────────────────────────────────────────────┘
                                │
                    ┌───────────┴───────────┐
                    ▼                       ▼
┌─────────────────────────┐    ┌─────────────────────────┐
│    Business Logic       │    │      External APIs      │
│   Service Layer          │    │   (OpenAI, Job APIs)    │
└─────────────────────────┘    └─────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│                      Data Access Layer                       │
│                  (Repositories & Database)                   │
└─────────────────────────────────────────────────────────────┘
                    │                       │
                    ▼                       ▼
┌─────────────────────────┐    ┌─────────────────────────┐
│   Oracle Database       │    │      Redis Cache        │
│  (User-prefixed schemas)│    │   (Sessions & Cache)    │
└─────────────────────────┘    └─────────────────────────┘
```

## Frontend Architecture

### Component Structure

```
frontend/src/
├── components/           # Reusable UI components
│   ├── common/          # Generic components
│   ├── layout/          # Layout components
│   └── [feature]/       # Feature-specific components
├── pages/               # Route page components
├── services/            # API service layer
│   ├── BaseService.ts   # Base service class
│   └── [feature]Service.ts
├── stores/              # Zustand state management
├── hooks/               # Custom React hooks
├── types/               # TypeScript definitions
├── utils/               # Utility functions
└── lib/                 # Third-party integrations
```

### State Management

We use Zustand for state management with the following stores:

- **authStore**: Authentication and user state
- **chatStore**: Chat conversations and messages
- **experienceStore**: User experiences data
- **uiStore**: UI state (modals, loading, etc.)

### Service Layer

All API calls go through a standardized service layer:

```typescript
class BaseService<T> {
  // Standard CRUD operations
  getAll(params?: QueryParams): Promise<PaginatedResponse<T>>
  getById(id: string): Promise<T>
  create(data: Partial<T>): Promise<T>
  update(id: string, data: Partial<T>): Promise<T>
  delete(id: string): Promise<void>
}
```

## Backend Architecture

### Layer Architecture

```
backend/src/
├── api/
│   ├── controllers/     # Request handlers
│   │   ├── BaseController.js
│   │   └── [feature]Controller.js
│   ├── routes/          # Route definitions
│   ├── middleware/      # Express middleware
│   └── validators/      # Request validation
├── services/            # Business logic
│   └── [feature]Service.js
├── repositories/        # Data access layer
│   ├── BaseRepository.js
│   └── [feature]Repository.js
├── database/
│   ├── migrations/      # Database migrations
│   ├── seeds/          # Seed data
│   └── queries/        # SQL queries
├── utils/              # Utility functions
└── config/             # Configuration
```

### Request Flow

1. **Route** → 2. **Middleware** → 3. **Validation** → 4. **Controller** → 5. **Service** → 6. **Repository** → 7. **Database**

### Error Handling

Centralized error handling with custom error classes:

```javascript
class AppError extends Error {
  constructor(message, statusCode, errors) {
    super(message)
    this.statusCode = statusCode
    this.errors = errors
    this.isOperational = true
  }
}
```

### API Response Format

Standardized response format for all endpoints:

```javascript
class ApiResponse {
  static success(res, data, message, statusCode)
  static error(res, message, statusCode, errors)
  static paginated(res, items, pagination, message)
}
```

## Database Architecture

### Multi-User Schema Design

Each user gets isolated database schemas:

```sql
-- System tables (shared)
pf_users
pf_user_sessions
pf_audit_log
pf_ref_skills_catalog
pf_ref_career_paths

-- User-specific schemas
user_[username]_experiences_detailed
user_[username]_experiences_summary
user_[username]_goals
user_[username]_applications
```

### 3-Tier Experience Model

1. **Level 1**: Detailed experiences with full context
2. **Level 2**: Aggregated summaries for analysis
3. **Level 3**: Quick access summaries for display

### Database Patterns

- **Soft Deletes**: Records marked as deleted, not removed
- **Audit Trail**: All changes logged with user attribution
- **Optimistic Locking**: Version fields for concurrent updates
- **Row Level Security**: User-based access control

## Security Architecture

### Authentication & Authorization

- **JWT Tokens**: Short-lived access tokens (15 minutes)
- **Refresh Tokens**: Long-lived refresh tokens (7 days)
- **Session Management**: Redis-backed sessions
- **Role-Based Access**: User roles and permissions

### Data Protection

- **Encryption at Rest**: AES-256 for sensitive fields
- **Encryption in Transit**: TLS 1.3
- **Input Validation**: Comprehensive validation
- **SQL Injection Prevention**: Parameterized queries
- **XSS Protection**: Content Security Policy
- **CSRF Protection**: CSRF tokens

### Security Headers

```javascript
app.use(helmet({
  contentSecurityPolicy: true,
  crossOriginEmbedderPolicy: true,
  crossOriginOpenerPolicy: true,
  crossOriginResourcePolicy: true,
  dnsPrefetchControl: true,
  frameguard: true,
  hidePoweredBy: true,
  hsts: true,
  ieNoOpen: true,
  noSniff: true,
  originAgentCluster: true,
  permittedCrossDomainPolicies: false,
  referrerPolicy: true,
  xssFilter: true
}))
```

## API Design

### RESTful Principles

- **Resource-Based**: URLs represent resources
- **HTTP Methods**: Proper use of GET, POST, PUT, DELETE
- **Status Codes**: Appropriate HTTP status codes
- **Stateless**: No server-side session state
- **Cacheable**: Proper cache headers

### Endpoint Naming Convention

```
GET    /api/resources          # List resources
GET    /api/resources/:id      # Get single resource
POST   /api/resources          # Create resource
PUT    /api/resources/:id      # Update resource
DELETE /api/resources/:id      # Delete resource

# Special operations
POST   /api/resources/:id/action
GET    /api/resources/search
POST   /api/resources/bulk
```

### Pagination

Standard pagination parameters:

```
?page=1&limit=20&sort=created_at&order=DESC
```

### Filtering

Query parameter based filtering:

```
?status=active&category=tech&date_from=2025-01-01
```

## Development Guidelines

### Code Style

- **Linting**: ESLint with Airbnb config
- **Formatting**: Prettier
- **Type Checking**: TypeScript strict mode
- **Naming**: camelCase for variables, PascalCase for components

### Git Workflow

```bash
main
  ├── develop
  │     ├── feature/feature-name
  │     ├── bugfix/bug-description
  │     └── hotfix/critical-fix
  └── release/v1.0.0
```

### Testing Strategy

- **Unit Tests**: Jest for business logic
- **Integration Tests**: Supertest for API endpoints
- **E2E Tests**: Playwright for user flows
- **Coverage Target**: 80%

### Performance Considerations

- **Database Indexing**: Proper indexes on frequently queried fields
- **Query Optimization**: Avoid N+1 queries
- **Caching Strategy**: Redis for frequently accessed data
- **Lazy Loading**: Code splitting and lazy imports
- **Image Optimization**: WebP format with fallbacks

### Monitoring & Logging

- **Application Logs**: Winston with log levels
- **Error Tracking**: Sentry integration
- **Performance Monitoring**: Application metrics
- **Health Checks**: `/health` endpoint

## Future Considerations

### Planned Improvements

1. **GraphQL API**: Alongside REST for flexible queries
2. **Microservices**: Split into smaller services
3. **Event-Driven**: Message queue for async operations
4. **Real-time Updates**: WebSockets for live features
5. **Full TypeScript**: Complete backend migration
6. **Kubernetes**: Container orchestration for scale

### Scalability Path

1. **Horizontal Scaling**: Load balancer with multiple instances
2. **Database Sharding**: Split data across multiple databases
3. **CDN Integration**: Static asset delivery
4. **Queue System**: Background job processing
5. **Caching Layer**: Distributed cache with Redis Cluster

---

*Last Updated: August 2025*