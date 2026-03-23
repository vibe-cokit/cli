import { basename, join, relative } from 'path'
import { mkdir, readdir, readFile, writeFile } from 'fs/promises'
import {
  OPENCODE_AGENT_DESCRIPTIONS,
  OPENCODE_COMMAND_AGENT_MAP,
  OPENCODE_COMMAND_ROOTS,
  OPENCODE_WORKFLOW_FILES,
} from './opencode-constants'

type OpenCodeCommand = {
  description: string
  template: string
  agent?: string
  subtask?: true
}

type OpenCodeConfig = {
  $schema: string
  default_agent: 'build'
  share: 'manual'
  autoupdate: 'notify'
  instructions: string[]
  watcher: { ignore: string[] }
  permission: { bash: Record<string, string> }
  agent: { plan: { permission: { edit: 'deny'; bash: 'deny' } } }
  command: Record<string, OpenCodeCommand>
}

const SQL_CLI_BLOCK = `## CLI

Resolve \`TEXT_TO_SQL_SCRIPT\` to the first existing path among:

- \`.opencode/skills/text-to-sql/scripts/text-to-sql.js\`
- \`$HOME/.config/opencode/skills/text-to-sql/scripts/text-to-sql.js\`
- \`$HOME/.claude/skills/text-to-sql/scripts/text-to-sql.js\`
- \`$HOME/.agents/skills/text-to-sql/scripts/text-to-sql.js\`

`

export async function buildOpenCodeKit(sourceDir: string, outputDir: string = sourceDir) {
  const commandsDir = join(sourceDir, 'commands', 'vk')
  const agentsDir = join(sourceDir, 'agents')
  const targetAgentsDir = join(outputDir, '.opencode', 'agents')
  const targetDocsDir = join(outputDir, 'docs', 'opencode')

  await mkdir(targetAgentsDir, { recursive: true })
  await mkdir(targetDocsDir, { recursive: true })

  const commandFiles = await listMarkdownFiles(commandsDir)
  const agentFiles = await listMarkdownFiles(agentsDir)
  const commands: Record<string, OpenCodeCommand> = {}

  for (const file of agentFiles) {
    const raw = await readFile(file, 'utf8')
    const { body } = splitFrontmatter(raw)
    const name = basename(file, '.md')
    const content = `${buildAgentFrontmatter(name)}${rewriteCommon(body).trimStart()}`
    await writeFile(join(targetAgentsDir, `${name}.md`), withTrailingNewline(content))
  }

  for (const file of commandFiles) {
    const raw = await readFile(file, 'utf8')
    const { frontmatter, body } = splitFrontmatter(raw)
    const relativePath = relative(commandsDir, file).replaceAll('\\', '/')
    const name = `vk:${relativePath.replace(/\.md$/, '').replaceAll('/', ':')}`
    const command: OpenCodeCommand = {
      description: sanitizeDescription(getFrontmatterValue(frontmatter, 'description') || name),
      template: finalizeCommandTemplate(name, rewriteCommon(body).trim()),
    }
    const agent = OPENCODE_COMMAND_AGENT_MAP.get(name)
    if (agent) {
      command.agent = agent
      command.subtask = true
    }
    commands[name] = command
  }

  for (const workflowFile of OPENCODE_WORKFLOW_FILES) {
    const raw = await readFile(join(sourceDir, 'workflows', workflowFile), 'utf8')
    await writeFile(join(targetDocsDir, workflowFile), withTrailingNewline(rewriteCommon(raw)))
  }

  await Promise.all([
    writeFile(join(outputDir, 'AGENTS.md'), withTrailingNewline(buildAgentsMd())),
    writeFile(join(outputDir, 'README.md'), withTrailingNewline(buildReadme(commandFiles.length, agentFiles.length))),
    writeFile(join(outputDir, '.gitignore'), buildGitignore()),
    writeFile(join(outputDir, '.markdownlint.json'), await readFile(join(sourceDir, '.markdownlint.json'), 'utf8')),
    writeFile(join(outputDir, 'LICENSE'), await readFile(join(sourceDir, 'LICENSE'), 'utf8')),
    writeFile(join(targetDocsDir, 'README.md'), withTrailingNewline(buildDocsIndex())),
    writeFile(join(targetDocsDir, 'research.md'), withTrailingNewline(buildResearchDoc())),
    writeFile(join(targetDocsDir, 'agent-map.md'), withTrailingNewline(buildMapDoc('Agent Map', agentFiles, sourceDir))),
    writeFile(join(targetDocsDir, 'command-map.md'), withTrailingNewline(buildMapDoc('Command Map', commandFiles, sourceDir))),
    writeFile(join(outputDir, 'opencode.jsonc'), `${JSON.stringify(buildConfig(commands), null, 2)}\n`),
  ])
}

