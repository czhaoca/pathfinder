# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a comprehensive AI-powered career navigation and experience management system that has evolved beyond its original CPA PERT reporting focus. The system now provides:

1. **Career Navigator**: Interactive LLM-based chatbot for career planning and guidance
2. **Experience Management**: 3-tier data structure for storing and organizing user experiences
3. **MCP Integration**: Model Context Protocol server for contextual AI conversations

## System Architecture

The system follows a multi-layered, multi-user architecture:

- **Frontend**: Web-based chat interface for user interactions
- **Application Layer**: Career Navigator and Experience Story Manager
- **LLM Integration**: Authenticated Large Language Model with MCP server for context management
- **Data Layer**: Multi-user 3-tier experience database with user-prefixed schema isolation
- **Security Layer**: JWT authentication, encryption, and HIPAA-compliant data protection

See `docs/development/multi-user-architecture.md` for detailed system diagrams and data flow.

## Database Structure

### Multi-User Architecture with HIPAA-Level Security

The system implements a **user-prefixed schema architecture** for complete data isolation:
- Each user gets their own database schema (e.g., `user_john_doe_experiences_detailed`)
- Complete data isolation at the database level - no cross-user data access possible
- Shared reference data in separate schema for skills, career paths, and role templates
- All user data is encrypted at rest with user-specific encryption keys

### 3-Tier Experience Model (Per User):
- **Level 1**: Detailed experiences with skills extraction and role mappings
- **Level 2**: Aggregated profile summaries with career progression analysis
- **Level 3**: Quick summaries for rapid context retrieval and resume headers

### Security & Privacy Features:
- **Authentication**: JWT-based with short-lived tokens (15 minutes)
- **Encryption**: AES-256 for sensitive fields, user-specific keys
- **Audit Logging**: All data access logged with user attribution
- **Data Isolation**: User-prefixed schemas prevent any cross-user access
- **Compliance Ready**: HIPAA-level standards for personal data protection

### Supporting Tables:
- Authentication system with MFA support
- Comprehensive audit logging for all operations
- Reference data: skills catalog, career paths, role templates
- User-specific encryption keys with rotation support

## Development Environment

### Local Development
Node.js-based project with the following key commands:

```bash
npm install              # Install dependencies
npm run db:setup         # Setup database
npm run db:migrate       # Run database migrations
npm run db:seed          # Seed test data
npm run dev              # Start development server
npm run test             # Run test suite
npm run lint             # Code linting
npm run type-check       # TypeScript checking
npm run mermaid          # Run mermaid CLI (mmdc)

# Multi-user MCP server commands
npm run mcp:start         # Start authenticated multi-user MCP server
npm run mcp:dev           # Start in development mode
npm run mcp:prod          # Start in production mode
```

### Docker Deployment (Required for Production)
The MCP and backend server **must be deployed using Docker** for production environments with proper environment separation:

```bash
# Copy environment template
cp .env.example .env

# Configure your .env file with actual values
# IMPORTANT: .env files are excluded from git and stored outside repo
# Include environment-specific database connections and table prefixing

# Development with Docker
docker-compose --profile development up -d

# Production deployment
docker-compose up -d

# Production with reverse proxy
docker-compose --profile nginx up -d
```

See `docs/deployment/docker-deployment.md` for complete Docker setup guide.

### Mermaid Diagram Workflow

When creating documentation with Mermaid diagrams:

1. **Create Mermaid source files**: Save `.mmd` files in the `assets/` folder relative to your markdown file
2. **Convert to PNG**: Use the provided scripts to generate PNG images
3. **Reference in Markdown**: Link to the PNG file, not the Mermaid code block

Example structure:
```
docs/development/
├── architecture.md
└── assets/
    ├── system-diagram.mmd    # Mermaid source
    └── system-diagram.png    # Generated PNG
```

Converting Mermaid to PNG:
```bash
# Using the bash script
./scripts/mermaid-to-png.sh docs/development/assets/system-diagram.mmd

# Using the Node.js script
node scripts/mermaid-converter.js docs/development/assets/system-diagram.mmd

# Using npm script
npm run mermaid -- -i docs/development/assets/system-diagram.mmd -o docs/development/assets/system-diagram.png
```

In your markdown file:
```markdown
![System Architecture](./assets/system-diagram.png)
```

**Important**: This project uses system Chromium on ARM architectures. The setup script automatically detects and configures the appropriate Chrome/Chromium for your system.

## Key Technologies

- **Backend**: Node.js/TypeScript with REST API
- **Database**: Oracle Autonomous Database with user-prefixed schemas for complete data isolation
- **Security**: JWT authentication, AES-256 encryption, comprehensive audit logging
- **LLM Integration**: Authenticated MCP (Model Context Protocol) server
- **Frontend**: Modern web framework (React/Vue/Svelte TBD)
- **Testing**: Jest for unit tests, Playwright for E2E

## Documentation Structure

- `docs/user-guides/` - Getting started and user documentation
- `docs/platform/` - Core features and roadmap documentation
- `docs/deployment/` - Security, MCP server, and deployment guides
- `docs/development/` - Technical architecture, data models, and developer guides
- `docs/addons/` - Industry-specific add-on modules and development

## Target Users

- Professionals seeking career guidance and planning
- Job seekers looking to optimize their experience presentation
- Career changers exploring new paths
- Anyone wanting to organize and leverage their professional experiences

