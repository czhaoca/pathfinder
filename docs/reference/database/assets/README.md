# Database Modeling Assets

This directory contains the Mermaid diagram source files (`.mmd`) for the database entity relationship diagrams.

## Diagram Files

- `system-erd.mmd` - System and authentication schema relationships
- `experience-erd.mmd` - User experience management schema
- `chat-erd.mmd` - Chat and conversation schema
- `cpa-pert-erd.mmd` - CPA PERT module schema

## Generating PNG Images

To convert these Mermaid diagrams to PNG images, you can use one of the following methods:

### Method 1: Using mermaid-cli (Recommended)

```bash
# Install mermaid-cli globally
npm install -g @mermaid-js/mermaid-cli

# Convert individual diagrams
mmdc -i system-erd.mmd -o system-erd.png
mmdc -i experience-erd.mmd -o experience-erd.png
mmdc -i chat-erd.mmd -o chat-erd.png
mmdc -i cpa-pert-erd.mmd -o cpa-pert-erd.png
```

### Method 2: Using Online Mermaid Editor

1. Visit [Mermaid Live Editor](https://mermaid.live)
2. Copy the content of each `.mmd` file
3. Paste into the editor
4. Export as PNG

### Method 3: Using VS Code Extension

1. Install "Mermaid Preview" extension in VS Code
2. Open `.mmd` file
3. Right-click and select "Export as PNG"

## Diagram Descriptions

### System ERD (`system-erd.mmd`)
Shows the relationships between:
- Users, sessions, and API keys
- Audit logging and legal holds
- Authentication and authorization tables

### Experience ERD (`experience-erd.mmd`)
Illustrates:
- User experience storage structure
- Skill mappings and achievement metrics
- Profile summaries and career objectives
- Reference data relationships

### Chat ERD (`chat-erd.mmd`)
Depicts:
- Conversation management
- Message storage
- Conversation summaries

### CPA PERT ERD (`cpa-pert-erd.mmd`)
Details:
- CPA competency framework
- Experience to competency mappings
- PERT response generation
- Proficiency assessments
- Compliance tracking