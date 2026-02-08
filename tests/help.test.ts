import { test, expect } from 'bun:test'
import { $ } from 'bun'

const CLI = './src/cli.ts'

test('--help shows help command', async () => {
  const result = await $`bun ${CLI} --help`.text()
  expect(result).toContain('help')
  expect(result).toContain('Show detailed usage guide')
})

test('help shows detailed usage with examples', async () => {
  const result = await $`bun ${CLI} help`.text()
  expect(result).toContain('USAGE')
  expect(result).toContain('COMMANDS')
  expect(result).toContain('EXAMPLES')
  expect(result).toContain('PREREQUISITES')
  expect(result).toContain('FILES')
})

test('help shows all available commands', async () => {
  const result = await $`bun ${CLI} help`.text()
  expect(result).toContain('init')
  expect(result).toContain('update')
  expect(result).toContain('skills')
  expect(result).toContain('help')
})
