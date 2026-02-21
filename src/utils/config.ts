import { homedir } from 'os'
import { join } from 'path'
import { mkdir, cp, rm, stat, readdir, readFile, writeFile, appendFile } from 'fs/promises'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { get } from 'lodash-es'
import { getErrorMsg } from './helpers'

const exec = promisify(execFile)

export const REPO = 'vibe-cokit/claude-code'
export const ANTIGRAVITY_REPO = 'vibe-cokit/antigravity'
export const SKILLS_REPO = 'vibe-cokit/skills'
export const CLAUDE_DIR = join(homedir(), '.claude')
export const CLAUDE_SKILLS_DIR = join(CLAUDE_DIR, 'skills')
export const ANTIGRAVITY_SKILLS_DIR = join(homedir(), '.gemini', 'antigravity', 'skills')
export const CONFIG_FOLDERS = ['agents', 'commands', 'hooks', 'prompts', 'workflows'] as const
export const TEMP_DIR = join(homedir(), '.vibe-cokit-tmp')
const SETTINGS_PATH = join(CLAUDE_DIR, 'settings.json')

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
    throw new Error(`Failed to clone repo: ${getErrorMsg(err)}`)
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

async function readSettings(): Promise<Record<string, unknown>> {
  const file = Bun.file(SETTINGS_PATH)
  if (await file.exists()) return file.json()
  return {}
}

async function writeSettings(settings: Record<string, unknown>) {
  await Bun.write(SETTINGS_PATH, JSON.stringify(settings, null, 2))
}

export async function updateSettings(commitSha: string) {
  const settings = await readSettings()
  settings.version = commitSha
  await writeSettings(settings)
}

export async function cleanup(tmpDir: string) {
  try {
    await rm(tmpDir, { recursive: true, force: true })
  } catch {
    // ignore cleanup errors
  }
}

export async function getCurrentVersion(): Promise<string | null> {
  const settings = await readSettings()
  return get(settings, 'version', null) as string | null
}

export async function getRemoteSha(ref?: string, repo: string = REPO): Promise<string> {
  const target = ref ?? 'HEAD'
  const { stdout } = await exec('git', ['ls-remote', `https://github.com/${repo}.git`, target])
  const sha = stdout.trim().split('\t')[0]
  if (!sha) throw new Error(`Could not resolve ref: ${target}`)
  return sha
}

export async function copySkillFolders(srcDir: string, destDir: string = CLAUDE_SKILLS_DIR) {
  await mkdir(destDir, { recursive: true })
  const entries = await readdir(srcDir, { withFileTypes: true })
  for (const entry of entries) {
    if (entry.isDirectory() && !entry.name.startsWith('.')) {
      const src = join(srcDir, entry.name)
      const dest = join(destDir, entry.name)
      await cp(src, dest, { recursive: true, force: true })
      log(`Copied skill: ${entry.name}/`)
    }
  }
}

export async function updateSkillsVersion(commitSha: string) {
  const settings = await readSettings()
  settings.skillsVersion = commitSha
  await writeSettings(settings)
}

export async function getSkillsVersion(): Promise<string | null> {
  const settings = await readSettings()
  return get(settings, 'skillsVersion', null) as string | null
}

export async function updateAntigravityVersion(commitSha: string) {
  const settings = await readSettings()
  settings.antigravityVersion = commitSha
  await writeSettings(settings)
}

export async function getAntigravityVersion(): Promise<string | null> {
  const settings = await readSettings()
  return get(settings, 'antigravityVersion', null) as string | null
}

export async function upgradeCli(): Promise<{ upgraded: boolean; from: string; to: string }> {
  // Get currently installed version from bun global packages
  const { stdout: installedRaw } = await exec('bun', ['pm', 'ls', '-g'])
  const match = installedRaw.match(/vibe-cokit@(\S+)/)
  const currentVersion = match?.[1] ?? '0.0.0'

  // Get latest version from npm registry
  const { stdout: latestRaw } = await exec('npm', ['view', 'vibe-cokit', 'version'])
  const latestVersion = latestRaw.trim()

  if (currentVersion === latestVersion) {
    return { upgraded: false, from: currentVersion, to: latestVersion }
  }

  await exec('bun', ['install', '-g', `vibe-cokit@${latestVersion}`])
  return { upgraded: true, from: currentVersion, to: latestVersion }
}

export async function copyAgentFolder(srcDir: string) {
  const dest = join(process.cwd(), '.agents')
  await mkdir(dest, { recursive: true })

  const entries = await readdir(srcDir, { withFileTypes: true })
  for (const entry of entries) {
    if (entry.name.startsWith('.git')) continue
    const src = join(srcDir, entry.name)
    const target = join(dest, entry.name)
    await cp(src, target, { recursive: true, force: true })
  }
}

export async function ensureGitignore(entry: string) {
  const gitignorePath = join(process.cwd(), '.gitignore')

  try {
    const content = await readFile(gitignorePath, 'utf-8')
    const lines = content.split(/\r?\n/)
    if (lines.some(line => line.trim() === entry)) return
    const separator = content.endsWith('\n') ? '' : '\n'
    await appendFile(gitignorePath, `${separator}${entry}\n`)
  } catch {
    await writeFile(gitignorePath, `${entry}\n`)
  }
}
