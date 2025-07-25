/**
 * Unit tests for PDF Content Extractor
 */

import { PDFContentExtractor } from '../../../../src/services/cpa-data-collector/extractors/pdf-content-extractor';
import { ExtractedCompetency } from '../../../../src/services/cpa-data-collector/utils/resource-metadata';

describe('PDFContentExtractor', () => {
  let extractor: PDFContentExtractor;

  beforeEach(() => {
    extractor = new PDFContentExtractor();
  });

  describe('extractCompetencies', () => {
    it('should extract technical competencies with codes', () => {
      const testText = `
        FR1: Financial reporting needs and systems
        MA2: Cost management and budgeting
        TX3: Tax compliance and planning
      `;

      const result = (extractor as any).extractCompetencies(testText);
      
      expect(result).toHaveLength(3);
      expect(result[0]).toMatchObject({
        code: 'FR1',
        description: 'Financial reporting needs and systems',
        type: 'technical'
      });
    });

    it('should extract enabling competencies by keywords', () => {
      const testText = `
        Professional competency includes maintaining ethical standards.
        Communication competency is essential for CPAs.
      `;

      const result = (extractor as any).extractCompetencies(testText);
      
      const professionalComp = result.find((c: ExtractedCompetency) => c.keyword === 'professional');
      const communicationComp = result.find((c: ExtractedCompetency) => c.keyword === 'communication');
      
      expect(professionalComp).toBeDefined();
      expect(communicationComp).toBeDefined();
      expect(professionalComp?.type).toBe('enabling');
    });
  });

  describe('extractGuidingQuestions', () => {
    it('should extract questions with proper filtering', () => {
      const testText = `
        • How do you approach financial analysis?
        • What methods do you use for cost control?
        - Describe your experience with tax planning.
        • Short question?
        • Which frameworks have you implemented in your organization?
      `;

      const result = (extractor as any).extractGuidingQuestions(testText);
      
      expect(result.length).toBeGreaterThan(0);
      expect(result).toContain('How do you approach financial analysis?');
      expect(result).toContain('What methods do you use for cost control?');
      expect(result).not.toContain('Short question?'); // Too short
    });
  });

  describe('extractProficiencyLevels', () => {
    it('should extract CPA proficiency levels', () => {
      const testText = `
        Level 0: Awareness and basic understanding
        Level 1: Routine application of knowledge
        Level 2: Complex analysis and judgment
      `;

      const result = (extractor as any).extractProficiencyLevels(testText);
      
      expect(result.level0).toBeDefined();
      expect(result.level1).toBeDefined();
      expect(result.level2).toBeDefined();
      expect(result.level0.number).toBe(0);
      expect(result.level1.description).toContain('Routine application');
    });
  });

  describe('extractExamples', () => {
    it('should extract examples from text', () => {
      const testText = `
        For example, implementing IFRS standards in manufacturing.
        e.g., developing cost allocation models for multiple departments.
        For instance, conducting tax planning for cross-border transactions.
      `;

      const result = (extractor as any).extractExamples(testText);
      
      expect(result.length).toBe(3);
      expect(result[0]).toContain('implementing IFRS standards');
    });
  });

  describe('extractRequirements', () => {
    it('should extract requirement statements', () => {
      const testText = `
        Candidates must demonstrate proficiency in financial reporting.
        You need to have at least 30 months of experience.
        The minimum requirement is Level 1 proficiency.
        Candidates should complete all competencies.
      `;

      const result = (extractor as any).extractRequirements(testText);
      
      expect(result.length).toBeGreaterThan(0);
      expect(result.some(r => r.includes('must demonstrate'))).toBe(true);
      expect(result.some(r => r.includes('at least 30 months'))).toBe(true);
    });
  });
});