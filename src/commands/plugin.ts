import { execFile } from 'child_process'
import { promisify } from 'util'
import { log } from '../utils/config'

const exec = promisify(execFile)

interface PluginDef {
  name: string
  description: string
  marketplace: string
}

const PLUGINS: Record<string, PluginDef> = {
  context7: {
    name: 'context7',
    description: 'Up-to-date documentation lookup for libraries and frameworks',
    marketplace: 'claude-plugins-official',
  },
  'code-review': {
    name: 'code-review',
    description: 'Automated code review with quality checks',
    marketplace: 'claude-plugins-official',
  },
  'ralph-loop': {
    name: 'ralph-loop',
    description: 'Iterative refinement loop for complex tasks',
    marketplace: 'claude-plugins-official',
  },
  'typescript-lsp': {
    name: 'typescript-lsp',
    description: 'TypeScript language server for type checking and diagnostics',
    marketplace: 'claude-plugins-official',
  },
  'pyright-lsp': {
    name: 'pyright-lsp',
    description: 'Python language server for type checking and diagnostics',
    marketplace: 'claude-plugins-official',
  },
  'gopls-lsp': {
    name: 'gopls-lsp',
    description: 'Go language server for type checking and diagnostics',
    marketplace: 'claude-plugins-official',
  },
  'rust-analyzer-lsp': {
    name: 'rust-analyzer-lsp',
    description: 'Rust language server for type checking and diagnostics',
    marketplace: 'claude-plugins-official',
  },
  'frontend-design': {
    name: 'frontend-design',
    description: 'Frontend design patterns and component generation',
    marketplace: 'claude-plugins-official',
  },
  'security-guidance': {
    name: 'security-guidance',
    description: 'Security best practices and vulnerability detection',
    marketplace: 'claude-plugins-official',
  },
  hookify: {
    name: 'hookify',
    description: 'Manage and create Claude Code hooks',
    marketplace: 'claude-plugins-official',
  },
  'code-simplifier': {
    name: 'code-simplifier',
    description: 'Simplify and refactor complex code',
    marketplace: 'claude-plugins-official',
  },
  'feature-dev': {
    name: 'feature-dev',
    description: 'Feature development workflow with planning and implementation',
    marketplace: 'claude-plugins-official',
  },
  'pr-review-toolkit': {
    name: 'pr-review-toolkit',
    description: 'PR review workflow with checklist and feedback',
    marketplace: 'claude-plugins-official',
  },
  'commit-commands': {
    name: 'commit-commands',
    description: 'Git commit workflow with conventional commits',
    marketplace: 'claude-plugins-official',
  },
}

function listPlugins() {
  console.log('\nAvailable plugins:\n')
  const maxName = Math.max(...Object.keys(PLUGINS).map(k => k.length))
  for (const [key, plugin] of Object.entries(PLUGINS)) {
    console.log(`  ${key.padEnd(maxName + 2)}${plugin.description}`)
  }
  console.log(`\nUsage:`)
  console.log(`  vk plugin install <name> [name2 ...]`)
  console.log(`  vk plugin install --all`)
  console.log(`  vk plugin uninstall <name> [name2 ...]`)
  console.log()
}

async function checkClaude(): Promise<boolean> {
  try { await exec('claude', ['--version']); return true } catch { return false }
}

async function addPlugin(plugin: PluginDef): Promise<boolean> {
  const fullName = `${plugin.name}@${plugin.marketplace}`
  try {
    await exec('claude', ['plugin', 'install', fullName])
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (!msg.includes('already installed')) {
      console.error(`  ✗ Failed to install ${plugin.name}: ${msg}`)
      return false
    }
  }
  try {
    await exec('claude', ['plugin', 'enable', fullName])
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (!msg.includes('already enabled')) {
      console.error(`  ✗ Failed to enable ${plugin.name}: ${msg}`)
      return false
    }
  }
  return true
}

async function removePlugin(name: string): Promise<boolean> {
  const plugin = PLUGINS[name]
  const fullName = plugin ? `${plugin.name}@${plugin.marketplace}` : name
  try {
    await exec('claude', ['plugin', 'uninstall', fullName])
    return true
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('not installed') || msg.includes('not found')) {
      console.log(`  ⚠ ${name} not installed, skipping`)
      return true
    }
    console.error(`  ✗ Failed to uninstall ${name}: ${msg}`)
    return false
  }
}

export async function pluginCommand(action: string | undefined, plugins: string[], options: { all?: boolean }) {
  switch (action) {
    case 'install': return pluginInstallCommand(plugins, options)
    case 'uninstall': return pluginUninstallCommand(plugins)
    default:
      console.log('\nvk plugin — Manage Claude Code plugins\n')
      console.log('  vk plugin install [plugins]     Install plugins')
      console.log('  vk plugin install --all         Install all plugins')
      console.log('  vk plugin uninstall <plugins>   Remove plugins')
      console.log()
  }
}

async function pluginInstallCommand(modules: string[], options: { all?: boolean }) {
  if (modules.length === 0 && !options.all) { listPlugins(); return }

  log('Checking claude CLI...')
  if (!(await checkClaude())) {
    console.error('\n✗ claude CLI not found.\n')
    process.exit(1)
  }

  const targets = options.all ? Object.keys(PLUGINS) : modules
  const invalid = targets.filter(p => !PLUGINS[p])
  if (invalid.length > 0) {
    console.error(`\n✗ Unknown plugins: ${invalid.join(', ')}`)
    console.error(`  Run 'vk plugin install' to see available plugins.\n`)
    process.exit(1)
  }

  let ok = 0, fail = 0
  for (const name of targets) {
    const plugin = PLUGINS[name]
    if (!plugin) continue
    log(`Installing ${plugin.name}...`)
    if (await addPlugin(plugin)) { log(`${plugin.name} ✓`); ok++ } else { fail++ }
  }

  console.log()
  if (ok > 0) console.log(`  ✓ Installed ${ok} plugin${ok > 1 ? 's' : ''}`)
  if (fail > 0) console.log(`  ✗ Failed: ${fail}`)
  if (ok > 0) console.log(`\n  Restart Claude Code to activate.\n`)
}

async function pluginUninstallCommand(modules: string[]) {
  if (modules.length === 0) {
    console.log('\nUsage: vk plugin uninstall <name> [name2 ...]\n')
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
    if (await removePlugin(name)) { log(`${name} ✓`); ok++ } else { fail++ }
  }

  console.log()
  if (ok > 0) console.log(`  ✓ Removed ${ok} plugin${ok > 1 ? 's' : ''}`)
  if (fail > 0) console.log(`  ✗ Failed: ${fail}`)
  if (ok > 0) console.log(`\n  Restart Claude Code to apply.\n`)
}
