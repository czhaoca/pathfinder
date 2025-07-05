# CLAUDE.md - CPA PERT Writer Add-on

This file provides specific guidance to Claude Code when working with the CPA PERT Writer add-on module.

## Add-on Overview

The CPA PERT Writer is a specialized add-on for the Career Navigator system, focused on assisting CPA candidates with Practical Experience Reporting Tool (PERT) submissions. This module has **strict requirements** for live data collection and EVR route focus.

## Core Principles - MANDATORY

### 1. Live Data Only Policy
- **NEVER** use fabricated or LLM-generated content
- **ALWAYS** fetch resources live from the internet
- **STRICTLY PROHIBITED**: Using internal knowledge or pre-existing memory
- All captured resources must have verifiable SHA-256 checksums

### 2. Jurisdiction Priority
- **PRIMARY**: CPA BC (British Columbia) requirements take precedence
- **SUPPORTING**: CPA Canada national standards for framework guidance
- **REFERENCE ONLY**: Other provinces may be referenced but not used as rubric
- Each province has different treatments - do not assume consistency

### 3. Route Focus
- **EVR ROUTE ONLY**: Experience Verification Route for industry candidates
- **EXCLUDE**: Public practice/auditing firm route materials
- **FILTER**: Remove audit training, assurance training, public accounting firm content
- Focus on industry experience verification requirements

### 4. Competency Classification
All resources must be classified as:
- **Technical**: Financial reporting, taxation, audit & assurance, finance, etc.
- **Enabling**: Communication, teamwork, leadership, problem-solving, etc.
- **General**: PERT process, system usage, general guidance
- **Mixed**: Documents containing multiple competency types

## Directory Structure Understanding

```
resources/
├── links/resource-links.json          # Central registry - DO NOT modify structure
├── knowledge/                         # Extracted knowledge (JSON only)
│   ├── CPABC/                        # BC-specific content
│   └── CPACanada/                    # National framework content
├── snapshots/                        # Live-captured PDFs only
│   ├── CPABC/                        # BC documents (official-docs, forms, guidance)
│   └── CPACanada/                    # National documents (framework, handbook, standards)
└── schema/metadata-schema.json       # Validation schema - DO NOT modify without approval
```

## Required Metadata Fields

When processing any resource, ALWAYS include:
- `url`: Original source URL
- `timestamp`: ISO 8601 capture timestamp
- `sha256`: Content hash for change detection
- `version_info`: Version tracking with `is_current` flag
- `competency_classification`: technical/enabling/general/mixed
- `route_relevance`: EVR/PublicPractice/Both/General
- `validation_status`: verified/needs_review/outdated/broken_link
- `source`: CPABC/CPACanada
- `document_type`: official/guidance/form/handbook/competency-framework/standards

## Approved Sources Only

### Primary Sources (CPABC)
- Website: https://www.bccpa.ca/
- Search: https://www.bccpa.ca/search/#q=
- Focus: BC-specific PERT requirements and EVR route

### Supporting Sources (CPA Canada)
- Website: https://www.cpacanada.ca/
- Search: https://www.cpacanada.ca/search#q= (Note: May block automated requests - use alternative methods)
- Focus: National competency framework and standards

#### CPA Canada Access Issues:
- **KNOWN ISSUE**: CPA Canada website may block automated WebFetch requests (403 errors)
- **SUCCESSFUL WORKAROUND**: Use wget with browser headers for PDF downloads:
  ```bash
  wget --user-agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" \
       --header="Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8" \
       --header="Accept-Language: en-US,en;q=0.5" \
       --no-check-certificate \
       -O "output-filename.pdf" \
       "https://www.cpacanada.ca/path/to/document.pdf"
  ```
- **ALTERNATIVE METHODS**: When wget fails:
  1. Document the blocked URL and attempted access in metadata
  2. Use manual verification or alternative data collection methods
  3. Note in validation_status as "access_restricted"
  4. Search for alternative public sources or contact CPA Canada directly
- **SUCCESSFUL ACCESS**: Known working search URL format: https://www.cpacanada.ca/search#q=PERT

### Prohibited Sources
- Other provincial CPA bodies (unless explicitly requested for reference)
- Third-party websites
- Educational institutions
- Blogs or unofficial sources

## Search Keywords

### Approved Keywords
- "PERT"
- "Practical Experience Requirements"
- "Experience Verification Route"
- "EVR"
- "Competency Framework"
- "Technical Competencies"
- "Enabling Competencies"
- "CPA Candidate"
- "Professional Development"

### Excluded Keywords
- "Public Practice"
- "Audit Training"
- "Assurance Training"
- "Public Accounting Firm"
- "CPA Firm"
- "Articling"

## Workflow Requirements

### When Adding New Resources:
1. Validate source is approved (CPABC or CPA Canada)
2. Fetch content live from the internet
3. Generate SHA-256 checksum
4. Classify competency type and route relevance
5. Filter out non-EVR content
6. Update both metadata and knowledge files
7. Ensure PDF snapshot exists in correct directory

### When Updating Existing Resources:
1. Compare SHA-256 to detect changes
2. If changed, create new version and mark previous as `is_current: false`
3. Update metadata with change history
4. Preserve all previous versions for audit trail

## Common Commands

```bash
# From addon directory
npm install                           # Install addon dependencies
npm run validate-metadata             # Validate metadata against schema
npm run check-snapshots              # Verify all snapshots exist
npm run update-checksums             # Regenerate SHA-256 checksums
```

## File Naming Conventions

### Snapshots
- Format: `{source}-{document-type}-{version}.pdf`
- Example: `cpabc-pert-handbook-v1.pdf`
- No spaces, lowercase, use hyphens

### Metadata IDs
- Format: `{source}_{document_type}_{version}`
- Example: `cpabc_pert_handbook_v1`
- Use underscores for JSON keys

## Quality Assurance

### Before Committing Changes:
- [ ] All resources have valid SHA-256 checksums
- [ ] PDF snapshots exist for all metadata entries
- [ ] Competency classification is accurate
- [ ] EVR route relevance is verified
- [ ] Source URLs are from approved organizations
- [ ] Metadata validates against schema

### Regular Maintenance:
- Check for broken links monthly
- Verify content currency quarterly
- Update version tracking when source content changes
- Remove outdated resources that are no longer current

## Error Handling

### If Resource Fetch Fails:
1. Mark validation_status as "broken_link" or "access_restricted" (for 403 errors)
2. Preserve existing metadata
3. Log failure with timestamp and error details
4. Do NOT create empty or placeholder content
5. For CPA Canada 403 errors: Document alternative access methods needed

### If Content Changes:
1. Create new version entry
2. Update `is_current` flags appropriately
3. Preserve change history
4. Generate new SHA-256 checksum

### CPA Canada Specific Error Handling:
- **403 Forbidden Errors**: Common on CPA Canada - document URL and mark as "access_restricted"
- **Alternative Methods**: Note need for manual verification or direct contact
- **Known Working URLs**: https://www.cpacanada.ca/search#q=PERT (verified working format)

## Development Notes

- This addon operates independently but integrates with main Career Navigator system
- All knowledge base content feeds into the MCP server for contextual AI conversations
- Metadata schema changes require approval and version increment
- Focus on BC requirements first, then national framework support

## Important Reminders

1. **NEVER** fabricate CPA content - all content must be live-fetched
2. **ALWAYS** prioritize CPA BC over other provinces
3. **FILTER** out public practice content for EVR route focus
4. **VALIDATE** all metadata against the schema before committing
5. **PRESERVE** version history for audit trail
6. **VERIFY** SHA-256 checksums for data integrity