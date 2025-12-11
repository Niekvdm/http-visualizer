/**
 * Storage Service Interface
 * 
 * Abstracts storage operations behind an interface for:
 * - Testability (can mock in tests)
 * - Flexibility (can swap implementations)
 * - Dependency Inversion Principle
 */

export interface StorageService<T = unknown> {
  /**
   * Get a value from storage
   */
  get(key: string): T | null

  /**
   * Set a value in storage
   */
  set(key: string, value: T): void

  /**
   * Remove a value from storage
   */
  remove(key: string): void

  /**
   * Check if a key exists
   */
  has(key: string): boolean

  /**
   * Clear all values
   */
  clear(): void
}

/**
 * LocalStorage implementation
 */
export class LocalStorageService<T = unknown> implements StorageService<T> {
  #prefix: string
  #serializer: (value: T) => string
  #deserializer: (raw: string) => T

  constructor(
    prefix: string = '',
    serializer: (value: T) => string = JSON.stringify,
    deserializer: (raw: string) => T = JSON.parse
  ) {
    this.#prefix = prefix
    this.#serializer = serializer
    this.#deserializer = deserializer
  }

  #getKey(key: string): string {
    return this.#prefix ? `${this.#prefix}:${key}` : key
  }

  get(key: string): T | null {
    try {
      const raw = localStorage.getItem(this.#getKey(key))
      return raw ? this.#deserializer(raw) : null
    } catch (error) {
      console.error(`LocalStorage get error for key "${key}":`, error)
      return null
    }
  }

  set(key: string, value: T): void {
    try {
      localStorage.setItem(this.#getKey(key), this.#serializer(value))
    } catch (error) {
      console.error(`LocalStorage set error for key "${key}":`, error)
    }
  }

  remove(key: string): void {
    try {
      localStorage.removeItem(this.#getKey(key))
    } catch (error) {
      console.error(`LocalStorage remove error for key "${key}":`, error)
    }
  }

  has(key: string): boolean {
    return localStorage.getItem(this.#getKey(key)) !== null
  }

  clear(): void {
    if (this.#prefix) {
      // Only clear keys with our prefix
      const keysToRemove: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key?.startsWith(this.#prefix)) {
          keysToRemove.push(key)
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key))
    } else {
      localStorage.clear()
    }
  }
}

/**
 * SessionStorage implementation
 */
export class SessionStorageService<T = unknown> implements StorageService<T> {
  #prefix: string
  #serializer: (value: T) => string
  #deserializer: (raw: string) => T

  constructor(
    prefix: string = '',
    serializer: (value: T) => string = JSON.stringify,
    deserializer: (raw: string) => T = JSON.parse
  ) {
    this.#prefix = prefix
    this.#serializer = serializer
    this.#deserializer = deserializer
  }

  #getKey(key: string): string {
    return this.#prefix ? `${this.#prefix}:${key}` : key
  }

  get(key: string): T | null {
    try {
      const raw = sessionStorage.getItem(this.#getKey(key))
      return raw ? this.#deserializer(raw) : null
    } catch (error) {
      console.error(`SessionStorage get error for key "${key}":`, error)
      return null
    }
  }

  set(key: string, value: T): void {
    try {
      sessionStorage.setItem(this.#getKey(key), this.#serializer(value))
    } catch (error) {
      console.error(`SessionStorage set error for key "${key}":`, error)
    }
  }

  remove(key: string): void {
    try {
      sessionStorage.removeItem(this.#getKey(key))
    } catch (error) {
      console.error(`SessionStorage remove error for key "${key}":`, error)
    }
  }

  has(key: string): boolean {
    return sessionStorage.getItem(this.#getKey(key)) !== null
  }

  clear(): void {
    if (this.#prefix) {
      const keysToRemove: string[] = []
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i)
        if (key?.startsWith(this.#prefix)) {
          keysToRemove.push(key)
        }
      }
      keysToRemove.forEach(key => sessionStorage.removeItem(key))
    } else {
      sessionStorage.clear()
    }
  }
}

/**
 * In-Memory storage implementation (for testing)
 */
export class MemoryStorageService<T = unknown> implements StorageService<T> {
  #storage = new Map<string, T>()

  get(key: string): T | null {
    return this.#storage.get(key) ?? null
  }

  set(key: string, value: T): void {
    this.#storage.set(key, value)
  }

  remove(key: string): void {
    this.#storage.delete(key)
  }

  has(key: string): boolean {
    return this.#storage.has(key)
  }

  clear(): void {
    this.#storage.clear()
  }
}

/**
 * Factory function to create storage service
 */
export function createStorage<T>(
  type: 'local' | 'session' | 'memory' = 'local',
  prefix: string = ''
): StorageService<T> {
  switch (type) {
    case 'session':
      return new SessionStorageService<T>(prefix)
    case 'memory':
      return new MemoryStorageService<T>()
    case 'local':
    default:
      return new LocalStorageService<T>(prefix)
  }
}
