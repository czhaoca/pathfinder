#!/usr/bin/env node

/**
 * Emergency Recovery Script
 * 
 * This script provides emergency access recovery when the site admin is locked out.
 * It requires physical server access and implements multiple authentication methods.
 * 
 * Usage:
 *   npm run recovery:emergency
 *   node scripts/emergency-recovery.js [--method=reset|unlock|temporary]
 * 
 * Security Requirements:
 *   - Physical server access (no SSH)
 *   - Recovery code or 2FA verification
 *   - All actions are audit logged
 */

const path = require('path');
const chalk = require('chalk');
const os = require('os');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

// Parse command line arguments
const args = process.argv.slice(2).reduce((acc, arg) => {
  const [key, value] = arg.replace('--', '').split('=');
  acc[key] = value || true;
  return acc;
}, {});

// Import services
const EmergencyRecovery = require('../src/services/emergencyRecovery');
const { initializeDatabase } = require('../src/database/connection');

async function main() {
  displayWarningBanner();
  
  try {
    // Step 1: Security checks
    performSecurityChecks();
    
    // Step 2: Initialize database
    console.log(chalk.yellow('\n📦 Initializing secure connection...'));
    await initializeDatabase();
    console.log(chalk.green('✓ Database connected'));
    
    // Step 3: Log recovery attempt
    await logRecoveryAttempt('initiated');
    
    // Step 4: Initialize recovery service
    const recovery = new EmergencyRecovery({
      requirePhysicalAccess: process.env.REQUIRE_PHYSICAL_ACCESS !== 'false',
      require2FA: process.env.REQUIRE_2FA_RECOVERY !== 'false',
      method: args.method
    });
    
    // Step 5: Execute recovery
    console.log(chalk.yellow('\n🔐 Starting emergency recovery process...\n'));
    const result = await recovery.initiateRecovery();
    
    // Step 6: Log success
    await logRecoveryAttempt('completed', result);
    
    // Step 7: Display success message
    displaySuccessBanner(result);
    
    process.exit(0);
    
  } catch (error) {
    console.error(chalk.red.bold('\n❌ Recovery failed:'), error.message);
    
    await logRecoveryAttempt('failed', null, error.message);
    
    if (error.message.includes('physical server access')) {
      console.log(chalk.red('\n🔒 Security Requirement:'));
      console.log(chalk.white('   Emergency recovery must be run from the server console.'));
      console.log(chalk.white('   SSH/remote connections are not permitted for security.'));
    }
    
    displayFailureBanner(error);
    process.exit(1);
  }
}

/**
 * Display warning banner
 */
function displayWarningBanner() {
  console.clear();
  console.log(chalk.red.bold('\n' + '='.repeat(70)));
  console.log(chalk.red.bold(' '.repeat(20) + '⚠️  SECURITY WARNING ⚠️'));
  console.log(chalk.red.bold('='.repeat(70)));
  
  console.log(chalk.yellow.bold('\nEMERGENCY RECOVERY MODE'));
  console.log(chalk.white('\nThis action will:'));
  console.log(chalk.white('  • Grant administrative access to the system'));
  console.log(chalk.white('  • Be permanently logged in audit trails'));
  console.log(chalk.white('  • Trigger security alerts to administrators'));
  console.log(chalk.white('  • Require justification for compliance'));
  
  console.log(chalk.yellow('\nRequirements:'));
  console.log(chalk.white('  • Physical server access (console)'));
  console.log(chalk.white('  • Valid recovery code or 2FA token'));
  console.log(chalk.white('  • Authorization from security team'));
  
  console.log(chalk.red.bold('\n' + '='.repeat(70)));
}

/**
 * Perform security checks
 */
function performSecurityChecks() {
  console.log(chalk.yellow('\n🔒 Performing security checks...'));
  
  // Check 1: Node environment
  if (process.env.NODE_ENV === 'production') {
    console.log(chalk.red('   ⚠️  Running in PRODUCTION environment'));
  }
  
  // Check 2: User running the script
  const currentUser = os.userInfo().username;
  console.log(chalk.gray(`   User: ${currentUser}`));
  
  // Check 3: Hostname
  const hostname = os.hostname();
  console.log(chalk.gray(`   Host: ${hostname}`));
  
  // Check 4: SSH detection
  if (process.env.SSH_CLIENT || process.env.SSH_TTY) {
    console.log(chalk.red('   ⚠️  SSH session detected'));
  }
  
  // Check 5: TTY availability
  if (!process.stdin.isTTY) {
    console.log(chalk.red('   ⚠️  No TTY available - may be automated execution'));
  }
  
  console.log(chalk.green('✓ Security checks completed'));
}

