import { join } from 'path'
import {
  CLAUDE_DIR,
  SKILLS_DIR,
  CONFIG_FOLDERS,
  dirExists,
  fileExists,
  getCurrentVersion,
  getSkillsVersion,
} from '../utils/config'
import { checkBinVersion, plural } from '../utils/helpers'
import { checkKeyboardStatus } from '../utils/keyboard'

export async function doctorCommand() {
  console.log('\nvibe-cokit doctor\n')

  let issues = 0

  // Check CLI tools
  const tools = ['gh', 'git', 'claude'] as const
  for (const tool of tools) {
    const ver = await checkBinVersion(tool)
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

  // Check keyboard / Vietnamese IME fix
  const kbStatus = await checkKeyboardStatus()
  if (kbStatus.cliJsFound) {
    if (kbStatus.isPatched) {
      console.log(`  ✓ Vietnamese IME fix: applied`)
    } else if (kbStatus.hasBug) {
      console.log(`  ✗ Vietnamese IME fix: not applied — run \`vk doctor --fix\``)
      issues++
    } else {
      console.log(`  ✓ Vietnamese IME: no bug detected`)
    }
  } else {
    console.log(`  ⚠ Claude Code CLI: not found`)
  }

  // Check CLAUDE.md in current project
  const claudeMdExists = await fileExists(join(process.cwd(), 'CLAUDE.md'))
  console.log(`  Project CLAUDE.md: ${claudeMdExists ? 'found' : 'not found'}`)

  console.log()

  if (issues === 0) {
    console.log('  ✓ All checks passed!\n')
  } else {
    console.log(`  ⚠ ${plural(issues, 'issue')} found\n`)
  }
}
