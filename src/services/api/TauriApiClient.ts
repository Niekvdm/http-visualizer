/**
 * Tauri API Client
 *
 * Handles HTTP proxy requests via Tauri IPC commands
 * Used when running inside the Tauri desktop application
 */

import { invoke } from '@tauri-apps/api/core'
import type { ProxyRequest, ProxyResponse } from './types'

/**
 * Execute an HTTP proxy request via Tauri IPC
 */
export async function proxyRequest(request: ProxyRequest): Promise<ProxyResponse> {
  try {
    const response = await invoke<ProxyResponse>('proxy_request', { request })
    return response
  } catch (error) {
    return {
      success: false,
      error: {
        message: error instanceof Error ? error.message : String(error),
        code: 'TAURI_IPC_ERROR',
      },
    }
  }
}

/**
 * Check if the Tauri backend is healthy
 * Since we're using IPC, this is always true if we can invoke commands
 */
export async function checkHealth(): Promise<boolean> {
  try {
    // Try a simple storage operation to verify IPC works
    await invoke('storage_has', { store: 'settings', key: '__health_check__' })
    return true
  } catch {
    return false
  }
}
