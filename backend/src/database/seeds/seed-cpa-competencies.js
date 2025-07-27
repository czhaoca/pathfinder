/**
 * CPA Competency Framework Seed Data
 * Based on CPA Canada's competency framework for the CPA certification program
 */

const { v4: uuidv4 } = require('uuid');
const config = require('../../config');

const cpaCompetencies = [
  // Financial Reporting Competencies
  {
    competency_code: 'FR-1.1',
    competency_name: 'Financial Reporting Needs and Systems',
    category: 'Financial Reporting',
    sub_category: 'Reporting Environment',
    description: 'Evaluates financial reporting needs and establishes appropriate accounting policies and systems',
    proficiency_levels: JSON.stringify({
      level0: 'Basic understanding of financial reporting requirements',
      level1: 'Applies accounting standards to routine transactions',
      level2: 'Develops accounting policies and evaluates complex transactions'
    }),
    keywords: 'IFRS, ASPE, accounting policies, financial statements, reporting framework'
  },
  {
    competency_code: 'FR-1.2',
    competency_name: 'Accounting Policies and Transactions',
    category: 'Financial Reporting',
    sub_category: 'Technical Competence',
    description: 'Evaluates the appropriateness of the basis of accounting and develops or evaluates accounting policies',
    proficiency_levels: JSON.stringify({
      level0: 'Identifies different bases of accounting',
      level1: 'Applies accounting policies to specific transactions',
      level2: 'Develops accounting policies for complex situations'
    }),
    keywords: 'accounting policies, transaction analysis, professional judgment'
  },
  
  // Strategy and Governance Competencies
  {
    competency_code: 'SG-2.1',
    competency_name: 'Governance and Strategy Development',
    category: 'Strategy and Governance',
    sub_category: 'Governance',
    description: 'Evaluates the entity's governance structure and strategy development process',
    proficiency_levels: JSON.stringify({
      level0: 'Understands basic governance principles',
      level1: 'Assesses governance practices and identifies improvements',
      level2: 'Designs governance frameworks and strategic planning processes'
    }),
    keywords: 'corporate governance, board of directors, strategic planning, risk oversight'
  },
  {
    competency_code: 'SG-2.2',
    competency_name: 'Mission, Vision, and Values',
    category: 'Strategy and Governance',
    sub_category: 'Strategic Direction',
    description: 'Evaluates the entity's mission, vision, and values',
    proficiency_levels: JSON.stringify({
      level0: 'Understands organizational mission and values',
      level1: 'Assesses alignment of operations with mission',
      level2: 'Develops organizational mission and strategic direction'
    }),
    keywords: 'mission statement, vision, organizational values, strategic alignment'
  },
  
  // Management Accounting Competencies
  {
    competency_code: 'MA-3.1',
    competency_name: 'Management Information Needs',
    category: 'Management Accounting',
    sub_category: 'Information Systems',
    description: 'Evaluates management information requirements and designs information systems',
    proficiency_levels: JSON.stringify({
      level0: 'Identifies basic management information needs',
      level1: 'Develops management reports and KPIs',
      level2: 'Designs comprehensive management information systems'
    }),
    keywords: 'management reporting, KPIs, dashboards, decision support'
  },
  {
    competency_code: 'MA-3.2',
    competency_name: 'Planning and Budgeting',
    category: 'Management Accounting',
    sub_category: 'Planning',
    description: 'Evaluates and applies cost management and budgeting techniques',
    proficiency_levels: JSON.stringify({
      level0: 'Understands basic budgeting concepts',
      level1: 'Prepares budgets and analyzes variances',
      level2: 'Designs budgeting systems and strategic cost management'
    }),
    keywords: 'budgeting, forecasting, variance analysis, cost management'
  },
  
  // Audit and Assurance Competencies
  {
    competency_code: 'AA-4.1',
    competency_name: 'Internal Control',
    category: 'Audit and Assurance',
    sub_category: 'Risk and Control',
    description: 'Evaluates internal control and identifies control weaknesses',
    proficiency_levels: JSON.stringify({
      level0: 'Understands internal control concepts',
      level1: 'Tests controls and identifies deficiencies',
      level2: 'Designs control frameworks and remediation plans'
    }),
    keywords: 'internal controls, COSO, control testing, risk assessment'
  },
  {
    competency_code: 'AA-4.2',
    competency_name: 'Assurance Engagement Planning',
    category: 'Audit and Assurance',
    sub_category: 'Engagement Management',
    description: 'Plans and executes assurance engagements',
    proficiency_levels: JSON.stringify({
      level0: 'Understands audit planning concepts',
      level1: 'Develops audit programs and performs procedures',
      level2: 'Manages complex audit engagements'
    }),
    keywords: 'audit planning, risk assessment, materiality, audit procedures'
  },
  
  // Finance Competencies
  {
    competency_code: 'FN-5.1',
    competency_name: 'Financial Analysis and Planning',
    category: 'Finance',
    sub_category: 'Financial Management',
    description: 'Evaluates the entity's financial state and financial management strategies',
    proficiency_levels: JSON.stringify({
      level0: 'Performs basic financial analysis',
      level1: 'Conducts comprehensive financial analysis',
      level2: 'Develops financial strategies and policies'
    }),
    keywords: 'financial analysis, ratio analysis, cash flow, working capital'
  },
  {
    competency_code: 'FN-5.2',
    competency_name: 'Treasury Management',
    category: 'Finance',
    sub_category: 'Treasury',
    description: 'Evaluates sources of financing and treasury management',
    proficiency_levels: JSON.stringify({
      level0: 'Understands financing options',
      level1: 'Analyzes financing alternatives',
      level2: 'Develops financing strategies and treasury policies'
    }),
    keywords: 'capital structure, financing, treasury, risk management'
  },
  
  // Taxation Competencies
  {
    competency_code: 'TX-6.1',
    competency_name: 'Corporate Taxation',
    category: 'Taxation',
    sub_category: 'Compliance',
    description: 'Prepares tax returns and analyzes tax issues for corporate entities',
    proficiency_levels: JSON.stringify({
      level0: 'Understands basic tax concepts',
      level1: 'Prepares corporate tax returns',
      level2: 'Provides tax planning advice'
    }),
    keywords: 'corporate tax, tax compliance, tax planning, ITA'
  },
  {
    competency_code: 'TX-6.2',
    competency_name: 'Personal Taxation',
    category: 'Taxation',
    sub_category: 'Individual Tax',
    description: 'Analyzes tax issues for individuals',
    proficiency_levels: JSON.stringify({
      level0: 'Understands personal tax basics',
      level1: 'Prepares personal tax returns',
      level2: 'Provides personal tax planning strategies'
    }),
    keywords: 'personal tax, tax planning, estate planning, tax optimization'
  }
];

