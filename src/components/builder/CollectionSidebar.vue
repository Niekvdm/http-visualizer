<script setup lang="ts">
import { ref, computed } from 'vue'
import { useCollectionStore } from '@/stores/collectionStore'
import { useFileExport } from '@/composables/useFileExport'
import CollectionItem from './CollectionItem.vue'
import NewRequestModal from './NewRequestModal.vue'
import NewFolderModal from './NewFolderModal.vue'
import { Plus, Archive, Download, Upload } from 'lucide-vue-next'

const emit = defineEmits<{
  'run-request': [requestId: string, collectionId: string]
  'edit-request': [requestId: string, collectionId: string]
}>()

const collectionStore = useCollectionStore()
const { exportCollections, importCollections } = useFileExport()

const collections = computed(() => collectionStore.collections)

// Modal states
const showNewCollectionInput = ref(false)
const newCollectionName = ref('')
const showNewRequestModal = ref(false)
const showNewFolderModal = ref(false)
const targetCollectionId = ref<string | null>(null)
const targetFolderId = ref<string | undefined>(undefined)
const importInput = ref<HTMLInputElement | null>(null)

// Create new collection
function startNewCollection() {
  showNewCollectionInput.value = true
  newCollectionName.value = ''
}

function createCollection() {
  if (newCollectionName.value.trim()) {
    collectionStore.createCollection(newCollectionName.value.trim())
    showNewCollectionInput.value = false
    newCollectionName.value = ''
  }
}

function cancelNewCollection() {
  showNewCollectionInput.value = false
  newCollectionName.value = ''
}

// Handle new request
function openNewRequestModal(collectionId: string, folderId?: string) {
  targetCollectionId.value = collectionId
  targetFolderId.value = folderId
  showNewRequestModal.value = true
}

function closeNewRequestModal() {
  showNewRequestModal.value = false
  targetCollectionId.value = null
  targetFolderId.value = undefined
}

// Handle new folder
function openNewFolderModal(collectionId: string) {
  targetCollectionId.value = collectionId
  showNewFolderModal.value = true
}

function closeNewFolderModal() {
  showNewFolderModal.value = false
  targetCollectionId.value = null
}

// Forward events
function onRunRequest(requestId: string, collectionId: string) {
  emit('run-request', requestId, collectionId)
}

function onEditRequest(requestId: string, collectionId: string) {
  emit('edit-request', requestId, collectionId)
}

// Export/Import
function handleExport() {
  exportCollections()
}

async function handleImport(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  const result = await importCollections(file, true)
  if (!result.success) {
    alert(`Import failed: ${result.error}`)
  } else {
    alert(`Successfully imported ${result.count} collection(s)`)
  }
  
  input.value = ''
}
</script>

<template>
  <div class="h-full flex flex-col">
    <!-- Header -->
    <div class="p-3 border-b border-[var(--color-border)] flex items-center justify-between">
      <span class="text-xs font-mono uppercase tracking-wider text-[var(--color-text-dim)]">
        Collections
      </span>
      <div class="flex items-center gap-0.5">
        <button
          class="p-1.5 rounded hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-dim)] hover:text-[var(--color-primary)] transition-colors"
          title="New Collection"
          @click="startNewCollection"
        >
          <Plus class="w-4 h-4" />
        </button>
        <button
          class="p-1.5 rounded hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-dim)] hover:text-[var(--color-secondary)] transition-colors"
          title="Import Collections"
          @click="importInput?.click()"
        >
          <Download class="w-4 h-4" />
        </button>
        <button
          class="p-1.5 rounded hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-dim)] hover:text-[var(--color-secondary)] transition-colors"
          title="Export All Collections"
          :disabled="collections.length === 0"
          :class="{ 'opacity-50 cursor-not-allowed': collections.length === 0 }"
          @click="handleExport"
        >
          <Upload class="w-4 h-4" />
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

    <!-- New collection input -->
    <div v-if="showNewCollectionInput" class="p-3 border-b border-[var(--color-border)] bg-[var(--color-bg-tertiary)]">
      <input
        v-model="newCollectionName"
        type="text"
        placeholder="Collection name..."
        class="w-full px-2 py-1.5 text-sm bg-[var(--color-bg)] border border-[var(--color-primary)] rounded text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-dim)]"
        @keydown.enter="createCollection"
        @keydown.escape="cancelNewCollection"
        autofocus
      />
      <div class="flex gap-2 mt-2">
        <button
          class="flex-1 px-2 py-1 text-xs bg-[var(--color-primary)] text-[var(--color-bg)] rounded font-medium hover:brightness-110"
          @click="createCollection"
        >
          Create
        </button>
        <button
          class="flex-1 px-2 py-1 text-xs bg-[var(--color-bg)] text-[var(--color-text-dim)] rounded hover:text-[var(--color-text)]"
          @click="cancelNewCollection"
        >
          Cancel
        </button>
      </div>
    </div>

    <!-- Collections list -->
    <div class="flex-1 overflow-y-auto p-2 space-y-1">
      <template v-if="collections.length === 0 && !showNewCollectionInput">
        <div class="text-center text-[var(--color-text-dim)] text-sm py-8">
          <Archive class="w-8 h-8 mx-auto mb-2 opacity-50" />
          <div>No collections yet</div>
          <div class="text-xs mt-1">Click + to create one</div>
        </div>
      </template>

      <CollectionItem
        v-for="collection in collections"
        :key="collection.id"
        :collection="collection"
        @run-request="onRunRequest"
        @edit-request="onEditRequest"
        @new-request="openNewRequestModal"
        @new-folder="openNewFolderModal"
      />
    </div>

    <!-- Footer stats -->
    <div class="p-3 border-t border-[var(--color-border)] text-xs text-[var(--color-text-dim)]">
      <div class="flex justify-between">
        <span>{{ collections.length }} collection(s)</span>
        <span>{{ collectionStore.allRequests.length }} request(s)</span>
      </div>
    </div>

    <!-- New Request Modal -->
    <NewRequestModal
      v-if="showNewRequestModal && targetCollectionId"
      :collection-id="targetCollectionId"
      :folder-id="targetFolderId"
      @close="closeNewRequestModal"
    />

    <!-- New Folder Modal -->
    <NewFolderModal
      v-if="showNewFolderModal && targetCollectionId"
      :collection-id="targetCollectionId"
      @close="closeNewFolderModal"
    />
  </div>
</template>

