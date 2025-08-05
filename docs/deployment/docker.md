# Docker Deployment Guide

This guide covers deploying Pathfinder using Docker containers for both development and production environments.

## Overview

Pathfinder uses Docker Compose to orchestrate multiple services:
- Frontend (React application)
- Backend API (Node.js)
- MCP Server (AI context management)
- Nginx (Reverse proxy for production)

## Prerequisites

- Docker Engine 20.10+
- Docker Compose 2.0+
- 4GB RAM available for Docker
- Oracle database connection details

## Project Structure

```
pathfinder/
├── docker-compose.yml          # Main orchestration file
├── Dockerfile.frontend         # Frontend container
├── Dockerfile.backend          # Backend container
├── nginx/
│   └── nginx.conf             # Nginx configuration
└── .env.example               # Environment template
```

## Development Deployment

### 1. Configure Environment

```bash
# Copy environment template
cp .env.example .env

# Edit .env with your configuration
nano .env
```

Required environment variables:

**For Single Database Mode:**
```env
# Database (Legacy format - still supported)
DB_USER=oracle_user
DB_PASSWORD=oracle_password
DB_CONNECTION_STRING=your_connection_string
ACTIVE_DATABASES=development  # or production

# Security
JWT_SECRET=your-secret-key-minimum-32-chars

# API Keys
OPENAI_API_KEY=sk-...
```

**For Dual Database Mode:**
```env
# Development Database
DEV_DB_USER=dev_oracle_user
DEV_DB_PASSWORD=dev_oracle_password
DEV_DB_CONNECTION_STRING=dev_connection_string
DEV_DB_WALLET_PATH=/path/to/dev/wallet

# Production Database  
PROD_DB_USER=prod_oracle_user
PROD_DB_PASSWORD=prod_oracle_password
PROD_DB_CONNECTION_STRING=prod_connection_string
PROD_DB_WALLET_PATH=/path/to/prod/wallet

# Active Databases
ACTIVE_DATABASES=both  # Enables dual database mode

# Security
JWT_SECRET=your-secret-key-minimum-32-chars

# API Keys
OPENAI_API_KEY=sk-...
```

### 2. Start Development Environment

```bash
# Start all services in development mode
npm run dev:docker

# Or using docker-compose directly
docker-compose --profile development up

# Run in background
docker-compose --profile development up -d
```

This starts:
- Frontend dev server: http://localhost:5173
- Backend API: http://localhost:3000
- MCP Server: http://localhost:3001

### 3. View Logs

```bash
# View all logs
npm run docker:logs

# View specific service logs
docker-compose logs -f backend
docker-compose logs -f frontend
```

### 4. Stop Services

```bash
# Stop all services
docker-compose down

# Stop and remove volumes
docker-compose down -v
```

## Production Deployment

### 1. Production Configuration

Create production environment file:
```bash
cp .env.example .env.production
```

Configure for production:
```env
# Production settings
NODE_ENV=production
LOG_LEVEL=info

# Security (use strong secrets)
JWT_SECRET=<generate-strong-secret>
DB_PASSWORD=<strong-password>

# Frontend URL
FRONTEND_URL=https://pathfinder.yourdomain.com
```

### 2. Build Production Images

```bash
# Build all images
docker-compose build

# Build specific service
docker-compose build frontend
docker-compose build backend
```

### 3. Start Production Stack

```bash
# Start production services with nginx
npm run prod:docker

# Or using docker-compose
docker-compose --profile production --profile nginx up -d
```

This starts:
- Nginx reverse proxy: http://localhost:80
- Backend API (internal)
- Frontend (served by Nginx)
- MCP Server (internal)

### 4. SSL/TLS Configuration

For HTTPS, update `nginx/nginx.conf`:

```nginx
server {
    listen 443 ssl http2;
    server_name pathfinder.yourdomain.com;

    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
    
    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    
    # ... rest of configuration
}
```

