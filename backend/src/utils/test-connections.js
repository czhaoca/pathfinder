#!/usr/bin/env node

/**
 * Connection Test Script
 * Tests both development and production database connections
 */

const oracledb = require('oracledb');
const fs = require('fs');
const path = require('path');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function colorize(text, color) {
  return `${colors[color]}${text}${colors.reset}`;
}

function printHeader(title) {
  console.log('\n' + colorize('='.repeat(60), 'cyan'));
  console.log(colorize(`  ${title}`, 'cyan'));
  console.log(colorize('='.repeat(60), 'cyan'));
}

function printSuccess(message) {
  console.log(colorize(`✅ ${message}`, 'green'));
}

function printError(message) {
  console.log(colorize(`❌ ${message}`, 'red'));
}

function printWarning(message) {
  console.log(colorize(`⚠️  ${message}`, 'yellow'));
}

function printInfo(message) {
  console.log(colorize(`ℹ️  ${message}`, 'blue'));
}

/**
 * Load environment configuration
 */
function loadEnvironmentConfig(env) {
  const envFile = `.env.${env}`;
  
  if (!fs.existsSync(envFile)) {
    throw new Error(`Environment file not found: ${envFile}`);
  }
  
  // Read and parse environment file
  const envContent = fs.readFileSync(envFile, 'utf8');
  const envVars = {};
  
  envContent.split('\n').forEach(line => {
    line = line.trim();
    if (line && !line.startsWith('#')) {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length > 0) {
        envVars[key.trim()] = valueParts.join('=').trim();
      }
    }
  });
  
  return envVars;
}

/**
 * Get database configuration for environment
 */
function getDatabaseConfig(env) {
  const envVars = loadEnvironmentConfig(env);
  
  const prefix = env === 'development' ? 'OCI_DB_DEV' : 'OCI_DB_PROD';
  const walletPath = env === 'development' ? './wallets/dev-wallet' : './wallets/prod-wallet';
  
  return {
    user: envVars[`${prefix}_USERNAME`] || 'ADMIN',
    password: envVars[`${prefix}_PASSWORD`],
    connectString: envVars[`${prefix}_SERVICE_NAME`],
    walletLocation: envVars[`${prefix}_WALLET_PATH`] || walletPath,
    walletPassword: envVars[`${prefix}_WALLET_PASSWORD`] || ''
  };
}

/**
 * Initialize Oracle Client
 */
function initializeOracleClient() {
  try {
    if (process.platform === 'linux' || process.platform === 'darwin') {
      oracledb.initOracleClient();
      printInfo('Oracle client initialized (thick mode)');
    }
  } catch (error) {
    printInfo('Oracle client already initialized or using thin mode');
  }
}

/**
 * Test database connection
 */
