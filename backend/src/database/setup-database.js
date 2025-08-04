/**
 * Database Setup Script
 * Creates all necessary tables and initial data for Pathfinder
 * This is a fresh development - no migrations needed
 */

const logger = require('../utils/logger');
const DatabaseManager = require('../services/database');
const fs = require('fs').promises;
const path = require('path');

// Import all table creation scripts
const createUserTables = require('./schema/user-tables');
const createExperienceTables = require('./schema/experience-tables');
const createChatTables = require('./schema/chat-tables');
const createCPAPertTables = require('./schema/cpa-pert-tables');
const createCareerPathTables = require('./schema/career-path-tables');
const createNetworkingTables = require('./schema/networking-tables');
const createJobSearchTables = require('./schema/job-search-tables');
const createLearningTables = require('./schema/learning-tables');

async function setupDatabase() {
  try {
    logger.info('Starting database setup...');
    
    // Initialize database connection
    await DatabaseManager.initialize();
    
    const tablePrefix = 'pf_';
    
    // Create tables in dependency order
    logger.info('Creating user and authentication tables...');
    await createUserTables(DatabaseManager, tablePrefix);
    
    logger.info('Creating experience management tables...');
    await createExperienceTables(DatabaseManager, tablePrefix);
    
    logger.info('Creating chat and conversation tables...');
    await createChatTables(DatabaseManager, tablePrefix);
    
    logger.info('Creating CPA PERT module tables...');
    await createCPAPertTables(DatabaseManager, tablePrefix);
    
    logger.info('Creating career path planning tables...');
    await createCareerPathTables(DatabaseManager, tablePrefix);
    
    logger.info('Creating professional networking tables...');
    await createNetworkingTables(DatabaseManager, tablePrefix);
    
    logger.info('Creating job search integration tables...');
    await createJobSearchTables(DatabaseManager, tablePrefix);
    
    logger.info('Creating learning & development tables...');
    await createLearningTables(DatabaseManager, tablePrefix);
    
    // Create indexes and constraints
    logger.info('Creating indexes and constraints...');
    await createIndexes(DatabaseManager, tablePrefix);
    
    // Seed initial reference data
    logger.info('Seeding reference data...');
    await seedReferenceData(DatabaseManager, tablePrefix);
    
    logger.info('✅ Database setup completed successfully!');
    
  } catch (error) {
    logger.error('❌ Database setup failed', { error: error.message });
    throw error;
  } finally {
    await DatabaseManager.close();
  }
}

async function createIndexes(db, prefix) {
  const indexes = [
    // User indexes
    `CREATE INDEX ${prefix}idx_user_email ON ${prefix}users(email)`,
    `CREATE INDEX ${prefix}idx_user_username ON ${prefix}users(username)`,
    `CREATE INDEX ${prefix}idx_session_token ON ${prefix}user_sessions(token)`,
    
    // Experience indexes
    `CREATE INDEX ${prefix}idx_exp_user ON ${prefix}experiences_detailed(user_id)`,
    `CREATE INDEX ${prefix}idx_exp_dates ON ${prefix}experiences_detailed(start_date, end_date)`,
    
    // Chat indexes
    `CREATE INDEX ${prefix}idx_chat_user ON ${prefix}chats(user_id)`,
    `CREATE INDEX ${prefix}idx_chat_updated ON ${prefix}chats(updated_at)`,
    
    // Learning indexes
    `CREATE INDEX ${prefix}idx_enroll_user ON ${prefix}course_enrollments(user_id)`,
    `CREATE INDEX ${prefix}idx_cert_user ON ${prefix}user_certifications(user_id)`,
    `CREATE INDEX ${prefix}idx_path_public ON ${prefix}learning_paths(is_public)`,
    
    // Job search indexes
    `CREATE INDEX ${prefix}idx_job_posted ON ${prefix}job_listings(posted_date)`,
    `CREATE INDEX ${prefix}idx_app_user ON ${prefix}applications(user_id)`,
    `CREATE INDEX ${prefix}idx_app_status ON ${prefix}applications(status)`
  ];
  
  for (const indexSql of indexes) {
    try {
      await db.execute(indexSql);
      logger.info(`Created index: ${indexSql.split(' ')[2]}`);
    } catch (error) {
      if (!error.message.includes('ORA-00955')) { // Index already exists
        logger.error(`Failed to create index: ${error.message}`);
      }
    }
  }
}

async function seedReferenceData(db, prefix) {
  // Seed skills catalog
  const skills = [
    { name: 'JavaScript', category: 'Programming', description: 'JavaScript programming language' },
    { name: 'Python', category: 'Programming', description: 'Python programming language' },
    { name: 'React', category: 'Framework', description: 'React JavaScript library' },
    { name: 'Node.js', category: 'Runtime', description: 'JavaScript runtime environment' },
    { name: 'AWS', category: 'Cloud', description: 'Amazon Web Services cloud platform' },
    { name: 'Docker', category: 'DevOps', description: 'Container platform' },
    { name: 'SQL', category: 'Database', description: 'Structured Query Language' },
    { name: 'Git', category: 'Version Control', description: 'Distributed version control' }
  ];
  
  for (const skill of skills) {
    const sql = `
      INSERT INTO ${prefix}skills (skill_id, skill_name, skill_category, skill_description)
      SELECT SYS_GUID(), :name, :category, :description FROM DUAL
      WHERE NOT EXISTS (
        SELECT 1 FROM ${prefix}skills WHERE skill_name = :name
      )
    `;
    
    await db.execute(sql, skill);
  }
  
  logger.info('Reference data seeded successfully');
}

// Run if called directly
if (require.main === module) {
  setupDatabase()
    .then(() => {
      logger.info('Database setup process completed');
      process.exit(0);
    })
    .catch(err => {
      logger.error('Database setup process failed', { error: err.message });
      process.exit(1);
    });
}

module.exports = { setupDatabase };