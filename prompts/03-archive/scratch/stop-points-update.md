You are updating STOP_POINTS.md.

BOOT
Follow /.context/BOOT_PROMPT.md.
If any instruction conflicts with 00-guardrails.md, guardrails win.
Do NOT modify any item already marked [done].

TASK
Update STOP_POINTS.md based only on the new Windows validation evidence.

REQUIREMENTS
1) Check only items that are provably complete based on:
   - docs/SP1.1-windows-validation.md
   - docs/SP1.2-windows-repeatability-report.md
2) Do NOT check “Minecraft ownership is verified” unless the app is allow-listed and ownershipState is OWNED.
3) Do NOT unlock Layer 2.

FILES TO CHANGE
- docs/STOP_POINTS.md

OUTPUT
- Exact diff only.