async function seedCPACompetencies(connection) {
  const tablePrefix = config.project.tablePrefix || 'skill_';
  
  try {
    // Clear existing data
    await connection.execute(`DELETE FROM ${tablePrefix}cpa_competencies`);
    
    // Insert competencies
    for (const competency of cpaCompetencies) {
      await connection.execute(
        `INSERT INTO ${tablePrefix}cpa_competencies (
          competency_id,
          competency_code,
          competency_name,
          category,
          sub_category,
          description,
          proficiency_levels,
          keywords,
          is_active
        ) VALUES (
          :competency_id,
          :competency_code,
          :competency_name,
          :category,
          :sub_category,
          :description,
          :proficiency_levels,
          :keywords,
          'Y'
        )`,
        {
          competency_id: uuidv4(),
          competency_code: competency.competency_code,
          competency_name: competency.competency_name,
          category: competency.category,
          sub_category: competency.sub_category,
          description: competency.description,
          proficiency_levels: competency.proficiency_levels,
          keywords: competency.keywords
        }
      );
    }
    
    await connection.commit();
    console.log(`✅ Seeded ${cpaCompetencies.length} CPA competencies`);
    
  } catch (error) {
    await connection.rollback();
    console.error('❌ Error seeding CPA competencies:', error);
    throw error;
  }
}

module.exports = { seedCPACompetencies, cpaCompetencies };