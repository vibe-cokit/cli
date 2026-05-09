import { createHash } from 'crypto'
import { existsSync } from 'fs'
import { cp, mkdir, readdir, readFile, stat, writeFile } from 'fs/promises'
import { homedir } from 'os'
import { basename, dirname, extname, join, relative, resolve, sep } from 'path'
import { log } from '../utils/config'
import { getErrorMsg, logError } from '../utils/helpers'

type MigrateOptions = {
  agent?: string[]
  global?: boolean
  yes?: boolean
  dryRun?: boolean
}

type Frontmatter = Record<string, unknown> & {
  name?: string
  description?: string
  model?: string
  tools?: string
}

type PortableItem = {
  name: string
  displayName: string
  description: string
  sourcePath: string
  raw: string
  frontmatter: Frontmatter
  body: string
  segments?: string[]
}

type SkillItem = {
  name: string
  path: string
}

type MigrationPlan = {
  agents: PortableItem[]
  commands: PortableItem[]
  skills: SkillItem[]
  configPath: string | null
  workflowPaths: string[]
  hookPaths: string[]
  global: boolean
}

const SUPPORTED_AGENTS = ['codex'] as const
const home = homedir()

export async function migrateCommand(options: MigrateOptions) {
  try {
    const requestedAgents = options.agent?.length ? options.agent : ['codex']
    const invalid = requestedAgents.filter(agent => !SUPPORTED_AGENTS.includes(agent as (typeof SUPPORTED_AGENTS)[number]))
    if (invalid.length > 0) {
      console.error(`\n✗ Unknown migrate target: ${invalid.join(', ')}`)
      console.error(`  Supported targets: ${SUPPORTED_AGENTS.join(', ')}\n`)
      process.exit(1)
    }

    console.log('\nvibe-cokit migrate\n')

    const plan = await buildMigrationPlan(options.global ?? false)
    if (!hasMigratableItems(plan)) {
      console.error('✗ Nothing to migrate.')
      console.error('  Expected Claude Code files in ./CLAUDE.md, ./.claude/, ~/.claude/, or local vibe-cokit source folders.\n')
      return
    }

    printPlan(plan, options.dryRun ?? false)

    if (options.dryRun) return

    if (!options.yes && process.stdout.isTTY) {
      const ok = await confirm(`Migrate ${countPlanItems(plan)} item(s) to Codex ${plan.global ? 'global' : 'project'} paths? [y/N] `)
      if (!ok) {
        console.log('\nMigration cancelled.\n')
        return
      }
    }

    const results = await migrateToCodex(plan)
    printResults(results)
  } catch (err) {
    logError('migrate', err)
    console.error(`\n✗ Migrate failed: ${getErrorMsg(err)}\n`)
    process.exit(1)
  }
}

async function buildMigrationPlan(global: boolean): Promise<MigrationPlan> {
  log('Discovering Claude Code source files...')

  const agentsDir = findFirstExistingDir([
    join(process.cwd(), '.claude', 'agents'),
    ...workspaceCandidates('claude-code', 'agents'),
    join(home, '.claude', 'agents'),
  ])
  const commandsDir = findFirstExistingDir([
    join(process.cwd(), '.claude', 'commands'),
    ...workspaceCandidates('claude-code', 'commands'),
    join(home, '.claude', 'commands'),
  ])
  const skillsDir = findFirstExistingDir([
    join(process.cwd(), '.claude', 'skills'),
    ...workspaceCandidates('skills'),
    join(home, '.claude', 'skills'),
  ])
  const configPath = findFirstExistingFile([
    join(process.cwd(), 'CLAUDE.md'),
    ...workspaceCandidates('claude-code', 'CLAUDE.md'),
    join(home, '.claude', 'CLAUDE.md'),
  ])
  const workflowsDir = findFirstExistingDir([
    join(process.cwd(), '.claude', 'workflows'),
    ...workspaceCandidates('claude-code', 'workflows'),
    join(home, '.claude', 'workflows'),
  ])
  const hooksDir = findFirstExistingDir([
    join(process.cwd(), '.claude', 'hooks'),
    ...workspaceCandidates('claude-code', 'hooks'),
    join(home, '.claude', 'hooks'),
  ])

  return {
    agents: agentsDir ? await discoverMarkdownItems(agentsDir, 'agent') : [],
    commands: commandsDir ? await discoverMarkdownItems(commandsDir, 'command') : [],
    skills: skillsDir ? await discoverSkills(skillsDir) : [],
    configPath,
    workflowPaths: workflowsDir ? await listFiles(workflowsDir) : [],
    hookPaths: hooksDir ? await listFiles(hooksDir) : [],
    global,
  }
}

