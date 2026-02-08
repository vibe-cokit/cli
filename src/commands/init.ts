import { homedir } from 'os'
import { join, resolve } from 'path'
import { mkdir, cp, rm, readdir, stat } from 'fs/promises'
import { execFile } from 'child_process'
import { promisify } from 'util'

const exec = promisify(execFile)

const REPO = 'vibe-cokit/claude-code'
const CLAUDE_DIR = join(homedir(), '.claude')
const CONFIG_FOLDERS = ['agents', 'commands', 'hooks', 'prompts', 'workflows'] as const
const TEMP_DIR = join(homedir(), '.vibe-cokit-tmp')

function log(step: string) {
  console.log(`  → ${step}`)
}

async function verifyPrerequisites() {
  try {
    await exec('gh', ['--version'])
  } catch {
    throw new Error('gh CLI not found. Install: https://cli.github.com')
  }
}

async function cloneRepo(tmpDir: string) {
  try {
    await exec('gh', ['repo', 'clone', REPO, tmpDir])
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new Error(`Failed to clone repo: ${msg}`)
  }
}

async function dirExists(path: string): Promise<boolean> {
  try {
    const s = await stat(path)
    return s.isDirectory()
  } catch {
    return false
  }
}

async function fileExists(path: string): Promise<boolean> {
  try {
    const s = await stat(path)
    return s.isFile()
  } catch {
    return false
  }
}

async function copyConfigFolders(srcDir: string) {
  await mkdir(CLAUDE_DIR, { recursive: true })
  for (const folder of CONFIG_FOLDERS) {
    const src = join(srcDir, folder)
    if (await dirExists(src)) {
      const dest = join(CLAUDE_DIR, folder)
      await cp(src, dest, { recursive: true, force: true })
      log(`Copied ${folder}/`)
    }
  }
}

async function copyClaudeMd(srcDir: string) {
  const src = join(srcDir, 'CLAUDE.md')
  const dest = join(process.cwd(), 'CLAUDE.md')
  if (await fileExists(src)) {
    await cp(src, dest, { force: true })
  }
}

async function runClaudeInit() {
  try {
    await exec('claude', ['init'])
    return true
  } catch {
    console.log('  ⚠ claude CLI not available, skipping CLAUDE.md enrichment')
    return false
  }
}

async function getCommitSha(tmpDir: string): Promise<string> {
  const { stdout } = await exec('git', ['-C', tmpDir, 'rev-parse', 'HEAD'])
  return stdout.trim()
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
  try {
    await rm(tmpDir, { recursive: true, force: true })
  } catch {
    // ignore cleanup errors
  }
}

export async function initCommand() {
  const tmpDir = join(TEMP_DIR, crypto.randomUUID())

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
