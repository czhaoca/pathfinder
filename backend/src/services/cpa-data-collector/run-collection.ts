#!/usr/bin/env node

/**
 * CPA Data Collection Runner
 * Command-line script to run the CPA PERT data collection pipeline
 */

import { runCPADataCollection } from './cpa-data-orchestrator';
import { getConfig } from './config/cpa-collector-config';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function main() {
  console.log('🚀 CPA PERT Data Collection Pipeline');
  console.log('=====================================\n');
  
  // Parse command line arguments
  const args = process.argv.slice(2);
  const flags = {
    headless: !args.includes('--no-headless'),
    validateChecksums: !args.includes('--no-validate'),
    requireAll: args.includes('--require-all'),
    help: args.includes('--help') || args.includes('-h')
  };
  
  if (flags.help) {
    console.log(`Usage: npm run cpa:collect [options]

Options:
  --no-headless      Run browser in visible mode
  --no-validate      Skip checksum validation
  --require-all      Fail if any resource cannot be collected
  --help, -h         Show this help message

Environment Variables:
  CPA_SNAPSHOT_DIR   Directory for downloaded PDFs
  CPA_KNOWLEDGE_DIR  Directory for knowledge base output
  CPA_METADATA_DIR   Directory for metadata and reports
  CPA_TEMP_DIR       Temporary directory for processing
`);
    process.exit(0);
  }
  
  // Override config with command line flags
  const config = getConfig();
  config.headless = flags.headless;
  config.validateChecksums = flags.validateChecksums;
  config.requireAllResources = flags.requireAll;
  
  try {
    const result = await runCPADataCollection(config);
    
    if (result.success) {
      console.log('\n✅ Collection pipeline completed successfully!');
      process.exit(0);
    } else {
      console.error('\n❌ Collection pipeline completed with errors:');
      result.errors.forEach(error => console.error(`  - ${error}`));
      process.exit(1);
    }
  } catch (error) {
    console.error('\n💥 Fatal error:', error);
    process.exit(2);
  }
}

// Run the main function
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(3);
});