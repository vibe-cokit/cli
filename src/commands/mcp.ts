import { execFile } from 'child_process'
import { promisify } from 'util'
import { log } from '../utils/config'

const exec = promisify(execFile)

interface McpModule {
  name: string
  description: string
  command: string
  args: string[]
  env?: Record<string, string>
  envPrompts?: Record<string, string>
  requiresUv?: boolean
}

const MCP_MODULES: Record<string, McpModule> = {
  serena: {
    name: 'serena',
    description: 'Code intelligence — semantic search, symbol navigation, go-to-definition',
    command: 'uvx',
    args: ['--from', 'git+https://github.com/oraios/serena', 'serena-mcp-server'],
    requiresUv: true,
  },
  context7: {
    name: 'context7',
    description: 'Up-to-date documentation for libraries and frameworks',
    command: 'npx',
    args: ['-y', '@upstash/context7-mcp@latest'],
  },
  'brave-search': {
    name: 'brave-search',
    description: 'Web search via Brave Search API',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-brave-search'],
    env: { BRAVE_API_KEY: '' },
    envPrompts: { BRAVE_API_KEY: 'Brave Search API key' },
  },
  filesystem: {
    name: 'filesystem',
    description: 'Read/write/search files on local filesystem',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', '/data'],
  },
  github: {
    name: 'github',
    description: 'GitHub API — repos, issues, PRs, code search',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-github'],
    env: { GITHUB_PERSONAL_ACCESS_TOKEN: '' },
    envPrompts: { GITHUB_PERSONAL_ACCESS_TOKEN: 'GitHub Personal Access Token' },
  },
  'sequential-thinking': {
    name: 'sequential-thinking',
    description: 'Structured step-by-step reasoning for complex problems',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-sequential-thinking'],
  },
  memory: {
    name: 'memory',
    description: 'Long-term memory with knowledge graph for persistent context',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-memory'],
  },
  puppeteer: {
    name: 'puppeteer',
    description: 'Browser automation — navigate, screenshot, interact with web pages',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-puppeteer'],
  },
}

function listModules() {
  console.log('\nAvailable MCP modules:\n')
  const maxName = Math.max(...Object.keys(MCP_MODULES).map(k => k.length))
  for (const [key, mod] of Object.entries(MCP_MODULES)) {
    console.log(`  ${key.padEnd(maxName + 2)}${mod.description}`)
  }
  console.log(`\nUsage:`)
  console.log(`  vk mcp install <module> [module2 ...]`)
  console.log(`  vk mcp install --all`)
  console.log(`  vk mcp uninstall <module> [module2 ...]`)
  console.log()
}

async function checkClaude(): Promise<boolean> {
  try { await exec('claude', ['--version']); return true } catch { return false }
}

async function checkUv(): Promise<boolean> {
  try { await exec('uvx', ['--version']); return true } catch { return false }
}

async function addModule(mod: McpModule): Promise<boolean> {
  const config: Record<string, unknown> = { command: mod.command, args: mod.args }
  if (mod.env) {
    const envConfig: Record<string, string> = {}
    for (const [key, defaultVal] of Object.entries(mod.env)) {
      envConfig[key] = process.env[key] || defaultVal
    }
    config.env = envConfig
  }
  try {
    await exec('claude', ['mcp', 'add-json', mod.name, JSON.stringify(config)])
    return true
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`  ✗ Failed to add ${mod.name}: ${msg}`)
    return false
  }
}

async function removeModule(name: string): Promise<boolean> {
  try {
    await exec('claude', ['mcp', 'remove', name])
    return true
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('not found') || msg.includes('does not exist')) {
      console.log(`  ⚠ ${name} not configured, skipping`)
      return true
    }
    console.error(`  ✗ Failed to remove ${name}: ${msg}`)
    return false
  }
}

export async function mcpCommand(action: string | undefined, modules: string[], options: { all?: boolean }) {
  switch (action) {
    case 'install': return mcpInstallCommand(modules, options)
    case 'uninstall': return mcpUninstallCommand(modules)
    default:
      console.log('\nvk mcp — Manage MCP servers for Claude Code\n')
      console.log('  vk mcp install [modules]     Install MCP servers')
      console.log('  vk mcp install --all         Install all MCP servers')
      console.log('  vk mcp uninstall <modules>   Remove MCP servers')
      console.log()
  }
}

async function mcpInstallCommand(modules: string[], options: { all?: boolean }) {
  if (modules.length === 0 && !options.all) { listModules(); return }

  log('Checking claude CLI...')
  if (!(await checkClaude())) {
    console.error('\n✗ claude CLI not found.\n')
    process.exit(1)
  }

  const targets = options.all ? Object.keys(MCP_MODULES) : modules
  const invalid = targets.filter(m => !MCP_MODULES[m])
  if (invalid.length > 0) {
    console.error(`\n✗ Unknown modules: ${invalid.join(', ')}`)
    console.error(`  Run 'vk mcp install' to see available modules.\n`)
    process.exit(1)
  }

  if (targets.some(m => MCP_MODULES[m]?.requiresUv)) {
    log('Checking uv/uvx...')
    if (!(await checkUv())) {
      console.error('\n✗ uvx not found (required for serena). Install: https://docs.astral.sh/uv/\n')
      process.exit(1)
    }
  }

  for (const name of targets) {
    const mod = MCP_MODULES[name]
    if (!mod) continue
    if (mod.envPrompts) {
      for (const [key, prompt] of Object.entries(mod.envPrompts)) {
        if (!process.env[key] && mod.env && !mod.env[key]) {
          console.log(`  ⚠ ${name}: ${prompt} not set (env: ${key})`)
        }
      }
    }
  }

  let ok = 0, fail = 0
  for (const name of targets) {
    const mod = MCP_MODULES[name]
    if (!mod) continue
    log(`Installing ${mod.name}...`)
    if (await addModule(mod)) { log(`${mod.name} ✓`); ok++ } else { fail++ }
  }

  console.log()
  if (ok > 0) console.log(`  ✓ Installed ${ok} MCP module${ok > 1 ? 's' : ''}`)
  if (fail > 0) console.log(`  ✗ Failed: ${fail}`)
  if (ok > 0) console.log(`\n  Restart Claude Code to activate.\n`)
}

async function mcpUninstallCommand(modules: string[]) {
  if (modules.length === 0) {
    console.log('\nUsage: vk mcp uninstall <module> [module2 ...]\n')
    return
  }

  log('Checking claude CLI...')
  if (!(await checkClaude())) {
    console.error('\n✗ claude CLI not found.\n')
    process.exit(1)
  }

  let ok = 0, fail = 0
  for (const name of modules) {
    log(`Removing ${name}...`)
    if (await removeModule(name)) { log(`${name} ✓`); ok++ } else { fail++ }
  }

  console.log()
  if (ok > 0) console.log(`  ✓ Removed ${ok} MCP module${ok > 1 ? 's' : ''}`)
  if (fail > 0) console.log(`  ✗ Failed: ${fail}`)
  if (ok > 0) console.log(`\n  Restart Claude Code to apply.\n`)
}
