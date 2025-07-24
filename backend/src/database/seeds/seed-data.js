#!/usr/bin/env node

/**
 * Sample Data Seeding Script
 * Seeds the database with realistic professional experience data for development testing
 */

const DatabaseManager = require('../lib/database');
const config = require('../config/mcp-config');

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

function printInfo(message) {
  console.log(colorize(`ℹ️  ${message}`, 'blue'));
}

/**
 * Sample professional experiences data
 */
const sampleExperiences = [
  {
    title: 'Senior Software Engineer',
    organization: 'TechCorp Solutions',
    description: 'Led development of cloud-native web applications using React, Node.js, and AWS. Managed a team of 4 junior developers and implemented CI/CD pipelines that reduced deployment time by 60%. Built microservices architecture serving 100K+ daily active users with 99.9% uptime. Collaborated with product managers and designers to deliver 15+ major features quarterly.',
    startDate: '2022-03-01',
    endDate: '2024-01-15',
    isCurrent: false,
    experienceType: 'work',
    extractedSkills: [
      { name: 'JavaScript', category: 'technical', proficiency: 'advanced', yearsExperience: 4 },
      { name: 'React', category: 'technical', proficiency: 'advanced', yearsExperience: 3 },
      { name: 'Node.js', category: 'technical', proficiency: 'advanced', yearsExperience: 3 },
      { name: 'AWS', category: 'technical', proficiency: 'intermediate', yearsExperience: 2 },
      { name: 'Team Leadership', category: 'soft', proficiency: 'intermediate', yearsExperience: 2 },
      { name: 'Microservices', category: 'technical', proficiency: 'intermediate', yearsExperience: 2 },
      { name: 'CI/CD', category: 'technical', proficiency: 'intermediate', yearsExperience: 2 }
    ],
    keyHighlights: [
      { description: 'Reduced deployment time by 60% through CI/CD implementation', impact: 'high', metric: '60% improvement' },
      { description: 'Led team of 4 developers on major product initiatives', impact: 'high', metric: '4 team members' },
      { description: 'Achieved 99.9% uptime for critical microservices', impact: 'high', metric: '99.9% uptime' },
      { description: 'Delivered 15+ features per quarter consistently', impact: 'medium', metric: '15+ features/quarter' }
    ],
    roleMappings: {
      currentLevel: 'senior',
      possibleRoles: ['Tech Lead', 'Engineering Manager', 'Staff Engineer'],
      careerProgression: 'management'
    },
    industryTags: ['Technology', 'SaaS', 'Fintech'],
    impactMetrics: {
      teamSize: 4,
      usersServed: 100000,
      uptime: 99.9,
      deploymentImprovement: 60,
      featuresDelivered: 60
    }
  },
  {
    title: 'Full Stack Developer',
    organization: 'StartupCo',
    description: 'Built and maintained web applications from concept to production using Python/Django backend and Vue.js frontend. Implemented user authentication, payment processing with Stripe, and real-time notifications. Worked directly with founders to define product requirements and technical architecture. Participated in code reviews and mentored 2 intern developers.',
    startDate: '2020-06-01',
    endDate: '2022-02-28',
    isCurrent: false,
    experienceType: 'work',
    extractedSkills: [
      { name: 'Python', category: 'technical', proficiency: 'advanced', yearsExperience: 3 },
      { name: 'Django', category: 'technical', proficiency: 'advanced', yearsExperience: 2 },
      { name: 'Vue.js', category: 'technical', proficiency: 'intermediate', yearsExperience: 2 },
      { name: 'PostgreSQL', category: 'technical', proficiency: 'intermediate', yearsExperience: 2 },
      { name: 'Stripe API', category: 'technical', proficiency: 'beginner', yearsExperience: 1 },
      { name: 'Mentoring', category: 'soft', proficiency: 'beginner', yearsExperience: 1 },
      { name: 'Product Development', category: 'soft', proficiency: 'intermediate', yearsExperience: 2 }
    ],
    keyHighlights: [
      { description: 'Built complete web application from scratch', impact: 'high', metric: 'Full-stack application' },
      { description: 'Implemented secure payment processing', impact: 'high', metric: 'Stripe integration' },
      { description: 'Mentored 2 intern developers', impact: 'medium', metric: '2 mentees' },
      { description: 'Collaborated directly with founders on product strategy', impact: 'medium', metric: 'C-level collaboration' }
    ],
    roleMappings: {
      currentLevel: 'mid',
      possibleRoles: ['Senior Developer', 'Full Stack Engineer', 'Product Engineer'],
      careerProgression: 'technical'
    },
    industryTags: ['Startup', 'E-commerce', 'Technology'],
    impactMetrics: {
      projectsCompleted: 3,
      mentees: 2,
      technologiesLearned: 5,
      founderCollaboration: true
    }
  },
  {
    title: 'Master of Science in Computer Science',
    organization: 'University of Technology',
    description: 'Specialized in Machine Learning and Data Science with focus on natural language processing and computer vision. Completed thesis on "Deep Learning Applications in Sentiment Analysis" achieving 94% accuracy on industry benchmarks. Participated in 3 research projects, published 2 papers in peer-reviewed conferences. Teaching assistant for Introduction to Programming course for 2 semesters.',
    startDate: '2018-09-01',
    endDate: '2020-05-15',
    isCurrent: false,
    experienceType: 'education',
    extractedSkills: [
      { name: 'Machine Learning', category: 'technical', proficiency: 'advanced', yearsExperience: 2 },
      { name: 'Python', category: 'technical', proficiency: 'advanced', yearsExperience: 2 },
      { name: 'TensorFlow', category: 'technical', proficiency: 'intermediate', yearsExperience: 1 },
      { name: 'Data Science', category: 'technical', proficiency: 'intermediate', yearsExperience: 2 },
      { name: 'Research', category: 'soft', proficiency: 'intermediate', yearsExperience: 2 },
      { name: 'Teaching', category: 'soft', proficiency: 'beginner', yearsExperience: 1 },
      { name: 'Academic Writing', category: 'soft', proficiency: 'intermediate', yearsExperience: 2 }
    ],
    keyHighlights: [
      { description: 'Achieved 94% accuracy in thesis research', impact: 'high', metric: '94% accuracy' },
      { description: 'Published 2 papers in peer-reviewed conferences', impact: 'high', metric: '2 publications' },
      { description: 'Teaching assistant for 2 semesters', impact: 'medium', metric: '2 semesters TA' },
      { description: 'Participated in 3 research projects', impact: 'medium', metric: '3 research projects' }
    ],
    roleMappings: {
      currentLevel: 'graduate',
      possibleRoles: ['ML Engineer', 'Data Scientist', 'Research Scientist'],
      careerProgression: 'technical'
    },
    industryTags: ['Education', 'Research', 'Technology'],
    impactMetrics: {
      gpa: 3.8,
      publications: 2,
      researchProjects: 3,
      studentsTeaching: 150
    }
  },
  {
    title: 'Open Source Contributor - React Testing Library',
    organization: 'Open Source Community',
    description: 'Active contributor to React Testing Library, focusing on improving documentation and adding new testing utilities. Submitted 12+ pull requests with features and bug fixes, participated in community discussions, and helped maintain issue triage. Created comprehensive examples and tutorials that have been viewed 50K+ times on GitHub.',
    startDate: '2021-01-01',
    endDate: null,
    isCurrent: true,
    experienceType: 'project',
    extractedSkills: [
      { name: 'React', category: 'technical', proficiency: 'advanced', yearsExperience: 3 },
      { name: 'Testing', category: 'technical', proficiency: 'advanced', yearsExperience: 3 },
      { name: 'JavaScript', category: 'technical', proficiency: 'advanced', yearsExperience: 4 },
      { name: 'Open Source', category: 'soft', proficiency: 'intermediate', yearsExperience: 2 },
      { name: 'Technical Writing', category: 'soft', proficiency: 'intermediate', yearsExperience: 2 },
      { name: 'Community Building', category: 'soft', proficiency: 'beginner', yearsExperience: 1 }
    ],
    keyHighlights: [
      { description: '12+ pull requests merged to popular open source project', impact: 'high', metric: '12+ PRs' },
      { description: 'Documentation viewed 50K+ times', impact: 'high', metric: '50K+ views' },
      { description: 'Active community participation and issue triage', impact: 'medium', metric: 'Community involvement' },
      { description: 'Created comprehensive testing examples', impact: 'medium', metric: 'Educational content' }
    ],
    roleMappings: {
      currentLevel: 'contributor',
      possibleRoles: ['Senior Developer', 'Open Source Maintainer', 'Developer Advocate'],
      careerProgression: 'technical'
    },
    industryTags: ['Open Source', 'Technology', 'Community'],
    impactMetrics: {
      pullRequests: 12,
      documentationViews: 50000,
      communityContributions: 25,
      tutorialsCreated: 5
    }
  },
  {
    title: 'Volunteer Code Mentor',
    organization: 'CodePath.org',
    description: 'Volunteer mentor for underrepresented students learning software engineering. Conducted weekly 1-on-1 sessions with 5 students, helping them with coding challenges, technical interview preparation, and career guidance. Assisted in curriculum development for web development track and organized virtual networking events.',
    startDate: '2021-09-01',
    endDate: null,
    isCurrent: true,
    experienceType: 'volunteer',
    extractedSkills: [
      { name: 'Mentoring', category: 'soft', proficiency: 'intermediate', yearsExperience: 2 },
      { name: 'Teaching', category: 'soft', proficiency: 'intermediate', yearsExperience: 2 },
      { name: 'Curriculum Development', category: 'soft', proficiency: 'beginner', yearsExperience: 1 },
      { name: 'Interview Preparation', category: 'soft', proficiency: 'intermediate', yearsExperience: 2 },
      { name: 'Event Organization', category: 'soft', proficiency: 'beginner', yearsExperience: 1 },
      { name: 'Diversity & Inclusion', category: 'soft', proficiency: 'beginner', yearsExperience: 1 }
    ],
    keyHighlights: [
      { description: 'Mentored 5 students with 100% program completion rate', impact: 'high', metric: '100% completion rate' },
      { description: 'Conducted 50+ mentoring sessions', impact: 'medium', metric: '50+ sessions' },
      { description: 'Contributed to curriculum development', impact: 'medium', metric: 'Curriculum contribution' },
      { description: 'Organized networking events for 100+ students', impact: 'medium', metric: '100+ attendees' }
    ],
    roleMappings: {
      currentLevel: 'mentor',
      possibleRoles: ['Engineering Manager', 'Technical Leader', 'Developer Advocate'],
      careerProgression: 'leadership'
    },
    industryTags: ['Education', 'Non-profit', 'Technology'],
    impactMetrics: {
      studentsmentored: 5,
      sessionsCompleted: 50,
      completionRate: 100,
      eventsOrganized: 3
    }
  },
  {
    title: 'AWS Solutions Architect Associate',
    organization: 'Amazon Web Services',
    description: 'Earned AWS Solutions Architect Associate certification demonstrating expertise in designing distributed systems and applications on AWS platform. Studied cloud architecture patterns, security best practices, cost optimization, and scalability principles. Completed hands-on labs and practice exams with 90%+ scores.',
    startDate: '2023-03-01',
    endDate: '2023-05-15',
    isCurrent: false,
    experienceType: 'certification',
    extractedSkills: [
      { name: 'AWS', category: 'technical', proficiency: 'intermediate', yearsExperience: 1 },
      { name: 'Cloud Architecture', category: 'technical', proficiency: 'intermediate', yearsExperience: 1 },
      { name: 'System Design', category: 'technical', proficiency: 'intermediate', yearsExperience: 2 },
      { name: 'Security', category: 'technical', proficiency: 'beginner', yearsExperience: 1 },
      { name: 'Cost Optimization', category: 'technical', proficiency: 'beginner', yearsExperience: 1 }
    ],
    keyHighlights: [
      { description: 'Achieved certification on first attempt', impact: 'medium', metric: 'First attempt pass' },
      { description: 'Scored 90%+ on practice exams', impact: 'medium', metric: '90%+ practice scores' },
      { description: 'Completed 20+ hands-on labs', impact: 'low', metric: '20+ labs' }
    ],
    roleMappings: {
      currentLevel: 'certified',
      possibleRoles: ['Cloud Engineer', 'Solutions Architect', 'DevOps Engineer'],
      careerProgression: 'technical'
    },
    industryTags: ['Cloud Computing', 'Technology', 'AWS'],
    impactMetrics: {
      certificationScore: 820,
      labsCompleted: 20,
      studyHours: 120
    }
  }
];

