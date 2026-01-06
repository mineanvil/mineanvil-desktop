#!/usr/bin/env node
/**
 * Creates a portable distribution of MineAnvil for USB/external drive distribution.
 * 
 * This script copies the entire win-unpacked folder to a portable directory
 * that can be copied to USB or any location.
 */

const fs = require('fs');
const path = require('path');

const releaseDir = path.join(process.cwd(), 'release');
const winUnpackedPath = path.join(releaseDir, 'win-unpacked');
const portableDir = path.join(releaseDir, 'portable');
const portableWinUnpacked = path.join(portableDir, 'win-unpacked');

// Read version from package.json
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const version = packageJson.version || '0.0.0';

if (!fs.existsSync(winUnpackedPath)) {
  console.error('❌ Error: release/win-unpacked/ not found. Run npm run package:win first.');
  process.exit(1);
}

// Clean and create portable directory
if (fs.existsSync(portableDir)) {
  console.log('Cleaning existing portable directory...');
  fs.rmSync(portableDir, { recursive: true, force: true });
}

fs.mkdirSync(portableDir, { recursive: true });

// Copy entire win-unpacked folder
console.log('Copying win-unpacked to portable directory...');
copyDirRecursive(winUnpackedPath, portableWinUnpacked);

// Create launcher script next to MineAnvil.exe
const launcherPath = path.join(portableWinUnpacked, 'Run MineAnvil.cmd');
const launcherContent = `@echo off
setlocal
cd /d "%~dp0"
start "" "MineAnvil.exe"
`;
fs.writeFileSync(launcherPath, launcherContent, 'utf8');
console.log('Created launcher: Run MineAnvil.cmd');

// Create a README for the portable distribution
const readmePath = path.join(portableDir, 'README.txt');
const readmeContent = `MineAnvil Portable Distribution v${version}

INSTRUCTIONS:
1. Copy the entire "win-unpacked" folder to your USB drive or desired location
2. Run MineAnvil.exe from within the win-unpacked folder
   (Do NOT move just the .exe file - all DLLs and resources must stay together)

IMPORTANT:
- The MineAnvil.exe file requires all DLLs and resources in the same directory
- Always run the .exe from within the win-unpacked folder
- You can rename the win-unpacked folder if desired, but keep all files together

Files included:
- MineAnvil.exe (main executable)
- ffmpeg.dll, libEGL.dll, libGLESv2.dll, vulkan-1.dll (required DLLs)
- resources/ (application resources)
- locales/ (language files)
- Other required Electron runtime files

Version: ${version}
Build Date: ${new Date().toISOString().split('T')[0]}
`;

fs.writeFileSync(readmePath, readmeContent, 'utf8');

console.log(`\n✓ Portable distribution created:`);
console.log(`  Location: ${portableDir}`);
console.log(`  Executable: ${path.join(portableWinUnpacked, 'MineAnvil.exe')}`);
console.log(`  Launcher: ${path.join(portableWinUnpacked, 'Run MineAnvil.cmd')}`);
console.log(`\nTo distribute:`);
console.log(`  1. Copy the entire "win-unpacked" folder to your USB drive`);
console.log(`  2. Double-click "Run MineAnvil.cmd" or run MineAnvil.exe from within that folder`);
console.log(`\n⚠️  Important: Do NOT copy just the .exe file - all files must stay together!`);

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

