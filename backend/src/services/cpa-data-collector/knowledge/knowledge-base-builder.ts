/**
 * Knowledge Base Builder
 * Builds structured knowledge graph from extracted CPA content
 */

import { ExtractedContent, ExtractedCompetency } from '../utils/resource-metadata';
import { saveJsonFile } from '../utils/file-utils';
import path from 'path';

export interface CompetencyKnowledge {
  type: 'technical' | 'enabling';
  descriptions: string[];
  relatedQuestions: string[];
  examples: string[];
  requirements: string[];
  proficiencyLevels?: Record<string, any>;
}

export interface KnowledgeGraph {
  competencies: Record<string, CompetencyKnowledge>;
  guidingQuestions: Record<string, string[]>;
  proficiencyLevels: Record<string, any>;
  examples: Record<string, string[]>;
  requirements: Record<string, string[]>;
  metadata: {
    lastUpdated: string;
    totalCompetencies: number;
    totalQuestions: number;
    totalExamples: number;
    sources: string[];
  };
}

export class KnowledgeBaseBuilder {
  private knowledgeGraph: KnowledgeGraph;

  constructor() {
    this.knowledgeGraph = {
      competencies: {},
      guidingQuestions: {},
      proficiencyLevels: {},
      examples: {},
      requirements: {},
      metadata: {
        lastUpdated: new Date().toISOString(),
        totalCompetencies: 0,
        totalQuestions: 0,
        totalExamples: 0,
        sources: []
      }
    };
  }

  async buildFromExtractedContent(extractedContents: ExtractedContent[]): Promise<KnowledgeGraph> {
    // Process each extracted content
    for (const content of extractedContents) {
      this.processCompetencies(content.extracted.competencies);
      this.processGuidingQuestions(content.extracted.guidingQuestions, content);
      this.processProficiencyLevels(content.extracted.proficiencyLevels);
      this.processExamples(content.extracted.examples, content);
      this.processRequirements(content.extracted.requirements, content);
      
      // Track source
      if (!this.knowledgeGraph.metadata.sources.includes(content.metadata.source)) {
        this.knowledgeGraph.metadata.sources.push(content.metadata.source);
      }
    }
    
    // Update metadata
    this.updateMetadata();
    
    return this.knowledgeGraph;
  }

  private processCompetencies(competencies: ExtractedCompetency[]): void {
    competencies.forEach(comp => {
      const key = comp.code || comp.keyword || 'unknown';
      
      if (!this.knowledgeGraph.competencies[key]) {
        this.knowledgeGraph.competencies[key] = {
          type: comp.type,
          descriptions: [],
          relatedQuestions: [],
          examples: [],
          requirements: []
        };
      }
      
      // Add description if available
      if (comp.description && !this.knowledgeGraph.competencies[key].descriptions.includes(comp.description)) {
        this.knowledgeGraph.competencies[key].descriptions.push(comp.description);
      }
      
      // Add context if available
      if (comp.context && !this.knowledgeGraph.competencies[key].descriptions.includes(comp.context)) {
        this.knowledgeGraph.competencies[key].descriptions.push(comp.context);
      }
    });
  }

  private processGuidingQuestions(questions: string[], content: ExtractedContent): void {
    questions.forEach(question => {
      // Classify question by competency and level
      const competency = this.classifyQuestionCompetency(question, content.text);
      const level = this.classifyQuestionLevel(question);
      
      const key = `${competency}_${level}`;
      if (!this.knowledgeGraph.guidingQuestions[key]) {
        this.knowledgeGraph.guidingQuestions[key] = [];
      }
      
      if (!this.knowledgeGraph.guidingQuestions[key].includes(question)) {
        this.knowledgeGraph.guidingQuestions[key].push(question);
      }
      
      // Also link to competency
      if (this.knowledgeGraph.competencies[competency]) {
        if (!this.knowledgeGraph.competencies[competency].relatedQuestions.includes(question)) {
          this.knowledgeGraph.competencies[competency].relatedQuestions.push(question);
        }
      }
    });
  }

  private processProficiencyLevels(levels: Record<string, any>): void {
    Object.entries(levels).forEach(([key, value]) => {
      if (!this.knowledgeGraph.proficiencyLevels[key]) {
        this.knowledgeGraph.proficiencyLevels[key] = value;
      } else {
        // Merge with existing data
        if (Array.isArray(value)) {
          this.knowledgeGraph.proficiencyLevels[key] = [
            ...new Set([...this.knowledgeGraph.proficiencyLevels[key], ...value])
          ];
        } else if (typeof value === 'object') {
          this.knowledgeGraph.proficiencyLevels[key] = {
            ...this.knowledgeGraph.proficiencyLevels[key],
            ...value
          };
        }
      }
    });
  }

  private processExamples(examples: string[], content: ExtractedContent): void {
    examples.forEach(example => {
      // Try to classify example by competency
      const competency = this.classifyExampleCompetency(example, content.text);
      
      if (!this.knowledgeGraph.examples[competency]) {
        this.knowledgeGraph.examples[competency] = [];
      }
      
      if (!this.knowledgeGraph.examples[competency].includes(example)) {
        this.knowledgeGraph.examples[competency].push(example);
      }
      
      // Also link to competency knowledge
      if (this.knowledgeGraph.competencies[competency]) {
        if (!this.knowledgeGraph.competencies[competency].examples.includes(example)) {
          this.knowledgeGraph.competencies[competency].examples.push(example);
        }
      }
    });
  }

