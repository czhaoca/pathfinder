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

## Comprehensive CPA PERT Knowledge Base

### Core PERT Requirements (Based on Live Data Analysis)

#### **Experience Duration & Progression**
- **Minimum**: 30 months of paid, relevant, and progressive work experience
- **12-Month Rule**: Must achieve Level 1 proficiency in two technical sub-competencies within 12 months (8 months in Quebec)
- **Progressive Nature**: Experience must show increasing complexity and responsibility over time

#### **Competency Framework Structure**
- **Technical Competencies**: 6 major areas with 24 sub-competencies
- **Enabling Competencies**: Professional skills across multiple domains
- **Proficiency Levels**: 0 (Administrative), 1 (Analysis), 2 (Knowledge Utilization)
- **Focus Areas**: 8-10 sub-competencies that are key to candidate's role

#### **EVR Route Specific Requirements**
- **Pre-Assessment Checklist**: Must be completed before reporting (Updated April 17, 2023)
- **Self-Assessment Tool**: Available at https://pert.cpa-services.org/Student/TrialAssessment
- **Mentorship**: Ongoing mentorship required throughout experience period
- **Supervision**: Must work under qualified supervision with appropriate autonomy levels

### Technical Competencies Deep Dive

#### **Financial Reporting (FR)**
- **FR1**: Financial reporting needs and systems
- **FR2**: Accounting policies and transactions
- **FR3**: Financial report preparation
- **FR4**: Financial statement analysis
- **EVR Focus**: Must demonstrate experience with external financial reporting frameworks (ASPE, IFRS, PSAS)
- **Level 2 Requirement**: 3+ complex examples from multiple framework areas

#### **Management Accounting (MA)**
- **MA1**: Management reporting needs and systems
- **MA2**: Planning, budgeting and forecasting
- **MA3**: Cost, revenue, profitability management
- **MA4**: Organizational/Individual performance measurement
- **Industry Focus**: Internal reporting and decision-making support

#### **Audit and Assurance (AA)**
- **AA1**: Internal control assessment
- **AA2**: Internal audit or external assurance requirements
- **AA3**: Internal audit projects or external assurance engagements
- **EVR Consideration**: Limited to internal audit functions in industry settings

#### **Taxation (TX)**
- **TX1**: Income tax legislation and research
- **TX2**: Income tax compliance (corporate or personal)
- **TX3**: Tax planning (corporate or personal)
- **Application**: Both internal corporate tax and external client scenarios

#### **Finance (FN)**
- **FN1**: Financial analysis and planning
- **FN2**: Treasury management
- **FN3**: Capital budgeting/valuation/corporate finance
- **Strategic Focus**: Financial viability, risk assessment, cash flow analysis

#### **Strategy and Governance (SG)**
- **SG1**: Governance, mission, vision, values and mandate
- **SG2**: Strategy development/implementation
- **SG3**: Enterprise risk management
- **Leadership Component**: Higher-level strategic thinking and analysis

### Proficiency Level Requirements

#### **Level 1 (Analysis)**
- **Characteristics**: Routine tasks, low-moderate complexity, supervised work
- **Examples Required**: 1-2 specific examples with frequency notation
- **Autonomy**: Lower level, work reviewed by supervisor
- **Complexity**: Straightforward tasks with routine approaches

#### **Level 2 (Knowledge Utilization)**
- **Characteristics**: Key job requirement, moderate-high complexity, significant judgment
- **Examples Required**: 3+ complex examples across duration
- **Autonomy**: Moderate to high level of independence
- **Complexity**: Multiple variables, ambiguities, non-routine approaches
- **Transferability**: Skills applicable outside current role/organization

### Response Writing Guidelines

#### **Structure Requirements**
- **Character Limit**: 5,000 characters maximum per response
- **Boundaries**: Must stay within PERT response box borders
- **Clarity**: Clear, concise writing (not story writing)
- **Focus**: Most complex examples, not routine tasks

