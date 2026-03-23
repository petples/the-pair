import { app } from 'electron'
import { exec } from 'child_process'
import { promisify } from 'util'
import * as path from 'path'
import * as fs from 'fs'
import * as crypto from 'crypto'

const execAsync = promisify(exec)

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

export async function createPairWorktree(
  pairId: string,
  sourceRepoPath: string,
  sourceBranch: string = 'HEAD'
): Promise<WorktreeInfo | null> {
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

    await execAsync(
      `git -C "${sourceRepoPath}" worktree add "${worktreePath}" -b ${branchName} ${sourceBranch}`
    )

    await copyLocalChangesToWorktree(sourceRepoPath, worktreePath)

    const preTurnHead = await getCurrentHead(sourceRepoPath)

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

export async function copyLocalChangesToWorktree(
  sourceRepoPath: string,
  worktreePath: string
): Promise<void> {
  try {
    const { stdout } = await execAsync(`git -C "${sourceRepoPath}" status --porcelain`)
    const statusOutput = stdout.trim()

    if (!statusOutput) return

    const lines = statusOutput.split('\n')
    for (const line of lines) {
      if (!line.trim()) continue

      const statusCode = line.substring(0, 2)
      let filePath = line.substring(3).trim()

      if (filePath.startsWith('"') && filePath.endsWith('"')) {
        filePath = filePath.slice(1, -1)
      }

      if (statusCode.includes('D')) continue

      if (filePath.startsWith('.pair/') || filePath === '.pair') continue

      const sourceFile = path.join(sourceRepoPath, filePath)
      const targetFile = path.join(worktreePath, filePath)
      const targetDir = path.dirname(targetFile)

      if (!fs.existsSync(sourceFile)) continue

      const stat = fs.statSync(sourceFile)
      if (stat.isDirectory()) continue

      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true })
      }

      fs.copyFileSync(sourceFile, targetFile)
    }
  } catch (error) {
    console.error('Failed to copy local changes to worktree:', error)
  }
}

export async function getCurrentHead(repoPath: string): Promise<string> {
  try {
    const { stdout } = await execAsync(`git -C "${repoPath}" rev-parse HEAD`)
    return stdout.trim()
  } catch {
    return ''
  }
}

export async function commitPairChanges(
  pairId: string,
  worktreePath: string,
  iteration: number
): Promise<{ commitSha?: string; noChanges: boolean; commitSubject?: string }> {
  try {
    const { stdout } = await execAsync(`git -C "${worktreePath}" status --porcelain`)
    const statusOutput = stdout.trim()

    if (!statusOutput) {
      return { noChanges: true }
    }

    await execAsync(`git -C "${worktreePath}" add -A`)

    const { stdout: diffOutput } = await execAsync(`git -C "${worktreePath}" diff --cached --stat`)

    if (!diffOutput.trim()) {
      return { noChanges: true }
    }

    const commitMessage = `pair(${pairId}): executor turn ${iteration}`
    await execAsync(`git -C "${worktreePath}" commit -m "${commitMessage}"`)

    const { stdout: headOutput } = await execAsync(`git -C "${worktreePath}" rev-parse HEAD`)
    const commitSha = headOutput.trim()

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

export async function getDiffStat(worktreePath: string, sha: string): Promise<string> {
  try {
    const { stdout } = await execAsync(
      `git -C "${worktreePath}" diff --stat --summary ${sha}^..${sha}`
    )
    return stdout.trim()
  } catch {
    return ''
  }
}

export async function getPatchExcerpt(
  worktreePath: string,
  sha: string,
  maxLines: number = 800,
  maxBytes: number = 204800
): Promise<string> {
  try {
    const { stdout: patch } = await execAsync(
      `git -C "${worktreePath}" show --stat --summary --patch --unified=3 --no-ext-diff ${sha}`,
      {
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

export async function removePairWorktree(
  worktreePath: string,
  branchName: string,
  originalRepoPath: string
): Promise<void> {
  try {
    await execAsync(`git -C "${originalRepoPath}" worktree remove "${worktreePath}" --force`)
    await execAsync(`git -C "${originalRepoPath}" branch -d "${branchName}"`)
  } catch (error) {
    console.error('Failed to remove worktree:', error)
  }
}

export async function getWorktreeStatus(worktreePath: string): Promise<string> {
  try {
    const { stdout } = await execAsync(`git -C "${worktreePath}" status --porcelain`)
    return stdout.trim()
  } catch {
    return ''
  }
}
