import { mkdirSync, copyFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join, resolve } from 'node:path'
import process from 'node:process'

const platformConfigs = {
  macos: {
    subdir: 'dmg',
    outputName: (version) => `the-pair-${version}.dmg`,
    patterns: [/\.dmg$/i]
  },
  windows: {
    subdir: 'nsis',
    outputName: (version) => `the-pair-${version}-setup.exe`,
    patterns: [/-setup\.exe$/i, /\.exe$/i]
  },
  linux: {
    subdir: 'appimage',
    outputName: (version) => `the-pair-${version}.AppImage`,
    patterns: [/\.AppImage$/i]
  }
}

function parseArgs(argv) {
  const options = {}

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    if (!token.startsWith('--')) {
      continue
    }

    const next = argv[index + 1]
    if (!next || next.startsWith('--')) {
      throw new Error(`Missing value for ${token}`)
    }

    options[token.slice(2)] = next
    index += 1
  }

  return options
}

function walkFiles(rootDir) {
  const entries = []

  for (const entry of readdirSync(rootDir, { withFileTypes: true }).sort((left, right) =>
    left.name.localeCompare(right.name)
  )) {
    const absolutePath = join(rootDir, entry.name)
    if (entry.isDirectory()) {
      entries.push(...walkFiles(absolutePath))
      continue
    }

    if (entry.isFile()) {
      entries.push(absolutePath)
    }
  }

  return entries
}

function findAsset(bundleRoot, platform) {
  const config = platformConfigs[platform]
  if (!config) {
    throw new Error(`Unsupported platform: ${platform}`)
  }

  const searchRoot = resolve(bundleRoot, config.subdir)
  if (!statSync(searchRoot, { throwIfNoEntry: false })) {
    throw new Error(`Expected bundle directory at ${searchRoot}`)
  }

  const candidates = walkFiles(searchRoot).filter((filePath) =>
    config.patterns.some((pattern) => pattern.test(filePath))
  )

  if (candidates.length === 0) {
    throw new Error(`No release asset found for ${platform} under ${searchRoot}`)
  }

  return candidates[0]
}

export function collectReleaseAsset({ platform, bundleRoot, outDir, version }) {
  const config = platformConfigs[platform]
  if (!config) {
    throw new Error(`Unsupported platform: ${platform}`)
  }

  const source = findAsset(bundleRoot, platform)
  mkdirSync(outDir, { recursive: true })

  const destination = join(outDir, config.outputName(version))
  copyFileSync(source, destination)

  return { source, destination }
}

function main() {
  const options = parseArgs(process.argv.slice(2))
  const platform = options.platform
  const bundleRoot = options['bundle-root']
  const outDir = options['out-dir']
  const version = options.version

  if (!platform || !bundleRoot || !outDir || !version) {
    throw new Error(
      'Usage: node scripts/release-assets.mjs --platform <macos|windows|linux> --bundle-root <path> --out-dir <path> --version <version>'
    )
  }

  const result = collectReleaseAsset({ platform, bundleRoot, outDir, version })
  console.log(`Copied ${result.source} -> ${result.destination}`)
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    main()
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
}
