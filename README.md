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

### Windows Installer
To create a Windows installer (.exe) for distribution:
```bash
npm install
npm run package:win
```

The installer will be created in `release/MineAnvil Setup <version>.exe`.

### Portable Distribution (USB/External Drive)
To create a portable distribution for USB drives or external storage:
```bash
npm install
npm run package:portable
```

This creates `release/portable/win-unpacked/` containing all required files.

**Important for USB distribution:**
- Copy the **entire `win-unpacked` folder** to your USB drive
- Run `MineAnvil.exe` from within that folder
- **Do NOT** copy just the `.exe` file - all DLLs and resources must stay together
- The executable requires `ffmpeg.dll` and other DLLs in the same directory