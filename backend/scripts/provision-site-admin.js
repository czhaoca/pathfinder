#!/usr/bin/env node

/**
 * Site Admin Provisioning Script
 * 
 * This script runs during initial deployment to create the site admin user.
 * It generates secure credentials and displays them once for the administrator.
 * 
 * Usage:
 *   npm run provision:site-admin
 *   node scripts/provision-site-admin.js [--env=production] [--username=admin]
 * 
 * Environment Variables:
 *   SITE_ADMIN_USERNAME - Username for site admin (default: siteadmin)
 *   SITE_ADMIN_EMAIL - Email for site admin
 *   ENABLE_MFA - Enable MFA during provisioning (default: true)
 *   PROVISIONING_ALERT_WEBHOOK - Webhook URL for alerts
 */

const path = require('path');
const chalk = require('chalk');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

// Parse command line arguments
const args = process.argv.slice(2).reduce((acc, arg) => {
  const [key, value] = arg.replace('--', '').split('=');
  acc[key] = value || true;
  return acc;
}, {});

// Set environment from args if provided
if (args.env) {
  process.env.NODE_ENV = args.env;
}

if (args.username) {
  process.env.SITE_ADMIN_USERNAME = args.username;
}

// Import services
const SiteAdminProvisioner = require('../src/services/siteAdminProvisioner');
const { initializeDatabase } = require('../src/database/connection');

async function main() {
  console.log(chalk.blue('\n🚀 Pathfinder Site Admin Provisioning\n'));
  console.log(chalk.gray(`Environment: ${process.env.NODE_ENV || 'development'}`));
  console.log(chalk.gray(`Timestamp: ${new Date().toISOString()}\n`));

  try {
    // Step 1: Check environment
    if (!process.env.NODE_ENV) {
      console.warn(chalk.yellow('⚠️  NODE_ENV not set, defaulting to development'));
      process.env.NODE_ENV = 'development';
    }

    // Step 2: Validate required environment variables
    validateEnvironment();

    // Step 3: Initialize database connection
    console.log(chalk.yellow('📦 Initializing database connection...'));
    await initializeDatabase();
    console.log(chalk.green('✓ Database connected'));

    // Step 4: Check if provisioning should proceed
    const shouldProvision = await checkProvisioningRequired();
    
    if (!shouldProvision) {
      console.log(chalk.yellow('\n⚠️  Site admin provisioning not required'));
      console.log(chalk.gray('   Site admin already exists or provisioning is disabled'));
      process.exit(0);
    }

    // Step 5: Run provisioning
    const provisioner = new SiteAdminProvisioner({
      environment: process.env.NODE_ENV,
      mfaRequired: process.env.ENABLE_MFA !== 'false',
      alertsEnabled: process.env.ENABLE_PROVISIONING_ALERTS === 'true',
      passwordLength: parseInt(process.env.ADMIN_PASSWORD_LENGTH) || 20
    });

    const result = await provisioner.provision();

    // Step 6: Verify provisioning success
    if (result.success) {
      console.log(chalk.green.bold('\n✅ Site admin provisioning completed successfully!'));
      console.log(chalk.cyan(`\nProvisioning ID: ${result.provisioningId}`));
      console.log(chalk.cyan(`User ID: ${result.userId}`));
      console.log(chalk.cyan(`Username: ${result.username}\n`));
      
      // Display post-provisioning instructions
      displayPostProvisioningInstructions();
      
      process.exit(0);
    } else {
      throw new Error('Provisioning failed without error');
    }

  } catch (error) {
    console.error(chalk.red.bold('\n❌ Provisioning failed:'), error.message);
    console.error(chalk.gray('\nStack trace:'), error.stack);
    
    // Check if this is a recoverable error
    if (isRecoverableError(error)) {
      console.log(chalk.yellow('\n💡 This error may be recoverable:'));
      displayRecoveryInstructions(error);
    }
    
    process.exit(1);
  }
}

/**
 * Validate required environment variables
 */
function validateEnvironment() {
  const required = [];
  const warnings = [];

  // Check database connection
  if (!process.env.DATABASE_URL && !process.env.ORACLE_CONNECTION_STRING) {
    required.push('DATABASE_URL or ORACLE_CONNECTION_STRING');
  }

  // Check JWT secret
  if (!process.env.JWT_SECRET) {
    required.push('JWT_SECRET');
  }

  // Check encryption key
  if (!process.env.ENCRYPTION_KEY) {
    warnings.push('ENCRYPTION_KEY not set - using default (not secure for production)');
  }

  // Check app URL
  if (!process.env.APP_URL) {
    warnings.push('APP_URL not set - defaulting to http://localhost:3000');
  }

  // Display warnings
  warnings.forEach(warning => {
    console.warn(chalk.yellow(`⚠️  ${warning}`));
  });

  // Fail if required variables are missing
  if (required.length > 0) {
    console.error(chalk.red('\n❌ Missing required environment variables:'));
    required.forEach(variable => {
      console.error(chalk.red(`   - ${variable}`));
    });
    console.error(chalk.gray('\nPlease set these variables in your .env file or environment'));
    process.exit(1);
  }
}

/**
 * Check if provisioning is required
 */
