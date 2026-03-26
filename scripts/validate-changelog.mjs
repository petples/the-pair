#!/usr/bin/env node
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = join(__dirname, '..')

const pkg = JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf8'))
const version = pkg.version

const changelog = readFileSync(join(rootDir, 'CHANGELOG.md'), 'utf8')
const hasEntry = changelog.includes(`## [${version}]`)

if (!hasEntry) {
  console.error(`❌ Missing changelog entry for version ${version}`)
  console.error(`\nPlease add an entry to CHANGELOG.md:\n`)
  console.error(`## [${version}] - ${new Date().toISOString().split('T')[0]}\n`)
  console.error(`### Fixed\n- Fixed ...\n`)
  process.exit(1)
}

console.log(`✅ Changelog entry found for version ${version}`)
