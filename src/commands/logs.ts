import { readdir, unlink } from 'fs/promises'
import { join } from 'path'
import { logger } from '../utils/logger'

const LOG_FILE_PATTERN = /^vk-\d{4}-\d{2}-\d{2}\.log$/

async function showLogs(lines: number): Promise<void> {
  const logDir = logger.getLogDir()
  let targetPath = logger.getLogFilePath()

  // Check if today's log exists; fall back to most recent
  if (targetPath && !(await Bun.file(targetPath).exists())) {
    targetPath = null
  }

  if (!targetPath) {
    try {
      const files = (await readdir(logDir)).filter(f => LOG_FILE_PATTERN.test(f)).sort().reverse()
      if (files.length > 0) {
        targetPath = join(logDir, files[0]!)
      }
    } catch {
      // dir doesn't exist
    }
  }

  if (!targetPath) {
    console.log('\nNo log files found. Logs are created when errors occur.')
    console.log("Run 'vk init' or any other command that fails to generate a log.\n")
    return
  }

  const content = await Bun.file(targetPath).text()
  const allLines = content.split('\n')
  const tail = allLines.slice(-lines).join('\n')
  const fileName = targetPath.split('/').pop()

  console.log(`\n--- ${fileName} (last ${lines} lines) ---`)
  console.log(tail)
}

async function clearLogs(): Promise<void> {
  const logDir = logger.getLogDir()
  let count = 0

  try {
    const files = await readdir(logDir)
    for (const file of files) {
      if (LOG_FILE_PATTERN.test(file)) {
        await unlink(join(logDir, file))
        count++
      }
    }
  } catch {
    // dir doesn't exist
  }

  if (count > 0) {
    console.log(`\n  ✓ Cleared ${count} log file${count > 1 ? 's' : ''} from ${logDir}\n`)
  } else {
    console.log('\nNo log files to clear.\n')
  }
}

export async function logsCommand(options: { tail?: number; clear?: boolean; path?: boolean }): Promise<void> {
  if (options.path) {
    console.log(logger.getLogDir())
    return
  }

  if (options.clear) {
    return clearLogs()
  }

  const lines = Number(options.tail) || 50
  return showLogs(lines)
}
