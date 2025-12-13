/**
 * Storage Initialization
 *
 * Initializes all stores asynchronously for Tauri mode.
 * In browser mode, stores use sync localStorage which is already initialized.
 */

import { isTauri } from './platform'

/**
 * Initialize all stores that need async storage loading.
 * This should be called early in the app lifecycle (after Pinia is set up).
 *
 * For browser mode: No-op (stores already use sync localStorage)
 * For Tauri mode: Loads data from SQLite via IPC
 */
export async function initializeStorage(): Promise<void> {
  if (!isTauri()) {
    // Browser mode - stores already initialized with sync localStorage
    return
  }

  console.log('[Storage] Initializing Tauri storage...')

  // Import stores dynamically to avoid circular dependencies
  // and ensure Pinia is ready
  const { useThemeStore } = await import('@/stores/themeStore')
  const { useAuthStore } = await import('@/stores/authStore')
  const { useEnvironmentStore } = await import('@/stores/environmentStore')
  const { useTokenStore } = await import('@/stores/tokenStore')
  const { usePresentationStore } = await import('@/stores/presentationStore')
  const { initialize: initializeCollections } = await import(
    '@/stores/collections/collectionState'
  )

  // Initialize all stores in parallel
  await Promise.all([
    useThemeStore().initialize(),
    useAuthStore().initialize(),
    useEnvironmentStore().initialize(),
    useTokenStore().initialize(),
    usePresentationStore().initialize(),
    initializeCollections(),
  ])

  console.log('[Storage] Tauri storage initialized')
}
