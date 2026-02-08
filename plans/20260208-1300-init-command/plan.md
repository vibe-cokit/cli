# Plan: Init Command for vibe-cokit

**Created**: 2026-02-08
**Status**: Completed
**Priority**: High

## Overview

Implement `vk init` command that bootstraps Claude Code configuration by cloning vibe-cokit/claude-code repo and installing config folders + CLAUDE.md into the user's environment.

## Flow

```
vk init
  → Verify prerequisites (gh, claude CLIs)
  → Clone vibe-cokit/claude-code.git → /tmp/vibe-cokit-<random>
  → Copy agents/, commands/, hooks/, prompts/, workflows/ → ~/.claude/
  → Copy CLAUDE.md → ./CLAUDE.md (current dir)
  → Run `claude init` to enrich CLAUDE.md with project context
  → Read commit SHA from cloned repo
  → Update ~/.claude/settings.json version field with vibeCokit version info
  → Cleanup temp dir
  → Print success
```

## Phases

| # | Phase | Status | File |
|---|-------|--------|------|
| 01 | Init command handler | Done | [phase-01](./phase-01-init-command.md) |
| 02 | CLI registration & tests | Done | [phase-02](./phase-02-cli-registration-tests.md) |

## Technical Decisions

- **Bun.$** for all shell commands (clone, copy, claude init)
- **Bun.file** for reading/writing settings.json
- **gh repo clone** for cloning (not raw git) — consistent with GitHub ecosystem
- **Overwrite strategy**: Copy with overwrite for config folders (user gets latest)
- **CLAUDE.md**: Overwrite — `claude init` re-enriches after copy
- **settings.json**: Merge — only update `vibeCokit` key, preserve user settings

## Out of Scope

- Update/upgrade command (future: `vk update`)
- Selective folder sync
- Interactive prompts for conflict resolution
- Rollback mechanism
