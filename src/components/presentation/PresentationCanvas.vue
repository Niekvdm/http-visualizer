<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { Application } from 'pixi.js'
import { usePresentationStore } from '@/stores/presentationStore'
import { useRequestStore } from '@/stores/requestStore'
import { useCollectionStore } from '@/stores/collectionStore'
import { useThemeStore } from '@/stores/themeStore'
import { useEnvironmentStore } from '@/stores/environmentStore'
import { createPresentationMode, type IPresentationMode, type PresentationModeEvent } from './modes'
import JsonReveal from './JsonReveal.vue'
import TerminalJsonReveal from './TerminalJsonReveal.vue'
import { X } from 'lucide-vue-next'

const containerRef = ref<HTMLDivElement | null>(null)
const presentationStore = usePresentationStore()
const requestStore = useRequestStore()
const collectionStore = useCollectionStore()
const themeStore = useThemeStore()
const envStore = useEnvironmentStore()

let app: Application | null = null
let currentRenderer: IPresentationMode | null = null

const colors = computed(() => themeStore.colors)
const mode = computed(() => presentationStore.mode)
const settings = computed(() => presentationStore.settings)
const responseBody = computed(() => requestStore.executionState.response?.bodyParsed)

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

// Local state for JSON reveal (controlled by mode events)
const showJsonReveal = ref(false)

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
  
  createRenderer()
}

