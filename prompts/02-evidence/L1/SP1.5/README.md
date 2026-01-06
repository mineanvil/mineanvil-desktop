# SP1.5 Validation Evidence

This folder contains all evidence for SP1.5: Local Installer File Picker implementation.

## Files

- **`validation-run.md`** - Complete validation test matrix and results template
- **`TESTING_CHECKLIST.md`** - Step-by-step checklist for executing tests
- **`STOP_POINTS_DIFF.md`** - Diff to apply to STOP_POINTS.md after validation completes
- **`screenshots/`** - Folder for all validation screenshots
- **`logs/`** - Folder for any relevant logs or console output

## Quick Start

1. **Read** `TESTING_CHECKLIST.md` for execution order
2. **Open** `validation-run.md` to record results
3. **Execute** tests in order, capturing screenshots
4. **Fill in** all test results in `validation-run.md`
5. **Review** "Final SP1.5 Conclusion" section
6. **Apply** `STOP_POINTS_DIFF.md` only after all tests pass

## Screenshot Requirements

All screenshots must be captured and stored in `screenshots/` folder with exact naming:

- `01-winget-progress.png`
- `02-winget-success.png`
- `03-official-download-progress.png`
- `04-official-installer-window.png`
- `05-store-deeplink.png`
- `06-store-still-waiting.png`
- `07-store-recheck.png` (if applicable)
- `08-local-picker.png`
- `09-local-msi-installer.png`
- `10-local-msi-cancelled.png`
- `11-local-exe-installer.png`
- `12-local-exe-still-waiting.png`
- `13-local-idle-after-cancel.png`

## Validation Matrix

The validation covers:

1. **WinGet Path** (Primary)
2. **Official Download Fallback** (aka.ms)
3. **Store Fallback**
4. **Cancel Behavior** (all phases)
5. **Local Installer** (.exe and .msi)
6. **Timeout Scenarios** (still waiting state)

## Critical Validations

- ✅ MSI cancel (exit codes 1605/1602) returns cleanly
- ✅ EXE timeout shows "still waiting" (not error)
- ✅ File picker cancel returns to idle
- ✅ All cancel behaviors show no scary errors
- ✅ Local installer launches interactively (no silent flags)

## Status

**Current**: ⏳ Validation framework ready - awaiting manual test execution

**After Tests Complete**: Update this README with final status

