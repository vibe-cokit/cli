# Phase 3: CLI Registration

## Context
The command needs to be registered with the `cac` CLI instance to be accessible by users.

## Overview
Update `src/cli.ts` to include the `skills` command and its help description.

## Requirements
1. Import `skillsCommand` from `./commands/skills`.
2. Register `.command('skills [ref]', 'Install or update skills from vibe-cokit/skills')`.
3. Link the command to the `skillsCommand` action.

## Architecture
- Declarative CLI definition using `cac`.

## Related code files
- `/data/me/cli/src/cli.ts`

## Implementation Steps
1. Add the import statement.
2. Add the `cli.command` call.

## Todo list
- [ ] Import `skillsCommand` in `src/cli.ts`
- [ ] Add `cli.command('skills [ref]', ...)` registration

## Success Criteria
- Running `vk --help` shows the `skills` command.
- Running `vk skills --help` shows the command details.
