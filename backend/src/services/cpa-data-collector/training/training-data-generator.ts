/**
 * LLM Training Data Generator
 * Generates high-quality training data for fine-tuning LLMs on PERT responses
 */

import { KnowledgeGraph } from '../knowledge/knowledge-base-builder';
import { saveJsonFile } from '../utils/file-utils';
import fs from 'fs/promises';

export interface TrainingExample {
  prompt: string;
  expectedResponse: string;
  metadata: {
    competency: string;
    level: string;
    industry: string;
    role: string;
    guidingQuestions: string[];
    characterCount?: number;
    qualityScore?: number;
  };
}

export interface TrainingDataset {
  version: string;
  created: string;
  examples: TrainingExample[];
  statistics: {
    totalExamples: number;
    byCompetency: Record<string, number>;
    byLevel: Record<string, number>;
    byIndustry: Record<string, number>;
    averageCharacterCount: number;
  };
}

export class TrainingDataGenerator {
  private knowledgeBase: KnowledgeGraph;
  private trainingData: TrainingExample[] = [];
  
  // Industry and role variations for diverse training data
  private industries = [
    'manufacturing', 'technology', 'retail', 'finance', 
    'healthcare', 'real estate', 'hospitality', 'consulting',
    'non-profit', 'government'
  ];
  
  private roles = [
    'analyst', 'senior analyst', 'manager', 'senior manager',
    'controller', 'assistant controller', 'finance manager',
    'accounting supervisor', 'tax specialist', 'audit senior'
  ];

  constructor(knowledgeBase: KnowledgeGraph) {
    this.knowledgeBase = knowledgeBase;
  }

  generateDataset(): TrainingDataset {
    // Generate training examples for each competency and level combination
    Object.entries(this.knowledgeBase.competencies).forEach(([code, data]) => {
      // For technical competencies, generate for levels 1 and 2
      if (data.type === 'technical') {
        ['1', '2'].forEach(level => {
          this.generateCompetencyLevelData(code, level, data);
        });
      } else {
        // For enabling competencies, focus on demonstrating integration
        this.generateEnablingCompetencyData(code, data);
      }
    });
    
    return {
      version: '1.0',
      created: new Date().toISOString(),
      examples: this.trainingData,
      statistics: this.calculateStatistics()
    };
  }

  private generateCompetencyLevelData(
    competencyCode: string, 
    level: string, 
    competencyData: any
  ): void {
    const guidingQuestions = this.knowledgeBase.guidingQuestions[`${competencyCode}_${level}`] || [];
    
    // Create multiple variations for each industry/role combination
    this.industries.forEach(industry => {
      this.roles.forEach(role => {
        const prompt = this.buildPrompt(competencyCode, level, industry, role, guidingQuestions);
        const expectedResponse = this.buildExpectedResponse(
          competencyCode, level, industry, role, competencyData, guidingQuestions
        );
        
        const trainingExample: TrainingExample = {
          prompt,
          expectedResponse,
          metadata: {
            competency: competencyCode,
            level,
            industry,
            role,
            guidingQuestions,
            characterCount: expectedResponse.length,
            qualityScore: this.assessResponseQuality(expectedResponse, guidingQuestions)
          }
        };
        
        this.trainingData.push(trainingExample);
      });
    });
  }

  private generateEnablingCompetencyData(code: string, data: any): void {
    // Enabling competencies are demonstrated across all levels
    const guidingQuestions = data.relatedQuestions || [];
    
    // Generate fewer variations for enabling competencies
    const selectedIndustries = this.industries.slice(0, 5);
    const selectedRoles = this.roles.slice(0, 5);
    
    selectedIndustries.forEach(industry => {
      selectedRoles.forEach(role => {
        const prompt = this.buildEnablingPrompt(code, industry, role, guidingQuestions);
        const expectedResponse = this.buildEnablingResponse(code, industry, role, data);
        
        const trainingExample: TrainingExample = {
          prompt,
          expectedResponse,
          metadata: {
            competency: code,
            level: 'integrated',
            industry,
            role,
            guidingQuestions,
            characterCount: expectedResponse.length,
            qualityScore: this.assessResponseQuality(expectedResponse, guidingQuestions)
          }
        };
        
        this.trainingData.push(trainingExample);
      });
    });
  }

