/**
 * Authentication Type Definitions
 * 
 * Focused types for authentication configuration and tokens.
 * Follows Interface Segregation Principle by splitting auth types
 * into specific, focused interfaces.
 */

// Base auth types
export type AuthType = 
  | 'none' 
  | 'basic' 
  | 'bearer' 
  | 'api-key' 
  | 'oauth2-client-credentials'
  | 'oauth2-password'
  | 'oauth2-authorization-code'
  | 'oauth2-implicit'
  | 'manual-headers'

// Basic Authentication
export interface BasicAuthConfig {
  username: string
  password: string
}

// Bearer Token Authentication
export interface BearerAuthConfig {
  token: string
}

// API Key Authentication
export interface ApiKeyAuthConfig {
  key: string
  value: string
  in: 'header' | 'query'
}

// OAuth2 Client Credentials Grant
export interface OAuth2ClientCredentialsConfig {
  tokenUrl: string
  clientId: string
  clientSecret: string
  scope?: string
  audience?: string
}

// OAuth2 Password Grant
export interface OAuth2PasswordConfig {
  tokenUrl: string
  clientId: string
  clientSecret?: string
  username: string
  password: string
  scope?: string
}

// OAuth2 Authorization Code Grant
export interface OAuth2AuthorizationCodeConfig {
  authorizationUrl: string
  tokenUrl: string
  clientId: string
  clientSecret?: string
  redirectUri: string
  scope?: string
  audience?: string  // Resource/audience for the token (required by some providers like Logto)
  usePkce: boolean
  state?: string
}

// OAuth2 Implicit Grant (Legacy - for SPAs without backend)
// Note: This flow is deprecated in OAuth 2.1 but still widely used
export interface OAuth2ImplicitConfig {
  authorizationUrl: string
  clientId: string
  redirectUri: string
  scope?: string
  state?: string
}

// Manual Headers
export interface ManualHeadersConfig {
  headers: HttpHeader[]
}

// Import HttpHeader from request types
import type { HttpHeader } from './request'

// Full Auth Configuration
export interface AuthConfig {
  type: AuthType
  basic?: BasicAuthConfig
  bearer?: BearerAuthConfig
  apiKey?: ApiKeyAuthConfig
  oauth2ClientCredentials?: OAuth2ClientCredentialsConfig
  oauth2Password?: OAuth2PasswordConfig
  oauth2AuthorizationCode?: OAuth2AuthorizationCodeConfig
  oauth2Implicit?: OAuth2ImplicitConfig
  manualHeaders?: ManualHeadersConfig
}

// Cached OAuth2 Token
export interface CachedToken {
  accessToken: string
  refreshToken?: string
  tokenType: string
  expiresAt?: number
  scope?: string
}

// Auth State for a specific request
export interface AuthState {
  requestId: string
  config: AuthConfig
  cachedToken?: CachedToken
}

// Legacy HttpAuth (for backward compatibility with parsed files)
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
    grantType: 'client_credentials' | 'password' | 'authorization_code' | 'implicit'
    accessTokenUrl: string           // Token URL (not needed for implicit)
    authorizationUrl?: string        // Auth URL (auth code + implicit only)
    clientId: string
    clientSecret?: string            // Optional for auth code, not used for implicit
    redirectUri?: string             // Auth code + implicit only
    scope?: string
    audience?: string                // Resource/audience for the token (required by some providers like Logto)
    usePkce?: boolean                // Auth code only
    // Password grant fields
    username?: string
    password?: string
  }
}

// Auth type labels for display
export const AUTH_TYPE_LABELS: Record<AuthType, string> = {
  'none': 'No Auth',
  'basic': 'Basic Auth',
  'bearer': 'Bearer Token',
  'api-key': 'API Key',
  'oauth2-client-credentials': 'OAuth2 (Client Credentials)',
  'oauth2-password': 'OAuth2 (Password)',
  'oauth2-authorization-code': 'OAuth2 (Authorization Code)',
  'oauth2-implicit': 'OAuth2 (Implicit - Legacy)',
  'manual-headers': 'Manual Headers',
}