function workspaceCandidates(...parts: string[]) {
  const here = import.meta.dir
  const roots = [
    process.cwd(),
    resolve(process.cwd(), '..'),
    resolve(here, '..', '..', '..'),
    resolve(here, '..', '..', '..', '..'),
  ]
  return Array.from(new Set(roots.map(root => join(root, ...parts))))
}

function findFirstExistingDir(paths: string[]) {
  return paths.find(path => {
    try {
      return existsSync(path)
    } catch {
      return false
    }
  }) ?? null
}

function findFirstExistingFile(paths: string[]) {
  return paths.find(path => {
    try {
      return existsSync(path)
    } catch {
      return false
    }
  }) ?? null
}

async function discoverMarkdownItems(root: string, type: 'agent' | 'command') {
  const files = await listFiles(root, file => file.endsWith('.md'))
  const items: PortableItem[] = []

  for (const file of files) {
    const raw = await readFile(file, 'utf-8')
    const parsed = parseFrontmatter(raw)
    const rel = relative(root, file).replaceAll('\\', '/')
    const segments = rel.replace(/\.md$/i, '').split('/').filter(Boolean)
    const name = type === 'command' ? segments.join('/') : basename(file, '.md')
    const displayName = type === 'command' ? segments.join(':') : String(parsed.frontmatter.name ?? name)
    items.push({
      name,
      displayName,
      description: String(parsed.frontmatter.description ?? ''),
      sourcePath: file,
      raw,
      frontmatter: parsed.frontmatter,
      body: parsed.body,
      segments,
    })
  }

  return items.sort((a, b) => a.name.localeCompare(b.name))
}

async function discoverSkills(root: string) {
  const entries = await readdir(root, { withFileTypes: true })
  const skills: SkillItem[] = []
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('.') || entry.name === 'node_modules') continue
    const skillPath = join(root, entry.name)
    if (existsSync(join(skillPath, 'SKILL.md'))) {
      skills.push({ name: entry.name, path: skillPath })
    }
  }
  return skills.sort((a, b) => a.name.localeCompare(b.name))
}

async function listFiles(root: string, filter: (path: string) => boolean = () => true): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true })
  const nested = await Promise.all(entries.map(async entry => {
    const fullPath = join(root, entry.name)
    if (entry.isDirectory()) return listFiles(fullPath, filter)
    return entry.isFile() && filter(fullPath) ? [fullPath] : []
  }))
  return nested.flat().sort()
}

function parseFrontmatter(raw: string): { frontmatter: Frontmatter; body: string } {
  const normalized = raw.replace(/^\uFEFF/, '')
  const match = normalized.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/)
  if (!match || match.index !== 0) return { frontmatter: {}, body: normalized.trimStart() }

  const frontmatter: Frontmatter = {}
  const lines = match[1]?.split(/\r?\n/) ?? []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? ''
    const keyMatch = line.match(/^([A-Za-z][\w-]*)\s*:\s*(.*)$/)
    if (!keyMatch) continue

    const rawKey = keyMatch[1]
    const rawValue = keyMatch[2]
    if (!rawKey || rawValue === undefined) continue

    const key = rawKey === 'argument-hint' ? 'argumentHint' : rawKey
    let value = rawValue.trim()
    if (value === '>-' || value === '>' || value === '|-' || value === '|') {
      const block: string[] = []
      while (i + 1 < lines.length && !lines[i + 1]?.match(/^[A-Za-z][\w-]*\s*:/)) {
        i++
        block.push((lines[i] ?? '').replace(/^\s{2}/, ''))
      }
      value = rawValue.startsWith('|') ? block.join('\n').trim() : block.join(' ').replace(/\s+/g, ' ').trim()
    }
    frontmatter[key] = stripQuotes(value)
  }

  return { frontmatter, body: normalized.slice(match[0].length).trimStart() }
}

