import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { collectReleaseAsset } from '../scripts/release-assets.mjs'

async function createBundleFile(relativePath: string, contents = 'artifact') {
  const root = await mkdtemp(join(tmpdir(), 'the-pair-release-assets-'))
  const filePath = join(root, relativePath)
  await mkdir(join(filePath, '..'), { recursive: true })
  await writeFile(filePath, contents)
  return { root, filePath }
}

test('collectReleaseAsset copies the macOS dmg into a normalized release name', async () => {
  const { root } = await createBundleFile('dmg/The Pair_1.1.6_universal.dmg', 'mac-dmg')
  await mkdir(join(root, 'macos', 'The Pair.app'), { recursive: true })

  const outDir = join(root, 'dist')
  const result = collectReleaseAsset({
    platform: 'macos',
    bundleRoot: join(root),
    outDir,
    version: '1.1.6'
  })

  assert.equal(result.destination, join(outDir, 'the-pair-1.1.6.dmg'))
  assert.equal(await readFile(result.destination, 'utf8'), 'mac-dmg')
})

test('collectReleaseAsset copies the Windows installer into a normalized release name', async () => {
  const { root } = await createBundleFile('nsis/The Pair_1.1.6_x64-setup.exe', 'windows-exe')

  const outDir = join(root, 'dist')
  const result = collectReleaseAsset({
    platform: 'windows',
    bundleRoot: root,
    outDir,
    version: '1.1.6'
  })

  assert.equal(result.destination, join(outDir, 'the-pair-1.1.6-setup.exe'))
  assert.equal(await readFile(result.destination, 'utf8'), 'windows-exe')
})

test('collectReleaseAsset copies the Linux AppImage into a normalized release name', async () => {
  const { root } = await createBundleFile(
    'appimage/The Pair_1.1.6_amd64.AppImage',
    'linux-appimage'
  )

  const outDir = join(root, 'dist')
  const result = collectReleaseAsset({
    platform: 'linux',
    bundleRoot: root,
    outDir,
    version: '1.1.6'
  })

  assert.equal(result.destination, join(outDir, 'the-pair-1.1.6.AppImage'))
  assert.equal(await readFile(result.destination, 'utf8'), 'linux-appimage')
})
