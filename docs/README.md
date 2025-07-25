# Career Navigator Documentation

Welcome to the Career Navigator documentation. This comprehensive guide covers everything from getting started to advanced development and deployment.

## 📖 Documentation Overview

Career Navigator is an AI-powered career development platform that helps professionals:
- 🧭 Explore career paths with AI guidance
- 📝 Build compelling professional narratives
- 🎯 Track and manage career experiences
- 🤝 Network strategically (coming soon)

## 🚀 Quick Start

### For Users
- [**Getting Started Guide**](./guides/getting-started.md) - Start using Career Navigator in minutes
- [**User Manual**](./guides/user-manual.md) - Complete user documentation
- [**FAQ**](./guides/faq.md) - Frequently asked questions

### For Developers
- [**Development Setup**](./development/setup.md) - Set up your development environment
- [**Architecture Overview**](./architecture/system-overview.md) - Understand the system design
- [**Contributing Guide**](./development/contributing/CONTRIBUTING.md) - How to contribute

### For Administrators
- [**Docker Deployment**](./deployment/docker/docker-deployment.md) - Production deployment
- [**Configuration Guide**](./guides/configuration.md) - System configuration
- [**Security Guide**](./deployment/security/security-procedures.md) - Security best practices

## 📚 Complete Documentation

### 1. Architecture & Design
- [**System Architecture**](./architecture/system-overview.md) - High-level system design and components
- [**Multi-User Architecture**](./architecture/multi-user-architecture.md) - User isolation and data privacy
- [**Database Design**](./architecture/database-design.md) - Schema design and data models
- [**Security Architecture**](./architecture/security-architecture.md) - Security implementation details
- [**Frontend Architecture**](./architecture/frontend-architecture.md) - React application structure

### 2. Features Documentation
- [**Core Features Overview**](./features/README.md) - All platform capabilities
  - [Career Exploration](./features/career-exploration.md) - AI-powered career discovery
  - [Experience Management](./features/experience-management.md) - Professional experience tracking
  - [Story Development](./features/story-development.md) - Resume and narrative building
  - [AI Chat Assistant](./features/ai-chat-assistant.md) - Intelligent career guidance
- [**Add-on Modules**](./features/addons.md) - Extended functionality
  - [CPA PERT Writer](./addons/cpa-pert-writer/README.md) - Specialized accounting module

### 3. API Documentation
- [**REST API Reference**](./api/rest-api.md) - Complete API documentation
- [**Authentication API**](./api/authentication.md) - Auth endpoints and flows
- [**Experience API**](./api/experience-api.md) - Experience management endpoints
- [**Chat API**](./api/chat-api.md) - AI chat integration
- [**MCP Integration**](./api/mcp-integration.md) - Model Context Protocol details

### 4. Development Guide
- [**Development Setup**](./development/setup.md) - Local development environment
- [**Code Architecture**](./development/code-architecture.md) - Code organization and patterns
- [**Backend Development**](./development/backend-guide.md) - Node.js/Express development
- [**Frontend Development**](./development/frontend-guide.md) - React/TypeScript development
- [**Testing Guide**](./development/testing.md) - Testing strategies and execution
- [**Contributing**](./development/contributing/CONTRIBUTING.md) - Contribution guidelines

### 5. Deployment & Operations
- [**Deployment Overview**](./deployment/README.md) - Deployment options and strategies
- [**Docker Deployment**](./deployment/docker/docker-deployment.md) - Container-based deployment
- [**Cloud Deployment**](./deployment/cloud-deployment.md) - AWS, GCP, Azure guides
- [**Database Setup**](./deployment/database-setup.md) - Oracle ATP configuration
- [**Security Procedures**](./deployment/security/security-procedures.md) - Security hardening
- [**Monitoring & Logging**](./deployment/monitoring.md) - Observability setup

### 6. User Guides
- [**Getting Started**](./guides/getting-started.md) - First steps with Career Navigator
- [**User Manual**](./guides/user-manual.md) - Detailed feature documentation
- [**Career Planning Guide**](./guides/career-planning.md) - Using AI for career decisions
- [**Experience Writing**](./guides/experience-writing.md) - Crafting compelling experiences
- [**Privacy Guide**](./guides/privacy-guide.md) - Understanding data privacy

### 7. Administrator Guides
- [**Admin Overview**](./guides/admin-guide.md) - System administration
- [**Configuration**](./guides/configuration.md) - Environment and system setup
- [**User Management**](./guides/user-management.md) - Managing users and access
- [**Backup & Recovery**](./guides/backup-recovery.md) - Data protection strategies
- [**Troubleshooting**](./guides/troubleshooting.md) - Common issues and solutions

### 8. Add-ons & Extensions
- [**Add-ons Overview**](./addons/README.md) - Available modules
- [**CPA PERT Writer**](./addons/cpa-pert-writer/README.md) - CPA experience reporting
  - [User Guide](./addons/cpa-pert-writer/docs/user-guide.md)
  - [Integration Guide](./addons/cpa-pert-writer/docs/integration.md)
- [**Extension Development**](./guides/extension-development.md) - Building custom modules

## 🏗️ Project Structure

```
career-navigator/
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

Career Navigator prioritizes data security and user privacy:
- **Data Isolation**: Complete user data separation
- **Encryption**: AES-256 for sensitive data
- **Authentication**: JWT with short-lived tokens
- **Audit Trail**: Comprehensive activity logging
- **Compliance**: HIPAA-level security standards

Learn more in our [Security Architecture](./architecture/security-architecture.md) documentation.

## 🤝 Contributing

We welcome contributions! See our [Contributing Guide](./guides/contributing-guide.md) for:
- Code contribution guidelines
- Documentation improvements
- Bug reporting procedures
- Feature request process

## 📞 Support

- **Documentation Issues**: Submit a GitHub issue
- **Bug Reports**: Use the bug report template
- **Feature Requests**: Use the feature request template
- **Security Issues**: Email security@career-navigator.com

## 🔄 Version History

- **v1.0.0** (Current) - Initial release with core features
- See [CHANGELOG.md](../CHANGELOG.md) for detailed version history

---

*Last updated: December 2024*