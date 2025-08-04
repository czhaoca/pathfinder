# User-Controlled Database Options

## Overview

To ensure maximum privacy and data sovereignty, users can choose from several database providers to store their career data. All options support encryption at rest and in transit, with users maintaining full control over their data.

## Recommended Free Tier Options

### 1. Oracle Cloud Infrastructure (OCI) Free Tier ⭐ RECOMMENDED

#### Why OCI Free Tier?
- **Always Free**: 2 Autonomous Transaction Processing (ATP) databases
- **20GB storage** per database (40GB total)
- **1 OCPU** per database for compute
- **No credit card expiration**: Truly free forever
- **Enterprise-grade security**: Advanced encryption and access controls
- **Global availability**: Multiple regions available

#### Setup Guide

```bash
# 1. Create OCI Account
# Visit: https://cloud.oracle.com/en_US/tryit
# Sign up with email (no credit card required for Always Free)

# 2. Create Autonomous Database
oci db autonomous-database create \
  --compartment-id <your-compartment-id> \
  --db-name CareerNavDB \
  --cpu-core-count 1 \
  --data-storage-size-in-tbs 1 \
  --admin-password <your-secure-password> \
  --is-free-tier true
```

#### Configuration
```yaml
Database Configuration:
  Type: Autonomous Transaction Processing (ATP)
  Version: 19c or higher
  Storage: 20GB (expandable within free tier limits)
  Backup: Automatic daily backups included
  Encryption: TDE (Transparent Data Encryption) enabled by default
  
Connection Details:
  Protocol: SSL/TLS only
  Authentication: Database users + OCI IAM
  Network: Private endpoints recommended
```

#### Cost Estimate
```
Monthly Cost: $0.00 (Always Free)
Storage: 20GB included
Compute: 1 OCPU included
Backup: Automatic backups included
Data Transfer: 10TB outbound per month free
```

### 2. Cloudflare D1 Database

#### Why Cloudflare D1?
- **Generous free tier**: 100,000 reads/day, 1,000 writes/day
- **Global edge deployment**: Data replicated worldwide
- **Built-in encryption**: All data encrypted at rest and in transit
- **SQLite compatibility**: Standard SQL interface
- **Cloudflare Workers integration**: Serverless compute included

#### Setup Guide

```bash
# 1. Install Wrangler CLI
npm install -g wrangler

# 2. Login to Cloudflare
wrangler login

# 3. Create D1 Database
wrangler d1 create pathfinder-db

# 4. Configure wrangler.toml
echo '
name = "pathfinder"
compatibility_date = "2024-01-01"

[[d1_databases]]
binding = "DB"
database_name = "pathfinder-db"
database_id = "<your-database-id>"
' > wrangler.toml
```

#### Configuration
```yaml
Database Configuration:
  Type: SQLite (Cloudflare D1)
  Storage: 5GB free tier
  Reads: 100,000 per day
  Writes: 1,000 per day
  Global Replication: Automatic
  
Connection Details:
  Protocol: HTTPS REST API
  Authentication: Cloudflare API tokens
  Encryption: ChaCha20-Poly1305 at rest, TLS 1.3 in transit
```

#### Cost Estimate
```
Monthly Cost: $0.00 (within free tier limits)
Storage: 5GB included
Reads: 100,000/day = ~3M/month included
Writes: 1,000/day = ~30K/month included
Overage: $0.001 per 1K reads, $1.00 per 1M writes
```

## Alternative Options

### 3. AWS Free Tier

#### RDS PostgreSQL + S3
```yaml
Components:
  - RDS PostgreSQL: 20GB storage, 750 hours/month
  - S3: 5GB storage, 20,000 GET requests
  - Lambda: 1M requests/month, 400,000 GB-seconds

Monthly Cost: $0.00 (12 months free)
After Free Tier: ~$15-25/month
```

### 4. Azure Free Tier

#### Azure Database for PostgreSQL + Blob Storage
```yaml
Components:
  - PostgreSQL: B1ms instance, 32GB storage
  - Blob Storage: 5GB LRS storage
  - App Service: B1 tier, 1GB RAM

Monthly Cost: $0.00 (12 months free)
After Free Tier: ~$20-30/month
```

### 5. Google Cloud Free Tier

#### Cloud SQL + Cloud Storage
```yaml
Components:
  - Cloud SQL PostgreSQL: db-f1-micro, 30GB HDD
  - Cloud Storage: 5GB standard storage
  - Cloud Functions: 2M invocations/month

Monthly Cost: $0.00 (Always Free tier)
Limitations: Shared CPU, limited performance
```

## Database Schema Deployment

