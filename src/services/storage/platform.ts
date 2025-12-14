/**
 * Platform detection utilities
 * Detects whether running in Wails desktop app vs browser
 */

/**
 * Check if running inside Wails desktop application
 * Wails exposes Go bindings via window.go
 */
export function isWails(): boolean {
  return typeof window !== 'undefined' && 'go' in window
}


/**
 * Check if running in a browser environment
 */
export function isBrowser(): boolean {
  return typeof window !== 'undefined' && !isWails()
}
