import { keys } from 'lodash-es'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { log } from '../utils/config'
import {
  getErrorMsg,
  requireClaude,
  printSummary,
  listRegistry,
  validateTargets,
} from '../utils/helpers'

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

async function addPlugin(plugin: PluginDef): Promise<boolean> {
  const fullName = `${plugin.name}@${plugin.marketplace}`
  try {
    await exec('claude', ['plugin', 'install', fullName])
  } catch (err) {
    const msg = getErrorMsg(err)
    if (!msg.includes('already installed')) {
      console.error(`  ✗ Failed to install ${plugin.name}: ${msg}`)
      return false
    }
  }
  try {
    await exec('claude', ['plugin', 'enable', fullName])
  } catch (err) {
    const msg = getErrorMsg(err)
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
    const msg = getErrorMsg(err)
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
  if (modules.length === 0 && !options.all) {
    listRegistry(PLUGINS, 'Available plugins:', [
      'vk plugin install <name> [name2 ...]',
      'vk plugin install --all',
      'vk plugin uninstall <name> [name2 ...]',
    ])
    return
  }

  log('Checking claude CLI...')
  await requireClaude()

  const targets = options.all ? keys(PLUGINS) : modules
  validateTargets(targets, PLUGINS, 'plugins', 'vk plugin install')

  let ok = 0, fail = 0
  for (const name of targets) {
    const plugin = PLUGINS[name]
    if (!plugin) continue
    log(`Installing ${plugin.name}...`)
    if (await addPlugin(plugin)) { log(`${plugin.name} ✓`); ok++ } else { fail++ }
  }

  printSummary(ok, fail, 'plugin', 'Installed')
}

async function pluginUninstallCommand(modules: string[]) {
  if (modules.length === 0) {
    console.log('\nUsage: vk plugin uninstall <name> [name2 ...]\n')
    return
  }

  log('Checking claude CLI...')
  await requireClaude()

  let ok = 0, fail = 0
  for (const name of modules) {
    log(`Removing ${name}...`)
    if (await removePlugin(name)) { log(`${name} ✓`); ok++ } else { fail++ }
  }

  printSummary(ok, fail, 'plugin', 'Removed')
}