### OCI ATP Deployment
```sql
-- Create encrypted tablespace
CREATE TABLESPACE career_data
DATAFILE 'career_data.dbf' SIZE 100M
ENCRYPTION USING 'AES256'
DEFAULT STORAGE(ENCRYPT);

-- Create application user
CREATE USER career_app IDENTIFIED BY "<secure-password>"
DEFAULT TABLESPACE career_data
QUOTA UNLIMITED ON career_data;

-- Grant necessary privileges
GRANT CREATE SESSION, CREATE TABLE, CREATE PROCEDURE TO career_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON career_app.* TO career_app;
```

### Cloudflare D1 Deployment
```sql
-- Enable foreign key constraints
PRAGMA foreign_keys = ON;

-- Create tables with encryption considerations
CREATE TABLE experiences_detailed (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    encrypted_data TEXT NOT NULL, -- JSON data encrypted client-side
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_experiences_user_id ON experiences_detailed(user_id);
CREATE INDEX idx_experiences_created ON experiences_detailed(created_at);
```

## Connection Configuration

### Environment Variables Template
```env
# Database Configuration
DB_TYPE=oci_atp  # or cloudflare_d1, postgres, mysql
DB_HOST=your-atp-host.oraclecloud.com
DB_PORT=1522
DB_NAME=career_nav_db
DB_USER=career_app
DB_PASSWORD=your-secure-password

# Encryption Configuration
DB_ENCRYPTION_KEY=your-32-byte-encryption-key
KEY_ROTATION_DAYS=90

# Connection Pool Settings
DB_POOL_MIN=2
DB_POOL_MAX=10
DB_TIMEOUT=30000

# Backup Configuration
BACKUP_SCHEDULE=daily
BACKUP_RETENTION_DAYS=30
```

### Connection Security
```javascript
// OCI ATP Connection with TLS
const dbConfig = {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: {
    rejectUnauthorized: true,
    ca: fs.readFileSync('path/to/oracle-wallet/ca.pem'),
    cert: fs.readFileSync('path/to/oracle-wallet/client.pem'),
    key: fs.readFileSync('path/to/oracle-wallet/client-key.pem')
  },
  options: {
    encrypt: true,
    trustServerCertificate: false
  }
};

// Cloudflare D1 Connection
const d1Config = {
  accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
  databaseId: process.env.CLOUDFLARE_DATABASE_ID,
  apiToken: process.env.CLOUDFLARE_API_TOKEN,
  baseUrl: 'https://api.cloudflare.com/client/v4'
};
```

## Migration & Backup Strategies

### Automated Backup Script
```bash
#!/bin/bash
# backup-career-data.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/secure/backups"
ENCRYPTION_KEY="$DB_ENCRYPTION_KEY"

# Create encrypted backup
pg_dump --host=$DB_HOST --username=$DB_USER --dbname=$DB_NAME \
  | gpg --symmetric --cipher-algo AES256 --compress-algo 1 --s2k-mode 3 \
        --s2k-digest-algo SHA512 --s2k-count 65536 --force-mdc \
        --passphrase="$ENCRYPTION_KEY" \
  > "$BACKUP_DIR/career_backup_$DATE.sql.gpg"

# Verify backup integrity
gpg --quiet --batch --decrypt --passphrase="$ENCRYPTION_KEY" \
    "$BACKUP_DIR/career_backup_$DATE.sql.gpg" | head -10

echo "Backup completed: career_backup_$DATE.sql.gpg"
```

### Cross-Provider Migration
```javascript
// Migration utility for switching database providers
class DatabaseMigrator {
  async migrateToProvider(sourceConfig, targetConfig) {
    const sourceDb = new DatabaseConnection(sourceConfig);
    const targetDb = new DatabaseConnection(targetConfig);
    
    // Export data with encryption
    const exportData = await sourceDb.exportEncrypted();
    
    // Create schema on target
    await targetDb.createSchema();
    
    // Import data with re-encryption
    await targetDb.importEncrypted(exportData);
    
    // Verify data integrity
    const verification = await this.verifyMigration(sourceDb, targetDb);
    
    return verification;
  }
}
```

## Security Considerations

### Data Encryption at Rest
- **Client-side encryption**: Data encrypted before sending to database
- **Transparent Data Encryption (TDE)**: Database-level encryption for supported providers
- **Key management**: User-controlled encryption keys, never stored with data

### Access Control
- **Database users**: Separate user accounts with minimal privileges
- **Network security**: VPC/private networks, IP whitelisting
- **Audit logging**: All database access logged and monitored

### Monitoring & Alerting
```yaml
Monitoring Metrics:
  - Connection count and duration
  - Query performance and errors
  - Storage usage and growth
  - Backup success/failure
  - Unusual access patterns

Alerts:
  - Failed login attempts (5+ in 1 hour)
  - Storage usage > 80%
  - Backup failures
  - Long-running queries (> 30 seconds)
  - Connections from new IP addresses
```