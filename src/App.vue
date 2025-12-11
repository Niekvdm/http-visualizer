<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRequestStore } from '@/stores/requestStore'
import { useThemeStore } from '@/stores/themeStore'
import { useEnvironmentStore } from '@/stores/environmentStore'
import { usePresentationStore } from '@/stores/presentationStore'
import { useCollectionStore } from '@/stores/collectionStore'
import { useRequestExecutor } from '@/composables/useRequestExecutor'
import AppLayout from '@/components/layout/AppLayout.vue'
import PixiCanvas from '@/components/canvas/PixiCanvas.vue'
import PresentationCanvas from '@/components/presentation/PresentationCanvas.vue'
import ThemeSelector from '@/components/ui/ThemeSelector.vue'
import ModeToggle from '@/components/presentation/ModeToggle.vue'
import NeonButton from '@/components/ui/NeonButton.vue'
import ExtensionStatus from '@/components/ui/ExtensionStatus.vue'
import EnvironmentSelector from '@/components/env/EnvironmentSelector.vue'
import EnvironmentEditor from '@/components/env/EnvironmentEditor.vue'
import RequestEditor from '@/components/builder/RequestEditor.vue'
import { X, Play } from 'lucide-vue-next'

const requestStore = useRequestStore()
const themeStore = useThemeStore()
const envStore = useEnvironmentStore()
const presentationStore = usePresentationStore()
const collectionStore = useCollectionStore()
const { executeRequest, isExecuting, isExtensionAvailable, reset } = useRequestExecutor()

// Presentation mode
const isPresentationMode = computed(() => presentationStore.isPresentationMode)

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

// Get the source ID for the active request (file ID or collection ID)
const activeSourceId = computed(() => {
  if (requestStore.selectedRequest) {
    return requestStore.selectedFileId ?? undefined
  }
  if (collectionStore.selectedRequest) {
    return collectionStore.selectedCollectionId ?? undefined
  }
  return undefined
})

const showThemePanel = ref(false)
const showEnvEditor = ref(false)

// Request editor state
const showRequestEditor = ref(false)
const editingRequestId = ref<string | null>(null)
const editingCollectionId = ref<string | null>(null)

// Find file ID for a request
function findFileIdForRequest(requestId: string): string | undefined {
  for (const file of requestStore.files) {
    if (file.requests.some(r => r.id === requestId)) {
      return file.id
    }
  }
  return undefined
}

// Handle run request event from sidebar (imported files)
function handleRunRequest(event: CustomEvent) {
  const requestId = event.detail.requestId
  const request = requestStore.allRequests.find(r => r.id === requestId)
  if (request) {
    const fileId = findFileIdForRequest(requestId)
    executeRequest(request, fileId)
  }
}

// Run the currently active request (from imported files or collections)
function runActiveRequest() {
  if (activeRequest.value) {
    executeRequest(activeRequest.value, activeSourceId.value)
  }
}

// Handle collection request run
function handleRunCollectionRequest(requestId: string, collectionId: string) {
  const collection = collectionStore.collections.find(c => c.id === collectionId)
  const request = collection?.requests.find(r => r.id === requestId)
  if (request) {
    const executableRequest = collectionStore.toExecutableRequest(request, collectionId)
    executeRequest(executableRequest, collectionId)
  }
}

// Handle edit collection request
function handleEditCollectionRequest(requestId: string, collectionId: string) {
  editingRequestId.value = requestId
  editingCollectionId.value = collectionId
  showRequestEditor.value = true
  collectionStore.setEditing(true)
}

// Close request editor
function closeRequestEditor() {
  showRequestEditor.value = false
  editingRequestId.value = null
  editingCollectionId.value = null
  collectionStore.setEditing(false)
}

// Run from editor
function runFromEditor() {
  if (editingRequestId.value && editingCollectionId.value) {
    handleRunCollectionRequest(editingRequestId.value, editingCollectionId.value)
  }
}

