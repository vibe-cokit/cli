import { test, expect } from 'bun:test'
import { $ } from 'bun'

const CLI = './src/cli.ts'

test('--help shows migrate command', async () => {
  const result = await $`bun ${CLI} --help`.text()
  expect(result).toContain('migrate')
  expect(result).toContain('Migrate vibe-cokit Claude Code config to other agents')
})

test('migrate --help shows codex options', async () => {
  const result = await $`bun ${CLI} migrate --help`.text()
  expect(result).toContain('--agent')
  expect(result).toContain('--global')
  expect(result).toContain('--dry-run')
})

test('migrate codex dry-run discovers source items without writing', async () => {
  const result = await $`bun ${CLI} migrate -a codex -g --dry-run --yes`.text()
  expect(result).toContain('Dry run: Codex migration plan')
  expect(result).toContain('Agents:')
  expect(result).toContain('Commands:')
  expect(result).toContain('Skills:')
})
