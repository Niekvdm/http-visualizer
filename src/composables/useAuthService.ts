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
import { authLogger, tokenLogger } from '@/utils/authLogger'
import { executeRequestViaExtension, isExtensionInstalled } from './useExtensionBridge'

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

/**
 * Fetch a token from the token endpoint, using extension for CORS bypass when available
 */
async function fetchToken(
  url: string, 
  body: URLSearchParams
): Promise<{ ok: boolean; status: number; statusText: string; data?: Record<string, unknown>; error?: string }> {
  const headers = { 'Content-Type': 'application/x-www-form-urlencoded' }
  const bodyString = body.toString()
  
  // Try extension first for CORS bypass
  if (isExtensionInstalled()) {
    tokenLogger.debug('Using extension for token request (CORS bypass)')
    try {
      const response = await executeRequestViaExtension({
        method: 'POST',
        url,
        headers,
        body: bodyString,
        timeout: 30000,
      })
      
      // Extension response wraps data in .data property
      const respData = response.data
      if (!respData) {
        return { ok: false, status: 0, statusText: 'No response data', error: 'Extension returned no data' }
      }
      
      if (respData.status >= 200 && respData.status < 300) {
        try {
          const data = JSON.parse(respData.body || '{}') as Record<string, unknown>
          return { ok: true, status: respData.status, statusText: respData.statusText || 'OK', data }
        } catch {
          return { ok: false, status: respData.status, statusText: 'Invalid JSON response', error: respData.body }
        }
      } else {
        return { ok: false, status: respData.status, statusText: respData.statusText || 'Error', error: respData.body }
      }
    } catch (err) {
      tokenLogger.warn('Extension request failed, falling back to direct fetch', err)
      // Fall through to direct fetch
    }
  }
  
  // Direct fetch (may fail due to CORS)
  tokenLogger.debug('Using direct fetch for token request')
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: bodyString,
  })
  
  if (response.ok) {
    const data = await response.json() as Record<string, unknown>
    return { ok: true, status: response.status, statusText: response.statusText, data }
  } else {
    const error = await response.text()
    return { ok: false, status: response.status, statusText: response.statusText, error }
  }
}

