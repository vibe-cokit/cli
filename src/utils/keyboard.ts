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

interface PatternMatch {
  index: number
  length: number
}

const BINARY_BUG_PATTERN_REGEXES: RegExp[] = [
  /\.includes\(\s*["']\\x7[fF]["']\s*\)/g,
  /\.includes\(\s*["']\\u007[fF]["']\s*\)/g,
  /\.indexOf\(\s*["']\\x7[fF]["']\s*\)\s*(?:>=?\s*0|>\s*-1|!==?\s*-1)/g,
  /\.indexOf\(\s*["']\\u007[fF]["']\s*\)\s*(?:>=?\s*0|>\s*-1|!==?\s*-1)/g,
]

const BINARY_UNPATCHED_MARKER = 'deleteToken' + 'Before'
const BINARY_UNPATCHED_MARKER_RE = new RegExp(`\\b${BINARY_UNPATCHED_MARKER}\\b`)

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
    // Keep legacy pattern for generated fix and compatibility checks.
    return '.includes("\\x7F")'
  }
  // In cli.js, \x7f is literal DEL byte
  return `.includes("${DEL_CHAR}")`
}

function findNextBinaryPattern(content: string, from: number): PatternMatch | null {
  let best: PatternMatch | null = null

  for (const re of BINARY_BUG_PATTERN_REGEXES) {
    re.lastIndex = from
    const m = re.exec(content)
    if (!m || m.index < 0) continue

    const candidate: PatternMatch = { index: m.index, length: m[0].length }
    if (!best || candidate.index < best.index) {
      best = candidate
    }
  }

  return best
}

function findEnclosingIfBlock(content: string, anchorIndex: number): { start: number; end: number } | null {
  const lookback = 260
  const searchStart = Math.max(0, anchorIndex - lookback)
  const prefix = content.slice(searchStart, anchorIndex + 1)

  let ifRelStart = -1
  const ifRegex = /if\s*\(/g
  let m: RegExpExecArray | null
  while ((m = ifRegex.exec(prefix)) !== null) {
    ifRelStart = m.index
  }

  if (ifRelStart === -1) return null

  const blockStart = searchStart + ifRelStart
  const firstBrace = content.indexOf('{', blockStart)
  if (firstBrace === -1 || firstBrace < blockStart || firstBrace > anchorIndex + 220) {
    return null
  }

  let depth = 0
  const maxEnd = Math.min(content.length, blockStart + 1600)
  for (let i = firstBrace; i < maxEnd; i++) {
    const ch = content[i]
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return { start: blockStart, end: i + 1 }
    }
  }

  return null
}

function isLikelyBinaryBugBlock(block: string): boolean {
  const hasGuard = /if\s*\(\s*![\w$]+\.backspace\s*&&\s*![\w$]+\.delete\s*&&/.test(block)
  const hasDeleteChars = /\.match\(\/\\x7[fF]\/g\)/.test(block)
  const hasUpdateCalls = /[\w$]+\([\w$]+\.text\)\s*;\s*[\w$]+\([\w$]+\.offset\)/.test(block)

  return hasGuard && hasDeleteChars && hasUpdateCalls
}

function scanBinaryBugBlocks(content: string): { patchableBlocks: number; patternMatches: number } {
  let searchFrom = 0
  let patchableBlocks = 0
  let patternMatches = 0

  while (true) {
    const match = findNextBinaryPattern(content, searchFrom)
    if (!match) break

    patternMatches++
    searchFrom = match.index + Math.max(match.length, 1)

    const range = findEnclosingIfBlock(content, match.index)
    if (!range) continue

    const block = content.slice(range.start, range.end)
    if (!isLikelyBinaryBugBlock(block)) continue
    if (!BINARY_UNPATCHED_MARKER_RE.test(block)) continue

    try {
      extractBinaryVariables(block)
      patchableBlocks++
    } catch {
      // Skip unknown/unsupported block shapes
    }
  }

  return { patchableBlocks, patternMatches }
}

export async function isPatched(filePath: string): Promise<boolean> {
  const fileType = detectFileType(filePath)
  const content = await readContent(filePath, fileType)
  return content.includes(PATCH_MARKER)
}

export function findBugBlock(content: string, fileType: FileType = 'js'): { start: number; end: number; block: string } {
  if (fileType === 'binary') {
    let searchFrom = 0

    while (true) {
      const match = findNextBinaryPattern(content, searchFrom)
      if (!match) {
        throw new Error(
          'Không tìm thấy bug pattern của binary.\n' +
          'Claude Code có thể đã được Anthropic fix hoặc đổi layout.'
        )
      }

      searchFrom = match.index + Math.max(match.length, 1)
      const range = findEnclosingIfBlock(content, match.index)
      if (!range) continue

      const block = content.slice(range.start, range.end)
      if (!isLikelyBinaryBugBlock(block)) continue
      if (!BINARY_UNPATCHED_MARKER_RE.test(block)) continue

      try {
        extractBinaryVariables(block)
        return { start: range.start, end: range.end, block }
      } catch {
        continue
      }
    }
  }

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

    const range = findEnclosingIfBlock(content, idx)
    if (!range) {
      searchFrom = idx + 1
      continue
    }

    const block = content.slice(range.start, range.end)
    return { start: range.start, end: range.end, block }
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

  // Compact fix: while loop + for-of reusing counter var, no legacy delete-token helper
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
    let patched = content

    if (fileType === 'binary') {
      const beforeScan = scanBinaryBugBlocks(content)

      // Binary may have multiple copies of the bug block — patch all
      let patchCount = 0
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
        if (beforeScan.patternMatches > 0) {
          throw new Error('Phát hiện layout keyboard mới chưa được hỗ trợ patch')
        }
        throw new Error('Không tìm thấy bug block (Claude có thể đã fix upstream)')
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
      const afterScan = scanBinaryBugBlocks(verify)
      if (afterScan.patchableBlocks > 0) {
        throw new Error('Verify failed: unpatched bug block still present after binary patch')
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
  const m0 = block.match(/if\s*\(\s*!([\w$]+)\.backspace\s*&&\s*!([\w$]+)\.delete\s*&&/)
  if (!m0) throw new Error('Không trích xuất được biến key event (binary)')
  const keyEvent = m0[1]!

  // Match legacy/new layouts:
  // let|const XH=(s.match(/\x7f/g)||[]).length,WH=j;
  const m1 = block.match(
    /(?:let|const)\s+([\w$]+)\s*=\s*\(([\w$]+)\.match\(\/\\x7[fF]\/g\)\|\|\[\]\)\.length\s*[,;]\s*([\w$]+)\s*=\s*([\w$]+)[;,]/
  )
  if (!m1) throw new Error('Không trích xuất được biến count/state (binary)')

  const input = m1[2]!
  const state = m1[3]!
  const curState = m1[4]!

  const stateEsc = state.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const m2 = block.match(
    new RegExp(`([\\w$]+)\\(${stateEsc}\\.text\\)\\s*;\\s*([\\w$]+)\\(${stateEsc}\\.offset\\)`)
  )
  if (!m2) throw new Error('Không trích xuất được update functions (binary)')

  if (!block.includes(`${state}.text`) || !block.includes(`${state}.offset`)) {
    throw new Error('Block binary không hợp lệ: thiếu state usage')
  }

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

    let patched: boolean
    let hasBug: boolean

    if (fileType === 'binary') {
      const scan = scanBinaryBugBlocks(content)
      hasBug = scan.patchableBlocks > 0
      patched = !hasBug && scan.patternMatches > 0
    } else {
      const bugPattern = getBugPattern(fileType)
      patched = content.includes(PATCH_MARKER)
      hasBug = content.includes(bugPattern) && !patched
    }

    return { cliJsFound: true, cliJsPath, isPatched: patched, hasBug, isBinary: fileType === 'binary' }
  } catch {
    return { cliJsFound: false, cliJsPath: null, isPatched: false, hasBug: false, isBinary: false }
  }
}
