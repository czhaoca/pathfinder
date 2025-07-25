#!/usr/bin/env node

/**
 * Basic CPA Resource Collector
 * Uses only built-in Node.js modules to demonstrate the collection process
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

console.log('🚀 Basic CPA Resource Collector');
console.log('==============================\n');

// Configuration
const config = {
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  outputDir: path.join(process.cwd(), 'data/snapshots/manual')
};

// Ensure output directory exists
if (!fs.existsSync(config.outputDir)) {
  fs.mkdirSync(config.outputDir, { recursive: true });
}

// Known CPA resources (these would normally be scraped)
const knownResources = [
  {
    name: 'CPA Canada Guiding Questions',
    url: 'https://www.cpacanada.ca/-/media/site/operational/ec-education-certification/docs/02639-ec_guiding-questions-practical-experience-rubric.pdf',
    description: 'Guiding questions and practical experience rubric (April 2023)'
  },
  {
    name: 'CPA Practical Experience Requirements',
    url: 'https://www.cpacanada.ca/-/media/site/operational/ec-education-certification/docs/g10177-ec-cpa-practical-experience-requirements-v20.pdf',
    description: 'CPA practical experience requirements guide'
  }
];

// Function to download a file
function downloadFile(url, filename) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(path.join(config.outputDir, filename));
    
    const options = {
      headers: {
        'User-Agent': config.userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    };
    
    https.get(url, options, (response) => {
      console.log(`Response status: ${response.statusCode}`);
      console.log(`Headers: ${JSON.stringify(response.headers, null, 2)}`);
      
      if (response.statusCode === 302 || response.statusCode === 301) {
        console.log(`Redirect to: ${response.headers.location}`);
        file.close();
        fs.unlinkSync(path.join(config.outputDir, filename));
        reject(new Error('Redirect detected - likely Cloudflare protection'));
        return;
      }
      
      if (response.statusCode !== 200) {
        file.close();
        fs.unlinkSync(path.join(config.outputDir, filename));
        reject(new Error(`HTTP ${response.statusCode}`));
        return;
      }
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        resolve(filename);
      });
    }).on('error', (err) => {
      fs.unlinkSync(path.join(config.outputDir, filename));
      reject(err);
    });
  });
}

// Function to calculate file checksum
function calculateChecksum(filepath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filepath);
    
    stream.on('data', (data) => {
      hash.update(data);
    });
    
    stream.on('end', () => {
      resolve(hash.digest('hex'));
    });
    
    stream.on('error', reject);
  });
}

// Main collection process
async function collectResources() {
  console.log('Starting resource collection...\n');
  
  const results = {
    successful: [],
    failed: [],
    metadata: []
  };
  
  for (const resource of knownResources) {
    console.log(`\n📄 Attempting to download: ${resource.name}`);
    console.log(`   URL: ${resource.url}`);
    
    const filename = path.basename(resource.url);
    
    try {
      await downloadFile(resource.url, filename);
      const filepath = path.join(config.outputDir, filename);
      const stats = fs.statSync(filepath);
      const checksum = await calculateChecksum(filepath);
      
      const metadata = {
        name: resource.name,
        filename: filename,
        url: resource.url,
        description: resource.description,
        size: stats.size,
        sha256: checksum,
        downloadedAt: new Date().toISOString()
      };
      
      results.successful.push(filename);
      results.metadata.push(metadata);
      
      console.log(`   ✅ Success! Size: ${stats.size} bytes`);
      console.log(`   SHA-256: ${checksum}`);
      
    } catch (error) {
      console.log(`   ❌ Failed: ${error.message}`);
      results.failed.push({
        resource: resource.name,
        error: error.message
      });
    }
  }
  
  // Save metadata
  const metadataPath = path.join(config.outputDir, 'collection_metadata.json');
  fs.writeFileSync(metadataPath, JSON.stringify(results, null, 2));
  
  console.log('\n📊 Collection Summary:');
  console.log(`   Successful: ${results.successful.length}`);
  console.log(`   Failed: ${results.failed.length}`);
  
  if (results.failed.length > 0) {
    console.log('\n⚠️  Failed resources (manual download required):');
    results.failed.forEach(f => {
      console.log(`   - ${f.resource}: ${f.error}`);
    });
    
    console.log('\n📌 Manual Download Instructions:');
    console.log('   1. Visit the URLs in a web browser');
    console.log('   2. Complete any Cloudflare challenges');
    console.log('   3. Download the PDFs manually');
    console.log(`   4. Place them in: ${config.outputDir}`);
  }
  
  console.log(`\n📁 Output directory: ${config.outputDir}`);
  console.log(`📋 Metadata saved to: ${metadataPath}`);
}

// Alternative: Generate wget commands
function generateWgetCommands() {
  console.log('\n🔧 Alternative: wget commands for manual execution:\n');
  
  knownResources.forEach(resource => {
    const filename = path.basename(resource.url);
    const wgetCmd = `wget --user-agent="${config.userAgent}" \\
  --header="Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" \\
  --header="Accept-Language: en-US,en;q=0.5" \\
  --no-check-certificate \\
  --timeout=30 \\
  --tries=3 \\
  -O "${config.outputDir}/${filename}" \\
  "${resource.url}"`;
    
    console.log(`# ${resource.name}`);
    console.log(wgetCmd);
    console.log();
  });
}

// Run the collector
collectResources()
  .then(() => {
    generateWgetCommands();
    console.log('\n✅ Collection process completed!');
  })
  .catch(error => {
    console.error('\n❌ Collection failed:', error);
    generateWgetCommands();
  });