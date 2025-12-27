# Create Core Module Boundaries

Read and obey `.prompts/00-rules.md`.

## Task
Create the core engine structure under `electron/src/core/` with NO Electron imports.

Define minimal TypeScript interfaces (no implementations yet) for:

1. AuthService
   - signIn()
   - signOut()
   - getSession()

2. OwnershipService
   - verifyMinecraftJavaOwnership()

3. InstanceService
   - ensureInstance()
   - listInstances()

4. RuntimeService
   - ensureJavaRuntime()

5. LaunchService
   - launch()

6. DiagnosticsService
   - collect()
   - exportBundle()

## Requirements
- Only interfaces and types.
- No real logic.
- No side effects.
- No filesystem access.
- Add JSDoc explaining responsibilities.

## Output
- Create files only under `electron/src/core/`
- Provide clean file structure.
- Do not modify renderer code yet.
