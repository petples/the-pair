import { homedir } from 'node:os'
import { join, resolve } from 'node:path'

export function resolveRustupHome() {
  if (process.env.CARGO_HOME) {
    return resolve(process.env.CARGO_HOME)
  }

  return join(homedir(), '.cargo')
}

export function getRustupBinDir() {
  return join(resolveRustupHome(), 'bin')
}
