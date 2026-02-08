# Phase 01: Init Command Handler

> Parent: [plan.md](./plan.md)

## Overview

- **Date**: 2026-02-08
- **Description**: Implement init command logic in `src/commands/init.ts`
- **Priority**: High
- **Implementation Status**: Pending
- **Review Status**: Not started

## Key Insights

- `Bun.$` returns ShellOutput with `.exitCode`, `.text()`, `.stderr` — good for error handling
- `Bun.file().json()` for reading settings.json, `Bun.write()` for writing
- `gh repo clone` works with SSH URLs, respects user's gh auth
- `/tmp` is writable by default, good for temp clone dir
- `crypto.randomUUID()` for unique temp dir names

## Requirements

1. Verify `gh` CLI is available
2. Clone repo to temp directory
3. Copy config folders to `~/.claude/`
4. Copy CLAUDE.md to current working directory
5. Run `claude init` for CLAUDE.md enrichment
6. Update settings.json with version field tracking as current commit id
7. Cleanup temp directory
8. Handle all error cases gracefully

## Architecture

```
src/commands/init.ts
├── initCommand(options)     # Main handler
├── verifyPrerequisites()    # Check gh, claude exist
├── cloneRepo(tmpDir)        # gh repo clone
├── copyConfigFolders(src, dest)  # Copy 5 folders
├── copyClaude(src, dest)    # Copy CLAUDE.md
├── updateSettings(commitSha)     # Merge into settings.json
└── cleanup(tmpDir)          # Remove temp dir
```

## Related Code Files

- `src/commands/init.ts` — NEW: init command handler
- `src/cli.ts` — UPDATE: register init command (Phase 02)

## Implementation Steps

1. Create `src/commands/` directory
2. Create `src/commands/init.ts`:
   - Import `Bun.$`, `Bun.file`, `Bun.write`
   - Define config folders list: `['agents', 'commands', 'hooks', 'prompts', 'workflows']`
   - Define `REPO_URL = 'git@github.com:vibe-cokit/claude-code.git'`
   - Define `CLAUDE_DIR = path.join(os.homedir(), '.claude')`

3. Implement `verifyPrerequisites()`:
   ```ts
   const ghCheck = await Bun.$`which gh`.quiet()
   if (ghCheck.exitCode !== 0) throw new Error('gh CLI not found. Install: https://cli.github.com')
   ```

4. Implement `cloneRepo(tmpDir)`:
   ```ts
   const tmpDir = `/tmp/vibe-cokit-${crypto.randomUUID()}`
   await Bun.$`gh repo clone vibe-cokit/claude-code ${tmpDir}`
   ```

5. Implement `copyConfigFolders(srcDir, destDir)`:
   ```ts
   for (const folder of CONFIG_FOLDERS) {
     await Bun.$`cp -r ${srcDir}/${folder} ${destDir}/`
   }
   ```

6. Implement `copyClaude(srcDir)`:
   ```ts
   await Bun.$`cp ${srcDir}/CLAUDE.md ${process.cwd()}/CLAUDE.md`
   ```

7. Implement claude init trigger:
   ```ts
   await Bun.$`claude init`.quiet()  // May fail if claude not installed — non-fatal
   ```

8. Implement `updateSettings(commitSha)`:
   ```ts
   const settingsPath = path.join(CLAUDE_DIR, 'settings.json')
   let settings = {}
   if (await Bun.file(settingsPath).exists()) {
     settings = await Bun.file(settingsPath).json()
   }
   settings.vibeCokit = { version: commitSha, installedAt: new Date().toISOString() }
   await Bun.write(settingsPath, JSON.stringify(settings, null, 2))
   ```

9. Implement `getCommitSha(tmpDir)`:
   ```ts
   const sha = await Bun.$`git -C ${tmpDir} rev-parse HEAD`.text()
   return sha.trim()
   ```

10. Implement cleanup:
    ```ts
    await Bun.$`rm -rf ${tmpDir}`
    ```

11. Wire everything in main `initCommand()`:
    - Print step progress with console.log
    - Wrap in try/catch for graceful error handling
    - Always cleanup temp dir in finally block

12. Export `initCommand` as default or named export

## Todo

- [ ] Create src/commands/ directory
- [ ] Implement verifyPrerequisites()
- [ ] Implement cloneRepo()
- [ ] Implement copyConfigFolders()
- [ ] Implement copyClaude()
- [ ] Implement claude init trigger
- [ ] Implement updateSettings()
- [ ] Implement getCommitSha()
- [ ] Implement cleanup()
- [ ] Wire main initCommand() with progress output
- [ ] Error handling for all steps

## Success Criteria

- `initCommand()` exports cleanly from `src/commands/init.ts`
- Each step prints progress message
- Errors are caught and reported with actionable messages
- Temp dir always cleaned up (even on error)
- settings.json correctly merged (not overwritten)

## Risk Assessment

- **Medium**: `gh` not authenticated — user needs `gh auth login` first
- **Medium**: SSH key not configured for GitHub — clone may fail
- **Low**: `claude init` not available — handle as non-fatal warning
- **Low**: Permission denied on `~/.claude/` — unlikely but handle

## Security Considerations

- Temp dir uses randomUUID — no predictable paths
- Only copies from known repo — no arbitrary code execution
- settings.json merge preserves existing user data

## Next Steps

→ Phase 02: Register command in cli.ts + write tests
