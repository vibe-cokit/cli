import { join } from 'path'
import { execFile } from 'child_process'
import { promisify } from 'util'
import {
  SKILLS_REPO,
  TEMP_DIR,
  log,
  verifyPrerequisites,
  cloneRepo,
  copyConfigFolders,
  copySkillFolders,
  getCommitSha,
  updateSettings,
  updateSkillsVersion,
  cleanup,
  getCurrentVersion,
  getSkillsVersion,
  getRemoteSha,
  upgradeCli,
} from '../utils/config'
import { getErrorMsg } from '../utils/helpers'

const exec = promisify(execFile)

export async function updateCommand(ref?: string) {
  try {
    console.log('\nvibe-cokit update\n')

    log('Verifying prerequisites...')
    await verifyPrerequisites()

    // 1. Upgrade CLI binary
    log('Checking CLI version...')
    try {
      const { upgraded, from, to } = await upgradeCli()
      if (upgraded) {
        log(`CLI upgraded: ${from} → ${to}`)
      } else {
        log(`CLI: v${from} (latest)`)
      }
    } catch {
      log('CLI upgrade skipped (npm registry unavailable)')
    }

    // 2. Update config
    await updateConfig(ref)

    // 3. Update skills
    await updateSkills(ref)

    console.log('\n✓ vibe-cokit update complete!\n')
  } catch (err) {
    const msg = getErrorMsg(err)
    console.error(`\n✗ Update failed: ${msg}\n`)
    process.exit(1)
  }
}

async function updateConfig(ref?: string) {
  const tmpDir = join(TEMP_DIR, crypto.randomUUID())

  try {
    log('Checking config version...')
    const currentSha = await getCurrentVersion()

    log('Fetching latest config version...')
    const targetSha = await getRemoteSha(ref)

    if (currentSha && currentSha === targetSha) {
      log(`Config: up-to-date (${currentSha.slice(0, 8)})`)
      return
    }

    log('Cloning vibe-cokit configuration...')
    await cloneRepo(tmpDir)

    if (ref) {
      log(`Checking out ${ref}...`)
      await exec('git', ['-C', tmpDir, 'checkout', ref])
    }

    log('Updating config folders in ~/.claude/')
    await copyConfigFolders(tmpDir)

    const sha = await getCommitSha(tmpDir)
    await updateSettings(sha)

    const from = currentSha ? currentSha.slice(0, 8) : 'none'
    log(`Config updated: ${from} → ${sha.slice(0, 8)}`)
  } finally {
    await cleanup(tmpDir)
  }
}

async function updateSkills(ref?: string) {
  const tmpDir = join(TEMP_DIR, crypto.randomUUID())

  try {
    log('Checking skills version...')
    const currentSha = await getSkillsVersion()

    log('Fetching latest skills version...')
    const targetSha = await getRemoteSha(ref, SKILLS_REPO)

    if (currentSha && currentSha === targetSha) {
      log(`Skills: up-to-date (${currentSha.slice(0, 8)})`)
      return
    }

    log('Cloning skills repository...')
    await cloneRepo(tmpDir, SKILLS_REPO)

    if (ref) {
      log(`Checking out ${ref}...`)
      await exec('git', ['-C', tmpDir, 'checkout', ref])
    }

    log('Updating skills in ~/.claude/skills/')
    await copySkillFolders(tmpDir)

    const sha = await getCommitSha(tmpDir)
    await updateSkillsVersion(sha)

    const from = currentSha ? currentSha.slice(0, 8) : 'none'
    log(`Skills updated: ${from} → ${sha.slice(0, 8)}`)
  } finally {
    await cleanup(tmpDir)
  }
}
