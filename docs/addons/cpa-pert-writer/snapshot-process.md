# CPA PERT Resource Gathering and Snapshot Process

This document outlines the definitive process for gathering, saving, and managing resources related to the CPA Practical Experience Requirements (PERT). It covers two primary methods for resource collection: user-directed snapshots and LLM-automated searches.

## Core Principles

1.  **Live Data Only**: All resources and snapshots **must** be fetched live from the internet at the time of the request. The agent is strictly prohibited from using its internal knowledge base or pre-existing memory to generate this content.
2.  **Snapshot Mandate**: Every resource entry in `links/resource-links.json` **must** have a corresponding non-empty PDF snapshot stored in the `snapshots/` directory. Entries without a valid, non-empty snapshot are considered invalid and must be removed.
3.  **Verifiable Checksums**: Every saved snapshot must have a corresponding SHA-256 checksum recorded to ensure data integrity.

## Directory and File Structure

-   `docs/addons/cpa-pert-writer/resources/`
    -   `links/resource-links.json`: The central JSON file containing metadata for all external resources, including website URLs and search endpoints.
    -   `knowledge/`: Contains subdirectories for each CPA body (e.g., `CPACanada/`, `CPABC/`) to store extracted knowledge in separate JSON files.
    -   `snapshots/`: The directory where all captured PDF snapshots of resources are stored.

## Method 1: User-Directed Snapshot

This method is used when a user provides a specific URL to be saved.

### Workflow

1.  **User Provides URL**: The user submits a direct URL to a resource.
2.  **Agent Fetches and Saves**: The agent accesses the URL live.
    -   If the URL points to a web page, the agent saves a PDF printout of the rendered HTML.
    -   If the URL points to a document (e.g., `.pdf`, `.docx`), the agent downloads the file and saves it as a PDF.
3.  **Agent Updates Metadata**: The agent generates a SHA-256 checksum for the new file and records the following metadata in `links/resource-links.json` under the appropriate CPA body:
    -   `title`: The title of the resource.
    -   `url`: The original URL of the resource.
    -   `description`: A brief description.
    -   `saved_path`: The relative path to the saved PDF in the `snapshots/` directory.
    -   `saved_timestamp`: The ISO 8601 timestamp of when the file was saved.
    -   `checksum`: The SHA-256 checksum of the saved file.
4.  **Agent Extracts Knowledge**: The agent analyzes the content of the new PDF and adds structured knowledge to the relevant JSON file in the `knowledge/` directory (e.g., `knowledge/CPABC/cpabc-knowledge.json`).

## Method 2: LLM-Automated Search

This method is used when the agent is tasked with proactively finding PERT-related resources for a specific CPA body.

### Workflow

1.  **Identify CPA Body**: The agent is instructed to find resources for a specific body (e.g., "Find PERT resources for CPA Ontario").
2.  **Retrieve Search Endpoint**: The agent consults `links/resource-links.json` to find the registered `search_endpoint` for that CPA body.
3.  **Execute Search**: The agent constructs a search query (e.g., using the term "PERT") and executes a search using the endpoint.
4.  **Process Results**: The agent analyzes the search results and, for each relevant link, follows the **User-Directed Snapshot** workflow (steps 2-4) to save the resource, update metadata, and extract knowledge.

## JSON Metadata Structure

The `links/resource-links.json` file is the cornerstone of this process. It must be structured to include the website's base URL and its search endpoint.

**Note**: Public search API endpoints are rare. In most cases, the `search_endpoint` will be a URL structure representing a site search. For example, a search for "PERT" on the CPABC website might be represented as `https://www.bccpa.ca/search?q=PERT`.

### Example `resource-links.json` Structure

```json
{
  "cpabc": {
    "organization": "CPABC",
    "website": "https://www.bccpa.ca",
    "search_endpoint": "https://www.bccpa.ca/search?q=",
    "resources": {
      "pert_system_guide": {
        "title": "PERT System Guide",
        "url": "https://www.bccpa.ca/students/practical-experience/pert-system/",
        "description": "BC-specific PERT system usage and requirements",
        "saved_path": "docs/addons/cpa-pert-writer/resources/snapshots/cpabc-pert-system-guide.pdf",
        "saved_timestamp": "2025-07-05T12:00:00Z",
        "checksum": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
      }
    }
  }
}
```