/**
 * Scheduled CPA Data Collection
 * Runs the CPA data collection pipeline on a schedule
 */

const schedule = require('node-schedule');
const { runCPADataCollection } = require('./cpa-data-orchestrator');
const winston = require('winston');

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/cpa-collection-error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/cpa-collection.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

// Schedule weekly collection - Sunday at 2 AM
const weeklyJob = schedule.scheduleJob('0 2 * * 0', async function() {
  logger.info('Starting scheduled CPA data collection...');
  
  try {
    const result = await runCPADataCollection();
    
    if (result.success) {
      logger.info('Weekly CPA data collection completed successfully', {
        report: result.report,
        knowledgeBasePath: result.knowledgeBasePath,
        trainingDataPath: result.trainingDataPath
      });
    } else {
      logger.error('Weekly CPA data collection completed with errors', {
        errors: result.errors,
        report: result.report
      });
    }
  } catch (error) {
    logger.error('Weekly CPA data collection failed', {
      error: error.message,
      stack: error.stack
    });
  }
});

// Schedule daily check for critical updates - Every day at 9 AM
const dailyCheckJob = schedule.scheduleJob('0 9 * * *', async function() {
  logger.info('Running daily CPA resource check...');
  
  // This could be expanded to check for specific critical updates
  // For now, it just logs that the check ran
  logger.info('Daily check completed');
});

logger.info('CPA data collection scheduler started');
logger.info('Weekly collection scheduled for: Sunday 2:00 AM');
logger.info('Daily checks scheduled for: Every day 9:00 AM');

// Handle graceful shutdown
process.on('SIGINT', () => {
  logger.info('Shutting down scheduler...');
  schedule.gracefulShutdown().then(() => {
    logger.info('Scheduler shutdown complete');
    process.exit(0);
  });
});