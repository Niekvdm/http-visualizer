<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRequestStore } from '@/stores/requestStore'
import { useAuthStore } from '@/stores/authStore'
import { useCollectionStore } from '@/stores/collectionStore'
import { useFileExport } from '@/composables/useFileExport'
import FileDropzone from './FileDropzone.vue'
import RequestItem from './RequestItem.vue'
import AuthConfigModal from '@/components/auth/AuthConfigModal.vue'
import { FileText, Circle, KeyRound, LockOpen, X, InboxIcon, ChevronRight, Download, Upload, Save } from 'lucide-vue-next'

const requestStore = useRequestStore()
const authStore = useAuthStore()
const collectionStore = useCollectionStore()
const { exportSession, importSession, exportResponse } = useFileExport()

// Import input ref
const importInput = ref<HTMLInputElement | null>(null)

// Handle import
async function handleImport(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  const result = await importSession(file)
  if (!result.success) {
    console.error('Import failed:', result.error)
  }
  
  input.value = ''
}

const files = computed(() => requestStore.files)
const selectedFileId = computed(() => requestStore.selectedFileId)
const selectedRequestId = computed(() => requestStore.selectedRequestId)

// File auth modal state
const showFileAuthModal = ref(false)
const fileAuthModalFileId = ref<string | null>(null)
const fileAuthModalFileName = ref('')

// Collapsed state for files
const collapsedFiles = ref<Set<string>>(new Set())

function toggleFileCollapse(fileId: string) {
  if (collapsedFiles.value.has(fileId)) {
    collapsedFiles.value.delete(fileId)
  } else {
    collapsedFiles.value.add(fileId)
  }
}

function isFileCollapsed(fileId: string): boolean {
  return collapsedFiles.value.has(fileId)
}

function selectFile(fileId: string) {
  collectionStore.clearSelection()
  requestStore.selectFile(fileId)
}

function selectRequest(requestId: string) {
  collectionStore.clearSelection()
  requestStore.selectRequest(requestId)
}

function removeFile(fileId: string) {
  requestStore.removeFile(fileId)
  // Also remove file auth config
  authStore.removeFileAuthConfig(fileId)
}

function runRequest(requestId: string) {
  requestStore.selectRequest(requestId)
  // Emit event to trigger execution - handled by parent
  window.dispatchEvent(new CustomEvent('run-request', { detail: { requestId } }))
}

function openFileAuthModal(fileId: string, fileName: string) {
  fileAuthModalFileId.value = fileId
  fileAuthModalFileName.value = fileName
  showFileAuthModal.value = true
}

function closeFileAuthModal() {
  showFileAuthModal.value = false
  fileAuthModalFileId.value = null
}

function hasFileAuth(fileId: string): boolean {
  return authStore.hasFileAuthConfig(fileId)
}

function getFileAuthLabel(fileId: string): string | null {
  const config = authStore.getFileAuthConfig(fileId)
  if (config && config.type !== 'none') {
    return authStore.getAuthTypeLabel(config.type)
  }
  return null
}
</script>

