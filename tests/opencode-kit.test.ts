import { expect, test } from 'bun:test'
import { mkdtemp, mkdir, readFile, readdir, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { dirname, join } from 'path'
import { buildOpenCodeKit } from '../src/utils/opencode-kit'

test('buildOpenCodeKit materializes OpenCode files from Claude source', async () => {
  const sourceDir = await mkdtemp(join(tmpdir(), 'vk-opencode-'))

  await Promise.all([
    writeFixtureFile(sourceDir, '.markdownlint.json', '{\n  "default": true\n}\n'),
    writeFixtureFile(sourceDir, 'LICENSE', 'MIT\n'),
    writeFixtureFile(sourceDir, 'agents/planner.md', `# Planner

Read CLAUDE.md and see ./.claude/workflows/primary-workflow.md before using /scout.
`),
    writeFixtureFile(sourceDir, 'agents/text-to-sql.md', `# SQL Agent

Use /.claude/skills/* when available.
`),
    writeFixtureFile(sourceDir, 'commands/vk/plan.md', `---
description: Plan the work
---

# Plan

Check CLAUDE.md before /scout.
`),
    writeFixtureFile(sourceDir, 'commands/vk/sql.md', `---
description: Generate SQL
---

# SQL

## CLI

Old SQL setup

## Workflow

Run node $HOME/.claude/skills/text-to-sql/scripts/text-to-sql.js with $SCRIPT.
`),
    writeFixtureFile(sourceDir, 'workflows/development-rules.md', '# Development Rules\n'),
    writeFixtureFile(sourceDir, 'workflows/documentation-management.md', '# Documentation Management\n'),
    writeFixtureFile(sourceDir, 'workflows/orchestration-protocol.md', '# Orchestration Protocol\n'),
    writeFixtureFile(sourceDir, 'workflows/primary-workflow.md', '# Primary Workflow\n'),
  ])

  await buildOpenCodeKit(sourceDir)

  const config = JSON.parse(await readFile(join(sourceDir, 'opencode.jsonc'), 'utf8')) as {
    command: Record<string, { agent?: string; subtask?: boolean; template: string }>
  }
  const agents = (await readdir(join(sourceDir, '.opencode', 'agents'))).filter(name => name.endsWith('.md'))
  const plannerAgent = await readFile(join(sourceDir, '.opencode', 'agents', 'planner.md'), 'utf8')
  const researchDoc = await readFile(join(sourceDir, 'docs', 'opencode', 'research.md'), 'utf8')

  expect(config.command['vk:plan']).toBeDefined()
  expect(config.command['vk:plan']?.agent).toBe('planner')
  expect(config.command['vk:plan']?.subtask).toBe(true)
  expect(config.command['vk:sql']).toBeDefined()
  expect(config.command['vk:sql']?.agent).toBe('text-to-sql')
  expect(config.command['vk:sql']?.template).toContain('TEXT_TO_SQL_SCRIPT')
  expect(agents.sort()).toEqual(['planner.md', 'text-to-sql.md'])
  expect(plannerAgent).toContain('mode: subagent')
  expect(plannerAgent).toContain('AGENTS.md')
  expect(researchDoc).toContain('https://opencode.ai/docs/agents/')
})

async function writeFixtureFile(rootDir: string, relativePath: string, content: string) {
  const fullPath = join(rootDir, relativePath)
  await mkdir(dirname(fullPath), { recursive: true })
  await writeFile(fullPath, content)
}
