/**
 * Unit tests for CPA Web Scraper
 */

import { CPAWebScraper } from '../../../../src/services/cpa-data-collector/scrapers/cpa-web-scraper';
import { CPACollectorConfig } from '../../../../src/services/cpa-data-collector/config/cpa-collector-config';
import { ResourceMetadata } from '../../../../src/services/cpa-data-collector/utils/resource-metadata';

describe('CPAWebScraper', () => {
  let scraper: CPAWebScraper;
  let mockConfig: CPACollectorConfig;

  beforeEach(() => {
    mockConfig = {
      snapshotDir: '/tmp/test-snapshots',
      knowledgeDir: '/tmp/test-knowledge',
      metadataDir: '/tmp/test-metadata',
      tempDir: '/tmp/test-temp',
      cpabcBaseUrl: 'https://www.bccpa.ca/',
      cpaCanadaBaseUrl: 'https://www.cpacanada.ca/',
      headless: true,
      userAgent: 'Test User Agent',
      retryAttempts: 3,
      timeout: 30000,
      validateChecksums: true,
      requireAllResources: false
    };
    
    scraper = new CPAWebScraper(mockConfig);
  });

  afterEach(async () => {
    await scraper.cleanup();
  });

  describe('initialize', () => {
    it('should initialize browser successfully', async () => {
      await expect(scraper.initialize()).resolves.not.toThrow();
    });
  });

  describe('classifyDocument', () => {
    it('should classify documents correctly', () => {
      const testCases = [
        { filename: 'guide.pdf', title: 'PERT Guide', expected: 'guidance' },
        { filename: 'form.pdf', title: 'Application Form', expected: 'form' },
        { filename: 'checklist.pdf', title: 'Requirements Checklist', expected: 'checklist' },
        { filename: 'handbook.pdf', title: 'CPA Handbook', expected: 'handbook' },
        { filename: 'policy.pdf', title: 'Policy Document', expected: 'policy' },
        { filename: 'example.pdf', title: 'Example Responses', expected: 'example' },
        { filename: 'other.pdf', title: 'Other Document', expected: 'official' }
      ];

      testCases.forEach(({ filename, title, expected }) => {
        // Access private method through reflection for testing
        const result = (scraper as any).classifyDocument(filename, title);
        expect(result).toBe(expected);
      });
    });
  });

  describe('classifyCompetency', () => {
    it('should classify competency types correctly', () => {
      const testCases = [
        { title: 'Technical Competencies', context: '', expected: 'technical' },
        { title: 'Guide', context: 'enabling competencies', expected: 'enabling' },
        { title: 'All Competencies', context: 'both technical and enabling', expected: 'mixed' },
        { title: 'PERT Guide', context: 'general information', expected: 'general' }
      ];

      testCases.forEach(({ title, context, expected }) => {
        const result = (scraper as any).classifyCompetency(title, context);
        expect(result).toBe(expected);
      });
    });
  });

  describe('getMetadata', () => {
    it('should return empty array initially', () => {
      expect(scraper.getMetadata()).toEqual([]);
    });
  });
});