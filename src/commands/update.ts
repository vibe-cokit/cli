import { join } from 'path'
import { execFile } from 'child_process'
import { promisify } from 'util'
import {
  SKILLS_REPO,
  ANTIGRAVITY_REPO,
  CLAUDE_SKILLS_DIR,
  TEMP_DIR,
  log,
  verifyPrerequisites,
  cloneRepo,
  copyConfigFolders,
  copySkillFolders,
  copyAgentFolder,
  dirExists,
  getCommitSha,
  updateSettings,
  updateSkillsVersion,
  updateAntigravityVersion,
  cleanup,
  getCurrentVersion,
  getSkillsVersion,
  getAntigravityVersion,
  getRemoteSha,
  upgradeCli,
} from '../utils/config'
import { getErrorMsg } from '../utils/helpers'

const exec = promisify(execFile)

const VALID_AGENTS = ['claude-code', 'antigravity'] as const
type AgentType = (typeof VALID_AGENTS)[number]

export async function updateCommand(agent?: string, ref?: string) {
  if (!agent) {
    console.error('\n✗ Missing agent type.')
    console.error(`  Usage: vk update <agent> [ref]`)
    console.error(`  Available agents: ${VALID_AGENTS.join(', ')}\n`)
    process.exit(1)
  }

  const agentType = agent as AgentType
  if (!VALID_AGENTS.includes(agentType)) {
    console.error(`\n✗ Unknown agent type: "${agent}"`)
    console.error(`  Available agents: ${VALID_AGENTS.join(', ')}\n`)
    process.exit(1)
  }

  try {
    console.log(`\nvibe-cokit update (${agentType})\n`)

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

    // 2. Agent-specific updates
    switch (agentType) {
      case 'claude-code':
        await updateClaudeCode(ref)
        break
      case 'antigravity':
        await updateAntigravity(ref)
        await updateSkills(ref, join(process.cwd(), '.agent', 'skills'))
        break
    }

    console.log('\n✓ vibe-cokit update complete!\n')
  } catch (err) {
    const msg = getErrorMsg(err)
    console.error(`\n✗ Update failed: ${msg}\n`)
    process.exit(1)
  }
}

async function updateClaudeCode(ref?: string) {
  // Update config
  await updateConfig(ref)

  // Update skills
  await updateSkills(ref)
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

async function updateSkills(ref?: string, destDir?: string) {
  const tmpDir = join(TEMP_DIR, crypto.randomUUID())

  try {
    log('Checking skills version...')
    const currentSha = await getSkillsVersion()

    log('Fetching latest skills version...')
    const targetSha = await getRemoteSha(ref, SKILLS_REPO)

    const target = destDir ?? CLAUDE_SKILLS_DIR
    const destExists = await dirExists(target)

    if (currentSha && currentSha === targetSha && destExists) {
      log(`Skills: up-to-date (${currentSha.slice(0, 8)})`)
      return
    }

    log('Cloning skills repository...')
    await cloneRepo(tmpDir, SKILLS_REPO)

    if (ref) {
      log(`Checking out ${ref}...`)
      await exec('git', ['-C', tmpDir, 'checkout', ref])
    }

    log(`Updating skills in ${target}/`)
    await copySkillFolders(tmpDir, target)

    const sha = await getCommitSha(tmpDir)
    await updateSkillsVersion(sha)

    const from = currentSha ? currentSha.slice(0, 8) : 'none'
    log(`Skills updated: ${from} → ${sha.slice(0, 8)}`)
  } finally {
    await cleanup(tmpDir)
  }
}

async function updateAntigravity(ref?: string) {
  const tmpDir = join(TEMP_DIR, crypto.randomUUID())

  try {
    log('Checking antigravity version...')
    const currentSha = await getAntigravityVersion()

    log('Fetching latest antigravity version...')
    const targetSha = await getRemoteSha(ref, ANTIGRAVITY_REPO)

    if (currentSha && currentSha === targetSha) {
      log(`Antigravity: up-to-date (${currentSha.slice(0, 8)})`)
      return
    }

    log('Cloning antigravity repository...')
    await cloneRepo(tmpDir, ANTIGRAVITY_REPO)

    if (ref) {
      log(`Checking out ${ref}...`)
      await exec('git', ['-C', tmpDir, 'checkout', ref])
    }

    log('Updating .agents/ folder...')
    await copyAgentFolder(tmpDir)

    const sha = await getCommitSha(tmpDir)
    await updateAntigravityVersion(sha)

    const from = currentSha ? currentSha.slice(0, 8) : 'none'
    log(`Antigravity updated: ${from} → ${sha.slice(0, 8)}`)
  } finally {
    await cleanup(tmpDir)
  }
}
