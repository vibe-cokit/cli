import { test, expect } from 'bun:test'
import { $ } from 'bun'

const CLI = './src/cli.ts'

test('--help shows init command', async () => {
  const result = await $`bun ${CLI} --help`.text()
  expect(result).toContain('init')
  expect(result).toContain('Initialize vibe-cokit for current project')
})

test('init --help shows init command description', async () => {
  const result = await $`bun ${CLI} init --help`.text()
  expect(result).toContain('init')
})

test('init fails gracefully when gh is not available', async () => {
  // Run with empty PATH so gh/git cannot be found — should fail with error message
  const result = await $`PATH="" bun ${CLI} init 2>&1`.quiet().nothrow().text()
  expect(result).toContain('Init failed')
})
