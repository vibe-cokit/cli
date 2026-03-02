import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { rm, mkdir, writeFile, readdir, utimes } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { Logger } from '../src/utils/logger'

describe('Logger', () => {
  let tempDir: string
  let logger: Logger

  beforeEach(async () => {
    tempDir = join(tmpdir(), `vk-test-${crypto.randomUUID()}`)
    logger = new Logger(tempDir)
  })

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true })
  })

  it('creates log directory on init if it does not exist', async () => {
    await logger.init(false)
    const files = await readdir(tempDir)
    expect(files).toBeDefined()
  })

  it('creates date-based log file on first write', async () => {
    await logger.init(false)
    await logger.error('cmd', 'test error')
    const files = await readdir(tempDir)
    expect(files.length).toBe(1)
    expect(files[0]).toMatch(/^vk-\d{4}-\d{2}-\d{2}\.log$/)
  })

  it('appends entries on subsequent writes (does not overwrite)', async () => {
    await logger.init(false)
    await logger.error('cmd', 'first error')
    await logger.error('cmd', 'second error')
    const logFile = logger.getLogFilePath()!
    const content = await Bun.file(logFile).text()
    expect(content).toContain('first error')
    expect(content).toContain('second error')
  })

  it('formats ERROR entry with timestamp, level, command, message', async () => {
    await logger.init(false)
    await logger.error('init', 'something broke')
    const logFile = logger.getLogFilePath()!
    const content = await Bun.file(logFile).text()
    expect(content).toMatch(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] ERROR \[init\] something broke/)
  })

  it('includes stack trace in ERROR entry when err is an Error object', async () => {
    await logger.init(false)
    const testErr = new Error('test failure')
    await logger.error('cmd', 'failed', testErr)
    const logFile = logger.getLogFilePath()!
    const content = await Bun.file(logFile).text()
    expect(content).toContain('  Stack: test failure')
  })

  it('omits stack trace when err is undefined', async () => {
    await logger.init(false)
    await logger.error('cmd', 'no stack')
    const logFile = logger.getLogFilePath()!
    const content = await Bun.file(logFile).text()
    expect(content).not.toContain('Stack:')
  })

  it('does NOT write DEBUG entry when debugMode is false', async () => {
    await logger.init(false)
    await logger.debug('cmd', 'debug msg')
    const logFile = logger.getLogFilePath()!
    const exists = await Bun.file(logFile).exists()
    if (exists) {
      const content = await Bun.file(logFile).text()
      expect(content).not.toContain('DEBUG')
    }
  })

  it('writes DEBUG entry when debugMode is true', async () => {
    await logger.init(true)
    await logger.debug('cmd', 'debug msg')
    const logFile = logger.getLogFilePath()!
    const content = await Bun.file(logFile).text()
    expect(content).toContain('DEBUG')
    expect(content).toContain('debug msg')
  })

  it('always writes INFO entry regardless of debugMode', async () => {
    await logger.init(false)
    await logger.info('cmd', 'info msg')
    const logFile = logger.getLogFilePath()!
    const content = await Bun.file(logFile).text()
    expect(content).toContain('INFO')
    expect(content).toContain('info msg')
  })

  it('always writes WARN entry regardless of debugMode', async () => {
    await logger.init(false)
    await logger.warn('cmd', 'warn msg')
    const logFile = logger.getLogFilePath()!
    const content = await Bun.file(logFile).text()
    expect(content).toContain('WARN')
    expect(content).toContain('warn msg')
  })

  it('does not throw if log directory is unwritable', async () => {
    const badLogger = new Logger('/nonexistent/deep/nested/path')
    // Should not throw
    await badLogger.init(false)
    await badLogger.error('cmd', 'should not throw')
  })

  it('deletes log files older than 7 days on init', async () => {
    await mkdir(tempDir, { recursive: true })

    // Create 3 fake log files
    const fresh = join(tempDir, 'vk-2026-03-02.log')
    const stale1 = join(tempDir, 'vk-2026-02-20.log')
    const stale2 = join(tempDir, 'vk-2026-02-19.log')

    await writeFile(fresh, 'fresh log')
    await writeFile(stale1, 'stale log 1')
    await writeFile(stale2, 'stale log 2')

    // Set mtime to 8 days ago for stale files
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000)
    await utimes(stale1, eightDaysAgo, eightDaysAgo)
    await utimes(stale2, eightDaysAgo, eightDaysAgo)

    await logger.init(false)

    const remaining = await readdir(tempDir)
    const logFiles = remaining.filter(f => f.startsWith('vk-'))
    // Fresh file stays, stale files deleted. Today's log may or may not exist yet.
    expect(logFiles).toContain('vk-2026-03-02.log')
    expect(logFiles).not.toContain('vk-2026-02-20.log')
    expect(logFiles).not.toContain('vk-2026-02-19.log')
  })

  it('keeps log files 7 days old or newer on init', async () => {
    await mkdir(tempDir, { recursive: true })

    const recent = join(tempDir, 'vk-2026-02-28.log')
    await writeFile(recent, 'recent log')

    // Set mtime to 6 days ago
    const sixDaysAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000)
    await utimes(recent, sixDaysAgo, sixDaysAgo)

    await logger.init(false)

    const remaining = await readdir(tempDir)
    expect(remaining).toContain('vk-2026-02-28.log')
  })

  it('getLogDir returns correct path', () => {
    expect(logger.getLogDir()).toBe(tempDir)
  })

  it('getLogFilePath returns today dated path after init', async () => {
    await logger.init(false)
    const logFile = logger.getLogFilePath()
    expect(logFile).toMatch(/vk-\d{4}-\d{2}-\d{2}\.log$/)
  })
})