async function testConnection(env) {
  console.log(colorize(`\n🧪 Testing ${env} environment...`, 'blue'));
  console.log(colorize('-'.repeat(40), 'blue'));
  
  try {
    const config = getDatabaseConfig(env);
    
    // Validate required fields
    if (!config.password) {
      throw new Error(`Missing password for ${env} environment`);
    }
    
    if (!config.connectString) {
      throw new Error(`Missing service name for ${env} environment`);
    }
    
    // Check wallet location
    if (!fs.existsSync(config.walletLocation)) {
      throw new Error(`Wallet location not found: ${config.walletLocation}`);
    }
    
    printInfo(`Connecting to: ${config.connectString}`);
    printInfo(`Using wallet: ${config.walletLocation}`);
    printInfo(`Username: ${config.user}`);
    
    // Test connection
    const startTime = Date.now();
    const connection = await oracledb.getConnection(config);
    const connectionTime = Date.now() - startTime;
    
    printSuccess(`Connection established in ${connectionTime}ms`);
    
    // Test basic query
    const queryStart = Date.now();
    const result = await connection.execute('SELECT 1 as test, CURRENT_TIMESTAMP as current_time FROM DUAL');
    const queryTime = Date.now() - queryStart;
    
    printSuccess(`Query executed in ${queryTime}ms`);
    
    // Show database info
    const versionResult = await connection.execute('SELECT BANNER FROM V$VERSION WHERE ROWNUM = 1');
    if (versionResult.rows.length > 0) {
      const version = versionResult.rows[0].BANNER || versionResult.rows[0][0];
      console.log(`   Database: ${version}`);
    }
    
    // Test table existence
    const tableResult = await connection.execute(`
      SELECT COUNT(*) as table_count 
      FROM user_tables 
      WHERE table_name IN ('EXPERIENCES_DETAILED', 'PROFILE_SUMMARIES', 'QUICK_SUMMARIES')
    `);
    
    const tableCount = tableResult.rows[0].TABLE_COUNT || tableResult.rows[0][0];
    console.log(`   Schema tables: ${tableCount}/3 found`);
    
    if (tableCount === 0) {
      printWarning('No schema tables found - run setup: npm run db:setup');
    } else if (tableCount < 3) {
      printWarning('Partial schema found - consider re-running setup');
    } else {
      printSuccess('Complete schema found');
    }
    
    await connection.close();
    
    return {
      success: true,
      connectionTime,
      queryTime,
      tableCount: parseInt(tableCount)
    };
    
  } catch (error) {
    printError(`Connection failed: ${error.message}`);
    
    // Provide specific troubleshooting
    if (error.message.includes('ORA-01017')) {
      console.log('   🔧 Check username/password in environment file');
    } else if (error.message.includes('TNS-')) {
      console.log('   🔧 Check service name and wallet configuration');
    } else if (error.message.includes('wallet')) {
      console.log('   🔧 Verify wallet files are extracted correctly');
    } else if (error.message.includes('ENOTFOUND')) {
      console.log('   🔧 Check network connectivity and hostname resolution');
    }
    
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Performance comparison test
 */
async function performanceComparison(devResult, prodResult) {
  if (!devResult.success || !prodResult.success) {
    return;
  }
  
  console.log(colorize('\n📊 Performance Comparison', 'cyan'));
  console.log(colorize('-'.repeat(30), 'cyan'));
  
  console.log(`Connection Time:`);
  console.log(`   Development: ${devResult.connectionTime}ms`);
  console.log(`   Production:  ${prodResult.connectionTime}ms`);
  
  console.log(`Query Time:`);
  console.log(`   Development: ${devResult.queryTime}ms`);
  console.log(`   Production:  ${prodResult.queryTime}ms`);
  
  console.log(`Schema Status:`);
  console.log(`   Development: ${devResult.tableCount}/3 tables`);
  console.log(`   Production:  ${prodResult.tableCount}/3 tables`);
  
  // Performance recommendations
  const totalDevTime = devResult.connectionTime + devResult.queryTime;
  const totalProdTime = prodResult.connectionTime + prodResult.queryTime;
  
  if (totalDevTime < 100 && totalProdTime < 100) {
    printSuccess('Both environments show excellent performance');
  } else if (totalDevTime > 200 || totalProdTime > 200) {
    printWarning('Consider optimizing connection pooling for slower environment');
  }
}

/**
 * Show environment recommendations
 */
function showRecommendations(devResult, prodResult) {
  console.log(colorize('\n💡 Recommendations', 'cyan'));
  console.log(colorize('-'.repeat(20), 'cyan'));
  
  if (devResult.success && prodResult.success) {
    printSuccess('Both environments are ready for MCP server deployment');
    console.log('\nNext steps:');
    console.log('   • Start development: npm run mcp:dev');
    console.log('   • Deploy to production: npm run mcp:prod');
    console.log('   • Monitor performance: npm run db:health');
  } else if (devResult.success) {
    printInfo('Development environment is ready');
    console.log('   • Fix production configuration');
    console.log('   • Use development for testing: npm run mcp:dev');
  } else if (prodResult.success) {
    printInfo('Production environment is ready');
    console.log('   • Fix development configuration');
    console.log('   • Consider using production for testing (carefully)');
  } else {
    printError('Both environments need configuration fixes');
    console.log('\nTroubleshooting steps:');
    console.log('   1. Check environment files: .env.development, .env.production');
    console.log('   2. Verify wallet files in wallets/ directory');
    console.log('   3. Test Oracle client: node -e "console.log(require(\'oracledb\').versionString)"');
    console.log('   4. Review OCI provisioning guide');
  }
  
  // Schema-specific recommendations
  const bothHaveSchema = devResult.success && prodResult.success && 
                         devResult.tableCount === 3 && prodResult.tableCount === 3;
  
  if (!bothHaveSchema) {
    console.log('\nSchema setup needed:');
    if (devResult.success && devResult.tableCount < 3) {
      console.log('   • Development: npm run db:setup:dev');
    }
    if (prodResult.success && prodResult.tableCount < 3) {
      console.log('   • Production: npm run db:setup:prod');
    }
  }
}

/**
 * Main test function
 */
async function main() {
  printHeader('Career Navigator MCP Connection Test');
  
  try {
    initializeOracleClient();
    
    // Test both environments
    const devResult = await testConnection('development');
    const prodResult = await testConnection('production');
    
    // Show comparison and recommendations
    await performanceComparison(devResult, prodResult);
    showRecommendations(devResult, prodResult);
    
    // Summary
    console.log(colorize('\n📝 Test Summary', 'cyan'));
    console.log(colorize('-'.repeat(15), 'cyan'));
    
    const successCount = [devResult.success, prodResult.success].filter(Boolean).length;
    
    if (successCount === 2) {
      printSuccess('All connections successful! 🎉');
    } else if (successCount === 1) {
      printWarning('Partial success - fix remaining issues');
    } else {
      printError('All connections failed - check configuration');
    }
    
    process.exit(successCount > 0 ? 0 : 1);
    
  } catch (error) {
    printError(`Connection test failed: ${error.message}`);
    
    console.log('\n🔧 General troubleshooting:');
    console.log('   • Ensure environment files exist (.env.development, .env.production)');
    console.log('   • Download and extract Oracle wallet files');
    console.log('   • Check database credentials and service names');
    console.log('   • Verify network connectivity to OCI');
    
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { main, testConnection };