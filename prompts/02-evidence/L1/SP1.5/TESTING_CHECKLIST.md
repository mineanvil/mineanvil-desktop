# SP1.5 Manual Testing Checklist

This checklist provides a step-by-step guide for executing the SP1.5 validation tests in order.

## Pre-Testing Setup

1. [ ] Ensure clean Windows environment ( )
2. [ ] Verify Minecraft Launcher is NOT installed
3. [ ] Verify WinGet is available (for Test 1)
4. [ ] Prepare local installer files:
   - [ ] `.exe` installer file ready
   - [ ] `.msi` installer file ready
5. [ ] Open screenshot capture tool
6. [ ] Open `validation-run.md` for recording results
7. [ ] Open console/log viewer for debugging

---

## Test Execution Order

### Phase 1: Primary Installation Paths

**Test 1: WinGet Path**
- [ ] Execute Test 1 steps
- [ ] Capture screenshots: `01-winget-progress.png`, `02-winget-success.png`
- [ ] Record result in validation-run.md
- [ ] Uninstall Minecraft Launcher (if needed for next tests)

**Test 2: Official Download Fallback**
- [ ] Disable/block WinGet (see validation-run.md for methods)
- [ ] Execute Test 2 steps
- [ ] Capture screenshots: `03-official-download-progress.png`, `04-official-installer-window.png`
- [ ] Record result in validation-run.md
- [ ] Uninstall Minecraft Launcher (if needed)

**Test 3: Store Fallback**
- [ ] Ensure WinGet fails and download unavailable
- [ ] Execute Test 3 steps
- [ ] Capture screenshots: `05-store-deeplink.png`, `06-store-still-waiting.png`, `07-store-recheck.png`
- [ ] Record result in validation-run.md
- [ ] Uninstall Minecraft Launcher (if needed)

---

### Phase 2: Cancel Behavior Validation

**Test 4a: Cancel During Download**
- [ ] Start official download
- [ ] Click Cancel during download
- [ ] Verify clean return to idle
- [ ] Capture screenshot: `13-local-idle-after-cancel.png`
- [ ] Record result

**Test 4b: Cancel During Store Waiting**
- [ ] Start Store path
- [ ] Click Cancel (if available)
- [ ] Verify clean return to idle
- [ ] Record result

**Test 4c: Cancel File Picker**
- [ ] Open "Advanced: Use Local Installer"
- [ ] Open file picker
- [ ] Click Cancel
- [ ] Verify clean return to idle
- [ ] Capture screenshot: `08-local-picker.png` (before cancel)
- [ ] Record result

**Test 4d: Cancel MSI Installer**
- [ ] Start local installer flow
- [ ] Select `.msi` file
- [ ] In MSI installer, click Cancel
- [ ] Verify clean return to idle (no error)
- [ ] Check console for cancellation log
- [ ] Capture screenshots: `09-local-msi-installer.png`, `10-local-msi-cancelled.png`
- [ ] Record result

---

### Phase 3: Local Installer Paths

**Test 5a: Local .exe Installer**
- [ ] Open "Advanced: Use Local Installer"
- [ ] Select `.exe` file
- [ ] Complete installation
- [ ] Verify success
- [ ] Capture screenshots: `08-local-picker.png`, `11-local-exe-installer.png`
- [ ] Record result
- [ ] Uninstall Minecraft Launcher (if needed)

**Test 5b: Local .exe Timeout**
- [ ] Open "Advanced: Use Local Installer"
- [ ] Select `.exe` file
- [ ] Let installer open but DO NOT complete
- [ ] Wait ~120 seconds for timeout
- [ ] Verify "Still waiting" state (NOT error)
- [ ] Verify calm UI, no error message
- [ ] Capture screenshot: `12-local-exe-still-waiting.png`
- [ ] Record result

**Test 5c: Local .msi Installer**
- [ ] Open "Advanced: Use Local Installer"
- [ ] Select `.msi` file
- [ ] Complete installation
- [ ] Verify success
- [ ] Capture screenshots: `08-local-picker.png`, `09-local-msi-installer.png`
- [ ] Record result

---

## Post-Testing

1. [ ] Review all screenshots are captured and named correctly
2. [ ] Review all test results recorded in validation-run.md
3. [ ] Complete UX validation checklist
4. [ ] Complete Safety & Compliance validation checklist
5. [ ] Complete Technical validation checklist
6. [ ] Fill in "Overall Result" section
7. [ ] Fill in "Final SP1.5 Conclusion"
8. [ ] Mark "Ready for STOP_POINTS.md Update" if all tests pass

---

## Screenshot Verification

Verify all required screenshots exist in `screenshots/` folder:

- [ ] `01-winget-progress.png`
- [ ] `02-winget-success.png`
- [ ] `03-official-download-progress.png`
- [ ] `04-official-installer-window.png`
- [ ] `05-store-deeplink.png`
- [ ] `06-store-still-waiting.png`
- [ ] `07-store-recheck.png` (if applicable)
- [ ] `08-local-picker.png`
- [ ] `09-local-msi-installer.png`
- [ ] `10-local-msi-cancelled.png`
- [ ] `11-local-exe-installer.png`
- [ ] `12-local-exe-still-waiting.png`
- [ ] `13-local-idle-after-cancel.png`

---

## Notes for Tester

- Take screenshots at key moments, not just at the end
- Record exact error messages if any failures occur
- Note timing/duration for timeout tests
- Check console logs for cancellation messages (Test 4d)
- Verify file picker dialog title and button labels match requirements
- Verify progress messages are parent-safe and clear

---

## Quick Reference: Expected Behaviors

**File Picker**:
- Title: "Select a Minecraft installer"
- Button: "Use this installer"
- Filters: `.exe` and `.msi` files

**MSI Cancel**:
- Exit codes 1605 or 1602 = clean cancellation
- No error shown
- Returns to idle state

**EXE Timeout**:
- After ~120s, shows "Still waiting for installation to complete..."
- State: "verifying" (NOT "error")
- No error message
- No failure object

**All Cancels**:
- Return to idle state
- No scary errors
- No false success messages


