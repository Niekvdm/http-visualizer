<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { CollectionFolder, CollectionRequest, HttpAuth } from '@/types'
import { useCollectionStore } from '@/stores/collectionStore'
import { useRequestStore } from '@/stores/requestStore'
import { useDropdownMenu } from '@/composables/useDropdownMenu'
import { useConfirmDialog, confirmActions } from '@/composables/useConfirmDialog'
import RequestItem from './RequestItem.vue'
import AuthTab from './AuthTab.vue'
import BaseModal from '@/components/shared/BaseModal.vue'
import DropdownMenu from '@/components/shared/DropdownMenu.vue'
import DropdownMenuItem from '@/components/shared/DropdownMenuItem.vue'
import DropdownDivider from '@/components/shared/DropdownDivider.vue'
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
  Lock
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
const { confirm } = useConfirmDialog()

// Dropdown menu
const menuRef = ref<HTMLElement | null>(null)
const { isOpen: showMenu, toggle: toggleMenu, close: closeMenu } = useDropdownMenu(menuRef, {
  align: 'right',
  alignOffset: 120,
})

// Rename state
const isRenaming = ref(false)
const renameInput = ref('')

// Auth modal state
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
  const newIds = newRequests.map(r => r.id).join(',')
  const localIds = localRequests.value.map(r => r.id).join(',')
  if (newIds !== localIds) {
    localRequests.value = [...newRequests]
  }
}, { deep: true })

// Handle request reorder within folder on drag end
function onFolderRequestDragEnd() {
  const collection = collectionStore.collections.find(c => c.id === props.collectionId)
  if (!collection) return

  const otherRequests = collection.requests.filter(r => r.folderId !== props.folder.id)
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
  closeMenu()
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

async function deleteFolder() {
  closeMenu()
  const confirmed = await confirm(
    confirmActions.deleteWithWarning(props.folder.name, 'Requests will be moved to the collection root.')
  )
  if (confirmed) {
    collectionStore.deleteFolder(props.collectionId, props.folder.id)
  }
}

function addRequest() {
  emit('new-request', props.folder.id)
  closeMenu()
}

function openAuthModal() {
  localAuth.value = props.folder.auth ? JSON.parse(JSON.stringify(props.folder.auth)) : undefined
  showAuthModal.value = true
  closeMenu()
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

async function deleteRequest(requestId: string) {
  const request = props.requests.find(r => r.id === requestId)
  if (request) {
    const confirmed = await confirm(confirmActions.delete(request.name))
    if (confirmed) {
      collectionStore.deleteRequest(props.collectionId, requestId)
    }
  }
}

// Handle request added to this folder (dropped from root or another folder)
function onRequestAdd(evt: { added?: { newIndex: number; element: CollectionRequest } }) {
  const added = evt.added
  if (!added?.element?.id) return
  collectionStore.moveRequestToFolder(props.collectionId, added.element.id, props.folder.id)
}
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
          @click.stop="toggleMenu"
        >
          <MoreVertical class="w-3 h-3 text-[var(--color-text-dim)]" />
        </button>

        <DropdownMenu
          v-model="showMenu"
          :trigger-ref="menuRef"
          align="right"
          :align-offset="120"
        >
          <DropdownMenuItem :icon="FilePlus" @click="addRequest">
            New Request
          </DropdownMenuItem>
          <DropdownMenuItem :icon="Lock" @click="openAuthModal">
            Configure Auth
            <span v-if="hasAuth" class="ml-auto text-[10px] text-[var(--color-warning)]">{{ authTypeLabel }}</span>
          </DropdownMenuItem>
          <DropdownDivider />
          <DropdownMenuItem :icon="Pencil" @click="startRename">
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem :icon="Trash2" danger @click="deleteFolder">
            Delete
          </DropdownMenuItem>
        </DropdownMenu>
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
    <BaseModal
      :show="showAuthModal"
      title="Folder Authentication"
      :subtitle="`${folder.name} - Requests will inherit this auth`"
      max-width="max-w-md"
      @close="closeAuthModal"
    >
      <AuthTab
        :auth="localAuth"
        @update:auth="onAuthUpdate"
      />

      <template #footer>
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
      </template>
    </BaseModal>
  </div>
</template>
