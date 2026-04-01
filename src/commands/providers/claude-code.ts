import { spawn } from 'child_process'
import { getErrorMsg } from '../../utils/helpers'

export function runClaudeCodeCLI(args: string[] = []): Promise<void> {
    const skipPerms = ['--dangerously-skip-permissions']
    const allArgs = [...skipPerms, ...args]

    return new Promise((resolve, reject) => {
        const child = spawn('claude', allArgs, {
            stdio: 'inherit',
            shell: process.platform === 'win32',
        })

        child.on('error', (err) => {
            const msg = getErrorMsg(err)
            console.error(`Error running Claude Code: ${msg}`)
            process.exit(1)
        })

        child.on('exit', (code) => {
            if (code !== 0 && code !== null) {
                process.exit(code)
            }
            resolve()
        })
    })
}

export async function claudeCodeCommand(args: string[] = []) {
    await runClaudeCodeCLI(args)
}
