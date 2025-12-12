/**
 * Execution Type Definitions
 * 
 * Focused types for request execution and response handling.
 */

import type { SentRequest } from './request'

// Execution phases
export type ExecutionPhase = 'idle' | 'authenticating' | 'authorizing' | 'fetching' | 'success' | 'error'

// Detailed timing breakdown from Performance Resource Timing API
export interface ResponseTiming {
  /** Total request time in ms */
  total: number
  /** DNS lookup time in ms */
  dns?: number
  /** TCP connection time in ms */
  tcp?: number
  /** TLS handshake time in ms (0 for HTTP) */
  tls?: number
  /** Time to first byte in ms */
  ttfb?: number
  /** Content download time in ms */
  download?: number
  /** Time blocked/queued in ms */
  blocked?: number
}

// Redirect hop information
export interface RedirectHop {
  /** URL of hop */
  url: string
  /** HTTP status code (301, 302, 307, 308), 0 for opaque */
  status: number
  /** Time for this hop in ms */
  duration: number
  /** Response headers from this hop */
  headers?: Record<string, string>
  /** Whether this was an opaque redirect (cross-origin) */
  opaque?: boolean
  /** Additional info about this hop (e.g., for grouped cross-origin redirects) */
  message?: string
}

// TLS/SSL information
export interface TlsInfo {
  /** TLS version (LS 1.2, TLS 1.3) */
  protocol?: string
  /** Cipher suite name */
  cipher?: string
  /** Certificate issuer */
  issuer?: string
  /** Certificate subject */
  subject?: string
  /** Certificate valid from timestamp */
  validFrom?: number
  /** Certificate valid to timestamp */
  validTo?: number
  /** Whether certificate is currently valid */
  valid?: boolean
}

// Size breakdown
export interface SizeBreakdown {
  /** Header size in bytes */
  headers: number
  /** Body size in bytes */
  body: number
  /** Total size in bytes */
  total: number
  /** Compressed size if applicable */
  compressed?: number
  /** Uncompressed size if applicable */
  uncompressed?: number
  /** Content-Encoding (gzip, br, deflate, identity) */
  encoding?: string
  /** Compression ratio (0-1, lower is better) */
  compressionRatio?: number
}

// Execution Response
export interface ExecutionResponse {
  status: number
  statusText: string
  headers: Record<string, string>
  /** Request headers that were actually sent (captured via webRequest API) */
  requestHeaders?: Record<string, string>
  body: string
  bodyParsed?: unknown
  size: number
  timing: ResponseTiming
  /** Final URL after redirects */
  url?: string
  /** Whether request was redirected */
  redirected?: boolean
  /** Chain of redirects if any */
  redirectChain?: RedirectHop[]
  /** TLS/SSL information (HTTPS only) */
  tls?: TlsInfo
  /** Detailed size breakdown */
  sizeBreakdown?: SizeBreakdown
  /** Server IP address */
  serverIP?: string
  /** HTTP protocol version (HTTP/1.1, HTTP/2) */
  protocol?: string
  /** Whether response was served from cache */
  fromCache?: boolean
  /** Resource type (xmlhttprequest, fetch, etc.) */
  resourceType?: string
  /** Size of request body in bytes */
  requestBodySize?: number
  /** Connection type (keep-alive, close) */
  connection?: string
  /** Server software from headers */
  serverSoftware?: string
}

// Execution Error
export interface ExecutionError {
  message: string
  code?: string
  phase: ExecutionPhase
}

// Execution State
export interface ExecutionState {
  phase: ExecutionPhase
  funnyText: string
  startTime: number
  endTime?: number
  duration?: number
  sentRequest?: SentRequest
  response?: ExecutionResponse
  error?: ExecutionError
  // OAuth authorization state (for iframe-based auth flow)
  oauthAuthUrl?: string       // Authorization URL for iframe/popup
  oauthState?: string         // State parameter for callback matching
  oauthUsePopup?: boolean     // Whether to use popup fallback (iframe blocked)
  oauthTokenKey?: string      // Token key for storing the result
}

// Execution History Entry
export interface ExecutionHistory {
  id: string
  requestId: string
  requestName: string
  timestamp: number
  state: ExecutionState
}
