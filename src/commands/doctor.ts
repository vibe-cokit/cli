import { execFile } from 'child_process'
import { promisify } from 'util'
import {
  CLAUDE_DIR,
  SKILLS_DIR,
  CONFIG_FOLDERS,
  dirExists,
  fileExists,
  getCurrentVersion,
  getSkillsVersion,
} from '../utils/config'
import { join } from 'path'

const exec = promisify(execFile)

async function checkBin(name: string): Promise<string | null> {
  try {
    const { stdout } = await exec(name, ['--version'])
    return stdout.trim().split('\n')[0] ?? null
  } catch {
    return null
  }
}

export async function doctorCommand() {
  console.log('\nvibe-cokit doctor\n')

  let issues = 0

  // Check CLI tools
  const tools = ['gh', 'git', 'claude'] as const
  for (const tool of tools) {
    const ver = await checkBin(tool)
    if (ver) {
      console.log(`  ✓ ${tool}: ${ver}`)
    } else {
      console.log(`  ✗ ${tool}: not found`)
      issues++
    }
  }

  console.log()

  // Check ~/.claude/ directory
  if (await dirExists(CLAUDE_DIR)) {
    console.log(`  ✓ ~/.claude/ exists`)
  } else {
    console.log(`  ✗ ~/.claude/ not found — run \`vk init\``)
    issues++
  }

  // Check config folders
  for (const folder of CONFIG_FOLDERS) {
    const path = join(CLAUDE_DIR, folder)
    if (await dirExists(path)) {
      console.log(`  ✓ ~/.claude/${folder}/`)
    } else {
      console.log(`  ✗ ~/.claude/${folder}/ missing`)
      issues++
    }
  }

  // Check skills directory
  if (await dirExists(SKILLS_DIR)) {
    console.log(`  ✓ ~/.claude/skills/`)
  } else {
    console.log(`  ✗ ~/.claude/skills/ missing — run \`vk skills\``)
    issues++
  }

  // Check settings.json
  const settingsPath = join(CLAUDE_DIR, 'settings.json')
  if (await fileExists(settingsPath)) {
    console.log(`  ✓ ~/.claude/settings.json`)
  } else {
    console.log(`  ✗ ~/.claude/settings.json missing`)
    issues++
  }

  console.log()

  // Check versions
  const configVersion = await getCurrentVersion()
  const skillsVersion = await getSkillsVersion()

  console.log(`  Config version:  ${configVersion ? configVersion.slice(0, 10) : 'not installed'}`)
  console.log(`  Skills version:  ${skillsVersion ? skillsVersion.slice(0, 10) : 'not installed'}`)

  // Check CLAUDE.md in current project
  const claudeMdExists = await fileExists(join(process.cwd(), 'CLAUDE.md'))
  console.log(`  Project CLAUDE.md: ${claudeMdExists ? 'found' : 'not found'}`)

  console.log()

  if (issues === 0) {
    console.log('  ✓ All checks passed!\n')
  } else {
    console.log(`  ⚠ ${issues} issue${issues > 1 ? 's' : ''} found\n`)
  }
}
