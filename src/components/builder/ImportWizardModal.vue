<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useCollectionStore } from '@/stores/collectionStore'
import { parseFileFromUpload } from '@/parsers'
import type { ParsedFile } from '@/types'
import { getMethodColor } from '@/utils/formatters'
import { getImportSummary, parsedFileToCollection, mergeIntoCollection } from '@/utils/importConverter'
import { X, Upload, FileText, FolderPlus, FolderInput, AlertCircle, Check } from 'lucide-vue-next'

const props = defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  close: []
  imported: [collectionId: string]
}>()

const collectionStore = useCollectionStore()

// Step state
type Step = 'upload' | 'preview' | 'target'
const currentStep = ref<Step>('upload')

// Upload state
const isDragging = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const error = ref<string | null>(null)

// Parsed file state
const parsedFile = ref<ParsedFile | null>(null)

// Target selection state
type TargetMode = 'new' | 'existing'
const targetMode = ref<TargetMode>('new')
const newCollectionName = ref('')
const selectedCollectionId = ref<string | null>(null)
const selectedFolderId = ref<string | undefined>(undefined)

// Computed
const collections = computed(() => collectionStore.collections)

const selectedCollection = computed(() => {
  if (!selectedCollectionId.value) return null
  return collections.value.find(c => c.id === selectedCollectionId.value) || null
})

const folders = computed(() => {
  if (!selectedCollection.value) return []
  return selectedCollection.value.folders
})

const importSummary = computed(() => {
  if (!parsedFile.value) return null
  return getImportSummary(parsedFile.value)
})

const canProceed = computed(() => {
  if (currentStep.value === 'upload') return !!parsedFile.value
  if (currentStep.value === 'preview') return true
  if (currentStep.value === 'target') {
    if (targetMode.value === 'new') return !!newCollectionName.value.trim()
    return !!selectedCollectionId.value
  }
  return false
})

// Reset state when modal opens/closes
watch(() => props.show, (show) => {
  if (!show) {
    resetState()
  }
})

function resetState() {
  currentStep.value = 'upload'
  isDragging.value = false
  error.value = null
  parsedFile.value = null
  targetMode.value = 'new'
  newCollectionName.value = ''
  selectedCollectionId.value = collections.value.length > 0 ? collections.value[0].id : null
  selectedFolderId.value = undefined
}

// File handling
function handleDragOver(e: DragEvent) {
  e.preventDefault()
  isDragging.value = true
}

function handleDragLeave() {
  isDragging.value = false
}

async function handleDrop(e: DragEvent) {
  e.preventDefault()
  isDragging.value = false

  const file = e.dataTransfer?.files[0]
  if (file) {
    await processFile(file)
  }
}

function triggerFileInput() {
  fileInput.value?.click()
}

async function handleFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) {
    await processFile(file)
  }
  input.value = ''
}

async function processFile(file: File) {
  error.value = null

  const result = await parseFileFromUpload(file)

  if (!result.success || !result.file) {
    error.value = result.error || 'Failed to parse file'
    return
  }

  parsedFile.value = result.file
  newCollectionName.value = result.file.name.replace(/\.(http|rest|bru)$/i, '')
  currentStep.value = 'preview'
}

// Navigation
function goBack() {
  if (currentStep.value === 'preview') {
    currentStep.value = 'upload'
    parsedFile.value = null
    error.value = null
  } else if (currentStep.value === 'target') {
    currentStep.value = 'preview'
  }
}

function goNext() {
  if (currentStep.value === 'preview') {
    currentStep.value = 'target'
  }
}

// Import action
function doImport() {
  if (!parsedFile.value) return

  let collectionId: string

  if (targetMode.value === 'new') {
    // Create new collection from import
    const newCollection = parsedFileToCollection(parsedFile.value, newCollectionName.value.trim())
    collectionStore.importCollection(newCollection)
    collectionId = newCollection.id
  } else {
    // Merge into existing collection
    if (!selectedCollectionId.value) return

    const collection = collectionStore.collections.find(c => c.id === selectedCollectionId.value)
    if (!collection) return

    const mergedCollection = mergeIntoCollection(collection, parsedFile.value, selectedFolderId.value)
    collectionStore.updateCollection(selectedCollectionId.value, mergedCollection)
    collectionId = selectedCollectionId.value
  }

  emit('imported', collectionId)
  emit('close')
}

function close() {
  emit('close')
}
</script>

