#!/usr/bin/env node
/**
 * Organizes electron-builder output into a versioned release structure.
 * 
 * Structure:
 * - release/MineAnvil Setup <version>.exe (installer at root for distribution)
 * - release/win-unpacked/ (latest unpacked for testing)
 * - release/versions/v<version>/ (versioned archive)
 *   - MineAnvil Setup <version>.exe
 *   - win-unpacked/
 */

const fs = require('fs');
const path = require('path');

const releaseDir = path.join(process.cwd(), 'release');
const versionsDir = path.join(releaseDir, 'versions');

// Read version from package.json
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const version = packageJson.version || '0.0.0';
const versionDir = path.join(versionsDir, `v${version}`);

// Ensure versions directory exists
if (!fs.existsSync(versionsDir)) {
  fs.mkdirSync(versionsDir, { recursive: true });
}

// Find installer .exe file
const installerPattern = /^MineAnvil Setup .*\.exe$/;
let installerFile = null;

if (fs.existsSync(releaseDir)) {
  const releaseFiles = fs.readdirSync(releaseDir, { withFileTypes: true });
  installerFile = releaseFiles.find(f => 
    f.isFile() && installerPattern.test(f.name)
  );
}

if (installerFile) {
  const installerPath = path.join(releaseDir, installerFile.name);
  const versionedInstallerPath = path.join(versionDir, installerFile.name);
  
  // Create version directory
  if (!fs.existsSync(versionDir)) {
    fs.mkdirSync(versionDir, { recursive: true });
  }
  
  // Copy installer to versioned location (keep original at root)
  if (!fs.existsSync(versionedInstallerPath)) {
    fs.copyFileSync(installerPath, versionedInstallerPath);
    console.log(`✓ Archived installer to: versions/v${version}/${installerFile.name}`);
  }
}

// Handle win-unpacked directory
const winUnpackedPath = path.join(releaseDir, 'win-unpacked');
const versionedUnpackedPath = path.join(versionDir, 'win-unpacked');

if (fs.existsSync(winUnpackedPath)) {
  // Create version directory if needed
  if (!fs.existsSync(versionDir)) {
    fs.mkdirSync(versionDir, { recursive: true });
  }
  
  // Copy win-unpacked to versioned location (keep original at root)
  if (!fs.existsSync(versionedUnpackedPath)) {
    copyDirRecursive(winUnpackedPath, versionedUnpackedPath);
    console.log(`✓ Archived unpacked build to: versions/v${version}/win-unpacked/`);
  }
}

console.log(`\nRelease structure organized:`);
console.log(`  - Installer: release/${installerFile?.name || 'N/A'}`);
console.log(`  - Unpacked: release/win-unpacked/`);
console.log(`  - Archived: release/versions/v${version}/`);

function copyDirRecursive(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  
  const entries = fs.readdirSync(src, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