Mount certificates in docker-compose.yml:
```yaml
nginx:
  volumes:
    - ./ssl:/etc/nginx/ssl:ro
```

## Docker Compose Configuration

### Service Definitions

```yaml
version: '3.8'

services:
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    profiles: ["development", "production"]
    environment:
      - VITE_API_URL=${VITE_API_URL}
    ports:
      - "5173:5173"  # Development only
    
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    profiles: ["development", "production"]
    environment:
      - NODE_ENV=${NODE_ENV}
      - DB_USER=${DB_USER}
      - DB_PASSWORD=${DB_PASSWORD}
    ports:
      - "3000:3000"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      
  nginx:
    image: nginx:alpine
    profiles: ["nginx"]
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
    depends_on:
      - frontend
      - backend
```

## Dual Database Configuration

### Overview

Pathfinder supports running with connections to both development and production databases simultaneously. This allows for:
- Easy data comparison between environments
- Gradual migration from dev to prod
- Testing production features with development data
- Data synchronization capabilities

### Configuration Modes

**1. Single Database Mode (Default)**
- Uses traditional `DB_*` environment variables
- Connects to one database based on `NODE_ENV`
- Set `ACTIVE_DATABASES=development` or `ACTIVE_DATABASES=production`

**2. Dual Database Mode**
- Uses `DEV_DB_*` and `PROD_DB_*` environment variables
- Maintains connections to both databases
- Set `ACTIVE_DATABASES=both`
- Allows cross-environment operations

### Using Dual Database Mode

1. **Configure Both Databases**
```bash
# .env file
ACTIVE_DATABASES=both

# Development
DEV_DB_USER=admin_dev
DEV_DB_PASSWORD=dev_password
DEV_DB_CONNECTION_STRING=dev.oracle.cloud/service
DEV_DB_WALLET_PATH=./wallets/dev

# Production
PROD_DB_USER=admin_prod  
PROD_DB_PASSWORD=prod_password
PROD_DB_CONNECTION_STRING=prod.oracle.cloud/service
PROD_DB_WALLET_PATH=./wallets/prod
```

2. **Database Sync Utility**
```bash
# Check health of both databases
docker exec backend npm run db:sync health

# View statistics
docker exec backend npm run db:sync stats

# List users in each environment
docker exec backend npm run db:sync list development
docker exec backend npm run db:sync list production

# Compare user data
docker exec backend npm run db:sync compare <userId> <schemaPrefix>

# Sync user from dev to prod
docker exec backend npm run db:sync sync <userId> development production
```

3. **API Endpoints with Environment Selection**
When dual database mode is active, some endpoints accept an optional `env` query parameter:
```bash
# Query development database
GET /api/users?env=development

# Query production database  
GET /api/users?env=production

# Default uses NODE_ENV setting
GET /api/users
```

### Docker Compose for Dual Database

```yaml
services:
  backend:
    environment:
      - ACTIVE_DATABASES=both
      - DEV_DB_USER=${DEV_DB_USER}
      - DEV_DB_PASSWORD=${DEV_DB_PASSWORD}
      - DEV_DB_CONNECTION_STRING=${DEV_DB_CONNECTION_STRING}
      - PROD_DB_USER=${PROD_DB_USER}
      - PROD_DB_PASSWORD=${PROD_DB_PASSWORD}
      - PROD_DB_CONNECTION_STRING=${PROD_DB_CONNECTION_STRING}
    volumes:
      - ./wallets/dev:/app/wallets/dev:ro
      - ./wallets/prod:/app/wallets/prod:ro
```

### Security Considerations

1. **Separate Credentials**: Always use different credentials for dev and prod
2. **Read-Only Access**: Consider read-only access for production in development environments
3. **Audit Logging**: All cross-environment operations are logged
4. **Network Isolation**: Ensure proper network segmentation between environments

## Container Management

### Useful Commands

