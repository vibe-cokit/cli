# Plan: CAC CLI Setup for vibe-cokit

**Created**: 2026-02-08
**Status**: Completed
**Priority**: High

## Overview

Set up `cac` CLI framework for `vibe-cokit` — a toolkit for interacting with Claude Code. Establish the CLI skeleton with proper binary configuration, version/help commands, and extensible command structure.

## Current State

- Fresh Bun + TypeScript project
- Single `index.ts` with `console.log("Hello via Bun!")`
- No dependencies beyond `@types/bun` and `typescript`
- No CLI framework installed

## Target State

- `cac` installed as CLI framework
- Executable binary `vibe-cokit` (alias `vck`)
- CLI skeleton with help/version built-in
- Extensible command structure ready for feature commands
- Runnable via `bunx vibe-cokit` or `bun link` globally

## Phases

| # | Phase | Status | File |
|---|-------|--------|------|
| 01 | Package & dependency setup | Done | [phase-01](./phase-01-package-setup.md) |
| 02 | CLI entry point & command structure | Done | [phase-02](./phase-02-cli-entry-point.md) |

## Technical Decisions

- **cac** over commander/yargs — lightweight, TypeScript-friendly, used by Vite
- **Bun shebang** (`#!/usr/bin/env bun`) for executable
- **Single entry point** `src/cli.ts` — separating CLI bootstrap from future command modules
- **Flat src structure** — no deep nesting for a CLI tool

## Out of Scope

- Actual feature commands (future work)
- Plugin system
- Config file loading
- Testing setup (separate task)
