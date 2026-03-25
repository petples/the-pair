import { existsSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import process from 'node:process'

import { getRustupBinDir, prependPathEntry } from './rustup-env.mjs'

const require = createRequire(import.meta.url)
const rustupBinDir = getRustupBinDir()

export function getPathEnvKey(env = process.env) {
  return Object.keys(env).find((key) => key.toLowerCase() === 'path') ?? 'PATH'
}

export function resolveLaunchCommand(command) {
  if (command === 'tauri') {
    return {
      command: process.execPath,
      args: [require.resolve('@tauri-apps/cli/tauri.js')]
    }
  }

  return {
    command,
    args: []
  }
}

function main() {
  const [command, ...args] = process.argv.slice(2)

  if (!command) {
    throw new Error('Usage: node scripts/run-with-rustup.mjs <command> [args...]')
  }

  if (!existsSync(rustupBinDir)) {
    throw new Error(`Rustup shims were not found at ${rustupBinDir}`)
  }

  const pathKey = getPathEnvKey(process.env)
  const env = {
    ...process.env,
    [pathKey]: prependPathEntry(rustupBinDir, process.env[pathKey] ?? '')
  }

  const { command: launchCommand, args: launchArgs } = resolveLaunchCommand(command)

  const child = spawn(launchCommand, [...launchArgs, ...args], {
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

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    main()
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
}
