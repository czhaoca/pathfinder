# MCP Server Configuration Guide

## Environment-Based Configuration

The MCP server supports environment-based configuration to switch between development and production Oracle Autonomous Database instances.

### Configuration Structure

```javascript
// config/mcp-config.js
const config = {
  environment: process.env.NODE_ENV || 'development',
  
  database: {
    development: {
      host: process.env.OCI_DB_DEV_HOST,
      port: process.env.OCI_DB_DEV_PORT || 1521,
      serviceName: process.env.OCI_DB_DEV_SERVICE_NAME,
      username: process.env.OCI_DB_DEV_USERNAME,
      password: process.env.OCI_DB_DEV_PASSWORD,
      walletLocation: process.env.OCI_DB_DEV_WALLET_PATH,
      pool: {
        min: 2,
        max: 8,
        increment: 1,
        timeout: 60000,
        idleTimeout: 300000
      }
    },
    
    production: {
      host: process.env.OCI_DB_PROD_HOST,
      port: process.env.OCI_DB_PROD_PORT || 1521,
      serviceName: process.env.OCI_DB_PROD_SERVICE_NAME,
      username: process.env.OCI_DB_PROD_USERNAME,
      password: process.env.OCI_DB_PROD_PASSWORD,
      walletLocation: process.env.OCI_DB_PROD_WALLET_PATH,
      pool: {
        min: 2,
        max: 15,
        increment: 2,
        timeout: 60000,
        idleTimeout: 300000
      }
    }
  },

  mcp: {
    server: {
      name: 'career-navigator-mcp',
      version: '1.0.0'
    },
    tools: [
      'store_experience',
      'get_quick_context',
      'get_detailed_profile',
      'search_experiences',
      'update_profile'
    ],
    performance: {
      quickContextTimeout: 10, // ms
      profileContextTimeout: 50, // ms
      detailedContextTimeout: 200 // ms
    }
  },

  security: {
    encryptionKey: process.env.MCP_ENCRYPTION_KEY,
    sessionTimeout: parseInt(process.env.MCP_SESSION_TIMEOUT) || 3600000,
    maxRetries: 3
  },

  logging: {
    level: process.env.LOG_LEVEL || (config.environment === 'production' ? 'info' : 'debug'),
    enableQueryLogging: process.env.ENABLE_QUERY_LOGGING === 'true'
  }
};

module.exports = config;
```

### Environment Variables Configuration

Create environment-specific configuration files:

#### Development Environment (.env.development)
```bash
# Environment
NODE_ENV=development

# Oracle Autonomous Database - Development
OCI_DB_DEV_HOST=your-dev-instance.adb.us-ashburn-1.oraclecloud.com
OCI_DB_DEV_PORT=1521
OCI_DB_DEV_SERVICE_NAME=your_dev_service_high
OCI_DB_DEV_USERNAME=ADMIN
OCI_DB_DEV_PASSWORD=YourDevPassword123!
OCI_DB_DEV_WALLET_PATH=./wallets/dev-wallet

# MCP Configuration
MCP_ENCRYPTION_KEY=dev-encryption-key-32-chars-long
MCP_SESSION_TIMEOUT=3600000
LOG_LEVEL=debug
ENABLE_QUERY_LOGGING=true
```

#### Production Environment (.env.production)
```bash
# Environment
NODE_ENV=production

# Oracle Autonomous Database - Production
OCI_DB_PROD_HOST=your-prod-instance.adb.us-ashburn-1.oraclecloud.com
OCI_DB_PROD_PORT=1521
OCI_DB_PROD_SERVICE_NAME=your_prod_service_high
OCI_DB_PROD_USERNAME=ADMIN
OCI_DB_PROD_PASSWORD=YourProdPassword456!
OCI_DB_PROD_WALLET_PATH=./wallets/prod-wallet

# MCP Configuration
MCP_ENCRYPTION_KEY=prod-encryption-key-32-chars-long
MCP_SESSION_TIMEOUT=1800000
LOG_LEVEL=info
ENABLE_QUERY_LOGGING=false
```

### Database Connection Manager

