You are validating MineAnvil on Windows.

BOOT
Follow /.context/BOOT_PROMPT.md.
If any instruction conflicts with 00-guardrails.md, guardrails win.
Never modify STOP_POINTS.md items marked [done].

STOP POINT
SP1.1 — Clean Machine Launch

TASK
Confirm the Windows dev environment is correct for running MineAnvil.

REQUIREMENTS
1) Identify and report:
   - Windows version
   - Node version
   - npm version
   - Git version
2) Confirm repo installs cleanly:
   - npm ci (or npm install if lockfile policy differs)
3) Confirm the app starts:
   - npm run dev:electron (or the project’s Windows equivalent)
4) Do not change code.

OUTPUT
- A short markdown note under docs/ recording the environment and exact commands used.
