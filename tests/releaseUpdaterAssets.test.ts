import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import test from 'node:test'

import { collectUpdaterAssets } from '../scripts/release-updater-assets.mjs'

async function createTempFile(relativePath: string, contents = 'artifact') {
  const root = await mkdtemp(join(tmpdir(), 'the-pair-updater-assets-'))
  const filePath = join(root, relativePath)
  await mkdir(join(filePath, '..'), { recursive: true })
  await writeFile(filePath, contents)
  return { root, filePath }
}

test('collectUpdaterAssets copies macOS updater archives and signatures', async () => {
  const { root } = await createTempFile('macos/The Pair.app.tar.gz', 'mac-update')
  await writeFile(join(root, 'macos', 'The Pair.app.tar.gz.sig'), 'mac-sig')

  const outDir = join(root, 'dist')
  const result = collectUpdaterAssets({
    platform: 'macos',
    bundleRoot: root,
    outDir,
    version: '1.1.12'
  })

  assert.equal(result.length, 2)
  assert.equal(await readFile(join(outDir, 'the-pair-1.1.12.app.tar.gz'), 'utf8'), 'mac-update')
  assert.equal(await readFile(join(outDir, 'the-pair-1.1.12.app.tar.gz.sig'), 'utf8'), 'mac-sig')
})

test('collectUpdaterAssets copies Windows signatures next to the installer asset', async () => {
  const { root } = await createTempFile('nsis/The Pair_1.1.12_x64-setup.nsis.zip', 'win-zip')
  await writeFile(join(root, 'nsis', 'The Pair_1.1.12_x64-setup.nsis.zip.sig'), 'win-sig')

  const outDir = join(root, 'dist')
  const result = collectUpdaterAssets({
    platform: 'windows',
    bundleRoot: root,
    outDir,
    version: '1.1.12'
  })

  assert.equal(result.length, 2)
  assert.equal(await readFile(join(outDir, 'the-pair-1.1.12-setup.nsis.zip'), 'utf8'), 'win-zip')
  assert.equal(
    await readFile(join(outDir, 'the-pair-1.1.12-setup.nsis.zip.sig'), 'utf8'),
    'win-sig'
  )
})

test('collectUpdaterAssets copies Linux signatures next to the AppImage asset', async () => {
  const { root } = await createTempFile('appimage/The Pair_1.1.12_amd64.AppImage.tar.gz', 'linux-tar')
  await writeFile(join(root, 'appimage', 'The Pair_1.1.12_amd64.AppImage.tar.gz.sig'), 'linux-sig')

  const outDir = join(root, 'dist')
  const result = collectUpdaterAssets({
    platform: 'linux',
    bundleRoot: root,
    outDir,
    version: '1.1.12'
  })

  assert.equal(result.length, 2)
  assert.equal(
    await readFile(join(outDir, 'the-pair-1.1.12.AppImage.tar.gz'), 'utf8'),
    'linux-tar'
  )
  assert.equal(
    await readFile(join(outDir, 'the-pair-1.1.12.AppImage.tar.gz.sig'), 'utf8'),
    'linux-sig'
  )
})
