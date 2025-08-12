#!/usr/bin/env node

/**
 * Version Management Script
 * Manages version updates across the project
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const VERSION_FILE = path.join(__dirname, '..', 'VERSION');
const PACKAGE_FILES = [
  path.join(__dirname, '..', 'package.json'),
  path.join(__dirname, '..', 'backend', 'package.json'),
  path.join(__dirname, '..', 'frontend', 'package.json')
];

/**
 * Read current version from VERSION file
 */
function getCurrentVersion() {
  try {
    return fs.readFileSync(VERSION_FILE, 'utf8').trim();
  } catch (error) {
    console.error('❌ Error reading VERSION file:', error.message);
    process.exit(1);
  }
}

/**
 * Write version to VERSION file
 */
function writeVersion(version) {
  fs.writeFileSync(VERSION_FILE, version);
}

/**
 * Update version in package.json files
 */
function updatePackageVersions(version) {
  PACKAGE_FILES.forEach(file => {
    if (fs.existsSync(file)) {
      const pkg = JSON.parse(fs.readFileSync(file, 'utf8'));
      pkg.version = version;
      fs.writeFileSync(file, JSON.stringify(pkg, null, 2) + '\n');
      console.log(`✅ Updated ${path.relative(process.cwd(), file)}`);
    }
  });
}

/**
 * Parse semantic version
 */
function parseVersion(version) {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)(?:-(.+))?$/);
  if (!match) {
    throw new Error(`Invalid version format: ${version}`);
  }
  return {
    major: parseInt(match[1]),
    minor: parseInt(match[2]),
    patch: parseInt(match[3]),
    prerelease: match[4] || null,
    toString() {
      let v = `${this.major}.${this.minor}.${this.patch}`;
      if (this.prerelease) v += `-${this.prerelease}`;
      return v;
    }
  };
}

/**
 * Increment version based on type
 */
function incrementVersion(currentVersion, type) {
  const version = parseVersion(currentVersion);
  
  switch (type) {
    case 'major':
      version.major++;
      version.minor = 0;
      version.patch = 0;
      version.prerelease = null;
      break;
    case 'minor':
      version.minor++;
      version.patch = 0;
      version.prerelease = null;
      break;
    case 'patch':
      version.patch++;
      version.prerelease = null;
      break;
    case 'prerelease':
      if (version.prerelease) {
        // Increment prerelease number
        const match = version.prerelease.match(/^(.+?)\.?(\d+)?$/);
        if (match) {
          const prefix = match[1];
          const num = parseInt(match[2] || '0') + 1;
          version.prerelease = `${prefix}.${num}`;
        }
      } else {
        // Add beta prerelease for versions < 1.0.0
        if (version.major === 0) {
          version.prerelease = 'beta.1';
        } else {
          version.prerelease = 'rc.1';
        }
      }
      break;
    default:
      throw new Error(`Unknown version type: ${type}`);
  }
  
  return version.toString();
}

/**
 * Create git tag
 */
function createGitTag(version, message) {
  try {
    execSync(`git tag -a v${version} -m "${message}"`, { stdio: 'inherit' });
    console.log(`✅ Created git tag: v${version}`);
  } catch (error) {
    console.error('❌ Error creating git tag:', error.message);
  }
}

/**
 * Main CLI
 */
function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  if (!command || command === 'current') {
    // Display current version
    const version = getCurrentVersion();
    console.log(`Current version: ${version}`);
    return;
  }
  
  if (command === 'set') {
    // Set specific version
    const newVersion = args[1];
    if (!newVersion) {
      console.error('❌ Please provide a version number');
      process.exit(1);
    }
    try {
      parseVersion(newVersion); // Validate format
      writeVersion(newVersion);
      updatePackageVersions(newVersion);
      console.log(`✅ Version set to: ${newVersion}`);
    } catch (error) {
      console.error(`❌ ${error.message}`);
      process.exit(1);
    }
    return;
  }
  
  if (['major', 'minor', 'patch', 'prerelease'].includes(command)) {
    // Increment version
    const currentVersion = getCurrentVersion();
    const newVersion = incrementVersion(currentVersion, command);
    writeVersion(newVersion);
    updatePackageVersions(newVersion);
    console.log(`✅ Version bumped from ${currentVersion} to ${newVersion}`);
    
    // Optional: create git tag
    if (args.includes('--tag')) {
      const message = args[args.indexOf('--tag') + 1] || `Release ${newVersion}`;
      createGitTag(newVersion, message);
    }
    return;
  }
  
  if (command === 'help') {
    console.log(`
Pathfinder Version Management

Usage:
  node scripts/version.js [command] [options]

Commands:
  current              Show current version
  set <version>        Set specific version
  major               Bump major version (x.0.0)
  minor               Bump minor version (0.x.0)
  patch               Bump patch version (0.0.x)
  prerelease          Bump prerelease version (0.0.0-x)
  help                Show this help message

Options:
  --tag [message]     Create git tag with optional message

Examples:
  node scripts/version.js current
  node scripts/version.js set 0.2.0-beta.1
  node scripts/version.js patch
  node scripts/version.js minor --tag "Feature release"
  node scripts/version.js prerelease

Current versioning strategy (pre-1.0):
  - 0.x.y-beta.z for development releases
  - 0.x.y-rc.z for release candidates
  - 0.x.y for stable pre-1.0 releases
    `);
    return;
  }
  
  console.error(`❌ Unknown command: ${command}`);
  console.log('Run "node scripts/version.js help" for usage information');
  process.exit(1);
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  getCurrentVersion,
  incrementVersion,
  parseVersion
};