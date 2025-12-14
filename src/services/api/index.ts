/**
 * API Client
 *
 * Provides a unified interface for HTTP proxy requests
 * Automatically selects Wails IPC or browser fetch based on platform
 */

import { isWails } from '../storage/platform'
import type { ProxyRequest, ProxyResponse } from './types'
import * as WailsApiClient from './WailsApiClient'
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
 * Uses Wails IPC when in desktop app, fetch when in browser
 */
export async function proxyRequest(request: ProxyRequest): Promise<ProxyResponse> {
  if (isWails()) {
    return WailsApiClient.proxyRequest(request)
  }
  return BrowserApiClient.proxyRequest(request)
}

/**
 * Check if the backend is healthy
 */
export async function checkHealth(): Promise<boolean> {
  if (isWails()) {
    return WailsApiClient.checkHealth()
  }
  return BrowserApiClient.checkHealth()
}

/**
 * Get the current API backend type
 */
export function getApiBackendType(): 'wails' | 'browser' {
  return isWails() ? 'wails' : 'browser'
}
