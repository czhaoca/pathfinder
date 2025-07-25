# CPA Data Collector Implementation Guide

## Overview

This guide provides detailed implementation instructions for building the CPA PERT data collection system with focus on live data fetching, validation, and LLM dataset preparation.

## Core Components

### 1. Web Scraping Service

```javascript
// cpa-web-scraper.js
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');

puppeteer.use(StealthPlugin());

class CPAWebScraper {
  constructor(config) {
    this.config = config;
    this.browser = null;
    this.resourceMetadata = [];
  }

  async initialize() {
    this.browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      ]
    });
  }

  async scrapeCPABC() {
    const page = await this.browser.newPage();
    
    // Set additional headers to bypass detection
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
    });

    try {
      // Navigate to CPA BC experience page
      await page.goto('https://www.bccpa.ca/become-a-cpa/about-the-program/experience/current-candidates/', {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      // Extract all PDF links related to PERT
      const pdfLinks = await page.evaluate(() => {
        const links = [];
        const anchorElements = document.querySelectorAll('a[href$=".pdf"]');
        
        anchorElements.forEach(anchor => {
          const href = anchor.href;
          const text = anchor.textContent.trim();
          
          // Filter for PERT-related content
          const pertKeywords = ['PERT', 'experience', 'competenc', 'EVR', 'guide'];
          const isRelevant = pertKeywords.some(keyword => 
            text.toLowerCase().includes(keyword.toLowerCase()) ||
            href.toLowerCase().includes(keyword.toLowerCase())
          );
          
          if (isRelevant) {
            links.push({
              url: href,
              text: text,
              context: anchor.closest('p')?.textContent || ''
            });
          }
        });
        
        return links;
      });

      // Process each PDF
      for (const link of pdfLinks) {
        await this.downloadAndProcessPDF(link);
      }

    } finally {
      await page.close();
    }
  }

  async downloadAndProcessPDF(linkInfo) {
    const { url, text, context } = linkInfo;
    
    // Generate filename from URL
    const filename = path.basename(url).replace(/[^a-z0-9.-]/gi, '_');
    const filepath = path.join(this.config.snapshotDir, 'CPABC', filename);
    
    // Download PDF
    const response = await fetch(url);
    const buffer = await response.arrayBuffer();
    const content = Buffer.from(buffer);
    
    // Generate SHA-256 checksum
    const hash = crypto.createHash('sha256');
    hash.update(content);
    const sha256 = hash.digest('hex');
    
    // Save PDF
    await fs.writeFile(filepath, content);
    
    // Create metadata
    const metadata = {
      id: `cpabc_${filename.replace('.pdf', '')}`,
      url: url,
      filename: filename,
      title: text,
      context: context,
      sha256: sha256,
      timestamp: new Date().toISOString(),
      fileSize: content.length,
      source: 'CPABC',
      documentType: this.classifyDocument(filename, text),
      competencyClassification: this.classifyCompetency(text, context),
      routeRelevance: 'EVR',
      validationStatus: 'verified'
    };
    
    this.resourceMetadata.push(metadata);
    
    // Extract text content for knowledge base
    await this.extractPDFContent(filepath, metadata);
  }

  classifyDocument(filename, title) {
    const lowerTitle = title.toLowerCase();
    if (lowerTitle.includes('guide')) return 'guidance';
    if (lowerTitle.includes('form')) return 'form';
    if (lowerTitle.includes('checklist')) return 'checklist';
    if (lowerTitle.includes('handbook')) return 'handbook';
    return 'official';
  }

  classifyCompetency(title, context) {
    const text = (title + ' ' + context).toLowerCase();
    if (text.includes('technical')) return 'technical';
    if (text.includes('enabling')) return 'enabling';
    if (text.includes('both') || text.includes('all')) return 'mixed';
    return 'general';
  }

  async cleanup() {
    if (this.browser) {
      await this.browser.close();
    }
  }
}
```

### 2. PDF Content Extractor

