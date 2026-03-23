import { test, expect } from 'bun:test'
import { $ } from 'bun'

const CLI = './src/cli.ts'

test('--help shows skills command', async () => {
  const result = await $`bun ${CLI} --help`.text()
  expect(result).toContain('skills')
  expect(result).toContain('Install or update skills from vibe-cokit')
})

test('skills --help shows description and [ref] arg', async () => {
  const result = await $`bun ${CLI} skills --help`.text()
  expect(result).toContain('skills')
  expect(result).toContain('[ref]')
})

test('skills fails gracefully when ref cannot be resolved', async () => {
  const result = await $`bun ${CLI} skills definitely-not-a-real-ref 2>&1`.quiet().nothrow().text()
  expect(result).toContain('Skills setup failed')
})
