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
    ,
    // CPA PERT (enhanced) indexes
    `CREATE INDEX ${prefix}idx_pert_reports_user ON ${prefix}cpa_pert_reports(user_id)` ,
    `CREATE INDEX ${prefix}idx_pert_reports_status ON ${prefix}cpa_pert_reports(status)` ,
    `CREATE INDEX ${prefix}idx_pert_reports_period ON ${prefix}cpa_pert_reports(report_period_start, report_period_end)` ,
    `CREATE INDEX ${prefix}idx_pert_exp_report ON ${prefix}cpa_pert_experiences(report_id)` ,
    `CREATE INDEX ${prefix}idx_pert_exp_sub ON ${prefix}cpa_pert_experiences(sub_competency_id)` ,
    `CREATE INDEX ${prefix}idx_pert_exp_status ON ${prefix}cpa_pert_experiences(approval_status)` ,
    `CREATE INDEX ${prefix}idx_comp_progress_user ON ${prefix}cpa_competency_progress(user_id)` ,
    `CREATE INDEX ${prefix}idx_comp_progress_sub ON ${prefix}cpa_competency_progress(sub_competency_id)` ,
    `CREATE INDEX ${prefix}idx_pert_templates_public ON ${prefix}cpa_pert_templates(is_public)` ,
    `CREATE INDEX ${prefix}idx_pert_submissions_report ON ${prefix}cpa_pert_submissions(report_id)` ,
    `CREATE INDEX ${prefix}idx_pert_submissions_status ON ${prefix}cpa_pert_submissions(submission_status)`,
    
    // New enhanced CPA PERT indexes
    `CREATE INDEX ${prefix}idx_pert_exp_dates ON ${prefix}cpa_pert_experiences(experience_start_date, experience_end_date)`,
    `CREATE INDEX ${prefix}idx_breakdown_exp ON ${prefix}cpa_experience_breakdown(experience_id)`,
    `CREATE INDEX ${prefix}idx_breakdown_dates ON ${prefix}cpa_experience_breakdown(start_date, end_date)`,
    `CREATE INDEX ${prefix}idx_progress_milestone_user ON ${prefix}cpa_progress_milestones(user_id, milestone_date)`,
    `CREATE INDEX ${prefix}idx_submission_history ON ${prefix}cpa_submission_history(submission_id, action_date)`,
    `CREATE INDEX ${prefix}idx_time_tracking_exp ON ${prefix}cpa_experience_time_tracking(experience_id)`,
    `CREATE INDEX ${prefix}idx_time_tracking_date ON ${prefix}cpa_experience_time_tracking(activity_date)`,
    `CREATE INDEX ${prefix}idx_evr_assess_user ON ${prefix}cpa_evr_assessments(user_id)`,
    `CREATE INDEX ${prefix}idx_evr_assess_dates ON ${prefix}cpa_evr_assessments(start_date, end_date)`
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

  // Seed CPA competency areas (minimal)
  const areas = [
    { code: 'FR', name: 'Financial Reporting', category: 'technical' },
    { code: 'MA', name: 'Management Accounting', category: 'technical' },
    { code: 'AA', name: 'Audit and Assurance', category: 'technical' },
    { code: 'TX', name: 'Taxation', category: 'technical' },
    { code: 'FN', name: 'Finance', category: 'technical' },
    { code: 'PS', name: 'Professionalism and Ethics', category: 'enabling' },
    { code: 'CM', name: 'Problem Solving and Decision-Making', category: 'enabling' },
    { code: 'CO', name: 'Communication', category: 'enabling' },
    { code: 'SE', name: 'Self-Management', category: 'enabling' },
    { code: 'TW', name: 'Teamwork and Leadership', category: 'enabling' }
  ];

  for (const area of areas) {
    const sql = `
      INSERT INTO ${prefix}cpa_competency_areas (id, code, name, category, requirements, created_at)
      SELECT SYS_GUID(), :code, :name, :category, :requirements, CURRENT_TIMESTAMP FROM DUAL
      WHERE NOT EXISTS (
        SELECT 1 FROM ${prefix}cpa_competency_areas WHERE code = :code
      )
    `;
    await db.execute(sql, {
      code: area.code,
      name: area.name,
      category: area.category,
      requirements: JSON.stringify({ core: false })
    });
  }

  // Seed minimal sub-competencies
  const subs = [
    { area: 'FR', code: 'FR1', name: 'Financial Reporting Needs and Systems' },
    { area: 'FR', code: 'FR2', name: 'Accounting Policies and Transactions' },
    { area: 'MA', code: 'MA1', name: 'Management Information Needs' },
    { area: 'MA', code: 'MA2', name: 'Cost Management' },
    { area: 'AA', code: 'AA1', name: 'Internal Control' },
    { area: 'AA', code: 'AA2', name: 'Assurance Engagement Planning' },
    { area: 'TX', code: 'TX1', name: 'Corporate Taxation' },
    { area: 'FN', code: 'FN1', name: 'Financial Analysis' },
    { area: 'CO', code: 'CO1', name: 'Communication Effectiveness' },
    { area: 'TW', code: 'TW1', name: 'Team Collaboration' }
  ];

  for (const sc of subs) {
    // Lookup area id by code
    const areaResult = await db.execute(
      `SELECT id FROM ${prefix}cpa_competency_areas WHERE code = :code`,
      { code: sc.area }
    );
    if (!areaResult.rows || areaResult.rows.length === 0) continue;
    const areaId = areaResult.rows[0].ID || areaResult.rows[0].id || (Array.isArray(areaResult.rows[0]) ? areaResult.rows[0][0] : null);

    const sql = `
      INSERT INTO ${prefix}cpa_sub_competencies (id, competency_area_id, code, name, created_at)
      SELECT SYS_GUID(), :area_id, :code, :name, CURRENT_TIMESTAMP FROM DUAL
      WHERE NOT EXISTS (
        SELECT 1 FROM ${prefix}cpa_sub_competencies WHERE code = :code
      )
    `;
    await db.execute(sql, {
      area_id: areaId,
      code: sc.code,
      name: sc.name
    });
  }
  logger.info('CPA competency areas and sub-competencies seeded');
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
