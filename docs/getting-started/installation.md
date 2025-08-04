# Installation Guide

This guide provides detailed instructions for installing Pathfinder on your local development environment.

## System Requirements

### Minimum Requirements
- **Node.js**: 18.0.0 or higher
- **npm**: 8.0.0 or higher
- **RAM**: 4GB minimum
- **Disk Space**: 10GB free space
- **OS**: Windows 10+, macOS 10.15+, or Linux (Ubuntu 20.04+)

### Recommended Requirements
- **RAM**: 8GB or more
- **CPU**: 4 cores or more
- **SSD**: For better performance

## Prerequisites

### 1. Node.js and npm
```bash
# Check if Node.js is installed
node --version

# Check if npm is installed
npm --version

# Install Node.js if needed
# Visit: https://nodejs.org/
```

### 2. Docker (Optional but Recommended)
```bash
# Check if Docker is installed
docker --version
docker-compose --version

# Install Docker if needed
# Visit: https://docs.docker.com/get-docker/
```

### 3. Git
```bash
# Check if Git is installed
git --version

# Install Git if needed
# Visit: https://git-scm.com/downloads
```

### 4. Oracle Instant Client (For Database)
Download from Oracle's website based on your OS:
- [Oracle Instant Client Downloads](https://www.oracle.com/database/technologies/instant-client/downloads.html)

## Installation Steps

### 1. Clone the Repository

```bash
# Clone via HTTPS
git clone https://github.com/czhaoca/pathfinder.git

# Or clone via SSH
git clone git@github.com:czhaoca/pathfinder.git

# Navigate to project directory
cd pathfinder
```

### 2. Install Dependencies

```bash
# Install all dependencies (frontend + backend)
npm run install:all

# This is equivalent to:
# npm install
# cd backend && npm install
# cd ../frontend && npm install
```

### 3. Environment Configuration

#### Create Environment Files
```bash
# Copy environment templates
cp .env.example .env
cp frontend/.env.example frontend/.env
cp backend/.env.example backend/.env
```

#### Configure Root Environment (.env)
```env
NODE_ENV=development
LOG_LEVEL=debug
```

#### Configure Backend Environment (backend/.env)
```env
# Server Configuration
API_PORT=3000
NODE_ENV=development

# Database Configuration
DB_USER=your_oracle_username
DB_PASSWORD=your_oracle_password
DB_CONNECTION_STRING=(DESCRIPTION=(ADDRESS=(PROTOCOL=TCP)(HOST=your-host)(PORT=1521))(CONNECT_DATA=(SERVICE_NAME=your-service)))
DB_POOL_MIN=2
DB_POOL_MAX=10
DB_POOL_INCREMENT=1

# Security
JWT_SECRET=your-super-secret-jwt-key-at-least-32-characters-long
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d
ENABLE_FIELD_ENCRYPTION=true

# API Keys
OPENAI_API_KEY=your-openai-api-key

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:5173

# MCP Server
MCP_SERVER_PORT=3001
```

#### Configure Frontend Environment (frontend/.env)
```env
# API Configuration
VITE_API_URL=http://localhost:3000/api

# Feature Flags
VITE_ENABLE_ANALYTICS=true
VITE_ENABLE_CHAT=true
```

### 4. Database Setup

#### Option A: Using Existing Oracle Database
1. Ensure you have access to an Oracle database
2. Update the connection string in `backend/.env`
3. Run migrations:
```bash
npm run db:migrate
```

#### Option B: Using Oracle Cloud Free Tier
1. Sign up for [Oracle Cloud Free Tier](https://www.oracle.com/cloud/free/)
2. Create an Autonomous Database
3. Download the wallet files
4. Configure connection in `backend/.env`

### 5. Verify Installation

```bash
# Check backend setup
cd backend
npm run test:connection

# Check frontend setup
cd ../frontend
npm run type-check
```

## Running the Application

### Development Mode

```bash
# From project root
npm run dev

# This starts:
# - Backend at http://localhost:3000
# - Frontend at http://localhost:5173
```

### Using Docker

```bash
# Build and start containers
npm run dev:docker

# View logs
npm run docker:logs

# Stop containers
npm run docker:down
```

### Production Mode

```bash
# Build frontend
npm run frontend:build

# Start production servers
npm run prod:docker
```

## Post-Installation

### 1. Create Admin User
```bash
cd backend
npm run create:admin
```

### 2. Seed Sample Data (Optional)
```bash
npm run db:seed
```

### 3. Run Health Checks
```bash
# API health check
curl http://localhost:3000/api/health

# Database health check
npm run db:health
```

## Troubleshooting

### Common Issues

#### Port Already in Use
```bash
# Find process using port 3000
lsof -i :3000  # macOS/Linux
netstat -ano | findstr :3000  # Windows

# Kill the process or change port in .env
```

#### Database Connection Failed
- Verify Oracle Instant Client is installed
- Check database credentials
- Ensure database is accessible from your network
- Check firewall settings

#### Module Not Found Errors
```bash
# Clear node_modules and reinstall
npm run clean
npm run install:all
```

#### Permission Errors (Linux/macOS)
```bash
# Fix npm permissions
sudo chown -R $(whoami) ~/.npm
sudo chown -R $(whoami) /usr/local/lib/node_modules
```

### Getting Help

1. Check the [Troubleshooting Guide](../development/troubleshooting.md)
2. Search [GitHub Issues](https://github.com/czhaoca/pathfinder/issues)
3. Create a new issue with:
   - System information
   - Error messages
   - Steps to reproduce

## Next Steps

- [Configuration Guide](./configuration.md) - Detailed configuration options
- [Quick Start Tutorial](./quick-start.md) - Get started using Pathfinder
- [Development Setup](../development/setup.md) - Set up development environment
- [API Documentation](../api/README.md) - Explore the API