  private processRequirements(requirements: string[], content: ExtractedContent): void {
    requirements.forEach(requirement => {
      // Classify by type
      const type = this.classifyRequirementType(requirement);
      
      if (!this.knowledgeGraph.requirements[type]) {
        this.knowledgeGraph.requirements[type] = [];
      }
      
      if (!this.knowledgeGraph.requirements[type].includes(requirement)) {
        this.knowledgeGraph.requirements[type].push(requirement);
      }
    });
  }

  private classifyQuestionCompetency(question: string, fullText: string): string {
    // CPA Technical Competency Areas
    const competencyKeywords: Record<string, string[]> = {
      'FR': ['financial report', 'accounting', 'IFRS', 'ASPE', 'financial statement'],
      'MA': ['management accounting', 'budget', 'cost', 'performance', 'variance'],
      'TX': ['tax', 'income tax', 'GST', 'HST', 'compliance', 'CRA'],
      'AA': ['audit', 'control', 'assurance', 'risk assessment', 'internal control'],
      'FN': ['finance', 'treasury', 'capital', 'investment', 'valuation'],
      'SG': ['strategy', 'governance', 'risk management', 'strategic']
    };
    
    const lowerQuestion = question.toLowerCase();
    
    // Check for specific competency codes mentioned nearby in the text
    for (const [code, keywords] of Object.entries(competencyKeywords)) {
      // Direct code mention
      if (question.includes(code) || question.includes(`${code}:`)) {
        return code;
      }
      
      // Keyword matching
      if (keywords.some(kw => lowerQuestion.includes(kw))) {
        return code;
      }
    }
    
    // Check enabling competencies
    const enablingKeywords: Record<string, string[]> = {
      'PROF': ['professional', 'ethical', 'ethics'],
      'COMM': ['communication', 'present', 'report'],
      'SELF': ['self-management', 'learning', 'development'],
      'TEAM': ['teamwork', 'collaborate', 'team'],
      'LEAD': ['leadership', 'lead', 'mentor'],
      'PROB': ['problem', 'solving', 'analyze']
    };
    
    for (const [code, keywords] of Object.entries(enablingKeywords)) {
      if (keywords.some(kw => lowerQuestion.includes(kw))) {
        return code;
      }
    }
    
    return 'GENERAL';
  }

  private classifyQuestionLevel(question: string): string {
    const lowerQuestion = question.toLowerCase();
    
    // Level 2 indicators (complex, non-routine)
    const level2Keywords = [
      'complex', 'non-routine', 'judgment', 'integrate', 'develop',
      'design', 'evaluate', 'assess', 'recommend', 'strategy',
      'multiple', 'various', 'advanced', 'sophisticated'
    ];
    
    // Level 1 indicators (routine)
    const level1Keywords = [
      'routine', 'basic', 'simple', 'standard', 'common',
      'typical', 'regular', 'straightforward', 'fundamental'
    ];
    
    // Level 0 indicators (awareness)
    const level0Keywords = [
      'aware', 'understand', 'knowledge', 'familiar', 'recognize'
    ];
    
    if (level2Keywords.some(kw => lowerQuestion.includes(kw))) return '2';
    if (level0Keywords.some(kw => lowerQuestion.includes(kw))) return '0';
    
    // Default to level 1
    return '1';
  }

  private classifyExampleCompetency(example: string, fullText: string): string {
    // Similar logic to classifyQuestionCompetency
    const competencyKeywords: Record<string, string[]> = {
      'FR': ['journal', 'entry', 'disclosure', 'IFRS', 'ASPE', 'financial statement'],
      'MA': ['budget', 'variance', 'cost', 'KPI', 'dashboard'],
      'TX': ['tax return', 'deduction', 'T2', 'T1', 'GST'],
      'AA': ['audit procedure', 'control test', 'sample', 'materiality'],
      'FN': ['NPV', 'DCF', 'ROI', 'capital budget', 'financing'],
      'SG': ['SWOT', 'strategic plan', 'risk matrix', 'governance']
    };
    
    const lowerExample = example.toLowerCase();
    
    for (const [code, keywords] of Object.entries(competencyKeywords)) {
      if (keywords.some(kw => lowerExample.includes(kw))) {
        return code;
      }
    }
    
    return 'GENERAL';
  }

  private classifyRequirementType(requirement: string): string {
    const lowerReq = requirement.toLowerCase();
    
    if (lowerReq.includes('experience') || lowerReq.includes('month') || lowerReq.includes('year')) {
      return 'experience_duration';
    }
    if (lowerReq.includes('level') || lowerReq.includes('proficiency')) {
      return 'proficiency_level';
    }
    if (lowerReq.includes('example') || lowerReq.includes('demonstrate')) {
      return 'demonstration';
    }
    if (lowerReq.includes('character') || lowerReq.includes('word')) {
      return 'format';
    }
    
    return 'general';
  }

  private updateMetadata(): void {
    this.knowledgeGraph.metadata.totalCompetencies = Object.keys(this.knowledgeGraph.competencies).length;
    this.knowledgeGraph.metadata.totalQuestions = Object.values(this.knowledgeGraph.guidingQuestions)
      .reduce((sum, questions) => sum + questions.length, 0);
    this.knowledgeGraph.metadata.totalExamples = Object.values(this.knowledgeGraph.examples)
      .reduce((sum, examples) => sum + examples.length, 0);
    this.knowledgeGraph.metadata.lastUpdated = new Date().toISOString();
  }

  async saveKnowledgeBase(outputPath: string): Promise<void> {
    await saveJsonFile(outputPath, this.knowledgeGraph);
  }

  getKnowledgeGraph(): KnowledgeGraph {
    return this.knowledgeGraph;
  }
}