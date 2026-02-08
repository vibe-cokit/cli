# Phase 2: Skills Command Implementation

## Context
The `skills` command is the core of this feature. It allows users to install or update their Claude Code skills from a centralized repository.

## Overview
We will create `src/commands/skills.ts` which implements the logic for cloning the skills repo and installing them locally.

## Requirements
1. Use a temporary directory for cloning.
2. Support an optional `ref` argument for installing specific versions.
3. Verify prerequisites (gh CLI).
4. Clone `vibe-cokit/skills`.
5. Checkout `ref` if provided.
6. Copy all skill folders to `~/.claude/skills/`.
7. Update `skillsVersion` in `settings.json`.
8. Clean up temporary files.

## Architecture
- Functional approach using the `skillsCommand` async function.
- Try-catch block for robust error handling and cleanup.
- Reuses utilities from `src/utils/config.ts`.

## Related code files
- `/data/me/cli/src/commands/skills.ts` (New file)
- `/data/me/cli/src/utils/config.ts`

## Implementation Steps
1. Create `src/commands/skills.ts`.
2. Import necessary utilities.
3. Define `skillsCommand(ref?: string)`.
4. Implement the sequence: Verify -> Clone -> (Checkout) -> Copy -> Update Version -> Cleanup.
5. Add descriptive logging for each step.

## Todo list
- [ ] Create `src/commands/skills.ts`
- [ ] Implement `skillsCommand` logic
- [ ] Add error handling and cleanup
- [ ] Add success/failure console output

## Success Criteria
- Running the command successfully clones the repo and copies files.
- `skillsVersion` is correctly updated in `settings.json`.
- Specific versions can be installed via the `ref` argument.