function createRenderer() {
  if (!app || !containerRef.value) return

  // Destroy existing renderer
  if (currentRenderer) {
    currentRenderer.destroy()
    currentRenderer = null
  }
  
  // Reset JSON reveal state
  showJsonReveal.value = false

  const width = containerRef.value.clientWidth
  const height = containerRef.value.clientHeight

  const options = {
    width,
    height,
    primaryColor: hexToNumber(colors.value.primary),
    secondaryColor: hexToNumber(colors.value.secondary),
    bgColor: hexToNumber(colors.value.bgSecondary),
    textColor: hexToNumber(colors.value.text),
    errorColor: hexToNumber(colors.value.error),
  }

  // Use the mode registry to create the appropriate renderer
  currentRenderer = createPresentationMode(mode.value, options)
  
  if (!currentRenderer) {
    // Mode is 'dialog' or unknown - nothing to render here
    return
  }

  // Set up event callback
  currentRenderer.setEventCallback(handleModeEvent)
  
  // Pass settings
  currentRenderer.updateSettings({
    autoAdvance: settings.value.autoAdvance,
    autoAdvanceDelay: settings.value.autoAdvanceDelay,
    typingSpeed: settings.value.typingSpeed,
  })

  app.stage.addChild(currentRenderer)
  
  // Set initial state
  if (activeRequest.value) {
    currentRenderer.setRequest(activeRequest.value, getResolvedVariables())
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

// Handle events from presentation modes
function handleModeEvent(event: PresentationModeEvent) {
  if (event === 'execute-request') {
    // Dispatch custom event to trigger request execution
    if (activeRequest.value) {
      window.dispatchEvent(new CustomEvent('run-request', { 
        detail: { requestId: activeRequest.value.id } 
      }))
    }
  } else if (event === 'open-response') {
    // Open JSON reveal if response available
    if (responseBody.value && settings.value.showJsonReveal) {
      showJsonReveal.value = true
    }
  }
}

// Close JSON reveal
function closeJsonReveal() {
  showJsonReveal.value = false
  // Notify mode that JSON reveal was closed
  currentRenderer?.onJsonRevealClosed()
}

function handleResize() {
  if (!containerRef.value || !app) return

  const width = containerRef.value.clientWidth
  const height = containerRef.value.clientHeight

  app.renderer.resize(width, height)
  currentRenderer?.resize(width, height)
}

// Watch mode changes
watch(mode, () => {
  if (mode.value !== 'dialog') {
    createRenderer()
  }
})

// Watch for selected request changes (from either imported files or collections)
watch(activeRequest, (request) => {
  currentRenderer?.setRequest(request, getResolvedVariables())
})

// Track last phase to avoid duplicate calls
let lastPhase: string | null = null
let lastResponseStatus: number | null = null

// Watch for execution state changes
watch(() => requestStore.executionState, (state) => {
  if (!currentRenderer) return

  // Reset JSON reveal on new execution
  if (state.phase === 'idle' || state.phase === 'authenticating' || state.phase === 'fetching') {
    showJsonReveal.value = false
  }

  // Only process if phase changed
  if (state.phase !== lastPhase) {
    lastPhase = state.phase
    lastResponseStatus = null
    
    // Sync presentation store with execution
    presentationStore.syncWithExecution(state, activeRequest.value)
    
    currentRenderer.setPhase(state.phase, state.funnyText)
  }

  // Handle response separately (only once per response)
  if (state.phase === 'success' && state.response && state.response.status !== lastResponseStatus) {
    lastResponseStatus = state.response.status
    currentRenderer.setResponse(
      state.response.status,
      state.response.statusText,
      state.response.size,
      state.response.timing.total
    )
  } else if (state.phase === 'error' && state.error && lastResponseStatus !== -1) {
    lastResponseStatus = -1 // Mark error as handled
    currentRenderer.setError(state.error.message)
  }
}, { deep: true })

// Watch for theme changes
watch(colors, (newColors) => {
  if (!app || !currentRenderer) return

  app.renderer.background.color = hexToNumber(newColors.bg)
  currentRenderer.setColors(
    hexToNumber(newColors.primary),
    hexToNumber(newColors.secondary),
    hexToNumber(newColors.bgSecondary),
    hexToNumber(newColors.text),
    hexToNumber(newColors.error)
  )
}, { deep: true })

// Watch for settings changes
watch(settings, (newSettings) => {
  currentRenderer?.updateSettings({
    autoAdvance: newSettings.autoAdvance,
    autoAdvanceDelay: newSettings.autoAdvanceDelay,
    typingSpeed: newSettings.typingSpeed,
  })
}, { deep: true })

// Handle keyboard events for presentation mode
function handleKeydown(e: KeyboardEvent) {
  // Close JSON reveal on Escape
  if (e.key === 'Escape' && showJsonReveal.value) {
    closeJsonReveal()
    return
  }
  
  // Block Enter when response view is open
  if (showJsonReveal.value) {
    return
  }
  
  // Let the current mode handle input
  if (currentRenderer && e.key === 'Enter') {
    currentRenderer.handleInput()
  }
}

// Handle click events on canvas
function handleCanvasClick() {
  // Block clicks when response view is open
  if (showJsonReveal.value) {
    return
  }
  
  // Let the current mode handle click
  currentRenderer?.handleInputClick()
}

onMounted(async () => {
  await initPixi()
  window.addEventListener('resize', handleResize)
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  window.removeEventListener('keydown', handleKeydown)
  currentRenderer?.destroy()
  app?.destroy(true)
})
</script>

<template>
  <div class="relative w-full h-full" @click="handleCanvasClick">
    <!-- PixiJS Canvas -->
    <div 
      ref="containerRef" 
      class="w-full h-full"
    />

    <!-- JSON Reveal Overlay - Terminal Mode -->
    <Transition
      enter-active-class="transition-all duration-300"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-all duration-200"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div 
        v-if="showJsonReveal && responseBody && mode === 'terminal'"
        class="absolute inset-0 flex items-center justify-center terminal-backdrop p-6"
        @click.stop="closeJsonReveal"
      >
        <div 
          class="relative max-w-3xl w-full h-full max-h-full flex flex-col"
          @click.stop
        >
          <TerminalJsonReveal :data="responseBody" @close="closeJsonReveal" />
        </div>
      </div>
    </Transition>

    <!-- JSON Reveal Overlay - Other Modes -->
    <Transition
      enter-active-class="transition-all duration-500"
      enter-from-class="opacity-0 scale-95"
      enter-to-class="opacity-100 scale-100"
      leave-active-class="transition-all duration-300"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95"
    >
      <div 
        v-if="showJsonReveal && responseBody && mode !== 'terminal'"
        class="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm"
        @click.stop="closeJsonReveal"
      >
        <div 
          class="relative max-w-2xl max-h-[80%] w-full mx-4 overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] shadow-2xl"
          @click.stop
        >
          <!-- Close button -->
          <button 
            class="absolute top-2 right-2 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-[var(--color-bg-tertiary)] text-[var(--color-text-dim)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg)] transition-colors"
            @click="closeJsonReveal"
          >
            <X class="w-4 h-4" />
          </button>
          <JsonReveal :data="responseBody" />
        </div>
      </div>
    </Transition>

  </div>
</template>

<style scoped>
.terminal-backdrop {
  background: rgba(0, 0, 0, 0.85);
  animation: crt-flicker 0.15s ease-in-out;
}

@keyframes crt-flicker {
  0% { opacity: 0; }
  10% { opacity: 0.8; }
  20% { opacity: 0.6; }
  30% { opacity: 0.9; }
  100% { opacity: 1; }
}
</style>
