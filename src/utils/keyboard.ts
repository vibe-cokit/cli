import { homedir, platform } from 'os'
import { join, dirname, basename } from 'path'
import { readdir, stat, cp } from 'fs/promises'

const PATCH_MARKER = '/* Vietnamese IME fix */'
const DEL_CHAR = '\x7f'

export interface VarMap {
  input: string
  state: string
  curState: string
  updateText: string
  updateOffset: string
}

export interface PatchResult {
  success: boolean
  message: string
  backupPath?: string
}

export interface KeyboardStatus {
  cliJsFound: boolean
  cliJsPath: string | null
  isPatched: boolean
  hasBug: boolean
}

export async function findCliJs(): Promise<string> {
  const home = homedir()
  const isWin = platform() === 'win32'

  const searchDirs = isWin
    ? [
        join(process.env.LOCALAPPDATA ?? '', 'npm-cache', '_npx'),
        join(process.env.APPDATA ?? '', 'npm', 'node_modules'),
      ]
    : [
        join(home, '.npm', '_npx'),
        join(home, '.nvm', 'versions', 'node'),
        '/usr/local/lib/node_modules',
        '/opt/homebrew/lib/node_modules',
      ]

  for (const dir of searchDirs) {
    try {
      const s = await stat(dir)
      if (!s.isDirectory()) continue
    } catch {
      continue
    }

    const found = await findCliJsRecursive(dir, 0, 5)
    if (found) return found
  }

  throw new Error(
    'Không tìm thấy Claude Code npm.\n' +
    'Cài đặt trước: npm install -g @anthropic-ai/claude-code'
  )
}

async function findCliJsRecursive(dir: string, depth: number, maxDepth: number): Promise<string | null> {
  if (depth >= maxDepth) return null
  try {
    const entries = await readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const fullPath = join(dir, entry.name)
      if (entry.name === '@anthropic-ai') {
        const cliJs = join(fullPath, 'claude-code', 'cli.js')
        try {
          const s = await stat(cliJs)
          if (s.isFile()) return cliJs
        } catch { /* not here */ }
        continue
      }
      // Skip node_modules inside packages to avoid deep nesting
      if (entry.name === 'node_modules' && depth > 0) continue
      const found = await findCliJsRecursive(fullPath, depth + 1, maxDepth)
      if (found) return found
    }
  } catch { /* permission denied etc */ }
  return null
}

export async function isPatched(filePath: string): Promise<boolean> {
  const file = Bun.file(filePath)
  const content = await file.text()
  return content.includes(PATCH_MARKER)
}

export function findBugBlock(content: string): { start: number; end: number; block: string } {
  const pattern = `.includes("${DEL_CHAR}")`
  const idx = content.indexOf(pattern)

  if (idx === -1) {
    throw new Error(
      'Không tìm thấy bug pattern .includes("\\x7f").\n' +
      'Claude Code có thể đã được Anthropic fix.'
    )
  }

  const searchStart = Math.max(0, idx - 150)
  const blockStart = content.lastIndexOf('if(', idx)
  if (blockStart === -1 || blockStart < searchStart) {
    throw new Error('Không tìm thấy block if chứa pattern')
  }

  let depth = 0
  let blockEnd = idx
  const slice = content.slice(blockStart, blockStart + 800)
  for (let i = 0; i < slice.length; i++) {
    if (slice[i] === '{') depth++
    else if (slice[i] === '}') {
      depth--
      if (depth === 0) {
        blockEnd = blockStart + i + 1
        break
      }
    }
  }

  if (depth !== 0) {
    throw new Error('Không tìm thấy closing brace của block if')
  }

  return {
    start: blockStart,
    end: blockEnd,
    block: content.slice(blockStart, blockEnd),
  }
}

