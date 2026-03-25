import { execFileSync } from 'node:child_process'
import process from 'node:process'

const requiredTargets = process.argv.slice(2)

if (requiredTargets.length === 0) {
  console.error('Usage: node scripts/ensure-rust-targets.mjs <target> [more-targets...]')
  process.exit(1)
}

function runRustup(args) {
  return execFileSync('rustup', args, { encoding: 'utf8' })
}

let installedTargets

try {
  installedTargets = runRustup(['target', 'list', '--installed'])
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
} catch (error) {
  const hint = 'Make sure Rust is installed and `rustup` is available on your PATH.'
  if (error?.code === 'ENOENT') {
    console.error(`rustup was not found. ${hint}`)
  } else {
    console.error(`Unable to inspect installed Rust targets. ${hint}`)
  }
  process.exit(1)
}

const missingTargets = requiredTargets.filter((target) => !installedTargets.includes(target))

if (missingTargets.length === 0) {
  process.exit(0)
}

console.log(`Installing missing Rust targets: ${missingTargets.join(', ')}`)

try {
  execFileSync('rustup', ['target', 'add', ...missingTargets], { stdio: 'inherit' })
} catch (error) {
  const hint = `If automatic installation fails, run \`rustup target add ${missingTargets.join(' ')}\` manually.`
  console.error(hint)
  process.exit(error?.status ?? 1)
}
