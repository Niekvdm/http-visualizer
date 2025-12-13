import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { CachedToken } from '@/types'
import { createStorageService } from '@/composables/useStoragePersistence'

const storage = createStorageService<Record<string, CachedToken>>('tokens', 'tokens', {
  storage: 'session',
})

/**
 * Token Store
 *
 * Manages OAuth2 token caching and lifecycle separately from auth configuration.
 * This follows the Single Responsibility Principle by separating:
 * - Auth configuration (authStore) - what auth to use
 * - Token management (tokenStore) - cached tokens and refresh logic
 */
export const useTokenStore = defineStore('tokens', () => {
  // State
  const cachedTokens = ref<Map<string, CachedToken>>(new Map())
  const isInitialized = ref(false)

  // Initialize from storage (sync for browser)
  function initFromStorageSync() {
    const stored = storage.loadSync()
    if (stored) {
      cachedTokens.value = new Map(Object.entries(stored))
    }
  }

  // Async initialization for Tauri mode
  async function initialize() {
    if (isInitialized.value) return

    const stored = await storage.load()
    if (stored) {
      cachedTokens.value = new Map(Object.entries(stored))
    }
    isInitialized.value = true
  }

  // Save to storage (fire and forget)
  function saveToStorage() {
    const tokensObj = Object.fromEntries(cachedTokens.value)
    storage.save(tokensObj).catch((err) => {
      console.error('Failed to save tokens:', err)
    })
  }

  /**
   * Get cached token for a key (request ID, file:fileId, or 'global')
   */
  function getCachedToken(key: string): CachedToken | null {
    const token = cachedTokens.value.get(key)
    if (!token) return null

    // Check if token is expired
    if (token.expiresAt && Date.now() >= token.expiresAt) {
      cachedTokens.value.delete(key)
      saveToStorage()
      return null
    }

    return token
  }

  /**
   * Get token with fallback chain: request -> file -> global
   */
  function getTokenWithFallback(requestId: string, fileId?: string): CachedToken | null {
    // Check request-specific token
    let token = getCachedToken(requestId)
    if (token) return token

    // Check file-level token
    if (fileId) {
      token = getCachedToken(`file:${fileId}`)
      if (token) return token
    }

    // Check global token
    return getCachedToken('global')
  }

  /**
   * Set cached token
   */
  function setCachedToken(key: string, token: CachedToken) {
    cachedTokens.value.set(key, token)
    saveToStorage()
  }

  /**
   * Clear cached token for a specific key
   */
  function clearCachedToken(key: string) {
    cachedTokens.value.delete(key)
    saveToStorage()
  }

  /**
   * Clear all cached tokens
   */
  function clearAllTokens() {
    cachedTokens.value.clear()
    saveToStorage()
  }

  /**
   * Check if token needs refresh (within 60 seconds of expiry)
   */
  function tokenNeedsRefresh(key: string): boolean {
    const token = cachedTokens.value.get(key)
    if (!token || !token.expiresAt) return false
    
    const bufferMs = 60 * 1000 // 60 seconds buffer
    return Date.now() >= (token.expiresAt - bufferMs)
  }

  /**
   * Check if a valid (non-expired) token exists for a key
   */
  function hasValidToken(key: string): boolean {
    return getCachedToken(key) !== null
  }

  /**
   * Get time until token expires (in seconds)
   */
  function getTokenExpiresIn(key: string): number | null {
    const token = cachedTokens.value.get(key)
    if (!token?.expiresAt) return null
    
    const remaining = Math.max(0, token.expiresAt - Date.now())
    return Math.round(remaining / 1000)
  }

  // Initialize on store creation (sync for browser)
  initFromStorageSync()

  return {
    // State
    cachedTokens,
    isInitialized,

    // Getters
    getCachedToken,
    getTokenWithFallback,
    hasValidToken,
    tokenNeedsRefresh,
    getTokenExpiresIn,

    // Actions
    initialize,
    setCachedToken,
    clearCachedToken,
    clearAllTokens,
    saveToStorage,
  }
})

