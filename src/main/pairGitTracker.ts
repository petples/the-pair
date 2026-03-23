import { exec } from 'child_process'
import { promisify } from 'util'
import * as path from 'path'
import type { GitTracking, ModifiedFile, FileStatus } from './types'

const execAsync = promisify(exec)

class PairGitTracker {
  async detectGitRepo(workspaceDir: string): Promise<GitTracking> {
    try {
      const { stdout } = await execAsync(`git -C "${workspaceDir}" rev-parse --show-toplevel`)
      const gitRoot = stdout.trim()
      return {
        available: true,
        rootPath: gitRoot,
        gitReviewAvailable: true
      }
    } catch {
      return { available: false, gitReviewAvailable: false }
    }
  }

  async captureBaseline(gitRoot: string): Promise<string> {
    try {
      const { stdout } = await execAsync('git status --porcelain=v1 -z --untracked-files=all', {
        cwd: gitRoot
      })
      return stdout
    } catch {
      return ''
    }
  }

  async getModifiedFiles(gitRoot: string, baseline: string): Promise<ModifiedFile[]> {
    try {
      const { stdout } = await execAsync('git status --porcelain=v1 -z --untracked-files=all', {
        cwd: gitRoot
      })

      const baselineFiles = this.parseStatusOutput(baseline, gitRoot)
      const currentFiles = this.parseStatusOutput(stdout, gitRoot)

      return currentFiles.filter((file) => {
        const baselineFile = baselineFiles.find((bf) => bf.displayPath === file.displayPath)
        return !baselineFile || baselineFile.status !== file.status
      })
    } catch {
      return []
    }
  }

  async getModifiedFilesRelative(gitRoot: string, workspaceDir: string): Promise<ModifiedFile[]> {
    try {
      const { stdout } = await execAsync('git status --porcelain=v1 -z --untracked-files=all', {
        cwd: gitRoot
      })
      return this.parseStatusOutput(stdout, workspaceDir)
    } catch {
      return []
    }
  }

  private parseStatusOutput(output: string, basePath: string): ModifiedFile[] {
    if (!output.trim()) return []

    const nullChar = '\x00'
    const entries = output.split(nullChar).filter(Boolean)

    return entries.map((entry) => {
      const statusCode = entry.substring(0, 2).trim()
      const filePath = entry.substring(3)

      let status: FileStatus = '??'
      if (statusCode === 'M') status = 'M'
      else if (statusCode === 'A') status = 'A'
      else if (statusCode === 'D') status = 'D'
      else if (statusCode.startsWith('R')) status = 'R'

      const displayPath = path.isAbsolute(filePath) ? path.relative(basePath, filePath) : filePath

      return {
        path: filePath,
        status,
        displayPath: displayPath || filePath
      }
    })
  }
}

export const pairGitTracker = new PairGitTracker()
