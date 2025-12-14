/**
 * Wails API Client
 *
 * Handles HTTP proxy requests via Wails IPC commands
 * Used when running inside the Wails desktop application
 */

import type { ProxyRequest, ProxyResponse } from './types'

/**
 * Execute an HTTP proxy request via Wails IPC
 */
export async function proxyRequest(request: ProxyRequest): Promise<ProxyResponse> {
  try {
    const response = await window.go.main.App.ProxyRequest(request)
    return response as ProxyResponse
  } catch (error) {
    return {
      success: false,
      error: {
        message: error instanceof Error ? error.message : String(error),
        code: 'WAILS_IPC_ERROR',
      },
    }
  }
}

/**
 * Check if the Wails backend is healthy
 * Since we're using IPC, this is always true if we can invoke commands
 */
export async function checkHealth(): Promise<boolean> {
  try {
    // Try a simple storage operation to verify IPC works
    await window.go.main.App.StorageHas('settings', '__health_check__')
    return true
  } catch {
    return false
  }
}
