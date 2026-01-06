# MineAnvil Desktop

Cross-platform desktop launcher for Minecraft Java with Microsoft sign-in,
managed Java runtime, install & launch pipeline, and diagnostics.

## Status
- Windows: primary execution target (Electron)
- macOS/Linux: browser-based development mode supported
- Project is under active development

## Development
- Renderer runs via Vite
- Desktop runtime via Electron
- macOS development uses Docker (no local installs required)

This repository intentionally avoids OS-specific forks.

## Building

### Development Build
```bash
npm install
npm run build:all
npm run start:electron
```

### Release Builds

#### Option 1: Windows Installer (NSIS)
Creates a Windows installer (.exe) for distribution:
```bash
npm run package:win
```

**Output:**
- `release/MineAnvil Setup <version>.exe` - NSIS installer
- `release/win-unpacked/` - Unpacked application files

**Note:** NSIS installer creation may fail on some machines due to Windows symlink privilege requirements. The unpacked build will still succeed.

#### Option 2: Portable Distribution (USB/External Drive)
Creates a portable distribution for USB drives or external storage:
```bash
npm run package:portable
```

**Output:**
- `release/portable/win-unpacked/` - Complete portable application

**Important for USB distribution:**
- Copy the **entire `win-unpacked` folder** to your USB drive
- Run `MineAnvil.exe` from within that folder
- **Do NOT** copy just the `.exe` file - all DLLs and resources must stay together
- The executable requires `ffmpeg.dll` and other DLLs in the same directory

#### Option 3: Quick Testing (Use Existing Build)
If you've already run a package command, test the unpacked build directly:
```bash
./release/win-unpacked/MineAnvil.exe
```

### Testing Third-Party Machine Conditions

To verify the app works without environment variables (simulating a user's machine):

```bash
# Temporarily rename .env
mv .env .env.testing-backup

# Launch the app
./release/win-unpacked/MineAnvil.exe

# Restore .env after testing
mv .env.testing-backup .env
```

The app should boot successfully without any "Microsoft client id not recognised" errors. The MS_CLIENT_ID is embedded at build time and does not require environment variables at runtime.