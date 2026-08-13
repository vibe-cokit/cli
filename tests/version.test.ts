import { test, expect } from 'bun:test'
import { $ } from 'bun'

const CLI = './src/cli.ts'

test('--help shows version command', async () => {
  const result = await $`bun ${CLI} --help`.text()
  expect(result).toContain('version')
  expect(result).toContain('Show version and installed commit IDs')
})

test('version shows package version', async () => {
  const result = await $`bun ${CLI} version`.text()
  expect(result).toContain('vibe-cokit v')
  expect(result).toContain('0.1.0')
})

test('version shows config commit status', async () => {
  const result = await $`bun ${CLI} version`.text()
  expect(result).toContain('Config commit:')
})

test('version shows skills commit status', async () => {
  const result = await $`bun ${CLI} version`.text()
  expect(result).toContain('Skills commit:')
})