#### **Content Requirements**
- **Guiding Questions**: Must address all questions for targeted proficiency level
- **Examples**: Specific, quantifiable examples with complete walk-through descriptions
- **Frequency**: Specify how often work is performed
- **Complexity Factors**: Research required, multiple analyses, judgment calls

### PERT System Access & Tools

#### **Primary Access Points**
- **Student/Candidate Portal**: https://my.cpawsb.ca/
- **Self-Assessment Tool**: https://pert.cpa-services.org/Student/TrialAssessment
- **Support Contact**: admissionadvising@cpawsb.ca or 1-866-420-2350 ext. 6001

#### **Key Resources Available**
- **PERT User Guide**: For Future CPAs (Updated April 1, 2023)
- **Video Training**: Technical and Enabling Competency Response crafting
- **Checklists**: Pre-assessment, Technical Competency Guiding Questions, Enabling Competencies
- **Timeline Documents**: EVR and PPR reporting timelines

### Assessment and Evaluation

#### **Evaluation Criteria**
- **Completeness**: All guiding questions addressed
- **Complexity**: Appropriate level of difficulty demonstrated
- **Autonomy**: Level of independence shown
- **Judgment**: Evidence of decision-making and analysis
- **Transferability**: Skills applicable beyond current role

#### **Common Quality Issues**
- **Insufficient Detail**: Examples lacking specific walk-through descriptions
- **Wrong Level**: Targeting proficiency level that doesn't match experience
- **Missing Elements**: Not addressing all guiding questions
- **Generic Responses**: Lacking specific examples and quantifiable results

### Mentorship Requirements

#### **Mentor Qualifications**
- Must be a CPA with relevant experience
- Understanding of candidate's role and industry
- Ability to provide ongoing guidance and support

#### **Mentorship Activities**
- Regular meetings and discussions
- Review of PERT responses and feedback
- Career guidance and professional development
- Industry-specific competency development

### Job Change Considerations

#### **Available Resources**
- Change of Job: EVR to EVR (Updated March 1, 2022)
- Change of Job: EVR to PPR (Updated March 1, 2022)
- Change of Job: PPR to EVR (Updated March 1, 2022)
- Change of Job: PPR to PPR (Updated March 1, 2022)

#### **Impact Factors**
- Competency development continuity
- Mentorship relationship changes
- Timeline adjustments
- Experience diversity requirements

### National Framework Integration

#### **CPA Canada Standards**
- **Guiding Questions and Practical Experience Rubric** (April 2023)
- **CPA Practical Experience Requirements** (Updated April 1, 2023)
- **Harmonized Practical Experience Policies** (Updated April 1, 2023)

#### **Assessment Consistency**
- National rubric standards applied provincially
- Consistent proficiency level definitions
- Standardized competency framework
- Uniform assessment criteria

### Implementation Best Practices

#### **Preparation Phase**
1. Complete self-assessment tool
2. Review pre-assessment checklist
3. Identify 8-10 key competencies for role
4. Establish mentorship relationship
5. Understand proficiency level requirements

#### **Response Development**
1. Use guiding questions as framework
2. Focus on most complex examples
3. Provide specific, quantifiable details
4. Show progression and growth
5. Demonstrate judgment and analysis

#### **Quality Assurance**
1. Address all guiding questions
2. Stay within character limits
3. Provide complete walk-through descriptions
4. Show appropriate proficiency level
5. Demonstrate transferable skills

## Important Reminders

1. **NEVER** fabricate CPA content - all content must be live-fetched
2. **ALWAYS** prioritize CPA BC over other provinces
3. **FILTER** out public practice content for EVR route focus
4. **VALIDATE** all metadata against the schema before committing
5. **PRESERVE** version history for audit trail
6. **VERIFY** SHA-256 checksums for data integrity
7. **FOCUS** on 8-10 key competencies relevant to candidate's role
8. **DEMONSTRATE** progressive, complex experience with specific examples
9. **MAINTAIN** 5,000 character limit and response box boundaries
10. **ENSURE** all guiding questions are addressed for targeted proficiency level