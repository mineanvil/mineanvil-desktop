# Stop Point Definition

This document defines what a Stop Point is and how it is used in MineAnvil development.

## What is a Stop Point?

A Stop Point is a checkpoint in the development process. Each Stop Point represents a specific, measurable milestone that must be completed before proceeding to the next.

## Structure

Stop Points are organized by:
- **Layer**: High-level functional area (e.g., Layer 1: Ownership & Launch Control)
- **Stop Point Number**: Sequential identifier within a layer (e.g., SP1.1, SP1.2)

## Authority

The authoritative list of Stop Points is maintained in `docs/STOP_POINTS.md`. This file is the scoreboard - progress is real only when items in that file are checked off.

## Rules

1. All work must advance exactly one stop point at a time
2. If it is not reflected in STOP_POINTS.md, it is not complete
3. No work on a higher layer is permitted until all stop points in the current layer are complete
4. Never modify items in STOP_POINTS.md that are already marked [done]

## Stop Point Directories

In the prompts structure, Stop Points are represented as directories:
- `01-execution/L1/SP1.1/` contains execution prompts for Stop Point 1.1
- `01-execution/L1/SP1.2/` contains execution prompts for Stop Point 1.2
- etc.

Each Stop Point directory contains numbered execution prompts that advance that specific stop point.

