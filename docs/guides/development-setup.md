# Development Setup Guide

## Prerequisites

Before starting, ensure you have the following installed:

- **Node.js** (v18 or higher)
- **npm** (v9 or higher)
- **Docker** and **Docker Compose**
- **Git**
- **Oracle Instant Client** (for database connectivity)

## Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/your-org/pathfinder.git
cd pathfinder
```

### 2. Install Dependencies

The project uses npm workspaces for monorepo management:

```bash
# Install all dependencies (frontend + backend)
npm run install:all
```

### 3. Environment Configuration

```bash
# Copy environment template
cp .env.example .env

# Edit .env with your configuration
# Key variables to configure:
# - DATABASE_URL (Oracle ATP connection string)
# - JWT_SECRET (generate with: openssl rand -hex 32)
# - ENABLE_FIELD_ENCRYPTION=true
# - API_PORT=3000
# - FRONTEND_PORT=5173
```

### 4. Database Setup

#### Option A: Using Oracle Cloud ATP
1. Create an Oracle Cloud account
2. Provision an Autonomous Database
3. Download wallet files to `backend/wallets/`
4. Update DATABASE_URL in `.env`

#### Option B: Using Docker (Development Only)
```bash
# Start Oracle XE container
docker-compose up -d oracle-xe

# Wait for database to initialize (check logs)
docker-compose logs -f oracle-xe
```

### 5. Run Database Migrations

```bash
# Run migrations
npm run db:migrate

# Seed test data (optional)
npm run db:seed
```

### 6. Start Development Servers

```bash
# Start both frontend and backend
npm run dev

# Or start separately:
npm run backend:dev   # Backend on http://localhost:3000
npm run frontend:dev  # Frontend on http://localhost:5173
```

## Development Workflow

### Project Structure

```
pathfinder/
├── frontend/                # React TypeScript application
│   ├── src/
│   │   ├── components/     # UI components
│   │   ├── pages/          # Route pages
│   │   ├── stores/         # Zustand state management
│   │   ├── services/       # API services
│   │   └── types/          # TypeScript types
│   └── package.json
│
├── backend/                 # Node.js backend
│   ├── src/
│   │   ├── api/            # REST API routes
│   │   ├── services/       # Business logic
│   │   ├── database/       # Database layer
│   │   ├── config/         # Configuration
│   │   └── utils/          # Utilities
│   └── package.json
│
└── docs/                    # Documentation
```

### Available Scripts

```bash
# Development
npm run dev              # Start all services
npm run backend:dev      # Start backend only
npm run frontend:dev     # Start frontend only

# Database
npm run db:migrate       # Run migrations
npm run db:rollback      # Rollback last migration
npm run db:seed          # Seed test data
npm run db:reset         # Reset database

# Testing
npm run test             # Run all tests
npm run test:unit        # Unit tests only
npm run test:integration # Integration tests
npm run test:e2e         # End-to-end tests

# Code Quality
npm run lint             # Lint all code
npm run lint:fix         # Fix linting issues
npm run typecheck        # TypeScript type checking
npm run format           # Format code with Prettier

# Building
npm run build            # Build for production
npm run preview          # Preview production build
```

## Development Tools

### VS Code Extensions

Recommended extensions for development:
- ESLint
- Prettier
- TypeScript and JavaScript Language Features
- Tailwind CSS IntelliSense
- Docker
- Oracle Developer Tools for VS Code

### Debugging

#### Backend Debugging
```json
// .vscode/launch.json
{
  "type": "node",
  "request": "launch",
  "name": "Debug Backend",
  "program": "${workspaceFolder}/backend/src/server.js",
  "envFile": "${workspaceFolder}/.env"
}
```

#### Frontend Debugging
- Use React Developer Tools browser extension
- Enable source maps in development

### Testing

#### Unit Tests
```bash
# Run with coverage
npm run test:unit -- --coverage

# Watch mode
npm run test:unit -- --watch
```

#### Integration Tests
```bash
# Requires database connection
npm run test:integration
```

#### E2E Tests
```bash
# Start services first
npm run dev

# In another terminal
npm run test:e2e
```

## Common Development Tasks

### Adding a New API Endpoint

1. Create controller in `backend/src/api/controllers/`
2. Create service in `backend/src/services/`
3. Add route in `backend/src/api/routes/`
4. Update API documentation
5. Add tests

### Adding a New Frontend Component

1. Create component in `frontend/src/components/`
2. Add TypeScript types in `frontend/src/types/`
3. Create service if needed in `frontend/src/services/`
4. Add tests
5. Update Storybook stories (if applicable)

### Database Schema Changes

1. Create migration file:
```bash
npm run db:migration:create -- add_new_table
```

2. Edit migration in `backend/src/database/migrations/`
3. Run migration:
```bash
npm run db:migrate
```

## Troubleshooting

### Common Issues

#### Port Already in Use
```bash
# Find process using port
lsof -i :3000

# Kill process
kill -9 <PID>
```

#### Database Connection Issues
- Check Oracle Instant Client installation
- Verify wallet files in `backend/wallets/`
- Test connection with sqlplus

#### Frontend Build Issues
```bash
# Clear cache
rm -rf frontend/node_modules/.cache
npm run frontend:dev
```

### Getting Help

- Check [Troubleshooting Guide](./troubleshooting.md)
- Review existing GitHub issues
- Join our Discord community
- Contact the development team

## Next Steps

- Review [Architecture Documentation](../architecture/README.md)
- Read [Contributing Guide](./contributing-guide.md)
- Explore [API Documentation](../api/README.md)
- Check [Security Best Practices](../deployment/security/security-procedures.md)