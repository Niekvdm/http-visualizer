import { watch, type Ref, type WatchSource } from 'vue'
import { isWails } from '@/services/storage/platform'
import { getStorage, type StoreName } from '@/services/storage'

export type StorageType = 'local' | 'session'

export interface UseStoragePersistenceOptions<T> {
  /** Storage key */
  key: string
  /** Store name for Wails SQLite storage */
  storeName: StoreName
  /** Type of storage to use (for browser mode) */
  storage?: StorageType
  /** Function to serialize data before saving */
  serialize?: (data: T) => string
  /** Function to deserialize data after loading */
  deserialize?: (raw: string) => T
  /** Default value if nothing is stored */
  defaultValue?: T
}

/**
 * Get the browser storage object based on type
 */
function getBrowserStorage(type: StorageType): Storage {
  return type === 'local' ? localStorage : sessionStorage
}

/**
 * Composable for persisting reactive state to storage
 * Supports both browser (localStorage/sessionStorage) and Wails (SQLite) modes
 *
 * @param dataRef - Ref or array of refs to persist
 * @param options - Configuration options
 */
export function useStoragePersistence<T>(
  dataRef: Ref<T> | WatchSource<T>[],
  options: UseStoragePersistenceOptions<T>,
) {
  const {
    key,
    storeName,
    storage = 'local',
    serialize = JSON.stringify,
    deserialize = JSON.parse,
    defaultValue,
  } = options

  // Use async storage adapter for Wails, direct browser storage otherwise
  const isInWails = isWails()
  const asyncStorage = isInWails ? getStorage<string>(storeName) : null
  const browserStorage = !isInWails ? getBrowserStorage(storage) : null

  /**
   * Load data from storage (async)
   */
  async function load(): Promise<T | null> {
    try {
      if (asyncStorage) {
        const stored = await asyncStorage.get(key)
        if (stored) {
          return deserialize(stored)
        }
      } else if (browserStorage) {
        const stored = browserStorage.getItem(getFullKey(key, storeName))
        if (stored) {
          return deserialize(stored)
        }
      }
      return defaultValue ?? null
    } catch (error) {
      console.error(`Failed to load from storage [${key}]:`, error)
      return defaultValue ?? null
    }
  }

  /**
   * Load data synchronously (browser only, for backwards compatibility)
   */
  function loadSync(): T | null {
    if (browserStorage) {
      try {
        const stored = browserStorage.getItem(getFullKey(key, storeName))
        if (stored) {
          return deserialize(stored)
        }
      } catch (error) {
        console.error(`Failed to load from storage [${key}]:`, error)
      }
    }
    return defaultValue ?? null
  }

  /**
   * Save data to storage (async)
   */
  async function save(data: T): Promise<boolean> {
    try {
      const serialized = serialize(data)
      if (asyncStorage) {
        await asyncStorage.set(key, serialized)
      } else if (browserStorage) {
        browserStorage.setItem(getFullKey(key, storeName), serialized)
      }
      return true
    } catch (error) {
      console.error(`Failed to save to storage [${key}]:`, error)
      return false
    }
  }

  /**
   * Remove data from storage (async)
   */
  async function remove(): Promise<boolean> {
    try {
      if (asyncStorage) {
        await asyncStorage.remove(key)
      } else if (browserStorage) {
        browserStorage.removeItem(getFullKey(key, storeName))
      }
      return true
    } catch (error) {
      console.error(`Failed to remove from storage [${key}]:`, error)
      return false
    }
  }

  /**
   * Setup auto-save watcher
   * Saves asynchronously whenever the watched data changes
   */
  function setupAutoSave(getData: () => T) {
    watch(
      dataRef,
      () => {
        // Fire and forget - don't await
        save(getData()).catch((err) => {
          console.error('Auto-save failed:', err)
        })
      },
      { deep: true },
    )
  }

  return {
    load,
    loadSync,
    save,
    remove,
    setupAutoSave,
    isAsync: isInWails,
  }
}

/**
 * Get the full storage key for browser storage
 */
function getFullKey(key: string, storeName: StoreName, workspaceId?: string): string {
  if (workspaceId) {
    return `http-visualizer:${workspaceId}:${storeName}:${key}`
  }
  return `http-visualizer:${storeName}:${key}`
}

/**
 * Create a simple storage service for a specific key
 * Supports both async (Wails) and sync (browser) modes
 */
export function createStorageService<T>(
  key: string,
  storeName: StoreName,
  options: Omit<UseStoragePersistenceOptions<T>, 'key' | 'storeName'> = {},
) {
  const {
    storage = 'local',
    serialize = JSON.stringify,
    deserialize = JSON.parse,
    defaultValue,
  } = options

  const isInWails = isWails()
  const asyncStorage = isInWails ? getStorage<string>(storeName) : null
  const browserStorage = !isInWails ? getBrowserStorage(storage) : null

  return {
    async load(): Promise<T | null> {
      try {
        if (asyncStorage) {
          const stored = await asyncStorage.get(key)
          if (stored) {
            return deserialize(stored)
          }
        } else if (browserStorage) {
          const stored = browserStorage.getItem(getFullKey(key, storeName))
          if (stored) {
            return deserialize(stored)
          }
        }
        return defaultValue ?? null
      } catch (error) {
        console.error(`Failed to load from storage [${key}]:`, error)
        return defaultValue ?? null
      }
    },

    loadSync(): T | null {
      if (browserStorage) {
        try {
          const stored = browserStorage.getItem(getFullKey(key, storeName))
          if (stored) {
            return deserialize(stored)
          }
        } catch (error) {
          console.error(`Failed to load from storage [${key}]:`, error)
        }
      }
      return defaultValue ?? null
    },

    async save(data: T): Promise<boolean> {
      try {
        const serialized = serialize(data)
        if (asyncStorage) {
          await asyncStorage.set(key, serialized)
        } else if (browserStorage) {
          browserStorage.setItem(getFullKey(key, storeName), serialized)
        }
        return true
      } catch (error) {
        console.error(`Failed to save to storage [${key}]:`, error)
        return false
      }
    },

    async remove(): Promise<boolean> {
      try {
        if (asyncStorage) {
          await asyncStorage.remove(key)
        } else if (browserStorage) {
          browserStorage.removeItem(getFullKey(key, storeName))
        }
        return true
      } catch (error) {
        console.error(`Failed to remove from storage [${key}]:`, error)
        return false
      }
    },

    isAsync: isInWails,
  }
}

