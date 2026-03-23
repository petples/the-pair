import { execSync } from 'child_process'
import * as path from 'path'
import type { GitTracking, ModifiedFile, FileStatus } from './types'

class PairGitTracker {
  detectGitRepo(workspaceDir: string): GitTracking {
    try {
      const gitRoot = execSync('git -C "${workspaceDir}" rev-parse --show-toplevel', {
        encoding: 'utf-8',
        cwd: workspaceDir
      }).trim()
      return {
        available: true,
        rootPath: gitRoot,
        gitReviewAvailable: true
      }
    } catch {
      return { available: false, gitReviewAvailable: false }
    }
  }

  captureBaseline(gitRoot: string): string {
    const output = execSync('git status --porcelain=v1 -z --untracked-files=all', {
      encoding: 'utf-8',
      cwd: gitRoot
    })
    return output
  }

  getModifiedFiles(gitRoot: string, baseline: string): ModifiedFile[] {
    try {
      const currentOutput = execSync('git status --porcelain=v1 -z --untracked-files=all', {
        encoding: 'utf-8',
        cwd: gitRoot
      })

      const baselineFiles = this.parseStatusOutput(baseline, gitRoot)
      const currentFiles = this.parseStatusOutput(currentOutput, gitRoot)

      return currentFiles.filter((file) => {
        const baselineFile = baselineFiles.find((bf) => bf.displayPath === file.displayPath)
        return !baselineFile || baselineFile.status !== file.status
      })
    } catch {
      return []
    }
  }

  getModifiedFilesRelative(gitRoot: string, workspaceDir: string): ModifiedFile[] {
    try {
      const output = execSync('git status --porcelain=v1 -z --untracked-files=all', {
        encoding: 'utf-8',
        cwd: gitRoot
      })
      return this.parseStatusOutput(output, workspaceDir)
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
