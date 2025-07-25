/**
 * CPA Data Collector Configuration
 */

import path from 'path';

export interface CPACollectorConfig {
  // Directory paths
  snapshotDir: string;
  knowledgeDir: string;
  metadataDir: string;
  tempDir: string;
  
  // URLs
  cpabcBaseUrl: string;
  cpaCanadaBaseUrl: string;
  
  // Browser configuration
  headless: boolean;
  userAgent: string;
  
  // Collection settings
  retryAttempts: number;
  timeout: number;
  
  // Validation settings
  validateChecksums: boolean;
  requireAllResources: boolean;
}

export const defaultConfig: CPACollectorConfig = {
  // Directory paths
  snapshotDir: path.join(process.cwd(), 'data/snapshots'),
  knowledgeDir: path.join(process.cwd(), 'data/knowledge'),
  metadataDir: path.join(process.cwd(), 'data/metadata'),
  tempDir: path.join(process.cwd(), 'data/temp'),
  
  // URLs
  cpabcBaseUrl: 'https://www.bccpa.ca/',
  cpaCanadaBaseUrl: 'https://www.cpacanada.ca/',
  
  // Browser configuration
  headless: true,
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  
  // Collection settings
  retryAttempts: 3,
  timeout: 30000,
  
  // Validation settings
  validateChecksums: true,
  requireAllResources: false
};

export function getConfig(): CPACollectorConfig {
  return {
    ...defaultConfig,
    // Allow environment variable overrides
    snapshotDir: process.env.CPA_SNAPSHOT_DIR || defaultConfig.snapshotDir,
    knowledgeDir: process.env.CPA_KNOWLEDGE_DIR || defaultConfig.knowledgeDir,
    metadataDir: process.env.CPA_METADATA_DIR || defaultConfig.metadataDir,
    tempDir: process.env.CPA_TEMP_DIR || defaultConfig.tempDir,
    headless: process.env.CPA_HEADLESS !== 'false',
    validateChecksums: process.env.CPA_VALIDATE_CHECKSUMS !== 'false',
    requireAllResources: process.env.CPA_REQUIRE_ALL_RESOURCES === 'true'
  };
}