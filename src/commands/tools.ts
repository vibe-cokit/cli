import killPort from 'kill-port'
import { getErrorMsg } from '../utils/helpers'

async function handleKillPort(port: number) {
    try {
        console.log(`\nKilling process on port ${port}...`)
        await killPort(port)
        console.log(`✓ Port ${port} is now free\n`)
    } catch (err) {
        const msg = getErrorMsg(err)
        if (msg.toLowerCase().includes('no process')) {
            console.log(`\n✓ No process running on port ${port}\n`)
        } else {
            console.error(`\n✗ Failed to kill port ${port}: ${msg}\n`)
            process.exit(1)
        }
    }
}

export async function toolsCommand(action?: string, args: string[] = []) {
    if (!action) {
        console.log('\nvibe-cokit tools\n')
        console.log('Available tools:')
        console.log('  kill-port <port>  Kill process running on the specified port\n')
        console.log('Usage: vk tools <tool> [args]\n')
        return
    }

    switch (action) {
        case 'kill-port': {
            const portStr = args[0]
            if (!portStr) {
                console.error('\n✗ Please specify a port number. Usage: vk tools kill-port <port>\n')
                process.exit(1)
            }
            const port = parseInt(portStr, 10)
            if (isNaN(port) || port < 1 || port > 65535) {
                console.error('\n✗ Invalid port number. Must be between 1 and 65535\n')
                process.exit(1)
            }
            await handleKillPort(port)
            break
        }
        default:
            console.error(`\n✗ Unknown tool: ${action}`)
            console.log('Run "vk tools" to see available tools\n')
            process.exit(1)
    }
}
