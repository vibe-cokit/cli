import { join } from 'path'
import { execFile } from 'child_process'
import { promisify } from 'util'
import {
  CLAUDE_SKILLS_DIR,
  TEMP_DIR,
  log,
  verifyPrerequisites,
  cloneRepo,
  copyConfigFolders,
  copySkillFolders,
  dirExists,
  getCommitSha,
  updateSettings,
  updateSkillsVersion,
  cleanup,
  getCurrentVersion,
  getSkillsVersion,
  getRemoteSha,
  upgradeCli,
} from '../utils/config'
import { getErrorMsg, logError } from '../utils/helpers'

const exec = promisify(execFile)

export async function updateCommand(ref?: string) {
  try {
    console.log('\nvibe-cokit update\n')

    // 1. Upgrade CLI binary
    log('Checking CLI version...')
    try {
      const { upgraded, from, to } = await upgradeCli()
      if (upgraded) {
        log(`CLI upgraded: ${from} → ${to}`)
      } else {
        log(`CLI: v${from} (latest)`)
      }
    } catch (err) {
      const reason = getErrorMsg(err)
      logError('update:cli', err)
      log(`CLI upgrade skipped: ${reason}`)
    }

    // 2. Update config + skills
    log('Verifying prerequisites...')
    await verifyPrerequisites()

    await updateConfigAndSkills(ref)

    console.log('\n✓ vibe-cokit update complete!\n')
  } catch (err) {
    logError('update', err)
    const msg = getErrorMsg(err)
    console.error(`\n✗ Update failed: ${msg}\n`)
    process.exit(1)
  }
}

async function updateConfigAndSkills(ref?: string) {
  log('Checking config version...')
  const currentConfigSha = await getCurrentVersion()
  const currentSkillsSha = await getSkillsVersion()

  log('Fetching latest vibe-cokit version...')
  const targetSha = await getRemoteSha(ref)

  const configUpToDate = currentConfigSha === targetSha
  const skillsUpToDate = currentSkillsSha === targetSha && (await dirExists(CLAUDE_SKILLS_DIR))

  if (configUpToDate && skillsUpToDate) {
    log(`Config: up-to-date (${targetSha.slice(0, 8)})`)
    log(`Skills: up-to-date (${targetSha.slice(0, 8)})`)
    return
  }

  const tmpDir = join(TEMP_DIR, crypto.randomUUID())

  try {
    log('Cloning vibe-cokit configuration...')
    await cloneRepo(tmpDir)

    if (ref) {
      log(`Checking out ${ref}...`)
      await exec('git', ['-C', tmpDir, 'checkout', ref])
    }

    const sha = await getCommitSha(tmpDir)

    if (configUpToDate) {
      log(`Config: up-to-date (${targetSha.slice(0, 8)})`)
    } else {
      log('Updating config folders in ~/.claude/')
      await copyConfigFolders(tmpDir)
      await updateSettings(sha)
      const from = currentConfigSha ? currentConfigSha.slice(0, 8) : 'none'
      log(`Config updated: ${from} → ${sha.slice(0, 8)}`)
    }

    if (skillsUpToDate) {
      log(`Skills: up-to-date (${targetSha.slice(0, 8)})`)
    } else {
      log(`Updating skills in ${CLAUDE_SKILLS_DIR}/`)
      await copySkillFolders(join(tmpDir, 'skills'))
      await updateSkillsVersion(sha)
      const from = currentSkillsSha ? currentSkillsSha.slice(0, 8) : 'none'
      log(`Skills updated: ${from} → ${sha.slice(0, 8)}`)
    }
  } finally {
    await cleanup(tmpDir)
  }
}
