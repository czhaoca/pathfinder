# Development Setup Guide

This guide helps you set up a local development environment for Pathfinder with all the tools and configurations needed for productive development.

## Development Environment

### Required Tools

1. **Code Editor**
   - VS Code (recommended) with extensions:
     - ESLint
     - Prettier
     - TypeScript and JavaScript
     - Tailwind CSS IntelliSense
     - Docker
     - GitLens

2. **Browser Extensions**
   - React Developer Tools
   - Redux DevTools (for debugging Zustand)

3. **Database Tools**
   - Oracle SQL Developer or DBeaver
   - Postman or Insomnia for API testing

### VS Code Configuration

Create `.vscode/settings.json`:
```json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "eslint.validate": [
    "javascript",
    "javascriptreact",
    "typescript",
    "typescriptreact"
  ],
  "typescript.tsdk": "node_modules/typescript/lib",
  "tailwindCSS.experimental.classRegex": [
    ["cn\\(([^)]*)\\)", "[\"'`]([^\"'`]*).*?[\"'`]"]
  ]
}
```

## Project Setup

### 1. Fork and Clone

```bash
# Fork the repository on GitHub first
# Then clone your fork
git clone https://github.com/YOUR_USERNAME/pathfinder.git
cd pathfinder

# Add upstream remote
git remote add upstream https://github.com/czhaoca/pathfinder.git
```

### 2. Install Dependencies

```bash
# Install all dependencies
npm run install:all

# Verify installation
npm ls
```

### 3. Environment Configuration

Create local environment files:
```bash
# Development environment
cp .env.example .env.development.local
cp frontend/.env.example frontend/.env.development.local
cp backend/.env.example backend/.env.development.local
```

### 4. Database Setup

#### Local Oracle Database
```bash
# Run Oracle XE in Docker
docker run -d \
  --name oracle-xe \
  -p 1521:1521 \
  -e ORACLE_PWD=yourpassword \
  oracle/database:21.3.0-xe

# Wait for database to be ready (takes 5-10 minutes)
docker logs -f oracle-xe
```

#### Configure Connection
Update `backend/.env.development.local`:
```env
DB_USER=system
DB_PASSWORD=yourpassword
DB_CONNECTION_STRING=localhost:1521/XE
```

#### Run Migrations
```bash
# Create schema
npm run db:migrate:dev

# Seed development data
npm run db:seed:dev
```

### 5. Start Development Servers

```bash
# Start all services
npm run dev

# Or start individually
npm run backend:dev   # Backend only
npm run frontend:dev  # Frontend only
npm run mcp:dev      # MCP server only
```

## Development Workflow

### 1. Creating a Feature Branch

```bash
# Update main branch
git checkout main
git pull upstream main

# Create feature branch
git checkout -b feature/your-feature-name
```

### 2. Making Changes

#### Frontend Development
```bash
# Navigate to frontend
cd frontend

# Create new component
mkdir src/components/YourComponent
touch src/components/YourComponent/YourComponent.tsx
touch src/components/YourComponent/index.ts

# Run type checking
npm run type-check

# Run tests
npm test
```

#### Backend Development
```bash
# Navigate to backend
cd backend

# Create new service
touch src/services/yourService.js

# Create new route
touch src/api/routes/yourRoutes.js

# Run tests
npm test

# Test specific file
npm test -- yourService.test.js
```

### 3. Testing Your Changes

#### Unit Tests
```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

#### Integration Tests
```bash
# Backend integration tests
cd backend
npm run test:integration

# E2E tests
npm run test:e2e
```

#### Manual Testing
1. Test in multiple browsers
2. Test responsive design
3. Test error scenarios
4. Test with slow network

### 4. Code Quality

#### Linting
```bash
# Lint all code
npm run lint

# Fix auto-fixable issues
npm run lint:fix
```

#### Type Checking
```bash
# Frontend type checking
cd frontend && npm run type-check

# Backend JSDoc checking
cd backend && npm run type-check
```

### 5. Committing Changes

```bash
# Stage changes
git add .

# Commit with conventional commit message
git commit -m "feat: add new feature"
git commit -m "fix: resolve issue with X"
git commit -m "docs: update README"
git commit -m "chore: update dependencies"
```

## Debugging

### Frontend Debugging

#### Browser DevTools
1. Open React DevTools
2. Inspect component props and state
3. Use Network tab for API calls
4. Console for debugging logs

#### VS Code Debugging
Create `.vscode/launch.json`:
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "chrome",
      "request": "launch",
      "name": "Debug Frontend",
      "url": "http://localhost:5173",
      "webRoot": "${workspaceFolder}/frontend/src"
    }
  ]
}
```

### Backend Debugging

#### VS Code Debugging
Add to `.vscode/launch.json`:
```json
{
  "type": "node",
  "request": "launch",
  "name": "Debug Backend",
  "program": "${workspaceFolder}/backend/src/api/server.js",
  "envFile": "${workspaceFolder}/backend/.env.development.local"
}
```

#### Logging
```javascript
// Use the logger utility
const logger = require('../utils/logger');

logger.debug('Debug message', { data });
logger.info('Info message');
logger.error('Error message', { error });
```

### Database Debugging

```bash
# Connect to database
npm run db:console

# Run SQL queries
SELECT * FROM pf_users;

# Check query execution plan
EXPLAIN PLAN FOR
SELECT * FROM pf_user_john_experiences;
```

## Common Development Tasks

### Adding a New API Endpoint

1. Create controller in `backend/src/api/controllers/`
2. Create route in `backend/src/api/routes/`
3. Add route to `backend/src/api/app.js`
4. Create service in `backend/src/services/`
5. Add API client method in `frontend/src/services/`
6. Update TypeScript types in `frontend/src/types/`

### Adding a New Page

1. Create page component in `frontend/src/pages/`
2. Add route in `frontend/src/App.tsx`
3. Add navigation link if needed
4. Create necessary API services
5. Add state management if complex

### Database Schema Changes

1. Create migration file in `backend/src/database/migrations/`
2. Test migration locally
3. Update TypeScript types
4. Update API validators
5. Document changes

## Performance Optimization

### Frontend Performance

```bash
# Analyze bundle size
cd frontend
npm run build
npm run analyze
```

### Backend Performance

```bash
# Profile API endpoints
npm run profile

# Database query analysis
npm run db:analyze
```

## Troubleshooting

### Common Issues

#### Port Already in Use
```bash
# Kill process on port
lsof -ti:3000 | xargs kill -9  # macOS/Linux
netstat -ano | findstr :3000    # Windows
```

#### Database Connection Issues
```bash
# Test connection
cd backend
npm run test:connection

# Check Oracle client
echo $ORACLE_HOME
```

#### Module Resolution Issues
```bash
# Clear caches
rm -rf node_modules
rm package-lock.json
npm run install:all
```

### Getting Help

1. Check existing issues on GitHub
2. Ask in development chat
3. Consult team documentation
4. Create detailed bug report

## Best Practices

### Code Style
- Follow ESLint rules
- Use Prettier formatting
- Write self-documenting code
- Add JSDoc comments

### Git Workflow
- Keep commits small and focused
- Write descriptive commit messages
- Rebase before merging
- Squash related commits

### Testing
- Write tests for new features
- Maintain test coverage above 80%
- Test edge cases
- Use meaningful test descriptions

### Security
- Never commit secrets
- Validate all inputs
- Use parameterized queries
- Follow OWASP guidelines