# Project Documentation Structure

## Documentation Organization

```
docs/
├── README.md                 # Project overview and quick start
├── architecture.md           # System architecture and flow diagrams
├── data-structure.md         # Database schema and data models
├── api/
│   ├── rest-api.md          # REST API documentation
│   ├── mcp-server.md        # MCP server implementation
│   └── websocket-api.md     # Real-time chat API
├── components/
│   ├── career-navigator.md  # Career planning module
│   ├── experience-manager.md # Experience storage and management
│   └── llm-integration.md   # LLM integration patterns
├── deployment/
│   ├── docker-setup.md      # Containerization setup
│   ├── database-setup.md    # Database configuration
│   └── environment.md       # Environment variables
├── security/
│   ├── authentication.md    # User authentication strategy
│   ├── data-privacy.md      # Data protection and privacy
│   └── api-security.md      # API security measures
├── development/
│   ├── getting-started.md   # Development environment setup
│   ├── contributing.md      # Contribution guidelines
│   └── testing.md           # Testing strategy and setup
└── user-guides/
    ├── career-planning.md   # How to use career navigator
    ├── experience-input.md  # Guide for entering experiences
    └── resume-generation.md # Using the system for resume building
```

## Core Components Documentation

### 1. Career Navigator (`docs/components/career-navigator.md`)
- Interactive chat interface design
- LLM prompt engineering for career guidance
- Context management and conversation flow
- Integration with user experience data

### 2. Experience Manager (`docs/components/experience-manager.md`)
- Experience input and validation
- Skill extraction algorithms
- Role mapping logic
- Data aggregation processes

### 3. LLM Integration (`docs/components/llm-integration.md`)
- Model selection and configuration
- Prompt templates and optimization
- Context window management
- Response processing and validation

## API Documentation Structure

### REST API (`docs/api/rest-api.md`)
```
Endpoints:
- POST /api/v1/experiences          # Create new experience
- GET /api/v1/experiences           # List user experiences
- PUT /api/v1/experiences/:id       # Update experience
- DELETE /api/v1/experiences/:id    # Delete experience
- GET /api/v1/profile/summary       # Get profile summary
- POST /api/v1/career/analyze       # Analyze career path
- GET /api/v1/skills/suggestions    # Get skill suggestions
```

### MCP Server (`docs/api/mcp-server.md`)
```
MCP Tools:
- get_user_profile()               # Retrieve user profile
- get_experience_details()         # Get specific experience
- search_experiences()             # Search user experiences
- get_career_suggestions()         # Get career recommendations
- update_user_context()            # Update conversation context
```

## Database Documentation

### Schema Evolution (`docs/data-structure.md`)
- Migration scripts and versioning
- Index optimization strategies
- Query performance guidelines
- Data retention policies

## Security Documentation Structure

### Authentication (`docs/security/authentication.md`)
- JWT token management
- OAuth integration options
- Session handling
- Multi-factor authentication

### Data Privacy (`docs/security/data-privacy.md`)
- GDPR compliance measures
- Data encryption at rest and in transit
- User consent management
- Data anonymization strategies

### API Security (`docs/security/api-security.md`)
- Rate limiting implementation
- Input validation and sanitization
- CORS configuration
- Security headers and middleware

## Development Workflow

### Getting Started (`docs/development/getting-started.md`)
```bash
# Development setup commands
npm install                    # Install dependencies
npm run db:setup              # Setup database
npm run db:migrate            # Run migrations
npm run db:seed               # Seed test data
npm run dev                   # Start development server
npm run test                  # Run test suite
npm run lint                  # Code linting
npm run type-check            # TypeScript checking
```

### Testing Strategy (`docs/development/testing.md`)
- Unit testing with Jest
- Integration testing for API endpoints
- E2E testing with Playwright
- Database testing with test containers
- LLM response testing and validation

## User Guide Structure

### Career Planning Guide (`docs/user-guides/career-planning.md`)
- How to start a career conversation
- Understanding AI recommendations
- Setting and tracking career goals
- Interpreting skill gap analysis

### Experience Input Guide (`docs/user-guides/experience-input.md`)
- Best practices for describing experiences
- Maximizing skill extraction accuracy
- Adding quantifiable achievements
- Organizing different experience types

### Resume Generation (`docs/user-guides/resume-generation.md`)
- Tailoring resumes for specific roles
- Using AI-generated content
- Customizing experience descriptions
- Export formats and options