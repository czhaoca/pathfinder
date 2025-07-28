# Docker Deployment Guide

## Overview

Pathfinder uses Docker for containerized deployment of both frontend and backend services. This ensures consistent environments, easy scaling, and simplified deployment across development and production environments.

## Prerequisites

- Docker Engine 20.10 or later
- Docker Compose 2.0 or later
- Oracle Autonomous Database with wallet files
- 4GB+ available RAM
- 10GB+ available disk space

## Architecture

The Docker setup includes:
- **Frontend**: React app served by Nginx
- **Backend**: Node.js API server with Express
- **Redis**: Session management and caching
- **Nginx**: Reverse proxy for production (optional)

## Quick Start

### 1. Clone and Setup Environment

```bash
# Clone the repository
git clone https://github.com/czhaoca/pathfinder.git
cd pathfinder

# Copy environment templates
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# Edit .env files with your actual values
nano .env
nano backend/.env
nano frontend/.env
```

### 2. Prepare Oracle Wallet Files

```bash
# Create wallet directory structure
mkdir -p wallets/dev-wallet
mkdir -p wallets/prod-wallet

# Extract your Oracle wallet files
unzip pathfinder-dev-wallet.zip -d wallets/dev-wallet/
unzip pathfinder-prod-wallet.zip -d wallets/prod-wallet/

# Set appropriate permissions
chmod -R 600 wallets/
```

### 3. Configure Environment Variables

Edit your `.env` file with the required values:

```bash
# Required variables
NODE_ENV=production
JWT_SECRET=your_jwt_secret_here
MCP_ENCRYPTION_KEY=your_encryption_key_here
REDIS_PASSWORD=your_redis_password_here

# Oracle Database Configuration
OCI_DB_PROD_SERVICE_NAME=your_service_name_here
OCI_DB_PROD_PASSWORD=your_database_password_here

# Docker Configuration
ORACLE_WALLET_PATH=/absolute/path/to/wallets
```

### 4. Deploy with Docker Compose

```bash
# Production deployment
docker-compose up -d

# Development deployment with dev profile
docker-compose --profile development up -d
```

## Environment Configuration

### Required Environment Variables

The `.env` file must contain these critical variables:

```bash
# Security (Generate with: openssl rand -hex 32)
JWT_SECRET=your_64_character_jwt_secret_key_here
MCP_ENCRYPTION_KEY=your_32_character_encryption_key_here
FIELD_ENCRYPTION_KEY=your_32_character_field_encryption_key_here

# Database
OCI_DB_PROD_SERVICE_NAME=your_prod_service_name.adb.oraclecloud.com
OCI_DB_PROD_PASSWORD=your_database_password

# Redis
REDIS_PASSWORD=your_secure_redis_password

# Docker
ORACLE_WALLET_PATH=/absolute/path/to/your/wallets
```

### Generating Secure Keys

```bash
# Generate JWT secret (64 characters)
openssl rand -hex 32

# Generate encryption keys (32 characters)
openssl rand -hex 16

# Generate strong passwords
openssl rand -base64 32
```

## Docker Services

### Main Services

#### 1. pathfinder (MCP Server)
- **Image**: Built from local Dockerfile
- **Port**: 3000 (configurable via MCP_PORT)
- **Volumes**: 
  - Oracle wallets (read-only)
  - Logs directory
  - Configuration files
- **Dependencies**: Redis

#### 2. redis (Session Management)
- **Image**: redis:7-alpine
- **Port**: 6379 (configurable via REDIS_PORT)
- **Data**: Persistent volume for session data
- **Security**: Password-protected

#### 3. nginx (Optional Reverse Proxy)
- **Profile**: production, nginx
- **Ports**: 80, 443
- **Features**: SSL termination, load balancing
- **Configuration**: Custom nginx.conf

### Development Services

#### pathfinder-dev
- **Profile**: development
- **Port**: 3001 (configurable via MCP_DEV_PORT)
- **Features**:
  - Live code reloading
  - Debug logging enabled
  - Source code mounted as volume

## Deployment Scenarios

### Development Environment

```bash
# Start development services
docker-compose --profile development up -d

# View logs
docker-compose logs -f pathfinder-dev

# Access development server
curl http://localhost:3001/health
```

### Production Environment

```bash
# Start production services
docker-compose up -d

# Enable nginx reverse proxy
docker-compose --profile nginx up -d

# View production logs
docker-compose logs -f pathfinder
```

### Staging Environment

```bash
# Use production images with staging config
NODE_ENV=staging docker-compose up -d
```

## Monitoring and Health Checks

### Built-in Health Checks

All services include comprehensive health checks:

```bash
# Check service health
docker-compose ps

# View health check details
docker inspect pathfinder-mcp --format='{{.State.Health}}'
```

### Health Check Endpoints

- **MCP Server**: `GET /health`
- **Redis**: Built-in Redis ping command
- **Custom Health Script**: `scripts/health-check.js`

