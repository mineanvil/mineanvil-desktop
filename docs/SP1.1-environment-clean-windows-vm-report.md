# SP1.1 Environment — Clean Windows VM Validation Report

Stop Point: **1.1 — Clean Machine Launch** (Environment Validation)

This report documents a validation run on a **fresh Windows VM** with **no prior MineAnvil state**.

---

## Environment

- **Date/time (local)**:
- **Windows edition/version**:
- **VM provider** (Hyper-V / VirtualBox / VMware / Parallels / other):
- **CPU / RAM / Disk**:
- **Network**: (NAT / bridged / proxy / captive portal / other)
- **Git commit**: (e.g. output of `git rev-parse HEAD`)
- **Node.js version**: (output of `node -v`)
- **NPM version**: (output of `npm -v`)

### Clean-state proof (required)

Before first run, confirm these locations do **not** exist (or are empty):

- **MineAnvil userData**: `%APPDATA%\MineAnvil\`
- **Default instance logs**: `%APPDATA%\MineAnvil\instances\default\logs\`
- **Secrets (encrypted tokens)**: `%APPDATA%\MineAnvil\secrets\`

If any exist, delete `%APPDATA%\MineAnvil\` and re-run this report from the top.

---

## Steps Taken

### 1) Obtain MineAnvil

- **Method**:
  - [ ] Prebuilt artifact/zip
  - [ ] From source repo
- **Details**:

If running from source, follow `BUILDING.md` (Windows section):

- `npm ci`
- `npm run dev:electron`

### 2) First launch

- Launch MineAnvil.
- Observe whether any **manual setup** was required (should be **none**).

Notes:

- MineAnvil uses a stable Electron app name (`MineAnvil`), so userData resolves to `%APPDATA%\MineAnvil\`.
- Main-process logs are persisted to:
  - `%APPDATA%\MineAnvil\instances\default\logs\mineanvil-main.log`

### 3) Microsoft sign-in

- Click sign-in and complete Microsoft OAuth login.
- Record result:
  - [ ] Sign-in succeeded
  - [ ] Sign-in failed (include error shown)

### 4) Ownership check (expected: UNVERIFIED_APP_NOT_APPROVED)

Expected behavior for current development state:

- Ownership state should be **UNVERIFIED_APP_NOT_APPROVED**
- **Launch is blocked**
- Error messaging is **clear** and requires **no manual steps**

Observed:

- **Ownership state shown**:
- **Was launch blocked?**:
- **Exact user-facing error text** (copy/paste):

---

## Observed Results

### UX expectations (must pass)

- **Blocked launch**: confirmed MineAnvil prevents launching Minecraft when ownership is unverified.
- **Clear error**: the message explains what happened and what the user can do next (no jargon).
- **No manual steps**: no registry edits, PATH tweaks, Java installs, or environment fiddling required.

### Logs (must pass)

Locate the main-process log:

- `%APPDATA%\MineAnvil\instances\default\logs\mineanvil-main.log`

Attach:

- A copy of the log file (or paste the relevant excerpt) covering:
  - app startup
  - sign-in attempt
  - ownership check / block

Verify and record:

- **Log file exists**:
- **Log file grows on each run**:
- **No secrets**:
  - [ ] No `access_token`
  - [ ] No `refresh_token`
  - [ ] No `Authorization:` headers
  - [ ] No full OAuth codes / bearer strings

If anything secret-like appears, paste the minimal excerpt and stop the run.

---

## Re-run (no manual setup)

Run MineAnvil **again** without changing anything.

Expected:

- No manual setup
- Same blocked ownership result (until Mojang allow-list enables verification)
- Logs continue to append (no secrets)

Observed:

- **Second run outcome**:
- **Differences vs first run**:

---

## Deviations / Issues

List anything that diverged from expectations:

- **Deviation**:
  - **Impact**:
  - **Evidence** (screenshot/log excerpt):
  - **Notes**:

---

## Conclusion

- **Pass/Fail**:
- **Summary**:


