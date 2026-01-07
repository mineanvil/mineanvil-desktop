# Naming Conventions

This document defines the strict naming conventions for the prompts folder structure.

## Directory Structure

```
prompts/
├─ 00-rules/          # Governance and rules
├─ 01-execution/      # Runnable prompts only
├─ 02-evidence/       # Proof and artifacts (never mixed with prompts)
├─ 03-archive/        # Non-runnable or superseded content
└─ README.md          # Structure documentation
```

## Execution Prompts

Execution prompts are organized by Layer and Stop Point:

```
01-execution/
├─ L1/
│  ├─ SP1.1/
│  │  ├─ 01-windows-sanity-check.md
│  │  ├─ 02-clean-machine-launch.md
│  │  └─ 03-repeatability-runs.md
│  ├─ SP1.2/
│  └─ SP1.3/
```

### Naming Rules

1. **Numeric Prefix**: All execution prompts must have a numeric prefix (01-, 02-, 03-, etc.)
2. **Descriptive Name**: Use kebab-case with clear, descriptive names
3. **Sequential Ordering**: Numbers indicate execution order within a Stop Point
4. **No Creative Naming**: Use predictable, deterministic names

### Examples

- ✅ `01-windows-sanity-check.md`
- ✅ `02-clean-machine-launch.md`
- ✅ `03-repeatability-runs.md`
- ❌ `windows-sanity-check.md` (missing numeric prefix)
- ❌ `SP1.1-windows-check.md` (stop point already in directory path)
- ❌ `Windows_Sanity_Check.md` (wrong case, wrong separator)

## Stop Point Directories

Stop Point directories are named with the pattern: `SP<Layer>.<Number>`

- ✅ `SP1.1/`
- ✅ `SP1.2/`
- ✅ `SP2.1/`
- ❌ `SP1-1/` (wrong separator)
- ❌ `stop-point-1.1/` (wrong format)

## Archive Structure

```
03-archive/
├─ scratch/      # Temporary or unclear prompts
├─ superseded/   # Replaced by new structure
└─ abandoned/    # No longer relevant
```

## Evidence Structure

Evidence is organized by Layer and Stop Point, with subdirectories for different types:

```
02-evidence/
├─ L1/
│  └─ SP1.1/
│     ├─ logs/
│     ├─ screenshots/
│     └─ json/
```

Evidence files are never mixed with prompts.

## Validation

Every prompt must answer:
- What stop point are we on?
- What is the next runnable prompt?
- Where is the proof?

If a prompt cannot answer these questions, it is incorrectly placed.




