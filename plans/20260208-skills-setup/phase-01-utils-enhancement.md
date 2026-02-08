# Phase 1: Utils Enhancement

## Context
The `src/utils/config.ts` file contains shared utilities for git operations, file system manipulation, and settings management. We need to add skills-specific logic here to avoid code duplication in the new command.

## Overview
We will add a new repo constant for skills, a utility to copy all subfolders from a source directory to `~/.claude/skills/`, and update the settings utility to handle `skillsVersion`.

## Requirements
1. Define `SKILLS_REPO` as `vibe-cokit/skills`.
2. Define `SKILLS_DIR` as `~/.claude/skills`.
3. Create `copySkillFolders(srcDir: string)` to copy all directories from `srcDir` to `SKILLS_DIR`.
4. Update `updateSettings` to accept an optional field name (defaulting to `version`) or add a specific `updateSkillsVersion` function.
5. Update `cloneRepo` to accept an optional repo string (defaulting to `REPO`).

## Architecture
- Constant-based configuration.
- Promise-based FS operations using `fs/promises`.
- Bun's file API for settings management.

## Related code files
- `/data/me/cli/src/utils/config.ts`

## Implementation Steps
1. Add `SKILLS_REPO` and `SKILLS_DIR` constants.
2. Refactor `cloneRepo` to take `repo` as a parameter.
3. Implement `copySkillFolders` using `readdir` and `cp`.
4. Implement `updateSkillsVersion` similar to `updateSettings`.

## Todo list
- [ ] Add `SKILLS_REPO = 'vibe-cokit/skills'`
- [ ] Add `SKILLS_DIR = join(CLAUDE_DIR, 'skills')`
- [ ] Refactor `cloneRepo(tmpDir: string, repo: string = REPO)`
- [ ] Implement `copySkillFolders`
- [ ] Implement `updateSkillsVersion(sha: string)`

## Success Criteria
- Utilities are available and correctly typed in `src/utils/config.ts`.
- `cloneRepo` can clone any repo.
- `copySkillFolders` correctly overwrites existing skills in `~/.claude/skills/`.
