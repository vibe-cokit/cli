import { join } from 'path'
import {
  TEMP_DIR,
  log,
  verifyPrerequisites,
  cloneRepo,
  copyConfigFolders,
  copyClaudeMd,
  runClaudeInit,
  getCommitSha,
  updateSettings,
  cleanup,
} from '../utils/config'

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
