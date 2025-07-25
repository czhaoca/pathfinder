# CPA Data Collector Service

A comprehensive data collection pipeline for CPA PERT (Practical Experience Reporting Tool) resources, designed to gather, extract, and process official CPA documentation for LLM training and knowledge base construction.

## Overview

The CPA Data Collector automates the process of:
- Scraping CPA BC and CPA Canada websites for PERT-related PDFs
- Extracting structured content from PDF documents
- Building a comprehensive knowledge graph of competencies, requirements, and examples
- Generating high-quality training data for LLM fine-tuning

## Architecture

```
cpa-data-collector/
├── scrapers/              # Web scraping modules
│   ├── cpa-web-scraper.ts     # CPA BC scraper with stealth mode
│   └── cpa-canada-bypass.ts   # Multi-strategy CPA Canada scraper
├── extractors/            # Content extraction
│   └── pdf-content-extractor.ts # PDF parsing and NLP extraction
├── knowledge/             # Knowledge base construction
│   └── knowledge-base-builder.ts # Competency graph builder
├── training/              # LLM training data generation
│   └── training-data-generator.ts # Dataset creator
├── config/                # Configuration
│   └── cpa-collector-config.ts # Centralized config
└── cpa-data-orchestrator.ts # Main pipeline coordinator
```

## Features

### 1. Web Scraping
- **CPA BC Scraper**: Uses Puppeteer with stealth plugin to avoid detection
- **CPA Canada Bypass**: Multiple strategies (wget, curl, puppeteer) to handle Cloudflare protection
- **Automatic retry logic** with exponential backoff
- **SHA-256 checksum validation** for integrity

### 2. Content Extraction
- **Competency extraction**: Technical (FR, MA, TX, AA, FN, SG) and Enabling competencies
- **Guiding questions**: Automatically identifies and categorizes assessment questions
- **Proficiency levels**: Extracts Level 0, 1, and 2 descriptions
- **Examples and requirements**: Mines practical examples and compliance requirements

### 3. Knowledge Base Building
- **Hierarchical competency graph**: Links competencies, questions, and examples
- **Automatic classification**: Categorizes content by competency area and proficiency level
- **Cross-referencing**: Connects related concepts across documents
- **Metadata tracking**: Source attribution and validation status

### 4. Training Data Generation
- **Industry variations**: 10+ industries (manufacturing, technology, finance, etc.)
- **Role diversity**: Multiple seniority levels (analyst to controller)
- **Quality scoring**: Automated assessment of generated responses
- **Character limit compliance**: Ensures 5,000 character limit adherence

## Installation

```bash
# Install dependencies
cd backend
npm install

# Required dependencies:
# - puppeteer (headless browser)
# - puppeteer-extra-plugin-stealth (bypass detection)
# - pdf-parse (PDF text extraction)
# - natural (NLP processing)
# - node-schedule (scheduled runs)
```

## Usage

### Manual Collection

```bash
# Run full pipeline
npm run cpa:collect

# Run with options
npm run cpa:collect -- --no-headless  # Show browser window
npm run cpa:collect -- --no-validate  # Skip checksum validation
npm run cpa:collect -- --help         # Show help
```

### Scheduled Collection

```bash
# Start scheduled collector (weekly on Sundays at 2 AM)
npm run cpa:collect:watch
```

### Programmatic Usage

```typescript
import { runCPADataCollection } from './cpa-data-orchestrator';

// Run with default config
const result = await runCPADataCollection();

// Run with custom config
const customConfig = {
  snapshotDir: './custom/snapshots',
  headless: false,
  validateChecksums: true
};
const result = await runCPADataCollection(customConfig);

// Check results
if (result.success) {
  console.log('Knowledge base:', result.knowledgeBasePath);
  console.log('Training data:', result.trainingDataPath);
} else {
  console.error('Errors:', result.errors);
}
```

## Configuration

Environment variables (`.env`):
```env
# Directory paths
CPA_SNAPSHOT_DIR=./data/snapshots
CPA_KNOWLEDGE_DIR=./data/knowledge
CPA_METADATA_DIR=./data/metadata
CPA_TEMP_DIR=./data/temp

# Collection settings
CPA_HEADLESS=true
CPA_VALIDATE_CHECKSUMS=true
CPA_REQUIRE_ALL_RESOURCES=false
```

## Output Structure

### 1. Snapshots Directory
```
snapshots/
├── CPABC/
│   ├── pert_guide_2024.pdf
│   ├── evr_requirements.pdf
│   └── competency_framework.pdf
└── CPACanada/
    ├── guiding_questions_rubric.pdf
    └── practical_experience_requirements.pdf
```

### 2. Knowledge Base (JSON)
```json
{
  "competencies": {
    "FR1": {
      "type": "technical",
      "descriptions": ["Financial reporting needs..."],
      "relatedQuestions": ["How do you..."],
      "examples": ["Prepared consolidated..."]
    }
  },
  "guidingQuestions": {
    "FR1_2": ["Complex financial reporting questions..."]
  },
  "metadata": {
    "totalCompetencies": 30,
    "totalQuestions": 150,
    "sources": ["CPABC", "CPACanada"]
  }
}
```

### 3. Training Data (JSONL)
```jsonl
{"prompt": "Generate PERT response...", "expectedResponse": "Throughout my role...", "metadata": {...}}
```

## Pipeline Phases

1. **Web Scraping**: Collects PDFs from CPA BC and attempts CPA Canada
2. **Content Extraction**: Parses PDFs and extracts structured information
3. **Knowledge Building**: Constructs competency graph from extracted data
4. **Training Generation**: Creates LLM fine-tuning dataset
5. **Results & Reporting**: Saves all outputs and generates collection report

## Error Handling

- **Partial failures**: Pipeline continues even if some resources fail
- **Retry logic**: Automatic retries with different strategies
- **Manual fallback**: Clear instructions for manual downloads when needed
- **Error logging**: Detailed error tracking in `metadata/collection_errors.json`

## Monitoring

Collection reports include:
- Resources collected vs. failed
- Extraction success rates
- Knowledge base statistics
- File sizes and checksums
- Validation status

## Security Considerations

- **Stealth mode**: Avoids detection with browser fingerprinting bypass
- **Rate limiting**: Respectful crawling with delays
- **User agent rotation**: Mimics real browser behavior
- **No credential storage**: Only accesses public resources

## Troubleshooting

### Common Issues

1. **Cloudflare blocking**: Try manual download or wait before retrying
2. **PDF extraction errors**: Ensure pdf-parse is properly installed
3. **Memory issues**: Increase Node.js heap size for large datasets
4. **Network timeouts**: Adjust timeout settings in config

### Debug Mode

```bash
# Run with detailed logging
DEBUG=cpa:* npm run cpa:collect
```

## Future Enhancements

- [ ] API integration when available
- [ ] Incremental updates (only new/changed content)
- [ ] Multi-province support
- [ ] Real-time change detection
- [ ] LLM response validation pipeline
- [ ] Integration with Career Navigator chat interface

## Contributing

When adding new features:
1. Update scrapers for new sources
2. Extend extractors for new content types
3. Enhance knowledge graph structure
4. Improve training data quality
5. Add comprehensive tests

## License

Part of the Career Navigator project. See main project LICENSE.