```bash
# List running containers
docker-compose ps

# Execute command in container
docker-compose exec backend npm run db:migrate

# View container resource usage
docker stats

# Clean up unused resources
docker system prune -a

# Backup database from container
docker-compose exec backend npm run db:backup
```

### Health Checks

Monitor service health:
```bash
# Check backend health
curl http://localhost:3000/api/health

# Check all services
docker-compose ps

# View health check logs
docker-compose logs backend | grep health
```

## Scaling

### Horizontal Scaling

Scale backend instances:
```yaml
backend:
  deploy:
    replicas: 3
```

Or use docker-compose scale:
```bash
docker-compose up -d --scale backend=3
```

### Load Balancing

Update nginx.conf for multiple backends:
```nginx
upstream backend {
    least_conn;
    server backend:3000 max_fails=3 fail_timeout=30s;
    server backend2:3000 max_fails=3 fail_timeout=30s;
    server backend3:3000 max_fails=3 fail_timeout=30s;
}
```

## Monitoring

### Container Logs

Configure log rotation:
```yaml
services:
  backend:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

### Health Monitoring

Add monitoring service:
```yaml
services:
  monitor:
    image: prom/prometheus
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
    ports:
      - "9090:9090"
```

## Backup and Recovery

### Database Backup

```bash
# Create backup script
cat > backup.sh << 'EOF'
#!/bin/bash
docker-compose exec backend npm run db:backup
aws s3 cp backup.sql s3://your-bucket/backups/
EOF

# Schedule with cron
0 2 * * * /path/to/backup.sh
```

### Volume Backup

```bash
# Backup volumes
docker run --rm -v pathfinder_data:/data -v $(pwd):/backup alpine tar czf /backup/data-backup.tar.gz -C /data .
```

## Troubleshooting

### Common Issues

#### Container Won't Start
```bash
# Check logs
docker-compose logs backend

# Verify environment
docker-compose config

# Check port conflicts
netstat -tulpn | grep -E '3000|5173|80'
```

#### Database Connection Issues
```bash
# Test from container
docker-compose exec backend npm run test:connection

# Check network
docker network ls
docker network inspect pathfinder_default
```

#### Memory Issues
```bash
# Increase Docker memory
# Docker Desktop: Preferences > Resources > Memory

# Or use limits in compose
services:
  backend:
    deploy:
      resources:
        limits:
          memory: 1G
```

### Debug Mode

Enable debug logging:
```yaml
services:
  backend:
    environment:
      - LOG_LEVEL=debug
      - DEBUG=app:*
```

## Security Best Practices

1. **Use Secrets Management**
   ```yaml
   services:
     backend:
       secrets:
         - db_password
         - jwt_secret
   
   secrets:
     db_password:
       external: true
     jwt_secret:
       external: true
   ```

2. **Network Isolation**
   ```yaml
   networks:
     frontend:
     backend:
     
   services:
     nginx:
       networks:
         - frontend
     backend:
       networks:
         - backend
   ```

3. **Read-Only Filesystems**
   ```yaml
   services:
     frontend:
       read_only: true
       tmpfs:
         - /tmp
   ```

4. **Non-Root User**
   ```dockerfile
   USER node
   ```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Build and push
        run: |
          docker-compose build
          docker-compose push
          
      - name: Deploy
        run: |
          ssh user@server 'cd /app && docker-compose pull && docker-compose up -d'
```

## Maintenance

### Regular Tasks

1. **Update Images**
   ```bash
   docker-compose pull
   docker-compose up -d
   ```

2. **Clean Up**
   ```bash
   docker system prune -a --volumes
   ```

3. **Monitor Disk Space**
   ```bash
   df -h
   docker system df
   ```

4. **Update Dependencies**
   ```bash
   docker-compose build --no-cache
   ```

## Support

For Docker-specific issues:
- Check container logs
- Verify environment variables
- Test network connectivity
- Review resource allocation

For application issues, see [Troubleshooting Guide](../development/troubleshooting.md)