# Phase 01: Package & Dependency Setup

> Parent: [plan.md](./plan.md)

## Overview

- **Date**: 2026-02-08
- **Description**: Install cac, configure package.json with proper metadata and bin field
- **Priority**: High
- **Implementation Status**: Pending
- **Review Status**: Not started

## Key Insights

- `cac` is zero-dependency, ~3.6KB — perfect for lightweight CLI
- Bun supports `bin` field in package.json natively
- Need shebang `#!/usr/bin/env bun` for CLI executables

## Requirements

1. Install `cac` as production dependency
2. Rename package from `cli` to `vibe-cokit`
3. Add `version` field to package.json
4. Configure `bin` field with both `vibe-cokit` and `vk` aliases
5. Set `module` to point to new CLI entry

## Architecture

```
package.json
├── name: "vibe-cokit"
├── version: "0.1.0"
├── bin:
│   ├── vibe-cokit → "./src/cli.ts"
│   └── vk → "./src/cli.ts"
└── dependencies:
    └── cac: "^6"
```

## Related Code Files

- `package.json` — main config, needs update
- `src/cli.ts` — new entry point (created in Phase 02)

## Implementation Steps

1. `bun add cac` — install cac framework
2. Update `package.json`:
   - `name`: `"vibe-cokit"`
   - `version`: `"0.1.0"`
   - `description`: `"A toolkit for interacting with Claude Code"`
   - `bin`: `{ "vibe-cokit": "./src/cli.ts", "vk": "./src/cli.ts" }`
   - Remove `private: true` (needed for bin linking)
3. Keep `index.ts` as library entry, add `src/cli.ts` as CLI entry

## Todo

- [ ] Install cac dependency
- [ ] Update package.json fields (name, version, description, bin)
- [ ] Remove private field

## Success Criteria

- `cac` in dependencies
- `bun run vibe-cokit --version` outputs version
- Both `vibe-cokit` and `vk` bin names configured

## Risk Assessment

- **Low**: cac is stable (used by Vite, 1M+ weekly downloads)
- **Low**: Bun bin support is mature

## Security Considerations

- None for this phase

## Next Steps

→ Phase 02: CLI entry point implementation
