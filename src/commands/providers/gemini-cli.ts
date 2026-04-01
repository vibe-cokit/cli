import { exec } from 'child_process'
import { promisify } from 'util'
import { getErrorMsg } from '../../utils/helpers'

const execAsync = promisify(exec)

export async function runGeminiCLI(args: string[] = []) {
    const cmd = `gemini ${args.join(' ')}`

    try {
        const { stdout, stderr } = await execAsync(cmd)
        if (stdout) process.stdout.write(stdout)
        if (stderr) process.stderr.write(stderr)
    } catch (err) {
        const msg = getErrorMsg(err)
        console.error(`Error running Gemini CLI: ${msg}`)
        process.exit(1)
    }
}

export async function geminiCLICommand(args: string[] = []) {
    await runGeminiCLI(args)
}
