# SP1.5 Validation Run — Local Installer File Picker

**Date**: [YYYY-MM-DD]  
**Tester**: [Name]  
**Environment**: Windows [Version/Build]  
**MineAnvil Version**: [Version/Commit Hash]

## Environment Information

- **Windows Version**: [e.g., Windows 11 22H2 Build 22621.xxx]
- **WinGet Available**: [ ] Yes [ ] No
- **Microsoft Store Available**: [ ] Yes [ ] No
- **Minecraft Launcher Pre-installed**: [ ] Yes [ ] No
- **Build Info**: 
  - Commit Hash: `[git rev-parse HEAD]`
  - App Version: `[if available]`

## Prerequisites

- [ ] Clean Windows machine (or VM)
- [ ] Minecraft Launcher NOT installed (for installation tests)
- [ ] WinGet available (for Test 1)
- [ ] Microsoft Store available (for Test 3)
- [ ] Local `.exe` installer file available (for Test 5)
- [ ] Local `.msi` installer file available (for Test 5)
- [ ] Screenshot capture tool ready

---

## Test 1: WinGet Path (Primary)

**Preconditions**: WinGet is available, Minecraft Launcher not installed

**Steps**:
1. Launch MineAnvil
2. Verify app detects launcher is missing
3. Verify "Install Minecraft" button appears
4. Click "Install Minecraft"
5. Observe progress states:
   - [ ] "Preparing" appears
   - [ ] "Downloading" appears
   - [ ] "Installing" appears
   - [ ] "Verifying" appears
6. Verify "Cancel" button is available during installation
7. Wait for installation to complete
8. Verify launcher is detected after installation
9. Verify "Install Minecraft" button disappears

**Screenshots Required**:
- `screenshots/01-winget-progress.png` - Progress UI showing download/install states
- `screenshots/02-winget-success.png` - Final success state with launcher detected

**Result**: [ ] PASS [ ] FAIL

**Notes**:
```
[Record any observations, timing, or issues]
```

---

## Test 2: Official Microsoft Download Fallback (aka.ms)

**Preconditions**: WinGet unavailable or forced failure

**How to Simulate WinGet Unavailable**:
- Option A: Temporarily rename `winget.exe` in system PATH (requires admin)
- Option B: Use a machine without WinGet installed
- Option C: Block WinGet via firewall/group policy (if available)

**Steps**:
1. Ensure WinGet is unavailable (using method above)
2. Launch MineAnvil
3. Verify app detects launcher is missing
4. Click "Install Minecraft"
5. Verify WinGet path fails gracefully
6. Observe fallback to official download:
   - [ ] "Preparing to download the official installer..." appears
   - [ ] "Downloading the official installer..." appears with progress
   - [ ] Download completes
7. Verify interactive installer window opens (MSIX installer)
8. Complete installation in the installer UI
9. Verify MineAnvil detects installation completion
10. Verify temp download file is cleaned up

**Screenshots Required**:
- `screenshots/03-official-download-progress.png` - Download progress UI
- `screenshots/04-official-installer-window.png` - Installer window opened

**Result**: [ ] PASS [ ] FAIL

**Notes**:
```
[Record download speed, file size, temp cleanup verification]
```

---

## Test 3: Microsoft Store Fallback

**Preconditions**: WinGet fails AND download path not used or not available

**How to Simulate**:
- Option A: Let WinGet fail, then block/disable download path
- Option B: Use a machine where download fails (network issues, etc.)
- Option C: Manually trigger Store path (if UI option exists)

**Steps**:
1. Ensure WinGet fails and download path unavailable
2. Launch MineAnvil
3. Click "Install Minecraft"
4. Verify Store deep-link opens:
   - [ ] Microsoft Store opens
   - [ ] Minecraft Launcher page is displayed
5. Verify MineAnvil shows "Waiting for installation to complete..."
6. Verify polling is non-blocking (UI remains responsive)
7. If timeout occurs, verify "Still waiting for installation to complete..." appears
8. Verify "Recheck now" functionality works (if implemented)
9. Complete installation in Store
10. Verify MineAnvil detects installation

**Screenshots Required**:
- `screenshots/05-store-deeplink.png` - Store opened with Minecraft Launcher page
- `screenshots/06-store-still-waiting.png` - "Still waiting" UI state
- `screenshots/07-store-recheck.png` - Recheck interaction (if applicable)

