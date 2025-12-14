/**
 * Async Storage Service Interface
 *
 * Used for storage backends that require async operations (SQLite, IndexedDB, etc.)
 */
export interface AsyncStorageService<T = unknown> {
  /**
   * Get a value from storage
   */
  get(key: string): Promise<T | null>

  /**
   * Set a value in storage
   */
  set(key: string, value: T): Promise<void>

  /**
   * Remove a value from storage
   */
  remove(key: string): Promise<void>

  /**
   * Check if a key exists
   */
  has(key: string): Promise<boolean>

  /**
   * Clear all values in this store
   */
  clear(): Promise<void>

  /**
   * Get all keys in this store
   */
  keys(): Promise<string[]>
}

/**
 * Storage store names used across the application
 */
export type StoreName =
  | 'collections'
  | 'theme'
  | 'auth'
  | 'tokens'
  | 'environment'
  | 'presentation'
  | 'settings'
  | 'workspaces'
