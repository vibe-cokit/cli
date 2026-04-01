import { spawn } from 'child_process'
import { getErrorMsg } from '../../utils/helpers'

export function runGeminiCLI(args: string[] = []): Promise<void> {
    return new Promise((resolve, reject) => {
        const child = spawn('gemini', args, {
            stdio: 'inherit',
            shell: process.platform === 'win32',
        })

        child.on('error', (err) => {
            const msg = getErrorMsg(err)
            console.error(`Error running Gemini CLI: ${msg}`)
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

export async function geminiCLICommand(args: string[] = []) {
    await runGeminiCLI(args)
}
