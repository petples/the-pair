import { existsSync } from 'node:fs'
import { spawn } from 'node:child_process'
import process from 'node:process'

import { getRustupBinDir, prependPathEntry } from './rustup-env.mjs'

const rustupBinDir = getRustupBinDir()

function main() {
  const [command, ...args] = process.argv.slice(2)

  if (!command) {
    throw new Error('Usage: node scripts/run-with-rustup.mjs <command> [args...]')
  }

  if (!existsSync(rustupBinDir)) {
    throw new Error(`Rustup shims were not found at ${rustupBinDir}`)
  }

  const env = {
    ...process.env,
    PATH: prependPathEntry(rustupBinDir, process.env.PATH ?? '')
  }

  const child = spawn(command, args, {
    env,
    stdio: 'inherit',
    shell: false
  })

  child.on('error', (error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  })

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal)
      return
    }

    process.exit(code ?? 1)
  })
}

try {
  main()
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
}