```javascript
// lib/database.js
const oracledb = require('oracledb');
const config = require('../config/mcp-config');

class DatabaseManager {
  constructor() {
    this.pool = null;
    this.environment = config.environment;
    this.dbConfig = config.database[this.environment];
  }

  async initialize() {
    try {
      // Set Oracle client library location if needed
      if (process.platform === 'linux') {
        oracledb.initOracleClient();
      }

      // Create connection pool
      this.pool = await oracledb.createPool({
        user: this.dbConfig.username,
        password: this.dbConfig.password,
        connectString: `${this.dbConfig.host}:${this.dbConfig.port}/${this.dbConfig.serviceName}`,
        poolMin: this.dbConfig.pool.min,
        poolMax: this.dbConfig.pool.max,
        poolIncrement: this.dbConfig.pool.increment,
        poolTimeout: this.dbConfig.pool.timeout,
        enableStatistics: true,
        walletLocation: this.dbConfig.walletLocation,
        walletPassword: '' // Empty for auto-login wallet
      });

      console.log(`✅ Database pool initialized for ${this.environment} environment`);
      console.log(`   Pool size: ${this.dbConfig.pool.min}-${this.dbConfig.pool.max} connections`);
      
    } catch (error) {
      console.error(`❌ Failed to initialize database pool for ${this.environment}:`, error);
      throw error;
    }
  }

  async getConnection() {
    if (!this.pool) {
      throw new Error('Database pool not initialized');
    }
    
    return await this.pool.getConnection();
  }

  async close() {
    if (this.pool) {
      await this.pool.close(10);
      console.log(`🔌 Database pool closed for ${this.environment} environment`);
    }
  }

  // Health check method
  async healthCheck() {
    const connection = await this.getConnection();
    try {
      const result = await connection.execute('SELECT 1 FROM DUAL');
      return { status: 'healthy', environment: this.environment };
    } catch (error) {
      return { status: 'unhealthy', environment: this.environment, error: error.message };
    } finally {
      await connection.close();
    }
  }
}

module.exports = new DatabaseManager();
```

### MCP Server Implementation

