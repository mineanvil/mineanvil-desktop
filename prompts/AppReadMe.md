# MineAnvil Desktop – Continuation Context (New Chat)

## Project
**MineAnvil Desktop**  
Electron + Vite + React + TypeScript  
Repository: `mineanvil/mineanvil-desktop`

---

## Stage Status

### ✅ Stage 1 – Shell & Plumbing (COMPLETE)
- Electron main, preload, renderer wired
- IPC working
- Vite dev server runs in Docker on macOS
- Electron runtime tested on Windows VM
- TypeScript builds clean
- Preload bridge fixed:
  - `contextIsolation: true`
  - `nodeIntegration: false`
  - sandbox disabled
- External browser OAuth launch confirmed

---

### ✅ Stage 2 – Microsoft OAuth (COMPLETE)
- Microsoft Entra App Registration created (public/native client)
- Client ID loaded via `.env` (`MS_CLIENT_ID`)
- No secrets committed
- OAuth loopback redirect implemented
- Fixed redirect URI used everywhere:

http://127.0.0.1:53682/callback


- Local HTTP listener binds successfully
- OAuth callback received
- Auth code exchanged for tokens successfully
- Tokens stored in memory
- Auth state propagated to renderer
- UI shows:

- Sign-out works correctly

> Prompt 20 (token exchange + auth status) is **NOT needed** anymore.  
> Its intent has already been satisfied by existing code.

---

## Current UI State
- Display name: **(unknown)**
- UUID: **(unknown)**
- Minecraft ownership: **(unknown)**
- Launch plan count: **0**

These are expected because Minecraft/Xbox authentication is not implemented yet.

---

## Known Logs / Warnings
- OAuth is clean and complete.
- Repeated warnings:

minecraft.auth – xbl.authenticate – status: 400

This marks the start of **Stage 3**.
- Vite port `5173` is unrelated to OAuth.
- OAuth loopback port `53682` is correct and fixed.

---

## 🔜 Stage 3 – Next Work (Minecraft Authentication Chain)

This is the next focus area.

### Required sequence:
1. **Xbox Live (XBL) authentication**
 - Use Microsoft OAuth token to request XBL user token
 - Fix current `xbl.authenticate` 400

2. **XSTS token**
 - Exchange XBL token for XSTS authorization token

3. **Minecraft services login**
 - `login_with_xbox` → Minecraft access token

4. **Entitlements check**
 - Confirm Minecraft ownership

5. **Profile fetch**
 - Populate Minecraft UUID and in-game name

Only after this:
- Display name populates
- UUID is known
- Ownership flips true/false
- Launch plan can proceed beyond dry-run

---

## Working Constraints / Style
- One prompt at a time
- Minimal diffs
- No secrets in logs
- Prompts stored in `.prompts/`
- Cursor commits after each prompt
- Windows VM used for runtime testing
- macOS used as authoritative dev + commit machine

---

## Next Prompt (High-Level)
**Stage 3 – Implement Xbox Live authentication (fix `xbl.authenticate` 400)**

This is the correct next unit of work.



