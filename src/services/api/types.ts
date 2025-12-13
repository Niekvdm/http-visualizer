/**
 * API Types
 *
 * Shared types for HTTP proxy requests and responses
 * Used by both browser fetch and Tauri IPC implementations
 */

export interface ProxyRequest {
  method: string
  url: string
  headers?: Record<string, string>
  body?: string
  timeout?: number
}

export interface TimingInfo {
  total: number
  dns?: number
  tcp?: number
  tls?: number
  ttfb?: number
  download?: number
  blocked?: number
}

export interface RedirectHop {
  url: string
  status: number
  duration: number
  headers?: Record<string, string>
  opaque?: boolean
  message?: string
}

export interface TlsInfo {
  protocol?: string
  cipher?: string
  issuer?: string
  subject?: string
  validFrom?: number
  validTo?: number
  valid?: boolean
}

export interface SizeBreakdown {
  headers: number
  body: number
  total: number
  compressed?: number
  uncompressed?: number
  encoding?: string
  compressionRatio?: number
}

export interface ResponseData {
  status: number
  statusText: string
  headers: Record<string, string>
  requestHeaders?: Record<string, string>
  body: string
  bodyBase64?: string | null
  isBinary: boolean
  size: number
  timing: TimingInfo
  url: string
  redirected: boolean
  redirectChain?: RedirectHop[]
  tls?: TlsInfo
  sizeBreakdown?: SizeBreakdown
  serverIP?: string
  protocol?: string
  fromCache?: boolean
  resourceType?: string
  requestBodySize?: number
  connection?: string
  serverSoftware?: string
}

export interface ErrorData {
  message: string
  code: string
  name?: string
}

export interface ProxyResponse {
  success: boolean
  data?: ResponseData
  error?: ErrorData
}
