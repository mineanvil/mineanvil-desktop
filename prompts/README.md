# MineAnvil Prompts Structure

This directory contains all prompts organized in a strict, deterministic structure.

## Structure

```
prompts/
├─ 00-rules/          # Governance, rules, and definitions
├─ 01-execution/      # Runnable prompts only
├─ 02-evidence/       # Proof and artifacts (never mixed with prompts)
├─ 03-archive/        # Non-runnable or superseded content
└─ README.md          # This file
```

## Categories

### 00-rules/
Governance material that defines how the project works:
- `00-rules.md` - Core development rules
- `01-stop-point-definition.md` - What stop points are
- `02-naming-conventions.md` - Naming rules for this structure

### 01-execution/
Runnable prompts organized by Layer and Stop Point. Only prompts that directly advance a stop point belong here.

Structure: `L<Layer>/SP<Layer>.<Number>/<number>-<descriptive-name>.md`

Example:
- `L1/SP1.1/01-windows-sanity-check.md`
- `L1/SP1.1/02-clean-machine-launch.md`
- `L1/SP1.2/01-deterministic-relaunch.md`

### 02-evidence/
Proof and artifacts from execution. Evidence is never mixed with prompts.

Structure: `L<Layer>/SP<Layer>.<Number>/<type>/`

Example:
- `L1/SP1.1/logs/`
- `L1/SP1.1/screenshots/`
- `L1/SP1.1/json/`

### 03-archive/
Non-runnable or superseded content:
- `scratch/` - Temporary or unclear prompts
- `superseded/` - Replaced by new structure (e.g., old Stage-based prompts)
- `abandoned/` - No longer relevant

## Validation

Every prompt must answer:
1. **What stop point are we on?** - Clear from directory path
2. **What is the next runnable prompt?** - Next numbered file in the stop point directory
3. **Where is the proof?** - In `02-evidence/` under the corresponding stop point

If a prompt cannot answer these questions, it is incorrectly placed.

## Rules

1. Prompts fall into exactly one category: rules, execution, evidence, or archive
2. Only runnable prompts go into execution
3. Evidence is never mixed with prompts
4. Stop Points are directories, not files
5. Ordering is numeric and flat — no creative naming
6. If a file does not clearly advance a stop point, archive it

## Stop Points

The authoritative list of stop points is in `docs/STOP_POINTS.md`. All work must advance exactly one stop point at a time.




