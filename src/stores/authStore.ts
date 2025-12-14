import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { AuthConfig, AuthState, CachedToken, AuthType } from '@/types'
import { createStorageService } from '@/composables/useStoragePersistence'

// Storage service for auth persistence
// Uses session storage in browser, SQLite in Wails (persisted across sessions in Wails)
const authStorage = createStorageService<{
  authConfigs: Record<string, AuthConfig>
  fileAuthConfigs: Record<string, AuthConfig>
  globalAuthConfig: AuthConfig | null
  cachedTokens: Record<string, CachedToken>
}>('auth-state', 'auth', { storage: 'session' })

export const useAuthStore = defineStore('auth', () => {
  // State
  const authConfigs = ref<Map<string, AuthConfig>>(new Map()) // requestId -> config
  const fileAuthConfigs = ref<Map<string, AuthConfig>>(new Map()) // fileId -> config
  const globalAuthConfig = ref<AuthConfig | null>(null)
  const cachedTokens = ref<Map<string, CachedToken>>(new Map())
  const isInitialized = ref(false)

  // Initialize from storage (sync for browser, async will override in Wails)
  function initFromStorageSync() {
    const data = authStorage.loadSync()
    if (data) {
      if (data.authConfigs) {
        authConfigs.value = new Map(Object.entries(data.authConfigs))
      }
      if (data.fileAuthConfigs) {
        fileAuthConfigs.value = new Map(Object.entries(data.fileAuthConfigs))
      }
      if (data.globalAuthConfig) {
        globalAuthConfig.value = data.globalAuthConfig
      }
      if (data.cachedTokens) {
        cachedTokens.value = new Map(Object.entries(data.cachedTokens))
      }
    }
  }

  // Async initialization for Wails mode
  async function initialize() {
    if (isInitialized.value) return

    const data = await authStorage.load()
    if (data) {
      if (data.authConfigs) {
        authConfigs.value = new Map(Object.entries(data.authConfigs))
      }
      if (data.fileAuthConfigs) {
        fileAuthConfigs.value = new Map(Object.entries(data.fileAuthConfigs))
      }
      if (data.globalAuthConfig) {
        globalAuthConfig.value = data.globalAuthConfig
      }
      if (data.cachedTokens) {
        cachedTokens.value = new Map(Object.entries(data.cachedTokens))
      }
    }
    isInitialized.value = true
  }

  // Save to storage (fire and forget)
  function saveToStorage() {
    const data = {
      authConfigs: Object.fromEntries(authConfigs.value),
      fileAuthConfigs: Object.fromEntries(fileAuthConfigs.value),
      globalAuthConfig: globalAuthConfig.value,
      cachedTokens: Object.fromEntries(cachedTokens.value),
    }
    authStorage.save(data).catch((err) => {
      console.error('Failed to save auth state:', err)
    })
  }

  // Get auth config for a request with inheritance:
  // 1. Request-specific config (highest priority)
  // 2. File/folder config (if fileId provided)
  // 3. Global config (lowest priority)
  function getAuthConfig(requestId: string, fileId?: string): AuthConfig | null {
    // Check request-specific first
    const requestConfig = authConfigs.value.get(requestId)
    if (requestConfig) {
      return requestConfig
    }

    // Check file-level config
    if (fileId) {
      const fileConfig = fileAuthConfigs.value.get(fileId)
      if (fileConfig) {
        return fileConfig
      }
    }

    // Fall back to global
    return globalAuthConfig.value
  }

  // Get the source of auth config for display purposes
  function getAuthConfigSource(requestId: string, fileId?: string): 'request' | 'file' | 'global' | null {
    if (authConfigs.value.has(requestId)) {
      return 'request'
    }
    if (fileId && fileAuthConfigs.value.has(fileId)) {
      return 'file'
    }
    if (globalAuthConfig.value) {
      return 'global'
    }
    return null
  }

  // Set auth config for a specific request
  function setAuthConfig(requestId: string, config: AuthConfig) {
    // Create a new Map to ensure reactivity
    const newMap = new Map(authConfigs.value)
    newMap.set(requestId, config)
    authConfigs.value = newMap
    saveToStorage()
  }

  // Remove auth config for a specific request
  function removeAuthConfig(requestId: string) {
    // Create a new Map to ensure reactivity
    const newMap = new Map(authConfigs.value)
    newMap.delete(requestId)
    authConfigs.value = newMap
    cachedTokens.value.delete(requestId)
    saveToStorage()
  }

  // Set auth config for a file/folder
  function setFileAuthConfig(fileId: string, config: AuthConfig) {
    // Create a new Map to ensure reactivity
    const newMap = new Map(fileAuthConfigs.value)
    newMap.set(fileId, config)
    fileAuthConfigs.value = newMap
    saveToStorage()
  }

  // Remove auth config for a file/folder
  function removeFileAuthConfig(fileId: string) {
    // Create a new Map to ensure reactivity
    const newMap = new Map(fileAuthConfigs.value)
    newMap.delete(fileId)
    fileAuthConfigs.value = newMap
    // Also clear cached tokens for this file
    cachedTokens.value.delete(`file:${fileId}`)
    saveToStorage()
  }

  // Get file auth config
  function getFileAuthConfig(fileId: string): AuthConfig | null {
    return fileAuthConfigs.value.get(fileId) || null
  }

  // Check if file has auth configured
  function hasFileAuthConfig(fileId: string): boolean {
    const config = fileAuthConfigs.value.get(fileId)
    return config !== null && config !== undefined && config.type !== 'none'
  }

  // Set global auth config
  function setGlobalAuthConfig(config: AuthConfig | null) {
    globalAuthConfig.value = config
    saveToStorage()
  }

  // Get cached token for a request (checks request, then file, then global)
  function getCachedToken(requestId: string, fileId?: string): CachedToken | null {
    // Check request-specific token
    let token = cachedTokens.value.get(requestId)
    if (token) {
      if (token.expiresAt && Date.now() >= token.expiresAt) {
        cachedTokens.value.delete(requestId)
        saveToStorage()
      } else {
        return token
      }
    }

    // Check file-level token
    if (fileId) {
      token = cachedTokens.value.get(`file:${fileId}`)
      if (token) {
        if (token.expiresAt && Date.now() >= token.expiresAt) {
          cachedTokens.value.delete(`file:${fileId}`)
          saveToStorage()
        } else {
          return token
        }
      }
    }

    // Check global token
    token = cachedTokens.value.get('global')
    if (token) {
      if (token.expiresAt && Date.now() >= token.expiresAt) {
        cachedTokens.value.delete('global')
        saveToStorage()
        return null
      }
      return token
    }

    return null
  }

  // Set cached token with appropriate key based on config source
  function setCachedToken(key: string, token: CachedToken) {
    cachedTokens.value.set(key, token)
    saveToStorage()
  }

  // Clear cached token
  function clearCachedToken(key: string) {
    cachedTokens.value.delete(key)
    saveToStorage()
  }

  // Clear all cached tokens
  function clearAllTokens() {
    cachedTokens.value.clear()
    saveToStorage()
  }

  // Check if token needs refresh (within 60 seconds of expiry)
  function tokenNeedsRefresh(key: string): boolean {
    const token = cachedTokens.value.get(key)
    if (!token || !token.expiresAt) return false
    
    const bufferMs = 60 * 1000 // 60 seconds buffer
    return Date.now() >= (token.expiresAt - bufferMs)
  }

  // Check if request has auth configured (including inherited)
  function hasAuthConfig(requestId: string, fileId?: string): boolean {
    const config = getAuthConfig(requestId, fileId)
    return config !== null && config.type !== 'none'
  }

  // Check if request has its OWN auth config (not inherited)
  function hasOwnAuthConfig(requestId: string): boolean {
    const config = authConfigs.value.get(requestId)
    return config !== null && config !== undefined && config.type !== 'none'
  }

  // Get auth type label for display
  function getAuthTypeLabel(type: AuthType): string {
    const labels: Record<AuthType, string> = {
      'none': 'No Auth',
      'basic': 'Basic Auth',
      'bearer': 'Bearer Token',
      'api-key': 'API Key',
      'oauth2-client-credentials': 'OAuth2 (Client Credentials)',
      'oauth2-password': 'OAuth2 (Password)',
      'oauth2-authorization-code': 'OAuth2 (Authorization Code)',
      'oauth2-implicit': 'OAuth2 (Implicit - Legacy)',
      'manual-headers': 'Manual Headers',
    }
    return labels[type] || type
  }

  // Create default auth config
  function createDefaultConfig(type: AuthType): AuthConfig {
    const config: AuthConfig = { type }

    switch (type) {
      case 'basic':
        config.basic = { username: '', password: '' }
        break
      case 'bearer':
        config.bearer = { token: '' }
        break
      case 'api-key':
        config.apiKey = { key: '', value: '', in: 'header' }
        break
      case 'oauth2-client-credentials':
        config.oauth2ClientCredentials = {
          tokenUrl: '',
          clientId: '',
          clientSecret: '',
          scope: '',
        }
        break
      case 'oauth2-password':
        config.oauth2Password = {
          tokenUrl: '',
          clientId: '',
          username: '',
          password: '',
          scope: '',
        }
        break
      case 'oauth2-authorization-code':
        config.oauth2AuthorizationCode = {
          authorizationUrl: '',
          tokenUrl: '',
          clientId: '',
          redirectUri: window.location.origin + '/oauth/callback',
          scope: '',
          usePkce: true,
        }
        break
      case 'oauth2-implicit':
        config.oauth2Implicit = {
          authorizationUrl: '',
          clientId: '',
          redirectUri: window.location.origin + '/oauth/callback',
          scope: '',
        }
        break
      case 'manual-headers':
        config.manualHeaders = { headers: [] }
        break
    }

    return config
  }

  // Clear all auth data
  function clearAll() {
    authConfigs.value.clear()
    fileAuthConfigs.value.clear()
    globalAuthConfig.value = null
    cachedTokens.value.clear()
    saveToStorage()
  }

  // Initialize on store creation (sync for browser, will be overridden by async in Wails)
  initFromStorageSync()

  return {
    // State
    authConfigs,
    fileAuthConfigs,
    globalAuthConfig,
    cachedTokens,
    isInitialized,

    // Getters
    getAuthConfig,
    getAuthConfigSource,
    getFileAuthConfig,
    getCachedToken,
    hasAuthConfig,
    hasOwnAuthConfig,
    hasFileAuthConfig,
    tokenNeedsRefresh,
    getAuthTypeLabel,

    // Actions
    initialize,
    setAuthConfig,
    removeAuthConfig,
    setFileAuthConfig,
    removeFileAuthConfig,
    setGlobalAuthConfig,
    setCachedToken,
    clearCachedToken,
    clearAllTokens,
    createDefaultConfig,
    clearAll,
    saveToStorage,
  }
})