  private buildPrompt(
    competencyCode: string, 
    level: string, 
    industry: string, 
    role: string, 
    questions: string[]
  ): string {
    return `Generate a PERT response for competency ${competencyCode} at Level ${level} proficiency.
    
Role: ${role} in ${industry} industry
Character Limit: 5,000 characters
Route: EVR (Experience Verification Route)

Competency Description:
${this.getCompetencyDescription(competencyCode)}

Address the following guiding questions:
${questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}

Requirements:
- Provide ${level === '2' ? '3-5 complex' : '2-3 routine'} examples from your ${industry} experience
- Demonstrate ${level === '2' ? 'high' : 'moderate'} autonomy and judgment
- Show progression in responsibility and complexity
- Include quantifiable results and business impacts
- Use professional terminology appropriate for ${industry}
- Ensure all guiding questions are thoroughly addressed

Focus Areas:
- Technical skills specific to ${competencyCode}
- ${level === '2' ? 'Complex problem-solving and strategic thinking' : 'Consistent application of standard procedures'}
- Integration with other competencies where relevant
- Leadership and mentoring ${level === '2' ? '(if applicable)' : ''}`;
  }

  private buildEnablingPrompt(
    code: string,
    industry: string,
    role: string,
    questions: string[]
  ): string {
    return `Generate a PERT response demonstrating ${code} (enabling competency) integrated throughout your work.

Role: ${role} in ${industry} industry
Character Limit: 5,000 characters

This is an enabling competency that should be demonstrated across various technical activities.

${questions.length > 0 ? `Consider these aspects:\n${questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}` : ''}

Requirements:
- Show how this competency is integrated into your technical work
- Provide specific examples from ${industry} context
- Demonstrate progression and continuous improvement
- Include measurable impacts where possible`;
  }

  private buildExpectedResponse(
    competencyCode: string,
    level: string,
    industry: string,
    role: string,
    competencyData: any,
    guidingQuestions: string[]
  ): string {
    // This creates a template response based on the knowledge base
    const examples = competencyData.examples || [];
    const requirements = competencyData.requirements || [];
    
    let response = `Throughout my role as ${role} at [Company Name], a leading ${industry} organization, I have consistently demonstrated ${competencyCode} competency at Level ${level} proficiency.\n\n`;
    
    // Add context-specific examples based on level
    if (level === '2') {
      response += this.generateComplexExamples(competencyCode, industry, role);
    } else {
      response += this.generateRoutineExamples(competencyCode, industry, role);
    }
    
    // Address each guiding question
    guidingQuestions.forEach((question, index) => {
      response += `\n\n${this.generateQuestionResponse(question, competencyCode, industry, level)}`;
    });
    
    // Add conclusion showing progression
    response += `\n\nThese experiences demonstrate my ${level === '2' ? 'advanced' : 'solid'} proficiency in ${competencyCode}, `;
    response += `with ${level === '2' ? 'significant autonomy in complex situations' : 'consistent application of established procedures'}. `;
    response += `I continue to develop these skills through ${this.generateDevelopmentActivities(competencyCode, industry)}.`;
    
    // Ensure within character limit
    if (response.length > 5000) {
      response = this.trimResponse(response, 5000);
    }
    
    return response;
  }

  private buildEnablingResponse(
    code: string,
    industry: string,
    role: string,
    data: any
  ): string {
    let response = `As a ${role} in the ${industry} sector, ${code} competency is integral to all aspects of my work.\n\n`;
    
    // Add integration examples
    response += this.generateEnablingExamples(code, industry, role);
    
    // Show progression
    response += `\n\nMy ${code} skills have evolved significantly through various challenging situations, `;
    response += `enabling me to contribute more effectively to team objectives and organizational goals.`;
    
    return response;
  }

  private generateComplexExamples(competency: string, industry: string, role: string): string {
    // Generate industry-specific complex examples
    const complexityIndicators = [
      'multi-faceted analysis',
      'strategic recommendations',
      'cross-functional integration',
      'significant judgment required',
      'non-standard approach'
    ];
    
    const industryContexts = this.getIndustryContexts(industry);
    const competencyActions = this.getCompetencyActions(competency, 'complex');
    
    let examples = '';
    for (let i = 0; i < 3; i++) {
      examples += `Example ${i + 1}: ${competencyActions[i % competencyActions.length]} for ${industryContexts[i % industryContexts.length]} `;
      examples += `requiring ${complexityIndicators[i % complexityIndicators.length]}. `;
      examples += `This resulted in ${this.generateBusinessImpact(competency, 'high')}.\n\n`;
    }
    
    return examples;
  }

