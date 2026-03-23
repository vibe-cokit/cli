import { expect, test } from 'bun:test'
import { mkdtemp, cp, readFile, readdir } from 'fs/promises'
import { tmpdir } from 'os'
import { join, resolve } from 'path'
import { buildOpenCodeKit } from '../src/utils/opencode-kit'

test('buildOpenCodeKit materializes OpenCode files from Claude source', async () => {
  const fixtureDir = await mkdtemp(join(tmpdir(), 'vk-opencode-'))
  const sourceDir = resolve(process.cwd(), '..', 'claude-code')

  await cp(sourceDir, fixtureDir, { recursive: true })
  await buildOpenCodeKit(fixtureDir)

  const config = JSON.parse(await readFile(join(fixtureDir, 'opencode.jsonc'), 'utf8')) as { command: Record<string, unknown> }
  const agents = (await readdir(join(fixtureDir, '.opencode', 'agents'))).filter(name => name.endsWith('.md'))
  const researchDoc = await readFile(join(fixtureDir, 'docs', 'opencode', 'research.md'), 'utf8')

  expect(config.command['vk:plan']).toBeDefined()
  expect(config.command['vk:sql']).toBeDefined()
  expect(agents.length).toBeGreaterThan(10)
  expect(researchDoc).toContain('https://opencode.ai/docs/agents/')
})
