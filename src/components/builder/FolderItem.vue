<script setup lang="ts">
import { ref, computed, watch, onUnmounted, nextTick } from 'vue'
import type { CollectionFolder, CollectionRequest, HttpAuth } from '@/types'
import { useCollectionStore } from '@/stores/collectionStore'
import { useRequestStore } from '@/stores/requestStore'
import RequestItem from './RequestItem.vue'
import AuthTab from './AuthTab.vue'
import draggable from 'vuedraggable'
import { 
  ChevronRight, 
  Folder, 
  FolderOpen,
  FilePlus, 
  MoreVertical, 
  Pencil, 
  Trash2,
  GripVertical,
  Lock,
  X
} from 'lucide-vue-next'

const props = defineProps<{
  folder: CollectionFolder
  collectionId: string
  requests: CollectionRequest[]
}>()

const emit = defineEmits<{
  'run-request': [requestId: string]
  'edit-request': [requestId: string]
  'new-request': [folderId: string]
}>()

const collectionStore = useCollectionStore()
const requestStore = useRequestStore()

const showMenu = ref(false)
const isRenaming = ref(false)
const renameInput = ref('')
const menuRef = ref<HTMLElement | null>(null)
const showAuthModal = ref(false)
const localAuth = ref<HttpAuth | undefined>(undefined)

const isSelected = computed(() => collectionStore.selectedFolderId === props.folder.id)
const isCollapsed = computed(() => props.folder.collapsed)
const hasAuth = computed(() => collectionStore.hasFolderAuth(props.collectionId, props.folder.id))
const authTypeLabel = computed(() => {
  const auth = props.folder.auth
  if (!auth || auth.type === 'none') return null
  const labels: Record<string, string> = {
    'basic': 'Basic',
    'bearer': 'Bearer',
    'api-key': 'API Key',
    'oauth2': 'OAuth2',
  }
  return labels[auth.type] || null
})

// Local array for draggable - keeps in sync with props.requests
const localRequests = ref<CollectionRequest[]>([...props.requests])

// Watch for external changes to requests prop and sync local array
watch(() => props.requests, (newRequests) => {
  // Only update if the arrays are different (to avoid infinite loops)
  const newIds = newRequests.map(r => r.id).join(',')
  const localIds = localRequests.value.map(r => r.id).join(',')
  if (newIds !== localIds) {
    localRequests.value = [...newRequests]
  }
}, { deep: true })

// Handle request reorder within folder on drag end
function onFolderRequestDragEnd() {
  // Get all requests from this collection
  const collection = collectionStore.collections.find(c => c.id === props.collectionId)
  if (!collection) return

  // Get requests NOT in this folder
  const otherRequests = collection.requests.filter(r => r.folderId !== props.folder.id)
  
  // Combine with current folder requests (already reordered by vuedraggable in localRequests)
  collectionStore.reorderRequests(props.collectionId, [...otherRequests, ...localRequests.value])
}

function toggleCollapse() {
  collectionStore.toggleFolderCollapse(props.collectionId, props.folder.id)
}

function selectFolder() {
  collectionStore.selectFolder(props.collectionId, props.folder.id)
}

function startRename() {
  renameInput.value = props.folder.name
  isRenaming.value = true
  showMenu.value = false
}

function finishRename() {
  if (renameInput.value.trim()) {
    collectionStore.updateFolder(props.collectionId, props.folder.id, { name: renameInput.value.trim() })
  }
  isRenaming.value = false
}

function cancelRename() {
  isRenaming.value = false
}

function deleteFolder() {
  if (confirm(`Delete folder "${props.folder.name}"? Requests will be moved to the collection root.`)) {
    collectionStore.deleteFolder(props.collectionId, props.folder.id)
  }
  showMenu.value = false
}

function addRequest() {
  emit('new-request', props.folder.id)
  showMenu.value = false
}

function openAuthModal() {
  localAuth.value = props.folder.auth ? JSON.parse(JSON.stringify(props.folder.auth)) : undefined
  showAuthModal.value = true
  showMenu.value = false
}

function saveAuth() {
  collectionStore.setFolderAuth(props.collectionId, props.folder.id, localAuth.value)
  showAuthModal.value = false
}

function closeAuthModal() {
  showAuthModal.value = false
}

function onAuthUpdate(auth: HttpAuth | undefined) {
  localAuth.value = auth
}

function selectRequest(requestId: string) {
  requestStore.clearSelection()
  collectionStore.selectRequest(props.collectionId, requestId)
}

function runRequest(requestId: string) {
  emit('run-request', requestId)
}

