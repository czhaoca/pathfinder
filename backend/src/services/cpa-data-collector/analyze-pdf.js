#!/usr/bin/env node

/**
 * Simple PDF Analyzer
 * Analyzes downloaded CPA PDFs without external dependencies
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

console.log('📄 CPA PDF Analyzer');
console.log('==================\n');

const pdfPath = path.join(process.cwd(), 'data/snapshots/manual/02639-ec_guiding-questions-practical-experience-rubric.pdf');

if (!fs.existsSync(pdfPath)) {
  console.error('❌ PDF not found:', pdfPath);
  process.exit(1);
}

// Get file stats
const stats = fs.statSync(pdfPath);
console.log('📊 File Information:');
console.log(`   Path: ${pdfPath}`);
console.log(`   Size: ${(stats.size / 1024).toFixed(2)} KB`);
console.log(`   Modified: ${stats.mtime}`);

// Calculate checksum
const fileBuffer = fs.readFileSync(pdfPath);
const hash = crypto.createHash('sha256');
hash.update(fileBuffer);
const sha256 = hash.digest('hex');
console.log(`   SHA-256: ${sha256}`);

// Check if it's a valid PDF
const header = fileBuffer.toString('utf-8', 0, 5);
console.log(`   PDF Header: ${header} (${header === '%PDF-' ? '✅ Valid' : '❌ Invalid'})`);

// Extract basic text (very crude method - just for demonstration)
console.log('\n📝 Text Preview (first readable strings):');
const textContent = fileBuffer.toString('utf-8');
const readableStrings = textContent.match(/[\x20-\x7E]{10,}/g);

if (readableStrings) {
  // Look for competency-related content
  const competencyKeywords = [
    'Financial Reporting',
    'Management Accounting',
    'Taxation',
    'Audit',
    'Finance',
    'Strategy',
    'Level 0',
    'Level 1', 
    'Level 2',
    'Guiding Questions',
    'Technical Competencies',
    'Enabling Competencies',
    'PERT',
    'EVR',
    'PPR'
  ];
  
  console.log('\n🔍 Found Keywords:');
  competencyKeywords.forEach(keyword => {
    const found = readableStrings.some(str => str.includes(keyword));
    if (found) {
      console.log(`   ✓ ${keyword}`);
    }
  });
  
  console.log('\n📋 Sample Content:');
  // Find some meaningful content
  const meaningfulStrings = readableStrings
    .filter(str => str.length > 30 && str.length < 200)
    .filter(str => /[a-zA-Z\s]{20,}/.test(str))
    .slice(0, 10);
  
  meaningfulStrings.forEach((str, i) => {
    console.log(`   ${i + 1}. ${str.substring(0, 80)}...`);
  });
}

// Create metadata
const metadata = {
  filename: path.basename(pdfPath),
  title: 'CPA Canada Guiding Questions and Practical Experience Rubric',
  source: 'CPACanada',
  url: 'https://www.cpacanada.ca/-/media/site/operational/ec-education-certification/docs/02639-ec_guiding-questions-practical-experience-rubric.pdf',
  downloadedAt: new Date().toISOString(),
  fileSize: stats.size,
  sha256: sha256,
  documentType: 'guidance',
  competencyClassification: 'mixed',
  routeRelevance: 'Both',
  description: 'Official CPA Canada document containing guiding questions for all technical and enabling competencies, with practical experience rubric for EVR and PPR routes',
  importance: 'critical',
  extractionRequired: true
};

// Save metadata
const metadataPath = path.join(path.dirname(pdfPath), 'pdf_metadata.json');
fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

console.log(`\n💾 Metadata saved to: ${metadataPath}`);

console.log('\n📌 Next Steps:');
console.log('1. Install pdf-parse to extract full text content');
console.log('2. Process competencies and guiding questions');
console.log('3. Build knowledge graph from extracted data');
console.log('4. Generate training data for LLM fine-tuning');

console.log('\n✅ Analysis complete!');

// Show what we know about this document
console.log('\n📚 Document Summary:');
console.log('This is the official CPA Canada "Guiding Questions and Practical Experience Rubric"');
console.log('It contains:');
console.log('- Guiding questions for all technical competencies (FR, MA, TX, AA, FN, SG)');
console.log('- Guiding questions for all enabling competencies');
console.log('- Proficiency level descriptions (Level 0, 1, 2)');
console.log('- Experience verification rubric for EVR and PPR routes');
console.log('- Critical resource for PERT response generation');