/**
 * Sample profile summary data
 */
const sampleProfileSummary = {
  coreStrengths: {
    technical: {
      primarySkills: ['JavaScript', 'Python', 'React', 'Node.js', 'Machine Learning'],
      frameworks: ['Django', 'Vue.js', 'TensorFlow', 'AWS'],
      databases: ['PostgreSQL', 'MongoDB'],
      tools: ['Git', 'Docker', 'CI/CD', 'Jest']
    },
    leadership: {
      teamManagement: 'Led teams of up to 4 developers',
      mentoring: 'Mentored 7+ junior developers and students',
      projectLeadership: 'Led 15+ major feature deliveries',
      crossFunctional: 'Collaborated with product, design, and executive teams'
    },
    communication: {
      technicalWriting: '2 academic publications, extensive documentation',
      presentation: 'Presented at team meetings and stakeholder reviews',
      teaching: 'Teaching assistant and volunteer code mentor',
      openSource: 'Active community contributor and maintainer'
    }
  },
  careerInterests: {
    primaryAreas: ['Full Stack Development', 'Machine Learning', 'Technical Leadership'],
    industries: ['Technology', 'Fintech', 'Education Technology'],
    roleTypes: ['Senior Engineer', 'Tech Lead', 'Engineering Manager'],
    workEnvironment: ['Startup', 'High-growth company', 'Remote-friendly'],
    values: ['Innovation', 'Mentorship', 'Work-life balance', 'Continuous learning']
  },
  careerProgression: {
    timeline: [
      { period: '2018-2020', role: 'Graduate Student', focus: 'ML/Data Science Foundation' },
      { period: '2020-2022', role: 'Full Stack Developer', focus: 'Product Development' },
      { period: '2022-2024', role: 'Senior Software Engineer', focus: 'Team Leadership' },
      { period: '2024+', role: 'Target: Tech Lead/EM', focus: 'Strategic Leadership' }
    ],
    growthPattern: 'Technical depth → Product impact → Team leadership',
    nextSteps: ['Technical leadership', 'Team management', 'Strategic planning'],
    careerVelocity: 'Promoted every 2 years with expanding responsibilities'
  },
  industryExperience: {
    primary: 'Technology/Software (4+ years)',
    secondary: ['Education (2 years)', 'Fintech (1 year)', 'Open Source (2+ years)'],
    domainExpertise: ['Web Applications', 'Machine Learning', 'Cloud Architecture'],
    marketUnderstanding: 'B2B SaaS, consumer applications, developer tools'
  },
  leadershipProfile: {
    style: 'Collaborative and mentorship-focused',
    experience: {
      teamLead: '4 direct reports, cross-functional collaboration',
      mentoring: '7+ mentees across different experience levels',
      projectManagement: '15+ major features from conception to delivery'
    },
    strengths: ['Technical mentorship', 'Process improvement', 'Cross-team collaboration'],
    development: ['Strategic thinking', 'Stakeholder management', 'Organizational leadership']
  },
  technicalProfile: {
    architecture: ['Microservices', 'REST APIs', 'Database design', 'Cloud infrastructure'],
    programming: ['JavaScript/TypeScript', 'Python', 'SQL'],
    frameworks: ['React/Vue.js', 'Node.js/Django', 'AWS services'],
    practices: ['TDD', 'CI/CD', 'Code review', 'Agile development'],
    emerging: ['Machine Learning', 'Cloud-native development', 'DevOps practices']
  },
  softSkillsProfile: {
    communication: {
      level: 'Advanced',
      evidence: ['Technical writing', 'Teaching', 'Stakeholder presentations']
    },
    problemSolving: {
      level: 'Advanced',
      evidence: ['Complex system debugging', 'Architecture decisions', 'Research projects']
    },
    collaboration: {
      level: 'Advanced',
      evidence: ['Cross-functional teams', 'Open source contributions', 'Code reviews']
    },
    adaptability: {
      level: 'Intermediate',
      evidence: ['Multiple technology stacks', 'Startup to established company', 'Remote work']
    },
    leadership: {
      level: 'Intermediate',
      evidence: ['Team leadership', 'Mentoring', 'Project ownership']
    }
  },
  educationSummary: {
    highest: 'Master of Science in Computer Science',
    institution: 'University of Technology',
    specialization: 'Machine Learning and Data Science',
    achievements: ['3.8 GPA', '2 publications', 'Teaching assistant'],
    relevantCoursework: ['Algorithms', 'Machine Learning', 'Database Systems', 'Software Engineering']
  },
  achievementHighlights: [
    { category: 'Technical', achievement: 'Built microservices serving 100K+ users with 99.9% uptime' },
    { category: 'Leadership', achievement: 'Led team of 4 developers delivering 15+ features per quarter' },
    { category: 'Efficiency', achievement: 'Reduced deployment time by 60% through CI/CD implementation' },
    { category: 'Research', achievement: 'Achieved 94% accuracy in ML thesis with 2 peer-reviewed publications' },
    { category: 'Community', achievement: '12+ open source contributions with 50K+ documentation views' },
    { category: 'Mentorship', achievement: 'Mentored 7+ developers with 100% program completion rate' },
    { category: 'Certification', achievement: 'AWS Solutions Architect Associate certification' },
    { category: 'Innovation', achievement: 'Architected scalable payment processing system' }
  ]
};

