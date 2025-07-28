# Project Structure

Pathfinder follows a modern monorepo architecture with clear separation between frontend and backend services.

## Directory Structure

```
pathfinder/
├── frontend/                    # React TypeScript frontend application
│   ├── src/
│   │   ├── components/         # Reusable UI components
│   │   │   ├── ui/            # Base UI components (buttons, inputs, cards)
│   │   │   ├── layout/        # Layout components (header, sidebar, footer)
│   │   │   ├── auth/          # Authentication-related components
│   │   │   ├── chat/          # Chat interface components
│   │   │   ├── experience/    # Experience management components
│   │   │   └── profile/       # Profile and dashboard components
│   │   ├── features/          # Feature-based modules
│   │   ├── hooks/             # Custom React hooks
│   │   ├── lib/               # Utility functions and helpers
│   │   ├── pages/             # Route-based page components
│   │   ├── services/          # API service layer
│   │   ├── stores/            # Zustand state management
│   │   ├── types/             # TypeScript type definitions
│   │   ├── App.tsx            # Main application component
│   │   ├── main.tsx           # Application entry point
│   │   └── index.css          # Global styles with Tailwind
│   ├── public/                # Static assets
│   ├── Dockerfile             # Frontend container configuration
│   ├── nginx.conf             # Nginx configuration for production
│   ├── package.json           # Frontend dependencies
│   ├── tailwind.config.js     # Tailwind CSS configuration
│   ├── tsconfig.json          # TypeScript configuration
│   └── vite.config.ts         # Vite build configuration
│
├── backend/                    # Node.js backend services
│   ├── src/
│   │   ├── api/               # REST API server
│   │   │   ├── routes/        # API route definitions
│   │   │   ├── middleware/    # Express middleware (auth, validation, etc.)
│   │   │   ├── controllers/   # Route controllers
│   │   │   └── index.js       # Main API server entry point
│   │   ├── services/          # Business logic and services
│   │   │   ├── database.js    # Database connection manager
│   │   │   ├── encryption.js  # Encryption service
│   │   │   ├── mcp-server.js  # Model Context Protocol server
│   │   │   ├── rate-limiter.js # Rate limiting service
│   │   │   ├── security-audit.js # Security audit service
│   │   │   ├── compliance-monitor.js # Compliance monitoring
│   │   │   └── data-retention.js # Data retention policies
│   │   ├── database/          # Database-related files
│   │   │   ├── migrations/    # Schema migration scripts
│   │   │   ├── seeds/         # Seed data scripts
│   │   │   └── queries/       # SQL query templates
│   │   ├── config/            # Configuration files
│   │   │   └── index.js       # Main configuration loader
│   │   └── utils/             # Utility functions
│   │       ├── db-health-check.js
│   │       ├── test-connections.js
│   │       └── security/      # Security utilities
│   ├── tests/                 # Test suites
│   │   ├── unit/              # Unit tests
│   │   ├── integration/       # Integration tests
│   │   └── e2e/               # End-to-end tests
│   ├── Dockerfile             # Backend container configuration
│   ├── docker-entrypoint.sh   # Docker startup script
│   ├── package.json           # Backend dependencies
│   └── .env.example           # Environment variable template
│
├── nginx/                      # Nginx reverse proxy configuration
│   └── nginx.conf             # Main nginx configuration
│
├── docs/                       # Project documentation
│   ├── deployment/            # Deployment guides
│   ├── development/           # Development documentation
│   ├── platform/              # Platform features
│   ├── user-guides/           # User documentation
│   └── addons/                # Add-on module documentation
│
├── wallets/                    # Oracle wallet files (gitignored)
├── logs/                       # Application logs (gitignored)
│
├── docker-compose.yml          # Docker orchestration configuration
├── package.json                # Root package.json with npm workspaces
├── .env.example                # Root environment variable template
├── CLAUDE.md                   # Claude Code guidance
├── README.md                   # Project README
└── LICENSE                     # MIT License
```

## Key Design Decisions

### 1. Monorepo with NPM Workspaces
- Simplifies dependency management
- Enables shared TypeScript types between frontend and backend
- Single command to run both services in development

### 2. Clear Frontend/Backend Separation
- Frontend is a standalone React SPA
- Backend provides REST API and MCP server
- Communication via well-defined API contracts

### 3. Service-Oriented Backend Architecture
- Business logic separated into services
- Database operations abstracted through DatabaseManager
- Clean separation of concerns

### 4. Docker-First Deployment
- Consistent development and production environments
- Easy scaling with docker-compose
- Built-in health checks and monitoring

### 5. Security at Every Layer
- Frontend: Input validation, XSS protection
- API: Authentication, authorization, rate limiting
- Database: Encrypted fields, user isolation
- Infrastructure: HTTPS, security headers

## File Naming Conventions

### Frontend (TypeScript/React)
- Components: PascalCase (e.g., `UserProfile.tsx`)
- Utilities: camelCase (e.g., `formatDate.ts`)
- Types: PascalCase with `.types.ts` extension
- Tests: Same name with `.test.tsx` or `.spec.tsx`

### Backend (JavaScript/Node.js)
- Services: kebab-case (e.g., `database-manager.js`)
- Routes: kebab-case (e.g., `auth-routes.js`)
- Utilities: kebab-case (e.g., `encrypt-field.js`)
- Tests: Same name with `.test.js` or `.spec.js`

## Import Path Conventions

### Frontend
```typescript
// Absolute imports using @ alias
import { Button } from '@/components/ui/button'
import { authStore } from '@/stores/authStore'
import type { User } from '@/types'
```

### Backend
```javascript
// Relative imports from src
const DatabaseManager = require('../services/database');
const config = require('../config');
```

## Environment Configuration

### Development
- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:3000`
- MCP Server: `http://localhost:3001`

### Production
- All services behind Nginx reverse proxy
- HTTPS enforced
- API at `/api` path
- Frontend at root path

## Build Outputs

### Frontend Build
```
frontend/dist/
├── assets/           # Bundled JS/CSS with hashes
├── index.html        # Main HTML entry
└── favicon.ico       # Favicon
```

### Backend Build
Backend runs directly from source in production (no build step required).

## Testing Structure

### Frontend Tests
- Unit tests for components and utilities
- Integration tests for page flows
- E2E tests with Playwright (planned)

### Backend Tests
- Unit tests for services and utilities
- Integration tests for API endpoints
- E2E tests for full system flows

## Deployment Artifacts

### Docker Images
- `pathfinder-frontend`: Nginx serving built React app
- `pathfinder-backend`: Node.js API server
- `pathfinder-nginx`: Reverse proxy (production only)

### Volumes
- `redis-data`: Redis persistence
- `logs`: Application logs
- `wallets`: Oracle connection wallets