import { join } from 'path'
import { some } from 'lodash-es'
import {
  CLAUDE_DIR,
  CLAUDE_SKILLS_DIR,
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
import { getErrorMsg, plural } from '../utils/helpers'
import { checkKeyboardStatus, patchCliJs } from '../utils/keyboard'

export async function doctorFixCommand() {
  console.log('\nvibe-cokit doctor fix\n')

  try {
    log('Verifying prerequisites...')
    await verifyPrerequisites()
  } catch (err) {
    console.error(`\n✗ Cannot fix: ${getErrorMsg(err)}\n`)
    process.exit(1)
  }

  let fixed = 0

  // Check if config or CLAUDE.md needs fixing (both use same repo)
  const folderChecks = await Promise.all(CONFIG_FOLDERS.map(f => dirExists(join(CLAUDE_DIR, f))))
  const configMissing = !(await dirExists(CLAUDE_DIR)) ||
    some(folderChecks, exists => !exists) ||
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
      console.error(`  ✗ Config/CLAUDE.md fix failed: ${getErrorMsg(err)}`)
    } finally {
      await cleanup(tmpDir)
    }
  } else {
    log('Config: OK')
    log('CLAUDE.md: OK')
  }

  // Check if skills are missing
  const skillsMissing = !(await dirExists(CLAUDE_SKILLS_DIR)) || !(await getSkillsVersion())

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
      console.error(`  ✗ Skills fix failed: ${getErrorMsg(err)}`)
    } finally {
      await cleanup(tmpDir)
    }
  } else {
    log('Skills: OK')
  }

  // Check and fix keyboard / Vietnamese IME
  const kbStatus = await checkKeyboardStatus()
  if (kbStatus.cliJsFound && kbStatus.hasBug && !kbStatus.isPatched) {
    log('Vietnamese IME fix missing — patching...')
    try {
      const result = await patchCliJs(kbStatus.cliJsPath!)
      if (result.success) {
        log(`Vietnamese IME fix applied`)
        if (result.backupPath) {
          log(`Backup: ${result.backupPath}`)
        }
        fixed++
      } else {
        console.error(`  ✗ Keyboard fix failed: ${result.message}`)
      }
    } catch (err) {
      console.error(`  ✗ Keyboard fix failed: ${getErrorMsg(err)}`)
    }
  } else if (kbStatus.cliJsFound && kbStatus.isPatched) {
    log('Vietnamese IME fix: OK')
  } else if (kbStatus.cliJsFound && !kbStatus.hasBug) {
    log('Vietnamese IME: no bug detected')
  } else {
    log('Claude Code CLI: not found (skip keyboard fix)')
  }

  console.log()

  if (fixed > 0) {
    console.log(`  ✓ Fixed ${plural(fixed, 'issue')}!\n`)
  } else {
    console.log('  ✓ Nothing to fix — all good!\n')
  }
}
