import { homedir } from 'os'
import { join } from 'path'
import { mkdir, readdir, stat, unlink, appendFile } from 'fs/promises'

const DEFAULT_LOG_DIR = join(homedir(), '.vk', 'logs')
const RETENTION_DAYS = 7
const LOG_FILE_PATTERN = /^vk-\d{4}-\d{2}-\d{2}\.log$/

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]!
}

function padLevel(level: string): string {
  return level.toUpperCase().padEnd(5)
}

function formatEntry(level: string, command: string, msg: string, err?: unknown): string {
  const ts = new Date().toISOString()
  let entry = `[${ts}] ${padLevel(level)} [${command}] ${msg}\n`
  if (err instanceof Error && err.stack) {
    const stackLines = err.stack.split('\n').slice(1).map(l => `    ${l.trim()}`).join('\n')
    entry += `  Stack: ${err.message}\n${stackLines}\n`
  }
  return entry
}

export class Logger {
  private logDir: string
  private logFilePath: string | null = null
  private debugMode = false
  private ready = false

  constructor(logDir?: string) {
    this.logDir = logDir ?? DEFAULT_LOG_DIR
  }

  async init(debugMode = false): Promise<void> {
    this.debugMode = debugMode
    try {
      await mkdir(this.logDir, { recursive: true })
      this.logFilePath = join(this.logDir, `vk-${formatDate(new Date())}.log`)
      await this.runRotation()
      this.ready = true
    } catch {
      // Graceful failure — if we can't create the log dir, just skip logging
    }
  }

  private async runRotation(): Promise<void> {
    try {
      const files = await readdir(this.logDir)
      const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000

      for (const file of files) {
        if (!LOG_FILE_PATTERN.test(file)) continue
        const filePath = join(this.logDir, file)
        try {
          const s = await stat(filePath)
          if (s.mtimeMs < cutoff) {
            await unlink(filePath)
          }
        } catch {
          // skip files we can't stat
        }
      }
    } catch {
      // skip rotation errors
    }
  }

  private async write(level: string, command: string, msg: string, err?: unknown): Promise<void> {
    if (!this.ready || !this.logFilePath) return
    if (!this.debugMode && level === 'debug') return

    try {
      const entry = formatEntry(level, command, msg, err)
      await appendFile(this.logFilePath, entry, 'utf-8')
    } catch {
      // Graceful failure — never let logging crash the CLI
    }
  }

  async debug(command: string, msg: string): Promise<void> {
    return this.write('debug', command, msg)
  }

  async info(command: string, msg: string): Promise<void> {
    return this.write('info', command, msg)
  }

  async warn(command: string, msg: string): Promise<void> {
    return this.write('warn', command, msg)
  }

  async error(command: string, msg: string, err?: unknown): Promise<void> {
    return this.write('error', command, msg, err)
  }

  getLogDir(): string {
    return this.logDir
  }

  getLogFilePath(): string | null {
    return this.logFilePath
  }
}

export const logger = new Logger()
