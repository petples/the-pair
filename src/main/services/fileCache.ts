import { readdirSync, statSync, existsSync, readFileSync } from 'fs'
import { join, relative } from 'path'
import chokidar from 'chokidar'
import type { FSWatcher } from 'chokidar'

const EXCLUDED_DIRS = new Set([
  '.git',
  '.svn',
  '.hg',
  'node_modules',
  'dist',
  'build',
  'out',
  '.next',
  '.nuxt',
  '.svelte-kit',
  '__pycache__',
  '.venv',
  'venv',
  '.cache',
  '.parcel-cache',
  '.turbo'
])

const EXCLUDED_FILES = new Set([
  '.DS_Store',
  'Thumbs.db',
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml'
])

export interface FileEntry {
  path: string
  type: 'file' | 'directory'
}

class FileCacheService {
  private caches: Map<string, FileEntry[]> = new Map()
  private watchers: Map<string, FSWatcher> = new Map()

  async buildCache(directory: string): Promise<FileEntry[]> {
    if (this.caches.has(directory)) {
      return this.caches.get(directory)!
    }

    const files = await this.scanDirectory(directory)
    this.caches.set(directory, files)
    this.startWatcher(directory)
    return files
  }

  getCache(directory: string): FileEntry[] | undefined {
    return this.caches.get(directory)
  }

  private async scanDirectory(directory: string, baseDir?: string): Promise<FileEntry[]> {
    const results: FileEntry[] = []
    const base = baseDir ?? directory

    if (!existsSync(directory)) {
      return results
    }

    try {
      const entries = readdirSync(directory)

      for (const entry of entries) {
        if (EXCLUDED_FILES.has(entry)) continue

        const fullPath = join(directory, entry)
        const relativePath = relative(base, fullPath)

        try {
          const stat = statSync(fullPath)
          if (stat.isDirectory()) {
            if (EXCLUDED_DIRS.has(entry)) continue
            results.push({ path: relativePath, type: 'directory' })
            const subFiles = await this.scanDirectory(fullPath, base)
            results.push(...subFiles)
          } else if (stat.isFile()) {
            results.push({ path: relativePath, type: 'file' })
          }
        } catch {
          // Skip inaccessible files
        }
      }
    } catch {
      // Skip inaccessible directories
    }

    return results
  }

  private startWatcher(directory: string): void {
    if (this.watchers.has(directory)) return

    const watcher = chokidar.watch(directory, {
      ignored: [/(^|[/\\])\./, /node_modules/, /dist/, /build/, /\.git/, /\.cache/],
      persistent: true,
      ignoreInitial: true
    })

    watcher.on('add', () => this.invalidateCache(directory))
    watcher.on('unlink', () => this.invalidateCache(directory))
    watcher.on('addDir', () => this.invalidateCache(directory))
    watcher.on('unlinkDir', () => this.invalidateCache(directory))

    this.watchers.set(directory, watcher)
  }

  private invalidateCache(directory: string): void {
    this.caches.delete(directory)
    this.buildCache(directory)
  }

  stopWatching(directory: string): void {
    const watcher = this.watchers.get(directory)
    if (watcher) {
      watcher.close()
      this.watchers.delete(directory)
      this.caches.delete(directory)
    }
  }

  async parseMentions(directory: string, spec: string): Promise<string> {
    const mentionRegex = /@([^\s]+)/g
    const files = await this.buildCache(directory)
    const fileSet = new Map(files.map((f) => [f.path, f]))

    let result = spec
    let match
    const processedPaths = new Set<string>()

    while ((match = mentionRegex.exec(spec)) !== null) {
      const mentionPath = match[1]
      if (processedPaths.has(mentionPath)) continue
      processedPaths.add(mentionPath)

      const file = fileSet.get(mentionPath)
      if (file && file.type === 'file') {
        try {
          const content = readFileSync(join(directory, mentionPath), 'utf-8')
          const insertion = `\n@${mentionPath}\n---\n${content.slice(0, 100000)}\n---\n`
          result = result.replace(match[0], insertion)
        } catch {
          // Skip files that can't be read
        }
      }
    }

    return result
  }
}

export const fileCacheService = new FileCacheService()
