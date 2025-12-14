/**
 * Storage Factory
 *
 * Creates the appropriate storage adapter based on the runtime platform.
 * - Browser: Uses IndexedDB via IndexedDBAdapter (auto-migrates from localStorage)
 * - Wails: Uses SQLite via WailsStorageAdapter
 */

import type { AsyncStorageService, StoreName } from './types'
import { isWails } from './platform'
import { IndexedDBAdapter } from './adapters/IndexedDBAdapter'
import { WailsStorageAdapter } from './adapters/WailsStorageAdapter'

// Cache of storage instances by store name
const storageCache = new Map<string, AsyncStorageService<unknown>>()

/**
 * Get a storage adapter for the specified store
 *
 * @param storeName - The name of the store
 * @param useSessionStorage - Deprecated, ignored (IndexedDB is always persistent)
 * @returns An async storage service instance
 */
export function getStorage<T = unknown>(
  storeName: StoreName,
  useSessionStorage: boolean = false,
): AsyncStorageService<T> {
  const cacheKey = `${storeName}:${useSessionStorage ? 'session' : 'local'}`

  if (!storageCache.has(cacheKey)) {
    const adapter = isWails()
      ? new WailsStorageAdapter<T>(storeName)
      : new IndexedDBAdapter<T>(storeName)

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
