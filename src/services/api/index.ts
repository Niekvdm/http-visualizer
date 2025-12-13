/**
 * API Client
 *
 * Provides a unified interface for HTTP proxy requests
 * Automatically selects Tauri IPC or browser fetch based on platform
 */

import { isTauri } from '../storage/platform'
import type { ProxyRequest, ProxyResponse } from './types'
import * as TauriApiClient from './TauriApiClient'
import * as BrowserApiClient from './BrowserApiClient'

export type { ProxyRequest, ProxyResponse } from './types'
export type {
  TimingInfo,
  RedirectHop,
  TlsInfo,
  SizeBreakdown,
  ResponseData,
  ErrorData,
} from './types'

/**
 * Execute an HTTP proxy request
 * Uses Tauri IPC when in desktop app, fetch when in browser
 */
export async function proxyRequest(request: ProxyRequest): Promise<ProxyResponse> {
  if (isTauri()) {
    return TauriApiClient.proxyRequest(request)
  }
  return BrowserApiClient.proxyRequest(request)
}

/**
 * Check if the backend is healthy
 */
export async function checkHealth(): Promise<boolean> {
  if (isTauri()) {
    return TauriApiClient.checkHealth()
  }
  return BrowserApiClient.checkHealth()
}

/**
 * Get the current API backend type
 */
export function getApiBackendType(): 'tauri' | 'browser' {
  return isTauri() ? 'tauri' : 'browser'
}
