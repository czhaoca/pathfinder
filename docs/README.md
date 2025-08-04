# Pathfinder Documentation

Welcome to the Pathfinder documentation. This comprehensive guide covers everything from getting started to advanced development and deployment.

## 📖 Documentation Overview

Pathfinder is an AI-powered career development platform that helps professionals:
- 🧭 Explore career paths with AI guidance
- 📝 Build compelling professional narratives
- 🎯 Track and manage career experiences
- 🤝 Network strategically (coming soon)

## 🚀 Quick Start

### For Users
- [**Getting Started Guide**](./user-guides/getting-started/) - Start using Pathfinder in minutes
- [**Features Documentation**](./user-guides/features/) - Complete feature guides

### For Developers
- [**Development Setup**](./technical/development/development-setup.md) - Set up your development environment
- [**Architecture Overview**](./reference/architecture/system-overview.md) - Understand the system design
- [**Contributing Guide**](./technical/development/contributing-guide.md) - How to contribute

### For Administrators
- [**Docker Deployment**](./technical/deployment/docker-deployment.md) - Production deployment
- [**Security Guide**](./technical/security/security-procedures.md) - Security best practices

## 📚 Complete Documentation

### 1. Reference Documentation
#### Architecture & Design
- [**System Architecture**](./reference/architecture/system-overview.md) - High-level system design and components
- [**Multi-User Architecture**](./reference/architecture/multi-user-architecture.md) - User isolation and data privacy
- [**Database Design**](./reference/architecture/database-design.md) - Schema design and data models
- [**Security Architecture**](./reference/architecture/security-architecture.md) - Security implementation details
- [**Frontend Architecture**](./reference/architecture/frontend-architecture.md) - React application structure

#### API Documentation
- [**REST API Reference**](./reference/api/rest-api.md) - Complete API documentation
- [**Experience API**](./reference/api/experience-endpoints.md) - Experience management endpoints
- [**Career Path API**](./reference/api/career-path-endpoints.md) - Career planning endpoints
- [**Analytics API**](./reference/api/analytics-endpoints.md) - Analytics and reporting
- [**Resume API**](./reference/api/resume-endpoints.md) - Resume generation endpoints

#### Database Documentation
- [**Database Schema**](./reference/database/) - Complete schema documentation
- [**Entity Relationships**](./reference/database/diagrams/) - ERD diagrams
- [**Multi-User Schema**](./reference/database/multi-user-architecture.md) - User isolation patterns
- [**Security Model**](./reference/database/security-encryption-model.md) - Encryption and security

### 2. User Guides
- [**Core Features**](./user-guides/features/README.md) - All platform capabilities
  - [Career Exploration](./user-guides/features/career-exploration.md) - AI-powered career discovery
  - [Experience Management](./user-guides/features/experience-management.md) - Professional experience tracking
  - [Story Development](./user-guides/features/story-development.md) - Resume and narrative building
  - [AI Chat Assistant](./user-guides/features/ai-chat-assistant.md) - Intelligent career guidance
  - [Professional Networking](./user-guides/features/professional-networking.md) - Network management
  - [Job Search Integration](./user-guides/features/job-search-integration.md) - Job search tools
  - [Learning Development](./user-guides/features/learning-development.md) - Skill development paths

### 3. Technical Documentation
#### Development
- [**Development Setup**](./technical/development/development-setup.md) - Local development environment
- [**Getting Started**](./technical/development/getting-started.md) - Developer quick start
- [**Contributing Guide**](./technical/development/contributing-guide.md) - Contribution guidelines
- [**Troubleshooting**](./technical/development/troubleshooting.md) - Common issues
- [**Mermaid Diagrams**](./technical/development/mermaid-diagrams.md) - Creating diagrams

#### Deployment
- [**Docker Deployment**](./technical/deployment/docker-deployment.md) - Container-based deployment
- [**MCP Configuration**](./technical/deployment/mcp-configuration.md) - Model Context Protocol setup
- [**OCI Database Setup**](./technical/deployment/oci-provisioning-guide.md) - Oracle Cloud setup
- [**Multi-Project Database**](./technical/deployment/multi-project-database-guide.md) - Shared database patterns

#### Security
- [**Security Procedures**](./technical/security/security-procedures.md) - Security hardening
- [**BYOK Implementation**](./technical/security/byok-implementation.md) - Bring Your Own Key
- [**Encryption Specification**](./technical/security/encryption-specification.md) - Encryption details
- [**Security Compliance**](./technical/security/security-compliance.md) - Compliance standards
- [**CPA PERT Security**](./technical/security/cpa-pert-security-audit.md) - Module security audit

### 4. Project Documentation
- [**Changelog**](./project/changelog/) - Development history and updates
- [**Add-on Modules**](./project/addons/) - Specialized modules
  - [CPA PERT Writer](./project/addons/cpa-pert-writer/README.md) - Accounting module

## 🏗️ Project Structure

```
pathfinder/
├── frontend/          # React TypeScript application
├── backend/           # Node.js Express API
├── docs/              # This documentation
├── nginx/             # Reverse proxy configuration
└── docker-compose.yml # Container orchestration
```

## 🔧 Technology Stack

- **Frontend**: React, TypeScript, Tailwind CSS, Zustand
- **Backend**: Node.js, Express, TypeScript
- **Database**: Oracle Autonomous Database
- **AI Integration**: Model Context Protocol (MCP)
- **Security**: JWT, AES-256 encryption, RBAC
- **Deployment**: Docker, Docker Compose

## 📊 Key Features

### For Individuals
- ✅ AI-powered career exploration and guidance
- ✅ Professional experience management
- ✅ Dynamic resume generation
- ✅ Skills gap analysis
- ✅ Career progression tracking

### For Organizations
- ✅ Multi-user support with data isolation
- ✅ HIPAA-level security standards
- ✅ Self-hosted deployment options
- ✅ Customizable add-on modules
- ✅ Comprehensive audit logging

## 🛡️ Security & Privacy

Pathfinder prioritizes data security and user privacy:
- **Data Isolation**: Complete user data separation
- **Encryption**: AES-256 for sensitive data
- **Authentication**: JWT with short-lived tokens
- **Audit Trail**: Comprehensive activity logging
- **Compliance**: HIPAA-level security standards

Learn more in our [Security Architecture](./reference/architecture/security-architecture.md) documentation.

## 🤝 Contributing

We welcome contributions! See our [Contributing Guide](./technical/development/contributing-guide.md) for:
- Code contribution guidelines
- Documentation improvements
- Bug reporting procedures
- Feature request process

## 📞 Support

- **Documentation Issues**: Submit a GitHub issue
- **Bug Reports**: Use the bug report template
- **Feature Requests**: Use the feature request template
- **Security Issues**: Email security@pathfinder.com

## 🔄 Version History

- **v1.0.0** (Current) - Initial release with core features
- See [Changelog](./project/changelog/) for detailed version history

---

*Last updated: December 2024*