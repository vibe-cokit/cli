import { exec } from 'child_process'
import { promisify } from 'util'
import { getErrorMsg, logError } from '../utils/helpers'

const execAsync = promisify(exec)

export async function dockerStopAllCommand() {
    try {
        console.log(`\nStopping all Docker containers...`)
        const { stdout: containerIds } = await execAsync('docker ps -a -q')
        
        if (!containerIds.trim()) {
            console.log(`✓ No Docker containers found to stop\n`)
            return
        }

        const ids = containerIds.trim().replace(/\n/g, ' ')
        const { stdout } = await execAsync(`docker stop ${ids}`)
        
        console.log(`✓ Successfully stopped containers:\n${stdout.trim()}\n`)
    } catch (err) {
        const msg = getErrorMsg(err)
        logError('docker container stop all', err)
        console.error(`\n✗ Failed to stop containers:\n${msg}\n`)
        process.exit(1)
    }
}
