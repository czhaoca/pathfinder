# Oracle Cloud Infrastructure Database Provisioning Guide

## Step-by-Step OCI Autonomous Database Setup

This guide provides detailed instructions to provision Oracle Autonomous Database instances for the Career Navigator MCP server, including both development and production environments.

## Prerequisites

- Oracle Cloud Infrastructure (OCI) account with Free Tier access
- Basic understanding of database concepts
- Terminal/command line access
- Text editor for configuration files

## Step 1: Create OCI Account and Access Console

### 1.1 Sign Up for OCI Free Tier
1. Navigate to [Oracle Cloud Free Tier](https://signup.oraclecloud.com/)
2. Complete the registration process
3. Verify your email and phone number
4. **Important**: No credit card required for Always Free resources

### 1.2 Access OCI Console
1. Go to [Oracle Cloud Console](https://cloud.oracle.com/)
2. Sign in with your Oracle Cloud credentials
3. Select your home region (choose the region closest to your users)
4. Familiarize yourself with the OCI Console interface

## Step 2: Provision Development Database

### 2.1 Navigate to Autonomous Database
1. From the OCI Console hamburger menu, select **"Oracle Database"**
2. Click **"Autonomous Database"**
3. Ensure you're in the correct compartment (usually "root" for Free Tier)

### 2.2 Create Development Database
Click **"Create Autonomous Database"** and configure:

**Basic Information:**
- **Compartment**: Select your compartment (usually root)
- **Display Name**: `career-navigator-dev`
- **Database Name**: `CAREERDEV` (must be unique in tenancy)

**Workload Type:**
- Select **"Transaction Processing"** (recommended for MCP operations)
- Alternative: **"JSON Database"** if you need maximum JSON optimization

**Deployment Type:**
- Select **"Shared Infrastructure"** (Always Free option)
- **Always Free**: Toggle this ON (this is critical for free tier)

**Configuration:**
- **Database version**: Select the latest version (usually 19c or 23c)
- **OCPU count**: 1 (fixed for Always Free)
- **Storage**: 20 GB (fixed for Always Free)
- **Auto Scaling**: Leave OFF (not available in Always Free)

**Create Administrator Credentials:**
- **Username**: `ADMIN` (default, cannot be changed)
- **Password**: Create a strong password (e.g., `DevCareer2024!`)
  - Requirements: 12-30 characters, uppercase, lowercase, number, special character
  - **Record this password securely**

**Network Access:**
- **Access Type**: Select **"Secure access from everywhere"**
  - This allows connections from your development environment
  - For production, consider **"Secure access from allowed IPs and VCNs"**

**License Type:**
- Select **"License Included"** (included in Always Free)

### 2.3 Complete Development Database Creation
1. Review all settings
2. Click **"Create Autonomous Database"**
3. Wait for provisioning (typically 2-5 minutes)
4. Status will change from "PROVISIONING" to "AVAILABLE"

## Step 3: Provision Production Database

### 3.1 Create Production Database
Repeat the process from Step 2.2 with these differences:

**Basic Information:**
- **Display Name**: `career-navigator-prod`
- **Database Name**: `CAREERPROD`

**Create Administrator Credentials:**
- **Username**: `ADMIN`
- **Password**: Create a different strong password (e.g., `ProdCareer2024!`)
  - **Use a different password than development**
  - **Record this password securely**

**Network Access:**
- Consider **"Secure access from allowed IPs and VCNs"** for production
- Or use **"Secure access from everywhere"** if you need flexibility

## Step 4: Download Database Wallets

Oracle Autonomous Database uses Oracle Wallet for secure connections. You need to download wallet files for both databases.

### 4.1 Download Development Wallet
1. From the Autonomous Database list, click on your development database (`career-navigator-dev`)
2. Click **"Database Connection"**
3. Click **"Download Wallet"**
4. Set wallet password (e.g., `DevWallet2024!`)
   - **Record this password securely**
5. Download the wallet ZIP file
6. Save as `career-navigator-dev-wallet.zip`

### 4.2 Download Production Wallet
1. Repeat the process for your production database (`career-navigator-prod`)
2. Set a different wallet password (e.g., `ProdWallet2024!`)
3. Save as `career-navigator-prod-wallet.zip`

### 4.3 Extract and Organize Wallets
Create wallet directories in your project:

```bash
# Create wallet directories
mkdir -p wallets/dev-wallet
mkdir -p wallets/prod-wallet

# Extract wallets
unzip career-navigator-dev-wallet.zip -d wallets/dev-wallet/
unzip career-navigator-prod-wallet.zip -d wallets/prod-wallet/

# Set appropriate permissions
chmod 600 wallets/dev-wallet/*
chmod 600 wallets/prod-wallet/*
```

## Step 5: Obtain Connection Information

### 5.1 Get Connection Strings
For each database, obtain the connection details:

1. From the database details page, click **"Database Connection"**
2. Note the connection strings under **"Connection Strings"**:
   - **High**: For high performance, concurrent operations
   - **Medium**: For typical operations (recommended)
   - **Low**: For reporting and batch operations

**Example Connection Strings:**
```
Development Database:
- High: careerdev_high
- Medium: careerdev_medium  
- Low: careerdev_low

Production Database:
- High: careerprod_high
- Medium: careerprod_medium
- Low: careerprod_low
```

### 5.2 Extract Connection Details
From the wallet's `tnsnames.ora` file, extract connection details:

```bash
# View connection details
cat wallets/dev-wallet/tnsnames.ora
```

You'll see entries like:
```
careerdev_high = (description= (retry_count=20)(retry_delay=3)(address=(protocol=tcps)(port=1521)(host=adb.us-ashburn-1.oraclecloud.com))(connect_data=(service_name=g4f1a2b3c4d5e6f_careerdev_high.adb.oraclecloud.com))(security=(ssl_server_cert_dn="CN=adb.us-ashburn-1.oraclecloud.com, OU=Oracle BMCS US, O=Oracle Corporation, L=Redwood City, ST=California, C=US")))
```

Extract key information:
- **Host**: `adb.us-ashburn-1.oraclecloud.com`
- **Port**: `1521`
- **Service Name**: `g4f1a2b3c4d5e6f_careerdev_high.adb.oraclecloud.com`

## Step 6: Configure Environment Variables

### 6.1 Create Development Environment File
Create `.env.development`:

```bash
# Environment
NODE_ENV=development

# Oracle Autonomous Database - Development
OCI_DB_DEV_HOST=adb.us-ashburn-1.oraclecloud.com
OCI_DB_DEV_PORT=1521
OCI_DB_DEV_SERVICE_NAME=g4f1a2b3c4d5e6f_careerdev_medium.adb.oraclecloud.com
OCI_DB_DEV_USERNAME=ADMIN
OCI_DB_DEV_PASSWORD=DevCareer2024!
OCI_DB_DEV_WALLET_PATH=./wallets/dev-wallet

# MCP Configuration
MCP_ENCRYPTION_KEY=dev-key-32-characters-long-1234
MCP_SESSION_TIMEOUT=3600000
LOG_LEVEL=debug
ENABLE_QUERY_LOGGING=true
```

### 6.2 Create Production Environment File
Create `.env.production`:

```bash
# Environment
NODE_ENV=production

# Oracle Autonomous Database - Production
OCI_DB_PROD_HOST=adb.us-ashburn-1.oraclecloud.com
OCI_DB_PROD_PORT=1521
OCI_DB_PROD_SERVICE_NAME=g4f1a2b3c4d5e6f_careerprod_medium.adb.oraclecloud.com
OCI_DB_PROD_USERNAME=ADMIN
OCI_DB_PROD_PASSWORD=ProdCareer2024!
OCI_DB_PROD_WALLET_PATH=./wallets/prod-wallet

# MCP Configuration
MCP_ENCRYPTION_KEY=prod-key-32-characters-long-5678
MCP_SESSION_TIMEOUT=1800000
LOG_LEVEL=info
ENABLE_QUERY_LOGGING=false
```

### 6.3 Secure Environment Files
```bash
# Set appropriate permissions
chmod 600 .env.development
chmod 600 .env.production

# Add to .gitignore to prevent accidental commits
echo ".env*" >> .gitignore
echo "wallets/" >> .gitignore
```

## Step 7: Create Database Schema

### 7.1 Connect to Development Database
Install Oracle client and test connection:

```bash
# Install Oracle client (if not already installed)
npm install oracledb

# Test connection script
node -e "
const oracledb = require('oracledb');
oracledb.initOracleClient();
async function test() {
  const connection = await oracledb.getConnection({
    user: 'ADMIN',
    password: 'DevCareer2024!',
    connectString: 'careerdev_medium',
    walletLocation: './wallets/dev-wallet',
    walletPassword: ''
  });
  const result = await connection.execute('SELECT 1 FROM DUAL');
  console.log('✅ Development database connected:', result.rows);
  await connection.close();
}
test();
"
```

### 7.2 Deploy Schema to Development
Create and run schema deployment script:

```javascript
// scripts/deploy-schema.js
const oracledb = require('oracledb');
const fs = require('fs');
const path = require('path');

const config = {
  development: {
    user: 'ADMIN',
    password: 'DevCareer2024!',
    connectString: 'careerdev_medium',
    walletLocation: './wallets/dev-wallet',
    walletPassword: ''
  },
  production: {
    user: 'ADMIN', 
    password: 'ProdCareer2024!',
    connectString: 'careerprod_medium',
    walletLocation: './wallets/prod-wallet',
    walletPassword: ''
  }
};

async function deploySchema(environment) {
  const connection = await oracledb.getConnection(config[environment]);
  
  try {
    console.log(`🚀 Deploying schema to ${environment}...`);
    
    // Create experiences_detailed table
    await connection.execute(`
      CREATE TABLE experiences_detailed (
        id RAW(16) DEFAULT SYS_GUID() PRIMARY KEY,
        title VARCHAR2(255) NOT NULL,
        organization VARCHAR2(255),
        description CLOB NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE,
        is_current NUMBER(1) DEFAULT 0 CHECK (is_current IN (0,1)),
        experience_type VARCHAR2(50) CHECK (experience_type IN ('work', 'education', 'volunteer', 'project', 'hobby', 'certification')),
        extracted_skills JSON,
        key_highlights JSON,
        role_mappings JSON,
        industry_tags JSON,
        impact_metrics JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create indexes
    await connection.execute(`
      CREATE INDEX idx_experiences_type_date ON experiences_detailed (experience_type, start_date DESC)
    `);
    
    await connection.execute(`
      CREATE INDEX idx_experiences_current ON experiences_detailed (is_current, updated_at DESC)
    `);
    
    // Create profile_summaries table
    await connection.execute(`
      CREATE TABLE profile_summaries (
        id RAW(16) DEFAULT SYS_GUID() PRIMARY KEY,
        core_strengths JSON,
        career_interests JSON,
        career_progression JSON,
        industry_experience JSON,
        leadership_profile JSON,
        technical_profile JSON,
        soft_skills_profile JSON,
        education_summary JSON,
        achievement_highlights JSON,
        last_aggregated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    await connection.execute(`
      CREATE UNIQUE INDEX idx_profile_singleton ON profile_summaries (1)
    `);
    
    // Create quick_summaries table
    await connection.execute(`
      CREATE TABLE quick_summaries (
        id RAW(16) DEFAULT SYS_GUID() PRIMARY KEY,
        executive_summary CLOB,
        key_skills JSON,
        career_goals CLOB,
        years_experience NUMBER(3),
        current_role VARCHAR2(255),
        industries JSON,
        education_level VARCHAR2(100),
        location VARCHAR2(255),
        availability VARCHAR2(100),
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    await connection.execute(`
      CREATE UNIQUE INDEX idx_quick_singleton ON quick_summaries (1)
    `);
    
    console.log(`✅ Schema deployed successfully to ${environment}`);
    
  } catch (error) {
    console.error(`❌ Schema deployment failed for ${environment}:`, error);
    throw error;
  } finally {
    await connection.close();
  }
}

// Deploy to both environments
async function main() {
  const env = process.argv[2] || 'development';
  
  if (!['development', 'production'].includes(env)) {
    console.error('Usage: node deploy-schema.js [development|production]');
    process.exit(1);
  }
  
  try {
    oracledb.initOracleClient();
    await deploySchema(env);
  } catch (error) {
    console.error('Deployment failed:', error);
    process.exit(1);
  }
}

main();
```

Run schema deployment:
```bash
# Deploy to development
node scripts/deploy-schema.js development

# Deploy to production  
node scripts/deploy-schema.js production
```

## Step 8: Test Database Connectivity

### 8.1 Create Connection Test Script
```javascript
// scripts/test-connections.js
const DatabaseManager = require('../lib/database');

async function testBothEnvironments() {
  const environments = ['development', 'production'];
  
  for (const env of environments) {
    console.log(`\n🧪 Testing ${env} environment...`);
    
    // Set environment
    process.env.NODE_ENV = env;
    
    // Reload configuration
    delete require.cache[require.resolve('../config/mcp-config')];
    delete require.cache[require.resolve('../lib/database')];
    
    const DatabaseManager = require('../lib/database');
    
    try {
      await DatabaseManager.initialize();
      const health = await DatabaseManager.healthCheck();
      
      console.log(`   Status: ${health.status}`);
      console.log(`   Environment: ${health.environment}`);
      
      if (health.error) {
        console.log(`   Error: ${health.error}`);
      }
      
      // Test a simple query
      const connection = await DatabaseManager.getConnection();
      const result = await connection.execute(`
        SELECT COUNT(*) as table_count 
        FROM user_tables 
        WHERE table_name IN ('EXPERIENCES_DETAILED', 'PROFILE_SUMMARIES', 'QUICK_SUMMARIES')
      `);
      
      console.log(`   Tables found: ${result.rows[0][0]}/3`);
      
      await connection.close();
      await DatabaseManager.close();
      
      console.log(`   ✅ ${env} connection test passed`);
      
    } catch (error) {
      console.error(`   ❌ ${env} connection test failed:`, error.message);
    }
  }
}

testBothEnvironments();
```

Run connection tests:
```bash
node scripts/test-connections.js
```

## Step 9: Configure MCP Server

### 9.1 Install Dependencies
```bash
npm install @modelcontextprotocol/sdk oracledb dotenv
```

### 9.2 Test MCP Server Startup
```bash
# Test development environment
npm run env:dev
npm run mcp:dev

# Test production environment  
npm run env:prod
npm run mcp:prod
```

## Step 10: Monitor and Optimize

### 10.1 Set Up Database Monitoring
1. In OCI Console, go to your Autonomous Database
2. Click **"Performance Hub"** to monitor queries and performance
3. Review **"Activity"** tab for connection monitoring
4. Check **"SQL Monitoring"** for slow queries

### 10.2 Configure Alerts
1. Go to **"Monitoring"** > **"Alarms"**
2. Create alerts for:
   - Storage usage > 70%
   - CPU usage > 80%
   - Failed connections
   - Response time degradation

### 10.3 Regular Maintenance
```bash
# Weekly health checks
npm run db:health

# Monitor storage usage
node -e "
const oracledb = require('oracledb');
// Query to check storage usage
// (Add to scripts/storage-check.js)
"
```

## Troubleshooting Guide

### Common Issues and Solutions

#### 1. "ORA-01017: invalid username/password"
- **Cause**: Incorrect credentials or wallet password
- **Solution**: Verify passwords in environment files and wallet password

#### 2. "TNS-12541: TNS:no listener"
- **Cause**: Incorrect connection string or network issues
- **Solution**: Check service name in tnsnames.ora and network connectivity

#### 3. "Wallet location not found"
- **Cause**: Incorrect wallet path in configuration
- **Solution**: Verify wallet files are extracted to correct location

#### 4. "ORA-00955: name is already used by an existing object"
- **Cause**: Schema objects already exist
- **Solution**: Drop existing objects or use CREATE OR REPLACE

#### 5. Connection pool exhaustion
- **Cause**: Too many concurrent connections
- **Solution**: Optimize connection pool settings and implement connection retry logic

### Getting Help

- **Oracle Cloud Support**: Available through OCI Console
- **Oracle Database Documentation**: [Oracle Database 19c Documentation](https://docs.oracle.com/en/database/oracle/oracle-database/19/)
- **OCI Free Tier FAQ**: [Oracle Cloud Free Tier FAQ](https://www.oracle.com/cloud/free/faq/)

## Security Best Practices

1. **Never commit credentials**: Keep environment files out of version control
2. **Use strong passwords**: Follow Oracle's password requirements
3. **Rotate passwords regularly**: Change database and wallet passwords periodically
4. **Monitor access**: Review database audit logs regularly
5. **Network security**: Use VPN or VCN for production environments
6. **Backup wallets**: Keep secure copies of wallet files

## Next Steps

After successful provisioning:

1. **Deploy MCP Server**: Use the configuration created in this guide
2. **Load Sample Data**: Create test experiences for development
3. **Performance Testing**: Verify MCP response times meet targets
4. **Production Deployment**: Deploy to production environment
5. **Monitoring Setup**: Configure comprehensive monitoring and alerting

Your Oracle Autonomous Database instances are now ready for the Career Navigator MCP server!