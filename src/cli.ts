#!/usr/bin/env bun
import cac from 'cac'
import { version } from '../package.json'
import { initCommand } from './commands/init'
import { updateCommand } from './commands/update'
import { skillsCommand } from './commands/skills'

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
  .command('update [ref]', 'Update vibe-cokit to latest or specific version')
  .alias('upgrade')
  .action(updateCommand)

cli
  .command('skills [ref]', 'Install or update skills from vibe-cokit')
  .action(skillsCommand)

cli.help()
cli.version(version)
cli.parse()
