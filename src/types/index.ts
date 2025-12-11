// Request types
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS'

export interface HttpHeader {
  key: string
  value: string
  enabled: boolean
}

// Auth configuration types
export type AuthType = 
  | 'none' 
  | 'basic' 
  | 'bearer' 
  | 'api-key' 
  | 'oauth2-client-credentials'
  | 'oauth2-password'
  | 'oauth2-authorization-code'
  | 'manual-headers'

export interface BasicAuthConfig {
  username: string
  password: string
}

export interface BearerAuthConfig {
  token: string
}

export interface ApiKeyAuthConfig {
  key: string
  value: string
  in: 'header' | 'query'
}

export interface OAuth2ClientCredentialsConfig {
  tokenUrl: string
  clientId: string
  clientSecret: string
  scope?: string
  audience?: string
}

export interface OAuth2PasswordConfig {
  tokenUrl: string
  clientId: string
  clientSecret?: string
  username: string
  password: string
  scope?: string
}

export interface OAuth2AuthorizationCodeConfig {
  authorizationUrl: string
  tokenUrl: string
  clientId: string
  clientSecret?: string
  redirectUri: string
  scope?: string
  usePkce: boolean
  state?: string
}

export interface ManualHeadersConfig {
  headers: HttpHeader[]
}

export interface AuthConfig {
  type: AuthType
  basic?: BasicAuthConfig
  bearer?: BearerAuthConfig
  apiKey?: ApiKeyAuthConfig
  oauth2ClientCredentials?: OAuth2ClientCredentialsConfig
  oauth2Password?: OAuth2PasswordConfig
  oauth2AuthorizationCode?: OAuth2AuthorizationCodeConfig
  manualHeaders?: ManualHeadersConfig
}

export interface CachedToken {
  accessToken: string
  refreshToken?: string
  tokenType: string
  expiresAt?: number
  scope?: string
}

export interface AuthState {
  requestId: string
  config: AuthConfig
  cachedToken?: CachedToken
}

// Legacy HttpAuth for backward compatibility with parsed files
export interface HttpAuth {
  type: 'none' | 'basic' | 'bearer' | 'api-key' | 'oauth2'
  basic?: {
    username: string
    password: string
  }
  bearer?: {
    token: string
  }
  apiKey?: {
    key: string
    value: string
    in: 'header' | 'query'
  }
  oauth2?: {
    grantType: string
    accessTokenUrl: string
    clientId: string
    clientSecret: string
    scope?: string
  }
}

export interface ParsedRequest {
  id: string
  name: string
  method: HttpMethod
  url: string
  headers: HttpHeader[]
  body?: string
  bodyType?: 'json' | 'text' | 'form' | 'multipart' | 'graphql'
  auth?: HttpAuth
  variables?: Record<string, string>
  source: 'http' | 'bruno' | 'manual'
  raw: string
}

// Collection types for request builder
export interface CollectionRequest {
  id: string
  name: string
  method: HttpMethod
  url: string
  headers: HttpHeader[]
  body?: string
  bodyType?: 'json' | 'text' | 'form' | 'multipart' | 'graphql'
  auth?: HttpAuth
  variables?: Record<string, string>
  folderId?: string // If in a folder, reference the folder ID
  createdAt: number
  updatedAt: number
}

export interface CollectionFolder {
  id: string
  name: string
  collapsed: boolean
  auth?: HttpAuth
  createdAt: number
  updatedAt: number
}

export interface Collection {
  id: string
  name: string
  description?: string
  folders: CollectionFolder[]
  requests: CollectionRequest[]
  variables: Record<string, string>
  collapsed: boolean
  createdAt: number
  updatedAt: number
}

export interface CollectionExport {
  version: string
  exportedAt: string
  collections: Collection[]
}

export interface ParsedFile {
  id: string
  name: string
  path: string
  type: 'http' | 'bruno'
  requests: ParsedRequest[]
  variables: Record<string, string>
  environments?: Record<string, Record<string, string>>
}

// Execution types
export type ExecutionPhase = 'idle' | 'authenticating' | 'fetching' | 'success' | 'error'

export interface SentRequest {
  method: string
  url: string
  headers: Record<string, string>
  body?: string
  viaExtension: boolean
}

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

export interface ExecutionError {
  message: string
  code?: string
  phase: ExecutionPhase
}

export interface ExecutionHistory {
  id: string
  requestId: string
  requestName: string
  timestamp: number
  state: ExecutionState
}

// Theme types
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
  files: ParsedFile[]
  history: ExecutionHistory[]
  theme: string
  variables: Record<string, string>
  environments?: Environment[]
  activeEnvironmentId?: string | null
  fileOverrides?: Record<string, Record<string, string>>
}

// Presentation Mode types
export type PresentationMode = 'dialog' | 'terminal'
export type PresentationPhase = 'idle' | 'intro' | 'auth' | 'sending' | 'receiving' | 'success' | 'error' | 'json-reveal'

export interface PresentationSettings {
  typingSpeed: number        // Characters per second for terminal mode
  autoAdvance: boolean       // Auto-advance through phases
  autoAdvanceDelay: number   // Delay between phases in ms
  dramaticPauses: boolean    // Add dramatic pauses in story/space modes
  showJsonReveal: boolean    // Animate JSON response reveal
  soundEnabled: boolean      // Sound effects (optional)
}

export interface PresentationState {
  mode: PresentationMode
  phase: PresentationPhase
  isPlaying: boolean
  isPaused: boolean
  currentText: string        // Text being typed/displayed
  targetText: string         // Full text to display
  typingProgress: number     // 0-1 for typing animation
  phaseProgress: number      // 0-1 for phase animations
  settings: PresentationSettings
}

export interface TerminalLine {
  text: string
  type: 'command' | 'output' | 'success' | 'error' | 'info'
  isTyping?: boolean
  timestamp?: number
}

