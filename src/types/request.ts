/**
 * HTTP Request Type Definitions
 * 
 * Focused types for HTTP requests and related data.
 */

// HTTP Methods
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS'

// HTTP Header
export interface HttpHeader {
  key: string
  value: string
  enabled: boolean
}

// Body types
export type BodyType = 'json' | 'text' | 'form' | 'multipart' | 'graphql'

// Request source
export type RequestSource = 'http' | 'bruno' | 'manual'

// Import auth types
import type { HttpAuth } from './auth'

// Parsed Request (from file import or manual creation)
export interface ParsedRequest {
  id: string
  name: string
  method: HttpMethod
  url: string
  headers: HttpHeader[]
  body?: string
  bodyType?: BodyType
  auth?: HttpAuth
  variables?: Record<string, string>
  source: RequestSource
  raw: string
}

// Parsed File (collection of requests from a file)
export interface ParsedFile {
  id: string
  name: string
  path: string
  type: 'http' | 'bruno'
  requests: ParsedRequest[]
  variables: Record<string, string>
  environments?: Record<string, Record<string, string>>
}

// Sent Request (what was actually sent to the server)
export interface SentRequest {
  method: string
  url: string
  headers: Record<string, string>
  body?: string
  viaExtension: boolean
  viaProxy?: boolean
}

