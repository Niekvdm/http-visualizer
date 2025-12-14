import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { Workspace, WorkspaceMetadata } from '@/types/workspace'
import { WORKSPACE_COLORS } from '@/types/workspace'
import { generateId } from '@/utils/formatters'
import { createStorageService } from '@/composables/useStoragePersistence'

// Default workspace ID constant
export const DEFAULT_WORKSPACE_ID = 'default-workspace'

// Storage service for workspace list and active workspace
const workspaceStorage = createStorageService<{
  workspaces: Workspace[]
  activeWorkspaceId: string | null
  hasMigrated: boolean
}>('workspaces', 'workspaces')

export const useWorkspaceStore = defineStore('workspaces', () => {
  // State
  const workspaces = ref<Workspace[]>([])
  const activeWorkspaceId = ref<string | null>(null)
  const isInitialized = ref(false)
  const hasMigrated = ref(false)

  // Computed
  const activeWorkspace = computed(() => {
    if (!activeWorkspaceId.value) return null
    return workspaces.value.find(w => w.id === activeWorkspaceId.value) || null
  })

  const workspaceList = computed(() => {
    return workspaces.value.map(w => ({
      id: w.id,
      name: w.name,
      description: w.description,
      color: w.color,
    }))
  })

  // Initialize from storage (sync for browser)
  function initFromStorageSync() {
    const data = workspaceStorage.loadSync()
    if (data) {
      if (data.workspaces && Array.isArray(data.workspaces)) {
        workspaces.value = data.workspaces
      }
      if (data.activeWorkspaceId) {
        activeWorkspaceId.value = data.activeWorkspaceId
      }
      if (data.hasMigrated !== undefined) {
        hasMigrated.value = data.hasMigrated
      }
    }

    // If no workspaces exist, create the default one
    if (workspaces.value.length === 0) {
      createDefaultWorkspace()
    }

    // Ensure we have an active workspace
    if (!activeWorkspaceId.value || !workspaces.value.find(w => w.id === activeWorkspaceId.value)) {
      activeWorkspaceId.value = workspaces.value[0]?.id || null
    }
  }

  // Async initialization for Wails mode
  async function initialize() {
    if (isInitialized.value) return

    const data = await workspaceStorage.load()
    if (data) {
      if (data.workspaces && Array.isArray(data.workspaces)) {
        workspaces.value = data.workspaces
      }
      if (data.activeWorkspaceId) {
        activeWorkspaceId.value = data.activeWorkspaceId
      }
      if (data.hasMigrated !== undefined) {
        hasMigrated.value = data.hasMigrated
      }
    }

    // If no workspaces exist, create the default one
    if (workspaces.value.length === 0) {
      createDefaultWorkspace()
    }

    // Ensure we have an active workspace
    if (!activeWorkspaceId.value || !workspaces.value.find(w => w.id === activeWorkspaceId.value)) {
      activeWorkspaceId.value = workspaces.value[0]?.id || null
    }

    isInitialized.value = true
  }

  // Save to storage
  function saveToStorage() {
    workspaceStorage.save({
      workspaces: workspaces.value,
      activeWorkspaceId: activeWorkspaceId.value,
      hasMigrated: hasMigrated.value,
    }).catch((err) => {
      console.error('Failed to save workspace state:', err)
    })
  }

  // Watch for changes and auto-save
  watch(
    [workspaces, activeWorkspaceId, hasMigrated],
    () => {
      saveToStorage()
    },
    { deep: true }
  )

  // Create default workspace
  function createDefaultWorkspace(): Workspace {
    const now = Date.now()
    const workspace: Workspace = {
      id: DEFAULT_WORKSPACE_ID,
      name: 'Default Workspace',
      description: 'Your default workspace',
      color: WORKSPACE_COLORS[0],
      createdAt: now,
      updatedAt: now,
    }
    workspaces.value.push(workspace)
    activeWorkspaceId.value = workspace.id
    return workspace
  }

  // CRUD Operations
  function createWorkspace(name: string, description?: string, color?: string): Workspace {
    const now = Date.now()
    const workspace: Workspace = {
      id: generateId(),
      name,
      description,
      color: color || WORKSPACE_COLORS[workspaces.value.length % WORKSPACE_COLORS.length],
      createdAt: now,
      updatedAt: now,
    }
    workspaces.value.push(workspace)
    return workspace
  }

  function updateWorkspace(id: string, updates: Partial<Omit<Workspace, 'id' | 'createdAt'>>) {
    const workspace = workspaces.value.find(w => w.id === id)
    if (workspace) {
      Object.assign(workspace, updates, { updatedAt: Date.now() })
    }
  }

  function deleteWorkspace(id: string): boolean {
    // Don't delete the last workspace
    if (workspaces.value.length <= 1) {
      return false
    }

    const index = workspaces.value.findIndex(w => w.id === id)
    if (index >= 0) {
      workspaces.value.splice(index, 1)

      // If deleted workspace was active, switch to first available
      if (activeWorkspaceId.value === id) {
        activeWorkspaceId.value = workspaces.value[0]?.id || null
      }
      return true
    }
    return false
  }

  function setActiveWorkspace(id: string) {
    if (workspaces.value.find(w => w.id === id)) {
      activeWorkspaceId.value = id
    }
  }

  function getWorkspace(id: string): Workspace | null {
    return workspaces.value.find(w => w.id === id) || null
  }

  // Get workspace metadata with counts (counts will be provided by caller)
  function getWorkspaceMetadata(
    id: string,
    collectionCount: number,
    environmentCount: number
  ): WorkspaceMetadata | null {
    const workspace = workspaces.value.find(w => w.id === id)
    if (!workspace) return null

    return {
      id: workspace.id,
      name: workspace.name,
      description: workspace.description,
      color: workspace.color,
      collectionCount,
      environmentCount,
      createdAt: workspace.createdAt,
      updatedAt: workspace.updatedAt,
    }
  }

  // Mark migration as complete
  function markMigrationComplete() {
    hasMigrated.value = true
  }

  // Check if migration is needed
  function needsMigration(): boolean {
    return !hasMigrated.value
  }

  // Import workspace (for workspace import feature)
  function importWorkspace(workspace: Workspace): Workspace {
    // Check if workspace with same ID exists
    const existing = workspaces.value.find(w => w.id === workspace.id)
    if (existing) {
      // Generate new ID for imported workspace
      workspace = {
        ...workspace,
        id: generateId(),
        name: `${workspace.name} (imported)`,
        updatedAt: Date.now(),
      }
    }
    workspaces.value.push(workspace)
    return workspace
  }

  // Initialize on store creation (sync for browser)
  initFromStorageSync()

  return {
    // State
    workspaces,
    activeWorkspaceId,
    isInitialized,
    hasMigrated,

    // Computed
    activeWorkspace,
    workspaceList,

    // Actions
    initialize,
    createWorkspace,
    updateWorkspace,
    deleteWorkspace,
    setActiveWorkspace,
    getWorkspace,
    getWorkspaceMetadata,
    markMigrationComplete,
    needsMigration,
    importWorkspace,
    saveToStorage,
  }
})
