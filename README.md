# vibe-cokit (vk)

A toolkit for interacting with Claude Code, Antigravity, and OpenCode.

## Install

```bash
bun install -g vibe-cokit
```

## Supported Setup Flows

- `claude-code` - installs the standard Claude Code project kit
- `antigravity` - installs the Antigravity project kit
- `opencode` - installs `AGENTS.md`, `opencode.jsonc`, `.opencode/`, and `docs/opencode/`

## Commands

```bash
vk init                # Initialize vibe-cokit for current project
vk init antigravity    # Install the Antigravity kit in current project
vk init opencode       # Install the OpenCode kit in current project
vk update              # Update CLI + config + skills
vk update antigravity  # Update the Antigravity kit in current project
vk update opencode     # Update the OpenCode kit in current project
vk skills              # Install/update skills
vk version             # Show CLI + installed kit versions
vk doctor              # Health check setup
vk doctor --fix        # Auto-fix setup issues
vk help                # Show detailed usage guide
```

### MCP Servers

```bash
vk mcp install                        # List available MCP modules
vk mcp install serena context7        # Install specific MCP servers
vk mcp install --all                  # Install all MCP servers
vk mcp uninstall serena               # Remove an MCP server
```

Available modules: `serena`, `context7`, `brave-search`, `filesystem`, `github`, `sequential-thinking`, `memory`, `puppeteer`

### Plugins

```bash
vk plugin install                     # List available plugins
vk plugin install context7 code-review # Install specific plugins
vk plugin install --all               # Install all plugins
vk plugin uninstall hookify           # Remove a plugin
```

Available plugins: `context7`, `code-review`, `ralph-loop`, `typescript-lsp`, `pyright-lsp`, `gopls-lsp`, `rust-analyzer-lsp`, `frontend-design`, `security-guidance`, `hookify`, `code-simplifier`, `feature-dev`, `pr-review-toolkit`, `commit-commands`

## Prerequisites

- [gh](https://cli.github.com) — GitHub CLI
- [git](https://git-scm.com) — Git version control
- [claude](https://docs.anthropic.com/en/docs/claude-code) — Claude Code CLI (for Claude setup and mcp/plugin commands)

## Files Created

- `./CLAUDE.md` - project-level Claude config created by `vk init`
- `./opencode.jsonc` - project-level OpenCode config created by `vk init opencode`
- `./.opencode/` - local OpenCode agents and metadata created by `vk init opencode`

## Development

```bash
bun install
bun run build
bun test
```
