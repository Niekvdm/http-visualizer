/**
 * Platform detection utilities
 * Detects whether running in Tauri desktop app vs browser
 */

/**
 * Check if running inside Tauri desktop application
 */
export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

/**
 * Check if running in a browser environment
 */
export function isBrowser(): boolean {
  return typeof window !== 'undefined' && !isTauri()
}
