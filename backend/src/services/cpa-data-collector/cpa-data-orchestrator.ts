/**
 * CPA Data Orchestrator
 * Coordinates all components of the CPA data collection pipeline
 */

import path from 'path';
import { CPAWebScraper } from './scrapers/cpa-web-scraper';
import { PDFContentExtractor } from './extractors/pdf-content-extractor';
import { CPACanadaBypass } from './scrapers/cpa-canada-bypass';
import { KnowledgeBaseBuilder } from './knowledge/knowledge-base-builder';
import { TrainingDataGenerator } from './training/training-data-generator';
import { CPACollectorConfig, getConfig } from './config/cpa-collector-config';
import { ResourceMetadata, CollectionReport, ExtractedContent } from './utils/resource-metadata';
import { ensureDirectory, saveJsonFile, generateFilename } from './utils/file-utils';
import fs from 'fs/promises';

export interface PipelineResult {
  success: boolean;
  report: CollectionReport;
  knowledgeBasePath?: string;
  trainingDataPath?: string;
  errors: string[];
}

export class CPADataOrchestrator {
  private config: CPACollectorConfig;
  private scraper: CPAWebScraper;
  private extractor: PDFContentExtractor;
  private canadaBypass: CPACanadaBypass;
  private knowledgeBuilder: KnowledgeBaseBuilder;
  private allMetadata: ResourceMetadata[] = [];
  private errors: string[] = [];

  constructor(config?: CPACollectorConfig) {
    this.config = config || getConfig();
    this.scraper = new CPAWebScraper(this.config);
    this.extractor = new PDFContentExtractor();
    this.canadaBypass = new CPACanadaBypass(this.config);
    this.knowledgeBuilder = new KnowledgeBaseBuilder();
  }

  async runFullPipeline(): Promise<PipelineResult> {
    console.log('Starting CPA PERT data collection pipeline...');
    console.log(`Configuration:
    - Snapshot Directory: ${this.config.snapshotDir}
    - Knowledge Directory: ${this.config.knowledgeDir}
    - Metadata Directory: ${this.config.metadataDir}
    - Headless Mode: ${this.config.headless}
    `);
    
    try {
      // Ensure directories exist
      await this.ensureDirectories();
      
      // Phase 1: Web Scraping from CPA BC
      console.log('\n=== Phase 1: Collecting CPA BC resources ===');
      const cpabcMetadata = await this.collectCPABCResources();
      
      // Phase 2: CPA Canada Resources with bypass strategies
      console.log('\n=== Phase 2: Attempting CPA Canada resource collection ===');
      const canadaMetadata = await this.collectCPACanadaResources();
      
      // Combine all metadata
      this.allMetadata = [...cpabcMetadata, ...canadaMetadata];
      
      // Phase 3: Content Extraction
      console.log('\n=== Phase 3: Extracting content from PDFs ===');
      const extractedContents = await this.extractAllContent();
      
      // Phase 4: Knowledge Base Building
      console.log('\n=== Phase 4: Building knowledge base ===');
      const knowledgeBasePath = await this.buildKnowledgeBase(extractedContents);
      
      // Phase 5: Training Data Generation
      console.log('\n=== Phase 5: Generating LLM training data ===');
      const trainingDataPath = await this.generateTrainingData();
      
      // Phase 6: Save Results and Generate Report
      console.log('\n=== Phase 6: Saving results and generating report ===');
      const report = await this.saveResults();
      
      console.log('\n✅ Pipeline completed successfully!');
      console.log(`📊 Summary:
      - Resources collected: ${report.resourcesCollected}
      - Successful downloads: ${report.successfulDownloads}
      - Failed downloads: ${report.failedDownloads}
      - Knowledge base: ${knowledgeBasePath}
      - Training data: ${trainingDataPath}
      `);
      
      return {
        success: true,
        report,
        knowledgeBasePath,
        trainingDataPath,
        errors: this.errors
      };
      
    } catch (error) {
      console.error('❌ Pipeline error:', error);
      this.errors.push(error instanceof Error ? error.message : String(error));
      
      // Still try to save partial results
      const report = await this.saveResults();
      
      return {
        success: false,
        report,
        errors: this.errors
      };
    } finally {
      await this.cleanup();
    }
  }

