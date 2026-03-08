import { join } from 'path'
import { execFile } from 'child_process'
import { promisify } from 'util'
import {
  SKILLS_REPO,
  ANTIGRAVITY_REPO,
  OPENCODE_REPO,
  ANTIGRAVITY_SKILLS_DIR,
  CLAUDE_SKILLS_DIR,
  TEMP_DIR,
  log,
  verifyPrerequisites,
  cloneRepo,
  copyConfigFolders,
  copySkillFolders,
  copyAgentFolder,
  copyOpenCodeKit,
  dirExists,
  getCommitSha,
  updateSettings,
  updateSkillsVersion,
  updateAntigravityVersion,
  updateOpenCodeVersion,
  cleanup,
  getCurrentVersion,
  getSkillsVersion,
  getAntigravityVersion,
  getOpenCodeVersion,
  getRemoteSha,
  upgradeCli,
} from '../utils/config'
import { getErrorMsg, logError } from '../utils/helpers'

const exec = promisify(execFile)

const VALID_AGENTS = ['claude-code', 'antigravity', 'opencode'] as const
type AgentType = (typeof VALID_AGENTS)[number]

export async function updateCommand(agent?: string, ref?: string) {
  const agentType = agent as AgentType | undefined

  if (agentType && !VALID_AGENTS.includes(agentType)) {
    console.error(`\n✗ Unknown agent type: "${agent}"`)
    console.error(`  Available agents: ${VALID_AGENTS.join(', ')}\n`)
    process.exit(1)
  }

  try {
    console.log(`\nvibe-cokit update${agentType ? ` (${agentType})` : ''}\n`)

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

    // 2. Agent-specific updates (only if agent is specified)
    if (agentType) {
      log('Verifying prerequisites...')
      await verifyPrerequisites()

      switch (agentType) {
        case 'claude-code':
          await updateClaudeCode(ref)
          break
        case 'antigravity':
          await updateAntigravity(ref)
          await updateSkills(ref, ANTIGRAVITY_SKILLS_DIR)
          break
        case 'opencode':
          await updateOpenCode(ref)
          break
      }
    }

    console.log('\n✓ vibe-cokit update complete!\n')
  } catch (err) {
    logError('update', err)
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

async function updateOpenCode(ref?: string) {
  const tmpDir = join(TEMP_DIR, crypto.randomUUID())

  try {
    log('Checking OpenCode kit version...')
    const currentSha = await getOpenCodeVersion()

    log('Fetching latest OpenCode kit version...')
    const targetSha = await getRemoteSha(ref, OPENCODE_REPO)

    if (currentSha && currentSha === targetSha) {
      log(`OpenCode kit: up-to-date (${currentSha.slice(0, 8)})`)
      return
    }

    log('Cloning OpenCode kit...')
    await cloneRepo(tmpDir, OPENCODE_REPO)

    if (ref) {
      log(`Checking out ${ref}...`)
      await exec('git', ['-C', tmpDir, 'checkout', ref])
    }

    log('Updating OpenCode kit in current project...')
    await copyOpenCodeKit(tmpDir)

    const sha = await getCommitSha(tmpDir)
    await updateOpenCodeVersion(sha)

    const from = currentSha ? currentSha.slice(0, 8) : 'none'
    log(`OpenCode kit updated: ${from} -> ${sha.slice(0, 8)}`)
  } finally {
    await cleanup(tmpDir)
  }
}
