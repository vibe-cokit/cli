import { homedir } from 'os'
import { join } from 'path'
import { mkdir, cp, rm, stat, readdir } from 'fs/promises'
import { execFile } from 'child_process'
import { promisify } from 'util'

const exec = promisify(execFile)

export const REPO = 'vibe-cokit/claude-code'
export const SKILLS_REPO = 'vibe-cokit/skills'
export const CLAUDE_DIR = join(homedir(), '.claude')
export const SKILLS_DIR = join(CLAUDE_DIR, 'skills')
export const CONFIG_FOLDERS = ['agents', 'commands', 'hooks', 'prompts', 'workflows'] as const
export const TEMP_DIR = join(homedir(), '.vibe-cokit-tmp')

export function log(step: string) {
  console.log(`  → ${step}`)
}

export async function verifyPrerequisites() {
  try {
    await exec('gh', ['--version'])
  } catch {
    throw new Error('gh CLI not found. Install: https://cli.github.com')
  }
}

export async function cloneRepo(tmpDir: string, repo: string = REPO) {
  try {
    await exec('gh', ['repo', 'clone', repo, tmpDir])
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new Error(`Failed to clone repo: ${msg}`)
  }
}

export async function dirExists(path: string): Promise<boolean> {
  try {
    const s = await stat(path)
    return s.isDirectory()
  } catch {
    return false
  }
}

export async function fileExists(path: string): Promise<boolean> {
  try {
    const s = await stat(path)
    return s.isFile()
  } catch {
    return false
  }
}

export async function copyConfigFolders(srcDir: string) {
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

export async function copyClaudeMd(srcDir: string) {
  const src = join(srcDir, 'CLAUDE.md')
  const dest = join(process.cwd(), 'CLAUDE.md')
  if (await fileExists(src)) {
    await cp(src, dest, { force: true })
  }
}

export async function runClaudeInit() {
  try {
    await exec('claude', ['init'])
    return true
  } catch {
    console.log('  ⚠ claude CLI not available, skipping CLAUDE.md enrichment')
    return false
  }
}

export async function getCommitSha(tmpDir: string): Promise<string> {
  const { stdout } = await exec('git', ['-C', tmpDir, 'rev-parse', 'HEAD'])
  return stdout.trim()
}

export async function updateSettings(commitSha: string) {
  const settingsPath = join(CLAUDE_DIR, 'settings.json')
  let settings: Record<string, unknown> = {}

  const file = Bun.file(settingsPath)
  if (await file.exists()) {
    settings = await file.json()
  }

  settings.version = commitSha
  await Bun.write(settingsPath, JSON.stringify(settings, null, 2))
}

export async function cleanup(tmpDir: string) {
  try {
    await rm(tmpDir, { recursive: true, force: true })
  } catch {
    // ignore cleanup errors
  }
}

export async function getCurrentVersion(): Promise<string | null> {
  const settingsPath = join(CLAUDE_DIR, 'settings.json')
  const file = Bun.file(settingsPath)
  if (await file.exists()) {
    const settings = await file.json()
    return settings.version ?? null
  }
  return null
}

export async function getRemoteSha(ref?: string, repo: string = REPO): Promise<string> {
  const target = ref ?? 'HEAD'
  const { stdout } = await exec('git', ['ls-remote', `https://github.com/${repo}.git`, target])
  const sha = stdout.trim().split('\t')[0]
  if (!sha) throw new Error(`Could not resolve ref: ${target}`)
  return sha
}

export async function copySkillFolders(srcDir: string) {
  await mkdir(SKILLS_DIR, { recursive: true })
  const entries = await readdir(srcDir, { withFileTypes: true })
  for (const entry of entries) {
    if (entry.isDirectory() && !entry.name.startsWith('.')) {
      const src = join(srcDir, entry.name)
      const dest = join(SKILLS_DIR, entry.name)
      await cp(src, dest, { recursive: true, force: true })
      log(`Copied skill: ${entry.name}/`)
    }
  }
}

export async function updateSkillsVersion(commitSha: string) {
  const settingsPath = join(CLAUDE_DIR, 'settings.json')
  let settings: Record<string, unknown> = {}

  const file = Bun.file(settingsPath)
  if (await file.exists()) {
    settings = await file.json()
  }

  settings.skillsVersion = commitSha
  await Bun.write(settingsPath, JSON.stringify(settings, null, 2))
}

export async function getSkillsVersion(): Promise<string | null> {
  const settingsPath = join(CLAUDE_DIR, 'settings.json')
  const file = Bun.file(settingsPath)
  if (await file.exists()) {
    const settings = await file.json()
    return settings.skillsVersion ?? null
  }
  return null
}

export async function upgradeCli(): Promise<{ upgraded: boolean; from: string; to: string }> {
  const { version: currentVersion } = await import('../../package.json')

  // Get latest version from npm registry
  const { stdout: latestRaw } = await exec('npm', ['view', 'vibe-cokit', 'version'])
  const latestVersion = latestRaw.trim()

  if (currentVersion === latestVersion) {
    return { upgraded: false, from: currentVersion, to: latestVersion }
  }

  await exec('bun', ['install', '-g', `vibe-cokit@${latestVersion}`])
  return { upgraded: true, from: currentVersion, to: latestVersion }
}