// Import environments from loaded files
function importEnvironmentsFromFiles() {
  for (const file of requestStore.files) {
    if (file.environments) {
      envStore.importFromFile(file.environments)
    }
  }
}

onMounted(() => {
  // Apply theme on mount
  themeStore.applyTheme()
  
  // Import environments from any already loaded files
  importEnvironmentsFromFiles()
  
  // Listen for run-request events
  window.addEventListener('run-request', handleRunRequest as EventListener)
})

onUnmounted(() => {
  window.removeEventListener('run-request', handleRunRequest as EventListener)
})
</script>

<template>
  <AppLayout
    @run-collection-request="handleRunCollectionRequest"
    @edit-collection-request="handleEditCollectionRequest"
  >
    <!-- Extension status before logo -->
    <template #header-left>
      <ExtensionStatus />
    </template>

    <!-- Header actions slot -->
    <template #header-actions>
      <div class="flex items-center gap-2">
        <!-- Environment Selector -->
        <EnvironmentSelector @open-editor="showEnvEditor = true" />

        <div class="w-px h-6 bg-[var(--color-border)]" />

        <!-- Run button -->
        <NeonButton 
          size="sm" 
          :disabled="!activeRequest || isExecuting"
          :loading="isExecuting"
          @click="runActiveRequest"
        >
          <span class="flex items-center gap-1">{{ isExecuting ? 'RUNNING...' : 'RUN' }} <Play v-if="!isExecuting" class="w-3 h-3" /></span>
        </NeonButton>

        <!-- Reset button -->
        <NeonButton 
          size="sm" 
          variant="ghost"
          :disabled="requestStore.executionState.phase === 'idle'"
          @click="reset"
        >
          RESET
        </NeonButton>

        <div class="w-px h-6 bg-[var(--color-border)]" />

        <!-- Theme toggle -->
        <button 
          class="px-3 py-1 text-xs font-mono uppercase tracking-wider rounded transition-colors text-[var(--color-text-dim)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg)]"
          title="Theme settings"
          @click="showThemePanel = !showThemePanel"
        >
          THEME
        </button>
      </div>

      <!-- Theme panel dropdown (teleported to body for proper z-index) -->
      <Teleport to="body">
        <div 
          v-if="showThemePanel"
          class="fixed top-12 right-4 z-[100] bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded p-2 shadow-xl min-w-[200px]"
        >
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs font-mono uppercase tracking-wider text-[var(--color-text)]">THEME</span>
            <button 
              class="text-[var(--color-text-dim)] hover:text-[var(--color-text)] text-xs"
              @click="showThemePanel = false"
            >
              <X class="w-4 h-4" />
            </button>
          </div>
          <ThemeSelector />
        </div>
      </Teleport>
    </template>

    <!-- Canvas slot -->
    <template #canvas>
      <div class="relative w-full h-full">
      <PresentationCanvas v-if="isPresentationMode" />
      <PixiCanvas v-else />
        
        <!-- Mode Toggle - Always visible in top right -->
        <ModeToggle />
      </div>
    </template>
  </AppLayout>

  <!-- Environment Editor Modal -->
  <EnvironmentEditor 
    :show="showEnvEditor" 
    @close="showEnvEditor = false" 
  />

  <!-- Request Editor Modal -->
  <Teleport to="body">
    <div 
      v-if="showRequestEditor && editingRequestId && editingCollectionId"
      class="fixed inset-0 z-[90] flex"
    >
      <!-- Backdrop -->
      <div 
        class="absolute inset-0 bg-black/50 backdrop-blur-sm"
        @click="closeRequestEditor"
      />
      
      <!-- Editor panel (slide in from right) -->
      <div class="absolute right-0 top-0 bottom-0 w-full max-w-2xl shadow-2xl">
        <RequestEditor
          :request-id="editingRequestId"
          :collection-id="editingCollectionId"
          @close="closeRequestEditor"
          @run="runFromEditor"
          @saved="() => {}"
        />
      </div>
    </div>
  </Teleport>
</template>