<template>
  <div class="h-full flex flex-col">
    <!-- Header -->
    <div class="p-3 border-b border-[var(--color-border)] flex items-center justify-between">
      <span class="text-xs font-mono uppercase tracking-wider text-[var(--color-text-dim)]">
        Imported Files
      </span>
      <div class="flex items-center gap-0.5">
        <button
          class="p-1.5 rounded hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-dim)] hover:text-[var(--color-secondary)] transition-colors"
          title="Import Session"
          @click="importInput?.click()"
        >
          <Download class="w-4 h-4" />
        </button>
        <button
          class="p-1.5 rounded hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-dim)] hover:text-[var(--color-secondary)] transition-colors"
          title="Export Session"
          :disabled="files.length === 0"
          :class="{ 'opacity-50 cursor-not-allowed': files.length === 0 }"
          @click="exportSession"
        >
          <Upload class="w-4 h-4" />
        </button>
        <button
          v-if="requestStore.executionState.response"
          class="p-1.5 rounded hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-dim)] hover:text-[var(--color-primary)] transition-colors"
          title="Save Response"
          @click="exportResponse"
        >
          <Save class="w-4 h-4" />
        </button>
        <input 
          ref="importInput"
          type="file" 
          accept=".json"
          class="hidden"
          @change="handleImport"
        />
      </div>
    </div>

    <!-- Dropzone -->
    <div class="p-3 border-b border-[var(--color-border)]">
      <FileDropzone />
    </div>
    
    <!-- Files and requests list -->
    <div class="flex-1 overflow-y-auto p-3 space-y-4">
      <template v-if="files.length === 0">
        <div class="text-center text-[var(--color-text-dim)] text-sm py-8">
          <InboxIcon class="w-8 h-8 mx-auto mb-2" />
          <div>No files loaded</div>
          <div class="text-xs mt-1">Drop .http or .bru files above</div>
        </div>
      </template>
      
      <template v-else>
        <div v-for="file in files" :key="file.id" class="space-y-2">
          <!-- File header -->
          <div 
            class="flex items-center justify-between px-2 py-1.5 rounded cursor-pointer group"
            :class="[
              selectedFileId === file.id 
                ? 'bg-[var(--color-primary)]/5' 
                : 'hover:bg-[var(--color-bg-tertiary)]'
            ]"
            @click="selectFile(file.id)"
          >
            <div class="flex items-center gap-2 min-w-0 flex-1">
              <!-- Collapse toggle -->
              <button
                class="p-0.5 -ml-1 rounded hover:bg-[var(--color-bg-tertiary)] transition-transform duration-200"
                :class="{ 'rotate-90': !isFileCollapsed(file.id) }"
                title="Toggle collapse"
                @click.stop="toggleFileCollapse(file.id)"
              >
                <ChevronRight class="w-3 h-3 text-[var(--color-text-dim)]" />
              </button>
              <component 
                :is="file.type === 'http' ? FileText : Circle" 
                class="w-4 h-4 text-[var(--color-primary)]" 
              />
              <span class="text-sm text-[var(--color-text)] truncate font-medium">
                {{ file.name }}
              </span>
              <span class="text-xs text-[var(--color-text-dim)]">
                ({{ file.requests.length }})
              </span>
              
              <!-- File auth indicator -->
              <button
                v-if="hasFileAuth(file.id)"
                class="text-xs px-1.5 py-0.5 rounded bg-[var(--color-primary)]/20 text-[var(--color-primary)] hover:bg-[var(--color-primary)]/30 transition-colors"
                :title="getFileAuthLabel(file.id) || 'File authentication'"
                @click.stop="openFileAuthModal(file.id, file.name)"
              >
                <KeyRound class="w-3 h-3" />
              </button>
              
              <!-- Add file auth button (shown on hover when no auth) -->
              <button
                v-else
                class="text-xs px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity bg-[var(--color-bg)] text-[var(--color-text-dim)] hover:text-[var(--color-primary)]"
                title="Set folder authentication (applies to all requests)"
                @click.stop="openFileAuthModal(file.id, file.name)"
              >
                <LockOpen class="w-3 h-3" />
              </button>
            </div>
            
            <button 
              class="opacity-0 group-hover:opacity-100 text-[var(--color-error)] hover:text-[var(--color-error)] text-sm px-1 transition-opacity ml-2"
              title="Remove file"
              @click.stop="removeFile(file.id)"
            >
              <X class="w-4 h-4" />
            </button>
          </div>
          
          <!-- Collapsible content -->
          <div 
            class="grid transition-[grid-template-rows] duration-200 ease-out"
            :class="isFileCollapsed(file.id) ? 'grid-rows-[0fr]' : 'grid-rows-[1fr]'"
          >
            <div class="overflow-hidden">
              <!-- File auth badge (when configured) -->
              <div 
                v-if="hasFileAuth(file.id)"
                class="ml-6 px-2 py-1 text-xs text-[var(--color-text-dim)] bg-[var(--color-bg-tertiary)] rounded flex items-center gap-2 mb-2"
              >
                <span class="text-[var(--color-primary)]">↳</span>
                <span>Folder auth: {{ getFileAuthLabel(file.id) }}</span>
                <span class="text-[var(--color-text-dim)]">(inherited by requests)</span>
              </div>
              
              <!-- Requests list -->
              <div class="space-y-2 pl-2">
                <RequestItem 
                  v-for="request in file.requests" 
                  :key="request.id"
                  :request="request"
                  :file-id="file.id"
                  :is-selected="selectedRequestId === request.id"
                  @select="selectRequest(request.id)"
                  @run="runRequest(request.id)"
                />
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>
    
    <!-- Footer with stats -->
    <div class="p-3 border-t border-[var(--color-border)] text-xs text-[var(--color-text-dim)]">
      <div class="flex justify-between">
        <span>{{ files.length }} file(s)</span>
        <span>{{ requestStore.allRequests.length }} request(s)</span>
      </div>
    </div>
  </div>

  <!-- File Auth Config Modal -->
  <AuthConfigModal
    v-if="fileAuthModalFileId"
    :request-id="fileAuthModalFileId"
    :request-name="fileAuthModalFileName"
    :show="showFileAuthModal"
    :is-file-auth="true"
    @close="closeFileAuthModal"
  />
</template>