export function extractVariables(block: string): VarMap {
  const normalized = block.replaceAll(DEL_CHAR, '\\x7f')

  // Match: let COUNT=(INPUT.match(/\x7f/g)||[]).length,STATE=CURSTATE;
  const m1 = normalized.match(
    /let ([\w$]+)=\(\w+\.match\(\/\\x7f\/g\)\|\|\[\]\)\.length[,;]([\w$]+)=([\w$]+)[;,]/
  )
  if (!m1) throw new Error('Không trích xuất được biến count/state')

  const state = m1[2]!
  const curState = m1[3]!

  // Match: UPDATETEXT(STATE.text);UPDATEOFFSET(STATE.offset)
  const stateEsc = state.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const m2 = block.match(
    new RegExp(`([\\w$]+)\\(${stateEsc}\\.text\\);([\\w$]+)\\(${stateEsc}\\.offset\\)`)
  )
  if (!m2) throw new Error('Không trích xuất được update functions')

  // Match: INPUT.includes("
  const m3 = block.match(/([\w$]+)\.includes\("/)
  if (!m3) throw new Error('Không trích xuất được input variable')

  return {
    input: m3[1]!,
    state,
    curState,
    updateText: m2[1]!,
    updateOffset: m2[2]!,
  }
}

export function generateFix(vars: VarMap): string {
  const v = vars
  return (
    `${PATCH_MARKER}` +
    `if(${v.input}.includes("\\x7f")){` +
    `let _n=(${v.input}.match(/\\x7f/g)||[]).length,` +
    `_vn=${v.input}.replace(/\\x7f/g,""),` +
    `${v.state}=${v.curState};` +
    `for(let _i=0;_i<_n;_i++)${v.state}=${v.state}.backspace();` +
    `for(const _c of _vn)${v.state}=${v.state}.insert(_c);` +
    `if(!${v.curState}.equals(${v.state})){` +
    `if(${v.curState}.text!==${v.state}.text)` +
    `${v.updateText}(${v.state}.text);` +
    `${v.updateOffset}(${v.state}.offset)` +
    `}return;}`
  )
}

export async function patchCliJs(filePath: string): Promise<PatchResult> {
  const file = Bun.file(filePath)
  if (!(await file.exists())) {
    return { success: false, message: `File không tồn tại: ${filePath}` }
  }

  const content = await file.text()

  if (content.includes(PATCH_MARKER)) {
    return { success: false, message: 'Đã patch trước đó' }
  }

  // Backup
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const backupPath = `${filePath}.backup-${timestamp}`
  await cp(filePath, backupPath)

  try {
    const { start, end } = findBugBlock(content)
    const block = content.slice(start, end)
    const vars = extractVariables(block)
    const fix = generateFix(vars)
    const patched = content.slice(0, start) + fix + content.slice(end)

    await Bun.write(filePath, patched)

    // Verify
    const verify = await Bun.file(filePath).text()
    if (!verify.includes(PATCH_MARKER)) {
      throw new Error('Verify failed: patch marker not found after write')
    }

    return { success: true, message: 'Patch thành công', backupPath }
  } catch (err) {
    // Rollback
    try {
      await cp(backupPath, filePath)
      const { unlink } = await import('fs/promises')
      await unlink(backupPath)
    } catch { /* ignore rollback errors */ }

    return {
      success: false,
      message: err instanceof Error ? err.message : String(err),
    }
  }
}

export async function restoreCliJs(filePath: string): Promise<boolean> {
  const dir = dirname(filePath)
  const name = basename(filePath)

  const entries = await readdir(dir)
  const backups = entries
    .filter(f => f.startsWith(`${name}.backup-`))
    .map(f => join(dir, f))

  if (backups.length === 0) return false

  // Sort by mtime, newest first
  const withMtime = await Promise.all(
    backups.map(async p => ({ path: p, mtime: (await stat(p)).mtimeMs }))
  )
  withMtime.sort((a, b) => b.mtime - a.mtime)

  await cp(withMtime[0]!.path, filePath)
  return true
}

export async function checkKeyboardStatus(): Promise<KeyboardStatus> {
  try {
    const cliJsPath = await findCliJs()
    const file = Bun.file(cliJsPath)
    const content = await file.text()
    const patched = content.includes(PATCH_MARKER)
    const hasBug = content.includes(`.includes("${DEL_CHAR}")`)

    return { cliJsFound: true, cliJsPath, isPatched: patched, hasBug: !patched && hasBug }
  } catch {
    return { cliJsFound: false, cliJsPath: null, isPatched: false, hasBug: false }
  }
}
