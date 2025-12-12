import { ref } from 'vue'
import { useRequestStore } from '@/stores/requestStore'
import { useAuthStore } from '@/stores/authStore'
import { useEnvironmentStore } from '@/stores/environmentStore'
import { useCollectionStore } from '@/stores/collectionStore'
import { useAuthService } from '@/composables/useAuthService'
import { useExtensionBridge, type ExtensionResponse, isAnyBridgeAvailable, getCurrentBridgeType } from '@/composables/useExtensionBridge'
import { resolveVariables, mergeVariables } from '@/utils/variableResolver'
import { requestLogger } from '@/utils/authLogger'
import type { ParsedRequest, ExecutionResponse, ExecutionError, HttpAuth, HttpHeader, SentRequest } from '@/types'

export function useRequestExecutor() {
  const requestStore = useRequestStore()
  const authStore = useAuthStore()
  const envStore = useEnvironmentStore()
  const collectionStore = useCollectionStore()
  const authService = useAuthService()
  const { isExtensionAvailable, isProxyBackendAvailable, executeViaExtension, executeViaProxy } = useExtensionBridge()
  const isExecuting = ref(false)
  const funnyTextInterval = ref<ReturnType<typeof setInterval> | null>(null)

  async function executeRequest(request: ParsedRequest, fileId?: string, isRetry = false): Promise<void> {
    if (isExecuting.value) return

    isExecuting.value = true
    requestLogger.group(isRetry ? 'Execute Request (Retry after reauth)' : 'Execute Request')
    requestLogger.info('Starting request execution', { 
      requestId: request.id, 
      method: request.method, 
      url: request.url,
      fileId,
      isRetry
    })
    
    // Get resolved variables for this request
    // Priority: file overrides > active environment > collection/file variables > request variables
    const variables = getResolvedVariables(request, fileId)
    // Check if auth is configured (from auth store - request or file level, or from file)
    const hasConfiguredAuth = authStore.hasAuthConfig(request.id, fileId)
    const hasFileAuth = request.auth?.type !== 'none' && request.auth?.type !== undefined
    const hasAuth = hasConfiguredAuth || hasFileAuth
    requestLogger.debug('Auth check', { hasConfiguredAuth, hasFileAuth, hasAuth })

    try {
      // Start funny text rotation
      startFunnyTextRotation()

      // Phase 1: Authentication (if needed)
      if (hasAuth) {
        requestLogger.info('Phase 1: Authentication')
        requestStore.setExecutionPhase('authenticating')
        
        // If using auth store config, try to get/refresh tokens
        if (hasConfiguredAuth) {
          const config = authStore.getAuthConfig(request.id, fileId)
          requestLogger.debug('Auth config', { type: config?.type })
          if (config && ['oauth2-client-credentials', 'oauth2-password', 'oauth2-authorization-code'].includes(config.type)) {
            try {
              // Determine the token cache key based on where the config comes from
              const authSource = authStore.getAuthConfigSource(request.id, fileId)
              const tokenKey = authSource === 'file' && fileId ? `file:${fileId}` : request.id
              requestLogger.debug('Token key', { authSource, tokenKey })
              
              await authService.getOrRefreshToken(tokenKey, config)
              requestLogger.info('Token obtained/refreshed successfully')
            } catch (error) {
              // Token fetch failed, but we'll continue and let the request fail
              requestLogger.error('Auth token fetch failed', error)
            }
          }
        } else {
          requestLogger.debug('Using file-baselegacy)')
        }
        
        // Small delay for visual effect
        await simulateDelay(500 + Math.random() * 300)
      } else {
        requestLogger.debug('No authentication required')
      }

      // Phase 2: Fetching
      requestLogger.info('Phase 2: Fetching')
      requestStore.setExecutionPhase('fetching')
      
      const startTime = performance.now()

      // Build fetch options with auth and resolved variables
      const fetchOptions = await buildFetchOptions(request, fileId, variables)

      // Resolve URL with variables
      let url = resolveVariables(request.url, variables)
      
      // Add API key query params if configured
      if (hasConfiguredAuth) {
        const queryParams = authService.getApiKeyQueryParams(request.id, fileId)
        if (Object.keys(queryParams).length > 0) {
          const urlObj = new URL(url)
          for (const [key, value] of Object.entries(queryParams)) {
            urlObj.searchParams.set(key, value)
          }
          url = urlObj.toString()
          requestLogger.debug('Added API key query params')
        }
      }

      let executionResponse: ExecutionResponse

      // Convert headers to object for storage and extension
      const headersObj = headersToObject(fetchOptions.headers as Headers)
      requestLogger.debug('Request headers', { headers: Object.keys(headersObj) })
      
      // Determine which bridge to use
      const bridgeType = getCurrentBridgeType()

      // Store the sent request details for visualization
      const sentRequest: SentRequest = {
        method: request.method,
        url,
        headers: headersObj,
        body: fetchOptions.body as string | undefined,
        viaExtension: bridgeType === 'extension',
        viaProxy: bridgeType === 'proxy',
      }
      requestStore.executionState.sentRequest = sentRequest

      // Try to use extension or proxy for CORS bypass, fall back to direct fetch
      if (bridgeType === 'extension' || bridgeType === 'proxy') {
        const isUsingExtension = bridgeType === 'extension'
        requestLogger.info(`Executing via ${bridgeType} (CORS bypass)`)

        // Execute via extension or proxy (both bypass CORS)
        const bridgeResponse = isUsingExtension
          ? await executeViaExtension({
              method: request.method,
              url,
              headers: headersObj,
              body: fetchOptions.body as string | undefined,
            })
          : await executeViaProxy({
              method: request.method,
              url,
              headers: headersObj,
              body: fetchOptions.body as string | undefined,
            })

        const endTime = performance.now()
        const duration = endTime - startTime

        if (!bridgeResponse.success || !bridgeResponse.data) {
          requestLogger.error(`${bridgeType} request failed`, bridgeResponse.error)
          throw new Error(bridgeResponse.error?.message || `${bridgeType} request failed`)
        }

        const { data } = bridgeResponse
        let bodyParsed: unknown = null

        try {
          bodyParsed = JSON.parse(data.body)
        } catch {
          // Not JSON, that's fine
        }

        executionResponse = {
          status: data.status,
          statusText: data.statusText,
          headers: data.headers,
          requestHeaders: data.requestHeaders,
          body: data.body,
          bodyParsed,
          size: data.size,
          // Use bridge's detailed timing if available, fallback to measured duration
          timing: {
            total: data.timing?.total ?? duration,
            dns: data.timing?.dns,
            tcp: data.timing?.tcp,
            tls: data.timing?.tls,
            ttfb: data.timing?.ttfb,
            download: data.timing?.download,
            blocked: data.timing?.blocked,
          },
          // Additional bridge data
          url: data.url,
          redirected: data.redirected,
          redirectChain: data.redirectChain,
          tls: data.tls,
          sizeBreakdown: data.sizeBreakdown,
          // Network/server info
          serverIP: data.serverIP,
          protocol: data.protocol,
          fromCache: data.fromCache,
          resourceType: data.resourceType,
          requestBodySize: data.requestBodySize,
          connection: data.connection,
          serverSoftware: data.serverSoftware,
        }
      } else {
        // Direct fetch (may hit CORS)
        requestLogger.info('Executing via direct fetch')
        const response = await fetch(url, fetchOptions)

        const endTime = performance.now()
        const duration = endTime - startTime

        // Read response body
        const bodyText = await response.text()
        let bodyParsed: unknown = null

        try {
          bodyParsed = JSON.parse(bodyText)
        } catch {
          // Not JSON, that's fine
        }

        executionResponse = {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          body: bodyText,
          bodyParsed,
          size: new Blob([bodyText]).size,
          timing: {
            total: duration,
          },
        }
      }

      // Update store with response
      requestStore.executionState.response = executionResponse
      requestLogger.info('Response received', { 
        status: executionResponse.status, 
        statusText: executionResponse.statusText,
        size: executionResponse.size,
        duration: executionResponse.timing?.total
      })

      // Phase 3: Success or Error based on status
      if (executionResponse.status >= 200 && executionResponse.status < 300) {
        requestLogger.info('Phase 3: Success')
        requestStore.setExecutionPhase('success')
        requestLogger.groupEnd()
        // Add to history
        requestStore.addToHistory(request.id, request.name, { ...requestStore.executionState })
      } else if (executionResponse.status === 401 && !isRetry) {
        // Check if we can auto-reauth with authorization code flow
        const config = authStore.getAuthConfig(request.id, fileId)
        if (config?.type === 'oauth2-authorization-code' && config.oauth2AuthorizationCode) {
          requestLogger.info('401 Unauthorized - attempting auto-reauth with Authorization Code flow')
          requestStore.setExecutionPhase('authenticating')
          
          try {
            // Determine the token cache key
            const authSource = authStore.getAuthConfigSource(request.id, fileId)
            const tokenKey = authSource === 'file' && fileId ? `file:${fileId}` : request.id
            
            // Clear existing token and initiate auth flow (shows popup)
            authStore.clearCachedToken(tokenKey)
            await authService.initiateAuthCodeFlow(tokenKey, config.oauth2AuthorizationCode)
            
            requestLogger.info('Re-authentication successful, retrying request')
            requestLogger.groupEnd()
            
            // Reset executing state so retry can proceed
            isExecuting.value = false
            stopFunnyTextRotation()
            
            // Retry the request with the new token
            return executeRequest(request, fileId, true)
          } catch (authError) {
            // Auth failed or user cancelled - show original 401 error
            requestLogger.warn('Auto-reauth failed or cancelled', authError)
            requestStore.executionState.error = {
              message: `HTTP 401: ${executionResponse.statusText} (re-authentication failed)`,
              code: '401',
              phase: 'authenticating',
            }
            requestStore.setExecutionPhase('error')
            requestLogger.groupEnd()
            // Add to history
            requestStore.addToHistory(request.id, request.name, { ...requestStore.executionState })
          }
        } else {
          // No auth code flow configured, show normal 401 error
          requestLogger.warn('Phase 3: HTTP Error (no auto-reauth available)', { 
            status: executionResponse.status, 
            statusText: executionResponse.statusText 
          })
          requestStore.executionState.error = {
            message: `HTTP ${executionResponse.status}: ${executionResponse.statusText}`,
            code: String(executionResponse.status),
            phase: 'fetching',
          }
          requestStore.setExecutionPhase('error')
          requestLogger.groupEnd()
          // Add to history
          requestStore.addToHistory(request.id, request.name, { ...requestStore.executionState })
        }
      } else {
        requestLogger.warn('Phase 3: HTTP Error', { 
          status: executionResponse.status, 
          statusText: executionResponse.statusText 
        })
        requestStore.executionState.error = {
          message: `HTTP ${executionResponse.status}: ${executionResponse.statusText}`,
          code: String(executionResponse.status),
          phase: 'fetching',
        }
        requestStore.setExecutionPhase('error')
        requestLogger.groupEnd()
        // Add to history
        requestStore.addToHistory(request.id, request.name, { ...requestStore.executionState })
      }

    } catch (error) {
      // Handle network errors
      let errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      let errorCode = 'NETWORK_ERROR'
      
      // Detect CORS errors and provide helpful message
      if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')) {
        if (!isExtensionAvailable.value) {
          errorMessage = 'CORS error: Install the HTTP Visualizer extension to bypass CORS restrictions'
          errorCode = 'CORS_ERROR'
        }
      }
      
      requestLogger.error('Request execution failed', { errorCode, errorMessage })
      
      const executionError: ExecutionError = {
        message: errorMessage,
        code: errorCode,
        phase: requestStore.executionState.phase,
      }
      
      requestStore.executionState.error = executionError
      requestStore.setExecutionPhase('error')
      requestStore.addToHistory(request.id, request.name, { ...requestStore.executionState })
      requestLogger.groupEnd()
    } finally {
      stopFunnyTextRotation()
      isExecuting.value = false
    }
  }

  /**
   * Get resolved variables for a request with proper priority chain:
   * 1. File/Collection overrides (highest priority)
   * 2. Active environment variables
   * 3. Collection-level variables (for collection requests)
   * 4. File-level parsed variables (for imported file requests)
   * 5. Request-level parsed variables (lowest priority)
   * 
   * The sourceId can be either a fileId (for imported .http files) or 
   * a collectionId (for manually created collections).
   */
  function getResolvedVariables(request: ParsedRequest, sourceId?: string): Record<string, string> {
    // Try to find a file with this ID first
    const file = sourceId ? requestStore.files.find(f => f.id === sourceId) : null
    // If not a file, try to find a collection
    const collection = sourceId && !file 
      ? collectionStore.collections.find(c => c.id === sourceId) 
      : null
    
    return mergeVariables(
      // Lowest priority: request-level variables
      request.variables,
      // File-level parsed variables (for imported files)
      file?.variables,
      // Collection-level variables (for collections)
      collection?.variables,
      // Active environment variables
      envStore.activeVariables,
      // Highest priority: file/collection overrides
      sourceId ? envStore.getFileOverrides(sourceId) : undefined
    )
  }

  async function buildFetchOptions(
    request: ParsedRequest, 
    fileId?: string,
    variables?: Record<string, string>
  ): Promise<RequestInit> {
    const headers = new Headers()
    const vars = variables || getResolvedVariables(request, fileId)

    // Add request headers from the file with variable resolution
    for (const header of request.headers) {
      if (header.enabled) {
        const resolvedKey = resolveVariables(header.key, vars)
        const resolvedValue = resolveVariables(header.value, vars)
        headers.set(resolvedKey, resolvedValue)
      }
    }

    // Check if we have auth configured in the auth store (request or file level)
    if (authStore.hasAuthConfig(request.id, fileId)) {
      // Get auth headers from auth service
      const authHeaders = await authService.getAuthHeaders(request, fileId)
      for (const header of authHeaders) {
        if (header.enabled) {
          // Auth headers may also contain variables
          const resolvedKey = resolveVariables(header.key, vars)
          const resolvedValue = resolveVariables(header.value, vars)
          headers.set(resolvedKey, resolvedValue)
        }
      }
    } else {
      // Fall back to file-based auth with variable resolution
      addLegacyAuthHeaders(headers, request.auth, vars)
    }

    const options: RequestInit = {
      method: request.method,
      headers,
      mode: 'cors',
    }

    // Add body for methods that support it, with variable resolution
    if (['POST', 'PUT', 'PATCH'].includes(request.method) && request.body) {
      options.body = resolveVariables(request.body, vars)
    }

    return options
  }

  // Legacy auth header handling for file-based auth configs
  function addLegacyAuthHeaders(headers: Headers, auth?: HttpAuth, variables?: Record<string, string>) {
    if (!auth || auth.type === 'none') return
    const vars = variables || {}

    switch (auth.type) {
      case 'bearer':
        if (auth.bearer?.token) {
          const resolvedToken = resolveVariables(auth.bearer.token, vars)
          headers.set('Authorization', `Bearer ${resolvedToken}`)
        }
        break

      case 'basic':
        if (auth.basic?.username) {
          const resolvedUsername = resolveVariables(auth.basic.username, vars)
          const resolvedPassword = resolveVariables(auth.basic.password || '', vars)
          const credentials = btoa(`${resolvedUsername}:${resolvedPassword}`)
          headers.set('Authorization', `Basic ${credentials}`)
        }
        break

      case 'api-key':
        if (auth.apiKey?.key && auth.apiKey?.value) {
          if (auth.apiKey.in === 'header') {
            const resolvedKey = resolveVariables(auth.apiKey.key, vars)
            const resolvedValue = resolveVariables(auth.apiKey.value, vars)
            headers.set(resolvedKey, resolvedValue)
          }
          // Query params would be handled in URL building
        }
        break

      case 'oauth2':
        // Legacy OAuth2 from file - would need token URL call
        // For now, just log a warning
        console.warn('Legacy OAuth2 auth from file not fully supported. Use auth configuration UI instead.')
        break
    }
  }

  function startFunnyTextRotation() {
    funnyTextInterval.value = setInterval(() => {
      requestStore.updateFunnyText()
    }, 2000)
  }

  function stopFunnyTextRotation() {
    if (funnyTextInterval.value) {
      clearInterval(funnyTextInterval.value)
      funnyTextInterval.value = null
    }
  }

  function simulateDelay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  function reset() {
    stopFunnyTextRotation()
    requestStore.reset()
    isExecuting.value = false
  }

  /**
   * Convert Headers object to plain object
   */
  function headersToObject(headers: Headers): Record<string, string> {
    const obj: Record<string, string> = {}
    headers.forEach((value, key) => {
      obj[key] = value
    })
    return obj
  }

  return {
    isExecuting,
    isExtensionAvailable,
    executeRequest,
    reset,
  }
}
