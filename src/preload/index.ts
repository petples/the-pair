import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

interface PairProcess {
  pairId: string
  mentorPid: number | null
  executorPid: number | null
  mentorStatus: string
  executorStatus: string
}

interface CreatePairInput {
  name: string
  directory: string
  spec: string
  mentor: { role: string; model: string }
  executor: { role: string; model: string }
}

interface AssignTaskInput {
  spec: string
}

interface PairModelSelection {
  mentorModel: string
  executorModel: string
  pendingMentorModel?: string
  pendingExecutorModel?: string
}

interface AssignTaskResult extends PairModelSelection {
  spec: string
}

interface AvailableModel {
  provider: string
  modelId: string
  displayName: string
  available: boolean
  providerLabel: string
  sourceProvider?: string
  sourceProviderLabel: string
  billingKind: 'plan' | 'payg' | 'byok' | 'unknown'
  billingLabel: string
  accessLabel: string
  planLabel?: string
  availabilityStatus: 'ready' | 'cli-missing' | 'auth-missing' | 'runtime-unsupported'
  availabilityReason?: string
  supportsPairExecution: boolean
  recommendedRoles: ('mentor' | 'executor')[]
}

interface DetectedProviderProfile {
  kind: string
  installed: boolean
  authenticated: boolean
  runnable: boolean
  subscriptionLabel: string
  currentModels: AvailableModel[]
  detectedAt: number
}

interface Message {
  id: string
  timestamp: number
  from: 'mentor' | 'executor' | 'human'
  to: 'mentor' | 'executor' | 'both' | 'human'
  type: 'plan' | 'feedback' | 'progress' | 'result' | 'question' | 'handoff'
  content: string
  attachments?: { path: string; description: string }[]
  iteration: number
}

interface FileEntry {
  path: string
  type: 'file' | 'directory'
}

const api = {
  pair: {
    create: (input: CreatePairInput): Promise<PairProcess> =>
      ipcRenderer.invoke('pair:create', input),
    assignTask: (pairId: string, input: AssignTaskInput): Promise<AssignTaskResult> =>
      ipcRenderer.invoke('pair:assignTask', pairId, input),
    updateModels: (pairId: string, input: PairModelSelection): Promise<PairModelSelection> =>
      ipcRenderer.invoke('pair:updateModels', pairId, input),
    stop: (pairId: string): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('pair:stop', pairId),
    retryTurn: (pairId: string): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('pair:retryTurn', pairId),
    list: (): Promise<PairProcess[]> => ipcRenderer.invoke('pair:list'),
    getMessages: (pairId: string): Promise<Message[]> =>
      ipcRenderer.invoke('pair:getMessages', pairId),
    getState: (pairId: string): Promise<unknown> => ipcRenderer.invoke('pair:getState', pairId),
    humanFeedback: (pairId: string, approved: boolean): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('pair:humanFeedback', pairId, approved),
    onCreated: (callback: (pair: PairProcess) => void): void => {
      ipcRenderer.on('pair:created', (_event, pair) => callback(pair))
    },
    onStopped: (callback: (data: { pairId: string }) => void): void => {
      ipcRenderer.on('pair:stopped', (_event, data) => callback(data))
    },
    onMessage: (callback: (data: { pairId: string; message: Message }) => void): void => {
      ipcRenderer.on('pair:message', (_event, data) => callback(data))
    },
    onState: (callback: (state: unknown) => void): void => {
      ipcRenderer.on('pair:state', (_event, state) => callback(state))
    }
  },
  config: {
    getModels: (): Promise<AvailableModel[]> => ipcRenderer.invoke('config:getModels'),
    getProviders: (): Promise<DetectedProviderProfile[]> =>
      ipcRenderer.invoke('config:getProviders'),
    read: (): Promise<unknown> => ipcRenderer.invoke('config:read'),
    openFile: (): Promise<string> => ipcRenderer.invoke('config:openFile'),
    getVersion: (): Promise<string> => ipcRenderer.invoke('app:getVersion')
  },
  file: {
    listFiles: (options: { pairId?: string; directory?: string }): Promise<FileEntry[]> =>
      ipcRenderer.invoke('file:listFiles', options),
    parseMentions: (pairId: string, spec: string): Promise<string> =>
      ipcRenderer.invoke('file:parseMentions', pairId, spec)
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore: fallback for non-isolated context
  window.electron = electronAPI
  // @ts-ignore: fallback for non-isolated context
  window.api = api
}
