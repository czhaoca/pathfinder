# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a comprehensive AI-powered career navigation and experience management system that has evolved beyond its original CPA PERT reporting focus. The system now provides:

1. **Career Navigator**: Interactive LLM-based chatbot for career planning and guidance
2. **Experience Management**: 3-tier data structure for storing and organizing user experiences
3. **MCP Integration**: Model Context Protocol server for contextual AI conversations

## System Architecture

The system follows a multi-layered architecture:

- **Frontend**: Web-based chat interface for user interactions
- **Application Layer**: Career Navigator and Experience Story Manager
- **LLM Integration**: Large Language Model with MCP server for context management
- **Data Layer**: 3-tier experience database (Detailed → Profile → Quick Summary)

See `docs/architecture.md` for detailed system diagrams and data flow.

## Database Structure

### 3-Tier Experience Model:
- **Level 1**: Detailed experiences with skills extraction and role mappings
- **Level 2**: Aggregated profile summaries with career progression analysis
- **Level 3**: Quick summaries for rapid context retrieval and resume headers

### Supporting Tables:
- Skills mapping with market demand and role correlations
- Career paths with progression tracks and requirements
- Role profiles with responsibilities and skill requirements

## Development Environment

Node.js-based project with the following key commands:

```bash
npm install              # Install dependencies
npm run db:setup         # Setup database
npm run db:migrate       # Run database migrations
npm run db:seed          # Seed test data
npm run dev              # Start development server
npm run test             # Run test suite
npm run lint             # Code linting
npm run type-check       # TypeScript checking
npm run mermaid          # Run mermaid CLI (mmdc)
```

### Mermaid Diagram Workflow

When creating documentation with Mermaid diagrams:

1. **Create Mermaid source files**: Save `.mmd` files in the `assets/` folder relative to your markdown file
2. **Convert to PNG**: Use the provided scripts to generate PNG images
3. **Reference in Markdown**: Link to the PNG file, not the Mermaid code block

Example structure:
```
docs/development/
├── architecture.md
└── assets/
    ├── system-diagram.mmd    # Mermaid source
    └── system-diagram.png    # Generated PNG
```

Converting Mermaid to PNG:
```bash
# Using the bash script
./scripts/mermaid-to-png.sh docs/development/assets/system-diagram.mmd

# Using the Node.js script
node scripts/mermaid-converter.js docs/development/assets/system-diagram.mmd

# Using npm script
npm run mermaid -- -i docs/development/assets/system-diagram.mmd -o docs/development/assets/system-diagram.png
```

In your markdown file:
```markdown
![System Architecture](./assets/system-diagram.png)
```

**Important**: This project uses system Chromium on ARM architectures. The setup script automatically detects and configures the appropriate Chrome/Chromium for your system.

## Key Technologies

- **Backend**: Node.js/TypeScript with REST API
- **Database**: PostgreSQL with JSONB for flexible schema
- **LLM Integration**: MCP (Model Context Protocol) server
- **Frontend**: Modern web framework (React/Vue/Svelte TBD)
- **Testing**: Jest for unit tests, Playwright for E2E

## Documentation Structure

- `docs/user-guides/` - Getting started and user documentation
- `docs/platform/` - Core features and roadmap documentation
- `docs/deployment/` - Security, MCP server, and deployment guides
- `docs/development/` - Technical architecture, data models, and developer guides
- `docs/addons/` - Industry-specific add-on modules and development

## Target Users

- Professionals seeking career guidance and planning
- Job seekers looking to optimize their experience presentation
- Career changers exploring new paths
- Anyone wanting to organize and leverage their professional experiences

## Core Features

### 🧭 Career Exploration & Mentorship
- **Career Discovery Engine**: AI-powered exploration based on interests, skills, and values
- **Intelligent Mentorship**: Personalized guidance through AI conversation
- **Skills Gap Analysis**: Development area identification for target career paths
- **Market Intelligence**: Real-time industry trends and opportunity analysis

### 📚 Story Development & Resume Building
- **Experience Mining**: Extract meaningful achievements from work history
- **Impact Quantification**: Identify and articulate measurable contributions  
- **Dynamic Resume Generation**: Tailored resumes for specific opportunities
- **ATS Optimization**: Keyword optimization for applicant tracking systems

### 🤝 Professional Networking (Future)
- **Contact Relationship Management**: Intelligent professional network tracking
- **Coffee Chat Facilitation**: AI-powered meeting planning and follow-up
- **Conversation Analytics**: Note-taking and relationship insight generation
- **Reconnection Intelligence**: Smart reminders and relationship maintenance

## Specialized Add-on Modules

### Industry-Specific Tools
Career Navigator supports discrete add-on modules for specific professional requirements. These modules are located in `addons/` and can be installed independently.

Available modules:
- `docs/addons/cpa-pert-writer/` - Accounting profession experience reporting
- Future modules for other regulated professions and industries

### Add-on Installation
```bash
# Install specific add-on modules
npm install ./docs/addons/[module-name]

# List available add-ons
ls docs/addons/
```