```javascript
// pdf-content-extractor.js
const pdfParse = require('pdf-parse');
const natural = require('natural');
const fs = require('fs').promises;

class PDFContentExtractor {
  constructor() {
    this.tokenizer = new natural.WordTokenizer();
  }

  async extractContent(pdfPath, metadata) {
    const dataBuffer = await fs.readFile(pdfPath);
    const pdfData = await pdfParse(dataBuffer);
    
    const content = {
      text: pdfData.text,
      pages: pdfData.numpages,
      info: pdfData.info,
      metadata: metadata
    };
    
    // Extract structured information
    const extracted = {
      competencies: this.extractCompetencies(content.text),
      guidingQuestions: this.extractGuidingQuestions(content.text),
      proficiencyLevels: this.extractProficiencyLevels(content.text),
      examples: this.extractExamples(content.text),
      requirements: this.extractRequirements(content.text)
    };
    
    return {
      ...content,
      extracted
    };
  }

  extractCompetencies(text) {
    const competencies = [];
    
    // Technical competency patterns
    const techPattern = /(?:FR|MA|AA|TX|FN|SG)\d+[:\s-]+([^\n]+)/gi;
    let match;
    
    while ((match = techPattern.exec(text)) !== null) {
      competencies.push({
        code: match[0].split(/[:\s-]/)[0],
        description: match[1].trim(),
        type: 'technical'
      });
    }
    
    // Enabling competency patterns
    const enablingKeywords = [
      'professional', 'ethical', 'communication', 
      'teamwork', 'leadership', 'self-management'
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

  extractGuidingQuestions(text) {
    const questions = [];
    
    // Look for question patterns
    const questionPattern = /(?:•|[-]|\d+\.)\s*([^?]+\?)/g;
    let match;
    
    while ((match = questionPattern.exec(text)) !== null) {
      const question = match[1].trim();
      
      // Filter for guiding questions
      if (question.length > 20 && 
          (question.includes('How') || 
           question.includes('What') || 
           question.includes('Describe'))) {
        questions.push(question);
      }
    }
    
    return questions;
  }

  extractProficiencyLevels(text) {
    const levels = {};
    
    // Level patterns
    const levelPatterns = [
      /Level\s+0[:\s-]+([^.]+)/i,
      /Level\s+1[:\s-]+([^.]+)/i,
      /Level\s+2[:\s-]+([^.]+)/i
    ];
    
    levelPatterns.forEach((pattern, index) => {
      const match = text.match(pattern);
      if (match) {
        levels[`level${index}`] = {
          number: index,
          description: match[1].trim()
        };
      }
    });
    
    return levels;
  }

  extractExamples(text) {
    const examples = [];
    
    // Example patterns
    const examplePattern = /(?:example|e\.g\.|for instance)[:\s]+([^.]+\.)/gi;
    let match;
    
    while ((match = examplePattern.exec(text)) !== null) {
      examples.push(match[1].trim());
    }
    
    return examples;
  }

  extractRequirements(text) {
    const requirements = [];
    
    // Requirement patterns
    const requirementKeywords = [
      'must', 'require', 'need to', 'should', 'minimum', 'at least'
    ];
    
    requirementKeywords.forEach(keyword => {
      const regex = new RegExp(`[^.]*${keyword}[^.]+\\.`, 'gi');
      const matches = text.match(regex);
      if (matches) {
        requirements.push(...matches.map(m => m.trim()));
      }
    });
    
    return [...new Set(requirements)]; // Remove duplicates
  }
}
```

### 3. CPA Canada Bypass Strategy

