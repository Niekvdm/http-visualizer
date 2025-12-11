/**
 * OAuth Callback Handler
 * 
 * Handles OAuth2 callbacks for both Authorization Code and Implicit flows.
 * This runs before the main app mounts to intercept callback URLs.
 */

import type { CachedToken } from '@/types'

export interface OAuthCallbackResult {
  type: 'authorization_code' | 'implicit' | 'error' | 'none'
  code?: string
  state?: string
  accessToken?: string
  tokenType?: string
  expiresIn?: number
  scope?: string
  error?: string
  errorDescription?: string
}

/**
 * Parse OAuth callback from URL
 * Handles both query params (auth code) and hash fragments (implicit)
 */
export function parseOAuthCallback(): OAuthCallbackResult {
  const url = new URL(window.location.href)
  const path = url.pathname
  
  // Check if this is an OAuth callback path
  if (!path.includes('/oauth/callback')) {
    return { type: 'none' }
  }

  // Check for error in query params or hash
  const queryParams = url.searchParams
  const hashParams = new URLSearchParams(url.hash.slice(1))
  
  const error = queryParams.get('error') || hashParams.get('error')
  if (error) {
    return {
      type: 'error',
      error,
      errorDescription: queryParams.get('error_description') || hashParams.get('error_description') || undefined,
      state: queryParams.get('state') || hashParams.get('state') || undefined,
    }
  }

  // Check for authorization code (query params)
  const code = queryParams.get('code')
  const state = queryParams.get('state')
  if (code && state) {
    return {
      type: 'authorization_code',
      code,
      state,
    }
  }

  // Check for implicit flow token (hash fragment)
  const accessToken = hashParams.get('access_token')
  if (accessToken) {
    return {
      type: 'implicit',
      accessToken,
      tokenType: hashParams.get('token_type') || 'Bearer',
      expiresIn: hashParams.get('expires_in') ? parseInt(hashParams.get('expires_in')!, 10) : undefined,
      scope: hashParams.get('scope') || undefined,
      state: hashParams.get('state') || undefined,
    }
  }

  return { type: 'none' }
}

/**
 * Handle authorization code callback
 * Exchanges the code for tokens and notifies the parent window
 */
