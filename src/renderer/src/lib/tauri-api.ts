import { invoke } from '@tauri-apps/api/core'
import type { CreatePairInput } from '../types'

export interface TauriPair {
  pairId: string
  name: string
  directory: string
  status: string
  mentorProvider: string
  mentorModel: string
  executorProvider: string
  executorModel: string
  createdAt: number
}

// Check if running in Tauri
const isTauri = '__TAURI__' in window

export const tauriApi = {
  pair: {
    create: async (input: CreatePairInput): Promise<TauriPair> => {
      if (!isTauri) throw new Error('Not running in Tauri')
      return await invoke('pair_create', { input })
    },
    list: async (): Promise<TauriPair[]> => {
      if (!isTauri) throw new Error('Not running in Tauri')
      return await invoke('pair_list')
    },
    delete: async (pairId: string): Promise<void> => {
      if (!isTauri) throw new Error('Not running in Tauri')
      return await invoke('pair_delete', { pairId })
    },
    pause: async (pairId: string): Promise<void> => {
      if (!isTauri) throw new Error('Not running in Tauri')
      return await invoke('pair_pause', { pairId })
    }
  }
}

export { isTauri }
