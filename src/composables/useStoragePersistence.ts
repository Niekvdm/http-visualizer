import { watch, type Ref, type WatchSource } from 'vue'

export type StorageType = 'local' | 'session'

export interface UseStoragePersistenceOptions<T> {
  /** Storage key */
  key: string
  /** Type of storage to use */
  storage?: StorageType
  /** Function to serialize data before saving */
  serialize?: (data: T) => string
  /** Function to deserialize data after loading */
  deserialize?: (raw: string) => T
  /** Default value if nothing is stored */
  defaultValue?: T
}

/**
 * Get the storage object based on type
 */
function getStorage(type: StorageType): Storage {
  return type === 'local' ? localStorage : sessionStorage
}

/**
 * Composable for persisting reactive state to localStorage or sessionStorage
 * 
 * @param dataRef - Ref or array of refs to persist
 * @param options - Configuration options
 */
export function useStoragePersistence<T>(
  dataRef: Ref<T> | WatchSource<T>[],
  options: UseStoragePersistenceOptions<T>
) {
  const {
    key,
    storage = 'local',
    serialize = JSON.stringify,
    deserialize = JSON.parse,
    defaultValue,
  } = options

  const storageObj = getStorage(storage)

  /**
   * Load data from storage
   */
  function load(): T | null {
    try {
      const stored = storageObj.getItem(key)
      if (stored) {
        return deserialize(stored)
      }
      return defaultValue ?? null
    } catch (error) {
      console.error(`Failed to load from ${storage}Storage [${key}]:`, error)
      return defaultValue ?? null
    }
  }

  /**
   * Save data to storage
   */
  function save(data: T): boolean {
    try {
      storageObj.setItem(key, serialize(data))
      return true
    } catch (error) {
      console.error(`Failed to save to ${storage}Storage [${key}]:`, error)
      return false
    }
  }

  /**
   * Remove data from storage
   */
  function remove(): boolean {
    try {
      storageObj.removeItem(key)
      return true
    } catch (error) {
      console.error(`Failed to remove from ${storage}Storage [${key}]:`, error)
      return false
    }
  }

  /**
   * Setup auto-save watcher
   */
  function setupAutoSave(getData: () => T) {
    watch(
      dataRef,
      () => save(getData()),
      { deep: true }
    )
  }

  return {
    load,
    save,
    remove,
    setupAutoSave,
  }
}

/**
 * Create a simple storage service for a specific key
 * Useful for stores that need direct load/save without reactive watching
 */
export function createStorageService<T>(
  key: string,
  options: Omit<UseStoragePersistenceOptions<T>, 'key'> = {}
) {
  const {
    storage = 'local',
    serialize = JSON.stringify,
    deserialize = JSON.parse,
    defaultValue,
  } = options

  const storageObj = getStorage(storage)

  return {
    load(): T | null {
      try {
        const stored = storageObj.getItem(key)
        if (stored) {
          return deserialize(stored)
        }
        return defaultValue ?? null
      } catch (error) {
        console.error(`Failed to load from ${storage}Storage [${key}]:`, error)
        return defaultValue ?? null
      }
    },

    save(data: T): boolean {
      try {
        storageObj.setItem(key, serialize(data))
        return true
      } catch (error) {
        console.error(`Failed to save to ${storage}Storage [${key}]:`, error)
        return false
      }
    },

    remove(): boolean {
      try {
        storageObj.removeItem(key)
        return true
      } catch (error) {
        console.error(`Failed to remove from ${storage}Storage [${key}]:`, error)
        return false
      }
    },
  }
}

