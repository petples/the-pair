#!/usr/bin/env node
// Clear local build and dev caches
import { rmSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

const dirs = ['node_modules/.vite', 'dist', 'out', '.pair']
const files = ['.eslintcache']
const rustTarget = resolve(root, 'src-tauri', 'target')

let removed = 0

for (const dir of dirs) {
  const p = resolve(root, dir)
  if (existsSync(p)) {
    rmSync(p, { recursive: true, force: true })
    console.log(`✓ Removed ${dir}/`)
    removed++
  }
}

for (const file of files) {
  const p = resolve(root, file)
  if (existsSync(p)) {
    rmSync(p, { force: true })
    console.log(`✓ Removed ${file}`)
    removed++
  }
}

if (existsSync(rustTarget)) {
  rmSync(rustTarget, { recursive: true, force: true })
  console.log('✓ Removed src-tauri/target/')
  removed++
}

if (removed === 0) {
  console.log('Nothing to clean.')
} else {
  console.log(`\nCleaned ${removed} item(s).`)
}