  private generateRoutineExamples(competency: string, industry: string, role: string): string {
    const routineIndicators = [
      'established procedures',
      'standard methodology',
      'regular analysis',
      'consistent application',
      'routine processing'
    ];
    
    const industryContexts = this.getIndustryContexts(industry);
    const competencyActions = this.getCompetencyActions(competency, 'routine');
    
    let examples = '';
    for (let i = 0; i < 2; i++) {
      examples += `Example ${i + 1}: ${competencyActions[i % competencyActions.length]} using ${routineIndicators[i % routineIndicators.length]} `;
      examples += `for ${industryContexts[i % industryContexts.length]}. `;
      examples += `This ${this.generateBusinessImpact(competency, 'moderate')}.\n\n`;
    }
    
    return examples;
  }

  private generateEnablingExamples(code: string, industry: string, role: string): string {
    const enablingContexts: Record<string, string[]> = {
      'PROF': ['ethical dilemmas', 'confidentiality matters', 'professional standards'],
      'COMM': ['stakeholder presentations', 'technical documentation', 'client communications'],
      'SELF': ['continuous learning', 'skill development', 'time management'],
      'TEAM': ['cross-functional projects', 'mentoring junior staff', 'collaborative initiatives'],
      'LEAD': ['team leadership', 'change management', 'strategic initiatives'],
      'PROB': ['complex analysis', 'innovative solutions', 'critical decisions']
    };
    
    const contexts = enablingContexts[code] || ['professional situations'];
    
    return contexts.map((context, i) => 
      `In ${context}, I demonstrated strong ${code} competency by ${this.generateEnablingAction(code, industry)}. `
    ).join('\n\n');
  }

  private generateQuestionResponse(question: string, competency: string, industry: string, level: string): string {
    // Generate a response that directly addresses the guiding question
    const questionLower = question.toLowerCase();
    
    let response = 'Regarding ';
    
    // Simplify the question for the response intro
    if (questionLower.includes('how')) {
      response += 'how I ' + question.substring(question.toLowerCase().indexOf('how') + 4);
    } else if (questionLower.includes('what')) {
      response += 'what ' + question.substring(question.toLowerCase().indexOf('what') + 5);
    } else {
      response += question;
    }
    
    response = response.replace('?', ':');
    response += ` In my ${industry} experience, `;
    response += this.generateSpecificAnswer(question, competency, level);
    
    return response;
  }

  private generateSpecificAnswer(question: string, competency: string, level: string): string {
    // Generate specific answers based on question type and competency
    const questionLower = question.toLowerCase();
    
    if (questionLower.includes('process') || questionLower.includes('approach')) {
      return `I follow a systematic approach that includes ${this.getProcessSteps(competency, level)}.`;
    } else if (questionLower.includes('example') || questionLower.includes('demonstrate')) {
      return `I demonstrated this through ${this.getSpecificExample(competency, level)}.`;
    } else if (questionLower.includes('impact') || questionLower.includes('result')) {
      return `the impact included ${this.generateBusinessImpact(competency, level === '2' ? 'high' : 'moderate')}.`;
    } else {
      return `I ensure ${this.getGeneralApproach(competency, level)}.`;
    }
  }

  private getCompetencyDescription(code: string): string {
    const descriptions: Record<string, string> = {
      'FR': 'Financial Reporting - Developing and evaluating financial information',
      'MA': 'Management Accounting - Planning, analyzing and controlling operations',
      'TX': 'Taxation - Compliance and planning for various tax obligations',
      'AA': 'Audit and Assurance - Enhancing reliability of information',
      'FN': 'Finance - Financial analysis and treasury management',
      'SG': 'Strategy and Governance - Strategic thinking and risk management'
    };
    
    return descriptions[code] || 'Professional competency area';
  }

