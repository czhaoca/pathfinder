# Quick Start Guide

Get Pathfinder up and running in under 5 minutes with this quick start guide.

## Prerequisites

- Node.js 18+ and npm 8+
- Docker and Docker Compose
- Git

## 1. Clone the Repository

```bash
git clone https://github.com/czhaoca/pathfinder.git
cd pathfinder
```

## 2. Install Dependencies

```bash
npm run install:all
```

This installs dependencies for both frontend and backend using npm workspaces.

## 3. Configure Environment

```bash
# Copy environment templates
cp .env.example .env
cp frontend/.env.example frontend/.env
cp backend/.env.example backend/.env

# Edit the .env files with your configuration
```

### Minimal Configuration

At minimum, you need to set:

**Root `.env`:**
```env
NODE_ENV=development
```

**Backend `.env`:**
```env
# Database
DB_USER=your_oracle_user
DB_PASSWORD=your_oracle_password
DB_CONNECTION_STRING=your_oracle_connection_string

# JWT Secret
JWT_SECRET=your-secret-key-at-least-32-chars

# API Configuration
API_PORT=3000
```

**Frontend `.env`:**
```env
VITE_API_URL=http://localhost:3000/api
```

## 4. Start Development Servers

```bash
npm run dev
```

This starts:
- Backend API server at http://localhost:3000
- Frontend dev server at http://localhost:5173

## 5. Access the Application

1. Open http://localhost:5173 in your browser
2. Click "Register" to create a new account
3. Start exploring your career path!

## Next Steps

- [Detailed Installation Guide](./installation.md)
- [Configuration Reference](./configuration.md)
- [Feature Overview](../features/README.md)
- [API Documentation](../api/README.md)

## Using Docker (Alternative)

For a containerized setup:

```bash
# Start all services
npm run dev:docker

# View logs
npm run docker:logs

# Stop services
npm run docker:down
```

## Common Issues

### Port Already in Use
If port 3000 or 5173 is already in use:
```bash
# Change ports in .env files
API_PORT=3001  # backend/.env
```

### Database Connection Failed
Ensure your Oracle database is accessible and credentials are correct.

### Missing Dependencies
```bash
# Clean install
npm run clean
npm run install:all
```

## Getting Help

- Check [Troubleshooting Guide](../development/troubleshooting.md)
- Review [GitHub Issues](https://github.com/czhaoca/pathfinder/issues)
- Contact support team