export function useAuthService() {
  const authStore = useAuthStore()

  // Get auth headers for a request (with file-level inheritance support)
  async function getAuthHeaders(request: ParsedRequest, fileId?: string): Promise<HttpHeader[]> {
    authLogger.group('getAuthHeaders')
    authLogger.debug('Request', { requestId: request.id, fileId })
    
    const config = authStore.getAuthConfig(request.id, fileId)
    if (!config || config.type === 'none') {
      authLogger.info('No auth config found or type is none')
      authLogger.groupEnd()
      return []
    }

    // Determine the token cache key based on where the config comes from
    const authSource = authStore.getAuthConfigSource(request.id, fileId)
    const tokenKey = authSource === 'file' && fileId ? `file:${fileId}` : request.id
    authLogger.debug('Auth config', { type: config.type, authSource, tokenKey })

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
          authLogger.info('Added Basic auth header')
        }
        break

      case 'bearer':
        if (config.bearer?.token) {
          headers.push({
            key: 'Authorization',
            value: `Bearer ${config.bearer.token}`,
            enabled: true,
          })
          authLogger.info('Added Bearer token header')
        }
        break

      case 'api-key':
        if (config.apiKey && config.apiKey.in === 'header') {
          headers.push({
            key: config.apiKey.key,
            value: config.apiKey.value,
            enabled: true,
          })
          authLogger.info('Added API key header', { key: config.apiKey.key })
        }
        break

      case 'oauth2-client-credentials':
      case 'oauth2-password':
      case 'oauth2-authorization-code':
      case 'oauth2-implicit':
        authLogger.info('Fetching OAuth2 token', { grantType: config.type })
        const token = await getOrRefreshToken(tokenKey, config)
        if (token) {
          headers.push({
            key: 'Authorization',
            value: `${token.tokenType} ${token.accessToken}`,
            enabled: true,
          })
          authLogger.info('Added OAuth2 token header', { 
            tokenType: token.tokenType, 
            hasRefreshToken: !!token.refreshToken,
            expiresAt: token.expiresAt ? new Date(token.expiresAt).toISOString() : 'never'
          })
        } else {
          authLogger.warn('No OAuth2 token available')
        }
        break

      case 'manual-headers':
        if (config.manualHeaders?.headers) {
          headers.push(...config.manualHeaders.headers.filter(h => h.enabled))
          authLogger.info('Added manual headers', { count: headers.length })
        }
        break
    }

    authLogger.debug('Final headers count', { count: headers.length })
    authLogger.groupEnd()
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
    tokenLogger.group('getOrRefreshToken')
    tokenLogger.debug('Token key', { tokenKey, configType: config.type })
    
    // Check for cached token
    let token = authStore.cachedTokens.get(tokenKey)
    
    if (token) {
      tokenLogger.info('Found cached token', { 
        hasRefreshToken: !!token.refreshToken,
        expiresAt: token.expiresAt ? new Date(token.expiresAt).toISOString() : 'never',
        isExpired: token.expiresAt ? Date.now() >= token.expiresAt : false
      })
    } else {
      tokenLogger.info('No cached token found')
    }
    
    // Check if token is expired
    if (token && token.expiresAt && Date.now() >= token.expiresAt) {
      tokenLogger.warn('Token expired, clearing cache')
      authStore.clearCachedToken(tokenKey)
      token = undefined
    }
    
    // If token exists and doesn't need refresh, return it
    if (token && !authStore.tokenNeedsRefresh(tokenKey)) {
      tokenLogger.info('Using cached token (no refresh needed)')
      tokenLogger.groupEnd()
      return token
    }

    // If token has refresh token and needs refresh, try to refresh
    if (token?.refreshToken && authStore.tokenNeedsRefresh(tokenKey)) {
      tokenLogger.info('Token needs refresh, attempting refresh')
      try {
        token = await refreshToken(tokenKey, config, token.refreshToken)
        if (token) {
          tokenLogger.info('Token refreshed successfully')
          tokenLogger.groupEnd()
          return token
        }
      } catch (error) {
        tokenLogger.error('Token refresh failed', error)
        // Fall through to get new token
      }
    }

    // Get new token based on grant type
    tokenLogger.info('Fetching new token', { grantType: config.type })
    try {
      switch (config.type) {
        case 'oauth2-client-credentials':
          if (config.oauth2ClientCredentials) {
            tokenLogger.debug('Executing client credentials flow')
            token = await executeClientCredentialsFlow(config.oauth2ClientCredentials)
          }
          break

        case 'oauth2-password':
          if (config.oauth2Password) {
            tokenLogger.debug('Executing password flow')
            token = await executePasswordFlow(config.oauth2Password)
          }
          break

        case 'oauth2-authorization-code':
          // Auth code flow requires user interaction, return cached token or null
          // The actual flow is initiated separately via initiateAuthCodeFlow
          tokenLogger.info('Auth code flow requires user interaction, returning cached token or null')
          tokenLogger.groupEnd()
          return token || null

        case 'oauth2-implicit':
          // Implicit flow requires user interaction, return cached token or null
          // The actual flow is initiated separately via initiateImplicitFlow
          tokenLogger.info('Implicit flow requires user interaction, returning cached token or null')
          tokenLogger.groupEnd()
          return token || null
      }

      if (token) {
        tokenLogger.info('New token obtained successfully', {
          tokenType: token.tokenType,
          hasRefreshToken: !!token.refreshToken,
          expiresAt: token.expiresAt ? new Date(token.expiresAt).toISOString() : 'never'
        })
        authStore.setCachedToken(tokenKey, token)
      } else {
        tokenLogger.warn('No token obtained')
      }
      tokenLogger.groupEnd()
      return token || null
    } catch (error) {
      tokenLogger.error('Failed to get OAuth2 token', error)
      tokenLogger.groupEnd()
      throw error
    }
  }

  // Execute OAuth2 Client Credentials flow
  async function executeClientCredentialsFlow(config: OAuth2ClientCredentialsConfig): Promise<CachedToken> {
    tokenLogger.group('Client Credentials Flow')
    tokenLogger.debug('Config', { 
      tokenUrl: config.tokenUrl, 
      clientId: config.clientId,
      scope: config.scope,
      audience: config.audience
    })
    
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

    tokenLogger.info('Sending token request', { url: config.tokenUrl })
    const response = await fetchToken(config.tokenUrl, body)

    tokenLogger.debug('Response received', { status: response.status, statusText: response.statusText })

    if (!response.ok) {
      tokenLogger.error('Token request failed', { status: response.status, error: response.error })
      tokenLogger.groupEnd()
      throw new Error(`Token request failed: ${response.status} - ${response.error}`)
    }

    const token = parseTokenResponse(response.data)
    tokenLogger.info('Token obtained', { 
      tokenType: token.tokenType,
      expiresAt: token.expiresAt ? new Date(token.expiresAt).toISOString() : 'never'
    })
    tokenLogger.groupEnd()
    return token
  }

  // Execute OAuth2 Password flow
  async function executePasswordFlow(config: OAuth2PasswordConfig): Promise<CachedToken> {
    tokenLogger.group('Password Flow')
    tokenLogger.debug('Config', { 
      tokenUrl: config.tokenUrl, 
      clientId: config.clientId,
      username: config.username,
      scope: config.scope
    })
    
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

    tokenLogger.info('Sending token request', { url: config.tokenUrl })
    const response = await fetchToken(config.tokenUrl, body)

    tokenLogger.debug('Response received', { status: response.status, statusText: response.statusText })

    if (!response.ok) {
      tokenLogger.error('Token request failed', { status: response.status, error: response.error })
      tokenLogger.groupEnd()
      throw new Error(`Token request failed: ${response.status} - ${response.error}`)
    }

    const token = parseTokenResponse(response.data)
    tokenLogger.info('Token obtained', { 
      tokenType: token.tokenType,
      expiresAt: token.expiresAt ? new Date(token.expiresAt).toISOString() : 'never'
    })
    tokenLogger.groupEnd()
    return token
  }

  // Initiate OAuth2 Authorization Code flow (opens popup)
  async function initiateAuthCodeFlow(tokenKey: string, config: OAuth2AuthorizationCodeConfig): Promise<CachedToken> {
    authLogger.group('Authorization Code Flow')
    authLogger.debug('Config', { 
      authorizationUrl: config.authorizationUrl,
      tokenUrl: config.tokenUrl,
      clientId: config.clientId,
      redirectUri: config.redirectUri,
      scope: config.scope,
      usePkce: config.usePkce
    })
    
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
      authLogger.debug('PKCE enabled', { challengeMethod: 'S256' })
    }

    // Store PKCE state and config for callback handling
    pkceState.set(tokenKey, { verifier, state })
    sessionStorage.setItem(`oauth2-pending-${state}`, JSON.stringify({ tokenKey, config }))
    sessionStorage.setItem(`oauth2-pkce-${state}`, JSON.stringify({ verifier, state }))

    // Open popup for authorization
    authLogger.info('Opening authorization popup')
    const popup = openAuthPopup(authUrl)
    if (!popup) {
      authLogger.error('Failed to open popup')
      authLogger.groupEnd()
      throw new Error('Failed to open authorization popup. Please allow popups for this site.')
    }

    // Wait for callback via postMessage
    authLogger.info('Waiting for callback...')
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        window.removeEventListener('message', handleMessage)
        authLogger.error('Authorization timed out')
        authLogger.groupEnd()
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
          authLogger.info('Authorization successful, token received')
          authLogger.groupEnd()
          authStore.setCachedToken(tokenKey, data.token)
          resolve(data.token)
        } else {
          authLogger.error('Authorization failed', { error: data.error, description: data.errorDescription })
          authLogger.groupEnd()
          reject(new Error(data.errorDescription || data.error || 'Authorization failed'))
        }
      }

      window.addEventListener('message', handleMessage)
    })
  }

  // Initiate OAuth2 Implicit flow (opens popup)
  async function initiateImplicitFlow(tokenKey: string, config: OAuth2ImplicitConfig): Promise<CachedToken> {
    authLogger.group('Implicit Flow')
    authLogger.debug('Config', { 
      authorizationUrl: config.authorizationUrl,
      clientId: config.clientId,
      redirectUri: config.redirectUri,
      scope: config.scope
    })
    authLogger.warn('Implicit flow is deprecated - consider using Authorization Code flow with PKCE')
    
    const state = generateRandomString(32)
    let authUrl = `${config.authorizationUrl}?response_type=token&client_id=${encodeURIComponent(config.clientId)}&redirect_uri=${encodeURIComponent(config.redirectUri)}&state=${state}`

    if (config.scope) {
      authUrl += `&scope=${encodeURIComponent(config.scope)}`
    }

    // Store config for callback handling
    sessionStorage.setItem(`oauth2-pending-${state}`, JSON.stringify({ tokenKey, config }))

    // Open popup for authorization
    authLogger.info('Opening authorization popup')
    const popup = openAuthPopup(authUrl)
    if (!popup) {
      authLogger.error('Failed to open popup')
      authLogger.groupEnd()
      throw new Error('Failed to open authorization popup. Please allow popups for this site.')
    }

    // Wait for callback via postMessage
    authLogger.info('Waiting for callback...')
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        window.removeEventListener('message', handleMessage)
        authLogger.error('Authorization timed out')
        authLogger.groupEnd()
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
          authLogger.info('Authorization successful, token received')
          authLogger.groupEnd()
          authStore.setCachedToken(tokenKey, data.token)
          resolve(data.token)
        } else {
          authLogger.error('Authorization failed', { error: data.error, description: data.errorDescription })
          authLogger.groupEnd()
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
    tokenLogger.group('Token Refresh')
    tokenLogger.debug('Refreshing token', { tokenKey, configType: config.type })
    
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

    if (!tokenUrl) {
      tokenLogger.warn('No token URL found for refresh')
      tokenLogger.groupEnd()
      return null
    }

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

    tokenLogger.info('Sending refresh request', { url: tokenUrl })
    const response = await fetchToken(tokenUrl, body)

    tokenLogger.debug('Response received', { status: response.status, statusText: response.statusText })

    if (!response.ok) {
      tokenLogger.error('Refresh request failed', { status: response.status, error: response.error })
      tokenLogger.groupEnd()
      return null
    }

    const token = parseTokenResponse(response.data)
    tokenLogger.info('Token refreshed successfully', {
      tokenType: token.tokenType,
      expiresAt: token.expiresAt ? new Date(token.expiresAt).toISOString() : 'never'
    })
    authStore.setCachedToken(tokenKey, token)
    tokenLogger.groupEnd()
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