  private async ensureDirectories(): Promise<void> {
    const directories = [
      this.config.snapshotDir,
      path.join(this.config.snapshotDir, 'CPABC'),
      path.join(this.config.snapshotDir, 'CPACanada'),
      this.config.knowledgeDir,
      this.config.metadataDir,
      this.config.tempDir
    ];
    
    for (const dir of directories) {
      await ensureDirectory(dir);
    }
  }

  private async collectCPABCResources(): Promise<ResourceMetadata[]> {
    try {
      await this.scraper.initialize();
      const metadata = await this.scraper.scrapeCPABC();
      console.log(`✓ Collected ${metadata.length} CPA BC resources`);
      return metadata;
    } catch (error) {
      console.error('Failed to collect CPA BC resources:', error);
      this.errors.push(`CPA BC collection failed: ${error}`);
      return [];
    }
  }

  private async collectCPACanadaResources(): Promise<ResourceMetadata[]> {
    const canadaUrls = [
      'https://www.cpacanada.ca/-/media/site/operational/ec-education-certification/docs/02639-ec_guiding-questions-practical-experience-rubric.pdf',
      'https://www.cpacanada.ca/-/media/site/operational/ec-education-certification/docs/g10177-ec-cpa-practical-experience-requirements-v20.pdf',
      'https://www.cpacanada.ca/-/media/site/operational/ec-education-certification/docs/01456-ec-harmonized-practical-experience-policy-dec-2021.pdf'
    ];
    
    const metadata: ResourceMetadata[] = [];
    
    for (const url of canadaUrls) {
      try {
        console.log(`\nAttempting to fetch: ${url}`);
        const result = await this.canadaBypass.fetchResource(url);
        
        if (result.success && result.content) {
          // Save the file
          const filename = generateFilename(url);
          const filepath = path.join(this.config.snapshotDir, 'CPACanada', filename);
          await ensureDirectory(path.dirname(filepath));
          await fs.writeFile(filepath, result.content);
          
          // Create metadata
          const resourceMetadata: ResourceMetadata = {
            id: `cpacanada_${filename.replace('.pdf', '')}`,
            url: url,
            filename: filename,
            title: this.extractTitleFromUrl(url),
            context: 'CPA Canada national framework document',
            sha256: '', // Will be calculated later
            timestamp: new Date().toISOString(),
            fileSize: result.size || result.content.length,
            source: 'CPACanada',
            documentType: 'official',
            competencyClassification: 'mixed',
            routeRelevance: 'Both',
            validationStatus: 'verified'
          };
          
          metadata.push(resourceMetadata);
          console.log(`✓ Successfully downloaded: ${filename} using ${result.method}`);
        } else {
          console.log(`✗ Failed to download: ${url}`);
          console.log(`  Recommendation: ${result.recommendation}`);
          this.errors.push(`Failed to download ${url}: ${result.recommendation}`);
        }
      } catch (error) {
        console.error(`Error processing ${url}:`, error);
        this.errors.push(`Error processing ${url}: ${error}`);
      }
    }
    
    console.log(`\n✓ Collected ${metadata.length} CPA Canada resources`);
    return metadata;
  }

  private async extractAllContent(): Promise<ExtractedContent[]> {
    const extractedContents: ExtractedContent[] = [];
    let successCount = 0;
    let failCount = 0;
    
    for (const metadata of this.allMetadata) {
      try {
        const pdfPath = path.join(this.config.snapshotDir, metadata.source, metadata.filename);
        console.log(`Extracting content from: ${metadata.filename}`);
        
        const content = await this.extractor.extractContent(pdfPath, metadata);
        extractedContents.push(content);
        
        // Update metadata with extraction status
        metadata.contentExtracted = true;
        metadata.extractedData = {
          pages: content.pages,
          competencyCount: content.extracted.competencies.length,
          questionCount: content.extracted.guidingQuestions.length
        };
        
        successCount++;
        console.log(`✓ Extracted: ${content.extracted.competencies.length} competencies, ${content.extracted.guidingQuestions.length} questions`);
      } catch (error) {
        failCount++;
        console.error(`✗ Failed to extract from ${metadata.filename}:`, error);
        this.errors.push(`Extraction failed for ${metadata.filename}: ${error}`);
        metadata.contentExtracted = false;
      }
    }
    
    console.log(`\nExtraction complete: ${successCount} successful, ${failCount} failed`);
    return extractedContents;
  }