### Log Monitoring

```bash
# View all service logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f pathfinder

# Follow logs with timestamps
docker-compose logs -f -t pathfinder
```

## Volume Management

### Persistent Data

- **Redis Data**: `pathfinder-redis-data` volume
- **Logs**: `./logs` host directory
- **Wallets**: Read-only mount from host

### Backup Procedures

```bash
# Backup Redis data
docker run --rm -v pathfinder-redis-data:/data -v $(pwd):/backup alpine tar czf /backup/redis-backup.tar.gz -C /data .

# Backup logs
tar czf logs-backup-$(date +%Y%m%d).tar.gz logs/
```

## Security Best Practices

### Environment Security

1. **Never commit `.env` files** to version control
2. **Use strong, unique passwords** for all services
3. **Rotate encryption keys regularly**
4. **Limit file permissions** on wallet files (600)
5. **Use separate environments** for dev/staging/production

### Network Security

```yaml
# docker-compose.yml network configuration
networks:
  pathfinder-network:
    driver: bridge
    internal: true  # For production isolation
```

### Container Security

- **Non-root user**: All containers run as non-root
- **Read-only wallets**: Wallet files mounted read-only
- **Minimal attack surface**: Alpine-based images
- **Regular updates**: Keep base images updated

## Scaling and Load Balancing

### Horizontal Scaling

```bash
# Scale MCP server instances
docker-compose up -d --scale pathfinder=3

# Use nginx for load balancing
docker-compose --profile nginx up -d
```

### Resource Limits

```yaml
# Add to docker-compose.yml
services:
  pathfinder:
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 4G
        reservations:
          cpus: '0.5'
          memory: 1G
```

## Troubleshooting

### Common Issues

#### 1. Database Connection Failures
```bash
# Check wallet files
ls -la wallets/prod-wallet/

# Verify environment variables
docker-compose exec pathfinder env | grep OCI_DB

# Test database connectivity
docker-compose exec pathfinder node scripts/db-health-check.js
```

#### 2. Redis Connection Issues
```bash
# Check Redis status
docker-compose exec redis redis-cli ping

# Verify Redis password
docker-compose exec redis redis-cli -a "${REDIS_PASSWORD}" ping
```

#### 3. Health Check Failures
```bash
# Check health check script
docker-compose exec pathfinder node scripts/health-check.js

# View detailed health status
docker inspect pathfinder-mcp --format='{{json .State.Health}}'
```

### Log Analysis

```bash
# Search logs for errors
docker-compose logs pathfinder 2>&1 | grep ERROR

# Monitor performance
docker-compose logs pathfinder 2>&1 | grep "execution_time"

# Check authentication issues
docker-compose logs pathfinder 2>&1 | grep "auth"
```

### Performance Monitoring

```bash
# Container resource usage
docker stats pathfinder-mcp

# Database connection pool status
docker-compose exec pathfinder curl -s http://localhost:3000/metrics
```

## Maintenance and Updates

### Regular Maintenance

```bash
# Update base images
docker-compose pull

# Rebuild with latest code
docker-compose build --no-cache

# Clean up unused images
docker system prune -f
```

### Database Schema Updates

```bash
# Run database migrations
docker-compose exec pathfinder npm run db:migrate

# Verify schema deployment
docker-compose exec pathfinder npm run db:health
```

### Backup and Recovery

```bash
# Full system backup
./scripts/backup-system.sh

# Restore from backup
./scripts/restore-system.sh backup-20240101.tar.gz
```

## Production Deployment Checklist

### Pre-Deployment

- [ ] Oracle Autonomous Database provisioned and accessible
- [ ] Wallet files downloaded and extracted
- [ ] Strong passwords and encryption keys generated
- [ ] `.env` file configured with production values
- [ ] SSL certificates obtained (if using HTTPS)
- [ ] Firewall rules configured
- [ ] Monitoring systems prepared

### Deployment

- [ ] Docker and Docker Compose installed
- [ ] Repository cloned and configured
- [ ] Services started with docker-compose
- [ ] Health checks passing
- [ ] Database connectivity verified
- [ ] Authentication system tested

### Post-Deployment

- [ ] Performance monitoring enabled
- [ ] Log aggregation configured
- [ ] Backup procedures tested
- [ ] Security audit completed
- [ ] Documentation updated
- [ ] Team trained on deployment procedures

## Support and Resources

### Documentation Links

- [Oracle Database Docker Guide](docs/deployment/mcp-server/oci-provisioning-guide.md)
- [Security Compliance](docs/deployment/security-compliance.md)
- [Multi-User Architecture](docs/development/multi-user-architecture.md)

### Getting Help

- Check container logs: `docker-compose logs -f`
- Run health checks: `scripts/health-check.js`
- Review environment configuration: `.env.example`
- Consult troubleshooting guide above

The Pathfinder MCP Server is now ready for secure, scalable Docker deployment with enterprise-grade features and monitoring capabilities.