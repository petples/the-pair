import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getVersion } from '@tauri-apps/api/app';

const api = {
  pair: {
    create: (input: any) => invoke('pair_create', { input }),
    assignTask: (pairId: string, input: any) => invoke('pair_assign_task', { pairId, input }),
    updateModels: (pairId: string, input: any) => invoke('pair_update_models', { pairId, input }),
    stop: (pairId: string) => invoke('pair_delete', { pairId }),
    retryTurn: (pairId: string) => invoke('pair_retry_turn', { pairId }),
    list: () => invoke('pair_list'),
    getMessages: (pairId: string) => invoke('pair_get_messages', { pairId }),
    getState: (pairId: string) => invoke('pair_get_state', { pairId }),
    humanFeedback: (pairId: string, approved: boolean) => invoke('pair_human_feedback', { pairId, approved }),
    onCreated: (callback: any) => listen('pair:created', (e) => callback(e.payload)),
    onStopped: (callback: any) => listen('pair:stopped', (e) => callback(e.payload)),
    onMessage: (callback: any) => listen('pair:message', (e) => callback(e.payload)),
    onState: (callback: any) => listen('pair:state', (e) => callback(e.payload)),
  },
  config: {
    getModels: () => invoke('config_get_models'),
    getProviders: () => invoke('config_get_providers'),
    read: () => invoke('config_read'),
    openFile: () => invoke('config_open_file'),
    getVersion: () => getVersion(),
  },
  file: {
    listFiles: (options: any) => invoke('file_list_files', { options }),
    parseMentions: (pairId: string, spec: string) => invoke('file_parse_mentions', { pairId, spec }),
  }
};

// @ts-ignore
window.api = api;
