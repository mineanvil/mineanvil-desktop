# MineAnvil Java Runtime (Pinned & Managed)

MineAnvil launches **Minecraft: Java Edition**, which requires a compatible Java runtime.

This document describes exactly what MineAnvil expects and how it resolves Java.

---

## Supported Java versions

- MineAnvil requires **Java 17 or newer**.
- If an older Java version is provided (for example Java 8 or Java 11), MineAnvil will block and explain what to do.

---

## Preferred distribution (managed runtime)

On Windows x64, MineAnvil prefers to use a **managed** runtime pinned to:

- **Vendor**: `temurin` (Eclipse Adoptium)
- **Pinned version**: **21** (major)
- **Platform**: `win-x64`

This is defined in the Electron main process runtime manifest:

- `electron/src/main/runtime/managedRuntime.ts` → `DEFAULT_RUNTIME_MANIFEST`

---

## Where the runtime is resolved from (and where it is installed)

When MineAnvil needs Java for launching Minecraft, it attempts this order:

1) **Managed runtime (preferred, Windows x64)**
   - MineAnvil downloads a runtime ZIP from the manifest’s `downloadUrl`
   - It verifies the download using the manifest’s pinned **SHA-256**
   - It extracts the archive under:
     - `app.getPath("userData")/runtimes/<vendor>/<version>/<platform>/`
   - It then uses Java at:
     - `<installDir>/<javaRelativePath>` (typically `bin/java.exe`)

2) **Fallback: system Java on PATH**
   - If the managed runtime install fails, MineAnvil tries `java.exe` found on `PATH`.

Notes:

- The managed runtime installer is currently implemented for **Windows only**.
- The runtime ZIP URL and SHA-256 are stored in `DEFAULT_RUNTIME_MANIFEST`. These values must be valid for managed installs to succeed.

---

## What happens if Java is missing or invalid

MineAnvil is designed to fail fast and clearly when Java is not usable.

### At application startup (Electron main)

MineAnvil validates Java early and will show a **blocking error dialog** if Java is not available or is incompatible:

- If `MINEANVIL_JAVA_PATH` is set but invalid → startup is blocked with an actionable message.
- If Java is present but **older than 17** → startup is blocked.
- If Java is not configured:
  - By default MineAnvil requires `MINEANVIL_JAVA_PATH`
  - For development only, `MINEANVIL_ALLOW_PATH_JAVA=1` enables PATH lookup

Implementation:

- `electron/src/main/java.ts` → `resolveAndValidateJavaAtStartup()`
- `electron/src/main/main.ts` shows the blocking error dialog and exits.

### During Minecraft launch

During launch, MineAnvil prefers the managed runtime and will fall back to PATH Java if needed:

- `electron/src/main/runtime/runtime.ts` → `resolveJavaRuntimePreferManaged()`

If neither the managed runtime nor PATH Java works, the operation fails with an error explaining both failures.