function editRequest(requestId: string) {
  emit('edit-request', requestId)
}

function duplicateRequest(requestId: string) {
  collectionStore.duplicateRequest(props.collectionId, requestId)
}

function deleteRequest(requestId: string) {
  const request = props.requests.find(r => r.id === requestId)
  if (request && confirm(`Delete request "${request.name}"?`)) {
    collectionStore.deleteRequest(props.collectionId, requestId)
  }
}

// Handle request added to this folder (dropped from root or another folder)
function onRequestAdd(evt: { added?: { newIndex: number; element: CollectionRequest } }) {
  // The @add event wraps the data in an 'added' property
  const added = evt.added
  if (!added?.element?.id) return
  
  // Request was dropped here - update its folderId
  collectionStore.moveRequestToFolder(props.collectionId, added.element.id, props.folder.id)
}

// Refs for dropdown menu (teleported to body)
const folderDropdownRef = ref<HTMLElement | null>(null)

// Close menu when clicking outside the dropdown
function onClickOutside(e: MouseEvent) {
  const target = e.target as Node
  if (folderDropdownRef.value && !folderDropdownRef.value.contains(target)) {
    showMenu.value = false
  }
}

// Add/remove click listener when menu opens/closes
// Use capture: true to catch events before @click.stop can prevent them
watch(showMenu, (isOpen) => {
  if (isOpen) {
    nextTick(() => {
      document.addEventListener('click', onClickOutside, true)
    })
  } else {
    document.removeEventListener('click', onClickOutside, true)
  }
})

// Cleanup on unmount
onUnmounted(() => {
  document.removeEventListener('click', onClickOutside, true)
})
</script>

