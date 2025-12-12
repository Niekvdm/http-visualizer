/**
 * Type Definitions Index
 * 
 * Re-exports all types from focused type modules.
 * This maintains backward compatibility while organizing types by domain.
 * 
 * Focused type modules:
 * - auth.ts - Authentication types
 * - request.ts - HTTP request types
 * - collection.ts - Collection types
 * - execution.ts - Execution/response types
 */

// Re-export from focused modules
export * from './auth'
export * from './request'
export * from './collection'
export * from './execution'

// Theme types (kept here as they don't warrant their own file)
export interface ThemeColors {
  bg: string
  bgSecondary: string
  bgTertiary: string
  primary: string
  primaryDim: string
  secondary: string
  error: string
  warning: string
  text: string
  textDim: string
  border: string
  glow: string
}

export interface Theme {
  id: string
  name: string
  colors: ThemeColors
}

// Canvas types
export interface CanvasNode {
  id: string
  type: 'auth' | 'request' | 'response' | 'status'
  x: number
  y: number
  width: number
  height: number
  label: string
  status: 'idle' | 'active' | 'success' | 'error'
  data?: Record<string, unknown>
}

export interface CanvasConnection {
  id: string
  from: string
  to: string
  animated: boolean
  progress: number
  status: 'idle' | 'active' | 'complete' | 'error'
}

// Environment types
export interface Environment {
  id: string
  name: string
  variables: Record<string, string>
  isDefault?: boolean
}

export interface EnvironmentVariable {
  key: string
  value: string
  source: 'environment' | 'file' | 'override'
  environmentName?: string
}

// Export/Import types
export interface ExportedSession {
  version: string
  exportedAt: string
  files: import('./request').ParsedFile[]
  history: import('./execution').ExecutionHistory[]
  theme: string
  variables: Record<string, string>
  environments?: Environment[]
  activeEnvironmentId?: string | null
  fileOverrides?: Record<string, Record<string, string>>
}

// Presentation Mode types
export type PresentationMode = 'dialog' | 'terminal' | 'sequence' | 'network' | 'waterfall' | 'packet' | 'curl' | 'har' | 'matrix' | 'blueprint'
export type PresentationPhase = 'idle' | 'intro' | 'auth' | 'sending' | 'receiving' | 'success' | 'error' | 'json-reveal'

export interface PresentationSettings {
  typingSpeed: number
  autoAdvance: boolean
  autoAdvanceDelay: number
  dramaticPauses: boolean
  showJsonReveal: boolean
  soundEnabled: boolean
}

export interface PresentationState {
  mode: PresentationMode
  phase: PresentationPhase
  isPlaying: boolean
  isPaused: boolean
  currentText: string
  targetText: string
  typingProgress: number
  phaseProgress: number
  settings: PresentationSettings
}

export interface TerminalLine {
  text: string
  type: 'command' | 'output' | 'success' | 'error' | 'info'
  isTyping?: boolean
  timestamp?: number
}

// Environment Export Format (standalone environment export)
export interface EnvironmentExport {
  version: string
  exportedAt: string
  environments: Environment[]
  activeEnvironmentId?: string | null
}

// Secret Detection Types
export type SecretFieldType = 
  | 'basic-password'
  | 'bearer-token'
  | 'api-key-value'
  | 'oauth2-client-secret'
  | 'oauth2-password'

export interface SecretFinding {
  /** Path to the secret, e.g., "My API > Auth Folder > Login Request" */
  location: string
  /** Human-readable field name, e.g., "Basic Auth Password" */
  fieldName: string
  /** Type of secret field */
  fieldType: SecretFieldType
  /** Whether the value uses {{variable}} syntax */
  isVariable: boolean
  /** Preview of value (first few chars) for user verification - only for hardcoded */
  valuePreview?: string
}

export interface SecretScanResult {
  /** Whether any hardcoded (non-variable) secrets were found */
  hasHardcodedSecrets: boolean
  /** Total count of secret fields scanned */
  totalScanned: number
  /** Count using variable references (safe) */
  variableRefCount: number
  /** Count with hardcoded values (risky) */
  hardcodedCount: number
  /** Detailed findings */
  findings: SecretFinding[]
}

// Collection Export Options
export interface CollectionExportOptions {
  /** Include environment definitions in export */
  includeEnvironments?: boolean
  /** Replace hardcoded secrets with placeholder text */
  redactSecrets?: boolean
}

// Export Preview (for modal display)
export interface ExportPreview {
  collections: import('./collection').Collection[]
  secretScan: SecretScanResult
  environments: Environment[]
  activeEnvironmentId: string | null
}