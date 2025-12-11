/**
 * Extension Bridge Composable
 * 
 * Handles communication with the HTTP Visualizer browser extension
 * for bypassing CORS restrictions.
 */

import { ref, readonly, onMounted, onUnmounted } from 'vue'

// Extension identifier (must match content.js)
const EXTENSION_ID = 'http-visualizer-extension'

// Message types
const MESSAGE_TYPES = {
  PING: 'HTTP_VISUALIZER_PING',
  PONG: 'HTTP_VISUALIZER_PONG',
  REQUEST: 'HTTP_VISUALIZER_REQUEST',
  RESPONSE: 'HTTP_VISUALIZER_RESPONSE',
  CONNECT: 'HTTP_VISUALIZER_CONNECT',
  DISCONNECT: 'HTTP_VISUALIZER_DISCONNECT',
}

// Detailed timing from extension
export interface ExtensionTiming {
  total: number
  dns?: number
  tcp?: number
  tls?: number
  ttfb?: number
  download?: number
  blocked?: number
}

// Redirect hop info from extension
export interface ExtensionRedirectHop {
  url: string
  status: number
  duration: number
  headers?: Record<string, string>
}

// TLS info from extension
export interface ExtensionTlsInfo {
  protocol?: string
  cipher?: string
  issuer?: string
  subject?: string
  validFrom?: number
  validTo?: number
  valid?: boolean
}

// Size breakdown from extension
export interface ExtensionSizeBreakdown {
  headers: number
  body: number
  total: number
  compressed?: number
  uncompressed?: number
  encoding?: string
  compressionRatio?: number
}

// Response from extension for HTTP requests
export interface ExtensionResponse {
  success: boolean
  id?: string
  data?: {
    status: number
    statusText: string
    headers: Record<string, string>
    body: string
    bodyBase64?: string | null
    isBinary: boolean
    size: number
    timing: ExtensionTiming
    url: string
    redirected: boolean
    redirectChain?: ExtensionRedirectHop[]
    tls?: ExtensionTlsInfo
    sizeBreakdown?: ExtensionSizeBreakdown
  }
  error?: {
    message: string
    code: string
    name?: string
  }
}

// Singleton state
let isExtensionAvailable = ref(false)
let extensionVersion = ref<string | null>(null)
let isInitialized = false
let pendingRequests = new Map<string, {
  resolve: (response: ExtensionResponse) => void
  reject: (error: Error) => void
  timeout: ReturnType<typeof setTimeout>
}>()

/**
 * Initialize extension detection
 */
function initExtensionBridge() {
  if (isInitialized) return

  // Listen for extension ready message
  window.addEventListener('message', handleMessage)

  // Also check periodically for extension
  checkExtensionAvailability()
  
  isInitialized = true
}

/**
 * Handle messages from the extension's content script
 */
function handleMessage(event: MessageEvent) {
  // Only accept messages from the same window
  if (event.source !== window) return
  
  // Only process messages from our extension
  if (!event.data || event.data.source !== EXTENSION_ID) return

  const { type, requestId, response } = event.data

  // Handle extension ready announcement
  if (type === 'HTTP_VISUALIZER_EXTENSION_READY') {
    isExtensionAvailable.value = true
    extensionVersion.value = event.data.version || '1.0.0'
    console.log('[HTTP Visualizer] Extension detected, version:', extensionVersion.value)
    
    // Send connect message
    sendToExtension(MESSAGE_TYPES.CONNECT, {})
    return
  }

  // Handle ping response
  if (type === `${MESSAGE_TYPES.PING}_RESPONSE`) {
    if (response?.type === MESSAGE_TYPES.PONG) {
      isExtensionAvailable.value = true
      extensionVersion.value = response.version || '1.0.0'
    }
    return
  }

  // Handle request response
  if (type === `${MESSAGE_TYPES.REQUEST}_RESPONSE` && requestId) {
    const pending = pendingRequests.get(requestId)
    if (pending) {
      clearTimeout(pending.timeout)
      pendingRequests.delete(requestId)
      pending.resolve(response as ExtensionResponse)
    }
    return
  }
}

/**
 * Send a message to the extension via postMessage
 */
function sendToExtension(type: string, payload: unknown, requestId?: string): void {
  window.postMessage({
    target: EXTENSION_ID,
    type,
    payload,
    requestId,
  }, '*')
}

/**
 * Check if extension is available by sending a ping
 */
async function checkExtensionAvailability(): Promise<boolean> {
  return new Promise((resolve) => {
    // Set up a one-time listener for the ping response
    const timeout = setTimeout(() => {
      resolve(false)
    }, 1000)

    const handler = (event: MessageEvent) => {
      if (event.source !== window) return
      if (!event.data || event.data.source !== EXTENSION_ID) return
      
      if (event.data.type === `${MESSAGE_TYPES.PING}_RESPONSE`) {
        clearTimeout(timeout)
        window.removeEventListener('message', handler)
        isExtensionAvailable.value = true
        extensionVersion.value = event.data.response?.version || '1.0.0'
        resolve(true)
      }
    }

    window.addEventListener('message', handler)
    sendToExtension(MESSAGE_TYPES.PING, {})
  })
}

/**
 * Generate a unique request ID
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Execute an HTTP request through the extension
 */
async function executeViaExtension(options: {
  method: string
  url: string
  headers?: Record<string, string>
  body?: string
  timeout?: number
}): Promise<ExtensionResponse> {
  if (!isExtensionAvailable.value) {
    throw new Error('Extension not available')
  }

  const requestId = generateRequestId()
  const requestTimeout = options.timeout || 30000

  return new Promise((resolve, reject) => {
    // Set up timeout
    const timeout = setTimeout(() => {
      pendingRequests.delete(requestId)
      reject(new Error(`Request timed out after ${requestTimeout}ms`))
    }, requestTimeout + 5000) // Add buffer for extension processing

    // Store pending request
    pendingRequests.set(requestId, { resolve, reject, timeout })

    // Send request to extension
    sendToExtension(MESSAGE_TYPES.REQUEST, {
      method: options.method,
      url: options.url,
      headers: options.headers || {},
      body: options.body,
      timeout: requestTimeout,
    }, requestId)
  })
}

/**
 * Composable for extension bridge functionality
 */
export function useExtensionBridge() {
  onMounted(() => {
    initExtensionBridge()
  })

  onUnmounted(() => {
    // Send disconnect message when component unmounts
    if (isExtensionAvailable.value) {
      sendToExtension(MESSAGE_TYPES.DISCONNECT, {})
    }
  })

  return {
    // State (readonly to prevent external mutation)
    isExtensionAvailable: readonly(isExtensionAvailable),
    extensionVersion: readonly(extensionVersion),
    
    // Methods
    checkExtensionAvailability,
    executeViaExtension,
  }
}

/**
 * Non-reactive utility for checking extension availability
 * Can be used outside of Vue components
 */
export function isExtensionInstalled(): boolean {
  return isExtensionAvailable.value
}

/**
 * Execute request via extension (non-composable version)
 */
export async function executeRequestViaExtension(options: {
  method: string
  url: string
  headers?: Record<string, string>
  body?: string
  timeout?: number
}): Promise<ExtensionResponse> {
  // Ensure bridge is initialized
  initExtensionBridge()
  
  // Wait a bit for extension detection if not yet available
  if (!isExtensionAvailable.value) {
    await checkExtensionAvailability()
  }
  
  return executeViaExtension(options)
}