  private getIndustryContexts(industry: string): string[] {
    const contexts: Record<string, string[]> = {
      'manufacturing': ['production cost analysis', 'inventory management', 'supply chain optimization'],
      'technology': ['SaaS metrics', 'R&D capitalization', 'revenue recognition'],
      'retail': ['multi-location operations', 'seasonal fluctuations', 'inventory turnover'],
      'finance': ['regulatory compliance', 'risk assessment', 'portfolio management'],
      'healthcare': ['patient billing', 'grant management', 'regulatory reporting'],
      'real estate': ['property valuations', 'lease accounting', 'development projects'],
      'hospitality': ['revenue management', 'franchise operations', 'customer analytics'],
      'consulting': ['client engagements', 'project profitability', 'resource allocation'],
      'non-profit': ['fund accounting', 'donor restrictions', 'program efficiency'],
      'government': ['public accountability', 'budget compliance', 'performance reporting']
    };
    
    return contexts[industry] || ['business operations', 'financial processes', 'strategic initiatives'];
  }

  private getCompetencyActions(competency: string, complexity: 'complex' | 'routine'): string[] {
    const actions: Record<string, { complex: string[], routine: string[] }> = {
      'FR': {
        complex: ['Implemented new accounting standards', 'Developed comprehensive disclosure frameworks', 'Led financial restatement project'],
        routine: ['Prepared monthly financial statements', 'Performed account reconciliations', 'Documented accounting policies']
      },
      'MA': {
        complex: ['Designed performance measurement system', 'Developed predictive cost models', 'Led budgeting transformation'],
        routine: ['Prepared variance analyses', 'Maintained cost accounting records', 'Generated management reports']
      },
      'TX': {
        complex: ['Structured tax-efficient reorganization', 'Developed transfer pricing strategy', 'Led tax provision review'],
        routine: ['Prepared tax returns', 'Calculated tax installments', 'Maintained tax compliance calendar']
      },
      'AA': {
        complex: ['Designed risk-based audit approach', 'Evaluated complex estimates', 'Led control remediation project'],
        routine: ['Performed control testing', 'Documented audit procedures', 'Prepared working papers']
      },
      'FN': {
        complex: ['Structured financing arrangement', 'Developed valuation models', 'Led capital allocation strategy'],
        routine: ['Prepared cash flow forecasts', 'Monitored covenant compliance', 'Analyzed investment returns']
      },
      'SG': {
        complex: ['Developed strategic plan', 'Implemented ERM framework', 'Led governance transformation'],
        routine: ['Prepared board reports', 'Monitored KPIs', 'Maintained risk registers']
      }
    };
    
    return actions[competency]?.[complexity] || ['Performed analysis', 'Developed solutions', 'Implemented improvements'];
  }

  private generateBusinessImpact(competency: string, level: 'high' | 'moderate'): string {
    const impacts = {
      high: [
        'a 25% improvement in efficiency',
        '$2M in cost savings',
        'enhanced decision-making across the organization',
        'significant risk mitigation',
        'strategic competitive advantage'
      ],
      moderate: [
        'improved accuracy and timeliness',
        'streamlined processes',
        'enhanced compliance',
        'better resource allocation',
        'increased stakeholder confidence'
      ]
    };
    
    const relevantImpacts = impacts[level];
    return relevantImpacts[Math.floor(Math.random() * relevantImpacts.length)];
  }

  private getProcessSteps(competency: string, level: string): string {
    if (level === '2') {
      return 'comprehensive analysis, stakeholder consultation, innovative solution design, and strategic implementation';
    }
    return 'initial assessment, standard procedure application, quality review, and timely delivery';
  }

  private getSpecificExample(competency: string, level: string): string {
    if (level === '2') {
      return 'leading a complex project that required significant judgment and cross-functional collaboration';
    }
    return 'successfully completing assigned tasks with attention to detail and adherence to standards';
  }

  private getGeneralApproach(competency: string, level: string): string {
    if (level === '2') {
      return 'comprehensive analysis, professional judgment, and strategic thinking in all aspects';
    }
    return 'accuracy, compliance, and consistent application of professional standards';
  }

  private generateDevelopmentActivities(competency: string, industry: string): string {
    const activities = [
      'professional development courses',
      'industry conferences',
      'cross-functional projects',
      'mentoring relationships',
      'technical literature review'
    ];
    
    return activities[Math.floor(Math.random() * activities.length)];
  }

