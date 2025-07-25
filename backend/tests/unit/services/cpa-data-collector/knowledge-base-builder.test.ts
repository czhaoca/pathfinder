/**
 * Unit tests for Knowledge Base Builder
 */

import { KnowledgeBaseBuilder } from '../../../../src/services/cpa-data-collector/knowledge/knowledge-base-builder';
import { ExtractedContent } from '../../../../src/services/cpa-data-collector/utils/resource-metadata';

describe('KnowledgeBaseBuilder', () => {
  let builder: KnowledgeBaseBuilder;

  beforeEach(() => {
    builder = new KnowledgeBaseBuilder();
  });

  describe('classifyQuestionCompetency', () => {
    it('should classify technical competency questions', () => {
      const testCases = [
        { question: 'How do you apply IFRS standards?', expected: 'FR' },
        { question: 'Describe your budgeting process', expected: 'MA' },
        { question: 'What is your approach to tax compliance?', expected: 'TX' },
        { question: 'How do you perform audit procedures?', expected: 'AA' },
        { question: 'Explain your capital budgeting analysis', expected: 'FN' },
        { question: 'Describe your strategic planning process', expected: 'SG' }
      ];

      testCases.forEach(({ question, expected }) => {
        const result = (builder as any).classifyQuestionCompetency(question, '');
        expect(result).toBe(expected);
      });
    });

    it('should classify enabling competency questions', () => {
      const testCases = [
        { question: 'How do you maintain ethical standards?', expected: 'PROF' },
        { question: 'Describe your communication approach', expected: 'COMM' },
        { question: 'How do you manage your professional development?', expected: 'SELF' },
        { question: 'Explain your approach to teamwork', expected: 'TEAM' },
        { question: 'How do you demonstrate leadership?', expected: 'LEAD' },
        { question: 'Describe your problem-solving methodology', expected: 'PROB' }
      ];

      testCases.forEach(({ question, expected }) => {
        const result = (builder as any).classifyQuestionCompetency(question, '');
        expect(result).toBe(expected);
      });
    });
  });

  describe('classifyQuestionLevel', () => {
    it('should classify question proficiency levels', () => {
      const testCases = [
        { question: 'How do you handle complex financial analysis?', expected: '2' },
        { question: 'Describe routine procedures you follow', expected: '1' },
        { question: 'Are you aware of the requirements?', expected: '0' },
        { question: 'How do you integrate multiple frameworks?', expected: '2' },
        { question: 'What basic procedures do you use?', expected: '1' }
      ];

      testCases.forEach(({ question, expected }) => {
        const result = (builder as any).classifyQuestionLevel(question);
        expect(result).toBe(expected);
      });
    });
  });

  describe('buildFromExtractedContent', () => {
    it('should build knowledge graph from extracted content', async () => {
      const mockContent: ExtractedContent = {
        text: 'Test content',
        pages: 10,
        info: {},
        metadata: {
          id: 'test1',
          url: 'http://test.com',
          filename: 'test.pdf',
          title: 'Test Document',
          context: 'Test context',
          sha256: 'abc123',
          timestamp: new Date().toISOString(),
          fileSize: 1000,
          source: 'CPABC',
          documentType: 'guidance',
          competencyClassification: 'technical',
          routeRelevance: 'EVR',
          validationStatus: 'verified'
        },
        extracted: {
          competencies: [
            { code: 'FR1', description: 'Financial reporting', type: 'technical' }
          ],
          guidingQuestions: ['How do you prepare financial statements?'],
          proficiencyLevels: { level1: { number: 1, description: 'Routine' } },
          examples: ['Preparing monthly reports'],
          requirements: ['Must have 30 months experience']
        }
      };

      const knowledgeGraph = await builder.buildFromExtractedContent([mockContent]);

      expect(knowledgeGraph.metadata.totalCompetencies).toBe(1);
      expect(knowledgeGraph.metadata.totalQuestions).toBeGreaterThan(0);
      expect(knowledgeGraph.competencies['FR1']).toBeDefined();
      expect(knowledgeGraph.metadata.sources).toContain('CPABC');
    });
  });

  describe('classifyExampleCompetency', () => {
    it('should classify examples by competency area', () => {
      const testCases = [
        { example: 'Prepared journal entries for year-end', expected: 'FR' },
        { example: 'Created budget variance analysis', expected: 'MA' },
        { example: 'Filed corporate tax returns', expected: 'TX' },
        { example: 'Performed control testing procedures', expected: 'AA' },
        { example: 'Calculated NPV for investment decision', expected: 'FN' },
        { example: 'Developed SWOT analysis for strategic planning', expected: 'SG' }
      ];

      testCases.forEach(({ example, expected }) => {
        const result = (builder as any).classifyExampleCompetency(example, '');
        expect(result).toBe(expected);
      });
    });
  });
});