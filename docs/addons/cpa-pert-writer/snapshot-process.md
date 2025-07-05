# CPA PERT Resource Gathering and Snapshot Process

This document outlines the definitive process for gathering, saving, and managing resources related to the CPA Practical Experience Requirements (PERT). The process focuses on CPA BC (primary) with CPA Canada (supporting) for EVR route candidates.

## Core Principles

1.  **Live Data Only**: All resources and snapshots **must** be fetched live from the internet at the time of the request. The agent is strictly prohibited from using its internal knowledge base or pre-existing memory to generate this content.
2.  **Snapshot Mandate**: Every resource entry in `links/resource-links.json` **must** have a corresponding non-empty PDF snapshot stored in the `snapshots/` directory. Entries without a valid, non-empty snapshot are considered invalid and must be removed.
3.  **Verifiable Checksums**: Every saved snapshot must have a corresponding SHA-256 checksum recorded to ensure data integrity.
4.  **Version Control**: All resources must track version history with SHA-256 comparison to detect changes.
5.  **EVR Route Focus**: Prioritize Experience Verification Route (industry) over Public Practice route.
6.  **BC Jurisdiction Priority**: CPA BC requirements take precedence over other provincial guidelines.

## Directory and File Structure

-   `docs/addons/cpa-pert-writer/resources/`
    -   `links/resource-links.json`: The central registry containing metadata for all external resources, search endpoints, and organizational information.
    -   `knowledge/`: Contains subdirectories for each CPA body to store extracted knowledge in separate JSON files:
        -   `CPABC/`: BC-specific knowledge and metadata
        -   `CPACanada/`: National standards and framework knowledge
    -   `snapshots/`: Organized PDF storage by jurisdiction and document type:
        -   `CPABC/`: BC-specific documents (official-docs, forms, guidance)
        -   `CPACanada/`: National documents (competency-framework, handbook, standards)
    -   `schema/`: JSON schema definitions for metadata validation

## Method 1: User-Directed Snapshot

This method is used when a user provides a specific URL to be saved.

### Workflow

1.  **User Provides URL**: The user submits a direct URL to a resource.
2.  **Agent Validates Source**: Verify the URL is from approved CPA organizations (CPABC or CPA Canada).
3.  **Agent Fetches and Saves**: The agent accesses the URL live.
    -   If the URL points to a web page, the agent saves a PDF printout of the rendered HTML.
    -   If the URL points to a document (e.g., `.pdf`, `.docx`), the agent downloads the file and saves it as a PDF.
4.  **Agent Generates Metadata**: The agent creates comprehensive metadata following the schema:
    -   Document classification (technical/enabling/general competency)
    -   Route relevance (EVR/PublicPractice/Both/General)
    -   Version tracking with SHA-256 checksum
    -   Timestamp and validation status
5.  **Agent Updates Registry**: Updates both `links/resource-links.json` and appropriate metadata files.
6.  **Agent Extracts Knowledge**: Analyzes the content and adds structured knowledge to relevant JSON files in the `knowledge/` directory.
7.  **Agent Validates Storage**: Ensures PDF snapshot exists and metadata is complete.

## Method 2: LLM-Automated Search

This method is used when the agent is tasked with proactively finding PERT-related resources for CPA BC (primary) or CPA Canada (supporting).

### Workflow

1.  **Identify Target Organization**: Focus on CPA BC first, then CPA Canada for national framework.
2.  **Retrieve Search Configuration**: The agent consults `links/resource-links.json` for:
    -   Search endpoint for the organization
    -   Approved search keywords (EVR, PERT, Technical Competencies, etc.)
    -   Excluded keywords (Public Practice, Audit Training, etc.)
3.  **Execute Targeted Search**: The agent constructs EVR-focused search queries and executes searches.
4.  **Filter Results**: Apply EVR route filter and exclude public practice materials.
5.  **Process Relevant Results**: For each qualifying link, follow the **User-Directed Snapshot** workflow.
6.  **Version Management**: Check for existing resources and update version tracking if content changed.
7.  **Quality Assurance**: Validate all captured resources meet EVR relevance criteria.

## Enhanced Metadata Schema

The metadata system uses a comprehensive schema (`schema/metadata-schema.json`) to ensure consistency and enable advanced features like version tracking, competency classification, and validation status.

### Key Schema Features

1.  **Version Control**: Track document versions with SHA-256 comparison
2.  **Competency Classification**: Categorize as technical, enabling, or general competency content
3.  **Route Relevance**: Specify EVR, PublicPractice, Both, or General applicability
4.  **Validation Status**: Track verified, needs_review, outdated, or broken_link status
5.  **Change History**: Maintain audit trail of document modifications

### Example Enhanced Resource Entry

```json
{
  "document_id": "cpabc_pert_system_guide_v1",
  "title": "PERT System Guide",
  "url": "https://www.bccpa.ca/students/practical-experience/pert-system/",
  "source": "CPABC",
  "route_relevance": "EVR",
  "document_type": "official",
  "competency_classification": "general",
  "version_info": {
    "version": "1.0",
    "is_current": true,
    "previous_versions": []
  },
  "capture_info": {
    "timestamp": "2025-07-05T12:00:00Z",
    "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "captured_by": "automated_crawler"
  },
  "storage_info": {
    "saved_path": "snapshots/CPABC/official-docs/pert-system-guide-v1.pdf"
  },
  "validation_status": "verified",
  "last_verified": "2025-07-05T12:00:00Z"
}
```

### Metadata File Organization

-   `links/resource-links.json`: Central registry with organizational metadata
-   `knowledge/CPABC/cpabc-metadata.json`: BC-specific document metadata
-   `knowledge/CPACanada/canada-metadata.json`: National document metadata
-   `knowledge/CPABC/cpabc-knowledge.json`: Extracted BC knowledge content
-   `knowledge/CPACanada/canada-knowledge.json`: Extracted national knowledge content