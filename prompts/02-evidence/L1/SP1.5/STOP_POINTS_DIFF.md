# STOP_POINTS.md Update for SP1.5 Completion

**⚠️ IMPORTANT: Apply this diff ONLY after validation evidence is complete**

This diff marks SP1.5 as ✅ COMPLETE after all validation tests pass and evidence is captured.

---

## Instructions

1. Verify all validation tests in `validation-run.md` are marked PASS
2. Verify all required screenshots exist in `screenshots/` folder
3. Verify "Final SP1.5 Conclusion" in `validation-run.md` shows ✅ COMPLETE
4. Only then apply this diff to `docs/STOP_POINTS.md`

---

## Diff to Apply

```diff
--- a/docs/STOP_POINTS.md
+++ b/docs/STOP_POINTS.md
@@ -120,6 +120,7 @@ Definition:
 - [ ] WinGet installation path is implemented
 - [ ] Official installer download fallback (aka.ms) is implemented
 - [ ] Microsoft Store deep-link fallback is implemented
+- [done] Local installer file picker (Advanced, Manual) is implemented
 - [ ] Installation detection works correctly
 - [ ] Progress states are streamed to UI
 - [ ] Cancel functionality works during installation
@@ -127,6 +128,7 @@ Definition:
 - [ ] WinGet path uses official Microsoft package
 - [ ] Official download uses official Microsoft URL (aka.ms)
 - [ ] Store fallback uses official Microsoft Store deep-link
+- [done] Local installer file picker uses Electron dialog.showOpenDialog
 - [ ] All paths verify installation completion
 - [ ] All paths handle errors gracefully
 - [ ] All paths provide clear progress feedback
@@ -134,6 +136,7 @@ Definition:
 - [ ] WinGet installation is interactive (not silent)
 - [ ] Official download installer opens interactively
 - [ ] Store installation requires parent interaction
+- [done] Local installer (.exe/.msi) launches interactively (no silent flags)
 - [ ] No silent installations occur
 - [ ] All installations are visible to parent
 - [ ] Parent can cancel at any time
@@ -141,6 +144,7 @@ Definition:
 - [ ] Confirmation dialog displays warnings about limitations
 - [ ] Official, unmodified MSI installer is used
 - [ ] Checksum verification is performed before execution
+- [done] File picker allows selection of .exe or .msi installer files
 - [ ] Warnings about limited auto-updates and legacy path are displayed
 - [ ] Parent is reminded that Microsoft sign-in is required after install
@@ -148,6 +152,7 @@ Definition:
 - [ ] Single primary button: "Install Minecraft"
 - [ ] Button is visible only when Minecraft is not detected
 - [ ] Button is disabled during installation process
+- [done] "Advanced: Use Local Installer" option is available
 - [ ] Progress states are displayed in plain language
 - [ ] All copy is calm and parent-safe
 - [ ] No technical jargon in parent-facing copy
@@ -155,6 +160,7 @@ Definition:
 - [ ] Fallback reasons are clearly explained
 
 ### Safety & Compliance
+- [done] Local installer path does not infer ownership
+- [done] Local installer path does not claim Store install
 - [ ] Only official Microsoft distribution paths are used
 - [ ] No Minecraft binaries are distributed by MineAnvil
 - [ ] No Microsoft account or ownership checks are bypassed
@@ -162,6 +168,7 @@ Definition:
 - [ ] All checksums are verified before execution
 - [ ] No silent installations without explicit confirmation
 - [ ] No modifications to official installers
+- [done] No installers are bundled or downloaded in local path
 
 ### Parent Control
 - [ ] Installation requires explicit parent confirmation
@@ -172,6 +179,8 @@ Definition:
 - [ ] No hidden or silent operations
 
 ### Error Handling
+- [done] MSI user cancel (exit codes 1605/1602) returns cleanly to idle
+- [done] EXE polling timeout returns "still waiting" state (not error)
 - [ ] All errors are logged and displayed in plain language
 - [ ] WinGet errors trigger Store fallback
 - [ ] Store errors trigger MSI fallback (with confirmation)
@@ -180,6 +189,7 @@ Definition:
 
 ### Technical Constraints
 - [ ] No child-facing UI is introduced
+- [done] Local installer file picker IPC integration works correctly
 - [ ] No changes to existing Layer 1 behaviour
 - [ ] Installation detection does not interfere with SP1.1–SP1.3
 - [ ] No routing changes beyond installation flow
@@ -203,7 +213,8 @@ Definition:
 - [ ] Installing Minecraft without explicit parent confirmation
 
 Evidence / notes:
 - [ ] Planning document: `prompts/01-execution/L1/SP1.5/01-sp1.5-definition.md`
-- [ ] Implementation evidence (when complete)
+- [done] Implementation evidence: `prompts/02-evidence/L1/SP1.5/validation-run.md`
+- [done] Validation screenshots: `prompts/02-evidence/L1/SP1.5/screenshots/`
 
-**Current Status**: ⏳ **SP1.5 is PLANNED** (not yet implemented).
+**Current Status**: ✅ **SP1.5 is COMPLETE** (local installer file picker implemented and validated).
```

---

## What This Diff Does

1. **Marks Local Installer Implementation Items as [done]**:
   - File picker implementation
   - Electron dialog integration
   - Interactive launch (no silent flags)
   - File picker UI option

2. **Marks Safety & Compliance Items as [done]**:
   - Local installer path does not infer ownership
   - Local installer path does not claim Store install
   - No installers bundled/downloaded in local path

3. **Marks Error Handling Items as [done]**:
   - MSI user cancel handling (1605/1602)
   - EXE polling timeout "still waiting" state

4. **Marks Technical Items as [done]**:
   - Local installer file picker IPC integration

5. **Updates Evidence Section**:
   - Marks validation-run.md as complete
   - Marks screenshots folder as complete

6. **Updates Status**:
   - Changes from "PLANNED" to "COMPLETE"
   - Updates description to reflect implementation

---

## Verification Before Applying

Before applying this diff, verify:

- [ ] All tests in `validation-run.md` show PASS
- [ ] All required screenshots exist and are named correctly
- [ ] "Final SP1.5 Conclusion" in validation-run.md shows ✅ COMPLETE
- [ ] No blocking defects identified
- [ ] All cancel behaviors validated
- [ ] All timeout scenarios validated
- [ ] UX validation passed
- [ ] Safety & compliance validation passed
- [ ] Technical validation passed

---

## How to Apply

1. Open `docs/STOP_POINTS.md`
2. Locate the SP1.5 section (around line 120-207)
3. Apply the changes shown in the diff above
4. Save the file
5. Commit with message: "Mark SP1.5 as complete - local installer file picker validated"

---

**DO NOT apply this diff until validation evidence is complete and reviewed.**