```javascript
// server/mcp-server.js
const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const DatabaseManager = require('../lib/database');
const config = require('../config/mcp-config');

class CareerNavigatorMCP {
  constructor() {
    this.server = new Server(
      {
        name: config.mcp.server.name,
        version: config.mcp.server.version,
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupTools();
  }

  setupTools() {
    // Store Experience Tool
    this.server.setRequestHandler('tools/call', async (request) => {
      if (request.params.name === 'store_experience') {
        return await this.storeExperience(request.params.arguments);
      }
      if (request.params.name === 'get_quick_context') {
        return await this.getQuickContext();
      }
      if (request.params.name === 'get_detailed_profile') {
        return await this.getDetailedProfile();
      }
      if (request.params.name === 'search_experiences') {
        return await this.searchExperiences(request.params.arguments);
      }
      if (request.params.name === 'update_profile') {
        return await this.updateProfile(request.params.arguments);
      }
      
      throw new Error(`Unknown tool: ${request.params.name}`);
    });

    // List available tools
    this.server.setRequestHandler('tools/list', async () => {
      return {
        tools: [
          {
            name: 'store_experience',
            description: 'Store a new professional experience',
            inputSchema: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                organization: { type: 'string' },
                description: { type: 'string' },
                startDate: { type: 'string', format: 'date' },
                endDate: { type: 'string', format: 'date' },
                isCurrent: { type: 'boolean' },
                experienceType: { 
                  type: 'string', 
                  enum: ['work', 'education', 'volunteer', 'project', 'hobby', 'certification']
                }
              },
              required: ['title', 'description', 'startDate', 'experienceType']
            }
          },
          {
            name: 'get_quick_context',
            description: 'Get quick professional summary for conversation context',
            inputSchema: { type: 'object', properties: {} }
          },
          {
            name: 'get_detailed_profile',
            description: 'Get comprehensive professional profile',
            inputSchema: { type: 'object', properties: {} }
          },
          {
            name: 'search_experiences',
            description: 'Search through professional experiences',
            inputSchema: {
              type: 'object',
              properties: {
                query: { type: 'string' },
                experienceType: { type: 'string' },
                dateRange: { type: 'object' }
              },
              required: ['query']
            }
          },
          {
            name: 'update_profile',
            description: 'Update profile summaries and quick context',
            inputSchema: { type: 'object', properties: {} }
          }
        ]
      };
    });
  }

  async storeExperience(args) {
    const startTime = Date.now();
    const connection = await DatabaseManager.getConnection();
    
    try {
      const result = await connection.execute(`
        INSERT INTO experiences_detailed (
          title, organization, description, start_date, end_date, 
          is_current, experience_type, created_at, updated_at
        ) VALUES (
          :title, :organization, :description, TO_DATE(:startDate, 'YYYY-MM-DD'), 
          TO_DATE(:endDate, 'YYYY-MM-DD'), :isCurrent, :experienceType, 
          CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
      `, {
        title: args.title,
        organization: args.organization || null,
        description: args.description,
        startDate: args.startDate,
        endDate: args.endDate || null,
        isCurrent: args.isCurrent ? 1 : 0,
        experienceType: args.experienceType
      }, { autoCommit: true });

      // Trigger profile aggregation (async)
      this.triggerProfileAggregation();

      return {
        content: [{
          type: 'text',
          text: `Experience "${args.title}" stored successfully. Rows affected: ${result.rowsAffected}`
        }]
      };
    } catch (error) {
      console.error('Error storing experience:', error);
      throw error;
    } finally {
      await connection.close();
      const duration = Date.now() - startTime;
      console.log(`Store experience completed in ${duration}ms`);
    }
  }

  async getQuickContext() {
    const startTime = Date.now();
    const connection = await DatabaseManager.getConnection();
    
    try {
      const result = await connection.execute(`
        SELECT 
          executive_summary,
          JSON_VALUE(key_skills, '$') as key_skills,
          career_goals,
          years_experience,
          current_role,
          JSON_VALUE(industries, '$') as industries,
          education_level,
          location,
          availability,
          last_updated
        FROM quick_summaries
        WHERE ROWNUM = 1
        ORDER BY last_updated DESC
      `);

      if (result.rows.length === 0) {
        return {
          content: [{
            type: 'text',
            text: 'No quick context available. Please update your profile first.'
          }]
        };
      }

      const context = result.rows[0];
      const responseTime = Date.now() - startTime;
      
      // Check if we met our performance target
      if (responseTime > config.mcp.performance.quickContextTimeout) {
        console.warn(`⚠️ Quick context query exceeded target (${responseTime}ms > ${config.mcp.performance.quickContextTimeout}ms)`);
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            executiveSummary: context[0],
            keySkills: JSON.parse(context[1] || '[]'),
            careerGoals: context[2],
            yearsExperience: context[3],
            currentRole: context[4],
            industries: JSON.parse(context[5] || '[]'),
            educationLevel: context[6],
            location: context[7],
            availability: context[8],
            lastUpdated: context[9],
            responseTime: `${responseTime}ms`
          }, null, 2)
        }]
      };
    } catch (error) {
      console.error('Error getting quick context:', error);
      throw error;
    } finally {
      await connection.close();
    }
  }

  async triggerProfileAggregation() {
    // This would typically be an async background job
    // For now, we'll just log that aggregation should occur
    console.log(`📊 Profile aggregation triggered for ${config.environment} environment`);
  }

  async start() {
    try {
      await DatabaseManager.initialize();
      
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      
      console.log(`🚀 Career Navigator MCP Server started in ${config.environment} mode`);
      console.log(`   Database: ${config.database[config.environment].host}`);
      console.log(`   Tools: ${config.mcp.tools.join(', ')}`);
      
    } catch (error) {
      console.error('Failed to start MCP server:', error);
      process.exit(1);
    }
  }
}

// Start server
const server = new CareerNavigatorMCP();
server.start();
```

### Environment Switching Script

```bash
#!/bin/bash
# scripts/switch-env.sh

ENV=${1:-development}

if [ "$ENV" != "development" ] && [ "$ENV" != "production" ]; then
    echo "❌ Invalid environment. Use 'development' or 'production'"
    exit 1
fi

echo "🔄 Switching to $ENV environment..."

# Copy appropriate environment file
cp .env.$ENV .env

# Verify wallet files exist
if [ "$ENV" = "development" ]; then
    WALLET_PATH="./wallets/dev-wallet"
else
    WALLET_PATH="./wallets/prod-wallet"
fi

if [ ! -d "$WALLET_PATH" ]; then
    echo "⚠️  Warning: Wallet directory $WALLET_PATH not found"
    echo "   Please ensure Oracle wallet files are properly installed"
fi

echo "✅ Environment switched to $ENV"
echo "   Config file: .env.$ENV → .env"
echo "   Wallet path: $WALLET_PATH"
echo ""
echo "🚀 Start MCP server with: npm run mcp:start"
```

### Package.json Scripts

```json
{
  "scripts": {
    "mcp:start": "node server/mcp-server.js",
    "mcp:dev": "NODE_ENV=development node server/mcp-server.js",
    "mcp:prod": "NODE_ENV=production node server/mcp-server.js",
    "env:dev": "./scripts/switch-env.sh development",
    "env:prod": "./scripts/switch-env.sh production",
    "db:health": "node scripts/db-health-check.js",
    "db:test-connection": "node scripts/test-connection.js"
  }
}
```

### Health Check Script

```javascript
// scripts/db-health-check.js
const DatabaseManager = require('../lib/database');

async function healthCheck() {
  try {
    await DatabaseManager.initialize();
    const health = await DatabaseManager.healthCheck();
    
    console.log('🏥 Database Health Check');
    console.log(`   Environment: ${health.environment}`);
    console.log(`   Status: ${health.status}`);
    
    if (health.error) {
      console.log(`   Error: ${health.error}`);
    }
    
    await DatabaseManager.close();
    process.exit(health.status === 'healthy' ? 0 : 1);
    
  } catch (error) {
    console.error('❌ Health check failed:', error);
    process.exit(1);
  }
}

healthCheck();
```

This configuration provides:

1. **Environment Separation**: Clear dev/prod database switching
2. **Secure Credential Management**: Environment variables for all sensitive data
3. **Performance Monitoring**: Built-in timing and performance tracking
4. **Connection Pooling**: Optimized for MCP conversation patterns
5. **Health Checks**: Database connectivity verification
6. **Easy Environment Switching**: Scripts for seamless environment changes

The MCP server will automatically use the appropriate database based on the NODE_ENV setting, ensuring clean separation between development testing and production usage.