<template>
  <div class="folder-item">
    <!-- Folder header -->
    <div 
      class="flex items-center gap-1 px-2 py-1 rounded cursor-pointer group transition-colors"
      :class="[
        isSelected 
          ? 'bg-[var(--color-secondary)]/10' 
          : 'hover:bg-[var(--color-bg-tertiary)]'
      ]"
      @click="selectFolder"
    >
      <!-- Drag handle for folder -->
      <div class="folder-drag-handle cursor-grab opacity-0 group-hover:opacity-50 hover:!opacity-100 shrink-0">
        <GripVertical class="w-3 h-3 text-[var(--color-text-dim)]" />
      </div>

      <!-- Collapse toggle -->
      <button
        class="p-0.5 rounded hover:bg-[var(--color-bg-tertiary)] transition-transform duration-200 shrink-0"
        :class="{ 'rotate-90': !isCollapsed }"
        @click.stop="toggleCollapse"
      >
        <ChevronRight class="w-3 h-3 text-[var(--color-text-dim)]" />
      </button>

      <!-- Folder icon -->
      <component 
        :is="isCollapsed ? Folder : FolderOpen" 
        class="w-4 h-4 text-[var(--color-secondary)] shrink-0" 
      />

      <!-- Folder name -->
      <div class="flex-1 min-w-0">
        <template v-if="isRenaming">
          <input
            v-model="renameInput"
            type="text"
            class="w-full px-1 py-0.5 text-xs bg-[var(--color-bg)] border border-[var(--color-secondary)] rounded text-[var(--color-text)] outline-none"
            @keydown.enter="finishRename"
            @keydown.escape="cancelRename"
            @blur="finishRename"
            autofocus
          />
        </template>
        <template v-else>
          <span class="text-xs font-medium text-[var(--color-text)] truncate block">
            {{ folder.name }}
          </span>
        </template>
      </div>

      <!-- Auth badge -->
      <span 
        v-if="hasAuth"
        class="px-1 py-0.5 text-[9px] font-medium rounded bg-[var(--color-warning)]/20 text-[var(--color-warning)] shrink-0"
        :title="`Auth: ${authTypeLabel}`"
      >
        <Lock class="w-2.5 h-2.5 inline-block" />
      </span>

      <!-- Request count -->
      <span class="text-[10px] text-[var(--color-text-dim)] shrink-0">
        {{ requests.length }}
      </span>

      <!-- Context menu button -->
      <div class="relative" ref="menuRef">
        <button
          class="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-[var(--color-bg)] transition-opacity shrink-0"
          @click.stop="showMenu = !showMenu"
        >
          <MoreVertical class="w-3 h-3 text-[var(--color-text-dim)]" />
        </button>

        <!-- Dropdown menu -->
        <Teleport to="body">
          <div
            v-if="showMenu"
            ref="folderDropdownRef"
            class="fixed z-[200] min-w-[160px] py-1 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded shadow-xl"
            :style="{
              top: menuRef ? `${menuRef.getBoundingClientRect().bottom + 4}px` : '0',
              left: menuRef ? `${menuRef.getBoundingClientRect().left - 120}px` : '0'
            }"
          >
            <button
              class="w-full px-3 py-1.5 text-left text-sm text-[var(--color-text)] hover:bg-[var(--color-bg-tertiary)] flex items-center gap-2"
              @click="addRequest"
            >
              <FilePlus class="w-4 h-4" />
              New Request
            </button>
            <button
              class="w-full px-3 py-1.5 text-left text-sm text-[var(--color-text)] hover:bg-[var(--color-bg-tertiary)] flex items-center gap-2"
              @click="openAuthModal"
            >
              <Lock class="w-4 h-4" />
              Configure Auth
              <span v-if="hasAuth" class="ml-auto text-[10px] text-[var(--color-warning)]">{{ authTypeLabel }}</span>
            </button>
            <div class="my-1 border-t border-[var(--color-border)]" />
            <button
              class="w-full px-3 py-1.5 text-left text-sm text-[var(--color-text)] hover:bg-[var(--color-bg-tertiary)] flex items-center gap-2"
              @click="startRename"
            >
              <Pencil class="w-4 h-4" />
              Rename
            </button>
            <button
              class="w-full px-3 py-1.5 text-left text-sm text-[var(--color-error)] hover:bg-[var(--color-bg-tertiary)] flex items-center gap-2"
              @click="deleteFolder"
            >
              <Trash2 class="w-4 h-4" />
              Delete
            </button>
          </div>
        </Teleport>
      </div>
    </div>

    <!-- Collapsible content -->
    <div 
      class="grid transition-[grid-template-rows] duration-200 ease-out"
      :class="isCollapsed ? 'grid-rows-[0fr]' : 'grid-rows-[1fr]'"
    >
      <div class="overflow-hidden">
        <div class="pl-5 space-y-0.5 mt-0.5">
          <!-- Requests in folder (draggable) -->
          <draggable
            v-model="localRequests"
            :group="{ name: 'requests-' + collectionId }"
            item-key="id"
            handle=".drag-handle"
            :animation="200"
            ghost-class="opacity-50"
            @end="onFolderRequestDragEnd"
            @add="onRequestAdd"
          >
            <template #item="{ element: request }">
              <RequestItem
                :request="request"
                :collection-id="collectionId"
                :is-selected="collectionStore.selectedRequestId === request.id"
                @select="selectRequest(request.id)"
                @edit="editRequest(request.id)"
                @run="runRequest(request.id)"
                @duplicate="duplicateRequest(request.id)"
                @delete="deleteRequest(request.id)"
              />
            </template>
          </draggable>

          <!-- Empty state -->
          <div
            v-if="requests.length === 0"
            class="text-[10px] text-[var(--color-text-dim)] px-2 py-1 italic"
          >
            No requests
          </div>
        </div>
      </div>
    </div>

    <!-- Auth Modal -->
    <Teleport to="body">
      <div
        v-if="showAuthModal"
        class="fixed inset-0 z-[300] flex items-center justify-center bg-black/50"
        @click.self="closeAuthModal"
      >
        <div class="w-full max-w-md bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg shadow-2xl">
          <!-- Modal Header -->
          <div class="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
            <div>
              <h3 class="text-sm font-bold text-[var(--color-text)]">Folder Authentication</h3>
              <p class="text-[10px] text-[var(--color-text-dim)]">{{ folder.name }} - Requests will inherit this auth</p>
            </div>
            <button
              class="p-1 rounded hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-dim)] hover:text-[var(--color-text)]"
              @click="closeAuthModal"
            >
              <X class="w-4 h-4" />
            </button>
          </div>

          <!-- Modal Body -->
          <div class="p-4 max-h-[60vh] overflow-y-auto">
            <AuthTab
              :auth="localAuth"
              @update:auth="onAuthUpdate"
            />
          </div>

          <!-- Modal Footer -->
          <div class="flex justify-end gap-2 px-4 py-3 border-t border-[var(--color-border)]">
            <button
              class="px-3 py-1.5 text-xs text-[var(--color-text-dim)] hover:text-[var(--color-text)] rounded"
              @click="closeAuthModal"
            >
              Cancel
            </button>
            <button
              class="px-3 py-1.5 text-xs bg-[var(--color-primary)] text-[var(--color-bg)] rounded font-medium hover:brightness-110"
              @click="saveAuth"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
