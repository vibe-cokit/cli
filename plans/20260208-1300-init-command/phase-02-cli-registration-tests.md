# Phase 02: CLI Registration & Tests

> Parent: [plan.md](./plan.md)
> Depends on: [Phase 01](./phase-01-init-command.md)

## Overview

- **Date**: 2026-02-08
- **Description**: Register init command in cli.ts and write integration tests
- **Priority**: High
- **Implementation Status**: Pending
- **Review Status**: Not started

## Key Insights

- cac `.command('init', 'desc').action(handler)` pattern for registration
- Tests should verify CLI integration, not re-test internal logic
- Use `Bun.$` in tests to invoke CLI as subprocess (same pattern as existing tests)

## Requirements

1. Register `init` command in `src/cli.ts`
2. Write tests verifying command registration and help output
3. Tests for actual init flow (mock-friendly or skip network calls)

## Architecture

```
src/cli.ts          # Register: cli.command('init', ...).action(initCommand)
tests/init.test.ts  # Integration tests
```

## Related Code Files

- `src/cli.ts` — UPDATE: import and register init command
- `src/commands/init.ts` — from Phase 01
- `tests/init.test.ts` — NEW: init command tests
- `tests/cli.test.ts` — existing CLI tests (may need update)

## Implementation Steps

1. Update `src/cli.ts`:
   ```ts
   import { initCommand } from './commands/init'

   cli
     .command('init', 'Initialize vibe-cokit for current project')
     .action(initCommand)
   ```

2. Create `tests/init.test.ts`:
   - Test: `init` appears in help output
   - Test: `init --help` shows init description
   - Test: init fails gracefully when gh not available (mock PATH)
   - Test: init command function is callable

3. Update existing `tests/cli.test.ts` if help output changes (new command listed)

## Todo

- [ ] Register init command in cli.ts
- [ ] Create tests/init.test.ts
- [ ] Update tests/cli.test.ts if needed
- [ ] Verify all tests pass

## Success Criteria

- `bun src/cli.ts --help` shows `init` command
- `bun src/cli.ts init --help` shows init description
- All tests pass with `bun test`
- TypeScript compiles without errors

## Risk Assessment

- **Low**: cac command registration is straightforward
- **Low**: Testing network-dependent code — test command registration, not full flow

## Security Considerations

- None for this phase

## Next Steps

→ Future: Add `vk update` command for upgrading installed config