/**
 * Sample quick summary data
 */
const sampleQuickSummary = {
  executiveSummary: 'Experienced full-stack software engineer with 4+ years building scalable web applications and leading development teams. Strong background in JavaScript/Python, cloud architecture, and machine learning. Proven track record of delivering high-impact features, mentoring developers, and contributing to open source projects.',
  keySkills: [
    'JavaScript/TypeScript',
    'React/Node.js',
    'Python/Django',
    'AWS/Cloud Architecture',
    'Team Leadership',
    'Machine Learning',
    'System Design',
    'Open Source'
  ],
  careerGoals: 'Seeking technical leadership role (Tech Lead or Engineering Manager) where I can combine deep technical expertise with team leadership to build innovative products and develop engineering talent.',
  yearsExperience: 4,
  currentRole: 'Senior Software Engineer',
  industries: ['Technology', 'Fintech', 'EdTech'],
  educationLevel: 'Master of Science in Computer Science',
  location: 'San Francisco Bay Area',
  availability: 'Open to opportunities'
};

/**
 * Seed experiences data
 */
async function seedExperiences() {
  printSection('Seeding Professional Experiences');
  
  let successCount = 0;
  let errorCount = 0;
  
  for (let i = 0; i < sampleExperiences.length; i++) {
    const experience = sampleExperiences[i];
    
    try {
      printInfo(`Adding: ${experience.title} at ${experience.organization}`);
      
      const experienceId = await DatabaseManager.storeExperience(experience);
      
      printSuccess(`✓ Stored experience: ${experience.title} (ID: ${experienceId})`);
      successCount++;
      
    } catch (error) {
      printError(`✗ Failed to store ${experience.title}: ${error.message}`);
      errorCount++;
    }
  }
  
  console.log(`\n📊 Experiences Summary: ${successCount} added, ${errorCount} errors`);
  return { successCount, errorCount };
}

