import { join } from 'path'
import { execFile } from 'child_process'
import { promisify } from 'util'
import {
  SKILLS_REPO,
  TEMP_DIR,
  log,
  verifyPrerequisites,
  cloneRepo,
  copySkillFolders,
  getCommitSha,
  updateSkillsVersion,
  getSkillsVersion,
  getRemoteSha,
  cleanup,
} from '../utils/config'

const exec = promisify(execFile)

export async function skillsCommand(ref?: string) {
  const tmpDir = join(TEMP_DIR, crypto.randomUUID())

  try {
    console.log('\nvibe-cokit skills\n')

    log('Verifying prerequisites...')
    await verifyPrerequisites()

    log('Checking current skills version...')
    const currentSha = await getSkillsVersion()

    log('Fetching latest skills version...')
    const targetSha = await getRemoteSha(ref, SKILLS_REPO)

    if (currentSha && currentSha === targetSha) {
      console.log(`\n✓ Skills already up-to-date (${currentSha.slice(0, 8)})\n`)
      return
    }

    log('Cloning skills repository...')
    await cloneRepo(tmpDir, SKILLS_REPO)

    if (ref) {
      log(`Checking out ${ref}...`)
      await exec('git', ['-C', tmpDir, 'checkout', ref])
    }

    log('Copying skills to ~/.claude/skills/')
    await copySkillFolders(tmpDir)

    log('Updating skills version...')
    const sha = await getCommitSha(tmpDir)
    await updateSkillsVersion(sha)

    const from = currentSha ? currentSha.slice(0, 8) : 'none'
    console.log(`\n✓ Skills installed successfully!`)
    console.log(`  From:    ${from}`)
    console.log(`  To:      ${sha.slice(0, 8)}`)
    console.log(`  Skills:  ~/.claude/skills/\n`)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`\n✗ Skills setup failed: ${msg}\n`)
    process.exit(1)
  } finally {
    await cleanup(tmpDir)
  }
}
