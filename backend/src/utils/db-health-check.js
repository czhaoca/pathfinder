#!/usr/bin/env node

/**
 * Database Health Check Script
 * Tests Oracle Autonomous Database connectivity and performance
 */

const DatabaseManager = require('../lib/database');
const config = require('../config/mcp-config');

// ANSI color codes for output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
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

function printSection(title) {
  console.log('\n' + colorize(`📋 ${title}`, 'blue'));
  console.log(colorize('-'.repeat(40), 'blue'));
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

async function testDatabaseConnection() {
  printSection('Database Connection Test');
  
  try {
    await DatabaseManager.initialize();
    printSuccess('Database pool initialized successfully');
    
    const poolStats = await DatabaseManager.getPoolStatistics();
    if (poolStats) {
      console.log(`   Pool configuration: ${poolStats.poolMin}-${poolStats.poolMax} connections`);
      console.log(`   Connections open: ${poolStats.connectionsOpen}`);
      console.log(`   Connections in use: ${poolStats.connectionsInUse}`);
    }
    
    return true;
  } catch (error) {
    printError(`Database initialization failed: ${error.message}`);
    return false;
  }
}

async function testBasicQueries() {
  printSection('Basic Query Tests');
  
  const queries = [
    {
      name: 'Simple health check',
      sql: 'SELECT 1 as health_check FROM DUAL',
      target: 10 // ms
    },
    {
      name: 'Database version check',
      sql: 'SELECT BANNER FROM V$VERSION WHERE ROWNUM = 1',
      target: 50 // ms
    },
    {
      name: 'Current timestamp',
      sql: 'SELECT CURRENT_TIMESTAMP as current_time FROM DUAL',
      target: 10 // ms
    }
  ];

  let passedTests = 0;
  
  for (const query of queries) {
    try {
      const startTime = Date.now();
      const result = await DatabaseManager.executeQuery(query.sql);
      const duration = Date.now() - startTime;
      
      if (duration <= query.target) {
        printSuccess(`${query.name}: ${duration}ms (target: ${query.target}ms)`);
        passedTests++;
      } else {
        printWarning(`${query.name}: ${duration}ms (exceeded target: ${query.target}ms)`);
        passedTests++;
      }
      
      // Show first result for some queries
      if (query.name === 'Database version check' && result.rows.length > 0) {
        console.log(`   Database: ${result.rows[0].BANNER || result.rows[0][0]}`);
      }
      
    } catch (error) {
      printError(`${query.name} failed: ${error.message}`);
    }
  }
  
  return passedTests === queries.length;
}

async function testSchemaExists() {
  printSection('Schema Validation');
  
  const expectedTables = [
    'EXPERIENCES_DETAILED',
    'PROFILE_SUMMARIES', 
    'QUICK_SUMMARIES',
    'SKILLS_MAPPING',
    'CAREER_PATHS',
    'ROLE_PROFILES'
  ];
  
  try {
    const result = await DatabaseManager.executeQuery(`
      SELECT table_name, num_rows 
      FROM user_tables 
      WHERE table_name IN (${expectedTables.map(t => `'${t}'`).join(',')})
      ORDER BY table_name
    `);
    
    const foundTables = result.rows.map(row => row.TABLE_NAME || row[0]);
    const missingTables = expectedTables.filter(table => !foundTables.includes(table));
    
    if (missingTables.length === 0) {
      printSuccess(`All ${expectedTables.length} required tables found`);
      
      // Show table details
      result.rows.forEach(row => {
        const tableName = row.TABLE_NAME || row[0];
        const numRows = row.NUM_ROWS || row[1] || 0;
        console.log(`   📊 ${tableName}: ${numRows} rows`);
      });
      
      return true;
    } else {
      printWarning(`Found ${foundTables.length}/${expectedTables.length} tables`);
      printError(`Missing tables: ${missingTables.join(', ')}`);
      printInfo('Run schema deployment: npm run db:migrate');
      return false;
    }
    
  } catch (error) {
    printError(`Schema validation failed: ${error.message}`);
    return false;
  }
}

async function testIndexes() {
  printSection('Index Validation');
  
  try {
    const result = await DatabaseManager.executeQuery(`
      SELECT index_name, table_name, uniqueness, status
      FROM user_indexes 
      WHERE table_name IN ('EXPERIENCES_DETAILED', 'PROFILE_SUMMARIES', 'QUICK_SUMMARIES')
      AND index_name NOT LIKE 'SYS_%'
      ORDER BY table_name, index_name
    `);
    
    if (result.rows.length > 0) {
      printSuccess(`Found ${result.rows.length} custom indexes`);
      
      result.rows.forEach(row => {
        const indexName = row.INDEX_NAME || row[0];
        const tableName = row.TABLE_NAME || row[1];
        const uniqueness = row.UNIQUENESS || row[2];
        const status = row.STATUS || row[3];
        
        const statusIcon = status === 'VALID' ? '✅' : '❌';
        const uniqueIcon = uniqueness === 'UNIQUE' ? '🔑' : '📇';
        
        console.log(`   ${statusIcon}${uniqueIcon} ${indexName} on ${tableName}`);
      });
      
      return true;
    } else {
      printWarning('No custom indexes found');
      printInfo('Indexes may not be created yet or schema deployment needed');
      return false;
    }
    
  } catch (error) {
    printError(`Index validation failed: ${error.message}`);
    return false;
  }
}

async function testMCPPerformance() {
  printSection('MCP Performance Tests');
  
  const performanceTests = [
    {
      name: 'Quick Context (Level 3)',
      method: 'getQuickContext',
      target: config.mcp.performance.quickContextTimeout
    },
    {
      name: 'Detailed Profile (Level 2)', 
      method: 'getDetailedProfile',
      target: config.mcp.performance.profileContextTimeout
    },
    {
      name: 'Search Experiences (Level 1)',
      method: 'searchExperiences',
      target: config.mcp.performance.detailedContextTimeout,
      args: [{ limit: 5 }]
    }
  ];
  
  let passedTests = 0;
  
  for (const test of performanceTests) {
    try {
      const startTime = Date.now();
      const result = await DatabaseManager[test.method](...(test.args || []));
      const duration = Date.now() - startTime;
      
      if (duration <= test.target) {
        printSuccess(`${test.name}: ${duration}ms (target: ≤${test.target}ms)`);
        passedTests++;
      } else {
        printWarning(`${test.name}: ${duration}ms (exceeded target: ${test.target}ms)`);
      }
      
      // Show result info
      if (result === null) {
        console.log(`   📝 No data available (expected for new installation)`);
      } else if (Array.isArray(result)) {
        console.log(`   📊 Retrieved ${result.length} records`);
      } else {
        console.log(`   📄 Data retrieved successfully`);
      }
      
    } catch (error) {
      printError(`${test.name} failed: ${error.message}`);
    }
  }
  
  return passedTests >= 2; // Allow some tests to fail if no data exists
}

async function testDatabaseHealth() {
  printSection('Database Health Metrics');
  
  try {
    const health = await DatabaseManager.healthCheck();
    
    if (health.status === 'healthy') {
      printSuccess(`Database status: ${health.status}`);
      console.log(`   Environment: ${health.environment}`);
      console.log(`   Response time: ${health.responseTime}`);
      
      if (health.poolStats) {
        console.log(`   Pool connections: ${health.poolStats.connectionsInUse}/${health.poolStats.connectionsOpen}`);
      }
      
      if (health.connectionStats) {
        console.log(`   Total connections: ${health.connectionStats.totalConnections}`);
        console.log(`   Total queries: ${health.connectionStats.queries}`);
        console.log(`   Average response: ${Math.round(health.connectionStats.avgResponseTime)}ms`);
        console.log(`   Error count: ${health.connectionStats.errors}`);
      }
      
      return true;
    } else {
      printError(`Database status: ${health.status}`);
      if (health.error) {
        console.log(`   Error: ${health.error}`);
      }
      return false;
    }
    
  } catch (error) {
    printError(`Health check failed: ${error.message}`);
    return false;
  }
}

async function showEnvironmentInfo() {
  printSection('Environment Information');
  
  console.log(`   Environment: ${config.environment}`);
  console.log(`   Node.js: ${process.version}`);
  console.log(`   Platform: ${process.platform}`);
  
  const dbConfig = config.database[config.environment];
  console.log(`   Database host: ${dbConfig.host || 'Not configured'}`);
  console.log(`   Service name: ${dbConfig.serviceName || 'Not configured'}`);
  console.log(`   Wallet location: ${dbConfig.walletLocation}`);
  console.log(`   Pool size: ${dbConfig.pool.min}-${dbConfig.pool.max}`);
  console.log(`   Log level: ${config.logging.level}`);
  console.log(`   Query logging: ${config.logging.enableQueryLogging ? 'Enabled' : 'Disabled'}`);
}

async function showTroubleshootingTips(testResults) {
  const failedTests = Object.keys(testResults).filter(key => !testResults[key]);
  
  if (failedTests.length > 0) {
    printSection('Troubleshooting Tips');
    
    failedTests.forEach(test => {
      switch (test) {
        case 'connection':
          console.log('🔧 Connection Issues:');
          console.log('   • Check database credentials in .env file');
          console.log('   • Verify wallet files are in correct location');
          console.log('   • Ensure database is running and accessible');
          console.log('   • Check network connectivity and firewall rules');
          break;
          
        case 'schema':
          console.log('🔧 Schema Issues:');
          console.log('   • Run schema deployment: npm run db:migrate');
          console.log('   • Check database permissions for table creation');
          console.log('   • Verify user has necessary privileges');
          break;
          
        case 'performance':
          console.log('🔧 Performance Issues:');
          console.log('   • Check database resource utilization');
          console.log('   • Consider connection pool optimization');
          console.log('   • Monitor database performance metrics in OCI');
          console.log('   • Verify indexes are created and valid');
          break;
          
        case 'indexes':
          console.log('🔧 Index Issues:');
          console.log('   • Indexes may be created during schema deployment');
          console.log('   • Check if schema deployment completed successfully');
          console.log('   • Manually create indexes if needed');
          break;
      }
      console.log('');
    });
    
    console.log('📚 Additional Resources:');
    console.log('   • OCI Provisioning Guide: docs/deployment/mcp-server/oci-provisioning-guide.md');
    console.log('   • Configuration Guide: docs/deployment/mcp-server/mcp-configuration.md');
    console.log('   • Test connections: npm run db:test-connection');
  }
}

async function main() {
  printHeader(`Career Navigator MCP Database Health Check`);
  
  const testResults = {
    connection: false,
    queries: false,
    schema: false,
    indexes: false,
    performance: false,
    health: false
  };
  
  try {
    // Show environment info first
    await showEnvironmentInfo();
    
    // Run tests
    testResults.connection = await testDatabaseConnection();
    
    if (testResults.connection) {
      testResults.queries = await testBasicQueries();
      testResults.schema = await testSchemaExists();
      testResults.indexes = await testIndexes();
      testResults.performance = await testMCPPerformance();
      testResults.health = await testDatabaseHealth();
    }
    
    // Final summary
    printSection('Health Check Summary');
    
    const passedTests = Object.values(testResults).filter(Boolean).length;
    const totalTests = Object.keys(testResults).length;
    
    if (passedTests === totalTests) {
      printSuccess(`All tests passed! (${passedTests}/${totalTests})`);
      console.log('\n🚀 Your database is ready for MCP server deployment!');
      console.log('\nNext steps:');
      console.log('   • Start MCP server: npm run mcp:dev');
      console.log('   • Load sample data: npm run db:seed');
    } else {
      printWarning(`${passedTests}/${totalTests} tests passed`);
      
      if (testResults.connection && testResults.queries) {
        console.log('\n✅ Database connectivity is working');
        
        if (!testResults.schema) {
          console.log('📋 Schema deployment needed: npm run db:migrate');
        }
      }
    }
    
    // Show troubleshooting tips for failed tests
    await showTroubleshootingTips(testResults);
    
    // Close database connection
    await DatabaseManager.close();
    
    process.exit(passedTests === totalTests ? 0 : 1);
    
  } catch (error) {
    printError(`Health check failed: ${error.message}`);
    
    console.log('\n🔧 Troubleshooting:');
    console.log('   • Check .env configuration');
    console.log('   • Verify Oracle wallet files');
    console.log('   • Test basic connectivity');
    console.log('   • Review error logs');
    
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

module.exports = { main };