/**
 * Create a workspace-scoped storage service
 * Data is stored with workspace ID in the key for isolation
 */
export function createWorkspaceScopedStorage<T>(
  key: string,
  storeName: StoreName,
  getWorkspaceId: () => string | null,
  options: Omit<UseStoragePersistenceOptions<T>, 'key' | 'storeName'> = {},
) {
  const {
    storage = 'local',
    serialize = JSON.stringify,
    deserialize = JSON.parse,
    defaultValue,
  } = options

  const isInWails = isWails()
  const asyncStorage = isInWails ? getStorage<string>(storeName) : null
  const browserStorage = !isInWails ? getBrowserStorage(storage) : null

  function getWorkspaceKey(): string {
    const workspaceId = getWorkspaceId()
    if (!workspaceId) {
      throw new Error('No active workspace')
    }
    return `${workspaceId}:${key}`
  }

  return {
    async load(): Promise<T | null> {
      try {
        const wsKey = getWorkspaceKey()
        if (asyncStorage) {
          const stored = await asyncStorage.get(wsKey)
          if (stored) {
            return deserialize(stored)
          }
        } else if (browserStorage) {
          const workspaceId = getWorkspaceId()
          const stored = browserStorage.getItem(getFullKey(key, storeName, workspaceId || undefined))
          if (stored) {
            return deserialize(stored)
          }
        }
        return defaultValue ?? null
      } catch (error) {
        console.error(`Failed to load from workspace storage [${key}]:`, error)
        return defaultValue ?? null
      }
    },

    loadSync(): T | null {
      if (browserStorage) {
        try {
          const workspaceId = getWorkspaceId()
          const stored = browserStorage.getItem(getFullKey(key, storeName, workspaceId || undefined))
          if (stored) {
            return deserialize(stored)
          }
        } catch (error) {
          console.error(`Failed to load from workspace storage [${key}]:`, error)
        }
      }
      return defaultValue ?? null
    },

    async save(data: T): Promise<boolean> {
      try {
        const serialized = serialize(data)
        const wsKey = getWorkspaceKey()
        if (asyncStorage) {
          await asyncStorage.set(wsKey, serialized)
        } else if (browserStorage) {
          const workspaceId = getWorkspaceId()
          browserStorage.setItem(getFullKey(key, storeName, workspaceId || undefined), serialized)
        }
        return true
      } catch (error) {
        console.error(`Failed to save to workspace storage [${key}]:`, error)
        return false
      }
    },

    async remove(): Promise<boolean> {
      try {
        const wsKey = getWorkspaceKey()
        if (asyncStorage) {
          await asyncStorage.remove(wsKey)
        } else if (browserStorage) {
          const workspaceId = getWorkspaceId()
          browserStorage.removeItem(getFullKey(key, storeName, workspaceId || undefined))
        }
        return true
      } catch (error) {
        console.error(`Failed to remove from workspace storage [${key}]:`, error)
        return false
      }
    },

    /**
     * Load data for a specific workspace (for migration or export)
     */
    loadForWorkspace(workspaceId: string): T | null {
      if (browserStorage) {
        try {
          const stored = browserStorage.getItem(getFullKey(key, storeName, workspaceId))
          if (stored) {
            return deserialize(stored)
          }
        } catch (error) {
          console.error(`Failed to load from workspace storage [${key}]:`, error)
        }
      }
      return defaultValue ?? null
    },

    /**
     * Save data to a specific workspace (for migration or import)
     */
    async saveToWorkspace(workspaceId: string, data: T): Promise<boolean> {
      try {
        const serialized = serialize(data)
        if (asyncStorage) {
          await asyncStorage.set(`${workspaceId}:${key}`, serialized)
        } else if (browserStorage) {
          browserStorage.setItem(getFullKey(key, storeName, workspaceId), serialized)
        }
        return true
      } catch (error) {
        console.error(`Failed to save to workspace storage [${key}]:`, error)
        return false
      }
    },

    /**
     * Load from legacy (non-workspace) storage for migration
     */
    loadLegacy(): T | null {
      if (browserStorage) {
        try {
          // Legacy key without workspace prefix
          const stored = browserStorage.getItem(`http-visualizer:${storeName}:${key}`)
          if (stored) {
            return deserialize(stored)
          }
        } catch (error) {
          console.error(`Failed to load legacy storage [${key}]:`, error)
        }
      }
      return defaultValue ?? null
    },

    /**
     * Remove legacy storage after migration
     */
    async removeLegacy(): Promise<boolean> {
      try {
        if (browserStorage) {
          browserStorage.removeItem(`http-visualizer:${storeName}:${key}`)
        }
        return true
      } catch (error) {
        console.error(`Failed to remove legacy storage [${key}]:`, error)
        return false
      }
    },

    isAsync: isInWails,
  }
}