**Result**: [ ] PASS [ ] FAIL

**Notes**:
```
[Record polling behavior, timeout handling, recheck functionality]
```

---

## Test 4: Cancel Behavior (All Phases)

### 4a: Cancel During Official Download

**Steps**:
1. Start installation via official download path
2. During download progress, click "Cancel" button
3. Verify:
   - [ ] Download stops
   - [ ] Progress state resets
   - [ ] App returns to idle state
   - [ ] No error message shown
   - [ ] No false success message

**Screenshot**: `screenshots/13-local-idle-after-cancel.png` - Idle state after cancel

**Result**: [ ] PASS [ ] FAIL

---

### 4b: Cancel During Store Waiting

**Steps**:
1. Start installation via Store path
2. While in "Waiting for installation..." state, click "Cancel" (if available)
3. Verify:
   - [ ] Polling stops
   - [ ] App returns to idle state
   - [ ] No error message shown

**Result**: [ ] PASS [ ] FAIL

---

### 4c: Cancel File Picker (Local Installer)

**Steps**:
1. Click "Advanced: Use Local Installer" option
2. File picker dialog opens
3. Click "Cancel" or close the dialog
4. Verify:
   - [ ] File picker closes
   - [ ] App returns to idle state
   - [ ] No error message shown
   - [ ] No scary error dialog

**Screenshot**: `screenshots/08-local-picker.png` - File picker dialog (before cancel)

**Result**: [ ] PASS [ ] FAIL

---

### 4d: Cancel Inside MSI Installer UI (Exit Code 1605/1602)

**Steps**:
1. Start local installer flow
2. Select an `.msi` installer file
3. MSI installer window opens
4. In the MSI installer UI, click "Cancel" button
5. Verify:
   - [ ] MSI installer closes
   - [ ] App returns to idle state cleanly
   - [ ] No error message shown
   - [ ] No false success message
   - [ ] Console log shows: "Local MSI installer cancelled by user (exit code 1605)" or similar

**Screenshots Required**:
- `screenshots/09-local-msi-installer.png` - MSI installer window open
- `screenshots/10-local-msi-cancelled.png` - App state after MSI cancel

**Log Reference**: Check console/logs for cancellation message

**Result**: [ ] PASS [ ] FAIL

**Notes**:
```
[Record exit code observed, verify clean return to idle]
```

---

## Test 5: Local Installer (Advanced Path)

### 5a: Local .exe Installer

**Preconditions**: Have a valid `.exe` installer file available

**Steps**:
1. Click "Advanced: Use Local Installer" option
2. File picker opens
3. Select a `.exe` installer file
4. Verify:
   - [ ] File picker closes
   - [ ] Progress shows "Preparing local installer..."
   - [ ] Progress shows "Opening the installer..."
   - [ ] Installer window opens interactively
5. Complete installation in installer UI
6. Verify:
   - [ ] MineAnvil polls for installation completion
   - [ ] "Waiting for installation to complete..." appears
   - [ ] Installation detected successfully
   - [ ] Success message appears

**Screenshots Required**:
- `screenshots/08-local-picker.png` - File picker with .exe selected
- `screenshots/11-local-exe-installer.png` - .exe installer window open

**Result**: [ ] PASS [ ] FAIL

---

### 5b: Local .exe Installer — Timeout Scenario (Still Waiting)

