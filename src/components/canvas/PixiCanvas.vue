<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from 'vue'
import { Application } from 'pixi.js'
import { useRequestStore } from '@/stores/requestStore'
import { useExecutionStore } from '@/stores/executionStore'
import { useCollectionStore } from '@/stores/collectionStore'
import { useThemeStore } from '@/stores/themeStore'
import { useAuthStore } from '@/stores/authStore'
import { useEnvironmentStore } from '@/stores/environmentStore'
import { MatrixRain } from './MatrixRain'
import { DataFlowGraph } from './DataFlowGraph'
import { formatBytes, formatDuration } from '@/utils/formatters'

const containerRef = ref<HTMLDivElement | null>(null)
// requestStore kept for files access during transition
const requestStore = useRequestStore()
const executionStore = useExecutionStore()
const collectionStore = useCollectionStore()
const themeStore = useThemeStore()
const authStore = useAuthStore()
const envStore = useEnvironmentStore()

let app: Application | null = null
let matrixRain: MatrixRain | null = null
let dataFlowGraph: DataFlowGraph | null = null

const colors = computed(() => themeStore.colors)

// Get the currently active request (from imported files or collections)
const activeRequest = computed(() => {
  // If a request is selected in the imported files store, use that
  if (requestStore.selectedRequest) {
    return requestStore.selectedRequest
  }
  // If a request is selected in the collections store, convert it to executable format
  if (collectionStore.selectedRequest && collectionStore.selectedCollectionId) {
    return collectionStore.toExecutableRequest(
      collectionStore.selectedRequest,
      collectionStore.selectedCollectionId
    )
  }
  return null
})

// Get the file/collection ID for auth config lookup
const activeSourceId = computed(() => {
  if (requestStore.selectedRequest) {
    return requestStore.selectedFileId ?? undefined
  }
  if (collectionStore.selectedRequest) {
    return collectionStore.selectedCollectionId ?? undefined
  }
  return undefined
})

// Get the resolved auth config for the active request
// This handles both auth store configs (imported files) and HttpAuth from collections
function getResolvedAuthConfig(request: typeof activeRequest.value): import('@/types').AuthConfig | null {
  if (!request) return null
  
  // First check auth store (handles imported files and any overrides)
  const storeConfig = authStore.getAuthConfig(request.id, activeSourceId.value)
  if (storeConfig && storeConfig.type !== 'none') {
    return storeConfig
  }
  
  // For collections, the auth is resolved in request.auth (HttpAuth type)
  // Convert HttpAuth to AuthConfig format for display
  if (request.auth && request.auth.type !== 'none') {
    const httpAuth = request.auth
    const authConfig: import('@/types').AuthConfig = { type: 'none' }
    
    switch (httpAuth.type) {
      case 'basic':
        authConfig.type = 'basic'
        authConfig.basic = httpAuth.basic
        break
      case 'bearer':
        authConfig.type = 'bearer'
        authConfig.bearer = httpAuth.bearer
        break
      case 'api-key':
        authConfig.type = 'api-key'
        authConfig.apiKey = httpAuth.apiKey
        break
      case 'oauth2':
        // Map legacy oauth2 to oauth2-client-credentials
        authConfig.type = 'oauth2-client-credentials'
        if (httpAuth.oauth2) {
          authConfig.oauth2ClientCredentials = {
            tokenUrl: httpAuth.oauth2.accessTokenUrl,
            clientId: httpAuth.oauth2.clientId,
            clientSecret: httpAuth.oauth2.clientSecret,
            scope: httpAuth.oauth2.scope,
          }
        }
        break
    }
    
    if (authConfig.type !== 'none') {
      return authConfig
    }
  }
  
  return null
}

function hexToNumber(hex: string): number {
  return parseInt(hex.replace('#', ''), 16)
}

