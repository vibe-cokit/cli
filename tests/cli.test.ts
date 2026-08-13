import { test, expect } from 'bun:test'
import { $ } from 'bun'

const CLI = './src/cli.ts'

test('--version outputs version from package.json', async () => {
  const result = await $`bun ${CLI} --version`.text()
  expect(result).toContain('0.1.0')
})

test('--help shows CLI name and description', async () => {
  const result = await $`bun ${CLI} --help`.text()
  expect(result).toContain('vibe-cokit')
  expect(result).toContain('A toolkit for interacting with Claude Code')
})

test('--help shows available options', async () => {
  const result = await $`bun ${CLI} --help`.text()
  expect(result).toContain('--help')
  expect(result).toContain('--version')
})

test('no args shows help output', async () => {
  const result = await $`bun ${CLI}`.text()
  expect(result).toContain('vibe-cokit')
  expect(result).toContain('Usage:')
})