async function listMarkdownFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = await Promise.all(entries.map(async entry => {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) return listMarkdownFiles(fullPath)
    return entry.name.endsWith('.md') ? [fullPath] : []
  }))
  return files.flat().sort()
}

function splitFrontmatter(raw: string) {
  if (!raw.startsWith('---\n')) return { frontmatter: '', body: raw }
  const end = raw.indexOf('\n---\n', 4)
  return end === -1 ? { frontmatter: '', body: raw } : { frontmatter: raw.slice(4, end), body: raw.slice(end + 5) }
}

function getFrontmatterValue(frontmatter: string, key: string) {
  return frontmatter.match(new RegExp(`^${escapeForRegExp(key)}:\\s*(.*)$`, 'm'))?.[1]?.trim() ?? ''
}

function rewriteCommon(text: string) {
  let next = text.replaceAll('\r\n', '\n')
  next = next
    .replaceAll('./.claude/workflows/', './docs/opencode/')
    .replaceAll('./docs/development-rules.md', './docs/opencode/development-rules.md')
    .replaceAll('./.claude/commands/vk/scout.md', './opencode.jsonc')
    .replaceAll('CLAUDE.md', 'AGENTS.md')
    .replaceAll('Slash Commands', 'commands')
    .replaceAll('Slash commands', 'commands')
    .replaceAll('SlashCommand', 'command')
    .replaceAll('slash commands', 'commands')
    .replaceAll('slash command', 'command')
    .replaceAll('`/.claude/skills/*`', '`.opencode/skills/*`, `~/.claude/skills/*`, or `.agents/skills/*`')
    .replaceAll('.claude/skills/*', '.opencode/skills/*, ~/.claude/skills/*, or .agents/skills/*')

  for (const root of OPENCODE_COMMAND_ROOTS) {
    const pattern = new RegExp(`/${escapeForRegExp(root)}(?=[:\\s"'<>())])`, 'g')
    next = next.replace(pattern, `/vk:${root}`)
  }

  return next.replace(/(?<!\/vk:)\/scout\b/g, '/vk:scout')
}