/**
 * Log recovery attempt to database
 */
async function logRecoveryAttempt(status, result = null, error = null) {
  try {
    const { query } = require('../src/database/connection');
    const auditService = require('../src/services/auditService');
    
    const metadata = {
      status,
      hostname: os.hostname(),
      user: os.userInfo().username,
      platform: os.platform(),
      node_version: process.version,
      timestamp: new Date().toISOString()
    };
    
    if (result) {
      metadata.result = {
        method: result.method,
        userId: result.userId,
        username: result.username
      };
    }
    
    if (error) {
      metadata.error = error;
    }
    
    await auditService.log({
      eventType: `emergency_recovery_${status}`,
      eventCategory: 'critical_security',
      eventStatus: status === 'completed' ? 'success' : status === 'failed' ? 'failure' : 'info',
      eventDescription: `Emergency recovery ${status}`,
      metadata
    });
    
  } catch (err) {
    console.error(chalk.red('Failed to log recovery attempt:'), err.message);
  }
}

/**
 * Display success banner
 */
function displaySuccessBanner(result) {
  console.log(chalk.green.bold('\n' + '='.repeat(70)));
  console.log(chalk.green.bold(' '.repeat(15) + '✅ RECOVERY SUCCESSFUL ✅'));
  console.log(chalk.green.bold('='.repeat(70)));
  
  console.log(chalk.cyan('\n📋 Recovery Summary:'));
  console.log(chalk.white(`   Recovery ID: ${result.recoveryId}`));
  console.log(chalk.white(`   Method: ${result.method}`));
  console.log(chalk.white(`   Username: ${result.username || 'N/A'}`));
  console.log(chalk.white(`   Timestamp: ${new Date().toISOString()}`));
  
  console.log(chalk.yellow('\n⚠️  Important:'));
  console.log(chalk.white('  • All recovery actions have been logged'));
  console.log(chalk.white('  • Security team has been notified'));
  console.log(chalk.white('  • Review audit logs for compliance'));
  console.log(chalk.white('  • Document reason for recovery'));
  
  if (result.expiresIn) {
    console.log(chalk.red(`\n⏰ Temporary access expires in: ${result.expiresIn}`));
  }
  
  console.log(chalk.green.bold('\n' + '='.repeat(70)));
}

/**
 * Display failure banner
 */
function displayFailureBanner(error) {
  console.log(chalk.red.bold('\n' + '='.repeat(70)));
  console.log(chalk.red.bold(' '.repeat(20) + '❌ RECOVERY FAILED ❌'));
  console.log(chalk.red.bold('='.repeat(70)));
  
  console.log(chalk.yellow('\n📋 Failure Details:'));
  console.log(chalk.white(`   Error: ${error.message}`));
  console.log(chalk.white(`   Timestamp: ${new Date().toISOString()}`));
  
  console.log(chalk.yellow('\n💡 Troubleshooting:'));
  
  if (error.message.includes('physical')) {
    console.log(chalk.white('  • Ensure you are at the server console'));
    console.log(chalk.white('  • Disconnect any SSH sessions'));
    console.log(chalk.white('  • Try running from system terminal'));
  } else if (error.message.includes('authorization')) {
    console.log(chalk.white('  • Verify your recovery code is valid'));
    console.log(chalk.white('  • Check 2FA token is synchronized'));
    console.log(chalk.white('  • Contact security team for authorization'));
  } else if (error.message.includes('database')) {
    console.log(chalk.white('  • Check database connectivity'));
    console.log(chalk.white('  • Verify connection credentials'));
    console.log(chalk.white('  • Ensure migrations have been run'));
  }
  
  console.log(chalk.yellow('\n📞 Contact:'));
  console.log(chalk.white('  Security Team: security@company.com'));
  console.log(chalk.white('  On-Call: Use PagerDuty escalation'));
  
  console.log(chalk.red.bold('\n' + '='.repeat(70)));
}

// Handle interrupts
process.on('SIGINT', () => {
  console.log(chalk.yellow('\n\n⚠️  Recovery interrupted by user'));
  logRecoveryAttempt('interrupted');
  process.exit(130);
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error(chalk.red.bold('\n💥 Critical error:'), error);
  logRecoveryAttempt('crashed', null, error.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error(chalk.red.bold('\n💥 Unhandled rejection:'), reason);
  logRecoveryAttempt('crashed', null, reason);
  process.exit(1);
});

// Run the script
if (require.main === module) {
  main();
}

module.exports = { main };