/**
 * Seed profile summary
 */
async function seedProfileSummary() {
  printSection('Seeding Profile Summary');
  
  try {
    printInfo('Adding comprehensive profile summary...');
    
    await DatabaseManager.updateProfileSummary(sampleProfileSummary);
    
    printSuccess('✓ Profile summary stored successfully');
    return true;
    
  } catch (error) {
    printError(`✗ Failed to store profile summary: ${error.message}`);
    return false;
  }
}

/**
 * Seed quick summary
 */
async function seedQuickSummary() {
  printSection('Seeding Quick Summary');
  
  try {
    printInfo('Adding optimized quick summary for MCP context...');
    
    await DatabaseManager.updateQuickSummary(sampleQuickSummary);
    
    printSuccess('✓ Quick summary stored successfully');
    return true;
    
  } catch (error) {
    printError(`✗ Failed to store quick summary: ${error.message}`);
    return false;
  }
}

/**
 * Verify seeded data
 */
async function verifySeededData() {
  printSection('Verifying Seeded Data');
  
  try {
    // Check experiences count
    const experiences = await DatabaseManager.searchExperiences({ limit: 50 });
    printInfo(`Experiences stored: ${experiences.length}`);
    
    // Check quick context
    const quickContext = await DatabaseManager.getQuickContext();
    if (quickContext) {
      printSuccess('✓ Quick context available for MCP');
      console.log(`   Executive summary: ${quickContext.EXECUTIVE_SUMMARY?.substring(0, 80)}...`);
    } else {
      printError('✗ Quick context not available');
    }
    
    // Check detailed profile
    const detailedProfile = await DatabaseManager.getDetailedProfile();
    if (detailedProfile) {
      printSuccess('✓ Detailed profile available for MCP');
      
      // Parse and show sample data
      if (detailedProfile.CORE_STRENGTHS) {
        const coreStrengths = JSON.parse(detailedProfile.CORE_STRENGTHS);
        console.log(`   Technical skills: ${coreStrengths.technical?.primarySkills?.slice(0, 3).join(', ')}...`);
      }
    } else {
      printError('✗ Detailed profile not available');
    }
    
    // Performance test
    printInfo('Testing MCP performance targets...');
    
    const quickStart = Date.now();
    await DatabaseManager.getQuickContext();
    const quickTime = Date.now() - quickStart;
    
    const profileStart = Date.now();
    await DatabaseManager.getDetailedProfile();
    const profileTime = Date.now() - profileStart;
    
    const searchStart = Date.now();
    await DatabaseManager.searchExperiences({ limit: 5 });
    const searchTime = Date.now() - searchStart;
    
    console.log('\n📈 Performance Results:');
    console.log(`   Quick context: ${quickTime}ms (target: ≤10ms) ${quickTime <= 10 ? '✅' : '⚠️'}`);
    console.log(`   Detailed profile: ${profileTime}ms (target: ≤50ms) ${profileTime <= 50 ? '✅' : '⚠️'}`);
    console.log(`   Search experiences: ${searchTime}ms (target: ≤200ms) ${searchTime <= 200 ? '✅' : '⚠️'}`);
    
    return {
      experienceCount: experiences.length,
      hasQuickContext: !!quickContext,
      hasDetailedProfile: !!detailedProfile,
      performance: { quickTime, profileTime, searchTime }
    };
    
  } catch (error) {
    printError(`Verification failed: ${error.message}`);
    return null;
  }
}

