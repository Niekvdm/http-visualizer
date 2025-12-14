/**
 * IndexedDB Storage Adapter
 *
 * Provides larger, more reliable storage compared to localStorage.
 * Uses IndexedDB for browser environment with async key-value storage.
 */

import type { AsyncStorageService, StoreName } from '../types'

const DB_NAME = 'http-visualizer'
const DB_VERSION = 1

// All store names that need to be created
const ALL_STORES: StoreName[] = [
  'collections',
  'theme',
  'auth',
  'tokens',
  'environment',
  'presentation',
  'settings',
]

// Singleton database connection
let dbPromise: Promise<IDBDatabase> | null = null

/**
 * Open or create the IndexedDB database
 */
function openDatabase(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => {
      console.error('IndexedDB open error:', request.error)
      reject(request.error)
    }

    request.onsuccess = () => {
      resolve(request.result)
    }

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result

      // Create object stores for each storage category
      for (const storeName of ALL_STORES) {
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName)
        }
      }
    }
  })

  return dbPromise
}

/**
 * Migrate data from localStorage to IndexedDB (one-time operation)
 */
async function migrateFromLocalStorage(
  db: IDBDatabase,
  storeName: StoreName,
): Promise<void> {
  const migrationKey = `http-visualizer:${storeName}:migrated`

  // Check if already migrated
  if (localStorage.getItem(migrationKey) === 'true') {
    return
  }

  const prefix = `http-visualizer:${storeName}:`
  const keysToMigrate: { key: string; value: unknown }[] = []

  // Find all localStorage keys for this store
  for (let i = 0; i < localStorage.length; i++) {
    const fullKey = localStorage.key(i)
    if (fullKey?.startsWith(prefix)) {
      const key = fullKey.slice(prefix.length)
      try {
        const raw = localStorage.getItem(fullKey)
        if (raw) {
          keysToMigrate.push({ key, value: JSON.parse(raw) })
        }
      } catch (e) {
        console.warn(`Failed to parse localStorage key ${fullKey}:`, e)
      }
    }
  }

  if (keysToMigrate.length === 0) {
    localStorage.setItem(migrationKey, 'true')
    return
  }

  // Migrate to IndexedDB
  const tx = db.transaction(storeName, 'readwrite')
  const store = tx.objectStore(storeName)

  for (const { key, value } of keysToMigrate) {
    store.put(value, key)
  }

  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => {
      // Mark as migrated and optionally clean up localStorage
      localStorage.setItem(migrationKey, 'true')
      console.log(`Migrated ${keysToMigrate.length} items from localStorage to IndexedDB (${storeName})`)
      resolve()
    }
    tx.onerror = () => reject(tx.error)
  })
}

export class IndexedDBAdapter<T = unknown> implements AsyncStorageService<T> {
  #storeName: StoreName
  #dbReady: Promise<IDBDatabase>

  constructor(storeName: StoreName) {
    this.#storeName = storeName
    this.#dbReady = openDatabase().then(async (db) => {
      // Run migration on first access
      await migrateFromLocalStorage(db, storeName)
      return db
    })
  }

  async get(key: string): Promise<T | null> {
    try {
      const db = await this.#dbReady
      const tx = db.transaction(this.#storeName, 'readonly')
      const store = tx.objectStore(this.#storeName)

      return new Promise((resolve, reject) => {
        const request = store.get(key)
        request.onsuccess = () => resolve(request.result ?? null)
        request.onerror = () => reject(request.error)
      })
    } catch (error) {
      console.error(`IndexedDB get error for key "${key}":`, error)
      return null
    }
  }

  async set(key: string, value: T): Promise<void> {
    try {
      const db = await this.#dbReady
      const tx = db.transaction(this.#storeName, 'readwrite')
      const store = tx.objectStore(this.#storeName)

      return new Promise((resolve, reject) => {
        const request = store.put(value, key)
        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
      })
    } catch (error) {
      console.error(`IndexedDB set error for key "${key}":`, error)
    }
  }

  async remove(key: string): Promise<void> {
    try {
      const db = await this.#dbReady
      const tx = db.transaction(this.#storeName, 'readwrite')
      const store = tx.objectStore(this.#storeName)

      return new Promise((resolve, reject) => {
        const request = store.delete(key)
        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
      })
    } catch (error) {
      console.error(`IndexedDB remove error for key "${key}":`, error)
    }
  }

  async has(key: string): Promise<boolean> {
    try {
      const db = await this.#dbReady
      const tx = db.transaction(this.#storeName, 'readonly')
      const store = tx.objectStore(this.#storeName)

      return new Promise((resolve, reject) => {
        const request = store.getKey(key)
        request.onsuccess = () => resolve(request.result !== undefined)
        request.onerror = () => reject(request.error)
      })
    } catch (error) {
      console.error(`IndexedDB has error for key "${key}":`, error)
      return false
    }
  }

  async clear(): Promise<void> {
    try {
      const db = await this.#dbReady
      const tx = db.transaction(this.#storeName, 'readwrite')
      const store = tx.objectStore(this.#storeName)

      return new Promise((resolve, reject) => {
        const request = store.clear()
        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
      })
    } catch (error) {
      console.error(`IndexedDB clear error:`, error)
    }
  }

  async keys(): Promise<string[]> {
    try {
      const db = await this.#dbReady
      const tx = db.transaction(this.#storeName, 'readonly')
      const store = tx.objectStore(this.#storeName)

      return new Promise((resolve, reject) => {
        const request = store.getAllKeys()
        request.onsuccess = () => resolve(request.result as string[])
        request.onerror = () => reject(request.error)
      })
    } catch (error) {
      console.error(`IndexedDB keys error:`, error)
      return []
    }
  }
}