<template>
  <Teleport to="body">
    <div v-if="show" class="fixed inset-0 z-[100] flex items-center justify-center">
      <!-- Backdrop -->
      <div
        class="absolute inset-0 bg-black/60 backdrop-blur-sm"
        @click="close"
      />

      <!-- Modal -->
      <div class="relative w-full max-w-lg mx-4 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg shadow-2xl">
        <!-- Header -->
        <div class="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
          <h2 class="text-sm font-mono uppercase tracking-wider text-[var(--color-text)]">
            Import Requests
          </h2>
          <button
            class="p-1 rounded hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-dim)] hover:text-[var(--color-text)]"
            @click="close"
          >
            <X class="w-4 h-4" />
          </button>
        </div>

        <!-- Step indicator -->
        <div class="px-4 py-2 border-b border-[var(--color-border)] flex items-center gap-2 text-xs">
          <span
            :class="[
              'px-2 py-0.5 rounded',
              currentStep === 'upload' ? 'bg-[var(--color-primary)] text-[var(--color-bg)]' : 'text-[var(--color-text-dim)]'
            ]"
          >
            1. Upload
          </span>
          <span class="text-[var(--color-text-dim)]">&rarr;</span>
          <span
            :class="[
              'px-2 py-0.5 rounded',
              currentStep === 'preview' ? 'bg-[var(--color-primary)] text-[var(--color-bg)]' : 'text-[var(--color-text-dim)]'
            ]"
          >
            2. Preview
          </span>
          <span class="text-[var(--color-text-dim)]">&rarr;</span>
          <span
            :class="[
              'px-2 py-0.5 rounded',
              currentStep === 'target' ? 'bg-[var(--color-primary)] text-[var(--color-bg)]' : 'text-[var(--color-text-dim)]'
            ]"
          >
            3. Destination
          </span>
        </div>

        <!-- Body -->
        <div class="p-4 min-h-[300px]">
          <!-- Step 1: Upload -->
          <div v-if="currentStep === 'upload'" class="space-y-4">
            <!-- Drop zone -->
            <div
              :class="[
                'border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer',
                isDragging
                  ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10'
                  : 'border-[var(--color-border)] hover:border-[var(--color-primary)]/50'
              ]"
              @dragover="handleDragOver"
              @dragleave="handleDragLeave"
              @drop="handleDrop"
              @click="triggerFileInput"
            >
              <Upload class="w-10 h-10 mx-auto mb-3 text-[var(--color-text-dim)]" />
              <div class="text-sm text-[var(--color-text)]">
                Drop a file here or click to browse
              </div>
              <div class="text-xs text-[var(--color-text-dim)] mt-1">
                Supports .http, .rest, .bru files
              </div>
            </div>

            <input
              ref="fileInput"
              type="file"
              accept=".http,.rest,.bru"
              class="hidden"
              @change="handleFileChange"
            />

            <!-- Error -->
            <div v-if="error" class="flex items-center gap-2 p-3 bg-[var(--color-error)]/10 border border-[var(--color-error)]/30 rounded text-sm text-[var(--color-error)]">
              <AlertCircle class="w-4 h-4 flex-shrink-0" />
              {{ error }}
            </div>
          </div>

          <!-- Step 2: Preview -->
          <div v-if="currentStep === 'preview' && parsedFile" class="space-y-4">
            <!-- File info -->
            <div class="flex items-center gap-3 p-3 bg-[var(--color-bg-tertiary)] rounded">
              <FileText class="w-5 h-5 text-[var(--color-primary)]" />
              <div class="flex-1 min-w-0">
                <div class="text-sm font-medium text-[var(--color-text)] truncate">
                  {{ parsedFile.name }}
                </div>
                <div class="text-xs text-[var(--color-text-dim)]">
                  {{ importSummary?.requestCount }} request(s)
                  <template v-if="importSummary?.variableCount"> &bull; {{ importSummary.variableCount }} variable(s)</template>
                  <template v-if="importSummary?.environmentCount"> &bull; {{ importSummary.environmentCount }} environment(s)</template>
                </div>
              </div>
            </div>

            <!-- Request list preview -->
            <div class="space-y-1 max-h-48 overflow-y-auto">
              <div
                v-for="request in parsedFile.requests"
                :key="request.id"
                class="flex items-center gap-2 p-2 bg-[var(--color-bg)] rounded border border-[var(--color-border)]"
              >
                <span
                  class="text-xs font-mono font-bold w-14 text-center"
                  :class="getMethodColor(request.method)"
                >
                  {{ request.method }}
                </span>
                <span class="flex-1 text-sm text-[var(--color-text)] truncate font-mono">
                  {{ request.name }}
                </span>
              </div>
            </div>
          </div>

          <!-- Step 3: Target selection -->
          <div v-if="currentStep === 'target'" class="space-y-4">
            <!-- Mode selection -->
            <div class="grid grid-cols-2 gap-2">
              <button
                :class="[
                  'p-3 rounded border text-left transition-colors',
                  targetMode === 'new'
                    ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10'
                    : 'border-[var(--color-border)] hover:border-[var(--color-primary)]/50'
                ]"
                @click="targetMode = 'new'"
              >
                <FolderPlus class="w-5 h-5 mb-1" :class="targetMode === 'new' ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-dim)]'" />
                <div class="text-sm font-medium text-[var(--color-text)]">New Collection</div>
                <div class="text-xs text-[var(--color-text-dim)]">Create a new collection</div>
              </button>
              <button
                :class="[
                  'p-3 rounded border text-left transition-colors',
                  targetMode === 'existing'
                    ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10'
                    : 'border-[var(--color-border)] hover:border-[var(--color-primary)]/50',
                  collections.length === 0 ? 'opacity-50 cursor-not-allowed' : ''
                ]"
                :disabled="collections.length === 0"
                @click="targetMode = 'existing'"
              >
                <FolderInput class="w-5 h-5 mb-1" :class="targetMode === 'existing' ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-dim)]'" />
                <div class="text-sm font-medium text-[var(--color-text)]">Existing Collection</div>
                <div class="text-xs text-[var(--color-text-dim)]">Add to existing collection</div>
              </button>
            </div>

            <!-- New collection name input -->
            <div v-if="targetMode === 'new'">
              <label class="block text-xs text-[var(--color-text-dim)] mb-1">Collection Name</label>
              <input
                v-model="newCollectionName"
                type="text"
                placeholder="My Collection"
                class="w-full px-3 py-2 text-sm bg-[var(--color-bg)] border border-[var(--color-border)] rounded text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] placeholder:text-[var(--color-text-dim)]"
              />
            </div>

            <!-- Existing collection selection -->
            <div v-if="targetMode === 'existing'" class="space-y-3">
              <div>
                <label class="block text-xs text-[var(--color-text-dim)] mb-1">Collection</label>
                <select
                  v-model="selectedCollectionId"
                  class="w-full px-3 py-2 text-sm bg-[var(--color-bg)] border border-[var(--color-border)] rounded text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]"
                >
                  <option v-for="collection in collections" :key="collection.id" :value="collection.id">
                    {{ collection.name }}
                  </option>
                </select>
              </div>

              <div v-if="folders.length > 0">
                <label class="block text-xs text-[var(--color-text-dim)] mb-1">Folder (optional)</label>
                <select
                  v-model="selectedFolderId"
                  class="w-full px-3 py-2 text-sm bg-[var(--color-bg)] border border-[var(--color-border)] rounded text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]"
                >
                  <option :value="undefined">Root (no folder)</option>
                  <option v-for="folder in folders" :key="folder.id" :value="folder.id">
                    {{ folder.name }}
                  </option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="flex justify-between px-4 py-3 border-t border-[var(--color-border)]">
          <button
            v-if="currentStep !== 'upload'"
            class="px-4 py-1.5 text-sm bg-[var(--color-bg)] text-[var(--color-text-dim)] rounded hover:text-[var(--color-text)] transition-colors"
            @click="goBack"
          >
            Back
          </button>
          <div v-else />

          <div class="flex gap-2">
            <button
              class="px-4 py-1.5 text-sm bg-[var(--color-bg)] text-[var(--color-text-dim)] rounded hover:text-[var(--color-text)] transition-colors"
              @click="close"
            >
              Cancel
            </button>

            <button
              v-if="currentStep === 'preview'"
              class="px-4 py-1.5 text-sm bg-[var(--color-primary)] text-[var(--color-bg)] rounded font-medium hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
              :disabled="!canProceed"
              @click="goNext"
            >
              Next
            </button>

            <button
              v-if="currentStep === 'target'"
              class="px-4 py-1.5 text-sm bg-[var(--color-primary)] text-[var(--color-bg)] rounded font-medium hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              :disabled="!canProceed"
              @click="doImport"
            >
              <Check class="w-4 h-4" />
              Import
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
