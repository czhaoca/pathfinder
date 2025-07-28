/**
 * MCP Server Configuration
 * Environment-based configuration for Oracle Autonomous Database connections
 */

require('dotenv').config();

const environment = process.env.NODE_ENV || 'development';

// Project configuration for shared database environments
const projectConfig = {
  name: 'pathfinder',
  tablePrefix: process.env.TABLE_PREFIX || 'skill_', // Skill development prefix
  schemaPrefix: process.env.SCHEMA_PREFIX || 'skill_user_',
  version: '1.0.0',
  database: {
    // Separate table space for this project in shared databases
    development: {
      tableSpace: process.env.DEV_TABLESPACE || 'SKILL_DEV_DATA',
      tempTableSpace: process.env.DEV_TEMP_TABLESPACE || 'SKILL_DEV_TEMP'
    },
    production: {
      tableSpace: process.env.PROD_TABLESPACE || 'SKILL_PROD_DATA',
      tempTableSpace: process.env.PROD_TEMP_TABLESPACE || 'SKILL_PROD_TEMP'
    }
  }
};

const config = {
  environment,
  project: projectConfig,
  
  database: {
    development: {
      host: process.env.OCI_DB_DEV_HOST,
      port: parseInt(process.env.OCI_DB_DEV_PORT) || 1521,
      serviceName: process.env.OCI_DB_DEV_SERVICE_NAME,
      username: process.env.OCI_DB_DEV_USERNAME || 'ADMIN',
      password: process.env.OCI_DB_DEV_PASSWORD,
      walletLocation: process.env.OCI_DB_DEV_WALLET_PATH || './wallets/dev-wallet',
      walletPassword: process.env.OCI_DB_DEV_WALLET_PASSWORD || '',
      pool: {
        min: 2,
        max: 8,
        increment: 1,
        timeout: 60000,
        idleTimeout: 300000,
        pingInterval: 60,
        enableStatistics: true
      },
      options: {
        autoCommit: false,
        fetchAsString: ['CLOB'],
        outFormat: 4002 // oracledb.OUT_FORMAT_OBJECT
      },
      // Project-specific settings for shared database
      projectSettings: {
        tablePrefix: projectConfig.tablePrefix,
        schemaPrefix: projectConfig.schemaPrefix,
        tableSpace: projectConfig.database.development.tableSpace,
        tempTableSpace: projectConfig.database.development.tempTableSpace,
        isolationLevel: 'schema' // Options: 'schema', 'prefix', 'tablespace'
      }
    },
    
    production: {
      host: process.env.OCI_DB_PROD_HOST,
      port: parseInt(process.env.OCI_DB_PROD_PORT) || 1521,
      serviceName: process.env.OCI_DB_PROD_SERVICE_NAME,
      username: process.env.OCI_DB_PROD_USERNAME || 'ADMIN',
      password: process.env.OCI_DB_PROD_PASSWORD,
      walletLocation: process.env.OCI_DB_PROD_WALLET_PATH || './wallets/prod-wallet',
      walletPassword: process.env.OCI_DB_PROD_WALLET_PASSWORD || '',
      pool: {
        min: 2,
        max: 15,
        increment: 2,
        timeout: 60000,
        idleTimeout: 300000,
        pingInterval: 60,
        enableStatistics: true
      },
      options: {
        autoCommit: false,
        fetchAsString: ['CLOB'],
        outFormat: 4002 // oracledb.OUT_FORMAT_OBJECT
      },
      // Project-specific settings for shared database
      projectSettings: {
        tablePrefix: projectConfig.tablePrefix,
        schemaPrefix: projectConfig.schemaPrefix,
        tableSpace: projectConfig.database.production.tableSpace,
        tempTableSpace: projectConfig.database.production.tempTableSpace,
        isolationLevel: 'schema' // Options: 'schema', 'prefix', 'tablespace'
      }
    }
  },

  mcp: {
    server: {
      name: 'pathfinder-mcp',
      version: '1.0.0',
      description: 'Career Navigator Model Context Protocol Server'
    },
    tools: [
      'store_experience',
      'get_quick_context',
      'get_detailed_profile',
      'search_experiences',
      'update_profile',
      'get_skills_analysis',
      'get_career_suggestions'
    ],
    performance: {
      quickContextTimeout: 10, // ms
      profileContextTimeout: 50, // ms
      detailedContextTimeout: 200, // ms
      maxRetries: 3,
      retryDelay: 1000 // ms
    },
    limits: {
      maxExperiences: 100,
      maxDescriptionLength: 5000,
      maxSkillsPerExperience: 20,
      maxHighlightsPerExperience: 10
    }
  },

  security: {
    encryptionKey: process.env.MCP_ENCRYPTION_KEY,
    sessionTimeout: parseInt(process.env.MCP_SESSION_TIMEOUT) || 3600000, // 1 hour
    maxRetries: 3,
    rateLimiting: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 100 // per window
    }
  },

  logging: {
    level: process.env.LOG_LEVEL || (environment === 'production' ? 'info' : 'debug'),
    enableQueryLogging: process.env.ENABLE_QUERY_LOGGING === 'true',
    logFile: process.env.LOG_FILE || null,
    enablePerformanceLogging: true
  },

  monitoring: {
    enableHealthCheck: true,
    healthCheckInterval: 30000, // 30 seconds
    performanceMetrics: {
      enabled: true,
      collectInterval: 60000, // 1 minute
      retentionPeriod: 24 * 60 * 60 * 1000 // 24 hours
    }
  }
};

// Validation
function validateConfig() {
  const currentDbConfig = config.database[environment];
  
  const required = ['password', 'serviceName'];
  const missing = required.filter(key => !currentDbConfig[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required configuration for ${environment}: ${missing.join(', ')}`);
  }
  
  if (config.security.encryptionKey && config.security.encryptionKey.length < 32) {
    throw new Error('Encryption key must be at least 32 characters long');
  }
}

// Initialize configuration
try {
  // Skip validation in test environment
  if (environment !== 'test') {
    validateConfig();
  }
} catch (error) {
  console.error('❌ Configuration validation failed:', error.message);
  process.exit(1);
}

module.exports = config;