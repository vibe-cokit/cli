#!/usr/bin/env bun
import { $ } from 'bun'
import { homedir } from 'os'
import { join } from 'path'

const REPO = 'vibe-cokit/claude-code'
const CLAUDE_DIR = join(homedir(), '.claude')
const CONFIG_FOLDERS = ['agents', 'commands', 'hooks', 'prompts', 'workflows'] as const

function log(step: string) {
  console.log(`  → ${step}`)
}

async function verifyPrerequisites() {
  const gh = await $`which gh`.quiet().nothrow()
  if (gh.exitCode !== 0) {
    throw new Error('gh CLI not found. Install: https://cli.github.com')
  }
}

async function cloneRepo(tmpDir: string) {
  const result = await $`gh repo clone ${REPO} ${tmpDir}`.quiet().nothrow()
  if (result.exitCode !== 0) {
    throw new Error(`Failed to clone repo: ${result.stderr.toString().trim()}`)
  }
}

async function copyConfigFolders(srcDir: string) {
  await $`mkdir -p ${CLAUDE_DIR}`.quiet()
  for (const folder of CONFIG_FOLDERS) {
    const src = join(srcDir, folder)
    const exists = await Bun.file(join(src, '.')).exists().catch(() => false)
    // Use cp -r to copy if folder exists in source
    const check = await $`test -d ${src}`.quiet().nothrow()
    if (check.exitCode === 0) {
      await $`cp -r ${src} ${CLAUDE_DIR}/`.quiet()
      log(`Copied ${folder}/`)
    }
  }
}

async function copyClaudeMd(srcDir: string) {
  const src = join(srcDir, 'CLAUDE.md')
  const dest = join(process.cwd(), 'CLAUDE.md')
  const check = await $`test -f ${src}`.quiet().nothrow()
  if (check.exitCode === 0) {
    await $`cp ${src} ${dest}`.quiet()
  }
}

async function runClaudeInit() {
  const result = await $`claude init`.quiet().nothrow()
  if (result.exitCode !== 0) {
    console.log('  ⚠ claude CLI not available, skipping CLAUDE.md enrichment')
    return false
  }
  return true
}

async function getCommitSha(tmpDir: string): Promise<string> {
  const sha = await $`git -C ${tmpDir} rev-parse HEAD`.text()
  return sha.trim()
}

async function updateSettings(commitSha: string) {
  const settingsPath = join(CLAUDE_DIR, 'settings.json')
  let settings: Record<string, unknown> = {}

  const file = Bun.file(settingsPath)
  if (await file.exists()) {
    settings = await file.json()
  }

  settings.version = commitSha
  await Bun.write(settingsPath, JSON.stringify(settings, null, 2))
}

async function cleanup(tmpDir: string) {
  await $`rm -rf ${tmpDir}`.quiet().nothrow()
}

export async function initCommand() {
  const tmpDir = `/tmp/vibe-cokit-${crypto.randomUUID()}`

  try {
    console.log('\nvibe-cokit init\n')

    log('Verifying prerequisites...')
    await verifyPrerequisites()

    log('Cloning vibe-cokit configuration...')
    await cloneRepo(tmpDir)

    log('Installing config folders to ~/.claude/')
    await copyConfigFolders(tmpDir)

    log('Copying CLAUDE.md to current project...')
    await copyClaudeMd(tmpDir)

    log('Running claude init...')
    await runClaudeInit()

    log('Updating version tracking...')
    const sha = await getCommitSha(tmpDir)
    await updateSettings(sha)

    log('Cleaning up...')
    await cleanup(tmpDir)

    console.log('\n✓ vibe-cokit initialized successfully!')
    console.log(`  Version: ${sha.slice(0, 8)}`)
    console.log(`  Config:  ~/.claude/`)
    console.log(`  Claude:  ./CLAUDE.md\n`)
  } catch (err) {
    await cleanup(tmpDir)
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`\n✗ Init failed: ${msg}\n`)
    process.exit(1)
  }
}
