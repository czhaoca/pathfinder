# CPA Canada PERT Report Writer Add-on

## Overview

The **CPA Canada PERT Report Writer** is a specialized add-on module for the Pathfinder system, designed specifically to assist CPA candidates in writing comprehensive and compliant Practical Experience Reporting Tool (PERT) reports.

## Module Name: `accounting-experience-reporter`

This add-on leverages the core experience management system to provide specialized functionality for:

- **PERT-compliant experience documentation**
- **CPA competency mapping and analysis**
- **Technical skill demonstration guidance**
- **Regulatory compliance checking**
- **Professional experience narrative generation**

## Key Features

### 🎯 PERT-Specific Functionality (EVR Focus)
- **Competency Mapping**: Automatic mapping of experiences to CPA competency framework
- **Technical Skills Analysis**: Identification and demonstration of technical competencies
- **Enabling Skills Integration**: Behavioral and professional skills assessment
- **Experience Level Validation**: Ensuring experiences meet EVR depth and breadth requirements
- **BC-Specific Compliance**: Tailored to CPA BC requirements with national framework support

### 📋 Report Generation
- **Structured Templates**: PERT-compliant report templates for EVR route
- **Experience Narratives**: AI-assisted writing of detailed industry experience descriptions
- **Competency Demonstrations**: Guided examples specific to EVR route competencies
- **Quality Assurance**: Built-in checks for completeness and EVR compliance

### 🔍 Compliance Verification
- **BC Requirement Mapping**: Verification against current CPA BC requirements
- **Experience Duration**: Tracking and validation of required EVR experience hours
- **Supervisor Validation**: Guidelines for industry supervisor sign-off requirements
- **Documentation Standards**: Ensuring reports meet professional documentation standards

### 📚 Live Knowledge Base
- **Real-time Resource Gathering**: Live capture of official CPA documents
- **Version Control**: SHA-256 tracking of document changes
- **Competency Classification**: Automatic categorization of technical vs enabling competencies
- **EVR Route Filtering**: Focused content relevant to industry experience verification

## Integration with Core System

The PERT Writer integrates seamlessly with the main Pathfinder system:

[![Integration with Core System](../../assets/mermaid/cpa-pert-writer-integration.png)](../../assets/diagrams/cpa-pert-writer-integration.mmd)

## Directory Structure

```
addons/cpa-pert-writer/
├── README.md                           # This file
├── COPYRIGHT-DISCLAIMER.md             # Copyright and legal disclaimers
├── package.json                        # Module dependencies and metadata
├── snapshot-process.md                 # Resource gathering and management process
├── src/
│   ├── competency-mapper.js           # CPA competency analysis engine
│   ├── pert-generator.js              # PERT report generation logic
│   ├── compliance-checker.js          # Regulatory compliance validation
│   └── templates/
│       ├── experience-templates.json   # PERT-specific experience templates
│       └── competency-examples.json    # Example competency demonstrations
├── resources/
│   ├── links/
│   │   └── resource-links.json        # Central registry of CPA resources
│   ├── knowledge/                     # Extracted knowledge from live sources
│   │   ├── CPABC/                     # BC-specific knowledge and metadata
│   │   │   ├── cpabc-knowledge.json    # BC knowledge content
│   │   │   └── cpabc-metadata.json     # BC document metadata
│   │   └── CPACanada/                 # National standards and framework
│   │       ├── canada-knowledge.json   # National knowledge content
│   │       └── canada-metadata.json    # National document metadata
│   ├── snapshots/                     # Live-captured PDF documents
│   │   ├── CPABC/                     # BC-specific documents
│   │   │   ├── official-docs/          # Official CPA BC documents
│   │   │   ├── forms/                  # BC-specific forms
│   │   │   └── guidance/               # BC guidance documents
│   │   └── CPACanada/                 # National documents
│   │       ├── competency-framework/   # National competency framework
│   │       ├── handbook/               # PERT handbook and guides
│   │       └── standards/              # National standards
│   └── schema/
│       └── metadata-schema.json        # JSON schema for metadata validation
├── docs/
│   ├── user-guide.md                  # How to use the PERT writer
│   ├── competency-mapping.md          # Understanding CPA competencies
│   ├── writing-guidelines.md          # Best practices for PERT writing
│   └── examples/                      # Sample PERT reports and experiences
│       └── evr-industry-experience.md  # EVR route industry experience examples
└── tests/
    ├── competency-mapping.test.js     # Tests for competency analysis
    ├── compliance-validation.test.js   # Tests for compliance checking
    └── fixtures/                      # Test data and sample experiences
        ├── sample-experiences.json     # Test experience data
        └── expected-mappings.json      # Expected competency mappings
```