/**
 * Main seeding function
 */
async function main() {
  printHeader(`Career Navigator MCP Data Seeding - ${config.environment.toUpperCase()}`);
  
  try {
    // Initialize database
    printInfo(`Connecting to ${config.environment} database...`);
    await DatabaseManager.initialize();
    
    // Test connection
    const health = await DatabaseManager.healthCheck();
    if (health.status !== 'healthy') {
      throw new Error(`Database health check failed: ${health.error}`);
    }
    
    printSuccess(`Connected to ${config.environment} database`);
    
    // Seed data
    const experienceResults = await seedExperiences();
    const profileSuccess = await seedProfileSummary();
    const quickSummarySuccess = await seedQuickSummary();
    
    // Verify results
    const verification = await verifySeededData();
    
    // Final summary
    printSection('Seeding Summary');
    
    console.log(`Environment: ${config.environment}`);
    console.log(`Experiences: ${experienceResults.successCount} added, ${experienceResults.errorCount} errors`);
    console.log(`Profile Summary: ${profileSuccess ? 'Success' : 'Failed'}`);
    console.log(`Quick Summary: ${quickSummarySuccess ? 'Success' : 'Failed'}`);
    
    if (verification) {
      console.log(`\nData Verification:`);
      console.log(`   Total experiences: ${verification.experienceCount}`);
      console.log(`   Quick context: ${verification.hasQuickContext ? 'Available' : 'Missing'}`);
      console.log(`   Detailed profile: ${verification.hasDetailedProfile ? 'Available' : 'Missing'}`);
      
      const allFast = verification.performance.quickTime <= 10 && 
                     verification.performance.profileTime <= 50 && 
                     verification.performance.searchTime <= 200;
      
      if (allFast) {
        printSuccess('🚀 All performance targets met!');
      } else {
        console.log('⚠️  Some performance targets exceeded - consider database optimization');
      }
    }
    
    console.log('\n🎉 Sample data seeding completed!');
    console.log('\nNext steps:');
    console.log('   • Start MCP server: npm run mcp:dev');
    console.log('   • Test MCP tools with seeded data');
    console.log('   • Run integration tests: npm run test:integration');
    
    await DatabaseManager.close();
    process.exit(0);
    
  } catch (error) {
    printError(`Seeding failed: ${error.message}`);
    
    console.log('\n🔧 Troubleshooting:');
    console.log('   • Ensure database schema is deployed: npm run db:migrate');
    console.log('   • Check database connectivity: npm run db:health');
    console.log('   • Verify environment configuration');
    
    await DatabaseManager.close();
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

module.exports = { 
  main, 
  sampleExperiences, 
  sampleProfileSummary, 
  sampleQuickSummary 
};