#!/usr/bin/env bun
import cac from 'cac'
import { version } from '../package.json'
import { initCommand } from './commands/init'
import { updateCommand } from './commands/update'

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

cli.help()
cli.version(version)
cli.parse()