## Installation and Usage

### Prerequisites
- Pathfinder core system installed
- Node.js 18+ for development
- Access to user's experience database

### Installation
```bash
# Install from the main project root
npm install ./addons/cpa-pert-writer

# Or install as a separate module
cd addons/cpa-pert-writer
npm install
```

### Basic Usage
```javascript
const CPAPERTWriter = require('cpa-pert-writer');

// Initialize with user's experience data
const pertWriter = new CPAPERTWriter({
  userId: 'user-123',
  experienceDatabase: userExperienceDB
});

// Generate PERT report for specific experience
const pertReport = await pertWriter.generatePERTReport({
  experienceId: 'exp-456',
  targetCompetencies: ['1.1.1', '1.2.1', '2.3.2'], // CPA competency codes
  reportType: 'detailed' // or 'summary'
});
```

## API Integration

### REST Endpoints
```
POST /api/v1/addons/cpa-pert/analyze-experience
GET  /api/v1/addons/cpa-pert/competency-mapping/{experienceId}
POST /api/v1/addons/cpa-pert/generate-report
GET  /api/v1/addons/cpa-pert/compliance-check/{userId}
POST /api/v1/addons/cpa-pert/validate-requirements
```

### MCP Tools Integration
```javascript
// Additional MCP tools for CPA PERT functionality
const pertMCPTools = {
  analyze_cpa_competencies: async (experienceId) => {
    // Analyze experience against CPA competency framework
  },
  
  generate_pert_narrative: async (experienceId, competencyCode) => {
    // Generate PERT-compliant experience narrative
  },
  
  validate_pert_requirements: async (userId) => {
    // Check if user meets PERT submission requirements
  },
  
  suggest_experience_improvements: async (experienceId) => {
    // Suggest improvements to meet PERT standards
  }
};
```

## Target Users

This add-on is specifically designed for:

- **CPA Candidates (EVR Route)**: Industry professionals preparing PERT reports for practical experience requirements
- **CPA Students (BC Focus)**: Learning to document professional experience effectively under BC requirements
- **Career Coaches**: Assisting clients with CPA designation requirements specific to industry experience
- **HR Professionals**: Understanding CPA competency requirements for hiring in BC
- **Industry Supervisors**: Understanding EVR supervision and sign-off requirements

## Compliance and Legal

### Important Disclaimers

⚖️ **This tool is designed to assist CPA candidates in preparing their PERT reports. It does not guarantee acceptance by CPA regulatory bodies.**

📋 **Users are responsible for ensuring their reports meet current CPA requirements and should verify all information with official CPA sources.**

🔍 **All generated content should be reviewed and validated by qualified supervisors before submission.**

### Copyright Notice

All CPA Canada content, frameworks, and requirements referenced in this add-on remain the intellectual property of CPA Canada and respective provincial CPA bodies. This tool is created for educational and assistance purposes only.

## Support and Maintenance

### Regular Updates
- **Quarterly**: Review of CPA requirement changes
- **Annually**: Major competency framework updates
- **As-needed**: Bug fixes and performance improvements

### Community Support
- GitHub Issues for bug reports and feature requests
- Documentation wiki for user-contributed examples
- CPA candidate community forum integration

## Development Roadmap

### Phase 1: Core Functionality (Current)
- [x] Basic competency mapping
- [x] PERT report templates
- [x] Compliance checking framework

### Phase 2: Enhanced Features
- [ ] Provincial-specific requirements
- [ ] Supervisor collaboration tools
- [ ] Mobile app integration

### Phase 3: Advanced Analytics
- [ ] Success rate analytics
- [ ] Competency gap analysis
- [ ] Career progression tracking

---

*For detailed installation instructions, usage examples, and API documentation, see the `docs/` directory.*