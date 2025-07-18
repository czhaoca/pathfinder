#!/usr/bin/env node

const { exec, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Detect architecture
const arch = os.arch();
const isARM = arch === 'arm64' || arch === 'aarch64';

// Setup environment for ARM
if (isARM) {
  process.env.PUPPETEER_PRODUCT = 'chrome';
}

function checkAndSetup() {
  const scriptDir = path.dirname(__filename);
  const wrapperPath = path.join(scriptDir, 'mermaid-wrapper.sh');
  
  if (!fs.existsSync(wrapperPath)) {
    console.log('First time setup required. Running setup...');
    try {
      execSync(`${path.join(scriptDir, 'setup-mermaid.sh')}`, { stdio: 'inherit' });
    } catch (error) {
      console.error('Setup failed. Please run ./scripts/setup-mermaid.sh manually');
      process.exit(1);
    }
  }
}

function convertMermaidToPng(inputFile, outputFile) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(inputFile)) {
      reject(new Error(`Input file not found: ${inputFile}`));
      return;
    }

    const output = outputFile || inputFile.replace(/\.mmd$/, '.png');
    const scriptDir = path.dirname(__filename);
    const wrapperPath = path.join(scriptDir, 'mermaid-wrapper.sh');
    
    // Use wrapper script if available, otherwise use mmdc directly
    const command = fs.existsSync(wrapperPath) 
      ? `"${wrapperPath}" -i "${inputFile}" -o "${output}" -t dark -b transparent --width 2048`
      : `mmdc -i "${inputFile}" -o "${output}" -t dark -b transparent --width 2048`;
    
    // Set environment for ARM
    const env = { ...process.env };
    if (isARM) {
      env.PUPPETEER_PRODUCT = 'chrome';
    }
    
    exec(command, { env }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`Conversion failed: ${error.message}`));
        return;
      }
      
      resolve({
        input: inputFile,
        output: output,
        message: `Successfully converted to ${output}`
      });
    });
  });
}

// CLI usage
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('Usage: node mermaid-converter.js <input.mmd> [output.png]');
    console.log('Example: node mermaid-converter.js diagram.mmd diagram.png');
    process.exit(1);
  }
  
  // Check setup first
  checkAndSetup();
  
  const inputFile = args[0];
  const outputFile = args[1];
  
  convertMermaidToPng(inputFile, outputFile)
    .then(result => console.log(result.message))
    .catch(error => {
      console.error(error.message);
      process.exit(1);
    });
}

module.exports = { convertMermaidToPng };