function finalizeCommandTemplate(name: string, template: string) {
  let next = template
  if (name.startsWith('vk:skill:')) next = next.replaceAll('.claude/skills/', '.opencode/skills/')
  if (name === 'vk:sql' || name === 'vk:sql:manage') {
    const heading = name === 'vk:sql' ? '## Workflow' : '## Commands'
    next = next.replace(/## CLI[\s\S]*?## (Workflow|Commands)/, `${SQL_CLI_BLOCK}${heading}`)
      .replaceAll('$SCRIPT', '$TEXT_TO_SQL_SCRIPT')
  }
  if (name === 'vk:sql:optimize' || name === 'vk:sql:setup') {
    next = next.replace(/^# [^\n]+\n\n/, match => `${match}${SQL_CLI_BLOCK}`)
      .replaceAll('node $HOME/.claude/skills/text-to-sql/scripts/text-to-sql.js', 'node $TEXT_TO_SQL_SCRIPT')
  }
  if (name === 'vk:sql:optimize') next = next.replace('/vk:sql init', '/vk:sql:manage init').replace('/vk:sql setup', '/vk:sql:setup')
  if (name === 'vk:sql:setup') {
    next = next
      .replaceAll('$HOME/.claude/skills/text-to-sql/.env', 'the `.env` file that lives next to the resolved `TEXT_TO_SQL_SCRIPT`')
      .replace('Read `DIRECT_URL` from the `the `.env` file that lives next to the resolved `TEXT_TO_SQL_SCRIPT``', 'Read `DIRECT_URL` from the `.env` file that lives next to the resolved `TEXT_TO_SQL_SCRIPT`')
  }
  return next
}

function buildConfig(commands: Record<string, OpenCodeCommand>): OpenCodeConfig {
  return {
    $schema: 'https://opencode.ai/config.json',
    default_agent: 'build',
    share: 'manual',
    autoupdate: 'notify',
    instructions: ['AGENTS.md', 'docs/opencode/development-rules.md', 'docs/opencode/orchestration-protocol.md', 'docs/opencode/primary-workflow.md', 'docs/opencode/documentation-management.md'],
    watcher: { ignore: ['.git/**', 'node_modules/**', 'dist/**', 'build/**', 'coverage/**', '.next/**'] },
    permission: { bash: { '*': 'allow', 'git push*': 'ask', 'git reset --hard*': 'ask', 'rm -rf *': 'ask' } },
    agent: { plan: { permission: { edit: 'deny', bash: 'deny' } } },
    command: commands,
  }
}

function buildAgentFrontmatter(name: string) {
  return `---\ndescription: ${JSON.stringify(OPENCODE_AGENT_DESCRIPTIONS[name] ?? `Specialized ${name} subagent.`)}\nmode: subagent\n---\n\n`
}

function buildAgentsMd() {
  return `# AGENTS.md\n\nThis repository is the OpenCode port of the vibe-cokit Claude Code kit.\n\n- \`.opencode/agents/\` contains the custom OpenCode subagents.\n- \`opencode.jsonc\` contains the command registry and project OpenCode settings.\n- \`docs/opencode/\` replaces the old \`.claude/workflows/\` references.\n\nFollow YAGNI, KISS, and DRY. Prefer the \`/vk:*\` commands for the ported vibe-cokit workflows. Check skills in \`.opencode/skills/*/SKILL.md\`, then \`~/.config/opencode/skills/*/SKILL.md\`, then Claude-compatible fallback locations.\n`
}

function buildReadme(commandCount: number, agentCount: number) {
  return `# vibe-cokit OpenCode kit\n\nOpenCode-native port of the vibe-cokit Claude Code workflow set.\n\n- \`AGENTS.md\` for project rules\n- \`opencode.jsonc\` for OpenCode config and the full \`/vk:*\` command registry\n- \`.opencode/agents/\` with ${agentCount} custom subagents\n- \`docs/opencode/\` with workflow docs, source maps, and porting notes\n\nThis kit currently ports ${commandCount} \`/vk:*\` commands from the Claude Code source kit.\n`
}

function buildDocsIndex() {
  return `# OpenCode Port Docs\n\n- [research.md](research.md)\n- [command-map.md](command-map.md)\n- [agent-map.md](agent-map.md)\n- [development-rules.md](development-rules.md)\n- [orchestration-protocol.md](orchestration-protocol.md)\n- [primary-workflow.md](primary-workflow.md)\n- [documentation-management.md](documentation-management.md)\n`
}

function buildResearchDoc() {
  return `# Research Notes\n\nThis port follows the official OpenCode docs for agents, commands, config, and rules.\n\nSources:\n- https://opencode.ai/docs/\n- https://opencode.ai/docs/agents/\n- https://opencode.ai/docs/commands/\n- https://opencode.ai/docs/config/\n- https://opencode.ai/docs/rules/\n`
}

function buildMapDoc(title: string, files: string[], sourceDir: string) {
  const rows = files.map(file => {
    const relativePath = relative(sourceDir, file).replaceAll('\\', '/')
    const name = relativePath.startsWith('commands/vk/')
      ? `vk:${relativePath.slice('commands/vk/'.length).replace(/\.md$/, '').replaceAll('/', ':')}`
      : basename(file, '.md')
    return `| \`${name}\` | \`${relativePath}\` |`
  }).join('\n')
  return `# ${title}\n\n| OpenCode name | Claude source |\n| --- | --- |\n${rows}\n`
}

function buildGitignore() {
  return ['cache', 'debug', 'file-history', 'ide', 'paste-cache', 'plans', 'plugins', '.gitmodules', 'projects', 'session-env', 'shell-snapshots', 'skills', 'statsig', 'tasks', 'teams', 'telemetry', 'todos', 'history.jsonl', 'settings.json', 'stats-cache.json', '.opencode/.vk.json'].join('\n') + '\n'
}

function sanitizeDescription(text: string) {
  return text.replace(/[^\x20-\x7E]/g, ' ').replace(/\s+/g, ' ').trim()
}

function withTrailingNewline(text: string) {
  return text.endsWith('\n') ? text : `${text}\n`
}

function escapeForRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
