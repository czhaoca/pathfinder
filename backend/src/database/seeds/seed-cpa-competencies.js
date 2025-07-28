/**
 * CPA Competency Framework Seed Data
 * Based on CPA Canada's competency framework for the EVR route
 * Follows the structure from the CPA PERT integration plan
 */

const { v4: uuidv4 } = require('uuid');
const logger = require('../../utils/logger');

// CPA Competency Framework - Technical and Enabling Competencies
const cpaCompetencies = [
  // Financial Reporting (FR) Competencies
  {
    competency_id: 'FR1',
    category: 'Technical',
    area_code: 'FR',
    area_name: 'Financial Reporting',
    sub_code: 'FR1',
    sub_name: 'Financial Reporting Needs and Systems',
    description: 'Evaluates financial reporting needs and establishes appropriate accounting policies and practices using the applicable financial reporting framework',
    evr_relevance: 'HIGH',
    level_1_criteria: `
      - Identifies financial reporting needs and objectives
      - Applies accounting standards to routine transactions
      - Prepares basic financial statements
      - Documents accounting policies and procedures
    `,
    level_2_criteria: `
      - Evaluates complex financial reporting requirements
      - Develops accounting policies for non-routine transactions
      - Advises on financial reporting framework selection
      - Implements financial reporting systems and controls
    `,
    guiding_questions: `
      - What financial reporting frameworks have you worked with?
      - How did you determine appropriate accounting treatment?
      - What role did you play in financial statement preparation?
      - How did you ensure compliance with reporting standards?
    `,
    is_active: 1
  },
  {
    competency_id: 'FR2',
    category: 'Technical',
    area_code: 'FR',
    area_name: 'Financial Reporting',
    sub_code: 'FR2',
    sub_name: 'Accounting Policies and Transactions',
    description: 'Develops or evaluates appropriate accounting policies and procedures, and accounts for routine and non-routine transactions',
    evr_relevance: 'HIGH',
    level_1_criteria: `
      - Records routine transactions accurately
      - Applies established accounting policies
      - Prepares journal entries and adjustments
      - Assists in month-end and year-end procedures
    `,
    level_2_criteria: `
      - Evaluates and develops accounting policies
      - Accounts for complex and non-routine transactions
      - Provides technical accounting guidance
      - Reviews and approves accounting treatments
    `,
    guiding_questions: `
      - What complex transactions have you accounted for?
      - How did you research appropriate accounting treatment?
      - What accounting policies have you developed or revised?
      - How did you handle non-routine transactions?
    `,
    is_active: 1
  },
  
  // Management Accounting (MA) Competencies
  {
    competency_id: 'MA1',
    category: 'Technical',
    area_code: 'MA',
    area_name: 'Management Accounting',
    sub_code: 'MA1',
    sub_name: 'Management Information Needs',
    description: 'Develops or evaluates information inputs for operational plans, budgets, and forecasts',
    evr_relevance: 'HIGH',
    level_1_criteria: `
      - Gathers data for budgets and forecasts
      - Prepares basic management reports
      - Analyzes variances from budget
      - Supports planning processes
    `,
    level_2_criteria: `
      - Designs management reporting systems
      - Develops comprehensive budgets and forecasts
      - Evaluates planning assumptions and models
      - Advises on strategic planning processes
    `,
    guiding_questions: `
      - What management reports have you prepared?
      - How did you contribute to budgeting processes?
      - What variance analyses have you performed?
      - How did you help management make decisions?
    `,
    is_active: 1
  },
  {
    competency_id: 'MA2',
    category: 'Technical',
    area_code: 'MA',
    area_name: 'Management Accounting',
    sub_code: 'MA2',
    sub_name: 'Cost Management',
    description: 'Evaluates and applies cost management techniques to optimize organizational performance',
    evr_relevance: 'MEDIUM',
    level_1_criteria: `
      - Calculates product and service costs
      - Performs cost-volume-profit analysis
      - Identifies cost reduction opportunities
      - Prepares cost reports
    `,
    level_2_criteria: `
      - Designs costing systems
      - Implements activity-based costing
      - Develops cost optimization strategies
      - Evaluates make-or-buy decisions
    `,
    guiding_questions: `
      - What costing methods have you used?
      - How did you analyze profitability?
      - What cost reduction initiatives did you implement?
      - How did you evaluate pricing decisions?
    `,
    is_active: 1
  },
  
  // Audit and Assurance (AA) Competencies
  {
    competency_id: 'AA1',
    category: 'Technical',
    area_code: 'AA',
    area_name: 'Audit and Assurance',
    sub_code: 'AA1',
    sub_name: 'Internal Control',
    description: 'Evaluates internal control design and implementation, identifies control deficiencies, and makes recommendations for improvement',
    evr_relevance: 'HIGH',
    level_1_criteria: `
      - Documents internal controls
      - Tests control effectiveness
      - Identifies control weaknesses
      - Assists in control remediation
    `,
    level_2_criteria: `
      - Designs internal control frameworks
      - Evaluates entity-level controls
      - Develops control remediation plans
      - Implements control monitoring systems
    `,
    guiding_questions: `
      - What internal controls have you evaluated?
      - How did you test control effectiveness?
      - What control deficiencies did you identify?
      - How did you improve control environments?
    `,
    is_active: 1
  },
  {
    competency_id: 'AA2',
    category: 'Technical',
    area_code: 'AA',
    area_name: 'Audit and Assurance',
    sub_code: 'AA2',
    sub_name: 'Assurance Engagement Planning',
    description: 'Plans and performs assurance engagements or projects',
    evr_relevance: 'MEDIUM',
    level_1_criteria: `
      - Performs audit procedures
      - Documents audit findings
      - Prepares working papers
      - Assists in risk assessment
    `,
    level_2_criteria: `
      - Plans audit engagements
      - Assesses audit risks
      - Designs audit procedures
      - Supervises audit teams
    `,
    guiding_questions: `
      - What audit procedures have you performed?
      - How did you assess audit risks?
      - What types of testing did you conduct?
      - How did you document your findings?
    `,
    is_active: 1
  },
  
  // Taxation (TX) Competencies
  {
    competency_id: 'TX1',
    category: 'Technical',
    area_code: 'TX',
    area_name: 'Taxation',
    sub_code: 'TX1',
    sub_name: 'Corporate Taxation',
    description: 'Prepares or reviews corporate tax returns and provides advice on tax planning',
    evr_relevance: 'MEDIUM',
    level_1_criteria: `
      - Prepares basic tax calculations
      - Gathers tax compliance information
      - Assists with tax return preparation
      - Identifies common tax issues
    `,
    level_2_criteria: `
      - Prepares complex corporate tax returns
      - Provides tax planning advice
      - Evaluates tax implications of transactions
      - Manages tax compliance processes
    `,
    guiding_questions: `
      - What tax returns have you prepared?
      - How did you ensure tax compliance?
      - What tax planning have you performed?
      - How did you research tax issues?
    `,
    is_active: 1
  },
  
  // Finance (FN) Competencies
  {
    competency_id: 'FN1',
    category: 'Technical',
    area_code: 'FN',
    area_name: 'Finance',
    sub_code: 'FN1',
    sub_name: 'Financial Analysis',
    description: 'Evaluates the entity's financial health and analyzes the impact of strategic decisions',
    evr_relevance: 'HIGH',
    level_1_criteria: `
      - Performs ratio analysis
      - Analyzes financial trends
      - Prepares financial dashboards
      - Supports decision-making
    `,
    level_2_criteria: `
      - Conducts comprehensive financial analysis
      - Evaluates strategic alternatives
      - Develops financial models
      - Advises on financial strategy
    `,
    guiding_questions: `
      - What financial analyses have you performed?
      - How did you evaluate financial performance?
      - What recommendations did you provide?
      - How did you model financial scenarios?
    `,
    is_active: 1
  },
  {
    competency_id: 'FN2',
    category: 'Technical',
    area_code: 'FN',
    area_name: 'Finance',
    sub_code: 'FN2',
    sub_name: 'Treasury Management',
    description: 'Evaluates sources and management of funds including working capital',
    evr_relevance: 'MEDIUM',
    level_1_criteria: `
      - Monitors cash flows
      - Prepares cash forecasts
      - Analyzes working capital
      - Assists with banking relationships
    `,
    level_2_criteria: `
      - Manages treasury functions
      - Develops financing strategies
      - Optimizes working capital
      - Negotiates credit facilities
    `,
    guiding_questions: `
      - How did you manage cash flows?
      - What financing decisions were you involved in?
      - How did you optimize working capital?
      - What treasury risks did you manage?
    `,
    is_active: 1
  },
  
  // Strategy and Governance (SG) Competencies
  {
    competency_id: 'SG1',
    category: 'Technical',
    area_code: 'SG',
    area_name: 'Strategy and Governance',
    sub_code: 'SG1',
    sub_name: 'Governance',
    description: 'Evaluates the entity's governance structure and processes',
    evr_relevance: 'MEDIUM',
    level_1_criteria: `
      - Understands governance requirements
      - Supports board reporting
      - Documents governance processes
      - Assists with compliance
    `,
    level_2_criteria: `
      - Evaluates governance effectiveness
      - Develops governance frameworks
      - Advises boards and committees
      - Implements governance improvements
    `,
    guiding_questions: `
      - What governance processes have you supported?
      - How did you interact with boards or committees?
      - What compliance requirements did you address?
      - How did you improve governance practices?
    `,
    is_active: 1
  },
  
  // Enabling Competencies - Professional and Ethical Behaviour
  {
    competency_id: 'PE1',
    category: 'Enabling',
    area_code: 'PE',
    area_name: 'Professional and Ethical Behaviour',
    sub_code: 'PE1',
    sub_name: 'Ethical Conduct',
    description: 'Behaves in an ethical manner and demonstrates professional values',
    evr_relevance: 'HIGH',
    level_1_criteria: `
      - Follows professional standards
      - Maintains confidentiality
      - Demonstrates integrity
      - Seeks guidance on ethical issues
    `,
    level_2_criteria: `
      - Resolves ethical dilemmas
      - Promotes ethical culture
      - Mentors others on ethics
      - Leads by example
    `,
    guiding_questions: `
      - How have you demonstrated ethical behavior?
      - What ethical challenges have you faced?
      - How did you maintain professional standards?
      - What difficult decisions have you made?
    `,
    is_active: 1
  },
  
  // Problem-Solving and Decision-Making
  {
    competency_id: 'PS1',
    category: 'Enabling',
    area_code: 'PS',
    area_name: 'Problem-Solving and Decision-Making',
    sub_code: 'PS1',
    sub_name: 'Problem Analysis',
    description: 'Uses critical thinking to analyze problems and make decisions',
    evr_relevance: 'HIGH',
    level_1_criteria: `
      - Identifies problems accurately
      - Gathers relevant information
      - Analyzes alternatives
      - Supports decision-making
    `,
    level_2_criteria: `
      - Solves complex problems
      - Makes strategic decisions
      - Evaluates risks and opportunities
      - Implements solutions effectively
    `,
    guiding_questions: `
      - What complex problems have you solved?
      - How did you approach problem-solving?
      - What analytical methods did you use?
      - How did you implement solutions?
    `,
    is_active: 1
  },
  
  // Communication
  {
    competency_id: 'CM1',
    category: 'Enabling',
    area_code: 'CM',
    area_name: 'Communication',
    sub_code: 'CM1',
    sub_name: 'Written and Oral Communication',
    description: 'Communicates effectively in written and oral form',
    evr_relevance: 'HIGH',
    level_1_criteria: `
      - Writes clear reports and emails
      - Presents information effectively
      - Listens actively
      - Adapts communication style
    `,
    level_2_criteria: `
      - Delivers persuasive presentations
      - Writes executive-level reports
      - Facilitates meetings effectively
      - Negotiates successfully
    `,
    guiding_questions: `
      - What reports have you written?
      - What presentations have you delivered?
      - How did you communicate complex information?
      - Who were your key audiences?
    `,
    is_active: 1
  },
  
  // Self-Management
  {
    competency_id: 'SM1',
    category: 'Enabling',
    area_code: 'SM',
    area_name: 'Self-Management',
    sub_code: 'SM1',
    sub_name: 'Personal Development',
    description: 'Manages own performance and demonstrates commitment to professional development',
    evr_relevance: 'MEDIUM',
    level_1_criteria: `
      - Manages time effectively
      - Seeks feedback actively
      - Pursues learning opportunities
      - Adapts to change
    `,
    level_2_criteria: `
      - Leads personal development
      - Mentors others' growth
      - Drives continuous improvement
      - Models lifelong learning
    `,
    guiding_questions: `
      - How do you manage your professional development?
      - What new skills have you acquired?
      - How do you handle multiple priorities?
      - What feedback have you received and applied?
    `,
    is_active: 1
  },
  
  // Teamwork and Leadership
  {
    competency_id: 'TL1',
    category: 'Enabling',
    area_code: 'TL',
    area_name: 'Teamwork and Leadership',
    sub_code: 'TL1',
    sub_name: 'Team Collaboration',
    description: 'Works effectively as a team member and develops leadership skills',
    evr_relevance: 'HIGH',
    level_1_criteria: `
      - Collaborates with team members
      - Contributes to team goals
      - Shares knowledge willingly
      - Supports team decisions
    `,
    level_2_criteria: `
      - Leads teams effectively
      - Builds high-performing teams
      - Manages team conflicts
      - Develops team members
    `,
    guiding_questions: `
      - What teams have you worked on?
      - How did you contribute to team success?
      - What leadership roles have you taken?
      - How did you handle team challenges?
    `,
    is_active: 1
  }
];

async function seedCPACompetencies(connection, tablePrefix = 'pf_') {
  try {
    logger.info('Seeding CPA competencies...');
    
    // Clear existing data
    await connection.execute(`DELETE FROM ${tablePrefix}cpa_competencies`);
    
    // Insert competencies
    let count = 0;
    for (const competency of cpaCompetencies) {
      await connection.execute(
        `INSERT INTO ${tablePrefix}cpa_competencies (
          competency_id,
          category,
          area_code,
          area_name,
          sub_code,
          sub_name,
          description,
          evr_relevance,
          level_1_criteria,
          level_2_criteria,
          guiding_questions,
          is_active
        ) VALUES (
          :competency_id,
          :category,
          :area_code,
          :area_name,
          :sub_code,
          :sub_name,
          :description,
          :evr_relevance,
          :level_1_criteria,
          :level_2_criteria,
          :guiding_questions,
          :is_active
        )`,
        competency
      );
      count++;
    }
    
    await connection.commit();
    logger.info(`✅ Seeded ${count} CPA competencies successfully`);
    
  } catch (error) {
    await connection.rollback();
    logger.error('❌ Error seeding CPA competencies:', error);
    throw error;
  }
}

module.exports = { seedCPACompetencies, cpaCompetencies };