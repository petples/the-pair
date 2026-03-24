import assert from 'node:assert/strict'
import test from 'node:test'

type LocalStorageLike = {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
  removeItem: (key: string) => void
  clear: () => void
}

function installLocalStorage(): () => void {
  const store = new Map<string, string>()
  const storage: LocalStorageLike = {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => {
      store.set(key, value)
    },
    removeItem: (key) => {
      store.delete(key)
    },
    clear: () => {
      store.clear()
    }
  }

  const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window')
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  Object.defineProperty(globalThis, 'window', {
    value: globalThis,
    configurable: true,
    writable: true
  })
  Object.defineProperty(globalThis, 'localStorage', {
    value: storage,
    configurable: true,
    writable: true
  })

  return () => {
    if (windowDescriptor) {
      Object.defineProperty(globalThis, 'window', windowDescriptor)
    } else {
      Reflect.deleteProperty(globalThis, 'window')
    }

    if (descriptor) {
      Object.defineProperty(globalThis, 'localStorage', descriptor)
    } else {
      Reflect.deleteProperty(globalThis, 'localStorage')
    }
  }
}

test('useThemeStore toggles between light and dark themes', async () => {
  const restore = installLocalStorage()

  try {
    const { useThemeStore } = await import('../src/renderer/src/store/useThemeStore.ts')

    useThemeStore.setState({ theme: 'light' })
    assert.equal(useThemeStore.getState().theme, 'light')

    useThemeStore.getState().toggleTheme()
    assert.equal(useThemeStore.getState().theme, 'dark')

    useThemeStore.getState().toggleTheme()
    assert.equal(useThemeStore.getState().theme, 'light')
  } finally {
    restore()
  }
})