## Core Features

### 🧭 Career Exploration & Mentorship
- **Career Discovery Engine**: AI-powered exploration based on interests, skills, and values
- **Intelligent Mentorship**: Personalized guidance through AI conversation
- **Skills Gap Analysis**: Development area identification for target career paths
- **Market Intelligence**: Real-time industry trends and opportunity analysis

### 📚 Story Development & Resume Building
- **Experience Mining**: Extract meaningful achievements from work history
- **Impact Quantification**: Identify and articulate measurable contributions  
- **Dynamic Resume Generation**: Tailored resumes for specific opportunities
- **ATS Optimization**: Keyword optimization for applicant tracking systems

### 🤝 Professional Networking (Future)
- **Contact Relationship Management**: Intelligent professional network tracking
- **Coffee Chat Facilitation**: AI-powered meeting planning and follow-up
- **Conversation Analytics**: Note-taking and relationship insight generation
- **Reconnection Intelligence**: Smart reminders and relationship maintenance

## Specialized Add-on Modules

### Industry-Specific Tools
Career Navigator supports discrete add-on modules for specific professional requirements. These modules are located in `addons/` and can be installed independently.

Available modules:
- `docs/addons/cpa-pert-writer/` - Accounting profession experience reporting
- Future modules for other regulated professions and industries

### Add-on Installation
```bash
# Install specific add-on modules
npm install ./docs/addons/[module-name]

# List available add-ons
ls docs/addons/
```

## Security & Privacy Guidelines

### Data Protection Standards

Career Navigator implements **HIPAA-level security standards** for protecting personal career and experience data:

1. **Complete Data Isolation**
   - User data stored in separate database schemas
   - No shared tables between users (except reference data)
   - Schema names prefixed with username (e.g., `user_john_doe_`)

2. **Authentication & Authorization**
   - JWT-based authentication with 15-minute token expiry
   - API key authentication for programmatic access
   - Multi-factor authentication (MFA) support
   - Session management with automatic timeout

3. **Encryption**
   - AES-256 encryption for sensitive fields
   - User-specific encryption keys
   - Encryption key rotation support
   - TLS 1.3 for data in transit

4. **Audit Logging**
   - All data access operations logged
   - User attribution for every action
   - Immutable audit trail
   - 7-year retention policy

5. **Access Control**
   - Role-based access control (RBAC)
   - Principle of least privilege
   - Regular access reviews
   - API rate limiting per user

### Development Security Practices

When developing features:
- **Never** store user credentials in plain text
- **Always** use parameterized queries to prevent SQL injection
- **Validate** all user input on both client and server
- **Sanitize** data before storage and display
- **Use** the audit logging system for all data operations
- **Test** authentication and authorization thoroughly
- **Review** security implications of new features

### MCP Server Authentication

The authenticated MCP server (`server/mcp-server.js`) includes built-in authentication and requires:
- Bearer token in Authorization header
- Valid JWT token from login endpoint
- Active session in database
- User account in 'active' status

Example authentication flow:
```javascript
// 1. Login to get token
const { token } = await login(username, password);

// 2. Include token in MCP requests
headers: {
  'Authorization': `Bearer ${token}`
}
```

### Environment Variables

Required for multi-user deployment:
```bash
JWT_SECRET=<64-character-hex-string>
ENABLE_FIELD_ENCRYPTION=true
ORACLE_INSTANT_CLIENT_PATH=/path/to/instantclient
```

### Multi-User Database Schema with Environment Separation

The system is designed for multi-user operation with proper development/production isolation:

**Environment-Specific Deployment:**
```bash
# Development environment
npm run db:migrate:dev
npm run db:access-control:dev
npm run mcp:dev

# Production environment  
npm run db:migrate:prod
npm run db:access-control:prod
npm run mcp:prod
```

**Key Features:**
1. **Table Prefixing**: All tables use `cn_` prefix for shared database coexistence
2. **Environment Isolation**: Separate dev/prod database connections and schemas
3. **User-Specific Schemas**: Complete data isolation with user-prefixed table names
4. **Access Control**: Role-based security with Row Level Security (RLS) policies
5. **Project Isolation**: Virtual Private Database (VPD) for multi-project environments

**Database Structure:**
- System tables: `cn_users`, `cn_user_sessions`, `cn_audit_log`
- Reference tables: `cn_ref_skills_catalog`, `cn_ref_career_paths`
- User schemas: `career_nav_username_experiences_detailed`

### Security Features (HIPAA-Level Compliance)

The system implements enterprise-grade security following the multi-user architecture roadmap:

**Phase 4 - Security Hardening (Completed):**
- Field-level encryption with AES-256-GCM for sensitive data
- Sliding-window rate limiting with Redis backend
- Comprehensive security audit logging with threat detection
- Automated suspicious activity monitoring

**Phase 5 - Compliance Management (Completed):**
- HIPAA compliance monitoring and reporting
- GDPR compliance assessment and documentation
- Automated data retention policies with legal hold support
- Real-time compliance dashboards and alerting

**Security Testing:**
```bash
# Test all security features
npm run security:audit

# Generate compliance reports
npm run compliance:hipaa-report
npm run compliance:gdpr-report

# Test data retention
npm run security:retention-cleanup
```