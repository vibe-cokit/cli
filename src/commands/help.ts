import { version } from '../../package.json'

const HELP_TEXT = `
vibe-cokit v${version} — A toolkit for interacting with Claude Code

USAGE
  vk <command> [options]

COMMANDS
  init              Set up vibe-cokit for the current project
                    Clones config repo, copies agents/commands/hooks/prompts/workflows
                    to ~/.claude/, adds CLAUDE.md to current directory, runs claude init

  update [ref]      Update everything: CLI + config + skills
                    Upgrades CLI package via npm, updates config and skills
                    Compares versions with remote, skips if already up-to-date
                    Aliases: upgrade

  skills [ref]      Install or update skills from vibe-cokit skills repo
                    Copies skill folders to ~/.claude/skills/
                    Tracks version separately via skillsVersion in settings.json

  help              Show this detailed usage guide

  version           Show version and installed commit IDs

  doctor            Check vibe-cokit setup health
  doctor --fix      Auto-fix missing config, skills, or CLAUDE.md

EXAMPLES
  vk init                    # Initialize vibe-cokit in current project
  vk update                  # Update CLI + config + skills
  vk update v1.2.0           # Update to specific tag
  vk skills                  # Install/update all skills
  vk skills main             # Install skills from specific branch
  vk version                 # Show version and commit IDs
  vk doctor                  # Health check setup
  vk doctor --fix            # Auto-fix setup issues

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
`

export function helpCommand() {
  console.log(HELP_TEXT)
}
