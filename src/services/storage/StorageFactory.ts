/**
 * Storage Factory
 *
 * Creates the appropriate storage adapter based on the runtime platform.
 * - Browser: Uses localStorage/sessionStorage via BrowserStorageAdapter
 * - Tauri: Uses SQLite via TauriStorageAdapter
 */

import type { AsyncStorageService, StoreName } from './types'
import { isTauri } from './platform'
import { BrowserStorageAdapter } from './adapters/BrowserStorageAdapter'
import { TauriStorageAdapter } from './adapters/TauriStorageAdapter'

// Cache of storage instances by store name
const storageCache = new Map<string, AsyncStorageService<unknown>>()

/**
 * Get a storage adapter for the specified store
 *
 * @param storeName - The name of the store
 * @param useSessionStorage - For browser, use sessionStorage instead of localStorage (default: false)
 * @returns An async storage service instance
 */
export function getStorage<T = unknown>(
  storeName: StoreName,
  useSessionStorage: boolean = false,
): AsyncStorageService<T> {
  const cacheKey = `${storeName}:${useSessionStorage ? 'session' : 'local'}`

  if (!storageCache.has(cacheKey)) {
    const adapter = isTauri()
      ? new TauriStorageAdapter<T>(storeName)
      : new BrowserStorageAdapter<T>(storeName, useSessionStorage)

    storageCache.set(cacheKey, adapter as AsyncStorageService<unknown>)
  }

  return storageCache.get(cacheKey) as AsyncStorageService<T>
}

/**
 * Clear all storage caches (useful for testing)
 */
export function clearStorageCache(): void {
  storageCache.clear()
}
