<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { useCollectionStore } from '@/stores/collectionStore'
import { useEnvironmentStore } from '@/stores/environmentStore'
import { useConfirmDialog } from '@/composables/useConfirmDialog'
import { useFileExport } from '@/composables/useFileExport'
import BaseModal from '@/components/shared/BaseModal.vue'
import WorkspaceCard from './WorkspaceCard.vue'
import { WORKSPACE_COLORS } from '@/types/workspace'
import type { Workspace } from '@/types/workspace'
import { Plus, Download, Upload } from 'lucide-vue-next'

const props = defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

const workspaceStore = useWorkspaceStore()
const collectionStore = useCollectionStore()
const environmentStore = useEnvironmentStore()
const { confirm } = useConfirmDialog()
const { exportWorkspace: doExportWorkspace, importWorkspace: doImportWorkspace } = useFileExport()

// Modal states
const isCreating = ref(false)
const isEditing = ref<string | null>(null)
const newWorkspaceName = ref('')
const newWorkspaceDescription = ref('')
const newWorkspaceColor = ref<string>(WORKSPACE_COLORS[0])
const importInput = ref<HTMLInputElement | null>(null)

const workspaces = computed(() => workspaceStore.workspaces)

// Get stats for each workspace
function getWorkspaceStats(workspaceId: string) {
  // For the active workspace, we can get counts directly
  if (workspaceId === workspaceStore.activeWorkspaceId) {
    return {
      collectionCount: collectionStore.collections.length,
      environmentCount: environmentStore.environments.length,
    }
  }
  // For other workspaces, we'd need to load from storage
  // For now, show "?" as we don't want to load all workspaces
  return {
    collectionCount: null,
    environmentCount: null,
  }
}

// Reset form state
function resetForm() {
  isCreating.value = false
  isEditing.value = null
  newWorkspaceName.value = ''
  newWorkspaceDescription.value = ''
  newWorkspaceColor.value = WORKSPACE_COLORS[workspaceStore.workspaces.length % WORKSPACE_COLORS.length]
}

// Start creating a new workspace
function startCreate() {
  resetForm()
  isCreating.value = true
  newWorkspaceColor.value = WORKSPACE_COLORS[workspaceStore.workspaces.length % WORKSPACE_COLORS.length]
}

// Start editing a workspace
function startEdit(workspace: Workspace) {
  resetForm()
  isEditing.value = workspace.id
  newWorkspaceName.value = workspace.name
  newWorkspaceDescription.value = workspace.description || ''
  newWorkspaceColor.value = workspace.color || WORKSPACE_COLORS[0]
}

// Save new workspace
function saveNewWorkspace() {
  if (!newWorkspaceName.value.trim()) return

  const workspace = workspaceStore.createWorkspace(
    newWorkspaceName.value.trim(),
    newWorkspaceDescription.value.trim() || undefined,
    newWorkspaceColor.value
  )

  // Switch to new workspace
  switchToWorkspace(workspace.id)
  resetForm()
}

// Save edited workspace
function saveEditedWorkspace() {
  if (!isEditing.value || !newWorkspaceName.value.trim()) return

  workspaceStore.updateWorkspace(isEditing.value, {
    name: newWorkspaceName.value.trim(),
    description: newWorkspaceDescription.value.trim() || undefined,
    color: newWorkspaceColor.value,
  })

  resetForm()
}

// Delete workspace
async function deleteWorkspace(workspaceId: string) {
  const workspace = workspaceStore.getWorkspace(workspaceId)
  if (!workspace) return

  const confirmed = await confirm({
    title: 'Delete Workspace',
    message: `Are you sure you want to delete "${workspace.name}"? This will permanently delete all collections and environments in this workspace.`,
    confirmText: 'Delete',
    variant: 'danger',
  })

  if (confirmed) {
    // If deleting the active workspace, switch first
    if (workspaceId === workspaceStore.activeWorkspaceId) {
      const otherWorkspace = workspaceStore.workspaces.find(w => w.id !== workspaceId)
      if (otherWorkspace) {
        switchToWorkspace(otherWorkspace.id)
      }
    }
    
    workspaceStore.deleteWorkspace(workspaceId)
  }
}

// Switch to a workspace
function switchToWorkspace(workspaceId: string) {
  if (workspaceId === workspaceStore.activeWorkspaceId) return

  // Save current workspace data before switching
  collectionStore.saveToStorage()
  environmentStore.saveToStorage()

  // Switch workspace
  workspaceStore.setActiveWorkspace(workspaceId)

  // Load new workspace data
  collectionStore.setCurrentWorkspaceId(workspaceId)
  collectionStore.loadForWorkspace(workspaceId)
  
  environmentStore.setCurrentWorkspaceId(workspaceId)
  environmentStore.loadForWorkspace(workspaceId)
}

// Export workspace
function exportWorkspace(workspaceId: string) {
  // Can only export active workspace currently
  if (workspaceId === workspaceStore.activeWorkspaceId) {
    doExportWorkspace(workspaceId)
  } else {
    // Switch to workspace first, then export
    switchToWorkspace(workspaceId)
    // Small delay to ensure data is loaded
    setTimeout(() => {
      doExportWorkspace(workspaceId)
    }, 100)
  }
}

