#!/usr/bin/env node
const { execFileSync } = require('child_process')
const { resolve } = require('path')

try {
  execFileSync('bun', [resolve(__dirname, '../dist/cli.js'), ...process.argv.slice(2)], {
    stdio: 'inherit'
  })
} catch (err) {
  if (err.status != null) process.exit(err.status)
  console.error('bun is required to run vibe-cokit. Install: https://bun.sh')
  process.exit(1)
}
