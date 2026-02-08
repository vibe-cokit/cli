import { join } from 'path'
import {
  CLAUDE_DIR,
  SKILLS_DIR,
  CONFIG_FOLDERS,
  TEMP_DIR,
  SKILLS_REPO,
  log,
  dirExists,
  fileExists,
  verifyPrerequisites,
  cloneRepo,
  copyConfigFolders,
  copyClaudeMd,
  copySkillFolders,
  getCommitSha,
  updateSettings,
  updateSkillsVersion,
  getCurrentVersion,
  getSkillsVersion,
  cleanup,
} from '../utils/config'

export async function doctorFixCommand() {
  console.log('\nvibe-cokit doctor fix\n')

  try {
    log('Verifying prerequisites...')
    await verifyPrerequisites()
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`\n✗ Cannot fix: ${msg}\n`)
    process.exit(1)
  }

  let fixed = 0

  // Check if config is missing
  const configMissing = !(await dirExists(CLAUDE_DIR)) ||
    (await Promise.all(CONFIG_FOLDERS.map(f => dirExists(join(CLAUDE_DIR, f))))).some(exists => !exists) ||
    !(await getCurrentVersion())

  if (configMissing) {
    log('Config missing — installing...')
    const tmpDir = join(TEMP_DIR, crypto.randomUUID())
    try {
      await cloneRepo(tmpDir)
      await copyConfigFolders(tmpDir)
      const sha = await getCommitSha(tmpDir)
      await updateSettings(sha)
      await cleanup(tmpDir)
      log(`Config installed (${sha.slice(0, 8)})`)
      fixed++
    } catch (err) {
      await cleanup(tmpDir)
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`  ✗ Config fix failed: ${msg}`)
    }
  } else {
    log('Config: OK')
  }

  // Check if skills are missing
  const skillsMissing = !(await dirExists(SKILLS_DIR)) || !(await getSkillsVersion())

  if (skillsMissing) {
    log('Skills missing — installing...')
    const tmpDir = join(TEMP_DIR, crypto.randomUUID())
    try {
      await cloneRepo(tmpDir, SKILLS_REPO)
      await copySkillFolders(tmpDir)
      const sha = await getCommitSha(tmpDir)
      await updateSkillsVersion(sha)
      await cleanup(tmpDir)
      log(`Skills installed (${sha.slice(0, 8)})`)
      fixed++
    } catch (err) {
      await cleanup(tmpDir)
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`  ✗ Skills fix failed: ${msg}`)
    }
  } else {
    log('Skills: OK')
  }

  // Check CLAUDE.md in current project
  const claudeMdPath = join(process.cwd(), 'CLAUDE.md')
  if (!(await fileExists(claudeMdPath))) {
    log('CLAUDE.md missing — copying...')
    const tmpDir = join(TEMP_DIR, crypto.randomUUID())
    try {
      await cloneRepo(tmpDir)
      await copyClaudeMd(tmpDir)
      await cleanup(tmpDir)
      log('CLAUDE.md copied to project')
      fixed++
    } catch (err) {
      await cleanup(tmpDir)
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`  ✗ CLAUDE.md fix failed: ${msg}`)
    }
  } else {
    log('CLAUDE.md: OK')
  }

  console.log()

  if (fixed > 0) {
    console.log(`  ✓ Fixed ${fixed} issue${fixed > 1 ? 's' : ''}!\n`)
  } else {
    console.log('  ✓ Nothing to fix — all good!\n')
  }
}
