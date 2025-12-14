// Types
export type { AsyncStorageService, StoreName } from './types'

// Platform detection
export { isWails, isBrowser } from './platform'

// Factory
export { getStorage, clearStorageCache } from './StorageFactory'

// Initialization
export { initializeStorage } from './initStorage'

// Adapters (for direct use if needed)
export { BrowserStorageAdapter, WailsStorageAdapter } from './adapters'

// Legacy sync storage (for backwards compatibility during migration)
export type { StorageService } from './StorageService'
export {
  LocalStorageService,
  SessionStorageService,
  MemoryStorageService,
  createStorage,
} from './StorageService'
