# Pathfinder - AI-Powered Career Navigation Platform

![Version](https://img.shields.io/badge/version-0.1.0--beta.1-blue.svg)
![Status](https://img.shields.io/badge/status-beta-orange.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-green.svg)
![License](https://img.shields.io/badge/license-MIT-blue.svg)

## 🚀 Overview

Pathfinder is a comprehensive AI-powered career navigation and experience management system designed to help professionals plan their career paths, manage their experiences, and achieve their professional goals. The platform leverages advanced AI capabilities to provide personalized career guidance, skill development recommendations, and professional networking opportunities.

## ✨ Features

### Core Platform Features

- **🤖 AI Career Chat**: Interactive conversational AI for personalized career guidance
- **📊 Experience Management**: 3-tier data structure for organizing professional experiences
- **🎯 Career Path Planning**: Visual career trajectory planning with skills gap analysis
- **💼 Job Search Integration**: Smart job matching with application tracking
- **📚 Learning & Development**: Course recommendations and certification tracking
- **🤝 Professional Networking**: Contact management and relationship tracking
- **📄 Resume Builder**: Dynamic resume generation with ATS optimization
- **📈 Analytics Dashboard**: Comprehensive career analytics and insights
- **🔐 Enterprise Security**: HIPAA-level data protection with user isolation

### Specialized Modules

- **CPA PERT Writer**: Accounting profession experience reporting module
- **Interview Preparation**: Practice questions and response tracking
- **Skills Assessment**: Competency evaluation and progress tracking

## 🏗️ Project Structure

```
pathfinder/
├── frontend/                # React TypeScript frontend application
│   ├── src/
│   │   ├── components/     # UI components
│   │   ├── pages/          # Route pages
│   │   ├── stores/         # Zustand state management
│   │   ├── services/       # API services
│   │   ├── types/          # TypeScript types
│   │   └── lib/            # Utilities
│   ├── public/             # Static assets
│   └── package.json
│
├── backend/                 # Node.js backend services
│   ├── src/
│   │   ├── api/            # REST API server
│   │   │   ├── routes/     # API routes
│   │   │   ├── middleware/ # Express middleware
│   │   │   └── index.js    # Main API server
│   │   ├── services/       # Business logic services
│   │   │   ├── database.js # Database manager
│   │   │   ├── encryption.js
│   │   │   └── mcp-server.js
│   │   ├── database/       # Database related
│   │   │   ├── schema/     # Table creation schemas
│   │   │   ├── seeds/      # Seed data
│   │   │   └── queries/    # SQL queries
│   │   ├── config/         # Configuration
│   │   └── utils/          # Utility functions
│   ├── tests/              # Backend tests
│   │   ├── unit/
│   │   ├── integration/
│   │   └── e2e/
│   └── package.json
│
├── nginx/                   # Nginx configuration
├── docs/                    # Documentation
├── docker-compose.yml       # Docker orchestration
└── package.json            # Root package.json with workspaces
```

## 🚦 Project Status

**Current Version**: v2.0.0-dev (In Active Development)

### Phase Completion Status

- ✅ **Phase 1: Foundation** - Complete
  - Multi-user architecture
  - Authentication system
  - Basic chat interface
  - Experience management
  - Database security

- ✅ **Phase 2: Professional Features** - Complete
  - Career Path Planning
  - Professional Networking
  - Job Search Integration
  - Learning & Development

- 🚧 **Phase 3: Enterprise & Scale** - Upcoming
  - Multi-language support
  - Team features
  - Advanced analytics
  - Mobile applications

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm 8+
- Docker and Docker Compose
- Oracle Cloud Infrastructure account (for database)

### Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/czhaoca/career-navigator.git
   cd career-navigator
   ```

2. **Install dependencies**
   ```bash
   npm run install:all
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   cp frontend/.env.example frontend/.env
   # Edit .env files with your configuration
   ```

4. **Set up database**
   ```bash
   npm run db:setup:dev
   ```

5. **Start development servers**
   ```bash
   npm run dev
   ```

   This starts both backend (http://localhost:3000) and frontend (http://localhost:5173)

### Docker Development

```bash
# Start all services in development mode
npm run dev:docker

# Or use docker-compose directly
docker-compose --profile development up
```

### Production Deployment

```bash
# Build and start production containers
npm run prod:docker

# Or use docker-compose directly
docker-compose --profile production --profile nginx up -d
```

## 🛠️ Available Scripts

### Root Level
- `npm run dev` - Start both frontend and backend in development mode
- `npm run test` - Run all tests
- `npm run lint` - Lint all code
- `npm run docker:build` - Build Docker images
- `npm run docker:up` - Start Docker containers
- `npm run docker:logs` - View container logs

### Backend Scripts
- `npm run backend:dev` - Start backend in development
- `npm run backend:start` - Start backend in production
- `npm run backend:test` - Run backend tests
- `npm run db:migrate` - Run database migrations
- `npm run mcp:start` - Start MCP server

### Frontend Scripts
- `npm run frontend:dev` - Start frontend development server
- `npm run frontend:build` - Build frontend for production
- `npm run frontend:preview` - Preview production build
- `npm run frontend:test` - Run frontend tests

## 🏛️ Architecture

### Frontend
- **Framework**: React 18 with TypeScript
- **Styling**: Tailwind CSS
- **State Management**: Zustand
- **Routing**: React Router v6
- **Build Tool**: Vite
- **UI Components**: Radix UI + custom components

### Backend
- **Runtime**: Node.js with Express
- **Database**: Oracle Autonomous Database
- **Authentication**: JWT with refresh tokens
- **Session Management**: Redis
- **Security**: Helmet, CORS, rate limiting
- **MCP Server**: Model Context Protocol for AI integration

### Infrastructure
- **Containerization**: Docker
- **Reverse Proxy**: Nginx
- **CI/CD**: GitHub Actions (planned)

## 🔒 Security Features

- JWT-based authentication with refresh tokens
- User-prefixed database schemas for data isolation
- AES-256 encryption for sensitive data
- Rate limiting and DDoS protection
- HTTPS enforcement in production
- Security headers via Helmet
- Comprehensive audit logging

## 📚 Documentation

- [Frontend Architecture](./docs/development/frontend-architecture.md)
- [Backend API Documentation](./docs/api/README.md)
- [Database Schema](./docs/database/schema.md)
- [Deployment Guide](./docs/deployment/README.md)
- [Security Procedures](./docs/deployment/security-procedures.md)

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with Claude Code assistance
- Powered by Oracle Autonomous Database
- UI components from Radix UI and Tailwind CSS