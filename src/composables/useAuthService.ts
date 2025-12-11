import { useAuthStore } from '@/stores/authStore'
import type { 
  AuthConfig, 
  CachedToken, 
  HttpHeader,
  ParsedRequest,
  OAuth2ClientCredentialsConfig,
  OAuth2PasswordConfig,
  OAuth2AuthorizationCodeConfig,
  OAuth2ImplicitConfig,
} from '@/types'

// PKCE helpers
function generateRandomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'
  let result = ''
  const randomValues = new Uint8Array(length)
  crypto.getRandomValues(randomValues)
  for (let i = 0; i < length; i++) {
    result += chars[randomValues[i] % chars.length]
  }
  return result
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(verifier)
  const digest = await crypto.subtle.digest('SHA-256', data)
  const base64 = btoa(String.fromCharCode(...new Uint8Array(digest)))
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

// Store for PKCE state during auth code flow
const pkceState = new Map<string, { verifier: string; state: string }>()

export function useAuthService() {
  const authStore = useAuthStore()

  // Get auth headers for a request (with file-level inheritance support)
  async function getAuthHeaders(request: ParsedRequest, fileId?: string): Promise<HttpHeader[]> {
    const config = authStore.getAuthConfig(request.id, fileId)
    if (!config || config.type === 'none') {
      return []
    }

    // Determine the token cache key based on where the config comes from
    const authSource = authStore.getAuthConfigSource(request.id, fileId)
    const tokenKey = authSource === 'file' && fileId ? `file:${fileId}` : request.id

    const headers: HttpHeader[] = []

    switch (config.type) {
      case 'basic':
        if (config.basic) {
          const credentials = btoa(`${config.basic.username}:${config.basic.password}`)
          headers.push({
            key: 'Authorization',
            value: `Basic ${credentials}`,
            enabled: true,
          })
        }
        break

      case 'bearer':
        if (config.bearer?.token) {
          headers.push({
            key: 'Authorization',
            value: `Bearer ${config.bearer.token}`,
            enabled: true,
          })
        }
        break

      case 'api-key':
        if (config.apiKey && config.apiKey.in === 'header') {
          headers.push({
            key: config.apiKey.key,
            value: config.apiKey.value,
            enabled: true,
          })
        }
        break

      case 'oauth2-client-credentials':
      case 'oauth2-password':
      case 'oauth2-authorization-code':
      case 'oauth2-implicit':
        const token = await getOrRefreshToken(tokenKey, config)
        if (token) {
          headers.push({
            key: 'Authorization',
            value: `${token.tokenType} ${token.accessToken}`,
            enabled: true,
          })
        }
        break

      case 'manual-headers':
        if (config.manualHeaders?.headers) {
          headers.push(...config.manualHeaders.headers.filter(h => h.enabled))
        }
        break
    }

    return headers
  }

  // Get API key query params if configured (with file-level inheritance)
  function getApiKeyQueryParams(requestId: string, fileId?: string): Record<string, string> {
    const config = authStore.getAuthConfig(requestId, fileId)
    if (config?.type === 'api-key' && config.apiKey?.in === 'query') {
      return { [config.apiKey.key]: config.apiKey.value }
    }
    return {}
  }

  // Get or refresh OAuth2 token
  async function getOrRefreshToken(tokenKey: string, config: AuthConfig): Promise<CachedToken | null> {
    // Check for cached token
    let token = authStore.cachedTokens.get(tokenKey)
    
    // Check if token is expired
    if (token && token.expiresAt && Date.now() >= token.expiresAt) {
      authStore.clearCachedToken(tokenKey)
      token = undefined
    }
    
    // If token exists and doesn't need refresh, return it
    if (token && !authStore.tokenNeedsRefresh(tokenKey)) {
      return token
    }

    // If token has refresh token and needs refresh, try to refresh
    if (token?.refreshToken && authStore.tokenNeedsRefresh(tokenKey)) {
      try {
        token = await refreshToken(tokenKey, config, token.refreshToken)
        if (token) return token
      } catch (error) {
        console.error('Token refresh failed:', error)
        // Fall through to get new token
      }
    }

    // Get new token based on grant type
    try {
      switch (config.type) {
        case 'oauth2-client-credentials':
          if (config.oauth2ClientCredentials) {
            token = await executeClientCredentialsFlow(config.oauth2ClientCredentials)
          }
          break

        case 'oauth2-password':
          if (config.oauth2Password) {
            token = await executePasswordFlow(config.oauth2Password)
          }
          break

        case 'oauth2-authorization-code':
          // Auth code flow requires user interaction, return cached token or null
          // The actual flow is initiated separately via initiateAuthCodeFlow
          return token || null

        case 'oauth2-implicit':
          // Implicit flow requires user interaction, return cached token or null
          // The actual flow is initiated separately via initiateImplicitFlow
          return token || null
      }

      if (token) {
        authStore.setCachedToken(tokenKey, token)
      }
      return token || null
    } catch (error) {
      console.error('Failed to get OAuth2 token:', error)
      throw error
    }
  }

  // Execute OAuth2 Client Credentials flow
  async function executeClientCredentialsFlow(config: OAuth2ClientCredentialsConfig): Promise<CachedToken> {
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: config.clientId,
      client_secret: config.clientSecret,
    })

    if (config.scope) {
      body.append('scope', config.scope)
    }
    if (config.audience) {
      body.append('audience', config.audience)
    }

    const response = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Token request failed: ${response.status} - ${error}`)
    }

    const data = await response.json()
    return parseTokenResponse(data)
  }

  // Execute OAuth2 Password flow
  async function executePasswordFlow(config: OAuth2PasswordConfig): Promise<CachedToken> {
    const body = new URLSearchParams({
      grant_type: 'password',
      client_id: config.clientId,
      username: config.username,
      password: config.password,
    })

    if (config.clientSecret) {
      body.append('client_secret', config.clientSecret)
    }
    if (config.scope) {
      body.append('scope', config.scope)
    }

    const response = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Token request failed: ${response.status} - ${error}`)
    }

    const data = await response.json()
    return parseTokenResponse(data)
  }

  // Initiate OAuth2 Authorization Code flow (opens popup)
  async function initiateAuthCodeFlow(tokenKey: string, config: OAuth2AuthorizationCodeConfig): Promise<CachedToken> {
    const state = generateRandomString(32)
    let authUrl = `${config.authorizationUrl}?response_type=code&client_id=${encodeURIComponent(config.clientId)}&redirect_uri=${encodeURIComponent(config.redirectUri)}&state=${state}`

    if (config.scope) {
      authUrl += `&scope=${encodeURIComponent(config.scope)}`
    }

    let verifier = ''
    if (config.usePkce) {
      verifier = generateRandomString(64)
      const challenge = await generateCodeChallenge(verifier)
      authUrl += `&code_challenge=${challenge}&code_challenge_method=S256`
    }

    // Store PKCE state and config for callback handling
    pkceState.set(tokenKey, { verifier, state })
    sessionStorage.setItem(`oauth2-pending-${state}`, JSON.stringify({ tokenKey, config }))
    sessionStorage.setItem(`oauth2-pkce-${state}`, JSON.stringify({ verifier, state }))

    // Open popup for authorization
    const popup = openAuthPopup(authUrl)
    if (!popup) {
      throw new Error('Failed to open authorization popup. Please allow popups for this site.')
    }

    // Wait for callback via postMessage
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        window.removeEventListener('message', handleMessage)
        reject(new Error('Authorization timed out. Please try again.'))
      }, 5 * 60 * 1000) // 5 minute timeout

      function handleMessage(event: MessageEvent) {
        // Verify origin
        if (event.origin !== window.location.origin) return
        
        const data = event.data
        if (data?.type !== 'oauth2-callback' || data?.state !== state) return

        // Clean up
        clearTimeout(timeout)
        window.removeEventListener('message', handleMessage)
        pkceState.delete(tokenKey)

        if (data.success && data.token) {
          authStore.setCachedToken(tokenKey, data.token)
          resolve(data.token)
        } else {
          reject(new Error(data.errorDescription || data.error || 'Authorization failed'))
        }
      }

      window.addEventListener('message', handleMessage)
    })
  }

  // Initiate OAuth2 Implicit flow (opens popup)
  async function initiateImplicitFlow(tokenKey: string, config: OAuth2ImplicitConfig): Promise<CachedToken> {
    const state = generateRandomString(32)
    let authUrl = `${config.authorizationUrl}?response_type=token&client_id=${encodeURIComponent(config.clientId)}&redirect_uri=${encodeURIComponent(config.redirectUri)}&state=${state}`

    if (config.scope) {
      authUrl += `&scope=${encodeURIComponent(config.scope)}`
    }

    // Store config for callback handling
    sessionStorage.setItem(`oauth2-pending-${state}`, JSON.stringify({ tokenKey, config }))

    // Open popup for authorization
    const popup = openAuthPopup(authUrl)
    if (!popup) {
      throw new Error('Failed to open authorization popup. Please allow popups for this site.')
    }

    // Wait for callback via postMessage
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        window.removeEventListener('message', handleMessage)
        reject(new Error('Authorization timed out. Please try again.'))
      }, 5 * 60 * 1000) // 5 minute timeout

      function handleMessage(event: MessageEvent) {
        // Verify origin
        if (event.origin !== window.location.origin) return
        
        const data = event.data
        if (data?.type !== 'oauth2-callback' || data?.state !== state) return

        // Clean up
        clearTimeout(timeout)
        window.removeEventListener('message', handleMessage)

        if (data.success && data.token) {
          authStore.setCachedToken(tokenKey, data.token)
          resolve(data.token)
        } else {
          reject(new Error(data.errorDescription || data.error || 'Authorization failed'))
        }
      }

      window.addEventListener('message', handleMessage)
    })
  }

  // Helper to open auth popup
  function openAuthPopup(url: string): Window | null {
    const width = 600
    const height = 700
    const left = window.screenX + (window.outerWidth - width) / 2
    const top = window.screenY + (window.outerHeight - height) / 2

    return window.open(
      url,
      'oauth2-auth',
      `width=${width},height=${height},left=${left},top=${top},scrollbars=yes`
    )
  }


  // Refresh an OAuth2 token
  async function refreshToken(tokenKey: string, config: AuthConfig, refreshTokenValue: string): Promise<CachedToken | null> {
    let tokenUrl: string | undefined

    switch (config.type) {
      case 'oauth2-client-credentials':
        tokenUrl = config.oauth2ClientCredentials?.tokenUrl
        break
      case 'oauth2-password':
        tokenUrl = config.oauth2Password?.tokenUrl
        break
      case 'oauth2-authorization-code':
        tokenUrl = config.oauth2AuthorizationCode?.tokenUrl
        break
    }

    if (!tokenUrl) return null

    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshTokenValue,
    })

    // Add client credentials if available
    if (config.type === 'oauth2-client-credentials' && config.oauth2ClientCredentials) {
      body.append('client_id', config.oauth2ClientCredentials.clientId)
      body.append('client_secret', config.oauth2ClientCredentials.clientSecret)
    } else if (config.type === 'oauth2-password' && config.oauth2Password) {
      body.append('client_id', config.oauth2Password.clientId)
      if (config.oauth2Password.clientSecret) {
        body.append('client_secret', config.oauth2Password.clientSecret)
      }
    } else if (config.type === 'oauth2-authorization-code' && config.oauth2AuthorizationCode) {
      body.append('client_id', config.oauth2AuthorizationCode.clientId)
      if (config.oauth2AuthorizationCode.clientSecret) {
        body.append('client_secret', config.oauth2AuthorizationCode.clientSecret)
      }
    }

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    })

    if (!response.ok) {
      return null
    }

    const data = await response.json()
    const token = parseTokenResponse(data)
    authStore.setCachedToken(tokenKey, token)
    return token
  }

  // Parse OAuth2 token response
  function parseTokenResponse(data: Record<string, unknown>): CachedToken {
    const expiresIn = data.expires_in as number | undefined
    
    return {
      accessToken: data.access_token as string,
      refreshToken: data.refresh_token as string | undefined,
      tokenType: (data.token_type as string) || 'Bearer',
      expiresAt: expiresIn ? Date.now() + expiresIn * 1000 : undefined,
      scope: data.scope as string | undefined,
    }
  }

  // Test auth configuration
  async function testAuthConfig(tokenKey: string, config: AuthConfig): Promise<{ success: boolean; message: string }> {
    try {
      switch (config.type) {
        case 'none':
          return { success: true, message: 'No authentication configured' }

        case 'basic':
          if (!config.basic?.username) {
            return { success: false, message: 'Username is required' }
          }
          return { success: true, message: 'Basic auth configured' }

        case 'bearer':
          if (!config.bearer?.token) {
            return { success: false, message: 'Token is required' }
          }
          return { success: true, message: 'Bearer token configured' }

        case 'api-key':
          if (!config.apiKey?.key || !config.apiKey?.value) {
            return { success: false, message: 'API key and value are required' }
          }
          return { success: true, message: 'API key configured' }

        case 'oauth2-client-credentials':
          if (!config.oauth2ClientCredentials?.tokenUrl || 
              !config.oauth2ClientCredentials?.clientId ||
              !config.oauth2ClientCredentials?.clientSecret) {
            return { success: false, message: 'Token URL, Client ID, and Client Secret are required' }
          }
          // Try to get a token
          const ccToken = await executeClientCredentialsFlow(config.oauth2ClientCredentials)
          authStore.setCachedToken(tokenKey, ccToken)
          return { success: true, message: `Token obtained successfully (expires in ${Math.round((ccToken.expiresAt! - Date.now()) / 1000)}s)` }

        case 'oauth2-password':
          if (!config.oauth2Password?.tokenUrl ||
              !config.oauth2Password?.clientId ||
              !config.oauth2Password?.username ||
              !config.oauth2Password?.password) {
            return { success: false, message: 'Token URL, Client ID, Username, and Password are required' }
          }
          const pwToken = await executePasswordFlow(config.oauth2Password)
          authStore.setCachedToken(tokenKey, pwToken)
          return { success: true, message: `Token obtained successfully` }

        case 'oauth2-authorization-code':
          if (!config.oauth2AuthorizationCode?.authorizationUrl ||
              !config.oauth2AuthorizationCode?.tokenUrl ||
              !config.oauth2AuthorizationCode?.clientId ||
              !config.oauth2AuthorizationCode?.redirectUri) {
            return { success: false, message: 'Authorization URL, Token URL, Client ID, and Redirect URI are required' }
          }
          return { success: true, message: 'Configuration valid. Click "Authorize" to get token.' }

        case 'oauth2-implicit':
          if (!config.oauth2Implicit?.authorizationUrl ||
              !config.oauth2Implicit?.clientId ||
              !config.oauth2Implicit?.redirectUri) {
            return { success: false, message: 'Authorization URL, Client ID, and Redirect URI are required' }
          }
          return { success: true, message: 'Configuration valid. Click "Authorize" to get token. Note: Implicit flow is deprecated.' }

        case 'manual-headers':
          return { success: true, message: `${config.manualHeaders?.headers.length || 0} header(s) configured` }

        default:
          return { success: false, message: 'Unknown auth type' }
      }
    } catch (error) {
      return { 
        success: false, 
        message: error instanceof Error ? error.message : 'Authentication test failed' 
      }
    }
  }

  // Clear tokens for a key
  function clearTokens(tokenKey: string) {
    authStore.clearCachedToken(tokenKey)
  }

  // Clear all tokens
  function clearAllTokens() {
    authStore.clearAllTokens()
  }

  return {
    getAuthHeaders,
    getApiKeyQueryParams,
    getOrRefreshToken,
    initiateAuthCodeFlow,
    initiateImplicitFlow,
    testAuthConfig,
    clearTokens,
    clearAllTokens,
  }
}
