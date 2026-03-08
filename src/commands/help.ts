import { version } from '../../package.json'

const HELP_TEXT = `
vibe-cokit v${version} — A toolkit for interacting with Claude Code and OpenCode

USAGE
  vk <command> [options]

COMMANDS
  init              Set up vibe-cokit for the current project
                    Supports claude-code, antigravity, and opencode setup flows
                    OpenCode installs AGENTS.md, opencode.jsonc, .opencode/, and docs/opencode/

  update [agent]    Update CLI or a specific kit (claude-code | antigravity | opencode)
                    Upgrades CLI package via npm, then updates the selected kit when provided
                    OpenCode updates the project-local OpenCode kit files and tracked commit
                    Aliases: upgrade

  skills [ref]      Install or update skills from vibe-cokit skills repo
                    Copies skill folders to ~/.claude/skills/
                    Tracks version separately via skillsVersion in settings.json

  mcp install       Install MCP servers (serena, context7, brave-search, etc.)
  mcp uninstall     Remove MCP servers

  plugin install    Install Claude Code plugins (code-review, typescript-lsp, etc.)
  plugin uninstall  Remove Claude Code plugins

  help              Show this detailed usage guide

  version           Show version and installed commit IDs

  doctor            Check vibe-cokit setup health
  doctor --fix      Auto-fix missing config, skills, or CLAUDE.md

EXAMPLES
  vk init                                  # Initialize vibe-cokit
  vk init opencode                         # Install the OpenCode kit in this project
  vk update                                # Update CLI + config + skills
  vk update opencode                       # Update the project OpenCode kit
  vk skills                                # Install/update all skills
  vk mcp install                           # List available MCP modules
  vk mcp install serena context7           # Install specific MCP servers
  vk mcp install --all                     # Install all MCP servers
  vk mcp uninstall serena                  # Remove an MCP server
  vk plugin install                        # List available plugins
  vk plugin install context7 code-review   # Install specific plugins
  vk plugin install --all                  # Install all plugins
  vk plugin uninstall hookify              # Remove a plugin
  vk doctor                                # Health check setup
  vk doctor --fix                          # Auto-fix setup issues

OPTIONS
  -h, --help        Show brief help
  -v, --version     Show version number

PREREQUISITES
  gh                GitHub CLI (https://cli.github.com)
  git               Git version control

FILES
  ~/.claude/        Config directory (agents, commands, hooks, prompts, workflows)
  ~/.claude/skills/ Skills directory
  ./CLAUDE.md       Project-level Claude config (created by init)
  ./opencode.jsonc  Project OpenCode config (created by init opencode)
`

export function helpCommand() {
  console.log(HELP_TEXT)
}
