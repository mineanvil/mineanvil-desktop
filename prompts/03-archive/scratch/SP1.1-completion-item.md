You are documenting an existing technical constraint in MineAnvil.

BOOT
Follow /.context/BOOT_PROMPT.md.
If any instruction conflicts with 00-guardrails.md, guardrails win.

STOP POINT
SP1.1 — Clean Machine Launch

TASK
Document the pinned Java runtime version and distribution used by MineAnvil.

AUTHORITATIVE CONTEXT
- Java is already explicitly managed
- Java 17+ is already enforced at runtime
- Managed runtime resolution already exists

REQUIREMENTS
1) Declare the supported Java version(s) explicitly.
2) Declare the preferred distribution (if applicable).
3) State where the runtime is resolved from.
4) State what happens if Java is missing or invalid.

FILES ALLOWED TO CHANGE
- docs/ (choose the most appropriate existing doc or create one new markdown file)

OUT OF SCOPE
- Runtime logic changes
- Installer changes
- UI changes

OUTPUT
- Clear, parent-readable documentation
