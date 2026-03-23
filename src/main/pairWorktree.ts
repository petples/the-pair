import { app } from 'electron'
import { execSync } from 'child_process'
import * as path from 'path'
import * as fs from 'fs'
import * as crypto from 'crypto'
import type { GitTracking } from './types'

export interface WorktreeInfo {
  worktreePath: string
  branchName: string
  preTurnHead: string
}

export function computeRepoHash(repoPath: string): string {
  try {
    const hash = crypto.createHash('md5').update(repoPath).digest('hex')
    return hash.substring(0, 8)
  } catch {
    return 'unknown'
  }
}

export function getPairWorktreesRoot(): string {
  const userDataPath = app.getPath('userData')
  return path.join(userDataPath, 'pair-worktrees')
}

export function detectGitRepo(workspaceDir: string): GitTracking {
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

export function createPairWorktree(
  pairId: string,
  sourceRepoPath: string,
  sourceBranch: string = 'HEAD'
): WorktreeInfo | null {
  try {
    const worktreesRoot = getPairWorktreesRoot()
    if (!fs.existsSync(worktreesRoot)) {
      fs.mkdirSync(worktreesRoot, { recursive: true })
    }

    const repoHash = computeRepoHash(sourceRepoPath)
    const branchName = `pair/${pairId}`
    const worktreePath = path.join(worktreesRoot, `${repoHash}`, pairId)
    const worktreeDir = path.dirname(worktreePath)

    if (!fs.existsSync(worktreeDir)) {
      fs.mkdirSync(worktreeDir, { recursive: true })
    }

    execSync(`git -C "${sourceRepoPath}" worktree add "${worktreePath}" -b ${branchName} ${sourceBranch}`, {
      encoding: 'utf-8'
    })

    const preTurnHead = getCurrentHead(sourceRepoPath)

    return {
      worktreePath,
      branchName,
      preTurnHead
    }
  } catch (error) {
    console.error('Failed to create worktree:', error)
    return null
  }
}

export function getCurrentHead(repoPath: string): string {
  try {
    return execSync('git -C "${repoPath}" rev-parse HEAD', {
      encoding: 'utf-8',
      cwd: repoPath
    }).trim()
  } catch {
    return ''
  }
}

export function commitPairChanges(
  pairId: string,
  worktreePath: string,
  iteration: number
): { commitSha?: string; noChanges: boolean; commitSubject?: string } {
  try {
    const statusOutput = execSync('git -C "${worktreePath}" status --porcelain', {
      encoding: 'utf-8',
      cwd: worktreePath
    }).trim()

    if (!statusOutput) {
      return { noChanges: true }
    }

    execSync('git -C "${worktreePath}" add -A', {
      encoding: 'utf-8',
      cwd: worktreePath
    })

    const diffOutput = execSync('git -C "${worktreePath}" diff --cached --stat', {
      encoding: 'utf-8',
      cwd: worktreePath
    }).trim()

    if (!diffOutput) {
      return { noChanges: true }
    }

    const commitMessage = `pair(${pairId}): executor turn ${iteration}`
    execSync(`git -C "${worktreePath}" commit -m "${commitMessage}"`, {
      encoding: 'utf-8'
    })

    const commitSha = execSync('git -C "${worktreePath}" rev-parse HEAD', {
      encoding: 'utf-8',
      cwd: worktreePath
    }).trim()

    return {
      commitSha,
      noChanges: false,
      commitSubject: commitMessage
    }
  } catch (error) {
    console.error('Failed to commit pair changes:', error)
    return { noChanges: true }
  }
}

export function getDiffStat(worktreePath: string, sha: string): string {
  try {
    return execSync(`git -C "${worktreePath}" diff --stat --summary ${sha}^..${sha}`, {
      encoding: 'utf-8',
      cwd: worktreePath
    }).trim()
  } catch {
    return ''
  }
}

export function getPatchExcerpt(worktreePath: string, sha: string, maxLines: number = 800, maxBytes: number = 204800): string {
  try {
    const patch = execSync(
      `git -C "${worktreePath}" show --stat --summary --patch --unified=3 --no-ext-diff ${sha}`,
      {
        encoding: 'utf-8',
        cwd: worktreePath,
        maxBuffer: maxBytes * 2
      }
    )

    const lines = patch.split('\n')
    if (lines.length <= maxLines && patch.length <= maxBytes) {
      return patch
    }

    const truncatedLines = lines.slice(0, maxLines)
    let result = truncatedLines.join('\n')

    if (result.length > maxBytes) {
      result = result.substring(0, maxBytes)
    }

    return result + '\n\n[truncated]'
  } catch (error) {
    console.error('Failed to get patch excerpt:', error)
    return '[failed to generate patch]'
  }
}

export function removePairWorktree(worktreePath: string, branchName: string, originalRepoPath: string): void {
  try {
    execSync(`git -C "${originalRepoPath}" worktree remove "${worktreePath}" --force`, {
      encoding: 'utf-8'
    })
    execSync(`git -C "${originalRepoPath}" branch -d "${branchName}"`, {
      encoding: 'utf-8'
    })
  } catch (error) {
    console.error('Failed to remove worktree:', error)
  }
}

export function getWorktreeStatus(worktreePath: string): string {
  try {
    return execSync('git -C "${worktreePath}" status --porcelain', {
      encoding: 'utf-8',
      cwd: worktreePath
    }).trim()
  } catch {
    return ''
  }
}
