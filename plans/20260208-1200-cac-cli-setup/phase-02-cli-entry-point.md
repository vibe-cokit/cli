# Phase 02: CLI Entry Point & Command Structure

> Parent: [plan.md](./plan.md)
> Depends on: [Phase 01](./phase-01-package-setup.md)

## Overview

- **Date**: 2026-02-08
- **Description**: Create CLI entry point with cac, configure base commands and help output
- **Priority**: High
- **Implementation Status**: Pending
- **Review Status**: Not started

## Key Insights

- cac API: `cac(name)` → `.command()` → `.option()` → `.action()` → `.help()` → `.version()` → `.parse()`
- Keep CLI bootstrap thin — delegate to command handlers
- `index.ts` stays as library re-export entry; `src/cli.ts` is CLI-specific

## Requirements

1. Create `src/cli.ts` with cac setup
2. Add shebang for Bun execution
3. Configure CLI name as "vibe-cokit"
4. Enable built-in help and version
5. Add default command that shows help
6. Keep `index.ts` as library entry point

## Architecture

```
src/
└── cli.ts          # CLI entry — cac setup, parse args
index.ts            # Library entry (future: re-exports)
```

### CLI Flow
```
User runs `vk` or `vibe-cokit`
  → src/cli.ts
    → cac("vibe-cokit")
    → register global options
    → .help() / .version()
    → .parse()
```

## Related Code Files

- `src/cli.ts` — NEW: CLI bootstrap with cac
- `index.ts` — UPDATE: clean up, prepare as library entry
- `package.json` — bin field points to `src/cli.ts`

## Implementation Steps

1. Create `src/` directory
2. Create `src/cli.ts`:
   ```ts
   #!/usr/bin/env bun
   import cac from 'cac'
   import { version } from '../package.json'

   const cli = cac('vibe-cokit')

   cli
     .command('', 'A toolkit for interacting with Claude Code')
     .action(() => {
       cli.outputHelp()
     })

   cli.help()
   cli.version(version)
   cli.parse()
   ```
3. Update `index.ts` — remove console.log, prepare for library exports
4. Verify: `bun src/cli.ts --help` shows help output
5. Verify: `bun src/cli.ts --version` shows 0.1.0

## Todo

- [ ] Create src/ directory
- [ ] Create src/cli.ts with cac setup
- [ ] Update index.ts
- [ ] Verify help output
- [ ] Verify version output
- [ ] Test `bun link` for global access

## Success Criteria

- `bun src/cli.ts --help` shows formatted help with "vibe-cokit" name
- `bun src/cli.ts --version` outputs "0.1.0"
- Running without args shows help
- Clean, extensible structure for adding commands later

## Risk Assessment

- **Low**: cac API is straightforward
- **Note**: `import { version } from '../package.json'` works in Bun with `allowImportingTsExtensions`

## Security Considerations

- Shebang uses `env bun` — standard practice, no risk

## Next Steps

→ Future: Add feature commands (e.g., `vk init`, `vk config`)
