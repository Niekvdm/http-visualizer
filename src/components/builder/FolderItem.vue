<script setup lang="ts">
import { ref, computed, watch, onUnmounted, nextTick } from 'vue'
import type { CollectionFolder, CollectionRequest } from '@/types'
import { useCollectionStore } from '@/stores/collectionStore'
import { useRequestStore } from '@/stores/requestStore'
import { getMethodColor } from '@/utils/formatters'
import { 
  ChevronRight, 
  Folder, 
  FolderOpen,
  FilePlus, 
  MoreVertical, 
  Pencil, 
  Trash2, 
  Play,
  Copy
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

// Request menu state
const showRequestMenu = ref<string | null>(null)
const requestMenuRef = ref<HTMLElement | null>(null)

const isSelected = computed(() => collectionStore.selectedFolderId === props.folder.id)
const isCollapsed = computed(() => props.folder.collapsed)

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

// Request menu actions
function duplicateRequest(requestId: string) {
  collectionStore.duplicateRequest(props.collectionId, requestId)
  showRequestMenu.value = null
}

function deleteRequest(requestId: string) {
  const request = props.requests.find(r => r.id === requestId)
  if (request && confirm(`Delete request "${request.name}"?`)) {
    collectionStore.deleteRequest(props.collectionId, requestId)
  }
  showRequestMenu.value = null
}

function toggleRequestMenu(requestId: string) {
  showRequestMenu.value = showRequestMenu.value === requestId ? null : requestId
}

// Refs for dropdown menus (teleported to body)
const folderDropdownRef = ref<HTMLElement | null>(null)
const requestDropdownRef = ref<HTMLElement | null>(null)

// Close menu when clicking outside the dropdown
function onClickOutside(e: MouseEvent) {
  const target = e.target as Node
  if (folderDropdownRef.value && !folderDropdownRef.value.contains(target)) {
    showMenu.value = false
  }
}

// Close request menu when clicking outside the dropdown
function onRequestMenuClickOutside(e: MouseEvent) {
  const target = e.target as Node
  if (requestDropdownRef.value && !requestDropdownRef.value.contains(target)) {
    showRequestMenu.value = null
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

// Add/remove click listener when request menu opens/closes
watch(showRequestMenu, (requestId) => {
  if (requestId) {
    nextTick(() => {
      document.addEventListener('click', onRequestMenuClickOutside, true)
    })
  } else {
    document.removeEventListener('click', onRequestMenuClickOutside, true)
  }
})

// Cleanup on unmount
onUnmounted(() => {
  document.removeEventListener('click', onClickOutside, true)
  document.removeEventListener('click', onRequestMenuClickOutside, true)
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
          <!-- Requests in folder -->
          <div
            v-for="request in requests"
            :key="request.id"
            class="flex items-center gap-2 px-2 py-1 rounded cursor-pointer group transition-colors select-none"
            :class="[
              collectionStore.selectedRequestId === request.id
                ? 'bg-[var(--color-primary)]/15 border border-[var(--color-primary)]/40'
                : 'hover:bg-[var(--color-bg-tertiary)] border border-transparent'
            ]"
            @click="selectRequest(request.id)"
            @dblclick="editRequest(request.id)"
          >
            <span 
              class="text-[9px] font-bold px-1 py-0.5 rounded bg-[var(--color-bg)] font-mono shrink-0"
              :class="getMethodColor(request.method)"
            >
              {{ request.method }}
            </span>
            <span class="text-xs text-[var(--color-text)] truncate flex-1">
              {{ request.name }}
            </span>
            <button
              class="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-[var(--color-primary)]/20 transition-opacity shrink-0"
              title="Run request"
              @click.stop="runRequest(request.id)"
            >
              <Play class="w-3.5 h-3.5 text-[var(--color-primary)]" />
            </button>
            
            <!-- Request context menu -->
            <div class="relative" :ref="el => { if (showRequestMenu === request.id) requestMenuRef = el as HTMLElement }">
              <button
                class="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-[var(--color-bg)] transition-opacity shrink-0"
                title="More options"
                @click.stop="toggleRequestMenu(request.id)"
              >
                <MoreVertical class="w-3.5 h-3.5 text-[var(--color-text-dim)]" />
              </button>

              <!-- Request dropdown menu -->
              <Teleport to="body">
                <div
                  v-if="showRequestMenu === request.id"
                  :ref="el => { requestDropdownRef = el as HTMLElement }"
                  class="fixed z-[200] min-w-[160px] py-1 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded shadow-xl"
                  :style="{
                    top: requestMenuRef ? `${requestMenuRef.getBoundingClientRect().bottom + 4}px` : '0',
                    left: requestMenuRef ? `${requestMenuRef.getBoundingClientRect().left - 100}px` : '0'
                  }"
                >
                  <button
                    class="w-full px-3 py-1.5 text-left text-sm text-[var(--color-text)] hover:bg-[var(--color-bg-tertiary)] flex items-center gap-2"
                    @click="editRequest(request.id); showRequestMenu = null"
                  >
                    <Pencil class="w-4 h-4" />
                    Edit
                  </button>
                  <button
                    class="w-full px-3 py-1.5 text-left text-sm text-[var(--color-text)] hover:bg-[var(--color-bg-tertiary)] flex items-center gap-2"
                    @click="runRequest(request.id); showRequestMenu = null"
                  >
                    <Play class="w-4 h-4" />
                    Run
                  </button>
                  <button
                    class="w-full px-3 py-1.5 text-left text-sm text-[var(--color-text)] hover:bg-[var(--color-bg-tertiary)] flex items-center gap-2"
                    @click="duplicateRequest(request.id)"
                  >
                    <Copy class="w-4 h-4" />
                    Duplicate
                  </button>
                  <div class="my-1 border-t border-[var(--color-border)]" />
                  <button
                    class="w-full px-3 py-1.5 text-left text-sm text-[var(--color-error)] hover:bg-[var(--color-bg-tertiary)] flex items-center gap-2"
                    @click="deleteRequest(request.id)"
                  >
                    <Trash2 class="w-4 h-4" />
                    Delete
                  </button>
                </div>
              </Teleport>
            </div>
          </div>

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
  </div>
</template>