  private generateEnablingAction(code: string, industry: string): string {
    const actions: Record<string, string[]> = {
      'PROF': ['maintaining confidentiality', 'upholding ethical standards', 'demonstrating integrity'],
      'COMM': ['presenting complex findings clearly', 'writing comprehensive reports', 'facilitating discussions'],
      'SELF': ['prioritizing effectively', 'seeking feedback', 'pursuing relevant training'],
      'TEAM': ['collaborating across departments', 'sharing knowledge', 'supporting colleagues'],
      'LEAD': ['guiding team members', 'driving initiatives', 'influencing decisions'],
      'PROB': ['analyzing root causes', 'developing innovative solutions', 'evaluating alternatives']
    };
    
    const codeActions = actions[code] || ['applying professional skills'];
    return codeActions[Math.floor(Math.random() * codeActions.length)];
  }

  private trimResponse(response: string, maxLength: number): string {
    if (response.length <= maxLength) return response;
    
    // Trim intelligently at sentence boundaries
    const trimmed = response.substring(0, maxLength - 3);
    const lastPeriod = trimmed.lastIndexOf('.');
    
    if (lastPeriod > maxLength - 100) {
      return trimmed.substring(0, lastPeriod + 1);
    }
    
    return trimmed + '...';
  }

  private assessResponseQuality(response: string, guidingQuestions: string[]): number {
    let score = 0;
    const maxScore = 100;
    
    // Check character count (20 points)
    const charCount = response.length;
    if (charCount >= 4000 && charCount <= 5000) {
      score += 20;
    } else if (charCount >= 3000 && charCount < 4000) {
      score += 15;
    } else if (charCount >= 2000 && charCount < 3000) {
      score += 10;
    }
    
    // Check guiding question coverage (40 points)
    const questionsCovered = guidingQuestions.filter(q => {
      const keywords = this.extractKeywords(q);
      return keywords.some(kw => response.toLowerCase().includes(kw.toLowerCase()));
    }).length;
    
    score += (questionsCovered / guidingQuestions.length) * 40;
    
    // Check for examples (20 points)
    const exampleCount = (response.match(/example/gi) || []).length;
    if (exampleCount >= 3) score += 20;
    else if (exampleCount >= 2) score += 15;
    else if (exampleCount >= 1) score += 10;
    
    // Check for quantifiable results (10 points)
    const hasNumbers = /\d+%|\$\d+|\d+\s*(thousand|million|K|M)/.test(response);
    if (hasNumbers) score += 10;
    
    // Check for professional terminology (10 points)
    const professionalTerms = ['analysis', 'implementation', 'strategic', 'compliance', 'framework', 'methodology'];
    const termCount = professionalTerms.filter(term => response.toLowerCase().includes(term)).length;
    score += Math.min(10, termCount * 2);
    
    return Math.round((score / maxScore) * 100) / 100;
  }

  private extractKeywords(question: string): string[] {
    // Extract key nouns and verbs from questions
    const stopWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'shall'];
    
    const words = question.toLowerCase()
      .replace(/[?.,!]/g, '')
      .split(' ')
      .filter(word => word.length > 3 && !stopWords.includes(word));
    
    return [...new Set(words)];
  }

  private calculateStatistics(): TrainingDataset['statistics'] {
    const statistics = {
      totalExamples: this.trainingData.length,
      byCompetency: {} as Record<string, number>,
      byLevel: {} as Record<string, number>,
      byIndustry: {} as Record<string, number>,
      averageCharacterCount: 0
    };
    
    let totalChars = 0;
    
    this.trainingData.forEach(example => {
      // By competency
      statistics.byCompetency[example.metadata.competency] = 
        (statistics.byCompetency[example.metadata.competency] || 0) + 1;
      
      // By level
      statistics.byLevel[example.metadata.level] = 
        (statistics.byLevel[example.metadata.level] || 0) + 1;
      
      // By industry
      statistics.byIndustry[example.metadata.industry] = 
        (statistics.byIndustry[example.metadata.industry] || 0) + 1;
      
      // Character count
      totalChars += example.metadata.characterCount || 0;
    });
    
    statistics.averageCharacterCount = Math.round(totalChars / this.trainingData.length);
    
    return statistics;
  }

  async exportToJSONL(filename: string): Promise<void> {
    const jsonlData = this.trainingData
      .map(item => JSON.stringify(item))
      .join('\n');
    
    await fs.writeFile(filename, jsonlData, 'utf-8');
  }

  async exportToJSON(filename: string): Promise<void> {
    const dataset = this.generateDataset();
    await saveJsonFile(filename, dataset);
  }
}