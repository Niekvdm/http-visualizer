/**
 * Tauri Storage Adapter
 *
 * Uses Tauri IPC to communicate with SQLite backend
 * Used when running inside Tauri desktop application
 */

import { invoke } from '@tauri-apps/api/core'
import type { AsyncStorageService, StoreName } from '../types'

export class TauriStorageAdapter<T = unknown> implements AsyncStorageService<T> {
  #store: StoreName

  constructor(storeName: StoreName) {
    this.#store = storeName
  }

  async get(key: string): Promise<T | null> {
    try {
      const value = await invoke<string | null>('storage_get', {
        store: this.#store,
        key,
      })
      return value ? JSON.parse(value) : null
    } catch (error) {
      console.error(`TauriStorage get error for key "${key}":`, error)
      return null
    }
  }

  async set(key: string, value: T): Promise<void> {
    try {
      await invoke('storage_set', {
        store: this.#store,
        key,
        value: JSON.stringify(value),
      })
    } catch (error) {
      console.error(`TauriStorage set error for key "${key}":`, error)
    }
  }

  async remove(key: string): Promise<void> {
    try {
      await invoke('storage_remove', {
        store: this.#store,
        key,
      })
    } catch (error) {
      console.error(`TauriStorage remove error for key "${key}":`, error)
    }
  }

  async has(key: string): Promise<boolean> {
    try {
      return await invoke<boolean>('storage_has', {
        store: this.#store,
        key,
      })
    } catch (error) {
      console.error(`TauriStorage has error for key "${key}":`, error)
      return false
    }
  }

  async clear(): Promise<void> {
    try {
      await invoke('storage_clear', {
        store: this.#store,
      })
    } catch (error) {
      console.error(`TauriStorage clear error for store "${this.#store}":`, error)
    }
  }

  async keys(): Promise<string[]> {
    try {
      return await invoke<string[]>('storage_keys', {
        store: this.#store,
      })
    } catch (error) {
      console.error(`TauriStorage keys error for store "${this.#store}":`, error)
      return []
    }
  }
}
