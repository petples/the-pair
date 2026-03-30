import type { RepoState } from '../types'

export const mockRepoState: RepoState = {
  isGitRepo: true,
  isDirty: false,
  currentBranch: 'main',
  branches: [
    {
      name: 'main',
      isLocal: true,
      isRemote: true,
      lastCommitMessage: 'Initial commit',
      lastCommitSha: 'abc123',
      lastCommitDate: Date.now() / 1000,
      isCheckedOutLocally: true
    },
    {
      name: 'develop',
      isLocal: true,
      isRemote: true,
      lastCommitMessage: 'Add feature',
      lastCommitSha: 'def456',
      lastCommitDate: Date.now() / 1000 - 86400,
      isCheckedOutLocally: false
    },
    {
      name: 'origin/feature-x',
      isLocal: false,
      isRemote: true,
      lastCommitMessage: 'WIP feature',
      lastCommitSha: 'ghi789',
      lastCommitDate: Date.now() / 1000 - 172800,
      isCheckedOutLocally: false
    }
  ]
}
