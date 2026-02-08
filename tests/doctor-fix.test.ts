import { test, expect } from 'bun:test'
import { $ } from 'bun'

const CLI = './src/cli.ts'

test('doctor --help shows --fix option', async () => {
  const result = await $`bun ${CLI} doctor --help`.text()
  expect(result).toContain('--fix')
  expect(result).toContain('Auto-fix')
})

test('help shows doctor --fix', async () => {
  const result = await $`bun ${CLI} help`.text()
  expect(result).toContain('doctor --fix')
  expect(result).toContain('Auto-fix')
})
