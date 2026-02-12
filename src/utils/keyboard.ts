import { homedir, platform } from 'os'
import { join, dirname, basename } from 'path'
import { readdir, stat, cp, readFile, writeFile } from 'fs/promises'

const PATCH_MARKER = '/* Vietnamese IME fix */'
const DEL_CHAR = '\x7f'

export interface VarMap {
  input: string
  state: string
  curState: string
  updateText: string
  updateOffset: string
  keyEvent?: string
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
  isBinary: boolean
}

type FileType = 'js' | 'binary'

function detectFileType(filePath: string): FileType {
  // Native binary lives in ~/.local/share/claude/versions/
  if (filePath.includes('/claude/versions/') || filePath.includes('\\claude\\versions\\')) {
    return 'binary'
  }
  return 'js'
}

export async function findCliJs(): Promise<string> {
  const home = homedir()
  const isWin = platform() === 'win32'

  // 1. Check native binary first (fastest)
  const nativePath = join(home, '.local', 'share', 'claude', 'versions')
  try {
    const s = await stat(nativePath)
    if (s.isDirectory()) {
      const entries = await readdir(nativePath)
      // Find latest version (sort by name, versions are semver-like)
      const versions = entries.filter(e => /^\d+\.\d+\.\d+$/.test(e))
      versions.sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
      for (const ver of versions) {
        const binPath = join(nativePath, ver)
        try {
          const bs = await stat(binPath)
          if (bs.isFile()) return binPath
        } catch { /* skip */ }
      }
    }
  } catch { /* native not installed */ }

  // 2. Search npm locations
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
    'Không tìm thấy Claude Code.\n' +
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
      if (entry.name === 'node_modules' && depth > 0) continue
      const found = await findCliJsRecursive(fullPath, depth + 1, maxDepth)
      if (found) return found
    }
  } catch { /* permission denied etc */ }
  return null
}

async function readContent(filePath: string, fileType: FileType): Promise<string> {
  if (fileType === 'binary') {
    const buf = await readFile(filePath)
    return buf.toString('latin1')
  }
  return Bun.file(filePath).text()
}

async function writeContent(filePath: string, content: string, fileType: FileType): Promise<void> {
  if (fileType === 'binary') {
    const bytes = Buffer.from(content, 'latin1')
    await writeFile(filePath, bytes)
  } else {
    await Bun.write(filePath, content)
  }
}

function getBugPattern(fileType: FileType): string {
  if (fileType === 'binary') {
    // In binary, \x7F is stored as escaped 4-char text: \x7F
    return '.includes("\\x7F")'
  }
  // In cli.js, \x7f is literal DEL byte
  return `.includes("${DEL_CHAR}")`
}

export async function isPatched(filePath: string): Promise<boolean> {
  const fileType = detectFileType(filePath)
  const content = await readContent(filePath, fileType)
  return content.includes(PATCH_MARKER)
}

