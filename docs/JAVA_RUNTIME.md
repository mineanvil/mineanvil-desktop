# MineAnvil Java Runtime (Pinned & Managed)

MineAnvil launches **Minecraft: Java Edition**, which requires a compatible Java runtime.

This document describes exactly what MineAnvil expects and how it resolves Java.

---

## Supported Java versions

- **Minimum supported**: **Java 17** (MineAnvil blocks anything older).
- **Recommended / preferred (managed runtime)**: **Java 21.x** on Windows x64.

Notes:

- MineAnvil’s startup validator currently checks the **Java major version** (e.g. 17, 21). It does **not** enforce a specific minor/patch at startup.

---

## Preferred distribution (managed runtime)

On Windows x64, MineAnvil prefers to use a **managed** runtime pinned to:

- **Vendor**: `temurin` (Eclipse Adoptium / Temurin)
- **Pinned version (major)**: **21**
- **Platform**: `win-x64`

The managed runtime is pinned in the Electron main process runtime manifest:

- `electron/src/main/runtime/managedRuntime.ts` → `DEFAULT_RUNTIME_MANIFEST`

### What “pinned” means here

MineAnvil treats the managed runtime as **build-time configuration**:

- The manifest’s `downloadUrl` points to the exact runtime archive to install.
- The manifest’s `sha256` must match that archive; MineAnvil verifies it before installing.

Even though the manifest’s `version` is currently just `"21"` (major), the **combination of `downloadUrl` + `sha256` effectively pins the exact minor/patch/build** of the runtime that will be installed.

---

## Where the runtime is resolved from (and where it is installed)

MineAnvil resolves Java in **two different contexts**: at **application startup** (hard gate) and at **Minecraft launch/runtime install time** (managed install).

### At application startup (Electron main)

MineAnvil validates Java early and will block startup if Java is missing or incompatible.

Resolution order:

1) **Explicit `MINEANVIL_JAVA_PATH` (required by default)**
   - MineAnvil requires an explicit Java executable path.

2) **PATH lookup (development escape hatch only)**
   - Only used if `MINEANVIL_ALLOW_PATH_JAVA=1` is set.

Implementation:

- `electron/src/main/java.ts` → `resolveAndValidateJavaAtStartup()`
- `electron/src/main/main.ts` shows a blocking error dialog and exits.

### During Minecraft launch (managed runtime install)

When MineAnvil needs Java for launching Minecraft, it attempts this order:

1) **Managed runtime (preferred, Windows x64)**
   - MineAnvil downloads a runtime ZIP from the manifest’s `downloadUrl`
   - It verifies the download using the manifest’s pinned **SHA-256**
   - It extracts the archive under:
     - `app.getPath("userData")/runtimes/<vendor>/<version>/<platform>/`
   - It then uses Java at:
     - `<installDir>/<javaRelativePath>` (typically `bin/java.exe`)

2) **Fallback: system Java on PATH (last resort)**
   - If the managed runtime install fails for any reason, MineAnvil tries `java.exe` found on `PATH`.
   - Clean-machine expectations for Stop Point 1.1 assume the **managed runtime succeeds**; PATH fallback exists as a last-resort compatibility path, not the intended “clean machine” path.

Notes:

- The managed runtime installer is currently implemented for **Windows only**.
- The runtime ZIP URL and SHA-256 are stored in `DEFAULT_RUNTIME_MANIFEST`.
  - The repo currently includes **placeholder** values (`example.invalid` URL and an all-zero SHA-256). If those placeholders are not replaced for a real build, managed installs will fail fast with a configuration error.

Implementation:

- `electron/src/main/runtime/managedRuntime.ts` → `ensureManagedRuntime()`
- `electron/src/main/runtime/runtime.ts` → `resolveJavaRuntimePreferManaged()`

---

## What happens if Java is missing or invalid

MineAnvil is designed to fail fast and clearly when Java is not usable.

### At application startup (Electron main)

MineAnvil validates Java early and will show a **blocking error dialog** and **exit** if Java is not available or is incompatible:

- If `MINEANVIL_JAVA_PATH` is set but does not exist → startup is blocked.
- If MineAnvil cannot run `java -version` from `MINEANVIL_JAVA_PATH` (including timeouts) → startup is blocked.
- If MineAnvil cannot parse the Java version → startup is blocked.
- If Java is present but **older than 17** → startup is blocked.
- If Java is not configured:
  - Startup requires `MINEANVIL_JAVA_PATH`, unless you explicitly set `MINEANVIL_ALLOW_PATH_JAVA=1` (development escape hatch).

Implementation:

- `electron/src/main/java.ts` → `resolveAndValidateJavaAtStartup()`
- `electron/src/main/main.ts` shows the blocking error dialog and calls `app.exit(1)`.

Logging note:

- Startup logs record **Java version information only** (major + truncated `java -version` output). MineAnvil intentionally does **not** log Java executable paths.

### During Minecraft launch

During launch, MineAnvil prefers the managed runtime and will fall back to PATH Java if needed:

- `electron/src/main/runtime/runtime.ts` → `resolveJavaRuntimePreferManaged()`

If neither the managed runtime nor PATH Java works, the operation fails with an error explaining both failures.

Common managed-runtime failure modes include:

- Placeholder / unconfigured `DEFAULT_RUNTIME_MANIFEST` (invalid `downloadUrl` / `sha256`)
- Running on a non-Windows platform (managed install is Windows-only right now)
- Download errors (non-2xx HTTP responses, too many redirects)
- Checksum mismatch
- Extraction failure (`powershell.exe Expand-Archive` failure)
- Extracted archive does not contain the expected `javaRelativePath`
