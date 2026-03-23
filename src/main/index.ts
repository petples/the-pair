import {
  app,
  shell,
  BrowserWindow,
  ipcMain,
  dialog,
  Menu,
  MenuItemConstructorOptions
} from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { messageBroker } from './messageBroker'
import { pairManager } from './pairManager'
import { fileCacheService } from './services/fileCache'
import type { AssignTaskInput, CreatePairInput, UpdatePairModelsInput } from './types'

app.setName('The Pair')

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden',
    titleBarOverlay:
      process.platform === 'darwin'
        ? false
        : {
            color: '#0f0f10',
            symbolColor: '#f5f5f5',
            height: 60
          },
    backgroundColor: '#0a0a0b',
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))

  // Pair management IPC handlers
  ipcMain.handle('pair:create', async (_event, input: CreatePairInput) => {
    return pairManager.createPair(input)
  })

  ipcMain.handle('pair:assignTask', async (_event, pairId: string, input: AssignTaskInput) => {
    return pairManager.assignTask(pairId, input)
  })

  ipcMain.handle(
    'pair:updateModels',
    async (_event, pairId: string, input: UpdatePairModelsInput) => {
      return pairManager.updatePairModels(pairId, input)
    }
  )

  ipcMain.handle('pair:stop', async (_event, pairId: string) => {
    pairManager.stopPair(pairId)
    return { success: true }
  })

  ipcMain.handle('pair:retryTurn', async (_event, pairId: string) => {
    pairManager.retryTurn(pairId)
    return { success: true }
  })

  ipcMain.handle('pair:list', async () => {
    return pairManager.getAllPairs()
  })

  ipcMain.handle('pair:getMessages', async (_event, pairId: string) => {
    return pairManager.getMessages(pairId)
  })

  ipcMain.handle('pair:humanFeedback', async (_event, pairId: string, approved: boolean) => {
    pairManager.humanFeedback(pairId, approved)
    return { success: true }
  })

  ipcMain.handle('pair:getState', async (_event, pairId: string) => {
    return messageBroker.getState(pairId)
  })

  ipcMain.handle(
    'file:listFiles',
    async (_event, options: { pairId?: string; directory?: string }) => {
      let directory: string | undefined

      if (options.pairId) {
        directory = pairManager.getPairDirectory(options.pairId)
      } else if (options.directory) {
        directory = options.directory
      }

      if (!directory) {
        return []
      }

      return fileCacheService.buildCache(directory)
    }
  )

  ipcMain.handle('file:parseMentions', async (_event, pairId: string, spec: string) => {
    const directory = pairManager.getPairDirectory(pairId)
    if (!directory) {
      return spec
    }
    return fileCacheService.parseMentions(directory, spec)
  })

  ipcMain.handle('config:getModels', async () => {
    return pairManager.getAvailableModels()
  })

  ipcMain.handle('config:getProviders', async () => {
    return pairManager.getProviderProfiles()
  })

  ipcMain.handle('config:read', async () => {
    return pairManager.readOpenCodeConfig()
  })

  ipcMain.handle('config:openFile', async () => {
    const configPath = join(app.getPath('home'), '.config/opencode/opencode.json')
    return shell.openPath(configPath)
  })

  ipcMain.handle('dialog:openDirectory', async () => {
    return dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory']
    })
  })

  ipcMain.handle('app:getVersion', async () => {
    return app.getVersion()
  })

  createWindow()

  const template: MenuItemConstructorOptions[] = [
    {
      label: 'The Pair',
      submenu: [
        {
          label: 'About',
          role: 'about'
        },
        { type: 'separator' },
        {
          label: 'Preferences',
          accelerator: 'CmdOrCtrl+,',
          click: () => {
            const configPath = join(app.getPath('home'), '.config/opencode/opencode.json')
            shell.openPath(configPath)
          }
        },
        { type: 'separator' },
        {
          label: 'Quit',
          accelerator: 'CmdOrCtrl+Q',
          role: 'quit'
        }
      ]
    },
    { label: 'Edit', role: 'editMenu' },
    { label: 'View', role: 'viewMenu' },
    { label: 'Window', role: 'windowMenu' }
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
