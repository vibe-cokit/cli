import { join } from 'path'
import {
  TEMP_DIR,
  ANTIGRAVITY_REPO,
  SKILLS_REPO,
  log,
  verifyPrerequisites,
  cloneRepo,
  copyConfigFolders,
  copyClaudeMd,
  copySkillFolders,
  runClaudeInit,
  getCommitSha,
  updateSettings,
  cleanup,
  copyAgentFolder,
  ensureGitignore,
} from '../utils/config'
import { getErrorMsg } from '../utils/helpers'

const VALID_AGENTS = ['claude-code', 'antigravity'] as const
type AgentType = (typeof VALID_AGENTS)[number]

export async function initCommand(agent?: string) {
  const agentType: AgentType = (agent as AgentType) ?? 'claude-code'

  if (!VALID_AGENTS.includes(agentType)) {
    console.error(`\n✗ Unknown agent type: "${agent}"`)
    console.error(`  Available agents: ${VALID_AGENTS.join(', ')}\n`)
    process.exit(1)
  }

  switch (agentType) {
    case 'claude-code':
      return initClaudeCode()
    case 'antigravity':
      return initAntigravity()
  }
}

async function initClaudeCode() {
  const tmpDir = join(TEMP_DIR, crypto.randomUUID())

  try {
    console.log('\nvibe-cokit init (claude-code)\n')

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

    console.log('\n✓ vibe-cokit initialized successfully!')
    console.log(`  Version: ${sha.slice(0, 8)}`)
    console.log(`  Config:  ~/.claude/`)
    console.log(`  Claude:  ./CLAUDE.md\n`)
  } catch (err) {
    console.error(`\n✗ Init failed: ${getErrorMsg(err)}\n`)
    process.exit(1)
  } finally {
    await cleanup(tmpDir)
  }
}

async function initAntigravity() {
  const tmpDir = join(TEMP_DIR, crypto.randomUUID())

  try {
    console.log('\nvibe-cokit init (antigravity)\n')

    log('Verifying prerequisites...')
    await verifyPrerequisites()

    log('Cloning antigravity configuration...')
    await cloneRepo(tmpDir, ANTIGRAVITY_REPO)

    log('Copying agent config to .agents/...')
    await copyAgentFolder(tmpDir)

    const skillsTmpDir = join(TEMP_DIR, crypto.randomUUID())
    try {
      log('Cloning skills repository...')
      await cloneRepo(skillsTmpDir, SKILLS_REPO)

      log('Installing skills to .agent/skills/...')
      await copySkillFolders(skillsTmpDir, join(process.cwd(), '.agent', 'skills'))
    } finally {
      await cleanup(skillsTmpDir)
    }

    log('Updating .gitignore...')
    await ensureGitignore('.agents')
    await ensureGitignore('.agent')

    log('Updating version tracking...')
    const sha = await getCommitSha(tmpDir)
    await updateSettings(sha)

    console.log('\n✓ Antigravity initialized successfully!')
    console.log(`  Version: ${sha.slice(0, 8)}`)
    console.log(`  Agent:   ./.agents/\n`)
  } catch (err) {
    console.error(`\n✗ Init failed: ${getErrorMsg(err)}\n`)
    process.exit(1)
  } finally {
    await cleanup(tmpDir)
  }
}