export function findBugBlock(content: string, fileType: FileType = 'js'): { start: number; end: number; block: string } {
  const pattern = getBugPattern(fileType)
  let searchFrom = 0

  while (true) {
    const idx = content.indexOf(pattern, searchFrom)

    if (idx === -1) {
      throw new Error(
        'Không tìm thấy bug pattern .includes("\\x7f").\n' +
        'Claude Code có thể đã được Anthropic fix.'
      )
    }

    const searchStart = Math.max(0, idx - 150)
    const blockStart = content.lastIndexOf('if(', idx)
    if (blockStart === -1 || blockStart < searchStart) {
      // Skip this occurrence — can't find enclosing if block
      searchFrom = idx + 1
      continue
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
      searchFrom = idx + 1
      continue
    }

    const block = content.slice(blockStart, blockEnd)

    // For binary: skip already-patched blocks (they don't contain deleteTokenBefore)
    if (fileType === 'binary' && !block.includes('deleteTokenBefore')) {
      searchFrom = idx + 1
      continue
    }

    return { start: blockStart, end: blockEnd, block }
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

function generateBinaryFix(block: string, vars: VarMap): string {
  // For binary: fix must be EXACTLY the same length as original block
  const v = vars
  // Extract counter var name from original block
  const counterMatch = block.match(/let ([\w$]+)=\(/)
  const counter = counterMatch?.[1] ?? 'XH'
  // Use key event var extracted from block (e.g. EH from if(!EH.backspace...))
  const ke = v.keyEvent ?? 'FH'

  // Compact fix: while loop + for-of reusing counter var, no deleteTokenBefore
  let fix =
    `if(!${ke}.backspace&&!${ke}.delete&&${v.input}.includes("\\x7F")){` +
    `let ${counter}=(${v.input}.match(/\\x7f/g)||[]).length,` +
    `${v.state}=${v.curState};` +
    `while(${counter}--)${v.state}=${v.state}.backspace();` +
    `for(${counter} of ${v.input}.replace(/\\x7f/g,""))${v.state}=${v.state}.insert(${counter});` +
    `if(!${v.curState}.equals(${v.state})){` +
    `if(${v.curState}.text!==${v.state}.text)` +
    `${v.updateText}(${v.state}.text);` +
    `${v.updateOffset}(${v.state}.offset)` +
    `}return}`

  const diff = block.length - fix.length
  if (diff > 0) {
    // Pad with spaces before closing brace
    fix = fix.slice(0, -1) + ' '.repeat(diff) + '}'
  } else if (diff < 0) {
    throw new Error(`Fix code quá dài (${-diff} bytes). Không thể patch binary.`)
  }

  return fix
}

export async function patchCliJs(filePath: string): Promise<PatchResult> {
  const fileType = detectFileType(filePath)

  try {
    await stat(filePath)
  } catch {
    return { success: false, message: `File không tồn tại: ${filePath}` }
  }

  const content = await readContent(filePath, fileType)

  if (content.includes(PATCH_MARKER)) {
    return { success: false, message: 'Đã patch trước đó' }
  }

  // Backup
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const backupDir = fileType === 'binary' ? '/tmp' : dirname(filePath)
  const backupPath = join(backupDir, `${basename(filePath)}.backup-${timestamp}`)
  await cp(filePath, backupPath)

  try {
    const bugPattern = getBugPattern(fileType)
    let patched = content

    if (fileType === 'binary') {
      // Binary may have multiple copies of the bug block — patch all
      let patchCount = 0
      // findBugBlock for binary skips already-patched blocks,
      // so we loop until it throws (no more unpatched blocks)
      while (patchCount < 10) {
        try {
          const { start, end, block } = findBugBlock(patched, fileType)
          const vars = extractBinaryVariables(block)
          const fix = generateBinaryFix(block, vars)
          patched = patched.slice(0, start) + fix + patched.slice(end)
          patchCount++
        } catch {
          break // No more unpatched bug blocks
        }
      }
      if (patchCount === 0) {
        throw new Error('Không tìm thấy bug block')
      }
    } else {
      const { start, end, block } = findBugBlock(content, fileType)
      const vars = extractVariables(block)
      const fix = generateFix(vars)
      patched = content.slice(0, start) + fix + content.slice(end)
    }

    // Verify same length for binary
    if (fileType === 'binary' && patched.length !== content.length) {
      throw new Error(`Binary patch size mismatch: ${patched.length} vs ${content.length}`)
    }

    await writeContent(filePath, patched, fileType)

    // Verify
    const verify = await readContent(filePath, fileType)
    if (fileType === 'binary') {
      // Verify no unpatched bug blocks remain
      // bugPattern (.includes("\\x7F")) still exists in the FIX code, so we can't
      // just check its presence. Instead, check that no if-block containing
      // bugPattern also contains deleteTokenBefore (which is the old buggy code).
      let searchPos = 0
      while (true) {
        const pos = verify.indexOf(bugPattern, searchPos)
        if (pos === -1) break
        // Check surrounding ~300 chars for deleteTokenBefore
        const vicinity = verify.slice(Math.max(0, pos - 100), pos + 300)
        if (vicinity.includes('deleteTokenBefore')) {
          throw new Error('Verify failed: unpatched bug block still present after binary patch')
        }
        searchPos = pos + 1
      }
    } else {
      if (!verify.includes(PATCH_MARKER)) {
        throw new Error('Verify failed: patch marker not found after write')
      }
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

function extractBinaryVariables(block: string): VarMap {
  // In binary, \x7F is escaped text (4 chars), not literal DEL byte
  // Extract key event variable from: if(!EH.backspace&&!EH.delete&&...
  const m0 = block.match(/if\(!(\w+)\.backspace/)
  if (!m0) throw new Error('Không trích xuất được biến key event (binary)')
  const keyEvent = m0[1]!

  // Match: let XH=(s.match(/\x7f/g)||[]).length,WH=j;
  const m1 = block.match(
    /let ([\w$]+)=\(([\w$]+)\.match\(\/\\x7f\/g\)\|\|\[\]\)\.length,([\w$]+)=([\w$]+)[;,]/
  )
  if (!m1) throw new Error('Không trích xuất được biến count/state (binary)')

  const input = m1[2]!
  const state = m1[3]!
  const curState = m1[4]!

  // Match: $(WH.text);z(WH.offset)
  const stateEsc = state.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const m2 = block.match(
    new RegExp(`([\\w$]+)\\(${stateEsc}\\.text\\);([\\w$]+)\\(${stateEsc}\\.offset\\)`)
  )
  if (!m2) throw new Error('Không trích xuất được update functions (binary)')

  return {
    input,
    state,
    curState,
    updateText: m2[1]!,
    updateOffset: m2[2]!,
    keyEvent,
  }
}

export async function restoreCliJs(filePath: string): Promise<boolean> {
  const dir = dirname(filePath)
  const name = basename(filePath)

  // Search for backups in both the original dir and /tmp
  const searchDirs = [dir, '/tmp']
  const allBackups: string[] = []

  for (const d of searchDirs) {
    try {
      const entries = await readdir(d)
      const found = entries
        .filter(f => f.startsWith(`${name}.backup-`))
        .map(f => join(d, f))
      allBackups.push(...found)
    } catch { /* dir not readable */ }
  }

  if (allBackups.length === 0) return false

  const withMtime = await Promise.all(
    allBackups.map(async (p: string) => ({ path: p, mtime: (await stat(p)).mtimeMs }))
  )
  withMtime.sort((a, b) => b.mtime - a.mtime)

  await cp(withMtime[0]!.path, filePath)
  return true
}

export async function checkKeyboardStatus(): Promise<KeyboardStatus> {
  try {
    const cliJsPath = await findCliJs()
    const fileType = detectFileType(cliJsPath)
    const content = await readContent(cliJsPath, fileType)
    const bugPattern = getBugPattern(fileType)

    let patched: boolean
    let hasBug: boolean

    if (fileType === 'binary') {
      // Check if any occurrence of bugPattern is near deleteTokenBefore
      // If yes → unpatched bug block exists. If no → already patched (or no bug).
      let hasUnpatchedBlock = false
      let searchPos = 0
      while (true) {
        const pos = content.indexOf(bugPattern, searchPos)
        if (pos === -1) break
        const vicinity = content.slice(Math.max(0, pos - 100), pos + 300)
        if (vicinity.includes('deleteTokenBefore')) {
          hasUnpatchedBlock = true
          break
        }
        searchPos = pos + 1
      }
      hasBug = hasUnpatchedBlock
      // Patched if bugPattern exists (in fix code) but no unpatched blocks remain
      patched = content.includes(bugPattern) && !hasUnpatchedBlock
    } else {
      patched = content.includes(PATCH_MARKER)
      hasBug = content.includes(bugPattern) && !patched
    }

    return { cliJsFound: true, cliJsPath, isPatched: patched, hasBug, isBinary: fileType === 'binary' }
  } catch {
    return { cliJsFound: false, cliJsPath: null, isPatched: false, hasBug: false, isBinary: false }
  }
}
