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
