/**
 * Browser Storage Adapter
 *
 * Wraps localStorage/sessionStorage with async interface for consistency
 * Used when running in browser (non-Tauri) environment
 */

import type { AsyncStorageService, StoreName } from '../types'

export class BrowserStorageAdapter<T = unknown> implements AsyncStorageService<T> {
  #storage: Storage
  #prefix: string

  constructor(storeName: StoreName, useSessionStorage: boolean = false) {
    this.#storage = useSessionStorage ? sessionStorage : localStorage
    this.#prefix = `http-visualizer:${storeName}`
  }

  #getKey(key: string): string {
    return `${this.#prefix}:${key}`
  }

  async get(key: string): Promise<T | null> {
    try {
      const raw = this.#storage.getItem(this.#getKey(key))
      return raw ? JSON.parse(raw) : null
    } catch (error) {
      console.error(`BrowserStorage get error for key "${key}":`, error)
      return null
    }
  }

  async set(key: string, value: T): Promise<void> {
    try {
      this.#storage.setItem(this.#getKey(key), JSON.stringify(value))
    } catch (error) {
      console.error(`BrowserStorage set error for key "${key}":`, error)
    }
  }

  async remove(key: string): Promise<void> {
    try {
      this.#storage.removeItem(this.#getKey(key))
    } catch (error) {
      console.error(`BrowserStorage remove error for key "${key}":`, error)
    }
  }

  async has(key: string): Promise<boolean> {
    return this.#storage.getItem(this.#getKey(key)) !== null
  }

  async clear(): Promise<void> {
    const keysToRemove: string[] = []
    for (let i = 0; i < this.#storage.length; i++) {
      const key = this.#storage.key(i)
      if (key?.startsWith(this.#prefix)) {
        keysToRemove.push(key)
      }
    }
    keysToRemove.forEach((key) => this.#storage.removeItem(key))
  }

  async keys(): Promise<string[]> {
    const result: string[] = []
    const prefixWithColon = `${this.#prefix}:`
    for (let i = 0; i < this.#storage.length; i++) {
      const key = this.#storage.key(i)
      if (key?.startsWith(prefixWithColon)) {
        result.push(key.slice(prefixWithColon.length))
      }
    }
    return result
  }
}