async function checkProvisioningRequired() {
  // Check if explicitly disabled
  if (process.env.SKIP_SITE_ADMIN_PROVISIONING === 'true') {
    console.log(chalk.gray('Provisioning skipped (SKIP_SITE_ADMIN_PROVISIONING=true)'));
    return false;
  }

  // Check if running in CI/CD
  if (process.env.CI === 'true' && process.env.FORCE_PROVISIONING !== 'true') {
    console.log(chalk.gray('Provisioning skipped in CI environment'));
    return false;
  }

  // Check database for existing admin
  try {
    const { query } = require('../src/database/connection');
    
    const result = await query(`
      SELECT COUNT(*) as count
      FROM pf_users u
      JOIN pf_user_roles ur ON u.id = ur.user_id
      JOIN pf_roles r ON ur.role_id = r.id
      WHERE r.name = 'site_admin'
      AND ur.is_active = 1
    `);

    if (result.rows[0].COUNT > 0) {
      console.log(chalk.yellow('\n📋 Site admin already exists'));
      
      // Check if force provisioning is enabled
      if (process.env.FORCE_PROVISIONING === 'true') {
        console.log(chalk.yellow('⚠️  FORCE_PROVISIONING=true - This will create another admin!'));
        
        // Require confirmation in production
        if (process.env.NODE_ENV === 'production') {
          const confirmed = await confirmAction(
            'Creating multiple site admins in production. Continue?'
          );
          return confirmed;
        }
      } else {
        return false;
      }
    }

    return true;

  } catch (error) {
    // If tables don't exist, provisioning is required
    if (error.message.includes('table or view does not exist')) {
      console.log(chalk.yellow('⚠️  Database tables not found - migrations may need to run first'));
      
      // Try to run migrations
      console.log(chalk.yellow('📦 Attempting to run migrations...'));
      const { runMigrations } = require('../src/database/migrate');
      await runMigrations();
      
      return true;
    }
    
    throw error;
  }
}

/**
 * Confirm action with user input
 */
async function confirmAction(message) {
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(chalk.yellow(`\n${message} (yes/no): `), (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
    });
  });
}

/**
 * Check if error is recoverable
 */
function isRecoverableError(error) {
  const recoverableErrors = [
    'Site admin already exists',
    'Another provisioning process is already in progress',
    'table or view does not exist',
    'Connection refused',
    'ECONNREFUSED'
  ];

  return recoverableErrors.some(msg => 
    error.message.toLowerCase().includes(msg.toLowerCase())
  );
}

/**
 * Display recovery instructions
 */
function displayRecoveryInstructions(error) {
  if (error.message.includes('Site admin already exists')) {
    console.log(chalk.white('\nTo recover:'));
    console.log(chalk.gray('  1. Use emergency recovery: npm run recovery:emergency'));
    console.log(chalk.gray('  2. Reset admin password: npm run admin:reset-password'));
    console.log(chalk.gray('  3. Force new admin (dangerous): FORCE_PROVISIONING=true npm run provision:site-admin'));
  } else if (error.message.includes('table or view does not exist')) {
    console.log(chalk.white('\nTo recover:'));
    console.log(chalk.gray('  1. Run database migrations: npm run db:migrate'));
    console.log(chalk.gray('  2. Then retry provisioning: npm run provision:site-admin'));
  } else if (error.message.includes('Connection refused')) {
    console.log(chalk.white('\nTo recover:'));
    console.log(chalk.gray('  1. Check database is running'));
    console.log(chalk.gray('  2. Verify DATABASE_URL or ORACLE_CONNECTION_STRING'));
    console.log(chalk.gray('  3. Check network connectivity'));
  }
}

/**
 * Display post-provisioning instructions
 */
function displayPostProvisioningInstructions() {
  console.log(chalk.cyan.bold('📋 Next Steps:'));
  console.log(chalk.white('\n1. Save the credentials shown above immediately'));
  console.log(chalk.white('2. Log in at: ') + chalk.cyan(process.env.APP_URL || 'http://localhost:3000'));
  console.log(chalk.white('3. Change the temporary password on first login'));
  console.log(chalk.white('4. Set up multi-factor authentication'));
  console.log(chalk.white('5. Generate and save recovery codes'));
  
  console.log(chalk.yellow.bold('\n⚠️  Security Reminders:'));
  console.log(chalk.white('• Never share the site admin credentials'));
  console.log(chalk.white('• Store recovery codes in a secure location'));
  console.log(chalk.white('• Enable MFA immediately after first login'));
  console.log(chalk.white('• Review audit logs regularly'));
  
  if (process.env.NODE_ENV === 'production') {
    console.log(chalk.red.bold('\n🔒 Production Security:'));
    console.log(chalk.white('• Restrict database access'));
    console.log(chalk.white('• Enable all security monitoring'));
    console.log(chalk.white('• Configure alerting webhooks'));
    console.log(chalk.white('• Schedule regular security audits'));
  }
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error(chalk.red.bold('\n💥 Uncaught exception:'), error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error(chalk.red.bold('\n💥 Unhandled rejection at:'), promise);
  console.error(chalk.red('Reason:'), reason);
  process.exit(1);
});

// Run the script
if (require.main === module) {
  main();
}

module.exports = { main };