# Plan: Implement `vk skills` command

Implementation of a `vk skills` command to install and update skills from the `vibe-cokit/skills` repository into `~/.claude/skills/`.

## Status
- Phase 1: Utils Enhancement: ✅ Done
- Phase 2: Skills Command Implementation: ✅ Done
- Phase 3: CLI Registration: ✅ Done
- Phase 4: Verification & Testing: ✅ Done

## Phases

### Phase 1: Utils Enhancement
Extend `src/utils/config.ts` with skills-specific constants and helper functions for copying skill folders and tracking skills version.
- See [phase-01-utils-enhancement.md](phase-01-utils-enhancement.md)

### Phase 2: Skills Command Implementation
Create `src/commands/skills.ts` following the pattern of `init.ts` and `update.ts`. It will handle repo cloning, copying files, and version updates.
- See [phase-02-skills-command.md](phase-02-skills-command.md)

### Phase 3: CLI Registration
Register the `skills` command in `src/cli.ts` using `cac`.
- See [phase-03-cli-registration.md](phase-03-cli-registration.md)

### Phase 4: Verification & Testing
Create `tests/skills.test.ts` to ensure the command works as expected and handles errors gracefully.
- See [phase-04-testing.md](phase-04-testing.md)