**Steps**:
1. Start local `.exe` installer flow
2. Select `.exe` file
3. Installer opens
4. Do NOT complete installation immediately
5. Wait for polling timeout (60 attempts × 2s = ~120 seconds)
6. Verify:
   - [ ] Progress shows "Still waiting for installation to complete..."
   - [ ] State is "verifying" (NOT "error")
   - [ ] UI remains in progress state (doesn't show failure)
   - [ ] No error message shown
   - [ ] No failure object in result
   - [ ] User can manually recheck later

**Screenshots Required**:
- `screenshots/12-local-exe-still-waiting.png` - "Still waiting" UI state

**Result**: [ ] PASS [ ] FAIL

**Notes**:
```
[Record timeout duration, verify calm UI, verify no error state]
```

---

### 5c: Local .msi Installer

**Preconditions**: Have a valid `.msi` installer file available

**Steps**:
1. Click "Advanced: Use Local Installer" option
2. File picker opens
3. Select a `.msi` installer file
4. Verify:
   - [ ] File picker closes
   - [ ] Progress shows "Preparing local installer..."
   - [ ] Progress shows "Opening the installer..."
   - [ ] `msiexec` launches interactively (no silent flags)
   - [ ] MSI installer window opens
5. Complete installation in MSI installer UI
6. Verify:
   - [ ] Progress shows "Verifying installation..."
   - [ ] Installation detected successfully
   - [ ] Success message appears

**Screenshots Required**:
- `screenshots/08-local-picker.png` - File picker with .msi selected
- `screenshots/09-local-msi-installer.png` - MSI installer window open

**Result**: [ ] PASS [ ] FAIL

**Notes**:
```
[Verify msiexec command has no /qn or silent flags - check process/command line if possible]
```

---

## Test Results Summary

| Test | Path | Outcome | Screenshots | Notes |
|------|------|---------|-------------|-------|
| 1 | WinGet | [ ] PASS [ ] FAIL | 01, 02 | |
| 2 | Official Download | [ ] PASS [ ] FAIL | 03, 04 | |
| 3 | Store Fallback | [ ] PASS [ ] FAIL | 05, 06, 07 | |
| 4a | Cancel (Download) | [ ] PASS [ ] FAIL | 13 | |
| 4b | Cancel (Store) | [ ] PASS [ ] FAIL | - | |
| 4c | Cancel (Picker) | [ ] PASS [ ] FAIL | 08 | |
| 4d | Cancel (MSI) | [ ] PASS [ ] FAIL | 09, 10 | |
| 5a | Local .exe | [ ] PASS [ ] FAIL | 08, 11 | |
| 5b | Local .exe Timeout | [ ] PASS [ ] FAIL | 12 | |
| 5c | Local .msi | [ ] PASS [ ] FAIL | 08, 09 | |

---

## UX Validation

- [ ] All copy is calm and parent-safe
- [ ] No technical jargon in parent-facing messages
- [ ] No urgency or pressure language
- [ ] Progress messages are clear and understandable
- [ ] Error messages are helpful and non-technical
- [ ] Fallback reasons are explained clearly
- [ ] Cancel actions return cleanly without scary errors
- [ ] "Still waiting" state is calm and non-alarming

---

## Safety & Compliance Validation

- [ ] No Minecraft binaries are distributed by MineAnvil
- [ ] Only official Microsoft distribution paths are used
- [ ] No Microsoft account or ownership checks are bypassed
- [ ] No silent installations without confirmation
- [ ] All operations are visible to parent
- [ ] Local installer path does not infer ownership
- [ ] Local installer path does not claim Store install
- [ ] No installers are bundled or downloaded in local path

---

## Technical Validation

- [ ] No changes to existing Layer 1 behaviour
- [ ] Installation detection does not interfere with SP1.1–SP1.3
- [ ] IPC handlers work correctly
- [ ] Progress events are received in renderer
- [ ] File picker IPC integration works
- [ ] MSI cancel codes (1605, 1602) handled correctly
- [ ] EXE timeout returns stillWaiting (not error)
- [ ] No crashes or errors in console
- [ ] TypeScript compiles without errors

---

## Overall Result

**Status**: [ ] PASS [ ] FAIL [ ] PARTIAL

**Summary**:
```
[Overall assessment of SP1.5 implementation]
```

**Known Issues**:
```
[List any known issues or limitations]
```

**Recommendations**:
```
[Any recommendations for improvement]
```

---

## Final SP1.5 Conclusion

**SP1.5 Status**: [ ] ✅ COMPLETE [ ] ❌ INCOMPLETE

**Reasoning**:
```
[Explain why SP1.5 is complete or incomplete based on test results]
```

**Evidence Checklist**:
- [ ] All required screenshots captured and stored
- [ ] All test scenarios executed
- [ ] All cancel behaviors validated
- [ ] All timeout scenarios validated
- [ ] Logs reviewed (if applicable)
- [ ] No blocking defects identified
- [ ] UX validation passed
- [ ] Safety & compliance validation passed
- [ ] Technical validation passed

**Ready for STOP_POINTS.md Update**: [ ] Yes [ ] No
