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

  // Check if config or CLAUDE.md needs fixing (both use same repo)
  const configMissing = !(await dirExists(CLAUDE_DIR)) ||
    (await Promise.all(CONFIG_FOLDERS.map(f => dirExists(join(CLAUDE_DIR, f))))).some(exists => !exists) ||
    !(await getCurrentVersion())

  const claudeMdPath = join(process.cwd(), 'CLAUDE.md')
  const claudeMdMissing = !(await fileExists(claudeMdPath))

  // Clone config repo once if needed for either config or CLAUDE.md
  if (configMissing || claudeMdMissing) {
    const tmpDir = join(TEMP_DIR, crypto.randomUUID())
    try {
      await cloneRepo(tmpDir)

      if (configMissing) {
        log('Config missing — installing...')
        await copyConfigFolders(tmpDir)
        const sha = await getCommitSha(tmpDir)
        await updateSettings(sha)
        log(`Config installed (${sha.slice(0, 8)})`)
        fixed++
      } else {
        log('Config: OK')
      }

      if (claudeMdMissing) {
        log('CLAUDE.md missing — copying...')
        await copyClaudeMd(tmpDir)
        log('CLAUDE.md copied to project')
        fixed++
      } else {
        log('CLAUDE.md: OK')
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`  ✗ Config/CLAUDE.md fix failed: ${msg}`)
    } finally {
      await cleanup(tmpDir)
    }
  } else {
    log('Config: OK')
    log('CLAUDE.md: OK')
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
      log(`Skills installed (${sha.slice(0, 8)})`)
      fixed++
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`  ✗ Skills fix failed: ${msg}`)
    } finally {
      await cleanup(tmpDir)
    }
  } else {
    log('Skills: OK')
  }

  console.log()

  if (fixed > 0) {
    console.log(`  ✓ Fixed ${fixed} issue${fixed > 1 ? 's' : ''}!\n`)
  } else {
    console.log('  ✓ Nothing to fix — all good!\n')
  }
}
