# Deployment Guide

## Overview

Career Navigator can be deployed in multiple environments, from local development to enterprise-scale production. This guide covers all deployment options and best practices.

## Deployment Options

### 1. [Docker Deployment](./docker/docker-deployment.md) (Recommended)
Container-based deployment for consistency and scalability
- **Docker Compose**: Single-server deployment
- **Kubernetes**: Multi-server orchestration
- **Container Registry**: Private registry setup

### 2. [Cloud Deployment](./cloud-deployment.md)
Platform-specific deployment guides
- **AWS**: EC2, ECS, RDS setup
- **Google Cloud**: GKE, Cloud SQL
- **Azure**: AKS, Azure Database

### 3. [Traditional Deployment](./traditional-deployment.md)
Direct server installation
- **Linux**: Ubuntu, CentOS, RHEL
- **Database**: Oracle ATP setup
- **Reverse Proxy**: Nginx configuration

## Quick Start Deployment

### Prerequisites
- Docker and Docker Compose installed
- Oracle Cloud account (for database)
- Domain name (optional)
- SSL certificate (optional)

### Basic Deployment Steps

1. **Clone the repository**
```bash
git clone https://github.com/your-org/career-navigator.git
cd career-navigator
```

2. **Configure environment**
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. **Start services**
```bash
docker-compose up -d
```

4. **Run migrations**
```bash
docker-compose exec backend npm run db:migrate
```

5. **Access the application**
```
http://localhost:80
```

## Production Deployment Checklist

### Security
- [ ] SSL/TLS certificates configured
- [ ] Firewall rules configured
- [ ] Database encryption enabled
- [ ] Secrets management system
- [ ] Security headers configured
- [ ] Rate limiting enabled
- [ ] DDoS protection

### Performance
- [ ] CDN configured
- [ ] Caching strategy implemented
- [ ] Database connection pooling
- [ ] Load balancer configured
- [ ] Auto-scaling policies
- [ ] Resource monitoring

### Reliability
- [ ] Backup strategy implemented
- [ ] Disaster recovery plan
- [ ] Health checks configured
- [ ] Log aggregation setup
- [ ] Alert notifications
- [ ] Uptime monitoring

### Compliance
- [ ] Data residency requirements
- [ ] Audit logging enabled
- [ ] Encryption at rest
- [ ] Access controls configured
- [ ] Compliance scanning
- [ ] Regular security audits

## Environment Configuration

### Development
```env
NODE_ENV=development
DATABASE_ENV=development
API_PORT=3000
FRONTEND_PORT=5173
LOG_LEVEL=debug
```

### Staging
```env
NODE_ENV=staging
DATABASE_ENV=staging
API_PORT=3000
FRONTEND_URL=https://staging.career-navigator.com
LOG_LEVEL=info
```

### Production
```env
NODE_ENV=production
DATABASE_ENV=production
API_PORT=3000
FRONTEND_URL=https://career-navigator.com
LOG_LEVEL=warn
ENABLE_MONITORING=true
```

## Database Deployment

### Oracle Autonomous Database Setup
1. Create ATP instance in Oracle Cloud
2. Download wallet files
3. Configure connection strings
4. Run schema migrations
5. Set up automated backups

See [Database Setup Guide](./database-setup.md) for details.

## Monitoring & Logging

### Application Monitoring
- **Metrics**: CPU, memory, response times
- **APM**: Application performance monitoring
- **Logs**: Centralized log aggregation
- **Alerts**: Threshold-based notifications

### Database Monitoring
- **Performance**: Query execution times
- **Connections**: Pool utilization
- **Storage**: Space usage trends
- **Backups**: Verification status

See [Monitoring Guide](./monitoring.md) for setup instructions.

## Scaling Strategies

### Horizontal Scaling
- **Load Balancing**: Distribute traffic
- **Session Management**: Redis for sessions
- **Database Pooling**: Connection management
- **Caching Layer**: Redis/Memcached

### Vertical Scaling
- **Resource Allocation**: CPU/Memory limits
- **Database Tier**: Upgrade ATP instance
- **Storage Expansion**: Increase disk space
- **Network Bandwidth**: Upgrade connectivity

## Deployment Architectures

### Single Server
```
┌─────────────────────────────────┐
│         Nginx (Reverse Proxy)    │
├─────────────────────────────────┤
│     Frontend    │    Backend     │
├─────────────────┴────────────────┤
│          Oracle Database         │
└─────────────────────────────────┘
```

### Multi-Server
```
       ┌──────────────┐
       │ Load Balancer│
       └──────┬───────┘
    ┌─────────┴─────────┐
    ▼                   ▼
┌────────┐         ┌────────┐
│Frontend│         │Frontend│
└────────┘         └────────┘
    │                   │
    ▼                   ▼
┌────────┐         ┌────────┐
│Backend │         │Backend │
└────────┘         └────────┘
    │                   │
    └─────────┬─────────┘
              ▼
      ┌──────────────┐
      │   Database   │
      │   Cluster    │
      └──────────────┘
```

## Troubleshooting Deployment

### Common Issues

#### Container Won't Start
```bash
# Check logs
docker-compose logs backend
docker-compose logs frontend

# Verify environment
docker-compose config
```

#### Database Connection Failed
```bash
# Test connection
docker-compose exec backend npm run db:health

# Check wallet files
ls -la wallets/
```

#### Port Conflicts
```bash
# Find process using port
lsof -i :3000
netstat -tlnp | grep 3000

# Change port in .env
API_PORT=3001
```

## Security Hardening

### Application Security
1. Enable all security headers
2. Configure CORS properly
3. Implement rate limiting
4. Enable audit logging
5. Regular dependency updates

### Infrastructure Security
1. Firewall configuration
2. VPN/Private network
3. Intrusion detection
4. Regular OS updates
5. Security scanning

See [Security Procedures](./security/security-procedures.md) for detailed guide.

## Backup & Recovery

### Backup Strategy
- **Database**: Daily automated backups
- **File Storage**: Incremental backups
- **Configuration**: Version controlled
- **Secrets**: Secure backup vault

### Recovery Procedures
1. Identify failure point
2. Restore from latest backup
3. Verify data integrity
4. Test application functionality
5. Document incident

See [Backup & Recovery Guide](../guides/backup-recovery.md) for procedures.

## Related Documentation

- [Docker Deployment](./docker/docker-deployment.md)
- [Security Procedures](./security/security-procedures.md)
- [Database Setup](./database-setup.md)
- [Monitoring Guide](./monitoring.md)
- [Performance Tuning](./performance-tuning.md)