/**
 * Browser API Client
 *
 * Handles HTTP proxy requests via fetch to the backend server
 * Used when running in a browser (non-Tauri) environment
 */

import type { ProxyRequest, ProxyResponse } from './types'

/**
 * Execute an HTTP proxy request via fetch
 */
export async function proxyRequest(request: ProxyRequest): Promise<ProxyResponse> {
  try {
    const response = await fetch('/api/proxy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        method: request.method,
        url: request.url,
        headers: request.headers || {},
        body: request.body,
        timeout: request.timeout || 30000,
      }),
    })

    if (!response.ok) {
      return {
        success: false,
        error: {
          message: `HTTP error: ${response.status} ${response.statusText}`,
          code: 'HTTP_ERROR',
        },
      }
    }

    return await response.json()
  } catch (error) {
    return {
      success: false,
      error: {
        message: error instanceof Error ? error.message : String(error),
        code: 'FETCH_ERROR',
      },
    }
  }
}

/**
 * Check if the backend server is healthy
 */
export async function checkHealth(): Promise<boolean> {
  try {
    const response = await fetch('/api/health', {
      method: 'GET',
      headers: { Accept: 'application/json' },
    })
    return response.ok
  } catch {
    return false
  }
}