function stripQuotes(value: string) {
  return value.replace(/^(['"])(.*)\1$/, '$2')
}

async function migrateToCodex(plan: MigrationPlan) {
  const results: string[] = []
  const codexDir = plan.global ? join(home, '.codex') : join(process.cwd(), '.codex')
  const agentsDir = join(codexDir, 'agents')
  const promptsDir = plan.global ? join(home, '.codex', 'prompts') : join(process.cwd(), '.codex', 'prompts')
  const skillsDir = plan.global ? join(home, '.agents', 'skills') : join(process.cwd(), '.agents', 'skills')
  const hooksDir = join(codexDir, 'hooks')
  const agentsMdPath = join(codexDir, 'AGENTS.md')
  const configTomlPath = join(codexDir, 'config.toml')

  for (const agent of plan.agents) {
    const { filename, content } = convertAgentToCodexToml(agent)
    const target = join(agentsDir, filename)
    await writeText(target, content)
    await upsertCodexAgentConfig(configTomlPath, agent)
    results.push(`agent:${agent.name} -> ${displayPath(target)}`)
  }

  for (const command of plan.commands) {
    const filename = flattenNestedFilename(command.name, extname(command.sourcePath) || '.md')
    const target = join(promptsDir, filename)
    await writeText(target, rewriteClaudeRefs(command.raw))
    results.push(`command:${command.displayName} -> ${displayPath(target)}`)
  }

  for (const skill of plan.skills) {
    const target = join(skillsDir, skill.name)
    await mkdir(dirname(target), { recursive: true })
    await cp(skill.path, target, { recursive: true, force: true })
    results.push(`skill:${skill.name} -> ${displayPath(target)}`)
  }

  const mergedConfig = await buildAgentsMd(plan)
  if (mergedConfig.trim()) {
    await writeText(agentsMdPath, mergedConfig)
    results.push(`config -> ${displayPath(agentsMdPath)}`)
  }

  for (const hook of plan.hookPaths) {
    const target = join(hooksDir, basename(hook))
    await mkdir(dirname(target), { recursive: true })
    await cp(hook, target, { force: true })
    results.push(`hook:${basename(hook)} -> ${displayPath(target)}`)
  }

  return results
}

function convertAgentToCodexToml(item: PortableItem) {
  const lines: string[] = []
  const model = mapModel(item.frontmatter.model)
  const sandboxMode = deriveSandboxMode(item.frontmatter.tools)
  if (model) lines.push(`model = ${JSON.stringify(model.model)}`)
  if (model?.effort) lines.push(`model_reasoning_effort = ${JSON.stringify(model.effort)}`)
  if (sandboxMode) lines.push(`sandbox_mode = ${JSON.stringify(sandboxMode)}`)
  if (lines.length > 0) lines.push('')
  lines.push(`developer_instructions = """\n${escapeTomlMultiline(rewriteClaudeRefs(item.body).trim())}\n"""`)
  return {
    filename: `${toCodexSlug(item.name)}.toml`,
    content: `${lines.join('\n')}\n`,
  }
}

function mapModel(model: unknown): { model: string; effort?: string } | null {
  if (typeof model !== 'string' || !model.trim() || model === 'inherit') return null
  const normalized = model.toLowerCase()
  if (normalized.includes('haiku')) return { model: 'gpt-5.1-codex-mini' }
  if (normalized.includes('opus')) return { model: 'gpt-5.1-codex', effort: 'high' }
  if (normalized.includes('sonnet')) return { model: 'gpt-5.1-codex' }
  return null
}

function deriveSandboxMode(tools: unknown) {
  if (typeof tools !== 'string') return null
  const names = tools.toLowerCase().split(/[,;|]/).map(tool => tool.trim().replace(/\(.*\)$/, ''))
  if (names.some(tool => ['bash', 'write', 'edit', 'multiedit', 'notebookedit', 'apply_patch', 'task'].includes(tool))) {
    return 'workspace-write'
  }
  if (names.some(tool => ['read', 'grep', 'glob', 'ls', 'search'].includes(tool))) return 'read-only'
  return null
}

async function upsertCodexAgentConfig(configPath: string, item: PortableItem) {
  const slug = toCodexSlug(item.name)
  const entry = [
    `[agents.${slug}]`,
    `description = ${JSON.stringify(item.description || item.displayName || item.name)}`,
    `config_file = "agents/${slug}.toml"`,
  ].join('\n')
  const current = existsSync(configPath) ? await readFile(configPath, 'utf-8') : ''
  const pattern = new RegExp(`(?:^|\\n)\\[agents\\.${escapeRegExp(slug)}\\]\\n(?:[^\\[]|\\[(?!agents\\.))*`, 'm')
  const next = pattern.test(current)
    ? current.replace(pattern, `\n${entry}\n`)
    : `${current.trimEnd()}${current.trim() ? '\n\n' : ''}${entry}\n`
  await writeText(configPath, next)
}

async function buildAgentsMd(plan: MigrationPlan) {
  const parts: string[] = []
  if (plan.configPath) {
    parts.push(await readFile(plan.configPath, 'utf-8'))
  }
  for (const workflow of plan.workflowPaths) {
    const title = basename(workflow, extname(workflow))
    parts.push(`\n## ${title}\n\n${await readFile(workflow, 'utf-8')}`)
  }
  return rewriteClaudeRefs(parts.join('\n\n')).trimEnd() + (parts.length > 0 ? '\n' : '')
}

function rewriteClaudeRefs(content: string) {
  return content
    .replace(/\.claude\/agents\//g, '.codex/agents/')
    .replace(/\.claude\/commands\//g, '.codex/prompts/')
    .replace(/\.claude\/hooks\//g, '.codex/hooks/')
    .replace(/\.claude\/skills\//g, '.agents/skills/')
    .replace(/~\/\.claude\/skills\//g, '~/.agents/skills/')
    .replace(/SlashCommand\((\/vk:[^)]+)\)/g, '$1')
    .replace(/\bSlash commands\b/g, 'prompts')
    .replace(/\bslash commands\b/g, 'prompts')
}

function toCodexSlug(name: string) {
  const normalized = name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
  let slug = normalized.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').toLowerCase()
  if (!slug) slug = `agent_${shortHash(name)}`
  if (slug.length > 96) slug = slug.slice(0, 96).replace(/_+$/g, '')
  return slug || `agent_${shortHash(name)}`
}

function shortHash(value: string) {
  return createHash('sha256').update(value).digest('hex').slice(0, 8)
}

function escapeTomlMultiline(value: string) {
  let escaped = value.replace(/\\/g, '\\\\')
  escaped = escaped.replace(/"""/g, '""\\"')
  if (escaped.endsWith('"')) escaped += '\n'
  return escaped
}

function flattenNestedFilename(name: string, extension: string) {
  const normalized = name.replace(/\\/g, '/').replace(/^\/+/, '')
  const withExtension = normalized.toLowerCase().endsWith(extension.toLowerCase())
    ? normalized
    : `${normalized}${extension}`
  return withExtension.replace(/\//g, '-')
}

async function writeText(path: string, content: string) {
  assertPathSafe(path)
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, content, 'utf-8')
}

function assertPathSafe(path: string) {
  const resolved = resolve(path)
  const safeRoots = [resolve(home), resolve(process.cwd())]
  if (!safeRoots.some(root => resolved === root || resolved.startsWith(`${root}${sep}`))) {
    throw new Error(`Unsafe target path outside project/home: ${path}`)
  }
}

function hasMigratableItems(plan: MigrationPlan) {
  return countPlanItems(plan) > 0
}

function countPlanItems(plan: MigrationPlan) {
  return plan.agents.length + plan.commands.length + plan.skills.length + (plan.configPath ? 1 : 0) + plan.workflowPaths.length + plan.hookPaths.length
}

function printPlan(plan: MigrationPlan, dryRun: boolean) {
  const targetRoot = plan.global ? '~/.codex/' : './.codex/'
  console.log(`${dryRun ? 'Dry run: ' : ''}Codex migration plan`)
  console.log(`  Scope:    ${plan.global ? 'global' : 'project'}`)
  console.log(`  Target:   ${targetRoot}`)
  console.log(`  Agents:   ${plan.agents.length}`)
  console.log(`  Commands: ${plan.commands.length}`)
  console.log(`  Skills:   ${plan.skills.length}`)
  console.log(`  Config:   ${plan.configPath ? displayPath(plan.configPath) : 'none'}`)
  console.log(`  Rules:    ${plan.workflowPaths.length}`)
  console.log(`  Hooks:    ${plan.hookPaths.length}`)
  console.log()
}

function printResults(results: string[]) {
  console.log()
  for (const result of results) console.log(`  ✓ ${result}`)
  console.log(`\n✓ Migration complete. Restart Codex to load the migrated config.\n`)
}

function displayPath(path: string) {
  const normalized = path.replaceAll('\\', '/')
  const homeNormalized = home.replaceAll('\\', '/')
  if (normalized.startsWith(`${homeNormalized}/`)) return `~/${normalized.slice(homeNormalized.length + 1)}`
  return normalized
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

async function confirm(prompt: string) {
  process.stdout.write(prompt)
  const answer = await new Promise<string>(resolveAnswer => {
    process.stdin.resume()
    process.stdin.once('data', data => resolveAnswer(String(data)))
  })
  process.stdin.pause()
  return answer.trim().toLowerCase() === 'y' || answer.trim().toLowerCase() === 'yes'
}
