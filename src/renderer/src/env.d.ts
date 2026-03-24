/// <reference types="vite/client" />

interface Window {
  api: {
    pair: {
      create: (input: any) => Promise<any>
      assignTask: (pairId: string, input: any) => Promise<any>
      updateModels: (pairId: string, input: any) => Promise<any>
      stop: (pairId: string) => Promise<any>
      retryTurn: (pairId: string) => Promise<any>
      list: () => Promise<any>
      getMessages: (pairId: string) => Promise<any>
      getState: (pairId: string) => Promise<any>
      humanFeedback: (pairId: string, approved: boolean) => Promise<any>
      onCreated: (callback: (data: any) => void) => Promise<any>
      onStopped: (callback: (data: any) => void) => Promise<any>
      onMessage: (callback: (data: any) => void) => Promise<any>
      onState: (callback: (data: any) => void) => Promise<any>
    }
    config: {
      getModels: () => Promise<any>
      getProviders: () => Promise<any>
      read: () => Promise<any>
      openFile: () => Promise<any>
      getVersion: () => Promise<string>
    }
    file: {
      listFiles: (options: any) => Promise<any>
      parseMentions: (pairId: string, spec: string) => Promise<any>
    }
  }
}
