import { version } from '../../package.json'
import { getCurrentVersion, getOpenCodeVersion, getSkillsVersion } from '../utils/config'

export async function versionCommand() {
  const commitSha = await getCurrentVersion()
  const skillsSha = await getSkillsVersion()
  const opencodeSha = await getOpenCodeVersion()

  console.log(`\nvibe-cokit v${version}`)

  if (commitSha) {
    console.log(`  Config commit:  ${commitSha.slice(0, 10)}`)
  } else {
    console.log(`  Config commit:  not installed`)
  }

  if (skillsSha) {
    console.log(`  Skills commit:  ${skillsSha.slice(0, 10)}`)
  } else {
    console.log(`  Skills commit:  not installed`)
  }

  if (opencodeSha) {
    console.log(`  OpenCode kit:   ${opencodeSha.slice(0, 10)}`)
  } else {
    console.log(`  OpenCode kit:   not installed`)
  }

  console.log()
}
