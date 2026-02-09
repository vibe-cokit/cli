import { execFile } from 'child_process'
import { promisify } from 'util'
import { get, mapValues, keys, filter, some, maxBy, size } from 'lodash-es'

const exec = promisify(execFile)

export function getErrorMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

export async function checkBin(name: string): Promise<boolean> {
  try { await exec(name, ['--version']); return true } catch { return false }
}

export async function checkBinVersion(name: string): Promise<string | null> {
  try {
    const { stdout } = await exec(name, ['--version'])
    return stdout.trim().split('\n')[0] ?? null
  } catch {
    return null
  }
}

export function plural(count: number, singular: string, suffix = 's'): string {
  return `${count} ${singular}${count > 1 ? suffix : ''}`
}

export function printSummary(ok: number, fail: number, label: string, action: 'Installed' | 'Removed') {
  console.log()
  if (ok > 0) console.log(`  ✓ ${action} ${plural(ok, label)}`)
  if (fail > 0) console.log(`  ✗ Failed: ${fail}`)
  if (ok > 0) console.log(`\n  Restart Claude Code to ${action === 'Installed' ? 'activate' : 'apply'}.\n`)
}

export function maxKeyLength<T extends Record<string, unknown>>(registry: T): number {
  return size(maxBy(keys(registry), k => k.length) ?? '')
}

export function listRegistry<T extends { description: string }>(
  registry: Record<string, T>,
  header: string,
  usage: string[],
) {
  console.log(`\n${header}\n`)
  const pad = maxKeyLength(registry) + 2
  for (const [key, item] of Object.entries(registry)) {
    console.log(`  ${key.padEnd(pad)}${item.description}`)
  }
  console.log(`\nUsage:`)
  for (const line of usage) console.log(`  ${line}`)
  console.log()
}

export function validateTargets<T>(
  targets: string[],
  registry: Record<string, T>,
  errorLabel: string,
  helpCmd: string,
): boolean {
  const invalid = filter(targets, t => !registry[t])
  if (invalid.length > 0) {
    console.error(`\n✗ Unknown ${errorLabel}: ${invalid.join(', ')}`)
    console.error(`  Run '${helpCmd}' to see available ${errorLabel}.\n`)
    process.exit(1)
  }
  return true
}

export async function requireClaude() {
  if (!(await checkBin('claude'))) {
    console.error('\n✗ claude CLI not found.\n')
    process.exit(1)
  }
}

export { get, mapValues, keys, filter, some, maxBy, size }
