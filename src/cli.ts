#!/usr/bin/env bun
import cac from 'cac'
import { version } from '../package.json'
import { initCommand } from './commands/init'
import { updateCommand } from './commands/update'
import { skillsCommand } from './commands/skills'
import { helpCommand } from './commands/help'
import { versionCommand } from './commands/version'
import { doctorCommand } from './commands/doctor'
import { doctorFixCommand } from './commands/doctor-fix'
import { mcpCommand } from './commands/mcp'
import { pluginCommand } from './commands/plugin'

const cli = cac('vibe-cokit')

cli
  .command('', 'A toolkit for interacting with Claude Code')
  .action(() => {
    cli.outputHelp()
  })

cli
  .command('init', 'Initialize vibe-cokit for current project')
  .action(initCommand)

cli
  .command('update [ref]', 'Update CLI, config, and skills to latest')
  .alias('upgrade')
  .action(updateCommand)

cli
  .command('skills [ref]', 'Install or update skills from vibe-cokit')
  .action(skillsCommand)

cli
  .command('help', 'Show detailed usage guide')
  .action(helpCommand)

cli
  .command('version', 'Show version and installed commit IDs')
  .action(versionCommand)

cli
  .command('doctor', 'Check vibe-cokit setup health')
  .option('--fix', 'Auto-fix missing config, skills, or CLAUDE.md')
  .action((options: { fix?: boolean }) => {
    if (options.fix) return doctorFixCommand()
    return doctorCommand()
  })

cli
  .command('mcp [action] [...modules]', 'Manage MCP servers (install/uninstall)')
  .option('--all', 'Apply to all available modules')
  .action((action: string | undefined, modules: string[], options: { all?: boolean }) => {
    return mcpCommand(action, modules, options)
  })

cli
  .command('plugin [action] [...plugins]', 'Manage plugins (install/uninstall)')
  .option('--all', 'Apply to all available plugins')
  .action((action: string | undefined, plugins: string[], options: { all?: boolean }) => {
    return pluginCommand(action, plugins, options)
  })

cli.help()
cli.version(version)
cli.parse()