async function initPixi() {
  if (!containerRef.value) return

  const width = containerRef.value.clientWidth
  const height = containerRef.value.clientHeight

  app = new Application()
  await app.init({
    width,
    height,
    backgroundColor: hexToNumber(colors.value.bg),
    antialias: true,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
  })

  containerRef.value.appendChild(app.canvas as HTMLCanvasElement)
  
  // Enable interaction events on the stage
  app.stage.eventMode = 'static'

  // Create Matrix rain background
  matrixRain = new MatrixRain(width, height, hexToNumber(colors.value.primary))
  app.stage.addChild(matrixRain)

  // Create data flow graph
  dataFlowGraph = new DataFlowGraph({
    width,
    height,
    primaryColor: hexToNumber(colors.value.primary),
    secondaryColor: hexToNumber(colors.value.secondary),
    bgColor: hexToNumber(colors.value.bgSecondary),
    textColor: hexToNumber(colors.value.text),
    errorColor: hexToNumber(colors.value.error),
  })
  app.stage.addChild(dataFlowGraph)

  // Set initial request if any
  if (activeRequest.value) {
    const authConfig = getResolvedAuthConfig(activeRequest.value)
    dataFlowGraph.setRequest(activeRequest.value, authConfig, getResolvedVariables())
  }
}

// Get resolved variables for display (merges request, file/collection, and environment variables)
function getResolvedVariables(): Record<string, string> {
  const request = activeRequest.value
  const fileId = requestStore.selectedFileId
  const file = fileId ? requestStore.files.find(f => f.id === fileId) : null
  const collectionId = collectionStore.selectedCollectionId
  const collection = collectionId ? collectionStore.collections.find(c => c.id === collectionId) : null
  
  return {
    // Request-level variables (lowest priority)
    ...request?.variables,
    // File-level variables (for imported files)
    ...file?.variables,
    // Collection-level variables (for collections)
    ...collection?.variables,
    // Active environment variables
    ...envStore.activeVariables,
    // File overrides (highest priority)
    ...(fileId ? envStore.getFileOverrides(fileId) : {}),
  }
}

function handleResize() {
  if (!containerRef.value || !app) return

  const width = containerRef.value.clientWidth
  const height = containerRef.value.clientHeight

  app.renderer.resize(width, height)
  matrixRain?.resize(width, height)
  dataFlowGraph?.resize(width, height)
}

// Watch for selected request changes (from either imported files or collections)
watch(activeRequest, (request) => {
  const authConfig = getResolvedAuthConfig(request)
  dataFlowGraph?.setRequest(request, authConfig, getResolvedVariables())
})

// Watch for execution state changes
watch(() => executionStore.executionState, (state) => {
  if (!dataFlowGraph) return

  dataFlowGraph.setPhase(state.phase, state.funnyText)

  if (state.phase === 'success' && state.response) {
    // Set redirect chain first (before response, so layout is correct)
    if (state.response.redirectChain && state.response.redirectChain.length > 0) {
      dataFlowGraph.setRedirectChain(state.response.redirectChain)
    }

    dataFlowGraph.setResponse(
      state.response.status,
      state.response.statusText,
      formatBytes(state.response.size),
      formatDuration(state.response.timing.total)
    )
    // Set response body content
    dataFlowGraph.setResponseBody(state.response.bodyParsed ?? state.response.body)
  } else if (state.phase === 'error' && state.error) {
    dataFlowGraph.setError(state.error.message)
  }
}, { deep: true })

// Watch for theme changes
watch(colors, (newColors) => {
  if (!app || !matrixRain || !dataFlowGraph) return

  app.renderer.background.color = hexToNumber(newColors.bg)
  matrixRain.setColor(hexToNumber(newColors.primary))
  dataFlowGraph.setColors(
    hexToNumber(newColors.primary),
    hexToNumber(newColors.secondary),
    hexToNumber(newColors.bgSecondary),
    hexToNumber(newColors.text),
    hexToNumber(newColors.error)
  )
}, { deep: true })

onMounted(async () => {
  await initPixi()
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  matrixRain?.destroy()
  dataFlowGraph?.destroy()
  app?.destroy(true)
})

// Expose resize function for parent to call
defineExpose({ resize: handleResize })
</script>

<template>
  <div 
    ref="containerRef" 
    class="w-full h-full"
  />
</template>

