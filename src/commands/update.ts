import { join } from 'path'
import { execFile } from 'child_process'
import { promisify } from 'util'
import {
  TEMP_DIR,
  log,
  verifyPrerequisites,
  cloneRepo,
  copyConfigFolders,
  getCommitSha,
  updateSettings,
  cleanup,
  getCurrentVersion,
  getRemoteSha,
  upgradeCli,
} from '../utils/config'

const exec = promisify(execFile)

export async function updateCommand(ref?: string) {
  const tmpDir = join(TEMP_DIR, crypto.randomUUID())

  try {
    console.log('\nvibe-cokit update\n')

    log('Verifying prerequisites...')
    await verifyPrerequisites()

    // Upgrade CLI binary
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

    // Update config
    log('Checking config version...')
    const currentSha = await getCurrentVersion()

    log('Fetching latest config version...')
    const targetSha = await getRemoteSha(ref)

    if (currentSha && currentSha === targetSha) {
      console.log(`\n✓ Config already up-to-date (${currentSha.slice(0, 8)})\n`)
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

    log('Updating version tracking...')
    const sha = await getCommitSha(tmpDir)
    await updateSettings(sha)

    log('Cleaning up...')
    await cleanup(tmpDir)

    const from = currentSha ? currentSha.slice(0, 8) : 'none'
    console.log(`\n✓ vibe-cokit updated successfully!`)
    console.log(`  From:    ${from}`)
    console.log(`  To:      ${sha.slice(0, 8)}`)
    console.log(`  Config:  ~/.claude/\n`)
  } catch (err) {
    await cleanup(tmpDir)
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`\n✗ Update failed: ${msg}\n`)
    process.exit(1)
  }
}
