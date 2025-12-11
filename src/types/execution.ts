/**
 * Execution Type Definitions
 * 
 * Focused types for request execution and response handling.
 */

import type { SentRequest } from './request'

// Execution phases
export type ExecutionPhase = 'idle' | 'authenticating' | 'fetching' | 'success' | 'error'

// Execution Response
export interface ExecutionResponse {
  status: number
  statusText: string
  headers: Record<string, string>
  body: string
  bodyParsed?: unknown
  size: number
  timing: {
    dns?: number
    connect?: number
    ttfb?: number
    download?: number
    total: number
  }
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
}

// Execution History Entry
export interface ExecutionHistory {
  id: string
  requestId: string
  requestName: string
  timestamp: number
  state: ExecutionState
}

