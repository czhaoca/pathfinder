/**
 * PDF Content Extractor
 * Extracts structured information from CPA PERT PDFs
 */

import pdf from 'pdf-parse';
import natural from 'natural';
import fs from 'fs/promises';
import { ExtractedContent, ExtractedCompetency, ResourceMetadata } from '../utils/resource-metadata';

export class PDFContentExtractor {
  private tokenizer: natural.WordTokenizer;

  constructor() {
    this.tokenizer = new natural.WordTokenizer();
  }

  async extractContent(pdfPath: string, metadata: ResourceMetadata): Promise<ExtractedContent> {
    const dataBuffer = await fs.readFile(pdfPath);
    const pdfData = await pdf(dataBuffer);
    
    const content: ExtractedContent = {
      text: pdfData.text,
      pages: pdfData.numpages,
      info: pdfData.info,
      metadata: metadata,
      extracted: {
        competencies: this.extractCompetencies(pdfData.text),
        guidingQuestions: this.extractGuidingQuestions(pdfData.text),
        proficiencyLevels: this.extractProficiencyLevels(pdfData.text),
        examples: this.extractExamples(pdfData.text),
        requirements: this.extractRequirements(pdfData.text)
      }
    };
    
    return content;
  }

  private extractCompetencies(text: string): ExtractedCompetency[] {
    const competencies: ExtractedCompetency[] = [];
    
    // Technical competency patterns - CPA framework codes
    const techPattern = /(?:FR|MA|AA|TX|FN|SG)\d+[:\s-]+([^\n]+)/gi;
    let match;
    
    while ((match = techPattern.exec(text)) !== null) {
      const code = match[0].split(/[:\s-]/)[0];
      competencies.push({
        code: code,
        description: match[1].trim(),
        type: 'technical'
      });
    }
    
    // Enabling competency patterns
    const enablingKeywords = [
      'professional', 'ethical', 'communication', 
      'teamwork', 'leadership', 'self-management',
      'problem-solving', 'decision-making'
    ];
    
    enablingKeywords.forEach(keyword => {
      const regex = new RegExp(`${keyword}[^.]*competenc[^.]*`, 'gi');
      const matches = text.match(regex);
      if (matches) {
        matches.forEach(m => {
          competencies.push({
            keyword: keyword,
            context: m,
            type: 'enabling'
          });
        });
      }
    });
    
    return competencies;
  }

  private extractGuidingQuestions(text: string): string[] {
    const questions: string[] = [];
    
    // Look for question patterns
    const questionPatterns = [
      /(?:•|[-–—]|\d+\.)\s*([^?]+\?)/g,
      /(?:Guiding Questions?|Questions? to Consider)[:\s]*([^?]+\?)/gi
    ];
    
    questionPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const question = match[1].trim();
        
        // Filter for substantive guiding questions
        if (question.length > 20 && 
            (question.includes('How') || 
             question.includes('What') || 
             question.includes('Describe') ||
             question.includes('Which') ||
             question.includes('Why'))) {
          questions.push(question);
        }
      }
    });
    
    // Remove duplicates
    return [...new Set(questions)];
  }

  private extractProficiencyLevels(text: string): Record<string, any> {
    const levels: Record<string, any> = {};
    
    // Level patterns - CPA uses 0, 1, 2 proficiency levels
    const levelPatterns = [
      { pattern: /Level\s+0[:\s-]+([^.]+)/i, key: 'level0' },
      { pattern: /Level\s+1[:\s-]+([^.]+)/i, key: 'level1' },
      { pattern: /Level\s+2[:\s-]+([^.]+)/i, key: 'level2' }
    ];
    
    levelPatterns.forEach(({ pattern, key }, index) => {
      const match = text.match(pattern);
      if (match) {
        levels[key] = {
          number: index,
          description: match[1].trim()
        };
      }
    });
    
    // Also extract proficiency level descriptions
    const proficiencyPattern = /(?:Level\s+\d+[:\s-]*)?(?:Routine|Non-routine|Complex)[^.]*\./gi;
    const proficiencyMatches = text.match(proficiencyPattern);
    if (proficiencyMatches) {
      levels.descriptions = proficiencyMatches.map(m => m.trim());
    }
    
    return levels;
  }

  private extractExamples(text: string): string[] {
    const examples: string[] = [];
    
    // Example patterns
    const examplePatterns = [
      /(?:example|e\.g\.|for instance|such as)[:\s]+([^.]+\.)/gi,
      /(?:Examples include)[:\s]+([^.]+\.)/gi
    ];
    
    examplePatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const example = match[1].trim();
        if (example.length > 20) {
          examples.push(example);
        }
      }
    });
    
    return [...new Set(examples)];
  }

  private extractRequirements(text: string): string[] {
    const requirements: string[] = [];
    
    // Requirement patterns
    const requirementKeywords = [
      'must', 'require', 'need to', 'should', 'minimum', 
      'at least', 'mandatory', 'necessary', 'essential'
    ];
    
    requirementKeywords.forEach(keyword => {
      const regex = new RegExp(`[^.]*\\b${keyword}\\b[^.]+\\.`, 'gi');
      const matches = text.match(regex);
      if (matches) {
        matches.forEach(match => {
          const req = match.trim();
          if (req.length > 30) {
            requirements.push(req);
          }
        });
      }
    });
    
    // Also look for numbered requirements
    const numberedReqPattern = /(?:\d+\.\s*)([^.]*(?:must|require|need)[^.]+\.)/gi;
    let match;
    while ((match = numberedReqPattern.exec(text)) !== null) {
      requirements.push(match[1].trim());
    }
    
    return [...new Set(requirements)];
  }

  /**
   * Extract competency-specific content
   */
  async extractCompetencyContent(pdfPath: string, competencyCode: string): Promise<any> {
    const dataBuffer = await fs.readFile(pdfPath);
    const pdfData = await pdf(dataBuffer);
    const text = pdfData.text;
    
    // Find sections related to the specific competency
    const competencyPattern = new RegExp(`${competencyCode}[:\\s-]+([^\\n]+(?:\\n(?!\\w{2}\\d)[^\\n]+)*)`, 'gi');
    const matches = text.match(competencyPattern);
    
    if (!matches) return null;
    
    return {
      competencyCode,
      sections: matches,
      guidingQuestions: this.extractGuidingQuestions(matches.join('\n')),
      examples: this.extractExamples(matches.join('\n'))
    };
  }
}