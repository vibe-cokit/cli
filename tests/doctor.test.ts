import { test, expect } from 'bun:test'
import { $ } from 'bun'

const CLI = './src/cli.ts'

test('--help shows doctor command', async () => {
  const result = await $`bun ${CLI} --help`.text()
  expect(result).toContain('doctor')
  expect(result).toContain('Check vibe-cokit setup health')
})

test('doctor shows CLI tools check', async () => {
  const result = await $`bun ${CLI} doctor`.text()
  expect(result).toContain('gh:')
  expect(result).toContain('git:')
  expect(result).toContain('claude:')
})

test('doctor shows config directory check', async () => {
  const result = await $`bun ${CLI} doctor`.text()
  expect(result).toContain('~/.claude/')
})

test('doctor shows version info', async () => {
  const result = await $`bun ${CLI} doctor`.text()
  expect(result).toContain('Config version:')
  expect(result).toContain('Skills version:')
})

test('doctor shows issue summary', async () => {
  const result = await $`bun ${CLI} doctor`.text()
  // Should contain either "All checks passed" or "issue(s) found"
  const hasPass = result.includes('All checks passed')
  const hasIssues = result.includes('issue')
  expect(hasPass || hasIssues).toBe(true)
})
