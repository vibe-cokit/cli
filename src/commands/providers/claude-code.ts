import { exec } from 'child_process'
import { promisify } from 'util'
import { getErrorMsg } from '../../utils/helpers'

const execAsync = promisify(exec)

export async function runClaudeCodeCLI(args: string[] = []) {
    const skipPerms = ['--dangerously-skip-permissions']
    const allArgs = [...skipPerms, ...args]
    const cmd = `claude ${allArgs.join(' ')}`

    try {
        const { stdout, stderr } = await execAsync(cmd)
        if (stdout) process.stdout.write(stdout)
        if (stderr) process.stderr.write(stderr)
    } catch (err) {
        const msg = getErrorMsg(err)
        console.error(`Error running Claude Code: ${msg}`)
        process.exit(1)
    }
}

export async function claudeCodeCommand(args: string[] = []) {
    await runClaudeCodeCLI(args)
}
