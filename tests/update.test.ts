import { test, expect } from 'bun:test'
import { $ } from 'bun'

const CLI = './src/cli.ts'

test('--help shows update command', async () => {
  const result = await $`bun ${CLI} --help`.text()
  expect(result).toContain('update')
  expect(result).toContain('Update CLI, config, and skills to latest')
})

test('update --help shows description and [ref] arg', async () => {
  const result = await $`bun ${CLI} update --help`.text()
  expect(result).toContain('update')
  expect(result).toContain('[ref]')
})

test('upgrade alias shows same help as update', async () => {
  const result = await $`bun ${CLI} upgrade --help`.text()
  expect(result).toContain('update')
  expect(result).toContain('[ref]')
})
