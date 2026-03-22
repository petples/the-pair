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

interface AvailableModel {
  provider: string
  modelId: string
  displayName: string
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

const api = {
  pair: {
    create: (input: CreatePairInput): Promise<PairProcess> =>
      ipcRenderer.invoke('pair:create', input),
    stop: (pairId: string): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('pair:stop', pairId),
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
    read: (): Promise<unknown> => ipcRenderer.invoke('config:read'),
    openFile: (): Promise<string> => ipcRenderer.invoke('config:openFile')
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