export async function handleAuthCodeCallback(code: string, state: string): Promise<void> {
  const pendingData = sessionStorage.getItem(`oauth2-pending-${state}`)
  if (!pendingData) {
    throw new Error('No pending authorization found for this state')
  }

  const { tokenKey, config } = JSON.parse(pendingData) as {
    tokenKey: string
    config: {
      tokenUrl: string
      clientId: string
      clientSecret?: string
      redirectUri: string
      usePkce: boolean
    }
  }

  // Get PKCE verifier if used
  const pkceData = sessionStorage.getItem(`oauth2-pkce-${state}`)
  const pkce = pkceData ? JSON.parse(pkceData) : null

  // Build token request
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: config.clientId,
    code,
    redirect_uri: config.redirectUri,
  })

  if (config.clientSecret) {
    body.append('client_secret', config.clientSecret)
  }

  if (config.usePkce && pkce?.verifier) {
    body.append('code_verifier', pkce.verifier)
  }

  // Exchange code for token
  const response = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Token exchange failed: ${response.status} - ${errorText}`)
  }

  const data = await response.json()
  const token: CachedToken = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    tokenType: data.token_type || 'Bearer',
    expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : undefined,
    scope: data.scope,
  }

  // Notify parent window
  if (window.opener) {
    window.opener.postMessage({
      type: 'oauth2-callback',
      success: true,
      tokenKey,
      token,
      state,
    }, window.location.origin)
  }

  // Cleanup
  sessionStorage.removeItem(`oauth2-pending-${state}`)
  sessionStorage.removeItem(`oauth2-pkce-${state}`)
}

/**
 * Handle implicit flow callback
 * Extracts token from hash and notifies parent window
 */
export function handleImplicitCallback(result: OAuthCallbackResult): void {
  if (result.type !== 'implicit' || !result.accessToken || !result.state) {
    throw new Error('Invalid implicit flow callback')
  }

  const pendingData = sessionStorage.getItem(`oauth2-pending-${result.state}`)
  if (!pendingData) {
    throw new Error('No pending authorization found for this state')
  }

  const { tokenKey } = JSON.parse(pendingData) as { tokenKey: string }

  const token: CachedToken = {
    accessToken: result.accessToken,
    tokenType: result.tokenType || 'Bearer',
    expiresAt: result.expiresIn ? Date.now() + result.expiresIn * 1000 : undefined,
    scope: result.scope,
    // Implicit flow doesn't provide refresh tokens
  }

  // Notify parent window
  if (window.opener) {
    window.opener.postMessage({
      type: 'oauth2-callback',
      success: true,
      tokenKey,
      token,
      state: result.state,
    }, window.location.origin)
  }

  // Cleanup
  sessionStorage.removeItem(`oauth2-pending-${result.state}`)
}

/**
 * Handle error callback
 */
export function handleErrorCallback(result: OAuthCallbackResult): void {
  if (result.type !== 'error') return

  // Notify parent window of error
  if (window.opener) {
    window.opener.postMessage({
      type: 'oauth2-callback',
      success: false,
      error: result.error,
      errorDescription: result.errorDescription,
      state: result.state,
    }, window.location.origin)
  }

  // Cleanup if we have state
  if (result.state) {
    sessionStorage.removeItem(`oauth2-pending-${result.state}`)
    sessionStorage.removeItem(`oauth2-pkce-${result.state}`)
  }
}

/**
 * Render a simple callback page UI
 */
export function renderCallbackPage(status: 'loading' | 'success' | 'error', message?: string): void {
  const styles = `
    body {
      font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
      background: #0a0a0a;
      color: #00ff41;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      padding: 20px;
      box-sizing: border-box;
    }
    .container {
      text-align: center;
      max-width: 400px;
    }
    .status {
      font-size: 48px;
      margin-bottom: 20px;
    }
    .message {
      font-size: 14px;
      opacity: 0.8;
      line-height: 1.6;
    }
    .error {
      color: #ff0040;
    }
    .spinner {
      width: 40px;
      height: 40px;
      border: 3px solid #00ff4133;
      border-top-color: #00ff41;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 20px;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `

  const statusIcons = {
    loading: '<div class="spinner"></div>',
    success: '<div class="status">✓</div>',
    error: '<div class="status error">✗</div>',
  }

  const defaultMessages = {
    loading: 'Completing authorization...',
    success: 'Authorization successful! This window will close automatically.',
    error: 'Authorization failed. You can close this window.',
  }

  document.head.innerHTML = `<style>${styles}</style><title>OAuth Callback</title>`
  document.body.innerHTML = `
    <div class="container">
      ${statusIcons[status]}
      <div class="message ${status === 'error' ? 'error' : ''}">${message || defaultMessages[status]}</div>
    </div>
  `
}

/**
 * Main callback handler - call this before mounting the app
 */
export async function handleOAuthCallbackIfNeeded(): Promise<boolean> {
  const result = parseOAuthCallback()

  if (result.type === 'none') {
    return false
  }

  // Render loading state
  renderCallbackPage('loading')

  try {
    if (result.type === 'authorization_code') {
      await handleAuthCodeCallback(result.code!, result.state!)
      renderCallbackPage('success')
    } else if (result.type === 'implicit') {
      handleImplicitCallback(result)
      renderCallbackPage('success')
    } else if (result.type === 'error') {
      handleErrorCallback(result)
      renderCallbackPage('error', result.errorDescription || result.error)
    }

    // Close popup after a short delay
    setTimeout(() => {
      window.close()
    }, 1500)

    return true
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error occurred'
    renderCallbackPage('error', message)

    // Notify parent of error
    if (window.opener && result.state) {
      window.opener.postMessage({
        type: 'oauth2-callback',
        success: false,
        error: 'callback_error',
        errorDescription: message,
        state: result.state,
      }, window.location.origin)
    }

    setTimeout(() => {
      window.close()
    }, 3000)

    return true
  }
}