  private async buildKnowledgeBase(extractedContents: ExtractedContent[]): Promise<string> {
    const knowledgeGraph = await this.knowledgeBuilder.buildFromExtractedContent(extractedContents);
    
    const outputPath = path.join(this.config.knowledgeDir, 'cpa_knowledge_base.json');
    await this.knowledgeBuilder.saveKnowledgeBase(outputPath);
    
    console.log(`✓ Knowledge base saved to: ${outputPath}`);
    console.log(`  - Competencies: ${knowledgeGraph.metadata.totalCompetencies}`);
    console.log(`  - Questions: ${knowledgeGraph.metadata.totalQuestions}`);
    console.log(`  - Examples: ${knowledgeGraph.metadata.totalExamples}`);
    
    return outputPath;
  }

  private async generateTrainingData(): Promise<string> {
    const knowledgeGraph = this.knowledgeBuilder.getKnowledgeGraph();
    const dataGenerator = new TrainingDataGenerator(knowledgeGraph);
    
    // Generate and save in multiple formats
    const jsonPath = path.join(this.config.knowledgeDir, 'cpa_pert_training_data.json');
    const jsonlPath = path.join(this.config.knowledgeDir, 'cpa_pert_training_data.jsonl');
    
    await dataGenerator.exportToJSON(jsonPath);
    await dataGenerator.exportToJSONL(jsonlPath);
    
    const dataset = dataGenerator.generateDataset();
    console.log(`✓ Training data generated:`);
    console.log(`  - Total examples: ${dataset.statistics.totalExamples}`);
    console.log(`  - Average character count: ${dataset.statistics.averageCharacterCount}`);
    console.log(`  - Saved to: ${jsonPath} and ${jsonlPath}`);
    
    return jsonPath;
  }

  private async saveResults(): Promise<CollectionReport> {
    // Save all metadata
    const metadataPath = path.join(this.config.metadataDir, 'collection_metadata.json');
    await saveJsonFile(metadataPath, this.allMetadata);
    
    // Calculate statistics
    const report: CollectionReport = {
      timestamp: new Date().toISOString(),
      resourcesCollected: this.allMetadata.length,
      successfulDownloads: this.allMetadata.filter(m => m.fileSize > 0).length,
      failedDownloads: this.allMetadata.filter(m => m.fileSize === 0).length,
      extractedDocuments: this.allMetadata.filter(m => m.contentExtracted).length,
      totalSize: this.allMetadata.reduce((sum, m) => sum + m.fileSize, 0),
      sources: {
        CPABC: this.allMetadata.filter(m => m.source === 'CPABC').length,
        CPACanada: this.allMetadata.filter(m => m.source === 'CPACanada').length
      },
      documentTypes: this.calculateDocumentTypes(),
      validationStatus: this.calculateValidationStatus()
    };
    
    // Save report
    const reportPath = path.join(this.config.metadataDir, 'collection_report.json');
    await saveJsonFile(reportPath, report);
    
    // Save errors if any
    if (this.errors.length > 0) {
      const errorsPath = path.join(this.config.metadataDir, 'collection_errors.json');
      await saveJsonFile(errorsPath, {
        timestamp: new Date().toISOString(),
        errors: this.errors
      });
    }
    
    return report;
  }

  private calculateDocumentTypes(): Record<string, number> {
    const types: Record<string, number> = {};
    this.allMetadata.forEach(m => {
      types[m.documentType] = (types[m.documentType] || 0) + 1;
    });
    return types;
  }

  private calculateValidationStatus(): Record<string, number> {
    const status: Record<string, number> = {};
    this.allMetadata.forEach(m => {
      status[m.validationStatus] = (status[m.validationStatus] || 0) + 1;
    });
    return status;
  }

  private extractTitleFromUrl(url: string): string {
    const filename = path.basename(url);
    const title = filename
      .replace('.pdf', '')
      .replace(/-/g, ' ')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
    return title;
  }

  private async cleanup(): Promise<void> {
    console.log('\nCleaning up...');
    await this.scraper.cleanup();
  }
}

// Export convenience function to run the pipeline
export async function runCPADataCollection(config?: CPACollectorConfig): Promise<PipelineResult> {
  const orchestrator = new CPADataOrchestrator(config);
  return orchestrator.runFullPipeline();
}