/**
 * Wails Storage Adapter
 *
 * Uses Wails IPC to communicate with Go/SQLite backend
 * Used when running inside Wails desktop application
 */

import type { AsyncStorageService, StoreName } from '../types'

// Declare the Wails Go bindings type
declare global {
  interface Window {
    go: {
      main: {
        App: {
          StorageGet(store: string, key: string): Promise<string | null>
          StorageSet(store: string, key: string, value: string): Promise<void>
          StorageRemove(store: string, key: string): Promise<void>
          StorageHas(store: string, key: string): Promise<boolean>
          StorageClear(store: string): Promise<void>
          StorageKeys(store: string): Promise<string[]>
          ProxyRequest(request: unknown): Promise<unknown>
        }
      }
    }
  }
}

export class WailsStorageAdapter<T = unknown> implements AsyncStorageService<T> {
  #store: StoreName

  constructor(storeName: StoreName) {
    this.#store = storeName
  }

  async get(key: string): Promise<T | null> {
    try {
      const value = await window.go.main.App.StorageGet(this.#store, key)
      return value ? JSON.parse(value) : null
    } catch (error) {
      console.error(`WailsStorage get error for key "${key}":`, error)
      return null
    }
  }

  async set(key: string, value: T): Promise<void> {
    try {
      await window.go.main.App.StorageSet(this.#store, key, JSON.stringify(value))
    } catch (error) {
      console.error(`WailsStorage set error for key "${key}":`, error)
    }
  }

  async remove(key: string): Promise<void> {
    try {
      await window.go.main.App.StorageRemove(this.#store, key)
    } catch (error) {
      console.error(`WailsStorage remove error for key "${key}":`, error)
    }
  }

  async has(key: string): Promise<boolean> {
    try {
      return await window.go.main.App.StorageHas(this.#store, key)
    } catch (error) {
      console.error(`WailsStorage has error for key "${key}":`, error)
      return false
    }
  }

  async clear(): Promise<void> {
    try {
      await window.go.main.App.StorageClear(this.#store)
    } catch (error) {
      console.error(`WailsStorage clear error for store "${this.#store}":`, error)
    }
  }

  async keys(): Promise<string[]> {
    try {
      return await window.go.main.App.StorageKeys(this.#store)
    } catch (error) {
      console.error(`WailsStorage keys error for store "${this.#store}":`, error)
      return []
    }
  }
}