// Import workspace
function triggerImport() {
  importInput.value?.click()
}

async function handleImport(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  const result = await doImportWorkspace(file)
  
  if (result.success && result.workspaceId) {
    // Workspace was imported and switched to automatically
  } else if (result.error) {
    console.error('Failed to import workspace:', result.error)
    alert(`Import failed: ${result.error}`)
  }

  input.value = ''
}

// Cancel form
function cancelForm() {
  resetForm()
}

// Reset form when modal closes
watch(() => props.show, (isShown) => {
  if (!isShown) {
    resetForm()
  }
})
</script>

<template>
  <BaseModal
    :show="show"
    title="Workspaces"
    subtitle="Organize your collections and environments"
    max-width="max-w-2xl"
    @close="emit('close')"
  >
    <div class="space-y-4">
      <!-- Create/Edit Form -->
      <div 
        v-if="isCreating || isEditing"
        class="p-4 rounded-lg bg-[var(--color-bg-tertiary)] border border-[var(--color-border)]"
      >
        <h3 class="text-sm font-medium text-[var(--color-text)] mb-3">
          {{ isCreating ? 'New Workspace' : 'Edit Workspace' }}
        </h3>
        
        <div class="space-y-3">
          <!-- Name -->
          <div>
            <label class="block text-xs text-[var(--color-text-dim)] mb-1">Name</label>
            <input
              v-model="newWorkspaceName"
              type="text"
              placeholder="Workspace name..."
              class="w-full px-3 py-2 text-sm bg-[var(--color-bg)] border border-[var(--color-border)] rounded text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] placeholder:text-[var(--color-text-dim)]"
              @keydown.enter="isCreating ? saveNewWorkspace() : saveEditedWorkspace()"
              @keydown.escape="cancelForm"
              autofocus
            />
          </div>
          
          <!-- Description -->
          <div>
            <label class="block text-xs text-[var(--color-text-dim)] mb-1">Description (optional)</label>
            <input
              v-model="newWorkspaceDescription"
              type="text"
              placeholder="A brief description..."
              class="w-full px-3 py-2 text-sm bg-[var(--color-bg)] border border-[var(--color-border)] rounded text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] placeholder:text-[var(--color-text-dim)]"
            />
          </div>
          
          <!-- Color -->
          <div>
            <label class="block text-xs text-[var(--color-text-dim)] mb-1">Color</label>
            <div class="flex gap-2">
              <button
                v-for="color in WORKSPACE_COLORS"
                :key="color"
                class="w-6 h-6 rounded-full transition-transform hover:scale-110"
                :class="{ 'ring-2 ring-[var(--color-primary)] ring-offset-2 ring-offset-[var(--color-bg-tertiary)]': newWorkspaceColor === color }"
                :style="{ backgroundColor: color }"
                @click="newWorkspaceColor = color"
              />
            </div>
          </div>
          
          <!-- Actions -->
          <div class="flex justify-end gap-2 pt-2">
            <button
              class="px-3 py-1.5 text-sm text-[var(--color-text-dim)] hover:text-[var(--color-text)] transition-colors"
              @click="cancelForm"
            >
              Cancel
            </button>
            <button
              :disabled="!newWorkspaceName.trim()"
              class="px-3 py-1.5 text-sm font-medium bg-[var(--color-primary)] text-[var(--color-bg)] rounded hover:bg-[var(--color-primary)]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              @click="isCreating ? saveNewWorkspace() : saveEditedWorkspace()"
            >
              {{ isCreating ? 'Create' : 'Save' }}
            </button>
          </div>
        </div>
      </div>

      <!-- Workspace List -->
      <div v-else class="space-y-2">
        <WorkspaceCard
          v-for="workspace in workspaces"
          :key="workspace.id"
          :workspace="workspace"
          :is-active="workspace.id === workspaceStore.activeWorkspaceId"
          :collection-count="getWorkspaceStats(workspace.id).collectionCount"
          :environment-count="getWorkspaceStats(workspace.id).environmentCount"
          :can-delete="workspaces.length > 1"
          @select="switchToWorkspace(workspace.id)"
          @edit="startEdit(workspace)"
          @delete="deleteWorkspace(workspace.id)"
          @export="exportWorkspace(workspace.id)"
        />
      </div>
    </div>

    <!-- Footer -->
    <template #footer>
      <div class="flex items-center gap-2 w-full">
        <!-- Import -->
        <button
          class="flex items-center gap-1.5 px-3 py-1.5 text-sm text-[var(--color-text-dim)] hover:text-[var(--color-text)] transition-colors"
          @click="triggerImport"
        >
          <Download class="w-4 h-4" />
          Import
        </button>
        <input
          ref="importInput"
          type="file"
          accept=".json"
          class="hidden"
          @change="handleImport"
        />
        
        <div class="flex-1" />
        
        <!-- Create -->
        <button
          v-if="!isCreating && !isEditing"
          class="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-[var(--color-primary)] text-[var(--color-bg)] rounded hover:bg-[var(--color-primary)]/90 transition-colors"
          @click="startCreate"
        >
          <Plus class="w-4 h-4" />
          New Workspace
        </button>
      </div>
    </template>
  </BaseModal>
</template>