```javascript
// cpa-canada-bypass.js
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

class CPACanadaBypass {
  constructor(config) {
    this.config = config;
    this.successfulMethods = [];
    this.failedMethods = [];
  }

  async fetchResource(url) {
    const strategies = [
      () => this.tryWgetMethod(url),
      () => this.tryCurlMethod(url),
      () => this.tryPuppeteerWithProxy(url),
      () => this.tryDirectAPI(url)
    ];
    
    for (const strategy of strategies) {
      try {
        const result = await strategy();
        if (result.success) {
          this.successfulMethods.push(result.method);
          return result;
        }
      } catch (error) {
        this.failedMethods.push({
          method: strategy.name,
          error: error.message
        });
      }
    }
    
    return {
      success: false,
      url: url,
      attemptedMethods: this.failedMethods,
      recommendation: 'Manual download required'
    };
  }

  async tryWgetMethod(url) {
    const outputFile = path.join(this.config.tempDir, 'download.pdf');
    
    const wgetCommand = `
      wget --user-agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" \
           --header="Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8" \
           --header="Accept-Language: en-US,en;q=0.5" \
           --header="Cache-Control: no-cache" \
           --header="Pragma: no-cache" \
           --no-check-certificate \
           --timeout=30 \
           --tries=3 \
           -O "${outputFile}" \
           "${url}"
    `;
    
    const { stdout, stderr } = await execPromise(wgetCommand);
    
    // Check if file was downloaded
    const stats = await fs.stat(outputFile);
    if (stats.size > 0) {
      const content = await fs.readFile(outputFile);
      return {
        success: true,
        method: 'wget',
        content: content,
        size: stats.size
      };
    }
    
    throw new Error('Wget download failed');
  }

  async tryCurlMethod(url) {
    const curlCommand = `
      curl -L \
           -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" \
           -H "Accept: */*" \
           -H "Accept-Language: en-US,en;q=0.9" \
           -H "Connection: keep-alive" \
           --compressed \
           --max-time 30 \
           --retry 3 \
           "${url}"
    `;
    
    const { stdout } = await execPromise(curlCommand);
    
    if (stdout && stdout.length > 0) {
      return {
        success: true,
        method: 'curl',
        content: Buffer.from(stdout),
        size: stdout.length
      };
    }
    
    throw new Error('Curl download failed');
  }

  async tryPuppeteerWithProxy(url) {
    // Implementation with proxy rotation
    // This would use a pool of proxies to bypass IP-based blocking
  }

  async tryDirectAPI(url) {
    // Check if CPA Canada has any public API endpoints
    // that might provide the same data
  }
}
```

### 4. Knowledge Base Builder

```javascript
// knowledge-base-builder.js
class KnowledgeBaseBuilder {
  constructor() {
    this.knowledgeGraph = {
      competencies: {},
      guidingQuestions: {},
      proficiencyLevels: {},
      examples: {},
      requirements: {}
    };
  }

  async buildFromExtractedContent(extractedContents) {
    for (const content of extractedContents) {
      this.processCompetencies(content.extracted.competencies);
      this.processGuidingQuestions(content.extracted.guidingQuestions);
      this.processProficiencyLevels(content.extracted.proficiencyLevels);
      this.processExamples(content.extracted.examples);
      this.processRequirements(content.extracted.requirements);
    }
    
    return this.knowledgeGraph;
  }

  processCompetencies(competencies) {
    competencies.forEach(comp => {
      const key = comp.code || comp.keyword;
      if (!this.knowledgeGraph.competencies[key]) {
        this.knowledgeGraph.competencies[key] = {
          type: comp.type,
          descriptions: [],
          relatedQuestions: [],
          examples: []
        };
      }
      
      if (comp.description) {
        this.knowledgeGraph.competencies[key].descriptions.push(comp.description);
      }
    });
  }

  processGuidingQuestions(questions) {
    questions.forEach(question => {
      // Classify question by competency
      const competency = this.classifyQuestionCompetency(question);
      const level = this.classifyQuestionLevel(question);
      
      const key = `${competency}_${level}`;
      if (!this.knowledgeGraph.guidingQuestions[key]) {
        this.knowledgeGraph.guidingQuestions[key] = [];
      }
      
      this.knowledgeGraph.guidingQuestions[key].push(question);
    });
  }

  classifyQuestionCompetency(question) {
    // Logic to determine which competency a question relates to
    const competencyKeywords = {
      'FR': ['financial report', 'accounting', 'IFRS', 'ASPE'],
      'MA': ['management', 'budget', 'cost', 'performance'],
      'TX': ['tax', 'income tax', 'compliance'],
      'AA': ['audit', 'control', 'assurance'],
      'FN': ['finance', 'treasury', 'capital'],
      'SG': ['strategy', 'governance', 'risk']
    };
    
    for (const [code, keywords] of Object.entries(competencyKeywords)) {
      if (keywords.some(kw => question.toLowerCase().includes(kw))) {
        return code;
      }
    }
    
    return 'GENERAL';
  }

  classifyQuestionLevel(question) {
    if (question.includes('routine') || question.includes('basic')) return '1';
    if (question.includes('complex') || question.includes('judgment')) return '2';
    return '1';
  }
}
```

### 5. LLM Training Data Generator

```javascript
// training-data-generator.js
class TrainingDataGenerator {
  constructor(knowledgeBase) {
    this.knowledgeBase = knowledgeBase;
    this.trainingData = [];
  }

  generateDataset() {
    // Generate for each competency and level
    Object.entries(this.knowledgeBase.competencies).forEach(([code, data]) => {
      ['1', '2'].forEach(level => {
        this.generateCompetencyLevelData(code, level, data);
      });
    });
    
    return this.trainingData;
  }

  generateCompetencyLevelData(competencyCode, level, competencyData) {
    const guidingQuestions = this.knowledgeBase.guidingQuestions[`${competencyCode}_${level}`] || [];
    
    // Create multiple variations
    const industries = ['manufacturing', 'technology', 'retail', 'finance', 'healthcare'];
    const roles = ['analyst', 'senior analyst', 'manager', 'controller'];
    
    industries.forEach(industry => {
      roles.forEach(role => {
        const trainingExample = {
          prompt: this.buildPrompt(competencyCode, level, industry, role, guidingQuestions),
          expectedResponse: this.buildExpectedResponse(competencyCode, level, industry, role),
          metadata: {
            competency: competencyCode,
            level: level,
            industry: industry,
            role: role,
            guidingQuestions: guidingQuestions
          }
        };
        
        this.trainingData.push(trainingExample);
      });
    });
  }

  buildPrompt(competencyCode, level, industry, role, questions) {
    return `Generate a PERT response for competency ${competencyCode} at Level ${level} proficiency.
    
Role: ${role} in ${industry} industry
Character Limit: 5,000 characters

Address the following guiding questions:
${questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}

Focus on:
- Specific examples from your ${industry} experience
- Demonstrating ${level === '2' ? 'complex' : 'routine'} tasks
- Showing ${level === '2' ? 'high' : 'moderate'} autonomy
- Quantifiable results and impacts`;
  }

  buildExpectedResponse(competencyCode, level, industry, role) {
    // This would use templates and examples from the knowledge base
    // to create realistic expected responses
  }

  exportToJSONL(filename) {
    const jsonlData = this.trainingData.map(item => JSON.stringify(item)).join('\n');
    fs.writeFileSync(filename, jsonlData);
  }
}
```

### 6. Orchestration Service

```javascript
// cpa-data-orchestrator.js
class CPADataOrchestrator {
  constructor(config) {
    this.config = config;
    this.scraper = new CPAWebScraper(config);
    this.extractor = new PDFContentExtractor();
    this.canadaBypass = new CPACanadaBypass(config);
    this.knowledgeBuilder = new KnowledgeBaseBuilder();
  }

  async runFullPipeline() {
    console.log('Starting CPA PERT data collection pipeline...');
    
    try {
      // Phase 1: Web Scraping
      console.log('Phase 1: Collecting CPA BC resources...');
      await this.scraper.initialize();
      await this.scraper.scrapeCPABC();
      
      // Phase 2: CPA Canada Resources
      console.log('Phase 2: Attempting CPA Canada resource collection...');
      const canadaUrls = [
        'https://www.cpacanada.ca/-/media/site/operational/ec-education-certification/docs/02639-ec_guiding-questions-practical-experience-rubric.pdf'
      ];
      
      for (const url of canadaUrls) {
        const result = await this.canadaBypass.fetchResource(url);
        if (result.success) {
          console.log(`Successfully downloaded: ${url}`);
        } else {
          console.log(`Failed to download: ${url} - Manual intervention required`);
        }
      }
      
      // Phase 3: Content Extraction
      console.log('Phase 3: Extracting content from PDFs...');
      const extractedContents = [];
      
      for (const metadata of this.scraper.resourceMetadata) {
        const content = await this.extractor.extractContent(
          path.join(this.config.snapshotDir, metadata.source, metadata.filename),
          metadata
        );
        extractedContents.push(content);
      }
      
      // Phase 4: Knowledge Base Building
      console.log('Phase 4: Building knowledge base...');
      const knowledgeBase = await this.knowledgeBuilder.buildFromExtractedContent(extractedContents);
      
      // Phase 5: Training Data Generation
      console.log('Phase 5: Generating LLM training data...');
      const dataGenerator = new TrainingDataGenerator(knowledgeBase);
      const trainingData = dataGenerator.generateDataset();
      dataGenerator.exportToJSONL('cpa_pert_training_data.jsonl');
      
      // Phase 6: Save Results
      console.log('Phase 6: Saving results...');
      await this.saveResults(knowledgeBase, trainingData);
      
      console.log('Pipeline completed successfully!');
      
    } catch (error) {
      console.error('Pipeline error:', error);
      throw error;
    } finally {
      await this.scraper.cleanup();
    }
  }

  async saveResults(knowledgeBase, trainingData) {
    // Save knowledge base
    await fs.writeFile(
      path.join(this.config.knowledgeDir, 'cpa_knowledge_base.json'),
      JSON.stringify(knowledgeBase, null, 2)
    );
    
    // Save metadata
    await fs.writeFile(
      path.join(this.config.metadataDir, 'collection_metadata.json'),
      JSON.stringify({
        timestamp: new Date().toISOString(),
        resourcesCollected: this.scraper.resourceMetadata.length,
        knowledgeBaseSize: Object.keys(knowledgeBase.competencies).length,
        trainingDataSize: trainingData.length
      }, null, 2)
    );
  }
}

// Run the pipeline
const config = {
  snapshotDir: './snapshots',
  knowledgeDir: './knowledge',
  metadataDir: './metadata',
  tempDir: './temp'
};

const orchestrator = new CPADataOrchestrator(config);
orchestrator.runFullPipeline().catch(console.error);
```

## Usage Instructions

1. **Setup Environment**
```bash
# Install dependencies
npm install puppeteer puppeteer-extra puppeteer-extra-plugin-stealth
npm install pdf-parse natural
npm install node-schedule dotenv

# Create directory structure
mkdir -p snapshots/{CPABC,CPACanada}/{official-docs,forms,guidance}
mkdir -p knowledge/{CPABC,CPACanada}
mkdir -p metadata
mkdir -p temp
```

2. **Configure Environment Variables**
```env
# .env file
CPABC_BASE_URL=https://www.bccpa.ca/
CPACANADA_BASE_URL=https://www.cpacanada.ca/
SNAPSHOT_DIR=./snapshots
KNOWLEDGE_DIR=./knowledge
METADATA_DIR=./metadata
TEMP_DIR=./temp
```

3. **Run Data Collection**
```bash
# Run full pipeline
node cpa-data-orchestrator.js

# Run specific components
node cpa-web-scraper.js --source=cpabc
node cpa-canada-bypass.js --url="specific-pdf-url"
node training-data-generator.js --input=knowledge_base.json
```

4. **Schedule Automated Runs**
```javascript
// scheduler.js
const schedule = require('node-schedule');

// Run every Sunday at 2 AM
schedule.scheduleJob('0 2 * * 0', function() {
  const orchestrator = new CPADataOrchestrator(config);
  orchestrator.runFullPipeline()
    .then(() => console.log('Weekly update completed'))
    .catch(error => console.error('Weekly update failed:', error));
});
```

## Monitoring and Maintenance

1. **Health Checks**
- Monitor successful vs failed downloads
- Track changes in document SHA-256 checksums
- Alert on significant content changes

2. **Quality Assurance**
- Validate extracted competencies against known framework
- Check guiding question completeness
- Verify character count compliance in generated responses

3. **Performance Optimization**
- Implement caching for unchanged resources
- Use parallel processing for PDF extraction
- Optimize knowledge graph queries

4. **Error Recovery**
- Implement retry logic with exponential backoff
- Save partial progress for resumption
- Manual fallback procedures documentation